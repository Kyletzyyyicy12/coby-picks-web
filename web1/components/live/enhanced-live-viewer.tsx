"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { toast } from "@/hooks/use-toast"
import { db } from "@/lib/firebase"
import { doc, onSnapshot, addDoc, collection, serverTimestamp, updateDoc, setDoc, getDoc } from "firebase/firestore"
import { Radio, Users, Heart, ThumbsUp, Star, Trophy, Eye, Loader2, Zap, MessageSquare, Send, Volume2, VolumeX, Crown, Copy } from "lucide-react"
import confetti from "canvas-confetti"
import { EnhancedWheel } from "@/components/randomizer/enhanced-wheel"
import { TextWinnerPopup } from "@/components/shared/text-winner-popup"

interface LiveSession {
  id: string
  title: string
  description: string
  isActive: boolean
  isSpinning: boolean
  currentState: "waiting" | "spinning" | "ended" | "completed"
  participants: Array<{
    id: string
    name: string
    email?: string
  }>
  winners: Array<{
    id: string
    name: string
    email?: string
  }>
  selectedWheelType?: {
    id: string
    title: string
    description: string
    icon: string
    category: string
    defaultItems: string[]
    color: string
    isCustomizable: boolean
  } | null
  settings: {
    numberOfWinners: number
    congratsMessage: string
    allowReactions: boolean
  }
  viewerCount: number
  endedExplicitly?: boolean
  teacherPresence?: {
    userId: string
    lastSeen: Date
    isOnline: boolean
  }
  wheelTitle?: string
  wheelType?: string
  roomCode?: string
  sessionEndNotification?: {
    message: string
    timestamp: any
    organizerName?: string
    isActive: boolean
  }
  // Theme synchronization data
  wheelTheme?: {
    primary: string
    secondary: string
    accent: string
    background: string
  }
  themeName?: string
  themeUpdatedAt?: any
}

interface EnhancedLiveViewerProps {
  sessionId: string
  participantName?: string
}

export function EnhancedLiveViewer({ sessionId, participantName }: EnhancedLiveViewerProps) {
  const [session, setSession] = useState<LiveSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [connected, setConnected] = useState(false)
  const [viewerName, setViewerName] = useState(participantName || "")
  const [isNameDialogOpen, setIsNameDialogOpen] = useState(!participantName)
  const [connectionAttempts, setConnectionAttempts] = useState(0)
  const [isReconnecting, setIsReconnecting] = useState(false)
  const [isParticipant, setIsParticipant] = useState(true) // Participants can only watch
  const [reactions, setReactions] = useState<Array<{
    id: string;
    emoji: string;
    userName: string;
    timestamp: Date
  }>>([])
  const [comments, setComments] = useState<Array<{
    id: string;
    text: string;
    userName: string;
    timestamp: Date
  }>>([])
  const [newComment, setNewComment] = useState("")
  const [isMuted, setIsMuted] = useState(false)
  const [spinAnimation, setSpinAnimation] = useState(false)
  const [viewerId, setViewerId] = useState<string>('')
  const [waitingForAnimationEnd, setWaitingForAnimationEnd] = useState<boolean>(false)
  const [showWinnerPopup, setShowWinnerPopup] = useState(false)
  const [lastWinnerAnnouncement, setLastWinnerAnnouncement] = useState<string>('')
  const [collaboratorPermissions, setCollaboratorPermissions] = useState<{
    canControlLive: boolean
    canTriggerSynchronizedSpin: boolean
    canEditWheel: boolean
    permissionLevel: 'full' | 'view'
  } | null>(null)
  const [currentWheelTheme, setCurrentWheelTheme] = useState({
    primary: "#8e0b16",
    secondary: "#66181E",
    accent: "#ffffff",
    background: "#f8f9fa"
  })
  const [lastThemeUpdate, setLastThemeUpdate] = useState<string>("")
  const unsubscribeRef = useRef<(() => void) | null>(null)
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)

  const schoolColors = {
    primary: "#8e0b16",
    secondary: "#66181E",
    accent: "#ffffff"
  }

  const reactionEmojis = [
    { emoji: "👏", icon: Zap, label: "Clap" },
    { emoji: "👍", icon: ThumbsUp, label: "Thumbs Up" },
    { emoji: "❤️", icon: Heart, label: "Heart" },
    { emoji: "⭐", icon: Star, label: "Star" },
    { emoji: "🎉", icon: Trophy, label: "Celebrate" }
  ]

  // Helper functions
  const detectPlatform = () => {
    const userAgent = (typeof navigator !== 'undefined' && navigator?.userAgent?.toLowerCase()) || ''
    if (userAgent.includes('mobile') || userAgent.includes('android') || userAgent.includes('iphone')) {
      return 'mobile'
    } else if (typeof window !== 'undefined' && (window.location.href.includes('app://') || window.location.href.includes('cobypicks://'))) {
      return 'app'
    } else {
      return 'web'
    }
  }

  const startHeartbeat = (sessionId: string, viewerId: string) => {
    // Clear any existing heartbeat
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current)
    }

    const heartbeatInterval = setInterval(async () => {
      try {
        await updateDoc(doc(db, "liveDrawSessions", sessionId, "viewers", viewerId), {
          lastSeen: serverTimestamp(),
          isActive: true,
          lastActivity: serverTimestamp()
        })
      } catch (error) {
        console.error("Heartbeat error:", error)
        // Don't clear interval on error, try again next time
        // Only clear if component is unmounting
      }
    }, 15000) // More frequent heartbeat for better reliability

    heartbeatRef.current = heartbeatInterval
  }

  useEffect(() => {
    if (viewerName && !connected) {
      joinSession()
    }

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current()
      }
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current)
      }
      if (audioContextRef.current) {
        audioContextRef.current.close()
      }
    }
  }, [viewerName, connected])

  // 🎨 THEME CHANGE HANDLING: Force wheel redraw when theme changes
  useEffect(() => {
    if (currentWheelTheme && lastThemeUpdate) {
      console.log("🎨 PARTICIPANT: Theme changed, wheel should update automatically via EnhancedWheel component", {
        theme: currentWheelTheme,
        lastThemeUpdate: lastThemeUpdate,
        timestamp: new Date().toISOString()
      })

      // The EnhancedWheel component should handle theme changes automatically
      // when it receives the wheelTheme prop, but we can add additional logging here
      // to ensure the theme change is being applied correctly
    }
  }, [currentWheelTheme, lastThemeUpdate])


  // Function to check if current viewer is a collaborator with specific permissions
  const checkCollaboratorPermissions = async () => {
    try {
      const sessionDoc = await getDoc(doc(db, "liveDrawSessions", sessionId))
      if (!sessionDoc.exists()) return null

      const sessionData = sessionDoc.data()
      if (!sessionData.collaboratorDetails) return null

      // Find this viewer's permission in the collaborator details
      const viewerPermissions = sessionData.collaboratorDetails[viewerName] || sessionData.collaboratorDetails[viewerId]

      if (viewerPermissions) {
        console.log("🎯 COLLABORATOR PERMISSIONS FOUND:", {
          viewerName,
          viewerId,
          permissions: viewerPermissions,
          canViewOnly: viewerPermissions.canViewOnly,
          permissionLevel: viewerPermissions.canViewOnly ? 'view' : 'full'
        })

        setCollaboratorPermissions({
          canControlLive: viewerPermissions.canControlLive,
          canTriggerSynchronizedSpin: viewerPermissions.canTriggerSynchronizedSpin,
          canEditWheel: viewerPermissions.canEditWheel,
          permissionLevel: viewerPermissions.canViewOnly ? 'view' : 'full'
        })

        // ENHANCED: Log the permission determination for debugging
        console.log("🎯 PERMISSION DETERMINATION:", {
          viewerName,
          viewerId,
          canViewOnly: viewerPermissions.canViewOnly,
          defaultPermission: viewerPermissions.canViewOnly ? 'view' : 'full',
          permissionLevel: viewerPermissions.canViewOnly ? 'view' : 'full',
          timestamp: new Date().toISOString()
        })

        return viewerPermissions
      }

      return null
    } catch (error) {
      console.error("Error checking collaborator permissions:", error)
      return null
    }
  }

  const joinSession = async () => {
    try {
      // Detect platform for cross-platform support
      const platform = detectPlatform()
      const generatedViewerId = `viewer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      setViewerId(generatedViewerId)

      console.log(`🔗 Participant joining session: ${sessionId} as ${viewerName} on ${platform}`)

      // Add viewer to session with enhanced data
      await setDoc(doc(db, "liveDrawSessions", sessionId, "viewers", generatedViewerId), {
        name: viewerName,
        joinedAt: serverTimestamp(),
        isActive: true,
        lastSeen: serverTimestamp(),
        platform: platform,
        connectionId: generatedViewerId,
        userAgent: (typeof navigator !== 'undefined' && navigator?.userAgent) || 'Unknown',
        sessionId: sessionId,
        isOnline: true,
        lastActivity: serverTimestamp()
      })

      // Start heartbeat to maintain connection
      startHeartbeat(sessionId, generatedViewerId)

      // Start listening to session updates
      const sessionUnsubscribe = onSnapshot(
        doc(db, "liveDrawSessions", sessionId),
        (doc) => {
          if (doc.exists()) {
            const data = doc.data() as LiveSession

            // Check if session has been ended by organizer
            if (!data.isActive || data.endedExplicitly) {
              console.log("📢 Session ended by organizer:", {
                isActive: data.isActive,
                endedExplicitly: data.endedExplicitly,
                currentState: data.currentState
              })
              
              // Clean up current session state
              setSession(null)
              setConnected(false)
              setSpinAnimation(false)
              
              // Show notification that organizer ended the session
              toast({
                title: "Session Ended",
                description: "The organizer has ended this live session. Thank you for participating!",
                variant: "default",
                duration: 6000
              })
              
              // Clean up heartbeat and listeners
              if (heartbeatRef.current) {
                clearInterval(heartbeatRef.current)
              }
              
              // Redirect to home page after a delay
              setTimeout(() => {
                window.location.href = '/'
              }, 3000)
              
              return
            }

            // FIXED: Ensure winners synched exactly between organizer and participants
            const updatedSession = { ...data, id: doc.id }

            // FIXED: Winner synchronization check - ensure participants see same winners
            if (data.winners && data.winners.length > 0) {
              console.log("🔄 WINNERS SYNC CHECK: Received session winners", {
                winnerCount: data.winners.length,
                winners: data.winners.map(w => w.name),
                currentWinnersInState: session?.winners?.length || 0
              })

              // FIXED: Ensure winners match exactly between organizer and participants
              if (!waitingForAnimationEnd && JSON.stringify(session?.winners || []) !== JSON.stringify(data.winners)) {
                console.log("✅ APPLYING WINNER SYNC: Updating winners to match organizer exactly", {
                  previousWinners: session?.winners?.length || 0,
                  newWinners: data.winners.length,
                  winners: data.winners
                })

                // Force update winners if they don't match - this ensures consistency
                updatedSession.winners = data.winners

                // Trigger winner announcement for participants if animation completed
                if (!waitingForAnimationEnd && data.winners.length > 0) {
                  setTimeout(() => {
                    console.log("🎯 PARTICIPANT SYNC WINNERS: Winners synchronized from session data", {
                      winners: data.winners.length,
                      shouldShowNow: true
                    })
                  }, 100)
                }
              }
            }

            // 🎨 THEME SYNCHRONIZATION: Handle theme updates from organizer
            if (data.wheelTheme && data.themeUpdatedAt) {
              console.log("🎨 PARTICIPANT: Received theme update from organizer:", {
                themeName: data.themeName,
                primary: data.wheelTheme.primary,
                secondary: data.wheelTheme.secondary,
                accent: data.wheelTheme.accent,
                background: data.wheelTheme.background,
                themeUpdatedAt: data.themeUpdatedAt,
                sessionId: sessionId,
                timestamp: new Date().toISOString()
              })

              // Create a unique identifier for the theme to detect changes
              const currentThemeId = `${currentWheelTheme.primary}-${currentWheelTheme.secondary}-${currentWheelTheme.accent}-${currentWheelTheme.background}`
              const newThemeId = `${data.wheelTheme.primary}-${data.wheelTheme.secondary}-${data.wheelTheme.accent}-${data.wheelTheme.background}`

              // Only update if theme has actually changed
              if (currentThemeId !== newThemeId) {
                console.log("🎨 PARTICIPANT: Applying organizer theme update:", {
                  oldTheme: currentWheelTheme,
                  newTheme: data.wheelTheme,
                  themeName: data.themeName || 'custom',
                  themeChanged: true,
                  sessionId: sessionId,
                  timestamp: new Date().toISOString()
                })

                // Update the theme state
                setCurrentWheelTheme(data.wheelTheme)
                setLastThemeUpdate(newThemeId)

                // Show notification to participant about theme change
                toast({
                  title: "🎨 Theme Updated",
                  description: `Organizer applied ${data.themeName || 'new'} theme`,
                  duration: 3000
                })

                console.log("✅ PARTICIPANT: Theme synchronization completed successfully", {
                  themeName: data.themeName,
                  theme: data.wheelTheme,
                  sessionId: sessionId,
                  timestamp: new Date().toISOString()
                })
              } else {
                console.log("🎨 PARTICIPANT: Theme unchanged, skipping update:", {
                  currentThemeId: currentThemeId,
                  newThemeId: newThemeId,
                  themeName: data.themeName || 'custom',
                  timestamp: new Date().toISOString()
                })
              }
            }

            setSession(updatedSession)

            setLoading(false)

            // Simplified teacher presence check
            const teacherPresence = data.teacherPresence
            const isTeacherPresent = teacherPresence?.isOnline === true

            // SIMPLIFIED FIX: Direct and responsive spin state handling
            if (data.currentState === "spinning") {
              console.log("🎯 PARTICIPANT: Wheel spinning state detected - immediate response", {
                timestamp: new Date().toISOString(),
                previousState: spinAnimation
              })

              // IMMEDIATE RESPONSE: Always ensure wheel is spinning when state is spinning
              if (!spinAnimation) {
                setSpinAnimation(true)
                setWaitingForAnimationEnd(true)

                console.log("🎯 PARTICIPANT: Starting immediate wheel animation")

                // Let EnhancedWheel handle the animation - just play sound and show toast
                playSound('spin')

                toast({
                  title: "Wheel Started Spinning!",
                  description: "Watch carefully as the wheel spins...",
                })
              }

            } else if (data.currentState === "waiting") {
              console.log("🔄 PARTICIPANT: Wheel returned to waiting state", {
                spinAnimationActive: spinAnimation,
                waitingForAnimationEnd: waitingForAnimationEnd,
                timestamp: new Date().toISOString()
              })

              // IMMEDIATE CLEANUP: Reset all spin-related states
              if (spinAnimation || waitingForAnimationEnd) {
                setSpinAnimation(false)
                setWaitingForAnimationEnd(false)

                // Clear any pending animation state
                console.log("✅ PARTICIPANT: Reset wheel to starting position")
              }
            }

          } else {
            // Session document doesn't exist
            setSession(null)
            setConnected(false)
            toast({
              title: "Session Not Found",
              description: "This live session may have ended or doesn't exist",
              variant: "destructive",
              duration: 5000
            })
            
            // Clean up heartbeat
            if (heartbeatRef.current) {
              clearInterval(heartbeatRef.current)
            }
            
            // Redirect to home page after a delay
            setTimeout(() => {
              window.location.href = '/'
            }, 3000)
            
            setLoading(false)
          }
        },
        async (error) => {
           console.error("❌ Session listener error:", error)
           setConnected(false)
           setConnectionAttempts(prev => prev + 1)

           if (connectionAttempts < 3) {
             setIsReconnecting(true)
             toast({
               title: "Connection Error",
               description: `Lost connection to session. Reconnecting... (attempt ${connectionAttempts + 1}/3)`,
               variant: "destructive"
             })

             // Wait before retrying
             setTimeout(() => {
               setIsReconnecting(false)
               joinSession()
             }, 2000)
           } else {
             toast({
               title: "Connection Failed",
               description: "Unable to reconnect to session. Please refresh the page.",
               variant: "destructive"
             })
             setLoading(false)
           }
         }
      )

      // Listen to reactions
      const reactionsUnsubscribe = onSnapshot(
        collection(db, "liveDrawSessions", sessionId, "reactions"),
        (snapshot) => {
          const reactionList = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            timestamp: doc.data().timestamp?.toDate()
          })) as Array<{ id: string; emoji: string; userName: string; timestamp: Date }>
          setReactions(reactionList.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()).slice(0, 15))
        }
      )

      // Listen to comments
      const commentsUnsubscribe = onSnapshot(
        collection(db, "liveDrawSessions", sessionId, "comments"),
        (snapshot) => {
          const commentList = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            timestamp: doc.data().timestamp?.toDate()
          })) as Array<{ id: string; text: string; userName: string; timestamp: Date }>
          setComments(commentList.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()).slice(0, 20))
        }
      )

      unsubscribeRef.current = () => {
        sessionUnsubscribe()
        reactionsUnsubscribe()
        commentsUnsubscribe()
      }

      setConnected(true)
      setIsNameDialogOpen(false)

      // Check if this viewer has collaborator permissions
      await checkCollaboratorPermissions()

      toast({
        title: "Connected!",
        description: "You're now watching the live session",
      })
    } catch (error) {
      console.error("Error joining session:", error)
      toast({
        title: "Connection Error",
        description: "Failed to join the live session",
        variant: "destructive"
      })
      setLoading(false)
    }
  }

  const sendReaction = async (emoji: string) => {
    if (!session?.settings.allowReactions) return

    try {
      await addDoc(collection(db, "liveDrawSessions", sessionId, "reactions"), {
        emoji,
        userId: viewerId,
        userName: viewerName,
        timestamp: serverTimestamp()
      })
    } catch (error) {
      console.error("Error sending reaction:", error)
    }
  }

  const sendComment = async () => {
    if (!newComment.trim()) return

    try {
      await addDoc(collection(db, "liveDrawSessions", sessionId, "comments"), {
        text: newComment.trim(),
        userId: viewerId,
        userName: viewerName,
        timestamp: serverTimestamp()
      })
      setNewComment("")
    } catch (error) {
      console.error("Error sending comment:", error)
    }
  }

  const triggerConfetti = () => {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: [schoolColors.primary, schoolColors.secondary, schoolColors.accent]
    })
  }


  const playSound = (type: 'spin' | 'complete') => {
    if (isMuted) return

    // Simple audio feedback
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
    }

    const ctx = audioContextRef.current
    const oscillator = ctx.createOscillator()
    const gainNode = ctx.createGain()

    oscillator.connect(gainNode)
    gainNode.connect(ctx.destination)

    if (type === 'spin') {
      oscillator.frequency.setValueAtTime(440, ctx.currentTime)
      gainNode.gain.setValueAtTime(0.1, ctx.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5)
      oscillator.start()
      oscillator.stop(ctx.currentTime + 0.5)
    } else {
      oscillator.frequency.setValueAtTime(523, ctx.currentTime)
      gainNode.gain.setValueAtTime(0.2, ctx.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1)
      oscillator.start()
      oscillator.stop(ctx.currentTime + 1)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto" style={{ color: schoolColors.primary }} />
          <p className="text-muted-foreground">
            {isReconnecting ? "Reconnecting to live session..." : "Connecting to live session..."}
          </p>
        </div>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="max-w-md">
          <CardContent className="text-center p-6">
            <p className="text-muted-foreground">Session not found or has ended</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Name Dialog */}
      <Dialog open={isNameDialogOpen} onOpenChange={setIsNameDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle style={{ color: schoolColors.primary }}>Join Live Session</DialogTitle>
            <DialogDescription>
              Enter your name to watch the live session
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Your name"
              value={viewerName}
              onChange={(e) => setViewerName(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && viewerName.trim() && joinSession()}
            />
            <Button
              onClick={joinSession}
              disabled={!viewerName.trim()}
              className="w-full bg-[#8e0b16] hover:bg-[#66181E]"
            >
              Join Session
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="container mx-auto p-4 space-y-6 max-w-4xl">
        {/* Page Header */}
        <div className="text-center py-4">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
            🤝 Collaborative Wheel Room
          </h1>
          <p className="text-sm sm:text-base text-gray-600">
            {session?.title || 'Work together in this collaborative wheel experience'}
          </p>
          {collaboratorPermissions && (
            <div className="mt-2">
              <Badge variant="secondary" className="bg-blue-100 text-blue-700 border border-blue-300">
                🤝 You're a Collaborator - Enhanced Permissions
              </Badge>
            </div>
          )}
        </div>

        {/* Enhanced Header */}
        <Card className="border-2" style={{ borderColor: schoolColors.primary }}>
          <CardHeader className="bg-gradient-to-r from-[#8e0b16] to-[#66181E] text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Radio className="h-6 w-6" />
                <div>
                  <CardTitle className="flex items-center gap-2">
                    {session.title || "Collaborative Live Session"}
                    {collaboratorPermissions && (
                      <Badge variant="secondary" className="bg-yellow-400 text-yellow-900 animate-pulse">
                        <Crown className="h-3 w-3 mr-1" />
                        {collaboratorPermissions.permissionLevel.toUpperCase()} ACCESS
                      </Badge>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsMuted(!isMuted)}
                      className="text-white hover:bg-white/20"
                    >
                      {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                    </Button>
                  </CardTitle>
                  <CardDescription className="text-white/80">
                    Welcome, {viewerName}! • {session.viewerCount} viewers
                    {collaboratorPermissions && (
                      <span className="text-yellow-200 font-medium">
                        • {collaboratorPermissions.canTriggerSynchronizedSpin ? 'Can sync spin' : 'Watch only'}
                      </span>
                    )}
                  </CardDescription>
                </div>
              </div>
              <Badge variant="secondary" className="bg-green-500 text-white animate-pulse">
                <div className="w-2 h-2 bg-white rounded-full mr-2" />
                COLLABORATIVE LIVE
              </Badge>
            </div>
          </CardHeader>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content - Wheel */}
          <div className="lg:col-span-2">
            {/* Selected Wheel Type Display - Prominent */}
            {session.selectedWheelType && (
              <div className="mb-6 p-6 bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-300 rounded-xl shadow-lg">
                <div className="flex items-center gap-4 mb-3">
                  <div className="text-2xl">{session.selectedWheelType.icon}</div>
                  <div className="flex-1">
                    <h3 className="text-2xl font-bold text-blue-900 mb-1">{session.selectedWheelType.title}</h3>
                    <p className="text-base text-blue-700 font-medium">{session.selectedWheelType.description}</p>
                  </div>
                </div>
                <div className="bg-white/60 p-3 rounded-lg border border-blue-200">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-semibold text-blue-800">Category:</span>
                      <span className="ml-2 text-blue-700">{session.selectedWheelType.category}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-blue-800">Items:</span>
                      <span className="ml-2 text-blue-700">{session.selectedWheelType.defaultItems?.length || 0} loaded</span>
                    </div>
                  </div>
                  <p className="text-xs text-blue-600 mt-2 font-medium">
                    🎯 This wheel type was selected for this collaborative session
                  </p>
                  {/* Show sample items */}
                  {session.selectedWheelType.defaultItems && session.selectedWheelType.defaultItems.length > 0 && (
                    <div className="mt-3">
                      <p className="text-xs font-semibold text-blue-800 mb-1">Sample Items:</p>
                      <div className="flex flex-wrap gap-1">
                        {session.selectedWheelType.defaultItems.slice(0, 5).map((item: string, index: number) => (
                          <span key={index} className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                            {item}
                          </span>
                        ))}
                        {session.selectedWheelType.defaultItems.length > 5 && (
                          <span className="text-xs text-blue-600 px-2 py-1">
                            +{session.selectedWheelType.defaultItems.length - 5} more
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            <Card className="bg-white rounded-lg border-2 p-6" style={{ borderColor: schoolColors.primary }}>
              {/* Real-time wheel display - Always show the wheel */}
              <div className="space-y-4">

                {/* Session Status Badge */}
                <div className="flex items-center justify-center mb-4">
                  {session.currentState === "waiting" && (
                    <div className="flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-800 rounded-full border border-blue-300">
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                      <span className="text-sm font-medium">Organizer is preparing the wheel...</span>
                    </div>
                  )}
                  {session.currentState === "spinning" && (
                    <div className="flex items-center gap-2 px-4 py-2 bg-yellow-100 text-yellow-800 rounded-full border border-yellow-300">
                      <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
                      <span className="text-sm font-medium">🎯 Wheel is spinning...</span>
                    </div>
                  )}
                  {session.currentState === "completed" && (
                    <div className="flex items-center gap-2 px-4 py-2 bg-green-100 text-green-800 rounded-full border border-green-300">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-sm font-medium">🎉 Results are ready!</span>
                    </div>
                  )}
                </div>

                {/* Actual Wheel Component for synchronized spinning */}
                <div className="space-y-4">
                  <div className="flex justify-center">
                    <div className="w-full max-w-none">
                      {session.selectedWheelType?.id === 'team-picker' || session.wheelType === 'team-picker' ? (
                        <div className="bg-white rounded-lg p-4 border-2 border-blue-200">
                          <div className="text-center mb-4">
                            <h3 className="text-lg font-semibold text-blue-900 mb-2">
                              👥 Team Picker Wheel
                            </h3>
                            <p className="text-sm text-blue-700">
                              The organizer is using Team Picker to generate random teams
                            </p>
                          </div>
                          {/* Note: EnhancedTeamPicker would be imported and used here */}
                          <div className="mt-3 text-center text-xs text-blue-600">
                            🎯 Synchronized with organizer's team generation
                          </div>
                        </div>
                      ) : (
                        <EnhancedWheel
                          participants={session.participants?.map(p => ({ id: p.id, name: p.name, email: p.email }))}
                          isLiveMode={true}
                          sessionId={sessionId}
                          studentMode={true}
                          disabled={!collaboratorPermissions?.canControlLive}
                          selectedWheelType={session.selectedWheelType || null}
                          wheelTitle={session.wheelTitle || session.title}
                          enableRealTimeSync={true}
                          organizerMode={false}
                          isSpinning={spinAnimation}
                          wheelTheme={currentWheelTheme}
                          customItems={session.selectedWheelType?.defaultItems || session.participants?.map(p => p.name) || []}
                          userPermissions={{
                            isFullAccessCollaborator: collaboratorPermissions?.canEditWheel || false,
                            canTriggerSynchronizedSpin: collaboratorPermissions?.canTriggerSynchronizedSpin || false,
                            synchronizationEnabled: collaboratorPermissions?.canTriggerSynchronizedSpin || false,
                            sessionId: sessionId,
                            userRole: collaboratorPermissions?.permissionLevel || 'viewer',
                            canViewOnly: collaboratorPermissions?.permissionLevel === 'view'
                          }}
                          onWinnersDetected={(winners) => {
                            console.log("🎯 COLLABORATIVE: Winners detected from EnhancedWheel - winner announcement should be synchronized", {
                              winnerCount: winners.length,
                              winners: winners.map(w => w.name),
                              timestamp: new Date().toISOString(),
                              willShowWinnerAnnouncement: true
                            })

                            if (!spinAnimation) {
                              console.log("✅ COLLABORATIVE: Spin animation completed, showing winner announcement")
                            } else {
                              console.log("⏳ COLLABORATIVE: Animation still running, winner announcement will be delayed")
                            }
                          }}
                        />
                      )}
                    </div>
                  </div>

                  {/* Real-time wheel type change notification */}
                  {session.selectedWheelType && (
                    <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <div className="flex items-center gap-2 text-blue-800">
                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                        <span className="text-sm font-medium">
                          🔄 Synchronized with organizer's wheel: {session.selectedWheelType.title}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Reaction Buttons */}
                {session.settings?.allowReactions && (
                  <div className="mt-6">
                    <p className="text-sm text-gray-600 mb-3">Send a reaction:</p>
                    <div className="flex justify-center gap-3 flex-wrap">
                      {reactionEmojis.map(({ emoji, label }) => (
                        <button
                          key={emoji}
                          onClick={() => sendReaction(emoji)}
                          className="text-2xl hover:scale-110 transition-transform p-2 rounded border hover:bg-gray-50"
                          title={label}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </Card>
          </div>

        {/* Sidebar - Requests, Reactions, and Comments */}
        <div className="space-y-4">
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
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 mb-3">
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

                  {/* Invite Options */}
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        // TODO: Implement invite students functionality
                        toast({
                          title: "Coming Soon",
                          description: "Student invitation feature coming soon!",
                        })
                      }}
                      className="flex items-center gap-1 text-xs h-8 border-2"
                      style={{borderColor: '#8e0b16', color: '#8e0b16'}}
                    >
                      📱 Invite Students
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        // TODO: Implement QR code functionality
                        toast({
                          title: "Coming Soon",
                          description: "QR code generation coming soon!",
                        })
                      }}
                      className="flex items-center gap-1 text-xs h-8 border-2"
                      style={{borderColor: '#8e0b16', color: '#8e0b16'}}
                    >
                      <span className="text-sm">📱</span> QR Code
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        if (navigator.share && session.roomCode) {
                          navigator.share({
                            title: 'Join Live Wheel Session',
                            text: `Join our live wheel session with code: ${session.roomCode}`,
                            url: window.location.href,
                          }).catch(console.error)
                        } else {
                          navigator.clipboard.writeText(`${window.location.href} (Room Code: ${session.roomCode})`)
                          toast({
                            title: "Copied!",
                            description: "Session link copied to clipboard",
                          })
                        }
                      }}
                      className="flex items-center gap-1 text-xs h-8 border-2"
                      style={{borderColor: '#8e0b16', color: '#8e0b16'}}
                    >
                      <span className="text-sm">📤</span> Share
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        // TODO: Implement email invites
                        toast({
                          title: "Coming Soon",
                          description: "Email invitation feature coming soon!",
                        })
                      }}
                      className="flex items-center gap-1 text-xs h-8 border-2"
                      style={{borderColor: '#8e0b16', color: '#8e0b16'}}
                    >
                      📧 Send Invites
                    </Button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-3 gap-1 sm:gap-2 pt-2 sm:pt-3 border-t border-gray-200">
                <div className="text-center p-1.5 sm:p-2 bg-gray-50 rounded-lg border">
                  <div className="text-sm sm:text-base font-bold" style={{color: '#8e0b16'}}>{session.participants?.length || 0}</div>
                  <div className="text-xs text-gray-600">Items</div>
                </div>
                <div className="text-center p-1.5 sm:p-2 bg-gray-50 rounded-lg border">
                  <div className="text-sm sm:text-base font-bold" style={{color: '#8e0b16'}}>{session.viewerCount || 0}</div>
                  <div className="text-xs text-gray-600">Viewers</div>
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
                  Participants ({session.viewerCount || 0})
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-2 sm:p-3">
              {session.viewerCount === 0 ? (
                <div className="text-center py-3 text-gray-500">
                  <div className="p-3 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                    <Users className="h-8 w-8 mx-auto mb-2 opacity-50" style={{color: '#8e0b16'}} />
                    <p className="text-xs font-medium mb-1" style={{color: '#8e0b16'}}>No participants yet</p>
                    <p className="text-xs text-gray-600">Use the invite options above to bring people in</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="max-h-32 overflow-y-auto space-y-2">
                    {/* Display current user */}
                    <div className="flex items-center justify-between p-2 rounded-lg border-2" style={{backgroundColor: 'rgba(142, 11, 22, 0.05)', borderColor: '#8e0b16'}}>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                        <span className="font-medium text-sm" style={{color: '#8e0b16'}}>
                          {viewerName} (You)
                        </span>
                        {collaboratorPermissions && (
                          <Badge variant="secondary" className="px-1 py-0 text-xs bg-yellow-100 text-yellow-700">
                            <Crown className="h-3 w-3 mr-1" />
                            {collaboratorPermissions.permissionLevel.toUpperCase()}
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-green-600 font-medium">
                        Online
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Comments */}
          <div className="bg-white rounded-lg border p-4">
            <h3 className="font-semibold mb-3" style={{ color: schoolColors.primary }}>
              Live Comments
            </h3>
            <div className="space-y-4">
              {/* Comment Input */}
              <div className="flex gap-2">
                <input
                  placeholder="Type a comment..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && sendComment()}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm"
                />
                <Button
                  onClick={sendComment}
                  disabled={!newComment.trim()}
                  className="px-4 py-2 bg-[#8e0b16] text-white rounded text-sm hover:bg-[#66181E] disabled:opacity-50"
                >
                  Send
                </Button>
              </div>

              {/* Comments List */}
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {comments.map((comment: any) => (
                  <div key={comment.id} className="p-2 bg-gray-50 rounded">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm">{comment.userName}</span>
                      <span className="text-xs text-gray-500">
                        {comment.timestamp ? comment.timestamp.toLocaleTimeString() : "Just now"}
                      </span>
                    </div>
                    <p className="text-sm">{comment.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced Winner Popup for Participants */}
      {session?.winners && session.winners.length > 0 && (
        <TextWinnerPopup
          isOpen={showWinnerPopup}
          onClose={() => setShowWinnerPopup(false)}
          winners={session.winners}
          congratsMessage={session.settings?.congratsMessage || "Congratulations! You are the {word}!"}
          customWinnerMessage={session.settings?.congratsMessage || ""}
          customWinnerWord="Winner"
          showConfetti={true}
          autoClose={15}
          customTitle="Winner Announcement"
          theme={{
            primary: schoolColors.primary,
            secondary: schoolColors.secondary,
            accent: schoolColors.accent
          }}
        />
      )}
    </div>
  </div>
)
}
