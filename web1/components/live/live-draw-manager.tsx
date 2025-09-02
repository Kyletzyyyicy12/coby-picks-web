"use client"

import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowDownUp } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { db } from "@/lib/firebase"
import CrossPlatformSessionManager from "@/lib/CrossPlatformSessionManager"
import {
   collection,
   addDoc,
   doc,
   updateDoc,
   onSnapshot,
   serverTimestamp,
   query,
   where,
   orderBy,
   limit,
   getDocs,
   getDoc,
   setDoc,
   deleteDoc
 } from "firebase/firestore"
import {
   Radio,
   Users,
   Share2,
   Eye,
   Play,
   Pause,
   RotateCcw,
   Smartphone,
   Monitor,
   QrCode,
   Copy,
   ArrowLeft,
   Settings,
   Download,
   RefreshCw,
   Shuffle,
   MessageSquare,
   Crown,
   Smartphone as MobileIcon
} from "lucide-react"
import { EnhancedWheel } from "@/components/randomizer/enhanced-wheel"
import { EnhancedTeamPicker } from "@/components/team/enhanced-team-picker"

// ⚠️ CRITICAL SEPARATION OF CONCERNS ⚠️
// LiveDrawManager is the PARENT component that provides UI structure and session management
// EnhancedWheel is responsible for ALL wheel synchronization, animations, and Firebase operations
// NEVER add wheel animation or Firebase wheel listeners in LiveDrawManager - they conflict!
import { ImagePickerWheel } from "@/components/wheels/ImagePickerWheel"
import { EnhancedWinnerPopup } from "@/components/shared/enhanced-winner-popup"
import { WheelTypeProvider, useWheelTypes } from "@/components/providers/wheel-type-provider"
import type { User as FirebaseUser } from "firebase/auth"
import type { PickerWheelType } from "@/lib/picker-wheel-types"
import { getVisiblePickerWheels } from "@/lib/picker-wheel-types"

// Picker Wheel Types Configuration
export interface PickerWheelTypeConfig {
  id: string
  title: string
  description: string
  icon: string
  category: string
  defaultItems: string[]
  color: string
  isCustomizable: boolean
  maxItems?: number
  minItems?: number
}

export const PICKER_WHEEL_TYPES: PickerWheelTypeConfig[] = [
  // Basic Picker Wheels
  {
    id: "basic-picker",
    title: "Picker Wheel",
    description: "Make random decisions from your custom options",
    icon: "🎯",
    category: "personal",
    defaultItems: ["Option 1", "Option 2", "Option 3", "Option 4", "Option 5"],
    color: "#8e0b16",
    isCustomizable: true
  },
  {
    id: "team-picker",
    title: "Team Picker Wheel",
    description: "Generate random teams from a list of names",
    icon: "👥",
    category: "entertainment",
    defaultItems: ["Team Alpha", "Team Beta", "Team Gamma", "Team Delta"],
    color: "#2563eb",
    isCustomizable: true
  },
  {
    id: "yes-no-picker",
    title: "Yes No Picker Wheel",
    description: "Quick yes or no decisions made easy",
    icon: "❓",
    category: "personal",
    defaultItems: ["Yes", "No"],
    color: "#16a34a",
    isCustomizable: false,
    maxItems: 2,
    minItems: 2
  },

  // Number & Letter Wheels
  {
    id: "number-picker",
    title: "Number Picker Wheel",
    description: "Pick random numbers for games, draws, or decisions",
    icon: "🔢",
    category: "academic",
    defaultItems: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"],
    color: "#dc2626",
    isCustomizable: true,
    maxItems: 100
  },
  {
    id: "letter-picker",
    title: "Letter Picker Wheel",
    description: "Generate random letters from the alphabet",
    icon: "🔤",
    category: "academic",
    defaultItems: ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z"],
    color: "#7c3aed",
    isCustomizable: true,
    maxItems: 26,
    minItems: 2
  },

  // Geographic Wheels
  {
    id: "country-picker",
    title: "Country Picker Wheel",
    description: "Explore the world by picking random countries",
    icon: "🌍",
    category: "research",
    defaultItems: ["United States", "Canada", "United Kingdom", "France", "Germany", "Japan", "Australia", "Brazil", "India", "China"],
    color: "#059669",
    isCustomizable: true
  },

  // Visual & Media Wheels
  {
    id: "color-picker",
    title: "Color Picker Wheel",
    description: "Choose random colors for art and design projects",
    icon: "🎨",
    category: "academic",
    defaultItems: ["Red", "Blue", "Green", "Yellow", "Purple", "Orange", "Pink", "Brown", "Black", "White"],
    color: "#ea580c",
    isCustomizable: true
  },
  {
    id: "image-picker",
    title: "Image Picker Wheel",
    description: "Select random images from your collection",
    icon: "🖼️",
    category: "entertainment",
    defaultItems: ["Image 1", "Image 2", "Image 3", "Image 4", "Image 5"],
    color: "#be185d",
    isCustomizable: true
  },

  // Time & Date Wheels
  {
    id: "date-picker",
    title: "Date Picker Wheel",
    description: "Pick random dates or days of the week",
    icon: "📅",
    category: "academic",
    defaultItems: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
    color: "#9333ea",
    isCustomizable: true
  },

  // Social Media Wheels
  {
    id: "instagram-comment-picker",
    title: "Instagram Comment Picker Wheel",
    description: "Perfect for Instagram giveaways and contests",
    icon: "📱",
    category: "personal",
    defaultItems: ["@user1", "@user2", "@user3", "@user4", "@user5"],
    color: "#e11d48",
    isCustomizable: true
  },

  // Sports Wheels
  {
    id: "mlb-picker",
    title: "MLB Picker Wheel",
    description: "Pick your favorite Major League Baseball team",
    icon: "⚾",
    category: "entertainment",
    defaultItems: [
      "New York Yankees", "Boston Red Sox", "Los Angeles Dodgers", "San Francisco Giants",
      "Chicago Cubs", "St. Louis Cardinals", "Atlanta Braves", "Philadelphia Phillies",
      "Houston Astros", "Texas Rangers", "Seattle Mariners", "Oakland Athletics"
    ],
    color: "#1e40af",
    isCustomizable: false
  },
  {
    id: "nba-picker",
    title: "NBA Picker Wheel",
    description: "Choose from National Basketball Association teams",
    icon: "🏀",
    category: "entertainment",
    defaultItems: [
      "Los Angeles Lakers", "Boston Celtics", "Golden State Warriors", "Chicago Bulls",
      "Miami Heat", "San Antonio Spurs", "Philadelphia 76ers", "New York Knicks",
      "Brooklyn Nets", "Milwaukee Bucks", "Phoenix Suns", "Dallas Mavericks"
    ],
    color: "#dc2626",
    isCustomizable: false
  },
  {
    id: "nfl-picker",
    title: "NFL Picker Wheel",
    description: "Select from National Football League teams",
    icon: "🏈",
    category: "entertainment",
    defaultItems: [
      "New England Patriots", "Dallas Cowboys", "Green Bay Packers", "Pittsburgh Steelers",
      "San Francisco 49ers", "New York Giants", "Chicago Bears", "Denver Broncos",
      "Kansas City Chiefs", "Seattle Seahawks", "Los Angeles Rams", "Buffalo Bills"
    ],
    color: "#059669",
    isCustomizable: false
  }
]

// Simplified categories per request
export const PICKER_CATEGORIES = [
  { id: "research", name: "Research", icon: "🧪" },
  { id: "academic", name: "Academic", icon: "🎓" },
  { id: "entertainment", name: "Entertainment", icon: "🎬" },
  { id: "personal", name: "Personal", icon: "🏠" }
]

// Helper functions
export const getPickerWheelById = (id: string): PickerWheelTypeConfig | undefined => {
  return PICKER_WHEEL_TYPES.find(wheel => wheel.id === id)
}

export const getPickerWheelsByCategory = (category: string): PickerWheelTypeConfig[] => {
  return PICKER_WHEEL_TYPES.filter(wheel => wheel.category === category)
}

// Helper function to get visible wheel types for live sessions
export const getVisibleLiveWheelTypes = (
  userRole: string, 
  dynamicWheelTypes?: any[], 
  adminOverrides?: Set<string>
): PickerWheelTypeConfig[] => {
  // Use dynamic wheel types if available, otherwise fall back to static
  if (dynamicWheelTypes && dynamicWheelTypes.length > 0) {
    // Convert dynamic wheel types to picker wheel type format and apply visibility filter
    const convertedWheelTypes = dynamicWheelTypes
      .filter(wt => {
        // Admin role: can see all wheels
        if (userRole === 'admin') {
          return true
        }
        
        // If wheel is not hidden for new users, show it
        if (!wt.hiddenForNewUsers) {
          return true
        }
        
        // If admin has overridden visibility for this wheel, show it
        if (adminOverrides && adminOverrides.has(wt.id || wt.value)) {
          return true
        }
        
        // Hide the wheel for new organizers and participants
        return false
      })
      .map(wt => ({
        id: wt.value || wt.id,
        title: wt.label,
        description: wt.description || `${wt.label} wheel for live sessions`,
        icon: wt.icon || "🎯",
        category: wt.category || "personal",
        defaultItems: wt.defaultItems || ["Option 1", "Option 2", "Option 3", "Option 4"],
        color: wt.color || "#8e0b16",
        isCustomizable: wt.isCustomizable !== false,
        maxItems: wt.maxItems,
        minItems: wt.minItems
      } as PickerWheelTypeConfig))
    
    // Merge with visible static wheel types to ensure all needed types are available
    const staticVisible = getVisiblePickerWheels(userRole, adminOverrides)
    const staticVisibleConverted = staticVisible.map(sw => ({
      id: sw.id,
      title: sw.title,
      description: sw.description,
      icon: sw.icon,
      category: sw.category,
      defaultItems: sw.defaultItems,
      color: sw.color,
      isCustomizable: sw.isCustomizable,
      maxItems: sw.maxItems,
      minItems: sw.minItems
    } as PickerWheelTypeConfig))
    
    // Deduplicate: dynamic wheels override static ones with same ID
    const dynamicIds = new Set(convertedWheelTypes.map(wt => wt.id))
    const uniqueStatic = staticVisibleConverted.filter(sw => !dynamicIds.has(sw.id))
    
    return [...convertedWheelTypes, ...uniqueStatic]
  }
  
  // Fallback to static wheel types with visibility filter
  return getVisiblePickerWheels(userRole, adminOverrides).map(sw => ({
    id: sw.id,
    title: sw.title,
    description: sw.description,
    icon: sw.icon,
    category: sw.category,
    defaultItems: sw.defaultItems,
    color: sw.color,
    isCustomizable: sw.isCustomizable,
    maxItems: sw.maxItems,
    minItems: sw.minItems
  } as PickerWheelTypeConfig))
}


interface LiveDrawSession {
     id: string
     title: string
     description: string
     createdBy: string
     createdAt: Date
     isActive: boolean
     isSpinning: boolean
     currentState: "waiting" | "spinning" | "ended"
     participants: Array<{
       id: string
       name: string
       email?: string
     }>
     winners: Array<{
       id: string
       name: string
       email?: string
     }>
     selectedWheelType?: {
       id: string
       title: string
       description: string
       icon: string
       color: string
       defaultItems?: string[]
       category?: string
       isCustomizable?: boolean
     } | null
     // Wheel-specific properties for proper data flow
     wheelType?: string
     wheelTitle?: string
     wheelItems?: string[]
     wheelIcon?: string
     wheelDescription?: string
     wheelCategory?: string
     // NEW: Custom title and configuration options
     customWheelTitle?: string
     customMessage?: string
     customWinnerWord?: string
     allowManualWinnerSelection?: boolean
     collaboratorWheelType?: string
     settings: {
       numberOfWinners: number
       congratsMessage: string
       allowReactions: boolean
     }
    viewerCount: number
    shareUrl: string
    roomCode?: string
    activityId?: string
    teacherPresence?: {
      userId: string
      userName: string
      isOnline: boolean
      lastSeen: Date
      temporarilyAway?: boolean
    }
    // NEW: Collaboration and notification features
    collaborators?: Array<{
      id: string
      name: string
      email?: string
      role: 'collaborator' | 'viewer'
      joinedAt: Date
      permissions: string[]
    }>
    collaboratorDetails?: Array<{
      uid: string
      email: string
      name: string
      acceptedAt: Date
      permissions: any
      status: string
      isOnline?: boolean
    }>
    notifications?: Array<{
      id: string
      type: 'join' | 'leave' | 'wheel_change' | 'custom'
      message: string
      userId: string
      userName: string
      timestamp: Date
    }>
  }

interface LiveDrawManagerProps {
    user: FirebaseUser
    activityId?: string
    participants: Array<{
      id: string
      name: string
      email?: string
    }>
    onBack?: () => void
    onAddParticipant?: (participant: { id: string; name: string; email?: string }) => void
    onRealUsersChange?: (users: any[]) => void
    autoStart?: boolean
    selectedWheelType?: PickerWheelType | null
    // NEW: Participant mode props for unified interface
    participantMode?: boolean
    participantName?: string
    isCollaborator?: boolean
    isActualOrganizer?: boolean
  }

export function LiveDrawManager({ user, activityId, participants, onBack, onAddParticipant, onRealUsersChange, autoStart = false, selectedWheelType, participantMode = false, participantName = "", isCollaborator = false, isActualOrganizer = false }: LiveDrawManagerProps) {
    // Use dynamic wheel types for visibility control
    const {
      enabledWheelTypes: dynamicWheelTypes,
      getVisibleWheelTypesByRole,
      loading: wheelTypesLoading,
      error: wheelTypesError
    } = useWheelTypes()
    
    // Determine user role for wheel type visibility
    const [userRole, setUserRole] = useState<string>("participant")
 
    // Fetch user role from Firestore
    useEffect(() => {
      const fetchUserRole = async () => {
        if (!user?.uid) return
 
        try {
          const userDoc = await getDoc(doc(db, "users", user.uid))
          if (userDoc.exists()) {
            const role = userDoc.data().role as string
            setUserRole(role || "participant")
            console.log("🔐 Fetched user role:", role)
          } else {
            console.log("⚠️ User document not found, defaulting to participant")
            setUserRole("participant")
          }
        } catch (error) {
          console.error("❌ Error fetching user role:", error)
          setUserRole("participant")
        }
      }
 
      fetchUserRole()
    }, [user?.uid])
    
    // Get visible wheel types based on user role
    const visibleWheelTypes = useMemo(() => {
      if (wheelTypesLoading) return []
      return getVisibleLiveWheelTypes(userRole, dynamicWheelTypes)
    }, [dynamicWheelTypes, userRole, wheelTypesLoading])
    
    // Cache wheel type to prevent unnecessary updates
    const [cachedWheelType, setCachedWheelType] = useState(selectedWheelType)

    // Debug logging for received props
    if (process.env.NODE_ENV === 'development') {
        console.log("🔄 LiveDrawManager received selectedWheelType:", {
            id: selectedWheelType?.id || 'none',
            title: selectedWheelType?.title,
            itemsCount: selectedWheelType?.defaultItems?.length || 0,
            items: selectedWheelType?.defaultItems || []
        })
    }
  
    // Force update cached wheel type when prop changes
    useEffect(() => {
      if (selectedWheelType) {
        console.log("🔄 Updating cached wheel type:", selectedWheelType.id)
        setCachedWheelType(selectedWheelType)
      }
    }, [selectedWheelType])
  const router = useRouter() // Initialize router for navigation
  const [session, setSession] = useState<LiveDrawSession | null>(null)
  const [isCreating, setIsCreating] = useState(false)

  // Debug logging for participant mode detection - CRITICAL FOR DEBUGGING
  useEffect(() => {
    console.log("🎯 LiveDrawManager participant mode detection:", {
      participantMode,
      participantName,
      isCollaborator,
      isActualOrganizer,
      userUid: user?.uid,
      sessionCreatedBy: session?.createdBy,
      organizerMode: session ? session.createdBy === user.uid : 'no session yet',
      shouldShowOrganizeButton: session && session.createdBy === user.uid,
      shouldShowWatchOnly: participantMode || (session && session.createdBy !== user.uid)
    })
  }, [participantMode, participantName, isCollaborator, isActualOrganizer, user?.uid, session?.id, session?.createdBy])

  // Fallback: Try to get wheel type from session data if prop is not available
  useEffect(() => {
    if (!cachedWheelType && session?.selectedWheelType) {
      console.log("🔄 Using session selectedWheelType as fallback:", session.selectedWheelType.id)
      setCachedWheelType(session.selectedWheelType as any)
    } else if (!cachedWheelType && session?.wheelType) {
      // Try to get from picker wheel types by ID
      const fallbackWheelType = PICKER_WHEEL_TYPES.find(w => w.id === session.wheelType)
      if (fallbackWheelType) {
        console.log("🔄 Using fallback wheel type from config:", fallbackWheelType.id)
        setCachedWheelType(fallbackWheelType)
      }
    }
  }, [session, cachedWheelType])
  const [viewers, setViewers] = useState<Array<{ id: string; name: string; joinedAt: Date }>>([])
  const [reactions, setReactions] = useState<Array<{ id: string; emoji: string; userId: string; timestamp: Date }>>([])
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("")
  const [isQrDialogOpen, setIsQrDialogOpen] = useState(false)
  const [isSendCodesDialogOpen, setIsSendCodesDialogOpen] = useState(false)
  const [isAddParticipantDialogOpen, setIsAddParticipantDialogOpen] = useState(false)
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([])
  const [newParticipant, setNewParticipant] = useState({ name: "", email: "" })
  const [participantActivity, setParticipantActivity] = useState<Record<string, { lastActive: Date; isOnline: boolean }>>({})
  const [realUsers, setRealUsers] = useState<any[]>([])
  const [isLoadingUsers, setIsLoadingUsers] = useState(false)
  const [liveComments, setLiveComments] = useState<Record<string, any[]>>({})
  const [kickedUsers, setKickedUsers] = useState<Set<string>>(new Set())
  const [activeUsers, setActiveUsers] = useState<any[]>([])
  const [isLoadingActiveUsers, setIsLoadingActiveUsers] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false)
  
  // NEW: Custom features state
  const [customWheelTitle, setCustomWheelTitle] = useState("")
  const [customMessage, setCustomMessage] = useState("")
  const [customWinnerWord, setCustomWinnerWord] = useState("Winner")
  const [allowManualWinnerSelection, setAllowManualWinnerSelection] = useState(false)
  const [showWinnerPopup, setShowWinnerPopup] = useState(false)
  const [selectedItems, setSelectedItems] = useState<string[]>([])
  const [isCustomSettingsOpen, setIsCustomSettingsOpen] = useState(false)
  const [collaboratorWheelType, setCollaboratorWheelType] = useState("")
  const [notifications, setNotifications] = useState<Array<{
    id: string
    type: 'join' | 'leave' | 'wheel_change' | 'custom'
    message: string
    userId: string
    userName: string
    timestamp: Date
  }>>([])

  const [sessionSettings, setSessionSettings] = useState({
    numberOfWinners: 1,
    spinDuration: 3000,
    allowReactions: true,
    autoStart: false,
    // Web-specific Image Picker Wheel features
    numberSets: [] as string[], // For number drawing functionality
    customCongratsMessage: "Congratulations, {name}! 🎉", // Customizable message
    multiWinnerAnnouncement: false // Enable multiple winner announcement
  })
  const [lastUpdateTime, setLastUpdateTime] = useState(0)
  const [updateQueue, setUpdateQueue] = useState<any[]>([])
  const unsubscribeRef = useRef<(() => void) | null>(null)

  const schoolColors = {
    primary: "#8e0b16",
    secondary: "#66181E",
    accent: "#ffffff"
  }

  // Helper functions for date formatting
  const formatDateDistance = (date: Date) => {
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffMins < 1) return 'Now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    return `${diffDays}d ago`
  }

  const formatTimeAgo = (timestamp: number) => {
    const now = Date.now()
    const diffMs = now - timestamp
    const diffMins = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))

    if (diffMins < 1) return 'Now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    return new Date(timestamp).toLocaleTimeString()
  }

  // Rate limiting for Firestore updates (max 1 update per second)
  const throttledUpdate = useCallback((updateFn: () => Promise<void>) => {
    const now = Date.now()
    const timeSinceLastUpdate = now - lastUpdateTime

    if (timeSinceLastUpdate < 1000) {
      // Queue the update for later
      setUpdateQueue(prev => [...prev, updateFn])
      return
    }

    setLastUpdateTime(now)
    updateFn().catch(error => {
      console.error("Firestore update error:", error)
    })
  }, [lastUpdateTime])

  // Process queued updates
  useEffect(() => {
    if (updateQueue.length > 0) {
      const nextUpdate = updateQueue[0]
      setUpdateQueue(prev => prev.slice(1))

      const timer = setTimeout(() => {
        throttledUpdate(nextUpdate)
      }, 1000)

      return () => clearTimeout(timer)
    }
  }, [updateQueue, throttledUpdate])

  // Helper functions for URL generation and logging
  const getShareableUrl = (path: string) => {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'
    return `${baseUrl}${path}`
  }

  const generateJoinUrl = (roomCode: string) => {
    return getShareableUrl(`/join?code=${roomCode}`)
  }

  const generateQRCodeUrl = (path: string) => {
    return `https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(getShareableUrl(path))}&color=${schoolColors.primary.replace('#', '')}&bgcolor=ffffff`
  }

  const logNetworkConfig = () => {
    console.log('🌐 Network configuration:', {
      origin: typeof window !== 'undefined' ? window.location.origin : 'SSR',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown',
      timestamp: new Date().toISOString()
    })
  }

  // Function to get time ago string
  const getTimeAgo = (date: Date) => {
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffMins < 1) return 'Active now'
    if (diffMins < 60) return `${diffMins} min ago`
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`
  }

  // Initialize participant activity when participants change
  useEffect(() => {
    setParticipantActivity(prev => {
      const newActivity: Record<string, { lastActive: Date; isOnline: boolean }> = {}
      let hasChanges = false

      participants.forEach(participant => {
        if (!prev[participant.id]) {
          // Simulate random activity for demo
          const hoursAgo = Math.floor(Math.random() * 48) // 0-48 hours ago
          const lastActive = new Date(Date.now() - hoursAgo * 60 * 60 * 1000)
          const isOnline = hoursAgo < 1 // Online if active within last hour
          newActivity[participant.id] = { lastActive, isOnline }
          hasChanges = true
        } else {
          newActivity[participant.id] = prev[participant.id]
        }
      })

      // Only return new object if there are actual changes
      return hasChanges ? newActivity : prev
    })
  }, [participants])

  // Update activity status every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setParticipantActivity(prev => {
        const updated = { ...prev }
        let hasChanges = false

        Object.keys(updated).forEach(id => {
          const timeDiff = Date.now() - updated[id].lastActive.getTime()
          const newOnlineStatus = timeDiff < 60 * 60 * 1000 // Online if active within last hour

          if (updated[id].isOnline !== newOnlineStatus) {
            updated[id].isOnline = newOnlineStatus
            hasChanges = true
          }
        })

        // Only return new object if there are actual changes
        return hasChanges ? updated : prev
      })
    }, 60000) // Update every minute

    return () => clearInterval(interval)
  }, [])

  // Auto-rejoin session when organizer returns
  useEffect(() => {
    if (session && session.teacherPresence?.temporarilyAway) {
      console.log("🔄 Organizer returned - rejoining session automatically")
      rejoinSession()
    }
  }, [session])

  // Auto-start live session if enabled
  useEffect(() => {
    if (autoStart && !session && !isCreating) {
      console.log("🚀 Auto-starting live session for activity:", activityId)

      // Small delay to ensure component is fully mounted
      const autoStartTimer = setTimeout(() => {
        if (!session && !isCreating) {
          console.log("✅ Creating live session automatically")
          createLiveSession()
        }
      }, 2000) // 2 second delay

      return () => clearTimeout(autoStartTimer)
    }
  }, [autoStart, session, isCreating, activityId])

  // Load existing session if activityId corresponds to a live session
  useEffect(() => {
    const loadExistingSession = async () => {
      if (!activityId || session || isCreating) return

      try {
        // First, try to load as a live session (direct session ID)
        const sessionDoc = await getDoc(doc(db, "liveDrawSessions", activityId))
        if (sessionDoc.exists()) {
          const sessionData = sessionDoc.data()
          const loadedSession: LiveDrawSession = {
            id: sessionDoc.id,
            title: sessionData.title,
            description: sessionData.description,
            createdBy: sessionData.createdBy,
            createdAt: sessionData.createdAt?.toDate() || new Date(),
            isActive: sessionData.isActive,
            isSpinning: sessionData.isSpinning || false,
            currentState: sessionData.currentState || "waiting",
            participants: sessionData.participants || [],
            winners: sessionData.winners || [],
            selectedWheelType: sessionData.selectedWheelType || null,
            wheelType: sessionData.wheelType,
            wheelTitle: sessionData.wheelTitle,
            wheelItems: sessionData.wheelItems,
            wheelIcon: sessionData.wheelIcon,
            wheelDescription: sessionData.wheelDescription,
            wheelCategory: sessionData.wheelCategory,
            settings: sessionData.settings || {
              numberOfWinners: 1,
              congratsMessage: "Congratulations, {name}! 🎉",
              allowReactions: true
            },
            viewerCount: sessionData.viewerCount || 0,
            shareUrl: sessionData.shareUrl || "",
            roomCode: sessionData.roomCode,
            activityId: sessionData.activityId,
            teacherPresence: sessionData.teacherPresence
          }
          
          console.log("✅ Loaded existing session:", loadedSession.id, loadedSession.title)
          console.log("🎯 Session selectedWheelType:", loadedSession.selectedWheelType)
          setSession(loadedSession)

          // Update cached wheel type if available
          if (loadedSession.selectedWheelType) {
            setCachedWheelType(loadedSession.selectedWheelType as any)
          }

          // Initialize custom settings from loaded session
          if (loadedSession.customWheelTitle !== undefined) setCustomWheelTitle(loadedSession.customWheelTitle)
          if (loadedSession.customMessage !== undefined) setCustomMessage(loadedSession.customMessage)
          if (loadedSession.allowManualWinnerSelection !== undefined) setAllowManualWinnerSelection(loadedSession.allowManualWinnerSelection)
          if (loadedSession.collaboratorWheelType !== undefined) setCollaboratorWheelType(loadedSession.collaboratorWheelType)

          console.log("🔄 Initialized custom settings from loaded session:", {
            customWheelTitle: loadedSession.customWheelTitle,
            customMessage: loadedSession.customMessage,
            allowManualWinnerSelection: loadedSession.allowManualWinnerSelection,
            collaboratorWheelType: loadedSession.collaboratorWheelType
          })

          // Start session listeners
          startSessionListener(sessionDoc.id)
          return
        }
        
        // If not found as session, try as activity ID
        const activityDoc = await getDoc(doc(db, "drawActivities", activityId))
        if (activityDoc.exists()) {
          const activityData = activityDoc.data()
          // Check if this activity has an associated live session
          if (activityData.liveSessionId) {
            const liveSessionDoc = await getDoc(doc(db, "liveDrawSessions", activityData.liveSessionId))
            if (liveSessionDoc.exists()) {
              const sessionData = liveSessionDoc.data()
              const loadedSession: LiveDrawSession = {
                id: liveSessionDoc.id,
                title: sessionData.title,
                description: sessionData.description,
                createdBy: sessionData.createdBy,
                createdAt: sessionData.createdAt?.toDate() || new Date(),
                isActive: sessionData.isActive,
                isSpinning: sessionData.isSpinning || false,
                currentState: sessionData.currentState || "waiting",
                participants: sessionData.participants || [],
                winners: sessionData.winners || [],
                selectedWheelType: sessionData.selectedWheelType || null,
                wheelType: sessionData.wheelType,
                wheelTitle: sessionData.wheelTitle,
                wheelItems: sessionData.wheelItems,
                wheelIcon: sessionData.wheelIcon,
                wheelDescription: sessionData.wheelDescription,
                wheelCategory: sessionData.wheelCategory,
                settings: sessionData.settings || {
                  numberOfWinners: 1,
                  congratsMessage: "Congratulations, {name}! 🎉",
                  allowReactions: true
                },
                viewerCount: sessionData.viewerCount || 0,
                shareUrl: sessionData.shareUrl || "",
                roomCode: sessionData.roomCode,
                activityId: sessionData.activityId,
                teacherPresence: sessionData.teacherPresence
              }
              
              console.log("✅ Loaded session from activity reference:", loadedSession.id)
               setSession(loadedSession)

               // Update cached wheel type if available
               if (loadedSession.selectedWheelType) {
                 setCachedWheelType(loadedSession.selectedWheelType as any)
               }

               // Initialize custom settings from loaded session
               if (loadedSession.customWheelTitle !== undefined) setCustomWheelTitle(loadedSession.customWheelTitle)
               if (loadedSession.customMessage !== undefined) setCustomMessage(loadedSession.customMessage)
               if (loadedSession.customWinnerWord !== undefined) setCustomWinnerWord(loadedSession.customWinnerWord)
               if (loadedSession.allowManualWinnerSelection !== undefined) setAllowManualWinnerSelection(loadedSession.allowManualWinnerSelection)
               if (loadedSession.collaboratorWheelType !== undefined) setCollaboratorWheelType(loadedSession.collaboratorWheelType)

               console.log("🔄 Initialized custom settings from activity reference session:", {
                 customWheelTitle: loadedSession.customWheelTitle,
                 customMessage: loadedSession.customMessage,
                 allowManualWinnerSelection: loadedSession.allowManualWinnerSelection,
                 collaboratorWheelType: loadedSession.collaboratorWheelType
               })

               // Start session listeners
               startSessionListener(liveSessionDoc.id)
              return
            }
          }
        }
        
        console.log("📝 No existing session found for activityId:", activityId)
        
        // If we have selectedWheelType and autoStart is enabled, create the session automatically
        if (autoStart && selectedWheelType && !isCreating) {
          console.log("🚀 No session found but autoStart enabled - creating session automatically")
          setTimeout(() => {
            if (!session && !isCreating) {
              createLiveSession()
            }
          }, 500)
        }
        
      } catch (error) {
        console.error("Error loading existing session:", error)
      }
    }
    
    loadExistingSession()
  }, [activityId, session, isCreating])

  // Auto-start when participants are added to an auto-start activity
  useEffect(() => {
    if (autoStart && !session && !isCreating) {
      // If we should auto-start, create session immediately
      const participantTimer = setTimeout(() => {
        if (!session && !isCreating) {
          console.log("✅ Auto-starting due to participants being available")
          createLiveSession()
        }
      }, 1000)

      return () => clearTimeout(participantTimer)
    }
  }, [autoStart, session, isCreating])

  // Collaborator status monitoring with periodic refresh
  useEffect(() => {
    if (!session?.id) return

    console.log("🔄 Starting collaborator status monitoring")

    const collaboratorMonitorInterval = setInterval(() => {
      try {
        // Refresh collaborator details from session
        const collaboratorCount = session.collaboratorDetails?.length || 0
        const viewerCount = viewers.length
        console.log(`📊 Collaborator sync: ${collaboratorCount} collaborators, ${viewerCount} viewers`, {
          collaborators: session.collaboratorDetails?.map(c => ({
            name: c.name,
            uid: c.uid,
            isOnline: c.isOnline,
            acceptedAt: c.acceptedAt
          }))
        })

        // Update participant count to include collaborators
        const totalParticipants = viewerCount + collaboratorCount
        setParticipantCount(totalParticipants)

      } catch (error) {
        console.error("❌ Error in collaborator status monitoring:", error)
      }
    }, 5000) // Refresh every 5 seconds

    // Cleanup interval on unmount or session change
    return () => {
      console.log("🛑 Stopping collaborator status monitoring")
      clearInterval(collaboratorMonitorInterval)
    }
  }, [session?.id, session?.collaboratorDetails, viewers])

  // Initialize participant count when viewers change
  const [participantCount, setParticipantCount] = useState(0)

  // Set up real-time user listening
  useEffect(() => {
    if (!user?.uid) return

    // Set up real-time listener for users collection
    const usersQuery = query(
      collection(db, "users"),
      orderBy("displayName"),
      limit(50)
    )

    const unsubscribeUsers = onSnapshot(usersQuery,
      (snapshot) => {
        const users = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          lastActive: doc.data().lastActive?.toDate() || new Date(),
          isOnline: doc.data().isOnline || false
        }))

        setRealUsers(users)

        // Update activity for real users - only set, don't merge to avoid loops
        const newActivity: Record<string, { lastActive: Date; isOnline: boolean }> = {}
        users.forEach(user => {
          newActivity[user.id] = {
            lastActive: user.lastActive,
            isOnline: user.isOnline
          }
        })
        setParticipantActivity(newActivity)
      },
      (error) => {
        console.error("Error fetching users:", error)
        // Fallback to showing added participants if Firestore fails
        setRealUsers([])
      }
    )

    return () => {
      unsubscribeUsers()
    }
  }, [user?.uid]) // Only depend on user.uid to avoid loops

  // Separate effect to notify parent about real users changes
  useEffect(() => {
    if (onRealUsersChange && realUsers.length > 0) {
      onRealUsersChange(realUsers)
    }
  }, [realUsers, onRealUsersChange]) // Keep consistent dependency array

  // Set up real-time comments listener
  useEffect(() => {
    if (!session?.id) return

    const commentsQuery = query(
      collection(db, "liveDrawSessions", session.id, "comments"),
      orderBy("timestamp", "desc"),
      limit(100)
    )

    const unsubscribeComments = onSnapshot(commentsQuery, (snapshot) => {
      const comments = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate() || new Date()
      }))

      // Group comments by user
      const commentsByUser: Record<string, any[]> = {}
      comments.forEach((comment: any) => {
        const userId = comment.userId || 'anonymous'
        if (!commentsByUser[userId]) {
          commentsByUser[userId] = []
        }
        commentsByUser[userId].push(comment)
      })

      setLiveComments(commentsByUser)
    })

    return () => unsubscribeComments()
  }, [session?.id])

  // Kick user function
  const kickUser = async (userId: string, userName: string) => {
    try {
      // Add to kicked users set
      setKickedUsers(prev => new Set([...prev, userId]))

      // Remove from session if they're in it
      if (session?.id) {
        const viewerRef = doc(db, "liveDrawSessions", session.id, "viewers", userId)
        await deleteDoc(viewerRef)
      }

      // Update user's status to kicked
      await updateDoc(doc(db, "users", userId), {
        isKicked: true,
        kickedAt: serverTimestamp(),
        kickedFrom: session?.id || activityId
      })

      toast({
        title: "User Kicked",
        description: `${userName} has been removed from the session`,
      })
    } catch (error) {
      console.error("Error kicking user:", error)
      toast({
        title: "Error",
        description: "Failed to kick user",
        variant: "destructive"
      })
    }
  }

  // Test function to add a sample comment (for testing purposes)
  const addTestComment = async (userId: string, content: string, type: 'message' | 'emoji' = 'message') => {
    if (!session?.id) return

    try {
      await addDoc(collection(db, "liveDrawSessions", session.id, "comments"), {
        userId,
        content,
        type,
        timestamp: serverTimestamp(),
        sessionId: session.id
      })
    } catch (error) {
      console.error("Error adding test comment:", error)
    }
  }

  // Generate a unique room code with guaranteed mix of letters and numbers
  const generateRoomCode = (): string => {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    const numbers = '0123456789'
    const allChars = letters + numbers

    let result = ''

    // Generate code with guaranteed mix
    for (let i = 0; i < 6; i++) {
      const char = allChars.charAt(Math.floor(Math.random() * allChars.length))
      result += char
    }

    // Ensure we have at least 2 numbers and 2 letters for better mix
    const numberCount = (result.match(/\d/g) || []).length
    const letterCount = (result.match(/[A-Z]/g) || []).length

    if (numberCount < 2 || letterCount < 2) {
      // Regenerate with better distribution
      const positions = [0, 1, 2, 3, 4, 5]
      result = ''

      // Place at least 2 numbers and 2 letters
      const numberPositions = []
      const letterPositions = []

      // Select positions for numbers
      while (numberPositions.length < 2) {
        const pos = positions.splice(Math.floor(Math.random() * positions.length), 1)[0]
        numberPositions.push(pos)
      }

      // Select positions for letters
      while (letterPositions.length < 2) {
        const pos = positions.splice(Math.floor(Math.random() * positions.length), 1)[0]
        letterPositions.push(pos)
      }

      // Fill remaining positions randomly
      for (let i = 0; i < 6; i++) {
        if (numberPositions.includes(i)) {
          result += numbers.charAt(Math.floor(Math.random() * numbers.length))
        } else if (letterPositions.includes(i)) {
          result += letters.charAt(Math.floor(Math.random() * letters.length))
        } else {
          result += allChars.charAt(Math.floor(Math.random() * allChars.length))
        }
      }
    }

    return result
  }

  // Load real-time active users from Firestore
  const loadActiveUsers = useCallback(async () => {
    setIsLoadingActiveUsers(true)
    try {
      // Get users who have been active in the last 24 hours
      const usersQuery = query(
        collection(db, "users"),
        where("isActive", "==", true),
        where("lastActiveAt", ">=", new Date(Date.now() - 24 * 60 * 60 * 1000)),
        orderBy("lastActiveAt", "desc"),
        limit(50)
      )

      const querySnapshot = await getDocs(usersQuery)
      const users = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        lastActiveAt: doc.data().lastActiveAt?.toDate() || new Date()
      }))

      setActiveUsers(users)
      if (onRealUsersChange) {
        onRealUsersChange(users)
      }
    } catch (error) {
      console.error("Error loading active users:", error)
      toast({
        title: "Error",
        description: "Failed to load active users",
        variant: "destructive"
      })
    } finally {
      setIsLoadingActiveUsers(false)
    }
  }, [onRealUsersChange])

  // Load active users on mount and refresh periodically
  useEffect(() => {
    loadActiveUsers()

    const interval = setInterval(() => {
      loadActiveUsers()
    }, 30000) // Refresh every 30 seconds

    return () => clearInterval(interval)
  }, [loadActiveUsers])

  useEffect(() => {
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current()
      }
    }
  }, [])

  const createLiveSession = async () => {
    setIsCreating(true)
    try {
      const roomCode = generateRoomCode()

      // Get current activity data for wheel type and settings
      let activityData = null
      if (activityId) {
        try {
          const activityDoc = await getDoc(doc(db, "drawActivities", activityId))
          if (activityDoc.exists()) {
            activityData = activityDoc.data()
          }
        } catch (error) {
          console.log("Could not fetch activity data:", error)
        }
      }

      // Helper function to deep clean undefined values
      const cleanData = (data: any): any => {
        if (data === null || data === undefined) {
          return null
        }

        if (typeof data === 'object' && !Array.isArray(data)) {
          const cleaned: any = {}
          for (const [key, value] of Object.entries(data)) {
            const cleanedValue = cleanData(value)
            if (cleanedValue !== null && cleanedValue !== undefined) {
              cleaned[key] = cleanedValue
            }
          }
          return Object.keys(cleaned).length > 0 ? cleaned : null
        }

        if (Array.isArray(data)) {
          const cleanedArray = data.map(cleanData).filter(item => item !== null && item !== undefined)
          return cleanedArray.length > 0 ? cleanedArray : null
        }

        return data
      }

      const sessionData = {
        title: activityData?.title || `Live Draw - ${new Date().toLocaleString()}`,
        description: activityData?.description || "Real-time randomizer session",
        createdBy: user.uid,
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true,
        isLive: true,
        isSpinning: false,
        currentState: "waiting",
        participants: participants,
        winners: [],

        // Enhanced wheel information - ensure proper saving to Firestore
        wheelType: selectedWheelType?.id || activityData?.wheelType || "basic-picker",
        wheelTitle: selectedWheelType?.title || activityData?.wheelTitle || "Live Wheel",
        wheelItems: selectedWheelType?.defaultItems || participants.map(p => p.name), // Use wheel type items or participant names
        selectedWheelType: selectedWheelType ? {
          id: selectedWheelType.id,
          title: selectedWheelType.title,
          description: selectedWheelType.description,
          icon: selectedWheelType.icon,
          color: selectedWheelType.color,
          category: selectedWheelType.category,
          defaultItems: selectedWheelType.defaultItems,
          isCustomizable: selectedWheelType.isCustomizable
        } : null,

        // Additional wheel type metadata for proper display
        wheelIcon: selectedWheelType?.icon || activityData?.wheelIcon,
        wheelDescription: selectedWheelType?.description || activityData?.wheelDescription,
        wheelCategory: selectedWheelType?.category || activityData?.wheelCategory,


        // Enhanced settings
        settings: {
          numberOfWinners: activityData?.settings?.numberOfWinners || 1,
          congratsMessage: activityData?.settings?.congratsMessage || "Congratulations, {name}! 🎉",
          allowReactions: true,
          autoStart: false,
          spinDuration: 3000,
          theme: activityData?.settings?.theme || "default"
        },

        // Real-time tracking
        viewerCount: 0,
        activeViewers: [],
        lastActivity: new Date(),

        // Connection info
        shareUrl: "",
        roomCode: roomCode,
        joinUrl: "", // Will be set after creation
        qrCodeUrl: "",

        // Activity reference
        activityId: activityId || null,

        // Teacher presence
        teacherPresence: {
          userId: user.uid,
          userName: user.displayName || user.email || "Teacher",
          isOnline: true,
          lastSeen: new Date(),
          connectionId: `teacher-${Date.now()}`
        }
      }

      // Debug logging to identify undefined values
      console.log("🔍 Raw sessionData before cleaning:", JSON.stringify(sessionData, null, 2))
      console.log("🔍 ActivityData:", JSON.stringify(activityData, null, 2))
      console.log("🔍 SelectedWheelType in sessionData:", sessionData.selectedWheelType)
      console.log("🔍 WheelItems in sessionData:", sessionData.wheelItems)
      console.log("🔍 SelectedWheelType prop passed to createLiveSession:", selectedWheelType)

      // Clean the data to remove any undefined values
      const cleanSessionData = cleanData(sessionData)
      console.log("✅ Clean sessionData:", JSON.stringify(cleanSessionData, null, 2))

      // Validate that there are no undefined values before sending to Firestore
      const validateNoUndefined = (obj: any, path: string = ''): string[] => {
        const errors: string[] = []
        if (obj === null || obj === undefined) return errors

        if (typeof obj === 'object' && !Array.isArray(obj)) {
          for (const [key, value] of Object.entries(obj)) {
            const currentPath = path ? `${path}.${key}` : key
            if (value === undefined) {
              errors.push(`Undefined value at path: ${currentPath}`)
            } else if (value === null) {
              // null is allowed, continue checking nested objects
              errors.push(...validateNoUndefined(value, currentPath))
            } else if (typeof value === 'object') {
              errors.push(...validateNoUndefined(value, currentPath))
            }
          }
        } else if (Array.isArray(obj)) {
          obj.forEach((item, index) => {
            const currentPath = `${path}[${index}]`
            if (item === undefined) {
              errors.push(`Undefined value at path: ${currentPath}`)
            } else if (item !== null && typeof item === 'object') {
              errors.push(...validateNoUndefined(item, currentPath))
            }
          })
        }
        return errors
      }

      const validationErrors = validateNoUndefined(cleanSessionData)
      if (validationErrors.length > 0) {
        console.error("❌ Validation errors found:", validationErrors)
        throw new Error(`Invalid data structure: ${validationErrors.join(', ')}`)
      }

      console.log("✅ Validation passed - no undefined values found")
      const docRef = await addDoc(collection(db, "liveDrawSessions"), cleanSessionData)
      const shareUrl = getShareableUrl(`/live/${docRef.id}`)
      const joinUrl = generateJoinUrl(roomCode)
      const qrCodeUrl = generateQRCodeUrl(`/join?code=${roomCode}`)

      // Log network configuration for debugging
      logNetworkConfig()

      // Update with generated URLs
      await updateDoc(docRef, {
        shareUrl,
        joinUrl,
        qrCodeUrl,
        updatedAt: serverTimestamp()
      })

      // Update the activity to mark it as live, or create a new activity if none exists
      if (activityId) {
        try {
          // Make sure all fields needed for Recent Draw Activities are set
          await updateDoc(doc(db, "drawActivities", activityId), {
            isLive: true,
            liveSessionId: docRef.id,
            roomCode: roomCode,
            updatedAt: serverTimestamp(),
            lastUsed: serverTimestamp(),
            participantCount: sessionData.participants?.length || 0,
            // Ensure all wheel data is saved
            wheelType: sessionData.wheelType,
            wheelTitle: sessionData.wheelTitle,
            wheelItems: sessionData.wheelItems,
            selectedWheelType: sessionData.selectedWheelType,
            status: "active"
          })
        } catch (error) {
          console.log("Could not update activity live status:", error)
        }
      } else {
        // Create a new draw activity record for Recent Draw Activities tracking
        try {
          const activityData = {
            title: sessionData.title,
            description: sessionData.description,
            category: "entertainment" as const,
            isReusable: true,
            isScheduled: false,
            createdAt: new Date(),
            timesUsed: 0,
            participantCount: sessionData.participants?.length || 0,
            settings: {
              numberOfWinners: sessionData.settings.numberOfWinners,
              hasConfetti: true,
              hasSound: true
            },
            wheelType: sessionData.wheelType,
            wheelTitle: sessionData.wheelTitle,
            wheelIcon: sessionData.wheelIcon,
            wheelDescription: sessionData.wheelDescription,
            wheelCategory: sessionData.wheelCategory,
            selectedWheelType: sessionData.selectedWheelType,
            createdBy: user.uid,
            isLive: true,
            liveSessionId: docRef.id,
            roomCode: roomCode,
            status: "active",
            updatedAt: new Date()
          }

          // Filter out any undefined values
          const cleanActivityData = cleanData(activityData)
          
          const activityDocRef = await addDoc(collection(db, "drawActivities"), cleanActivityData)
          
          console.log("✅ Created new draw activity for Recent Activities tracking:", {
            activityId: activityDocRef.id,
            title: activityData.title,
            wheelType: activityData.wheelType,
            liveSessionId: docRef.id
          })
          
          // Update the live session to reference the new activity
          await updateDoc(docRef, {
            activityId: activityDocRef.id
          })
          
        } catch (error) {
          console.log("Could not create new activity record:", error)
        }
      }

      // Start listening to session updates
      startSessionListener(docRef.id)

      // Start teacher presence tracking
      startTeacherPresenceTracking(docRef.id)

      // Start real-time viewer tracking
      startViewerTracking(docRef.id)

      toast({
        title: "🎉 Live Session Created!",
        description: `Room Code: ${roomCode} - Students can join now!`,
      })

      // Log session creation for debugging
      console.log("🚀 Live session created:", {
        sessionId: docRef.id,
        roomCode: roomCode,
        wheelType: sessionData.wheelType,
        wheelTitle: sessionData.wheelTitle,
        wheelItemsCount: sessionData.wheelItems?.length || 0,
        selectedWheelType: sessionData.selectedWheelType?.id,
        joinUrl: joinUrl,
        participants: participants.length
      })
    } catch (error) {
      console.error("Error creating live session:", error)
      toast({
        title: "Error",
        description: "Failed to create live session",
        variant: "destructive"
      })
    } finally {
      setIsCreating(false)
    }
  }

  const startSessionListener = (sessionId: string) => {
    // Listen to session updates
    const sessionUnsubscribe = onSnapshot(
      doc(db, "liveDrawSessions", sessionId),
      (doc) => {
        if (doc.exists()) {
          const data = doc.data()
          const updatedSession = {
            id: doc.id,
            ...data,
            createdAt: data.createdAt?.toDate(),
            // Ensure wheel data is properly read from Firestore
            wheelType: data.wheelType || undefined,
            wheelTitle: data.wheelTitle || undefined,
            wheelItems: data.wheelItems || [],
            selectedWheelType: data.selectedWheelType || null,
            wheelIcon: data.wheelIcon,
            wheelDescription: data.wheelDescription,
            wheelCategory: data.wheelCategory,
            // Load custom wheel settings from Firestore
            customWheelTitle: data.customWheelTitle,
            customMessage: data.customMessage,
            customWinnerWord: data.customWinnerWord,
            allowManualWinnerSelection: data.allowManualWinnerSelection,
            collaboratorWheelType: data.collaboratorWheelType,
          } as LiveDrawSession

          setSession(updatedSession)

          // Cache and log wheel type changes (only in development)
          if (data.selectedWheelType && (!session || JSON.stringify(data.selectedWheelType) !== JSON.stringify(session.selectedWheelType))) {
            if (process.env.NODE_ENV === 'development') {
              console.log("🔄 Session selectedWheelType updated in real-time:", {
                selectedWheelType: data.selectedWheelType,
                wheelType: data.wheelType,
                wheelTitle: data.wheelTitle,
                wheelItems: data.wheelItems
              })
            }
            // Cache the wheel type to prevent unnecessary re-renders
            setCachedWheelType(data.selectedWheelType as any)
          }

          // Load custom settings from session data (only when session loads initially)
          if (!session || (session && updatedSession.id !== session.id) || (data.customWheelTitle !== undefined && customWheelTitle !== data.customWheelTitle)) {
            console.log("🔄 Loading initial custom settings from session:", {
              customWheelTitle: data.customWheelTitle,
              customMessage: data.customMessage,
              customWinnerWord: data.customWinnerWord,
              allowManualWinnerSelection: data.allowManualWinnerSelection,
              collaboratorWheelType: data.collaboratorWheelType
            })

            // Set custom settings from session data
            if (data.customWheelTitle !== undefined) setCustomWheelTitle(data.customWheelTitle)
            if (data.customMessage !== undefined) setCustomMessage(data.customMessage)
            if (data.customWinnerWord !== undefined) setCustomWinnerWord(data.customWinnerWord)
            if (data.allowManualWinnerSelection !== undefined) setAllowManualWinnerSelection(data.allowManualWinnerSelection)
            if (data.collaboratorWheelType !== undefined) setCollaboratorWheelType(data.collaboratorWheelType)
          }

          // Fallback: If no selectedWheelType but we have wheelType, try to get it from config
          if (!data.selectedWheelType && data.wheelType && data.wheelType !== 'basic-picker') {
            if (process.env.NODE_ENV === 'development') {
              console.log("🔄 Attempting fallback for wheelType:", data.wheelType)
              console.log("🔍 Available visible wheel types:", visibleWheelTypes.map(w => w.id))
              console.log("🔍 Available static wheel types:", PICKER_WHEEL_TYPES.map(w => w.id))
            }
            // Try visible wheel types first, then fallback to static types
            let fallbackWheelType = visibleWheelTypes.find(w => w.id === data.wheelType)
            if (!fallbackWheelType) {
              fallbackWheelType = PICKER_WHEEL_TYPES.find(w => w.id === data.wheelType)
            }
            
            if (fallbackWheelType) {
              if (process.env.NODE_ENV === 'development') {
                console.log("✅ Found fallback wheel type:", fallbackWheelType)
              }
              setCachedWheelType(fallbackWheelType)
            } else {
              if (process.env.NODE_ENV === 'development') {
                console.log("❌ No fallback wheel type found for:", data.wheelType)
              }
            }
          }

          // Debug log wheel data loading (only in development)
          if (process.env.NODE_ENV === 'development') {
            console.log("📊 LiveDrawManager session updated with wheel data:", {
              wheelType: updatedSession.wheelType,
              wheelTitle: updatedSession.wheelTitle,
              wheelItemsCount: updatedSession.wheelItems?.length || 0,
              selectedWheelType: updatedSession.selectedWheelType?.id,
              wheelIcon: updatedSession.wheelIcon,
              wheelDescription: updatedSession.wheelDescription,
              wheelCategory: updatedSession.wheelCategory,
              selectedWheelTypeObj: updatedSession.selectedWheelType,
              fullSelectedWheelType: JSON.stringify(updatedSession.selectedWheelType, null, 2)
            })
          }
        }
      }
    )

    // Listen to viewer updates with enhanced real-time tracking
    const viewersUnsubscribe = onSnapshot(
      collection(db, "liveDrawSessions", sessionId, "viewers"),
      (snapshot) => {
        const viewerList = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          joinedAt: doc.data().joinedAt?.toDate(),
          lastSeen: doc.data().lastSeen?.toDate() || new Date()
        })) as Array<{
          id: string;
          name: string;
          joinedAt: Date;
          lastSeen: Date;
          platform?: string;
          connectionId?: string;
          isActive?: boolean;
          role?: string;
          userId?: string;
        }>

        // Check for new participants and show notifications
        const currentViewerIds = new Set(viewers?.map(v => v.id) || [])
        const newViewers = viewerList.filter(viewer => !currentViewerIds.has(viewer.id))

        // Show welcome notifications for new participants
        newViewers.forEach(viewer => {
          if (viewer.name) {
            const isCollaboratorJoining = viewer.role === 'collaborator'
            console.log(`🎉 New ${isCollaboratorJoining ? 'collaborator' : 'participant'} joined: ${viewer.name} on ${viewer.platform || 'web'}`)

            // Special notification for collaborators
            if (isCollaboratorJoining) {
              toast({
                title: "🤝 Collaborator Joined!",
                description: `${viewer.name} has joined as a collaborator`,
                duration: 5000,
              })
            } else {
              toast({
                title: "👋 New Participant Joined!",
                description: `${viewer.name} connected to your live session`,
                duration: 4000,
              })
            }
          }
        })

        // Filter active viewers (seen in last 5 minutes)
        const currentTime = new Date().getTime()
        const activeViewerList = viewerList.filter(viewer => {
          const timeDiff = currentTime - viewer.lastSeen.getTime()
          return timeDiff < 300000 // 5 minutes
        })

        setViewers(activeViewerList)

        // Update activeUsers state for the participant management UI
        const activeUsersFromViewers = activeViewerList.map(viewer => {
          const safeViewerName = viewer.name || 'Anonymous User'
          const isCollaborator = viewer.role === 'collaborator'
          return {
            id: viewer.id,
            name: safeViewerName,
            email: isCollaborator && viewer.userId ? `${viewer.userId}@collaborator.local` : `${safeViewerName.toLowerCase().replace(/\s+/g, '.')}@live.session`,
            role: isCollaborator ? 'organizer' : 'student',
            isActive: true,
            lastActiveAt: viewer.lastSeen,
            platform: viewer.platform || 'web',
            connectionId: viewer.connectionId || viewer.id,
            joinedAt: viewer.joinedAt
          }
        })

        setActiveUsers(activeUsersFromViewers)

        console.log(`👥 Live viewers updated: ${activeViewerList.length}/${viewerList.length}`, {
          total: viewerList.length,
          active: activeViewerList.length,
          viewers: activeViewerList.map(v => ({
            name: v.name,
            platform: v.platform,
            lastSeen: v.lastSeen
          }))
        })
      },
      (error) => {
        console.error("❌ Error listening to viewers:", error)
      }
    )

    // Listen to reactions
    const reactionsUnsubscribe = onSnapshot(
      collection(db, "liveDrawSessions", sessionId, "reactions"),
      (snapshot) => {
        const reactionList = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          timestamp: doc.data().timestamp?.toDate()
        })) as Array<{ id: string; emoji: string; userId: string; timestamp: Date }>
        setReactions(reactionList.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()))
      }
    )

    unsubscribeRef.current = () => {
      sessionUnsubscribe()
      viewersUnsubscribe()
      reactionsUnsubscribe()
    }
  }

  // ⚠️ CRITICAL FIX: REMOVED LiveDrawManager's startSpin function
  // 🎯 ALL wheel spinning and Firebase synchronization is now handled by EnhancedWheel component
  // 🚫 DO NOT manage spin state or Firebase operations here - they conflict with EnhancedWheel

  // DEPRECATED: startSpin conflicts with EnhancedWheel synchronization
  // Removed to prevent Firebase race conditions and state inconsistencies
  // EnhancedWheel now handles all spin initiation, animation timing, and Firebase updates

  const startSpin = async () => {
    // PASS-THROUGH: Just log - let EnhancedWheel handle the actual spin
    console.log("🎯 LiveDrawManager startSpin called (delegated to EnhancedWheel)")

    toast({
      title: "Starting Spin...",
      description: "Your enhanced wheel will now handle all synchronization",
    })
  }

  const resetSpin = async () => {
    if (!session) return

    try {
      await updateDoc(doc(db, "liveDrawSessions", session.id), {
        isSpinning: false,
        currentState: "waiting",
        winners: [],
        // Explicit reset payload so participant wheels reset immediately and match formation
        wheelState: {
          isSpinning: false,
          currentAngle: 0,
          progress: 0,
          winners: [],
          resetAt: Date.now()
        },
        updatedAt: serverTimestamp()
      })
    } catch (error) {
      console.error("Error resetting spin:", error)
    }
  }

  // Shuffle participants function
  const shuffleParticipants = async () => {
    if (!session) return

    try {
      // Shuffle the participants array
      const shuffledParticipants = [...session.participants].sort(() => Math.random() - 0.5)
      
      await updateDoc(doc(db, "liveDrawSessions", session.id), {
        participants: shuffledParticipants,
        updatedAt: serverTimestamp()
      })
      
      toast({
        title: "Participants Shuffled!",
        description: "The participant order has been randomized",
      })
    } catch (error) {
      console.error("Error shuffling participants:", error)
      toast({
        title: "Error",
        description: "Failed to shuffle participants",
        variant: "destructive"
      })
    }
  }

  // ⚠️ CRITICAL FIX: REMOVED LiveDrawManager's spin completion handler
  // 🎯 ALL wheel synchronization is now handled by EnhancedWheel component
  // 🚫 DO NOT add wheel animation or Firebase wheel listeners here - they conflict with EnhancedWheel

  // DEPRECATED: handleSpinComplete conflicts with EnhancedWheel synchronization
  // Removed to prevent Firebase race conditions and synchronization conflicts
  // EnhancedWheel now handles all winner broadcasting, notifications, and state updates

  const handleSpinComplete = async (result: any) => {
    // PASS-THROUGH: Just log and toast - EnhancedWheel now handles Firebase sync
    // Session stays active after each spin for multiple spins before manual completion
    console.log("🎯 LiveDrawManager received spin completion (EnhancedWheel handles sync):", result)

    toast({
      title: "Spin Complete!",
      description: `${result.winners?.length || 0} winner(s) selected. Session remains active for next spin.`,
    })

    // Show winner announcement popup (UI only - Firebase handled by EnhancedWheel)
    setShowWinnerPopup(true)
  }

  const toggleSession = async () => {
    if (!session) return

    try {
      const newActiveState = !session.isActive
      await updateDoc(doc(db, "liveDrawSessions", session.id), {
        isActive: newActiveState,
        updatedAt: serverTimestamp()
      })

      toast({
        title: newActiveState ? "Session Resumed" : "Session Paused",
        description: newActiveState
          ? "Students can now join and participate in real-time"
          : "Real-time functionality is paused. Students cannot join.",
      })
    } catch (error) {
      console.error("Error toggling session:", error)
      toast({
        title: "Error",
        description: "Failed to update session state",
        variant: "destructive"
      })
    }
  }

  // Handle organizer temporarily leaving (accidental exit) - keeps session alive for rejoining
  const handleTemporaryExit = async () => {
    if (!session) return

    try {
      // Mark organizer as temporarily away but keep session active
      await updateDoc(doc(db, "liveDrawSessions", session.id), {
        "teacherPresence.isOnline": false,
        "teacherPresence.lastSeen": new Date(),
        "teacherPresence.temporarilyAway": true, // New flag for temporary absence
        lastActivity: serverTimestamp(),
        // Keep isActive: true and isLive: true so session remains joinable
        sessionState: "organizer_away" // Track that organizer stepped away
      })

      // Update the activity to show it's still live but organizer is away
      if (session.activityId) {
        try {
          await updateDoc(doc(db, "drawActivities", session.activityId), {
            lastUsed: serverTimestamp(),
            updatedAt: serverTimestamp(),
            // Keep hasActiveSession: true so it stays in Recent Draw Activities
            organizerPresent: false // Track organizer presence
          })
          console.log("✅ Marked activity as organizer temporarily away:", session.activityId)
        } catch (error) {
          console.log("Could not update activity organizer presence:", error)
        }
      }

      console.log("✅ Session marked as temporarily paused - organizer can rejoin")
    } catch (error) {
      console.error("❌ Error handling temporary exit:", error)
    }
  }

  // Enhanced function to rejoin an active session
  const rejoinSession = async () => {
    if (!session) return

    try {
      // Mark organizer as back online
      await updateDoc(doc(db, "liveDrawSessions", session.id), {
        "teacherPresence.isOnline": true,
        "teacherPresence.lastSeen": new Date(),
        "teacherPresence.temporarilyAway": false,
        lastActivity: serverTimestamp(),
        sessionState: "active" // Resume active state
      })

      // Update the activity to show organizer is back
      if (session.activityId) {
        try {
          await updateDoc(doc(db, "drawActivities", session.activityId), {
            lastUsed: serverTimestamp(),
            updatedAt: serverTimestamp(),
            organizerPresent: true // Organizer is back
          })
          console.log("✅ Marked organizer as present in activity:", session.activityId)
        } catch (error) {
          console.log("Could not update organizer presence:", error)
        }
      }

      toast({
        title: "Rejoined Session",
        description: `Welcome back! Session ${session.roomCode} is active.`,
      })

      console.log("✅ Successfully rejoined session:", session.id)
    } catch (error) {
      console.error("❌ Error rejoining session:", error)
      toast({
        title: "Error",
        description: "Failed to rejoin session. Please try refreshing.",
        variant: "destructive"
      })
    }
  }

  const endSession = async () => {
    if (!session) {
      toast({
        title: "No Active Session",
        description: "No session is currently active to end.",
        variant: "destructive"
      })
      return
    }

    try {
      console.log("🔚 Starting session end process for:", session.id)
      
      // Show immediate feedback
      toast({
        title: "Ending Session...",
        description: "Cleaning up and saving session data...",
        duration: 3000
      })

      // Store session in live history before ending
      console.log("🔚 Preparing to save session history for session:", session.id)
      const sessionDuration = Math.round((new Date().getTime() - session.createdAt.getTime()) / 1000)
      const historyData = {
        sessionId: session.id,
        title: session.title || "Live Draw Session",
        description: session.description || "Real-time randomizer session",
        wheelType: session.wheelType || "basic-picker",
        wheelTitle: session.wheelTitle || session.title || "Live Wheel",
        wheelIcon: session.wheelIcon || "🎯",
        participants: session.participants || [],
        winners: session.winners || [],
        createdBy: session.createdBy || user.uid, // Make sure we have a createdBy field
        createdAt: session.createdAt,
        endedAt: new Date(),
        roomCode: session.roomCode,
        viewerCount: session.viewerCount || 0,
        totalSpins: session.winners?.length || 0,
        sessionDuration: sessionDuration,
        selectedWheelType: session.selectedWheelType,
        settings: session.settings,
        endedExplicitly: true, // Mark as explicitly ended by organizer
        category: session.selectedWheelType?.category || session.wheelCategory || "personal",
        organizerUid: user.uid,
        organizerName: user.displayName || user.email || "Organizer",
        participantCount: session.participants?.length || 0,
        hasWinners: (session.winners?.length || 0) > 0,
        timestamp: new Date() // Add timestamp field expected by spinner
      }

      console.log("📝 History data prepared:", {
        sessionId: historyData.sessionId,
        title: historyData.title,
        createdBy: historyData.createdBy,
        userUid: user.uid,
        participantCount: historyData.participantCount,
        hasWinners: historyData.hasWinners,
        category: historyData.category,
        timestamp: historyData.timestamp
      })

      // Validate that createdBy matches user.uid for proper filtering
      if (historyData.createdBy !== user.uid) {
        console.warn("⚠️ WARNING: createdBy mismatch!", {
          sessionCreatedBy: session.createdBy,
          userUid: user.uid,
          historyCreatedBy: historyData.createdBy
        })
      }

      // Save to live history collection (for "View Spin History")
      try {
        console.log("💾 Attempting to save to liveWheelHistory collection...")

        const historyRef = await addDoc(collection(db, "liveWheelHistory"), historyData)
        console.log("✅ SUCCESS: Saved to live wheel history:", {
          docId: historyRef.id,
          sessionId: session.id,
          title: historyData.title,
          createdBy: historyData.createdBy,
          participantCount: historyData.participantCount,
          hasWinners: historyData.hasWinners
        })

        // Dispatch event to trigger immediate history refresh
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('sessionEnded', {
            detail: {
              sessionId: session.id,
              historySaved: true,
              docId: historyRef.id
            }
          }))
        }

      } catch (historyError) {
        console.error("❌ FAILED to save live wheel history:", historyError)
        const error = historyError instanceof Error ? historyError : new Error(String(historyError))
        console.error("❌ Full error details:", {
          message: error.message,
          stack: error.stack,
          code: (error as any).code
        })
        toast({
          title: "Warning",
          description: `Session ended but history logging failed: ${error.message}. Data may be lost.`,
          variant: "destructive"
        })
      }
      
      // Also save to spin history for compatibility
      if (session.winners && session.winners.length > 0) {
        try {
          const spinHistoryData = {
            activityId: session.activityId || session.id,
            activityTitle: session.title || "Live Session",
            winners: (session.winners || []).map(w => w.name || w).filter(w => w),
            participantCount: session.participants?.length || 0,
            timestamp: new Date(),
            category: session.selectedWheelType?.category || session.wheelCategory || "live-session",
            numberOfWinners: session.winners?.length || 0,
            spinDuration: 3000, // Default duration
            createdBy: session.createdBy,
            createdAt: session.createdAt,
            sessionId: session.id,
            roomCode: session.roomCode,
            organizerUid: user.uid,
            organizerName: user.displayName || user.email || "Organizer"
          }
          const spinHistoryRef = await addDoc(collection(db, "spinHistory"), spinHistoryData)
          console.log("✅ Saved to spin history:", spinHistoryRef.id, {
            winners: spinHistoryData.winners?.length || 0,
            participantCount: spinHistoryData.participantCount
          })
        } catch (spinHistoryError) {
          console.error("❌ Failed to save spin history:", spinHistoryError)
          // Don't show error toast for spin history failure since live history succeeded
        }
      }

      // Use CrossPlatformSessionManager to properly end the session
      try {
        await CrossPlatformSessionManager.endSession(session.id)
        console.log("✅ CrossPlatformSessionManager session ended successfully:", session.id)
      } catch (sessionEndError) {
        console.error("❌ CrossPlatformSessionManager end session failed:", sessionEndError)
        // Continue with local cleanup even if CrossPlatformSessionManager fails
        console.log("⚠️ Continuing with local session cleanup despite session manager error")
      }

      // Additional cleanup: Update session with comprehensive end data
      await updateDoc(doc(db, "liveDrawSessions", session.id), {
        isActive: false,
        isLive: false,
        currentState: "ended",
        endedAt: serverTimestamp(),
        archivedAt: serverTimestamp(),
        endedExplicitly: true, // This flag indicates organizer explicitly ended the session
        closedAt: serverTimestamp(),
        // Ensure teacher presence is marked as offline
        "teacherPresence.isOnline": false,
        "teacherPresence.lastSeen": serverTimestamp(),
        // Add session end notification for participants
        sessionEndNotification: {
          message: "This live session has been ended by the organizer",
          timestamp: serverTimestamp(),
          organizerName: user.displayName || user.email || "Organizer",
          isActive: true
        },
        // Archive metadata
        archivedBy: user.uid,
        archivedByName: user.displayName || user.email || "Organizer"
      })
      console.log("✅ Updated session document with end data")

      // Update the corresponding draw activity to mark as ended but keep it visible in Recent Draw Activities
      if (session.activityId) {
        try {
          const timesUsedFinal = (session.winners?.length || 0) > 0 ? 1 : 0
          await updateDoc(doc(db, "drawActivities", session.activityId), {
            isLive: false,
            hasActiveSession: false, // Session is no longer active
            lastUsed: serverTimestamp(),
            timesUsed: timesUsedFinal, // Mark as used if there were winners
            updatedAt: serverTimestamp(),
            endedAt: serverTimestamp(),
            // Keep in Recent Draw Activities for organizer to view session history
            // status: "completed", // Remove status field, keep activity visible
            movedToHistory: false, // Keep visible in recent activities for history tracking
            endedBy: user.uid,
            endedByName: user.displayName || user.email || "Organizer",
            endSessionSummary: {
              totalWinners: session.winners?.length || 0,
              totalParticipants: session.participants?.length || 0,
              sessionDuration: sessionDuration,
              explicitEnd: true // Mark as explicitly ended by organizer
            }
          })
          console.log("✅ Updated draw activity - ended session but kept in Recent Draw Activities:", session.activityId)
        } catch (error) {
          console.warn("⚠️ Could not update activity end status:", error)
        }
      }

      // Clean up all listeners and intervals
      if (unsubscribeRef.current) {
        unsubscribeRef.current()
        unsubscribeRef.current = null
      }

      // Clean up any presence tracking intervals
      if (typeof window !== 'undefined') {
        // Clear any intervals or timeouts that might be running
        const highestId = window.setTimeout(() => {}, 0)
        for (let i = 0; i < highestId; i++) {
          window.clearInterval(i)
          window.clearTimeout(i)
        }
      }

      // Clear local state immediately
      setSession(null)
      setViewers([])
      setReactions([])

      // Success notification
      toast({
        title: "Session Ended Successfully",
        description: "Live session has been ended and saved to history. Participants have been notified.",
        duration: 5000
      })

      // Dispatch custom event to notify other components about session end
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('sessionEnded', {
          detail: {
            sessionId: session.id,
            title: session.title,
            endedAt: new Date(),
            roomCode: session.roomCode,
            organizerUid: user.uid,
            success: true
          }
        }))
      }

      console.log("✅ Session end process completed successfully")

      // Navigate to organizer dashboard - use direct navigation
      console.log("🔄 Session ended - forcing redirect to /organizer")
      if (typeof window !== 'undefined') {
        window.location.href = '/organizer'
      } else {
        router.push('/organizer')
      }
      
    } catch (error) {
      console.error("❌ Error ending session:", error)
      
      // Show detailed error information
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred"
      
      toast({
        title: "Error Ending Session",
        description: `Failed to end session properly: ${errorMessage}. Please try again or refresh the page.`,
        variant: "destructive",
        duration: 8000
      })
      
      // Still attempt to navigate back on error - force redirect
      console.log("⚠️ Error fallback - forcing redirect to /organizer")
      if (typeof window !== 'undefined') {
        window.location.href = '/organizer'
      } else {
        router.push('/organizer')
      }
    }
  }

  // Enhanced teacher presence tracking
  const startTeacherPresenceTracking = (sessionId: string) => {
    const updatePresence = async () => {
      try {
        // Update both the subcollection and main session document
        await Promise.all([
          // Update teacher activity subcollection
          setDoc(doc(db, "liveDrawSessions", sessionId, "teacherActivity", user.uid), {
            userId: user.uid,
            userName: user.displayName || user.email || "Teacher",
            lastActive: new Date(),
            isPresent: true,
            connectionId: `teacher-${user.uid}-${Date.now()}`
          }, { merge: true }),

          // Update main session document with teacher presence
          updateDoc(doc(db, "liveDrawSessions", sessionId), {
            "teacherPresence.isOnline": true,
            "teacherPresence.lastSeen": new Date(),
            "teacherPresence.userId": user.uid,
            "teacherPresence.userName": user.displayName || user.email || "Teacher",
            lastActivity: serverTimestamp()
          })
        ])

        console.log("✅ Teacher presence updated successfully")
      } catch (error) {
        console.error("❌ Error updating teacher presence:", error)
      }
    }

    // Update presence immediately when starting
    updatePresence()

    // Update presence every 15 seconds (more frequent for better real-time experience)
    const presenceInterval = setInterval(updatePresence, 15000)

    // Update presence on user activity
    const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click']
    const handleActivity = () => {
      updatePresence()
    }

    activityEvents.forEach(event => {
      document.addEventListener(event, handleActivity, true)
    })

    // Cleanup function - handle temporary exit (don't end session)
    const cleanup = async () => {
      clearInterval(presenceInterval)
      activityEvents.forEach(event => {
        document.removeEventListener(event, handleActivity, true)
      })

      // Handle temporary exit - keep session alive for rejoining
      try {
        await handleTemporaryExit()
        console.log("✅ Session preserved for rejoining after organizer navigation")
      } catch (error) {
        console.error("❌ Error handling temporary exit:", error)
      }
    }

    // Store cleanup function for later use
    window.addEventListener('beforeunload', cleanup)
    window.addEventListener('pagehide', cleanup)

    return cleanup
  }

  // Start real-time viewer tracking
  const startViewerTracking = (sessionId: string) => {
    // Listen to viewers subcollection for real-time updates
    const viewersUnsubscribe = onSnapshot(
      collection(db, "liveDrawSessions", sessionId, "viewers"),
      (snapshot) => {
        const activeViewers = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          joinedAt: doc.data().joinedAt?.toDate() || new Date(),
          lastSeen: doc.data().lastSeen?.toDate() || new Date()
        }))

        // Filter out inactive viewers (not seen in last 5 minutes)
        const currentTime = new Date().getTime()
        const recentViewers = activeViewers.filter(viewer => {
          const timeDiff = currentTime - viewer.lastSeen.getTime()
          return timeDiff < 300000 // 5 minutes
        })

        // Update viewer count in main session document
        updateDoc(doc(db, "liveDrawSessions", sessionId), {
          viewerCount: recentViewers.length,
          activeViewers: recentViewers.map((v: any) => ({
            id: v.id,
            name: v.name || `Viewer ${v.id}`,
            joinedAt: v.joinedAt,
            platform: v.platform || 'web',
            lastSeen: v.lastSeen
          })),
          lastActivity: serverTimestamp()
        }).catch(error => {
          console.error("Error updating viewer count:", error)
        })

        // Update the activeUsers state for the UI
        setActiveUsers(recentViewers.map((v: any) => ({
          id: v.id,
          name: v.name || `Viewer ${v.id}`,
          email: `student-${v.id}@session.local`,
          role: 'student',
          isActive: true,
          lastActiveAt: v.lastSeen,
          platform: v.platform || 'web',
          connectionId: v.connectionId || v.id
        })))

        console.log(`📊 Active viewers updated: ${recentViewers.length}/${activeViewers.length}`, {
          total: activeViewers.length,
          recent: recentViewers.length,
          viewers: recentViewers.map((v: any) => ({ name: v.name || `Viewer ${v.id}`, platform: v.platform || 'web' }))
        })
      },
      (error) => {
        console.error("Error listening to viewers:", error)
      }
    )

    // Store unsubscribe function for cleanup
    const originalUnsubscribe = unsubscribeRef.current
    unsubscribeRef.current = () => {
      viewersUnsubscribe()
      if (originalUnsubscribe) originalUnsubscribe()
    }
  }

  const generateQRCode = () => {
    if (!session) return

    try {
      // Generate QR code for join URL (more user-friendly than direct session URL)
      const joinUrl = generateJoinUrl(session.roomCode!)
      const qrDataUrl = `https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(joinUrl)}&color=${schoolColors.primary.replace('#', '')}&bgcolor=ffffff`
      setQrCodeUrl(qrDataUrl)
      setIsQrDialogOpen(true)
    } catch (error) {
      console.error("Error generating QR code:", error)
      toast({
        title: "Error",
        description: "Failed to generate QR code",
        variant: "destructive"
      })
    }
  }

  const copyShareLink = async () => {
    if (!session) return

    try {
      await navigator.clipboard.writeText(session.shareUrl)
      toast({
        title: "Link Copied",
        description: "Share link copied to clipboard"
      })
    } catch (error) {
      // Fallback for browsers that don't support clipboard API
      const textArea = document.createElement('textarea')
      textArea.value = session.shareUrl
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)

      toast({
        title: "Link Copied",
        description: "Share link copied to clipboard"
      })
    }
  }

  const copyJoinLink = async () => {
    if (!session) return

    try {
      const joinLink = generateJoinUrl(session.roomCode!)
      await navigator.clipboard.writeText(joinLink)
      toast({
        title: "Join Link Copied!",
        description: "Students can use this link to join directly",
      })
    } catch (error) {
      // Fallback for browsers that don't support clipboard API
      const joinLink = generateJoinUrl(session.roomCode!)
      const textArea = document.createElement('textarea')
      textArea.value = joinLink
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)

      toast({
        title: "Join Link Copied!",
        description: "Students can use this link to join directly",
      })
    }
  }

  const handleSendCodes = () => {
    setIsSendCodesDialogOpen(true)
  }

  // Export session data
  const exportSessionData = () => {
    if (!session) return

    const exportData = {
      sessionId: session.id,
      title: session.title,
      roomCode: session.roomCode,
      participants: session.participants,
      viewers: viewers,
      winners: session.winners,
      settings: session.settings,
      createdAt: session.createdAt,
      exportedAt: new Date().toISOString()
    }

    const dataStr = JSON.stringify(exportData, null, 2)
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = `live-session-${session.roomCode}-${new Date().toISOString().split('T')[0]}.json`
    link.click()
    URL.revokeObjectURL(url)

    toast({
      title: "Session Exported",
      description: "Session data has been downloaded as JSON file"
    })
  }

  // Update session settings
  const updateSessionSettings = async (newSettings: Partial<typeof sessionSettings>) => {
    if (!session) return

    try {
      const updatedSettings = { ...sessionSettings, ...newSettings }
      setSessionSettings(updatedSettings)

      await updateDoc(doc(db, "liveDrawSessions", session.id), {
        settings: {
          ...session.settings,
          ...newSettings
        },
        updatedAt: serverTimestamp()
      })

      toast({
        title: "Settings Updated",
        description: "Session settings have been saved"
      })
    } catch (error) {
      console.error("Error updating settings:", error)
      toast({
        title: "Error",
        description: "Failed to update settings",
        variant: "destructive"
      })
    }
  }

  // Handle wheel type change from participant requests
  const handleWheelTypeChange = async (newWheelType: PickerWheelTypeConfig) => {
    if (!session) return

    try {
      // Update session with new wheel type
      await updateDoc(doc(db, "liveDrawSessions", session.id), {
        wheelType: newWheelType.id,
        wheelTitle: newWheelType.title,
        wheelItems: newWheelType.defaultItems,
        selectedWheelType: newWheelType,
        wheelIcon: newWheelType.icon,
        wheelDescription: newWheelType.description,
        wheelCategory: newWheelType.category,
        updatedAt: serverTimestamp(),
        // Reset any previous spin results
        isSpinning: false,
        currentState: "waiting",
        winners: []
      })

      // Update local cached state
      setCachedWheelType(newWheelType)

      toast({
        title: "🎯 Wheel Type Changed!",
        description: `Session updated to ${newWheelType.title}`,
      })

      console.log("✅ Wheel type changed via participant request:", {
        from: cachedWheelType?.id,
        to: newWheelType.id,
        sessionId: session.id
      })
    } catch (error) {
      console.error("Error changing wheel type:", error)
      toast({
        title: "Error",
        description: "Failed to change wheel type",
        variant: "destructive"
      })
    }
  }

  // Handle topic suggestions from participants
  const handleTopicSuggestion = async (topic: string) => {
    if (!session) return

    try {
      // Add topic suggestion to session for organizer review
      await updateDoc(doc(db, "liveDrawSessions", session.id), {
        topicSuggestions: [...((session as any).topicSuggestions || []), {
          suggestion: topic,
          timestamp: new Date(),
          status: "approved"
        }],
        updatedAt: serverTimestamp()
      })

      toast({
        title: "💡 Topic Suggestion Approved!",
        description: `"${topic}" has been noted for the session`,
      })
    } catch (error) {
      console.error("Error handling topic suggestion:", error)
      toast({
        title: "Error",
        description: "Failed to process topic suggestion",
        variant: "destructive"
      })
    }
  }

  const addParticipant = async () => {
    if (!newParticipant.name.trim()) {
      toast({
        title: "Name Required",
        description: "Please enter a participant name",
        variant: "destructive"
      })
      return
    }

    try {
      // Enforce max participants if configured
      try {
        if (activityId) {
          const activitySnap = await getDoc(doc(db, "drawActivities", activityId))
          if (activitySnap.exists()) {
            const activityData: any = activitySnap.data()
            const maxAllowed: number | undefined = activityData?.settings?.maxParticipants || activityData?.liveSession?.maxParticipants
            if (maxAllowed && participants.length >= maxAllowed) {
              toast({
                title: "Participant Limit Reached",
                description: `Maximum of ${maxAllowed} participants reached for this activity`,
                variant: "destructive"
              })
              return
            }
          }
        }
      } catch {}

      const participantData = {
        id: `participant-${Date.now()}`,
        name: newParticipant.name.trim(),
        email: newParticipant.email.trim() || undefined
      }

      // Call the callback to add participant to the parent component
      if (onAddParticipant) {
        onAddParticipant(participantData)
      }

      toast({
        title: "Participant Added!",
        description: `${newParticipant.name} has been added to the activity`,
      })

      // Reset form
      setNewParticipant({ name: "", email: "" })
      setIsAddParticipantDialogOpen(false)

    } catch (error) {
      console.error("Error adding participant:", error)
      toast({
        title: "Error",
        description: "Failed to add participant",
        variant: "destructive"
      })
    }
  }

  const sendRoomCodesToParticipants = async () => {
    if (selectedParticipants.length === 0) return

    try {
      // Create room code if session doesn't exist yet
      let roomCode = session?.roomCode
      if (!roomCode) {
        roomCode = Math.random().toString(36).substring(2, 8).toUpperCase()
      }

      // In a real implementation, you would send emails/notifications here
      // For now, we'll create invitation records in Firestore
      const invitations = selectedParticipants.map(participantId => {
        const participant = participants.find(p => p.id === participantId)
        return {
          participantId,
          participantName: participant?.name || 'Unknown',
          participantEmail: participant?.email,
          roomCode,
          activityId,
          sentAt: new Date(),
          status: 'sent'
        }
      })

      // Save invitations to Firestore (this would trigger email sending in a real app)
      for (const invitation of invitations) {
        await addDoc(collection(db, "roomCodeInvitations"), invitation)
      }

      toast({
        title: "Room Codes Sent!",
        description: `Room code ${roomCode} sent to ${selectedParticipants.length} participant(s)`,
      })

      setIsSendCodesDialogOpen(false)
      setSelectedParticipants([])
    } catch (error) {
      console.error("Error sending codes:", error)
      toast({
        title: "Error",
        description: "Failed to send room codes",
        variant: "destructive"
      })
    }
  }

  if (!session) {
    return (
      <Card className="border-2" style={{ borderColor: schoolColors.primary }}>
        <CardHeader className="bg-gradient-to-r from-[#8e0b16] to-[#66181E] text-white">
          <CardTitle className="flex flex-col sm:flex-row items-start sm:items-center gap-2 text-sm sm:text-lg">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 sm:h-6 sm:w-6" />
              <span>Live Session Setup</span>
            </div>
          </CardTitle>
          <CardDescription className="text-white/80 text-xs sm:text-sm">
            Create and manage your live wheel session
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {participants.length === 0 && (
            <div className="text-center p-6 bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-dashed border-blue-200 rounded-xl">
              <div className="w-16 h-16 mx-auto mb-4 bg-blue-100 rounded-full flex items-center justify-center">
                <Users className="h-8 w-8 text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold text-blue-900 mb-2">Ready to Start Live Session</h3>
              <p className="text-sm text-blue-700 mb-4">Create your live session and participants can join using the room code</p>
              
              {/* Manual create session button */}
              <Button 
                onClick={createLiveSession}
                disabled={isCreating}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2"
              >
                {isCreating ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Creating Session...
                  </>
                ) : (
                  <>
                    <Radio className="h-4 w-4 mr-2" />
                    Start Live Session
                  </>
                )}
              </Button>
            </div>
          )}
          
          {/* Show wheel type info if available */}
          {(selectedWheelType || cachedWheelType) && (
            <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-xl">
              <div className="flex items-center gap-3 mb-3">
                <div className="text-2xl">{(selectedWheelType || cachedWheelType)?.icon}</div>
                <div>
                  <h4 className="font-semibold text-green-900">{(selectedWheelType || cachedWheelType)?.title}</h4>
                  <p className="text-sm text-green-700">{(selectedWheelType || cachedWheelType)?.description}</p>
                </div>
              </div>
              <div className="text-xs text-green-600">
                🎯 Ready to create live session with {(selectedWheelType || cachedWheelType)?.defaultItems?.length || 0} items
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Live Wheel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card className="border-2 shadow-xl" style={{borderColor: '#8e0b16'}}>
            <CardHeader className="bg-gradient-to-r from-[#8e0b16] to-[#66181E] text-white rounded-t-lg p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-white/20 rounded-lg">
                    <div className="text-4xl">
                      {cachedWheelType ? cachedWheelType.icon
                        : session.selectedWheelType ? session.selectedWheelType.icon
                        : '🎯'}
                    </div>
                  </div>
                  <div>
                    <CardTitle className="text-2xl font-bold flex items-center gap-3">
                      <span>
                        {customWheelTitle ||
                          (cachedWheelType ? cachedWheelType.title
                          : session.selectedWheelType ? session.selectedWheelType.title
                          : session.wheelTitle || 'Live Wheel')}
                      </span>
                      {session.currentState === "spinning" && (
                        <Badge variant="secondary" className="bg-yellow-500 text-white animate-pulse px-3 py-1">
                          SPINNING
                        </Badge>
                      )}
                    </CardTitle>
                    <div className="text-white/90 mt-2 flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                      <span className="text-sm">Live session synchronized with all participants</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Select
                    value={cachedWheelType?.id || session.selectedWheelType?.id || ""}
                    onValueChange={async (wheelId) => {
                      // Look for wheel in both visible wheel types and fallback to static types
                      let selectedWheel = visibleWheelTypes.find(w => w.id === wheelId)
                      if (!selectedWheel) {
                        selectedWheel = PICKER_WHEEL_TYPES.find(w => w.id === wheelId)
                      }
                      
                      if (selectedWheel && session?.id) {
                        // Update cached wheel type for immediate UI feedback
                        setCachedWheelType(selectedWheel)
                        
                        // Update live session in real-time for participants
                        try {
                          await updateDoc(doc(db, "liveDrawSessions", session.id), {
                            selectedWheelType: {
                              id: selectedWheel.id,
                              title: selectedWheel.title,
                              description: selectedWheel.description,
                              icon: selectedWheel.icon,
                              color: selectedWheel.color,
                              category: selectedWheel.category,
                              defaultItems: selectedWheel.defaultItems,
                              isCustomizable: selectedWheel.isCustomizable
                            },
                            wheelType: selectedWheel.id,
                            wheelTitle: customWheelTitle || selectedWheel.title,
                            wheelItems: selectedWheel.defaultItems,
                            customWheelTitle: customWheelTitle,
                            customMessage: customMessage,
                            customWinnerWord: customWinnerWord,
                            allowManualWinnerSelection: allowManualWinnerSelection,
                            collaboratorWheelType: collaboratorWheelType,
                            updatedAt: serverTimestamp()
                          })
                          
                          console.log(`🔄 Wheel type changed to: ${selectedWheel.title} - participants will see this instantly`)
                          
                          toast({
                            title: "🔄 Wheel Type Updated!",
                            description: `Changed to "${selectedWheel.title}" - participants can see the new wheel`,
                          })
                        } catch (error) {
                          console.error("Error updating wheel type:", error)
                          toast({
                            title: "Update Failed",
                            description: "Could not update wheel type. Please try again.",
                            variant: "destructive"
                          })
                        }
                      }
                    }}
                  >
                    <SelectTrigger className="w-full sm:w-36 text-sm bg-white/20 border-white/30 text-white hover:bg-white/30 transition-colors">
                      <SelectValue placeholder="Change wheel type" />
                    </SelectTrigger>
                    <SelectContent>
                      {/* Show loading state for wheel types */}
                      {wheelTypesLoading ? (
                        <SelectItem value="loading" disabled>
                          Loading wheel types...
                        </SelectItem>
                      ) : (
                        /* Show visible wheel types based on user role and admin overrides */
                        visibleWheelTypes.map((wheelType) => (
                          <SelectItem key={wheelType.id} value={wheelType.id} className="text-sm">
                            {wheelType.icon} {wheelType.title}
                          </SelectItem>
                        ))
                      )}
                      
                      {/* Show error state if wheel types failed to load */}
                      {wheelTypesError && (
                        <SelectItem value="error" disabled>
                          Error loading wheel types
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  
                  {/* Custom Settings Button */}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setIsCustomSettingsOpen(true)}
                    className="bg-white/10 border-white/30 text-white hover:bg-white/20 transition-colors"
                    title="Custom Wheel Settings"
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 lg:p-8">
              {/* Web-specific Image Picker Wheel Features */}
              {cachedWheelType?.id === 'image-picker' && (
                <div className="space-y-4 mb-6 p-4 bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-purple-200 rounded-xl">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-2xl">🖼️</span>
                    <h3 className="font-semibold text-purple-900">Image Picker Wheel - Web Features</h3>
                  </div>
                  
                  {/* Number Sets Feature */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-purple-800">Number Sets (Web Only)</Label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Enter numbers (e.g., 1,2,3,4,5)"
                        value={sessionSettings.numberSets.join(',')}
                        onChange={(e) => {
                          const numbers = e.target.value.split(',').map(n => n.trim()).filter(n => n)
                          setSessionSettings(prev => ({ ...prev, numberSets: numbers }))
                        }}
                        className="flex-1"
                      />
                      <Button
                        size="sm"
                        onClick={() => {
                          // Generate random numbers 1-50
                          const randomNumbers = Array.from({length: 10}, () => Math.floor(Math.random() * 50) + 1)
                          setSessionSettings(prev => ({ ...prev, numberSets: randomNumbers.map(String) }))
                        }}
                        className="px-3"
                      >
                        Random
                      </Button>
                    </div>
                    <p className="text-xs text-purple-600">
                      Add number sets for lottery-style draws. Numbers will be displayed alongside images.
                    </p>
                  </div>
                  
                  {/* Custom Congratulations Message */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-purple-800">Custom Congratulations Message (Web Only)</Label>
                    <Input
                      placeholder="Congratulations, {name}! You won! 🎉"
                      value={sessionSettings.customCongratsMessage}
                      onChange={(e) => setSessionSettings(prev => ({ ...prev, customCongratsMessage: e.target.value }))}
                    />
                    <p className="text-xs text-purple-600">
                      Customize the winner message. Use {'{'}{"name"}{'}'}  to include the winner's name.
                    </p>
                  </div>
                  
                  {/* Multiple Winner Announcement */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="multiWinnerAnnouncement"
                        checked={sessionSettings.multiWinnerAnnouncement}
                        onChange={(e) => setSessionSettings(prev => ({ ...prev, multiWinnerAnnouncement: e.target.checked }))}
                        className="rounded"
                      />
                      <Label htmlFor="multiWinnerAnnouncement" className="text-sm font-medium text-purple-800">
                        Enable Multi-Winner Announcement (Web Only)
                      </Label>
                    </div>
                    
                    {sessionSettings.multiWinnerAnnouncement && (
                      <div className="p-3 bg-white rounded-lg border border-purple-200">
                        <Label className="text-sm font-medium text-purple-800 mb-2 block">Set Number of Winners</Label>
                        <Select
                          value={sessionSettings.numberOfWinners.toString()}
                          onValueChange={(value) => setSessionSettings(prev => ({ ...prev, numberOfWinners: parseInt(value) }))}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {[1,2,3,4,5,6,7,8,9,10].map(num => (
                              <SelectItem key={num} value={num.toString()}>{num} Winners</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        
                        <Button
                          className="mt-3 w-full bg-purple-600 hover:bg-purple-700 text-white"
                          onClick={async () => {
                            if (!session?.id) return
                            
                            // Announce all winners automatically
                            const winners = session.winners || []
                            if (winners.length > 0) {
                              const announcement = winners.length === 1 
                                ? sessionSettings.customCongratsMessage.replace('{name}', winners[0].name)
                                : `🎉 Congratulations to our ${winners.length} winners: ${winners.map(w => w.name).join(', ')}! 🎉`
                                
                              await updateDoc(doc(db, "liveDrawSessions", session.id), {
                                resultNotification: {
                                  message: announcement,
                                  winners: winners,
                                  timestamp: serverTimestamp(),
                                  isActive: true,
                                  showConfetti: true,
                                  priority: "immediate",
                                  isMultiWinnerAnnouncement: true
                                },
                                lastUpdated: serverTimestamp()
                              })
                              
                              toast({
                                title: "🎤 Winners Announced!",
                                description: `Announced ${winners.length} winners to all participants`,
                              })
                            } else {
                              toast({
                                title: "No Winners Yet",
                                description: "Spin the wheel first to select winners",
                                variant: "destructive"
                              })
                            }
                          }}
                          disabled={!session.winners || session.winners.length === 0}
                        >
                          🎤 Announce All {sessionSettings.numberOfWinners} Winners
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              <div className="flex justify-center">
                <div className="w-full max-w-none">
                  {(session.selectedWheelType?.id === 'team-picker' || session.wheelType === 'team-picker') ? (
                    <EnhancedTeamPicker
                      initialNames={session.selectedWheelType?.defaultItems || session.participants?.map(p => p.name) || []}
                      canEdit={true}
                      onTeamsGenerated={(teams) => {
                        toast({
                          title: "Teams Generated! 🎉",
                          description: `Created ${teams.length} teams from ${session.participants?.length || 0} participants`,
                        })
                        // Optionally update session with generated teams
                        if (session?.id) {
                          updateDoc(doc(db, "liveDrawSessions", session.id), {
                            winners: teams.map(team => ({
                              id: team.id,
                              name: team.name,
                              email: undefined
                            })),
                            currentState: "ended",
                            updatedAt: serverTimestamp()
                          }).catch(console.error)
                        }
                      }}
                      disabled={session.currentState === "ended"}
                      readonly={false}
                    />
                  ) : (session.selectedWheelType?.id === 'image-picker' || session.wheelType === 'image-picker') ? (
                    <ImagePickerWheel
                      allowEdit={true}
                      showWinnerModal={true}
                      maxSlices={20}
                      size={400}
                      onSpinComplete={(result) => {
                        // Handle Image Picker Wheel spin completion
                        if (session?.id) {
                          const winner = {
                            id: result.slice.id,
                            name: result.slice.text,
                            email: undefined
                          }
                          
                          updateDoc(doc(db, "liveDrawSessions", session.id), {
                            isSpinning: false,
                            currentState: "completed",
                            winners: [winner],
                            updatedAt: serverTimestamp()
                          }).then(() => {
                            toast({
                              title: "🖼️ Image Winner Selected!",
                              description: `${result.slice.text} was chosen from the Image Picker Wheel!`,
                            })
                          }).catch(console.error)
                        }
                      }}
                      initialSlices={[
                        {
                          id: "demo-1",
                          text: "Photo 1", 
                          color: "#FF6B6B"
                        },
                        {
                          id: "demo-2",
                          text: "Photo 2",
                          color: "#4ECDC4"
                        },
                        {
                          id: "demo-3",
                          text: "Photo 3",
                          color: "#45B7D1"
                        },
                        {
                          id: "demo-4",
                          text: "Photo 4",
                          color: "#96CEB4"
                        }
                      ]}
                    />
                  ) : (
                    <EnhancedWheel
                      participants={session.selectedWheelType?.defaultItems ?
                        session.selectedWheelType.defaultItems.map((item: string, index: number) => ({
                          id: `wheel-item-${index}`,
                          name: item,
                          email: undefined,
                          isSelected: true
                        })) :
                        session.participants?.map(p => ({
                          id: p.id,
                          name: p.name,
                          email: p.email,
                          isSelected: true
                        })) || []}
                      onSpinComplete={handleSpinComplete}
                      isLiveMode={true}
                      sessionId={session.id}
                      disabled={session.currentState === "ended"}
                      selectedWheelType={cachedWheelType as any}
                      wheelTitle={customWheelTitle || cachedWheelType?.title || session.selectedWheelType?.title || session.wheelTitle || session.title}
                      enableRealTimeSync={true}
                      // FIX: Override participant mode if user is actually the session creator
                      organizerMode={session.createdBy === user.uid || isActualOrganizer}
                      studentMode={participantMode && !(session.createdBy === user.uid || isActualOrganizer)}
                      onSettingsChange={(settings) => {
                        // Update congratulations message if it's an Image Picker Wheel
                        if (cachedWheelType?.id === 'image-picker' && sessionSettings.customCongratsMessage) {
                          setSessionSettings(prev => ({
                            ...prev,
                            customCongratsMessage: settings.congratsMessage || prev.customCongratsMessage
                          }))
                        }
                      }}
                    />
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4 lg:space-y-6">
          {/* Session Info */}
          <Card className="border-2 shadow-lg" style={{borderColor: '#8e0b16'}}>
            <CardHeader className="bg-gradient-to-r from-[#8e0b16] to-[#66181E] text-white rounded-t-lg p-1.5 sm:p-2">
              <CardTitle className="text-xs sm:text-sm font-bold flex items-center gap-1.5">
                <div className="p-0.5 bg-white/20 rounded flex-shrink-0">
                  <Radio className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                </div>
                <span className="truncate">Session Info</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5 sm:space-y-2 p-2 sm:p-3">
              <div className="flex justify-between items-center p-2 bg-gray-50 rounded-lg">
                <span className="font-medium text-sm" style={{color: '#8e0b16'}}>Status:</span>
                <Badge variant={
                  session.currentState === "waiting" ? "secondary" :
                  session.currentState === "spinning" ? "default" : "destructive"
                } className="px-2 py-0.5 text-xs">
                  {session.currentState.toUpperCase()}
                </Badge>
              </div>
              <div className="flex justify-between items-center p-2 bg-gray-50 rounded-lg">
                <span className="font-medium text-sm" style={{color: '#8e0b16'}}>Live Status:</span>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${session.isActive ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></div>
                  <Badge variant={session.isActive ? "default" : "secondary"} className="px-2 py-0.5 text-xs">
                    {session.isActive ? "LIVE" : "PAUSED"}
                  </Badge>
                </div>
              </div>
              {session.roomCode && (
                <div className="p-2 sm:p-3 border-2 rounded-lg" style={{borderColor: '#8e0b16', backgroundColor: 'rgba(142, 11, 22, 0.05)'}}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-medium text-xs sm:text-sm" style={{color: '#8e0b16'}}>Room Code:</span>
                  </div>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                    <span className="font-mono font-bold text-lg sm:text-xl px-2 py-1 rounded border-2 bg-white break-all" style={{borderColor: '#8e0b16', color: '#8e0b16'}}>
                      {session.roomCode}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        navigator.clipboard.writeText(session.roomCode!)
                        toast({
                          title: "Copied!",
                          description: "Room code copied to clipboard",
                        })
                      }}
                      className="h-8 w-full sm:w-8 p-1 sm:p-0 border-2 hover:bg-gray-50 text-xs"
                      style={{borderColor: '#8e0b16', color: '#8e0b16'}}
                    >
                      <Copy className="h-3 w-3 sm:mr-0 mr-1" />
                      <span className="sm:hidden">Copy</span>
                    </Button>
                  </div>
                </div>
              )}

              {/* Student Invitation Section */}
              <div className="space-y-2 sm:space-y-3 pt-2 sm:pt-3 border-t-2" style={{borderColor: '#8e0b16'}}>
                <div className="text-xs font-bold text-center flex items-center justify-center gap-1 flex-wrap" style={{color: '#8e0b16'}}>
                  <Smartphone className="h-3 w-3 flex-shrink-0" />
                  <span>📱 Invite Students</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={generateQRCode}
                    className="flex items-center justify-center gap-1 text-xs border-2 hover:bg-gray-50 transition-colors h-8"
                    style={{borderColor: '#8e0b16', color: '#8e0b16'}}
                  >
                    <QrCode className="h-3 w-3" />
                    QR Code
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={copyJoinLink}
                    className="flex items-center justify-center gap-1 text-xs border-2 hover:bg-gray-50 transition-colors h-8"
                    style={{borderColor: '#8e0b16', color: '#8e0b16'}}
                  >
                    <Share2 className="h-3 w-3" />
                    Share
                  </Button>
                </div>
                <div className="text-center">
                  <Button
                    size="sm"
                    onClick={() => setIsSendCodesDialogOpen(true)}
                    className="text-white text-xs px-3 py-1 hover:opacity-90 transition-opacity w-full"
                    style={{backgroundColor: '#8e0b16'}}
                  >
                    📧 Send Invites
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-1 sm:gap-2 pt-2 sm:pt-3 border-t border-gray-200">
                <div className="text-center p-1.5 sm:p-2 bg-gray-50 rounded-lg border">
                  <div className="text-sm sm:text-base font-bold" style={{color: '#8e0b16'}}>{session.participants?.length || 0}</div>
                  <div className="text-xs text-gray-600">Participants</div>
                </div>
                <div className="text-center p-1.5 sm:p-2 bg-gray-50 rounded-lg border">
                  <div className="text-sm sm:text-base font-bold" style={{color: '#8e0b16'}}>{viewers?.length || 0}</div>
                  <div className="text-xs text-gray-600">Viewers</div>
                </div>
                <div className="text-center p-1.5 sm:p-2 bg-gray-50 rounded-lg border">
                  <div className="text-sm sm:text-base font-bold" style={{color: '#8e0b16'}}>{session.winners?.length || 0}</div>
                  <div className="text-xs text-gray-600">Winners</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Live Participants */}
          <Card className="border-2 shadow-lg" style={{borderColor: '#8e0b16'}}>
            <CardHeader className="bg-gradient-to-r from-[#8e0b16] to-[#66181E] text-white rounded-t-lg p-2 sm:p-3">
              <CardTitle className="text-sm sm:text-base font-bold flex items-center gap-1.5">
                <div className="p-0.5 bg-white/20 rounded flex-shrink-0">
                  <Users className="h-3 w-3" />
                </div>
                <span className="truncate">
                  Live Participants ({participantCount})
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-2 sm:p-3">
              {/* Show organizers/collaborators first */}
              {session.collaboratorDetails && session.collaboratorDetails.length > 0 && (
                <div className="mb-4 space-y-2">
                  <div className="text-xs font-semibold text-white/80 flex items-center gap-2">
                    <Crown className="h-3 w-3" />
                    Organizers ({session.collaboratorDetails.length})
                  </div>
                  {session.collaboratorDetails.map((collaborator: any) => (
                    <div key={`collaborator-${collaborator.uid}`} className="flex items-center justify-between p-2 rounded-lg border-2 hover:shadow-md transition-shadow" style={{backgroundColor: 'rgba(255, 215, 0, 0.1)', borderColor: '#FFD700'}}>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                        <Crown className="h-3 w-3 text-yellow-500" />
                        <span className="font-medium text-sm text-yellow-800">{collaborator.name || collaborator.email}</span>
                        {collaborator.isOnline !== false && (
                          <Badge variant="secondary" className="px-1 py-0 text-xs bg-green-100 text-green-700">
                            Online
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-yellow-600">
                        Joined {collaborator.acceptedAt ? formatDateDistance(new Date(collaborator.acceptedAt)) : 'Recently'}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {viewers.length === 0 ? (
                <div className="text-center py-3 text-gray-500">
                  <div className="p-3 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                    <Users className="h-8 w-8 mx-auto mb-2 opacity-50" style={{color: '#8e0b16'}} />
                    <p className="text-xs font-medium mb-1" style={{color: '#8e0b16'}}>No students have joined yet</p>
                    <p className="text-xs text-gray-600">Share the room code: </p>
                    <span className="font-mono font-bold text-sm" style={{color: '#8e0b16'}}>{session.roomCode}</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-white/80 flex items-center gap-2">
                    <Users className="h-3 w-3" />
                    Students ({viewers.length})
                  </div>
                  <div className="max-h-32 overflow-y-auto">
                    {viewers.map((viewer) => {
                      const viewerData = viewer as any // Cast to any to access potential additional properties
                      return (
                        <div key={`viewer-${viewer.id}`} className="flex items-center justify-between p-2 rounded-lg border-2 hover:shadow-md transition-shadow" style={{backgroundColor: 'rgba(142, 11, 22, 0.05)', borderColor: '#8e0b16'}}>
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                            <span className="font-medium text-sm" style={{color: '#8e0b16'}}>
                              {viewer.name || 'Anonymous User'}
                              {viewerData?.platform === 'mobile' && (
                                <MobileIcon className="h-3 w-3 inline ml-1" />
                              )}
                            </span>
                            {viewerData?.role === 'collaborator' && (
                              <Badge variant="secondary" className="px-1 py-0 text-xs bg-yellow-100 text-yellow-700">
                                <Crown className="h-3 w-3 mr-1" />
                                Collaborator
                              </Badge>
                            )}
                          </div>
                          <div className="text-xs" style={{color: '#66181E'}}>
                            {viewer.joinedAt ? formatTimeAgo(new Date(viewer.joinedAt).getTime()) : 'Just joined'}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>



          {/* Live Reactions & Comments */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <span>💬</span>
                Live Feedback ({reactions.length + (Object.keys(liveComments).length)})
              </CardTitle>
              <CardDescription>
                Real-time reactions and comments from participants
              </CardDescription>
            </CardHeader>
            <CardContent>
              {reactions.length === 0 && Object.keys(liveComments).length === 0 ? (
                <div className="text-center py-4 text-muted-foreground">
                  <span className="text-2xl mb-2 block">😊</span>
                  <p className="text-sm">No reactions or comments yet</p>
                  <p className="text-xs">Participants can react and comment during the live session</p>
                </div>
              ) : (
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {/* Recent Reactions */}
                  {reactions.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                        <span>😍</span> Recent Reactions ({reactions.length})
                      </h4>
                      <div className="grid grid-cols-2 gap-2">
                        {reactions.slice(0, 10).map((reaction) => (
                          <div key={reaction.id} className="flex items-center gap-2 p-2 bg-blue-50 rounded-lg border border-blue-200">
                            <span className="text-xl">{reaction.emoji}</span>
                            <div className="flex-1 min-w-0">
                              <span className="font-medium text-blue-700 text-sm truncate block">
                                {(reaction as any).userName || 'Student'}
                              </span>
                              <div className="text-xs text-blue-600">
                                {reaction.timestamp ? reaction.timestamp.toLocaleTimeString() : 'Just now'}
                              </div>
                            </div>
                            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Live Comments */}
                  {Object.keys(liveComments).length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                        <span>💬</span> Live Comments ({Object.values(liveComments).flat().length})
                      </h4>
                      <div className="space-y-2">
                        {Object.values(liveComments).flat()
                          .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                          .slice(0, 8)
                          .map((comment: any) => (
                            <div key={comment.id} className="p-3 bg-green-50 rounded-lg border border-green-200">
                              <div className="flex items-start gap-2">
                                <div className="w-2 h-2 bg-green-500 rounded-full mt-2 animate-pulse"></div>
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="font-medium text-green-700 text-sm">
                                      {comment.userName || 'Anonymous User'}
                                    </span>
                                    <span className="text-xs text-green-600">
                                      {comment.timestamp ? new Date(comment.timestamp).toLocaleTimeString() : 'Just now'}
                                    </span>
                                  </div>
                                  <p className="text-sm text-gray-700">{comment.text}</p>
                                </div>
                              </div>
                            </div>
                          ))
                        }
                      </div>
                    </div>
                  )}

                  {/* Show more indicator */}
                  {(reactions.length > 10 || Object.values(liveComments).flat().length > 8) && (
                    <div className="text-center pt-2 border-t">
                      <p className="text-xs text-gray-500">
                        Showing recent feedback... Total: {reactions.length + Object.values(liveComments).flat().length} items
                      </p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>




      {/* End Session Button */}
      <Card>
        <CardContent className="p-6">
          <div className="flex justify-center gap-4">
            <Button
              onClick={async () => {
                try {
                  // Show immediate feedback that session is being saved
                  toast({
                    title: "💾 Saving Session...",
                    description: "Preparing live session for resume from dashboard",
                  })

                  console.log("🔄 Back to Dashboard clicked - saving session for resume")

                  if (session?.id) {
                    let finalActivityId = session.activityId

                    // If no activityId but this session doesn't have one, create a draw activity record
                    if (!finalActivityId && !session.activityId) {
                      console.log("⚠️ Session has no associated activity - creating new activity record for Recent Draw Activities")

                      try {
                        const activityData = {
                          title: session.title || `Live Session - ${new Date().toLocaleString()}`,
                          description: session.description || "Interactive randomizer session",
                          category: "entertainment" as const,
                          isReusable: false, // Single-use live sessions
                          isScheduled: false,
                          createdAt: session.createdAt || new Date(),
                          timesUsed: session.winners && session.winners.length > 0 ? 1 : 0,
                          participantCount: session.participants?.length || 0,
                          settings: session.settings || {
                            numberOfWinners: 1,
                            hasConfetti: true,
                            hasSound: true
                          },
                          // Save all wheel information
                          wheelType: session.wheelType,
                          wheelTitle: session.wheelTitle,
                          wheelItems: session.wheelItems,
                          selectedWheelType: session.selectedWheelType,
                          createdBy: user.uid,
                          // Mark as live session activity
                          isLive: true,
                          liveSessionId: session.id,
                          roomCode: session.roomCode,
                          status: "active",
                          updatedAt: new Date()
                        }

                        const activityDocRef = await addDoc(collection(db, "drawActivities"), activityData)
                        finalActivityId = activityDocRef.id
                        console.log("✅ Created new activity record:", finalActivityId)

                        // Update session to reference the newly created activity
                        await updateDoc(doc(db, "liveDrawSessions", session.id), {
                          activityId: finalActivityId,
                          updatedAt: serverTimestamp()
                        })
                        console.log("✅ Session linked to new activity record")

                      } catch (createError) {
                        console.error("❌ Failed to create activity record:", createError)
                        // Continue with session update only
                      }
                    }

                    // Mark session as temporarily away but resumable
                    await updateDoc(doc(db, "liveDrawSessions", session.id), {
                      "teacherPresence.isOnline": false,
                      "teacherPresence.lastSeen": new Date(),
                      "teacherPresence.temporarilyAway": true,
                      lastActivity: serverTimestamp(),
                      sessionState: "organizer_away_but_resumable"
                    })
                    console.log("✅ Session marked as temporarily away but resumable")

                    // Update activity to show it's resumable in Recent Draw Activities
                    if (finalActivityId) {
                      const viewerCount = viewers.length || 0
                      await updateDoc(doc(db, "drawActivities", finalActivityId), {
                        isLive: true, // Keep live status
                        hasActiveSession: true, // Mark as having active session
                        lastUsed: serverTimestamp(),
                        participantCount: session.participants?.length || 0,
                        organizerPresent: false,
                        // Ensure all wheel data is saved for resume
                        wheelType: session.wheelType,
                        wheelTitle: session.wheelTitle,
                        wheelItems: session.wheelItems,
                        selectedWheelType: session.selectedWheelType,
                        roomCode: session.roomCode,
                        // Add session data for resume functionality
                        sessionData: {
                          roomCode: session.roomCode,
                          viewerCount: viewerCount,
                          currentState: session.currentState,
                          createdAt: session.createdAt,
                          organizerAway: true,
                          sessionState: "organizer_away"
                        }
                      })
                      console.log("✅ Activity updated for Recent Draw Activities recovery")
                    }
                  }

                  // Success feedback
                  toast({
                    title: "✅ Session Saved!",
                    description: "Live session ready for resume from Recent Draw Activities",
                  })

                  console.log("🔄 Redirecting to organizer dashboard")
                  // Use direct navigation to ensure it works
                  if (typeof window !== 'undefined') {
                    window.location.href = '/organizer'
                  } else {
                    router.push('/organizer')
                  }
                } catch (error) {
                  console.error("❌ Error saving session for resume:", error)
                  toast({
                    title: "⚠️ Partial Success",
                    description: "Navigation completed, but session save may have failed",
                    variant: "destructive"
                  })
                  // Even on error, navigate to organizer dashboard
                  if (typeof window !== 'undefined') {
                    window.location.href = '/organizer'
                  } else {
                    router.push('/organizer')
                  }
                }
              }}
              variant="outline"
              size="lg"
              className="border-2 px-8 py-3"
              style={{ borderColor: schoolColors.primary, color: schoolColors.primary }}
            >
              <ArrowLeft className="h-5 w-5 mr-2" />
              Back to Dashboard
            </Button>
            <Button
              onClick={() => {
                // Add confirmation dialog for ending session
                const confirmEnd = window.confirm(
                  `Are you sure you want to end this live session?\n\n` +
                  `• All participants will be disconnected\n` +
                  `• The session will be saved to your history\n` +
                  `• Room code ${session?.roomCode} will become inactive\n\n` +
                  `This action cannot be undone.`
                )
                
                if (confirmEnd) {
                  endSession()
                }
              }}
              variant="destructive"
              size="lg"
              className="bg-red-600 hover:bg-red-700 text-white px-8 py-3 font-semibold"
            >
              <ArrowLeft className="h-5 w-5 mr-2" />
              End Session
            </Button>
          </div>
          <p className="text-center text-sm text-muted-foreground mt-3">
            {onBack ? "Return to activity or end the live session and save to history" : "This will end the live session, disconnect all participants, and save it to your history"}
          </p>
        </CardContent>
      </Card>



      {/* Enhanced Winner Popup */}
      {session?.winners && session.winners.length > 0 && (
        <EnhancedWinnerPopup
          isOpen={showWinnerPopup}
          onClose={() => setShowWinnerPopup(false)}
          winners={session.winners}
          congratsMessage={(customMessage || "🎉 Congratulations! You are the {winner}! 🎉").replace('{winner}', customWinnerWord?.toLowerCase() || 'winner')}
          showConfetti={true}
          autoClose={10}
          theme={cachedWheelType ? {
            primary: cachedWheelType.color,
            secondary: cachedWheelType.color,
            accent: '#ffffff'
          } : schoolColors}
        />
      )}

      {/* QR Code Dialog */}
      <Dialog open={isQrDialogOpen} onOpenChange={setIsQrDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle style={{ color: schoolColors.primary }}>Share QR Code</DialogTitle>
            <DialogDescription>
              Students can scan this QR code to join the live session
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center space-y-4">
            {qrCodeUrl && (
              <img src={qrCodeUrl} alt="QR Code" className="border rounded" />
            )}
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-2">Or share this link:</p>
              <Input
                value={session.shareUrl}
                readOnly
                className="text-center"
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={copyShareLink} className="bg-[#8e0b16] hover:bg-[#66181E]">
              Copy Link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Send Codes Dialog */}
      <Dialog open={isSendCodesDialogOpen} onOpenChange={setIsSendCodesDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle style={{ color: schoolColors.primary }}>
              {selectedParticipants.length === 1 ? 'Invite Participant' : 'Send Room Codes'}
            </DialogTitle>
            <DialogDescription>
              {selectedParticipants.length === 1
                ? `Send room code to ${participants.find(p => p.id === selectedParticipants[0])?.name}`
                : 'Select participants to send the room code to'
              }
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="p-4 bg-gradient-to-r from-red-50 to-pink-50 border-2 border-red-200 rounded-xl">
              <div className="text-center">
                <Label className="text-sm font-medium text-red-700">Room Code</Label>
                <div className="text-3xl font-mono font-bold text-red-700 mt-2 tracking-wider">
                  {session?.roomCode || Math.random().toString(36).substring(2, 8).toUpperCase()}
                </div>
                <p className="text-xs text-red-600 mt-2">
                  Students will use this code to join the live session
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Select Participants:</Label>
              <div className="max-h-40 overflow-y-auto space-y-2">
                {participants.map((participant) => (
                  <div key={participant.id} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id={participant.id}
                      checked={selectedParticipants.includes(participant.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedParticipants(prev => [...prev, participant.id])
                        } else {
                          setSelectedParticipants(prev => prev.filter(id => id !== participant.id))
                        }
                      }}
                      className="rounded border-gray-300"
                    />
                    <label htmlFor={participant.id} className="text-sm">
                      {participant.name}
                      {participant.email && (
                        <span className="text-muted-foreground ml-1">({participant.email})</span>
                      )}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  const allIds = participants.map(p => p.id)
                  setSelectedParticipants(
                    selectedParticipants.length === allIds.length ? [] : allIds
                  )
                }}
                size="sm"
              >
                {selectedParticipants.length === participants.length ? "Deselect All" : "Select All"}
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsSendCodesDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={sendRoomCodesToParticipants}
              disabled={selectedParticipants.length === 0}
              className="bg-[#8e0b16] hover:bg-[#66181E]"
            >
              Send Codes ({selectedParticipants.length})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Participant Dialog */}
      <Dialog open={isAddParticipantDialogOpen} onOpenChange={setIsAddParticipantDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle style={{ color: schoolColors.primary }}>
              Add Student/Organizer
            </DialogTitle>
            <DialogDescription>
              Add a new participant to your activity
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="participantName">Name *</Label>
              <Input
                id="participantName"
                placeholder="Enter student/organizer name"
                value={newParticipant.name}
                onChange={(e) => setNewParticipant(prev => ({ ...prev, name: e.target.value }))}
                onKeyPress={(e) => e.key === "Enter" && newParticipant.name.trim() && addParticipant()}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="participantEmail">Email (Optional)</Label>
              <Input
                id="participantEmail"
                type="email"
                placeholder="Enter email address"
                value={newParticipant.email}
                onChange={(e) => setNewParticipant(prev => ({ ...prev, email: e.target.value }))}
                onKeyPress={(e) => e.key === "Enter" && newParticipant.name.trim() && addParticipant()}
              />
              <p className="text-xs text-muted-foreground">
                Email is optional but helpful for sending room codes
              </p>
            </div>

            <div className="bg-blue-50 p-3 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Users className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-700">Quick Add Options</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setNewParticipant({ name: "Student " + (participants.length + 1), email: "" })}
                  className="text-xs"
                >
                  Quick Student
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setNewParticipant({ name: "Organizer " + (participants.length + 1), email: "" })}
                  className="text-xs"
                >
                  Quick Organizer
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setNewParticipant({ name: "", email: "" })
                setIsAddParticipantDialogOpen(false)
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={addParticipant}
              disabled={!newParticipant.name.trim()}
              className="bg-[#8e0b16] hover:bg-[#66181E]"
            >
              Add Participant
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Settings Dialog */}
      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle style={{ color: schoolColors.primary }}>
              Session Settings
            </DialogTitle>
            <DialogDescription>
              Configure your live session preferences
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium">Number of Winners</Label>
              <Select
                value={sessionSettings.numberOfWinners.toString()}
                onValueChange={(value) => updateSessionSettings({ numberOfWinners: parseInt(value) })}
              >
                <SelectTrigger className="w-full mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5].map(num => (
                    <SelectItem key={num} value={num.toString()}>{num}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm font-medium">Spin Duration (ms)</Label>
              <Select
                value={sessionSettings.spinDuration.toString()}
                onValueChange={(value) => updateSessionSettings({ spinDuration: parseInt(value) })}
              >
                <SelectTrigger className="w-full mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2000">2 seconds</SelectItem>
                  <SelectItem value="3000">3 seconds</SelectItem>
                  <SelectItem value="4000">4 seconds</SelectItem>
                  <SelectItem value="5000">5 seconds</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="allowReactions"
                checked={sessionSettings.allowReactions}
                onChange={(e) => updateSessionSettings({ allowReactions: e.target.checked })}
                className="rounded"
              />
              <Label htmlFor="allowReactions" className="text-sm">Allow student reactions</Label>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="autoStart"
                checked={sessionSettings.autoStart}
                onChange={(e) => updateSessionSettings({ autoStart: e.target.checked })}
                className="rounded"
              />
              <Label htmlFor="autoStart" className="text-sm">Auto-start when students join</Label>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsSettingsOpen(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Share Dialog */}
      <Dialog open={isShareDialogOpen} onOpenChange={setIsShareDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle style={{ color: schoolColors.primary }}>
              Share Live Session
            </DialogTitle>
            <DialogDescription>
              Share this session with students and participants
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium">Room Code</Label>
              <div className="flex items-center gap-2 mt-1">
                <Input
                  value={session?.roomCode || ''}
                  readOnly
                  className="font-mono text-lg font-bold text-center"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (session?.roomCode) {
                      navigator.clipboard.writeText(session.roomCode)
                      toast({
                        title: "Copied!",
                        description: "Room code copied to clipboard"
                      })
                    }
                  }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div>
              <Label className="text-sm font-medium">Share Link</Label>
              <div className="flex items-center gap-2 mt-1">
                <Input
                  value={session?.shareUrl || ''}
                  readOnly
                  className="text-sm"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={copyShareLink}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="text-center">
              <Button
                onClick={generateQRCode}
                variant="outline"
                className="w-full"
              >
                <QrCode className="h-4 w-4 mr-2" />
                Generate QR Code
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsShareDialogOpen(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Custom Settings Dialog */}
      <Dialog open={isCustomSettingsOpen} onOpenChange={setIsCustomSettingsOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle style={{ color: schoolColors.primary }} className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Custom Wheel Settings
            </DialogTitle>
            <DialogDescription>
              Customize your wheel appearance, behavior, and collaboration settings
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Custom Wheel Title Section */}
            <div className="space-y-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center gap-2">
                <span className="text-xl">🏷️</span>
                <h3 className="font-semibold text-blue-900">Custom Wheel Title</h3>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-blue-800">Custom Title for Wheel</Label>
                <Input
                  placeholder={`Default: ${cachedWheelType?.title || session.selectedWheelType?.title || 'Live Wheel'}`}
                  value={customWheelTitle}
                  onChange={(e) => {
                    setCustomWheelTitle(e.target.value)
                    // Update session immediately for real-time display
                    if (session?.id) {
                      updateDoc(doc(db, "liveDrawSessions", session.id), {
                        customWheelTitle: e.target.value,
                        wheelTitle: e.target.value || cachedWheelType?.title || session.selectedWheelType?.title,
                        updatedAt: serverTimestamp()
                      }).catch(console.error)
                    }
                  }}
                  className="bg-white"
                />
                <p className="text-xs text-blue-600">
                  Override the default wheel title. Leave empty to use the default wheel type title.
                </p>
              </div>
              
              {/* Preview */}
              <div className="p-2 bg-white rounded border border-blue-300">
                <div className="text-xs text-blue-700 mb-1">Preview:</div>
                <div className="flex items-center gap-2">
                  <span className="text-lg">{cachedWheelType?.icon || '🎯'}</span>
                  <span className="font-semibold text-sm">
                    {customWheelTitle || cachedWheelType?.title || session.selectedWheelType?.title || 'Live Wheel'}
                  </span>
                </div>
              </div>
            </div>

            {/* Custom Message Section */}
            <div className="space-y-3 p-4 bg-green-50 rounded-lg border border-green-200">
              <div className="flex items-center gap-2">
                <span className="text-xl">💬</span>
                <h3 className="font-semibold text-green-900">Custom Winner Message</h3>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-green-800">Custom Message for Winners</Label>
                <Input
                  placeholder="🎉 Congratulations {name}! You're our lucky winner! 🎊"
                  value={customMessage}
                  onChange={(e) => {
                    setCustomMessage(e.target.value)
                    // Update session settings for real-time use
                    setSessionSettings(prev => ({ ...prev, customCongratsMessage: e.target.value }))
                    if (session?.id) {
                      updateDoc(doc(db, "liveDrawSessions", session.id), {
                        customMessage: e.target.value,
                        "settings.congratsMessage": e.target.value,
                        updatedAt: serverTimestamp()
                      }).catch(console.error)
                    }
                  }}
                  className="bg-white"
                />
                <p className="text-xs text-green-600">
                  Use <code>{'{name}'}</code> to include the winner's name. This message will be shown to all participants.
                </p>
              </div>
              
              {/* Message Preview */}
              <div className="p-2 bg-white rounded border border-green-300">
                <div className="text-xs text-green-700 mb-1">Preview:</div>
                <div className="text-sm font-medium">
                  {(customMessage || "🎉 Congratulations {name}! You're our lucky {winner}! 🎊").replace('{name}', 'John Doe').replace('{winner}', customWinnerWord?.toLowerCase() || 'winner')}
                </div>
              </div>
            </div>

            {/* Custom Winner Word Section */}
            <div className="space-y-3 p-4 bg-red-50 rounded-lg border border-red-200">
              <div className="flex items-center gap-2">
                <span className="text-xl">🏆</span>
                <h3 className="font-semibold text-red-900">Custom Winner Word</h3>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-red-800">Winner Word/Service Name</Label>
                <Input
                  placeholder="Winner"
                  value={customWinnerWord}
                  onChange={(e) => {
                    setCustomWinnerWord(e.target.value)
                    // Update session immediately for real-time display
                    if (session?.id) {
                      updateDoc(doc(db, "liveDrawSessions", session.id), {
                        customWinnerWord: e.target.value,
                        updatedAt: serverTimestamp()
                      }).catch(console.error)
                    }
                  }}
                  className="bg-white"
                />
                <p className="text-xs text-red-600">
                  This word will immediately replace "winner" in all announcements and messages for your live session participants.
                </p>
              </div>

              {/* Word Preview */}
              <div className="p-2 bg-white rounded border border-red-300">
                <div className="text-xs text-red-700 mb-1">Preview Examples:</div>
                <div className="space-y-1">
                  <div className="text-sm font-medium">
                    "🎉 {customWinnerWord || 'Winner'}: John Doe!"
                  </div>
                  <div className="text-sm text-gray-600">
                    "Congratulations! You are the {customWinnerWord?.toLowerCase() || 'winner'}!"
                  </div>
                  <div className="text-sm text-gray-600">
                    "🎉 {customWinnerWord ? `${customWinnerWord}s` : 'Winners'}: John, Mary, Bob!"
                  </div>
                </div>
              </div>
            </div>

            {/* Manual Winner Selection Section */}
            <div className="space-y-3 p-4 bg-purple-50 rounded-lg border border-purple-200">
              <div className="flex items-center gap-2">
                <span className="text-xl">👆</span>
                <h3 className="font-semibold text-purple-900">Manual Winner Selection</h3>
              </div>
              
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="allowManualSelection"
                  checked={allowManualWinnerSelection}
                  onChange={async (e) => {
                    setAllowManualWinnerSelection(e.target.checked)
                    if (session?.id) {
                      await updateDoc(doc(db, "liveDrawSessions", session.id), {
                        allowManualWinnerSelection: e.target.checked,
                        updatedAt: serverTimestamp()
                      })
                      
                      toast({
                        title: e.target.checked ? "Manual Selection Enabled" : "Manual Selection Disabled",
                        description: e.target.checked 
                          ? "You can now manually select winners instead of random spin"
                          : "Winners will be selected randomly by wheel spin"
                      })
                    }
                  }}
                  className="rounded"
                />
                <Label htmlFor="allowManualSelection" className="text-sm font-medium text-purple-800">
                  Enable Manual Winner Selection
                </Label>
              </div>
              
              <p className="text-xs text-purple-600">
                When enabled, you can manually select winners instead of relying on random wheel spins.
              </p>
              
              {/* Manual Winner Selection Interface */}
              {allowManualWinnerSelection && (
                <div className="mt-4 space-y-3 p-3 bg-white rounded border border-purple-300">
                  <Label className="text-sm font-medium text-purple-800">Select Winners Manually:</Label>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {(session.selectedWheelType?.defaultItems || session.participants?.map(p => p.name) || []).map((item, index) => (
                      <div key={`manual-${item}-${index}`} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id={`manual-winner-${index}-${Date.now()}`}
                          checked={selectedItems.includes(item)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedItems(prev => [...prev, item])
                            } else {
                              setSelectedItems(prev => prev.filter(i => i !== item))
                            }
                          }}
                          className="rounded"
                        />
                        <label htmlFor={`manual-winner-${index}-${Date.now()}`} className="text-sm text-purple-700">
                          {item}
                        </label>
                      </div>
                    ))}
                  </div>
                  
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setSelectedItems([])}
                      className="text-xs"
                    >
                      Clear All
                    </Button>
                    <Button
                      size="sm"
                      onClick={async () => {
                        if (selectedItems.length === 0) {
                          toast({
                            title: "No Winners Selected",
                            description: "Please select at least one winner",
                            variant: "destructive"
                          })
                          return
                        }
                        
                        // Create winner objects
                        const winners = selectedItems.map((item, index) => {
                          if (session.selectedWheelType?.defaultItems) {
                            return {
                              id: `manual-winner-${index}-${Date.now()}`,
                              name: item,
                              email: undefined
                            }
                          } else {
                            const participant = session.participants?.find(p => p.name === item)
                            return participant || {
                              id: `manual-winner-${index}-${Date.now()}`,
                              name: item,
                              email: undefined
                            }
                          }
                        })

                        // Update session with manually selected winners
                        if (session?.id) {
                          await updateDoc(doc(db, "liveDrawSessions", session.id), {
                            winners: winners,
                            currentState: "ended",
                            isSpinning: false,
                            manuallySelected: true,
                            updatedAt: serverTimestamp(),
                            // Immediate result notification
                            resultNotification: {
                              message: winners.length === 1
                                ? (customMessage || "🎉 {winner}: {name}!").replace('{name}', winners[0].name).replace('{winner}', customWinnerWord || 'Winner')
                                : `🎉 Manually Selected ${customWinnerWord ? `${customWinnerWord}s` : 'Winners'}: ${winners.map(w => w.name).join(', ')}!`,
                              winners: winners,
                              timestamp: serverTimestamp(),
                              isActive: true,
                              showConfetti: true,
                              priority: "immediate",
                              isManualSelection: true,
                              customWinnerWord: customWinnerWord
                            }
                          })
                          
                          toast({
                            title: "👆 Winners Selected Manually!",
                            description: `Selected ${winners.length} winner(s) and notified all participants`,
                          })
                          
                          // Clear selected items
                          setSelectedItems([])
                        }
                      }}
                      className="bg-purple-600 hover:bg-purple-700 text-white text-xs flex-1"
                      disabled={selectedItems.length === 0}
                    >
                      ✅ Set as Winners ({selectedItems.length})
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Collaborator Permissions Section */}
            <div className="space-y-3 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
              <div className="flex items-center gap-2">
                <span className="text-xl">🤝</span>
                <h3 className="font-semibold text-yellow-900">Collaborator Permissions</h3>
              </div>
              
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-yellow-800">Allow Collaborators to Choose Wheel Type</Label>
                  <Select
                    value={collaboratorWheelType}
                    onValueChange={async (value) => {
                      setCollaboratorWheelType(value)
                      if (session?.id) {
                        await updateDoc(doc(db, "liveDrawSessions", session.id), {
                          collaboratorWheelType: value,
                          updatedAt: serverTimestamp()
                        })
                        
                        // Add notification for collaborators
                        const notification = {
                          id: `collab-${Date.now()}`,
                          type: 'wheel_change' as const,
                          message: value === 'suggest' 
                            ? "Collaborators can now suggest wheel types"
                            : value === 'choose'
                            ? "Collaborators can now directly choose wheel types"
                            : "Collaborator wheel selection disabled",
                          userId: user.uid,
                          userName: user.displayName || user.email || "Organizer",
                          timestamp: new Date()
                        }
                        
                        setNotifications(prev => [notification, ...prev])
                        
                        toast({
                          title: "Collaborator Permissions Updated",
                          description: notification.message
                        })
                      }
                    }}
                  >
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder="Select permission level" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">🚫 No Access - Organizer Only</SelectItem>
                      <SelectItem value="suggest">💡 Can Suggest Wheel Types</SelectItem>
                      <SelectItem value="choose">✅ Can Directly Choose Wheel Types</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-yellow-600">
                    Control what collaborators can do with wheel types during the live session.
                  </p>
                </div>
                
                {/* Show current collaborator status */}
                {collaboratorWheelType && (
                  <div className="p-2 bg-white rounded border border-yellow-300">
                    <div className="text-xs text-yellow-700 mb-1">Current Setting:</div>
                    <div className="text-sm font-medium text-yellow-800">
                      {collaboratorWheelType === 'suggest' && "🤔 Collaborators can suggest wheel types for your approval"}
                      {collaboratorWheelType === 'choose' && "🎯 Collaborators can directly change wheel types"}
                      {collaboratorWheelType === 'none' && "🔒 Only you can change wheel types"}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Notification Settings Section */}
            <div className="space-y-3 p-4 bg-indigo-50 rounded-lg border border-indigo-200">
              <div className="flex items-center gap-2">
                <span className="text-xl">🔔</span>
                <h3 className="font-semibold text-indigo-900">Collaboration Notifications</h3>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium text-indigo-800">Show Join/Leave Notifications</Label>
                  <input
                    type="checkbox"
                    checked={sessionSettings.allowReactions}
                    onChange={(e) => updateSessionSettings({ allowReactions: e.target.checked })}
                    className="rounded"
                  />
                </div>
                
                <div className="text-xs text-indigo-600">
                  Get notified when participants join or leave the session
                </div>
              </div>
              
              {/* Recent Notifications Display */}
              {notifications.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-indigo-800">Recent Notifications:</Label>
                  <div className="space-y-1 max-h-24 overflow-y-auto">
                    {notifications.slice(0, 3).map((notification) => (
                      <div key={notification.id} className="p-2 bg-white rounded border border-indigo-200 text-xs">
                        <div className="flex items-center gap-2">
                          <span>
                            {notification.type === 'join' && '👋'}
                            {notification.type === 'leave' && '👋'}
                            {notification.type === 'wheel_change' && '🎯'}
                            {notification.type === 'custom' && '💬'}
                          </span>
                          <span className="text-indigo-700">{notification.message}</span>
                        </div>
                        <div className="text-indigo-500 mt-1">
                          {notification.timestamp.toLocaleTimeString()}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Advanced Features Section */}
            <div className="space-y-3 p-4 bg-orange-50 rounded-lg border border-orange-200">
              <div className="flex items-center gap-2">
                <span className="text-xl">⚙️</span>
                <h3 className="font-semibold text-orange-900">Advanced Features</h3>
              </div>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium text-orange-800">Auto-announce Winners</Label>
                  <input
                    type="checkbox"
                    checked={sessionSettings.multiWinnerAnnouncement}
                    onChange={(e) => setSessionSettings(prev => ({ ...prev, multiWinnerAnnouncement: e.target.checked }))}
                    className="rounded"
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium text-orange-800">Allow Participant Reactions</Label>
                  <input
                    type="checkbox"
                    checked={sessionSettings.allowReactions}
                    onChange={(e) => updateSessionSettings({ allowReactions: e.target.checked })}
                    className="rounded"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-orange-800">Spin Duration</Label>
                  <Select
                    value={sessionSettings.spinDuration.toString()}
                    onValueChange={(value) => updateSessionSettings({ spinDuration: parseInt(value) })}
                  >
                    <SelectTrigger className="bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1000">1 second (Quick)</SelectItem>
                      <SelectItem value="2000">2 seconds</SelectItem>
                      <SelectItem value="3000">3 seconds (Default)</SelectItem>
                      <SelectItem value="4000">4 seconds</SelectItem>
                      <SelectItem value="5000">5 seconds (Dramatic)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                // Reset all custom settings
                 setCustomWheelTitle("")
                 setCustomMessage("")
                 setCustomWinnerWord("Winner")
                 setAllowManualWinnerSelection(false)
                 setSelectedItems([])
                 setCollaboratorWheelType("")
                
                toast({
                  title: "Settings Reset",
                  description: "All custom settings have been reset to defaults"
                })
              }}
            >
              Reset All
            </Button>
            <Button
              onClick={() => setIsCustomSettingsOpen(false)}
              className="bg-[#8e0b16] hover:bg-[#66181E] text-white"
            >
              Save & Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Wrapper component that provides wheel type context
export function LiveDrawManagerWithProvider(props: LiveDrawManagerProps) {
  // Determine user role for wheel type visibility
  const getUserRole = () => {
    // Check if user is admin (you can modify this logic based on your user role system)
    // For now, assuming organizers have organizer role
    return 'organizer'
  }
  
  const userRole = getUserRole()
  
  return (
    <WheelTypeProvider userRole={userRole}>
      <LiveDrawManager {...props} />
    </WheelTypeProvider>
  )
}

// Export both the wrapped and unwrapped versions
// Use LiveDrawManagerWithProvider when you need wheel type visibility control
// Use LiveDrawManager when the component is already wrapped with WheelTypeProvider
export { LiveDrawManager as LiveDrawManagerComponent }
export default LiveDrawManagerWithProvider
