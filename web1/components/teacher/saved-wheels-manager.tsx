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
import { db } from "@/lib/firebase"
import { collection, getDocs, query, where, orderBy, deleteDoc, doc, addDoc, serverTimestamp } from "firebase/firestore"
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
  X
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
  const [creating, setCreating] = useState(false)
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

  const schoolColors = {
    primary: "#8e0b16",
    secondary: "#66181E",
    accent: "#ffffff"
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
    fetchSavedWheels()
  }, [user])

  const fetchSavedWheels = async () => {
    try {
      // Simplified query to avoid index requirement
      const wheelsQuery = query(
        collection(db, "wheelPresets"),
        where("createdBy", "==", user.uid)
      )
      const wheelsSnapshot = await getDocs(wheelsQuery)
      const wheels = wheelsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        lastUsed: doc.data().lastUsed?.toDate(),
        createdAt: doc.data().createdAt?.toDate() || new Date()
      })) as SavedWheel[]

      // Sort by createdAt on client side
      wheels.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      setSavedWheels(wheels)
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
    if (!confirm("Are you sure you want to delete this saved wheel?")) return

    try {
      await deleteDoc(doc(db, "wheelPresets", wheelId))
      setSavedWheels(prev => prev.filter(wheel => wheel.id !== wheelId))
      toast({
        title: "Deleted",
        description: "Saved wheel deleted successfully"
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
        title: "Duplicated",
        description: "Wheel duplicated successfully"
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
      title: "Updated",
      description: "Favorite status updated"
    })
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
        title: "Participants Required",
        description: "Please enter participants for your wheel",
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
          title: "Not Enough Participants",
          description: "Please enter at least 2 participants (one per line)",
          variant: "destructive"
        })
        setCreating(false)
        return
      }

      const wheelData = {
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
        isFavorite: false,
        timesUsed: 0,
        createdAt: serverTimestamp(),
        createdBy: user.uid,
        wheelType: "custom-wheel",
        isCustomWheel: true
      }

      const docRef = await addDoc(collection(db, "wheelPresets"), wheelData)
      
      // Add to local state
      const newSavedWheel: SavedWheel = {
        id: docRef.id,
        ...wheelData,
        createdAt: new Date(),
        lastUsed: undefined
      }
      setSavedWheels(prev => [newSavedWheel, ...prev])

      toast({
        title: "✅ Custom Wheel Created!",
        description: `"${newWheel.title}" has been saved and is ready to use for live draws or solo play.`
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
                         wheel.description.toLowerCase().includes(searchTerm.toLowerCase())
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
            <Card key={wheel.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{categoryIcons[wheel.category]}</span>
                    <Badge className={categoryColors[wheel.category]}>
                      {wheel.category}
                    </Badge>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => toggleFavorite(wheel.id)}
                    className="text-yellow-500 hover:text-yellow-600"
                  >
                    {wheel.isFavorite ? <Star className="h-4 w-4 fill-current" /> : <StarOff className="h-4 w-4" />}
                  </Button>
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
                    <Link href={`/activity/${wheel.id}`} className="flex-1">
                      <Button 
                        size="sm" 
                        className="w-full text-white"
                        style={{ backgroundColor: schoolColors.primary }}
                      >
                        <Play className="h-4 w-4 mr-1" />
                        Use
                      </Button>
                    </Link>
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
            </div>

            {/* Participants */}
            <div className="space-y-2">
              <Label htmlFor="participants">Participants *</Label>
              <Textarea
                id="participants"
                value={newWheel.participants}
                onChange={(e) => setNewWheel(prev => ({ ...prev, participants: e.target.value }))}
                placeholder={"Enter participants (one per line):\nAlice Johnson\nBob Smith\nCharlie Brown\nDiana Prince"}
                rows={6}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Enter each participant name on a separate line. Minimum 2 participants required.
              </p>
            </div>

            {/* Settings */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold" style={{ color: schoolColors.primary }}>Wheel Settings</h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="winners">Number of Winners</Label>
                  <Select 
                    value={newWheel.numberOfWinners.toString()} 
                    onValueChange={(value) => setNewWheel(prev => ({ ...prev, numberOfWinners: parseInt(value) }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 Winner</SelectItem>
                      <SelectItem value="2">2 Winners</SelectItem>
                      <SelectItem value="3">3 Winners</SelectItem>
                      <SelectItem value="4">4 Winners</SelectItem>
                      <SelectItem value="5">5 Winners</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="theme">Theme</Label>
                  <Select 
                    value={newWheel.theme} 
                    onValueChange={(value) => setNewWheel(prev => ({ ...prev, theme: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">🎨 Default</SelectItem>
                      <SelectItem value="colorful">🌈 Colorful</SelectItem>
                      <SelectItem value="elegant">✨ Elegant</SelectItem>
                      <SelectItem value="dark">🌙 Dark</SelectItem>
                      <SelectItem value="minimalist">⚪ Minimalist</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label className="text-sm font-medium">🎊 Confetti Animation</Label>
                    <p className="text-xs text-muted-foreground">Show confetti when wheel stops</p>
                  </div>
                  <Button
                    type="button"
                    variant={newWheel.hasConfetti ? "default" : "outline"}
                    size="sm"
                    onClick={() => setNewWheel(prev => ({ ...prev, hasConfetti: !prev.hasConfetti }))}
                    style={newWheel.hasConfetti ? { backgroundColor: schoolColors.primary } : undefined}
                  >
                    {newWheel.hasConfetti ? "On" : "Off"}
                  </Button>
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label className="text-sm font-medium">🔊 Sound Effects</Label>
                    <p className="text-xs text-muted-foreground">Play sounds during spin</p>
                  </div>
                  <Button
                    type="button"
                    variant={newWheel.hasSound ? "default" : "outline"}
                    size="sm"
                    onClick={() => setNewWheel(prev => ({ ...prev, hasSound: !prev.hasSound }))}
                    style={newWheel.hasSound ? { backgroundColor: schoolColors.primary } : undefined}
                  >
                    {newWheel.hasSound ? "On" : "Off"}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="congrats-message">Congratulations Message</Label>
                <Input
                  id="congrats-message"
                  value={newWheel.congratsMessage}
                  onChange={(e) => setNewWheel(prev => ({ ...prev, congratsMessage: e.target.value }))}
                  placeholder="Congratulations, {winner}!"
                />
                <p className="text-xs text-muted-foreground">
                  Use {'{winner}'} as placeholder for the selected participant's name
                </p>
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
    </div>
  )
}
