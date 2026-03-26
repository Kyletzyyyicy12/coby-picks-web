"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/hooks/use-toast"
import { db } from "@/lib/firebase"
import {
  collection,
  addDoc,
  doc,
  updateDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  getDocs,
  setDoc,
  Timestamp,
  serverTimestamp,
  writeBatch,
  limit
} from "firebase/firestore"

import { type PickerWheelType } from "@/lib/picker-wheel-types"
import CrossPlatformSessionManager from "@/lib/CrossPlatformSessionManager"
import { createSessionThemeConfig } from "@/lib/ThemeMapper"
import CollaborativeLiveRoomManager from "@/lib/collaborative-live-room-manager"
import { useAuth } from "@/contexts/AuthContext"
import { OrganizerRequestManager } from "@/components/live/organizer-request-manager"
import { EnhancedWheel } from "@/components/randomizer/enhanced-wheel"
import {
  Users,
  Play,
  Square,
  Copy,
  Eye,
  Trophy,
  Heart,
  ThumbsUp,
  Star,
  Zap,
  RefreshCw,
  Wifi,
  WifiOff,
  Radio,
  Settings,
  Crown,
  Target,
  BarChart3,
  RotateCcw
} from "lucide-react"
import type { User as FirebaseUser } from "firebase/auth"

interface Participant {
  id: string
  name: string
  email?: string
}

interface LiveSession {
    id: string
    roomCode: string
    title: string
    description: string
    createdBy: string
    createdAt: Date
    activityId?: string
    isActive: boolean
    isLive: boolean
    currentState: "waiting" | "spinning" | "ended"
    participants: Participant[]
    viewers: Array<{ id: string; name: string; joinedAt: Date }>
    winners: Participant[]
    maxParticipants?: number

    // Enhanced wheel information
    wheelType?: string
    wheelItems?: string[]
    selectedWheelType?: PickerWheelType | null
    wheelTitle?: string

    // Enhanced wheel state for real-time synchronization
    wheelState?: {
      isSpinning: boolean
      spinStartTime?: number
      spinDuration?: number
      totalRotation?: number
      finalAngle?: number
      currentAngle?: number
      progress?: number
      startedAt?: any
      completedAt?: any
      hasResults?: boolean
    }

    // Real-time notifications
    spinningNotification?: {
      message: string
      timestamp: any
      isActive: boolean
    }
    
    resultNotification?: {
      message: string
      winners: Participant[]
      timestamp: any
      isActive: boolean
      showConfetti: boolean
    }

    // Theme configuration for cross-platform sync
    themeConfig?: {
      organizerTheme: string
      customColors?: {
        primary: string
        secondary: string
        background: string
        surface: string
        text: string
        accent: string
      }
      wheelTheme?: string
      syncEnabled: boolean
      lastThemeUpdate?: any
    }

    settings: {
      numberOfWinners: number
      congratsMessage: string
      allowReactions: boolean
      maxParticipants?: number
    }
    viewerCount: number
    teacherPresence: {
      userId: string
      lastSeen: Date
      isOnline: boolean
    }
  }

interface LiveRoomOrganizerProps {
  user: FirebaseUser
  participants: Participant[]
  onSessionCreated?: (sessionId: string, roomCode: string) => void
  onSessionEnded?: () => void
}

export function LiveRoomOrganizer({
  user,
  participants,
  onSessionCreated,
  onSessionEnded
}: LiveRoomOrganizerProps) {
  const { currentUser, userProfile } = useAuth()
  const [session, setSession] = useState<LiveSession | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [viewers, setViewers] = useState<Array<{ id: string; name: string; joinedAt: Date }>>([])
  const [reactions, setReactions] = useState<Array<{ id: string; emoji: string; userName: string; timestamp: Date }>>([])
  const [participantEvents, setParticipantEvents] = useState<Array<{ id: string; type: 'join' | 'leave'; participantName: string; platform: string; timestamp: Date }>>([])
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'connecting'>('disconnected')
  const [roomCode, setRoomCode] = useState<string>("")
  
  // Collaborative live room state
  const [collaborativeManager, setCollaborativeManager] = useState<CollaborativeLiveRoomManager | null>(null)
  const [activeCollaborators, setActiveCollaborators] = useState<string[]>([])
  const [isCollaborating, setIsCollaborating] = useState(false)
  const [realtimeCollaboratorJoins, setRealtimeCollaboratorJoins] = useState<Array<{id: string, name: string, platform: string, joinedAt: Date}>>([]) // Track real-time joins
  const [sessionSettings, setSessionSettings] = useState({
    title: "Live Wheel Session",
    description: "Interactive random selection session",
    numberOfWinners: 1,
    congratsMessage: "Congratulations, {name}! 🎉",
    allowReactions: true,
    maxParticipants: 50,
    selectedWheelType: null as PickerWheelType | null,
    showWheelSelector: false,
    theme: "school", // Default theme
    enableThemeSync: true // Enable theme synchronization by default
  })

  // Collaboration invitation state
  const [showInviteDialog, setShowInviteDialog] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [isInviting, setIsInviting] = useState(false)

  const unsubscribeRef = useRef<(() => void) | null>(null)
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null)

  // Generate a unique 6-character room code with mixed letters and numbers
  const generateRoomCode = (): string => {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    const numbers = '0123456789'
    const allChars = letters + numbers

    let result = ''

    // Generate code with guaranteed mix
    for (let i = 0; i < 6; i++) {
      const char = allChars.charAt(Math.floor(Math.random() * allChars.length))
      result += char
    }

    // Ensure we have at least 2 numbers and 2 letters for better mix
    const numberCount = (result.match(/\d/g) || []).length
    const letterCount = (result.match(/[A-Z]/g) || []).length

    if (numberCount < 2 || letterCount < 2) {
      // Regenerate with better distribution
      const positions = [0, 1, 2, 3, 4, 5]
      result = ''

      // Place at least 2 numbers and 2 letters
      const numberPositions = []
      const letterPositions = []

      // Select positions for numbers
      while (numberPositions.length < 2) {
        const pos = positions.splice(Math.floor(Math.random() * positions.length), 1)[0]
        numberPositions.push(pos)
      }

      // Select positions for letters
      while (letterPositions.length < 2) {
        const pos = positions.splice(Math.floor(Math.random() * positions.length), 1)[0]
        letterPositions.push(pos)
      }

      // Fill remaining positions randomly
      for (let i = 0; i < 6; i++) {
        if (numberPositions.includes(i)) {
          result += numbers.charAt(Math.floor(Math.random() * numbers.length))
        } else if (letterPositions.includes(i)) {
          result += letters.charAt(Math.floor(Math.random() * letters.length))
        } else {
          result += allChars.charAt(Math.floor(Math.random() * allChars.length))
        }
      }
    }

    return result
  }

  // Create a new live session
  const createSession = async () => {
    setIsCreating(true)
    setConnectionStatus('connecting')

    try {
      const newRoomCode = generateRoomCode()

      const sessionData = {
        roomCode: newRoomCode,
        title: sessionSettings.title,
        description: sessionSettings.description,
        createdBy: user.uid,
        createdAt: Timestamp.fromDate(new Date()),
        activityId: null, // Will be set if created from an activity
        isActive: true,
        isLive: true,
        currentState: "waiting",
        participants: participants,
        viewers: [],
        winners: [],

        // Enhanced wheel information
        wheelType: sessionSettings.selectedWheelType?.id || "team-picker",
        wheelTitle: sessionSettings.selectedWheelType?.title || "Live Wheel",
        wheelItems: sessionSettings.selectedWheelType?.defaultItems || participants.map(p => p.name),
        selectedWheelType: sessionSettings.selectedWheelType,

        settings: {
          numberOfWinners: sessionSettings.numberOfWinners,
          congratsMessage: sessionSettings.congratsMessage,
          allowReactions: sessionSettings.allowReactions,
          maxParticipants: sessionSettings.maxParticipants
        },
        maxParticipants: sessionSettings.maxParticipants,
        viewerCount: 0,
        teacherPresence: {
          userId: user.uid,
          lastSeen: serverTimestamp(),
          isOnline: true
        }
      }

      console.log('🔍 DEBUG: Session data before addDoc:', JSON.stringify(sessionData, null, 2));
      console.log('🎯 Selected wheel type in session:', sessionSettings.selectedWheelType);

      // Validate no undefined values
      const validateData = (obj: any, path = ''): boolean => {
        for (const [key, value] of Object.entries(obj)) {
          const currentPath = path ? `${path}.${key}` : key;
          if (value === undefined) {
            console.error(`❌ Found undefined value at: ${currentPath}`);
            return false;
          }
          if (value && typeof value === 'object' && !Array.isArray(value)) {
            if (!validateData(value, currentPath)) return false;
          }
        }
        return true;
      };

      if (!validateData(sessionData)) {
        throw new Error('Session data contains undefined values');
      }

      const docRef = await addDoc(collection(db, "liveDrawSessions"), sessionData)
      setRoomCode(newRoomCode)

      // Add theme synchronization for cross-platform consistency
      if (sessionSettings.enableThemeSync) {
        try {
          const sessionManager = CrossPlatformSessionManager;
          const themeConfig = createSessionThemeConfig(sessionSettings.theme, sessionSettings.theme);
          await sessionManager.updateSessionTheme(docRef.id, themeConfig);
          console.log('✅ Theme synchronized for live session:', sessionSettings.theme);
        } catch (themeError) {
          console.warn('⚠️ Theme sync failed, but live session is active:', themeError);
        }
      }

      // Start real-time listeners
      startSessionListeners(docRef.id)

      // Start teacher heartbeat
      startTeacherHeartbeat(docRef.id)

      setConnectionStatus('connected')

      toast({
        title: "🎉 Session Created Successfully!",
        description: `Room code: ${newRoomCode}. Participants can now join!`,
      })

      onSessionCreated?.(docRef.id, newRoomCode)

    } catch (error: any) {
      console.error("Error creating session:", error)
      setConnectionStatus('disconnected')
      toast({
        title: "Error Creating Session",
        description: error.message,
        variant: "destructive"
      })
    } finally {
      setIsCreating(false)
    }
  }

  // Start real-time listeners for the session
  const startSessionListeners = (sessionId: string) => {
    // Listen to session updates
    const sessionUnsubscribe = onSnapshot(
      doc(db, "liveDrawSessions", sessionId),
      (doc) => {
        if (doc.exists()) {
          const data = doc.data()
          setSession({
            id: doc.id,
            roomCode: data.roomCode || '',
            title: data.title || '',
            description: data.description || '',
            createdBy: data.createdBy || '',
            createdAt: data.createdAt?.toDate() || new Date(),
            activityId: data.activityId,
            isActive: data.isActive || false,
            isLive: data.isLive || false,
            currentState: data.currentState || 'waiting',
            participants: data.participants || [],
            viewers: data.viewers || [],
            winners: data.winners || [],

            // Enhanced wheel information
            wheelType: data.wheelType || 'team-picker',
            wheelTitle: data.wheelTitle || 'Live Wheel',
            wheelItems: data.wheelItems || [],
            selectedWheelType: data.selectedWheelType || null,

            settings: data.settings || { numberOfWinners: 1, congratsMessage: '', allowReactions: true },
            viewerCount: data.viewerCount || 0,
            teacherPresence: data.teacherPresence || { userId: '', lastSeen: new Date(), isOnline: false }
          } as LiveSession)
        }
      },
      (error) => {
        console.error("Session listener error:", error)
        setConnectionStatus('disconnected')
      }
    )

    // Listen to viewers subcollection
    const viewersUnsubscribe = onSnapshot(
      collection(db, "liveDrawSessions", sessionId, "viewers"),
      (snapshot) => {
        const viewerList = snapshot.docs.map(doc => {
          const data = doc.data()
          return {
            id: doc.id,
            name: data.name || 'Unknown',
            joinedAt: data.joinedAt?.toDate() || new Date()
          }
        })
        setViewers(viewerList)

        // Update viewer count in main document
        updateDoc(doc(db, "liveDrawSessions", sessionId), {
          viewerCount: viewerList.length,
          lastUpdated: serverTimestamp()
        }).catch(console.error)
      },
      (error) => {
        console.error("Viewers listener error:", error)
      }
    )

    // Listen to reactions
    const reactionsUnsubscribe = onSnapshot(
      collection(db, "liveDrawSessions", sessionId, "reactions"),
      (snapshot) => {
        const reactionList = snapshot.docs.map(doc => {
          const data = doc.data()
          return {
            id: doc.id,
            emoji: data.emoji || '👍',
            userName: data.userName || 'Anonymous',
            timestamp: data.timestamp?.toDate() || new Date()
          }
        })
        setReactions(reactionList.slice(-20)) // Keep last 20 reactions
      }
    )

    // Enhanced: Listen to participant events for real-time join/leave notifications
    const participantEventsUnsubscribe = onSnapshot(
      collection(db, "liveDrawSessions", sessionId, "participantEvents"),
      (snapshot) => {
        const eventList = snapshot.docs.map(doc => {
          const data = doc.data()
          return {
            id: doc.id,
            type: data.type || 'join',
            participantName: data.participantName || 'Unknown',
            platform: data.platform || 'unknown',
            timestamp: data.timestamp?.toDate() || new Date()
          }
        }).sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        setParticipantEvents(eventList.slice(0, 10)) // Keep last 10 events
        
        // Show toast notification for recent events (within last 5 seconds)
        const recentEvents = eventList.filter(event => 
          Date.now() - event.timestamp.getTime() < 5000
        )
        
        recentEvents.forEach(event => {
          if (event.type === 'join') {
            toast({
              title: "\ud83d\udfe2 Participant Joined",
              description: `${event.participantName} joined from ${event.platform}`,
              duration: 4000,
            })
          } else if (event.type === 'leave') {
            toast({
              title: "\ud83d\udd34 Participant Left", 
              description: `${event.participantName} left the session`,
              variant: "destructive",
              duration: 3000,
            })
          }
        })
      },
      (error) => {
        console.error("Participant events listener error:", error)
      }
    )

    unsubscribeRef.current = () => {
      sessionUnsubscribe()
      viewersUnsubscribe()
      reactionsUnsubscribe()
      participantEventsUnsubscribe()
    }
  }

  // Start teacher heartbeat to show online status
  const startTeacherHeartbeat = (sessionId: string) => {
    const updatePresence = async () => {
      try {
        await updateDoc(doc(db, "liveDrawSessions", sessionId), {
          "teacherPresence.lastSeen": new Date(),
          "teacherPresence.isOnline": true
        })
      } catch (error) {
        console.error("Heartbeat error:", error)
      }
    }

    // Update immediately
    updatePresence()

    // Update every 30 seconds
    heartbeatRef.current = setInterval(updatePresence, 30000)
  }

  // Initialize collaborative manager when session is created
  useEffect(() => {
    if (session && currentUser) {
      const manager = CollaborativeLiveRoomManager.getInstance()
      setCollaborativeManager(manager)
      
      // Update organizer presence
      const updatePresence = async () => {
        await manager.updateOrganizerPresence(session.id, {
          uid: currentUser.uid,
          name: userProfile?.name || 'Organizer',
          email: currentUser.email || '',
          isOnline: true,
          lastSeen: Date.now(),
          permissions: {
            canControlLive: true, // Owner has full permissions
            canEditWheel: true,
            canManageParticipants: true
          }
        })
      }
      
      // Update presence immediately and then periodically
      updatePresence()
      const presenceInterval = setInterval(updatePresence, 30000)
      
      // Listen to organizer presence to track collaborators
      const presenceUnsubscribe = manager.listenToOrganizerPresence(session.id, (organizers) => {
        const otherOrganizers = organizers.filter(org => org.uid !== currentUser.uid)
        setActiveCollaborators(otherOrganizers.map(org => org.name))
        setIsCollaborating(otherOrganizers.length > 0)
      })
      
      // Listen for real-time organizer presence notifications (new joins)
      const organizerPresenceQuery = query(
        collection(db, 'organizerPresence'),
        where('status', '==', 'joined_collaboration'),
        orderBy('joinedAt', 'desc'),
        limit(10)
      )
      
      const realtimePresenceUnsubscribe = onSnapshot(organizerPresenceQuery, (snapshot) => {
        const newJoins = snapshot.docs.map(doc => {
          const data = doc.data()
          return {
            id: doc.id,
            name: data.organizerName || 'Organizer',
            platform: data.platform || 'unknown',
            joinedAt: data.joinedAt?.toDate() || new Date()
          }
        }).filter(join => {
          // Only show joins from the last 30 seconds and not by current user
          const now = new Date()
          const timeDiff = now.getTime() - join.joinedAt.getTime()
          return timeDiff < 30000 && join.name !== (userProfile?.name || 'Organizer')
        })
        
        // Show toast notifications for new collaborators joining
        newJoins.forEach(join => {
          toast({
            title: "🤝 Collaborator Joined!",
            description: `${join.name} has joined the collaboration from ${join.platform}. You can now work together on live sessions!`,
            duration: 6000,
          })
        })
        
        setRealtimeCollaboratorJoins(newJoins)
      })
      
      return () => {
        clearInterval(presenceInterval)
        presenceUnsubscribe()
        realtimePresenceUnsubscribe()
      }
    } else {
      setCollaborativeManager(null)
      setIsCollaborating(false)
      setActiveCollaborators([])
      setRealtimeCollaboratorJoins([])
    }
  }, [session, currentUser, userProfile])
  

  // Enhanced winner selection with real-time broadcasting
  const selectWinners = async () => {
    if (!session) return

    try {
      console.log("🎯 ORGANIZER: Manual selectWinners triggered - checking wheel submission")
      const availableParticipants = [...session.participants]
      const selectedWinners = []

      for (let i = 0; i < session.settings.numberOfWinners && availableParticipants.length > 0; i++) {
        const randomIndex = Math.floor(Math.random() * availableParticipants.length)
        selectedWinners.push(availableParticipants.splice(randomIndex, 1)[0])
      }

      // Calculate exact winner data for perfect synchronization
      const exactWinnerData = {
        winners: selectedWinners,
        finalAngle: session.wheelState?.finalAngle || 0,
        completedAt: Date.now(),
        organizerTimestamp: Date.now()
      }
      
      console.log('⚡ ORGANIZER: Broadcasting EXACT winner data:', {
        winnerCount: selectedWinners.length,
        winnerNames: selectedWinners.map(w => w.name),
        exactSync: true
      })
      
      // 🚀 PRIORITY: INSTANT zero-delay winner broadcast for immediate participant response
      // ✅ FIX: Explicitly reset currentState to "waiting" for unlimited spins
      await updateDoc(doc(db, "liveDrawSessions", session.id), {
        winners: selectedWinners, // Keep winners for display only
        lastUpdated: Timestamp.fromDate(new Date()),
        currentState: "waiting", // 🔄 RESET: Always ready for next spin
        // 💥 Enhanced wheel state for INSTANT final results - FIXED: Complete winner data transmission
        wheelState: {
          isSpinning: false,
          progress: 1,
          ...exactWinnerData,
          hasResults: true,
          // 🚀 PRIORITY flags for instant participant response
          instantResult: true,
          participantSync: "immediate",
          accuracyMode: "exact",
          zeroDelay: true,
          // FIXED: Ensure all winner details are included
          winners: selectedWinners,
          winnerCount: selectedWinners.length,
          winnerNames: selectedWinners.map(w => w.name),
          completedAt: Date.now()
        },
        // 🚀 PRIORITY result notification for INSTANT participant response
        resultNotification: {
          message: selectedWinners.length === 1
            ? `🎉 WINNER: ${selectedWinners[0].name}!`
            : `🎉 WINNERS: ${selectedWinners.map(w => w.name).join(', ')}!`,
          winners: selectedWinners,
          timestamp: Timestamp.fromDate(new Date()),
          isActive: true,
          showConfetti: true,
          priority: "immediate", // Highest priority for instant display
          zeroDelay: true // Flag for immediate participant response
        },
        // Clear spinning notification
        spinningNotification: {
          isActive: false
        },
        // 💥 Force immediate sync heartbeat
        syncHeartbeat: Date.now(),
        winnerBroadcastTime: Date.now()
      })

      // Toast notification removed to prevent duplication - winners are shown visually
      console.log('✅ Winners Selected:', {
        count: selectedWinners.length,
        names: selectedWinners.map(w => w.name),
        readyForNextSpin: true
      })

      // Enhanced: Broadcast individual winner notifications to subcollection for better real-time sync
      const batch = writeBatch(db)
      selectedWinners.forEach((winner, index) => {
        const winnerNotificationRef = doc(collection(db, "liveDrawSessions", session.id, "winnerNotifications"))
        batch.set(winnerNotificationRef, {
          winnerId: winner.id,
          winnerName: winner.name,
          winnerEmail: winner.email || '',
          position: index + 1,
          totalWinners: selectedWinners.length,
          message: session.settings.congratsMessage.replace('{name}', winner.name),
          timestamp: Timestamp.fromDate(new Date()),
          sessionId: session.id,
          isActive: true
        })
      })
      
      await batch.commit()
      console.log('✨ Winner notifications broadcasted to all participants')
      console.log('🚀 UNLIMITED SPINS: Session automatically reset to "waiting" state - ready for next spin!')

    } catch (error) {
      console.error("Error selecting winners:", error)
      toast({
        title: "Error",
        description: "Failed to select winners",
        variant: "destructive"
      })
    }
  }

  // Reset wheel for next spin
  const resetForNextSpin = async () => {
    if (!session) return

    try {
      // Calculate exact reset position (same as final angle to maintain consistency)
      const resetPosition = session.wheelState?.finalAngle || 0

      // Reset to waiting state with exact reset position
      await updateDoc(doc(db, "liveDrawSessions", session.id), {
        currentState: "waiting",
        isSpinning: false,
        winners: [],
        lastUpdated: Timestamp.fromDate(new Date()),
        // Clear wheel state for next spin with exact reset position
        wheelState: {
          isSpinning: false,
          currentAngle: resetPosition,
          progress: 0,
          hasResults: false,
          resetPosition: resetPosition, // Send exact reset position to participants
          zeroDelay: true,
          participantSync: 'immediate'
        },
        // Clear notifications to prevent duplicate messages
        spinningNotification: {
          isActive: false
        },
        resultNotification: {
          isActive: false,
          showConfetti: false
        },
        // Force immediate sync heartbeat
        syncHeartbeat: Date.now(),
        resetBroadcastTime: Date.now()
      })

      toast({
        title: "🔄 Ready for Next Spin!",
        description: "Wheel has been reset and is ready for another spin",
        duration: 4000,
      })

      console.log('✅ Wheel reset successfully - ready for next spin at position:', resetPosition)

    } catch (error) {
      console.error("Error resetting wheel:", error)
      toast({
        title: "Error Resetting Wheel",
        description: "Failed to reset wheel for next spin. Please try again.",
        variant: "destructive"
      })
    }
  }

  // End the session
  const endSession = async () => {
    if (!session) return

    try {
      // Store session in spin history before ending
      const historyData = {
        sessionId: session.id,
        title: session.title,
        description: session.description,
        wheelType: session.wheelType,
        wheelTitle: session.wheelTitle,
        wheelIcon: session.selectedWheelType?.icon || '🎯',
        participants: session.participants,
        winners: session.winners || [],
        createdBy: session.createdBy,
        createdAt: session.createdAt,
        endedAt: new Date(),
        roomCode: session.roomCode,
        viewerCount: session.viewerCount || 0,
        totalSpins: session.winners?.length || 0,
        sessionDuration: Math.round((new Date().getTime() - session.createdAt.getTime()) / 1000), // in seconds
        selectedWheelType: session.selectedWheelType,
        settings: session.settings,
        endedExplicitly: true, // Mark as explicitly ended by organizer
        category: session.selectedWheelType?.category || "personal",
        currentState: "completed", // ✅ 'completed' status for history logs only
        finalWinners: session.winners || [], // Keep winners in history
        spinCount: session.winners?.length || 0 // Track total spins
      }

      // Save to live wheel history collection (for "View Spin History")
      await addDoc(collection(db, "liveWheelHistory"), historyData)

      // Also save to spin history for compatibility - ✅ with 'completed' status
      const spinHistoryData = {
        activityId: session.activityId || session.id,
        activityTitle: session.title,
        winners: (session.winners || []).map(w => w.name || w),
        participantCount: session.participants.length,
        timestamp: new Date(),
        category: session.selectedWheelType?.category || "personal",
        numberOfWinners: session.winners?.length || 0,
        spinDuration: 3000, // Default duration
        createdBy: session.createdBy,
        createdAt: session.createdAt,
        sessionId: session.id,
        roomCode: session.roomCode,
        currentState: "completed", // ✅ 'completed' status in spin history logs
        finalWinners: session.winners || [] // ✅ Complete winners list for history
      }
      await addDoc(collection(db, "spinHistory"), spinHistoryData)

      // Update the session to mark as explicitly ended
      await updateDoc(doc(db, "liveDrawSessions", session.id), {
        isActive: false,
        isLive: false,
        currentState: "ended",
        closedAt: Timestamp.fromDate(new Date()),
        endedAt: Timestamp.fromDate(new Date()),
        archivedAt: Timestamp.fromDate(new Date()),
        endedExplicitly: true, // This flag indicates organizer explicitly ended the session
        "teacherPresence.isOnline": false
      })

      // Update the corresponding draw activity if it exists
      if (session.activityId) {
        try {
          await updateDoc(doc(db, "drawActivities", session.activityId), {
            isLive: false,
            hasActiveSession: false, // Remove from Recent Draw Activities
            lastUsed: Timestamp.fromDate(new Date()),
            timesUsed: (session.winners?.length || 0) > 0 ? 1 : 0, // Mark as used if there were winners
            updatedAt: Timestamp.fromDate(new Date()),
            endedAt: Timestamp.fromDate(new Date()),
            movedToHistory: true // Flag to indicate this is now in history
          })
          console.log("✅ Updated draw activity - moved to history:", session.activityId)
        } catch (error) {
          console.log("Could not update activity end status:", error)
        }
      }

      // Clean up listeners and heartbeat
      if (unsubscribeRef.current) {
        unsubscribeRef.current()
      }
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current)
      }

      setSession(null)
      setViewers([])
      setConnectionStatus('disconnected')

      toast({
        title: "Session Ended Successfully",
        description: "Live session has been ended and saved to Spin History. You can view it in the history section.",
        duration: 6000,
      })

      // Trigger callback to refresh parent components (dashboard)
      onSessionEnded?.()

      // Dispatch custom event to notify other components about session end
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('sessionEnded', {
          detail: {
            sessionId: session.id,
            title: session.title,
            endedAt: new Date(),
            roomCode: session.roomCode
          }
        }))
      }

    } catch (error: any) {
      console.error("Error ending session:", error)
      toast({
        title: "Error Ending Session",
        description: error.message,
        variant: "destructive"
      })
    }
  }

  // Copy room code to clipboard
  const copyRoomCode = async () => {
    if (!roomCode) return

    try {
      await navigator.clipboard.writeText(roomCode)
      toast({
        title: "Copied!",
        description: "Room code copied to clipboard",
      })
    } catch (error) {
      toast({
        title: "Copy Failed",
        description: "Could not copy room code",
        variant: "destructive"
      })
    }
  }

  // Create collaboration invitation
  const createCollaborationInvitation = async (organizerEmail: string) => {
    if (!session || !roomCode) {
      toast({
        title: "Error",
        description: "No active session found. Please create a session first.",
        variant: "destructive"
      })
      return
    }

    try {
      console.log('🤝 Creating collaboration invitation for:', organizerEmail)

      const invitationData = {
        sessionId: session.id,
        sessionTitle: session.title,
        sessionDescription: session.description,
        wheelType: session.wheelType || 'team-picker',
        wheelTitle: session.wheelTitle || 'Live Wheel',
        wheelIcon: session.selectedWheelType?.icon || '🎯',
        roomCode: roomCode, // ✅ Include the correct room code from the live session

        // Inviter information
        invitedBy: user.uid,
        invitedByName: userProfile?.name || user.displayName || 'Organizer',
        invitedByEmail: user.email || '',

        // Invitee information
        invitedOrganizerEmail: organizerEmail,
        invitedOrganizer: null, // Will be filled when they accept

        // Invitation details
        status: 'sent',
        type: 'live_room_invitation',
        createdAt: serverTimestamp(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours

        // Session configuration
        sessionConfig: {
          maxParticipants: session.maxParticipants || 50,
          allowReactions: session.settings?.allowReactions ?? true,
          confettiEffect: true,
          soundEffects: true,
          liveSession: true,
          allowDataSync: true
        },

        // Collaboration permissions
        permissions: {
          canControlLive: true,
          canEditWheel: true,
          canManageParticipants: true,
          canEndSession: false, // Only primary organizer can end
          canInviteOthers: false
        },

        // Notification metadata
        isRealTimeNotification: true,
        priority: 'high',
        requiresImmediateAttention: true,

        // Track notification delivery
        notificationSent: true,
        sentAt: serverTimestamp()
      }

      // Create the invitation directly
      const docRef = await addDoc(collection(db, "liveRoomInvitations"), invitationData)

      toast({
        title: "🤝 Collaboration Invitation Sent!",
        description: `Invitation sent to ${organizerEmail} with room code: ${roomCode}`,
        duration: 6000,
      })
      console.log('✅ Collaboration invitation created successfully:', docRef.id)

    } catch (error: any) {
      console.error('❌ Error creating collaboration invitation:', error)
      toast({
        title: "Error Creating Invitation",
        description: error.message || "Failed to send collaboration invitation. Please try again.",
        variant: "destructive"
      })
    }
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current()
      }
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current)
      }
    }
  }, [])

  const getConnectionIcon = () => {
    switch (connectionStatus) {
      case 'connected':
        return <Wifi className="h-4 w-4 text-[#10b981]" />
      case 'connecting':
        return <RefreshCw className="h-4 w-4 text-yellow-500 animate-spin" />
      default:
        return <WifiOff className="h-4 w-4 text-red-500" />
    }
  }

  const getConnectionBadge = () => {
    switch (connectionStatus) {
      case 'connected':
        return <Badge variant="default" className="bg-[#10b981]">Live</Badge>
      case 'connecting':
        return <Badge variant="secondary">Connecting...</Badge>
      default:
        return <Badge variant="destructive">Offline</Badge>
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header Section */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gradient-to-r from-[#8e0b16] to-[#66181E] rounded-xl">
                <Crown className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                  Live Session Organizer
                  {getConnectionIcon()}
                </h1>
                <p className="text-gray-600">
                  Create and manage real-time sessions for participants to join and interact
                </p>
                {isCollaborating && (
                  <div className="mt-2 flex items-center gap-2">
                    <Users className="h-4 w-4 text-[#8e0b16]" />
                    <Badge variant="secondary" className="bg-[#8e0b16]/10 text-[#8e0b16] text-xs">
                      🤝 {activeCollaborators.length + 1} Organizers
                    </Badge>
                    <span className="text-sm text-[#8e0b16]">
                      Collaborating with: {activeCollaborators.join(', ')}
                    </span>
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {getConnectionBadge()}
            </div>
          </div>
        </div>

        {!session ? (
          // Create Session Section - Modern Layout
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* Welcome Card */}
            <div className="xl:col-span-3">
              <div className="bg-gradient-to-r from-[#8e0b16] to-[#66181E] rounded-2xl p-6 text-white">
                <div className="flex items-center gap-3 mb-4">
                  <Radio className="h-6 w-6" />
                  <h2 className="text-xl font-semibold">Ready to Go Live</h2>
                </div>
                <p className="text-white/80 mb-4">
                  Create a session with {participants.length} participants. They can join using the room code.
                </p>
                <div className="flex items-center gap-2 text-white/80">
                  <Users className="h-4 w-4" />
                  <span className="text-sm">{participants.length} participants ready</span>
                </div>
              </div>
            </div>

            {/* Session Configuration */}
            <div className="xl:col-span-2 space-y-6">
              {/* Basic Settings Card */}
              <Card className="border-0 shadow-sm bg-white rounded-2xl">
                <CardHeader className="border-b border-gray-100 pb-4">
                  <CardTitle className="text-lg flex items-center gap-3 text-gray-900">
                    <div className="p-2 bg-[#8e0b16]/20 rounded-lg">
                      <Settings className="h-5 w-5 text-white" />
                    </div>
                    Session Configuration
                  </CardTitle>
                  <CardDescription className="text-gray-600">
                    Configure your live session settings and preferences
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6 pt-6">
                  <div className="grid gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="title" className="text-sm font-medium text-gray-700">
                        Session Title
                      </Label>
                      <Input
                        id="title"
                        value={sessionSettings.title}
                        onChange={(e) => setSessionSettings(prev => ({ ...prev, title: e.target.value }))}
                        placeholder="Enter session title"
                        className="h-12 border-gray-200 focus:border-[#8e0b16] focus:ring-[#8e0b16]"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="description" className="text-sm font-medium text-gray-700">
                        Description
                      </Label>
                      <Textarea
                        id="description"
                        value={sessionSettings.description}
                        onChange={(e) => setSessionSettings(prev => ({ ...prev, description: e.target.value }))}
                        placeholder="Brief description of this session"
                        rows={3}
                        className="border-gray-200 focus:border-[#8e0b16] focus:ring-[#8e0b16] resize-none"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Activity Options Card */}
              <Card className="border-0 shadow-sm bg-white rounded-2xl">
                <CardHeader className="border-b border-gray-100 pb-4">
                  <CardTitle className="text-lg flex items-center gap-3 text-gray-900">
                    <div className="p-2 bg-[#10b981]/20 rounded-lg">
                      <Target className="h-5 w-5 text-[#10b981]" />
                    </div>
                    Activity Options
                  </CardTitle>
                  <CardDescription className="text-gray-600">
                    Configure sharing, scheduling, and interaction options for your wheel activity
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6 pt-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="winners" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                        <Trophy className="h-4 w-4 text-yellow-500" />
                        Number of Winners
                      </Label>
                      <Input
                        id="winners"
                        type="number"
                        min="1"
                        max="10"
                        value={sessionSettings.numberOfWinners}
                        onChange={(e) => setSessionSettings(prev => ({
                          ...prev,
                          numberOfWinners: parseInt(e.target.value) || 1
                        }))}
                        className="h-12 border-gray-200 focus:border-yellow-500 focus:ring-yellow-500"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="maxParticipants" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                        <Users className="h-4 w-4 text-[#8e0b16]" />
                        Max Participants
                      </Label>
                      <Input
                        id="maxParticipants"
                        type="number"
                        min="1"
                        max="50"
                        value={sessionSettings.maxParticipants}
                        onChange={(e) => setSessionSettings(prev => ({
                          ...prev,
                          maxParticipants: Math.min(50, Math.max(1, parseInt(e.target.value) || 50))
                        }))}
                        className="h-12 border-gray-200 focus:border-[#8e0b16] focus:ring-[#8e0b16]"
                      />
                      <p className="text-xs text-gray-500">
                        Limit: 1-50 participants
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="message" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                        <span className="text-lg">🎉</span>
                        Congrats Message
                      </Label>
                      <Input
                        id="message"
                        value={sessionSettings.congratsMessage}
                        onChange={(e) => setSessionSettings(prev => ({ ...prev, congratsMessage: e.target.value }))}
                        placeholder="Use {name} for winner's name"
                        className="h-12 border-gray-200 focus:border-[#10b981] focus:ring-[#10b981]"
                      />
                    </div>
                  </div>

                  {/* Wheel Type Selection */}
                  <div className="space-y-3">
                    <Label className="text-sm font-medium text-gray-700">Wheel Type</Label>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setSessionSettings(prev => ({ ...prev, showWheelSelector: true }))}
                      className="w-full h-16 justify-start border-2 border-dashed border-gray-300 hover:border-[#8e0b16] hover:bg-[#8e0b16]/5"
                    >
                      {sessionSettings.selectedWheelType ? (
                        <div className="flex items-center gap-3">
                          <div className="text-2xl">{sessionSettings.selectedWheelType.icon}</div>
                          <div className="text-left">
                            <p className="font-medium">{sessionSettings.selectedWheelType.title}</p>
                            <p className="text-sm text-gray-500">{sessionSettings.selectedWheelType.description}</p>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3">
                          <Target className="h-6 w-6 text-gray-400" />
                          <div className="text-left">
                            <p className="font-medium">Select Wheel Type</p>
                            <p className="text-sm text-gray-500">Choose the type of wheel for your live session</p>
                          </div>
                        </div>
                      )}
                    </Button>
                    {sessionSettings.selectedWheelType && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setSessionSettings(prev => ({ ...prev, selectedWheelType: null }))}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                      >
                        ✕ Clear Selection
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Theme & Advanced Settings */}
            <div className="space-y-6">
              {/* Theme Card */}
              <Card className="border-0 shadow-sm bg-white rounded-2xl">
                <CardHeader className="border-b border-gray-100 pb-4">
                  <CardTitle className="text-lg flex items-center gap-3 text-gray-900">
                    <div className="p-2 bg-[#8e0b16]/20 rounded-lg">
                      <span className="text-lg">🎨</span>
                    </div>
                    Theme Settings
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 pt-6">
                  <div className="space-y-3">
                    <Label className="text-sm font-medium text-gray-700">Session Theme</Label>
                    <select 
                      value={sessionSettings.theme} 
                      onChange={(e) => {
                        const newTheme = e.target.value;
                        setSessionSettings(prev => ({ ...prev, theme: newTheme }));
                      }}
                      className="w-full p-3 border border-gray-200 rounded-xl focus:border-[#8e0b16] focus:ring-[#8e0b16] bg-white"
                    >
                      <option value="school">🏦 School Colors</option>
                      <option value="vibrant">🌈 Vibrant</option>
                      <option value="minimal">⚪ Minimal</option>
                      <option value="ocean">🌊 Ocean Blue</option>
                      <option value="forest">🌲 Forest Green</option>
                      <option value="sunset">🌅 Sunset Orange</option>
                      <option value="maroon">❤️ Maroon Theme</option>
                      <option value="pink">🌸 Cherry Blossom</option>
                      <option value="dark">🌙 Dark Mode</option>
                      <option value="neon">⚡ Neon Glow</option>
                      <option value="retro">📼 Retro</option>
                      <option value="gold">✨ Golden</option>
                    </select>
                    
                    <div className="flex items-center gap-3 p-3 bg-[#8e0b16]/5 rounded-lg">
                      <input
                        type="checkbox"
                        id="enableThemeSync"
                        checked={sessionSettings.enableThemeSync}
                        onChange={(e) => setSessionSettings(prev => ({ ...prev, enableThemeSync: e.target.checked }))}
                        className="w-4 h-4 text-[#8e0b16] bg-gray-100 border-gray-300 rounded focus:ring-[#8e0b16]"
                      />
                      <Label htmlFor="enableThemeSync" className="text-sm font-medium text-[#8e0b16]">
                        📱 Sync to mobile apps
                      </Label>
                    </div>
                    <p className="text-xs text-gray-500">
                      Choose theme colors that will be applied to participants' mobile apps
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Create Session Button */}
              <Card className="border-0 shadow-sm bg-white rounded-2xl">
                <CardContent className="p-6">
                  <Button
                    onClick={createSession}
                    disabled={isCreating || participants.length === 0}
                    className="w-full h-16 bg-gradient-to-r from-[#8e0b16] to-[#66181E] hover:from-[#66181E] hover:to-[#8e0b16] text-white font-semibold text-lg rounded-xl shadow-lg hover:shadow-xl transition-all duration-200"
                    size="lg"
                  >
                    {isCreating ? (
                      <div className="flex items-center gap-3">
                        <RefreshCw className="h-6 w-6 animate-spin" />
                        <span>Creating Session...</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <Radio className="h-6 w-6" />
                        <span>Create Live Session</span>
                      </div>
                    )}
                  </Button>
                  {participants.length === 0 && (
                    <p className="text-center text-sm text-red-500 mt-2">
                      ⚠️ No participants available. Add participants to create a session.
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        ) : (
          // Live Session Active - Modern Layout
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* Session Status & Control Panel */}
            <div className="xl:col-span-2 space-y-6">
              {/* Live Session Header */}
              <Card className="border-0 shadow-sm bg-white rounded-2xl overflow-hidden">
                <div className="bg-gradient-to-r from-green-500 to-emerald-600 p-6 text-white">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-white/20 rounded-xl">
                        <Radio className="h-6 w-6" />
                      </div>
                      <div>
                        <h2 className="text-xl font-semibold">{session.title}</h2>
                        <p className="text-green-100">{session.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-white rounded-full animate-pulse"></div>
                      <Badge className="bg-white/20 text-white border-white/30">LIVE</Badge>
                    </div>
                  </div>
                </div>
                
                {/* Room Code Section */}
                <CardContent className="p-6">
                  <div className="text-center mb-6">
                    <Label className="text-sm font-medium text-gray-600 mb-2 block">Session Room Code</Label>
                    <div className="flex items-center justify-center gap-3 mb-4">
                      <div className="px-6 py-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl border-2 border-blue-200">
                        <div className="text-4xl font-mono font-bold text-blue-700 tracking-wider">
                          {roomCode}
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={copyRoomCode}
                        className="h-12 w-12 border-blue-200 text-blue-700 hover:bg-blue-50 rounded-xl"
                      >
                        <Copy className="h-5 w-5" />
                      </Button>
                    </div>
                    
                    {/* Action Buttons */}
                    <div className="grid grid-cols-2 gap-3">
                      <Button
                        variant="outline"
                        onClick={() => {
                          const shareText = `Join my live wheel session!\n\nRoom Code: ${roomCode}\n\nOn web: Visit [your-website]/join\nOn mobile: Use the CobyPicks app and enter the room code\n\nLet's see who gets picked! 🎯`;

                          if (navigator.share) {
                            navigator.share({
                              title: 'Join Live Wheel Session',
                              text: shareText,
                            }).catch(console.error);
                          } else {
                            navigator.clipboard.writeText(shareText).then(() => {
                              toast({
                                title: "📧 Invite Text Copied!",
                                description: "Share this text with participants via email, SMS, or messaging apps",
                                duration: 5000,
                              });
                            }).catch(() => {
                              toast({
                                title: "Create Invite",
                                description: shareText,
                                duration: 10000,
                              });
                            });
                          }
                        }}
                        className="h-12 border-blue-200 text-blue-700 hover:bg-blue-50 rounded-xl"
                      >
                        <Users className="h-4 w-4 mr-2" />
                        Send Invites
                      </Button>

                      <Button
                        variant="outline"
                        onClick={() => setShowInviteDialog(true)}
                        className="h-12 border-green-200 text-green-700 hover:bg-green-50 rounded-xl"
                      >
                        <Users className="h-4 w-4 mr-2" />
                        🤝 Invite Collaborator
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Session Statistics */}
              <Card className="border-0 shadow-sm bg-white rounded-2xl">
                <CardHeader className="border-b border-gray-100 pb-4">
                  <CardTitle className="text-lg flex items-center gap-3 text-gray-900">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <BarChart3 className="h-5 w-5 text-blue-600" />
                    </div>
                    Live Session Stats
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-4 bg-blue-50 rounded-2xl border border-blue-100">
                      <div className="text-3xl font-bold text-blue-600 mb-1">
                        {viewers.length}
                      </div>
                      <div className="text-sm text-blue-600 font-medium">Live Viewers</div>
                      <div className="text-xs text-gray-500 mt-1">
                        Max: {session.maxParticipants || session.settings?.maxParticipants || 50}
                      </div>
                    </div>
                    
                    <div className="text-center p-4 bg-green-50 rounded-2xl border border-green-100">
                      <div className="text-3xl font-bold text-green-600 mb-1">
                        {participants.length}
                      </div>
                      <div className="text-sm text-green-600 font-medium">Participants</div>
                      <div className="text-xs text-gray-500 mt-1">Ready to play</div>
                    </div>
                    
                    <div className="text-center p-4 bg-purple-50 rounded-2xl border border-purple-100">
                      <div className="text-2xl font-bold text-purple-600 mb-1 capitalize">
                        {session.currentState === 'waiting' ? 'Ready' : session.currentState}
                      </div>
                      <div className="text-sm text-purple-600 font-medium">Status</div>
                      <div className="text-xs text-gray-500 mt-1">
                        {session.currentState === 'waiting' && 'Ready to spin'}
                        {session.currentState === 'spinning' && 'In progress'}
                        {session.currentState === 'waiting' && session.winners && session.winners.length > 0 && 'Ready for next spin'}
                      </div>
                    </div>
                    
                    <div className="text-center p-4 bg-yellow-50 rounded-2xl border border-yellow-100">
                      <div className="text-3xl font-bold text-yellow-600 mb-1">
                        {reactions.length}
                      </div>
                      <div className="text-sm text-yellow-600 font-medium">Reactions</div>
                      <div className="text-xs text-gray-500 mt-1">Total received</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Enhanced Wheel Component for Organizer */}
              {session && (
                <Card className="border-0 shadow-sm bg-white rounded-2xl">
                  <CardHeader className="border-b border-gray-100 pb-4">
                    <CardTitle className="text-lg flex items-center gap-3 text-gray-900">
                      <div className="p-2 bg-green-100 rounded-lg">
                        <Target className="h-5 w-5 text-green-600" />
                      </div>
                      Live Wheel Control
                    </CardTitle>
                    <CardDescription className="text-gray-600">
                      Control the wheel spinning and synchronization for all participants
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <EnhancedWheel
                      participants={session.participants || []}
                      isLiveMode={true}
                      sessionId={session.id}
                      selectedWheelType={session.selectedWheelType}
                      enableRealTimeSync={true}
                      organizerMode={true}
                      userPermissions={{
                        isFullAccessCollaborator: userProfile?.role === 'collaborator' || false,
                        canTriggerSynchronizedSpin: true,
                        synchronizationEnabled: true,
                        sessionId: session.id,
                        userRole: userProfile?.role || 'organizer'
                      }}
                      wheelTitle={session.wheelTitle || session.selectedWheelType?.title}
                      customCongratsMessage={session.settings?.congratsMessage || ""}
                      customItems={session.wheelItems}
                      onWinnersDetected={(winners) => {
                        console.log("🎯 ORGANIZER: onWinnersDetected callback triggered!", {
                          winnerCount: winners?.length || 0,
                          winners: winners?.map(w => w.name) || [],
                          hasWinners: !!(winners && winners.length > 0),
                          winnersType: typeof winners,
                          timestamp: new Date().toISOString()
                        })

                        // CRITICAL FIX: Handle winner announcements when collaborator spins
                        if (winners && winners.length > 0) {
                          console.log("🎯 ORGANIZER: Processing winner announcement - showing toast and effects", {
                            winnerCount: winners.length,
                            winners: winners.map(w => w.name),
                            firstWinner: winners[0]?.name,
                            sessionId: session?.id
                          })

                          // Show immediate toast notification for organizer
                          toast({
                            title: "🎯 Winner Selected!",
                            description: winners.length === 1
                              ? `${winners[0].name} has been selected!`
                              : `${winners.length} winners selected: ${winners.map(w => w.name).join(', ')}`,
                            duration: 5000,
                          })

                          // Trigger confetti effect for organizer
                          import('canvas-confetti').then((confetti) => {
                            confetti.default({
                              particleCount: 100,
                              spread: 70,
                              origin: { y: 0.6 }
                            })
                          }).catch(console.warn)

                          console.log("🎯 ORGANIZER: Winner announcement completed successfully", {
                            winnerCount: winners.length,
                            winners: winners.map(w => w.name),
                            announcementCompleted: true
                          })
                        } else {
                          console.warn("🎯 ORGANIZER: onWinnersDetected called but no winners provided", {
                            winners,
                            winnerCount: winners?.length || 0
                          })
                        }
                      }}
                    />
                  </CardContent>
                </Card>
              )}

              {/* Connection Status */}
              <Card className="border-0 shadow-sm bg-white rounded-2xl">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-gray-100 rounded-lg">
                        {getConnectionIcon()}
                      </div>
                      <span className="font-medium text-gray-700">Connection Status</span>
                    </div>
                    {getConnectionBadge()}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Sidebar - Activity & Controls */}
            <div className="space-y-6">
              {/* Participant Request Manager - Show for organizers */}
              {session && (
                <div className="relative">
                  {/* Prominent notification badge for pending requests */}
                  <div className="absolute -top-2 -right-2 z-10">
                    <div className="w-4 h-4 bg-red-500 rounded-full animate-pulse border-2 border-white shadow-lg"></div>
                  </div>
                  
                  <OrganizerRequestManager
                    sessionId={session.id}
                    organizerId={user.uid}
                    onWheelTypeChange={async (wheelType) => {
                      console.log('🔄 Organizer approved wheel type change:', wheelType)
                      
                      try {
                        // Apply the wheel type change to local state
                        setSessionSettings(prev => ({
                          ...prev,
                          selectedWheelType: wheelType
                        }))
                        
                        // 🚀 ENHANCED: Broadcast to all participants with priority synchronization
                        await setDoc(doc(db, "liveDrawSessions", session.id), {
                          selectedWheelType: wheelType,
                          wheelType: wheelType.id,
                          wheelTitle: wheelType.title,
                          wheelItems: wheelType.defaultItems,
                          wheelTypeUpdatedBy: user.uid,
                          wheelTypeUpdatedAt: serverTimestamp(),
                          lastUpdated: serverTimestamp(),
                          // 🚀 Add synchronization flags for immediate participant updates
                          participantSync: 'immediate',
                          accuracyMode: 'exact',
                          wheelTypeChangeTimestamp: Date.now(),
                          syncVersion: Date.now(),
                          broadcastPriority: 'high'
                        }, { merge: true })
                        
                        console.log('✨ Wheel type broadcasted to all participants with enhanced sync:', wheelType.title)
                        
                        toast({
                          title: "✅ Wheel Type Changed!",
                          description: `Successfully changed to ${wheelType.title}. All participants will see the update immediately.`,
                          duration: 4000,
                        })
                      } catch (error) {
                        console.error('Error updating wheel type:', error)
                        toast({
                          title: "Error",
                          description: "Failed to change wheel type. Please try again.",
                          variant: "destructive"
                        })
                      }
                    }}
                    onTopicSuggestion={(topic) => {
                      console.log('📝 Organizer approved topic suggestion:', topic)
                      // Handle topic suggestion approval (could be used to update session description or announcements)
                      toast({
                        title: "💡 Topic Suggestion Noted",
                        description: `Topic suggestion: ${topic}`,
                        duration: 3000,
                      })
                    }}
                  />
                </div>
              )}
              {/* Selected Wheel Type Display */}
              {session.selectedWheelType && (
                <Card className="border-0 shadow-sm bg-white rounded-2xl">
                  <CardHeader className="border-b border-gray-100 pb-4">
                    <CardTitle className="text-lg flex items-center gap-3 text-gray-900">
                      <div className="p-2 bg-indigo-100 rounded-lg">
                        <Target className="h-5 w-5 text-indigo-600" />
                      </div>
                      Active Wheel Type
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-indigo-50 to-blue-50 rounded-2xl border border-indigo-200">
                      <div className="text-4xl">{session.selectedWheelType.icon}</div>
                      <div className="flex-1">
                        <h4 className="font-semibold text-indigo-900 text-lg">{session.selectedWheelType.title}</h4>
                        <p className="text-sm text-indigo-700">{session.selectedWheelType.description}</p>
                        <p className="text-xs text-indigo-600 mt-2">
                          🎯 This wheel is live for all participants
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Recent Reactions */}
              {reactions.length > 0 && (
                <Card className="border-0 shadow-sm bg-white rounded-2xl">
                  <CardHeader className="border-b border-gray-100 pb-4">
                    <CardTitle className="text-lg flex items-center gap-3 text-gray-900">
                      <div className="p-2 bg-yellow-100 rounded-lg">
                        <Heart className="h-5 w-5 text-yellow-600" />
                      </div>
                      Live Reactions
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <div className="flex gap-2 flex-wrap p-4 bg-yellow-50 rounded-2xl border border-yellow-200 min-h-[80px]">
                      {reactions.slice(-15).map((reaction) => (
                        <div
                          key={reaction.id}
                          className="text-2xl animate-bounce hover:scale-110 transition-transform cursor-pointer"
                          title={`${reaction.userName} - ${reaction.timestamp ? reaction.timestamp.toLocaleTimeString() : 'Just now'}`}
                        >
                          {reaction.emoji}
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-yellow-600 mt-2 text-center">
                      🎉 {reactions.length} total reactions from participants
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Participant Activity Feed */}
              {participantEvents.length > 0 && (
                <Card className="border-0 shadow-sm bg-white rounded-2xl">
                  <CardHeader className="border-b border-gray-100 pb-4">
                    <CardTitle className="text-lg flex items-center gap-3 text-gray-900">
                      <div className="p-2 bg-green-100 rounded-lg">
                        <Users className="h-5 w-5 text-green-600" />
                      </div>
                      Live Activity Feed
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <div className="space-y-3 max-h-64 overflow-y-auto">
                      {participantEvents.slice(0, 8).map((event) => (
                        <div
                          key={event.id}
                          className={`flex items-center gap-3 p-3 rounded-xl transition-all ${
                            event.type === 'join' 
                              ? 'bg-green-50 border border-green-200 hover:bg-green-100' 
                              : 'bg-red-50 border border-red-200 hover:bg-red-100'
                          }`}
                        >
                          <div className={`w-3 h-3 rounded-full ${
                            event.type === 'join' ? 'bg-green-500 animate-pulse' : 'bg-red-500'
                          }`} />
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <span className={`font-medium ${
                                event.type === 'join' ? 'text-green-800' : 'text-red-800'
                              }`}>
                                {event.participantName}
                              </span>
                              <span className="text-xs text-gray-500">
                                {event.timestamp.toLocaleTimeString()}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <span className={`text-sm ${
                                event.type === 'join' ? 'text-green-600' : 'text-red-600'
                              }`}>
                                {event.type === 'join' ? '✓ Joined' : '✗ Left'}
                              </span>
                              <span className="text-xs text-gray-500">
                                • {event.platform}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    {participantEvents.length > 8 && (
                      <p className="text-xs text-green-600 mt-3 text-center font-medium">
                        +{participantEvents.length - 8} more activities
                      </p>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Session Control Panel */}
              <Card className="border-0 shadow-sm bg-white rounded-2xl">
                <CardHeader className="border-b border-gray-100 pb-4">
                  <CardTitle className="text-lg flex items-center gap-3 text-gray-900">
                    <div className="p-2 bg-red-100 rounded-lg">
                      <Settings className="h-5 w-5 text-red-600" />
                    </div>
                    Session Controls
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <Button
                    variant="destructive"
                    onClick={endSession}
                    className="w-full h-12 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 rounded-xl font-semibold"
                    size="lg"
                  >
                    <Square className="mr-2 h-5 w-5" />
                    End Live Session
                  </Button>
                  <p className="text-xs text-gray-500 mt-2 text-center">
                    This will end the session for all participants
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Winners Display - Show for any winner selection during live session */}
            {session && session.winners && session.winners.length > 0 && (
              <div className="xl:col-span-3">
                <Card className="border-0 shadow-sm bg-white rounded-2xl overflow-hidden">
                  <div className="bg-gradient-to-r from-yellow-400 to-orange-500 p-6 text-white">
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-white/20 rounded-xl">
                        <Trophy className="h-6 w-6" />
                      </div>
                      <div>
                        <h2 className="text-xl font-semibold">🎉 Current Winners! - Ready for Next Spin</h2>
                        <p className="text-yellow-100">Click "Start Wheel" to spin unlimited times!</p>
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
                          <div className="text-2xl">✓</div>
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
                        🔄 Status: Always Ready for Unlimited Spins!
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        )}

        {/* Wheel Type Selector Dialog */}
        <Dialog open={sessionSettings.showWheelSelector} onOpenChange={(open) =>
          setSessionSettings(prev => ({ ...prev, showWheelSelector: open }))
        }>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Select Wheel Type for Live Session
              </DialogTitle>
              <DialogDescription>
                Choose a wheel type that will be displayed during your live session
              </DialogDescription>
            </DialogHeader>

            <div className="mt-4 text-center py-12">
              <div className="text-6xl mb-4">🎯</div>
              <h2 className="text-2xl font-bold mb-2">Wheel Type Selection</h2>
              <p className="text-muted-foreground mb-4">
                The wheel type selection gallery is currently unavailable. Please use the dashboard to select wheel types.
              </p>
              <Button onClick={() => setSessionSettings(prev => ({ ...prev, showWheelSelector: false }))}>
                Close
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Collaboration Invitation Dialog */}
        <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                🤝 Invite Collaborator
              </DialogTitle>
              <DialogDescription>
                Invite another organizer to collaborate on this live session. They'll receive a notification with the room code.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="collaboratorEmail">Collaborator Email Address</Label>
                <Input
                  id="collaboratorEmail"
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="organizer@example.com"
                  className="h-12"
                />
              </div>

              {roomCode && (
                <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-sm text-blue-800">
                    <strong>Room Code:</strong> {roomCode}
                  </p>
                  <p className="text-xs text-blue-600 mt-1">
                    This room code will be included in the invitation
                  </p>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  className="flex-1 bg-green-600 hover:bg-green-700"
                  onClick={async () => {
                    if (!inviteEmail.trim()) {
                      toast({
                        title: "Email Required",
                        description: "Please enter the collaborator's email address",
                        variant: "destructive"
                      })
                      return
                    }

                    if (!inviteEmail.includes('@')) {
                      toast({
                        title: "Invalid Email",
                        description: "Please enter a valid email address",
                        variant: "destructive"
                      })
                      return
                    }

                    setIsInviting(true)
                    await createCollaborationInvitation(inviteEmail.trim())
                    setIsInviting(false)
                    setShowInviteDialog(false)
                    setInviteEmail('')
                  }}
                  disabled={isInviting || !inviteEmail.trim()}
                >
                  {isInviting ? (
                    <div className="flex items-center gap-2">
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Sending...
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Send Invitation
                    </div>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowInviteDialog(false)
                    setInviteEmail('')
                  }}
                  disabled={isInviting}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
