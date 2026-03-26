"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { LiveRoomOrganizer } from "@/components/organizer/live-room-organizer"
import { EnhancedParticipantJoin } from "@/components/live/enhanced-participant-join"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Info, Users, Crown, Key, ArrowRight } from "lucide-react"
import type { User as FirebaseUser } from "firebase/auth"

// Mock user for demo
const mockUser: FirebaseUser = {
  uid: "demo-organizer-123",
  email: "organizer@demo.com",
  displayName: "Demo Organizer",
  phoneNumber: null,
  photoURL: null,
  emailVerified: true,
  isAnonymous: false,
  metadata: {} as any,
  providerData: [],
  refreshToken: "",
  tenantId: null,
  providerId: "demo",
  delete: async () => {},
  getIdToken: async () => "demo-token",
  getIdTokenResult: async () => ({} as any),
  reload: async () => {},
  toJSON: () => ({}),
}

export default function LiveDemoPage() {
  const [participants, setParticipants] = useState<Array<{
    id: string;
    name: string;
    email: string;
  }>>([
    { id: "1", name: "Alice Johnson", email: "alice@example.com" },
    { id: "2", name: "Bob Smith", email: "bob@example.com" },
    { id: "3", name: "Carol Williams", email: "carol@example.com" },
    { id: "4", name: "David Brown", email: "david@example.com" },
    { id: "5", name: "Emma Davis", email: "emma@example.com" },
  ])
  const [newParticipant, setNewParticipant] = useState({ name: "", email: "" })

  const [activeTab, setActiveTab] = useState("organizer")

  const addParticipant = () => {
    if (!newParticipant.name.trim()) return

    const participant = {
      id: Date.now().toString(),
      name: newParticipant.name,
      email: newParticipant.email.trim() || ""
    }

    setParticipants([...participants, participant])
    setNewParticipant({ name: "", email: "" })
  }

  const removeParticipant = (id: string) => {
    setParticipants(participants.filter(p => p.id !== id))
  }

  const handleSessionCreated = (sessionId: string, roomCode: string) => {
    console.log("Session created:", { sessionId, roomCode })
    // You could redirect to the session or show it in a new tab
    // window.open(`/live/${sessionId}`, '_blank')
  }

  const handleSessionEnded = () => {
    console.log("Session ended")
  }

  const handleJoinSuccess = (sessionId: string, roomCode: string, participantName: string) => {
    console.log("Join success:", { sessionId, roomCode, participantName })
    // You could redirect to the session
    // window.location.href = `/live/${sessionId}?name=${encodeURIComponent(participantName)}`
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <Crown className="h-8 w-8 text-yellow-500" />
              Live Session Demo
            </CardTitle>
            <CardDescription>
              Experience the new enhanced live session system with real-time interactions
            </CardDescription>
          </CardHeader>
        </Card>

        {/* How It Works */}
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>How the New Live System Works</AlertTitle>
          <AlertDescription>
            <div className="space-y-2 mt-2">
              <p><strong>Step 1:</strong> Organizer creates a session with participants (left tab)</p>
              <p><strong>Step 2:</strong> Organizer gets a unique 6-character room code</p>
              <p><strong>Step 3:</strong> Participants join using the room code (right tab)</p>
              <p><strong>Step 4:</strong> Everyone can see live wheel spinning, react, and comment</p>
            </div>
          </AlertDescription>
        </Alert>

        {/* Features List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              New Features
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="flex items-center gap-2">
                <Badge variant="default">✨</Badge>
                <span className="text-sm">Real-time wheel spinning</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="default">💬</Badge>
                <span className="text-sm">Live comments & reactions</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="default">🔊</Badge>
                <span className="text-sm">Audio notifications</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="default">🎯</Badge>
                <span className="text-sm">Room code validation</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="default">📱</Badge>
                <span className="text-sm">Cross-platform support</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="default">🎉</Badge>
                <span className="text-sm">Confetti celebrations</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Main Demo Interface */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="organizer" className="flex items-center gap-2">
              <Crown className="h-4 w-4" />
              Organizer View
            </TabsTrigger>
            <TabsTrigger value="participant" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Participant View
            </TabsTrigger>
          </TabsList>

          <TabsContent value="organizer" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Participants Management */}
              <Card className="lg:col-span-1">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Manage Participants
                  </CardTitle>
                  <CardDescription>
                    Add participants for the live session
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Add Participant Form */}
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="name">Name</Label>
                      <Input
                        id="name"
                        placeholder="Participant name"
                        value={newParticipant.name}
                        onChange={(e) => setNewParticipant(prev => ({ ...prev, name: e.target.value }))}
                        onKeyPress={(e) => e.key === "Enter" && addParticipant()}
                      />
                    </div>
                    <div>
                      <Label htmlFor="email">Email (Optional)</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="participant@example.com"
                        value={newParticipant.email}
                        onChange={(e) => setNewParticipant(prev => ({ ...prev, email: e.target.value }))}
                        onKeyPress={(e) => e.key === "Enter" && addParticipant()}
                      />
                    </div>
                    <Button onClick={addParticipant} disabled={!newParticipant.name.trim()}>
                      Add Participant
                    </Button>
                  </div>

                  {/* Participants List */}
                  <div className="space-y-2">
                    <Label>Current Participants ({participants.length})</Label>
                    <div className="max-h-48 overflow-y-auto space-y-1">
                      {participants.map((participant) => (
                        <div key={participant.id} className="flex items-center justify-between p-2 bg-white rounded border">
                          <div>
                            <span className="font-medium text-sm">{participant.name}</span>
                            {participant.email && (
                              <div className="text-xs text-gray-500">{participant.email}</div>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeParticipant(participant.id)}
                            className="text-red-500 hover:text-red-700"
                          >
                            ✕
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Organizer Interface */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Crown className="h-5 w-5 text-yellow-500" />
                    Live Session Organizer
                  </CardTitle>
                  <CardDescription>
                    Create and manage your live session
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <LiveRoomOrganizer
                    user={mockUser}
                    participants={participants}
                    onSessionCreated={handleSessionCreated}
                    onSessionEnded={handleSessionEnded}
                  />
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="participant" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Key className="h-5 w-5" />
                  Join Live Session
                </CardTitle>
                <CardDescription>
                  Enter the room code provided by the organizer to join the live session
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="max-w-md mx-auto">
                  <EnhancedParticipantJoin
                    onJoinSuccess={handleJoinSuccess}
                  />
                </div>

                <Alert className="mt-6">
                  <Info className="h-4 w-4" />
                  <AlertTitle>Demo Instructions</AlertTitle>
                  <AlertDescription>
                    <div className="space-y-2 mt-2">
                      <p>1. Go to the "Organizer View" tab and create a session</p>
                      <p>2. Copy the room code that appears</p>
                      <p>3. Come back here and enter the room code</p>
                      <p>4. Enter your name and join the session</p>
                      <p>5. Try the live reactions and comments!</p>
                    </div>
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Instructions */}
        <Card>
          <CardHeader>
            <CardTitle>Implementation Guide</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold mb-2">For Organizers:</h4>
                <pre className="text-sm bg-gray-100 p-3 rounded">
{`import { LiveRoomOrganizer } from '@/components/organizer/live-room-organizer'

<LiveRoomOrganizer
  user={currentUser}
  participants={participantsList}
  onSessionCreated={(sessionId, roomCode) => {
    // Share roomCode with participants
    console.log('Room code:', roomCode)
  }}
  onSessionEnded={() => {
    // Handle session cleanup
  }}
/>`}
                </pre>
              </div>

              <div>
                <h4 className="font-semibold mb-2">For Participants:</h4>
                <pre className="text-sm bg-gray-100 p-3 rounded">
{`import { EnhancedParticipantJoin } from '@/components/live/enhanced-participant-join'

<EnhancedParticipantJoin
  onJoinSuccess={(sessionId, roomCode, participantName) => {
    // Redirect to live session
    router.push(\`/live/\${sessionId}?name=\${encodeURIComponent(participantName)}\`)
  }}
/>`}
                </pre>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}