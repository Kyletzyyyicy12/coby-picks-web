"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { toast } from "@/hooks/use-toast"
import { db, auth } from "@/lib/firebase"
import { collection, getDocs, query, where, orderBy, onSnapshot, doc, getDoc } from "firebase/firestore"
import { signOut } from "firebase/auth"
import { AnnouncementDisplay } from "@/components/shared/announcement-display"
import {
  Eye,
  Play,
  Clock,
  Users,
  BookOpen,
  Gamepad2,
  User,
  Radio,
  Heart,
  ThumbsUp,
  Star,
  Trophy,
  Calendar,
  Share2,
  Settings,
  LogOut,
  UserCircle,
  RotateCcw,
  BarChart3,
  Target,
  ChevronDown
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ConsentManager } from "@/components/privacy/consent-manager"
import { SpinHistoryManager } from "@/components/teacher/spin-history-manager"
import { SavedWheelsManager } from "@/components/teacher/saved-wheels-manager"
import { EnhancedParticipantJoin } from "@/components/live/enhanced-participant-join"
import { ParticipantPickerWheelGallery } from "@/components/participant/participant-picker-wheel-gallery"
import { WheelTypeProvider } from "@/components/providers/wheel-type-provider"

import type { User as FirebaseUser } from "firebase/auth"

interface PublicDraw {
  id: string
  title: string
  description: string
  category: "academic" | "research" | "entertainment" | "personal"
  organizerName: string
  scheduledTime?: Date
  isLive: boolean
  participantCount: number
  viewerCount: number
  status: "upcoming" | "live" | "completed"
  allowReactions: boolean
  shareUrl: string
}

interface ParticipantDashboardProps {
  user?: FirebaseUser | null
  participantName?: string
}

export function ParticipantDashboard({ user, participantName }: ParticipantDashboardProps) {
  const [availableDraws, setAvailableDraws] = useState<PublicDraw[]>([])
  const [loading, setLoading] = useState(true)
  const [showConsentDialog, setShowConsentDialog] = useState(false)
  const [hasConsent, setHasConsent] = useState(false)
  const [viewingDraw, setViewingDraw] = useState<PublicDraw | null>(null)
  const [activeModal, setActiveModal] = useState<string | null>(null)

  // Live session states
  const [liveSessions, setLiveSessions] = useState<any[]>([])
  const [roomCode, setRoomCode] = useState("")
  const [showRoomCodeDialog, setShowRoomCodeDialog] = useState(false)
  const [joiningSession, setJoiningSession] = useState(false)
  const [showParticipantGallery, setShowParticipantGallery] = useState(false)
  const [showProfileModal, setShowProfileModal] = useState(false)

  // School colors
  const schoolColors = {
    primary: "#8e0b16",      // Main red
    secondary: "#66181E",    // Dark red/maroon
    accent: "#ffffff",       // White
    background: "#f8f9fa"    // Light background
  }

  const categoryIcons = {
    academic: BookOpen,
    research: BookOpen, // Changed from Search to BookOpen
    entertainment: Gamepad2,
    personal: User
  }

  const statusColors = {
    upcoming: "bg-blue-500",
    live: "bg-red-500 animate-pulse",
    completed: "bg-green-500"
  }

  const statusIcons = {
    upcoming: Calendar,
    live: Radio,
    completed: Trophy
  }

  useEffect(() => {
    fetchPublicDraws()
    
    // Check consent status if user is logged in
    if (user) {
      checkConsentStatus()
    } else {
      setHasConsent(true) // Allow viewing without login
    }
  }, [user])

  // Real-time live session listener - only for invited sessions
  useEffect(() => {
    if (!user) return

    // Listen for invitations for this student
    const invitationsQuery = query(
      collection(db, "roomCodeInvitations"),
      where("participantEmail", "==", user.email),
      where("status", "==", "sent")
    )

    const unsubscribeInvitations = onSnapshot(invitationsQuery, async (invitationSnapshot) => {
      const invitations = invitationSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Array<{ id: string; roomCode: string; participantEmail: string; status: string }>

      if (invitations.length === 0) {
        setLiveSessions([])
        return
      }

      // Get room codes from invitations
      const roomCodes = invitations.map(inv => inv.roomCode)

      // Query live sessions that match the room codes and are active
      const liveSessionsQuery = query(
        collection(db, "liveDrawSessions"),
        where("isActive", "==", true),
        where("roomCode", "in", roomCodes)
      )

      const unsubscribeSessions = onSnapshot(liveSessionsQuery, async (sessionSnapshot) => {
        const sessions = await Promise.all(
          sessionSnapshot.docs.map(async (doc) => {
            const sessionData = {
              id: doc.id,
              ...doc.data(),
              createdAt: doc.data().createdAt?.toDate()
            } as any

            // Check if teacher is actively present in the session
            const teacherPresent = await checkTeacherPresence(doc.id, sessionData.createdBy)

            return {
              ...sessionData,
              teacherPresent
            }
          })
        )

        // Only show sessions where organizer is present
        const activeSessions = sessions.filter(session => session.teacherPresent)
        setLiveSessions(activeSessions)

        // Show notification for new live sessions where organizer is present
        if (activeSessions.length > liveSessions.length && liveSessions.length > 0) {
          const newSessions = activeSessions.filter(session =>
            !liveSessions.some(existing => existing.id === session.id)
          )

          newSessions.forEach(session => {
            toast({
              title: "🔴 Organizer Started Live Session!",
              description: `"${session.title}" is now live and organizer is present! Room code: ${session.roomCode}`,
              duration: 10000,
            })
          })
        }
      }, (error) => {
        console.error("Error listening to live sessions:", error)
      })

      return unsubscribeSessions
    }, (error) => {
      console.error("Error listening to invitations:", error)
    })

    return () => unsubscribeInvitations()
  }, [user, liveSessions.length])

  // Function to check if teacher is actively present in the session
  const checkTeacherPresence = async (sessionId: string, teacherId: string): Promise<boolean> => {
    try {
      // Check if teacher has been active in the last 2 minutes
      const teacherActivityQuery = query(
        collection(db, "liveDrawSessions", sessionId, "teacherActivity"),
        where("userId", "==", teacherId),
        where("lastActive", ">=", new Date(Date.now() - 2 * 60 * 1000)) // Last 2 minutes
      )

      const snapshot = await getDocs(teacherActivityQuery)
      return !snapshot.empty
    } catch (error) {
      console.error("Error checking teacher presence:", error)
      return false
    }
  }

  const fetchPublicDraws = async () => {
    try {
      // For students, we'll skip fetching activities since they should use Browse Picker Wheels instead
      if (user) {
        // Only try to fetch if user has appropriate permissions
        try {
          const drawsQuery = query(
            collection(db, "drawActivities"),
            where("settings.isShared", "==", true),
            orderBy("createdAt", "desc")
          )
          const drawsSnapshot = await getDocs(drawsQuery)
          const draws = drawsSnapshot.docs.map(doc => {
            const data = doc.data()
            return {
              id: doc.id,
              title: data.title,
              description: data.description,
              category: data.category,
              organizerName: data.organizerName || "Teacher",
              scheduledTime: data.scheduledTime?.toDate(),
              isLive: data.isLive || false,
              participantCount: data.participants?.length || 0,
              viewerCount: data.viewerCount || 0,
              status: data.isLive ? "live" : (data.scheduledTime && data.scheduledTime > new Date() ? "upcoming" : "completed"),
              allowReactions: data.settings?.allowReactions || false,
              shareUrl: data.shareUrl || ""
            }
          }) as PublicDraw[]

          setAvailableDraws(draws)
        } catch (permissionError: any) {
          // Handle permission errors gracefully for students
          if (permissionError.code === 'permission-denied') {
            console.log("Student doesn't have permission to view activities - this is expected")
            setAvailableDraws([])
          } else {
            console.error("Error fetching public draws:", permissionError)
          }
        }
      } else {
        setAvailableDraws([])
      }
    } catch (error) {
      console.error("Error in fetchPublicDraws:", error)
      setAvailableDraws([])
    } finally {
      setLoading(false)
    }
  }

  const checkConsentStatus = async () => {
    if (!user) return
    
    try {
      // Check if user has given consent
      // This would check the consent collection
      setHasConsent(true) // Simplified for now
    } catch (error) {
      console.error("Error checking consent:", error)
    }
  }

  // Join live session by room code
  const joinSessionByRoomCode = async () => {
    if (!roomCode.trim()) {
      toast({
        title: "Error",
        description: "Please enter a room code",
        variant: "destructive"
      })
      return
    }

    setJoiningSession(true)

    try {
      // Find active session by room code
      const sessionsQuery = query(
        collection(db, "liveDrawSessions"),
        where("roomCode", "==", roomCode.trim().toUpperCase()),
        where("isActive", "==", true)
      )

      const snapshot = await getDocs(sessionsQuery)

      if (snapshot.empty) {
        toast({
          title: "Session Not Found",
          description: "No active session found with that room code. Please check the code and try again.",
          variant: "destructive"
        })
        return
      }

      const sessionDoc = snapshot.docs[0]
      const sessionData = sessionDoc.data()
      const sessionId = sessionDoc.id

      // Generate participant details with better name detection
      const studentDisplayName = user?.displayName || user?.email?.split('@')[0] || participantName || 'Student'
      const viewerId = `viewer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

      console.log(`🚀 PARTICIPANT JOINING: ${studentDisplayName} → Session ${sessionId}`)

      // Navigate directly to live session with enhanced parameters
      const liveViewerUrl = `/live/${sessionId}?name=${encodeURIComponent(studentDisplayName)}&viewerId=${viewerId}&platform=web`
      window.open(liveViewerUrl, '_blank')

      setShowRoomCodeDialog(false)
      setRoomCode("")

      toast({
        title: "🎉 Joined Session!",
        description: `Successfully joined "${sessionData.title}" - opening in new tab`,
      })

    } catch (error) {
      console.error("Error joining session:", error)
      toast({
        title: "Error",
        description: "Failed to join session. Please try again.",
        variant: "destructive"
      })
    } finally {
      setJoiningSession(false)
    }
  }

  const handleViewDraw = (draw: PublicDraw) => {
    if (!hasConsent && user) {
      setShowConsentDialog(true)
      return
    }

    // Navigate to live viewer or results page
    if (draw.isLive) {
      const display = participantName || user?.displayName || user?.email?.split('@')[0] || 'Student'
      window.open(`/live/${draw.id}?name=${encodeURIComponent(display)}&platform=web`, '_blank')
    } else {
      setViewingDraw(draw)
    }
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

  const liveDraws = availableDraws.filter(draw => draw.status === "live")
  const upcomingDraws = availableDraws.filter(draw => draw.status === "upcoming")
  const completedDraws = availableDraws.filter(draw => draw.status === "completed")

  const quickActions = [
    {
      title: "Browse Picker Wheels",
      description: "Create and play wheels solo - no live session needed",
      icon: Target,
      action: () => setShowParticipantGallery(true),
      color: "#8e0b16",
      disabled: false // Available for everyone
    },
    {
      title: "Join Live Session",
      description: "Enter room code to join organizer's live draw",
      icon: Radio,
      action: () => setShowRoomCodeDialog(true),
      color: "#e74c3c",
      disabled: false
    },
    {
      title: "View Saved Wheels",
      description: "Access your wheel templates",
      icon: RotateCcw,
      action: () => setActiveModal("saved-wheels"),
      color: schoolColors.secondary,
      disabled: !user
    },
    {
      title: "View Spin History",
      description: "See past draw results",
      icon: BarChart3,
      action: () => setActiveModal("spin-history"),
      color: schoolColors.primary,
      disabled: !user
    },

  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4" style={{ borderColor: schoolColors.primary }}></div>
          <p style={{ color: schoolColors.primary }}>Loading available draws...</p>
        </div>
      </div>
    )
  }

  // Show Participant Picker Wheel Gallery if requested
  if (showParticipantGallery) {
    return (
      <WheelTypeProvider userRole="participant">
        <ParticipantPickerWheelGallery
          user={user}
          onBack={() => setShowParticipantGallery(false)}
        />
      </WheelTypeProvider>
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
            <div className="text-center flex-1">
              <h1 className="text-3xl font-bold text-white mb-2">
                🎯 Welcome to Coby Picks!
              </h1>
              <p className="text-white/90 text-lg mb-4">
                {participantName ? `Hello, ${participantName}!` : "Hello, Participant!"} Watch live draws and see results
              </p>
              <div className="text-white/80 text-sm">👥 Participant Dashboard</div>
            </div>

            {/* Settings Menu */}
            {user && (
              <div className="flex items-center gap-4">
                <AnnouncementDisplay user={user} userRole="student" />
                
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
                            {user.displayName || user.email?.split('@')[0] || 'Participant'}
                          </span>
                          <span className="text-xs text-gray-500">{user.email}</span>
                        </div>
                      </div>
                      <div className="mt-2">
                        <Badge variant="default" className="bg-swu-red text-xs">
                          👥 PARTICIPANT
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
            )}
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 pb-8">

        {/* Dashboard Overview - Only show for logged-in users */}
        {user && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold mb-6" style={{ color: schoolColors.primary }}>
              📊 Dashboard Overview
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {quickActions.map((action, index) => {
                const IconComponent = action.icon
                return (
                  <Card
                    key={index}
                    className={`hover:shadow-lg transition-all duration-200 border-2 hover:border-opacity-50 ${
                      action.disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                    }`}
                    style={{ borderColor: action.color }}
                    onClick={action.disabled ? undefined : action.action}
                  >
                    <CardContent className="p-6 text-center">
                      <div
                        className="p-3 rounded-lg mx-auto mb-4 w-fit"
                        style={{ backgroundColor: `${action.color}15`, color: action.color }}
                      >
                        <IconComponent className="h-6 w-6" />
                      </div>
                      <h3 className="font-semibold text-lg mb-2" style={{ color: schoolColors.primary }}>
                        {action.title}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {action.description}
                      </p>
                      {action.disabled && (
                        <p className="text-xs text-red-500 mt-2">
                          Login required
                        </p>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </div>
        )}

        {/* Live Sessions Notification Section */}
        {liveSessions.length > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold mb-6" style={{ color: schoolColors.primary }}>
              🔴 Live Sessions Available
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {liveSessions.map((session) => (
                <Card key={session.id} className="border-red-200 bg-red-50">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant="destructive" className="animate-pulse">
                        🔴 LIVE
                      </Badge>
                      <span className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">
                        {session.roomCode}
                      </span>
                    </div>
                    <h3 className="font-semibold text-lg mb-2">{session.title}</h3>
                    <p className="text-sm text-gray-600 mb-3">{session.description}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">
                        👥 {session.participantCount || 0} joined
                      </span>
                      <Button
                        size="sm"
                        className="bg-red-600 hover:bg-red-700 text-white"
                        onClick={() => {
                          const studentDisplayName = user?.displayName || user?.email?.split('@')[0] || 'Student'
                          window.open(`/live/${session.id}?name=${encodeURIComponent(studentDisplayName)}&platform=web`, '_blank')
                        }}
                      >
                        Join Now
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Live Draws */}
        {liveDraws.length > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2" style={{ color: schoolColors.primary }}>
              <Radio className="h-6 w-6 text-red-500 animate-pulse" />
              🔴 Live Draws
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {liveDraws.map((draw) => {
                const IconComponent = categoryIcons[draw.category]
                const StatusIcon = statusIcons[draw.status]
                return (
                  <Card key={draw.id} className="border-2 border-red-500 bg-red-50 hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <IconComponent className="h-5 w-5" style={{ color: schoolColors.primary }} />
                          <Badge className="bg-red-500 animate-pulse">
                            <StatusIcon className="h-3 w-3 mr-1" />
                            LIVE
                          </Badge>
                        </div>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Eye className="h-4 w-4" />
                          <span>{draw.viewerCount}</span>
                        </div>
                      </div>
                      <CardTitle className="text-lg">{draw.title}</CardTitle>
                      <CardDescription>
                        By {draw.organizerName}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <p className="text-sm text-muted-foreground">{draw.description}</p>
                        
                        <div className="flex items-center gap-4 text-sm">
                          <div className="flex items-center gap-1">
                            <Users className="h-4 w-4 text-muted-foreground" />
                            <span>{draw.participantCount} participants</span>
                          </div>
                        </div>
                        
                        <div className="flex gap-2">
                          <Button
                            onClick={() => handleViewDraw(draw)}
                            className="flex-1 text-white bg-red-500 hover:bg-red-600"
                          >
                            <Play className="h-4 w-4 mr-2" />
                            Watch Live
                          </Button>
                          <Button
                            onClick={() => window.open(`/participate/${draw.id}`, '_blank')}
                            variant="outline"
                            className="flex-1"
                            style={{ borderColor: schoolColors.primary, color: schoolColors.primary }}
                          >
                            Join & Spin
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </div>
        )}

        {/* Upcoming Draws */}
        {upcomingDraws.length > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2" style={{ color: schoolColors.primary }}>
              <Calendar className="h-6 w-6" />
              📅 Upcoming Draws
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {upcomingDraws.map((draw) => {
                const IconComponent = categoryIcons[draw.category]
                return (
                  <Card key={draw.id} className="hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <IconComponent className="h-5 w-5" style={{ color: schoolColors.primary }} />
                          <Badge className="bg-blue-500">
                            Upcoming
                          </Badge>
                        </div>
                      </div>
                      <CardTitle className="text-lg">{draw.title}</CardTitle>
                      <CardDescription>
                        By {draw.organizerName}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <p className="text-sm text-muted-foreground">{draw.description}</p>
                        
                        {draw.scheduledTime && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Clock className="h-4 w-4" />
                            <span>Scheduled: {draw.scheduledTime.toLocaleString()}</span>
                          </div>
                        )}
                        
                        <div className="flex items-center gap-4 text-sm">
                          <div className="flex items-center gap-1">
                            <Users className="h-4 w-4 text-muted-foreground" />
                            <span>{draw.participantCount} participants</span>
                          </div>
                        </div>
                        
                        <Button 
                          variant="outline"
                          className="w-full"
                          style={{ borderColor: schoolColors.primary, color: schoolColors.primary }}
                          disabled
                        >
                          <Clock className="h-4 w-4 mr-2" />
                          Waiting to Start
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </div>
        )}

        {/* Completed Draws */}
        {completedDraws.length > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2" style={{ color: schoolColors.primary }}>
              <Trophy className="h-6 w-6" />
              🏆 Recent Results
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {completedDraws.slice(0, 6).map((draw) => {
                const IconComponent = categoryIcons[draw.category]
                return (
                  <Card key={draw.id} className="hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <IconComponent className="h-5 w-5" style={{ color: schoolColors.primary }} />
                          <Badge className="bg-green-500">
                            Completed
                          </Badge>
                        </div>
                      </div>
                      <CardTitle className="text-lg">{draw.title}</CardTitle>
                      <CardDescription>
                        By {draw.organizerName}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <p className="text-sm text-muted-foreground">{draw.description}</p>
                        
                        <div className="flex items-center gap-4 text-sm">
                          <div className="flex items-center gap-1">
                            <Users className="h-4 w-4 text-muted-foreground" />
                            <span>{draw.participantCount} participants</span>
                          </div>
                        </div>
                        
                        <div className="flex gap-2">
                          <Button
                            onClick={() => handleViewDraw(draw)}
                            variant="outline"
                            className="flex-1"
                            style={{ borderColor: schoolColors.primary, color: schoolColors.primary }}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            View Results
                          </Button>
                          <Button
                            onClick={() => window.open(`/participate/${draw.id}`, '_blank')}
                            variant="outline"
                            className="flex-1"
                            style={{ borderColor: schoolColors.secondary, color: schoolColors.secondary }}
                          >
                            Participate
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </div>
        )}

        {/* No Draws Available */}
        {availableDraws.length === 0 && (
          <div className="flex items-center justify-center min-h-[400px]">
            <Card className="max-w-md mx-auto">
              <CardContent className="text-center py-12">
                <div className="text-6xl mb-6">🎯</div>
                <h3 className="text-2xl font-semibold mb-4" style={{ color: schoolColors.primary }}>
                  Create Your Own Wheels!
                </h3>
                <p className="text-muted-foreground mb-6">
                  Ready to spin some wheels? Browse our picker wheel gallery to create and play wheels solo - no live session needed!
                </p>
                <Button
                  onClick={() => setShowParticipantGallery(true)}
                  className="mb-4 text-white"
                  style={{ backgroundColor: schoolColors.primary }}
                >
                  <Target className="h-4 w-4 mr-2" />
                  Browse Picker Wheels
                </Button>
                <div className="text-sm text-muted-foreground">
                  <p>🎯 Create number, color, letter wheels</p>
                  <p>🎮 Play solo without live sessions</p>
                  <p>🏆 Get instant results</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Consent Dialog */}
      {user && showConsentDialog && (
        <ConsentManager
          user={user}
          showDialog={true}
          onConsentComplete={(consented) => {
            setHasConsent(consented)
            setShowConsentDialog(false)
            if (consented && viewingDraw) {
              handleViewDraw(viewingDraw)
            }
          }}
        />
      )}

      {/* Modal Dialogs - Only available for logged-in users */}
      {user && (
        <>
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

          {/* Room Code Dialog */}
          <Dialog open={showRoomCodeDialog} onOpenChange={setShowRoomCodeDialog}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Radio className="h-5 w-5 text-red-600" />
                  Join Live Session
                </DialogTitle>
                <DialogDescription>
                  Enter the room code provided by your teacher to join a live draw session.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Room Code</label>
                  <Input
                    placeholder="Enter room code (e.g., ABC123)"
                    value={roomCode}
                    onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                    className="mt-1"
                    maxLength={6}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowRoomCodeDialog(false)
                    setRoomCode("")
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={joinSessionByRoomCode}
                  disabled={joiningSession || !roomCode.trim()}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  {joiningSession ? "Joining..." : "Join Session"}
                </Button>
              </DialogFooter>
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
                      {user.displayName || user.email?.split('@')[0] || 'Participant'}
                    </h3>
                    <Badge variant="default" className="bg-swu-red mt-2">
                      👥 Participant
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

        </>
      )}
    </div>
  )
}

// Legacy export for compatibility
export const StudentDashboard = ParticipantDashboard
