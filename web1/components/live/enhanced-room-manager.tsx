"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { toast } from "@/hooks/use-toast"
import { db } from "@/lib/firebase"
import { 
  collection, 
  addDoc, 
  doc, 
  updateDoc, 
  onSnapshot, 
  serverTimestamp, 
  query, 
  where, 
  orderBy,
  deleteDoc
} from "firebase/firestore"
import { 
  Users, 
  Radio, 
  Copy, 
  QrCode, 
  Eye, 
  UserPlus, 
  UserMinus, 
  Wifi, 
  WifiOff,
  Clock,
  Play,
  Square,
  RefreshCw
} from "lucide-react"
import type { User as FirebaseUser } from "firebase/auth"

interface RoomParticipant {
  id: string
  name: string
  email?: string
  joinedAt: Date
  isActive: boolean
  lastSeen: Date
}

interface LiveRoom {
  id: string
  roomCode: string
  title: string
  description: string
  createdBy: string
  createdAt: Date
  isActive: boolean
  isLive: boolean
  currentState: "waiting" | "active" | "spinning" | "ended"
  participants: RoomParticipant[]
  viewers: Array<{ id: string; name: string; joinedAt: Date }>
  settings: {
    allowReactions: boolean
    autoStart: boolean
    maxParticipants: number
  }
}

interface EnhancedRoomManagerProps {
  user: FirebaseUser
  participants: Array<{ id: string; name: string; email?: string }>
  onRoomCreated?: (roomId: string, roomCode: string) => void
  onRoomClosed?: () => void
}

export function EnhancedRoomManager({ 
  user, 
  participants, 
  onRoomCreated, 
  onRoomClosed 
}: EnhancedRoomManagerProps) {
  const [room, setRoom] = useState<LiveRoom | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [viewers, setViewers] = useState<Array<{ id: string; name: string; joinedAt: Date }>>([])
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'connecting'>('disconnected')
  const [roomCode, setRoomCode] = useState<string>("")
  const unsubscribeRef = useRef<(() => void) | null>(null)
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null)

  // Generate a unique 6-character room code with mixed letters and numbers
  const generateRoomCode = (): string => {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    const numbers = '0123456789'
    const allChars = letters + numbers

    let result = ''

    // Generate code with guaranteed mix
    for (let i = 0; i < 6; i++) {
      const char = allChars.charAt(Math.floor(Math.random() * allChars.length))
      result += char
    }

    // Ensure we have at least 2 numbers and 2 letters for better mix
    const numberCount = (result.match(/\d/g) || []).length
    const letterCount = (result.match(/[A-Z]/g) || []).length

    if (numberCount < 2 || letterCount < 2) {
      // Regenerate with better distribution
      const positions = [0, 1, 2, 3, 4, 5]
      result = ''

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
          result += numbers.charAt(Math.floor(Math.random() * numbers.length))
        } else if (letterPositions.includes(i)) {
          result += letters.charAt(Math.floor(Math.random() * letters.length))
        } else {
          result += allChars.charAt(Math.floor(Math.random() * allChars.length))
        }
      }
    }

    return result
  }

  // Create a new live room
  const createRoom = async () => {
    setIsCreating(true)
    setConnectionStatus('connecting')
    
    try {
      const newRoomCode = generateRoomCode()
      // Helper function to deep clean undefined values
      const cleanData = (data: any): any => {
        if (data === null || data === undefined) {
          return null
        }

        if (typeof data === 'object' && !Array.isArray(data)) {
          const cleaned: any = {}
          for (const [key, value] of Object.entries(data)) {
            const cleanedValue = cleanData(value)
            if (cleanedValue !== null && cleanedValue !== undefined) {
              cleaned[key] = cleanedValue
            }
          }
          return Object.keys(cleaned).length > 0 ? cleaned : null
        }

        if (Array.isArray(data)) {
          const cleanedArray = data.map(cleanData).filter(item => item !== null && item !== undefined)
          return cleanedArray.length > 0 ? cleanedArray : null
        }

        return data
      }

      const roomData = {
        roomCode: newRoomCode,
        title: `Live Session - ${new Date().toLocaleString()}`,
        description: "Real-time wheel session",
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        isActive: true,
        isLive: true,
        currentState: "waiting",
        participants: participants.map(p => ({
          ...p,
          joinedAt: new Date(),
          isActive: true,
          lastSeen: new Date()
        })),
        viewers: [],
        settings: {
          allowReactions: true,
          autoStart: false,
          maxParticipants: 100
        },
        teacherPresence: {
          userId: user.uid,
          lastSeen: serverTimestamp(),
          isOnline: true
        }
      }

      // Clean the data to remove any undefined values
      const cleanRoomData = cleanData(roomData)
      console.log("✅ Clean room data:", JSON.stringify(cleanRoomData, null, 2))

      // Validate that there are no undefined values before sending to Firestore
      const validateNoUndefined = (obj: any, path: string = ''): string[] => {
        const errors: string[] = []
        if (obj === null || obj === undefined) return errors

        if (typeof obj === 'object' && !Array.isArray(obj)) {
          for (const [key, value] of Object.entries(obj)) {
            const currentPath = path ? `${path}.${key}` : key
            if (value === undefined) {
              errors.push(`Undefined value at path: ${currentPath}`)
            } else if (value === null) {
              // null is allowed, continue checking nested objects
              errors.push(...validateNoUndefined(value, currentPath))
            } else if (typeof value === 'object') {
              errors.push(...validateNoUndefined(value, currentPath))
            }
          }
        } else if (Array.isArray(obj)) {
          obj.forEach((item, index) => {
            const currentPath = `${path}[${index}]`
            if (item === undefined) {
              errors.push(`Undefined value at path: ${currentPath}`)
            } else if (item !== null && typeof item === 'object') {
              errors.push(...validateNoUndefined(item, currentPath))
            }
          })
        }
        return errors
      }

      const validationErrors = validateNoUndefined(cleanRoomData)
      if (validationErrors.length > 0) {
        console.error("❌ Validation errors found:", validationErrors)
        throw new Error(`Invalid data structure: ${validationErrors.join(', ')}`)
      }

      console.log("✅ Validation passed - no undefined values found")

      const docRef = await addDoc(collection(db, "liveDrawSessions"), cleanRoomData)
      setRoomCode(newRoomCode)
      
      // Start real-time listeners
      startRoomListeners(docRef.id)
      
      // Start teacher heartbeat
      startTeacherHeartbeat(docRef.id)
      
      setConnectionStatus('connected')
      
      toast({
        title: "🎉 Room Created Successfully!",
        description: `Room code: ${newRoomCode}. Students can now join!`,
      })

      onRoomCreated?.(docRef.id, newRoomCode)
      
    } catch (error: any) {
      console.error("Error creating room:", error)
      setConnectionStatus('disconnected')
      toast({
        title: "Error Creating Room",
        description: error.message,
        variant: "destructive"
      })
    } finally {
      setIsCreating(false)
    }
  }

  // Start real-time listeners for the room
  const startRoomListeners = (roomId: string) => {
    // Listen to room updates
    const roomUnsubscribe = onSnapshot(
      doc(db, "liveDrawSessions", roomId),
      (doc) => {
        if (doc.exists()) {
          const data = doc.data()
          setRoom({
            id: doc.id,
            ...data,
            createdAt: data.createdAt?.toDate() || new Date(),
            participants: data.participants || [],
            viewers: data.viewers || []
          } as LiveRoom)
        }
      },
      (error) => {
        console.error("Room listener error:", error)
        setConnectionStatus('disconnected')
      }
    )

    // Listen to viewers subcollection
    const viewersUnsubscribe = onSnapshot(
      collection(db, "liveDrawSessions", roomId, "viewers"),
      (snapshot) => {
        const viewerList = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          joinedAt: doc.data().joinedAt?.toDate() || new Date()
        })) as Array<{ id: string; name: string; joinedAt: Date }>
        
        setViewers(viewerList)
        
        // Update viewer count in main document
        updateDoc(doc(db, "liveDrawSessions", roomId), {
          viewerCount: viewerList.length,
          lastUpdated: serverTimestamp()
        }).catch(console.error)
      },
      (error) => {
        console.error("Viewers listener error:", error)
      }
    )

    unsubscribeRef.current = () => {
      roomUnsubscribe()
      viewersUnsubscribe()
    }
  }

  // Start teacher heartbeat to show online status
  const startTeacherHeartbeat = (roomId: string) => {
    // Clear any existing heartbeat
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current)
    }

    const updatePresence = async () => {
      try {
        await updateDoc(doc(db, "liveDrawSessions", roomId), {
          "teacherPresence.lastSeen": serverTimestamp(),
          "teacherPresence.isOnline": true,
          lastUpdated: serverTimestamp()
        })
      } catch (error) {
        console.error("Heartbeat error:", error)
        setConnectionStatus('disconnected')
      }
    }

    // Update immediately
    updatePresence()

    // Update every 15 seconds for better reliability
    heartbeatRef.current = setInterval(updatePresence, 15000)
  }

  // Close the room
  const closeRoom = async () => {
    if (!room) return

    try {
      await updateDoc(doc(db, "liveDrawSessions", room.id), {
        isActive: false,
        isLive: false,
        currentState: "ended",
        closedAt: serverTimestamp(),
        "teacherPresence.isOnline": false
      })

      // Clean up listeners and heartbeat
      if (unsubscribeRef.current) {
        unsubscribeRef.current()
      }
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current)
      }

      setRoom(null)
      setViewers([])
      setConnectionStatus('disconnected')
      
      toast({
        title: "Room Closed",
        description: "The live session has been ended",
      })

      onRoomClosed?.()
      
    } catch (error: any) {
      toast({
        title: "Error Closing Room",
        description: error.message,
        variant: "destructive"
      })
    }
  }

  // Copy room code to clipboard
  const copyRoomCode = async () => {
    if (!roomCode) return
    
    try {
      await navigator.clipboard.writeText(roomCode)
      toast({
        title: "Copied!",
        description: "Room code copied to clipboard",
      })
    } catch (error) {
      toast({
        title: "Copy Failed",
        description: "Could not copy room code",
        variant: "destructive"
      })
    }
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current()
      }
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current)
      }
    }
  }, [])

  const getConnectionIcon = () => {
    switch (connectionStatus) {
      case 'connected':
        return <Wifi className="h-4 w-4 text-green-500" />
      case 'connecting':
        return <RefreshCw className="h-4 w-4 text-yellow-500 animate-spin" />
      default:
        return <WifiOff className="h-4 w-4 text-red-500" />
    }
  }

  const getConnectionBadge = () => {
    switch (connectionStatus) {
      case 'connected':
        return <Badge variant="default" className="bg-green-500">Live</Badge>
      case 'connecting':
        return <Badge variant="secondary">Connecting...</Badge>
      default:
        return <Badge variant="destructive">Offline</Badge>
    }
  }

  return (
    <div className="space-y-4">
      {/* Room Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Radio className="h-5 w-5" />
            Live Room Manager
            {getConnectionIcon()}
          </CardTitle>
          <CardDescription>
            Create and manage real-time sessions for students to join
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!room ? (
            // Create Room Section
            <div className="space-y-4">
              <Alert>
                <Users className="h-4 w-4" />
                <AlertTitle>Ready to Go Live</AlertTitle>
                <AlertDescription>
                  Create a room with {participants.length} participants. Students can join using the room code.
                </AlertDescription>
              </Alert>

              <Button
                onClick={createRoom}
                disabled={isCreating || participants.length === 0}
                className="w-full"
                size="lg"
              >
                {isCreating ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Creating Room...
                  </>
                ) : (
                  <>
                    <Radio className="mr-2 h-4 w-4" />
                    Create Live Room
                  </>
                )}
              </Button>
            </div>
          ) : (
            // Active Room Section
            <div className="space-y-4">
              {/* Room Code Display */}
              <div className="p-4 bg-gradient-to-r from-red-50 to-pink-50 border-2 border-red-200 rounded-xl">
                <div className="text-center">
                  <Label className="text-sm font-medium text-red-700">Room Code</Label>
                  <div className="flex items-center justify-center gap-2 mt-2">
                    <div className="text-3xl font-mono font-bold text-red-700 tracking-wider">
                      {roomCode}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={copyRoomCode}
                      className="border-red-200 text-red-700 hover:bg-red-100"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-red-600 mt-2">
                    Students use this code to join your live session
                  </p>
                </div>
              </div>

              {/* Connection Status */}
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2">
                  {getConnectionIcon()}
                  <span className="font-medium">Connection Status</span>
                </div>
                {getConnectionBadge()}
              </div>

              {/* Live Stats */}
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="p-3 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">{viewers.length}</div>
                  <div className="text-xs text-blue-600">Live Viewers</div>
                </div>
                <div className="p-3 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">{participants.length}</div>
                  <div className="text-xs text-green-600">Participants</div>
                </div>
                <div className="p-3 bg-purple-50 rounded-lg">
                  <div className="text-2xl font-bold text-purple-600">
                    {room.currentState === 'waiting' ? 'Ready' : room.currentState}
                  </div>
                  <div className="text-xs text-purple-600">Status</div>
                </div>
              </div>

              {/* Active Viewers */}
              {viewers.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Live Viewers ({viewers.length})</Label>
                  <div className="max-h-32 overflow-y-auto space-y-1">
                    {viewers.map((viewer) => (
                      <div key={viewer.id} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                        <span className="text-sm font-medium">{viewer.name || 'Anonymous User'}</span>
                        <span className="text-xs text-gray-500 ml-auto">
                          {viewer.joinedAt.toLocaleTimeString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Room Controls */}
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  onClick={closeRoom}
                  className="flex-1"
                >
                  <Square className="mr-2 h-4 w-4" />
                  End Session
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
