"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { toast } from "@/hooks/use-toast"
import { db } from "@/lib/firebase"
import { collection, addDoc, onSnapshot, setDoc, doc, updateDoc, Timestamp } from "firebase/firestore"

export default function TestLivePage() {
  const [sessionId, setSessionId] = useState("")
  const [studentName, setStudentName] = useState("")
  const [isConnected, setIsConnected] = useState(false)
  const [viewers, setViewers] = useState<any[]>([])
  const [sessionData, setSessionData] = useState<any>(null)

  // Create a test session with properly mixed letters and numbers
  const createTestSession = async () => {
    try {
      const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
      const numbers = '0123456789'
      const allChars = letters + numbers

      let roomCode = ''

      // Generate code with guaranteed mix
      for (let i = 0; i < 6; i++) {
        const char = allChars.charAt(Math.floor(Math.random() * allChars.length))
        roomCode += char
      }

      // Ensure we have at least 2 numbers and 2 letters for better mix
      const numberCount = (roomCode.match(/\d/g) || []).length
      const letterCount = (roomCode.match(/[A-Z]/g) || []).length

      if (numberCount < 2 || letterCount < 2) {
        // Regenerate with better distribution
        const positions = [0, 1, 2, 3, 4, 5]
        roomCode = ''

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
            roomCode += numbers.charAt(Math.floor(Math.random() * numbers.length))
          } else if (letterPositions.includes(i)) {
            roomCode += letters.charAt(Math.floor(Math.random() * letters.length))
          } else {
            roomCode += allChars.charAt(Math.floor(Math.random() * allChars.length))
          }
        }
      }
      const sessionData = {
        title: "Test Live Session",
        roomCode: roomCode,
        isActive: true,
        isLive: true,
        currentState: "waiting",
        participants: [
          { id: "1", name: "Test Student 1" },
          { id: "2", name: "Test Student 2" }
        ],
        teacherPresence: {
          isOnline: true,
          lastSeen: Timestamp.fromDate(new Date()),
          userId: "test-teacher",
          userName: "Test Teacher"
        },
        viewerCount: 0,
        activeViewers: [],
        createdAt: Timestamp.fromDate(new Date()),
        lastActivity: Timestamp.fromDate(new Date())
      }

      console.log('🔍 DEBUG: Session data before addDoc:', JSON.stringify(sessionData, null, 2));

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
      setSessionId(docRef.id)
      
      toast({
        title: "Test Session Created",
        description: `Session ID: ${docRef.id}, Room Code: ${roomCode}`
      })

      // Start listening to the session
      startListening(docRef.id)
    } catch (error) {
      console.error("Error creating test session:", error)
      toast({
        title: "Error",
        description: "Failed to create test session",
        variant: "destructive"
      })
    }
  }

  // Join as a student
  const joinAsStudent = async () => {
    if (!sessionId || !studentName) return

    try {
      const viewerId = `viewer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      
      await setDoc(doc(db, "liveDrawSessions", sessionId, "viewers", viewerId), {
        name: studentName,
        joinedAt: Timestamp.fromDate(new Date()),
        lastSeen: Timestamp.fromDate(new Date()),
        isActive: true,
        platform: "web-test",
        connectionId: viewerId
      })

      setIsConnected(true)
      
      // Start heartbeat
      const heartbeat = setInterval(async () => {
        try {
          await updateDoc(doc(db, "liveDrawSessions", sessionId, "viewers", viewerId), {
            lastSeen: Timestamp.fromDate(new Date()),
            isActive: true
          })
        } catch (error) {
          console.error("Heartbeat error:", error)
          clearInterval(heartbeat)
        }
      }, 10000) // Every 10 seconds

      toast({
        title: "Connected",
        description: `Joined as ${studentName}`
      })
    } catch (error) {
      console.error("Error joining session:", error)
      toast({
        title: "Error",
        description: "Failed to join session",
        variant: "destructive"
      })
    }
  }

  // Start listening to session updates
  const startListening = (sessionId: string) => {
    // Listen to main session
    const sessionUnsubscribe = onSnapshot(
      doc(db, "liveDrawSessions", sessionId),
      (doc) => {
        if (doc.exists()) {
          setSessionData(doc.data())
          console.log("✅ Session data updated:", doc.data())
        } else {
          console.log("❌ Session not found")
        }
      },
      (error) => {
        console.error("❌ Session listener error:", error)
      }
    )

    // Listen to viewers
    const viewersUnsubscribe = onSnapshot(
      collection(db, "liveDrawSessions", sessionId, "viewers"),
      (snapshot) => {
        const viewerList = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          joinedAt: doc.data().joinedAt?.toDate(),
          lastSeen: doc.data().lastSeen?.toDate()
        }))
        setViewers(viewerList)
        console.log("✅ Viewers updated:", viewerList.length, "viewers")

        // Update viewer count in session
        updateDoc(doc(db, "liveDrawSessions", sessionId), {
          viewerCount: viewerList.length,
          lastUpdated: Timestamp.fromDate(new Date())
        }).catch(console.error)
      },
      (error) => {
        console.error("❌ Viewers listener error:", error)
      }
    )

    // Listen to reactions
    const reactionsUnsubscribe = onSnapshot(
      collection(db, "liveDrawSessions", sessionId, "reactions"),
      (snapshot) => {
        console.log("✅ Reactions updated:", snapshot.size, "reactions")
      }
    )

    // Listen to comments
    const commentsUnsubscribe = onSnapshot(
      collection(db, "liveDrawSessions", sessionId, "comments"),
      (snapshot) => {
        console.log("✅ Comments updated:", snapshot.size, "comments")
      }
    )
  }

  // Test functions
  const testReaction = async () => {
    if (!sessionId) return
    try {
      await addDoc(collection(db, "liveDrawSessions", sessionId, "reactions"), {
        emoji: "🚀",
        userName: studentName || "Test User",
        timestamp: Timestamp.fromDate(new Date())
      })
      toast({ title: "Reaction sent!", description: "🚀" })
    } catch (error) {
      console.error("Error sending reaction:", error)
      toast({ title: "Error", description: "Failed to send reaction", variant: "destructive" })
    }
  }

  const testComment = async () => {
    if (!sessionId) return
    try {
      await addDoc(collection(db, "liveDrawSessions", sessionId, "comments"), {
        text: "Test comment from automated test",
        userName: studentName || "Test User",
        timestamp: Timestamp.fromDate(new Date())
      })
      toast({ title: "Comment sent!", description: "Test comment posted" })
    } catch (error) {
      console.error("Error sending comment:", error)
      toast({ title: "Error", description: "Failed to send comment", variant: "destructive" })
    }
  }

  const testWheelSpin = async () => {
    if (!sessionId) return
    try {
      await updateDoc(doc(db, "liveDrawSessions", sessionId), {
        currentState: "spinning",
        lastUpdated: Timestamp.fromDate(new Date())
      })
      toast({ title: "Wheel spinning!", description: "Started spinning animation" })

      // Simulate winner selection after 3.5 seconds to match animation timing
      setTimeout(async () => {
        const availableParticipants = sessionData?.participants || []
        const numWinners = sessionData?.settings?.numberOfWinners || 1
        const winners = []

        for (let i = 0; i < numWinners && availableParticipants.length > 0; i++) {
          const randomIndex = Math.floor(Math.random() * availableParticipants.length)
          winners.push(availableParticipants[randomIndex])
        }

        await updateDoc(doc(db, "liveDrawSessions", sessionId), {
          currentState: "completed",
          winners: winners,
          lastUpdated: Timestamp.fromDate(new Date())
        })
        toast({ title: "", description: `${winners.length} winner(s) chosen` })
      }, 3500)
    } catch (error) {
      console.error("Error starting wheel spin:", error)
      toast({ title: "Error", description: "Failed to start wheel", variant: "destructive" })
    }
  }

  // Automated test runner
  const runAutomatedTest = async () => {
    if (!sessionId) {
      toast({ title: "No session", description: "Create a session first", variant: "destructive" })
      return
    }

    toast({ title: "Starting automated test", description: "Testing all functions..." })

    // Test 1: Send multiple reactions
    setTimeout(() => testReaction(), 1000)
    setTimeout(() => testReaction(), 2000)
    setTimeout(() => testReaction(), 3000)

    // Test 2: Send comment
    setTimeout(() => testComment(), 4000)

    // Test 3: Start wheel spin
    setTimeout(() => testWheelSpin(), 5000)

    toast({ title: "Test completed", description: "All functions tested automatically" })
  }

  return (
    <div className="container mx-auto p-4 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>🧪 Live Session Test Page - Enhanced</CardTitle>
          <p className="text-sm text-muted-foreground">
            Comprehensive testing of all live session functionality
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Teacher Side */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">👨‍🏫 Teacher Side</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button onClick={createTestSession} className="w-full">
                  Create Test Session
                </Button>
                
                {sessionId && (
                  <div className="space-y-2">
                    <p className="text-sm"><strong>Session ID:</strong> {sessionId}</p>
                    <p className="text-sm"><strong>Room Code:</strong> {sessionData?.roomCode}</p>
                    <p className="text-sm"><strong>Active:</strong> {sessionData?.isActive ? "Yes" : "No"}</p>
                    <p className="text-sm"><strong>Teacher Online:</strong> {sessionData?.teacherPresence?.isOnline ? "Yes" : "No"}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Student Side */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">👨‍🎓 Student Side</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Input
                  placeholder="Enter your name"
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                />
                <Button 
                  onClick={joinAsStudent} 
                  disabled={!sessionId || !studentName || isConnected}
                  className="w-full"
                >
                  {isConnected ? "Connected" : "Join Session"}
                </Button>
                
                {isConnected && (
                  <Badge variant="outline" className="w-full justify-center">
                    ✅ Connected as {studentName}
                  </Badge>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Viewers List */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">👥 Live Viewers ({viewers.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {viewers.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">No viewers connected</p>
              ) : (
                <div className="space-y-2">
                  {viewers.map((viewer) => (
                    <div key={viewer.id} className="flex items-center justify-between p-2 border rounded">
                      <div>
                        <span className="font-medium">{viewer.name || 'Anonymous User'}</span>
                        <span className="text-sm text-muted-foreground ml-2">({viewer.platform})</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {viewer.lastSeen ? new Date(viewer.lastSeen).toLocaleTimeString() : "Unknown"}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Test Functions */}
          {sessionId && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">🧪 Test Functions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2 flex-wrap">
                  <Button onClick={testReaction} size="sm" variant="outline">
                    Send Reaction 🚀
                  </Button>
                  <Button onClick={testComment} size="sm" variant="outline">
                    Send Comment 💬
                  </Button>
                  <Button onClick={testWheelSpin} size="sm" variant="outline">
                    Test Wheel Spin 🎯
                  </Button>
                  <Button onClick={runAutomatedTest} size="sm" variant="default" className="bg-green-600 hover:bg-green-700">
                    Run Automated Test 🤖
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Debug Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">🔍 Debug Info</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="text-xs bg-gray-100 p-2 rounded overflow-auto max-h-60">
                {JSON.stringify({
                  sessionData,
                  viewers,
                  sessionId,
                  connected: isConnected,
                  connectionStatus: sessionData?.teacherPresence?.isOnline ? 'Teacher Online' : 'Teacher Offline'
                }, null, 2)}
              </pre>
            </CardContent>
          </Card>

          {/* Status Indicators */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">📊 System Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span>Session Active:</span>
                  <Badge variant={sessionData?.isActive ? "default" : "destructive"}>
                    {sessionData?.isActive ? "✅" : "❌"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Live Status:</span>
                  <Badge variant={sessionData?.isLive ? "default" : "secondary"}>
                    {sessionData?.isLive ? "🔴 LIVE" : "⏸️ PAUSED"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Teacher Online:</span>
                  <Badge variant={sessionData?.teacherPresence?.isOnline ? "default" : "destructive"}>
                    {sessionData?.teacherPresence?.isOnline ? "✅" : "❌"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Connected Viewers:</span>
                  <Badge variant="outline">{viewers.length}</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </CardContent>
      </Card>
    </div>
  )
}
