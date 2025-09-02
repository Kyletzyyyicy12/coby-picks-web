"use client"

import { useState, useEffect, useRef } from "react"
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
import { type PickerWheelType, generateNumberRange, generateDateRange, PICKER_WHEEL_TYPES } from "@/lib/picker-wheel-types"
import { Settings, Plus, Trash2, RotateCcw, Download, Share2, Target } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { QuickActivityCreator } from "./quick-activity-creator"
import { auth } from "@/lib/firebase"
import { onAuthStateChanged, type User } from "firebase/auth"

interface DynamicPickerWheelProps {
  wheelType: PickerWheelType
  onBack?: () => void
  externalParticipants?: Array<{ id: string; name: string; email?: string }>
  onParticipantsChange?: (participants: Participant[]) => void
  isStudentMode?: boolean
  user?: User | null
  soloMode?: boolean // New prop to disable live session functionality
}

interface Participant {
  id: string
  name: string
}

export function DynamicPickerWheel({
  wheelType,
  onBack,
  externalParticipants,
  onParticipantsChange,
  isStudentMode = false,
  user: propUser,
  soloMode = false
}: DynamicPickerWheelProps) {
  const [participants, setParticipants] = useState<Participant[]>([])
  const [newItem, setNewItem] = useState("")
  const [isCustomizing, setIsCustomizing] = useState(false)
  const [numberRange, setNumberRange] = useState({ start: 1, end: 10 })
  const [dateRange, setDateRange] = useState({
    start: new Date().toISOString().split('T')[0],
    end: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  })
  const [user, setUser] = useState<User | null>(propUser || null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isWheelSwitcherOpen, setIsWheelSwitcherOpen] = useState(false)
  const prevExternalParticipantsRef = useRef<string | null>(null)
  const lastSentParticipantsRef = useRef<string | null>(null)

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
    } else if (participants.length === 0) {
      // Only initialize if participants are empty
      initializeParticipants()
    }
  }, [wheelType.id, externalParticipants, participants.length])

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
    // Prevent initialization if we already have participants or external participants
    if (participants.length > 0 || (externalParticipants && externalParticipants.length > 0)) {
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

    if (wheelType.maxItems && participants.length >= wheelType.maxItems) {
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

    setNewItem("")

    toast({
      title: "Item Added",
      description: `"${newItem.trim()}" has been added to the wheel`,
    })
  }

  const removeItem = (id: string) => {
    // Allow deletion of all items - no minimum restriction for better UX
    const updatedParticipants = participants.filter(p => p.id !== id)
    setParticipants(updatedParticipants)

    // Update external participants if callback is provided
    if (onParticipantsChange) {
      onParticipantsChange(updatedParticipants)
    }

    toast({
      title: "Item Removed",
      description: "Item has been removed from the wheel",
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
    toast({
      title: "Reset Complete",
      description: "Wheel has been reset to default items"
    })
  }

  const updateNumberRange = () => {
    const items = generateNumberRange(numberRange.start, numberRange.end)
    const newParticipants = items.map((item, index) => ({
      id: `number-${index}`,
      name: item
    }))
    setParticipants(newParticipants)
  }

  const updateDateRange = () => {
    const items = generateDateRange(new Date(dateRange.start), new Date(dateRange.end))
    const newParticipants = items.map((item, index) => ({
      id: `date-${index}`,
      name: item
    }))
    setParticipants(newParticipants)
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
        {/* Action Buttons - Hidden in Solo Mode */}
        {!soloMode && (
          <div className="flex items-center gap-2">
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
            
            {onBack && (
              <Button
                variant="outline"
                onClick={onBack}
              >
                Back to Gallery
              </Button>
            )}
          </div>
        )}

      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Wheel / Team Picker */}
        <div className="lg:col-span-2">
          {wheelType.id === 'team-picker' ? (
            <EnhancedTeamPicker 
              initialNames={participants.map(p => p.name)} 
              canEdit={!isStudentMode && !soloMode}
              onTeamsGenerated={(teams) => {
                toast({
                  title: "Teams Generated! 🎉",
                  description: `Created ${teams.length} teams successfully`,
                })
              }}
              disabled={isStudentMode}
              readonly={soloMode}
            />
          ) : (
            <Card>
              <CardContent className="p-6">
                <EnhancedWheel
                  participants={participants}
                  onSpinComplete={(result) => {
                    toast({
                      title: "Spin Complete!",
                      description: `Selected: ${result.winners.map(w => w.name).join(", ")}`
                    })
                  }}
                />
              </CardContent>
            </Card>
          )}
        </div>

        {/* Settings Panel */}
        <div className="space-y-4">
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

                <Button variant="outline" onClick={resetToDefault} className="w-full">
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Reset to Default
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Items List */}
          <Card>
            <CardHeader>
              <CardTitle>Current Items ({participants.length})</CardTitle>
              <CardDescription>
                {wheelType.isCustomizable ? "Add custom items for your wheel. Click to remove items." : "Default items for this wheel"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Add Item Section */}
              {(wheelType.isCustomizable || externalParticipants) && (
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
