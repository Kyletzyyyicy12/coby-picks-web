"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { auth, db } from "@/lib/firebase"
import { signOut, type User } from "firebase/auth"
import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  deleteField,
  orderBy,
} from "firebase/firestore"
import { toast } from "@/hooks/use-toast"
import { Plus, Edit, Trash2, Share2, Settings, Upload, Download, RotateCcw } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { CobyPicksWheel } from "@/components/wheel/coby-picks-wheel"
import { DataImporter } from "@/components/data/data-importer"
import { WinnerExport } from "@/components/data/winner-export"
import { CollaboratorInvite } from "@/components/shared/collaborator-invite"
import { PrivacyConsent } from "@/components/shared/privacy-consent"
import { AnnouncementDisplay } from "@/components/shared/announcement-display"
import { ToolSettings } from "@/settings/tool-settings" // Import new settings component
import { THEMES } from "@/lib/wheel-data" // Import THEMES

// Define WheelTypeConfig from the database structure
interface WheelTypeConfig {
  id: string
  value: string
  label: string
  description: string
  enabled: boolean
  order: number
  createdAt?: Date
  updatedAt?: Date
  // New properties for enhanced functionality
  isUserSpecific?: boolean
  category?: string
  icon?: string
}

type WheelType =
  | "participant"
  | "category"
  | "yes-no"
  | "number"
  | "letter"
  | "country"
  | "color"
  | "image"
  | "date"
  | "mlb"
  | "nba"
  | "nfl"
  | string // Allow for custom/dynamic types

interface Wheel {
  id: string
  name: string
  topic: string
  category: string
  congratulatoryMessage: string
  theme: string
  ownerId: string
  type: WheelType // New property for wheel type
  // Type-specific configurations
  numberMin?: number
  numberMax?: number
  dateStart?: string // YYYY-MM-DD
  dateEnd?: string // YYYY-MM-DD
  imageUrls?: string[] // For image picker
  collaborators?: string[]
  // New settings properties
  spinSpeedLevel?: number
  spinDuration?: number
  manualStop?: boolean
  mysterySpin?: boolean
  spinCount?: number
  randomInitialAngle?: boolean
  initialSpinning?: boolean
  wheelBgImage?: string
  centerImage?: string
  centerImageSize?: number
  pageBackgroundColor?: string
  wheelBorderWidth?: number
  wheelBorderColor?: string
  wheelShadow?: string
  confettiAndSound?: boolean
  createdAt?: Date
  updatedAt?: Date

}

export function Dashboard({ user, userRole }: { user: User; userRole: string }) {
  const [wheels, setWheels] = useState<Wheel[]>([])
  const [newWheelName, setNewWheelName] = useState("")
  const [newWheelTopic, setNewWheelTopic] = useState("")
  const [newWheelCategory, setNewWheelCategory] = useState("Personal")
  const [newWheelMessage, setNewWheelMessage] = useState("Congratulations, {winner}!")
  const [newWheelTheme, setNewWheelTheme] = useState("default")
  const [newWheelType, setNewWheelType] = useState<WheelType>("participant") // Default to participant
  const [newNumberMin, setNewNumberMin] = useState(1)
  const [newNumberMax, setNewNumberMax] = useState(100)
  const [newDateStart, setNewDateStart] = useState("")
  const [newDateEnd, setNewDateEnd] = useState("")
  const [newImageUrls, setNewImageUrls] = useState("") // Comma-separated URLs


  const [availableWheelTypes, setAvailableWheelTypes] = useState<WheelTypeConfig[]>([]) // Dynamic wheel types

  // New states for default settings when creating a new wheel
  const [newSpinSpeedLevel, setNewSpinSpeedLevel] = useState(5)
  const [newSpinDuration, setNewSpinDuration] = useState(10)
  const [newManualStop, setNewManualStop] = useState(false)
  const [newMysterySpin, setNewMysterySpin] = useState(false)
  const [newRandomInitialAngle, setNewRandomInitialAngle] = useState(false)
  const [newInitialSpinning, setNewInitialSpinning] = useState(false)
  const [newWheelBgImage, setNewWheelBgImage] = useState("")
  const [newCenterImage, setNewCenterImage] = useState("")
  const [newCenterImageSize, setNewCenterImageSize] = useState(50)
  const [newPageBackgroundColor, setNewPageBackgroundColor] = useState("#f8fafc") // Default to gray-50
  const [newWheelBorderWidth, setNewWheelBorderWidth] = useState(2)
  const [newWheelBorderColor, setNewWheelBorderColor] = useState("#A00000") // Default to swu-red
  const [newWheelShadow, setNewWheelShadow] = useState("none")
  const [newConfettiAndSound, setNewConfettiAndSound] = useState(false)

  const [selectedWheel, setSelectedWheel] = useState<Wheel | null>(null)
  const [isCreatingWheel, setIsCreatingWheel] = useState(false)
  const [isEditingWheel, setIsEditingWheel] = useState(false)

  // Add a new state variable to control the visibility of the Tool Settings card
  const [showToolSettings, setShowToolSettings] = useState(true)

  const categories = ["Research", "Academic", "Entertainment", "Personal"]

  useEffect(() => {
    const fetchInitialData = async () => {
      if (!user) return
      // Fetch wheels (existing logic)
      const q = query(
        collection(db, "wheels"),
        where("ownerId", "==", user.uid),
        // Add OR condition for collaborators if needed
      )
      const querySnapshot = await getDocs(q)
      const fetchedWheels: Wheel[] = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate(),
      })) as Wheel[]
      setWheels(fetchedWheels)



      // Fetch available wheel types
      const wheelTypesSnapshot = await getDocs(query(collection(db, "wheelTypes"), orderBy("order", "asc")))
      const globalWheelTypes: WheelTypeConfig[] = wheelTypesSnapshot.docs
        .map((doc) => ({
          id: doc.id,
          value: doc.data().value,
          label: doc.data().label,
          description: doc.data().description,
          enabled: doc.data().enabled,
          order: doc.data().order,
          createdAt: doc.data().createdAt?.toDate(),
          updatedAt: doc.data().updatedAt?.toDate(),
        }))
        .filter((type) => type.enabled) // Only show enabled types

      // Fetch user-specific wheel types
      const userWheelTypesQuery = query(
        collection(db, "userWheelTypes"),
        where("userId", "==", user.uid)
      )
      const userWheelTypesSnapshot = await getDocs(userWheelTypesQuery)
      const userSpecificWheelTypes: WheelTypeConfig[] = userWheelTypesSnapshot.docs.map((doc) => ({
        id: doc.data().wheelTypeId || doc.id,
        value: doc.data().wheelTypeValue,
        label: doc.data().wheelTypeLabel,
        description: doc.data().wheelTypeDescription,
        enabled: true, // User-specific types are always enabled
        order: doc.data().addedAt?.toMillis() || Date.now(), // Use addedAt as order
        createdAt: doc.data().addedAt?.toDate() || new Date(),
        updatedAt: doc.data().addedAt?.toDate() || new Date(),
        isUserSpecific: true,
        category: doc.data().category,
        icon: doc.data().wheelTypeIcon
      }))

      // Also fetch from email-based user wheel types (for specific user targeting)
      const userEmailWheelTypesQuery = query(
        collection(db, "userWheelTypes"),
        where("userId", "==", user.email)
      )
      const userEmailWheelTypesSnapshot = await getDocs(userEmailWheelTypesQuery)
      const emailBasedWheelTypes: WheelTypeConfig[] = userEmailWheelTypesSnapshot.docs.map((doc) => ({
        id: doc.data().wheelTypeId || doc.id,
        value: doc.data().wheelTypeValue,
        label: doc.data().wheelTypeLabel,
        description: doc.data().wheelTypeDescription,
        enabled: true,
        order: doc.data().addedAt?.toMillis() || Date.now(),
        createdAt: doc.data().addedAt?.toDate() || new Date(),
        updatedAt: doc.data().addedAt?.toDate() || new Date(),
        isUserSpecific: true,
        category: doc.data().category,
        icon: doc.data().wheelTypeIcon
      }))

      // Combine and deduplicate wheel types
      const allWheelTypes = [...globalWheelTypes, ...userSpecificWheelTypes, ...emailBasedWheelTypes]
      const uniqueWheelTypes = allWheelTypes.filter((type, index, self) => 
        index === self.findIndex(t => t.value === type.value)
      )
      
      // Sort by order
      uniqueWheelTypes.sort((a, b) => (a.order || 0) - (b.order || 0))
      
      setAvailableWheelTypes(uniqueWheelTypes)

      // Set default new wheel type to the first available if not already set
      if (
        newWheelType === "participant" &&
        uniqueWheelTypes.length > 0 &&
        !uniqueWheelTypes.some((t) => t.value === "participant")
      ) {
        setNewWheelType(uniqueWheelTypes[0].value)
      }
    }
    fetchInitialData()
  }, [user])

  const handleCreateWheel = async () => {
    if (
      !newWheelName ||
      (!newWheelTopic && newWheelType !== "category") ||
      (newWheelType === "category" && !newWheelTopic)
    ) {
      toast({
        title: "Missing Information",
        description: "Please fill in wheel name and topic/category items.",
        variant: "destructive",
      })
      return
    }

    const wheelData: Omit<Wheel, "id"> = {
      name: newWheelName,
      topic: newWheelTopic, // This will now store custom items or preset name
      category: newWheelCategory,
      congratulatoryMessage: newWheelMessage,
      theme: newWheelTheme,
      ownerId: user.uid,
      type: newWheelType,
      createdAt: new Date(),
      updatedAt: new Date(),
      spinSpeedLevel: newSpinSpeedLevel,
      spinDuration: newSpinDuration,
      manualStop: newManualStop,
      mysterySpin: newMysterySpin,
      spinCount: 0,
      randomInitialAngle: newRandomInitialAngle,
      initialSpinning: newInitialSpinning,
      wheelBgImage: newWheelBgImage,
      centerImage: newCenterImage,
      centerImageSize: newCenterImageSize,
      pageBackgroundColor: newPageBackgroundColor,
      wheelBorderWidth: newWheelBorderWidth,
      wheelBorderColor: newWheelBorderColor,
      wheelShadow: newWheelShadow,
      confettiAndSound: newConfettiAndSound,
    }

    // Add type-specific data
    if (newWheelType === "number") {
      wheelData.numberMin = newNumberMin
      wheelData.numberMax = newNumberMax
    } else if (newWheelType === "date") {
      wheelData.dateStart = newDateStart
      wheelData.dateEnd = newDateEnd
    } else if (newWheelType === "image") {
      wheelData.imageUrls = newImageUrls
        .split(",")
        .map((url) => url.trim())
        .filter(Boolean)
    }

    try {
      const docRef = await addDoc(collection(db, "wheels"), wheelData)
      setWheels((prev) => [
        ...prev,
        {
          id: docRef.id,
          ...wheelData,
        } as Wheel,
      ])
      // Reset form fields
      setNewWheelName("")
      setNewWheelTopic("")
      setNewWheelCategory("Personal")
      setNewWheelMessage("Congratulations, {winner}!")
      setNewWheelTheme("default")
      setNewWheelType(availableWheelTypes[0]?.value || "participant") // Reset to first available type
      setNewNumberMin(1)
      setNewNumberMax(100)
      setNewDateStart("")
      setNewDateEnd("")
      setNewImageUrls("")
      setNewSpinSpeedLevel(5)
      setNewSpinDuration(10)
      setNewManualStop(false)
      setNewMysterySpin(false)
      setNewRandomInitialAngle(false)
      setNewInitialSpinning(false)
      setNewWheelBgImage("")
      setNewCenterImage("")
      setNewCenterImageSize(50)
      setNewPageBackgroundColor("#f8fafc")
      setNewWheelBorderWidth(2)
      setNewWheelBorderColor("#A00000")
      setNewWheelShadow("none")
      setNewConfettiAndSound(false)


      setIsCreatingWheel(false)
      toast({
        title: "Wheel Created",
        description: "Your new Coby Picks wheel has been created.",
      })
    } catch (error: any) {
      toast({
        title: "Error Creating Wheel",
        description: error.message,
        variant: "destructive",
      })
    }
  }

  const handleUpdateWheel = async (updatedWheel: Wheel) => {
    if (!updatedWheel) return
    try {
      const wheelRef = doc(db, "wheels", updatedWheel.id)
      const dataToUpdate: Partial<Wheel> = {
        ...updatedWheel,
        updatedAt: new Date(),
      }

      // Ensure type-specific data is correctly handled for update
      // Use undefined to remove fields that are no longer relevant for the current wheel type
      if (updatedWheel.type !== "number") {
        dataToUpdate.numberMin = undefined
        dataToUpdate.numberMax = undefined
      }
      if (updatedWheel.type !== "date") {
        dataToUpdate.dateStart = undefined
        dataToUpdate.dateEnd = undefined
      }
      if (updatedWheel.type !== "image") {
        dataToUpdate.imageUrls = undefined
      }

      // For category type, topic is used for items, so keep it.

      await updateDoc(wheelRef, dataToUpdate)
      setWheels((prev) => prev.map((w) => (w.id === updatedWheel.id ? updatedWheel : w)))
      setSelectedWheel(updatedWheel) // Update selected wheel state
      setIsEditingWheel(false)
      toast({
        title: "Wheel Updated",
        description: "Your wheel settings have been updated.",
      })
    } catch (error: any) {
      toast({
        title: "Error Updating Wheel",
        description: error.message,
        variant: "destructive",
      })
    }
  }

  const handleDeleteWheel = async (wheelId: string) => {
    if (!confirm("Are you sure you want to delete this wheel? This action cannot be undone.")) {
      return
    }
    try {
      await deleteDoc(doc(db, "wheels", wheelId))
      setWheels((prev) => prev.filter((w) => w.id !== wheelId))
      if (selectedWheel?.id === wheelId) {
        setSelectedWheel(null)
      }
      toast({
        title: "Wheel Deleted",
        description: "The wheel has been successfully deleted.",
      })
    } catch (error: any) {
      toast({
        title: "Error Deleting Wheel",
        description: error.message,
        variant: "destructive",
      })
    }
  }

  const handleLogout = async () => {
    try {
      await signOut(auth)
      toast({
        title: "Logged Out",
        description: "You have been successfully logged out.",
      })
    } catch (error: any) {
      toast({
        title: "Logout Error",
        description: error.message,
        variant: "destructive",
      })
    }
  }

  const renderWheelTypeSpecificInputs = (
    currentType: WheelType,
    isEditMode: boolean,
    currentWheel: Wheel | null,
    setWheelState: (key: keyof Wheel, value: any) => void,
  ) => {
    const valueGetter = (key: keyof Wheel) => (isEditMode && currentWheel ? currentWheel[key] : undefined)
    const setter = (key: keyof Wheel, value: any) => {
      if (isEditMode && currentWheel) {
        setWheelState(key, value)
      } else {
        // For new wheel creation
        if (key === "numberMin") setNewNumberMin(value)
        else if (key === "numberMax") setNewNumberMax(value)
        else if (key === "dateStart") setNewDateStart(value)
        else if (key === "dateEnd") setNewDateEnd(value)
        else if (key === "imageUrls") setNewImageUrls(value)

        else if (key === "topic") setNewWheelTopic(value) // Handle custom topic for category
      }
    }

    switch (currentType) {
      case "number":
        return (
          <>
            <div className="grid gap-2">
              <Label htmlFor="number-min">Min Number</Label>
              <Input
                id="number-min"
                type="number"
                value={isEditMode ? (valueGetter("numberMin") as number) || 1 : newNumberMin}
                onChange={(e) => setter("numberMin", Number.parseInt(e.target.value) || 1)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="number-max">Max Number</Label>
              <Input
                id="number-max"
                type="number"
                value={isEditMode ? (valueGetter("numberMax") as number) || 100 : newNumberMax}
                onChange={(e) => setter("numberMax", Number.parseInt(e.target.value) || 100)}
              />
            </div>
          </>
        )
      case "date":
        return (
          <>
            <div className="grid gap-2">
              <Label htmlFor="date-start">Start Date</Label>
              <Input
                id="date-start"
                type="date"
                value={isEditMode ? (valueGetter("dateStart") as string) || "" : newDateStart}
                onChange={(e) => setter("dateStart", e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="date-end">End Date</Label>
              <Input
                id="date-end"
                type="date"
                value={isEditMode ? (valueGetter("dateEnd") as string) || "" : newDateEnd}
                onChange={(e) => setter("dateEnd", e.target.value)}
              />
            </div>
          </>
        )
      case "image":
        return (
          <div className="grid gap-2">
            <Label htmlFor="image-urls">Image URLs (comma-separated)</Label>
            <Textarea
              id="image-urls"
              value={isEditMode ? ((valueGetter("imageUrls") as string[]) || []).join(", ") : newImageUrls}
              onChange={(e) =>
                setter(
                  "imageUrls",
                  e.target.value
                    .split(",")
                    .map((url) => url.trim())
                    .filter(Boolean),
                )
              }
              placeholder="e.g., https://example.com/img1.png, https://example.com/img2.jpg"
              rows={4}
            />
            <p className="text-sm text-muted-foreground">
              Enter full URLs to images, separated by commas. (Note: Direct file upload requires Firebase Storage
              setup).
            </p>
          </div>
        )
      case "category":
        return (
          <div className="grid gap-2">
            <Label htmlFor="category-items">Categories (comma-separated)</Label>
            <Textarea
              id="category-items"
              value={isEditMode ? (valueGetter("topic") as string) : newWheelTopic}
              onChange={(e) => setter("topic", e.target.value)}
              placeholder="e.g., Food, Activity, Movie"
              rows={3}
            />
            <p className="text-sm text-muted-foreground">
              Enter the categories you want to spin, separated by commas.
            </p>
          </div>
        )
      default:
        // For other types, if they are meant to use predefined categories,
        // you would add similar logic here, filtering based on `applicableWheelTypes`
        // and populating the `topic` or specific fields from `preset.items`.
        // For now, we assume only 'category' type uses predefined categories directly.
        return (
          <div className="grid gap-2">
            <Label htmlFor="wheel-topic">Default Topic</Label>
            <Input
              id="wheel-topic"
              value={isEditMode ? (valueGetter("topic") as string) : newWheelTopic}
              onChange={(e) => setter("topic", e.target.value)}
              placeholder="e.g., Who presents next?, Lucky Winner"
            />
          </div>
        )
    }
  }

  // Function to get category items for category wheels
  const getCategoryItemsForWheel = (wheel: Wheel): string[] | undefined => {
    if (wheel.type === "category") {
      return wheel.topic
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    }
    return undefined
  }

  return (
    <div
      className="flex flex-col min-h-screen p-4 md:p-8"
      style={{ backgroundColor: selectedWheel?.pageBackgroundColor || "#f8fafc" }}
    >
      <header className="flex justify-between items-center mb-8 pb-4 border-b border-swu-red">
        <h1 className="text-4xl font-extrabold text-swu-red">Coby Picks Dashboard</h1>
        <div className="flex items-center gap-2">
          <AnnouncementDisplay user={user} userRole={userRole} />
          <Button
            onClick={handleLogout}
            variant="outline"
            className="border-swu-red text-swu-red hover:bg-swu-red hover:text-white bg-transparent"
          >
            Logout
          </Button>
        </div>
      </header>

      <main className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1">
          <Card className="border-swu-red shadow-md">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 bg-swu-red text-white rounded-t-md">
              <CardTitle className="text-xl font-semibold">Your Wheels</CardTitle>
              <Dialog open={isCreatingWheel} onOpenChange={setIsCreatingWheel}>
                <DialogTrigger asChild>
                  <Button size="sm" className="gap-1 bg-white text-swu-red hover:bg-gray-100">
                    <Plus className="h-4 w-4" />
                    New Wheel
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle className="text-swu-red">Create New Wheel</DialogTitle>
                    <DialogDescription>Define the basic properties of your new Coby Picks wheel.</DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="wheel-name">Wheel Name</Label>
                      <Input
                        id="wheel-name"
                        value={newWheelName}
                        onChange={(e) => setNewWheelName(e.target.value)}
                        placeholder="e.g., Raffle Draw, Presentation Order"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="wheel-type">Wheel Type</Label>
                      <Select value={newWheelType} onValueChange={setNewWheelType}>
                        <SelectTrigger id="wheel-type">
                          <SelectValue placeholder="Select wheel type" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableWheelTypes.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              <div className="flex items-center gap-2">
                                {type.icon && <span className="text-sm">{type.icon}</span>}
                                <span>{type.label}</span>
                                {type.isUserSpecific && (
                                  <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-800">
                                    Personal
                                  </Badge>
                                )}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {renderWheelTypeSpecificInputs(newWheelType, false, null, () => {})}
                    <div className="grid gap-2">
                      <Label htmlFor="wheel-category">Category</Label>
                      <Select value={newWheelCategory} onValueChange={setNewWheelCategory}>
                        <SelectTrigger id="wheel-category">
                          <SelectValue placeholder="Select a category" />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map((cat) => (
                            <SelectItem key={cat} value={cat}>
                              {cat}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="congratulatory-message">Congratulatory Message</Label>
                      <Textarea
                        id="congratulatory-message"
                        value={newWheelMessage}
                        onChange={(e) => setNewWheelMessage(e.target.value)}
                        placeholder="e.g., Congratulations, {winner}!"
                        rows={3}
                      />
                      <p className="text-sm text-muted-foreground">
                        Use {"{winner}"} as a placeholder for the selected name.
                      </p>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="wheel-theme">Theme</Label>
                      <Select value={newWheelTheme} onValueChange={setNewWheelTheme}>
                        <SelectTrigger id="wheel-theme">
                          <SelectValue placeholder="Select a theme" />
                        </SelectTrigger>
                        <SelectContent>
                          {THEMES.map((theme) => (
                            <SelectItem key={theme.value} value={theme.value}>
                              {theme.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      type="submit"
                      onClick={handleCreateWheel}
                      className="bg-swu-red hover:bg-swu-red/90 text-white"
                    >
                      Create Wheel
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent className="p-4">
              {wheels.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">
                  No wheels created yet. Click "New Wheel" to start!
                </p>
              ) : (
                <div className="grid gap-2">
                  {wheels.map((wheel) => (
                    <div
                      key={wheel.id}
                      className={`flex items-center justify-between p-3 rounded-md cursor-pointer transition-colors border ${
                        selectedWheel?.id === wheel.id
                          ? "bg-swu-red/10 border-swu-red"
                          : "hover:bg-muted/50 border-gray-200"
                      }`}
                      onClick={() => setSelectedWheel(wheel)}
                    >
                      <div>
                        <p className="font-medium text-lg">{wheel.name}</p>
                        <div className="flex items-center gap-2">
                          <p className="text-sm text-muted-foreground">
                            Type: {availableWheelTypes.find((t) => t.value === wheel.type)?.label || wheel.type} | Topic:{" "}
                            {wheel.topic}
                          </p>
                          {availableWheelTypes.find((t) => t.value === wheel.type)?.isUserSpecific && (
                            <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-800">
                              Personal Type
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Dialog
                          open={isEditingWheel && selectedWheel?.id === wheel.id}
                          onOpenChange={setIsEditingWheel}
                        >
                          <DialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-swu-red hover:bg-swu-red/10"
                              onClick={(e) => {
                                e.stopPropagation()
                                setSelectedWheel(wheel)
                                setIsEditingWheel(true)
                              }}
                            >
                              <Edit className="h-4 w-4" />
                              <span className="sr-only">Edit Wheel</span>
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="sm:max-w-[425px]">
                            <DialogHeader>
                              <DialogTitle className="text-swu-red">Edit Wheel Settings</DialogTitle>
                              <DialogDescription>Update the properties of your Coby Picks wheel.</DialogDescription>
                            </DialogHeader>
                            {selectedWheel && (
                              <div className="grid gap-4 py-4">
                                <div className="grid gap-2">
                                  <Label htmlFor="edit-wheel-name">Wheel Name</Label>
                                  <Input
                                    id="edit-wheel-name"
                                    value={selectedWheel.name}
                                    onChange={(e) => setSelectedWheel({ ...selectedWheel, name: e.target.value })}
                                  />
                                </div>
                                <div className="grid gap-2">
                                  <Label htmlFor="edit-wheel-type">Wheel Type</Label>
                                  <Select
                                    value={selectedWheel.type}
                                    onValueChange={(value) =>
                                      setSelectedWheel({ ...selectedWheel, type: value as WheelType })
                                    }
                                  >
                                    <SelectTrigger id="edit-wheel-type">
                                      <SelectValue placeholder="Select wheel type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {availableWheelTypes.map((type) => (
                                        <SelectItem key={type.value} value={type.value}>
                                          <div className="flex items-center gap-2">
                                            {type.icon && <span className="text-sm">{type.icon}</span>}
                                            <span>{type.label}</span>
                                            {type.isUserSpecific && (
                                              <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-800">
                                                Personal
                                              </Badge>
                                            )}
                                          </div>
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                {renderWheelTypeSpecificInputs(selectedWheel.type, true, selectedWheel, (key, value) =>
                                  setSelectedWheel((prev) => (prev ? { ...prev, [key]: value } : prev)),
                                )}
                                <div className="grid gap-2">
                                  <Label htmlFor="edit-wheel-category">Category</Label>
                                  <Select
                                    value={selectedWheel.category}
                                    onValueChange={(value) => setSelectedWheel({ ...selectedWheel, category: value })}
                                  >
                                    <SelectTrigger id="edit-wheel-category">
                                      <SelectValue placeholder="Select a category" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {categories.map((cat) => (
                                        <SelectItem key={cat} value={cat}>
                                          {cat}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="grid gap-2">
                                  <Label htmlFor="edit-congratulatory-message">Congratulatory Message</Label>
                                  <Textarea
                                    id="edit-congratulatory-message"
                                    value={selectedWheel.congratulatoryMessage}
                                    onChange={(e) =>
                                      setSelectedWheel({ ...selectedWheel, congratulatoryMessage: e.target.value })
                                    }
                                    rows={3}
                                  />
                                </div>
                                <div className="grid gap-2">
                                  <Label htmlFor="edit-wheel-theme">Theme</Label>
                                  <Select
                                    value={selectedWheel.theme}
                                    onValueChange={(value) => setSelectedWheel({ ...selectedWheel, theme: value })}
                                  >
                                    <SelectTrigger id="edit-wheel-theme">
                                      <SelectValue placeholder="Select a theme" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {THEMES.map((theme) => (
                                        <SelectItem key={theme.value} value={theme.value}>
                                          {theme.label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                            )}
                            <DialogFooter>
                              <Button
                                type="submit"
                                onClick={() => selectedWheel && handleUpdateWheel(selectedWheel)}
                                className="bg-swu-red hover:bg-swu-red/90 text-white"
                              >
                                Save Changes
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-500 hover:bg-red-500/10"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeleteWheel(wheel.id)
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                          <span className="sr-only">Delete Wheel</span>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          {selectedWheel ? (
            <div className="grid gap-8">
              <Card className="border-swu-red shadow-md">
                <CardHeader className="bg-swu-red text-white rounded-t-md">
                  <CardTitle className="flex items-center gap-2 text-2xl font-semibold">
                    <RotateCcw className="h-6 w-6" />
                    {selectedWheel.name}
                  </CardTitle>
                  <CardDescription className="text-white/80">
                    Type: {availableWheelTypes.find((t) => t.value === selectedWheel.type)?.label || selectedWheel.type}{" "}
                    | Topic: {selectedWheel.topic} | Category: {selectedWheel.category}
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-6">
                  <CobyPicksWheel
                    wheelId={selectedWheel.id}
                    congratulatoryMessage={selectedWheel.congratulatoryMessage}
                    wheelType={selectedWheel.type}
                    numberMin={selectedWheel.numberMin}
                    numberMax={selectedWheel.numberMax}
                    dateStart={selectedWheel.dateStart}
                    dateEnd={selectedWheel.dateEnd}
                    imageUrls={selectedWheel.imageUrls}
                    categoryItems={getCategoryItemsForWheel(selectedWheel)}
                    // Pass new settings to the wheel component
                    spinSpeedLevel={selectedWheel.spinSpeedLevel}
                    spinDuration={selectedWheel.spinDuration}
                    manualStop={selectedWheel.manualStop}
                    mysterySpin={selectedWheel.mysterySpin}
                    spinCount={selectedWheel.spinCount}
                    randomInitialAngle={selectedWheel.randomInitialAngle}
                    initialSpinning={selectedWheel.initialSpinning}
                    wheelBgImage={selectedWheel.wheelBgImage}
                    centerImage={selectedWheel.centerImage}
                    centerImageSize={selectedWheel.centerImageSize}
                    wheelBorderWidth={selectedWheel.wheelBorderWidth}
                    wheelBorderColor={selectedWheel.wheelBorderColor}
                    wheelShadow={selectedWheel.wheelShadow}
                    confettiAndSound={selectedWheel.confettiAndSound}
                    onSpinComplete={(newSpinCount) => {
                      // Update spin count in Firebase and local state
                      if (selectedWheel) {
                        handleUpdateWheel({ ...selectedWheel, spinCount: newSpinCount })
                      }
                    }}
                    wheelTheme={selectedWheel.theme} // Pass the selected theme
                  />
                </CardContent>
              </Card>

              {/* Tool Settings Card */}
              <Card className="border-swu-red shadow-md">
                <CardHeader className="bg-swu-red text-white rounded-t-md">
                  <CardTitle className="text-xl font-semibold">Tool Settings</CardTitle>
                  <CardDescription className="text-white/80">
                    Customize the wheel's behavior and appearance.
                  </CardDescription>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute top-2 right-2 text-white hover:bg-white/20"
                    onClick={() => setShowToolSettings(!showToolSettings)}
                  >
                    {showToolSettings ? "Hide" : "Show"}
                  </Button>
                </CardHeader>
                {showToolSettings && (
                  <CardContent className="p-6">
                    <ToolSettings wheel={selectedWheel} onUpdateWheel={handleUpdateWheel} />
                  </CardContent>
                )}
              </Card>

              {selectedWheel.type === "participant" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card className="border-swu-red shadow-md">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 bg-swu-red text-white rounded-t-md">
                      <CardTitle className="text-xl font-semibold">Participants</CardTitle>
                      <Upload className="h-5 w-5" />
                    </CardHeader>
                    <CardContent className="p-6">
                      <DataImporter wheelId={selectedWheel.id} />
                    </CardContent>
                  </Card>

                  <Card className="border-swu-red shadow-md">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 bg-swu-red text-white rounded-t-md">
                      <CardTitle className="text-xl font-semibold">Export Winners</CardTitle>
                      <Download className="h-5 w-5" />
                    </CardHeader>
                    <CardContent className="p-6">
                      <WinnerExport wheelId={selectedWheel.id} />
                    </CardContent>
                  </Card>
                </div>
              )}

              <Card className="border-swu-red shadow-md">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 bg-swu-red text-white rounded-t-md">
                  <CardTitle className="text-xl font-semibold">Collaboration</CardTitle>
                  <Share2 className="h-5 w-5" />
                </CardHeader>
                <CardContent className="p-6">
                  <CollaboratorInvite wheelId={selectedWheel.id} ownerId={user.uid} />
                </CardContent>
              </Card>

              <Card className="border-swu-red shadow-md">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 bg-swu-red text-white rounded-t-md">
                  <CardTitle className="text-xl font-semibold">Privacy & Consent</CardTitle>
                  <Settings className="h-5 w-5" />
                </CardHeader>
                <CardContent className="p-6">
                  <PrivacyConsent />
                </CardContent>
              </Card>

              {/* Placeholder for Restaurant Feature */}
              <Card className="border-swu-red shadow-md">
                <CardHeader className="bg-swu-red text-white rounded-t-md">
                  <CardTitle className="text-xl font-semibold">Restaurant Integration (Future Feature)</CardTitle>
                  <CardDescription className="text-white/80">
                    Search for restaurants and automatically add their names to the wheel.
                  </CardDescription>
                </CardHeader>
                <CardContent className="text-center p-8">
                  <p className="text-lg text-muted-foreground">
                    This feature would integrate with a location-based API (e.g., Google Places API) to search for
                    restaurants. The extracted names could then be automatically added as participants to the wheel.
                    This requires additional API keys and backend integration.
                  </p>
                  <Button
                    variant="outline"
                    className="mt-4 border-swu-red text-swu-red hover:bg-swu-red hover:text-white bg-transparent"
                  >
                    Explore Restaurants
                  </Button>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card className="h-full flex items-center justify-center border-swu-red shadow-md">
              <CardContent className="text-center p-8">
                <p className="text-lg text-muted-foreground">
                  Select a wheel from the left or create a new one to get started!
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  )
}
