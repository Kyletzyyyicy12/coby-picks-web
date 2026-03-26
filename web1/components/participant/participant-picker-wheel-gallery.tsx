"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft, Target, Users, Calendar, Trophy, Search, Filter, Wifi, Loader2, Plus, Upload } from "lucide-react"
import { PICKER_WHEEL_TYPES, getVisiblePickerWheels, PICKER_CATEGORIES } from "@/lib/picker-wheel-types"
import type { PickerWheelType } from "@/lib/picker-wheel-types"
import { DynamicPickerWheel } from "@/components/picker-wheels/dynamic-picker-wheel"
import type { User as FirebaseUser } from "firebase/auth"
import { db } from "@/lib/firebase"
import { collection, query, orderBy, onSnapshot, where, addDoc, serverTimestamp, getDocs } from "firebase/firestore"
import { toast } from "@/hooks/use-toast"

interface ParticipantPickerWheelGalleryProps {
  user?: FirebaseUser | null
  onBack?: () => void
  userRole?: string
}

export function ParticipantPickerWheelGallery({ user, onBack, userRole }: ParticipantPickerWheelGalleryProps) {
  const [selectedWheel, setSelectedWheel] = useState<PickerWheelType | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<string>("all")

  // Wheel types state management
  const [enabledWheelTypes, setEnabledWheelTypes] = useState<any[]>([])
  const [wheelTypesLoading, setWheelTypesLoading] = useState(true)
  const hasInitializedRef = useRef(false)

  // Saved custom wheels state
  const [savedWheels, setSavedWheels] = useState<any[]>([])
  const [savedWheelsLoading, setSavedWheelsLoading] = useState(false)

  // Temporary unsaved wheel state
  const [tempWheelData, setTempWheelData] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Create wheel modal state
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newWheel, setNewWheel] = useState({
    title: "",
    description: "",
    category: "personal" as "academic" | "research" | "entertainment" | "personal",
    participants: "" as string,
    numberOfWinners: 1,
    theme: "default",
    hasConfetti: true,
    hasSound: true,
    congratsMessage: "Congratulations, {winner}!"
  })

  const categoryIcons = {
    academic: "📚",
    research: "🔬",
    entertainment: "🎮",
    personal: "👤"
  }

  const schoolColors = {
    primary: "#8e0b16",
    secondary: "#66181E",
    accent: "#ffffff",
    background: "#f5f5f5"
  }

  // Helper function to auto-fill participants from registered users
  const autoFillParticipants = async (setParticipants: (value: string) => void) => {
    try {
      const usersQuery = query(collection(db, "users"))
      const usersSnapshot = await getDocs(usersQuery)
      const userNames = usersSnapshot.docs
        .map(doc => {
          const userData = doc.data()
          return {
            name: userData.displayName || userData.email || "Unnamed User",
            role: userData.role || userData.userRole,
            email: userData.email
          }
        })
        .filter(user => {
          const isAdmin = user.role === 'admin' ||
                         user.role === 'administrator' ||
                         user.role === 'system admin' ||
                         user.role === 'super admin' ||
                         user.name.toLowerCase().includes('admin') ||
                         user.name.toLowerCase().includes('administrator') ||
                         user.name.toLowerCase().includes('system') ||
                         (user.email && user.email.toLowerCase().includes('admin'))
          return !isAdmin && user.name.trim().length > 0
        })
        .map(user => user.name)

      if (userNames.length > 0) {
        setParticipants(userNames.join('\n'))
        toast({
          title: "Auto-filled Participants",
          description: `Added ${userNames.length} participants from registered users.`,
        })
      } else {
        toast({
          title: "No Users Found",
          description: "No registered users were found in the system.",
          variant: "destructive"
        })
      }
    } catch (error) {
      console.error("Error auto-filling participants:", error)
      toast({
        title: "Error",
        description: "Failed to load participants from users.",
        variant: "destructive"
      })
    }
  }

  const importParticipantsFromFile = async (event: React.ChangeEvent<HTMLInputElement>, setParticipants: (value: string) => void) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const text = await file.text()
      const lines = text.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)

      if (lines.length > 0) {
        setParticipants(lines.join('\n'))
        toast({
          title: "Import Successful",
          description: `Imported ${lines.length} participants from file.`,
        })
      } else {
        toast({
          title: "No Participants Found",
          description: "The selected file contains no valid participant names.",
          variant: "destructive"
        })
      }
    } catch (error) {
      console.error("Error importing participants:", error)
      toast({
        title: "Import Failed",
        description: "Failed to import participants from file.",
        variant: "destructive"
      })
    } finally {
      event.target.value = ''
    }
  }

  const saveCurrentWheel = async () => {
    if (!user || !tempWheelData) return

    setSaving(true)
    try {
      const wheelData = {
        ...tempWheelData,
        isFavorite: false,
        timesUsed: 0,
        createdAt: serverTimestamp(),
        wheelType: "custom-wheel",
        isCustomWheel: true
      }

      const docRef = await addDoc(collection(db, "wheelPresets"), wheelData)

      // Also save to wheelTypes collection
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
        icon: categoryIcons[tempWheelData.category as keyof typeof categoryIcons] || "🎯",
        category: tempWheelData.category,
        isPreset: false,
        defaultItems: tempWheelData.participants,
        defaultSettings: {
          allowRealTimeCollection: false,
          requiresApproval: false,
          congratsMessage: tempWheelData.settings.congratsMessage,
          numberOfWinners: tempWheelData.settings.numberOfWinners,
          theme: tempWheelData.settings.theme,
          hasConfetti: tempWheelData.settings.hasConfetti,
          hasSound: tempWheelData.settings.hasSound
        },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: user.uid,
        isCustomWheel: true
      }

      await addDoc(collection(db, "wheelTypes"), wheelTypeData)

      toast({
        title: "💾 Wheel Saved!",
        description: `"${tempWheelData.title}" has been saved successfully!`
      })

      // Update the selected wheel to mark it as saved
      if (selectedWheel) {
        setSelectedWheel({
          ...selectedWheel,
          id: `saved-${docRef.id}`,
          isSavedWheel: true
        })
      }

      // Clear temp data
      setTempWheelData(null)

    } catch (error) {
      console.error("Error saving wheel:", error)
      toast({
        title: "Error",
        description: "Failed to save wheel. Please try again.",
        variant: "destructive"
      })
    } finally {
      setSaving(false)
    }
  }

  const deleteCustomWheel = async (wheelId: string) => {
    if (!user) return

    setDeleting(true)
    try {
      // Extract the actual document ID (remove 'saved-' prefix)
      const actualId = wheelId.replace('saved-', '')

      // Delete from wheelPresets
      const { deleteDoc, doc } = await import('firebase/firestore')
      await deleteDoc(doc(db, "wheelPresets", actualId))

      // Find and delete from wheelTypes
      const wheelTypesQuery = query(
        collection(db, "wheelTypes"),
        where("value", "==", actualId)
      )
      const wheelTypesSnapshot = await getDocs(wheelTypesQuery)
      for (const docSnapshot of wheelTypesSnapshot.docs) {
        await deleteDoc(doc(db, "wheelTypes", docSnapshot.id))
      }

      toast({
        title: "🗑️ Wheel Deleted",
        description: "Your custom wheel has been removed."
      })

      // Go back to gallery
      setSelectedWheel(null)

    } catch (error) {
      console.error("Error deleting wheel:", error)
      toast({
        title: "Error",
        description: "Failed to delete wheel. Please try again.",
        variant: "destructive"
      })
    } finally {
      setDeleting(false)
    }
  }

  const createCustomWheel = async () => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "You must be logged in to create custom wheels",
        variant: "destructive"
      })
      return
    }

    if (!newWheel.title.trim()) {
      toast({
        title: "Title Required",
        description: "Please enter a title for your custom wheel",
        variant: "destructive"
      })
      return
    }

    if (!newWheel.participants.trim()) {
      toast({
        title: "Items Required",
        description: "Please enter items for your wheel",
        variant: "destructive"
      })
      return
    }

    setCreating(true)

    try {
      const participantsList = newWheel.participants
        .split('\n')
        .map(p => p.trim())
        .filter(p => p.length > 0)

      if (participantsList.length < 2) {
        toast({
          title: "Not Enough Items",
          description: "Please enter at least 2 items (one per line)",
          variant: "destructive"
        })
        setCreating(false)
        return
      }

      // Validate numberOfWinners doesn't exceed available items
      const maxWinners = Math.floor(participantsList.length / 2)
      if (newWheel.numberOfWinners > maxWinners) {
        toast({
          title: "Too Many Winners",
          description: `Maximum ${maxWinners} winners allowed for ${participantsList.length} items`,
          variant: "destructive"
        })
        setCreating(false)
        return
      }

      // Store temporary wheel data (not saved to database yet)
      const tempData = {
        title: newWheel.title.trim(),
        description: newWheel.description.trim(),
        category: newWheel.category,
        participants: participantsList,
        settings: {
          numberOfWinners: newWheel.numberOfWinners,
          theme: newWheel.theme,
          hasConfetti: newWheel.hasConfetti,
          hasSound: newWheel.hasSound,
          congratsMessage: newWheel.congratsMessage
        },
        createdBy: user.uid
      }

      setTempWheelData(tempData)

      toast({
        title: "✅ Wheel Created!",
        description: `"${newWheel.title}" - Don't forget to save it!`
      })

      // Close modal
      setShowCreateModal(false)

      // Create a temporary wheel object to use immediately (unsaved)
      const newlyCreatedWheel: PickerWheelType = {
        id: `temp-${Date.now()}`,
        title: newWheel.title.trim(),
        description: newWheel.description.trim(),
        icon: categoryIcons[newWheel.category] || "🎯",
        category: newWheel.category,
        defaultItems: participantsList,
        color: "#8e0b16",
        isCustomizable: true,
        isSavedWheel: false
      }

      // Reset form
      setNewWheel({
        title: "",
        description: "",
        category: "personal",
        participants: "",
        numberOfWinners: 1,
        theme: "default",
        hasConfetti: true,
        hasSound: true,
        congratsMessage: "Congratulations, {winner}!"
      })

      // Navigate directly to the newly created wheel
      setSelectedWheel(newlyCreatedWheel)

    } catch (error) {
      console.error("Error creating custom wheel:", error)
      toast({
        title: "Error",
        description: "Failed to create custom wheel. Please try again.",
        variant: "destructive"
      })
    } finally {
      setCreating(false)
    }
  }

  // Real-time wheel types listener
  useEffect(() => {
    console.log("🎯 Setting up real-time wheel types listener...")

    const q = query(collection(db, "wheelTypes"), orderBy("order", "asc"))

    const unsubscribe = onSnapshot(
      q,
      (querySnapshot) => {
        const fetchedTypes = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          value: doc.data().value,
          label: doc.data().label,
          description: doc.data().description,
          enabled: doc.data().enabled,
          order: doc.data().order,
          allowedRoles: doc.data().allowedRoles || ["organizer", "participant"],
          isActivityWheel: doc.data().isActivityWheel || false,
          canBeShared: doc.data().canBeShared || false,
          hiddenForNewUsers: doc.data().hiddenForNewUsers || false,
          icon: doc.data().icon,
          category: doc.data().category,
          isPreset: doc.data().isPreset || false,
          defaultItems: doc.data().defaultItems || ["Option 1", "Option 2", "Option 3"],
          defaultSettings: doc.data().defaultSettings || {
            allowRealTimeCollection: false,
            requiresApproval: false,
            congratsMessage: "Congratulations, {winner}!"
          },
          createdAt: doc.data().createdAt?.toDate() || new Date(),
          updatedAt: doc.data().updatedAt?.toDate() || new Date(),
        }))

        setEnabledWheelTypes(fetchedTypes.filter(type => type.enabled))
        setWheelTypesLoading(false)

        if (!hasInitializedRef.current) {
          hasInitializedRef.current = true
        }

        console.log(`✅ Loaded ${fetchedTypes.length} wheel types`)
      },
      (error) => {
        console.error("❌ Error in wheel types listener:", error)
        setWheelTypesLoading(false)
      }
    )

    return () => {
      console.log("🔌 Cleaning up wheel types listener")
      unsubscribe()
    }
  }, [])

  // Fetch saved custom wheels for logged-in users
  useEffect(() => {
    if (user?.uid) {
      setSavedWheelsLoading(true)
      console.log("🎯 Setting up saved wheels listener...")

      const savedWheelsQuery = query(
        collection(db, "wheelPresets"),
        where("createdBy", "==", user.uid),
        orderBy("createdAt", "desc")
      )

      const unsubscribe = onSnapshot(
        savedWheelsQuery,
        (querySnapshot) => {
          const savedWheelsData = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate(),
            lastUsed: doc.data().lastUsed?.toDate()
          }))

          setSavedWheels(savedWheelsData)
          setSavedWheelsLoading(false)
          console.log(`✅ Loaded ${savedWheelsData.length} saved wheels`)
        },
        (error) => {
          console.error("❌ Error in saved wheels listener:", error)
          setSavedWheelsLoading(false)
        }
      )

      return () => {
        console.log("🔌 Cleaning up saved wheels listener")
        unsubscribe()
      }
    }
  }, [user?.uid])

  // Combine static wheel types with dynamic ones from Firestore
  const allWheelTypes = useMemo(() => {
    const dynamicWheels: PickerWheelType[] = enabledWheelTypes
      .filter(wheelType => {
        // Filter for participant role permissions
        const hasRolePermission = wheelType.allowedRoles.includes("participant") || wheelType.allowedRoles.includes("all")
        if (!hasRolePermission) return false

        // Show customizable wheels even if hidden for new users, or show non-hidden wheels
        const matchingStaticWheel = PICKER_WHEEL_TYPES.find(sw => sw.id === wheelType.value)
        const isCustomizable = matchingStaticWheel?.isCustomizable ?? true
        return isCustomizable || !wheelType.hiddenForNewUsers
      })
      .map(wheelType => {
        // Find matching static wheel to get proper default items and settings
        const matchingStaticWheel = PICKER_WHEEL_TYPES.find(sw => sw.id === wheelType.value)

        return {
          id: wheelType.value,
          title: wheelType.label,
          description: wheelType.description,
          icon: wheelType.icon || matchingStaticWheel?.icon || "🎯", // Use preset icon, static icon, or default
          // Map dynamic wheels into simplified categories
          category: ((): string => {
            // Use preset category if available, otherwise map from label
            if (wheelType.category) {
              const categoryMapping: Record<string, string> = {
                "Picker Wheels": "personal",
                "Academic Activities": "academic",
                "Research Tools": "research",
                "Entertainment": "entertainment",
                "Special Events": "entertainment"
              }
              return categoryMapping[wheelType.category] || "personal"
            }

            // Use static wheel category if available
            if (matchingStaticWheel) {
              return matchingStaticWheel.category
            }

            const label = (wheelType.label || "").toLowerCase()
            if (label.includes("research") || label.includes("survey") || label.includes("experiment")) return "research"
            if (label.includes("class") || label.includes("quiz") || label.includes("student") || wheelType.isActivityWheel) return "academic"
            if (label.includes("game") || label.includes("movie") || label.includes("team")) return "entertainment"
            return "personal"
          })(),
          defaultItems: wheelType.defaultItems || matchingStaticWheel?.defaultItems || ["Option 1", "Option 2", "Option 3"],
          color: matchingStaticWheel?.color || "#8e0b16", // Use static wheel color or default
          isCustomizable: matchingStaticWheel?.isCustomizable ?? true,
          maxItems: matchingStaticWheel?.maxItems,
          minItems: matchingStaticWheel?.minItems,
          isDynamic: true, // Mark as dynamic wheel type
          allowedRoles: wheelType.allowedRoles,
          canBeShared: wheelType.canBeShared,
          features: matchingStaticWheel?.features
        }
      })

    // Add saved custom wheels for logged-in users
    const customWheels: PickerWheelType[] = user ? savedWheels.map(savedWheel => ({
      id: `saved-${savedWheel.id}`,
      title: savedWheel.title,
      description: savedWheel.description,
      icon: "💾",
      category: savedWheel.category || "personal",
      defaultItems: savedWheel.participants || [],
      color: "#8e0b16",
      isCustomizable: true,
      isSavedWheel: true,
      savedWheelData: savedWheel
    })) : []

    // Only return dynamic wheels that have been added by admin plus custom wheels
    return [...dynamicWheels, ...customWheels]
  }, [enabledWheelTypes, savedWheels, user])

  // Filter wheels based on search and category
  const filteredWheels = allWheelTypes.filter(wheel => {
    const matchesSearch = wheel.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         wheel.description.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory = selectedCategory === "all" || wheel.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  // Get unique categories for filter from all visible wheels
  const categories = ["all", ...new Set(allWheelTypes.map(wheel => wheel.category))]

  // If a wheel is selected, show the wheel interface in solo mode
  if (selectedWheel) {
    const isUnsaved = selectedWheel.id.startsWith('temp-')
    const isSaved = selectedWheel.id.startsWith('saved-')

    return (
      <div className="container mx-auto px-4 py-8">
        {/* Action Buttons for Custom Wheels */}
        {(isUnsaved || isSaved) && (
          <div className="mb-4 flex gap-2 justify-end">
            {isUnsaved && (
              <Button
                onClick={saveCurrentWheel}
                disabled={saving}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    💾 Save Wheel
                  </>
                )}
              </Button>
            )}
            {isSaved && (
              <Button
                onClick={() => deleteCustomWheel(selectedWheel.id)}
                disabled={deleting}
                variant="destructive"
              >
                {deleting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    🗑️ Delete Wheel
                  </>
                )}
              </Button>
            )}
          </div>
        )}
        <DynamicPickerWheel
          wheelType={selectedWheel}
          onBack={() => {
            // Warn if leaving unsaved wheel
            if (isUnsaved) {
              const confirmLeave = window.confirm(
                "This wheel is not saved. If you go back, it will be lost. Continue?"
              )
              if (!confirmLeave) return
              setTempWheelData(null)
            }
            setSelectedWheel(null)
          }}
          isStudentMode={true} // Force solo mode for participants
          user={user}
          soloMode={true} // New prop to ensure no live session options
          userRole={userRole}
        />
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: schoolColors.background }}>
      {/* Header - Sticky */}
      <div 
        className="sticky top-0 z-50 w-full py-6 px-4 shadow-md"
        style={{ 
          backgroundColor: schoolColors.secondary,
          background: `linear-gradient(135deg, ${schoolColors.secondary} 0%, ${schoolColors.primary} 100%)`
        }}
      >
        <div className="container mx-auto">
          <div className="flex items-center gap-4">
            {onBack && (
              <Button
                onClick={onBack}
                variant="outline"
                size="sm"
                className="bg-white/10 border-white/20 text-white hover:bg-white/20"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Button>
            )}
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-white mb-1">
                🎯 Solo Picker Wheels
                {!wheelTypesLoading && enabledWheelTypes.length > 0 && (
                  <span className="ml-2 text-sm font-normal opacity-90">
                    ({enabledWheelTypes.length} live types available)
                  </span>
                )}
              </h1>
              <p className="text-white/90">
                Create and play wheels by yourself - no live sessions, just instant fun!
                {!wheelTypesLoading && enabledWheelTypes.length > 0 && (
                  <span className="block text-sm mt-1 opacity-80">
                    ✨ Including {enabledWheelTypes.filter(t => !t.hiddenForNewUsers && (t.allowedRoles.includes("participant") || t.allowedRoles.includes("all"))).length} activated preset wheels
                    {savedWheels.length > 0 && (
                      <> + {savedWheels.length} of your custom wheels</>
                    )}
                  </span>
                )}
              </p>
            </div>
            {user && (
              <Button
                onClick={() => setShowCreateModal(true)}
                className="bg-white/90 hover:bg-white text-[#8e0b16] font-semibold"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Your Own Wheel
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Search and Filter Controls - Sticky */}
      <div 
        className="sticky z-40 bg-white border-b shadow-sm"
        style={{ 
          top: 'calc(6rem + 1.5rem)', // Adjust based on header height (py-6 = 1.5rem + 1.5rem)
          backgroundColor: schoolColors.background 
        }}
      >
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col sm:flex-row gap-4 items-center">
            <div className="relative flex-1 max-w-md w-full">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search wheels..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-white"
              />
            </div>
            <div className="flex gap-2 flex-wrap justify-center sm:justify-start">
              {categories.map((category) => {
                const categoryInfo = PICKER_CATEGORIES.find(c => c.id === category)
                const categoryName = category === "all" ? "All Categories" : 
                                   categoryInfo ? `${categoryInfo.icon} ${categoryInfo.name}` : 
                                   category.charAt(0).toUpperCase() + category.slice(1)
                
                return (
                  <Badge
                    key={category}
                    variant={selectedCategory === category ? "default" : "outline"}
                    className={`cursor-pointer transition-colors ${
                      selectedCategory === category 
                        ? "text-white" 
                        : "hover:bg-gray-100"
                    }`}
                    style={{
                      backgroundColor: selectedCategory === category ? schoolColors.primary : undefined,
                      borderColor: schoolColors.primary
                    }}
                    onClick={() => setSelectedCategory(category)}
                  >
                    {categoryName}
                  </Badge>
                )
              })}              
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 pb-8 pt-6">

        {/* Loading State */}
        {wheelTypesLoading && (
          <div className="text-center py-8">
            <div className="flex items-center justify-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin" style={{ color: schoolColors.primary }} />
              <span className="text-muted-foreground">Loading wheel types...</span>
            </div>
          </div>
        )}

        {/* Results Count */}
        {!wheelTypesLoading && (
          <div className="text-center text-muted-foreground mb-4">
            <span>
              Showing {filteredWheels.length} of {allWheelTypes.length} picker wheels
              {enabledWheelTypes.length > 0 && (
                <span className="text-green-600 ml-2">
                  (including {enabledWheelTypes.filter(t => !t.hiddenForNewUsers && (t.allowedRoles.includes("participant") || t.allowedRoles.includes("all"))).length} preset types)
                </span>
              )}
            </span>
          </div>
        )}

        {/* Wheels Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
          {!wheelTypesLoading && filteredWheels.map((wheel) => (
            <Card key={wheel.id} className="hover:shadow-lg transition-all duration-200 group flex flex-col h-full">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-2xl flex-shrink-0">{wheel.icon}</span>
                    <Badge 
                      variant="outline" 
                      className="text-xs whitespace-nowrap"
                      style={{ borderColor: schoolColors.primary, color: schoolColors.primary }}
                    >
                      {(() => {
                        const categoryInfo = PICKER_CATEGORIES.find(c => c.id === wheel.category)
                        return categoryInfo ? `${categoryInfo.icon} ${categoryInfo.name}` : wheel.category
                      })()}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground flex-shrink-0">
                    {wheel.id.startsWith('saved-') ? "Custom" : "Solo"}
                  </div>
                </div>
                <CardTitle className="text-base md:text-lg group-hover:text-red-600 transition-colors line-clamp-2">
                  {wheel.title}
                </CardTitle>
                <CardDescription className="text-sm line-clamp-2">
                  {wheel.description}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0 flex-1 flex flex-col">
                <div className="space-y-3 flex-1 flex flex-col">
                  {/* Default Items Preview */}
                  {wheel.defaultItems && wheel.defaultItems.length > 0 && (
                    <div className="flex-1">
                      <p className="text-xs font-medium text-muted-foreground mb-2">Sample Items:</p>
                      <div className="flex flex-wrap gap-1">
                        {wheel.defaultItems.slice(0, 3).map((item, index) => (
                          <Badge 
                            key={index} 
                            variant="outline" 
                            className="text-xs px-2 py-0.5"
                          >
                            {item.length > 12 ? item.substring(0, 12) + '...' : item}
                          </Badge>
                        ))}
                        {wheel.defaultItems.length > 3 && (
                          <Badge variant="outline" className="text-xs px-2 py-0.5">
                            +{wheel.defaultItems.length - 3}
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Features */}
                  <div className="text-xs text-muted-foreground leading-relaxed">
                    ✅ Customizable<br />
                    ✅ Instant results<br />
                    ❌ No live sessions
                  </div>

                  {/* Play Button */}
                  <Button
                    onClick={() => setSelectedWheel(wheel)}
                    className="w-full text-white group-hover:scale-105 transition-transform mt-auto"
                    style={{ backgroundColor: schoolColors.primary }}
                  >
                    <Target className="h-4 w-4 mr-2" />
                    {wheel.id.startsWith('saved-') ? "Use Wheel" : "Play Solo"}
                  </Button>

                  {/* Delete Button for Custom Saved Wheels */}
                  {wheel.id.startsWith('saved-') && user && (
                    <Button
                      onClick={(e) => {
                        e.stopPropagation()
                        if (window.confirm(`Delete "${wheel.title}"? This cannot be undone.`)) {
                          deleteCustomWheel(wheel.id)
                        }
                      }}
                      variant="destructive"
                      size="sm"
                      className="w-full mt-2"
                      disabled={deleting}
                    >
                      {deleting ? (
                        <>
                          <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                          Deleting...
                        </>
                      ) : (
                        <>
                          🗑️ Delete
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* No Results */}
        {filteredWheels.length === 0 && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🔍</div>
            <h3 className="text-xl font-semibold mb-2" style={{ color: schoolColors.primary }}>
              No wheels found
            </h3>
            <p className="text-muted-foreground mb-4">
              Try adjusting your search terms or category filter
            </p>
            <Button
              onClick={() => {
                setSearchQuery("")
                setSelectedCategory("all")
              }}
              variant="outline"
              style={{ borderColor: schoolColors.primary, color: schoolColors.primary }}
            >
              Clear Filters
            </Button>
          </div>
        )}

      </div>

      {/* Create New Wheel Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" style={{ color: schoolColors.primary }} />
              Create Your Own Custom Wheel
            </DialogTitle>
            <DialogDescription>
              Design your own wheel with custom items. This wheel will be saved and available in your saved wheels.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Basic Information */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="wheel-title">Wheel Title *</Label>
                <Input
                  id="wheel-title"
                  value={newWheel.title}
                  onChange={(e) => setNewWheel(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="e.g., My Custom Picker, Random Name Generator"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="wheel-description">Description (Optional)</Label>
                <Input
                  id="wheel-description"
                  value={newWheel.description}
                  onChange={(e) => setNewWheel(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Brief description of this wheel's purpose"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="wheel-category">Category</Label>
                <Select 
                  value={newWheel.category} 
                  onValueChange={(value: "academic" | "research" | "entertainment" | "personal") => 
                    setNewWheel(prev => ({ ...prev, category: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="academic">📚 Academic</SelectItem>
                    <SelectItem value="research">🔬 Research</SelectItem>
                    <SelectItem value="entertainment">🎮 Entertainment</SelectItem>
                    <SelectItem value="personal">👤 Personal</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="number-of-winners">Number of Random Winners</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="number-of-winners"
                    type="number"
                    min="1"
                    max={Math.max(10, Math.floor((newWheel.participants.split('\n').filter(p => p.trim().length > 0).length) / 2) || 10)}
                    value={newWheel.numberOfWinners}
                    onChange={(e) => {
                      const value = parseInt(e.target.value)
                      const maxWinners = Math.max(10, Math.floor((newWheel.participants.split('\n').filter(p => p.trim().length > 0).length) / 2) || 10)
                      const validValue = Math.max(1, Math.min(value || 1, maxWinners))
                      setNewWheel(prev => ({ ...prev, numberOfWinners: validValue }))
                    }}
                    placeholder="1"
                    className="flex-1"
                  />
                  <span className="text-sm text-muted-foreground">
                    {newWheel.numberOfWinners === 1 ? "winner" : "winners"}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Maximum: {Math.max(10, Math.floor((newWheel.participants.split('\n').filter(p => p.trim().length > 0).length) / 2) || 10)} winners
                </p>
              </div>
            </div>

            {/* Items */}
            <div className="space-y-2">
              <Label htmlFor="participants">Items *</Label>
              <Textarea
                id="participants"
                value={newWheel.participants}
                onChange={(e) => setNewWheel(prev => ({ ...prev, participants: e.target.value }))}
                placeholder={"Enter items (one per line):\nAlice Johnson\nBob Smith\nCharlie Brown\nDiana Prince"}
                rows={6}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Enter each item name on a separate line. Minimum 2 items required.
              </p>
              <div className="flex gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => autoFillParticipants((value) => setNewWheel(prev => ({ ...prev, participants: value })))}
                  className="flex-1"
                >
                  <Users className="h-4 w-4 mr-1" />
                  Auto-fill from registered users
                </Button>
                <label className="flex-1">
                  <Button type="button" variant="outline" size="sm" asChild className="w-full">
                    <span>
                      <Upload className="h-4 w-4 mr-1" />
                      Import from file
                    </span>
                  </Button>
                  <input
                    type="file"
                    accept=".txt,.csv"
                    className="hidden"
                    onChange={(e) => importParticipantsFromFile(e, (value) => setNewWheel(prev => ({ ...prev, participants: value })))}
                  />
                </label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCreateModal(false)
                setNewWheel({
                  title: "",
                  description: "",
                  category: "personal",
                  participants: "",
                  numberOfWinners: 1,
                  theme: "default",
                  hasConfetti: true,
                  hasSound: true,
                  congratsMessage: "Congratulations, {winner}!"
                })
              }}
              disabled={creating}
            >
              Cancel
            </Button>
            <Button
              onClick={createCustomWheel}
              disabled={creating || !newWheel.title.trim() || !newWheel.participants.trim()}
              className="text-white"
              style={{ backgroundColor: schoolColors.primary }}
            >
              {creating ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Wheel
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}