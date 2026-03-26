"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { toast } from "@/hooks/use-toast"
import { auth, db } from "@/lib/firebase"
import { doc, getDoc, updateDoc, serverTimestamp, addDoc, collection } from "firebase/firestore"
import { onAuthStateChanged, type User as FirebaseUser } from "firebase/auth"
import { EnhancedWheel } from "@/components/randomizer/enhanced-wheel"
import { CobyPicksWheel } from "@/components/wheel/coby-picks-wheel"
import { ParticipantManager } from "@/components/data/participant-manager"
import LiveDrawManager from "@/components/live/live-draw-manager"
import { Settings, Users, Radio, History, ArrowLeft } from "lucide-react"
import Link from "next/link"
import { PICKER_WHEEL_TYPES, type PickerWheelType } from "@/lib/picker-wheel-types"

interface DrawActivity {
  id: string
  title: string
  description: string
  category: "academic" | "research" | "entertainment" | "personal"
  wheelType?: string // Added for picker wheel activities
  wheelTitle?: string // Added for picker wheel activities
  participants: Array<{
    id: string
    name: string
    email?: string
    contactNumber?: string
    isSelected: boolean
  }>
  settings: {
    numberOfWinners: number
    congratsMessage: string
    theme: string
    isShared: boolean
    spinDuration: number
    showConfetti: boolean
    playSound: boolean
    hasConfetti?: boolean // Added for picker wheel activities
    hasSound?: boolean // Added for picker wheel activities
  }
  createdBy: string
  createdAt: Date
  lastUsed?: Date
  timesUsed: number
  isLive?: boolean // Added for live session support
  status?: string // Added for activity status
}

interface SpinResult {
  id: string
  winners: Array<{
    id: string
    name: string
    email?: string
  }>
  timestamp: Date
  spinDuration: number
  totalParticipants: number
}

export default function ActivityPage() {
  const params = useParams()
  const activityId = params.id as string
  
  const [user, setUser] = useState<FirebaseUser | null>(null)
  const [activity, setActivity] = useState<DrawActivity | null>(null)
  const [loading, setLoading] = useState(true)
  const [participants, setParticipants] = useState<Array<{
    id: string
    name: string
    email?: string
    contactNumber?: string
    isSelected: boolean
  }>>([])
  const [spinHistory, setSpinHistory] = useState<SpinResult[]>([])
  const [activeTab, setActiveTab] = useState("wheel")
  const [isPickerWheelActivity, setIsPickerWheelActivity] = useState(false)

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
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser)
      if (currentUser && activityId) {
        fetchActivity(currentUser)
      } else if (!currentUser) {
        setLoading(false)
      }
    })

    return () => unsubscribe()
  }, [activityId])

  const fetchActivity = async (currentUser?: FirebaseUser) => {
    try {
      const userToUse = currentUser || user
      console.log("🔍 Fetching activity:", activityId, "for user:", userToUse?.uid)
      const activityDoc = await getDoc(doc(db, "drawActivities", activityId))

      if (activityDoc.exists()) {
        const data = activityDoc.data()
        console.log("✅ Activity found:", data)

        const activityData: DrawActivity = {
          id: activityDoc.id,
          ...data,
          createdAt: data.createdAt?.toDate(),
          lastUsed: data.lastUsed?.toDate()
        } as DrawActivity

        console.log("🔍 Checking access - User:", userToUse?.uid, "Creator:", activityData.createdBy, "Shared:", activityData.settings?.isShared)
        console.log("🔍 Full activity data:", activityData)
        console.log("🔍 Settings object:", activityData.settings)

        // More robust access check with detailed debugging
        const userUid = userToUse?.uid
        const createdBy = activityData.createdBy
        const isCreator = userUid && createdBy && userUid === createdBy
        const isShared = activityData.settings?.isShared === true || (activityData as any).isShared === true
        const wheelType = (activityData as any).wheelType
        const wheelTitle = (activityData as any).wheelTitle
        const isPickerWheel = wheelType && (
          wheelType.includes('picker') ||
          wheelType === 'number' ||
          wheelType === 'letter' ||
          wheelType === 'color' ||
          wheelType === 'country' ||
          wheelType === 'state' ||
          wheelType === 'date' ||
          wheelType === 'yes-no' ||
          wheelType === 'mlb' ||
          wheelType === 'nba' ||
          wheelType === 'nfl' ||
          wheelTitle?.includes('Picker')
        )

        // Set picker wheel activity state
        setIsPickerWheelActivity(isPickerWheel)

        console.log("🔍 Detailed access check:", {
          userUid: userUid,
          createdBy: createdBy,
          userUidType: typeof userUid,
          createdByType: typeof createdBy,
          isCreator: isCreator,
          isShared: isShared,
          isPickerWheelActivity: isPickerWheel,
          wheelType: wheelType,
          wheelTitle: wheelTitle,
          settingsIsShared: activityData.settings?.isShared,
          rootIsShared: (activityData as any).isShared
        })

        // Allow access if user is creator OR activity is shared OR it's a picker wheel activity
        const hasAccess = isCreator || isShared || isPickerWheel

        if (!hasAccess) {
          console.error("❌ Access denied for activity:", activityId)
          console.error("❌ Access denied - User:", userUid, "Creator:", createdBy, "Match:", isCreator, "Shared:", isShared, "PickerWheel:", isPickerWheel)
          toast({
            title: "Access Denied",
            description: "You don't have permission to view this activity. Please make sure you're logged in with the correct account.",
            variant: "destructive"
          })
          // Redirect to dashboard after showing error
          setTimeout(() => {
            window.location.href = "/"
          }, 3000)
          return
        }

        console.log("✅ Access granted for activity:", activityId)

        console.log("✅ Access granted, setting activity data")
        setActivity(activityData)
        setParticipants(activityData.participants || [])
      } else {
        console.error("❌ Activity not found:", activityId)

        // Try to wait a bit and retry once (for timing issues)
        console.log("🔄 Retrying activity fetch after delay...")
        await new Promise(resolve => setTimeout(resolve, 2000))

        const retryDoc = await getDoc(doc(db, "drawActivities", activityId))
        if (retryDoc.exists()) {
          console.log("✅ Activity found on retry!")
          const data = retryDoc.data()
          const activityData: DrawActivity = {
            id: retryDoc.id,
            ...data,
            createdAt: data.createdAt?.toDate(),
            lastUsed: data.lastUsed?.toDate()
          } as DrawActivity

          if (activityData.createdBy !== userToUse?.uid && !activityData.settings?.isShared) {
            toast({
              title: "Access Denied",
              description: "You don't have permission to view this activity",
              variant: "destructive"
            })
            return
          }

          setActivity(activityData)
          setParticipants(activityData.participants || [])
        } else {
          console.error("❌ Activity still not found after retry")
          toast({
            title: "Activity Not Found",
            description: "The requested activity could not be found. Redirecting to dashboard...",
            variant: "destructive"
          })
          // Redirect to dashboard after a short delay
          setTimeout(() => {
            window.location.href = "/"
          }, 2000)
        }
      }
    } catch (error) {
      console.error("Error fetching activity:", error)
      toast({
        title: "Error",
        description: "Failed to load activity",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const updateActivity = async (updates: Partial<DrawActivity>) => {
    if (!activity || !user) return

    try {
      // Filter out undefined values before updating
      const cleanUpdates = Object.fromEntries(
        Object.entries(updates).filter(([_, value]) => value !== undefined)
      )

      await updateDoc(doc(db, "drawActivities", activity.id), {
        ...cleanUpdates,
        updatedAt: serverTimestamp()
      })

      setActivity(prev => prev ? { ...prev, ...updates } : null)
    } catch (error) {
      console.error("Error updating activity:", error)
      toast({
        title: "Error",
        description: "Failed to save changes",
        variant: "destructive"
      })
    }
  }

  const handleParticipantsChange = (newParticipants: typeof participants) => {
    setParticipants(newParticipants)

    // Clean participants data before saving to Firebase
    const cleanParticipants = newParticipants.map(participant => {
      const cleanParticipant: any = {
        id: participant.id,
        name: participant.name,
        isSelected: participant.isSelected
      }

      // Only include optional fields if they have values
      if (participant.email?.trim()) cleanParticipant.email = participant.email.trim()
      if (participant.contactNumber?.trim()) cleanParticipant.contactNumber = participant.contactNumber.trim()
      if ((participant as any).studentId?.trim()) cleanParticipant.studentId = (participant as any).studentId.trim()
      if ((participant as any).grade?.trim()) cleanParticipant.grade = (participant as any).grade.trim()
      if ((participant as any).section?.trim()) cleanParticipant.section = (participant as any).section.trim()
      if ((participant as any).customFields && Object.keys((participant as any).customFields).length > 0) {
        cleanParticipant.customFields = (participant as any).customFields
      }

      return cleanParticipant
    })

    updateActivity({ participants: cleanParticipants })
  }

  const handleSpinComplete = async (result: SpinResult) => {
    setSpinHistory(prev => [result, ...prev.slice(0, 9)])

    // Update activity usage stats
    await updateActivity({
      lastUsed: new Date(),
      timesUsed: (activity?.timesUsed || 0) + 1
    })

    // Save to global spin history for the user
    if (user && activity) {
      try {
        await addDoc(collection(db, "spinHistory"), {
          activityId: activity.id,
          activityTitle: activity.title,
          winners: result.winners.map(w => w.name),
          participantCount: participants.length,
          timestamp: result.timestamp,
          category: activity.category || "academic",
          numberOfWinners: result.winners.length,
          spinDuration: result.spinDuration,
          createdBy: user.uid,
          createdAt: new Date()
        })
      } catch (error) {
        console.error("Error saving to spin history:", error)
      }
    }

    toast({
      title: "Spin Complete!",
      description: `${result.winners.length} winner(s) selected`,
    })
  }

  const handleSettingsChange = (newSettings: any) => {
    if (activity) {
      updateActivity({
        settings: { ...activity.settings, ...newSettings }
      })
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-lg" style={{ color: schoolColors.primary }}>Loading activity...</p>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="max-w-md">
          <CardContent className="text-center p-6">
            <p className="text-muted-foreground">Please log in to view this activity</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!activity) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="max-w-md">
          <CardContent className="text-center p-6">
            <p className="text-muted-foreground">Activity not found</p>
            <Link href="/dashboard">
              <Button className="mt-4 bg-[#8e0b16] hover:bg-[#66181E]">
                Back to Dashboard
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Helper function to map picker wheel types to CobyPicksWheel types
   const mapPickerWheelType = (pickerWheelId: string): string => {
     const mapping: Record<string, string> = {
       "team-picker": "category",
       "yes-no-picker": "yes-no",
       "number-picker": "number",
       "letter-picker": "letter",
       "country-picker": "country",
       "color-picker": "color",
       "image-picker": "image",
       "date-picker": "date",
       "instagram-comment-picker": "category",
       "mlb-picker": "mlb",
       "nba-picker": "nba",
       "nfl-picker": "nfl"
     }
     return mapping[pickerWheelId] || "category"
   }

   // Helper function to create PickerWheelType from activity data
   const createSelectedWheelType = (activity: DrawActivity): PickerWheelType | null => {
     if (!activity.wheelType) return null

     console.log("🔧 Creating selected wheel type for:", activity.wheelType)

     // Try to find the wheel type in PICKER_WHEEL_TYPES
     const existingWheelType = PICKER_WHEEL_TYPES.find(wheel => wheel.id === activity.wheelType)
     if (existingWheelType) {
       console.log("✅ Found existing wheel type:", existingWheelType)
       return existingWheelType
     }

     // If not found, create a custom wheel type based on activity data
     const customWheelType = {
       id: activity.wheelType,
       title: activity.wheelTitle || "Custom Wheel",
       description: activity.description || "Custom picker wheel",
       icon: "🎯", // Default icon for custom wheels
       category: activity.category,
       defaultItems: selectedParticipants.map(p => p.name),
       color: "#8e0b16", // Default school color
       isCustomizable: true
     }
     console.log("🆕 Created custom wheel type:", customWheelType)
     return customWheelType
   }

  const selectedParticipants = participants.filter(p => p.isSelected)

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto p-4 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-2xl">{categoryIcons[activity.category]}</span>
                <h1 className="text-3xl font-bold" style={{ color: schoolColors.primary }}>
                  {activity.title}
                </h1>
                <Badge variant="outline" className="capitalize">
                  {activity.category}
                </Badge>
              </div>
              {activity.description && (
                <p className="text-muted-foreground mt-1">{activity.description}</p>
              )}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold" style={{ color: schoolColors.primary }}>
                {participants.length}
              </p>
              <p className="text-sm text-muted-foreground">Total Participants</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold" style={{ color: schoolColors.primary }}>
                {selectedParticipants.length}
              </p>
              <p className="text-sm text-muted-foreground">Selected for Draw</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold" style={{ color: schoolColors.primary }}>
                {activity.settings.numberOfWinners}
              </p>
              <p className="text-sm text-muted-foreground">Winners to Select</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold" style={{ color: schoolColors.primary }}>
                {activity.timesUsed}
              </p>
              <p className="text-sm text-muted-foreground">Times Used</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="wheel" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Randomizer
            </TabsTrigger>
            <TabsTrigger value="participants" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Participants
            </TabsTrigger>
            <TabsTrigger value="live" className="flex items-center gap-2">
              <Radio className="h-4 w-4" />
              Live Draw
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2">
              <History className="h-4 w-4" />
              History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="wheel" className="space-y-6">
            {isPickerWheelActivity ? (
              // Render CobyPicksWheel for picker wheel activities
              <CobyPicksWheel
                wheelId={activity.id}
                congratulatoryMessage={activity.settings?.congratsMessage || "🎉 Congratulations, {winner}! Well done!"}
                wheelType={mapPickerWheelType((activity as any).wheelType || "team-picker")}
                numberMin={1}
                numberMax={100}
                dateStart=""
                dateEnd=""
                imageUrls={[]}
                categoryItems={activity.participants?.map(p => p.name) || []}
                spinSpeedLevel={5}
                spinDuration={activity.settings?.spinDuration ? activity.settings.spinDuration / 1000 : 3}
                manualStop={false}
                mysterySpin={false}
                spinCount={activity.timesUsed || 0}
                randomInitialAngle={false}
                initialSpinning={false}
                wheelBgImage=""
                centerImage=""
                centerImageSize={50}
                wheelBorderWidth={2}
                wheelBorderColor="#A00000"
                wheelShadow="none"
                confettiAndSound={(activity.settings as any)?.hasConfetti || false}
                onSpinComplete={(newSpinCount) => {
                  // Update the activity's spin count
                  if (activity) {
                    setActivity({ ...activity, timesUsed: newSpinCount })
                  }
                }}
                wheelTheme={activity.settings?.theme || "school"}
              />
            ) : selectedParticipants.length === 0 ? (
              <Card>
                <CardContent className="text-center py-8">
                  <p className="text-muted-foreground mb-4">
                    No participants selected for the draw
                  </p>
                  <Button
                    onClick={() => setActiveTab("participants")}
                    className="bg-[#8e0b16] hover:bg-[#66181E]"
                  >
                    <Users className="h-4 w-4 mr-2" />
                    Manage Participants
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <EnhancedWheel
                participants={selectedParticipants}
                onSpinComplete={handleSpinComplete}
                onSettingsChange={handleSettingsChange}
                isLiveMode={false}
                wheelTheme={typeof activity.settings?.theme === 'object' ? activity.settings.theme : undefined}
              />
            )}
          </TabsContent>

          <TabsContent value="participants">
            <ParticipantManager
              participants={participants}
              onParticipantsChange={handleParticipantsChange}
              onSelectionChange={(selected) => {
                // Update selection in participants array
                const updated = participants.map(p => ({
                  ...p,
                  isSelected: selected.some(s => s.id === p.id)
                }))
                setParticipants(updated)
              }}
            />
          </TabsContent>

          <TabsContent value="live">
            <LiveDrawManager
              user={user}
              activityId={activity.id}
              participants={selectedParticipants}
              onBack={() => setActiveTab("randomizer")}
              selectedWheelType={createSelectedWheelType(activity)}
            />
          </TabsContent>

          <TabsContent value="history">
            <Card>
              <CardHeader>
                <CardTitle>Spin History</CardTitle>
                <CardDescription>
                  Recent randomizer results for this activity
                </CardDescription>
              </CardHeader>
              <CardContent>
                {spinHistory.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    No spins recorded yet
                  </p>
                ) : (
                  <div className="space-y-4">
                    {spinHistory.map((result) => (
                      <div key={result.id} className="border rounded-lg p-4">
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-semibold">
                            Spin #{result.id}
                          </h4>
                          <span className="text-sm text-muted-foreground">
                            {result.timestamp.toLocaleString()}
                          </span>
                        </div>
                        <div className="space-y-2">
                          <p className="text-sm text-muted-foreground">
                            {result.totalParticipants} participants • {result.winners.length} winner(s)
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {result.winners.map((winner, index) => (
                              <Badge key={winner.id} className="bg-[#8e0b16]">
                                #{index + 1} {winner.name}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
