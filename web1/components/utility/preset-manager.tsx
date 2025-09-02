"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { toast } from "@/hooks/use-toast"
import { db } from "@/lib/firebase"
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, where, orderBy } from "firebase/firestore"
import { Save, FolderOpen, Trash2, Download, Upload, Star, Clock, Users } from "lucide-react"
import * as XLSX from "xlsx"
import type { User as FirebaseUser } from "firebase/auth"

interface WheelPreset {
  id: string
  name: string
  description: string
  category: "academic" | "research" | "entertainment" | "personal"
  participants: Array<{
    id: string
    name: string
    email?: string
    contactNumber?: string
  }>
  settings: {
    numberOfWinners: number
    congratsMessage: string
    theme: string
    spinDuration: number
    showConfetti: boolean
    playSound: boolean
  }
  createdBy: string
  createdAt: Date
  lastUsed?: Date
  timesUsed: number
  isFavorite: boolean
}

interface PresetManagerProps {
  user: FirebaseUser
  currentActivity?: {
    participants: any[]
    settings: any
    category: string
  }
  onLoadPreset?: (preset: WheelPreset) => void
}

export function PresetManager({ user, currentActivity, onLoadPreset }: PresetManagerProps) {
  const [presets, setPresets] = useState<WheelPreset[]>([])
  const [loading, setLoading] = useState(true)
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false)
  const [isLoadDialogOpen, setIsLoadDialogOpen] = useState(false)
  const [saveForm, setSaveForm] = useState({
    name: "",
    description: "",
    category: "academic" as const
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

  useEffect(() => {
    fetchPresets()
  }, [user])

  const fetchPresets = async () => {
    try {
      const q = query(
        collection(db, "wheelPresets"),
        where("createdBy", "==", user.uid),
        orderBy("createdAt", "desc")
      )
      const snapshot = await getDocs(q)
      const fetchedPresets = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        lastUsed: doc.data().lastUsed?.toDate()
      })) as WheelPreset[]
      
      setPresets(fetchedPresets)
    } catch (error) {
      console.error("Error fetching presets:", error)
      toast({
        title: "Error",
        description: "Failed to load presets",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const savePreset = async () => {
    if (!saveForm.name.trim()) {
      toast({
        title: "Name Required",
        description: "Please enter a name for your preset",
        variant: "destructive"
      })
      return
    }

    if (!currentActivity) {
      toast({
        title: "No Activity Data",
        description: "No current activity to save as preset",
        variant: "destructive"
      })
      return
    }

    try {
      const presetData = {
        name: saveForm.name,
        description: saveForm.description,
        category: saveForm.category,
        participants: currentActivity.participants,
        settings: currentActivity.settings,
        createdBy: user.uid,
        createdAt: new Date(),
        timesUsed: 0,
        isFavorite: false
      }

      await addDoc(collection(db, "wheelPresets"), presetData)
      
      toast({
        title: "Preset Saved",
        description: `"${saveForm.name}" has been saved successfully`,
      })
      
      setIsSaveDialogOpen(false)
      setSaveForm({ name: "", description: "", category: "academic" })
      fetchPresets()
    } catch (error) {
      console.error("Error saving preset:", error)
      toast({
        title: "Error",
        description: "Failed to save preset",
        variant: "destructive"
      })
    }
  }

  const loadPreset = async (preset: WheelPreset) => {
    try {
      // Update usage stats
      await updateDoc(doc(db, "wheelPresets", preset.id), {
        lastUsed: new Date(),
        timesUsed: preset.timesUsed + 1
      })

      onLoadPreset?.(preset)
      setIsLoadDialogOpen(false)
      
      toast({
        title: "Preset Loaded",
        description: `"${preset.name}" has been loaded`,
      })
      
      fetchPresets()
    } catch (error) {
      console.error("Error loading preset:", error)
      toast({
        title: "Error",
        description: "Failed to load preset",
        variant: "destructive"
      })
    }
  }

  const deletePreset = async (presetId: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"? This action cannot be undone.`)) {
      return
    }

    try {
      await deleteDoc(doc(db, "wheelPresets", presetId))
      
      toast({
        title: "Preset Deleted",
        description: `"${name}" has been deleted`,
      })
      
      fetchPresets()
    } catch (error) {
      console.error("Error deleting preset:", error)
      toast({
        title: "Error",
        description: "Failed to delete preset",
        variant: "destructive"
      })
    }
  }

  const toggleFavorite = async (preset: WheelPreset) => {
    try {
      await updateDoc(doc(db, "wheelPresets", preset.id), {
        isFavorite: !preset.isFavorite
      })
      
      fetchPresets()
    } catch (error) {
      console.error("Error updating favorite:", error)
    }
  }

  const exportPreset = (preset: WheelPreset) => {
    const exportData = {
      name: preset.name,
      description: preset.description,
      category: preset.category,
      participants: preset.participants,
      settings: preset.settings,
      exportedAt: new Date().toISOString(),
      exportedBy: user.email
    }

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${preset.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_preset.json`
    a.click()
    URL.revokeObjectURL(url)

    toast({
      title: "Preset Exported",
      description: "Preset has been downloaded as JSON file",
    })
  }

  const exportToExcel = (preset: WheelPreset) => {
    const worksheetData = [
      ["Name", "Email", "Contact Number"],
      ...preset.participants.map(p => [p.name, p.email || "", p.contactNumber || ""])
    ]

    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, "Participants")

    XLSX.writeFile(workbook, `${preset.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_participants.xlsx`)

    toast({
      title: "Participants Exported",
      description: "Participant list has been exported to Excel",
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold" style={{ color: schoolColors.primary }}>
            Wheel Presets
          </h3>
          <p className="text-sm text-muted-foreground">
            Save and reuse your wheel configurations
          </p>
        </div>
        
        <div className="flex gap-2">
          <Dialog open={isSaveDialogOpen} onOpenChange={setIsSaveDialogOpen}>
            <DialogTrigger asChild>
              <Button 
                className="bg-[#8e0b16] hover:bg-[#66181E]"
                disabled={!currentActivity}
              >
                <Save className="h-4 w-4 mr-2" />
                Save Preset
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle style={{ color: schoolColors.primary }}>Save Wheel Preset</DialogTitle>
                <DialogDescription>
                  Save your current wheel configuration for future use
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="preset-name">Preset Name</Label>
                  <Input
                    id="preset-name"
                    value={saveForm.name}
                    onChange={(e) => setSaveForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., Quiz Group Selector"
                  />
                </div>
                
                <div className="grid gap-2">
                  <Label htmlFor="preset-description">Description (Optional)</Label>
                  <Textarea
                    id="preset-description"
                    value={saveForm.description}
                    onChange={(e) => setSaveForm(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Brief description of this preset"
                    rows={3}
                  />
                </div>
                
                <div className="grid gap-2">
                  <Label htmlFor="preset-category">Category</Label>
                  <select 
                    id="preset-category"
                    value={saveForm.category}
                    onChange={(e) => setSaveForm(prev => ({ ...prev, category: e.target.value as any }))}
                    className="w-full p-2 border rounded"
                  >
                    <option value="academic">📚 Academic</option>
                    <option value="research">🔬 Research</option>
                    <option value="entertainment">🎮 Entertainment</option>
                    <option value="personal">👤 Personal</option>
                  </select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsSaveDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={savePreset} className="bg-[#8e0b16] hover:bg-[#66181E]">
                  Save Preset
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={isLoadDialogOpen} onOpenChange={setIsLoadDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" style={{ borderColor: schoolColors.primary, color: schoolColors.primary }}>
                <FolderOpen className="h-4 w-4 mr-2" />
                Load Preset
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle style={{ color: schoolColors.primary }}>Load Wheel Preset</DialogTitle>
                <DialogDescription>
                  Choose a saved preset to load its configuration
                </DialogDescription>
              </DialogHeader>
              <div className="max-h-[400px] overflow-y-auto">
                {loading ? (
                  <p className="text-center py-4 text-muted-foreground">Loading presets...</p>
                ) : presets.length === 0 ? (
                  <p className="text-center py-4 text-muted-foreground">No presets saved yet</p>
                ) : (
                  <div className="space-y-3">
                    {presets.map((preset) => (
                      <div key={preset.id} className="border rounded-lg p-4 hover:bg-gray-50">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-lg">{categoryIcons[preset.category]}</span>
                              <h4 className="font-medium">{preset.name}</h4>
                              {preset.isFavorite && (
                                <Star className="h-4 w-4 text-yellow-500 fill-current" />
                              )}
                            </div>
                            {preset.description && (
                              <p className="text-sm text-muted-foreground mb-2">{preset.description}</p>
                            )}
                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Users className="h-3 w-3" />
                                {preset.participants.length} participants
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                Used {preset.timesUsed} times
                              </span>
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => toggleFavorite(preset)}
                            >
                              <Star className={`h-4 w-4 ${preset.isFavorite ? 'text-yellow-500 fill-current' : 'text-gray-400'}`} />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => exportPreset(preset)}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => deletePreset(preset.id, preset.name)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => loadPreset(preset)}
                              className="bg-[#8e0b16] hover:bg-[#66181E] text-white"
                            >
                              Load
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Quick Stats */}
      {presets.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold" style={{ color: schoolColors.primary }}>
                {presets.length}
              </p>
              <p className="text-sm text-muted-foreground">Total Presets</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold" style={{ color: schoolColors.primary }}>
                {presets.filter(p => p.isFavorite).length}
              </p>
              <p className="text-sm text-muted-foreground">Favorites</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold" style={{ color: schoolColors.primary }}>
                {presets.reduce((sum, p) => sum + p.timesUsed, 0)}
              </p>
              <p className="text-sm text-muted-foreground">Total Uses</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold" style={{ color: schoolColors.primary }}>
                {presets.reduce((sum, p) => sum + p.participants.length, 0)}
              </p>
              <p className="text-sm text-muted-foreground">Total Participants</p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
