"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { EnhancedRoomManager } from "@/components/live/enhanced-room-manager"
import { EnhancedStudentJoin } from "@/components/live/enhanced-student-join"
import { auth } from "@/lib/firebase"
import { onAuthStateChanged, signInAnonymously } from "firebase/auth"
import { toast } from "@/hooks/use-toast"
import { Toaster } from "@/components/ui/toaster"
import { 
  Users, 
  GraduationCap, 
  Radio, 
  Wifi, 
  Monitor, 
  Smartphone,
  CheckCircle,
  AlertCircle
} from "lucide-react"
import type { User as FirebaseUser } from "firebase/auth"

export default function TestRoomPage() {
  const [user, setUser] = useState<FirebaseUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("teacher")
  const [roomCreated, setRoomCreated] = useState(false)
  const [currentRoomCode, setCurrentRoomCode] = useState("")

  // Sample participants for testing
  const sampleParticipants = [
    { id: "1", name: "Alice Johnson", email: "alice@school.edu" },
    { id: "2", name: "Bob Smith", email: "bob@school.edu" },
    { id: "3", name: "Charlie Brown", email: "charlie@school.edu" },
    { id: "4", name: "Diana Prince", email: "diana@school.edu" },
    { id: "5", name: "Eve Wilson", email: "eve@school.edu" },
    { id: "6", name: "Frank Miller", email: "frank@school.edu" },
    { id: "7", name: "Grace Lee", email: "grace@school.edu" },
    { id: "8", name: "Henry Davis", email: "henry@school.edu" }
  ]

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser)
      } else {
        // Sign in anonymously for testing
        signInAnonymously(auth).then((result) => {
          setUser(result.user)
          toast({
            title: "Signed in for testing",
            description: "You're now signed in anonymously to test room functionality",
          })
        }).catch((error) => {
          console.error("Anonymous sign-in error:", error)
          toast({
            title: "Authentication Error",
            description: "Failed to sign in for testing",
            variant: "destructive"
          })
        })
      }
      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  const handleRoomCreated = (roomId: string, roomCode: string) => {
    setRoomCreated(true)
    setCurrentRoomCode(roomCode)
    setActiveTab("student") // Switch to student tab to show join interface
    toast({
      title: "🎉 Room Created!",
      description: `Room code: ${roomCode}. Now test joining as a student!`,
    })
  }

  const handleRoomClosed = () => {
    setRoomCreated(false)
    setCurrentRoomCode("")
    toast({
      title: "Room Closed",
      description: "The live session has ended",
    })
  }

  const handleJoinSuccess = (sessionId: string, studentName: string) => {
    toast({
      title: "Join Successful!",
      description: `${studentName} is joining the session`,
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#8e0b16] mx-auto"></div>
          <p className="text-muted-foreground">Loading test environment...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-6xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            🎯 Real-Time Room System Test
          </h1>
          <p className="text-gray-600">
            Test the teacher room creation and student joining functionality
          </p>
        </div>

        {/* Status Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <span className="font-medium">Firebase Connected</span>
              </div>
              <p className="text-sm text-gray-600">Real-time database ready</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4 text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Users className="h-5 w-5 text-blue-500" />
                <span className="font-medium">{sampleParticipants.length} Participants</span>
              </div>
              <p className="text-sm text-gray-600">Ready for live session</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4 text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                {roomCreated ? (
                  <>
                    <Radio className="h-5 w-5 text-green-500" />
                    <span className="font-medium">Room Active</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-5 w-5 text-gray-400" />
                    <span className="font-medium">No Active Room</span>
                  </>
                )}
              </div>
              <p className="text-sm text-gray-600">
                {roomCreated ? `Code: ${currentRoomCode}` : "Create a room to start"}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main Testing Interface */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Radio className="h-6 w-6" />
              Live Room Testing Interface
            </CardTitle>
            <CardDescription>
              Test both teacher (room creation) and student (room joining) perspectives
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="teacher" className="flex items-center gap-2">
                  <GraduationCap className="h-4 w-4" />
                  Teacher View
                </TabsTrigger>
                <TabsTrigger value="student" className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Student View
                </TabsTrigger>
              </TabsList>

              <TabsContent value="teacher" className="space-y-4">
                <div className="space-y-4">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <h3 className="font-medium text-blue-900 mb-2">Teacher Instructions:</h3>
                    <ol className="text-sm text-blue-800 space-y-1">
                      <li>1. Click "Create Live Room" to start a session</li>
                      <li>2. Share the generated room code with students</li>
                      <li>3. Monitor live viewers joining in real-time</li>
                      <li>4. Use the room controls to manage the session</li>
                    </ol>
                  </div>

                  {user && (
                    <EnhancedRoomManager
                      user={user}
                      participants={sampleParticipants}
                      onRoomCreated={handleRoomCreated}
                      onRoomClosed={handleRoomClosed}
                    />
                  )}
                </div>
              </TabsContent>

              <TabsContent value="student" className="space-y-4">
                <div className="space-y-4">
                  <div className="bg-green-50 p-4 rounded-lg">
                    <h3 className="font-medium text-green-900 mb-2">Student Instructions:</h3>
                    <ol className="text-sm text-green-800 space-y-1">
                      <li>1. Get the room code from your teacher</li>
                      <li>2. Enter the 6-character code below</li>
                      <li>3. Enter your name to join the session</li>
                      <li>4. Watch the live wheel session in real-time</li>
                    </ol>
                    {currentRoomCode && (
                      <div className="mt-3 p-2 bg-green-100 rounded border">
                        <p className="text-sm font-medium text-green-900">
                          Test Room Code: <span className="font-mono text-lg">{currentRoomCode}</span>
                        </p>
                      </div>
                    )}
                  </div>

                  <EnhancedStudentJoin onJoinSuccess={handleJoinSuccess} />
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Features Overview */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wifi className="h-5 w-5 text-green-500" />
                Real-Time Features
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span>Live room code generation</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span>Real-time student joining</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span>Live viewer count updates</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span>Teacher presence tracking</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span>Instant room validation</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Monitor className="h-5 w-5 text-blue-500" />
                Platform Support
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <Monitor className="h-4 w-4 text-blue-500" />
                <span>Web browsers (Chrome, Firefox, Safari)</span>
              </div>
              <div className="flex items-center gap-2">
                <Smartphone className="h-4 w-4 text-blue-500" />
                <span>Mobile devices (iOS, Android)</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span>Responsive design</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span>Cross-platform compatibility</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span>No app installation required</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="mt-8 text-center">
          <a 
            href="/" 
            className="text-blue-600 hover:text-blue-800 underline"
          >
            ← Back to Home
          </a>
        </div>
      </div>
      <Toaster />
    </div>
  )
}
