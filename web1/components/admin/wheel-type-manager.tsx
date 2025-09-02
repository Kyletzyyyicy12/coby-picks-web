"use client"

import React, { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"
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
  createdAt: Date
  updatedAt: Date
}

export function WheelTypeManager() {
  const [wheelTypes, setWheelTypes] = useState<WheelTypeConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [newTypeValue, setNewTypeValue] = useState("")
  const [newTypeLabel, setNewTypeLabel] = useState("")
  const [newTypeDescription, setNewTypeDescription] = useState("")
  const [newAllowedRoles, setNewAllowedRoles] = useState<string[]>(["organizer"])
  const [newIsActivityWheel, setNewIsActivityWheel] = useState(true)
  const [newCanBeShared, setNewCanBeShared] = useState(true)
  const [newAllowRealTimeCollection, setNewAllowRealTimeCollection] = useState(true)
  const [newMaxParticipants, setNewMaxParticipants] = useState<number | undefined>(undefined)
  const [newRequiresApproval, setNewRequiresApproval] = useState(false)
  const [newCongratsMessage, setNewCongratsMessage] = useState("Congratulations, {winner}!")
  const [editingType, setEditingType] = useState<WheelTypeConfig | null>(null)
  const [saving, setSaving] = useState(false)

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
          allowedRoles: doc.data().allowedRoles || ["organizer"],
          isActivityWheel: doc.data().isActivityWheel || false,
          canBeShared: doc.data().canBeShared || false,
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
    if (!newTypeValue || !newTypeLabel || !newTypeDescription) {
      toast({
        title: "Missing Information",
        description: "Please fill in all fields.",
        variant: "destructive",
      })
      return
    }
    if (wheelTypes.some((type) => type.value === newTypeValue)) {
      toast({
        title: "Duplicate Value",
        description: "A wheel type with this value already exists.",
        variant: "destructive",
      })
      return
    }

    setSaving(true)
    try {
      const newOrder = wheelTypes.length > 0 ? Math.max(...wheelTypes.map((t) => t.order)) + 1 : 1

      // Add the new wheel type
      const docRef = await addDoc(collection(db, "wheelTypes"), {
        value: newTypeValue,
        label: newTypeLabel,
        description: newTypeDescription,
        enabled: true, // New types are enabled by default
        order: newOrder,
        allowedRoles: newAllowedRoles,
        isActivityWheel: newIsActivityWheel,
        canBeShared: newCanBeShared,
        defaultSettings: {
          allowRealTimeCollection: newAllowRealTimeCollection,
          maxParticipants: newMaxParticipants,
          requiresApproval: newRequiresApproval,
          congratsMessage: newCongratsMessage
        },
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
      toast({
        title: "Wheel Type Added",
        description: `"${newTypeLabel}" has been added.`,
      })
      setNewTypeValue("")
      setNewTypeLabel("")
      setNewTypeDescription("")
      setNewAllowedRoles(["organizer"])
      setNewIsActivityWheel(true)
      setNewCanBeShared(true)
      setNewAllowRealTimeCollection(true)
      setNewMaxParticipants(undefined)
      setNewRequiresApproval(false)
      setNewCongratsMessage("Congratulations, {winner}!")
      setIsAddDialogOpen(false)
      // Real-time listener will automatically update the list
    } catch (error: any) {
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
      await updateDoc(typeRef, {
        value: editingType.value,
        label: editingType.label,
        description: editingType.description,
        enabled: editingType.enabled,
        order: editingType.order,
        allowedRoles: editingType.allowedRoles,
        isActivityWheel: editingType.isActivityWheel,
        canBeShared: editingType.canBeShared,
        defaultSettings: editingType.defaultSettings,
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
          <WheelTypePresets onPresetAdded={() => {
            // Real-time listener will automatically update the list
            toast({
              title: "Preset Added",
              description: "The wheel type preset has been added successfully!",
            })
          }} />
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1 bg-swu-red hover:bg-swu-red/90 text-white">
                <Plus className="h-4 w-4" />
                Add Custom Type
              </Button>
            </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle className="text-swu-red">Add New Wheel Type</DialogTitle>
              <DialogDescription>Define a new type of wheel for users to create.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="new-type-value">Internal Value (e.g., "participant")</Label>
                <Input
                  id="new-type-value"
                  value={newTypeValue}
                  onChange={(e) => setNewTypeValue(e.target.value)}
                  placeholder="Unique identifier (no spaces)"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="new-type-label">Display Label (e.g., "Participant Picker Wheel")</Label>
                <Input
                  id="new-type-label"
                  value={newTypeLabel}
                  onChange={(e) => setNewTypeLabel(e.target.value)}
                  placeholder="User-friendly name"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="new-type-description">Description</Label>
                <Textarea
                  id="new-type-description"
                  value={newTypeDescription}
                  onChange={(e) => setNewTypeDescription(e.target.value)}
                  placeholder="A brief explanation of this wheel type"
                  rows={3}
                  required
                />
              </div>

              <div className="grid gap-2">
                <Label>Allowed Roles</Label>
                <div className="flex flex-wrap gap-2">
                  {["organizer", "participant"].map((role) => (
                    <div key={role} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id={`new-role-${role}`}
                        checked={newAllowedRoles.includes(role)}
                        onChange={(e) => {
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
              </div>

              <div className="grid gap-2">
                <Label>Activity Wheel Settings</Label>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="new-is-activity-wheel"
                    checked={newIsActivityWheel}
                    onCheckedChange={setNewIsActivityWheel}
                  />
                  <Label htmlFor="new-is-activity-wheel">Is Activity Wheel</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="new-can-be-shared"
                    checked={newCanBeShared}
                    onCheckedChange={setNewCanBeShared}
                  />
                  <Label htmlFor="new-can-be-shared">Can Be Shared in Real-time</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="new-allow-real-time-collection"
                    checked={newAllowRealTimeCollection}
                    onCheckedChange={setNewAllowRealTimeCollection}
                  />
                  <Label htmlFor="new-allow-real-time-collection">Allow Real-time Collection</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="new-requires-approval"
                    checked={newRequiresApproval}
                    onCheckedChange={setNewRequiresApproval}
                  />
                  <Label htmlFor="new-requires-approval">Requires Approval</Label>
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="new-max-participants">Max Participants (optional)</Label>
                <Input
                  id="new-max-participants"
                  type="number"
                  value={newMaxParticipants || ""}
                  onChange={(e) => setNewMaxParticipants(e.target.value ? parseInt(e.target.value) : undefined)}
                  placeholder="Leave empty for unlimited"
                />
              </div>

              {/* Advanced Settings */}
              <div className="grid gap-2">
                <Label className="text-base font-semibold text-swu-red">Advanced Settings</Label>
                <div className="grid gap-3 p-3 border rounded-lg bg-gray-50">
                  <div className="grid gap-2">
                    <Label htmlFor="new-congrats-message">Congratulations Message</Label>
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
                onClick={handleAddWheelType}
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
            <TableCaption>A list of available wheel types.</TableCaption>
            <TableHeader className="bg-gray-50">
              <TableRow>
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
                      <DialogContent className="sm:max-w-[425px]">
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
                                required
                                disabled // Value should not be changed after creation
                              />
                            </div>
                            <div className="grid gap-2">
                              <Label htmlFor="edit-type-label">Display Label</Label>
                              <Input
                                id="edit-type-label"
                                value={editingType.label}
                                onChange={(e) => setEditingType({ ...editingType, label: e.target.value })}
                                required
                              />
                            </div>
                            <div className="grid gap-2">
                              <Label htmlFor="edit-type-description">Description</Label>
                              <Textarea
                                id="edit-type-description"
                                value={editingType.description}
                                onChange={(e) => setEditingType({ ...editingType, description: e.target.value })}
                                rows={3}
                                required
                              />
                            </div>

                            <div className="grid gap-2">
                              <Label>Allowed Roles</Label>
                              <div className="flex flex-wrap gap-2">
                                {["organizer", "participant"].map((role) => (
                                  <div key={role} className="flex items-center space-x-2">
                                    <input
                                      type="checkbox"
                                      id={`edit-role-${role}`}
                                      checked={editingType.allowedRoles.includes(role)}
                                      onChange={(e) => {
                                        if (e.target.checked) {
                                          setEditingType({
                                            ...editingType,
                                            allowedRoles: [...editingType.allowedRoles, role]
                                          })
                                        } else {
                                          setEditingType({
                                            ...editingType,
                                            allowedRoles: editingType.allowedRoles.filter(r => r !== role)
                                          })
                                        }
                                      }}
                                    />
                                    <Label htmlFor={`edit-role-${role}`} className="capitalize">{role}</Label>
                                  </div>
                                ))}
                              </div>
                            </div>

                            <div className="grid gap-2">
                              <Label>Activity Wheel Settings</Label>
                              <div className="flex items-center space-x-2">
                                <Switch
                                  id="edit-is-activity-wheel"
                                  checked={editingType.isActivityWheel}
                                  onCheckedChange={(checked) => setEditingType({ ...editingType, isActivityWheel: checked })}
                                />
                                <Label htmlFor="edit-is-activity-wheel">Is Activity Wheel</Label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <Switch
                                  id="edit-can-be-shared"
                                  checked={editingType.canBeShared}
                                  onCheckedChange={(checked) => setEditingType({ ...editingType, canBeShared: checked })}
                                />
                                <Label htmlFor="edit-can-be-shared">Can Be Shared in Real-time</Label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <Switch
                                  id="edit-allow-real-time-collection"
                                  checked={editingType.defaultSettings.allowRealTimeCollection}
                                  onCheckedChange={(checked) => setEditingType({
                                    ...editingType,
                                    defaultSettings: { ...editingType.defaultSettings, allowRealTimeCollection: checked }
                                  })}
                                />
                                <Label htmlFor="edit-allow-real-time-collection">Allow Real-time Collection</Label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <Switch
                                  id="edit-requires-approval"
                                  checked={editingType.defaultSettings.requiresApproval}
                                  onCheckedChange={(checked) => setEditingType({
                                    ...editingType,
                                    defaultSettings: { ...editingType.defaultSettings, requiresApproval: checked }
                                  })}
                                />
                                <Label htmlFor="edit-requires-approval">Requires Approval</Label>
                              </div>
                            </div>

                            <div className="grid gap-2">
                              <Label htmlFor="edit-max-participants">Max Participants (optional)</Label>
                              <Input
                                id="edit-max-participants"
                                type="number"
                                value={editingType.defaultSettings.maxParticipants || ""}
                                onChange={(e) => setEditingType({
                                  ...editingType,
                                  defaultSettings: {
                                    ...editingType.defaultSettings,
                                    maxParticipants: e.target.value ? parseInt(e.target.value) : undefined
                                  }
                                })}
                                placeholder="Leave empty for unlimited"
                              />
                            </div>

                            {/* Advanced Settings */}
                            <div className="grid gap-2">
                              <Label className="text-base font-semibold text-swu-red">Advanced Settings</Label>
                              <div className="grid gap-3 p-3 border rounded-lg bg-gray-50">
                                <div className="grid gap-2">
                                  <Label htmlFor="edit-congrats-message">Congratulations Message</Label>
                                  <Textarea
                                    id="edit-congrats-message"
                                    value={editingType.defaultSettings.congratsMessage || "Congratulations, {winner}!"}
                                    onChange={(e) => setEditingType({
                                      ...editingType,
                                      defaultSettings: {
                                        ...editingType.defaultSettings,
                                        congratsMessage: e.target.value
                                      }
                                    })}
                                    placeholder="Congratulations, {winner}!"
                                    rows={2}
                                  />
                                  <p className="text-xs text-muted-foreground">
                                    Use {'{winner}'} as placeholder for the selected participant's name
                                  </p>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center space-x-2">
                              <Switch
                                id="edit-type-enabled"
                                checked={editingType.enabled}
                                onCheckedChange={(checked) => setEditingType({ ...editingType, enabled: checked })}
                              />
                              <Label htmlFor="edit-type-enabled">Enabled for Users</Label>
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
