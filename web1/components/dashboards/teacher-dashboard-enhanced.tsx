"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { toast } from "@/hooks/use-toast"
import { db, auth } from "@/lib/firebase"
import { collection, getDocs, query, where, orderBy, limit, deleteDoc, doc, getDoc } from "firebase/firestore"
import { signOut } from "firebase/auth"
import { SpinHistoryManager } from "@/components/teacher/spin-history-manager"
import { StudentListManager } from "@/components/teacher/student-list-manager"
import { SavedWheelsManager } from "@/components/teacher/saved-wheels-manager"
import { WheelCustomization } from "@/components/teacher/wheel-customization"
import { ActivityConfiguration } from "@/components/organizer/activity-configuration"

import { AnnouncementDisplay } from "@/components/shared/announcement-display"
import {
  Gamepad2,
  BarChart3,
  Users,
  Settings,
  Play,
  Clock,
  Trophy,
  BookOpen,
  Search,
  User,
  RotateCcw,
  Share2,
  Calendar,
  Target,
  LogOut,
  UserCircle,
  Trash2,
  Plus
} from "lucide-react"
import Link from "next/link"
import type { User as FirebaseUser } from "firebase/auth"

interface DashboardStats {
  activeWheels: number
  totalDraws: number
  lastWinner: string
  totalParticipants: number
}

interface DrawActivity {
   id: string
   title: string
   description: string
   category: "academic" | "research" | "entertainment" | "personal"
   isReusable: boolean
   isScheduled: boolean
   scheduledDate?: Date
   lastUsed?: Date
   createdAt: Date
   timesUsed: number
   participantCount: number
   settings: {
     numberOfWinners: number
     hasConfetti: boolean
     hasSound: boolean
   }
   // Additional properties from Firestore
   wheelType?: string
   wheelTitle?: string
   createdBy?: string
   isLive?: boolean
   status?: string
 }

interface TeacherDashboardEnhancedProps {
  user: FirebaseUser
}

export function TeacherDashboardEnhanced({ user }: TeacherDashboardEnhancedProps) {
  const [stats, setStats] = useState<DashboardStats>({
    activeWheels: 0,
    totalDraws: 0,
    lastWinner: "None yet",
    totalParticipants: 0
  })
  const [recentActivities, setRecentActivities] = useState<DrawActivity[]>([])
  const [loading, setLoading] = useState(true)
  const [activeModal, setActiveModal] = useState<string | null>(null)
  const [showActivityConfiguration, setShowActivityConfiguration] = useState(false)

  // School colors
  const schoolColors = {
    primary: "#8e0b16",      // Main red
    secondary: "#66181E",    // Dark red/maroon
    accent: "#ffffff",       // White
    background: "#f8f9fa"    // Light background
  }

  // Default icon for activities since categories were removed
  const defaultActivityIcon = Target

  const categoryColors = {
    academic: "bg-blue-500",
    research: "bg-purple-500",
    entertainment: "bg-green-500",
    personal: "bg-orange-500"
  }

  useEffect(() => {
    fetchDashboardData()
  }, [user])

  const fetchDashboardData = async () => {
    try {
      console.log("Fetching dashboard data for user:", user.uid, user.email)

      // Fetch recent activities - simplified query to avoid index requirement
      const activitiesQuery = query(
        collection(db, "drawActivities"),
        where("createdBy", "==", user.uid),
        limit(20) // Increased limit to get more activities
      )
      const activitiesSnapshot = await getDocs(activitiesQuery)

      console.log("Found", activitiesSnapshot.docs.length, "activities in Firestore")

      const activities = activitiesSnapshot.docs.map(doc => {
        const data = doc.data()
        return {
          id: doc.id,
          ...data,
          lastUsed: data.lastUsed?.toDate(),
          scheduledDate: data.scheduledDate?.toDate(),
          createdAt: data.createdAt?.toDate() || new Date()
        }
      }) as DrawActivity[]

      console.log("Processed activities:", activities.map(a => ({
        id: a.id,
        title: a.title,
        wheelType: a.wheelType,
        wheelTitle: a.wheelTitle,
        createdBy: a.createdBy,
        isLive: a.isLive,
        status: a.status
      })))

      // Special check for Picker Wheel Gallery activities
      const pickerWheelActivities = activities.filter(a =>
        a.wheelType && (
          a.wheelType.includes('picker') ||
          a.wheelType === 'basic-picker' ||
          a.wheelTitle?.includes('Picker')
        )
      )
      console.log("🎯 Picker Wheel Gallery activities found:", pickerWheelActivities.length, pickerWheelActivities.map(a => ({
        id: a.id,
        title: a.title,
        wheelType: a.wheelType,
        wheelTitle: a.wheelTitle
      })))

      // Filter out incomplete activities (activities without proper title or wheelType)
      const completeActivities = activities.filter(activity => {
        const hasTitle = activity.title && activity.title.trim() !== ''
        const hasWheelType = activity.wheelType && activity.wheelType.trim() !== ''

        // Check if it's a Picker Wheel Gallery activity
        const isPickerWheelActivity = activity.wheelType && (
          activity.wheelType.includes('picker') ||
          activity.wheelType === 'basic-picker' ||
          activity.wheelTitle?.includes('Picker')
        )

        // Very lenient filtering - just need a title, but always include picker wheel activities
        const isValid = hasTitle || isPickerWheelActivity

        // Log all activities for debugging
        console.log("📋 Activity check:", {
          id: activity.id,
          title: activity.title,
          wheelType: activity.wheelType,
          wheelTitle: activity.wheelTitle,
          hasTitle,
          hasWheelType,
          isPickerWheelActivity,
          isValid,
          createdBy: activity.createdBy
        })

        if (!isValid) {
          console.log("❌ Filtering out activity:", activity.id, "Reason: Missing title and not a picker wheel")
        } else {
          console.log("✅ Including activity:", activity.id, activity.title)
          if (isPickerWheelActivity) {
            console.log("🎯 This is a Picker Wheel Gallery activity!")
          }
        }

        return isValid
      })

      // Sort by createdAt on client side
      completeActivities.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      setRecentActivities(completeActivities.slice(0, 6))

      // Calculate stats
      const totalDraws = activities.reduce((sum, activity) => sum + activity.timesUsed, 0)
      const totalParticipants = activities.reduce((sum, activity) => sum + activity.participantCount, 0)
      const activeWheels = activities.filter(activity =>
        activity.lastUsed &&
        Date.now() - activity.lastUsed.getTime() < 7 * 24 * 60 * 60 * 1000 // Active in last 7 days
      ).length

      setStats({
        activeWheels,
        totalDraws,
        lastWinner: "John Doe", // This would come from recent spin results
        totalParticipants
      })

      console.log("Dashboard data loaded successfully")

    } catch (error) {
      console.error("Error fetching dashboard data:", error)

      // Retry mechanism for network issues
      if (error && typeof error === 'object' && 'code' in error &&
          (error.code === 'unavailable' || error.code === 'deadline-exceeded')) {
        console.log("Retrying dashboard data fetch due to network issue...")
        setTimeout(() => {
          fetchDashboardData()
        }, 2000)
      } else {
        toast({
          title: "Error Loading Activities",
          description: "Failed to load your activities. Please refresh the page.",
          variant: "destructive"
        })
      }
    } finally {
      setLoading(false)
    }
  }

  // Function to verify and ensure activity access
  const verifyActivityAccess = async (activityId: string) => {
    try {
      const activityDoc = await getDoc(doc(db, "drawActivities", activityId))
      if (!activityDoc.exists()) {
        console.error("Activity not found:", activityId)
        return false
      }

      const activityData = activityDoc.data()
      if (activityData.createdBy !== user.uid) {
        console.error("Activity access denied - not creator:", activityId)
        return false
      }

      return true
    } catch (error) {
      console.error("Error verifying activity access:", error)
      return false
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

      // Remove from local state
      setRecentActivities(prev => prev.filter(activity => activity.id !== activityId))
    } catch (error) {
      console.error("Error deleting activity:", error)
      toast({
        title: "Error",
        description: "Failed to delete activity",
        variant: "destructive"
      })
    }
  }

  const quickActions = [
    {
      title: "Browse Picker Wheels",
      description: "Explore all available wheel types",
      icon: Target,
      action: () => setShowActivityConfiguration(true),
      color: "#8e0b16"
    },
    {
      title: "View Saved Wheels",
      description: "Access your wheel templates",
      icon: RotateCcw,
      action: () => setActiveModal("saved-wheels"),
      color: schoolColors.secondary
    },
    {
      title: "View Spin History",
      description: "See past draw results",
      icon: BarChart3,
      action: () => setActiveModal("spin-history"),
      color: schoolColors.primary
    }
  ]

  const getTeacherName = () => {
    return user.displayName || user.email?.split('@')[0] || "Teacher"
  }

  const handleLogout = async () => {
    try {
      await signOut(auth)
      toast({
        title: "Logged Out",
        description: "You have been successfully logged out.",
      })
    } catch (error) {
      console.error("Error signing out:", error)
      toast({
        title: "Error",
        description: "Failed to log out. Please try again.",
        variant: "destructive"
      })
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4" style={{ borderColor: schoolColors.primary }}></div>
          <p style={{ color: schoolColors.primary }}>Loading your dashboard...</p>
        </div>
      </div>
    )
  }

  // Show ActivityConfiguration if requested
  if (showActivityConfiguration) {
    return (
      <ActivityConfiguration 
        user={user}
        userName={getTeacherName()}
        onCancel={() => setShowActivityConfiguration(false)}
      />
    )
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: schoolColors.background }}>
      {/* Welcome Banner */}
      <div 
        className="w-full py-8 px-6 mb-8"
        style={{ 
          backgroundColor: schoolColors.secondary,
          background: `linear-gradient(135deg, ${schoolColors.secondary} 0%, ${schoolColors.primary} 100%)`
        }}
      >
        <div className="container mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">
                🎯 Ready to Spin the Wheel, {getTeacherName()}?
              </h1>
              <p className="text-white/90 text-lg">
                Welcome to your Coby Picks Teacher Dashboard
              </p>
            </div>
            <div className="flex items-center gap-4">
              <AnnouncementDisplay user={user} userRole="organizer" />
              <div className="text-right text-white/80 text-sm">
                <div className="flex items-center gap-2">
                  <UserCircle className="h-4 w-4" />
                  <span>{user.displayName || user.email}</span>
                </div>
                <div className="text-xs">👤 Organizer Dashboard</div>
              </div>
              <Button
                onClick={handleLogout}
                variant="outline"
                size="sm"
                className="bg-white/10 border-white/20 text-white hover:bg-white/20"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
          

        </div>
      </div>

      <div className="container mx-auto px-6 pb-8">
        {/* Quick Actions */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-6" style={{ color: schoolColors.primary }}>
            🧭 Dashboard Overview
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {quickActions.map((action, index) => {
              const IconComponent = action.icon
              return (
                <Card
                  key={index}
                  className="hover:shadow-lg transition-all duration-200 cursor-pointer border-2 hover:border-opacity-50"
                  style={{ borderColor: action.color }}
                  onClick={action.action}
                >
                  <CardContent className="p-6">
                    <div className="flex items-center gap-4">
                      <div
                        className="p-3 rounded-lg"
                        style={{ backgroundColor: `${action.color}15`, color: action.color }}
                      >
                        <IconComponent className="h-6 w-6" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg" style={{ color: schoolColors.primary }}>
                          {action.title}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {action.description}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>

        {/* Recent Activities */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold" style={{ color: schoolColors.primary }}>
              🧾 Recent Draw Activities
            </h2>
            {recentActivities.length >= 6 && (
              <Link href="/activities">
                <Button variant="outline" style={{ borderColor: schoolColors.primary, color: schoolColors.primary }}>
                  View All Activities
                </Button>
              </Link>
            )}
          </div>

          {recentActivities.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <Target className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">No Activities Yet</h3>
                <p className="text-muted-foreground mb-4">
                  Browse our picker wheel gallery to create your first activity
                </p>
                <Link href="#" onClick={(e) => { e.preventDefault(); setShowActivityConfiguration(true); }}>
                  <Button className="text-white" style={{ backgroundColor: schoolColors.primary }}>
                    <Target className="h-4 w-4 mr-2" />
                    Browse Picker Wheels
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {recentActivities.map((activity) => {
                const IconComponent = defaultActivityIcon
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
                          {activity.isReusable && (
                            <Badge variant="outline" className="text-xs">
                              <RotateCcw className="h-3 w-3 mr-1" />
                              Reusable
                            </Badge>
                          )}
                          {activity.isScheduled && (
                            <Badge variant="outline" className="text-xs">
                              <Calendar className="h-3 w-3 mr-1" />
                              Scheduled
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
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div className="flex items-center gap-1">
                            <Users className="h-4 w-4 text-muted-foreground" />
                            <span>{activity.participantCount} participants</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Trophy className="h-4 w-4 text-muted-foreground" />
                            <span>{activity.settings.numberOfWinners} winner(s)</span>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {activity.lastUsed ? (
                            <span>Last used: {activity.lastUsed.toLocaleDateString()}</span>
                          ) : (
                            <span>Never used</span>
                          )}
                          <span>• Used {activity.timesUsed} times</span>
                        </div>
                        
                        <div className="flex gap-2 pt-2">
                          <Button
                            size="sm"
                            className="w-full text-white"
                            style={{ backgroundColor: schoolColors.primary }}
                            onClick={() => {
                              console.log("🎯 TEACHER: Starting activity:", activity.id, activity.title)
                              console.log("🔍 TEACHER: Activity data:", {
                                id: activity.id,
                                title: activity.title,
                                wheelType: activity.wheelType,
                                wheelTitle: activity.wheelTitle,
                                isLive: activity.isLive,
                                createdBy: activity.createdBy,
                                userUid: user.uid,
                                status: activity.status
                              })

                              // Check if this is a Picker Wheel Gallery activity
                              const isPickerWheelActivity = activity.wheelType && (
                                activity.wheelType.includes('picker') ||
                                activity.wheelType === 'basic-picker' ||
                                activity.wheelTitle?.includes('Picker')
                              )

                              if (isPickerWheelActivity) {
                                console.log("🎯 TEACHER: This is a Picker Wheel Gallery activity!")
                              }

                              // Show loading toast
                              toast({
                                title: "Starting Activity",
                                description: `Loading ${activity.title}...`,
                              })

                              // Navigate directly to live-draw-manager - always use live mode
                              const targetUrl = `/live/${activity.id}`
                              console.log("🚀 TEACHER: Navigating directly to live-draw-manager:", targetUrl)

                              // Use window.location for reliable navigation
                              window.location.href = targetUrl
                            }}
                          >
                            <Play className="h-4 w-4 mr-1" />
                            Start Draw
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            style={{ borderColor: schoolColors.secondary, color: schoolColors.secondary }}
                          >
                            <Share2 className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => deleteActivity(activity.id, activity.title)}
                            className="text-red-600 border-red-600 hover:bg-red-50"
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
      </div>

      {/* Modal Dialogs */}
      <Dialog open={activeModal === "spin-history"} onOpenChange={() => setActiveModal(null)}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Spin History</DialogTitle>
          </DialogHeader>
          <SpinHistoryManager user={user} onClose={() => setActiveModal(null)} />
        </DialogContent>
      </Dialog>

      <Dialog open={activeModal === "student-lists"} onOpenChange={() => setActiveModal(null)}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Student Lists</DialogTitle>
          </DialogHeader>
          <StudentListManager user={user} onClose={() => setActiveModal(null)} />
        </DialogContent>
      </Dialog>

      <Dialog open={activeModal === "saved-wheels"} onOpenChange={() => setActiveModal(null)}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Saved Wheels</DialogTitle>
          </DialogHeader>
          <SavedWheelsManager user={user} onClose={() => setActiveModal(null)} />
        </DialogContent>
      </Dialog>

      <Dialog open={activeModal === "customization"} onOpenChange={() => setActiveModal(null)}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Wheel Customization</DialogTitle>
          </DialogHeader>
          <WheelCustomization user={user} onClose={() => setActiveModal(null)} />
        </DialogContent>
      </Dialog>


    </div>
  )
}
