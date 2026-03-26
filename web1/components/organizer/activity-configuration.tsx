"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { toast } from "@/hooks/use-toast"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { 
  Users, 
  RotateCcw, 
  Globe, 
  MessageCircle, 
  Sparkles, 
  Volume2, 
  Radio,
  RefreshCw,
  FileDown,
  FileUp,
  X,
  Copy,
  QrCode,
  Target,
  UserPlus,
  Share2,
  CheckSquare,
  Square
} from "lucide-react"
import { useEffect } from "react"
import { db } from "@/lib/firebase"
import { collection, addDoc, serverTimestamp, query, where, getDocs } from "firebase/firestore"
import { useRouter } from "next/navigation"
import type { User as FirebaseUser } from "firebase/auth"
import type { PickerWheelType } from "@/lib/picker-wheel-types"
import { getPickerWheelById, PICKER_WHEEL_TYPES, PICKER_CATEGORIES } from "@/lib/picker-wheel-types"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface ActivityConfigurationProps {
   user?: FirebaseUser | null
   onCancel?: () => void
   userName?: string
   autoEnableLiveSession?: boolean // New prop to automatically enable live sessions
 }

export function ActivityConfiguration({ user, onCancel, userName = "Organizer", autoEnableLiveSession = false }: ActivityConfigurationProps) {
  const router = useRouter()
  const [isCreating, setIsCreating] = useState(false)
  const [selectedWheelType] = useState<PickerWheelType | null>(
    getPickerWheelById("yes-no-picker") || null // Default to yes-no-picker for simplicity
  )

  // Generate a unique room code with guaranteed mix of letters and numbers
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
      const numberPositions: number[] = []
      const letterPositions: number[] = []

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

  // Activity Options State
  const [maxParticipants, setMaxParticipants] = useState(50)
  const [allowReactions, setAllowReactions] = useState(true)
  const [confettiEffect, setConfettiEffect] = useState(true)
  const [soundEffects, setSoundEffects] = useState(true)
  const [liveSession, setLiveSession] = useState(autoEnableLiveSession)
  const [isLiveSessionLocked, setIsLiveSessionLocked] = useState(autoEnableLiveSession)
  const [roomCode, setRoomCode] = useState("")
  const [allowDataSync, setAllowDataSync] = useState(false)
  const [collaborators, setCollaborators] = useState("teacher2@example.com, coord@example.com")
  const [defaultPermission, setDefaultPermission] = useState<'full' | 'view'>('full')

  // Generate room code when live session is enabled and lock the toggle
  useEffect(() => {
    if (liveSession && !roomCode) {
      setRoomCode(generateRoomCode())
      // Lock the live session toggle once enabled to prevent accidental disabling
      setIsLiveSessionLocked(true)
    } else if (!liveSession) {
      setRoomCode("")
    }
  }, [liveSession, roomCode, generateRoomCode])

  const handleCreateWheelActivity = async () => {
    // Prevent multiple simultaneous calls
    if (isCreating) return

    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please log in to create activities.",
        variant: "destructive"
      })
      return
    }

    // Ensure we have a wheel type (should always be true with our default)
    if (!selectedWheelType) {
      toast({
        title: "Wheel Type Required",
        description: "Please select a wheel type before creating your activity.",
        variant: "destructive"
      })
      return
    }

    const wheelTypeToUse = selectedWheelType
    setIsCreating(true)

    let sessionId: string | null = null

    try {
      // Step 1: Parse and validate collaborator emails (basic validation only)
      const rawEmails = collaborators
        .split(',')
        .map(email => email.trim())
        .filter(email => {
          // Basic email validation only - skip Firebase validation for speed
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
          return email && emailRegex.test(email) && email !== user.email
        })

      // Step 2: Create session data (synchronous preparation)
      const sessionData = {
        title: `${wheelTypeToUse.title} Activity for ${userName}`,
        description: `${wheelTypeToUse.description} - Created on ${new Date().toLocaleDateString()}`,
        wheelType: wheelTypeToUse.id,
        wheelTitle: wheelTypeToUse.title,
        category: wheelTypeToUse.category,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        lastUsed: serverTimestamp(),
        isActive: true,
        isLive: true,
        currentState: "waiting",

        // Activity Configuration
        maxParticipants,
        allowReactions,
        confettiEffect,
        soundEffects,
        liveSession,
        allowDataSync,

        // Room Code for live sessions
        roomCode: liveSession ? roomCode : null,

        // Settings object for compatibility
        settings: {
          maxParticipants,
          allowReactions,
          confettiEffect,
          soundEffects,
          liveSession,
          allowDataSync,
          roomCode: liveSession ? roomCode : null
        },

        // Collaboration settings - simplified for speed
        collaborators: rawEmails, // Store all emails, validation happens later
        collaboratorDetails: rawEmails.map(email => ({
          email: email,
          invitedAt: new Date(),
          status: 'invited',
          role: 'collaborator',
          permissions: {
            canControlLive: defaultPermission === 'full',
            canEditWheel: defaultPermission === 'full',
            canManageParticipants: defaultPermission === 'full',
            canViewOnly: defaultPermission === 'view'
          }
        })),

        // Default congratulations message
        congratulationsMessage: `🎉 Congratulations, ${userName}! Well done!`,

        // Initial participants from selected wheel type
        participants: wheelTypeToUse.defaultItems.map((item, index) => ({
          id: `item-${index}`,
          name: item,
          email: null,
          isSelected: true
        })),

        // Selected wheel type from gallery
        selectedWheelType: wheelTypeToUse,

        // Activity stats
        participantCount: wheelTypeToUse.defaultItems.length,
        timesUsed: 0,
        theme: "school-colors",
        viewerCount: 0,
        activeViewers: [],
        lastActivity: serverTimestamp(),
        updatedAt: serverTimestamp(),
        // Theme synchronization data
        wheelTheme: {
          primary: "#8e0b16",
          secondary: "#66181E",
          accent: "#ffffff",
          background: "#f8f9fa"
        },
        themeName: "School Colors",
        themeUpdatedAt: serverTimestamp()
      }

      // Step 3: Create the session document (critical operation)
      const docRef = await addDoc(collection(db, "liveDrawSessions"), sessionData)
      sessionId = docRef.id

      // Step 4: Send invitations asynchronously (non-blocking)
      if (rawEmails.length > 0) {
        // Send invitations in parallel for speed
        const invitationPromises = rawEmails.map(async (email) => {
          try {
            const invitationData = {
              sessionId: docRef.id,
              sessionTitle: sessionData.title,
              sessionDescription: sessionData.description,
              wheelType: wheelTypeToUse.id,
              wheelTitle: wheelTypeToUse.title,
              wheelIcon: wheelTypeToUse.icon,
              roomCode: roomCode,

              // Inviter information
              invitedBy: user.uid,
              invitedByName: user.displayName || user.email?.split('@')[0] || userName,
              invitedByEmail: user.email,

              // Invitee information
              invitedOrganizerEmail: email,
              invitedOrganizer: null,

              // Invitation details
              status: 'sent',
              type: 'live_room_invitation',
              createdAt: serverTimestamp(),
              expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),

              // Session configuration
              sessionConfig: {
                maxParticipants,
                allowReactions,
                confettiEffect,
                soundEffects,
                liveSession: true,
                allowDataSync
              },

              // Collaboration permissions
              permissions: {
                canControlLive: defaultPermission === 'full',
                canEditWheel: defaultPermission === 'full',
                canManageParticipants: defaultPermission === 'full',
                canViewOnly: defaultPermission === 'view',
                canEndSession: false,
                canInviteOthers: false
              },

              // Notification metadata
              isRealTimeNotification: true,
              priority: 'high',
              requiresImmediateAttention: true,
              notificationSent: true,
              sentAt: serverTimestamp()
            }

            return await addDoc(collection(db, "liveRoomInvitations"), invitationData)
          } catch (error) {
            console.warn(`Failed to send invitation to ${email}:`, error)
            // Don't throw - continue with other invitations
            return null
          }
        })

        // Wait for all invitations to complete (but don't block navigation)
        Promise.allSettled(invitationPromises).then((results) => {
          const successCount = results.filter(r => r.status === 'fulfilled').length
          console.log(`✅ Sent ${successCount}/${rawEmails.length} invitations`)
        })
      }

      // Step 5: Show success message and navigate (immediate)
      toast({
        title: "Activity Created! 🎉",
        description: liveSession
          ? `${wheelTypeToUse.title} room created! Code: ${roomCode}`
          : `${wheelTypeToUse.title} activity created successfully!`,
      })

      // Step 6: Navigate immediately (don't wait for invitations)
      router.push(`/live/${docRef.id}`)

    } catch (error) {
      console.error("Error creating live session:", error)

      // If session was created but something else failed, still navigate
      if (sessionId) {
        toast({
          title: "Activity Created (with warnings)",
          description: "Session created successfully, but some features may not work properly.",
          variant: "destructive"
        })
        router.push(`/live/${sessionId}`)
      } else {
        toast({
          title: "Creation Failed",
          description: "Failed to create activity. Please try again.",
          variant: "destructive"
        })
      }
    } finally {
      setIsCreating(false)
    }
  }



  return (
    <div className="container mx-auto px-4 py-4 sm:px-6 sm:py-8 max-w-4xl w-full">
      {/* Activity Options */}
      <Card className="mb-6 border-2 shadow-lg" style={{borderColor: '#8e0b16'}}>
        <CardHeader className="bg-gradient-to-r from-[#8e0b16] to-[#66181E] text-white rounded-t-lg">
          <CardTitle className="text-2xl font-bold flex items-center gap-2">
            <div className="p-2 bg-white/20 rounded-lg">
              <Users className="h-6 w-6" />
            </div>
            Activity Options
          </CardTitle>
          <CardDescription className="text-white/90">
            Configure sharing, scheduling, and interaction options for your wheel activity
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 p-6">
          {/* Max Participants */}
          <div className="space-y-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <Label className="flex items-center gap-2 text-base font-semibold" style={{color: '#8e0b16'}}>
              <div className="p-1 rounded-md" style={{backgroundColor: '#8e0b16'}}>
                <Users className="h-4 w-4 text-white" />
              </div>
              Max Participants
            </Label>
            <Input
              type="number"
              value={maxParticipants}
              onChange={(e) => setMaxParticipants(parseInt(e.target.value) || 50)}
              className="max-w-xs border-2 focus:border-[#8e0b16] focus:ring-[#8e0b16]" 
              style={{borderColor: '#8e0b16'}}
              min={1}
              max={1000}
            />
            <p className="text-sm text-gray-600">
              Limit how many participants can join this wheel or live session.
            </p>
          </div>

          <div className="border-t-2" style={{borderColor: '#8e0b16'}}></div>

          {/* Toggle Options */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">



            <div className="p-4 bg-white border-2 rounded-lg hover:shadow-md transition-shadow" style={{borderColor: '#8e0b16'}}>
              <div className="flex items-center justify-between mb-2">
                <Label className="flex items-center gap-2 text-base font-semibold" style={{color: '#8e0b16'}}>
                  <div className="p-1 rounded-md" style={{backgroundColor: '#8e0b16'}}>
                    <MessageCircle className="h-4 w-4 text-white" />
                  </div>
                  Allow Reactions
                </Label>
                <Switch
                  checked={allowReactions}
                  onCheckedChange={setAllowReactions}
                />
              </div>
              <p className="text-sm text-gray-600">
                Students can react with emojis
              </p>
            </div>

            <div className="p-4 bg-white border-2 rounded-lg hover:shadow-md transition-shadow" style={{borderColor: '#8e0b16'}}>
              <div className="flex items-center justify-between mb-2">
                <Label className="flex items-center gap-2 text-base font-semibold" style={{color: '#8e0b16'}}>
                  <div className="p-1 rounded-md" style={{backgroundColor: '#8e0b16'}}>
                    <Sparkles className="h-4 w-4 text-white" />
                  </div>
                  Confetti Effect
                </Label>
                <Switch
                  checked={confettiEffect}
                  onCheckedChange={setConfettiEffect}
                />
              </div>
              <p className="text-sm text-gray-600">
                Show confetti when winners are selected
              </p>
            </div>

            <div className="p-4 bg-white border-2 rounded-lg hover:shadow-md transition-shadow" style={{borderColor: '#8e0b16'}}>
              <div className="flex items-center justify-between mb-2">
                <Label className="flex items-center gap-2 text-base font-semibold" style={{color: '#8e0b16'}}>
                  <div className="p-1 rounded-md" style={{backgroundColor: '#8e0b16'}}>
                    <Volume2 className="h-4 w-4 text-white" />
                  </div>
                  Sound Effects
                </Label>
                <Switch
                  checked={soundEffects}
                  onCheckedChange={setSoundEffects}
                />
              </div>
              <p className="text-sm text-gray-600">
                Play sounds during spin
              </p>
            </div>

            <div className="p-4 bg-white border-2 rounded-lg hover:shadow-md transition-shadow" style={{borderColor: '#8e0b16'}}>
              <div className="flex items-center justify-between mb-2">
                <Label className="flex items-center gap-2 text-base font-semibold" style={{color: '#8e0b16'}}>
                  <div className="p-1 rounded-md" style={{backgroundColor: '#8e0b16'}}>
                    <Radio className="h-4 w-4 text-white" />
                  </div>
                  Live Session
                  {isLiveSessionLocked && (
                    <Badge variant="secondary" className="bg-green-100 text-green-700 text-xs">
                      🔒 Locked
                    </Badge>
                  )}
                </Label>
                <Switch
                  checked={liveSession}
                  onCheckedChange={(checked) => {
                    if (!isLiveSessionLocked) {
                      setLiveSession(checked)
                    }
                  }}
                  disabled={isLiveSessionLocked}
                />
              </div>
              <p className="text-sm text-gray-600">
                {isLiveSessionLocked 
                  ? "Live session is locked once enabled to prevent accidental disabling"
                  : "Enable real-time wheel with room code"
                }
              </p>
            </div>

            {/* Room Code Display - Prominent Section */}
            {liveSession && roomCode && (
              <div className="md:col-span-2">
                <div className="mt-4 p-6 bg-gradient-to-r from-white to-gray-50 border-2 rounded-xl shadow-lg" style={{borderColor: '#8e0b16'}}>
                  <div className="text-center space-y-4">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-3 h-3 rounded-full animate-pulse" style={{backgroundColor: '#8e0b16'}}></div>
                      <Label className="text-lg font-bold flex items-center gap-2" style={{color: '#8e0b16'}}>
                        <QrCode className="h-5 w-5" />
                        🎉 Live Session Active!
                        <Radio className="h-5 w-5 animate-pulse" />
                      </Label>
                      <div className="w-3 h-3 rounded-full animate-pulse" style={{backgroundColor: '#8e0b16'}}></div>
                    </div>
                    <div className="p-4 bg-white border-2 rounded-lg shadow-sm" style={{borderColor: '#8e0b16'}}>
                      <p className="text-sm font-medium mb-2" style={{color: '#8e0b16'}}>Room Code:</p>
                      <p className="text-5xl font-mono font-bold tracking-wider mb-3" style={{color: '#8e0b16'}}>
                        {roomCode}
                      </p>
                      <p className="text-sm" style={{color: '#66181E'}}>
                        Share this code with participants to join your live session
                      </p>
                    </div>
                    <div className="flex gap-3 justify-center">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setRoomCode(generateRoomCode())}
                        className="border-2 text-white hover:bg-[#66181E] transition-colors"
                        style={{backgroundColor: '#8e0b16', borderColor: '#8e0b16'}}
                      >
                        🔄 Generate New Code
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          navigator.clipboard.writeText(roomCode)
                          toast({
                            title: "Copied!",
                            description: "Room code copied to clipboard"
                          })
                        }}
                        className="border-2 bg-white hover:bg-gray-50 transition-colors"
                        style={{color: '#8e0b16', borderColor: '#8e0b16'}}
                      >
                        <Copy className="h-4 w-4 mr-2" />
                        Copy Code
                      </Button>
                    </div>
                    <div className="text-xs p-3 rounded-lg" style={{color: '#8e0b16', backgroundColor: 'rgba(142, 11, 22, 0.1)'}}>
                      ✅ Participants can join at /join using this code<br />
                      📱 This code will be saved when you create the activity
                    </div>
                  </div>
                </div>
              </div>
            )}

          </div>
        </CardContent>
      </Card>

      {/* Collaboration & Sharing */}
      <Card className="mb-6 border-2 shadow-lg" style={{borderColor: '#8e0b16'}}>
        <CardHeader className="bg-gradient-to-r from-[#8e0b16] to-[#66181E] text-white rounded-t-lg">
          <CardTitle className="text-2xl font-bold flex items-center gap-2">
            <div className="p-2 bg-white/20 rounded-lg">
              <Share2 className="h-6 w-6" />
            </div>
            Collaboration & Sharing
          </CardTitle>
          <CardDescription className="text-white/90">
            Invite collaborators and choose modules to share with participants
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 p-6">
          {/* Allow Data Sync */}
          <div className="p-4 bg-white border-2 rounded-lg hover:shadow-md transition-shadow" style={{borderColor: '#8e0b16'}}>
            <div className="flex items-center justify-between mb-2">
              <Label className="flex items-center gap-2 text-base font-semibold" style={{color: '#8e0b16'}}>
                <div className="p-1 rounded-md" style={{backgroundColor: '#8e0b16'}}>
                  <RefreshCw className="h-4 w-4 text-white" />
                </div>
                🔄 Allow Data Sync
              </Label>
              <Switch
                checked={allowDataSync}
                onCheckedChange={setAllowDataSync}
              />
            </div>
            <p className="text-sm text-gray-600">
              Keep activity data synced across collaborators
            </p>
          </div>

          <Separator className="border-2" style={{borderColor: '#8e0b16'}} />

          {/* Add Collaborators */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2 text-base font-semibold" style={{color: '#8e0b16'}}>
              <div className="p-1 rounded-md" style={{backgroundColor: '#8e0b16'}}>
                <UserPlus className="h-4 w-4 text-white" />
              </div>
              Add Collaborators (emails, comma-separated)
            </Label>
            <Textarea
              placeholder="teacher2@example.com, coord@example.com"
              value={collaborators}
              onChange={(e) => setCollaborators(e.target.value)}
              className="min-h-[80px] border-2 focus:border-[#8e0b16] focus:ring-[#8e0b16]"
              style={{borderColor: '#8e0b16'}}
            />
            {/* Permission Selection */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Default Permissions for Collaborators</Label>
              <Select value={defaultPermission} onValueChange={(value: string) => setDefaultPermission(value as any)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full">Full Access (Control, Edit, Manage)</SelectItem>
                  <SelectItem value="view">View Only</SelectItem>
                </SelectContent>
              </Select>
              {/* Conditional Permission Options based on selection */}
              {defaultPermission === 'full' && (
                <div className="text-xs text-green-600 p-2 bg-green-50 rounded">
                  ✅ Full permissions: Can control live sessions, edit wheels, manage participants
                </div>
              )}
              {defaultPermission === 'view' && (
                <div className="text-xs text-gray-600 p-2 bg-gray-50 rounded">
                  👁️ View only: Can view session and see synchronized spins but cannot trigger spins or make changes
                </div>
              )}
            </div>
            <div className="space-y-2">
              <p className="text-sm text-gray-600">
                📧 Collaborators will receive real-time notifications in their dashboard to join the live session with selected permissions.
              </p>
              {collaborators.trim() && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="text-xs text-blue-700 mb-2">Email Validation Preview:</div>
                  {(() => {
                    const emails = collaborators
                      .split(',')
                      .map(email => email.trim())
                      .filter(email => email.length > 0)
                    
                    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
                    const validEmails = emails.filter(email => emailRegex.test(email) && email !== user?.email)
                    const invalidEmails = emails.filter(email => !emailRegex.test(email) || email === user?.email)
                    
                    return (
                      <div className="space-y-2">
                        {validEmails.length > 0 && (
                          <div>
                            <div className="text-xs font-medium text-green-700 mb-1">✅ Valid Collaborators ({validEmails.length}):</div>
                            <div className="flex flex-wrap gap-1">
                              {validEmails.map((email, index) => (
                                <Badge key={index} variant="outline" className="text-xs bg-green-50 text-green-700 border-green-300">
                                  📧 {email} ({defaultPermission})
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                        {invalidEmails.length > 0 && (
                          <div>
                            <div className="text-xs font-medium text-red-700 mb-1">❌ Invalid/Skipped ({invalidEmails.length}):</div>
                            <div className="flex flex-wrap gap-1">
                              {invalidEmails.map((email, index) => (
                                <Badge key={index} variant="outline" className="text-xs bg-red-50 text-red-700 border-red-300">
                                  ⚠️ {email || 'Empty'}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                        <div className="text-xs text-blue-600 mt-2">
                          {validEmails.length > 0
                            ? `${validEmails.length} collaborator(s) will receive live room invitations with ${defaultPermission} permissions`
                            : "No valid email addresses to invite"
                          }
                        </div>
                      </div>
                    )
                  })()}
                </div>
              )}
            </div>
          </div>


        </CardContent>
      </Card>



      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="flex gap-4">
          {onCancel && (
            <Button variant="outline" onClick={onCancel} disabled={isCreating} className="w-full sm:w-auto">
              <X className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          )}
        </div>
        <Button
          onClick={handleCreateWheelActivity}
          disabled={isCreating}
          className="text-white px-8 hover:opacity-90 transition-opacity w-full sm:w-auto"
          style={{backgroundColor: '#8e0b16'}}
        >
          {isCreating ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Creating...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4 mr-2" />
              Create Wheel Activity
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
