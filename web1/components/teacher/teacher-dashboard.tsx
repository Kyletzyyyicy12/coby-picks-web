"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { toast } from "@/hooks/use-toast"
import { db } from "@/lib/firebase"
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, where, orderBy, getDoc } from "firebase/firestore"
import { Plus, Edit, Trash2, Play, Save, BookOpen, Search, Beaker, Gamepad2, User, Share2, Eye } from "lucide-react"
import type { User as FirebaseUser } from "firebase/auth"

interface DrawActivity {
  id: string
  title: string
  description: string
  category: "academic" | "research" | "entertainment" | "personal"
  participants: string[]
  settings: {
    numberOfWinners: number
    congratsMessage: string
    theme: string
    isShared: boolean
  }
  createdBy: string
  createdAt: Date
  lastUsed?: Date
  timesUsed: number
}

interface TeacherDashboardProps {
  user: FirebaseUser
}

export function TeacherDashboard({ user }: TeacherDashboardProps) {
  const [activities, setActivities] = useState<DrawActivity[]>([])
  const [loading, setLoading] = useState(true)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [editingActivity, setEditingActivity] = useState<DrawActivity | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  
  // New activity form state
  const [newActivity, setNewActivity] = useState({
    title: "",
    description: "",
    category: "academic" as const,
    numberOfWinners: 1,
    congratsMessage: "Congratulations, {name}! 🎉",
    theme: "school",
    isShared: false
  })

  const schoolColors = {
    primary: "#8e0b16",
    secondary: "#66181E",
    accent: "#ffffff"
  }

  const categoryIcons = {
    academic: BookOpen,
    research: Search,
    entertainment: Gamepad2,
    personal: User
  }

  const categoryColors = {
    academic: "bg-blue-500",
    research: "bg-purple-500", 
    entertainment: "bg-green-500",
    personal: "bg-orange-500"
  }

  useEffect(() => {
    fetchActivities()
  }, [user])

  const fetchActivities = async () => {
    try {
      const q = query(
        collection(db, "drawActivities"),
        where("createdBy", "==", user.uid),
        orderBy("createdAt", "desc")
      )
      const snapshot = await getDocs(q)
      const fetchedActivities = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        lastUsed: doc.data().lastUsed?.toDate()
      })) as DrawActivity[]
      
      setActivities(fetchedActivities)
    } catch (error) {
      console.error("Error fetching activities:", error)
      toast({
        title: "Error",
        description: "Failed to load activities",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const createActivity = async () => {
    if (!newActivity.title.trim()) {
      toast({
        title: "Title Required",
        description: "Please enter a title for your activity",
        variant: "destructive"
      })
      return
    }

    try {
      const activityData = {
        title: newActivity.title,
        description: newActivity.description,
        category: newActivity.category,
        participants: [],
        settings: {
          numberOfWinners: newActivity.numberOfWinners,
          congratsMessage: newActivity.congratsMessage,
          theme: newActivity.theme,
          isShared: newActivity.isShared
        },
        createdBy: user.uid,
        createdAt: new Date(),
        timesUsed: 0
      }

      await addDoc(collection(db, "drawActivities"), activityData)
      
      toast({
        title: "Activity Created",
        description: `"${newActivity.title}" has been created successfully`,
      })
      
      setIsCreateDialogOpen(false)
      setNewActivity({
        title: "",
        description: "",
        category: "academic",
        numberOfWinners: 1,
        congratsMessage: "Congratulations, {name}! 🎉",
        theme: "school",
        isShared: false
      })
      
      fetchActivities()
    } catch (error) {
      console.error("Error creating activity:", error)
      toast({
        title: "Error",
        description: "Failed to create activity",
        variant: "destructive"
      })
    }
  }

  const updateActivity = async (activity: DrawActivity) => {
    try {
      const activityRef = doc(db, "drawActivities", activity.id)
      await updateDoc(activityRef, {
        title: activity.title,
        description: activity.description,
        category: activity.category,
        settings: activity.settings,
        updatedAt: new Date()
      })
      
      toast({
        title: "Activity Updated",
        description: "Changes have been saved successfully",
      })
      
      setEditingActivity(null)
      fetchActivities()
    } catch (error) {
      console.error("Error updating activity:", error)
      toast({
        title: "Error",
        description: "Failed to update activity",
        variant: "destructive"
      })
    }
  }

  const deleteActivity = async (activityId: string, title: string) => {
    if (!confirm(`Are you sure you want to delete "${title}"? This action cannot be undone.`)) {
      return
    }

    try {
      await deleteDoc(doc(db, "drawActivities", activityId))
      
      toast({
        title: "Activity Deleted",
        description: `"${title}" has been deleted`,
      })
      
      fetchActivities()
    } catch (error) {
      console.error("Error deleting activity:", error)
      toast({
        title: "Error",
        description: "Failed to delete activity",
        variant: "destructive"
      })
    }
  }

  const filteredActivities = activities.filter(activity => {
    const matchesSearch = activity.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         activity.description.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = categoryFilter === "all" || activity.category === categoryFilter
    return matchesSearch && matchesCategory
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold" style={{ color: schoolColors.primary }}>
            Teacher Dashboard
          </h1>
          <p className="text-muted-foreground">
            Create and manage your randomizer activities
          </p>
        </div>
        
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[#8e0b16] hover:bg-[#66181E] text-white">
              <Plus className="h-4 w-4 mr-2" />
              Create New Activity
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle style={{ color: schoolColors.primary }}>Create New Activity</DialogTitle>
              <DialogDescription>
                Set up a new randomizer activity for your class or event.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="title">Activity Title</Label>
                <Input
                  id="title"
                  value={newActivity.title}
                  onChange={(e) => setNewActivity(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="e.g., Quiz Reviewer, Group Selector"
                />
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="description">Description (Optional)</Label>
                <Textarea
                  id="description"
                  value={newActivity.description}
                  onChange={(e) => setNewActivity(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Brief description of this activity"
                  rows={3}
                />
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="category">Category</Label>
                <Select 
                  value={newActivity.category} 
                  onValueChange={(value: any) => setNewActivity(prev => ({ ...prev, category: value }))}
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
              
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="winners">Number of Winners</Label>
                  <Input
                    id="winners"
                    type="number"
                    min="1"
                    max="10"
                    value={newActivity.numberOfWinners}
                    onChange={(e) => setNewActivity(prev => ({ ...prev, numberOfWinners: parseInt(e.target.value) || 1 }))}
                  />
                </div>
                
                <div className="grid gap-2">
                  <Label htmlFor="theme">Theme</Label>
                  <Select 
                    value={newActivity.theme} 
                    onValueChange={(value) => setNewActivity(prev => ({ ...prev, theme: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="school">🏫 School</SelectItem>
                      <SelectItem value="vibrant">🌈 Vibrant</SelectItem>
                      <SelectItem value="minimal">⚪ Minimal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="message">Congratulations Message</Label>
                <Input
                  id="message"
                  value={newActivity.congratsMessage}
                  onChange={(e) => setNewActivity(prev => ({ ...prev, congratsMessage: e.target.value }))}
                  placeholder="Use {name} for winner's name"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={createActivity} className="bg-[#8e0b16] hover:bg-[#66181E]">
                Create Activity
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <Input
                placeholder="Search activities..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full md:w-[200px]">
                <SelectValue placeholder="Filter by category" />
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
        </CardContent>
      </Card>

      {/* Activities Grid */}
      {loading ? (
        <div className="text-center py-8">
          <p className="text-muted-foreground">Loading activities...</p>
        </div>
      ) : filteredActivities.length === 0 ? (
        <Card>
          <CardContent className="text-center py-8">
            <p className="text-muted-foreground mb-4">
              {searchTerm || categoryFilter !== "all" 
                ? "No activities match your filters" 
                : "No activities created yet"}
            </p>
            {!searchTerm && categoryFilter === "all" && (
              <Button 
                onClick={() => setIsCreateDialogOpen(true)}
                className="bg-[#8e0b16] hover:bg-[#66181E]"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Activity
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredActivities.map((activity) => {
            const IconComponent = categoryIcons[activity.category]
            return (
              <Card key={activity.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <IconComponent className="h-5 w-5" style={{ color: schoolColors.primary }} />
                      <Badge className={categoryColors[activity.category]}>
                        {activity.category}
                      </Badge>
                    </div>
                    <div className="flex gap-1">
                      {activity.settings.isShared && (
                        <Badge variant="outline" className="text-xs">
                          <Share2 className="h-3 w-3 mr-1" />
                          Shared
                        </Badge>
                      )}
                    </div>
                  </div>
                  <CardTitle className="text-lg">{activity.title}</CardTitle>
                  {activity.description && (
                    <CardDescription>{activity.description}</CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>Winners: {activity.settings.numberOfWinners}</span>
                      <span>Used: {activity.timesUsed} times</span>
                    </div>
                    
                    {activity.lastUsed && (
                      <p className="text-xs text-muted-foreground">
                        Last used: {activity.lastUsed.toLocaleDateString()}
                      </p>
                    )}
                    
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="flex-1 bg-[#8e0b16] hover:bg-[#66181E]"
                        onClick={async () => {
                          try {
                            // Verify activity exists before navigating
                            const activityDoc = await getDoc(doc(db, "drawActivities", activity.id))
                            if (activityDoc.exists()) {
                              window.location.href = `/activity/${activity.id}`
                            } else {
                              toast({
                                title: "Activity Not Found",
                                description: "This activity no longer exists. Please refresh the page.",
                                variant: "destructive"
                              })
                              // Refresh activities list
                              fetchActivities()
                            }
                          } catch (error) {
                            console.error("Error checking activity:", error)
                            toast({
                              title: "Error",
                              description: "Failed to start activity. Please try again.",
                              variant: "destructive"
                            })
                          }
                        }}
                      >
                        <Play className="h-4 w-4 mr-1" />
                        Start
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => setEditingActivity(activity)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => deleteActivity(activity.id, activity.title)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
