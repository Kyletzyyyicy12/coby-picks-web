"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { toast } from "@/hooks/use-toast"
import { db } from "@/lib/firebase"
import { collection, query, where, getDocs } from "firebase/firestore"
import { Users, Smartphone, Monitor, QrCode } from "lucide-react"

interface RoomCodeJoinProps {
  trigger?: React.ReactNode
  className?: string
}

export function RoomCodeJoin({ trigger, className }: RoomCodeJoinProps) {
  const [roomCode, setRoomCode] = useState("")
  const [studentName, setStudentName] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const router = useRouter()

  const schoolColors = {
    primary: "#8e0b16",
    secondary: "#66181E",
    accent: "#ffffff"
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

    if (!studentName.trim()) {
      toast({
        title: "Name Required",
        description: "Please enter your name",
        variant: "destructive"
      })
      return
    }

    setIsLoading(true)
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
          description: "No active session found with this room code",
          variant: "destructive"
        })
        return
      }

      const sessionDoc = querySnapshot.docs[0]
      const sessionId = sessionDoc.id

      // Redirect to live viewer with student name
      router.push(`/live/${sessionId}?name=${encodeURIComponent(studentName)}`)
      
      toast({
        title: "Joining Session...",
        description: `Connecting to room ${roomCode}`,
      })
      
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

  const formatRoomCode = (value: string) => {
    // Remove non-alphanumeric characters and convert to uppercase
    const cleaned = value.replace(/[^A-Z0-9]/gi, '').toUpperCase()
    // Limit to 6 characters
    return cleaned.slice(0, 6)
  }

  const handleRoomCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatRoomCode(e.target.value)
    setRoomCode(formatted)
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button 
            className={`bg-[#8e0b16] hover:bg-[#66181E] ${className}`}
            size="lg"
          >
            <Users className="h-5 w-5 mr-2" />
            Join with Room Code
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle style={{ color: schoolColors.primary }}>
            Join Live Session
          </DialogTitle>
          <DialogDescription>
            Enter the room code to join a live wheel session
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="roomCode">Room Code</Label>
            <Input
              id="roomCode"
              placeholder="Enter 6-character code"
              value={roomCode}
              onChange={handleRoomCodeChange}
              className="font-mono text-lg text-center tracking-wider"
              maxLength={6}
            />
            <p className="text-xs text-muted-foreground">
              Ask your teacher for the 6-character room code
            </p>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="studentName">Your Name</Label>
            <Input
              id="studentName"
              placeholder="Enter your name"
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
            />
          </div>
          
          <div className="bg-blue-50 p-3 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <div className="flex items-center gap-1">
                <Monitor className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-700">Web</span>
              </div>
              <div className="flex items-center gap-1">
                <Smartphone className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-700">Mobile App</span>
              </div>
            </div>
            <p className="text-xs text-blue-600">
              This works on both web browsers and the mobile app
            </p>
          </div>
          
          <Button
            onClick={handleJoinRoom}
            disabled={isLoading || !roomCode.trim() || !studentName.trim()}
            className="w-full bg-[#8e0b16] hover:bg-[#66181E]"
            size="lg"
          >
            {isLoading ? "Joining..." : "Join Session"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
