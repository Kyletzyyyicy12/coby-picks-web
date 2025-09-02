"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { toast } from "@/hooks/use-toast"
import { db } from "@/lib/firebase"
import { doc, onSnapshot, updateDoc, arrayUnion, serverTimestamp } from "firebase/firestore"
import { Play, Users, Trophy, Clock, Eye, Heart, ThumbsUp, Star } from "lucide-react"
import { EnhancedWheel } from "@/components/randomizer/enhanced-wheel"
import type { User as FirebaseUser } from "firebase/auth"

interface StudentWheelParticipantProps {
  activityId: string
  user: FirebaseUser | null
  studentName?: string
}

interface ActivityData {
  id: string
  title: string
  description: string
  category: string
  participants: string[]
  settings: {
    numberOfWinners: number
    isShared: boolean
    allowReactions: boolean
    hasConfetti: boolean
    hasSound: boolean
  }
  isLive: boolean
  currentSpin?: {
    isSpinning: boolean
    results: string[]
    timestamp: Date
  }
  createdBy: string
  organizerName: string
}

export function StudentWheelParticipant({ activityId, user, studentName }: StudentWheelParticipantProps) {
  const [activity, setActivity] = useState<ActivityData | null>(null)
  const [loading, setLoading] = useState(true)
  const [hasJoined, setHasJoined] = useState(false)
  const [viewerCount, setViewerCount] = useState(0)
  const [selectedReaction, setSelectedReaction] = useState<string>("")

  const schoolColors = {
    primary: "#8e0b16",
    secondary: "#66181E",
    accent: "#ffffff"
  }

  const reactions = [
    { emoji: "❤️", label: "Love it" },
    { emoji: "👍", label: "Great" },
    { emoji: "🎉", label: "Exciting" },
    { emoji: "⭐", label: "Amazing" },
    { emoji: "🔥", label: "Fire" },
    { emoji: "😊", label: "Happy" }
  ]

  useEffect(() => {
    if (!activityId) return

    const unsubscribe = onSnapshot(doc(db, "drawActivities", activityId), (doc) => {
      if (doc.exists()) {
        const data = doc.data()
        setActivity({
          id: doc.id,
          title: data.title,
          description: data.description,
          category: data.category,
          participants: data.participants || [],
          settings: data.settings || {},
          isLive: data.isLive || false,
          currentSpin: data.currentSpin,
          createdBy: data.createdBy,
          organizerName: data.organizerName || "Teacher"
        })

        // Check if user has joined
        if (user && data.participants?.includes(user.uid)) {
          setHasJoined(true)
        }

        // Update viewer count
        setViewerCount(data.viewerCount || 0)
      }
      setLoading(false)
    })

    return () => unsubscribe()
  }, [activityId, user])

  const handleJoinActivity = async () => {
    if (!user || !activity) return

    try {
      const participantData: any = {
        name: user.displayName || studentName || "Student",
        joinedAt: serverTimestamp()
      }

      // Only include email if it exists
      if (user.email) {
        participantData.email = user.email
      }

      await updateDoc(doc(db, "drawActivities", activityId), {
        participants: arrayUnion(user.uid),
        [`participantData.${user.uid}`]: participantData,
        viewerCount: viewerCount + 1
      })

      setHasJoined(true)
      toast({
        title: "Joined Successfully!",
        description: `You've joined "${activity.title}" and can now participate in draws.`,
      })
    } catch (error) {
      console.error("Error joining activity:", error)
      toast({
        title: "Error",
        description: "Failed to join activity. Please try again.",
        variant: "destructive"
      })
    }
  }

  const handleReaction = async (emoji: string) => {
    if (!user || !activity || !activity.settings.allowReactions) return

    try {
      const reactionData = {
        emoji,
        timestamp: serverTimestamp(),
        userName: user.displayName || studentName || "Student"
      }

      await updateDoc(doc(db, "drawActivities", activityId), {
        [`reactions.${user.uid}`]: reactionData
      })

      setSelectedReaction(emoji)
      toast({
        title: "Reaction Added!",
        description: `You reacted with ${emoji}`,
      })
    } catch (error) {
      console.error("Error adding reaction:", error)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4" style={{ borderColor: schoolColors.primary }}></div>
          <p style={{ color: schoolColors.primary }}>Loading activity...</p>
        </div>
      </div>
    )
  }

  if (!activity) {
    return (
      <div className="container mx-auto p-6 text-center">
        <h2 className="text-2xl font-bold mb-4" style={{ color: schoolColors.primary }}>
          Activity Not Found
        </h2>
        <p className="text-muted-foreground">
          The activity you're looking for doesn't exist or isn't shared publicly.
        </p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold" style={{ color: schoolColors.primary }}>
                {activity.title}
              </h1>
              <p className="text-muted-foreground">
                By {activity.organizerName}
              </p>
            </div>
            <div className="flex items-center gap-4">
              {activity.isLive && (
                <Badge className="bg-red-500 animate-pulse">
                  🔴 LIVE
                </Badge>
              )}
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Eye className="h-4 w-4" />
                <span>{viewerCount} viewers</span>
              </div>
            </div>
          </div>
          
          {activity.description && (
            <p className="text-muted-foreground mb-4">{activity.description}</p>
          )}

          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span>{activity.participants.length} participants</span>
            </div>
            <div className="flex items-center gap-1">
              <Trophy className="h-4 w-4 text-muted-foreground" />
              <span>{activity.settings.numberOfWinners} winner(s)</span>
            </div>
          </div>
        </div>

        {/* Join Activity */}
        {!hasJoined && user && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle style={{ color: schoolColors.primary }}>
                Join This Activity
              </CardTitle>
              <CardDescription>
                Join to participate in the wheel spin and see results in real-time
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={handleJoinActivity}
                className="text-white"
                style={{ backgroundColor: schoolColors.primary }}
              >
                <Users className="h-4 w-4 mr-2" />
                Join Activity
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Wheel Display */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle style={{ color: schoolColors.primary }}>
                  {activity.isLive ? "🔴 Live Draw" : "Wheel Preview"}
                </CardTitle>
                <CardDescription>
                  {activity.isLive 
                    ? "Watch the live draw in real-time!" 
                    : hasJoined 
                      ? "You're ready to participate when the draw goes live"
                      : "Join the activity to participate in draws"
                  }
                </CardDescription>
              </CardHeader>
              <CardContent>
                <EnhancedWheel
                  participants={activity.participants.map((id, index) => ({
                    id: id,
                    name: `Participant ${index + 1}`,
                    isSelected: false
                  }))}
                  onSpinComplete={() => {}} // Students can't initiate spins
                  studentMode={true} // Enable student mode
                  disabled={!hasJoined} // Disable if not joined
                  isLiveMode={activity.isLive}
                  sessionId={activityId}
                />
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Participation Status */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Your Status</CardTitle>
              </CardHeader>
              <CardContent>
                {hasJoined ? (
                  <div className="text-center space-y-2">
                    <div className="text-green-600 text-2xl">✅</div>
                    <p className="font-medium text-green-600">Joined!</p>
                    <p className="text-sm text-muted-foreground">
                      You'll be included in the next draw
                    </p>
                  </div>
                ) : user ? (
                  <div className="text-center space-y-2">
                    <div className="text-yellow-600 text-2xl">⏳</div>
                    <p className="font-medium text-yellow-600">Not Joined</p>
                    <p className="text-sm text-muted-foreground">
                      Join to participate in draws
                    </p>
                  </div>
                ) : (
                  <div className="text-center space-y-2">
                    <div className="text-blue-600 text-2xl">👀</div>
                    <p className="font-medium text-blue-600">Viewing</p>
                    <p className="text-sm text-muted-foreground">
                      You can watch but not participate
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Reactions */}
            {activity.settings.allowReactions && hasJoined && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">React</CardTitle>
                  <CardDescription>
                    Show your excitement!
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-2">
                    {reactions.map((reaction) => (
                      <Button
                        key={reaction.emoji}
                        variant={selectedReaction === reaction.emoji ? "default" : "outline"}
                        size="sm"
                        onClick={() => handleReaction(reaction.emoji)}
                        className="text-lg"
                      >
                        {reaction.emoji}
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Activity Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Activity Info</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Category:</span>
                  <Badge variant="outline">{activity.category}</Badge>
                </div>
                <div className="flex justify-between">
                  <span>Winners:</span>
                  <span>{activity.settings.numberOfWinners}</span>
                </div>
                <div className="flex justify-between">
                  <span>Confetti:</span>
                  <span>{activity.settings.hasConfetti ? "✅" : "❌"}</span>
                </div>
                <div className="flex justify-between">
                  <span>Sound:</span>
                  <span>{activity.settings.hasSound ? "✅" : "❌"}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
