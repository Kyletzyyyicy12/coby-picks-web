"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { toast } from "@/hooks/use-toast"
import { db } from "@/lib/firebase"
import { doc, onSnapshot, addDoc, collection, serverTimestamp, updateDoc, setDoc } from "firebase/firestore"
import { Radio, Users, Heart, ThumbsUp, Star, Trophy, Eye, Loader2, Zap, MessageSquare, Send, Volume2, VolumeX } from "lucide-react"
import confetti from "canvas-confetti"
import { EnhancedWheel } from "@/components/randomizer/enhanced-wheel"

interface LiveSession {
  id: string
  title: string
  description: string
  isActive: boolean
  isSpinning: boolean
  currentState: "waiting" | "spinning" | "ended"
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
  sessionEndNotification?: {
    message: string
    timestamp: any
    organizerName?: string
    isActive: boolean
  }
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
  const [wheelRotation, setWheelRotation] = useState(0)
  const [viewerId, setViewerId] = useState<string>('')
  const [waitingForAnimationEnd, setWaitingForAnimationEnd] = useState<boolean>(false)
  const [lastSpinStart, setLastSpinStart] = useState<number>(0)
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
    const userAgent = navigator.userAgent.toLowerCase()
    if (userAgent.includes('mobile') || userAgent.includes('android') || userAgent.includes('iphone')) {
      return 'mobile'
    } else if (window.location.href.includes('app://') || window.location.href.includes('cobypicks://')) {
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
        userAgent: navigator.userAgent,
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
                setLastSpinStart(Date.now())
                setWaitingForAnimationEnd(true)

                console.log("🎯 PARTICIPANT: Starting immediate wheel animation")

                // Start animation immediately without delay for better responsiveness
                startWheelAnimation()
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
                setWheelRotation(0) // Reset wheel to starting position

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

  const startWheelAnimation = () => {
    let animationId: number | null = null
    let startTime = performance.now()

    const animateWheel = (currentTime: number) => {
      if (!spinAnimation) {
        if (animationId) {
          cancelAnimationFrame(animationId)
        }
        return
      }

      const elapsed = currentTime - startTime

      // FIXED: Smooth, consistent rotation during spin
      if (elapsed < 3000) { // Spin for 3 seconds
        const rotationSpeed = Math.max(10, 50 - (elapsed / 60)) // Faster at start, slower at end
        setWheelRotation(prev => prev + rotationSpeed)
        animationId = requestAnimationFrame(animateWheel)
      } else {
        // FIXED: Automatic completion after duration
        console.log("✅ PARTICIPANT: Wheel animation completed naturally")
        if (animationId) {
          cancelAnimationFrame(animationId)
        }

        // FIXED: Proper cleanup and winner check after animation
        setTimeout(() => {
          if (waitingForAnimationEnd) {
            setWaitingForAnimationEnd(false)
            console.log(" plataformas PARTICIPANT: Wheel animation cleanup complete, ready for winner announcement")
          }
        }, 200)
      }
    }

    animationId = requestAnimationFrame(animateWheel)
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

      <div className="container mx-auto p-4 space-y-6">
        {/* Enhanced Header */}
        <Card className="border-2" style={{ borderColor: schoolColors.primary }}>
          <CardHeader className="bg-gradient-to-r from-[#8e0b16] to-[#66181E] text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Radio className="h-6 w-6" />
                <div>
                  <CardTitle className="flex items-center gap-2">
                    {session.title || "Live Session"}
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
                  </CardDescription>
                </div>
              </div>
              <Badge variant="secondary" className="bg-green-500 text-white animate-pulse">
                <div className="w-2 h-2 bg-white rounded-full mr-2" />
                LIVE
              </Badge>
            </div>
          </CardHeader>
        </Card>

        {/* Enhanced Status with Animation */}
        <Card>
          <CardContent className="p-6 text-center">
            {session.currentState === "waiting" && (
              <div className="space-y-4">
                <div className="text-6xl animate-pulse">⏳</div>
                <h2 className="text-2xl font-bold" style={{ color: schoolColors.primary }}>
                  Waiting for Activity to Start
                </h2>
                <p className="text-muted-foreground">
                  The organizer will start the activity soon...
                </p>
              </div>
            )}

            {session.currentState === "spinning" && (
              <div className="space-y-4">
                {/* Actual Wheel Component for synchronized spinning */}
                <div className="flex justify-center">
                  <div className="w-full max-w-md">
                    <EnhancedWheel
                      participants={session.participants}
                      isLiveMode={true}
                      sessionId={sessionId}
                      studentMode={true}
                      disabled={true}
                      selectedWheelType={session.selectedWheelType || null}
                      wheelTitle={session.wheelTitle || session.title}
                      enableRealTimeSync={true}
                      organizerMode={false}
                      isSpinning={session.currentState === "spinning"}
                      onWinnersDetected={(winners) => {
                        console.log("🎯 PARTICIPANT: Winners detected from EnhancedWheel - winner announcement should be synchronized", {
                          winnerCount: winners.length,
                          winners: winners.map(w => w.name),
                          timestamp: new Date().toISOString(),
                          willShowWinnerAnnouncement: true
                        })

                        // CRITICAL: Only show winner UI if animation has completed
                        if (!spinAnimation) {
                          // Winner announcement should only happen AFTER spin animation completes
                          console.log("✅ PARTICIPANT: Spin animation completed, showing winner announcement")
                        } else {
                          console.log("⏳ PARTICIPANT: Animation still running, winner announcement will be delayed")
                        }
                      }}
                    />
                  </div>
                </div>
                <h2 className="text-2xl font-bold" style={{ color: schoolColors.primary }}>
                  Activity in Progress!
                </h2>
                <p className="text-muted-foreground">
                  Watch as the results are determined...
                </p>
              </div>
            )}

            {/* FIXED: Winner announcement with proper synchronization */}
            {session.winners && session.winners.length > 0 && !waitingForAnimationEnd && (
              <div className="space-y-4">
                <div className="text-6xl animate-bounce">🎉</div>
                <div className="space-y-3">
                  {session.winners.map((winner, index) => (
                    <div key={`${winner.id}-${session.currentState}`} className="flex items-center justify-center gap-3 p-3 bg-green-50 rounded-lg border border-green-200 animate-in fade-in-50 duration-500">
                      <Badge variant="default" className="bg-[#8e0b16] animate-pulse">
                        #{index + 1}
                      </Badge>
                      <div>
                        <p className="font-semibold text-lg">{winner.name}</p>
                        {winner.email && (
                          <p className="text-sm text-muted-foreground">{winner.email}</p>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* FIXED: Show winner announcement message */}
                  <div className="p-3 bg-green-100 rounded-lg border border-green-300">
                    <p className="text-center text-green-800 font-medium">
                      {session.settings?.congratsMessage || "Congratulations to the winners! 🎉"}
                    </p>
                  </div>
                </div>

                {/* FIXED: Clear winner ready message */}
                {session.currentState === "waiting" && !spinAnimation && (
                  <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200 animate-in fade-in-0 duration-500">
                    <p className="text-center text-sm text-blue-700 font-medium">
                      🎯 Ready for Next Spin! The organizer can spin again.
                    </p>
                  </div>
                )}

                {/* FIXED: Show if waiting for animation to complete */}
                {waitingForAnimationEnd && (
                  <div className="mt-4 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                    <div className="flex items-center justify-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-500"></div>
                      <p className="text-center text-sm text-yellow-700 font-medium">
                        Completing wheel animation...
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* FIXED: Add waiting indicator while wheel spins */}
            {waitingForAnimationEnd && session.currentState !== "ended" && (
              <div className="mt-4 p-3 bg-orange-50 rounded-lg border border-orange-200">
                <p className="text-center text-sm text-orange-700 font-medium">
                  🌀 Wheel is spinning... Reconnecting will continue when complete!
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Enhanced Reactions */}
        {session.settings.allowReactions && (
          <Card>
            <CardHeader>
              <CardTitle className="text-center flex items-center justify-center gap-2">
                <Heart className="h-5 w-5" />
                React to the Session
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex justify-center gap-3 flex-wrap">
                {reactionEmojis.map(({ emoji, icon: Icon, label }) => (
                  <Button
                    key={emoji}
                    variant="outline"
                    size="lg"
                    onClick={() => sendReaction(emoji)}
                    className="text-2xl hover:scale-110 transition-all duration-200 hover:shadow-md"
                    style={{ borderColor: schoolColors.primary }}
                    title={label}
                  >
                    {emoji}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Live Activity Feed */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Reactions */}
          {reactions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Heart className="h-5 w-5" />
                  Live Reactions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {reactions.slice(0, 10).map((reaction) => (
                    <div
                      key={reaction.id}
                      className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg"
                    >
                      <span className="text-2xl">{reaction.emoji}</span>
                      <div className="flex-1">
                        <p className="font-medium text-sm">{reaction.userName}</p>
                        <p className="text-xs text-muted-foreground">
                          {reaction.timestamp.toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Comments Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Live Chat
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Comments List */}
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {comments.map((comment) => (
                    <div key={comment.id} className="p-2 bg-gray-50 rounded-lg">
                      <div className="flex justify-between items-start">
                        <p className="font-medium text-sm">{comment.userName}</p>
                        <p className="text-xs text-muted-foreground">
                          {comment.timestamp.toLocaleTimeString()}
                        </p>
                      </div>
                      <p className="text-sm mt-1">{comment.text}</p>
                    </div>
                  ))}
                  {comments.length === 0 && (
                    <p className="text-center text-muted-foreground py-4">
                      No comments yet. Be the first to say something!
                    </p>
                  )}
                </div>

                {/* Comment Input */}
                <div className="flex gap-2">
                  <Input
                    placeholder="Type a comment..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && sendComment()}
                    className="flex-1"
                  />
                  <Button 
                    onClick={sendComment}
                    disabled={!newComment.trim()}
                    size="sm"
                    style={{ backgroundColor: schoolColors.primary }}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Participants List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Participants ({session.participants.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {session.participants.map((participant) => (
                <div
                  key={participant.id}
                  className={`p-3 rounded-lg border transition-colors ${
                    session.winners.some(w => w.id === participant.id)
                      ? "bg-green-50 border-green-200 shadow-md"
                      : "bg-gray-50 border-gray-200"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {session.winners.some(w => w.id === participant.id) && (
                      <Trophy className="h-4 w-4 text-yellow-500" />
                    )}
                    <span className="font-medium">{participant.name}</span>
                  </div>
                  {participant.email && (
                    <p className="text-xs text-muted-foreground mt-1">{participant.email}</p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}