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
import { PickerWheelGallery } from "@/components/picker-wheels/picker-wheel-gallery"
import type { PickerWheelType } from "@/lib/picker-wheel-types"

interface ActivityConfigurationProps {
  user?: FirebaseUser | null
  onCancel?: () => void
  userName?: string
  autoEnableLiveSession?: boolean // New prop to automatically enable live sessions
}

export function ActivityConfiguration({ user, onCancel, userName = "Organizer", autoEnableLiveSession = false }: ActivityConfigurationProps) {
  const router = useRouter()
  const [isCreating, setIsCreating] = useState(false)
  const [showWheelGallery, setShowWheelGallery] = useState(false) // FIXED: Start with false to show configuration directly
  const [selectedWheelType, setSelectedWheelType] = useState<PickerWheelType | null>({
    // FIXED: Default to a basic wheel type so configuration shows immediately
    id: 'basic-wheel',
    title: 'Basic Wheel',
    icon: '🎯',
    description: 'Create a custom wheel activity',
    category: 'personal',
    defaultItems: ['Option 1', 'Option 2', 'Option 3', 'Option 4'],
    color: '#8e0b16',
    isCustomizable: true,
    maxItems: 100
  })

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
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please log in to create activities.",
        variant: "destructive"
      })
      return
    }

    if (!selectedWheelType) {
      toast({
        title: "No Wheel Selected",
        description: "Please select a wheel type first.",
        variant: "destructive"
      })
      return
    }

    setIsCreating(true)

    try {
      // Parse collaborator emails
      const rawEmails = collaborators
        .split(',')
        .map(email => email.trim())
        .filter(email => {
          // Basic email validation
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
          return email && emailRegex.test(email) && email !== user.email
        })

      console.log("📧 Processing collaborator emails:", rawEmails)

      // Validate that collaborator emails correspond to existing users
      const validCollaboratorEmails: string[] = []
      const invalidEmails: string[] = []

      if (rawEmails.length > 0) {
        for (const email of rawEmails) {
          try {
            // Check if user exists and is an organizer/teacher
            const usersQuery = query(
              collection(db, "users"),
              where("email", "==", email)
            )
            const userSnapshot = await getDocs(usersQuery)

            if (userSnapshot.empty) {
              invalidEmails.push(`${email} (user not found)`)
              continue
            }

            const userData = userSnapshot.docs[0].data()
            const userRole = userData.role?.toLowerCase()

            if (userRole !== 'organizer' && userRole !== 'teacher') {
              invalidEmails.push(`${email} (not an organizer/teacher)`)
              continue
            }

            // Valid collaborator
            validCollaboratorEmails.push(email)

          } catch (error) {
            console.error(`Error validating collaborator ${email}:`, error)
            invalidEmails.push(`${email} (validation error)`)
          }
        }

        // Show validation results
        if (invalidEmails.length > 0) {
          console.warn("⚠️ Invalid collaborators found:", invalidEmails)
          toast({
            title: "Invalid Collaborators",
            description: `Some emails are not valid organizers: ${invalidEmails.join(', ')}. Only valid collaborators will be invited.`,
            variant: "destructive",
            duration: 6000
          })
        }

        console.log("✅ Valid collaborators:", validCollaboratorEmails)
      }

      const collaboratorEmails = validCollaboratorEmails

      // Create a new live draw session with the configured settings
      const sessionData = {
        title: `${selectedWheelType.title} Activity for ${userName}`,
        description: `${selectedWheelType.description} - Created on ${new Date().toLocaleDateString()}`,
        wheelType: selectedWheelType.id,
        wheelTitle: selectedWheelType.title,
        category: selectedWheelType.category,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        lastUsed: serverTimestamp(),
        isActive: true,
        isLive: true,
        currentState: "waiting", // waiting, spinning, completed
        
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
        
        // Collaboration settings - store validated emails
        collaborators: collaboratorEmails,
        collaboratorDetails: collaboratorEmails.map(email => ({
          email: email,
          invitedAt: new Date(),
          status: 'invited',
          permissions: {
            canControlLive: true,
            canEditWheel: true,
            canManageParticipants: true
          }
        })),
        
        // Default congratulations message
        congratulationsMessage: `🎉 Congratulations, ${userName}! Well done!`,
        
        // Initial participants from selected wheel type
        participants: selectedWheelType.defaultItems.map((item, index) => ({
          id: `item-${index}`,
          name: item,
          email: null,
          isSelected: true
        })),
        
        // Selected wheel type from gallery
        selectedWheelType: selectedWheelType,
        
        // Activity stats
        participantCount: selectedWheelType.defaultItems.length,
        timesUsed: 0,
        theme: "school-colors",
        viewerCount: 0,
        activeViewers: [],
        lastActivity: serverTimestamp(),
        updatedAt: serverTimestamp()
      }

      const docRef = await addDoc(collection(db, "liveDrawSessions"), sessionData)
      
      // Send live room invitations to collaborators
      if (collaboratorEmails.length > 0) {
        console.log(`📧 Sending ${collaboratorEmails.length} live room invitations...`)
        
        for (const email of collaboratorEmails) {
          try {
            // Create live room invitation for real-time notification
            const invitationData = {
              sessionId: docRef.id,
              sessionTitle: sessionData.title,
              sessionDescription: sessionData.description,
              wheelType: selectedWheelType.id,
              wheelTitle: selectedWheelType.title,
              wheelIcon: selectedWheelType.icon,
              roomCode: roomCode,
              
              // Inviter information
              invitedBy: user.uid,
              invitedByName: user.displayName || user.email?.split('@')[0] || userName,
              invitedByEmail: user.email,
              
              // Invitee information
              invitedOrganizerEmail: email,
              invitedOrganizer: null, // Will be filled when they accept
              
              // Invitation details
              status: 'sent',
              type: 'live_room_invitation',
              createdAt: serverTimestamp(),
              expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
              
              // Session configuration shared with collaborators
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
                canControlLive: true,
                canEditWheel: true,
                canManageParticipants: true,
                canEndSession: false, // Only primary organizer can end
                canInviteOthers: false
              },
              
              // Notification metadata
              isRealTimeNotification: true,
              priority: 'high',
              requiresImmediateAttention: true,
              
              // Track notification delivery
              notificationSent: true,
              sentAt: serverTimestamp()
            }
            
            await addDoc(collection(db, "liveRoomInvitations"), invitationData)
            console.log(`✅ Live room invitation sent to: ${email}`)
            
          } catch (error) {
            console.error(`❌ Failed to send invitation to ${email}:`, error)
            // Continue with other invitations even if one fails
          }
        }
        
        toast({
          title: "🎉 Activity Created & Invitations Sent!",
          description: liveSession 
            ? `${selectedWheelType.title} room created! Code: ${roomCode}. Invitations sent to ${collaboratorEmails.length} collaborator(s).`
            : `${selectedWheelType.title} activity created! Invitations sent to ${collaboratorEmails.length} collaborator(s).`,
          duration: 6000
        })
      } else {
        toast({
          title: "Activity Created! 🎉",
          description: liveSession 
            ? `${selectedWheelType.title} room created! Code: ${roomCode}`
            : `${selectedWheelType.title} activity created successfully!`,
        })
      }

      // Navigate to the live draw page (will show LiveDrawManager for organizers)
      router.push(`/live/${docRef.id}`)
      
    } catch (error) {
      console.error("Error creating live session:", error)
      toast({
        title: "Error",
        description: "Failed to create live session. Please try again.",
        variant: "destructive"
      })
    } finally {
      setIsCreating(false)
    }
  }


  // Show the picker wheel gallery by default
  if (showWheelGallery && !selectedWheelType) {
    return (
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <div
            className="w-full py-4 px-4 rounded-xl text-white shadow-sm"
            style={{ background: "linear-gradient(135deg, #66181E 0%, #8e0b16 100%)" }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {onCancel && (
                  <button
                    type="button"
                    aria-label="Back to Dashboard"
                    onClick={onCancel}
                    className="inline-flex items-center justify-center h-8 w-8 rounded-md bg-white/10 hover:bg-white/20 transition-colors"
                  >
                    <X className="h-5 w-5" />
                  </button>
                )}
                <div>
                  <h1 className="text-xl font-semibold leading-tight">Browse Picker Wheels</h1>
                  <p className="text-xs opacity-90">Select a wheel type to create your activity</p>
                </div>
              </div>
              {user && (
                <div className="text-sm opacity-90 px-2 py-1 rounded-md bg-white/10">
                  {user.displayName || user.email}
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Picker Wheel Gallery */}
        <PickerWheelGallery
          onSelectWheel={(wheel) => {
            console.log("🎯 Wheel selected:", wheel)
            setSelectedWheelType(wheel)
            setShowWheelGallery(false)
          }}
          userRole="organizer"
          user={user}
        />
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">



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
            <div className="space-y-2">
              <p className="text-sm text-gray-600">
                📧 Collaborators will receive real-time notifications in their dashboard to join the live session.
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
                                  📧 {email}
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
                            ? `${validEmails.length} collaborator(s) will receive live room invitations in their dashboard`
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
      <div className="flex gap-4 justify-between">
        <div className="flex gap-4">
          {onCancel && (
            <Button variant="outline" onClick={onCancel} disabled={isCreating}>
              <X className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          )}
        </div>
        <Button 
          onClick={handleCreateWheelActivity}
          disabled={isCreating}
          className="text-white px-8 hover:opacity-90 transition-opacity"
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