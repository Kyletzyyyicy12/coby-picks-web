"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { WorkingLiveSessionManager } from "@/components/live/working-live-session-manager"
import { WorkingParticipantJoin } from "@/components/live/working-participant-join"
import { Users, Radio, Eye } from "lucide-react"
import type { User as FirebaseUser } from "firebase/auth"

// Mock user for testing
const mockUser: FirebaseUser = {
  uid: "test-organizer-123",
  email: "organizer@test.com",
  displayName: "Test Organizer",
  emailVerified: true,
  isAnonymous: false,
  metadata: {
    creationTime: new Date().toISOString(),
    lastSignInTime: new Date().toISOString()
  },
  providerData: [],
  refreshToken: "",
  tenantId: null,
  delete: async () => {},
  getIdToken: async () => "mock-token",
  getIdTokenResult: async () => ({
    token: "mock-token",
    expirationTime: new Date(Date.now() + 3600000).toISOString(),
    authTime: new Date().toISOString(),
    issuedAtTime: new Date().toISOString(),
    signInProvider: "password",
    signInSecondFactor: null,
    claims: {}
  }),
  reload: async () => {},
  toJSON: () => ({}),
  phoneNumber: null,
  photoURL: null,
  providerId: "firebase"
}

export default function TestWorkingLivePage() {
  const [activeView, setActiveView] = useState<'organizer' | 'participant' | 'overview'>('overview')

  // Sample participants for testing
  const testParticipants = [
    { id: "1", name: "Alice Johnson", email: "alice@example.com" },
    { id: "2", name: "Bob Smith", email: "bob@example.com" },
    { id: "3", name: "Carol Davis", email: "carol@example.com" },
    { id: "4", name: "David Wilson", email: "david@example.com" },
    { id: "5", name: "Emma Brown", email: "emma@example.com" }
  ]

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="text-center space-y-4">
        <h1 className="text-3xl font-bold text-[#8e0b16]">Working Live Session Test</h1>
        <p className="text-lg text-muted-foreground">
          Test the fixed live session functionality with real-time participant joining
        </p>
      </div>

      {/* View Toggle */}
      <div className="flex justify-center gap-4">
        <Button
          variant={activeView === 'overview' ? 'default' : 'outline'}
          onClick={() => setActiveView('overview')}
          className="bg-[#8e0b16] hover:bg-[#66181E]"
        >
          <Eye className="h-4 w-4 mr-2" />
          Overview
        </Button>
        <Button
          variant={activeView === 'organizer' ? 'default' : 'outline'}
          onClick={() => setActiveView('organizer')}
          className="bg-[#8e0b16] hover:bg-[#66181E]"
        >
          <Radio className="h-4 w-4 mr-2" />
          Organizer View
        </Button>
        <Button
          variant={activeView === 'participant' ? 'default' : 'outline'}
          onClick={() => setActiveView('participant')}
          className="bg-[#8e0b16] hover:bg-[#66181E]"
        >
          <Users className="h-4 w-4 mr-2" />
          Participant View
        </Button>
      </div>

      {/* Overview */}
      {activeView === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-[#8e0b16]">What's Fixed</CardTitle>
              <CardDescription>Issues resolved in the live session system</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-sm">Real-time participant joining</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-sm">Proper room code validation</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-sm">Enhanced session creation</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-sm">Teacher presence tracking</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-sm">Cross-platform viewer support</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-[#8e0b16]">How to Test</CardTitle>
              <CardDescription>Steps to verify the functionality</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-sm space-y-2">
                <p><strong>1.</strong> Switch to "Organizer View" to create a session</p>
                <p><strong>2.</strong> Copy the generated room code</p>
                <p><strong>3.</strong> Switch to "Participant View" to join</p>
                <p><strong>4.</strong> Enter the room code and validate</p>
                <p><strong>5.</strong> Join as a participant and see real-time updates</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Organizer View */}
      {activeView === 'organizer' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-[#8e0b16]">Organizer: Create Live Session</CardTitle>
              <CardDescription>
                This view simulates the organizer creating and managing a live session
              </CardDescription>
            </CardHeader>
            <CardContent>
              <WorkingLiveSessionManager
                user={mockUser}
                participants={testParticipants}
                onAddParticipant={(participant) => {
                  console.log("New participant added:", participant)
                }}
                onRealUsersChange={(users) => {
                  console.log("Real users updated:", users)
                }}
              />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Participant View */}
      {activeView === 'participant' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-[#8e0b16]">Participant: Join Live Session</CardTitle>
              <CardDescription>
                This view simulates a participant joining a live session using the room code
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <WorkingParticipantJoin
                onJoinSuccess={(sessionId, roomCode, participantName) => {
                  console.log("Participant joined:", { sessionId, roomCode, participantName })
                }}
              />

              <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="font-medium text-blue-900 mb-2">Testing Instructions</h4>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>• Create a session in the Organizer View first</li>
                  <li>• Copy the room code from the organizer</li>
                  <li>• Enter the room code above and click validate</li>
                  <li>• Enter your name and click "Join Live Session"</li>
                  <li>• You should be redirected to the live viewer</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}