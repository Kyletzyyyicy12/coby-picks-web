"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { toast } from "@/hooks/use-toast"
import { db, auth } from "@/lib/firebase"
import { collection, getDocs, query, where, orderBy, limit, deleteDoc, doc, getDoc, updateDoc } from "firebase/firestore"
import { signOut } from "firebase/auth"
import { SpinHistoryManager } from "@/components/teacher/spin-history-manager"
import { SavedWheelsManager } from "@/components/teacher/saved-wheels-manager"
import { ActivityConfiguration } from "@/components/organizer/activity-configuration"
import { ParticipantPickerWheelGallery } from "@/components/participant/participant-picker-wheel-gallery"

import { AnnouncementDisplay } from "@/components/shared/announcement-display"
import { WebCollaborationNotifications } from "@/components/shared/web-collaboration-notifications"
import { LiveRoomInvitations } from "@/components/shared/live-room-invitations"
import { ConsentManager } from "@/components/privacy/consent-manager"
import {
  Users,
  Calendar,
  BarChart3,
  Settings,
  Play,
  Clock,
  Trophy,
  BookOpen,
  Search,
  Gamepad2,
  User,
  Eye,
  Share2,
  Target,
  Building,
  UserCheck,
  LogOut,
  UserCircle,
  RotateCcw,
  Trash2,
  Plus,
  Radio,
  RefreshCw,
  ChevronDown
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { User as FirebaseUser } from "firebase/auth"

interface DashboardStats {
  activeWheels: number
  totalDraws: number
  lastWinner: string
  totalParticipants: number
  activeLiveSessions: number
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
   // Live session properties
   liveSessionId?: string
   hasActiveSession?: boolean
   sessionData?: {
     roomCode: string
     viewerCount: number
     currentState: string
     createdAt: Date
     organizerAway?: boolean
     sessionState?: string
   } | null
 }

interface OrganizerDashboardProps {
  user: FirebaseUser
}

export function OrganizerDashboard({ user }: OrganizerDashboardProps) {
  const [stats, setStats] = useState<DashboardStats>({
    activeWheels: 0,
    totalDraws: 0,
    lastWinner: "None yet",
    totalParticipants: 0,
    activeLiveSessions: 0
  })
  const [recentActivities, setRecentActivities] = useState<DrawActivity[]>([])
  const [loading, setLoading] = useState(true)
  const [activeModal, setActiveModal] = useState<string | null>(null)
  const [showActivityConfiguration, setShowActivityConfiguration] = useState(false)
  const [showRegularActivityConfiguration, setShowRegularActivityConfiguration] = useState(false)
  const [showOrganizerSoloGallery, setShowOrganizerSoloGallery] = useState(false)
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [showConsentDialog, setShowConsentDialog] = useState(false)
  const [hasConsent, setHasConsent] = useState(false)

  // School colors
  const schoolColors = {
    primary: "#8e0b16",      // Main red
    secondary: "#66181E",    // Dark red/maroon
    accent: "#ffffff",       // White
    background: "#f8f9fa"    // Light background
  }

  // Default icon for activities since categories were removed
  const defaultActivityIcon = Target

  const statusColors = {
    draft: "bg-gray-500",
    active: "bg-green-500",
    completed: "bg-blue-500"
  }

  useEffect(() => {
    fetchDashboardData()

    // Listen for session ended events to refresh dashboard immediately
    const handleSessionEnded = (event: CustomEvent) => {
      console.log('🔄 Organizer Dashboard: Session ended, refreshing data:', event.detail)
      // Small delay to ensure Firestore has processed the updates
      setTimeout(() => {
        fetchDashboardData()
      }, 1000)
    }

    // Check if returning from saved wheels
    if (typeof window !== 'undefined') {
      const returnToSavedWheels = sessionStorage.getItem('returnToSavedWheels')
      if (returnToSavedWheels === 'true') {
        setActiveModal('saved-wheels')
        sessionStorage.removeItem('returnToSavedWheels')
      }

      window.addEventListener('sessionEnded', handleSessionEnded as EventListener)

      return () => {
        window.removeEventListener('sessionEnded', handleSessionEnded as EventListener)
      }
    }
  }, [user])

  const fetchDashboardData = async () => {
    try {
      console.log("Fetching dashboard data for organizer:", user.uid, user.email)

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
        liveSessionId: a.liveSessionId,
        status: a.status
      })))

      // Check for active live sessions for each activity
      console.log("🔍 Checking for active live sessions...")
      const activitiesWithLiveStatus = await Promise.all(
        activities.map(async (activity) => {
          if (activity.liveSessionId) {
            try {
              const sessionDoc = await getDoc(doc(db, "liveDrawSessions", activity.liveSessionId))
              if (sessionDoc.exists()) {
                const sessionData = sessionDoc.data()
                
                // Session is considered active if it exists and hasn't been explicitly ended
                // This ensures activities remain visible even if organizer accidentally closes the wheel
                // Only when organizer explicitly ends the session should it disappear
                const isExplicitlyEnded = sessionData.endedExplicitly === true
                const sessionStillActive = sessionData.isActive !== false // Session is active by default unless explicitly set to false
                const shouldShowSession = sessionStillActive && !isExplicitlyEnded
                
                console.log(`📊 Activity ${activity.id} live session status:`, {
                  sessionId: activity.liveSessionId,
                  isActive: sessionData.isActive,
                  isLive: sessionData.isLive,
                  temporarilyAway: sessionData.teacherPresence?.temporarilyAway,
                  endedExplicitly: sessionData.endedExplicitly,
                  sessionStillActive: sessionStillActive,
                  shouldShowSession: shouldShowSession,
                  roomCode: sessionData.roomCode,
                  viewerCount: sessionData.viewerCount || 0
                })
                
                return {
                  ...activity,
                  hasActiveSession: shouldShowSession,
                  sessionData: shouldShowSession ? {
                    roomCode: sessionData.roomCode,
                    viewerCount: sessionData.viewerCount || 0,
                    currentState: sessionData.currentState || 'waiting',
                    createdAt: sessionData.createdAt?.toDate() || new Date(),
                    organizerAway: sessionData.teacherPresence?.temporarilyAway || false,
                    sessionState: sessionData.sessionState || 'active'
                  } : null
                }
              }
            } catch (error) {
              console.log(`❌ Error checking live session for activity ${activity.id}:`, error)
            }
          }
          
          return {
            ...activity,
            hasActiveSession: false,
            sessionData: null
          }
        })
      )

      console.log("✅ Activities with live session status:", activitiesWithLiveStatus.map(a => ({
        id: a.id,
        title: a.title,
        hasActiveSession: a.hasActiveSession,
        roomCode: a.sessionData?.roomCode,
        viewerCount: a.sessionData?.viewerCount
      })))

      // Special check for Picker Wheel Gallery activities
      const pickerWheelActivities = activities.filter(a =>
        a.wheelType && (
          a.wheelType.includes('picker') ||
          a.wheelTitle?.includes('Picker')
        )
      )
      console.log("🎯 ORGANIZER: Picker Wheel Gallery activities found:", pickerWheelActivities.length, pickerWheelActivities.map(a => ({
        id: a.id,
        title: a.title,
        wheelType: a.wheelType,
        wheelTitle: a.wheelTitle
      })))

      // Filter out incomplete activities (activities without proper title or wheelType)
      const completeActivities = activitiesWithLiveStatus.filter(activity => {
        const hasTitle = activity.title && activity.title.trim() !== ''
        const hasWheelType = activity.wheelType && activity.wheelType.trim() !== ''

        // Check if it's a Picker Wheel Gallery activity
        const isPickerWheelActivity = activity.wheelType && (
          activity.wheelType.includes('picker') ||
          activity.wheelTitle?.includes('Picker')
        )

        // Very lenient filtering - just need a title, but always include picker wheel activities
        const isValid = hasTitle || isPickerWheelActivity

        // Log all activities for debugging
        console.log("📋 Organizer activity check:", {
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
          console.log("❌ Filtering out organizer activity:", activity.id, "Reason: Missing title and not a picker wheel")
        } else {
          console.log("✅ Including organizer activity:", activity.id, activity.title)
          if (isPickerWheelActivity) {
            console.log("🎯 ORGANIZER: This is a Picker Wheel Gallery activity!")
          }
        }

        return isValid
      })

      // Sort by createdAt on client side
      completeActivities.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      setRecentActivities(completeActivities.slice(0, 6))

      // Calculate stats
      const totalDraws = activitiesWithLiveStatus.reduce((sum, activity) => sum + activity.timesUsed, 0)
      const totalParticipants = activitiesWithLiveStatus.reduce((sum, activity) => sum + activity.participantCount, 0)
      const activeWheels = activitiesWithLiveStatus.filter(activity =>
        activity.lastUsed &&
        Date.now() - activity.lastUsed.getTime() < 7 * 24 * 60 * 60 * 1000 // Active in last 7 days
      ).length
      const activeLiveSessions = activitiesWithLiveStatus.filter(activity => activity.hasActiveSession).length

      setStats({
        activeWheels,
        totalDraws,
        lastWinner: "John Doe", // This would come from recent spin results
        totalParticipants,
        activeLiveSessions
      })

      console.log("Organizer dashboard data loaded successfully")

    } catch (error) {
      console.error("Error fetching organizer dashboard data:", error)

      // Retry mechanism for network issues
      if (error && typeof error === 'object' && 'code' in error &&
          (error.code === 'unavailable' || error.code === 'deadline-exceeded')) {
        console.log("Retrying organizer dashboard data fetch due to network issue...")
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

  const getOrganizerName = () => {
    return user.displayName || user.email?.split('@')[0] || "Organizer"
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

  const quickActions = [
    {
      title: "Browse Picker Wheels",
      description: "Use wheels in solo mode - no live session needed",
      icon: Target,
      action: () => setShowOrganizerSoloGallery(true),
      color: "#8e0b16" // Match participants dashboard color
    },
    {
      title: "Create Live Activity",
      description: "Create activities with live sessions for participants",
      icon: Radio,
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
    },


  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4" style={{ borderColor: schoolColors.primary }}></div>
          <p style={{ color: schoolColors.primary }}>Loading organizer dashboard...</p>
        </div>
      </div>
    )
  }

  // Show ActivityConfiguration if requested
  if (showActivityConfiguration) {
    return (
      <ActivityConfiguration
        user={user}
        userName={getOrganizerName()}
        autoEnableLiveSession={true} // Automatically enable live sessions since this is for creating live activities
        onCancel={() => setShowActivityConfiguration(false)}
      />
    )
  }

  // Show Regular ActivityConfiguration if requested
  if (showRegularActivityConfiguration) {
    return (
      <ActivityConfiguration
        user={user}
        userName={getOrganizerName()}
        autoEnableLiveSession={false} // Don't enable live sessions for regular activities
        onCancel={() => setShowRegularActivityConfiguration(false)}
      />
    )
  }

  // Show Organizer Solo Gallery if requested
  if (showOrganizerSoloGallery) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: schoolColors.background }}>
        {/* Solo Wheel Gallery */}
        <ParticipantPickerWheelGallery
          user={user}
          onBack={() => setShowOrganizerSoloGallery(false)}
          userRole="organizer"
        />
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: schoolColors.background }}>
      {/* Welcome Banner */}
      <div 
        className="w-full py-10 px-6 mb-8 shadow-lg"
        style={{ 
          backgroundColor: schoolColors.secondary,
          background: `linear-gradient(135deg, ${schoolColors.secondary} 0%, ${schoolColors.primary} 100%)`
        }}
      >
        <div className="container mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-3 bg-white/15 rounded-lg backdrop-blur-sm">
                  <span className="text-4xl">👤</span>
                </div>
                <div>
                  <h1 className="text-3xl md:text-4xl font-bold text-white mb-1">
                    Welcome to Coby Picks!
                  </h1>
                  <p className="text-white/90 text-lg">
                    Hello, {getOrganizerName()}!
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge className="text-xs px-3 py-1" style={{ backgroundColor: 'rgba(255, 255, 255, 0.2)', color: 'white', border: '1px solid rgba(255, 255, 255, 0.3)' }}>
                  Organizer Dashboard
                </Badge>
                <Badge className="text-xs px-3 py-1" style={{ backgroundColor: '#66181E', color: 'white' }}>
                  🎯 Manage Activities & Live Sessions
                </Badge>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <AnnouncementDisplay user={user} userRole="organizer" />

               {/* Account Dropdown Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="relative h-10 w-10 rounded-full bg-white/10 border-white/20 text-white hover:bg-white/20 p-0"
                  >
                    <UserCircle className="h-6 w-6" />
                    <ChevronDown className="absolute -bottom-1 -right-1 h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 bg-white">
                  {/* User Profile Section */}
                  <div className="px-3 py-2 border-b border-gray-200">
                    <div className="flex items-center gap-3">
                      <UserCircle className="h-8 w-8 text-swu-red" />
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-gray-900">
                          {user.displayName || user.email?.split('@')[0] || 'Organizer'}
                        </span>
                        <span className="text-xs text-gray-500">{user.email}</span>
                      </div>
                    </div>
                    <div className="mt-2">
                      <Badge variant="default" className="bg-swu-red text-xs">
                        👤 ORGANIZER
                      </Badge>
                    </div>
                  </div>

                  {/* Menu Items */}
                  <DropdownMenuItem
                    className="cursor-pointer py-2 px-3 hover:bg-gray-50"
                    onClick={() => setShowProfileModal(true)}
                  >
                    <User className="mr-2 h-4 w-4 text-swu-red" />
                    <span>My Profile</span>
                  </DropdownMenuItem>

                  <DropdownMenuItem
                    className="cursor-pointer py-2 px-3 hover:bg-blue-50 text-blue-600"
                    onClick={async () => {
                      try {
                        // Update user role in Firestore
                        const userDocRef = doc(db, "users", user.uid)
                        await updateDoc(userDocRef, {
                          role: "participant",
                          lastRoleSelection: new Date()
                        })

                        toast({
                          title: "Role Switched",
                          description: "You are now set as a Participant.",
                        })

                        // Navigate to participant dashboard
                        window.location.href = "/participants"
                      } catch (error) {
                        console.error("Error switching role:", error)
                        toast({
                          title: "Error",
                          description: "Failed to switch role. Please try again.",
                          variant: "destructive"
                        })
                      }
                    }}
                  >
                    <Users className="mr-2 h-4 w-4" />
                    <span>Switch to Participant</span>
                  </DropdownMenuItem>

                  <DropdownMenuSeparator />

                  <DropdownMenuItem
                    className="cursor-pointer py-2 px-3 hover:bg-red-50 text-red-600"
                    onClick={handleLogout}
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Logout</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </div>

      {/* Collaboration Notifications - Positioned outside banner for better visibility */}
      <div className="container mx-auto px-6 pb-8">
        
        {/* Live Room Invitations - Real-time notifications for live session collaborations */}
        <LiveRoomInvitations user={user} />
        
        {/* Legacy Collaboration Notifications */}
        <WebCollaborationNotifications />
        {/* Quick Actions */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold flex items-center gap-2" style={{ color: schoolColors.primary }}>
              <Target className="h-6 w-6" />
              Quick Actions
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {quickActions.map((action, index) => {
              const IconComponent = action.icon
              return (
                <Card
                  key={index}
                  className="group hover:shadow-xl transition-all duration-300 cursor-pointer border-2 bg-white hover:scale-105"
                  style={{ borderColor: action.color, borderWidth: '2px' }}
                  onClick={action.action}
                >
                  <CardContent className="p-6">
                    <div className="flex items-center gap-4">
                      <div
                        className="p-4 rounded-xl transition-transform group-hover:scale-110"
                        style={{ 
                          backgroundColor: `${action.color}15`,
                          border: `2px solid ${action.color}20`
                        }}
                      >
                        <IconComponent className="h-7 w-7" style={{ color: action.color }} />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-bold text-base mb-1" style={{ color: schoolColors.primary }}>
                          {action.title}
                        </h3>
                        <p className="text-sm text-gray-600 leading-relaxed">
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

        {/* Recent Draw Activities */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <h2 className="text-2xl font-bold" style={{ color: schoolColors.primary }}>
                🧾 Recent Draw Activities
              </h2>
              {stats.activeLiveSessions > 0 && (
                <Badge className="bg-red-100 border-red-500 text-red-600">
                  🔴 {stats.activeLiveSessions} Live Session{stats.activeLiveSessions > 1 ? 's' : ''}
                </Badge>
              )}
            </div>
            {recentActivities.length >= 6 && (
              <Button variant="outline" style={{ borderColor: schoolColors.primary, color: schoolColors.primary }}>
                View All Activities
              </Button>
            )}
          </div>

          {recentActivities.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <Target className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">No Activities Yet</h3>
                <p className="text-muted-foreground mb-6">
                  Choose how you want to use picker wheels
                </p>
                <div className="flex gap-3 justify-center flex-col sm:flex-row">
                  <Button
                    onClick={() => setShowOrganizerSoloGallery(true)}
                    variant="outline"
                    className="text-blue-600 border-blue-600 hover:bg-blue-50"
                  >
                    <Target className="h-4 w-4 mr-2" />
                    Solo Mode
                  </Button>
                  <Button
                    onClick={() => setShowActivityConfiguration(true)}
                    className="text-white"
                    style={{ backgroundColor: schoolColors.primary }}
                  >
                    <Radio className="h-4 w-4 mr-2" />
                    Create Live Activity
                  </Button>
                </div>
                <div className="mt-4 text-xs text-muted-foreground space-y-1">
                  <p>🎯 <strong>Solo Mode:</strong> Use wheels privately, no live sessions</p>
                  <p>📷 <strong>Live Activity:</strong> Create sessions for participants to join</p>
                </div>
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
                          <Badge
                            variant="outline"
                            className="text-xs"
                            style={{ borderColor: schoolColors.primary, color: schoolColors.primary }}
                          >
                            {activity.category}
                          </Badge>
                          {/* Live Session Status Badge */}
                          {activity.hasActiveSession && activity.sessionData && (
                            <Badge
                              variant="outline"
                              className="text-xs bg-red-50 border-red-500 text-red-600"
                            >
                              🔴 LIVE
                            </Badge>
                          )}
                        </div>
                        <div className="flex gap-1">
                          {activity.isReusable && (
                            <Badge variant="outline" className="text-xs">
                              <RotateCcw className="h-3 w-3 mr-1" />
                              Reusable
                            </Badge>
                          )}
                        </div>
                      </div>
                      <CardTitle className="text-lg">{activity.title}</CardTitle>
                      {activity.description && (
                        <CardDescription>{activity.description}</CardDescription>
                      )}
                      {/* Live Session Info */}
                      {activity.hasActiveSession && activity.sessionData && (
                        <div className="bg-red-50 border border-red-200 rounded p-2 mt-2">
                          <div className="text-xs text-red-700 space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold">🏠 Room Code:</span>
                              <span className="bg-white px-2 py-1 rounded font-mono">
                                {activity.sessionData.roomCode}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold">👥 Viewers:</span>
                              <span>{activity.sessionData.viewerCount}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold">📊 Status:</span>
                              <span className="capitalize">
                                {activity.sessionData.organizerAway ? "Organizer Away" : activity.sessionData.currentState}
                              </span>
                              {activity.sessionData.organizerAway && (
                                <span className="text-orange-600 font-medium">(⏸️ Paused)</span>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {/* Wheel Information */}
                        {(activity.wheelType || activity.wheelTitle) && (
                          <div className="p-3 bg-gray-50 rounded-lg border">
                            <div className="text-sm font-medium text-gray-700 mb-2">🎯 Wheel Used</div>
                            <div className="space-y-1">
                              {activity.wheelType && (
                                <div className="text-xs">
                                  <span className="font-medium">Type:</span> {activity.wheelType}
                                </div>
                              )}
                              {activity.wheelTitle && (
                                <div className="text-xs">
                                  <span className="font-medium">Name:</span> {activity.wheelTitle}
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Users className="h-4 w-4" />
                            <span>{activity.participantCount} participants</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Trophy className="h-4 w-4" />
                            <span>{activity.settings.numberOfWinners} winner(s)</span>
                          </div>
                        </div>

                        <div className="text-xs text-muted-foreground space-y-1">
                          {activity.lastUsed && (
                            <div className="flex items-center gap-2">
                              <Clock className="h-3 w-3" />
                              <span>Last used: {activity.lastUsed.toLocaleDateString()}</span>
                            </div>
                          )}
                          <span>• Used {activity.timesUsed} times</span>
                        </div>

                        <div className="flex gap-2 pt-2">
                          {/* Show Resume Live Session button for active sessions */}
                          {activity.hasActiveSession && activity.sessionData ? (
                            <Button
                              size="sm"
                              className={`flex-1 text-white ${activity.sessionData.organizerAway ? 'bg-orange-600 hover:bg-orange-700' : 'bg-red-600 hover:bg-red-700'}`}
                              onClick={() => {
                                const actionType = activity.sessionData?.organizerAway ? "Rejoining" : "Resuming"
                                console.log(`🔴 ORGANIZER: ${actionType} live session:`, activity.liveSessionId, activity.title)
                                console.log("📊 Live session data:", activity.sessionData)
                                
                                // Show loading toast
                                toast({
                                  title: `${actionType} Live Session`,
                                  description: `Connecting to live room ${activity.sessionData?.roomCode}...`,
                                })
                                
                                // Navigate directly to the live session
                                const targetUrl = `/live/${activity.liveSessionId}`
                                console.log(`🚀 ORGANIZER: Navigating to ${actionType.toLowerCase()} live session:`, targetUrl)
                                
                                // Use window.location for reliable navigation
                                window.location.href = targetUrl
                              }}
                            >
                              {activity.sessionData.organizerAway ? (
                                <>
                                  <RefreshCw className="h-4 w-4 mr-1" />
                                  Rejoin Session
                                </>
                              ) : (
                                <>
                                  <Play className="h-4 w-4 mr-1" />
                                  Resume Live Session
                                </>
                              )}
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              className="flex-1 text-white"
                              style={{ backgroundColor: schoolColors.primary }}
                              onClick={() => {
                                console.log("🎯 ORGANIZER: Starting activity:", activity.id, activity.title)
                                console.log("🔍 ORGANIZER: Activity data:", {
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
                                  console.log("🎯 ORGANIZER: This is a Picker Wheel Gallery activity!")
                                }

                                // Show loading toast
                                toast({
                                  title: "Starting Activity",
                                  description: `Loading ${activity.title}...`,
                                })

                                // Navigate directly to live-draw-manager - always use live mode
                                const targetUrl = `/live/${activity.id}`
                                console.log("🚀 ORGANIZER: Navigating directly to live-draw-manager:", targetUrl)

                                // Use window.location for reliable navigation
                                window.location.href = targetUrl
                              }}
                            >
                              <Play className="h-4 w-4 mr-1" />
                              Start Draw
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            style={{ borderColor: schoolColors.secondary, color: schoolColors.secondary }}
                          >
                            <Eye className="h-4 w-4" />
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



      <Dialog open={activeModal === "saved-wheels"} onOpenChange={() => setActiveModal(null)}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Saved Wheels</DialogTitle>
          </DialogHeader>
          <SavedWheelsManager user={user} onClose={() => setActiveModal(null)} />
        </DialogContent>
      </Dialog>

      {/* Profile Modal */}
      <Dialog open={showProfileModal} onOpenChange={setShowProfileModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-swu-red" />
              My Profile
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            {/* Profile Information */}
            <div className="space-y-4">
              <div className="text-center">
                <div className="w-20 h-20 bg-swu-red rounded-full flex items-center justify-center mx-auto mb-4">
                  <User className="h-10 w-10 text-white" />
                </div>
                <h3 className="text-lg font-semibold">
                  {user.displayName || user.email?.split('@')[0] || 'Organizer'}
                </h3>
                <Badge variant="default" className="bg-swu-red mt-2">
                  👤 Organizer
                </Badge>
              </div>

              <div className="space-y-3">
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="text-sm font-medium text-gray-700">Email Address</div>
                  <div className="text-sm text-gray-900 mt-1">{user.email}</div>
                </div>

                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="text-sm font-medium text-gray-700">Display Name</div>
                  <div className="text-sm text-gray-900 mt-1">
                    {user.displayName || 'Not set'}
                  </div>
                </div>

                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="text-sm font-medium text-gray-700">Account Created</div>
                  <div className="text-sm text-gray-900 mt-1">
                    {user.metadata?.creationTime 
                      ? new Date(user.metadata.creationTime).toLocaleDateString()
                      : 'Unknown'
                    }
                  </div>
                </div>

                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="text-sm font-medium text-gray-700">Email Verified</div>
                  <div className="text-sm mt-1">
                    <Badge variant={user.emailVerified ? 'default' : 'destructive'}>
                      {user.emailVerified ? '✅ Verified' : '❌ Not Verified'}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>

            {/* Close Button */}
            <div className="flex justify-end">
              <Button
                onClick={() => setShowProfileModal(false)}
                className="bg-swu-red hover:bg-swu-red/90"
              >
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Consent Dialog */}
      <ConsentManager
        user={user}
        showDialog={showConsentDialog}
        onConsentComplete={(consented) => {
          setHasConsent(consented)
          setShowConsentDialog(false)
        }}
      />

    </div>
  )
}
