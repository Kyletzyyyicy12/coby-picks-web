"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { toast } from "@/hooks/use-toast"
import { db } from "@/lib/firebase"
import { doc, onSnapshot, addDoc, collection, serverTimestamp, updateDoc, setDoc } from "firebase/firestore"
import { Radio, Users, Heart, ThumbsUp, Star, Trophy, Eye, Loader2, Zap } from "lucide-react"
import confetti from "canvas-confetti"

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
  settings: {
    numberOfWinners: number
    congratsMessage: string
    allowReactions: boolean
  }
  viewerCount: number
  endedExplicitly?: boolean
  teacherPresence?: {
    isOnline: boolean
    lastSeen: any
    userId?: string
    userName?: string
  }
  sessionEndNotification?: {
    message: string
    timestamp: any
    organizerName?: string
    isActive: boolean
  }
}

interface LiveViewerProps {
  sessionId: string
  studentName?: string
}

export function LiveViewer({ sessionId, studentName }: LiveViewerProps) {
  const [session, setSession] = useState<LiveSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [connected, setConnected] = useState(false)
  const [viewerName, setViewerName] = useState(studentName || "")
  const [isNameDialogOpen, setIsNameDialogOpen] = useState(!studentName)
  const [reactions, setReactions] = useState<Array<{ id: string; emoji: string; timestamp: Date }>>([])
  const [spinAnimation, setSpinAnimation] = useState(false)
  const unsubscribeRef = useRef<(() => void) | null>(null)

  const schoolColors = {
    primary: "#8e0b16",
    secondary: "#66181E",
    accent: "#ffffff"
  }

  const reactionEmojis = [
    { emoji: "👏", icon: Zap, label: "Clap" },
    { emoji: "👍", icon: ThumbsUp, label: "Thumbs Up" },
    { emoji: "❤️", icon: Heart, label: "Heart" },
    { emoji: "⭐", icon: Star, label: "Star" }
  ]

  useEffect(() => {
    if (viewerName && !connected) {
      joinSession()
    }

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current()
      }
    }
  }, [viewerName, connected])

  const joinSession = async () => {
    try {
      // Detect platform for cross-platform support
      const platform = detectPlatform()
      const viewerId = `viewer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

      console.log(`🔗 Student joining session: ${sessionId} as ${viewerName} on ${platform}`)

      // Add viewer to session with enhanced data
      await setDoc(doc(db, "liveDrawSessions", sessionId, "viewers", viewerId), {
        name: viewerName,
        joinedAt: serverTimestamp(),
        isActive: true,
        lastSeen: serverTimestamp(),
        platform: platform,
        connectionId: viewerId,
        userAgent: navigator.userAgent,
        sessionId: sessionId,
        isOnline: true,
        lastActivity: serverTimestamp()
      })

      // Start heartbeat to maintain connection
      startHeartbeat(sessionId, viewerId)

      // Start listening to session updates with enhanced teacher presence checking
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
              
              // Show notification that organizer ended the session
              toast({
                title: "Session Ended",
                description: "The organizer has ended this live session. Thank you for participating!",
                variant: "default",
                duration: 6000
              })
              
              // Redirect to home page after a delay
              setTimeout(() => {
                window.location.href = '/'
              }, 3000)
              
              return
            }

            setSession({ ...data, id: doc.id })

            // Check teacher presence - more lenient approach
            const teacherPresence = data.teacherPresence
            const isTeacherPresent = teacherPresence && (
              teacherPresence.isOnline === true ||
              (teacherPresence.lastSeen &&
               new Date().getTime() - teacherPresence.lastSeen.toDate().getTime() < 300000) // 5 minutes
            )

            // Only show teacher not present if session is supposed to be active but teacher is clearly offline
            if (data.isActive && !isTeacherPresent && data.currentState !== "ended") {
              console.warn("⚠️ Teacher presence check:", {
                isOnline: teacherPresence?.isOnline,
                lastSeen: teacherPresence?.lastSeen?.toDate(),
                timeDiff: teacherPresence?.lastSeen ? new Date().getTime() - teacherPresence.lastSeen.toDate().getTime() : 'no lastSeen'
              })

              // Only show error after a delay to avoid false positives
              setTimeout(() => {
                if (data.isActive && data.currentState !== "ended") {
                  toast({
                    title: "Teacher Connection Issue",
                    description: "Trying to reconnect to teacher...",
                    variant: "default"
                  })
                }
              }, 10000) // Wait 10 seconds before showing warning
            }   

            // Handle state changes
            if (data.currentState === "spinning" && !spinAnimation) {
              setSpinAnimation(true)
              toast({
                title: "Spin Started!",
                description: "The wheel is spinning...",
              })
            } else if (data.currentState === "ended" && spinAnimation) {
              setSpinAnimation(false)
              triggerConfetti()
              // Toast notification removed to prevent duplication
              console.log('🎉 Winners selected:', {
                count: data.winners.length,
                names: data.winners.map(w => w.name)
              })
            }

            console.log(`📡 Session update:`, {
              state: data.currentState,
              isActive: data.isActive,
              viewerCount: data.viewerCount,
              teacherOnline: teacherPresence?.isOnline
            })

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
            
            // Redirect to home page after a delay
            setTimeout(() => {
              window.location.href = '/'
            }, 3000)
          }
          setLoading(false)
        },
        (error) => {
          console.error("❌ Session listener error:", error)
          toast({
            title: "Connection Error",
            description: "Lost connection to session. Trying to reconnect...",
            variant: "destructive"
          })
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
          })) as Array<{ id: string; emoji: string; timestamp: Date }>
          setReactions(reactionList.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()).slice(0, 10))
        }
      )

      unsubscribeRef.current = () => {
        sessionUnsubscribe()
        reactionsUnsubscribe()
      }

      setConnected(true)
      setIsNameDialogOpen(false)
      
      toast({
        title: "Connected!",
        description: "You're now watching the live draw",
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
        userId: `viewer-${Date.now()}`,
        userName: viewerName,
        timestamp: serverTimestamp()
      })
    } catch (error) {
      console.error("Error sending reaction:", error)
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto" style={{ color: schoolColors.primary }} />
          <p className="text-muted-foreground">Connecting to live session...</p>
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
              Enter your name to watch the live draw
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
        {/* Header */}
        <Card className="border-2" style={{ borderColor: schoolColors.primary }}>
          <CardHeader className="bg-[#8e0b16] text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Radio className="h-6 w-6" />
                <div>
                  <CardTitle>Live Draw Session</CardTitle>
                  <CardDescription className="text-white/80">
                    Welcome, {viewerName}!
                  </CardDescription>
                </div>
              </div>
              <Badge variant="secondary" className="bg-green-500 text-white">
                <div className="w-2 h-2 bg-white rounded-full mr-2 animate-pulse" />
                LIVE
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold" style={{ color: schoolColors.primary }}>
                  {session.participants.length}
                </p>
                <p className="text-sm text-muted-foreground">Participants</p>
              </div>
              <div>
                <p className="text-2xl font-bold" style={{ color: schoolColors.primary }}>
                  {session.viewerCount}
                </p>
                <p className="text-sm text-muted-foreground">Viewers</p>
              </div>
              <div>
                <p className="text-2xl font-bold" style={{ color: schoolColors.primary }}>
                  {session.settings.numberOfWinners}
                </p>
                <p className="text-sm text-muted-foreground">Winners to Select</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Status */}
        <Card>
          <CardContent className="p-6 text-center">
            {session.currentState === "waiting" && (
              <div className="space-y-4">
                <div className="text-6xl">⏳</div>
                <h2 className="text-2xl font-bold" style={{ color: schoolColors.primary }}>
                  Waiting for Draw to Start
                </h2>
                <p className="text-muted-foreground">
                  The teacher will start the randomizer soon...
                </p>
              </div>
            )}

            {session.currentState === "spinning" && (
              <div className="space-y-4">
                <div className="text-6xl animate-spin">🎯</div>
                <h2 className="text-2xl font-bold" style={{ color: schoolColors.primary }}>
                  Spinning the Wheel!
                </h2>
                <p className="text-muted-foreground">
                  The randomizer is selecting winners...
                </p>
              </div>
            )}

            {session.winners && session.winners.length > 0 && (
              <div className="space-y-4">
                <div className="space-y-4">
                  <div className="flex items-center justify-center gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
                    <div className="text-4xl">🏆</div>
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Congratulations to our winner{session.winners.length > 1 ? 's' : ''}!
                      </p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {session.winners.map((winner, index) => (
                      <div key={winner.id} className="flex items-center justify-center gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
                        <Badge variant="default" className="bg-[#8e0b16]">
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
                  </div>
                  <p className="text-lg font-medium" style={{ color: schoolColors.primary }}>
                    {session.settings.congratsMessage.replace('{name}', session.winners.map(w => w.name).join(', '))}
                  </p>
                </div>
                {session.currentState === "waiting" && (
                  <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <p className="text-center text-sm text-blue-700 font-medium">
                      🎯 Ready for Next Spin! The teacher can spin again.
                    </p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Reactions */}
        {session.settings.allowReactions && (
          <Card>
            <CardHeader>
              <CardTitle className="text-center">Send a Reaction</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex justify-center gap-3 flex-wrap">
                {reactionEmojis.map(({ emoji, icon: Icon, label }) => (
                  <Button
                    key={emoji}
                    variant="outline"
                    size="lg"
                    onClick={() => sendReaction(emoji)}
                    className="text-2xl hover:scale-110 transition-transform"
                    style={{ borderColor: schoolColors.primary }}
                  >
                    {emoji}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Recent Reactions */}
        {reactions.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Heart className="h-5 w-5" />
                Recent Reactions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2 flex-wrap">
                {reactions.slice(0, 10).map((reaction) => (
                  <div
                    key={reaction.id}
                    className="text-2xl animate-bounce"
                    style={{ animationDelay: `${Math.random() * 2}s` }}
                  >
                    {reaction.emoji}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

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
                  className={`p-3 rounded-lg border ${
                    session.winners.some(w => w.id === participant.id)
                      ? "bg-green-50 border-green-200"
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

  // Helper functions for cross-platform support
  function detectPlatform() {
    const userAgent = navigator.userAgent.toLowerCase()

    if (userAgent.includes('mobile') || userAgent.includes('android') || userAgent.includes('iphone')) {
      return 'mobile'
    } else if (window.location.href.includes('app://') || window.location.href.includes('cobypicks://')) {
      return 'app'
    } else {
      return 'web'
    }
  }

  function startHeartbeat(sessionId: string, viewerId: string) {
    const heartbeatInterval = setInterval(async () => {
      try {
        await updateDoc(doc(db, "liveDrawSessions", sessionId, "viewers", viewerId), {
          lastSeen: serverTimestamp(),
          isActive: true,
          lastActivity: serverTimestamp()
        })
      } catch (error) {
        console.error("Heartbeat error:", error)
        clearInterval(heartbeatInterval)
      }
    }, 30000) // Every 30 seconds

    // Cleanup on unmount
    return () => clearInterval(heartbeatInterval)
  }
}
