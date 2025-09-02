"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { toast } from "@/hooks/use-toast"
import { auth, db } from "@/lib/firebase"
import { addDoc, collection, serverTimestamp, updateDoc, getDoc, doc } from "firebase/firestore"
import { onAuthStateChanged, type User } from "firebase/auth"
import { useRouter } from "next/navigation"
import { Settings, Trophy, Users, Calendar, Share2, Upload, Download, UserPlus } from "lucide-react"
import { type PickerWheelType } from "@/lib/picker-wheel-types"
import { getShareableUrl, generateQRCodeUrl, generateJoinUrl } from "@/lib/network-utils"
import CrossPlatformSessionManager from "@/lib/CrossPlatformSessionManager"
import { createSessionThemeConfig } from "@/lib/ThemeMapper"
import { CollaboratorInvite } from "@/components/shared/collaborator-invite"

const schoolColors = {
  primary: "#8e0b16",
  secondary: "#66181E",
  accent: "#ffffff"
}

interface QuickActivityCreatorProps {
  isOpen: boolean
  onClose: () => void
  selectedWheel: PickerWheelType | null
  autoEnableLiveSession?: boolean // New prop to automatically enable live sessions
}

export function QuickActivityCreator({ isOpen, onClose, selectedWheel, autoEnableLiveSession = false }: QuickActivityCreatorProps) {
  const [user, setUser] = useState<User | null>(null)
  const [userRole, setUserRole] = useState<string | null>(null)
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [importedItems, setImportedItems] = useState<string[] | null>(null)
  const [showRoomCodeDialog, setShowRoomCodeDialog] = useState(false)
  const [createdRoomCode, setCreatedRoomCode] = useState("")

  const [formData, setFormData] = useState({
    title: "",
    theme: "school",
    congratsMessage: "🎉 Congratulations, {name}! Well done!",
    allowReactions: true,
    hasConfetti: true,
    hasSound: true,
    isScheduled: false,
    scheduledDate: "",
    scheduledTime: "",
    enableLiveSession: autoEnableLiveSession,
    roomCode: "",
    maxParticipants: 50,
    allowDataSync: true,
    collaborators: [] as string[]
  })
  
  // State for live session locking
  const [isLiveSessionLocked, setIsLiveSessionLocked] = useState(autoEnableLiveSession)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser)

      if (currentUser) {
        try {
          const userDocRef = doc(db, "users", currentUser.uid)
          const userDocSnap = await getDoc(userDocRef)

          if (userDocSnap.exists()) {
            const userData = userDocSnap.data()
            setUserRole(userData.role || "student")
          } else {
            setUserRole("student") // Default to student if no document
          }
        } catch (error) {
          console.error("Error fetching user role:", error)
          setUserRole("student") // Default to student on error
        }
      } else {
        setUserRole(null)
      }
    })
    return () => unsubscribe()
  }, [])

  // Generate a unique room code with mixed letters and numbers (like the live session manager)
  const generateRoomCode = () => {
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

  // Generate room code when live session is enabled and lock the toggle
  useEffect(() => {
    if (formData.enableLiveSession && !formData.roomCode) {
      setFormData(prev => ({ ...prev, roomCode: generateRoomCode() }))
      // Lock the live session toggle once enabled to prevent accidental disabling
      setIsLiveSessionLocked(true)
    } else if (!formData.enableLiveSession) {
      setFormData(prev => ({ ...prev, roomCode: "" }))
    }
  }, [formData.enableLiveSession])

  // Auto-populate title with selected wheel title
  useEffect(() => {
    if (selectedWheel && !formData.title.trim()) {
      setFormData(prev => ({ ...prev, title: selectedWheel.title }))
    }
  }, [selectedWheel])

  const themeOptions = [
    { value: "school", label: "🏫 School Colors", description: "Red and white theme" },
    { value: "vibrant", label: "🌈 Vibrant", description: "Colorful and energetic" },
    { value: "minimal", label: "⚪ Minimal", description: "Clean and simple" },
    { value: "ocean", label: "🌊 Ocean Blue", description: "Calming blue tones" },
    { value: "forest", label: "🌲 Forest Green", description: "Natural green theme" },
    { value: "sunset", label: "🌅 Sunset Orange", description: "Warm orange and yellow" },
    { value: "purple", label: "💜 Royal Purple", description: "Elegant purple theme" },
    { value: "pink", label: "🌸 Cherry Blossom", description: "Soft pink theme" },
    { value: "dark", label: "🌙 Dark Mode", description: "Dark background theme" },
    { value: "neon", label: "⚡ Neon Glow", description: "Bright neon colors" },
    { value: "retro", label: "📼 Retro", description: "Vintage 80s style" },
    { value: "gold", label: "✨ Golden", description: "Luxurious gold theme" }
  ]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please log in to create an activity",
        variant: "destructive"
      })
      return
    }

    if (!formData.title.trim()) {
      toast({
        title: "Title Required",
        description: "Please enter a title for your activity",
        variant: "destructive"
      })
      return
    }

    if (!selectedWheel) {
      toast({
        title: "Wheel Required",
        description: "Please select a wheel type",
        variant: "destructive"
      })
      return
    }

    setLoading(true)
    try {
      let docRef = null
      let activityData = null
      let liveSessionRef: any = null

      // Create activity data for regular (non-live) sessions
      const baseActivityData = {
        title: formData.title,
        description: `${selectedWheel.title} activity created on ${new Date().toLocaleDateString()}`,
        category: "entertainment", // Default category for picker wheels
        wheelType: selectedWheel.id,
        wheelTitle: selectedWheel.title,
        participants: (importedItems ?? selectedWheel.defaultItems).map((item, index) => ({
          id: `default-${index}`,
          name: item,
          email: null,
          contactNumber: null,
          isSelected: false
        })),
        settings: {
          congratsMessage: formData.congratsMessage,
          theme: formData.theme,
          allowReactions: formData.allowReactions,
          hasConfetti: formData.hasConfetti,
          hasSound: formData.hasSound,
          spinDuration: 3000,
          numberOfWinners: 1,
          allowDuplicates: false,
          showParticipantCount: true,
          maxParticipants: formData.maxParticipants,
          allowDataSync: formData.allowDataSync,
          collaborators: formData.collaborators
        },
        isScheduled: formData.isScheduled,
        scheduledDate: formData.isScheduled && formData.scheduledDate && formData.scheduledTime
          ? new Date(`${formData.scheduledDate}T${formData.scheduledTime}`)
          : null,
        createdBy: user.uid,
        organizerName: user.displayName || user.email?.split('@')[0] || "Teacher",
        createdAt: serverTimestamp(),
        lastUsed: null,
        timesUsed: 0,
        participantCount: (importedItems ?? selectedWheel.defaultItems).length,
        isLive: formData.enableLiveSession, // Set live status based on live session
        status: formData.enableLiveSession ? "live" : "draft",
        // Additional fields that might be expected
        winners: [],
        spinHistory: [],
        tags: [selectedWheel.category, "picker-wheel"],
        version: "1.0"
      }

      if (!formData.enableLiveSession) {
        // Create regular activity (no live session)
        activityData = {
          ...baseActivityData,
          liveSession: {
            enabled: false,
            roomCode: null,
            isActive: false,
            participants: [],
            viewers: [],
            createdAt: null,
            maxParticipants: formData.maxParticipants
          }
        }

        console.log("🎯 Creating regular activity with data:", activityData)
        docRef = await addDoc(collection(db, "drawActivities"), activityData)
        console.log("✅ Regular activity created successfully with ID:", docRef.id)
      } else {
        // For live sessions, we'll create only the live session document
        // The activity document will be minimal and reference the live session
        activityData = {
          ...baseActivityData,
          liveSession: {
            enabled: true,
            roomCode: formData.roomCode,
            isActive: true,
            participants: [],
            viewers: [],
            createdAt: serverTimestamp(),
            maxParticipants: formData.maxParticipants
          }
        }

        console.log("🎯 Creating minimal activity (for live session) with data:", activityData)
        docRef = await addDoc(collection(db, "drawActivities"), activityData)
        console.log("✅ Activity reference created with ID:", docRef.id)
      }

      // Verify the activity was created by reading it back
      try {
        const verifyDoc = await getDoc(doc(db, "drawActivities", docRef.id))
        if (verifyDoc.exists()) {
          console.log("✅ Activity verification successful:", verifyDoc.data())
        } else {
          console.error("❌ Activity verification failed - document not found")
        }
      } catch (verifyError) {
        console.error("❌ Activity verification error:", verifyError)
      }

      // If live session is enabled, create the live session immediately with enhanced data
      if (formData.enableLiveSession) {
        try {
          const liveSessionData = {
            title: `Live Draw - ${formData.title}`,
            description: "Real-time randomizer session",
            createdBy: user.uid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            isActive: true,
            isLive: true,
            isSpinning: false,
            currentState: "waiting",

            // Enhanced wheel information
            wheelType: selectedWheel.id,
            wheelTitle: selectedWheel.title,
            wheelItems: (importedItems ?? selectedWheel.defaultItems),

            // Participants from default items
            participants: (importedItems ?? selectedWheel.defaultItems).map((item, index) => ({
              id: `default-${index}`,
              name: item
            })),
            winners: [],

            // Enhanced settings
            settings: {
              numberOfWinners: 1,
              congratsMessage: formData.congratsMessage,
              allowReactions: formData.allowReactions,
              autoStart: true, // Enable auto-start for quick activities
              spinDuration: 3000,
              theme: formData.theme
            },

            // Real-time tracking
            viewerCount: 0,
            activeViewers: [],
            lastActivity: serverTimestamp(),

            // Connection info
            shareUrl: "",
            roomCode: formData.roomCode,
            joinUrl: "", // Will be set after creation
            qrCodeUrl: "",

            // Activity reference
            activityId: docRef.id,

            // Teacher presence
            teacherPresence: {
              userId: user.uid,
              userName: user.displayName?.trim() || user.email?.split('@')[0]?.trim() || "Teacher",
              isOnline: true,
              lastSeen: serverTimestamp(),
              connectionId: `teacher-${Date.now()}`
            },

            // Platform support
            supportedPlatforms: ["web", "mobile", "app"],
            crossPlatformEnabled: true
          }

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

          // Clean the data to remove any undefined values
          const cleanLiveSessionData = cleanData(liveSessionData)
          console.log("✅ Clean live session data:", JSON.stringify(cleanLiveSessionData, null, 2))

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

          const validationErrors = validateNoUndefined(cleanLiveSessionData)
          if (validationErrors.length > 0) {
            console.error("❌ Validation errors found:", validationErrors)
            throw new Error(`Invalid data structure: ${validationErrors.join(', ')}`)
          }

          console.log("✅ Validation passed - no undefined values found")

          // Debug: Log the live session data before creating
          console.log("🔍 Creating live session with data:", {
            title: cleanLiveSessionData.title,
            roomCode: cleanLiveSessionData.roomCode,
            wheelType: cleanLiveSessionData.wheelType,
            participantsCount: cleanLiveSessionData.participants.length
          })

          const liveSessionRef = await addDoc(collection(db, "liveDrawSessions"), cleanLiveSessionData)
          const shareUrl = getShareableUrl(`/live/${liveSessionRef.id}`)
          const joinUrl = generateJoinUrl(formData.roomCode)
          const qrCodeUrl = generateQRCodeUrl(`/join?code=${formData.roomCode}`)

          // Update with generated URLs
          await updateDoc(liveSessionRef, {
            shareUrl,
            joinUrl,
            qrCodeUrl,
            updatedAt: serverTimestamp()
          })

          // Add theme synchronization for cross-platform consistency
          try {
            const sessionManager = CrossPlatformSessionManager;
            const themeConfig = createSessionThemeConfig(formData.theme, formData.theme);
            await sessionManager.updateSessionTheme(liveSessionRef.id, themeConfig);
            console.log('✅ Theme synchronized for live session:', formData.theme);
          } catch (themeError) {
            console.warn('⚠️ Theme sync failed, but live session is active:', themeError);
          }

          // Update the activity to mark it as live with session reference
          await updateDoc(docRef, {
            isLive: true,
            liveSessionId: liveSessionRef.id,
            roomCode: formData.roomCode,
            liveSessionUrl: `/live-draw/${docRef.id}`,
            joinUrl: joinUrl,
            updatedAt: serverTimestamp()
          })

          console.log("✅ Live session created and linked successfully:", {
            activityId: docRef.id,
            sessionId: liveSessionRef.id,
            roomCode: formData.roomCode,
            shareUrl,
            joinUrl
          })

          toast({
            title: "🎉 Live Session Active!",
            description: `"${formData.title}" is now live with room code: ${formData.roomCode}`,
          })
        } catch (error) {
          console.error("Error creating live session:", error)
          console.error("Live session error details:", {
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
            userUid: user.uid,
            userEmail: user.email,
            roomCode: formData.roomCode,
            activityId: docRef.id
          })
          toast({
            title: "Activity Created",
            description: `"${formData.title}" created but live session failed to start. Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            variant: "destructive"
          })
        }
      } else {
        toast({
          title: "Activity Created!",
          description: `"${formData.title}" has been created successfully`,
        })
      }

      onClose()

      // Add a small delay to ensure Firestore has processed the write
      console.log("⏳ Waiting for Firestore to process...")
      await new Promise(resolve => setTimeout(resolve, 1500))

      if (formData.enableLiveSession) {
        // For live sessions, redirect to the live session page (not activity page)
        // This prevents showing duplicate wheels and ensures proper live functionality
        try {
          const liveSessionId = (await getDoc(doc(db, "drawActivities", docRef.id))).data()?.liveSessionId
          if (liveSessionId) {
            console.log("🚀 Redirecting to live session:", `/live/${liveSessionId}`)
            router.push(`/live/${liveSessionId}`)
          } else {
            console.log("🚀 Redirecting to activity page (fallback):", `/activity/${docRef.id}`)
            router.push(`/activity/${docRef.id}`)
          }
        } catch (error) {
          console.error("❌ Error getting live session ID, redirecting to activity page:", error)
          router.push(`/activity/${docRef.id}`)
        }
      } else {
        // Redirect to regular activity page for non-live activities
        console.log("🚀 Redirecting to activity page:", `/activity/${docRef.id}`)
        router.push(`/activity/${docRef.id}`)
      }
    } catch (error) {
      console.error("Error creating activity:", error)
      console.error("Activity creation error details:", {
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        userUid: user.uid,
        userEmail: user.email,
        formData: formData,
        selectedWheel: selectedWheel
      })
      toast({
        title: "Error",
        description: `Failed to create activity. Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    setFormData({
      title: "",
      theme: "school",
      congratsMessage: "🎉 Congratulations, {name}! Well done!",
      allowReactions: true,
      hasConfetti: true,
      hasSound: true,
      isScheduled: false,
      scheduledDate: "",
      scheduledTime: "",
      enableLiveSession: autoEnableLiveSession,
      roomCode: "",
      maxParticipants: 50,
      allowDataSync: true,
      collaborators: []
    })
    onClose()
  }

  return (
    <>
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2" style={{ color: schoolColors.primary }}>
            {selectedWheel?.icon} Create {selectedWheel?.title} Activity
          </DialogTitle>
          <DialogDescription>
            Set up your {selectedWheel?.title.toLowerCase()} activity with custom settings and options.
          </DialogDescription>
        </DialogHeader>

        <form id="activity-form" onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2" style={{ color: schoolColors.primary }}>
                <Settings className="h-5 w-5" />
                Basic Information
              </CardTitle>
              <CardDescription>
                Set the title for your activity
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="title">Activity Title *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  readOnly
                  className="bg-gray-50 cursor-not-allowed"
                  placeholder={selectedWheel ? selectedWheel.title : "Select a wheel type first"}
                  required
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Title is automatically set based on the selected wheel type
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Draw Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2" style={{ color: schoolColors.primary }}>
                <Trophy className="h-5 w-5" />
                Draw Settings
              </CardTitle>
              <CardDescription>
                Configure how the randomizer will work
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="theme">Theme</Label>
                <Select 
                  value={formData.theme} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, theme: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {themeOptions.map(theme => (
                      <SelectItem key={theme.value} value={theme.value}>
                        <div className="flex items-center gap-2">
                          <span>{theme.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  Choose a visual theme for your wheel
                </p>
              </div>
              
              <div>
                <Label htmlFor="message">Congratulations Message</Label>
                <Input
                  id="message"
                  value={formData.congratsMessage}
                  onChange={(e) => setFormData(prev => ({ ...prev, congratsMessage: e.target.value }))}
                  placeholder="Use {name} for winner's name"
                />
              </div>
            </CardContent>
          </Card>

          {/* Activity Options */}
          <Card className="border-2 shadow-lg" style={{borderColor: '#8e0b16'}}>
            <CardHeader className="bg-gradient-to-r from-[#8e0b16] to-[#66181E] text-white rounded-t-lg">
              <CardTitle className="flex items-center gap-2">
                <div className="p-2 bg-white/20 rounded-lg">
                  <Users className="h-5 w-5" />
                </div>
                Activity Options
              </CardTitle>
              <CardDescription className="text-white/90">
                Configure sharing, scheduling, and interaction options
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="grid gap-2">
                    <Label htmlFor="max-participants">👥 Max Participants</Label>
                    <Input
                      id="max-participants"
                      type="number"
                      min={1}
                      max={5000}
                      value={formData.maxParticipants}
                      onChange={(e) => setFormData(prev => ({ ...prev, maxParticipants: Math.max(1, Math.min(5000, Number(e.target.value) || 1)) }))}
                    />
                    <p className="text-xs text-muted-foreground">Limit how many can join this wheel or live session.</p>
                  </div>


                  
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="reactions">💬 Allow Reactions</Label>
                      <p className="text-sm text-muted-foreground">Students can react with emojis</p>
                    </div>
                    <Switch
                      id="reactions"
                      checked={formData.allowReactions}
                      onCheckedChange={(checked) => setFormData(prev => ({ ...prev, allowReactions: checked }))}
                    />
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="confetti">🎊 Confetti Effect</Label>
                      <p className="text-sm text-muted-foreground">Show confetti when winners are selected</p>
                    </div>
                    <Switch
                      id="confetti"
                      checked={formData.hasConfetti}
                      onCheckedChange={(checked) => setFormData(prev => ({ ...prev, hasConfetti: checked }))}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="sound">🔊 Sound Effects</Label>
                      <p className="text-sm text-muted-foreground">Play sounds during spin</p>
                    </div>
                    <Switch
                      id="sound"
                      checked={formData.hasSound}
                      onCheckedChange={(checked) => setFormData(prev => ({ ...prev, hasSound: checked }))}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="liveSession" className="flex items-center gap-2">
                        <span className={formData.enableLiveSession ? "text-green-600" : "text-red-600"}>
                          {formData.enableLiveSession ? "🟢" : "🔴"}
                        </span>
                        Live Session {formData.enableLiveSession ? "Active" : ""}
                        {isLiveSessionLocked && (
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                            🔒 Locked
                          </span>
                        )}
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        {userRole === "student"
                          ? "Live sessions are only available for teachers and organizers"
                          : isLiveSessionLocked
                            ? "Live session is locked once enabled to prevent accidental disabling"
                            : formData.enableLiveSession
                            ? "Real-time wheel with room code is enabled"
                            : "Enable real-time wheel with room code"
                        }
                      </p>
                    </div>
                    <Switch
                      id="liveSession"
                      checked={formData.enableLiveSession}
                      onCheckedChange={(checked) => {
                        if (!isLiveSessionLocked) {
                          setFormData(prev => ({ ...prev, enableLiveSession: checked }))
                        }
                      }}
                      disabled={userRole === "student" || isLiveSessionLocked}
                    />
                  </div>

                  {formData.enableLiveSession && formData.roomCode && (
                    <div className="mt-4 p-6 bg-gradient-to-r from-white to-gray-50 border-2 rounded-xl shadow-lg" style={{borderColor: '#8e0b16'}}>
                      <div className="text-center space-y-4">
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-3 h-3 rounded-full animate-pulse" style={{backgroundColor: '#8e0b16'}}></div>
                          <Label className="text-lg font-bold flex items-center gap-1" style={{color: '#8e0b16'}}>
                            🎉 Live Session Active!
                          </Label>
                          <div className="w-3 h-3 rounded-full animate-pulse" style={{backgroundColor: '#8e0b16'}}></div>
                        </div>
                        <div className="p-4 bg-white border-2 rounded-lg shadow-sm" style={{borderColor: '#8e0b16'}}>
                          <p className="text-sm font-medium mb-2" style={{color: '#8e0b16'}}>Room Code:</p>
                          <p className="text-4xl font-mono font-bold tracking-wider mb-2" style={{color: '#8e0b16'}}>
                            {formData.roomCode}
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
                            onClick={() => setFormData(prev => ({ ...prev, roomCode: generateRoomCode() }))}
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
                              navigator.clipboard.writeText(formData.roomCode)
                              toast({
                                title: "Copied!",
                                description: "Room code copied to clipboard"
                              })
                            }}
                            className="border-2 bg-white hover:bg-gray-50 transition-colors"
                            style={{color: '#8e0b16', borderColor: '#8e0b16'}}
                          >
                            📋 Copy Code
                          </Button>
                        </div>
                        <div className="text-xs p-3 rounded-lg" style={{color: '#8e0b16', backgroundColor: 'rgba(142, 11, 22, 0.1)'}}>
                          ✅ Participants can join at /join using this code
                        </div>
                      </div>
                    </div>
                  )}

                </div>
              </div>
            </CardContent>
          </Card>

          {/* Collaboration & Sharing */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2" style={{ color: schoolColors.primary }}>
                <Share2 className="h-5 w-5" /> Collaboration & Sharing
              </CardTitle>
              <CardDescription>Invite collaborators and choose modules to share with participants</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>🔄 Allow Data Sync</Label>
                  <p className="text-sm text-muted-foreground">Keep activity data synced across collaborators</p>
                </div>
                <Switch checked={formData.allowDataSync} onCheckedChange={(checked) => setFormData(prev => ({ ...prev, allowDataSync: checked }))} />
              </div>
              <div>
                <Label>Add Collaborators</Label>
                {user && (
                  <CollaboratorInvite 
                    wheelId={"temp-" + Date.now()} // Temporary ID for activities being created
                    ownerId={user.uid}
                    wheelName={formData.title || "New Activity"}
                    currentUser={user}
                  />
                )}
                <p className="text-xs text-muted-foreground">Invited organizers will receive notifications with Enter/Cancel options.</p>
              </div>
            </CardContent>
          </Card>


        </form>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel} disabled={loading}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="activity-form"
            disabled={loading}
            className="bg-[#8e0b16] hover:bg-[#66181E]"
          >
            {loading ? "Creating..." : "Create Wheel Activity"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Room Code Success Dialog */}
    <Dialog open={showRoomCodeDialog} onOpenChange={setShowRoomCodeDialog}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center text-green-600 flex items-center justify-center gap-2">
            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
            🎉 Live Session Active!
            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
          </DialogTitle>
          <DialogDescription className="text-center">
            Your real-time wheel session is ready! Share this room code with participants to join.
          </DialogDescription>
        </DialogHeader>

        <div className="text-center space-y-4">
          <div className="p-6 bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-300 rounded-xl">
            <Label className="text-sm font-medium text-green-700">Room Code</Label>
            <div className="mt-3">
              <div className="text-4xl font-mono font-bold text-green-700 tracking-wider bg-white p-3 rounded-lg border border-green-200">
                {createdRoomCode}
              </div>
            </div>
          </div>

          <div className="text-sm text-gray-600 space-y-3 bg-gray-50 p-3 rounded-lg">
            <p className="font-medium">📱 Participants can join using this code:</p>
            <ul className="text-xs space-y-1">
              <li>• Web browser: Visit /join and enter the room code</li>
              <li>• Mobile app: Enter the room code in the join section</li>
              <li>• They'll see your live wheel and can participate in real-time</li>
            </ul>
          </div>

          <div className="flex gap-3 justify-center">
            <Button
              variant="outline"
              onClick={() => setFormData(prev => ({ ...prev, roomCode: generateRoomCode() }))}
              className="border-green-400 text-green-700 hover:bg-green-50"
            >
              🔄 Generate New Code
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                navigator.clipboard.writeText(createdRoomCode)
                toast({ title: "Copied!", description: "Room code copied to clipboard" })
              }}
              className="border-green-400 text-green-700 hover:bg-green-50"
            >
              📋 Copy Code
            </Button>
            <Button
              onClick={() => {
                setShowRoomCodeDialog(false)
                onClose()
              }}
              className="bg-green-600 hover:bg-green-700"
            >
              🚀 Start Live Session
            </Button>
          </div>

          <div className="text-xs text-green-600 bg-green-100 p-2 rounded border border-green-200">
            ✅ Room code is connected to your live session - participants will join immediately!
          </div>
        </div>
      </DialogContent>
    </Dialog>
    </>
  )
}
