"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { toast } from "@/hooks/use-toast"
import { auth, db } from "@/lib/firebase"
import { addDoc, collection, serverTimestamp } from "firebase/firestore"
import { onAuthStateChanged, type User as FirebaseUser } from "firebase/auth"
import { ArrowLeft, Save, Play, BookOpen, Search, Gamepad2, User, Calendar, Users, Trophy, Settings, Target } from "lucide-react"
import Link from "next/link"

export default function CreateActivityPage() {
  const router = useRouter()
  const [user, setUser] = useState<FirebaseUser | null>(null)
  const [loading, setLoading] = useState(false)
  
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category: "academic" as string,
    wheelType: "picker-wheel" as string,
    congratsMessage: "🎉 Congratulations, {name}! Well done!",
    theme: "school",
    isScheduled: false,
    scheduledDate: "",
    scheduledTime: "",
    allowReactions: true,
    hasConfetti: true,
    hasSound: true,
    spinDuration: 3000
  })

  const schoolColors = {
    primary: "#8e0b16",
    secondary: "#66181E",
    accent: "#ffffff"
  }

  const wheelTypesByCategory = {
    academic: [
      {
        id: "picker-wheel",
        title: "Picker Wheel",
        description: "Randomly select answers, quiz topics, or students.",
        icon: "🎯"
      },
      {
        id: "number",
        title: "Number Picker Wheel",
        description: "Pick numbers for math problems, student IDs, or groups.",
        icon: "🔢"
      },
      {
        id: "letter",
        title: "Letter Picker Wheel",
        description: "Use for spelling, phonics, or alphabetical selections.",
        icon: "🔤"
      },
      {
        id: "date",
        title: "Date Picker Wheel",
        description: "Pick random dates for assignments, presentations, or events.",
        icon: "📅"
      }
    ],
    research: [
      {
        id: "picker-wheel",
        title: "Picker Wheel",
        description: "Make unbiased random selections for sampling or testing.",
        icon: "🎯"
      },
      {
        id: "number",
        title: "Number Picker Wheel",
        description: "Randomize data points or survey participants.",
        icon: "🔢"
      },
      {
        id: "country",
        title: "Country Picker Wheel",
        description: "Pick countries for geography-based studies or international research.",
        icon: "🌍"
      },
      {
        id: "color",
        title: "Color Picker Wheel",
        description: "Use in psychological or preference-based studies.",
        icon: "🎨"
      },
      {
        id: "date",
        title: "Date Picker Wheel",
        description: "Select randomized dates for time-based sampling.",
        icon: "📅"
      }
    ],
    entertainment: [
      {
        id: "picker-wheel",
        title: "Picker Wheel",
        description: "Spin for dares, prizes, or game outcomes.",
        icon: "🎯"
      },
      {
        id: "team-picker",
        title: "Team Picker Wheel",
        description: "Randomly split people into teams for games or group activities.",
        icon: "👥"
      },
      {
        id: "yes-no",
        title: "Yes No Picker Wheel",
        description: "Use for truth-or-dare, quick decisions, or interactive games.",
        icon: "❓"
      },
      {
        id: "image",
        title: "Image Picker Wheel",
        description: "Use in guessing games or art-based challenges.",
        icon: "🖼️"
      },
      {
        id: "instagram-comment",
        title: "Instagram Comment Picker Wheel",
        description: "For giveaways and social challenges.",
        icon: "📱"
      },
      {
        id: "mlb",
        title: "MLB Picker Wheel",
        description: "Spin to pick a team for fantasy games or debates.",
        icon: "⚾"
      },
      {
        id: "nba",
        title: "NBA Picker Wheel",
        description: "Choose NBA teams for events or matchups.",
        icon: "🏀"
      },
      {
        id: "nfl",
        title: "NFL Picker Wheel",
        description: "Use for fun football-themed games or random picks.",
        icon: "🏈"
      }
    ],
    personal: [
      {
        id: "picker-wheel",
        title: "Picker Wheel",
        description: "Make everyday decisions like what to eat or watch.",
        icon: "🎯"
      },
      {
        id: "yes-no",
        title: "Yes No Picker Wheel",
        description: "Help with quick decisions (e.g., \"Should I do it?\").",
        icon: "❓"
      },
      {
        id: "number",
        title: "Number Picker Wheel",
        description: "Use in budgeting, games, or habit tracking.",
        icon: "🔢"
      },
      {
        id: "color",
        title: "Color Picker Wheel",
        description: "Pick colors for DIY, art, or outfits.",
        icon: "🎨"
      },
      {
        id: "date",
        title: "Date Picker Wheel",
        description: "Randomize special dates or plan activities.",
        icon: "📅"
      },
      {
        id: "image",
        title: "Image Picker Wheel",
        description: "Choose randomly from your favorite memories or ideas.",
        icon: "🖼️"
      }
    ]
  }

  // Get wheel types for the selected category
  const getWheelTypesForCategory = (category: string) => {
    return wheelTypesByCategory[category as keyof typeof wheelTypesByCategory] || wheelTypesByCategory.academic
  }

  const categoryOptions = [
    { value: "academic", label: "📚 Academic", icon: BookOpen, description: "Classroom activities, quizzes, assignments" },
    { value: "research", label: "🔬 Research", icon: Search, description: "Research projects, data collection" },
    { value: "entertainment", label: "🎮 Entertainment", icon: Gamepad2, description: "Fun activities, games, events" },
    { value: "personal", label: "👤 Personal", icon: User, description: "Personal use, small groups" }
  ]

  const themeOptions = [
    { value: "school", label: "🏫 School Colors", description: "Red and white theme" },
    { value: "vibrant", label: "🌈 Vibrant", description: "Colorful and energetic" },
    { value: "minimal", label: "⚪ Minimal", description: "Clean and simple" },
    { value: "ocean", label: "🌊 Ocean Blue", description: "Calming blue tones" },
    { value: "forest", label: "🌲 Forest Green", description: "Natural green theme" },
    { value: "sunset", label: "🌅 Sunset Orange", description: "Warm orange and yellow" },
    { value: "purple", label: "💜 Royal Purple", description: "Elegant purple theme" },
    { value: "pink", label: "🌸 Cherry Blossom", description: "Soft pink theme" },
    { value: "dark", label: "🌙 Dark Mode", description: "Dark background theme" },
    { value: "neon", label: "⚡ Neon Glow", description: "Bright neon colors" },
    { value: "retro", label: "📼 Retro", description: "Vintage 80s style" },
    { value: "gold", label: "✨ Golden", description: "Luxurious gold theme" }
  ]

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser)
      if (!currentUser) {
        router.push("/")
      }
    })
    return () => unsubscribe()
  }, [router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please log in to create an activity",
        variant: "destructive"
      })
      return
    }

    if (!formData.title.trim()) {
      toast({
        title: "Title Required",
        description: "Please enter a title for your activity",
        variant: "destructive"
      })
      return
    }

    setLoading(true)
    try {
      // Get the wheel title from the selected wheel type
      const selectedWheelType = getWheelTypesForCategory(formData.category || "academic")
        .find(wt => wt.id === formData.wheelType)
      const wheelTitle = selectedWheelType?.title || formData.wheelType

      const activityData = {
        title: formData.title,
        description: formData.description,
        wheelType: formData.wheelType,
        wheelTitle: wheelTitle, // Add the wheel title
        participants: [],
        settings: {
          congratsMessage: formData.congratsMessage,
          theme: formData.theme,
          allowReactions: formData.allowReactions,
          hasConfetti: formData.hasConfetti,
          hasSound: formData.hasSound,
          spinDuration: formData.spinDuration
        },
        isScheduled: formData.isScheduled,
        scheduledDate: formData.isScheduled && formData.scheduledDate && formData.scheduledTime
          ? new Date(`${formData.scheduledDate}T${formData.scheduledTime}`)
          : null,
        createdBy: user.uid,
        organizerName: user.displayName || user.email?.split('@')[0] || "Teacher",
        createdAt: serverTimestamp(),
        timesUsed: 0,
        participantCount: 0
      }

      const docRef = await addDoc(collection(db, "drawActivities"), activityData)
      
      toast({
        title: "Activity Created!",
        description: `"${formData.title}" has been created successfully`,
      })

      // Redirect back to dashboard
      router.push("/")
    } catch (error) {
      console.error("Error creating activity:", error)
      toast({
        title: "Error",
        description: "Failed to create activity. Please try again.",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Loading...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto p-6 max-w-4xl">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link href="/">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold" style={{ color: schoolColors.primary }}>
              ➕ Create New Draw Activity
            </h1>
            <p className="text-muted-foreground">
              Set up a new randomizer activity for your class or event
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2" style={{ color: schoolColors.primary }}>
                <Settings className="h-5 w-5" />
                Basic Information
              </CardTitle>
              <CardDescription>
                Set the title, description, and category for your activity
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4">
                <div>
                  <Label htmlFor="title">Activity Title *</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="e.g., Quiz Reviewer - Week 3, Group Selector"
                    required
                  />
                </div>
                
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Brief description of this activity (optional)"
                    rows={3}
                  />
                </div>
                
                <div>
                  <Label htmlFor="category">Category</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                    {categoryOptions.map((option) => {
                      const IconComponent = option.icon
                      return (
                        <div
                          key={option.value}
                          className={`p-4 border rounded-lg cursor-pointer transition-all ${
                            formData.category === option.value 
                              ? "border-[#8e0b16] bg-red-50" 
                              : "border-gray-200 hover:border-gray-300"
                          }`}
                          onClick={() => setFormData(prev => {
                            const availableWheelTypes = getWheelTypesForCategory(option.value)
                            return {
                              ...prev,
                              category: option.value as any,
                              wheelType: availableWheelTypes[0]?.id || "picker-wheel"
                            }
                          })}
                        >
                          <div className="flex items-center gap-3">
                            <IconComponent className="h-5 w-5" style={{ color: schoolColors.primary }} />
                            <div>
                              <h4 className="font-medium">{option.label}</h4>
                              <p className="text-sm text-muted-foreground">{option.description}</p>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Wheel Type Selection */}
          {formData.category ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2" style={{ color: schoolColors.primary }}>
                  <Target className="h-5 w-5" />
                  Wheel Type
                </CardTitle>
                <CardDescription>
                  Choose the type of picker wheel for your {formData.category} activity
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Category Description */}
                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">
                      {formData.category === "academic" && "📚"}
                      {formData.category === "research" && "🔬"}
                      {formData.category === "entertainment" && "🎮"}
                      {formData.category === "personal" && "👤"}
                    </span>
                    <h3 className="font-semibold capitalize">{formData.category}</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {formData.category === "academic" && "For classroom activities, quizzes, and assignments."}
                    {formData.category === "research" && "For research projects, data collection, and analysis."}
                    {formData.category === "entertainment" && "Fun activities, games, and events."}
                    {formData.category === "personal" && "For personal use or small group decisions."}
                  </p>
                </div>

                {/* Wheel Type Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {getWheelTypesForCategory(formData.category).map((wheelType) => (
                    <div
                      key={wheelType.id}
                      className={`p-4 border rounded-lg cursor-pointer transition-all ${
                        formData.wheelType === wheelType.id
                          ? "border-[#8e0b16] bg-red-50"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                      onClick={() => setFormData(prev => ({ ...prev, wheelType: wheelType.id }))}
                    >
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{wheelType.icon}</span>
                          <h4 className="font-medium text-sm">{wheelType.title}</h4>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {wheelType.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-dashed border-gray-300">
              <CardContent className="text-center py-8">
                <Target className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-600 mb-2">Select a Category First</h3>
                <p className="text-sm text-gray-500">
                  Choose a category above to see available wheel types for your activity.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Draw Settings */}
          <Card className="border-2 shadow-lg" style={{borderColor: '#8e0b16'}}>
            <CardHeader className="bg-gradient-to-r from-[#8e0b16] to-[#66181E] text-white rounded-t-lg">
              <CardTitle className="flex items-center gap-2">
                <div className="p-2 bg-white/20 rounded-lg">
                  <Trophy className="h-5 w-5" />
                </div>
                Draw Settings
              </CardTitle>
              <CardDescription className="text-white/90">
                Configure how the randomizer will work
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="theme">Theme</Label>
                <Select
                  value={formData.theme}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, theme: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {themeOptions.map(theme => (
                      <SelectItem key={theme.value} value={theme.value}>
                        <div className="flex items-center gap-2">
                          <span>{theme.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  Choose a visual theme for your wheel
                </p>
              </div>
              
              <div>
                <Label htmlFor="message">Congratulations Message</Label>
                <Input
                  id="message"
                  value={formData.congratsMessage}
                  onChange={(e) => setFormData(prev => ({ ...prev, congratsMessage: e.target.value }))}
                  placeholder="Use {name} for winner's name"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Preview: {formData.congratsMessage.replace('{name}', 'John Doe')}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Options */}
          <Card className="border-2 shadow-lg" style={{borderColor: '#8e0b16'}}>
            <CardHeader className="bg-gradient-to-r from-[#8e0b16] to-[#66181E] text-white rounded-t-lg">
              <CardTitle className="flex items-center gap-2">
                <div className="p-2 bg-white/20 rounded-lg">
                  <Users className="h-5 w-5" />
                </div>
                Activity Options
              </CardTitle>
              <CardDescription className="text-white/90">
                Configure sharing, scheduling, and interaction options
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">


                  
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="reactions">💬 Allow Reactions</Label>
                      <p className="text-sm text-muted-foreground">Students can react with emojis</p>
                    </div>
                    <Switch
                      id="reactions"
                      checked={formData.allowReactions}
                      onCheckedChange={(checked) => setFormData(prev => ({ ...prev, allowReactions: checked }))}
                    />
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="confetti">🎊 Confetti Effect</Label>
                      <p className="text-sm text-muted-foreground">Show confetti when winners are selected</p>
                    </div>
                    <Switch
                      id="confetti"
                      checked={formData.hasConfetti}
                      onCheckedChange={(checked) => setFormData(prev => ({ ...prev, hasConfetti: checked }))}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="sound">🔊 Sound Effects</Label>
                      <p className="text-sm text-muted-foreground">Play sounds during spin</p>
                    </div>
                    <Switch
                      id="sound"
                      checked={formData.hasSound}
                      onCheckedChange={(checked) => setFormData(prev => ({ ...prev, hasSound: checked }))}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Submit Buttons */}
          <div className="flex gap-4">
            <Button
              type="submit"
              disabled={loading}
              className="flex-1 text-white"
              style={{ backgroundColor: schoolColors.primary }}
            >
              {loading ? "Creating..." : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Create Activity
                </>
              )}
            </Button>
            
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/")}
              style={{ borderColor: schoolColors.secondary, color: schoolColors.secondary }}
            >
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
