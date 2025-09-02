import { db } from '@/lib/firebase'
import {
  doc,
  updateDoc,
  onSnapshot,
  serverTimestamp,
  collection,
  addDoc,
  query,
  where,
  orderBy,
  limit,
  deleteDoc,
  setDoc,
  getDoc
} from 'firebase/firestore'

interface CollaborativeAction {
  id?: string
  sessionId: string
  wheelId: string
  action: 'start_spin' | 'end_session' | 'change_settings' | 'select_winners' | 'broadcast_message'
  performedBy: string
  performedByName: string
  timestamp: any
  parameters?: any
  status: 'pending' | 'executing' | 'completed' | 'cancelled' | 'conflicted'
  lockExpiry?: number
  conflictReason?: string
}

interface OrganizerPresence {
  uid: string
  name: string
  email: string
  isOnline: boolean
  lastSeen: number
  currentAction?: string
  permissions: {
    canControlLive: boolean
    canEditWheel: boolean
    canManageParticipants: boolean
  }
}

interface LiveRoomLock {
  action: string
  lockedBy: string
  lockedByName: string
  lockedAt: number
  expiresAt: number
  sessionId: string
}

class CollaborativeLiveRoomManager {
  private static instance: CollaborativeLiveRoomManager
  private sessionListeners: Map<string, () => void> = new Map()
  private lockCheckInterval: NodeJS.Timeout | null = null

  private constructor() {
    // Start lock cleanup interval
    this.lockCheckInterval = setInterval(() => {
      this.cleanupExpiredLocks()
    }, 5000) // Check every 5 seconds
  }

  static getInstance(): CollaborativeLiveRoomManager {
    if (!CollaborativeLiveRoomManager.instance) {
      CollaborativeLiveRoomManager.instance = new CollaborativeLiveRoomManager()
    }
    return CollaborativeLiveRoomManager.instance
  }

  /**
   * Check if an organizer has permission to perform an action
   */
  private async hasPermission(
    organizerUid: string, 
    wheelId: string, 
    action: string
  ): Promise<{ allowed: boolean; reason?: string }> {
    try {
      // Check if organizer is wheel owner
      const wheelDoc = await getDoc(doc(db, 'wheels', wheelId))
      if (!wheelDoc.exists()) {
        return { allowed: false, reason: 'Wheel not found' }
      }

      const wheelData = wheelDoc.data()
      
      // Owner always has full permissions
      if (wheelData.userId === organizerUid) {
        return { allowed: true }
      }

      // Check if organizer is in collaborators list
      const collaboratorDetails = wheelData.collaboratorDetails || []
      const collaborator = collaboratorDetails.find((c: any) => c.uid === organizerUid)
      
      if (!collaborator) {
        return { allowed: false, reason: 'Not authorized as collaborator' }
      }

      // Check specific permissions
      const permissions = collaborator.permissions || {}
      
      switch (action) {
        case 'start_spin':
        case 'select_winners':
        case 'broadcast_message':
          return {
            allowed: permissions.canControlLive === true,
            reason: permissions.canControlLive ? undefined : 'Missing live control permission'
          }
        case 'change_settings':
          return {
            allowed: permissions.canEditWheel === true,
            reason: permissions.canEditWheel ? undefined : 'Missing wheel edit permission'
          }
        case 'end_session':
          return {
            allowed: permissions.canControlLive === true,
            reason: permissions.canControlLive ? undefined : 'Missing live control permission'
          }
        default:
          return { allowed: false, reason: 'Unknown action' }
      }
    } catch (error) {
      console.error('Permission check error:', error)
      return { allowed: false, reason: 'Permission check failed' }
    }
  }

  /**
   * Acquire a lock for performing an action
   */
  private async acquireLock(
    sessionId: string,
    action: string,
    organizerUid: string,
    organizerName: string,
    duration: number = 30000 // 30 seconds default
  ): Promise<{ success: boolean; reason?: string; conflictWith?: string }> {
    try {
      const lockId = `${sessionId}_${action}`
      const lockRef = doc(db, 'liveLocks', lockId)
      
      // Check if lock already exists
      const existingLock = await getDoc(lockRef)
      
      if (existingLock.exists()) {
        const lockData = existingLock.data() as LiveRoomLock
        const now = Date.now()
        
        // Check if lock has expired
        if (lockData.expiresAt < now) {
          // Lock expired, we can acquire it
          await deleteDoc(lockRef)
        } else {
          // Lock still active
          if (lockData.lockedBy === organizerUid) {
            // Same organizer, extend the lock
            await updateDoc(lockRef, {
              expiresAt: now + duration,
              lastExtended: now
            })
            return { success: true }
          } else {
            // Different organizer has the lock
            return {
              success: false,
              reason: `Action locked by ${lockData.lockedByName}`,
              conflictWith: lockData.lockedBy
            }
          }
        }
      }

      // Create new lock
      const now = Date.now()
      const newLock: LiveRoomLock = {
        action,
        lockedBy: organizerUid,
        lockedByName: organizerName,
        lockedAt: now,
        expiresAt: now + duration,
        sessionId
      }

      await setDoc(lockRef, newLock)
      return { success: true }
    } catch (error) {
      console.error('Lock acquisition error:', error)
      return { success: false, reason: 'Failed to acquire lock' }
    }
  }

  /**
   * Release a lock
   */
  private async releaseLock(sessionId: string, action: string, organizerUid: string): Promise<void> {
    try {
      const lockId = `${sessionId}_${action}`
      const lockRef = doc(db, 'liveLocks', lockId)
      
      const existingLock = await getDoc(lockRef)
      if (existingLock.exists()) {
        const lockData = existingLock.data() as LiveRoomLock
        
        // Only release if we own the lock
        if (lockData.lockedBy === organizerUid) {
          await deleteDoc(lockRef)
        }
      }
    } catch (error) {
      console.error('Lock release error:', error)
    }
  }

  /**
   * Clean up expired locks
   */
  private async cleanupExpiredLocks(): Promise<void> {
    try {
      // This would normally use a query, but for simplicity we'll handle it
      // in a real implementation, you might want to use Cloud Functions for this
      console.log('Cleaning up expired locks...')
    } catch (error) {
      console.error('Lock cleanup error:', error)
    }
  }

  /**
   * Execute a collaborative action with conflict prevention
   */
  async executeCollaborativeAction(
    action: Omit<CollaborativeAction, 'id' | 'timestamp' | 'status'>
  ): Promise<{ success: boolean; message: string; actionId?: string }> {
    const { sessionId, wheelId, action: actionType, performedBy, performedByName } = action
    
    try {
      // 1. Check permissions
      const permissionCheck = await this.hasPermission(performedBy, wheelId, actionType)
      if (!permissionCheck.allowed) {
        return {
          success: false,
          message: `Permission denied: ${permissionCheck.reason}`
        }
      }

      // 2. Acquire lock for critical actions
      const criticalActions = ['start_spin', 'end_session', 'select_winners']
      let lockAcquired = false
      
      if (criticalActions.includes(actionType)) {
        const lockResult = await this.acquireLock(
          sessionId,
          actionType,
          performedBy,
          performedByName,
          actionType === 'start_spin' ? 60000 : 30000 // Longer lock for spinning
        )
        
        if (!lockResult.success) {
          return {
            success: false,
            message: `Action blocked: ${lockResult.reason}`
          }
        }
        lockAcquired = true
      }

      // 3. Create action record
      const actionRecord: CollaborativeAction = {
        ...action,
        timestamp: serverTimestamp(),
        status: 'executing'
      }

      const actionRef = await addDoc(
        collection(db, 'liveDrawSessions', sessionId, 'collaborativeActions'),
        actionRecord
      )

      try {
        // 4. Execute the actual action
        await this.performAction(actionRecord)
        
        // 5. Mark action as completed
        await updateDoc(actionRef, {
          status: 'completed',
          completedAt: serverTimestamp()
        })

        // 6. Release lock
        if (lockAcquired) {
          await this.releaseLock(sessionId, actionType, performedBy)
        }

        return {
          success: true,
          message: `${actionType} executed successfully`,
          actionId: actionRef.id
        }
      } catch (actionError) {
        // Mark action as failed and release lock
        await updateDoc(actionRef, {
          status: 'cancelled',
          error: (actionError as Error).message,
          failedAt: serverTimestamp()
        })
        
        if (lockAcquired) {
          await this.releaseLock(sessionId, actionType, performedBy)
        }
        
        throw actionError
      }
    } catch (error) {
      console.error('Collaborative action error:', error)
      return {
        success: false,
        message: `Failed to execute ${actionType}: ${(error as Error).message}`
      }
    }
  }

  /**
   * Perform the actual action
   */
  private async performAction(action: CollaborativeAction): Promise<void> {
    const { sessionId, action: actionType, parameters } = action
    
    switch (actionType) {
      case 'start_spin':
        await this.performStartSpin(sessionId, parameters)
        break
      case 'end_session':
        await this.performEndSession(sessionId)
        break
      case 'change_settings':
        await this.performChangeSettings(sessionId, parameters)
        break
      case 'select_winners':
        await this.performSelectWinners(sessionId, parameters)
        break
      case 'broadcast_message':
        await this.performBroadcastMessage(sessionId, parameters)
        break
      default:
        throw new Error(`Unknown action type: ${actionType}`)
    }
  }

  private async performStartSpin(sessionId: string, parameters: any): Promise<void> {
    const sessionRef = doc(db, 'liveDrawSessions', sessionId)
    
    const spinStartTime = Date.now()
    const spinDuration = parameters?.spinDuration || 3500
    const totalRotation = parameters?.totalRotation || (5 + Math.random() * 5) * 360
    const finalAngle = parameters?.finalAngle || Math.random() * 360
    
    // Validate all values to prevent undefined Firebase errors
    const wheelStateData = {
      isSpinning: true,
      spinStartTime: spinStartTime,
      spinDuration: spinDuration,
      totalRotation: totalRotation,
      finalAngle: finalAngle,
      currentAngle: 0,
      progress: 0,
      startedAt: serverTimestamp()
    }
    
    // Filter out any undefined values
    const cleanWheelState = Object.fromEntries(
      Object.entries(wheelStateData).filter(([_, value]) => value !== undefined)
    )
    
    const updateData = {
      currentState: 'spinning',
      wheelState: cleanWheelState,
      spinningNotification: {
        message: '🎯 The wheel is now spinning! Everyone watch together...',
        timestamp: serverTimestamp(),
        isActive: true,
        duration: spinDuration
      },
      lastUpdated: serverTimestamp()
    }
    
    await updateDoc(sessionRef, updateData)
  }

  private async performEndSession(sessionId: string): Promise<void> {
    const sessionRef = doc(db, 'liveDrawSessions', sessionId)
    
    await updateDoc(sessionRef, {
      isActive: false,
      isLive: false,
      currentState: 'completed',
      closedAt: serverTimestamp(),
      lastUpdated: serverTimestamp()
    })
  }

  private async performChangeSettings(sessionId: string, parameters: any): Promise<void> {
    const sessionRef = doc(db, 'liveDrawSessions', sessionId)
    
    const updateData: any = {
      lastUpdated: serverTimestamp()
    }
    
    if (parameters?.wheelType) {
      updateData.selectedWheelType = parameters.wheelType
      updateData.wheelType = parameters.wheelType.id
      updateData.wheelTitle = parameters.wheelType.title
      updateData.wheelItems = parameters.wheelType.defaultItems || []
    }
    
    if (parameters?.settings && typeof parameters.settings === 'object') {
      // Clean settings to remove undefined values
      const cleanSettings = Object.fromEntries(
        Object.entries(parameters.settings).filter(([_, value]) => value !== undefined)
      )
      if (Object.keys(cleanSettings).length > 0) {
        updateData.settings = { ...updateData.settings, ...cleanSettings }
      }
    }
    
    // Filter out any undefined values from the main update data
    const cleanUpdateData = Object.fromEntries(
      Object.entries(updateData).filter(([_, value]) => value !== undefined)
    )
    
    await updateDoc(sessionRef, cleanUpdateData)
  }

  private async performSelectWinners(sessionId: string, parameters: any): Promise<void> {
    const sessionRef = doc(db, 'liveDrawSessions', sessionId)
    
    const winners = parameters?.winners || []
    
    // Validate and clean winner data
    const cleanWinners = winners.filter(winner => winner !== undefined && winner !== null)
    
    const wheelStateData = {
      isSpinning: false,
      progress: 1,
      completedAt: serverTimestamp(),
      hasResults: true
    }
    
    // Filter out any undefined values
    const cleanWheelState = Object.fromEntries(
      Object.entries(wheelStateData).filter(([_, value]) => value !== undefined)
    )
    
    const updateData = {
      currentState: 'completed',
      winners: cleanWinners,
      wheelState: cleanWheelState,
      resultNotification: {
        message: cleanWinners.length === 1 
          ? `🎉 Congratulations ${cleanWinners[0]?.name || 'Winner'}! You are the winner!`
          : `🎉 Congratulations to our ${cleanWinners.length} winners: ${cleanWinners.map((w: any) => w?.name || 'Winner').join(', ')}!`,
        winners: cleanWinners,
        timestamp: serverTimestamp(),
        isActive: true,
        showConfetti: true
      },
      lastUpdated: serverTimestamp()
    }
    
    await updateDoc(sessionRef, updateData)
  }

  private async performBroadcastMessage(sessionId: string, parameters: any): Promise<void> {
    const message = parameters?.message || ''
    const sender = parameters?.senderName || 'Organizer'
    
    // Add to session messages collection
    await addDoc(
      collection(db, 'liveDrawSessions', sessionId, 'messages'),
      {
        message,
        sender,
        timestamp: serverTimestamp(),
        type: 'organizer_broadcast'
      }
    )
    
    // Update session with latest broadcast
    await updateDoc(doc(db, 'liveDrawSessions', sessionId), {
      latestBroadcast: {
        message,
        sender,
        timestamp: serverTimestamp()
      },
      lastUpdated: serverTimestamp()
    })
  }

  /**
   * Update organizer presence
   */
  async updateOrganizerPresence(
    sessionId: string,
    organizer: OrganizerPresence
  ): Promise<void> {
    try {
      const presenceRef = doc(
        db,
        'liveDrawSessions',
        sessionId,
        'organizerPresence',
        organizer.uid
      )
      
      await setDoc(presenceRef, {
        ...organizer,
        lastSeen: Date.now(),
        updatedAt: serverTimestamp()
      }, { merge: true })
    } catch (error) {
      console.error('Error updating organizer presence:', error)
    }
  }

  /**
   * Listen to collaborative actions for a session
   */
  listenToCollaborativeActions(
    sessionId: string,
    callback: (actions: CollaborativeAction[]) => void
  ): () => void {
    const actionsQuery = query(
      collection(db, 'liveDrawSessions', sessionId, 'collaborativeActions'),
      orderBy('timestamp', 'desc'),
      limit(50)
    )
    
    return onSnapshot(actionsQuery, (snapshot) => {
      const actions = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as CollaborativeAction[]
      
      callback(actions)
    })
  }

  /**
   * Listen to organizer presence for a session
   */
  listenToOrganizerPresence(
    sessionId: string,
    callback: (organizers: OrganizerPresence[]) => void
  ): () => void {
    return onSnapshot(
      collection(db, 'liveDrawSessions', sessionId, 'organizerPresence'),
      (snapshot) => {
        const organizers = snapshot.docs.map(doc => ({
          ...doc.data()
        })) as OrganizerPresence[]
        
        // Filter out offline organizers (not seen in last 2 minutes)
        const now = Date.now()
        const activeOrganizers = organizers.filter(org => 
          org.isOnline && (now - org.lastSeen) < 120000
        )
        
        callback(activeOrganizers)
      }
    )
  }

  /**
   * Cleanup when component unmounts
   */
  cleanup(): void {
    // Clear all listeners
    this.sessionListeners.forEach(unsubscribe => unsubscribe())
    this.sessionListeners.clear()
    
    // Clear interval
    if (this.lockCheckInterval) {
      clearInterval(this.lockCheckInterval)
      this.lockCheckInterval = null
    }
  }
}

export default CollaborativeLiveRoomManager
export { type CollaborativeAction, type OrganizerPresence, type LiveRoomLock }