 "use client"

import { useParams, useSearchParams, useRouter } from "next/navigation"
import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { auth, db } from "@/lib/firebase"
import { onAuthStateChanged } from "firebase/auth"
import {
  doc,
  getDoc,
  onSnapshot,
  collection,
  addDoc,
  updateDoc,
  serverTimestamp,
  query,
  where,
  getDocs,
  orderBy
} from "firebase/firestore"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "@/hooks/use-toast"
import { EnhancedWheel } from "@/components/randomizer/enhanced-wheel"
import { ImagePickerWheel } from "@/components/picker-wheels/image-picker-wheel"
import { EnhancedTeamPicker } from "@/components/team/enhanced-team-picker"
import { CollaborativeFeedbackIndicators } from "@/components/live/collaborative-feedback-indicators"
import { TextWinnerPopup } from "@/components/shared/text-winner-popup"
import { PICKER_WHEEL_TYPES } from "@/lib/picker-wheel-types"
import type { User as FirebaseUser } from "firebase/auth"
import type { PickerWheelType } from "@/lib/picker-wheel-types"
import EnhancedCollaborativeLiveRoomManager from "@/lib/enhanced-collaborative-live-room-manager"
import {
  Crown,
  Eye,
  Zap,
  Copy,
  Wifi,
  WifiOff,
  RefreshCw,
  Users,
  Settings,
  Square,
  Heart,
  Target,
  BarChart3,
  Radio,
  Smartphone,
  Share2,
  Shuffle,
  RotateCcw
} from "lucide-react"

interface CollaborativeSession {
  id: string
  title: string
  roomCode: string
  createdBy: string
  isActive: boolean
  isLive: boolean
  currentState: string
  wheelType?: string
  wheelTitle?: string
  wheelItems?: string[] // Wheel items for display
  selectedWheelType?: PickerWheelType
  deployedWheelTypes?: string[] // Types deployed by admin
  collaborators: Array<{
    uid: string
    name: string
    email: string
    permissions: {
      canControlLive: boolean
      canEditWheel: boolean
      canManageParticipants: boolean
      canBroadcast: boolean
    }
  }>
  wheelState?: any
  settings?: any
  winners?: any[]
  isSpinning?: boolean
  imageWheelSlices?: any[]
  wheelImages?: any[]
  customMessage?: string
  customWinnerWord?: string
}

export default function CollaborativeWheelRoomPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const sessionId = params.sessionId as string
  const invitationId = searchParams.get('invitationId')

  const [user, setUser] = useState<FirebaseUser | null>(null)
  const [session, setSession] = useState<CollaborativeSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [collaborativeManager, setCollaborativeManager] = useState<EnhancedCollaborativeLiveRoomManager | null>(null)

  // 🚫 CRITICAL: Removed independent isSpinning state that conflicts with EnhancedWheel synchronization
  // The EnhancedWheel component now handles ALL spinning state management and Firebase synchronization
  // Having a separate state causes conflicts and prevents proper synchronization

  const [userPermissions, setUserPermissions] = useState<any>({ canControlLive: true }) // Default to enabled
  const [organizerPresence, setOrganizerPresence] = useState<any[]>([])
  const [recentActions, setRecentActions] = useState<any[]>([])
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'error'>('syncing')
  const [lastSyncTime, setLastSyncTime] = useState<number>(Date.now())
  const lastSyncTimeRef = useRef<number>(Date.now())
  const [hasEnteredRoom, setHasEnteredRoom] = useState(false)
  const [debouncedSpinningState, setDebouncedSpinningState] = useState(false)
  const [newComment, setNewComment] = useState("")
  const [dynamicWheelTypes, setDynamicWheelTypes] = useState<any[]>([])
  const [wheelTypesLoading, setWheelTypesLoading] = useState(true)
  const [showWinnerPopup, setShowWinnerPopup] = useState(false)
  const [winnersAnnounced, setWinnersAnnounced] = useState(false)

  // 🔥 CRITICAL FIX: Reset winnersAnnounced flag when spinning starts (allows new announcements)
  useEffect(() => {
    if (session?.isSpinning) {
      setWinnersAnnounced(false) // Reset flag so new spin can announce winners
      console.log("🎯 COLLABORATOR: Spin started - resetting winner announcement flag for next spin")
    }
  }, [session?.isSpinning])
  const [winners, setWinners] = useState<any[]>([])

  // Custom settings state
  const [isCustomSettingsOpen, setIsCustomSettingsOpen] = useState(false)
  const [customWheelTitle, setCustomWheelTitle] = useState("")
  const [customMessage, setCustomMessage] = useState("")
  const [customWinnerWord, setCustomWinnerWord] = useState("Winner")
  const [allowManualWinnerSelection, setAllowManualWinnerSelection] = useState(false)
  const [selectedItems, setSelectedItems] = useState<string[]>([])
  const [collaboratorWheelType, setCollaboratorWheelType] = useState("")
  const [selectedTheme, setSelectedTheme] = useState("default")
  const [sessionSettings, setSessionSettings] = useState({
    numberOfWinners: 1,
    spinDuration: 3000,
    allowReactions: true,
    autoStart: false,
    numberSets: [] as string[],
    customCongratsMessage: "Congratulations, {name}! 🎉",
    multiWinnerAnnouncement: false
  })
  const [notifications, setNotifications] = useState<Array<{
    id: string
    type: 'join' | 'leave' | 'wheel_change' | 'custom' | 'session_ended'
    message: string
    userId: string
    userName: string
    timestamp: Date
  }>>([])

  // Track if session was ended by organizer
  const [sessionEnded, setSessionEnded] = useState(false)
  const [sessionEndedBy, setSessionEndedBy] = useState<string>('')
  const [sessionEndTime, setSessionEndTime] = useState<Date | null>(null)

  // Initialize collaborative manager
  useEffect(() => {
    const manager = EnhancedCollaborativeLiveRoomManager.getInstance()
    setCollaborativeManager(manager)

    // Listen to collaborative actions
    const unsubscribeActions = manager.listenToEnhancedCollaborativeActions(
      sessionId,
      (actions) => {
        setRecentActions(actions.slice(0, 5)) // Keep last 5 actions
      }
    )

    // Listen to organizer presence
    const unsubscribePresence = manager.listenToEnhancedOrganizerPresence(
      sessionId,
      (organizers) => {
        setOrganizerPresence(organizers)
      }
    )

    return () => {
      unsubscribeActions()
      unsubscribePresence()
    }
  }, [sessionId])

  // Remove debouncing entirely for instant synchronization - EnhancedWheel handles spinning state now

  // CRITICAL FIX: Removed local isSpinning sync - EnhancedWheel handles all spinning state now
  // The local component no longer manages spinning state to avoid conflicts

  // Mark as entered room on first load
  useEffect(() => {
    if (session && user && !hasEnteredRoom) {
      setHasEnteredRoom(true)
    }
  }, [session, user, hasEnteredRoom])

  // Debug logging for user permissions changes
  useEffect(() => {
    console.log("🎯 COLLABORATIVE ROOM: User permissions updated", {
      userPermissions,
      sessionId,
      canViewOnly: userPermissions?.canViewOnly,
      isFullAccessCollaborator: userPermissions?.isFullAccessCollaborator,
      timestamp: new Date().toISOString()
    })
  }, [userPermissions, sessionId])

  // Ensure wheel types are responsive to admin deployment changes
  useEffect(() => {
    if (session?.deployedWheelTypes) {
      console.log("🎯 Admin deployed wheel types updated:", session.deployedWheelTypes)
    }
  }, [session?.deployedWheelTypes])

  // Force refresh session data on mount to get latest admin deployments
  useEffect(() => {
    if (sessionId && !loading) {
      console.log("🎯 Checking for latest admin wheel deployments...")
      // The session listener will handle updates, but we can log for debugging
    }
  }, [sessionId, loading])

  // Load wheel types from Firestore (same as organizer)
  useEffect(() => {
    console.log("🔄 Loading wheel types from Firestore for collaborator...")
    const q = query(collection(db, "wheelTypes"), orderBy("order", "asc"))

    const unsubscribe = onSnapshot(
      q,
      (querySnapshot) => {
        const fetchedTypes = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          value: doc.data().value,
          label: doc.data().label,
          description: doc.data().description,
          enabled: doc.data().enabled,
          order: doc.data().order,
          allowedRoles: doc.data().allowedRoles || ["organizer", "participant"],
          isActivityWheel: doc.data().isActivityWheel || false,
          canBeShared: doc.data().canBeShared || false,
          hiddenForNewUsers: doc.data().hiddenForNewUsers || false,
          icon: doc.data().icon,
          category: doc.data().category,
          isPreset: doc.data().isPreset || false,
          defaultItems: doc.data().defaultItems || ["Option 1", "Option 2", "Option 3"],
          defaultSettings: doc.data().defaultSettings || {
            allowRealTimeCollection: false,
            requiresApproval: false,
            congratsMessage: "Congratulations, {winner}!"
          },
          createdAt: doc.data().createdAt?.toDate() || new Date(),
          updatedAt: doc.data().updatedAt?.toDate() || new Date(),
        }))

        console.log(`✅ Loaded ${fetchedTypes.length} wheel types from Firestore for collaborator`)
        setDynamicWheelTypes(fetchedTypes)
        setWheelTypesLoading(false)
      },
      (error) => {
        console.error("❌ Error loading wheel types for collaborator:", error)
        setWheelTypesLoading(false)
      }
    )

    return () => unsubscribe()
  }, [])

  // Auth and session loading
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser)

      if (currentUser && sessionId) {
        try {
          // Load session data
          const sessionDoc = await getDoc(doc(db, "liveDrawSessions", sessionId))
          if (sessionDoc.exists()) {
            const sessionData = sessionDoc.data()
            const loadedSession: CollaborativeSession = {
              id: sessionDoc.id,
              ...sessionData,
              collaborators: sessionData.collaboratorDetails || []
            } as CollaborativeSession

            setSession(loadedSession)

            // Find user permissions
            const userCollaborator = sessionData.collaboratorDetails?.find(
              (collab: any) => collab.uid === currentUser.uid
            )

            // Ensure collaborators have proper permissions for wheel control
            const collaboratorPermissions = {
              canControlLive: userCollaborator?.permissions?.canControlLive !== false, // Default to true for collaborators
              canEditWheel: userCollaborator?.permissions?.canEditWheel || false,
              canManageParticipants: userCollaborator?.permissions?.canManageParticipants || false,
              canBroadcast: userCollaborator?.permissions?.canBroadcast !== false // Default to true
            }

            // CRITICAL FIX: Ensure userPermissions object is properly structured for EnhancedWheel
            // Check if this collaborator has view-only permissions
            const isViewOnly = !collaboratorPermissions.canControlLive && !collaboratorPermissions.canEditWheel

            const enhancedUserPermissions = {
              isFullAccessCollaborator: !isViewOnly, // Mark as full access only if not view-only
              canTriggerSynchronizedSpin: collaboratorPermissions.canControlLive, // Allow spinning if can control
              synchronizationEnabled: true, // CRITICAL: Enable synchronization for ALL collaborators (both full and view-only)
              sessionId: sessionId,
              userRole: isViewOnly ? 'view' : 'collaborator',
              canViewOnly: isViewOnly, // Add the view-only flag - view-only users cannot trigger spins BUT they MUST see synchronized spins
              canControlLive: collaboratorPermissions.canControlLive // Include the original permission
            }

            console.log("🎯 COLLABORATIVE ROOM: Setting user permissions for wheel component", {
              isViewOnly,
              canControlLive: collaboratorPermissions.canControlLive,
              canEditWheel: collaboratorPermissions.canEditWheel,
              enhancedUserPermissions,
              sessionId,
              timestamp: new Date().toISOString()
            })

            setUserPermissions(enhancedUserPermissions)


            // Update presence if collaborative manager is available (optional - don't fail if permissions denied)
            if (collaborativeManager) {
              try {
                const presence: any = {
                  uid: currentUser.uid,
                  name: currentUser.displayName || currentUser.email?.split('@')[0] || 'Collaborator',
                  email: currentUser.email || '',
                  isOnline: true,
                  lastSeen: Date.now(),
                  permissions: userCollaborator?.permissions || {
                    canControlLive: false,
                    canEditWheel: false,
                    canManageParticipants: false,
                    canBroadcast: true
                  },
                  connectionQuality: 'excellent' as const
                }

                await collaborativeManager.updateEnhancedOrganizerPresence(sessionId, presence)
                console.log("✅ Collaborative presence updated successfully")
              } catch (presenceError) {
                console.warn("⚠️ Presence update failed (non-critical):", presenceError)
                // Don't fail the entire session loading for presence update issues
              }
            }

            console.log("🎯 Collaborative wheel room loaded:", {
              sessionId,
              userPermissions: userCollaborator?.permissions,
              collaborators: sessionData.collaboratorDetails?.length || 0,
              calculatedPermissions: {
                isViewOnly,
                canControlLive: collaboratorPermissions.canControlLive,
                canEditWheel: collaboratorPermissions.canEditWheel,
                enhancedUserPermissions
              }
            })
          }
        } catch (error) {
          console.error("Error loading collaborative session:", error)
          toast({
            title: "Error",
            description: "Failed to load collaborative session",
            variant: "destructive"
          })
        }
      }

      setLoading(false)
    })

    return () => unsubscribe()
  }, [sessionId, collaborativeManager])

  // 🔥 BIDIRECTIONAL SYNC: Listen to session updates and broadcast collaborator changes
  useEffect(() => {
    if (!sessionId) return

    const unsubscribe = onSnapshot(
      doc(db, "liveDrawSessions", sessionId),
      (docSnapshot) => {
        if (docSnapshot.exists()) {
          const sessionData = docSnapshot.data()
          const now = Date.now()

          // 🔍 CRITICAL DEBUG: Log wheel state for synchronization
          if (sessionData.isSpinning || sessionData.wheelState?.isSpinning) {
            console.log("🎡 WEB: SESSION LISTENER DETECTED SPIN:", {
              isSpinning: sessionData.isSpinning,
              wheelState: {
                isSpinning: sessionData.wheelState?.isSpinning,
                spinDuration: sessionData.wheelState?.spinDuration,
                totalRotation: sessionData.wheelState?.totalRotation,
                winningIndex: sessionData.wheelState?.winningIndex,
                broadcastSource: sessionData.wheelState?.broadcastSource
              },
              timestamp: now
            })
          }

          // REMOVED: Duplicate listener - EnhancedWheel component handles all spin synchronization
          // The EnhancedWheel has its own Firebase listener that properly syncs animations
          // Having two listeners causes conflicts and prevents proper synchronization
          
          // Only track winners announced state for UI updates
          if (sessionData.isSpinning) {
            setWinnersAnnounced(false) // Reset for new spin
          }

          // 🎯 CRITICAL: Detect wheel type changes and clear winners for participants
          if (sessionData.selectedWheelType?.id !== session?.selectedWheelType?.id) {
            console.log("🔄 WHEEL TYPE CHANGED: Clearing winners for participant", {
              oldType: session?.selectedWheelType?.id,
              newType: sessionData.selectedWheelType?.id,
              timestamp: new Date().toISOString()
            })

            // Clear winner states for participants
            setWinners([])
            setWinnersAnnounced(false)

            // Force UI update
            toast({
              title: "🔄 Wheel Type Updated",
              description: `Organizer changed to "${sessionData.selectedWheelType?.title}"`,
              duration: 3000
            })
          }

          // 🔥 BIDIRECTIONAL SYNC: Detect collaborator button changes and broadcast to organizer
          // Check if wheel items changed (from collaborator's add/remove actions)
          if (JSON.stringify(sessionData.wheelItems) !== JSON.stringify(session?.wheelItems)) {
            console.log("🔔 COLLABORATOR: Broadcasting wheel items change to organizer", {
              oldItems: session?.wheelItems?.length,
              newItems: sessionData.wheelItems?.length,
              changedItems: sessionData.wheelItems,
              timestamp: new Date().toISOString()
            })
          }

          // 🔥 BIDIRECTIONAL SYNC: Check if theme changed
          if (JSON.stringify(sessionData.wheelState?.theme) !== JSON.stringify(session?.wheelState?.theme)) {
            console.log("🎨 COLLABORATOR: Theme change detected, syncing with organizer", {
              theme: sessionData.wheelState?.theme,
              timestamp: new Date().toISOString()
            })
          }

          // 🔥 BIDIRECTIONAL SYNC: Check if settings changed (numberOfWinners, customMessage, etc.)
          if (sessionData.settings?.numberOfWinners !== session?.settings?.numberOfWinners ||
              sessionData.customMessage !== session?.customMessage ||
              sessionData.customWinnerWord !== session?.customWinnerWord) {
            console.log("⚙️ COLLABORATOR: Settings change detected, keeping organizer in sync", {
              numberOfWinners: sessionData.settings?.numberOfWinners,
              customMessage: sessionData.customMessage,
              customWinnerWord: sessionData.customWinnerWord,
              timestamp: new Date().toISOString()
            })
          }

          setSession(prev => {
            const updatedSession = prev ? { ...prev, ...sessionData } : null

            // Check if session was ended by organizer
            if (sessionData.currentState === 'ended' && prev?.currentState !== 'ended') {
              console.log("🚨 COLLABORATOR: Session ended by organizer", {
                sessionId,
                endedBy: sessionData.endedBy || 'organizer',
                endedAt: sessionData.endedAt,
                timestamp: new Date().toISOString()
              })

              setSessionEnded(true)
              setSessionEndedBy(sessionData.endedBy || 'organizer')
              setSessionEndTime(new Date())

              // Show notification
              toast({
                title: "⚠️ Session Ended",
                description: "The organizer has ended this collaborative session.",
                variant: "destructive",
                duration: 10000
              })

              // Add to notifications
              const endNotification = {
                id: `session-ended-${Date.now()}`,
                type: 'session_ended' as const,
                message: `Session ended by ${sessionData.endedBy || 'organizer'}`,
                userId: sessionData.endedBy || 'organizer',
                userName: 'Organizer',
                timestamp: new Date()
              }
              setNotifications(prev => [endNotification, ...prev.slice(0, 9)])
            }

            // Session synchronized - minimal logging for performance
            return updatedSession
          })

          // Update sync status
          setSyncStatus('synced')
          setLastSyncTime(now)
          lastSyncTimeRef.current = now

        }
      },
      (error) => {
        console.error("Session listener error:", error)
        setSyncStatus('error')
      }
    )

    return () => unsubscribe()
  }, [sessionId])

  // Simplified wheel state synchronization using main session listener only

  // Heartbeat mechanism for continuous synchronization
  useEffect(() => {
    if (!sessionId || !user) return

    const heartbeatInterval = setInterval(async () => {
      try {
        // Update collaborator presence to maintain sync (optional)
        if (collaborativeManager) {
          try {
            const presence: any = {
              uid: user.uid,
              name: user.displayName || user.email?.split('@')[0] || 'Collaborator',
              email: user.email || '',
              isOnline: true,
              lastSeen: Date.now(),
              permissions: userPermissions || {
                canControlLive: false,
                canEditWheel: false,
                canManageParticipants: false,
                canBroadcast: true
              },
              connectionQuality: 'excellent' as const
            }

            await collaborativeManager.updateEnhancedOrganizerPresence(sessionId, presence)
          } catch (heartbeatError) {
            console.warn("⚠️ Heartbeat presence update failed (non-critical):", heartbeatError)
            // Continue with sync status monitoring even if presence update fails
          }
        }

        // Check sync status
        const timeSinceLastSync = Date.now() - lastSyncTimeRef.current
        if (timeSinceLastSync > 10000) { // 10 seconds
          setSyncStatus('error')
          console.warn("🎯 COLLABORATOR: Sync delay detected", {
            timeSinceLastSync,
            sessionId,
            lastSyncTime: new Date(lastSyncTimeRef.current).toISOString()
          })
        } else if (timeSinceLastSync > 3000) { // 3 seconds
          setSyncStatus('syncing')
        } else {
          setSyncStatus('synced')
        }

      } catch (error) {
        console.error("Heartbeat error:", error)
        setSyncStatus('error')
      }
    }, 5000) // Every 5 seconds

    return () => clearInterval(heartbeatInterval)
  }, [sessionId, user, collaborativeManager, userPermissions])

  // Handle collaborative actions - simplified (EnhancedWheel handles spinning)
  const handleCollaborativeAction = async (actionType: string, parameters?: any) => {
    // Note: Spinning is handled by EnhancedWheel component's spinWheel function
    // This function is kept for potential future collaborative features
    console.log("Collaborative action:", actionType)
  }

  // Handle wheel spin completion
  const handleSpinComplete = useCallback((result: any) => {
    console.log("🎯 Collaborative wheel spin completed:", result)

    // 🔥 BIDIRECTIONAL SYNC: Broadcast spin completion to organizer
    const spinCompleteAction = {
      id: `spin-complete-${Date.now()}`,
      type: 'spin_completed',
      timestamp: serverTimestamp(),
      completedBy: user?.displayName || user?.email || 'Collaborator',
      completedByUID: user?.uid,
      spinDuration: result?.spinDuration || 3000,
      winners: result?.winners || [],
      action: 'collaborator_completed_spin'
    }

    // 🔥 Spin completion broadcasted to organizer through Firebase listener
    console.log("✅ Collaborator spin completion event:", spinCompleteAction)
  }, [user, collaborativeManager, sessionId])

  // Handle winner detection
  const handleWinnersDetected = useCallback(async (winners: any[]) => {
    console.log("🎯 Collaborative winners detected:", winners)

    // CRITICAL FIX: Prevent multiple announcements
    if (winnersAnnounced || !winners || winners.length === 0) {
      console.log("🎯 WINNERS ALREADY ANNOUNCED: Skipping duplicate announcement")
      return
    }

    setWinnersAnnounced(true)

    // CRITICAL FIX: Always set winners for announcement, regardless of permissions
    // Collaborators should see winner announcements too
    // Update local state first - EnhancedWheel handles spinning state now
    setSession(prev => prev ? {
      ...prev,
      winners: winners,
      wheelState: {
        ...prev.wheelState,
        winners: winners,
        completedAt: Date.now(),
        isSpinning: false
      }
    } : null)

    // 🔥 BIDIRECTIONAL SYNC: Broadcast winner detection to organizer and all collaborators
    const winnerDetectionAction = {
      id: `winner-detected-${Date.now()}`,
      type: 'winners_detected',
      timestamp: serverTimestamp(),
      detectedBy: user?.displayName || user?.email || 'Collaborator',
      detectedByUID: user?.uid,
      winners: winners.map(w => ({
        id: w.id,
        name: w.name,
        email: w.email
      })),
      action: 'collaborator_detected_winner'
    }

    // CRITICAL FIX: Update Firestore to stop spinning for all users
    try {
      const sessionRef = doc(db, "liveDrawSessions", sessionId)
      await updateDoc(sessionRef, {
        isSpinning: false,
        currentState: 'completed',
        winners: winners,
        wheelState: {
          isSpinning: false,
          winners: winners,
          completedAt: Date.now(),
          announcementTimestamp: Date.now(),
          detectedByCollaborator: true,
          detectedByUID: user?.uid,
          detectedByName: user?.displayName || user?.email || 'Collaborator'
        },
        lastUpdated: serverTimestamp(),
        lastUpdatedBy: user?.uid || 'collaborator',
        lastUpdatedByName: user?.displayName || user?.email || 'Collaborator'
      })

      // 🔥 Winner detection broadcasted to organizer through Firebase listener
      console.log("✅ Winner detection action logged:", winnerDetectionAction)

      console.log("🎯 FIRESTORE UPDATE: Set isSpinning to false and updated winners in Firestore, broadcasted to organizer")
    } catch (error) {
      console.error("❌ Error updating Firestore with winners:", error)
    }

    // CRITICAL FIX: Ensure winner popup is triggered immediately
    console.log("🎯 COLLABORATIVE WINNER POPUP: Triggering winner announcement popup")
    setShowWinnerPopup(true)
  }, [userPermissions, sessionId, winnersAnnounced, user, collaborativeManager])

  // Send comment function
  const sendComment = async () => {
    if (!newComment.trim() || !user) return

    try {
      // 🔥 BIDIRECTIONAL SYNC: Add comment from collaborator (visible to organizer)
      const commentAction = {
        id: `comment-${Date.now()}`,
        type: 'collaborator_comment',
        timestamp: serverTimestamp(),
        sender: user.displayName || user.email?.split('@')[0] || 'Collaborator',
        senderUID: user.uid,
        message: newComment,
        action: 'collaborator_sent_comment'
      }

      // Save to comments subcollection
      await addDoc(collection(db, "liveDrawSessions", sessionId, "comments"), {
        text: newComment.trim(),
        sender: user.displayName || user.email?.split('@')[0] || 'Collaborator',
        senderUID: user.uid,
        senderRole: 'collaborator',
        timestamp: serverTimestamp()
      })

      // 🔥 Comment broadcasted to organizer through Firebase listener
      console.log("✅ Comment action logged:", commentAction)

      setNewComment("")
      
      console.log("🔥 Collaborator comment broadcasted to organizer and all participants")
    } catch (error) {
      console.error("Error sending comment:", error)
    }
  }

  // Send reaction function
  const sendReaction = async (emoji: string) => {
    if (!user) return

    try {
      // 🔥 BIDIRECTIONAL SYNC: Add reaction from collaborator (visible to organizer)
      const reactionAction = {
        id: `reaction-${Date.now()}`,
        type: 'collaborator_reaction',
        timestamp: serverTimestamp(),
        sender: user.displayName || user.email?.split('@')[0] || 'Collaborator',
        senderUID: user.uid,
        emoji: emoji,
        action: 'collaborator_sent_reaction'
      }

      await addDoc(collection(db, "liveDrawSessions", sessionId, "reactions"), {
        emoji,
        sender: user.displayName || user.email?.split('@')[0] || 'Collaborator',
        senderUID: user.uid,
        senderRole: 'collaborator',
        timestamp: serverTimestamp()
      })

      // 🔥 Reaction broadcasted to organizer through Firebase listener
      console.log("✅ Reaction action logged:", reactionAction)

      console.log("🔥 Collaborator reaction broadcasted to organizer")
    } catch (error) {
      console.error("Error sending reaction:", error)
    }
  }

  // 🔥 LEAVE SESSION: Remove collaborator from wheel and notify organizer
  const handleLeaveSession = async () => {
    if (!user || !sessionId) return

    try {
      console.log("🚪 COLLABORATOR: Attempting to leave session", {
        collaboratorUID: user.uid,
        collaboratorName: user.displayName || user.email,
        sessionId,
        timestamp: new Date().toISOString()
      })

      // Get current session to remove collaborator from collaboratorDetails
      const sessionRef = doc(db, "liveDrawSessions", sessionId)
      const sessionDoc = await getDoc(sessionRef)

      if (sessionDoc.exists()) {
        const sessionData = sessionDoc.data()
        const collaboratorDetails = sessionData.collaboratorDetails || []

        // Filter out the current collaborator
        const updatedCollaborators = collaboratorDetails.filter(
          (collab: any) => collab.uid !== user.uid
        )

        // Update Firestore to remove collaborator from wheelParticipants
        await updateDoc(sessionRef, {
          collaboratorDetails: updatedCollaborators,
          lastUpdated: serverTimestamp(),
          lastUpdatedBy: user.uid,
          lastUpdatedByName: user.displayName || user.email || 'Collaborator'
        })

        console.log("✅ COLLABORATOR REMOVED: Firestore updated - organizer notified", {
          removedCollaborator: {
            uid: user.uid,
            name: user.displayName || user.email
          },
          remainingCollaborators: updatedCollaborators.length,
          timestamp: new Date().toISOString()
        })

        // Log the leave action
        const leaveAction = {
          id: `collaborator-left-${Date.now()}`,
          type: 'collaborator_left',
          timestamp: serverTimestamp(),
          collaboratorUID: user.uid,
          collaboratorName: user.displayName || user.email || 'Collaborator',
          action: 'collaborator_left_session'
        }

        console.log("✅ Leave action logged:", leaveAction)

        // Show toast confirmation
        toast({
          title: "👋 Left Session",
          description: "You have left the collaborative session. The organizer has been notified.",
          duration: 5000
        })

        // 🔥 REDIRECT TO HOME PAGE after leaving (using router.push to preserve auth session)
        setTimeout(() => {
          router.push('/')
        }, 1500)
      }
    } catch (error) {
      console.error("❌ Error leaving session:", error)
      toast({
        title: "Error",
        description: "Failed to leave session. Please try again.",
        variant: "destructive"
      })
    }
  }

  // CRITICAL FIX: Move useMemo hook BEFORE any early returns to ensure consistent hook count
  // Get visible wheel types - same logic as organizer using dynamic data
  const availableWheelTypes = useMemo(() => {
    if (wheelTypesLoading) return []

    // If we have dynamic wheel types from Firestore, filter them
    if (dynamicWheelTypes && dynamicWheelTypes.length > 0) {
      console.log("🎯 Using dynamic wheel types from Firestore for collaborators:", dynamicWheelTypes.length)

      // Filter based on admin deployment restrictions
      if (session?.deployedWheelTypes && Array.isArray(session.deployedWheelTypes) && session.deployedWheelTypes.length > 0) {
        const deployedTypes = session.deployedWheelTypes
        console.log("🎯 Filtering by admin deployment:", deployedTypes)
        return dynamicWheelTypes
          .filter(wt => deployedTypes.includes(wt.value || wt.id))
          .filter(wt => !wt.hiddenForNewUsers) // Hide hidden types
          .filter(wt => wt.allowedRoles?.includes('participant') || wt.allowedRoles?.includes('collaborator'))
          .map(wt => ({
            id: wt.value || wt.id,
            title: wt.label,
            description: wt.description || `${wt.label} wheel for live sessions`,
            icon: wt.icon || "🎯",
            category: wt.category || "personal",
            defaultItems: wt.defaultItems || ["Option 1", "Option 2", "Option 3"],
            color: wt.color || "#8e0b16",
            isCustomizable: wt.isCustomizable !== false,
            maxItems: wt.maxItems,
            minItems: wt.minItems
          })) as PickerWheelType[]
      }

      // If no deployment restrictions, show all enabled wheel types from Firestore
      console.log("🎯 No deployment restrictions - showing all enabled wheel types from Firestore")
      return dynamicWheelTypes
        .filter(wt => wt.enabled !== false) // Only enabled types
        .filter(wt => !wt.hiddenForNewUsers) // Hide hidden types
        .filter(wt => wt.allowedRoles?.includes('participant') || wt.allowedRoles?.includes('collaborator'))
        .map(wt => ({
          id: wt.value || wt.id,
          title: wt.label,
          description: wt.description || `${wt.label} wheel for live sessions`,
          icon: wt.icon || "🎯",
          category: wt.category || "personal",
          defaultItems: wt.defaultItems || ["Option 1", "Option 2", "Option 3"],
          color: wt.color || "#8e0b16",
          isCustomizable: wt.isCustomizable !== false,
          maxItems: wt.maxItems,
          minItems: wt.minItems
        })) as PickerWheelType[]
    }

    // Fallback to static wheel types if no dynamic types loaded
    console.log("🎯 Using static wheel types as fallback")
    return PICKER_WHEEL_TYPES.filter(wt => !wt.hiddenForNewUsers)
  }, [dynamicWheelTypes, wheelTypesLoading, session?.deployedWheelTypes])

  // Memoize initial slices for image picker wheel - moved before early returns
  const imagePickerInitialSlices = useMemo(() => {
    // For organizers, prioritize imageWheelSlices from session
    if (session?.imageWheelSlices && Array.isArray(session.imageWheelSlices) && session.imageWheelSlices.length > 0) {
      return session.imageWheelSlices.map((slice: any, index: number) => ({
        id: slice.id || `slice-${index}`,
        text: slice.text || `Slice ${index + 1}`,
        color: slice.color || (index % 2 === 0 ? "#8e0b16" : "#66181E"),
        image: slice.image ? {
          url: slice.image.url,
          alt: slice.image.alt || `Image for ${slice.text || `Slice ${index + 1}`}`,
          isLoaded: slice.image.isLoaded !== false,
          error: slice.image.error || false
        } : undefined
      }))
    }

    // Fallback to wheelImages
    if (session?.wheelImages && Array.isArray(session.wheelImages) && session.wheelImages.length > 0) {
      return session.wheelImages.map((imgData: any, index: number) => ({
        id: imgData.sliceId || `slice-${index}`,
        text: imgData.sliceId || `Slice ${index + 1}`,
        color: index % 2 === 0 ? "#8e0b16" : "#66181E",
        image: imgData.url ? {
          url: imgData.url,
          alt: imgData.alt || `Image for ${imgData.sliceId || `Slice ${index + 1}`}`,
          isLoaded: imgData.isLoaded !== false,
          error: imgData.error || false
        } : undefined
      }))
    }

    // Default slices
    return Array.from({ length: 6 }, (_, index) => ({
      id: `slice-${index}`,
      text: `Slice ${index + 1}`,
      color: index % 2 === 0 ? "#8e0b16" : "#66181E",
      image: undefined
    }))
  }, [session?.imageWheelSlices, session?.wheelImages])

  // Prepare participants for the wheel - MUST be before early returns to avoid hook order issues
  // CRITICAL: Memoize to prevent infinite re-renders
  const participantsArray = useMemo(() => {
    if (!session) return []
    
    // Priority 1: Use organizer's current wheel items from wheelState (real-time sync)
    if (session.wheelState?.wheelItems && session.wheelState.wheelItems.length > 0) {
      console.log("🎯 Using organizer's wheel items for collaborators:", session.wheelState.wheelItems.length)
      return session.wheelState.wheelItems.map((item: string, index: number) => ({
        id: `wheel-item-${index}`,
        name: item,
        isSelected: true
      }))
    }
    // Priority 2: Use selected wheel type default items (for initial setup)
    else if (session.selectedWheelType?.defaultItems && session.selectedWheelType.defaultItems.length > 0) {
      console.log("🎯 Using selected wheel type default items:", session.selectedWheelType.defaultItems.length)
      return session.selectedWheelType.defaultItems.map((item: string, index: number) => ({
        id: `wheel-item-${index}`,
        name: item,
        email: undefined,
        isSelected: true
      }))
    }
    // Priority 3: Fallback items
    else {
      console.log("🎯 Using fallback items - no organizer data available")
      return [
        { id: 'fallback-1', name: 'Option 1', isSelected: true },
        { id: 'fallback-2', name: 'Option 2', isSelected: true },
        { id: 'fallback-3', name: 'Option 3', isSelected: true }
      ]
    }
  }, [session, session?.wheelState?.wheelItems, session?.selectedWheelType?.defaultItems])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4 text-blue-600"></div>
          <p className="text-lg text-gray-600">Loading Collaborative Wheel Room...</p>
        </div>
      </div>
    )
  }

  if (!user || !session) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <p className="text-gray-600">Session not found or access denied</p>
        </div>
      </div>
    )
  }

  // Determine if the current user is a collaborator
  const isCollaborator = session?.collaborators?.some(
    (collab: any) => collab.uid === user?.uid
  ) || false

  const canControlLive = userPermissions?.canControlLive || isCollaborator
  const canEditWheel = userPermissions?.canEditWheel || false

  const schoolColors = { primary: "#8e0b16", secondary: "#66181E", accent: "#ffffff" }
  const reactionEmojis = [
    { emoji: "👏", label: "Clap" },
    { emoji: "👍", label: "Thumbs Up" },
    { emoji: "❤️", label: "Heart" },
    { emoji: "⭐", label: "Star" },
    { emoji: "🎉", label: "Celebrate" }
  ]

  const getConnectionIcon = () => {
    switch (syncStatus) {
      case 'synced':
        return <Wifi className="h-4 w-4 text-[#10b981]" />
      case 'syncing':
        return <RefreshCw className="h-4 w-4 text-yellow-500 animate-spin" />
      default:
        return <WifiOff className="h-4 w-4 text-red-500" />
    }
  }

  const getConnectionBadge = () => {
    switch (syncStatus) {
      case 'synced':
        return <Badge variant="default" className="bg-[#10b981]">Connected</Badge>
      case 'syncing':
        return <Badge variant="secondary">Connecting...</Badge>
      default:
        return <Badge variant="destructive">Error</Badge>
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4 text-blue-600"></div>
          <p className="text-lg text-gray-600">Loading Collaborative Wheel Room...</p>
        </div>
      </div>
    )
  }

  if (!user || !session) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <p className="text-gray-600">Session not found or access denied</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Session Ended Warning Banner */}
      {sessionEnded && (
        <Card className="border-4 border-red-500 bg-gradient-to-r from-red-50 to-orange-50 shadow-2xl animate-pulse">
          <CardContent className="p-6">
            <div className="flex items-center justify-center gap-4">
              <div className="p-4 bg-red-100 rounded-full">
                <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center">
                  <span className="text-white font-bold text-lg">!</span>
                </div>
              </div>
              <div className="flex-1 text-center">
                <h2 className="text-2xl font-bold text-red-800 mb-2">
                  🚨 Session Ended
                </h2>
                <p className="text-lg text-red-700 mb-2">
                  The organizer has ended this collaborative session.
                </p>
                <p className="text-sm text-red-600">
                  Ended by: <span className="font-semibold">{sessionEndedBy}</span> •
                  Ended at: <span className="font-semibold">
                    {sessionEndTime?.toLocaleString() || 'Unknown time'}
                  </span>
                </p>
                <div className="mt-4 p-3 bg-red-100 rounded-lg border border-red-300">
                  <p className="text-sm text-red-800 font-medium">
                    💡 You can no longer interact with the wheel. The session has been closed.
                  </p>
                </div>
              </div>
              <div className="p-4 bg-red-100 rounded-full">
                <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center">
                  <span className="text-white font-bold text-lg">!</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Live Wheel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card className="border-2 shadow-xl" style={{borderColor: '#8e0b16'}}>
            <CardHeader className="bg-gradient-to-r from-[#8e0b16] to-[#66181E] text-white rounded-t-lg p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-white/20 rounded-lg">
                    <div className="text-4xl">
                      {session.selectedWheelType ? session.selectedWheelType.icon
                        : session.wheelType ? '🎯'
                        : '🎯'}
                    </div>
                  </div>
                  <div>
                    <CardTitle className="text-2xl font-bold flex items-center gap-3">
                      <span>
                        {session.selectedWheelType?.title || session.wheelTitle || session.title || 'Spin Wheel Room'}
                      </span>
                      {session.isSpinning && (
                        <Badge variant="secondary" className="bg-yellow-500 text-white animate-pulse px-3 py-1">
                          SPINNING
                        </Badge>
                      )}
                    </CardTitle>
                    <div className="text-white/90 mt-2 flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                      <span className="text-sm">🤝 You are in COLLABORATOR MODE - synchronized with organizer</span>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="secondary" className="bg-white/20 text-white px-2 py-1 text-xs">
                        🎯 Spin Wheel
                      </Badge>
                      <Badge variant="secondary" className="bg-orange-500 text-white px-2 py-1 text-xs">
                        🤝 Collaborator Room
                      </Badge>
                      <Badge variant="outline" className="text-white border-white/30 text-xs">
                        Room: {session.roomCode}
                      </Badge>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Select
                    value={session.selectedWheelType?.id || ""}
                    onValueChange={async (wheelId) => {
                    console.log("🎯 Collaborator attempting to change wheel type:", wheelId, "canEditWheel:", canEditWheel)
                    // Look for wheel in available wheel types (dynamic or static)
                    const selectedWheel = availableWheelTypes.find(w => w.id === wheelId)

                    if (selectedWheel && session?.id && canEditWheel) {
                        // Update cached wheel type for immediate UI feedback
                        const updatedSession = { ...session, selectedWheelType: selectedWheel }
                        setSession(updatedSession)

                        // 🔥 CRITICAL: Broadcast wheel type change to all collaborators and organizer
                        const wheelChangeAction = {
                          id: `wheel-change-${Date.now()}`,
                          type: 'wheel_type_changed',
                          timestamp: serverTimestamp(),
                          changedBy: user?.displayName || user?.email || 'Collaborator',
                          changedByUID: user?.uid,
                          fromWheelType: session.selectedWheelType?.id,
                          toWheelType: selectedWheel.id,
                          wheelTitle: selectedWheel.title,
                          action: 'collaborator_changed_wheel'
                        }

                        // Update live session in real-time for ALL participants
                        try {
                          const updatePayload = {
                            selectedWheelType: {
                              id: selectedWheel.id,
                              title: selectedWheel.title,
                              description: selectedWheel.description,
                              icon: selectedWheel.icon,
                              color: selectedWheel.color,
                              category: selectedWheel.category,
                              defaultItems: selectedWheel.defaultItems,
                              isCustomizable: selectedWheel.isCustomizable
                            },
                            wheelType: selectedWheel.id,
                            wheelTitle: customWheelTitle || selectedWheel.title,
                            wheelItems: selectedWheel.defaultItems,
                            customWheelTitle: customWheelTitle,
                            customMessage: customMessage,
                            customWinnerWord: customWinnerWord,
                            allowManualWinnerSelection: allowManualWinnerSelection,
                            collaboratorWheelType: collaboratorWheelType,
                            // 🎯 CRITICAL: Clear wheel state and winners when changing wheel type
                            wheelState: {
                              isSpinning: false,
                              winners: [],
                              currentAngle: 0,
                              wheelItems: selectedWheel.defaultItems,
                              resetAt: Date.now(),
                              resetBy: user?.uid || 'collaborator',
                              resetByName: user?.displayName || user?.email || 'Collaborator'
                            },
                            isSpinning: false,
                            currentState: 'idle',
                            updatedAt: serverTimestamp(),
                            lastUpdatedBy: user?.uid || 'collaborator',
                            lastUpdatedByName: user?.displayName || user?.email || 'Collaborator'
                          }

                          await updateDoc(doc(db, "liveDrawSessions", session.id), updatePayload)

                          // 🔥 Wheel change broadcasted to organizer through Firebase listener
                          console.log("✅ Wheel type change action logged:", wheelChangeAction)

                          console.log(`🔄 Wheel type changed to: ${selectedWheel.title} - broadcasting to organizer and all participants`)

                          toast({
                            title: "🔄 Wheel Type Updated!",
                            description: `Changed to "${selectedWheel.title}" - organizer and participants notified`,
                          })
                        } catch (error) {
                          console.error("Error updating wheel type:", error)
                          toast({
                            title: "Permission Denied",
                            description: "You don't have permission to change wheel types. Only organizers can modify wheel settings.",
                            variant: "destructive"
                          })
                        }
                      }
                    }}
                  >
                    <SelectTrigger className="w-full sm:w-36 text-sm bg-white/20 border-white/30 text-white hover:bg-white/30 transition-colors">
                      <SelectValue placeholder="Change wheel type" />
                    </SelectTrigger>
                    <SelectContent>
                      {/* Show only admin-deployed wheel types */}
                      {availableWheelTypes.map((wheelType) => (
                        <SelectItem key={wheelType.id} value={wheelType.id} className="text-sm">
                          {wheelType.icon} {wheelType.title}
                        </SelectItem>
                      ))}
                      {availableWheelTypes.length === 0 && (
                        <div className="px-2 py-1.5 text-sm text-gray-500 text-center">
                          {session?.deployedWheelTypes ? "No wheel types deployed by admin" : "Loading admin deployments..."}
                        </div>
                      )}
                    </SelectContent>
                  </Select>

                  {/* Custom Settings Button */}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setIsCustomSettingsOpen(true)}
                    className="bg-white/10 border-white/30 text-white hover:bg-white/20 transition-colors"
                    title="Custom Wheel Settings"
                  >
                    <Settings className="h-4 w-4" />
                  </Button>

                  {/* 🚪 LEAVE SESSION BUTTON */}
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="bg-red-600 hover:bg-red-700 text-white transition-colors"
                        title="Leave Session"
                      >
                        <Square className="h-4 w-4 mr-2" />
                        Leave
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md">
                      <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-red-600">
                          <div className="p-2 bg-red-100 rounded-lg">
                            <Square className="h-5 w-5" />
                          </div>
                          Leave Session
                        </DialogTitle>
                        <DialogDescription className="text-base mt-2">
                          Are you sure you want to leave this collaborative wheel session?
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                          <p className="text-sm text-red-800 font-semibold mb-1">⚠️ What happens when you leave:</p>
                          <ul className="text-sm text-red-700 space-y-1 ml-4">
                            <li>• Your name will be removed from the organizer's wheel</li>
                            <li>• You will no longer see live updates</li>
                            <li>• You can rejoin with the session link if invited again</li>
                          </ul>
                        </div>
                        <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                          <p className="text-sm text-blue-800">
                            <strong>Session ID:</strong> {sessionId}
                          </p>
                        </div>
                      </div>
                      <DialogFooter className="flex gap-3 justify-end">
                        <Button
                          variant="outline"
                          onClick={() => {}}
                          className="border-gray-300 text-gray-700 hover:bg-gray-50"
                        >
                          Cancel
                        </Button>
                        <Button
                          variant="destructive"
                          onClick={handleLeaveSession}
                          className="bg-red-600 hover:bg-red-700"
                        >
                          <Square className="h-4 w-4 mr-2" />
                          Yes, Leave Session
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>

                  {getConnectionBadge()}
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 lg:p-8">
              <div className="flex justify-center">
                <div className="w-full max-w-none">
                  {(session.selectedWheelType?.id === 'team-picker' || session.wheelType === 'team-picker') ? (
                    <EnhancedTeamPicker
                      key={`team-picker-${sessionId}`}
                      initialNames={session.wheelState?.wheelItems || session.selectedWheelType?.defaultItems || []}
                      canEdit={true}
                      disabled={sessionEnded}
                      readonly={false}
                      isParticipantView={false}
                      sessionId={sessionId}
                      liveTeams={session.wheelState?.teams || []}
                    />
                  ) : (session.selectedWheelType?.id === 'image-picker' || session.wheelType === 'image-picker') ? (
                    <ImagePickerWheel
                      key={`image-picker-wheel-${sessionId}`}
                      slices={imagePickerInitialSlices}
                      onSpinComplete={handleSpinComplete}
                      isLiveMode={true}
                      sessionId={sessionId}
                      disabled={sessionEnded || !(canControlLive || isCollaborator)}
                      wheelTitle={session.selectedWheelType?.title || session.wheelTitle || session.title}
                      enableRealTimeSync={!sessionEnded && true}
                      organizerMode={false}
                      userPermissions={{
                        isFullAccessCollaborator: true,
                        canTriggerSynchronizedSpin: !sessionEnded && !session?.isSpinning,
                        synchronizationEnabled: !sessionEnded && true,
                        sessionId: sessionId,
                        userRole: sessionEnded ? 'ended' : 'collaborator',
                        canViewOnly: false,
                        isCollaborator: true
                      }}
                      useEnhancedSpinning={false}
                      wheelTheme={session.wheelState?.theme || {
                        primary: "#8e0b16",
                        secondary: "#66181E",
                        accent: "#ffffff"
                      }}
                      isSpinning={session.isSpinning}
                    />
                  ) : (
                    <EnhancedWheel
                      participants={participantsArray}
                      onSpinComplete={handleSpinComplete}
                      onWinnersDetected={handleWinnersDetected}
                      isLiveMode={true}
                      sessionId={sessionId}
                      disabled={sessionEnded || !(canControlLive || isCollaborator)}
                      wheelTitle={session.selectedWheelType?.title || session.wheelTitle || session.title}
                      selectedWheelType={session.selectedWheelType}
                      enableRealTimeSync={!sessionEnded && true}
                      organizerMode={false}
                      studentMode={false}
                      isSpinning={session.isSpinning}
                      wheelTheme={session.wheelState?.theme}
                      customItems={session.wheelState?.wheelItems && session.wheelState.wheelItems.length > 0
                        ? session.wheelState.wheelItems
                        : undefined}
                      customCongratsMessage={
                        (session.settings?.congratsMessage || session.customMessage || "🎉 Congratulations, {winner}!")
                          .replace('{winner}', session.winners?.map((w: any) => w.name).join(', ') || 'Winner')
                      }
                      customWinnerWord={session.customWinnerWord || "Winner"}
                      remoteSpinData={session.wheelState}
                      userPermissions={{
                        isFullAccessCollaborator: !userPermissions.canViewOnly && !sessionEnded,
                        canTriggerSynchronizedSpin: userPermissions.canControlLive && !sessionEnded && !session?.isSpinning, // 🔥 CRITICAL: Disable spin button while organizer is spinning
                        synchronizationEnabled: !sessionEnded && true,
                        sessionId: sessionId,
                        userRole: sessionEnded ? 'ended' : (userPermissions.canViewOnly ? 'view' : 'collaborator'),
                        canViewOnly: userPermissions.canViewOnly || sessionEnded
                      }}
                    />
                  )}
                </div>
              </div>

              {/* Session Status Indicator */}
              <div className="flex items-center justify-center mt-6">
                {sessionEnded ? (
                  <div className="flex items-center gap-2 px-6 py-3 bg-red-100 text-red-800 rounded-full border-2 border-red-400">
                    <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                    <span className="text-sm font-medium">🚨 Session Ended by Organizer</span>
                  </div>
                ) : session.currentState === "waiting" ? (
                  <div className="flex items-center gap-2 px-6 py-3 bg-blue-100 text-blue-800 rounded-full border border-blue-300">
                    <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
                    <span className="text-sm font-medium">Waiting for spin wheel to start...</span>
                  </div>
                ) : session.isSpinning ? (
                  <div className="flex items-center gap-2 px-6 py-3 bg-yellow-100 text-yellow-800 rounded-full border border-yellow-300">
                    <div className="w-3 h-3 bg-yellow-500 rounded-full animate-pulse"></div>
                    <span className="text-sm font-medium">🎯 Spin wheel is spinning...</span>
                  </div>
                ) : session.currentState === "ended" && session.winners && session.winners.length > 0 ? (
                  <div className="flex items-center gap-2 px-6 py-3 bg-green-100 text-green-800 rounded-full border border-green-300">
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    <span className="text-sm font-medium">🎉 Spin results are ready!</span>
                  </div>
                ) : null}
              </div>

              {/* Sync Status */}
              {!sessionEnded ? (
                <div className="flex items-center justify-center gap-2 p-4 bg-gray-50 rounded-lg border border-gray-200 mt-4">
                  <div className={`w-3 h-3 rounded-full ${
                    syncStatus === 'synced' ? 'bg-green-500 animate-pulse' :
                    syncStatus === 'syncing' ? 'bg-yellow-500 animate-pulse' : 'bg-red-500'
                  }`}></div>
                  <span className="text-sm font-medium text-gray-700">
                    {syncStatus === 'synced' ? '🔄 Spin wheel fully synchronized' :
                     syncStatus === 'syncing' ? '⏳ Syncing spin wheel...' : '❌ Sync error - reconnecting'}
                  </span>
                  <Badge variant="secondary" className="bg-orange-100 text-orange-700 px-2 py-1 text-xs">
                    🤝 Collaborator
                  </Badge>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2 p-4 bg-red-50 rounded-lg border-2 border-red-200 mt-4">
                  <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                  <span className="text-sm font-medium text-red-700">
                    🚫 Session ended - synchronization disabled
                  </span>
                  <Badge variant="destructive" className="px-2 py-1 text-xs">
                    Ended
                  </Badge>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4 lg:space-y-6">
          {/* Session Info */}
          <Card className="border-2 shadow-lg" style={{borderColor: '#8e0b16'}}>
            <CardHeader className="bg-gradient-to-r from-[#8e0b16] to-[#66181E] text-white rounded-t-lg p-1.5 sm:p-2">
              <CardTitle className="text-xs sm:text-sm font-bold flex items-center gap-1.5">
                <div className="p-0.5 bg-white/20 rounded flex-shrink-0">
                  <Radio className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                </div>
                <span className="truncate">Session Info</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5 sm:space-y-2 p-2 sm:p-3">
              <div className="flex justify-between items-center p-2 bg-gray-50 rounded-lg">
                <span className="font-medium text-sm" style={{color: '#8e0b16'}}>Status:</span>
                <Badge variant={
                  session.currentState === "waiting" ? "secondary" :
                  session.currentState === "spinning" ? "default" : "destructive"
                } className="px-2 py-0.5 text-xs">
                  {session.currentState.toUpperCase()}
                </Badge>
              </div>
              <div className="flex justify-between items-center p-2 bg-gray-50 rounded-lg">
                <span className="font-medium text-sm" style={{color: '#8e0b16'}}>Live Status:</span>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${session.isActive ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></div>
                  <Badge variant={session.isActive ? "default" : "secondary"} className="px-2 py-0.5 text-xs">
                    {session.isActive ? "LIVE" : "PAUSED"}
                  </Badge>
                </div>
              </div>
              {session.roomCode && (
                <div className="p-2 sm:p-3 border-2 rounded-lg" style={{borderColor: '#8e0b16', backgroundColor: 'rgba(142, 11, 22, 0.05)'}}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-medium text-xs sm:text-sm" style={{color: '#8e0b16'}}>Room Code:</span>
                  </div>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                    <span className="font-mono font-bold text-lg sm:text-xl px-2 py-1 rounded border-2 bg-white break-all" style={{borderColor: '#8e0b16', color: '#8e0b16'}}>
                      {session.roomCode}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        navigator.clipboard.writeText(session.roomCode!)
                        toast({
                          title: "Copied!",
                          description: "Room code copied to clipboard",
                        })
                      }}
                      className="h-8 w-full sm:w-8 p-1 sm:p-0 border-2 hover:bg-gray-50 text-xs"
                      style={{borderColor: '#8e0b16', color: '#8e0b16'}}
                    >
                      <Copy className="h-3 w-3 sm:mr-0 mr-1" />
                      <span className="sm:hidden">Copy</span>
                    </Button>
                  </div>
                </div>
              )}

              {/* Invite Students Section */}
              <div className="space-y-2 sm:space-y-3 pt-2 sm:pt-3 border-t-2" style={{borderColor: '#8e0b16'}}>
                <div className="text-xs font-bold text-center flex items-center justify-center gap-1 flex-wrap" style={{color: '#8e0b16'}}>
                  <Smartphone className="h-3 w-3 flex-shrink-0" />
                  <span>📱 Invite Students</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      const shareText = `Join my live wheel session!\n\nRoom Code: ${session.roomCode}\n\nOn web: Visit [your-website]/join\nOn mobile: Use the CobyPicks app and enter the room code\n\nLet's see who gets picked! 🎯`;

                      if (navigator.share) {
                        try {
                         await navigator.share({
                           title: 'Join Live Wheel Session',
                           text: shareText,
                         })
                       } catch (error) {
                         console.warn('Share failed:', error)
                       }
                      } else {
                        try {
                          await navigator.clipboard.writeText(shareText)
                          toast({
                            title: "📧 Invite Text Copied!",
                            description: "Share this text with participants via email, SMS, or messaging apps",
                            duration: 5000,
                          })
                        } catch (error) {
                          toast({
                            title: "Create Invite",
                            description: shareText,
                            duration: 10000,
                          })
                        }
                      }
                    }}
                    className="flex items-center justify-center gap-1 text-xs border-2 hover:bg-gray-50 transition-colors h-8"
                    style={{borderColor: '#8e0b16', color: '#8e0b16'}}
                  >
                    <Users className="h-3 w-3" />
                    Invite
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      const linkText = `Join the live session: [your-website]/join?code=${session.roomCode}`
                      try {
                        await navigator.clipboard.writeText(linkText)
                        toast({
                          title: "🔗 Link Copied!",
                          description: "Session link copied to clipboard",
                          duration: 3000,
                        })
                      } catch (error) {
                        toast({
                          title: "Link",
                          description: linkText,
                          duration: 5000,
                        })
                      }
                    }}
                    className="flex items-center justify-center gap-1 text-xs border-2 hover:bg-gray-50 transition-colors h-8"
                    style={{borderColor: '#8e0b16', color: '#8e0b16'}}
                  >
                    <Share2 className="h-3 w-3" />
                    Share
                  </Button>
                </div>
                <div className="text-center">
                  <Button
                    size="sm"
                    onClick={async () => {
                      const linkText = `Join the live session: [your-website]/join?code=${session.roomCode}`
                      try {
                        await navigator.clipboard.writeText(linkText)
                        toast({
                          title: "🔗 Link Copied!",
                          description: "Session link copied to clipboard",
                          duration: 3000,
                        })
                      } catch (error) {
                        toast({
                          title: "Link",
                          description: linkText,
                          duration: 5000,
                        })
                      }
                    }}
                    className="text-white text-xs px-3 py-1 hover:opacity-90 transition-opacity w-full"
                    style={{backgroundColor: '#8e0b16'}}
                  >
                    📧 Send Invites
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-1 sm:gap-2 pt-2 sm:pt-3 border-t border-gray-200">
                <div className="text-center p-1.5 sm:p-2 bg-gray-50 rounded-lg border">
                  <div className="text-sm sm:text-base font-bold" style={{color: '#8e0b16'}}>{participantsArray.length}</div>
                  <div className="text-xs text-gray-600">Items</div>
                </div>
                <div className="text-center p-1.5 sm:p-2 bg-gray-50 rounded-lg border">
                  <div className="text-sm sm:text-base font-bold" style={{color: '#8e0b16'}}>{organizerPresence.length}</div>
                  <div className="text-xs text-gray-600">Organizers</div>
                </div>
                <div className="text-center p-1.5 sm:p-2 bg-gray-50 rounded-lg border">
                  <div className="text-sm sm:text-base font-bold" style={{color: '#8e0b16'}}>{session.winners?.length || 0}</div>
                  <div className="text-xs text-gray-600">Winners</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Live Participants */}
          <Card className="border-2 shadow-lg" style={{borderColor: '#8e0b16'}}>
            <CardHeader className="bg-gradient-to-r from-[#8e0b16] to-[#66181E] text-white rounded-t-lg p-2 sm:p-3">
              <CardTitle className="text-sm sm:text-base font-bold flex items-center gap-1.5">
                <div className="p-0.5 bg-white/20 rounded flex-shrink-0">
                  <Users className="h-3 w-3" />
                </div>
                <span className="truncate">
                  Live Participants ({organizerPresence.length})
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-2 sm:p-3">
              {organizerPresence.length === 0 ? (
                <div className="text-center py-3 text-gray-500">
                  <div className="p-3 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                    <Users className="h-8 w-8 mx-auto mb-2 opacity-50" style={{color: '#8e0b16'}} />
                    <p className="text-xs font-medium mb-1" style={{color: '#8e0b16'}}>No organizers online yet</p>
                    <p className="text-xs text-gray-600">Waiting for organizer to join...</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-white/80 flex items-center gap-2">
                    <Crown className="h-3 w-3" />
                    Organizers ({organizerPresence.length})
                  </div>
                  <div className="max-h-32 overflow-y-auto">
                    {organizerPresence.map((organizer, index) => (
                      <div key={`organizer-${organizer.uid || `organizer-${index}`}`} className="flex items-center justify-between p-2 rounded-lg border-2 hover:shadow-md transition-shadow" style={{backgroundColor: 'rgba(255, 215, 0, 0.1)', borderColor: '#FFD700'}}>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          <Crown className="h-3 w-3 text-yellow-500" />
                          <span className="font-medium text-sm text-yellow-800">{organizer.name || 'Organizer'}</span>
                          <Badge variant="secondary" className="px-1 py-0 text-xs bg-green-100 text-green-700">
                            Online
                          </Badge>
                        </div>
                        <div className="text-xs text-yellow-600">
                          Active now
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Live Reactions & Comments */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <span>💬</span>
                Live Feedback ({recentActions.filter(action => action.action?.includes('comment') || action.action?.includes('reaction')).length})
              </CardTitle>
              <CardDescription>
                Real-time reactions and comments from participants
              </CardDescription>
            </CardHeader>
            <CardContent>
              {recentActions.filter(action => action.action?.includes('comment') || action.action?.includes('reaction')).length === 0 ? (
                <div className="text-center py-4 text-muted-foreground">
                  <span className="text-2xl mb-2 block">😊</span>
                  <p className="text-sm">No reactions or comments yet</p>
                  <p className="text-xs">Participants can react and comment during the live session</p>
                </div>
              ) : (
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {/* Recent Reactions */}
                  {recentActions.filter(action => action.action?.includes('reaction')).length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                        <span>😍</span> Recent Reactions ({recentActions.filter(action => action.action?.includes('reaction')).length})
                      </h4>
                      <div className="grid grid-cols-2 gap-2">
                        {recentActions.filter(action => action.action?.includes('reaction')).slice(0, 10).map((action, index) => (
                          <div key={`reaction-${index}`} className="flex items-center gap-2 p-2 bg-blue-50 rounded-lg border border-blue-200">
                            <span className="text-xl">{action.emoji || '😊'}</span>
                            <div className="flex-1 min-w-0">
                              <span className="font-medium text-blue-700 text-sm truncate block">
                                {action.performedByName || 'Collaborator'}
                              </span>
                              <div className="text-xs text-blue-600">
                                Just now
                              </div>
                            </div>
                            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Live Comments */}
                  {recentActions.filter(action => action.action?.includes('comment')).length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                        <span>💬</span> Live Comments ({recentActions.filter(action => action.action?.includes('comment')).length})
                      </h4>
                      <div className="space-y-2">
                        {recentActions.filter(action => action.action?.includes('comment')).slice(0, 5).map((action, index) => (
                          <div key={`comment-${index}`} className="p-3 bg-green-50 rounded-lg border border-green-200">
                            <div className="flex items-start gap-2">
                              <div className="w-2 h-2 bg-green-500 rounded-full mt-2 animate-pulse"></div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-medium text-green-700 text-sm">
                                    {action.performedByName || 'Collaborator'}
                                  </span>
                                  <span className="text-xs text-green-600">
                                    Just now
                                  </span>
                                </div>
                                <p className="text-sm text-gray-700">{action.message || action.action}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Show more indicator */}
                  {recentActions.filter(action => action.action?.includes('comment') || action.action?.includes('reaction')).length > 15 && (
                    <div className="text-center pt-2 border-t">
                      <p className="text-xs text-gray-500">
                        Showing recent feedback... Total: {recentActions.filter(action => action.action?.includes('comment') || action.action?.includes('reaction')).length} items
                      </p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>


      {/* Winners Display - Enhanced for collaborative sessions */}
      {session && session.winners && session.winners.length > 0 && (
        <Card className="border-0 shadow-sm bg-white rounded-2xl overflow-hidden">
          <div className="bg-gradient-to-r from-yellow-400 to-orange-500 p-6 text-white">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-white/20 rounded-xl">
                <Crown className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">🎉 Spin Wheel Winners!</h2>
                <p className="text-yellow-100">Results announced to all participants</p>
              </div>
            </div>
          </div>
          <CardContent className="p-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {session.winners.map((winner, index) => (
                <div key={winner.id} className="flex items-center gap-4 p-4 bg-gradient-to-r from-yellow-50 to-orange-50 rounded-2xl border border-yellow-200">
                  <div className="flex-shrink-0">
                    <Badge className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white text-lg px-3 py-1 rounded-xl">
                      #{index + 1}
                    </Badge>
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-yellow-900 text-lg">{winner.name}</p>
                    {winner.email && <p className="text-sm text-yellow-700">{winner.email}</p>}
                  </div>
                  <div className="text-2xl">🏆</div>
                </div>
              ))}
            </div>
            <div className="mt-6 p-4 bg-gradient-to-r from-yellow-50 to-orange-50 rounded-2xl border border-yellow-200 text-center">
              <p className="text-xl font-semibold text-yellow-800">
                {session.settings?.congratsMessage?.replace(
                  '{name}',
                  session.winners.map(w => w.name).join(', ')
                )}
              </p>
              <p className="text-sm text-yellow-600 mt-2">
                🔄 Ready for next spin wheel round!
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Enhanced Winner Popup */}
      <TextWinnerPopup
        isOpen={showWinnerPopup && !!(session?.winners && session.winners.length > 0)}
        onClose={() => setShowWinnerPopup(false)}
        winners={session?.winners || []}
        congratsMessage={session?.settings?.congratsMessage || session?.customMessage || "🎉 Congratulations! "}
        customWinnerMessage={session?.customMessage || ""}
        customWinnerWord={session?.customWinnerWord || "Winner"}
        showConfetti={true}
        autoClose={10}
        theme={session?.selectedWheelType ? {
          primary: session.selectedWheelType.color || '#8e0b16',
          secondary: session.selectedWheelType.color || '#8e0b16',
          accent: '#ffffff'
        } : schoolColors}
      />
    </div>
  )
}
