"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { toast } from "@/hooks/use-toast"
import { db } from "@/lib/firebase"
import { collection, query, where, getDocs, doc, setDoc, serverTimestamp } from "firebase/firestore"
import { Radio, Loader2, CheckCircle, AlertCircle } from "lucide-react"

interface DirectJoinProps {
  onJoinSuccess?: (sessionId: string, studentName: string) => void
}

export function DirectParticipantJoin({ onJoinSuccess }: DirectJoinProps) {
  const [roomCode, setRoomCode] = useState("")
  const [studentName, setStudentName] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [sessionFound, setSessionFound] = useState<any>(null)
  const router = useRouter()

  const formatRoomCode = (value: string) => {
    return value.replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 6)
  }

  const handleRoomCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatRoomCode(e.target.value)
    setRoomCode(formatted)
    
    // Auto-validate when 6 characters
    if (formatted.length === 6) {
      validateRoom(formatted)
    } else {
      setSessionFound(null)
    }
  }

  const validateRoom = async (code: string) => {
    try {
      console.log(`🔍 Searching for room: ${code}`)
      
      const sessionsQuery = query(
        collection(db, "liveDrawSessions"),
        where("roomCode", "==", code),
        where("isActive", "==", true)
      )
      
      const querySnapshot = await getDocs(sessionsQuery)
      
      if (!querySnapshot.empty) {
        const sessionDoc = querySnapshot.docs[0]
        const sessionData = sessionDoc.data()
        
        const foundSession = {
          id: sessionDoc.id,
          title: sessionData.title || "Live Session",
          roomCode: code,
          viewerCount: sessionData.viewerCount || 0
        }
        
        setSessionFound(foundSession)
        console.log(`✅ Found session: ${foundSession.title}`)
        
        toast({
          title: "Room Found! ✅",
          description: `Ready to join "${foundSession.title}"`,
        })
      } else {
        setSessionFound(null)
        console.log(`❌ No session found with code: ${code}`)
        
        toast({
          title: "Room Not Found ❌",
          description: "No active session found with this code",
          variant: "destructive"
        })
      }
    } catch (error) {
      console.error("Validation error:", error)
      setSessionFound(null)
    }
  }

  const handleDirectJoin = async () => {
    if (!sessionFound || !studentName.trim()) {
      toast({
        title: "Missing Information",
        description: "Please enter room code and your name",
        variant: "destructive"
      })
      return
    }

    setIsLoading(true)
    
    try {
      const viewerId = `viewer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      const trimmedName = studentName.trim()
      const sessionId = sessionFound.id

      console.log(`🚀 DIRECT JOIN: ${trimmedName} → Session ${sessionId}`)

      // Step 1: Register as viewer in Firestore
      const viewerData = {
        name: trimmedName,
        joinedAt: serverTimestamp(),
        isActive: true,
        lastSeen: serverTimestamp(),
        platform: 'web',
        connectionId: viewerId,
        userAgent: navigator.userAgent,
        sessionId: sessionId,
        isOnline: true,
        lastActivity: serverTimestamp(),
        participantType: 'student'
      }

      await setDoc(doc(db, "liveDrawSessions", sessionId, "viewers", viewerId), viewerData)
      console.log(`✅ Registered viewer: ${viewerId}`)

      // Step 2: Update session viewer count
      await setDoc(doc(db, "liveDrawSessions", sessionId), {
        viewerCount: (sessionFound.viewerCount || 0) + 1,
        lastActivity: serverTimestamp()
      }, { merge: true })
      console.log(`📊 Updated viewer count`)

      // Step 3: Show success message
      toast({
        title: "🎉 Joined Successfully!",
        description: `Welcome ${trimmedName}! Connecting to live session...`,
      })

      // Step 4: DIRECT NAVIGATION TO LIVE VIEWER
      const liveViewerUrl = `/live/${sessionId}?name=${encodeURIComponent(trimmedName)}&viewerId=${viewerId}&platform=web`
      console.log(`🎯 NAVIGATING TO: ${liveViewerUrl}`)
      
      // Call success callback
      onJoinSuccess?.(sessionId, trimmedName)
      
      // Navigate immediately
      router.push(liveViewerUrl)

    } catch (error) {
      console.error("❌ JOIN FAILED:", error)
      toast({
        title: "Join Failed",
        description: "Failed to join session. Please try again.",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto">
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2 text-[#8e0b16]">
            <Radio className="h-6 w-6" />
            Join Live Session
          </CardTitle>
          <CardDescription>
            Enter room code and your name to join immediately
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Room Code Input */}
          <div className="space-y-2">
            <Label htmlFor="roomCode">Room Code (6 characters)</Label>
            <Input
              id="roomCode"
              placeholder="ABC123"
              value={roomCode}
              onChange={handleRoomCodeChange}
              className="font-mono text-lg text-center tracking-wider"
              maxLength={6}
            />
            
            {/* Session Status */}
            {roomCode.length === 6 && (
              <div className="text-center">
                {sessionFound ? (
                  <div className="flex items-center justify-center gap-2 text-green-600">
                    <CheckCircle className="h-4 w-4" />
                    <span className="text-sm">Found: {sessionFound.title}</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2 text-red-600">
                    <AlertCircle className="h-4 w-4" />
                    <span className="text-sm">Room not found</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Student Name Input */}
          <div className="space-y-2">
            <Label htmlFor="studentName">Your Name</Label>
            <Input
              id="studentName"
              placeholder="Enter your name"
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && sessionFound && studentName.trim() && handleDirectJoin()}
            />
          </div>

          {/* Session Info */}
          {sessionFound && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="font-medium">{sessionFound.title}</div>
                <div className="text-sm text-gray-600">
                  {sessionFound.viewerCount} viewers connected
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Join Button */}
          <Button
            onClick={handleDirectJoin}
            disabled={isLoading || !sessionFound || !studentName.trim()}
            className="w-full bg-[#8e0b16] hover:bg-[#66181E]"
            size="lg"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Joining...
              </>
            ) : (
              <>
                <Radio className="mr-2 h-4 w-4" />
                Join Live Session
              </>
            )}
          </Button>

          {/* Instructions */}
          <div className="text-center">
            <p className="text-xs text-gray-500">
              You will be connected directly to the live session
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}