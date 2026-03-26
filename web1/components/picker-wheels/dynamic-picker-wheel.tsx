"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { EnhancedWheel } from "@/components/randomizer/enhanced-wheel"
import { TeamPicker } from "@/components/team/team-picker"
import { EnhancedTeamPicker } from "@/components/team/enhanced-team-picker"
import { ImagePickerWheel } from "./image-picker-wheel"


import { type PickerWheelType, generateNumberRange, generateDateRange, PICKER_WHEEL_TYPES } from "@/lib/picker-wheel-types"
import { Settings, Plus, Trash2, RotateCcw, Download, Share2, Target, Save, Play, Upload, ChevronDown, ChevronUp } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { QuickActivityCreator } from "./quick-activity-creator"
import { auth, db } from "@/lib/firebase"
import { onAuthStateChanged, type User } from "firebase/auth"
import { collection, addDoc, serverTimestamp, updateDoc, doc } from "firebase/firestore"

interface DynamicPickerWheelProps {
  wheelType: PickerWheelType
  onBack?: () => void
  onBackToSavedWheels?: () => void // New prop for saved wheels back button
  externalParticipants?: Array<{ id: string; name: string; email?: string }>
  onParticipantsChange?: (participants: Participant[]) => void
  isStudentMode?: boolean
  user?: User | null
  soloMode?: boolean // New prop to disable live session functionality
  userRole?: string // User role for dashboard routing
}

interface Participant {
  id: string
  name: string
}

export function DynamicPickerWheel({
  wheelType,
  onBack,
  onBackToSavedWheels,
  externalParticipants,
  onParticipantsChange,
  isStudentMode = false,
  user: propUser,
  soloMode = false,
  userRole
}: DynamicPickerWheelProps) {
  const [participants, setParticipants] = useState<Participant[]>([])
  const [newItem, setNewItem] = useState("")
  const [isCustomizing, setIsCustomizing] = useState(false)
  const [numberRange, setNumberRange] = useState({ start: 1, end: 10 })
  const [dateRange, setDateRange] = useState({
    start: new Date().toISOString().split('T')[0],
    end: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  })
  const router = useRouter()
  const [user, setUser] = useState<User | null>(propUser || null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isWheelSwitcherOpen, setIsWheelSwitcherOpen] = useState(false)
  const [numberOfWinners, setNumberOfWinners] = useState(1)
  const [showCsvImport, setShowCsvImport] = useState(true)
  const [showCurrentItems, setShowCurrentItems] = useState(true)
  const [spinMode, setSpinMode] = useState<'random' | 'manual'>('random')
  const [selectedWinners, setSelectedWinners] = useState<Participant[]>([])
  const [customCongratsMessage, setCustomCongratsMessage] = useState("Congratulations! 🎉")
  const prevExternalParticipantsRef = useRef<string | null>(null)
  const lastSentParticipantsRef = useRef<string | null>(null)
  const [isTemporaryWheel, setIsTemporaryWheel] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [tempWheelData, setTempWheelData] = useState<any>(null)
  // Force re-render when participants change to ensure wheel updates instantly
  const [wheelRefreshTrigger, setWheelRefreshTrigger] = useState(0)

  useEffect(() => {
    // If user is provided as prop (student mode), use that instead of auth listener
    if (propUser !== undefined) {
      setUser(propUser)
      return
    }

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser)
    })
    return () => unsubscribe()
  }, [propUser])

  // Check if this is a temporary wheel from sessionStorage
  useEffect(() => {
    const wheelSource = sessionStorage.getItem('wheelSource')
    const customWheelData = sessionStorage.getItem('customWheelData')
    
    if (wheelSource === 'saved-wheels-manager-new' && customWheelData) {
      try {
        const data = JSON.parse(customWheelData)
        if (data.isTemporary) {
          setIsTemporaryWheel(true)
          setTempWheelData(data)
        }
      } catch (error) {
        console.error('Error parsing wheel data:', error)
      }
    }
  }, [])

  // Initialize participants based on wheel type or external participants
  useEffect(() => {
    if (externalParticipants && externalParticipants.length > 0) {
      // Use external participants if provided
      const convertedParticipants = externalParticipants.map(p => ({
        id: p.id,
        name: p.name
      }))
      // Check if external participants have actually changed
      const currentExternal = JSON.stringify(externalParticipants)
      if (prevExternalParticipantsRef.current !== currentExternal) {
        setParticipants(convertedParticipants)
        prevExternalParticipantsRef.current = currentExternal
      }
    } else {
      // Always initialize participants when wheel type changes, regardless of current state
      initializeParticipants()
    }
  }, [wheelType.id, externalParticipants])

  // Notify parent when participants change (but avoid infinite loops)
  useEffect(() => {
    if (onParticipantsChange && participants.length > 0) {
      const currentParticipants = JSON.stringify(participants)
      // Only call onParticipantsChange if participants have actually changed
      if (lastSentParticipantsRef.current !== currentParticipants) {
        onParticipantsChange(participants)
        lastSentParticipantsRef.current = currentParticipants
      }
    }
  }, [participants, onParticipantsChange])

  const initializeParticipants = () => {
    // Skip initialization only if external participants are provided
    if (externalParticipants && externalParticipants.length > 0) {
      return
    }

    let items: string[] = []

    switch (wheelType.id) {
      case "number-picker":
        items = generateNumberRange(numberRange.start, numberRange.end)
        break
      case "date-picker":
        if (wheelType.defaultItems.includes("Monday")) {
          // Default to days of week
          items = wheelType.defaultItems
        } else {
          items = generateDateRange(new Date(dateRange.start), new Date(dateRange.end))
        }
        break
      default:
        items = [...wheelType.defaultItems]
    }

    const newParticipants = items.map((item, index) => ({
      id: `${wheelType.id}-${index}`,
      name: item
    }))
    setParticipants(newParticipants)
  }

  const handleBackToSavedWheels = () => {
    if (isTemporaryWheel && !isSaving) {
      // Show warning if wheel hasn't been saved
      const confirmed = confirm(
        `⚠️ Unsaved Wheel Warning\n\n` +
        `Your wheel "${tempWheelData?.title || 'Untitled'}" has NOT been saved yet!\n` +
        `If you go back now, this wheel will be lost.\n\n` +
        `Click OK to go back anyway (wheel will be lost)\n` +
        `Click Cancel to stay and save your wheel first`
      )

      if (!confirmed) {
        // User chose to stay
        toast({
          title: "💡 Tip",
          description: "Click 'Save Wheel Permanently' to save your wheel before going back.",
        })
        return
      }
    }

    // Proceed to go back
    if (onBackToSavedWheels) {
      onBackToSavedWheels()
    }
  }

  const handleSaveWheelClick = () => {
    if (!user || !tempWheelData) {
      toast({
        title: "Unable to Save",
        description: "You must be logged in to save wheels",
        variant: "destructive"
      })
      return
    }

    // Show confirmation dialog
    const confirmed = confirm(
      `💾 Save "${tempWheelData.title}" Permanently?\n\n` +
      `This will save your wheel with ${participants.length} items to Firestore.\n` +
      `You'll be able to access it anytime from your Saved Wheels.\n\n` +
      `Click OK to save permanently.`
    )

    if (confirmed) {
      saveWheelToFirestore()
    }
  }

  const saveWheelToFirestore = async () => {
    if (!user || !tempWheelData) {
      toast({
        title: "Unable to Save",
        description: "You must be logged in to save wheels",
        variant: "destructive"
      })
      return
    }

    setIsSaving(true)

    try {
      const wheelData = {
        title: tempWheelData.title,
        description: tempWheelData.description,
        category: tempWheelData.category,
        participants: participants.map(p => p.name),
        settings: tempWheelData.settings,
        isFavorite: false,
        timesUsed: 0,
        createdAt: serverTimestamp(),
        createdBy: user.uid,
        wheelType: "custom-wheel",
        isCustomWheel: true
      }

      const docRef = await addDoc(collection(db, "wheelPresets"), wheelData)

      // Also save to wheelTypes collection for live organizer dropdown
      const categoryIcons: Record<string, string> = {
        academic: "📚",
        research: "🔬",
        entertainment: "🎮",
        personal: "👤"
      }

      const wheelTypeData = {
        value: docRef.id,
        label: tempWheelData.title,
        description: tempWheelData.description || `${tempWheelData.title} - Custom wheel`,
        enabled: true,
        order: Date.now(),
        allowedRoles: ["organizer", "participant"],
        isActivityWheel: false,
        canBeShared: true,
        hiddenForNewUsers: false,
        icon: categoryIcons[tempWheelData.category] || "🎯",
        category: tempWheelData.category,
        isPreset: false,
        defaultItems: participants.map(p => p.name),
        defaultSettings: tempWheelData.settings,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: user.uid,
        isCustomWheel: true
      }

      await addDoc(collection(db, "wheelTypes"), wheelTypeData)

      toast({
        title: "✅ Wheel Saved Successfully!",
        description: `"${tempWheelData.title}" has been saved permanently and is now available in your saved wheels.`
      })

      // Mark as no longer temporary
      setIsTemporaryWheel(false)
      sessionStorage.removeItem('customWheelData')
      sessionStorage.removeItem('wheelSource')

    } catch (error) {
      console.error("Error saving wheel:", error)
      toast({
        title: "Save Failed",
        description: "Failed to save wheel. Please try again.",
        variant: "destructive"
      })
    } finally {
      setIsSaving(false)
    }
  }

  const addItem = () => {
    if (!newItem.trim()) {
      toast({
        title: "Empty Item",
        description: "Please enter a name or item before adding",
        variant: "destructive"
      })
      return
    }

    // Check for duplicate items
    if (participants.some(p => p.name.toLowerCase() === newItem.trim().toLowerCase())) {
      toast({
        title: "Duplicate Item",
        description: "This item already exists in the wheel",
        variant: "destructive"
      })
      return
    }

    // Allow unlimited items for solo picker wheels (not team-picker or image-picker)
    const isSoloPickerWheel = wheelType.id !== 'team-picker' && wheelType.id !== 'image-picker'
    if (!isSoloPickerWheel && wheelType.maxItems && participants.length >= wheelType.maxItems) {
      toast({
        title: "Maximum items reached",
        description: `This wheel can only have ${wheelType.maxItems} items`,
        variant: "destructive"
      })
      return
    }

    const newParticipant: Participant = {
      id: `custom-${Date.now()}`,
      name: newItem.trim()
    }

    const updatedParticipants = [...participants, newParticipant]
    setParticipants(updatedParticipants)

    // Update external participants if callback is provided
    if (onParticipantsChange) {
      onParticipantsChange(updatedParticipants)
    }

    // Force wheel re-render immediately (SOLO MODE ONLY)
    if (soloMode) {
      setWheelRefreshTrigger(prev => prev + 1)
    }

    setNewItem("")

    toast({
      title: "✅ Item Added!",
      description: `"${newItem.trim()}" has been added to the wheel${soloMode ? ' - Instant update!' : ''}`,
    })
  }

  const removeItem = (id: string) => {
    // Allow deletion of all items - no minimum restriction for better UX
    const removedItem = participants.find(p => p.id === id)
    const updatedParticipants = participants.filter(p => p.id !== id)
    setParticipants(updatedParticipants)

    // Update external participants if callback is provided
    if (onParticipantsChange) {
      onParticipantsChange(updatedParticipants)
    }

    // Force wheel re-render immediately (SOLO MODE ONLY) - Increment AFTER setting state
    if (soloMode) {
      setWheelRefreshTrigger(prev => prev + 1)
    }

    toast({
      title: "✅ Item Removed",
      description: `"${removedItem?.name}" has been removed${soloMode ? ' - Instant update!' : ''}`,
    })
  }

  const resetToDefault = () => {
    // Reset to default items
    const defaultParticipants = wheelType.defaultItems.map((item, index) => ({
      id: `default-${index}`,
      name: item
    }))

    setParticipants(defaultParticipants)

    // Update external participants if callback is provided
    if (onParticipantsChange) {
      onParticipantsChange(defaultParticipants)
    }

    setIsCustomizing(false)
    
    // Force wheel re-render immediately (SOLO MODE ONLY) - Increment AFTER setting state
    if (soloMode) {
      setWheelRefreshTrigger(prev => prev + 1)
    }

    toast({
      title: "✅ Reset Complete",
      description: `Wheel has been reset to default items${soloMode ? ' - Instant update!' : ''}`
    })
  }

  const clearAllItems = () => {
    // Clear all items from the wheel
    setParticipants([])

    // Clear the input field text as well
    setNewItem("")

    // Update external participants if callback is provided
    if (onParticipantsChange) {
      onParticipantsChange([])
    }

    // Force wheel re-render immediately (SOLO MODE ONLY) - Increment AFTER setting state
    if (soloMode) {
      setWheelRefreshTrigger(prev => prev + 1)
    }

    toast({
      title: "✅ All Items Cleared",
      description: `All items have been removed${soloMode ? ' - Instant update!' : ''}`
    })
  }

  const updateNumberRange = () => {
    const items = generateNumberRange(numberRange.start, numberRange.end)
    const newParticipants = items.map((item, index) => ({
      id: `number-${index}`,
      name: item
    }))
    setParticipants(newParticipants)
    
    // Force wheel re-render immediately (SOLO MODE ONLY) - Increment AFTER setting state
    if (soloMode) {
      setWheelRefreshTrigger(prev => prev + 1)
    }
  }

  const updateDateRange = () => {
    const items = generateDateRange(new Date(dateRange.start), new Date(dateRange.end))
    const newParticipants = items.map((item, index) => ({
      id: `date-${index}`,
      name: item
    }))
    setParticipants(newParticipants)
    
    // Force wheel re-render immediately (SOLO MODE ONLY) - Increment AFTER setting state
    if (soloMode) {
      setWheelRefreshTrigger(prev => prev + 1)
    }
  }

  const exportItems = () => {
    const itemsList = participants.map(p => p.name).join('\n')
    const blob = new Blob([itemsList], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${wheelType.title.replace(/\s+/g, '-').toLowerCase()}-items.txt`
    a.click()
    URL.revokeObjectURL(url)
    
    toast({
      title: "Items Exported",
      description: "Items list has been downloaded"
    })
  }

  const shareWheel = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: wheelType.title,
          text: wheelType.description,
          url: window.location.href
        })
      } catch (error) {
        // Fallback to clipboard
        navigator.clipboard.writeText(window.location.href)
        toast({
          title: "Link Copied",
          description: "Wheel link has been copied to clipboard"
        })
      }
    } else {
      navigator.clipboard.writeText(window.location.href)
      toast({
        title: "Link Copied",
        description: "Wheel link has been copied to clipboard"
      })
    }
  }

  const handleBackToDashboard = () => {
    // Route to appropriate dashboard based on user role
    if (userRole === 'admin') {
      router.push('/admin-dashboard')
    } else if (userRole === 'organizer') {
      router.push('/organizer')
    } else if (userRole === 'participant') {
      router.push('/participants')
    } else {
      router.push('/') // Default to main dashboard
    }
  }

  const saveCustomWheel = async () => {
    if (!user || participants.length === 0) {
      toast({
        title: "Cannot Save Wheel",
        description: "Please add participants and ensure you're logged in",
        variant: "destructive"
      })
      return
    }

    try {
      const wheelData = {
        title: `${wheelType.title} (Custom)`,
        description: `Custom ${wheelType.title} with ${participants.length} participants`,
        category: wheelType.category || "personal",
        participants: participants.map(p => p.name),
        settings: {
          numberOfWinners: 1,
          theme: "default",
          hasConfetti: true,
          hasSound: true,
          congratsMessage: "Congratulations, {winner}!"
        },
        isFavorite: false,
        timesUsed: 0,
        createdAt: serverTimestamp(),
        createdBy: user.uid,
        wheelType: wheelType.id,
        isCustomWheel: true
      }

      const docRef = await addDoc(collection(db, "wheelPresets"), wheelData)

      toast({
        title: "✅ Wheel Saved!",
        description: "Your custom wheel has been saved and is now available in your saved wheels."
      })

    } catch (error) {
      console.error("Error saving custom wheel:", error)
      toast({
        title: "Error",
        description: "Failed to save custom wheel. Please try again.",
        variant: "destructive"
      })
    }
  }

  const useInSoloMode = () => {
    if (participants.length === 0) {
      toast({
        title: "No Participants",
        description: "Please add participants to the wheel first",
        variant: "destructive"
      })
      return
    }

    // Store custom wheel data in sessionStorage for solo mode
    sessionStorage.setItem('customWheelData', JSON.stringify({
      id: `temp-${Date.now()}`,
      title: `${wheelType.title} (Custom)`,
      description: `Custom ${wheelType.title}`,
      participants: participants.map(p => p.name),
      settings: {
        numberOfWinners: 1,
        theme: "default",
        hasConfetti: true,
        hasSound: true,
        congratsMessage: "Congratulations, {winner}!"
      },
      category: wheelType.category || "personal"
    }))

    // Navigate to picker wheel gallery with custom wheel
    router.push('/picker-wheel/custom')

    toast({
      title: "🎯 Solo Mode Activated",
      description: "Your custom wheel is now ready for solo play!"
    })
  }


  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="text-4xl p-3 rounded-lg"
            style={{ backgroundColor: `${wheelType.color}20` }}
          >
            {wheelType.icon}
          </div>
          <div>
            <h1 className="text-3xl font-bold text-swu-red">{wheelType.title}</h1>
            <Badge
              className="mt-1"
              style={{ backgroundColor: `${wheelType.color}20`, color: wheelType.color }}
            >
              {participants.length} items
            </Badge>
            {soloMode && (
              <Badge variant="outline" className="mt-1 ml-2 text-blue-600 border-blue-600">
                Solo Mode
              </Badge>
            )}
          </div>
        </div>
        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {!soloMode && (
            <>
              <Button
                variant="outline"
                onClick={() => setIsCustomizing(!isCustomizing)}
                className="flex items-center gap-2"
              >
                <Settings className="h-4 w-4" />
                {isCustomizing ? "Hide Settings" : "Customize"}
              </Button>

              {user && (
                <Button
                  onClick={() => setIsModalOpen(true)}
                  className="bg-[#8e0b16] hover:bg-[#66181E] text-white"
                >
                  <Target className="h-4 w-4 mr-2" />
                  Create Activity
                </Button>
              )}
            </>
          )}

          {isTemporaryWheel && user && (
            <Button
              onClick={handleSaveWheelClick}
              disabled={isSaving}
              className="bg-orange-600 hover:bg-orange-700 text-white"
            >
              {isSaving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Wheel Permanently
                </>
              )}
            </Button>
          )}

          {onBackToSavedWheels && (
            <Button
              variant="outline"
              onClick={handleBackToSavedWheels}
              className="bg-green-50 hover:bg-green-100 text-green-700 border-green-300"
            >
              ← Back to Saved Wheels
            </Button>
          )}

          {onBack && !onBackToSavedWheels && (
            <Button
              variant="outline"
              onClick={onBack}
            >
              Back to Gallery
            </Button>
          )}


        </div>

      </div>

      <div className={`grid gap-6 ${soloMode && (wheelType.id === 'team-picker' || wheelType.id === 'image-picker') ? 'grid-cols-1 max-w-7xl mx-auto' : 'grid-cols-1 lg:grid-cols-3'}`}>
        {/* Wheel / Team Picker */}
        <div className={`${soloMode && (wheelType.id === 'team-picker' || wheelType.id === 'image-picker') ? 'max-w-7xl mx-auto' : 'lg:col-span-2'}`}>
          {wheelType.id === 'team-picker' ? (
            <div className={`space-y-4 ${soloMode ? 'p-12' : ''}`}>
              <EnhancedTeamPicker
                key={`team-picker-${soloMode ? wheelRefreshTrigger : wheelType.id}`}
                initialNames={participants.length > 0 ? participants.map(p => p.name) : wheelType.defaultItems}
                canEdit={true}
                onTeamsGenerated={(teams) => {
                  toast({
                    title: "Teams Generated! 🎉",
                    description: `Created ${teams.length} teams successfully`,
                  })
                }}
                disabled={false}
                readonly={false}
              />
            </div>
          ) : wheelType.id === 'image-picker' ? (
            soloMode ? (
              // In solo mode, use Image Picker Wheel functionality
              <ImagePickerWheel
                key={`image-picker-${soloMode ? wheelRefreshTrigger : wheelType.id}`}
                slices={participants.map(p => ({
                  id: p.id,
                  text: p.name,
                  color: "#8B0000", // School theme maroon
                  image: undefined
                }))}
                onSpinComplete={(result) => {
                  toast({
                    title: "Spin Complete!",
                    description: `Selected ${result.winners.length} winner${result.winners.length > 1 ? 's' : ''}: ${result.winners.map((w: any) => w.name || w.text).join(", ")}`
                  })
                }}
                isLiveMode={false}
                organizerMode={true}
                userPermissions={{
                  isFullAccessCollaborator: false,
                  canTriggerSynchronizedSpin: true,
                  synchronizationEnabled: false,
                  sessionId: undefined,
                  userRole: userRole
                }}
                useEnhancedSpinning={false}
                wheelTitle={wheelType.title}
                wheelTheme={{
                  primary: "#8B0000", // Maroon
                  secondary: "#800000", // Darker maroon
                  accent: "#ffffff",
                  background: "#ffffff"
                }}
              />
            ) : (
              // In non-solo mode, show restriction message
              <Card>
                <CardContent className="p-6">
                  <div className="text-center py-8">
                    <div className="text-4xl mb-4">🖼️</div>
                    <h3 className="text-lg font-semibold mb-2">Image Picker Wheel</h3>
                    <p className="text-muted-foreground mb-4">
                      This wheel type is available in the enhanced wheel component with full image picker functionality.
                    </p>
                    <Button
                      onClick={() => router.push('/picker-wheel/image-picker')}
                      className="bg-[#8e0b16] hover:bg-[#66181E] text-white"
                    >
                      Use Enhanced Image Picker
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          ) : (
            <Card>
              <CardContent className="p-6">
                <EnhancedWheel
                  key={`enhanced-wheel-${soloMode ? wheelRefreshTrigger : wheelType.id}`}
                  participants={participants}
                  selectedWheelType={wheelType}
                  numberOfWinners={numberOfWinners}
                  customCongratsMessage={customCongratsMessage}
                  onSpinComplete={(result) => {
                    toast({
                      title: "Spin Complete!",
                      description: `Selected ${result.winners.length} winner${result.winners.length > 1 ? 's' : ''}: ${result.winners.map(w => w.name).join(", ")}`
                    })
                  }}
                  userRole={userRole}
                  {...(!soloMode && { onBackToDashboard: handleBackToDashboard })}
                  userPermissions={{
                    canTriggerSynchronizedSpin: true, // Allow spinning for all authenticated users
                    synchronizationEnabled: !soloMode,
                    sessionId: undefined,
                    userRole: userRole
                  }}
                />
              </CardContent>
            </Card>
          )}
        </div>

        {/* Settings Panel - Hide in Team Picker and Image Picker Solo Mode */}
        <div className={`space-y-4 ${soloMode && (wheelType.id === 'team-picker' || wheelType.id === 'image-picker') ? 'hidden' : ''}`}>
          {/* Current Items Section - Always visible for customizable wheels */}
          {(wheelType.isCustomizable || externalParticipants) && (
            <Card className="border-2 border-red-800 bg-white">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-blue-900">
                      📋 Current Items
                      <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                        {participants.length}
                      </Badge>
                    </CardTitle>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowCurrentItems(!showCurrentItems)}
                    className="text-blue-600 hover:text-blue-800 hover:bg-blue-100"
                  >
                    {showCurrentItems ? (
                      <>
                        <ChevronUp className="h-4 w-4 mr-1" />
                        Hide
                      </>
                    ) : (
                      <>
                        <ChevronDown className="h-4 w-4 mr-1" />
                        Show
                      </>
                    )}
                  </Button>
                </div>
              </CardHeader>
              {showCurrentItems && (
                <CardContent className="space-y-6">
                  {/* Manual Item Management */}
                  <div className="space-y-4">
                    {/* Single Custom Ending Message for All Winners */}
                    <div className="space-y-2 p-4 bg-green-50 rounded-lg border border-green-200">
                      <Label className="text-sm font-medium text-green-800">Custom Congratulation Message</Label>
                      <Input
                        placeholder="e.g., Congratulations! You won the prize!"
                        value={customCongratsMessage}
                        onChange={(e) => setCustomCongratsMessage(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && e.preventDefault()}
                        className="text-sm"
                      />
                      <p className="text-xs text-green-700">
                        This message will be shown for all winners in the announce winner section.
                      </p>
                    </div>

                    {/* Spin Mode Selector */}
                    {participants.length > 0 && (
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Spin Mode</Label>
                        <Select
                          value={spinMode}
                          onValueChange={(value: 'random' | 'manual') => {
                            setSpinMode(value)
                            if (value === 'random') {
                              setSelectedWinners([])
                            }
                          }}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Choose how to select winners" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="random">🎲 Random Spin</SelectItem>
                            <SelectItem value="manual">🎯 Select Specific Winners</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          Choose random spinning or manually select specific winners
                        </p>
                      </div>
                    )}

                    {/* Number of Winners Selector - Only show for random mode */}
                    {participants.length > 1 && spinMode === 'random' && (
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Number of Random Winners</Label>
                        <Select
                          value={numberOfWinners.toString()}
                          onValueChange={(value) => setNumberOfWinners(parseInt(value))}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select number of winners" />
                          </SelectTrigger>
                          <SelectContent>
                            {Array.from({ length: Math.min(participants.length, 20) }, (_, i) => i + 1).map((num) => (
                              <SelectItem key={num} value={num.toString()}>
                                {num} Winner{num > 1 ? 's' : ''}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          Select how many random winners to pick when the wheel spins
                        </p>
                      </div>
                    )}

                    {/* Manual Winner Selection */}
                    {spinMode === 'manual' && participants.length > 0 && (
                      <div className="space-y-3">
                        <Label className="text-sm font-medium">Select Winners ({selectedWinners.length} selected)</Label>
                        <div className="max-h-48 overflow-y-auto space-y-2 border rounded-lg p-3 bg-gray-50">
                          {participants.map((participant, index) => {
                            const isSelected = selectedWinners.some(w => w.id === participant.id)
                            return (
                              <div
                                key={participant.id}
                                className={`flex items-center justify-between p-2 rounded cursor-pointer transition-colors ${
                                  isSelected
                                    ? 'bg-blue-100 border border-blue-300'
                                    : 'bg-white border border-gray-200 hover:bg-gray-100'
                                }`}
                                onClick={() => {
                                  if (isSelected) {
                                    setSelectedWinners(prev => prev.filter(w => w.id !== participant.id))
                                  } else {
                                    setSelectedWinners(prev => [...prev, participant])
                                  }
                                }}
                              >
                                <span className="text-sm font-medium">{index + 1}. {participant.name}</span>
                                {isSelected && (
                                  <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                                    <span className="text-white text-xs">✓</span>
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                        {selectedWinners.length > 0 && (
                          <Button
                            onClick={() => {
                              toast({
                                title: "🎯 Winners Selected!",
                                description: `Selected winners: ${selectedWinners.map(w => w.name).join(", ")}`
                              })
                            }}
                            className="w-full bg-green-600 hover:bg-green-700"
                          >
                            Confirm Selected Winners ({selectedWinners.length})
                          </Button>
                        )}
                        <p className="text-xs text-muted-foreground">
                          Click on participants to select them as winners
                        </p>
                      </div>
                    )}

                    {/* Add Item Section */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Add Individual Item</Label>
                      <div className="flex gap-2">
                        <Input
                          placeholder="Enter name or item..."
                          value={newItem}
                          onChange={(e) => setNewItem(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && addItem()}
                          className="flex-1"
                        />
                        <Button onClick={addItem} size="sm" className="bg-[#8e0b16] hover:bg-[#66181E]">
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Items List */}
                    <div className="max-h-64 overflow-y-auto space-y-2">
                      {participants.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          <div className="text-4xl mb-2">📝</div>
                          <p className="text-sm">No items added yet</p>
                          <p className="text-xs">Use CSV upload below or add items manually</p>
                        </div>
                      ) : (
                        participants.map((participant, index) => (
                          <div
                            key={participant.id}
                            className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow"
                          >
                            <span className="text-sm font-medium flex-1">{index + 1}. {participant.name}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeItem(participant.id)}
                              className="h-8 w-8 p-0 hover:bg-red-100 hover:text-red-600 ml-2 flex-shrink-0"
                              title="Click to remove this item"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Action buttons */}
                    <div className="flex gap-2 pt-2 border-t">
                      <Button variant="outline" onClick={clearAllItems} className="flex-1">
                        <Trash2 className="h-4 w-4 mr-2" />
                        Clear All
                      </Button>
                      <Button variant="outline" onClick={resetToDefault} className="flex-1">
                        <RotateCcw className="h-4 w-4 mr-2" />
                        Reset to Default
                      </Button>
                    </div>

                    {/* CSV Import Section */}
                    <div className="space-y-4 pt-4">
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {/* Template Download */}
                        <div className="space-y-2">
                          <Label className="text-xs font-medium text-blue-900">Download Template</Label>
                          <Button
                            onClick={() => {
                            // Create an empty CSV template with just the header
                            const csvContent = "Name\n"

                              // Create and download the file
                              const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
                              const link = document.createElement('a')
                              const url = URL.createObjectURL(blob)
                              link.setAttribute('href', url)
                              link.setAttribute('download', 'wheel-participants-template.csv')
                              link.style.visibility = 'hidden'
                              document.body.appendChild(link)
                              link.click()
                              document.body.removeChild(link)
                              URL.revokeObjectURL(url)

                              toast({
                                title: "📥 Template Downloaded",
                                description: "CSV template with 50 sample names has been downloaded",
                              })
                            }}
                            variant="outline"
                            className="w-full border-blue-300 text-blue-700 hover:bg-blue-100 text-xs"
                          >
                            <Download className="h-3 w-3 mr-1" />
                            Download Template
                          </Button>
                        </div>

                        {/* File Upload */}
                        <div className="space-y-2">
                          <Label className="text-xs font-medium text-blue-900">Upload Your CSV</Label>
                          <div className="border-2 border-dashed border-blue-300 rounded-lg p-3 hover:border-blue-400 transition-colors bg-white">
                            <div className="text-center">
                              <Upload className="h-6 w-6 mx-auto mb-1 text-blue-400" />
                              <input
                                type="file"
                                accept=".csv,text/csv,text/plain"
                                onChange={(e) => {
                                  const file = e.target.files?.[0]
                                  if (file) {
                                    // Basic validation
                                    if (!file.name.toLowerCase().endsWith('.csv') &&
                                        !file.type.includes('csv') &&
                                        !file.type.includes('text')) {
                                      toast({
                                        title: "Invalid file type",
                                        description: "Please select a CSV file (.csv)",
                                        variant: "destructive"
                                      })
                                      return
                                    }

                                    if (file.size > 5 * 1024 * 1024) { // 5MB limit
                                      toast({
                                        title: "File too large",
                                        description: "Please select a CSV file smaller than 5MB",
                                        variant: "destructive"
                                      })
                                      return
                                    }

                                    // Simple CSV parsing
                                    const reader = new FileReader()
                                    reader.onload = (event) => {
                                      try {
                                        const csv = event.target?.result as string
                                        const lines = csv.split(/\r\n|\r|\n/).map(line => line.trim()).filter(line => line.length > 0)

                                        if (lines.length < 2) {
                                          throw new Error("CSV file must contain at least a header row and one data row")
                                        }

                                        // Parse names (skip header, use first column)
                                        const names: string[] = []
                                        for (let i = 1; i < lines.length && names.length < 5000; i++) {
                                          const cells = lines[i].split(/[,;|\t]/).map(cell => cell.replace(/"/g, '').trim())
                                          if (cells.length > 0 && cells[0] && cells[0].length > 0) {
                                            names.push(cells[0])
                                          }
                                        }

                                        if (names.length === 0) {
                                          throw new Error("No valid names found in CSV file")
                                        }

                                        // Update participants
                                        const newParticipants = names.map((name, index) => ({
                                          id: `csv-${Date.now()}-${index}`,
                                          name: name
                                        }))

                                        setParticipants(newParticipants)
                                        onParticipantsChange?.(newParticipants)

                                        // Force wheel re-render immediately (SOLO MODE ONLY)
                                        if (soloMode) {
                                          setWheelRefreshTrigger(prev => prev + 1)
                                        }

                                        toast({
                                          title: "✅ CSV Imported Successfully!",
                                          description: `Added ${names.length} participants from your CSV file${soloMode ? ' - Instant update!' : ''}`,
                                        })

                                      } catch (error: any) {
                                        toast({
                                          title: "CSV Import Failed",
                                          description: error.message || "Failed to process the CSV file",
                                          variant: "destructive"
                                        })
                                      }
                                    }
                                    reader.readAsText(file, 'utf-8')
                                  }
                                }}
                                className="hidden"
                                id="csv-upload-current-items"
                              />
                              <label htmlFor="csv-upload-current-items" className="cursor-pointer">
                                <Button variant="outline" className="border-blue-300 text-blue-700 hover:bg-blue-100 text-xs" asChild>
                                  <span>
                                    <Upload className="h-3 w-3 mr-1" />
                                    Choose CSV File
                                  </span>
                                </Button>
                              </label>
                              <p className="text-xs text-blue-600 mt-1">
                                Supports Excel CSV files with any delimiter
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>
          )}

          {/* Show Current Items section in solo mode for customizable wheels - HIDDEN since we now have the main Current Items section */}
          {false && (soloMode && wheelType.isCustomizable && wheelType.id !== 'team-picker' && wheelType.id !== 'image-picker') && (
            <>
              {/* CSV Upload Section - Prominent in solo mode */}
              <Card className="border-2 border-blue-200 bg-blue-50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-blue-900">
                    <Upload className="h-5 w-5" />
                    Import Participants from CSV
                  </CardTitle>
                  <CardDescription className="text-blue-700">
                    Upload a CSV file with participant names or download our template to get started quickly
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Template Download */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-blue-900">Download Template</Label>
                      <Button
                        onClick={() => {
                          // Create a sample CSV template with 50 example names
                          const sampleNames = [
                            "John Smith", "Sarah Johnson", "Michael Brown", "Emily Davis", "David Wilson",
                            "Lisa Garcia", "James Miller", "Jennifer Martinez", "Robert Anderson", "Maria Rodriguez",
                            "William Taylor", "Jessica Lopez", "Christopher Lee", "Amanda Gonzalez", "Daniel Harris",
                            "Ashley Clark", "Matthew Lewis", "Brittany Robinson", "Anthony Walker", "Samantha Hall",
                            "Joseph Young", "Rachel Allen", "Andrew King", "Lauren Wright", "Ryan Scott",
                            "Stephanie Green", "Nicholas Adams", "Michelle Baker", "Jonathan Nelson", "Rebecca Carter",
                            "Brandon Mitchell", "Laura Perez", "Tyler Roberts", "Hannah Turner", "Austin Phillips",
                            "Megan Campbell", "Kevin Parker", "Rachel Evans", "Justin Edwards", "Kimberly Collins",
                            "Jordan Stewart", "Nicole Sanchez", "Christian Morris", "Christina Rogers", "Dylan Reed",
                            "Amanda Cook", "Logan Morgan", "Victoria Bell", "Cameron Murphy", "Jasmine Bailey"
                          ]

                          // Create CSV content with header
                          const csvContent = "Name\n" + sampleNames.map(name => `"${name}"`).join('\n')

                          // Create and download the file
                          const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
                          const link = document.createElement('a')
                          const url = URL.createObjectURL(blob)
                          link.setAttribute('href', url)
                          link.setAttribute('download', 'wheel-participants-template.csv')
                          link.style.visibility = 'hidden'
                          document.body.appendChild(link)
                          link.click()
                          document.body.removeChild(link)
                          URL.revokeObjectURL(url)

                          toast({
                            title: "📥 Template Downloaded",
                            description: "CSV template with 50 sample names has been downloaded",
                          })
                        }}
                        variant="outline"
                        className="w-full border-blue-300 text-blue-700 hover:bg-blue-100"
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Download Template (50 names)
                      </Button>
                      <p className="text-xs text-blue-600">
                        Get started quickly with our sample template
                      </p>
                    </div>

                    {/* File Upload */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-blue-900">Upload Your CSV</Label>
                      <div className="border-2 border-dashed border-blue-300 rounded-lg p-4 hover:border-blue-400 transition-colors bg-white">
                        <div className="text-center">
                          <Upload className="h-8 w-8 mx-auto mb-2 text-blue-400" />
                          <input
                            type="file"
                            accept=".csv,text/csv,text/plain"
                            onChange={(e) => {
                              const file = e.target.files?.[0]
                              if (file) {
                                // Basic validation
                                if (!file.name.toLowerCase().endsWith('.csv') &&
                                    !file.type.includes('csv') &&
                                    !file.type.includes('text')) {
                                  toast({
                                    title: "Invalid file type",
                                    description: "Please select a CSV file (.csv)",
                                    variant: "destructive"
                                  })
                                  return
                                }

                                if (file.size > 5 * 1024 * 1024) { // 5MB limit
                                  toast({
                                    title: "File too large",
                                    description: "Please select a CSV file smaller than 5MB",
                                    variant: "destructive"
                                  })
                                  return
                                }

                                // Simple CSV parsing for solo mode
                                const reader = new FileReader()
                                reader.onload = (event) => {
                                  try {
                                    const csv = event.target?.result as string
                                    const lines = csv.split(/\r\n|\r|\n/).map(line => line.trim()).filter(line => line.length > 0)

                                    if (lines.length < 2) {
                                      throw new Error("CSV file must contain at least a header row and one data row")
                                    }

                                    // Parse names (skip header, use first column)
                                    const names: string[] = []
                                    for (let i = 1; i < lines.length && names.length < 5000; i++) {
                                      const cells = lines[i].split(/[,;|\t]/).map(cell => cell.replace(/"/g, '').trim())
                                      if (cells.length > 0 && cells[0] && cells[0].length > 0) {
                                        names.push(cells[0])
                                      }
                                    }

                                    if (names.length === 0) {
                                      throw new Error("No valid names found in CSV file")
                                    }

                                    // Update participants
                                    const newParticipants = names.map((name, index) => ({
                                      id: `csv-${Date.now()}-${index}`,
                                      name: name
                                    }))

                                    setParticipants(newParticipants)
                                    onParticipantsChange?.(newParticipants)

                                    toast({
                                      title: "✅ CSV Imported Successfully!",
                                      description: `Added ${names.length} participants from your CSV file`,
                                    })

                                  } catch (error: any) {
                                    toast({
                                      title: "CSV Import Failed",
                                      description: error.message || "Failed to process the CSV file",
                                      variant: "destructive"
                                    })
                                  }
                                }
                                reader.readAsText(file, 'utf-8')
                              }
                            }}
                            className="hidden"
                            id="csv-upload"
                          />
                          <label htmlFor="csv-upload" className="cursor-pointer">
                            <Button variant="outline" className="border-blue-300 text-blue-700 hover:bg-blue-100" asChild>
                              <span>
                                <Upload className="h-4 w-4 mr-2" />
                                Choose CSV File
                              </span>
                            </Button>
                          </label>
                          <p className="text-xs text-blue-600 mt-2">
                            Supports Excel CSV files with any delimiter
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* CSV Format Help */}
                  <div className="bg-white rounded-lg border border-blue-200 p-3">
                    <h4 className="font-medium text-blue-900 mb-2 text-sm">CSV Format Guide:</h4>
                    <div className="text-xs text-blue-800 space-y-1">
                      <p>• First row: Headers (e.g., "Name", "Participant", "Student")</p>
                      <p>• Subsequent rows: Participant names in the first column</p>
                      <p>• Supports: Comma, semicolon, tab, and pipe delimiters</p>
                      <p>• Maximum: 5,000 participants per file</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Current Items Management */}
              <Card>
                <CardHeader>
                  <CardTitle>Current Items ({participants.length})</CardTitle>
                  <CardDescription>
                    Add custom items manually or manage your imported participants. Click the trash icon to remove items.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Number of Winners Selector */}
                  {participants.length > 1 && (
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Number of Random Winners</Label>
                      <Select
                        value={numberOfWinners.toString()}
                        onValueChange={(value) => setNumberOfWinners(parseInt(value))}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select number of winners" />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: Math.min(participants.length, 20) }, (_, i) => i + 1).map((num) => (
                            <SelectItem key={num} value={num.toString()}>
                              {num} Winner{num > 1 ? 's' : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                        <p className="text-xs text-muted-foreground mt-1">
                          Maximum 20 winners allowed
                        </p>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Select how many random winners to pick when the wheel spins
                      </p>
                    </div>
                  )}

                  {/* Add Item Section */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Add Individual Item</Label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Enter name or item..."
                        value={newItem}
                        onChange={(e) => setNewItem(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && addItem()}
                        className="flex-1"
                      />
                      <Button onClick={addItem} size="sm" className="bg-[#8e0b16] hover:bg-[#66181E]">
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Items List */}
                  <div className="max-h-64 overflow-y-auto space-y-2">
                    {participants.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <div className="text-4xl mb-2">📝</div>
                        <p className="text-sm">No items added yet</p>
                        <p className="text-xs">Use CSV upload above or add items manually</p>
                      </div>
                    ) : (
                      participants.map((participant, index) => (
                        <div
                          key={participant.id}
                          className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow"
                        >
                          <span className="text-sm font-medium flex-1">{index + 1}. {participant.name}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeItem(participant.id)}
                            className="h-8 w-8 p-0 hover:bg-red-100 hover:text-red-600 ml-2 flex-shrink-0"
                            title="Click to remove this item"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Action buttons for solo mode */}
                  <div className="flex gap-2 pt-2 border-t">
                    <Button variant="outline" onClick={clearAllItems} className="flex-1">
                      <Trash2 className="h-4 w-4 mr-2" />
                      Clear All
                    </Button>
                    <Button variant="outline" onClick={resetToDefault} className="flex-1">
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Reset to Default
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {isCustomizing && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Wheel Settings
                </CardTitle>
                <CardDescription>
                  Customize your wheel items and settings
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Number Range Settings */}
                {wheelType.id === "number-picker" && (
                  <div className="space-y-3">
                    <Label>Number Range</Label>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        placeholder="Start"
                        value={numberRange.start}
                        onChange={(e) => setNumberRange(prev => ({ ...prev, start: parseInt(e.target.value) || 1 }))}
                      />
                      <Input
                        type="number"
                        placeholder="End"
                        value={numberRange.end}
                        onChange={(e) => setNumberRange(prev => ({ ...prev, end: parseInt(e.target.value) || 10 }))}
                      />
                    </div>
                    <Button onClick={updateNumberRange} className="w-full">
                      Update Range
                    </Button>
                  </div>
                )}

                {/* Date Range Settings */}
                {wheelType.id === "date-picker" && (
                  <div className="space-y-3">
                    <Label>Date Range</Label>
                    <Input
                      type="date"
                      value={dateRange.start}
                      onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                    />
                    <Input
                      type="date"
                      value={dateRange.end}
                      onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                    />
                    <Button onClick={updateDateRange} className="w-full">
                      Update Dates
                    </Button>
                  </div>
                )}

                {/* Custom Items */}
                {wheelType.isCustomizable && (
                  <>
                    <Separator />
                    <div className="space-y-3">
                      <Label>Add Custom Item</Label>
                      <div className="flex gap-2">
                        <Input
                          placeholder="Enter item name..."
                          value={newItem}
                          onChange={(e) => setNewItem(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && addItem()}
                        />
                        <Button onClick={addItem} size="sm">
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </>
                )}

                <div className="flex gap-2">
                  <Button variant="outline" onClick={clearAllItems} className="flex-1">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Clear All
                  </Button>
                  <Button variant="outline" onClick={resetToDefault} className="flex-1">
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Reset to Default
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Items List - Hide for Team Picker and Image Picker in Solo Mode */}
           {!(soloMode && (wheelType.id === 'team-picker' || wheelType.id === 'image-picker')) && !soloMode && (
             <Card>
               <CardHeader>
                 <CardTitle>Current Items ({participants.length})</CardTitle>
                 <CardDescription>
                   {wheelType.isCustomizable ? "Add custom items for your wheel. Click to remove items." : "Default items for this wheel"}
                 </CardDescription>
               </CardHeader>
            <CardContent className="space-y-4">
              {/* Add Item Section - Hide for Team Picker and Image Picker in Solo Mode */}
              {(wheelType.isCustomizable || externalParticipants) && (!(soloMode && (wheelType.id === 'team-picker' || wheelType.id === 'image-picker'))) && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Add New Item</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Enter name or item..."
                      value={newItem}
                      onChange={(e) => setNewItem(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && addItem()}
                      className="flex-1"
                    />
                    <Button onClick={addItem} size="sm" className="bg-[#8e0b16] hover:bg-[#66181E]">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}

              {/* Items List */}
              <div className="max-h-64 overflow-y-auto space-y-2">
                {participants.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <div className="text-4xl mb-2">📝</div>
                    <p className="text-sm">No items added yet</p>
                    <p className="text-xs">Add items above to get started</p>
                  </div>
                ) : (
                  participants.map((participant, index) => (
                    <div
                      key={participant.id}
                      className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow"
                    >
                      <span className="text-sm font-medium flex-1">{index + 1}. {participant.name}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeItem(participant.id)}
                        className="h-8 w-8 p-0 hover:bg-red-100 hover:text-red-600 ml-2 flex-shrink-0"
                        title="Click to remove this item"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
          )}
        </div>
      </div>

      {/* Quick Activity Creator Modal - Hidden in Solo Mode */}
      {!soloMode && (
        <QuickActivityCreator
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          selectedWheel={wheelType}
        />
      )}

      {/* Wheel Type Switcher Dialog */}
      <Dialog open={isWheelSwitcherOpen} onOpenChange={setIsWheelSwitcherOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle style={{ color: wheelType.color }}>
              Switch to Different Wheel Type
            </DialogTitle>
            <DialogDescription>
              Choose a different wheel type to switch to
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
            {PICKER_WHEEL_TYPES.map((wheel) => (
              <Card
                key={wheel.id}
                className={`cursor-pointer transition-all hover:shadow-md ${
                  wheel.id === wheelType.id ? 'ring-2 ring-blue-500 bg-blue-50' : ''
                }`}
                onClick={() => {
                  if (wheel.id !== wheelType.id && onBack) {
                    // Navigate to the new wheel type
                    window.location.href = `/picker-wheel/${wheel.id}`
                  }
                }}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{wheel.icon}</span>
                    <div>
                      <CardTitle className="text-sm">{wheel.title}</CardTitle>
                      {wheel.id === wheelType.id && (
                        <Badge variant="secondary" className="text-xs">Current</Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="text-xs text-muted-foreground">
                    {wheel.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
