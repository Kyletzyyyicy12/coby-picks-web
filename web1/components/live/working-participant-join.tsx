"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { toast } from "@/hooks/use-toast"
import { db } from "@/lib/firebase"
import { collection, query, where, getDocs, doc, setDoc, serverTimestamp } from "firebase/firestore"
import {
  Users,
  Smartphone,
  Monitor,
  QrCode,
  Key,
  ArrowRight,
  CheckCircle,
  AlertCircle,
  Loader2,
  Eye
} from "lucide-react"

interface WorkingParticipantJoinProps {
  trigger?: React.ReactNode
  className?: string
  onJoinSuccess?: (sessionId: string, roomCode: string, participantName: string) => void
}

export function WorkingParticipantJoin({
  trigger,
  className,
  onJoinSuccess
}: WorkingParticipantJoinProps) {
  const [roomCode, setRoomCode] = useState("")
  const [participantName, setParticipantName] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isValidating, setIsValidating] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [validationAttempts, setValidationAttempts] = useState(0)
  const [sessionPreview, setSessionPreview] = useState<{
    title: string
    description: string
    participantCount: number
    viewerCount: number
    sessionId: string
  } | null>(null)
  const router = useRouter()

  const schoolColors = {
    primary: "#8e0b16",
    secondary: "#66181E",
    accent: "#ffffff"
  }

  // Format room code input
  const formatRoomCode = (value: string) => {
    const cleaned = value.replace(/[^A-Z0-9]/gi, '').toUpperCase()
    return cleaned.slice(0, 6)
  }

  const handleRoomCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatRoomCode(e.target.value)
    setRoomCode(formatted)
    setSessionPreview(null)
  }

  // Validate room code and get session preview
  const validateRoomCode = async () => {
    if (!roomCode.trim() || roomCode.length !== 6) {
      toast({
        title: "Invalid Room Code",
        description: "Please enter a valid 6-character room code",
        variant: "destructive"
      })
      return
    }

    setIsValidating(true)
    setValidationAttempts(prev => prev + 1)

    try {
      // Search for live session with this room code
      const sessionsQuery = query(
        collection(db, "liveDrawSessions"),
        where("roomCode", "==", roomCode.toUpperCase()),
        where("isActive", "==", true)
      )

      const querySnapshot = await getDocs(sessionsQuery)

      if (querySnapshot.empty) {
        toast({
          title: "Room Not Found",
          description: validationAttempts < 2
            ? "No active session found with this room code. Please check the code and try again."
            : "Room not found. Please verify the room code with the organizer.",
          variant: "destructive"
        })
        setSessionPreview(null)
        return
      }

      const sessionDoc = querySnapshot.docs[0]
      const sessionData = sessionDoc.data()

      // Check if session is actually live
      if (!sessionData.isLive) {
        toast({
          title: "Session Not Live",
          description: "This session is not currently active",
          variant: "destructive"
        })
        setSessionPreview(null)
        return
      }

      // Get viewer count from subcollection
      const viewersQuery = query(collection(db, "liveDrawSessions", sessionDoc.id, "viewers"))
      const viewersSnapshot = await getDocs(viewersQuery)

      setSessionPreview({
        title: sessionData.title || "Live Session",
        description: sessionData.description || "",
        participantCount: sessionData.participants?.length || 0,
        viewerCount: viewersSnapshot.size,
        sessionId: sessionDoc.id
      })

      setValidationAttempts(0)

      toast({
        title: "Room Found!",
        description: `"${sessionData.title}" is ready to join`,
      })

    } catch (error) {
      console.error("Error validating room code:", error)
      toast({
        title: "Validation Error",
        description: "Failed to validate room code. Please check your connection and try again.",
        variant: "destructive"
      })
      setSessionPreview(null)
    } finally {
      setIsValidating(false)
    }
  }

  const handleJoinRoom = async () => {
    if (!roomCode.trim()) {
      toast({
        title: "Room Code Required",
        description: "Please enter a room code",
        variant: "destructive"
      })
      return
    }

    if (!participantName.trim()) {
      toast({
        title: "Name Required",
        description: "Please enter your name",
        variant: "destructive"
      })
      return
    }

    if (!sessionPreview) {
      toast({
        title: "Validate Room First",
        description: "Please validate the room code before joining",
        variant: "destructive"
      })
      return
    }

    setIsLoading(true)
    try {
      // Detect platform for cross-platform support
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

      const platform = detectPlatform()
      const viewerId = `viewer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

      // Add viewer to session with enhanced data
      await setDoc(doc(db, "liveDrawSessions", sessionPreview.sessionId, "viewers", viewerId), {
        name: participantName,
        joinedAt: serverTimestamp(),
        isActive: true,
        lastSeen: serverTimestamp(),
        platform: platform,
        connectionId: viewerId,
        userAgent: navigator.userAgent,
        sessionId: sessionPreview.sessionId,
        isOnline: true,
        lastActivity: serverTimestamp()
      })

      // Update viewer count in main session document
      await setDoc(doc(db, "liveDrawSessions", sessionPreview.sessionId), {
        viewerCount: sessionPreview.viewerCount + 1
      }, { merge: true })

      console.log(`🔗 Participant joining session: ${sessionPreview.sessionId} as ${participantName} on ${platform}`)

      // Redirect to live viewer
      router.push(`/live/${sessionPreview.sessionId}?name=${encodeURIComponent(participantName)}`)

      toast({
        title: "Joining Session...",
        description: `Welcome ${participantName}! Connecting to room ${roomCode}`,
      })

      onJoinSuccess?.(sessionPreview.sessionId, roomCode, participantName)
      setIsOpen(false)

    } catch (error) {
      console.error("Error joining room:", error)
      toast({
        title: "Error",
        description: "Failed to join room. Please try again.",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button
            className={`bg-[#8e0b16] hover:bg-[#66181E] ${className}`}
            size="lg"
          >
            <Key className="h-5 w-5 mr-2" />
            Join Live Session
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle style={{ color: schoolColors.primary }} className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Join Live Session
          </DialogTitle>
          <DialogDescription>
            Enter the room code provided by your organizer to join the live session
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Room Code Input */}
          <div className="space-y-2">
            <Label htmlFor="roomCode">Room Code</Label>
            <div className="flex gap-2">
              <Input
                id="roomCode"
                placeholder="Enter 6-character code"
                value={roomCode}
                onChange={handleRoomCodeChange}
                className="font-mono text-lg text-center tracking-wider"
                maxLength={6}
                disabled={isValidating}
              />
              <Button
                onClick={validateRoomCode}
                disabled={roomCode.length !== 6 || isValidating}
                variant="outline"
                size="sm"
              >
                {isValidating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Ask your organizer for the 6-character room code
            </p>
          </div>

          {/* Session Preview */}
          {sessionPreview && (
            <Card className="border-green-200 bg-green-50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-green-800 flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  Session Found!
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="font-medium text-green-900">{sessionPreview.title}</p>
                  {sessionPreview.description && (
                    <p className="text-sm text-green-700">{sessionPreview.description}</p>
                  )}
                </div>

                <div className="flex justify-between text-sm">
                  <div className="flex items-center gap-1 text-green-700">
                    <Users className="h-3 w-3" />
                    <span>{sessionPreview.participantCount} participants</span>
                  </div>
                  <div className="flex items-center gap-1 text-green-700">
                    <Eye className="h-3 w-3" />
                    <span>{sessionPreview.viewerCount} viewers</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Participant Name Input */}
          {sessionPreview && (
            <div className="space-y-2">
              <Label htmlFor="participantName">Your Name</Label>
              <Input
                id="participantName"
                placeholder="Enter your display name"
                value={participantName}
                onChange={(e) => setParticipantName(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && participantName.trim() && handleJoinRoom()}
                disabled={isLoading}
              />
              <p className="text-xs text-muted-foreground">
                This name will be visible to everyone in the session
              </p>
            </div>
          )}

          {/* Platform Support Info */}
          <div className="bg-blue-50 p-3 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Monitor className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-700">Cross-Platform Support</span>
            </div>
            <p className="text-xs text-blue-600">
              This works on web browsers, mobile devices, and the mobile app
            </p>
          </div>

          {/* Join Button */}
          <Button
            onClick={handleJoinRoom}
            disabled={
              isLoading ||
              !roomCode.trim() ||
              !participantName.trim() ||
              !sessionPreview
            }
            className="w-full bg-[#8e0b16] hover:bg-[#66181E]"
            size="lg"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Joining Session...
              </>
            ) : (
              <>
                <ArrowRight className="mr-2 h-4 w-4" />
                Join Live Session
              </>
            )}
          </Button>

          {/* Help Text */}
          {!sessionPreview && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>How to Join</AlertTitle>
              <AlertDescription>
                1. Get the 6-character room code from your organizer<br/>
                2. Enter the code above and click validate<br/>
                3. Enter your name and join the session
              </AlertDescription>
            </Alert>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}