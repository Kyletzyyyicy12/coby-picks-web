"use client"

import React, { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from "@/components/ui/table"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { toast } from "@/hooks/use-toast"
import { db } from "@/lib/firebase"
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, orderBy, onSnapshot, serverTimestamp } from "firebase/firestore"
import { Plus, Edit, Trash2, Loader2, ArrowUp, ArrowDown } from "lucide-react"
import { WheelTypePresets } from "./wheel-type-presets"


interface WheelTypeConfig {
  id: string
  value: string // Unique identifier, e.g., "participant"
  label: string // Display name, e.g., "Participant Picker Wheel"
  description: string // Detailed description
  enabled: boolean // Whether this type is available to users
  order: number // Display order
  allowedRoles: string[] // Roles that can use this wheel type: ["organizer", "participant"]
  isActivityWheel: boolean // Whether this is an activity wheel that can be shared/collected
  canBeShared: boolean // Whether wheels of this type can be shared in real-time
  defaultSettings: {
    allowRealTimeCollection: boolean
    maxParticipants?: number
    requiresApproval: boolean
    congratsMessage?: string
  }
  defaultItems?: string[]
  createdAt: Date
  updatedAt: Date
}

export function WheelTypeManager() {
  const [wheelTypes, setWheelTypes] = useState<WheelTypeConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [newTypeLabel, setNewTypeLabel] = useState("")
  const [newTypeDescription, setNewTypeDescription] = useState("")
  const [newAllowedRoles, setNewAllowedRoles] = useState<string[]>(["organizer", "participant"])
  const [newIsActivityWheel, setNewIsActivityWheel] = useState(true)
  const [newCanBeShared, setNewCanBeShared] = useState(true)
  const [newAllowRealTimeCollection, setNewAllowRealTimeCollection] = useState(true)
  const [newMaxParticipants, setNewMaxParticipants] = useState<number | undefined>(undefined)
  const [newRequiresApproval, setNewRequiresApproval] = useState(false)
  const [newCongratsMessage, setNewCongratsMessage] = useState("Congratulations, {winner}!")
  const [editingType, setEditingType] = useState<WheelTypeConfig | null>(null)
  const [saving, setSaving] = useState(false)

  // Bulk delete states
  const [selectedWheelTypes, setSelectedWheelTypes] = useState<Set<string>>(new Set())
  const [isBulkDeleting, setIsBulkDeleting] = useState(false)
  const [showWheelTypeCheckboxes, setShowWheelTypeCheckboxes] = useState(false)


  const setupRealTimeListener = useCallback(() => {
    setLoading(true)

    const q = query(collection(db, "wheelTypes"), orderBy("order", "asc"))

    const unsubscribe = onSnapshot(q,
      (querySnapshot) => {
        const fetchedTypes: WheelTypeConfig[] = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          value: doc.data().value,
          label: doc.data().label,
          description: doc.data().description,
          enabled: doc.data().enabled,
          order: doc.data().order,
          allowedRoles: doc.data().allowedRoles || ["organizer", "participant"],
          isActivityWheel: doc.data().isActivityWheel || false,
          canBeShared: doc.data().canBeShared || false,
          defaultItems: doc.data().defaultItems || ["Option 1", "Option 2", "Option 3"],
          defaultSettings: doc.data().defaultSettings || {
            allowRealTimeCollection: false,
            requiresApproval: false,
            congratsMessage: "Congratulations, {winner}!"
          },
          createdAt: doc.data().createdAt?.toDate(),
          updatedAt: doc.data().updatedAt?.toDate(),
        }))
        setWheelTypes(fetchedTypes)
        setLoading(false)

        // Silence repetitive realtime update toast to avoid popup spam
      },
      (error) => {
        console.error("Error in wheel types listener:", error)
        toast({
          title: "Error Fetching Wheel Types",
          description: error.message,
          variant: "destructive",
        })
        setLoading(false)
      }
    )

    return unsubscribe
  }, [loading])

  useEffect(() => {
    const unsubscribe = setupRealTimeListener()
    return () => {
      if (unsubscribe) {
        unsubscribe()
      }
    }
  }, [])

  const handleAddWheelType = async () => {
    console.log("handleAddWheelType called")
    alert("Function started")

    if (!newTypeLabel) {
      console.log("Validation failed: missing label")
      alert("Validation failed: missing label")
      toast({
        title: "Missing Information",
        description: "Please fill in the label field.",
        variant: "destructive",
      })
      return
    }

    // Validate allowed roles
    if (newAllowedRoles.length === 0) {
      console.log("Validation failed: no allowed roles selected")
      toast({
        title: "Missing Allowed Roles",
        description: "Please select at least one role that can use this wheel type.",
        variant: "destructive",
      })
      return
    }

    // Validation for wheel items (manual input only)
    if (!newTypeDescription.trim()) {
      console.log("Validation failed: missing description")
      toast({
        title: "Missing Wheel Items",
        description: "Please enter items for the wheel in the description field.",
        variant: "destructive",
      })
      return
    }

    const finalItems = newTypeDescription.split(',').map(item => item.trim()).filter(item => item.length > 0)

    if (finalItems.length === 0) {
      console.log("Validation failed: no items parsed from description")
      toast({
        title: "No Items",
        description: "Please add at least one item to the wheel.",
        variant: "destructive",
      })
      return
    }
    // Generate internal value and check for duplicates
    const generatedValue = newTypeLabel.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
    console.log("Generated value:", generatedValue)
    if (wheelTypes.some((type) => type.value === generatedValue)) {
      console.log("Validation failed: duplicate value")
      toast({
        title: "Duplicate Value",
        description: "A wheel type with this name already exists.",
        variant: "destructive",
      })
      return
    }

    setSaving(true)
    try {
      console.log("About to add wheel type to Firestore")
      const newOrder = wheelTypes.length > 0 ? Math.max(...wheelTypes.map((t) => t.order)) + 1 : 1

      // Build defaultSettings object conditionally to avoid undefined values
      const defaultSettings: any = {
        allowRealTimeCollection: newAllowRealTimeCollection,
        requiresApproval: newRequiresApproval,
        congratsMessage: newCongratsMessage
      }

      // Only include maxParticipants if it has a value (not undefined)
      if (newMaxParticipants !== undefined) {
        defaultSettings.maxParticipants = newMaxParticipants
      }

      // Add the new wheel type
      const docRef = await addDoc(collection(db, "wheelTypes"), {
        value: generatedValue,
        label: newTypeLabel,
        description: newTypeDescription,
        enabled: true, // New types are enabled by default
        order: newOrder,
        allowedRoles: newAllowedRoles,
        isActivityWheel: newIsActivityWheel,
        canBeShared: newCanBeShared,
        defaultItems: finalItems,
        defaultSettings: defaultSettings,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })

      // Broadcast the change to all users by creating a system notification
      await addDoc(collection(db, "systemNotifications"), {
        type: "wheelTypeAdded",
        wheelTypeId: docRef.id,
        wheelTypeLabel: newTypeLabel,
        message: `New wheel type "${newTypeLabel}" is now available!`,
        createdAt: serverTimestamp(),
        isActive: true,
        targetRoles: newAllowedRoles,
        priority: "normal"
      })
      console.log("Wheel type added successfully")
      toast({
        title: "Wheel Type Added",
        description: `"${newTypeLabel}" has been added.`,
      })
      setNewTypeLabel("")
      setNewTypeDescription("")
      setNewAllowedRoles(["organizer", "participant"])
      setNewIsActivityWheel(true)
      setNewCanBeShared(true)
      setNewAllowRealTimeCollection(true)
      setNewMaxParticipants(undefined)
      setNewRequiresApproval(false)
      setNewCongratsMessage("Congratulations, {winner}!")
      setIsAddDialogOpen(false)
      // Real-time listener will automatically update the list
    } catch (error: any) {
      console.error("Error adding wheel type:", error)
      toast({
        title: "Error Adding Wheel Type",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const handleUpdateWheelType = async () => {
    if (!editingType) return
    if (!editingType.value || !editingType.label || !editingType.description) {
      toast({
        title: "Missing Information",
        description: "Please fill in all fields.",
        variant: "destructive",
      })
      return
    }

    setSaving(true)
    try {
      const typeRef = doc(db, "wheelTypes", editingType.id)

      // Build defaultSettings object conditionally to avoid undefined values
      const defaultSettings: any = {
        allowRealTimeCollection: editingType.defaultSettings.allowRealTimeCollection,
        requiresApproval: editingType.defaultSettings.requiresApproval,
        congratsMessage: editingType.defaultSettings.congratsMessage
      }

      // Only include maxParticipants if it has a value (not undefined)
      if (editingType.defaultSettings.maxParticipants !== undefined) {
        defaultSettings.maxParticipants = editingType.defaultSettings.maxParticipants
      }

      await updateDoc(typeRef, {
        value: editingType.value,
        label: editingType.label,
        description: editingType.description,
        enabled: editingType.enabled,
        order: editingType.order,
        allowedRoles: editingType.allowedRoles,
        isActivityWheel: editingType.isActivityWheel,
        canBeShared: editingType.canBeShared,
        defaultSettings: defaultSettings,
        updatedAt: new Date(),
      })
      toast({
        title: "Wheel Type Updated",
        description: `"${editingType.label}" has been updated.`,
      })
      setIsEditDialogOpen(false)
      setEditingType(null)
      // Real-time listener will automatically update the list
    } catch (error: any) {
      toast({
        title: "Error Updating Wheel Type",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteWheelType = async (typeId: string, typeLabel: string) => {
    if (!confirm(`Are you sure you want to delete the wheel type "${typeLabel}"? This action cannot be undone.`)) {
      return
    }

    try {
      await deleteDoc(doc(db, "wheelTypes", typeId))
      toast({
        title: "Wheel Type Deleted",
        description: `"${typeLabel}" has been deleted.`,
      })
      // Real-time listener will automatically update the list
    } catch (error: any) {
      toast({
        title: "Error Deleting Wheel Type",
        description: error.message,
        variant: "destructive",
      })
    }
  }

  // Bulk delete handler for multiple wheel types
  const handleBulkDeleteWheelTypes = async () => {
    if (selectedWheelTypes.size === 0) {
      toast({
        title: "No Wheel Types Selected",
        description: "Please select wheel types to delete.",
        variant: "destructive",
      })
      return
    }

    const selectedTypesArray = Array.from(selectedWheelTypes)
    const selectedTypeLabels = selectedTypesArray.map(id =>
      wheelTypes.find(type => type.id === id)?.label || "Unknown"
    ).join(", ")

    const confirmMessage = `Are you sure you want to permanently delete ${selectedTypesArray.length} wheel type(s): ${selectedTypeLabels}? This action cannot be undone.`

    if (!confirm(confirmMessage)) {
      console.log(`🛑 Bulk wheel type deletion cancelled`)
      return
    }

    setIsBulkDeleting(true)
    let successCount = 0
    let errorCount = 0

    try {
      for (const typeId of selectedTypesArray) {
        const wheelType = wheelTypes.find(type => type.id === typeId)
        if (!wheelType) continue

        try {
          await deleteDoc(doc(db, "wheelTypes", typeId))
          console.log(`✅ Successfully deleted wheel type: ${wheelType.label}`)
          successCount++
        } catch (error: any) {
          console.error(`❌ Error deleting wheel type ${wheelType.label}:`, error)
          errorCount++
        }
      }

      // Clear selection
      setSelectedWheelTypes(new Set())

      // Show results
      if (successCount > 0) {
        toast({
          title: "Bulk Delete Completed",
          description: `Successfully deleted ${successCount} wheel type(s)${errorCount > 0 ? `, ${errorCount} failed` : ''}.`,
        })
      } else {
        toast({
          title: "Bulk Delete Failed",
          description: `Failed to delete any wheel types. Check the console for details.`,
          variant: "destructive",
        })
      }
    } catch (error: any) {
      console.error("Error in bulk delete:", error)
      toast({
        title: "Bulk Delete Error",
        description: error.message || "An unexpected error occurred during bulk delete.",
        variant: "destructive",
      })
    } finally {
      setIsBulkDeleting(false)
    }
  }

  // Handle select all checkbox
  const handleSelectAllWheelTypes = (checked: boolean) => {
    if (checked) {
      const allTypeIds = new Set(wheelTypes.map(type => type.id))
      setSelectedWheelTypes(allTypeIds)
    } else {
      setSelectedWheelTypes(new Set())
    }
  }

  // Handle individual wheel type selection
  const handleSelectWheelType = (typeId: string, checked: boolean) => {
    const newSelected = new Set(selectedWheelTypes)
    if (checked) {
      newSelected.add(typeId)
    } else {
      newSelected.delete(typeId)
    }
    setSelectedWheelTypes(newSelected)
  }

  // Toggle wheel type selection mode
  const toggleWheelTypeSelectMode = () => {
    if (showWheelTypeCheckboxes) {
      // Exiting select mode, clear selections
      setSelectedWheelTypes(new Set())
    }
    setShowWheelTypeCheckboxes(!showWheelTypeCheckboxes)
  }

  const handleToggleEnabled = async (type: WheelTypeConfig) => {
    try {
      const typeRef = doc(db, "wheelTypes", type.id)
      await updateDoc(typeRef, { enabled: !type.enabled, updatedAt: new Date() })
      toast({
        title: "Status Updated",
        description: `"${type.label}" is now ${!type.enabled ? "enabled" : "disabled"}.`,
      })
      // Real-time listener will automatically update the list
    } catch (error: any) {
      toast({
        title: "Error Updating Status",
        description: error.message,
        variant: "destructive",
      })
    }
  }

  const handleMoveType = async (typeToMove: WheelTypeConfig, direction: "up" | "down") => {
    const currentIndex = wheelTypes.findIndex((t) => t.id === typeToMove.id)
    if (currentIndex === -1) return

    const newIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1
    if (newIndex < 0 || newIndex >= wheelTypes.length) return // Out of bounds

    const updatedTypes = [...wheelTypes]
    const [removed] = updatedTypes.splice(currentIndex, 1)
    updatedTypes.splice(newIndex, 0, removed)

    // Reassign orders based on new array position
    const batch = []
    for (let i = 0; i < updatedTypes.length; i++) {
      const type = updatedTypes[i]
      if (type.order !== i + 1) {
        batch.push(updateDoc(doc(db, "wheelTypes", type.id), { order: i + 1, updatedAt: new Date() }))
      }
    }

    try {
      await Promise.all(batch)
      toast({
        title: "Order Updated",
        description: `"${typeToMove.label}" moved ${direction}.`,
      })
      // Real-time listener will automatically update the list
    } catch (error: any) {
      toast({
        title: "Error Reordering",
        description: error.message,
        variant: "destructive",
      })
    }
  }

  return (
    <div className="grid gap-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-xl font-semibold text-swu-red">Manage Wheel Types</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Control wheel type availability and settings.
            <span className="text-green-600 font-medium"> Preset wheel types are automatically enabled for all users.</span>
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={toggleWheelTypeSelectMode}
            variant={showWheelTypeCheckboxes ? "default" : "outline"}
            size="sm"
          >
            {showWheelTypeCheckboxes ? "Cancel" : "Select items"}
          </Button>
          {selectedWheelTypes.size > 0 && (
            <Button
              onClick={handleBulkDeleteWheelTypes}
              disabled={isBulkDeleting}
              variant="destructive"
              size="sm"
            >
              {isBulkDeleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
            </Button>
          )}
          <WheelTypePresets onPresetAdded={() => {
            // Real-time listener will automatically update the list
            toast({
              title: "Preset Added",
              description: "The wheel type preset has been added successfully!",
            })
          }} />
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button
                size="sm"
                className="gap-1 bg-swu-red hover:bg-swu-red/90 text-white"
              >
                <Plus className="h-4 w-4" />
                Add Custom Type
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-swu-red">Add New Wheel Type</DialogTitle>
                <DialogDescription>
                  Create a custom wheel type with your own items and settings.
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="new-type-label">Display Label *</Label>
                  <Input
                    id="new-type-label"
                    value={newTypeLabel}
                    onChange={(e) => {
                      console.log("Label changed to:", e.target.value)
                      setNewTypeLabel(e.target.value)
                    }}
                    placeholder="User-friendly name"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="new-type-description">Wheel Items *</Label>
                  <Textarea
                    id="new-type-description"
                    value={newTypeDescription}
                    onChange={(e) => {
                      console.log("Description changed to:", e.target.value)
                      setNewTypeDescription(e.target.value)
                    }}
                    placeholder="Enter items separated by commas (e.g., Apple, Banana, Orange)"
                    rows={3}
                  />
                  <p className="text-xs text-muted-foreground">
                    Required: Enter at least one item for the wheel
                  </p>
                </div>



                <div className="grid gap-2">
                  <Label>Allowed Roles *</Label>
                  <div className="flex flex-wrap gap-2">
                    {["organizer", "participant"].map((role) => (
                      <div key={role} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id={`new-role-${role}`}
                          checked={newAllowedRoles.includes(role)}
                          onChange={(e) => {
                            console.log(`Checkbox ${role} changed:`, e.target.checked)
                            if (e.target.checked) {
                              setNewAllowedRoles([...newAllowedRoles, role])
                            } else {
                              setNewAllowedRoles(newAllowedRoles.filter(r => r !== role))
                            }
                          }}
                        />
                        <Label htmlFor={`new-role-${role}`} className="capitalize">{role}</Label>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Required: Select at least one role that can use this wheel type
                  </p>
                  <p className="text-xs text-blue-600">
                    Current roles: {newAllowedRoles.join(', ') || 'none selected'}
                  </p>
                </div>

                {/* Advanced Settings */}
                <div className="grid gap-2">
                  <Label className="text-base font-semibold text-swu-red">Advanced Settings</Label>
                  <div className="grid gap-3 p-3 border rounded-lg bg-gray-50">
                    <div className="grid gap-2">
                      <Label htmlFor="new-congrats-message">Ending Message</Label>
                      <Textarea
                        id="new-congrats-message"
                        value={newCongratsMessage}
                        onChange={(e) => setNewCongratsMessage(e.target.value)}
                        placeholder="Congratulations, {winner}!"
                        rows={2}
                      />
                      <p className="text-xs text-muted-foreground">
                        Use {'{winner}'} as placeholder for the selected participant's name
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsAddDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    console.log("Add Wheel Type button clicked")
                    alert("Button clicked - attempting to add wheel type")
                    handleAddWheelType()
                  }}
                  disabled={saving}
                  className="bg-swu-red hover:bg-swu-red/90 text-white"
                >
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {saving ? "Adding..." : "Add Wheel Type"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-swu-red" />
          <p className="ml-2 text-muted-foreground">Loading wheel types...</p>
        </div>
      ) : wheelTypes.length === 0 ? (
        <p className="text-muted-foreground text-center py-4">No wheel types found. Add one above!</p>
      ) : (
        <div className="border border-gray-200 rounded-md overflow-hidden">
          <Table>
            <TableCaption>A list of available wheel types. Use checkboxes to select multiple wheel types for bulk deletion.</TableCaption>
            <TableHeader className="bg-gray-50">
              <TableRow>
                {showWheelTypeCheckboxes && (
                  <TableHead className="w-[50px]">
                    <Checkbox
                      checked={selectedWheelTypes.size === wheelTypes.length && wheelTypes.length > 0}
                      onCheckedChange={handleSelectAllWheelTypes}
                      aria-label="Select all wheel types"
                    />
                  </TableHead>
                )}
                <TableHead className="w-[50px]">Order</TableHead>
                <TableHead>Label</TableHead>
                <TableHead>Value</TableHead>
                <TableHead>Roles</TableHead>
                <TableHead>Activity</TableHead>
                <TableHead>Shareable</TableHead>
                <TableHead>Enabled</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {wheelTypes.map((type, index) => (
                <TableRow key={type.id}>
                  {showWheelTypeCheckboxes && (
                    <TableCell>
                      <Checkbox
                        checked={selectedWheelTypes.has(type.id)}
                        onCheckedChange={(checked) => handleSelectWheelType(type.id, checked as boolean)}
                        aria-label={`Select ${type.label}`}
                      />
                    </TableCell>
                  )}
                  <TableCell className="font-medium">{type.order}</TableCell>
                  <TableCell>{type.label}</TableCell>
                  <TableCell className="font-mono text-sm text-muted-foreground">{type.value}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {type.allowedRoles.map(role => (
                        <span key={role} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded capitalize">
                          {role}
                        </span>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    {type.isActivityWheel ? (
                      <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">Activity</span>
                    ) : (
                      <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs rounded">Standard</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {type.canBeShared ? (
                      <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded">Shareable</span>
                    ) : (
                      <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs rounded">Private</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Switch checked={type.enabled} onCheckedChange={() => handleToggleEnabled(type)} />
                  </TableCell>
                  <TableCell className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-gray-500 hover:bg-gray-500/10"
                      onClick={() => handleMoveType(type, "up")}
                      disabled={index === 0}
                    >
                      <ArrowUp className="h-4 w-4" />
                      <span className="sr-only">Move Up</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-gray-500 hover:bg-gray-500/10"
                      onClick={() => handleMoveType(type, "down")}
                      disabled={index === wheelTypes.length - 1}
                    >
                      <ArrowDown className="h-4 w-4" />
                      <span className="sr-only">Move Down</span>
                    </Button>
                    <Dialog open={isEditDialogOpen && editingType?.id === type.id} onOpenChange={setIsEditDialogOpen}>
                      <DialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-blue-500 hover:bg-blue-500/10"
                          onClick={(e) => {
                            e.stopPropagation()
                            setEditingType(type)
                            setIsEditDialogOpen(true)
                          }}
                        >
                          <Edit className="h-4 w-4" />
                          <span className="sr-only">Edit Type</span>
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-[500px] md:max-w-[600px] lg:max-w-[700px] max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle className="text-swu-red">Edit Wheel Type: {editingType?.label}</DialogTitle>
                          <DialogDescription>Update the properties of this wheel type.</DialogDescription>
                        </DialogHeader>
                        {editingType && (
                          <div className="grid gap-4 py-4">
                            <div className="grid gap-2">
                              <Label htmlFor="edit-type-value">Internal Value</Label>
                              <Input
                                id="edit-type-value"
                                value={editingType.value}
                                onChange={(e) => setEditingType({ ...editingType, value: e.target.value })}
                                disabled // Value should not be changed after creation
                              />
                            </div>
                            <div className="grid gap-2">
                              <Label htmlFor="edit-type-label">Display Label</Label>
                              <Input
                                id="edit-type-label"
                                value={editingType.label}
                                onChange={(e) => setEditingType({ ...editingType, label: e.target.value })}
                              />
                            </div>
                            <div className="grid gap-2">
                              <Label htmlFor="edit-type-description">Description</Label>
                              <Textarea
                                id="edit-type-description"
                                value={editingType.description}
                                onChange={(e) => setEditingType({ ...editingType, description: e.target.value })}
                                rows={3}
                              />
                            </div>


                          </div>
                        )}
                        <DialogFooter>
                          <Button
                            onClick={handleUpdateWheelType}
                            disabled={saving}
                            className="bg-swu-red hover:bg-swu-red/90 text-white"
                          >
                            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            {saving ? "Saving..." : "Save Changes"}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-red-500 hover:bg-red-500/10"
                      onClick={() => handleDeleteWheelType(type.id, type.label)}
                    >
                      <Trash2 className="h-4 w-4" />
                      <span className="sr-only">Delete Type</span>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
