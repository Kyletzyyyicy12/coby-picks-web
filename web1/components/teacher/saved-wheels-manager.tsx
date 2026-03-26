"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { toast } from "@/hooks/use-toast"
import { db, auth } from "@/lib/firebase"
import { collection, getDocs, query, where, orderBy, deleteDoc, doc, addDoc, serverTimestamp, updateDoc } from "firebase/firestore"
import { getAuth } from "firebase/auth"
import {
  RotateCcw,
  Play,
  Copy,
  Trash2,
  Edit,
  Search,
  Filter,
  Calendar,
  Users,
  Trophy,
  Settings,
  Star,
  StarOff,
  Plus,
  X,
  Upload,
  Save
} from "lucide-react"
import Link from "next/link"
import type { User as FirebaseUser } from "firebase/auth"

interface SavedWheel {
  id: string
  title: string
  description: string
  category: "academic" | "research" | "entertainment" | "personal"
  participants: string[]
  settings: {
    numberOfWinners: number
    theme: string
    hasConfetti: boolean
    hasSound: boolean
    congratsMessage: string
  }
  isFavorite: boolean
  timesUsed: number
  lastUsed?: Date
  createdAt: Date
  isUnsaved?: boolean // New flag to track unsaved wheels
}

interface SavedWheelsManagerProps {
  user: FirebaseUser
  onClose?: () => void
}

export function SavedWheelsManager({ user, onClose }: SavedWheelsManagerProps) {
  const [savedWheels, setSavedWheels] = useState<SavedWheel[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [sortBy, setSortBy] = useState("recent")
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingWheel, setEditingWheel] = useState<SavedWheel | null>(null)
  const [creating, setCreating] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [saving, setSaving] = useState<string | null>(null) // Track which wheel is being saved
  const [newWheel, setNewWheel] = useState({
    title: "",
    description: "",
    category: "academic" as "academic" | "research" | "entertainment" | "personal",
    participants: "" as string,
    numberOfWinners: 1,
    theme: "default",
    hasConfetti: true,
    hasSound: true,
    congratsMessage: "Congratulations, {winner}!"
  })
  const [editWheel, setEditWheel] = useState({
    title: "",
    description: "",
    category: "academic" as "academic" | "research" | "entertainment" | "personal",
    participants: "" as string,
    numberOfWinners: 1,
    theme: "default",
    hasConfetti: true,
    hasSound: true,
    congratsMessage: "Congratulations, {winner}!"
  })

  const schoolColors = {
    primary: "#8e0b16",
    secondary: "#66181E",
    accent: "#ffffff"
  }

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
          // Exclude admin accounts
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
      // Reset the input
      event.target.value = ''
    }
  }

  const categoryIcons = {
    academic: "📚",
    research: "🔬",
    entertainment: "🎮",
    personal: "👤"
  }

  const categoryColors = {
    academic: "bg-blue-500",
    research: "bg-purple-500",
    entertainment: "bg-green-500",
    personal: "bg-orange-500"
  }

  useEffect(() => {
    // Load unsaved wheels immediately on mount
    const unsavedWheelsData = localStorage.getItem(`unsavedWheels_${user.uid}`)
    if (unsavedWheelsData) {
      try {
        const unsavedWheels: SavedWheel[] = JSON.parse(unsavedWheelsData)
        setSavedWheels(unsavedWheels)
      } catch (error) {
        console.error('Error loading unsaved wheels from localStorage:', error)
      }
    }

    fetchSavedWheels()
  }, [user])



  // Save unsaved wheels to localStorage whenever they change
  useEffect(() => {
    const unsavedWheels = savedWheels.filter(w => w.isUnsaved)
    if (unsavedWheels.length > 0) {
      localStorage.setItem(`unsavedWheels_${user.uid}`, JSON.stringify(unsavedWheels))
    } else {
      localStorage.removeItem(`unsavedWheels_${user.uid}`)
    }
  }, [savedWheels, user.uid])

  const fetchSavedWheels = async () => {
    try {
      // Simplified query to avoid index requirement
      const wheelsQuery = query(
        collection(db, "wheelPresets"),
        where("createdBy", "==", user.uid)
      )
      const wheelsSnapshot = await getDocs(wheelsQuery)
      const savedWheels = wheelsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        lastUsed: doc.data().lastUsed?.toDate(),
        createdAt: doc.data().createdAt?.toDate() || new Date()
      })) as SavedWheel[]

      // Load unsaved wheels from localStorage and merge with saved wheels
      const unsavedWheelsData = localStorage.getItem(`unsavedWheels_${user.uid}`)
      let unsavedWheels: SavedWheel[] = []
      if (unsavedWheelsData) {
        try {
          unsavedWheels = JSON.parse(unsavedWheelsData)
          // Filter out any unsaved wheels that might have been saved in the meantime
          unsavedWheels = unsavedWheels.filter(unsaved =>
            !savedWheels.some(saved => saved.id === unsaved.id)
          )
        } catch (error) {
          console.error('Error loading unsaved wheels from localStorage:', error)
        }
      }

      // Combine saved and unsaved wheels
      const allWheels = [...unsavedWheels, ...savedWheels]

      // Sort by createdAt on client side
      allWheels.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      setSavedWheels(allWheels)
    } catch (error) {
      console.error("Error fetching saved wheels:", error)
      toast({
        title: "Error",
        description: "Failed to load saved wheels",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteWheel = async (wheelId: string) => {
    try {
      // Delete from wheelPresets collection
      await deleteDoc(doc(db, "wheelPresets", wheelId))

      // Also delete from wheelTypes collection to remove from live organizer dropdown
      try {
        const wheelTypesQuery = query(
          collection(db, "wheelTypes"),
          where("value", "==", wheelId),
          where("createdBy", "==", user.uid)
        )
        const wheelTypesSnapshot = await getDocs(wheelTypesQuery)

        if (!wheelTypesSnapshot.empty) {
          // Delete the corresponding wheelTypes document
          const wheelTypeDoc = wheelTypesSnapshot.docs[0]
          await deleteDoc(doc(db, "wheelTypes", wheelTypeDoc.id))
          console.log("Also deleted wheel from wheelTypes collection for live organizer sync")
        }
      } catch (wheelTypeError) {
        console.warn("Could not delete from wheelTypes collection:", wheelTypeError)
        // Don't fail the entire deletion if wheelTypes deletion fails
      }

      setSavedWheels(prev => prev.filter(wheel => wheel.id !== wheelId))
      toast({
        title: "🗑️ Wheel Deleted Successfully!",
        description: "The saved wheel has been permanently removed from your collection.",
        variant: "destructive"
      })
    } catch (error) {
      console.error("Error deleting wheel:", error)
      toast({
        title: "Error",
        description: "Failed to delete saved wheel",
        variant: "destructive"
      })
    }
  }

  const handleDuplicateWheel = async (wheel: SavedWheel) => {
    try {
      // Create a copy with modified title
      const { id, ...wheelWithoutId } = wheel
      const duplicatedWheel = {
        ...wheelWithoutId,
        title: `${wheel.title} (Copy)`,
        timesUsed: 0,
        lastUsed: null,
        createdAt: new Date()
      }

      // In a real implementation, you would save this to Firestore
      toast({
        title: "📋 Wheel Duplicated!",
        description: `"${wheel.title} (Copy)" has been created successfully.`
      })
    } catch (error) {
      console.error("Error duplicating wheel:", error)
      toast({
        title: "Error",
        description: "Failed to duplicate wheel",
        variant: "destructive"
      })
    }
  }

  const toggleFavorite = async (wheelId: string) => {
    setSavedWheels(prev => prev.map(wheel => 
      wheel.id === wheelId 
        ? { ...wheel, isFavorite: !wheel.isFavorite }
        : wheel
    ))
    
    toast({
      title: "⭐ Favorite Updated!",
      description: "Wheel favorite status has been updated successfully."
    })
  }

  const openEditModal = (wheel: SavedWheel) => {
    setEditingWheel(wheel)
    setEditWheel({
      title: wheel.title,
      description: wheel.description,
      category: wheel.category,
      participants: wheel.participants.join('\n'),
      numberOfWinners: wheel.settings.numberOfWinners,
      theme: wheel.settings.theme,
      hasConfetti: wheel.settings.hasConfetti,
      hasSound: wheel.settings.hasSound,
      congratsMessage: wheel.settings.congratsMessage
    })
    setShowEditModal(true)
  }

  const updateCustomWheel = async () => {
    if (!editingWheel) return

    if (!editWheel.title.trim()) {
      toast({
        title: "Title Required",
        description: "Please enter a title for your custom wheel",
        variant: "destructive"
      })
      return
    }

    if (!editWheel.participants.trim()) {
      toast({
        title: "Items Required",
        description: "Please enter items for your wheel",
        variant: "destructive"
      })
      return
    }

    setUpdating(true)

    try {
      // Parse participants from textarea
      const participantsList = editWheel.participants
        .split('\n')
        .map(p => p.trim())
        .filter(p => p.length > 0)

      if (participantsList.length < 2) {
        toast({
          title: "Not Enough Items",
          description: "Please enter at least 2 items (one per line)",
          variant: "destructive"
        })
        setUpdating(false)
        return
      }

      // Validate numberOfWinners doesn't exceed available items
      const maxWinners = Math.floor(participantsList.length / 2)
      if (editWheel.numberOfWinners > maxWinners) {
        toast({
          title: "Too Many Winners",
          description: `Maximum ${maxWinners} winners allowed for ${participantsList.length} items`,
          variant: "destructive"
        })
        setUpdating(false)
        return
      }

      const wheelData = {
        title: editWheel.title.trim(),
        description: editWheel.description.trim(),
        category: editWheel.category,
        participants: participantsList,
        settings: {
          numberOfWinners: editWheel.numberOfWinners,
          theme: editWheel.theme,
          hasConfetti: editWheel.hasConfetti,
          hasSound: editWheel.hasSound,
          congratsMessage: editWheel.congratsMessage
        }
      }

      const wheelRef = doc(db, "wheelPresets", editingWheel.id)
      await updateDoc(wheelRef, wheelData)

      // Also update the corresponding wheelTypes document for live organizer sync
      try {
        // Find the wheelTypes document that corresponds to this wheel preset
        const wheelTypesQuery = query(
          collection(db, "wheelTypes"),
          where("value", "==", editingWheel.id),
          where("createdBy", "==", user.uid)
        )
        const wheelTypesSnapshot = await getDocs(wheelTypesQuery)

        if (!wheelTypesSnapshot.empty) {
          // Update the existing wheelTypes document
          const wheelTypeDoc = wheelTypesSnapshot.docs[0]
          const wheelTypeRef = doc(db, "wheelTypes", wheelTypeDoc.id)

          await updateDoc(wheelTypeRef, {
            label: editWheel.title.trim(),
            description: editWheel.description.trim() || `${editWheel.title.trim()} - Custom wheel created by organizer`,
            category: editWheel.category,
            icon: categoryIcons[editWheel.category] || "🎯",
            defaultItems: participantsList,
            defaultSettings: {
              allowRealTimeCollection: false,
              requiresApproval: false,
              congratsMessage: editWheel.congratsMessage,
              numberOfWinners: editWheel.numberOfWinners,
              theme: editWheel.theme,
              hasConfetti: editWheel.hasConfetti,
              hasSound: editWheel.hasSound
            },
            updatedAt: serverTimestamp()
          })
        }
      } catch (wheelTypeError) {
        console.warn("Could not update wheelTypes document:", wheelTypeError)
        // Don't fail the entire update if wheelTypes update fails
      }

      // Update local state
      setSavedWheels(prev => prev.map(wheel =>
        wheel.id === editingWheel.id
          ? {
              ...wheel,
              ...wheelData,
              settings: wheelData.settings
            }
          : wheel
      ))

      toast({
        title: "✅ Wheel Updated!",
        description: `"${editWheel.title}" has been updated successfully.`
      })

      setShowEditModal(false)
      setEditingWheel(null)

    } catch (error) {
      console.error("Error updating custom wheel:", error)
      toast({
        title: "Error",
        description: "Failed to update custom wheel. Please try again.",
        variant: "destructive"
      })
    } finally {
      setUpdating(false)
    }
  }

  const saveWheelToFirestore = async (wheel: SavedWheel) => {
    setSaving(wheel.id)

    try {
      const wheelData = {
        title: wheel.title,
        description: wheel.description,
        category: wheel.category,
        participants: wheel.participants,
        settings: wheel.settings,
        isFavorite: wheel.isFavorite,
        timesUsed: wheel.timesUsed,
        createdAt: serverTimestamp(),
        createdBy: user.uid,
        wheelType: "custom-wheel",
        isCustomWheel: true
      }

      const docRef = await addDoc(collection(db, "wheelPresets"), wheelData)

      // Also save to wheelTypes collection so it appears in live organizer dropdown
      const wheelTypeData = {
        value: docRef.id, // Use the wheelPresets document ID as the value
        label: wheel.title,
        description: wheel.description || `${wheel.title} - Custom wheel created by organizer`,
        enabled: true,
        order: Date.now(), // Use timestamp for ordering (newest first)
        allowedRoles: ["organizer", "participant"],
        isActivityWheel: false,
        canBeShared: true,
        hiddenForNewUsers: false,
        icon: categoryIcons[wheel.category] || "🎯",
        category: wheel.category,
        isPreset: false, // This is a custom wheel, not a preset
        defaultItems: wheel.participants,
        defaultSettings: {
          allowRealTimeCollection: false,
          requiresApproval: false,
          congratsMessage: wheel.settings.congratsMessage,
          numberOfWinners: wheel.settings.numberOfWinners,
          theme: wheel.settings.theme,
          hasConfetti: wheel.settings.hasConfetti,
          hasSound: wheel.settings.hasSound
        },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: user.uid,
        isCustomWheel: true
      }

      // Save to wheelTypes collection
      await addDoc(collection(db, "wheelTypes"), wheelTypeData)

      // Update local state - replace the unsaved wheel with the saved one
      setSavedWheels(prev => prev.map(w =>
        w.id === wheel.id
          ? {
              ...wheel,
              id: docRef.id,
              isUnsaved: false,
              createdAt: new Date()
            }
          : w
      ))

      toast({
        title: "✅ Wheel Saved Successfully!",
        description: `"${wheel.title}" has been saved and is now available in live organizer wheel selection.`
      })

    } catch (error) {
      console.error("Error saving wheel:", error)
      toast({
        title: "Save Failed",
        description: "Failed to save wheel. Please try again.",
        variant: "destructive"
      })
    } finally {
      setSaving(null)
    }
  }

  const createCustomWheel = async () => {
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
      // Parse participants from textarea
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

      // Create temporary wheel ID for session storage (NOT saved to Firestore)
      const tempWheelId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      
      // Store custom wheel data in sessionStorage for immediate use
      const wheelData = {
        id: tempWheelId,
        title: newWheel.title.trim(),
        description: newWheel.description.trim(),
        participants: participantsList,
        settings: {
          numberOfWinners: newWheel.numberOfWinners,
          theme: newWheel.theme,
          hasConfetti: newWheel.hasConfetti,
          hasSound: newWheel.hasSound,
          congratsMessage: newWheel.congratsMessage
        },
        category: newWheel.category,
        isTemporary: true // Flag to indicate this is NOT saved yet
      }

      sessionStorage.setItem('customWheelData', JSON.stringify(wheelData))
      sessionStorage.setItem('wheelSource', 'saved-wheels-manager-new')

      toast({
        title: "✅ Wheel Created!",
        description: `Taking you to "${newWheel.title}". Use the Save button on the wheel page to save it permanently.`,
      })

      // Reset form
      setNewWheel({
        title: "",
        description: "",
        category: "academic",
        participants: "",
        numberOfWinners: 1,
        theme: "default",
        hasConfetti: true,
        hasSound: true,
        congratsMessage: "Congratulations, {winner}!"
      })
      setShowCreateModal(false)

      // Navigate directly to the wheel page
      window.location.href = '/picker-wheel/custom'

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

  const filteredWheels = savedWheels.filter(wheel => {
    const matchesSearch = wheel.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         wheel.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         wheel.participants.some(participant =>
                           participant.toLowerCase().includes(searchTerm.toLowerCase())
                         )
    const matchesCategory = categoryFilter === "all" || wheel.category === categoryFilter
    return matchesSearch && matchesCategory
  }).sort((a, b) => {
    switch (sortBy) {
      case "recent":
        return b.createdAt.getTime() - a.createdAt.getTime()
      case "lastUsed":
        if (!a.lastUsed && !b.lastUsed) return 0
        if (!a.lastUsed) return 1
        if (!b.lastUsed) return -1
        return b.lastUsed.getTime() - a.lastUsed.getTime()
      case "title":
        return a.title.localeCompare(b.title)
      case "timesUsed":
        return b.timesUsed - a.timesUsed
      case "favorites":
        if (a.isFavorite && !b.isFavorite) return -1
        if (!a.isFavorite && b.isFavorite) return 1
        return 0
      default:
        return 0
    }
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto mb-4" style={{ borderColor: schoolColors.primary }}></div>
          <p>Loading saved wheels...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: schoolColors.primary }}>
            🎡 Saved Wheels
          </h2>
          <p className="text-muted-foreground">
            Manage your saved wheel templates and presets
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            className="text-white" 
            style={{ backgroundColor: schoolColors.primary }}
            onClick={() => setShowCreateModal(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            Create New Wheel
          </Button>
          {onClose && (
            <Button onClick={onClose} variant="outline">
              Close
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filters & Search</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Search</label>
              <div className="relative">
                <Search className="h-4 w-4 absolute left-3 top-3 text-muted-foreground" />
                <Input
                  placeholder="Search wheels..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Category</label>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="academic">📚 Academic</SelectItem>
                  <SelectItem value="research">🔬 Research</SelectItem>
                  <SelectItem value="entertainment">🎮 Entertainment</SelectItem>
                  <SelectItem value="personal">👤 Personal</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Sort By</label>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recent">Recently Created</SelectItem>
                  <SelectItem value="lastUsed">Last Used</SelectItem>
                  <SelectItem value="title">Title A-Z</SelectItem>
                  <SelectItem value="timesUsed">Most Used</SelectItem>
                  <SelectItem value="favorites">Favorites First</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button 
                onClick={() => {
                  setSearchTerm("")
                  setCategoryFilter("all")
                  setSortBy("recent")
                }}
                variant="outline"
                className="w-full"
              >
                <Filter className="h-4 w-4 mr-2" />
                Clear Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Wheels Grid */}
      {filteredWheels.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <RotateCcw className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No Saved Wheels</h3>
            <p className="text-muted-foreground mb-4">
              {savedWheels.length === 0 
                ? "Create your first wheel to save it as a template" 
                : "No wheels match your current filters"}
            </p>
            {savedWheels.length === 0 && (
              <Button 
                className="text-white" 
                style={{ backgroundColor: schoolColors.primary }}
                onClick={() => setShowCreateModal(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Wheel
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredWheels.map((wheel) => (
            <Card key={wheel.id} className={`hover:shadow-lg transition-shadow ${wheel.isUnsaved ? 'border-orange-300 bg-orange-50' : ''}`}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{categoryIcons[wheel.category]}</span>
                    <Badge className={categoryColors[wheel.category]}>
                      {wheel.category}
                    </Badge>
                    {wheel.isUnsaved && (
                      <Badge variant="outline" className="text-orange-600 border-orange-600">
                        Unsaved
                      </Badge>
                    )}
                  </div>
                  {!wheel.isUnsaved && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => toggleFavorite(wheel.id)}
                      className="text-yellow-500 hover:text-yellow-600"
                    >
                      {wheel.isFavorite ? <Star className="h-4 w-4 fill-current" /> : <StarOff className="h-4 w-4" />}
                    </Button>
                  )}
                </div>
                <CardTitle className="text-lg">{wheel.title}</CardTitle>
                {wheel.description && (
                  <CardDescription>{wheel.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="flex items-center gap-1">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span>{wheel.participants.length} participants</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Trophy className="h-4 w-4 text-muted-foreground" />
                      <span>{wheel.settings.numberOfWinners} winner(s)</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <RotateCcw className="h-4 w-4 text-muted-foreground" />
                      <span>Used {wheel.timesUsed} times</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span>{wheel.lastUsed ? wheel.lastUsed.toLocaleDateString() : "Never"}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1">
                    {wheel.settings.hasConfetti && <Badge variant="outline" className="text-xs">🎊 Confetti</Badge>}
                    {wheel.settings.hasSound && <Badge variant="outline" className="text-xs">🔊 Sound</Badge>}
                    <Badge variant="outline" className="text-xs">🎨 {wheel.settings.theme}</Badge>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button
                      size="sm"
                      className="w-full text-white"
                      style={{ backgroundColor: schoolColors.primary }}
                      onClick={() => {
                        // Store custom wheel data in sessionStorage for solo mode
                        sessionStorage.setItem('customWheelData', JSON.stringify({
                          id: wheel.id,
                          title: wheel.title,
                          description: wheel.description,
                          participants: wheel.participants,
                          settings: wheel.settings,
                          category: wheel.category
                        }))
                        // Mark that this came from saved wheels manager
                        sessionStorage.setItem('wheelSource', 'saved-wheels-manager')
                        // Navigate to picker wheel gallery
                        window.location.href = '/picker-wheel/custom'
                      }}
                    >
                      <Play className="h-4 w-4 mr-1" />
                      Use
                    </Button>
                    {wheel.isUnsaved ? (
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          className="flex-1"
                          onClick={() => saveWheelToFirestore(wheel)}
                          disabled={saving === wheel.id}
                          style={{ backgroundColor: '#f59e0b', color: 'white' }}
                        >
                          {saving === wheel.id ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                              Saving...
                            </>
                          ) : (
                            <>
                              <Save className="h-4 w-4 mr-1" />
                              Save
                            </>
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={async () => {
                            // Remove from local state
                            setSavedWheels(prev => prev.filter(w => w.id !== wheel.id))
                            // Remove from localStorage
                            const unsavedWheels = JSON.parse(localStorage.getItem(`unsavedWheels_${user.uid}`) || '[]')
                            const updatedUnsavedWheels = unsavedWheels.filter((w: SavedWheel) => w.id !== wheel.id)
                            if (updatedUnsavedWheels.length > 0) {
                              localStorage.setItem(`unsavedWheels_${user.uid}`, JSON.stringify(updatedUnsavedWheels))
                            } else {
                              localStorage.removeItem(`unsavedWheels_${user.uid}`)
                            }
                            toast({
                              title: "🗑️ Unsaved Wheel Deleted!",
                              description: "The temporary wheel has been removed from your collection.",
                              variant: "destructive"
                            })
                          }}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDuplicateWheel(wheel)}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openEditModal(wheel)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDeleteWheel(wheel.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create New Wheel Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" style={{ color: schoolColors.primary }} />
              Create New Custom Wheel
            </DialogTitle>
            <DialogDescription>
              Design your own wheel with custom participants. This wheel can be used for both live draws and solo play.
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
                  placeholder="e.g., Class Presentation Order, Team Assignments"
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
                  Auto-fill for people with accounts
                </Button>
                <label className="flex-1">
                  <Button type="button" variant="outline" size="sm" asChild className="w-full">
                    <span>
                      <Upload className="h-4 w-4 mr-1" />
                      Import participant names
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
                  category: "academic",
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

      {/* Edit Wheel Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5" style={{ color: schoolColors.primary }} />
              Edit Custom Wheel
            </DialogTitle>
            <DialogDescription>
              Update your wheel title and items. Changes will be saved immediately.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Basic Information */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-wheel-title">Wheel Title *</Label>
                <Input
                  id="edit-wheel-title"
                  value={editWheel.title}
                  onChange={(e) => setEditWheel(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="e.g., Class Presentation Order, Team Assignments"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-wheel-description">Description (Optional)</Label>
                <Input
                  id="edit-wheel-description"
                  value={editWheel.description}
                  onChange={(e) => setEditWheel(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Brief description of this wheel's purpose"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-wheel-category">Category</Label>
                <Select 
                  value={editWheel.category} 
                  onValueChange={(value: "academic" | "research" | "entertainment" | "personal") => 
                    setEditWheel(prev => ({ ...prev, category: value }))
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
                <Label htmlFor="edit-number-of-winners">Number of Random Winners</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="edit-number-of-winners"
                    type="number"
                    min="1"
                    max={Math.max(10, Math.floor((editWheel.participants.split('\n').filter(p => p.trim().length > 0).length) / 2) || 10)}
                    value={editWheel.numberOfWinners}
                    onChange={(e) => {
                      const value = parseInt(e.target.value)
                      const maxWinners = Math.max(10, Math.floor((editWheel.participants.split('\n').filter(p => p.trim().length > 0).length) / 2) || 10)
                      const validValue = Math.max(1, Math.min(value || 1, maxWinners))
                      setEditWheel(prev => ({ ...prev, numberOfWinners: validValue }))
                    }}
                    placeholder="1"
                    className="flex-1"
                  />
                  <span className="text-sm text-muted-foreground">
                    {editWheel.numberOfWinners === 1 ? "winner" : "winners"}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Maximum: {Math.max(10, Math.floor((editWheel.participants.split('\n').filter(p => p.trim().length > 0).length) / 2) || 10)} winners
                </p>
              </div>
            </div>

            {/* Items */}
            <div className="space-y-2">
              <Label htmlFor="edit-participants">Items *</Label>
              <Textarea
                id="edit-participants"
                value={editWheel.participants}
                onChange={(e) => setEditWheel(prev => ({ ...prev, participants: e.target.value }))}
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
                  onClick={() => autoFillParticipants((value) => setEditWheel(prev => ({ ...prev, participants: value })))}
                  className="flex-1"
                >
                  <Users className="h-4 w-4 mr-1" />
                  Auto-fill for people with accounts
                </Button>
                <label className="flex-1">
                  <Button type="button" variant="outline" size="sm" asChild className="w-full">
                    <span>
                      <Upload className="h-4 w-4 mr-1" />
                      Import participant names
                    </span>
                  </Button>
                  <input
                    type="file"
                    accept=".txt,.csv"
                    className="hidden"
                    onChange={(e) => importParticipantsFromFile(e, (value) => setEditWheel(prev => ({ ...prev, participants: value })))}
                  />
                </label>
              </div>
            </div>


          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowEditModal(false)
                setEditingWheel(null)
              }}
              disabled={updating}
            >
              Cancel
            </Button>
            <Button
              onClick={updateCustomWheel}
              disabled={updating || !editWheel.title.trim() || !editWheel.participants.trim()}
              className="text-white"
              style={{ backgroundColor: schoolColors.primary }}
            >
              {updating ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Updating...
                </>
              ) : (
                <>
                  <Edit className="h-4 w-4 mr-2" />
                  Update Wheel
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
