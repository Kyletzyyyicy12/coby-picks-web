
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
   Smartphone as MobileIcon,
   Lock,
   Clock,
   Edit3,
   Upload,
   FileText,
   Trash2
} from "lucide-react"
import { EnhancedWheel } from "@/components/randomizer/enhanced-wheel"
import { EnhancedTeamPicker } from "@/components/team/enhanced-team-picker"
import { ImagePickerWheel } from "@/components/picker-wheels/image-picker-wheel"
import * as XLSX from "xlsx"

import { EnhancedWinnerPopup } from "@/components/shared/enhanced-winner-popup"
import { TextWinnerPopup } from "@/components/shared/text-winner-popup"
import { LiveRoomInvitations } from "@/components/shared/live-room-invitations"
import type { User as FirebaseUser } from "firebase/auth"
import type { PickerWheelType } from "@/lib/picker-wheel-types"

// Import Enhanced Collaborative Live Room Manager for enhanced collaboration features
import EnhancedCollaborativeLiveRoomManager from "@/lib/enhanced-collaborative-live-room-manager"

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
   hiddenForNewUsers?: boolean
 }

export const PICKER_WHEEL_TYPES: PickerWheelTypeConfig[] = [
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
    maxItems: 100,
    hiddenForNewUsers: false
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
    minItems: 2,
    hiddenForNewUsers: false
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
    isCustomizable: true,
    hiddenForNewUsers: false
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
    isCustomizable: true,
    hiddenForNewUsers: false
  },
  {
    id: "image-picker",
    title: "Image Picker Wheel",
    description: "Select random images from your collection",
    icon: "🖼️",
    category: "entertainment",
    defaultItems: ["Image 1", "Image 2", "Image 3", "Image 4", "Image 5", "Image 6"],
    color: "#be185d",
    isCustomizable: true,
    hiddenForNewUsers: false
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
    isCustomizable: true,
    hiddenForNewUsers: false
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
    isCustomizable: true,
    hiddenForNewUsers: false
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
    isCustomizable: false,
    hiddenForNewUsers: false
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
    isCustomizable: false,
    hiddenForNewUsers: false
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
    isCustomizable: false,
    hiddenForNewUsers: false
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

// 🎨 THEME COLORS HELPER: Get theme colors based on selected theme
const getThemeColors = (themeName: string) => {
  const themeMap: Record<string, { primary: string; secondary: string; accent: string; background: string }> = {
    'default': { primary: '#8e0b16', secondary: '#66181E', accent: '#ffffff', background: '#ffffff' },
    'ocean': { primary: '#0ea5e9', secondary: '#0284c7', accent: '#ffffff', background: '#ffffff' },
    'sunset': { primary: '#f97316', secondary: '#ea580c', accent: '#ffffff', background: '#ffffff' },
    'forest': { primary: '#16a34a', secondary: '#15803d', accent: '#ffffff', background: '#ffffff' },
    'royal': { primary: '#8b5cf6', secondary: '#7c3aed', accent: '#ffffff', background: '#ffffff' },
    'fire': { primary: '#dc2626', secondary: '#b91c1c', accent: '#ffffff', background: '#ffffff' },
    'ice': { primary: '#3b82f6', secondary: '#2563eb', accent: '#ffffff', background: '#ffffff' },
    'earth': { primary: '#a3a3a3', secondary: '#737373', accent: '#ffffff', background: '#ffffff' },
    'galaxy': { primary: '#6366f1', secondary: '#4f46e5', accent: '#ffffff', background: '#ffffff' },
    'sunflower': { primary: '#eab308', secondary: '#ca8a04', accent: '#ffffff', background: '#ffffff' },
    'cherry': { primary: '#ec4899', secondary: '#db2777', accent: '#ffffff', background: '#ffffff' },
    'mint': { primary: '#10b981', secondary: '#059669', accent: '#ffffff', background: '#ffffff' },
    'lavender': { primary: '#a855f7', secondary: '#9333ea', accent: '#ffffff', background: '#ffffff' },
    'coral': { primary: '#f97316', secondary: '#ea580c', accent: '#ffffff', background: '#ffffff' },
    'autumn': { primary: '#ea580c', secondary: '#dc2626', accent: '#ffffff', background: '#ffffff' },
    'midnight': { primary: '#1e293b', secondary: '#334155', accent: '#ffffff', background: '#ffffff' },
    'candy': { primary: '#ec4899', secondary: '#3b82f6', accent: '#ffffff', background: '#ffffff' },
    'vintage': { primary: '#92400e', secondary: '#78350f', accent: '#ffffff', background: '#ffffff' }
  }

  return themeMap[themeName] || themeMap['default']
}

// Helper function to get visible wheel types for live sessions
export const getVisibleLiveWheelTypes = (
  userRole: string,
  dynamicWheelTypes?: any[],
  adminOverrides?: Set<string>
): PickerWheelTypeConfig[] => {
  // Only show wheel types that have been added to Firestore by admin
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

    return convertedWheelTypes
  }

  // No dynamic wheel types available - return empty array
  return []
}


interface LiveDrawSession {
  id: string
  title: string
  description: string
  createdBy: string
  createdAt: Date
  isActive: boolean
  isSpinning: boolean
  currentState: "waiting" | "spinning" | "ended" | "completed"
  isUpdating?: boolean // 🎯 STABILITY: Flag for smooth loading state
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
       role?: string // Added role property to fix TypeScript error
     }>
     notifications?: Array<{
       id: string
       type: 'join' | 'leave' | 'wheel_change' | 'custom'
       message: string
       userId: string
       userName: string
       timestamp: Date
     }>
     // 🎨 THEME SYNCHRONIZATION: Add wheelState for theme synchronization
     wheelState?: {
       theme?: {
         primaryColor?: string
         secondaryColor?: string
         accentColor?: string
         backgroundColor?: string
         themeName?: string
         primary?: string
         secondary?: string
         accent?: string
         background?: string
         colors?: string[]
       }
       themeUpdatedAt?: any
       isSpinning?: boolean
       completedAt?: any
       winners?: any[]
       broadcastSource?: string
       // Research mode properties
       uploadedStudentCount?: number
       randomSelectionCount?: number
       isResearchModeActive?: boolean
       researchModeUpdatedAt?: number
     }
     selectedTheme?: string
     // Image Picker Wheel specific properties
     imageWheelSlices?: Array<{
       id: string
       text: string
       color: string
       image?: {
         url: string
         fileName?: string
         uploadTimestamp?: Date
         isUploaded?: boolean
       }
     }>
     wheelImages?: Array<{
       sliceId: string
       url: string
       alt?: string
       isLoaded?: boolean
       error?: boolean
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
      onInvitationSent?: () => void // Callback for when an invitation is sent
      onRealUsersChange?: (users: any[]) => void
      autoStart?: boolean
      selectedWheelType?: PickerWheelType | null
      // NEW: Participant mode props for unified interface
      participantMode?: boolean
      participantName?: string
      isCollaborator?: boolean
      isActualOrganizer?: boolean
      // 🎨 ENHANCED: Image data for image-picker wheels
      imageWheelSlices?: Array<{
        id: string
        text: string
        color: string
        image?: {
          url: string
          fileName?: string
          uploadTimestamp?: Date
          isUploaded?: boolean
        }
      }>
      wheelImages?: Array<{
        sliceId: string
        url: string
        alt?: string
        isLoaded?: boolean
        error?: boolean
      }>
      onSettingsChange?: (settings: any) => void
    }

export function LiveDrawManager({ user, activityId, participants, onBack, onAddParticipant, onRealUsersChange, autoStart = false, selectedWheelType, participantMode = false, participantName = "", isCollaborator = false, isActualOrganizer = false, imageWheelSlices = [], wheelImages = [], onSettingsChange }: LiveDrawManagerProps) {
    // Use direct Firestore queries for wheel types
    const [dynamicWheelTypes, setDynamicWheelTypes] = useState<any[]>([])
    const [wheelTypesLoading, setWheelTypesLoading] = useState(true)
    const [wheelTypesError, setWheelTypesError] = useState<string | null>(null)

    // Determine user role for wheel type visibility
    const [userRole, setUserRole] = useState<string>("participant")

    // Enhanced Collaborative Live Room Manager instance
    const [enhancedManager, setEnhancedManager] = useState<EnhancedCollaborativeLiveRoomManager | null>(null)
    const [enhancedManagerInitialized, setEnhancedManagerInitialized] = useState(false)

    // CRITICAL FIX: Add Firebase synchronization state for collaborator spins
    const [isSpinning, setIsSpinning] = useState(false)
    const [liveSession, setLiveSession] = useState<LiveDrawSession | null>(null)
    const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'error'>('syncing')
    const [lastSyncTime, setLastSyncTime] = useState<number>(Date.now())
    const [debugLogs, setDebugLogs] = useState<string[]>([])
    const [winners, setWinners] = useState<any[]>([])
 
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
  
    // Load wheel types directly from Firestore
    useEffect(() => {
      const q = query(collection(db, "wheelTypes"), orderBy("order", "asc"))
  
      const unsubscribe = onSnapshot(
        q,
        (querySnapshot) => {
          const fetchedTypes = querySnapshot.docs.map((doc) => ({
            id: doc.id,
            value: doc.data().value,
            label: doc.data().label,
            description: doc.data().description,
            enabled: doc.data().enabled,
            order: doc.data().order,
            allowedRoles: doc.data().allowedRoles || ["organizer", "participant"],
            isActivityWheel: doc.data().isActivityWheel || false,
            canBeShared: doc.data().canBeShared || false,
            hiddenForNewUsers: doc.data().hiddenForNewUsers || false,
            icon: doc.data().icon,
            category: doc.data().category,
            isPreset: doc.data().isPreset || false,
            defaultItems: doc.data().defaultItems || ["Option 1", "Option 2", "Option 3"],
            defaultSettings: doc.data().defaultSettings || {
              allowRealTimeCollection: false,
              requiresApproval: false,
              congratsMessage: "Congratulations, {winner}!"
            },
            createdAt: doc.data().createdAt?.toDate() || new Date(),
            updatedAt: doc.data().updatedAt?.toDate() || new Date(),
          }))
  
          setDynamicWheelTypes(fetchedTypes)
          setWheelTypesLoading(false)
          setWheelTypesError(null)
        },
        (error) => {
          console.error("Error loading wheel types:", error)
          setWheelTypesError(error.message)
          setWheelTypesLoading(false)
        }
      )
  
      return () => unsubscribe()
    }, [])
  
    // Get visible wheel types based on user role (only from Firestore)
    const visibleWheelTypes = useMemo(() => {
      if (wheelTypesLoading) return []
      return getVisibleLiveWheelTypes(userRole, dynamicWheelTypes)
    }, [dynamicWheelTypes, userRole, wheelTypesLoading])

    // Only show wheel types that have been added to Firestore by admin
    const allAvailableWheelTypes = useMemo(() => {
      return getVisibleLiveWheelTypes(userRole, dynamicWheelTypes)
    }, [dynamicWheelTypes, userRole, wheelTypesLoading])
    
    // Cache wheel type to prevent unnecessary updates
    const [cachedWheelType, setCachedWheelType] = useState(selectedWheelType)

    // STABLE: Consistent wheel type caching
    useEffect(() => {
      if (selectedWheelType) {
        setCachedWheelType(selectedWheelType)
      }
    }, [selectedWheelType])

    // 🚫 REMOVED: Conflicting Firebase listeners that interfere with EnhancedWheel synchronization
    // The parent LiveDrawManager component had duplicate listeners that conflicted with
    // EnhancedWheel's precise real-time synchronization. All wheel spinning and Firebase
    // synchronization is now handled exclusively by the EnhancedWheel component.
    // See: https://github.com/coderbydesign.live-picker-collaboration#wheel-sync for details

    // 🎯 STABLE WHEEL TYPE CHANGE PREVENTION: Add lock to prevent race conditions
    const [lastWheelTypeChangeTime, setLastWheelTypeChangeTime] = useState(0)
    const wheelTypeChangeLockRef = useRef(false)
    const [wheelTypeChangeId, setWheelTypeChangeId] = useState<string>('')
    const lastProcessedChangeId = useRef<string>('')
    const wheelTypeChangeDebounceRef = useRef<NodeJS.Timeout | null>(null)
    const wheelTypeChangeInProgress = useRef(false)
    const pendingWheelTypeChange = useRef<any>(null)

    // CRITICAL: Ultra-fast wheel state synchronization for immediate spin detection
    useEffect(() => {
      if (!activityId) return
 
      // STABLE: Consistent listener setup - no variable logging
 
      const wheelStateUnsubscribe = onSnapshot(
        doc(db, "liveDrawSessions", activityId),
        (docSnapshot) => {
          if (!docSnapshot.exists()) return
 
          const sessionData = docSnapshot.data()
          const wheelState = sessionData.wheelState

          // Sync shuffled items from EnhancedWheel broadcasts
          // 🎯 CRITICAL: Handle wheelItems, customItems, AND shuffledItems for complete sync
          if (wheelState) {
            // Priority 1: shuffledItems (from shuffle button)
            // Priority 2: customItems (from direct edits)
            // Priority 3: wheelItems (general updates)
            const syncedItems = wheelState.shuffledItems || wheelState.customItems || wheelState.wheelItems
            
            if (syncedItems && Array.isArray(syncedItems) && syncedItems.length > 0) {
              const newItems = syncedItems as string[]
              const typeId = sessionData.selectedWheelType?.id || sessionData.wheelType || currentWheelTypeId
              
              console.log("🔄 LIVE-DRAW-MANAGER: Syncing items from Firebase", {
                source: wheelState.shuffledItems ? 'shuffledItems' : wheelState.customItems ? 'customItems' : 'wheelItems',
                itemCount: newItems.length,
                wheelTypeId: typeId,
                preview: newItems.slice(0, 3),
                timestamp: new Date().toISOString()
              })
              
              setEditableItemsByWheelType(prev => ({
                ...prev,
                [typeId]: [...newItems]
              }))
            }
            
            // 🔥 SYNC: Load persisted wheelTypesData for all wheel types
            const wheelTypesData = wheelState.wheelTypesData || {}
            if (Object.keys(wheelTypesData).length > 0) {
              console.log("💾 LOADING PERSISTED WHEEL TYPES DATA:", {
                wheelTypes: Object.keys(wheelTypesData),
                data: Object.entries(wheelTypesData).map(([id, data]: [string, any]) => ({
                  wheelTypeId: id,
                  itemCount: data.items?.length || 0,
                  items: data.items || [],
                  lastUpdated: data.lastUpdated ? new Date(data.lastUpdated).toISOString() : 'unknown'
                }))
              })
              setEditableItemsByWheelType(prev => {
                const updated = { ...prev }
                Object.entries(wheelTypesData).forEach(([wheelTypeId, data]: [string, any]) => {
                  if (data.items && Array.isArray(data.items) && data.items.length > 0) {
                    updated[wheelTypeId] = [...data.items]
                    console.log(`✅ RESTORED ITEMS FOR ${wheelTypeId}:`, {
                      itemCount: data.items.length,
                      items: data.items
                    })
                  }
                })
                return updated
              })
            }
          }

          // 🎯 ATOMIC WHEEL TYPE SYNC: Apply changes with unique ID tracking and debouncing
          const incomingChangeId = sessionData.wheelState?.wheelTypeChangeId || ''
          if (sessionData.selectedWheelType && 
              sessionData.selectedWheelType.id !== cachedWheelType?.id &&
              incomingChangeId !== lastProcessedChangeId.current &&
              !wheelTypeChangeLockRef.current &&
              !wheelTypeChangeInProgress.current) {
            
            // Clear any pending debounce
            if (wheelTypeChangeDebounceRef.current) {
              clearTimeout(wheelTypeChangeDebounceRef.current)
            }
            
            // Lock to prevent concurrent changes
            wheelTypeChangeLockRef.current = true
            wheelTypeChangeInProgress.current = true
            lastProcessedChangeId.current = incomingChangeId
            
            console.log("⚡ ATOMIC WHEEL TYPE CHANGE: Processing wheel type change", {
              from: cachedWheelType?.id,
              to: sessionData.selectedWheelType?.id,
              changeId: incomingChangeId,
              timestamp: new Date().toISOString()
            })
            
            // 🎯 ATOMIC UPDATE: All state changes in one synchronous batch
            const newWheelType = sessionData.selectedWheelType
            const wheelState = sessionData.wheelState as any
            
            // 🔥 ENHANCED ITEM LOADING: Check persisted data first, then defaults
            const wheelTypesData = (wheelState as any)?.wheelTypesData || {}
            const persistedItems = wheelTypesData[newWheelType.id]?.items
            
            const newWheelItems = persistedItems || 
                                 wheelState?.wheelItems || 
                                 wheelState?.customItems || 
                                 sessionData.wheelItems || 
                                 newWheelType.defaultItems || []
            
            console.log("⚡ SYNCING WHEEL TYPE DATA:", {
              wheelTypeId: newWheelType.id,
              itemCount: newWheelItems.length,
              changeId: incomingChangeId,
              source: persistedItems ? 'persisted wheelTypesData' :
                     wheelState?.wheelItems ? 'wheelState.wheelItems' : 
                     wheelState?.customItems ? 'wheelState.customItems' :
                     sessionData.wheelItems ? 'sessionData.wheelItems' : 'defaultItems',
              items: newWheelItems.slice(0, 5)
            })
            
            // 🎯 INSTANT STATE UPDATE - No debouncing to prevent stuttering
            // React 18 batches these automatically for smooth transitions
            const newEditableItemsByWheelType = {
              [newWheelType.id]: newWheelItems
            }
            
            const newSessionState = session ? {
              ...session,
              selectedWheelType: newWheelType,
              wheelItems: newWheelItems,
              wheelState: {
                wheelItems: newWheelItems,
                customItems: newWheelItems,
                wheelTypeChangeId: incomingChangeId,
                lastWheelTypeId: newWheelType.id,
                lastWheelTypeUpdate: Date.now(),
                shuffledItems: null,
                wheelTypesData: {
                  ...((session.wheelState as any)?.wheelTypesData || {}),
                  [newWheelType.id]: {
                    items: newWheelItems,
                    lastUpdated: Date.now()
                  }
                }
              } as any,
              winners: [],
              currentState: 'waiting' as const,
              isSpinning: false
            } : null
            
            // Apply all state changes instantly - React 18 batches them
            setCachedWheelType(newWheelType)
            setWheelTypeChangeId(incomingChangeId)
            setLastWheelTypeChangeTime(Date.now())
            setShowWinnerPopup(false)
            setIsProcessingWinners(false)
            setLastWinnerTimestamp(0)
            setWinners([])
            setEditableItemsByWheelType(newEditableItemsByWheelType)
            setSession(newSessionState)
            
            // Unlock immediately - no artificial delays
            wheelTypeChangeLockRef.current = false
            wheelTypeChangeInProgress.current = false
          }
 
          // 🎨 ENHANCED: Sync image data from Firebase
          if (sessionData.wheelImages && sessionData.wheelImages.length > 0) {
            // STABLE: Consistent image sync - no variable logging
            setCurrentWheelImages(sessionData.wheelImages)
 
            // Update session state with wheel images for participant sync
            setLiveSession(prev => {
              if (!prev) return prev
              return {
                ...prev,
                wheelImages: sessionData.wheelImages
              }
            })
          }
 
          if (sessionData.imageWheelSlices && sessionData.imageWheelSlices.length > 0) {
            // STABLE: Consistent image slice sync - no variable logging
            setCurrentImageWheelSlices(sessionData.imageWheelSlices)
 
            // Update session state with image wheel slices for participant sync
            setLiveSession(prev => {
              if (!prev) return prev
              return {
                ...prev,
                imageWheelSlices: sessionData.imageWheelSlices
              }
            })
          }
 
          // 🎨 ENHANCED: Handle image application updates from EnhancedWheel
          if (sessionData.lastImageUpdate && sessionData.wheelImages) {
            // STABLE: Consistent image update handling - no variable logging
 
            // Update local state immediately for instant reflection
            setCurrentWheelImages(sessionData.wheelImages)
            if (sessionData.imageWheelSlices) {
              setCurrentImageWheelSlices(sessionData.imageWheelSlices)
            }
 
            // Update session state for participant sync
            setLiveSession(prev => {
              if (!prev) return prev
              return {
                ...prev,
                wheelImages: sessionData.wheelImages,
                imageWheelSlices: sessionData.imageWheelSlices,
                wheelState: {
                  ...prev.wheelState,
                  hasImages: sessionData.wheelImages.length > 0,
                  imageCount: sessionData.wheelImages.length,
                  imagesApplied: true
                }
              }
            })
 
            // Show notification that images were applied
            toast({
              title: "🎨 Images Applied!",
              description: `Images have been applied to ${sessionData.wheelImages.length} wheel segments`,
            })
          }
 
          // 🎨 ENHANCED: Handle wheelState image updates
          if (sessionData.wheelState?.hasImages === true && sessionData.wheelState?.imageCount > 0) {
            // STABLE: Consistent wheel state image handling - no variable logging
 
            // Ensure local state is updated
            if (sessionData.wheelImages) {
              setCurrentWheelImages(sessionData.wheelImages)
            }
            if (sessionData.imageWheelSlices) {
              setCurrentImageWheelSlices(sessionData.imageWheelSlices)
            }
 
            // Update session state for participant sync
            setLiveSession(prev => {
              if (!prev) return prev
              return {
                ...prev,
                wheelImages: sessionData.wheelImages || prev.wheelImages,
                imageWheelSlices: sessionData.imageWheelSlices || prev.imageWheelSlices,
                wheelState: {
                  ...prev.wheelState,
                  hasImages: true,
                  imageCount: sessionData.wheelState.imageCount,
                  imagesApplied: true
                }
              }
            })
          }
 
          // 🚀 IMMEDIATE SPIN DETECTION: Ultra-fast response to collaborator spin
          if (wheelState?.isSpinning === true && !isSpinning) {
            // STABLE: Consistent spin detection - no variable logging
 
            // Immediate spinning state update
            setIsSpinning(true)
 
            // Force session update for wheel synchronization
            setLiveSession(prev => {
              if (!prev) return null
              return {
                ...prev,
                isSpinning: true,
                currentState: 'spinning' as const,
                wheelState: wheelState
              }
            })
 
            // Update sync status
            setSyncStatus('synced')
            setLastSyncTime(Date.now())
          }
 
          // 🎯 SPIN COMPLETION DETECTION - FIXED FOR COLLABORATOR SPINS
          if (wheelState?.isSpinning === false && isSpinning && wheelState?.completedAt) {
            // STABLE: Consistent spin completion detection - no variable logging
 
            setIsSpinning(false)
 
            // CRITICAL FIX: Properly update session with winners for collaborator-initiated spins
            if (wheelState.winners && wheelState.winners.length > 0 && wheelState.broadcastSource === 'collaborator') {
              // STABLE: Consistent collaborator winner handling - no variable logging
 
              // Force winner popup to show by updating session state
              setLiveSession(prev => {
                if (!prev) return null
                const updatedSession = {
                  ...prev,
                  isSpinning: false,
                  currentState: 'completed' as const,
                  winners: wheelState.winners,
                  wheelState: wheelState,
                  // Force popup trigger for collaborator spins
                  winnerPopupTrigger: Date.now()
                }
                // STABLE: Consistent session update - no variable logging
                return updatedSession
              })
 
              // CRITICAL FIX: Actually trigger the winner popup to show only if not already shown
              if (!showWinnerPopup) {
                setShowWinnerPopup(true)
              }
            } else if (wheelState.winners && wheelState.winners.length > 0) {
              // Handle other cases (organizer or regular spins)
              setLiveSession(prev => {
                if (!prev) return null
                return {
                  ...prev,
                  isSpinning: false,
                  currentState: 'completed' as const,
                  winners: wheelState.winners,
                  wheelState: wheelState
                }
              })
 
              // CRITICAL FIX: Also trigger winner popup for regular spins only if not already shown
              if (!showWinnerPopup) {
                setShowWinnerPopup(true)
              }
            }
          }
        },
        (error) => {
          console.error("Ultra-fast wheel state listener error:", error)
        }
      )
 
      return () => {
        console.log("🔄 Cleaning up ultra-fast wheel state listener")
        wheelStateUnsubscribe()
        
        // Clean up pending debounce timeout
        if (wheelTypeChangeDebounceRef.current) {
          clearTimeout(wheelTypeChangeDebounceRef.current)
          wheelTypeChangeDebounceRef.current = null
        }
        
        // Reset locks
        wheelTypeChangeLockRef.current = false
        wheelTypeChangeInProgress.current = false
      }
    }, [activityId, isSpinning])
  const router = useRouter() // Initialize router for navigation
  const [session, setSession] = useState<LiveDrawSession | null>(null)
  const [isCreating, setIsCreating] = useState(false)

  // Extract collaborator permissions from session data
  const getCollaboratorPermissions = () => {
    if (!session?.collaboratorDetails || (!user?.email && !user?.uid)) return null

    console.log("🔐 DEBUG: Getting collaborator permissions", {
      userEmail: user?.email,
      userUid: user?.uid,
      collaboratorDetailsCount: session.collaboratorDetails.length,
      collaboratorDetails: session.collaboratorDetails.map(c => ({
        email: c.email,
        uid: c.uid,
        name: c.name,
        permissions: c.permissions
      }))
    })

    // Try to find collaborator by email first (preferred method)
    let collaboratorDetail = session.collaboratorDetails.find(
      (collab: any) => collab.email === user.email
    )

    console.log("🔐 DEBUG: Found collaborator by email?", !!collaboratorDetail, collaboratorDetail?.permissions)

    // If not found by email, try by uid for backward compatibility
    if (!collaboratorDetail && user?.uid) {
      collaboratorDetail = session.collaboratorDetails.find(
        (collab: any) => collab.uid === user.uid
      )
      console.log("🔐 DEBUG: Found collaborator by uid?", !!collaboratorDetail, collaboratorDetail?.permissions)
    }

    const permissions = collaboratorDetail?.permissions || null
    console.log("🔐 DEBUG: Final permissions retrieved:", permissions)

    return permissions
  }

  const collaboratorPermissions = getCollaboratorPermissions()

  // Determine effective permissions based on collaborator status and permission level
  // ENHANCED: Full Access collaborators get complete organizer-level control including synchronized spinning
  // SPECIAL CASE: Any collaborator with "organizer" role gets full access automatically
  
  // STABLE: Consistent collaborator detection - optimized for performance
  const collaboratorDetails = useMemo(() => {
    if (!session?.collaboratorDetails || !user) return null;

    // Try exact email match first (most reliable)
    let details = session.collaboratorDetails.find(
      (collab: any) => collab.email === user.email
    );

    // If not found by email, try UID match
    if (!details) {
      details = session.collaboratorDetails.find(
        (collab: any) => collab.uid === user.uid
      );
    }

    return details || null;
  }, [session?.collaboratorDetails, user?.email, user?.uid]);

  const collaboratorRole = collaboratorDetails?.role;
  const collaboratorPermissionsFromDetails = collaboratorDetails?.permissions;
  
  // SPECIAL OVERRIDE: If collaborator is an organizer, grant them full access regardless of other permissions
  // ENHANCED: Also check for organizer-level permissions from live room invitations
  const isOrganizerCollaborator = collaboratorRole === 'organizer' ||
    (collaboratorPermissions && (
      collaboratorPermissions.canControlLive === true ||
      collaboratorPermissions.canEditWheel === true ||
      collaboratorPermissions.canManageParticipants === true ||
      collaboratorPermissions.canEndSession === true
    ));
  
  const hasFullAccess = isActualOrganizer ||
    isOrganizerCollaborator || // SPECIAL OVERRIDE: Organizer collaborators always have full access
    (isCollaborator && (
      // Debug: Log permission checks
      (() => {
        console.log('🔍 DEBUG: Checking permissions for full access...');
        console.log('🔍 DEBUG: Is actual organizer:', isActualOrganizer);
        console.log('🔍 DEBUG: Is organizer collaborator:', isOrganizerCollaborator);
        console.log('🔍 DEBUG: Is collaborator:', isCollaborator);
        console.log('🔍 DEBUG: collaboratorPermissions?.permissionLevel === "full_access":', collaboratorPermissions?.permissionLevel === 'full_access');
        console.log('🔍 DEBUG: Full control permissions:', collaboratorPermissions?.permissions?.includes('full_control'));
        console.log('🔍 DEBUG: Control_edit_manage permissions:', collaboratorPermissions?.permissions?.includes('control_edit_manage'));
        console.log('🔍 DEBUG: Individual permissions combination:',
          collaboratorPermissionsFromDetails?.canControlLive &&
          collaboratorPermissionsFromDetails?.canEditWheel &&
          collaboratorPermissionsFromDetails?.canManageParticipants);
        
        return (
          // Check for explicit full access permission level
          collaboratorPermissions?.permissionLevel === 'full_access' ||
          // Check for full control permission string
          collaboratorPermissions?.permissions?.includes('full_control') ||
          collaboratorPermissions?.permissions?.includes('control_edit_manage') ||
          // Check permissions from collaborator details (for organizer collaborators)
          (collaboratorPermissionsFromDetails?.canControlLive &&
           collaboratorPermissionsFromDetails?.canEditWheel &&
           collaboratorPermissionsFromDetails?.canManageParticipants) ||
          // Check for individual permissions that together constitute full access
          (collaboratorPermissions?.canControlLive &&
           collaboratorPermissions?.canEditWheel &&
           collaboratorPermissions?.canManageParticipants) ||
          // Check for individual permission flags
          collaboratorPermissions?.canControlLive ||
          collaboratorPermissions?.canEditWheel ||
          collaboratorPermissions?.canManageParticipants
        );
      })()
    ))



  const hasSpinAccess = hasFullAccess ||
    (isCollaborator && (
      collaboratorPermissions?.canControlLive
    ))

  const hasEditAccess = hasFullAccess ||
    (isCollaborator && (
      collaboratorPermissions?.canEditWheel ||
      collaboratorPermissions?.canControlLive
    ))

  const hasSuggestAccess = hasFullAccess ||
    (isCollaborator && (
      collaboratorPermissions?.canEditWheel
    ))

  const hasViewOnly = isCollaborator &&
    !hasFullAccess &&
    !hasSpinAccess &&
    !hasEditAccess &&
    !hasSuggestAccess

  // NEW: Enhanced logging for full access collaborators
  if (hasFullAccess && isCollaborator && !isActualOrganizer) {
    console.log("🎯 FULL ACCESS COLLABORATOR DETECTED: This collaborator has complete organizer-level control", {
      isActualOrganizer,
      isCollaborator,
      collaboratorPermissions,
      permissionLevel: collaboratorPermissions?.permissionLevel,
      permissionsArray: collaboratorPermissions?.permissions,
      hasFullAccess,
      userUid: user?.uid,
      synchronizationEnabled: true
    })
  }

  console.log("🔐 Enhanced Collaborator permissions analysis:", {
    isActualOrganizer,
    isCollaborator,
    collaboratorPermissions,
    hasFullAccess,
    hasSpinAccess,
    hasEditAccess,
    hasSuggestAccess,
    hasViewOnly,
    userUid: user?.uid,
    fullAccessCollaborator: hasFullAccess && isCollaborator && !isActualOrganizer
  })
  // Initialize Enhanced Collaborative Live Room Manager
  useEffect(() => {
    if (session?.id && user && !enhancedManagerInitialized) {
      console.log("🎯 Initializing Enhanced Collaborative Live Room Manager for session:", session.id)

      const manager = EnhancedCollaborativeLiveRoomManager.getInstance()
      setEnhancedManager(manager)
      setEnhancedManagerInitialized(true)

      // Set up listeners for enhanced collaborative actions
      const unsubscribeActions = manager.listenToEnhancedCollaborativeActions(
        session.id,
        (actions) => {
          console.log("🎯 Enhanced collaborative actions received:", actions)
          // Handle enhanced collaborative actions here
        }
      )

      const unsubscribePresence = manager.listenToEnhancedOrganizerPresence(
        session.id,
        (organizers) => {
          console.log("🎯 Enhanced organizer presence updated:", organizers)
          // Handle enhanced organizer presence updates here
        }
      )

      // Update organizer presence
      manager.updateEnhancedOrganizerPresence(session.id, {
        uid: user.uid,
        name: user.displayName || user.email?.split('@')[0] || 'Organizer',
        email: user.email || '',
        isOnline: true,
        lastSeen: Date.now(),
        permissions: {
          canControlLive: hasFullAccess,
          canEditWheel: hasEditAccess,
          canManageParticipants: hasFullAccess,
          canBroadcast: hasFullAccess
        },
        connectionQuality: 'excellent'
      })

      // Cleanup function
      return () => {
        console.log("🧹 Cleaning up enhanced collaborative manager listeners")
        unsubscribeActions()
        unsubscribePresence()
      }
    }
  }, [session?.id, user, enhancedManagerInitialized, isActualOrganizer, isCollaborator, hasFullAccess])

  // STABLE: Consistent initialization - no console logging that varies with state
  useEffect(() => {
    // Component initialized - consistent behavior only
  }, []) // Empty dependency array - only run once on mount


  // Fallback: Try to get wheel type from session data if prop is not available
  useEffect(() => {
    if (!cachedWheelType && session?.selectedWheelType) {
      console.log("🔄 Using session selectedWheelType as fallback:", session.selectedWheelType.id)
      setCachedWheelType(session.selectedWheelType as any)
    } else if (!cachedWheelType && session?.wheelType) {
      // Try to get from visible wheel types only (from Firestore)
      const fallbackWheelType = visibleWheelTypes.find(w => w.id === session.wheelType)
      if (fallbackWheelType) {
        console.log("🔄 Using fallback wheel type from visible types:", fallbackWheelType.id)
        setCachedWheelType(fallbackWheelType)
      }
    }
  }, [session, cachedWheelType, visibleWheelTypes])
  const [viewers, setViewers] = useState<Array<{ 
    id: string; 
    name: string; 
    joinedAt: Date;
    lastSeen: Date;
    platform?: string;
    connectionId?: string;
    isActive?: boolean;
    role?: string;
    userId?: string;
  }>>([])
  const [reactions, setReactions] = useState<Array<{ id: string; emoji: string; userId: string; timestamp: Date }>>([])
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("")
  const [isQrDialogOpen, setIsQrDialogOpen] = useState(false)
  const [isSendCodesDialogOpen, setIsSendCodesDialogOpen] = useState(false)
  const [isAddParticipantDialogOpen, setIsAddParticipantDialogOpen] = useState(false)
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([])
  const [newParticipant, setNewParticipant] = useState({ name: "", email: "" })
  const [collaboratorEmail, setCollaboratorEmail] = useState("")
  const [isInvitingCollaborator, setIsInvitingCollaborator] = useState(false)
  const [collaboratorPermissionLevel, setCollaboratorPermissionLevel] = useState("full_access")
  const [participantActivity, setParticipantActivity] = useState<Record<string, { lastActive: Date; isOnline: boolean; connectionId?: string }>>({})
  const [realUsers, setRealUsers] = useState<any[]>([])
  const [isLoadingUsers, setIsLoadingUsers] = useState(false)
  const [liveComments, setLiveComments] = useState<Record<string, any[]>>({})
  const [kickedUsers, setKickedUsers] = useState<Set<string>>(new Set())
  const [activeUsers, setActiveUsers] = useState<any[]>([])
  const [isLoadingActiveUsers, setIsLoadingActiveUsers] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false)
  // NEW: State for pending collaborators
  const [pendingCollaborators, setPendingCollaborators] = useState<any[]>([])
  
  // NEW: Custom features state
  const [customWheelTitle, setCustomWheelTitle] = useState("")
  const enableRealTimeSync = true
  const [customMessage, setCustomMessage] = useState("")
  const [customWinnerWord, setCustomWinnerWord] = useState("Winner")
  const [allowManualWinnerSelection, setAllowManualWinnerSelection] = useState(false)
  const [showWinnerPopup, setShowWinnerPopup] = useState(false)
  const [selectedItems, setSelectedItems] = useState<string[]>([])
  const [isCustomSettingsOpen, setIsCustomSettingsOpen] = useState(false)
  const [collaboratorWheelType, setCollaboratorWheelType] = useState("")
  const [selectedTheme, setSelectedTheme] = useState("default")

  // NEW: Participant leave popup notification state
  const [showLeavePopup, setShowLeavePopup] = useState(false)
  const [leavePopupData, setLeavePopupData] = useState<{
    participantName: string;
    platform: string;
    reason: string;
  } | null>(null)

  // Auto-close leave popup after 5 seconds
  useEffect(() => {
    if (showLeavePopup) {
      const timer = setTimeout(() => {
        setShowLeavePopup(false)
      }, 5000) // Auto-close after 5 seconds

      return () => clearTimeout(timer)
    }
  }, [showLeavePopup])

  // OPTIMIZATION: Add debounced state for large participant lists
  const [debouncedViewers, setDebouncedViewers] = useState<typeof viewers>([])

  // Debounce viewer updates to prevent excessive re-renders with large participant counts
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedViewers(viewers)
    }, viewers.length > 50 ? 500 : viewers.length > 20 ? 300 : 100) // Longer delay for larger groups

    return () => clearTimeout(timer)
  }, [viewers])

  // NEW: Spin Mode and Number of Winners state
  const [spinMode, setSpinMode] = useState("random")
  const [numberOfWinners, setNumberOfWinners] = useState(1)
  
  // 🎯 STABILITY: Wheel type changing state for smooth UX
  const [isChangingWheelType, setIsChangingWheelType] = useState(false)

  // NEW: Spin Mode and Number of Winners settings per wheel type
  const [spinModeByWheelType, setSpinModeByWheelType] = useState<Record<string, string>>({})
  const [numberOfWinnersByWheelType, setNumberOfWinnersByWheelType] = useState<Record<string, number>>({})

  // Get current wheel type ID for isolation
  const currentWheelTypeId = cachedWheelType?.id || session?.selectedWheelType?.id || session?.wheelType || "default"

  // Get current wheel type settings
  const currentSpinMode = spinModeByWheelType[currentWheelTypeId] || "random"
  const currentNumberOfWinners = numberOfWinnersByWheelType[currentWheelTypeId] || 1

  // NEW: Edit text functionality state - with wheel type isolation
  const [isEditTextDialogOpen, setIsEditTextDialogOpen] = useState(false)
  const [editableItemsByWheelType, setEditableItemsByWheelType] = useState<Record<string, string[]>>({})
  const [newItemText, setNewItemText] = useState("")
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [isUploadingCsv, setIsUploadingCsv] = useState(false)
  const [csvUploadProgress, setCsvUploadProgress] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Get editable items for current wheel type
  const editableItems = useMemo(() => 
    editableItemsByWheelType[currentWheelTypeId] || [], 
    [editableItemsByWheelType, currentWheelTypeId]
  )
  
  const setEditableItems = useCallback(async (items: string[]) => {
    setEditableItemsByWheelType(prev => {
      // Only update if items actually changed
      const currentItems = prev[currentWheelTypeId] || []
      if (JSON.stringify(currentItems) === JSON.stringify(items)) {
        return prev // Return same reference to prevent re-render
      }
      return {
        ...prev,
        [currentWheelTypeId]: items
      }
    })
    
    // 🔥 CRITICAL: Persist items to Firebase for this wheel type
    if (session?.id && currentWheelTypeId) {
      try {
        await updateDoc(doc(db, "liveDrawSessions", session.id), {
          [`wheelState.wheelTypesData.${currentWheelTypeId}.items`]: items,
          [`wheelState.wheelTypesData.${currentWheelTypeId}.lastUpdated`]: Date.now(),
          updatedAt: serverTimestamp()
        })
        console.log(`💾 PERSISTED ITEMS FOR ${currentWheelTypeId}:`, {
          itemCount: items.length,
          items: items
        })
      } catch (error) {
        console.error(`❌ Failed to persist items for ${currentWheelTypeId}:`, error)
      }
    }
  }, [currentWheelTypeId, session?.id])

  // 🎯 PERFORMANCE: Memoize wheel participants to prevent unnecessary re-renders
  // 🔥 ORGANIZER VIEW: Show only collaborators (not regular participants)
  // 🔥 COLLABORATOR VIEW: Show organizer's wheel items from wheelState
  const wheelParticipants = useMemo(() => {
    if (editableItems && editableItems.length > 0) {
      return editableItems.map((item: string, index: number) => ({
        id: `wheel-item-${index}`,
        name: item,
        email: undefined,
        isSelected: true
      }))
    }
    if (cachedWheelType?.defaultItems) {
      return cachedWheelType.defaultItems.map((item: string, index: number) => ({
        id: `wheel-item-${index}`,
        name: item,
        email: undefined,
        isSelected: true
      }))
    }
    
    // 🔥 ORGANIZER-ONLY VIEW: Show ONLY collaborators (not regular participants)
    if (isActualOrganizer && session?.collaboratorDetails && session.collaboratorDetails.length > 0) {
      const collaboratorParticipants = session.collaboratorDetails.map(c => ({
        id: c.uid || `collab-${c.name}`,
        name: c.name,
        email: c.email,
        isSelected: true,
        isCollaborator: true
      }))
      
      console.log("🎯 ORGANIZER WHEEL: Showing ONLY collaborators", {
        collaboratorCount: collaboratorParticipants.length,
        collaboratorNames: collaboratorParticipants.map(c => c.name).join(', '),
        timestamp: new Date().toISOString()
      })
      
      return collaboratorParticipants
    }
    
    // Priority 1: Use session participants if available (for non-organizers or regular participants)
    if (session?.participants && session.participants.length > 0) {
      const baseParticipants = session.participants.map(p => ({
        id: p.id,
        name: p.name,
        email: p.email,
        isSelected: true
      }))
      
      // 🔥 COLLABORATOR VIEW: Add collaborators to the wheel participants list
      const collaboratorParticipants = (session?.collaboratorDetails || []).map(c => ({
        id: c.uid || `collab-${c.name}`,
        name: c.name,
        email: c.email,
        isSelected: true,
        isCollaborator: true
      }))
      
      // Combine and deduplicate (collaborators take precedence if duplicated)
      const allParticipants = [...baseParticipants]
      collaboratorParticipants.forEach(collab => {
        if (!allParticipants.find(p => p.id === collab.id)) {
          allParticipants.push(collab)
        }
      })
      
      return allParticipants
    }
    
    // Fallback to empty array
    return []
  }, [editableItems, cachedWheelType?.defaultItems, session?.participants, session?.collaboratorDetails, isActualOrganizer])

  // 🎯 PERFORMANCE: Memoize customItems to prevent unnecessary re-renders
  const wheelCustomItems = useMemo(() => {
    return editableItems && editableItems.length > 0 ? editableItems : undefined
  }, [editableItems])

  // 🔥 CRITICAL: Monitor collaborator changes and ensure they appear on the wheel (ORGANIZER ONLY)
  useEffect(() => {
    if (isActualOrganizer && session?.collaboratorDetails && session.collaboratorDetails.length > 0) {
      const collaboratorNames = session.collaboratorDetails.map(c => c.name).join(', ')
      console.log("🎯 ORGANIZER: COLLABORATORS DETECTED ON WHEEL (ORGANIZER VIEW ONLY):", {
        count: session.collaboratorDetails.length,
        names: collaboratorNames,
        wheelParticipantsCount: wheelParticipants.length,
        wheelParticipantNames: wheelParticipants.map(p => p.name).join(', '),
        timestamp: new Date().toISOString()
      })
    } else if (isActualOrganizer && (!session?.collaboratorDetails || session.collaboratorDetails.length === 0)) {
      console.log("ℹ️ ORGANIZER: No collaborators have joined yet", {
        timestamp: new Date().toISOString()
      })
    }
  }, [session?.collaboratorDetails, wheelParticipants, isActualOrganizer])

  // Initialize wheel type settings when wheel type changes
  useEffect(() => {
    if (currentWheelTypeId && !spinModeByWheelType[currentWheelTypeId]) {
      setSpinModeByWheelType(prev => ({
        ...prev,
        [currentWheelTypeId]: "random"
      }))
    }
    if (currentWheelTypeId && !numberOfWinnersByWheelType[currentWheelTypeId]) {
      setNumberOfWinnersByWheelType(prev => ({
        ...prev,
        [currentWheelTypeId]: 1
      }))
    }

    // 🎯 CRITICAL FIX: Only initialize if items don't exist - prevent overwriting saved state
    if (currentWheelTypeId && !editableItemsByWheelType[currentWheelTypeId]) {
      // Priority 1: Load from Firebase wheelTypesData (persisted per wheel type)
      // Priority 2: Use wheelState items for current active wheel
      // Priority 3: Use cachedWheelType defaultItems
      const wheelState = session?.wheelState as any
      const wheelTypesData = wheelState?.wheelTypesData || {}
      const savedItemsForType = wheelTypesData[currentWheelTypeId]?.items
      
      const wheelStateItems = wheelState?.wheelItems || wheelState?.customItems
      const sessionItems = session?.wheelItems || []
      const defaultItems = cachedWheelType?.defaultItems || ["Option 1", "Option 2", "Option 3", "Option 4", "Option 5"]
      
      const initialItems = savedItemsForType && savedItemsForType.length > 0 ? savedItemsForType :
                           wheelStateItems && wheelStateItems.length > 0 ? wheelStateItems :
                           sessionItems.length > 0 ? sessionItems : 
                           defaultItems

      console.log(`🔄 INITIALIZING ITEMS FOR ${currentWheelTypeId}:`, {
        itemCount: initialItems.length,
        items: initialItems,
        source: savedItemsForType ? 'Firebase wheelTypesData (PERSISTED)' : 
                wheelStateItems ? 'wheelState' : 
                sessionItems.length > 0 ? 'session' : 'default'
      })

      setEditableItemsByWheelType(prev => ({
        ...prev,
        [currentWheelTypeId]: [...initialItems]
      }))
    } else if (currentWheelTypeId && editableItemsByWheelType[currentWheelTypeId]) {
      console.log(`✅ ITEMS ALREADY EXIST FOR ${currentWheelTypeId}:`, {
        itemCount: editableItemsByWheelType[currentWheelTypeId].length,
        items: editableItemsByWheelType[currentWheelTypeId]
      })
    }
  }, [currentWheelTypeId, spinModeByWheelType, numberOfWinnersByWheelType, session?.wheelState, session?.wheelItems, cachedWheelType, editableItemsByWheelType])

  // NEW: Prevent winner announcement loops and ensure accurate single announcement
  const [isProcessingWinners, setIsProcessingWinners] = useState(false)
  const [lastWinnerTimestamp, setLastWinnerTimestamp] = useState(0)
  const [lastSpinId, setLastSpinId] = useState<string>("")

  // 🎨 ENHANCED: Image synchronization state for image-picker wheels
  const [currentImageWheelSlices, setCurrentImageWheelSlices] = useState<any[]>(imageWheelSlices || [])
  const [currentWheelImages, setCurrentWheelImages] = useState<any[]>(wheelImages || [])

  // Debug selectedTheme changes
  useEffect(() => {
    console.log('🎨 selectedTheme STATE CHANGED:', {
      selectedTheme,
      timestamp: new Date().toISOString()
    })
  }, [selectedTheme])

  // Reset winner processing flag when spinning starts
  useEffect(() => {
    if (isSpinning) {
      setIsProcessingWinners(false)
      setLastWinnerTimestamp(0)
      setShowWinnerPopup(false) // Reset popup to prevent multiple announcements
    }
  }, [isSpinning])



  // Derived state for missing variables
  const effectiveOrganizerMode = hasFullAccess || isActualOrganizer
  const userPermissions = {
    isFullAccessCollaborator: hasFullAccess && isCollaborator && !isActualOrganizer,
    canTriggerSynchronizedSpin: (session?.createdBy === user.uid || isActualOrganizer) ||
      (isCollaborator && (hasFullAccess || collaboratorRole === 'organizer')),
    synchronizationEnabled: enableRealTimeSync && !!session?.id,
    sessionId: session?.id,
    userRole: userRole || 'collaborator'
  }
  const wheelTheme = (() => {
    // Get theme from session data - prioritize wheelState.theme for real-time sync
    const sessionTheme = session?.wheelState?.theme || session?.selectedTheme

    console.log("🎨 LIVE DRAW MANAGER - PASSING THEME TO WHEEL:", {
      sessionTheme: sessionTheme,
      selectedTheme: session?.selectedTheme,
      wheelStateTheme: session?.wheelState?.theme,
      sessionId: session?.id,
      timestamp: new Date().toISOString()
    })

    // If session has theme data, use it
    if (sessionTheme && typeof sessionTheme === 'object' && sessionTheme !== null) {
      const themeObj = sessionTheme as any
      const themeResult = {
        primary: themeObj.primaryColor || themeObj.primary || "#8e0b16",
        secondary: themeObj.secondaryColor || themeObj.secondary || "#66181E",
        accent: themeObj.accentColor || themeObj.accent || "#ffffff",
        background: themeObj.backgroundColor || themeObj.background || "#ffffff"
      }

      console.log("🎨 USING SESSION THEME OBJECT:", themeResult)
      return themeResult
    }

    // If session has theme name, get colors for it
    if (typeof sessionTheme === 'string') {
      const themeColors = getThemeColors(sessionTheme)
      const themeResult = {
        primary: themeColors.primary,
        secondary: themeColors.secondary,
        accent: themeColors.accent,
        background: themeColors.background
      }

      console.log("🎨 USING SESSION THEME NAME:", {
        themeName: sessionTheme,
        themeColors: themeResult
      })
      return themeResult
    }

    // Default theme
    const defaultTheme = {
      primary: "#8e0b16",
      secondary: "#66181E",
      accent: "#ffffff",
      background: "#ffffff"
    }

    console.log("🎨 USING DEFAULT THEME:", defaultTheme)
    return defaultTheme
  })()
  const isLiveMode = !!session
  // CRITICAL FIX: Count ALL viewers as live participants (organizers excluded at registration)
  const liveParticipants = viewers
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

  // 🎨 TEST THEME SYNC: Test function to verify theme synchronization
  const testThemeSync = async () => {
    if (!session?.id) {
      toast({
        title: "No Active Session",
        description: "Please start a live session first",
        variant: "destructive"
      })
      return
    }

    try {
      console.log('🧪 TESTING THEME SYNCHRONIZATION...')

      // Test with a random theme
      const testThemes = ['ocean', 'sunset', 'forest', 'royal', 'fire']
      const randomTheme = testThemes[Math.floor(Math.random() * testThemes.length)]

      console.log('🧪 Testing with theme:', randomTheme)

      const themeColors = getThemeColors(randomTheme)
      const updateData = {
        selectedTheme: randomTheme,
        wheelState: {
          theme: {
            primaryColor: themeColors.primary,
            secondaryColor: themeColors.secondary,
            accentColor: themeColors.accent,
            backgroundColor: themeColors.background,
            themeName: randomTheme
          },
          themeUpdatedAt: serverTimestamp()
        },
        updatedAt: serverTimestamp()
      }

      await updateDoc(doc(db, "liveDrawSessions", session.id), updateData)

      console.log('🧪 TEST THEME UPDATE SENT:', updateData)

      toast({
        title: "🧪 Theme Sync Test Sent!",
        description: `Testing theme synchronization with "${randomTheme}" theme. Check participant browser console for detection.`,
        duration: 5000
      })

    } catch (error) {
      console.error('❌ TEST THEME SYNC FAILED:', error)
      toast({
        title: "Test Failed",
        description: "Could not send test theme update",
        variant: "destructive"
      })
    }
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

  // Enhanced participant activity tracking with accurate leave detection
  useEffect(() => {
    setParticipantActivity(prev => {
      const newActivity: Record<string, { lastActive: Date; isOnline: boolean; connectionId?: string }> = {}
      let hasChanges = false

      participants.forEach(participant => {
        if (!prev[participant.id]) {
          // Initialize with current timestamp for accurate tracking
          const lastActive = new Date()
          newActivity[participant.id] = {
            lastActive,
            isOnline: true,
            connectionId: `participant-${participant.id}-${Date.now()}`
          }
          hasChanges = true
        } else {
          newActivity[participant.id] = prev[participant.id]
        }
      })

      // Only return new object if there are actual changes
      return hasChanges ? newActivity : prev
    })
  }, [participants])

  // Enhanced activity status tracking with real-time presence detection
  useEffect(() => {
    const interval = setInterval(() => {
      setParticipantActivity(prev => {
        const updated = { ...prev }
        let hasChanges = false
        const currentTime = Date.now()

        Object.keys(updated).forEach(id => {
          const timeDiff = currentTime - updated[id].lastActive.getTime()
          const newOnlineStatus = timeDiff < 5 * 60 * 1000 // Online if active within last 5 minutes

          if (updated[id].isOnline !== newOnlineStatus) {
            updated[id].isOnline = newOnlineStatus
            hasChanges = true

            // Show notification when participant goes offline
            if (!newOnlineStatus) {
              const participant = participants.find(p => p.id === id)
              if (participant) {
                console.log(`👋 Participant left: ${participant.name} (inactive for 5+ minutes)`)

                // Add leave notification
                const leaveNotification = {
                  id: `leave-${id}-${Date.now()}`,
                  type: 'leave' as const,
                  message: `${participant.name} has left the live session`,
                  userId: id,
                  userName: participant.name,
                  timestamp: new Date()
                }

                setNotifications(prevNotifications => [leaveNotification, ...prevNotifications.slice(0, 9)])

                // Show toast notification for organizer
                toast({
                  title: "👋 Participant Left",
                  description: `${participant.name} has left the live session`,
                  duration: 4000,
                })
              }
            }
          }
        })

        // Only return new object if there are actual changes
        return hasChanges ? updated : prev
      })
    }, 30000) // Update every 30 seconds for more responsive detection

    return () => clearInterval(interval)
  }, [participants])

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

  // Enhanced collaborator status monitoring with accurate leave detection
  useEffect(() => {
    if (!session?.id) return

    console.log("🔄 Starting enhanced collaborator status monitoring")

    const collaboratorMonitorInterval = setInterval(() => {
      try {
        const collaboratorDetails = session.collaboratorDetails || []
        const collaboratorCount = collaboratorDetails.length
        const viewerCount = viewers.length

        // Enhanced collaborator presence tracking
        const currentTime = new Date().getTime()
        const activeCollaborators = collaboratorDetails.filter(collaborator => {
          // Check if collaborator has been seen recently (within 3 minutes)
          // Use acceptedAt as the reference point since that's what's available
          const lastSeen = collaborator.acceptedAt
          if (!lastSeen) return true // If no timestamp, assume active

          const timeDiff = currentTime - new Date(lastSeen).getTime()
          return timeDiff < 180000 // 3 minutes - consider active if joined within 3 minutes
        })

        const inactiveCollaborators = collaboratorDetails.filter(collaborator => {
          const lastSeen = collaborator.acceptedAt
          if (!lastSeen) return false

          const timeDiff = currentTime - new Date(lastSeen).getTime()
          return timeDiff >= 180000 // Inactive for 3+ minutes
        })

        // Show notifications for collaborators who left
        inactiveCollaborators.forEach(collaborator => {
          if (collaborator.isOnline !== false) { // Only show notification if not already marked offline
            console.log(`👋 Collaborator left: ${collaborator.name} (inactive for 3+ minutes)`)

            // Add leave notification
            const leaveNotification = {
              id: `collab-leave-${collaborator.uid}-${Date.now()}`,
              type: 'leave' as const,
              message: `Collaborator ${collaborator.name} has left the session`,
              userId: collaborator.uid,
              userName: collaborator.name,
              timestamp: new Date()
            }

            setNotifications(prev => [leaveNotification, ...prev.slice(0, 9)])

            // Show toast notification for organizer
            toast({
              title: "👋 Collaborator Left",
              description: `${collaborator.name} has left the live session`,
              duration: 5000,
            })
          }
        })

        console.log(`📊 Enhanced collaborator sync: ${activeCollaborators.length}/${collaboratorCount} active collaborators, ${viewerCount} viewers`, {
          totalCollaborators: collaboratorCount,
          activeCollaborators: activeCollaborators.length,
          inactiveCollaborators: inactiveCollaborators.length,
          viewers: viewerCount,
          collaborators: collaboratorDetails.map(c => ({
            name: c.name,
            email: c.email,
            uid: c.uid,
            isOnline: c.isOnline,
            acceptedAt: c.acceptedAt
          }))
        })

        // Update participant count to include active collaborators and viewers
        const totalParticipants = viewerCount + activeCollaborators.length
        if (totalParticipants !== participantCount) setParticipantCount(totalParticipants)

      } catch (error) {
        console.error("❌ Error in enhanced collaborator status monitoring:", error)
      }
    }, 30000) // Refresh every 30 seconds for more accurate detection

    // Cleanup interval on unmount or session change
    return () => {
      console.log("🛑 Stopping enhanced collaborator status monitoring")
      clearInterval(collaboratorMonitorInterval)
    }
  }, [session?.id, session?.collaboratorDetails, viewers])

  // Initialize participant count when viewers change
  const [participantCount, setParticipantCount] = useState(0)
  const [previousParticipantCount, setPreviousParticipantCount] = useState(0)

  // Update participant count immediately when viewers change
  useEffect(() => {
    const regularParticipants = viewers.filter((viewer: any) => viewer.role !== 'collaborator').length
    const collaborators = (session?.collaboratorDetails?.length || 0)
    const totalParticipants = regularParticipants + collaborators
    setParticipantCount(totalParticipants)
  }, [viewers, session?.collaboratorDetails])

  // Register current user as viewer with appropriate role
  useEffect(() => {
    if (!session?.id || !user?.uid) return

    const registerCurrentUserAsViewer = async () => {
      try {
        // CRITICAL FIX: Determine if this user is the organizer FIRST
        const isActualOrganizer = session.createdBy === user.uid
        
        // CRITICAL: Do NOT register organizers as viewers AT ALL
        if (isActualOrganizer) {
          console.log("🚫 SKIPPING VIEWER REGISTRATION - USER IS THE ORGANIZER")
          return
        }

        console.log("🎯 REGISTERING CURRENT USER AS VIEWER:", {
          userUid: user.uid,
          userEmail: user.email,
          sessionId: session.id,
          isActualOrganizer: isActualOrganizer,
          isCollaborator: session.collaboratorDetails?.some((collab: any) => collab.uid === user.uid) || session.collaborators?.some((c: any) => c?.email && user.email && c.email === user.email)
        })

        // Determine the correct role - NEVER use 'organizer' role for live-draw-manager viewers
        const isCollaborator = session.collaboratorDetails?.some((collab: any) => collab.uid === user.uid) ||
                              session.collaborators?.some((c: any) => c?.email && user.email && c.email === user.email)
        const role = isCollaborator ? 'collaborator' : 'participant'

        console.log("✅ USER ROLE DETERMINED:", { role, isCollaborator, userId: user.uid })

        // Check if user is already registered
        const existingViewersQuery = query(
          collection(db, "liveDrawSessions", session.id, "viewers"),
          where("userId", "==", user.uid),
          where("isActive", "==", true)
        )

        const existingViewersSnapshot = await getDocs(existingViewersQuery)

        if (!existingViewersSnapshot.empty) {
          // Update existing viewer
          const existingViewerDoc = existingViewersSnapshot.docs[0]
          await updateDoc(doc(db, "liveDrawSessions", session.id, "viewers", existingViewerDoc.id), {
            name: user.displayName || user.email?.split('@')[0] || 'User',
            lastSeen: serverTimestamp(),
            lastActivity: serverTimestamp(),
            isActive: true,
            isOnline: true,
            platform: (typeof navigator !== 'undefined' && navigator?.userAgent?.toLowerCase().includes('mobile')) ? 'mobile' : 'web',
            role: role,
            userId: user.uid
          })
          console.log("✅ UPDATED EXISTING VIEWER REGISTRATION:", { role, userId: user.uid })
        } else {
          // Create new viewer registration
          const viewerId = `user-${user.uid}`
          const platform = typeof navigator !== 'undefined' && navigator?.userAgent ? (navigator.userAgent.toLowerCase().includes('mobile') ? 'mobile' : 'web') : 'web'

          const viewerData = {
            name: user.displayName || user.email?.split('@')[0] || 'User',
            joinedAt: serverTimestamp(),
            isActive: true,
            lastSeen: serverTimestamp(),
            platform: platform,
            connectionId: viewerId,
            userAgent: (typeof navigator !== 'undefined' && navigator?.userAgent) || 'Unknown',
            sessionId: session.id,
            isOnline: true,
            lastActivity: serverTimestamp(),
            role: role,
            userId: user.uid
          }

          await setDoc(doc(db, "liveDrawSessions", session.id, "viewers", viewerId), viewerData)
          console.log("✅ CREATED NEW VIEWER REGISTRATION:", { role, userId: user.uid, viewerData })
        }
      } catch (error) {
        console.error("❌ USER VIEWER REGISTRATION FAILED:", error)
      }
    }

    registerCurrentUserAsViewer()
  }, [session?.id, user?.uid, user?.email, user?.displayName, session?.createdBy, session?.collaboratorDetails, session?.collaborators])

  // Track participant count changes for leave notifications
  useEffect(() => {
    if (previousParticipantCount > 0 && participantCount < previousParticipantCount) {
      const participantsLeft = previousParticipantCount - participantCount
      console.log(`👋 ${participantsLeft} participant(s) left the session`)

      // Show notification for multiple participants leaving
      if (participantsLeft > 1) {
        toast({
          title: "👋 Participants Left",
          description: `${participantsLeft} participants have left the session`,
          duration: 5000,
        })
      }
    }
    setPreviousParticipantCount(participantCount)
  }, [participantCount, previousParticipantCount])

  // Enhanced real-time user presence tracking with accurate leave detection
  useEffect(() => {
    if (!user?.uid || !session?.id) return

    console.log("🔄 Starting enhanced real-time user presence tracking")

    // Set up real-time listener for users collection with presence tracking
    const usersQuery = query(
      collection(db, "users"),
      orderBy("lastActiveAt", "desc"),
      limit(100)
    )

    const unsubscribeUsers = onSnapshot(usersQuery,
      (snapshot) => {
        const users = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          lastActiveAt: doc.data().lastActiveAt?.toDate() || new Date(),
          isOnline: doc.data().isOnline || false
        }))

        setRealUsers(users)

        // Enhanced activity tracking with leave detection
        const newActivity: Record<string, { lastActive: Date; isOnline: boolean; connectionId?: string }> = {}
        const currentTime = new Date().getTime()

        users.forEach(userData => {
          const lastActive = userData.lastActiveAt
          const timeDiff = currentTime - lastActive.getTime()
          const isCurrentlyOnline = timeDiff < 5 * 60 * 1000 // 5 minutes threshold

          // Check if this user was previously tracked as online but now should be offline
          const wasOnline = participantActivity[userData.id]?.isOnline
          if (wasOnline && !isCurrentlyOnline) {
            const userName = (userData as any).displayName || (userData as any).email || `User ${userData.id}`
            console.log(`👋 User left: ${userName} (inactive for 5+ minutes)`)

            // Add leave notification
            const leaveNotification = {
              id: `user-leave-${userData.id}-${Date.now()}`,
              type: 'leave' as const,
              message: `${userName} has left the session`,
              userId: userData.id,
              userName: userName,
              timestamp: new Date()
            }

            setNotifications(prev => [leaveNotification, ...prev.slice(0, 9)])

            // Show toast notification for organizer
            toast({
              title: "👋 User Left",
              description: `${userName} has left the session`,
              duration: 4000,
            })
          }

          newActivity[userData.id] = {
            lastActive: lastActive,
            isOnline: isCurrentlyOnline,
            connectionId: `user-${userData.id}-${Date.now()}`
          }
        })

        setParticipantActivity(newActivity)

        console.log(`👥 Real-time users updated: ${users.length} total, ${Object.values(newActivity).filter(a => a.isOnline).length} online`)
      },
      (error) => {
        console.error("Error fetching users:", error)
        // Fallback to showing added participants if Firestore fails
        setRealUsers([])
      }
    )

    return () => {
      console.log("🛑 Stopping enhanced real-time user presence tracking")
      unsubscribeUsers()
    }
  }, [user?.uid, session?.id]) // Depend on session.id for accurate tracking

  // Separate effect to notify parent about real users changes
  useEffect(() => {
    if (onRealUsersChange && realUsers.length > 0) {
      onRealUsersChange(realUsers)
    }
  }, [realUsers, onRealUsersChange]) // Keep consistent dependency array

  // Listen for pending collaborators (sent invitations that haven't been accepted)
  useEffect(() => {
    if (!session?.id) {
      setPendingCollaborators([])
      return
    }

    console.log("👥 Starting listener for pending collaborators for session:", session.id)

    const pendingQuery = query(
      collection(db, 'liveRoomInvitations'),
      where('sessionId', '==', session.id),
      where('status', '==', 'sent')
    )

    const unsubscribePending = onSnapshot(pendingQuery, (snapshot) => {
      const pending: any[] = []
      snapshot.forEach((doc) => {
        const data = doc.data()
        pending.push({
          id: doc.id,
          email: data.invitedOrganizerEmail,
          invitedByName: data.invitedByName,
          sentAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt),
          expiresAt: data.expiresAt?.toDate ? data.expiresAt.toDate() : new Date(data.expiresAt)
        })
      })

      console.log(`📧 Found ${pending.length} pending collaborator invitations`, {
        pending: pending.map(p => ({ email: p.email, sentBy: p.invitedByName }))
      })

      setPendingCollaborators(pending)
    }, (error) => {
      console.error("❌ Error listening to pending collaborators:", error)
    })

    return () => {
      console.log("🧹 Cleaning up pending collaborators listener")
      unsubscribePending()
    }
  }, [session?.id])

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
        title: activityData?.title || "Live Draw",
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
        wheelType: selectedWheelType?.id || activityData?.wheelType || "team-picker",
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

        // Theme synchronization
        selectedTheme: "default",

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
              collaboratorWheelType: data.collaboratorWheelType,
              selectedTheme: data.selectedTheme
            })

            // Set custom settings from session data
            if (data.customWheelTitle !== undefined) setCustomWheelTitle(data.customWheelTitle)
            if (data.customMessage !== undefined) setCustomMessage(data.customMessage)
            if (data.customWinnerWord !== undefined) setCustomWinnerWord(data.customWinnerWord)
            if (data.allowManualWinnerSelection !== undefined) setAllowManualWinnerSelection(data.allowManualWinnerSelection)
            if (data.collaboratorWheelType !== undefined) setCollaboratorWheelType(data.collaboratorWheelType)
            if (data.selectedTheme !== undefined) setSelectedTheme(data.selectedTheme)
          }

          // Handle real-time theme changes
          if (data.selectedTheme && data.selectedTheme !== selectedTheme) {
            console.log("🎨 Theme changed in real-time:", data.selectedTheme)
            setSelectedTheme(data.selectedTheme)

            toast({
              title: "🎨 Theme Updated!",
              description: `Theme changed to ${data.selectedTheme}`,
            })
          }

          // Fallback: If no selectedWheelType but we have wheelType, try to get it from visible types only
          if (!data.selectedWheelType && data.wheelType && data.wheelType !== 'basic-picker') {
            if (process.env.NODE_ENV === 'development') {
              console.log("🔄 Attempting fallback for wheelType:", data.wheelType)
              console.log("🔍 Available visible wheel types:", visibleWheelTypes.map((w: PickerWheelTypeConfig) => w.id))
            }
            // Only try visible wheel types (from Firestore)
            const fallbackWheelType = visibleWheelTypes.find(w => w.id === data.wheelType)

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

    // Enhanced viewer tracking with accurate leave detection
    const viewersUnsubscribe = onSnapshot(
      collection(db, "liveDrawSessions", sessionId, "viewers"),
      async (snapshot) => {
        console.log(`🔄 VIEWER SNAPSHOT RECEIVED: ${snapshot.docs.length} viewers in Firestore for session ${sessionId}`)
        
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

        console.log(`📊 RAW VIEWER LIST (${viewerList.length} total):`, viewerList.map(v => ({
          id: v.id,
          name: v.name,
          role: v.role,
          isActive: v.isActive,
          platform: v.platform,
          lastSeen: v.lastSeen
        })))
        
        // CRITICAL: Log filtered participants to debug counting issue
        const activeNonOrganizers = viewerList.filter(v => v.role !== 'organizer' && v.isActive !== false)
        console.log(`👥 FILTERED LIVE PARTICIPANTS: ${activeNonOrganizers.length} participants (excluding organizers, including active only)`, activeNonOrganizers.map(v => ({
          name: v.name,
          role: v.role || 'undefined',
          isActive: v.isActive
        })))
        
        // CRITICAL DEBUG: Log FULL viewer objects to see what's happening
        console.log(`🔍 FULL VIEWER OBJECTS:`, JSON.stringify(viewerList, null, 2))

        // Enhanced join/leave detection with previous state comparison
        const currentViewerIds = new Set(viewers?.map(v => v.id) || [])
        const newViewerIds = new Set(viewerList.map(v => v.id))

        // Detect new participants (joined)
        const newViewers = viewerList.filter(viewer => !currentViewerIds.has(viewer.id))

        // Detect left participants (disconnected)
        const leftViewers = viewers?.filter(viewer => !newViewerIds.has(viewer.id)) || []

        // OPTIMIZED: Show join notifications with rate limiting for large groups
        if (newViewers.length <= 5) {
          // For small groups, show individual notifications
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

              // Add join notification to the list
              const joinNotification = {
                id: `join-${viewer.id}-${Date.now()}`,
                type: 'join' as const,
                message: `${viewer.name} has joined the live session`,
                userId: viewer.id,
                userName: viewer.name,
                timestamp: new Date()
              }

              setNotifications(prev => [joinNotification, ...prev.slice(0, 9)])
            }
          })
        } else {
          // For large groups, show bulk notification
          console.log(`🎉 BULK JOIN: ${newViewers.length} participants joined simultaneously`)
          toast({
            title: "🎉 Multiple Participants Joined!",
            description: `${newViewers.length} participants connected to your live session`,
            duration: 5000,
          })

          // Add a single bulk notification
          const bulkJoinNotification = {
            id: `bulk-join-${Date.now()}`,
            type: 'join' as const,
            message: `${newViewers.length} participants joined the live session`,
            userId: 'bulk',
            userName: `${newViewers.length} participants`,
            timestamp: new Date()
          }
          setNotifications(prev => [bulkJoinNotification, ...prev.slice(0, 9)])
        }

        // OPTIMIZED: Show leave notifications with rate limiting for large groups
        if (leftViewers.length <= 5) {
          // For small groups, show individual notifications
          leftViewers.forEach(async (viewer) => {
            if (viewer.name) {
              console.log(`👋 PARTICIPANT LEFT: ${viewer.name} (ID: ${viewer.id}) - CREATING NOTIFICATION`)

              // Add leave notification to the list (local state)
              const leaveNotification = {
                id: `leave-${viewer.id}-${Date.now()}`,
                type: 'leave' as const,
                message: `${viewer.name} has left the live session`,
                userId: viewer.id,
                userName: viewer.name,
                timestamp: new Date()
              }

              setNotifications(prev => [leaveNotification, ...prev.slice(0, 9)])

              // ENHANCED: Create Firestore notification for real-time sync (rate limited)
              try {
                if (session?.id) {
                  await addDoc(collection(db, "liveDrawSessions", session.id, "notifications"), {
                    type: 'leave',
                    message: `${viewer.name} has left the live session`,
                    userId: viewer.id,
                    userName: viewer.name,
                    timestamp: serverTimestamp(),
                    participantName: viewer.name,
                    platform: viewer.platform || 'unknown'
                  })
                  console.log(`📋 FIRESTORE LEAVE NOTIFICATION CREATED: ${viewer.name}`)
                }
              } catch (error) {
                console.error("❌ Failed to create Firestore leave notification:", error)
              }

              // Show toast notification for organizer
              toast({
                title: "👋 Participant Left",
                description: `${viewer.name} has left the live session`,
                duration: 4000,
              })

              // ENHANCED: Show popup notification for participant leave
              setLeavePopupData({
                participantName: viewer.name,
                platform: viewer.platform || 'web',
                reason: 'disconnected'
              })
              setShowLeavePopup(true)
              
              console.log(`🔔 TOAST & POPUP NOTIFICATION SHOWN: ${viewer.name} left`)
            }
          })
        } else {
          // For large groups leaving, show bulk notification
          console.log(`👋 BULK LEAVE: ${leftViewers.length} participants left simultaneously`)
          toast({
            title: "👋 Multiple Participants Left",
            description: `${leftViewers.length} participants have left the live session`,
            duration: 5000,
          })

          // Show a generic bulk leave popup
          setLeavePopupData({
            participantName: `${leftViewers.length} participants`,
            platform: 'multiple',
            reason: 'bulk_disconnect'
          })
          setShowLeavePopup(true)

          // Create bulk Firestore notification
          try {
            if (session?.id) {
              await addDoc(collection(db, "liveDrawSessions", session.id, "notifications"), {
                type: 'leave',
                message: `${leftViewers.length} participants have left the live session`,
                userId: 'bulk-leave',
                userName: `${leftViewers.length} participants`,
                timestamp: serverTimestamp(),
                participantName: `${leftViewers.length} participants`,
                platform: 'multiple',
                reason: 'bulk_disconnect'
              })
              console.log(`📋 BULK LEAVE NOTIFICATION CREATED: ${leftViewers.length} participants`)
            }
          } catch (error) {
            console.error("❌ Failed to create bulk leave notification:", error)
          }
        }

        // Enhanced active viewer filtering with better logic
        const currentTime = new Date().getTime()
        const activeViewerList = viewerList.filter(viewer => {
          // Check if explicitly marked as inactive first
          if (viewer.isActive === false) {
            console.log(`🚫 Participant marked as inactive: ${viewer.name || viewer.id}`)
            return false
          }
          
          const timeDiff = currentTime - viewer.lastSeen.getTime()
          // Consider active if seen in last 2 minutes (more responsive for immediate leave detection)
          const isActiveByTime = timeDiff < 120000 // 2 minutes instead of 5
          
          if (!isActiveByTime) {
            console.log(`⏰ Participant inactive by time: ${viewer.name || viewer.id} (${Math.round(timeDiff/1000)}s ago)`)
          }
          
          return isActiveByTime
        })

        setViewers(activeViewerList)
        
        // CRITICAL DEBUG: Log what was just set to viewers state
        console.log(`✅ SET VIEWERS STATE: ${activeViewerList.length} active viewers`, activeViewerList.map(v => ({
          id: v.id,
          name: v.name,
          role: v.role || 'participant',
          isActive: v.isActive,
          platform: v.platform
        })))

        // Update activeUsers state for the participant management UI
        const activeUsersFromViewers = activeViewerList.map(viewer => {
          const safeViewerName = viewer.name || 'Anonymous User'
          const isCollaborator = viewer.role === 'collaborator'
          return {
            id: viewer.id,
            name: safeViewerName,
            email: isCollaborator && viewer.userId ? `${viewer.userId}@collaborator.local` : `${safeViewerName.toLowerCase().replace(/\s+/g, '.')}@live.session`,
            role: isCollaborator ? 'organizer' : 'student',
            joinedAt: viewer.joinedAt || new Date(),
            permissions: isCollaborator ? ['full_control'] : ['view']
          }
        })

        setActiveUsers(activeUsersFromViewers)

        // Update participant count - COUNT ALL VIEWERS
        // Since organizers are excluded at registration, all viewers are participants
        const totalParticipants = activeViewerList.length
        setParticipantCount(totalParticipants)

        console.log(`👥 PARTICIPANT STATUS UPDATE:`, {
          totalFromFirestore: viewerList.length,
          activeAfterFiltering: activeViewerList.length,
          participantsJoined: newViewers.length,
          participantsLeft: leftViewers.length,
          leftParticipantNames: leftViewers.map(v => v.name || v.id),
          activeParticipantNames: activeViewerList.map(v => v.name || v.id),
          timestamp: new Date().toISOString()
        })

        console.log(`👥 Live participants updated: ${totalParticipants} total participants`, {
          total: viewerList.length,
          active: activeViewerList.length,
          totalParticipants: totalParticipants,
          newJoiners: newViewers.length,
          leavers: leftViewers.length,
          viewers: activeViewerList.map(v => ({
            name: v.name,
            platform: v.platform,
            role: v.role || 'participant',
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

    // Listen to session notifications (participant join/leave, session events)
    const notificationsUnsubscribe = onSnapshot(
      collection(db, "liveDrawSessions", sessionId, "notifications"),
      (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const notificationData = change.doc.data()
            const notification = {
              id: change.doc.id,
              type: notificationData.type,
              message: notificationData.message,
              userId: notificationData.userId,
              userName: notificationData.userName,
              timestamp: notificationData.timestamp?.toDate() || new Date()
            }

            // Show real-time notifications for participant events
            if (notification.type === 'leave') {
              console.log("👋 Participant left notification:", notification)
              toast({
                title: "👋 Participant Left",
                description: `${notification.userName} has left the live session`,
                duration: 3000,
              })
              
              // ENHANCED: Show popup notification for participant leave
              setLeavePopupData({
                participantName: notification.userName || 'Unknown Participant',
                platform: notificationData.platform || 'unknown',
                reason: notificationData.reason || 'unknown'
              })
              setShowLeavePopup(true)
            } else if (notification.type === 'join') {
              console.log("🎉 Participant joined notification:", notification)
              toast({
                title: "🎉 Participant Joined",
                description: `${notification.userName} has joined the live session`,
                duration: 3000,
              })
            }
            // Add to notifications list for display
            setNotifications(prev => [notification, ...prev.slice(0, 9)]) // Keep only last 10 notifications
          }
        })
      },
      (error) => {
        console.error("❌ Error listening to notifications:", error)
      }
    )

    unsubscribeRef.current = () => {
      sessionUnsubscribe()
      viewersUnsubscribe()
      reactionsUnsubscribe()
      notificationsUnsubscribe()
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
        wheelType: session.wheelType || "team-picker",
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
        currentState: "completed",
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
        // Clear our specific participant cleanup interval
        if ((window as any).participantCleanupInterval) {
          clearInterval((window as any).participantCleanupInterval)
          console.log("🧹 Participant cleanup interval cleared")
        }
        
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

    // OPTIMIZED: Set up periodic cleanup for inactive participants (large group friendly)
    const cleanupInterval = setInterval(async () => {
      if (!sessionId) return
      
      try {
        const viewersSnapshot = await getDocs(collection(db, "liveDrawSessions", sessionId, "viewers"))
        const currentTime = new Date().getTime()
        const participantCount = viewersSnapshot.docs.length
        
        // OPTIMIZATION: Adjust cleanup frequency based on participant count
        const cleanupThreshold = participantCount > 50 ? 120000 : // 2 minutes for large groups
                                participantCount > 20 ? 90000 :   // 90 seconds for medium groups
                                60000                             // 60 seconds for small groups
        
        console.log(`🧹 PERIODIC CLEANUP: Checking ${participantCount} participants with ${cleanupThreshold/1000}s threshold`)
        
        let inactiveCount = 0
        const batch = [] // Batch updates for better performance
        
        for (const doc of viewersSnapshot.docs) {
          const viewerData = doc.data()
          const lastSeen = viewerData.lastSeen?.toDate?.() || new Date(viewerData.lastSeen)
          const timeSinceLastSeen = currentTime - lastSeen.getTime()
          
          // If participant hasn't been seen for threshold time and is still marked as active
          if (timeSinceLastSeen > cleanupThreshold && viewerData.isActive !== false && viewerData.name) {
            inactiveCount++
            console.log(`👋 PERIODIC CLEANUP: Marking inactive participant as left: ${viewerData.name} (inactive for ${Math.round(timeSinceLastSeen / 1000)}s)`)
            
            batch.push({
              docRef: doc.ref,
              viewerData: viewerData,
              docId: doc.id
            })
          }
        }
        
        // OPTIMIZATION: Batch process inactive participants for better performance
        if (batch.length > 0) {
          console.log(`🧹 BATCH CLEANUP: Processing ${batch.length} inactive participants`)
          
          // Process in smaller chunks to avoid overwhelming Firestore
          const chunkSize = 10
          for (let i = 0; i < batch.length; i += chunkSize) {
            const chunk = batch.slice(i, i + chunkSize)
            
            // Process chunk concurrently but with controlled concurrency
            await Promise.all(chunk.map(async ({ docRef, viewerData, docId }) => {
              try {
                // Mark as inactive
                await updateDoc(docRef, {
                  isActive: false,
                  isOnline: false,
                  leftAt: serverTimestamp()
                })
                
                // Create leave notification (only for small batches to avoid spam)
                if (batch.length <= 5) {
                  await addDoc(collection(db, "liveDrawSessions", sessionId, "notifications"), {
                    type: 'leave',
                    message: `${viewerData.name} has left the live session`,
                    userId: docId,
                    userName: viewerData.name || 'Anonymous User',
                    timestamp: serverTimestamp(),
                    participantName: viewerData.name,
                    platform: viewerData.platform || 'unknown',
                    reason: 'inactive_timeout'
                  })
                }
              } catch (error) {
                console.warn(`Failed to cleanup participant ${viewerData.name}:`, error)
              }
            }))
            
            // Small delay between chunks to be gentle on Firestore
            if (i + chunkSize < batch.length) {
              await new Promise(resolve => setTimeout(resolve, 100))
            }
          }
          
          // Create bulk notification for large cleanups
          if (batch.length > 5) {
            await addDoc(collection(db, "liveDrawSessions", sessionId, "notifications"), {
              type: 'leave',
              message: `${batch.length} participants have left due to inactivity`,
              userId: 'bulk-cleanup',
              userName: `${batch.length} participants`,
              timestamp: serverTimestamp(),
              participantName: `${batch.length} participants`,
              platform: 'multiple',
              reason: 'bulk_inactive_timeout'
            })
          }
          
          console.log(`📋 PERIODIC CLEANUP COMPLETE: Processed ${batch.length} inactive participants`)
        } else {
          console.log(`✅ PERIODIC CLEANUP: All ${participantCount} participants are active`)
        }
      } catch (error) {
        console.warn("Error in participant cleanup:", error)
      }
    }, 45000) // Check every 45 seconds for better performance balance
    
    // Store cleanup interval for teardown
    ;(window as any).participantCleanupInterval = cleanupInterval
  }

  const generateQRCode = () => {
    if (!session) return

    try {
      // Generate QR code containing ONLY the room code for direct extraction by mobile app
      // This ensures the app scans and reads the room code directly, not a localhost link
      const qrDataUrl = `https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(session.roomCode!)}&color=${schoolColors.primary.replace('#', '')}&bgcolor=ffffff`
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
      // Generate unique change ID for tracking
      const changeId = `wheel-change-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      
      // 🎯 CRITICAL: Check if we have saved items for this wheel type
      const sessionSnap = await getDoc(doc(db, "liveDrawSessions", session.id))
      const sessionData = sessionSnap.exists() ? sessionSnap.data() : null
      const wheelTypesData = (sessionData?.wheelState as any)?.wheelTypesData || {}
      const savedItemsForType = wheelTypesData[newWheelType.id]?.items
      
      // Use saved items if available, otherwise use defaults
      const wheelItemsToUse = savedItemsForType && savedItemsForType.length > 0 
        ? savedItemsForType 
        : newWheelType.defaultItems
      
      console.log(`🔄 SWITCHING TO ${newWheelType.id}:`, {
        hasSavedItems: !!savedItemsForType,
        itemCount: wheelItemsToUse.length,
        items: wheelItemsToUse
      })
      
      // Update session with new wheel type and correct items
      await updateDoc(doc(db, "liveDrawSessions", session.id), {
        wheelType: newWheelType.id,
        wheelTitle: newWheelType.title,
        wheelItems: wheelItemsToUse,
        selectedWheelType: newWheelType,
        wheelIcon: newWheelType.icon,
        wheelDescription: newWheelType.description,
        wheelCategory: newWheelType.category,
        'wheelState.wheelTypeChangeId': changeId,
        'wheelState.wheelTypeChangedAt': Date.now(),
        'wheelState.wheelItems': wheelItemsToUse,
        'wheelState.customItems': wheelItemsToUse,
        'wheelState.clearWinners': true,
        winners: [],
        currentState: 'waiting',
        isSpinning: false,
        updatedAt: serverTimestamp()
      })

      // Update local cached state
      setCachedWheelType(newWheelType)
      
      // Update local editable items immediately
      setEditableItemsByWheelType(prev => ({
        ...prev,
        [newWheelType.id]: [...wheelItemsToUse]
      }))

      toast({
        title: "🎯 Wheel Type Changed!",
        description: `Session updated to ${newWheelType.title}`,
      })

      console.log("✅ Wheel type changed via participant request:", {
        from: cachedWheelType?.id,
        to: newWheelType.id,
        sessionId: session.id,
        itemsRestored: !!savedItemsForType
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

  // NEW: Invite specific collaborator by email
  const inviteCollaborator = async () => {
    if (!collaboratorEmail.trim()) {
      toast({
        title: "Email Required",
        description: "Please enter a collaborator email address",
        variant: "destructive"
      })
      return
    }

    if (!session?.id) {
      toast({
        title: "No Active Session",
        description: "Please start a live session first",
        variant: "destructive"
      })
      return
    }

    setIsInvitingCollaborator(true)

    try {
      console.log("📧 Sending collaborator invitation:", {
        email: collaboratorEmail.trim(),
        sessionId: session.id,
        userUid: user.uid
      })

      // Create collaborator invitation matching the LiveRoomInvitation interface
      const invitationData = {
        sessionId: session.id,
        invitedOrganizerEmail: collaboratorEmail.trim().toLowerCase(), // Use invitedOrganizerEmail to match listener query
        invitedBy: user.uid,
        invitedByName: user.displayName || user.email?.split('@')[0] || 'Organizer',
        invitedByEmail: user.email || undefined,
        status: 'sent' as const,
        type: 'live_room_invitation' as const,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        sessionTitle: session.title || 'Live Draw',
        sessionDescription: 'Join me for a collaborative wheel drawing session',
        wheelType: session.wheelType || 'team-picker',
        wheelTitle: session.wheelTitle || 'Live Wheel',
        wheelIcon: '🎯',
        roomCode: session.roomCode || '',
        sessionConfig: {
          maxParticipants: 50,
          allowReactions: true,
          confettiEffect: true,
          soundEffects: true,
          liveSession: true,
          allowDataSync: true
        },
        permissions: collaboratorPermissionLevel === 'full_access' ? {
          canControlLive: true,
          canEditWheel: true,
          canManageParticipants: true,
          canEndSession: false,
          canInviteOthers: false
        } : {
          canControlLive: false,
          canEditWheel: false,
          canManageParticipants: false,
          canEndSession: false,
          canInviteOthers: false
        },
        isRealTimeNotification: true,
        priority: 'high' as const,
        requiresImmediateAttention: true
      }

      console.log("💾 Saving invitation to database:", invitationData)
      await addDoc(collection(db, "liveRoomInvitations"), invitationData)

      console.log("✅ Collaborator invitation saved to database")

      // Send email notification
      try {
        const emailContent = {
          to: collaboratorEmail.trim(),
          subject: `You're invited to collaborate on "${session.title}"`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #8e0b16;">🎯 Session Collaboration Invite</h2>
              <p>Hi there,</p>
              <p>You've been invited to collaborate on the live session: <strong>${session.title}</strong></p>

              <div style="background-color: #f8f9fa; padding: 20px; margin: 20px 0; border-radius: 8px;">
                <h3 style="margin-top: 0;">Session Details:</h3>
                <p><strong>Room Code:</strong> ${session.roomCode}</p>
                <p><strong>Organizer:</strong> ${user.displayName || user.email || 'Organizer'}</p>
                <p><strong>Link:</strong> <a href="${session.shareUrl}" target="_blank">${session.shareUrl}</a></p>
              </div>

              <p>As a collaborator with <strong>{collaboratorPermissionLevel === 'full_access' ? 'full access' : 'view-only'}</strong> permissions, you'll be able to:</p>
              <ul>
                {collaboratorPermissionLevel === 'full_access' ? (
                  <>
                    <li>Control the wheel (spin, pause, reset)</li>
                    <li>Edit wheel settings and items</li>
                    <li>Manage participants</li>
                  </>
                ) : (
                  <>
                    <li>Watch the live session in real-time</li>
                    <li>View participant reactions and feedback</li>
                    <li>Observe but not interact with the wheel</li>
                  </>
                )}
              </ul>

              <div style="text-align: center; margin: 30px 0;">
                <a href="${session.shareUrl}" style="background-color: #8e0b16; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Join Session</a>
              </div>

              <p style="color: #666; font-size: 14px;">
                This invitation expires in 7 days. If you have any questions, contact the session organizer.
              </p>
            </div>
          `,
          text: `You've been invited to collaborate on "${session.title}". Room code: ${session.roomCode}. Join here: ${session.shareUrl}`
        }

        // Send the email using the email service
        await fetch('/api/send-email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(emailContent),
        })

        console.log("📧 Collaborator invitation email sent to:", collaboratorEmail)
      } catch (emailError) {
        console.warn("Failed to send email notification:", emailError)
        // Don't fail the invitation if email fails - we've saved the invitation successfully
      }

      toast({
        title: "✅ Invitation Sent!",
        description: `Collaborator invitation sent to ${collaboratorEmail}`,
      })

      // Clear the input and close dialog
      setCollaboratorEmail("")
      setIsSendCodesDialogOpen(false)
    } catch (error) {
      console.error("Error inviting collaborator:", error)
      toast({
        title: "Error",
        description: "Failed to send collaborator invitation",
        variant: "destructive"
      })
    } finally {
      setIsInvitingCollaborator(false)
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
                    disabled={isChangingWheelType}
                    onValueChange={async (wheelId) => {
                      // Prevent rapid changes
                      if (isChangingWheelType) return
                      
                      // Look for wheel in both visible wheel types and fallback to static types
                      let selectedWheel = visibleWheelTypes.find(w => w.id === wheelId)
                      if (!selectedWheel) {
                        selectedWheel = PICKER_WHEEL_TYPES.find(w => w.id === wheelId)
                      }

                      if (selectedWheel && session?.id) {
                        // Generate unique change ID for this wheel type change
                        const changeId = `wheel-change-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
                        
                        // STEP 1: INSTANT UI UPDATE - Update all UI state immediately (optimistic)
                        const wheelEditableItems = editableItemsByWheelType[wheelId] || selectedWheel.defaultItems || []
                        
                        console.log(`⚡ ATOMIC WHEEL CHANGE: ${selectedWheel.title}`, {
                          wheelId,
                          changeId,
                          itemCount: wheelEditableItems.length,
                          timestamp: new Date().toISOString()
                        })
                        
                        // 🎯 ATOMIC UPDATE: All state changes in single batch for instant UI
                        setCachedWheelType(selectedWheel)
                        setWheelTypeChangeId(changeId)
                        setEditableItems(wheelEditableItems)
                        setShowWinnerPopup(false)
                        setIsProcessingWinners(false)
                        setLastWinnerTimestamp(0)
                        setWinners([])
                        setIsChangingWheelType(true)
                        
                        // Update session state immediately with wheelState for instant sync
                        setSession(prev => prev ? {
                          ...prev,
                          selectedWheelType: selectedWheel,
                          wheelItems: wheelEditableItems,
                          wheelState: {
                            ...(prev.wheelState || {}),
                            wheelItems: wheelEditableItems,
                            customItems: wheelEditableItems,
                            wheelTypeId: wheelId,
                            wheelTypeChangeId: changeId,
                            wheelTypeChangedAt: Date.now()
                          },
                          winners: [],
                          currentState: 'waiting' as const,
                          isSpinning: false
                        } : null)
                        
                        console.log(`⚡ INSTANT: Wheel type changing to ${selectedWheel.title} with changeId: ${changeId}`)

                        // STEP 2: FIREBASE UPDATE - Background sync (non-blocking)
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
                            wheelItems: wheelEditableItems,
                            customWheelTitle: customWheelTitle,
                            customMessage: customMessage,
                            customWinnerWord: customWinnerWord,
                            allowManualWinnerSelection: allowManualWinnerSelection,
                            collaboratorWheelType: collaboratorWheelType,
                            // 🎯 CRITICAL: Clear winners when changing wheel type
                            winners: [],
                            currentState: 'waiting',
                            isSpinning: false,
                            // 🎯 ATOMIC SYNC: Update wheelState with unique change ID for tracking
                            wheelState: {
                              isSpinning: false,
                              winners: [],
                              completedAt: null,
                              wheelItems: wheelEditableItems,
                              customItems: wheelEditableItems,
                              wheelTypeId: selectedWheel.id,
                              wheelTypeChangeId: changeId,
                              wheelTypeChangedAt: Date.now(),
                              clearWinners: true,
                              forceUpdate: Date.now()
                            },
                            updatedAt: serverTimestamp(),
                            // Add flag to prevent listener loops
                            lastWheelTypeChange: Date.now()
                          })

                          console.log(`✅ SYNCED: Wheel type "${selectedWheel.title}" saved to Firebase`)

                          toast({
                            title: "✅ Wheel Type Changed!",
                            description: `Now using "${selectedWheel.title}"`,
                          })
                        } catch (error) {
                          console.error("❌ Error updating wheel type:", error)
                          
                          // Revert optimistic update on error
                          if (session.selectedWheelType) {
                            setCachedWheelType(session.selectedWheelType as any)
                          }
                          
                          toast({
                            title: "Update Failed",
                            description: "Could not update wheel type. Please try again.",
                            variant: "destructive"
                          })
                        } finally {
                          // Clear changing state immediately - UI already updated
                          setIsChangingWheelType(false)
                        }
                      }
                    }}
                  >
                    <SelectTrigger className="w-full sm:w-36 text-sm bg-white/20 border-white/30 text-white hover:bg-white/30 transition-colors">
                      <SelectValue placeholder="Change wheel type">
                        {isChangingWheelType ? (
                          <span className="flex items-center gap-2">
                            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                            Changing...
                          </span>
                        ) : undefined}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {/* Show loading state for wheel types */}
                      {wheelTypesLoading ? (
                        <SelectItem value="loading" disabled>
                          Loading wheel types...
                        </SelectItem>
                      ) : (
                        /* Show visible wheel types based on user role and admin overrides */
                        visibleWheelTypes
                          .map((wheelType) => (
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
              
              <div className="flex justify-center">
                <div className="w-full max-w-none">
                  {/* Show Team Picker only for team-picker wheel type */}
                  {(session.selectedWheelType?.id === 'team-picker' || session.wheelType === 'team-picker') && (
                    <EnhancedTeamPicker
                      initialNames={session.selectedWheelType?.defaultItems || session.participants?.map(p => p.name) || []}
                      canEdit={hasEditAccess}
                      onTeamsGenerated={async (teams) => {
                        toast({
                          title: "Teams Generated! 🎉",
                          description: `Created ${teams.length} teams from ${session.participants?.length || 0} participants`,
                        })
                        console.log("🎯 Teams generated and synchronized:", teams.length, "teams")
                        
                        // CRITICAL FIX: Ensure teams are saved to Firebase for participant sync
                        if (session?.id && teams.length > 0) {
                          try {
                            console.log("🎯 ORGANIZER: Saving teams to Firebase for participant sync", {
                              sessionId: session.id,
                              teamsCount: teams.length,
                              firstTeamName: teams[0]?.name || 'Unknown',
                              timestamp: new Date().toISOString()
                            })

                            // CRITICAL FIX: Clean all data before Firebase update to prevent undefined errors
                            const cleanUndefinedValues = (obj: any): any => {
                              if (obj === null || obj === undefined) return null
                              if (typeof obj !== 'object') return obj
                              
                              if (Array.isArray(obj)) {
                                return obj.map(item => cleanUndefinedValues(item)).filter(item => item !== null && item !== undefined)
                              }
                              
                              const cleaned: any = {}
                              Object.entries(obj).forEach(([key, value]) => {
                                const cleanedValue = cleanUndefinedValues(value)
                                if (cleanedValue !== null && cleanedValue !== undefined) {
                                  cleaned[key] = cleanedValue
                                }
                              })
                              return cleaned
                            }

                            // Get and clean wheelState, removing undefined values
                            const lastWheelState = (typeof window !== 'undefined' ? (window as any).lastWheelState : {}) || {}
                            const cleanedWheelState = cleanUndefinedValues(lastWheelState)
                            const cleanedTeams = cleanUndefinedValues(teams)

                            // Prepare clean update data with proper structure
                            const updateData = {
                              teams: cleanedTeams,
                              wheelState: {
                                ...cleanedWheelState,
                                teams: cleanedTeams,
                                teamDistribution: true,
                                revealedTeams: cleanedTeams.length,
                                teamsGeneratedAt: new Date() // Use Date instead of serverTimestamp() for nested objects
                              },
                              updatedAt: serverTimestamp()
                            }

                            console.log("🧹 ORGANIZER: Cleaned data for Firebase update", {
                              hasTeams: !!updateData.teams,
                              teamsCount: updateData.teams?.length || 0,
                              hasWheelState: !!updateData.wheelState,
                              hasLastWheelState: !!cleanedWheelState,
                              wheelStateKeys: Object.keys(updateData.wheelState || {}),
                              timestamp: new Date().toISOString()
                            })

                            await updateDoc(doc(db, "liveDrawSessions", session.id), updateData)

                            console.log("🎯 ORGANIZER: Teams saved to Firebase successfully", {
                              sessionId: session.id,
                              teamsCount: cleanedTeams.length,
                              timestamp: new Date().toISOString()
                            })
                          } catch (error) {
                            console.error("❌ ORGANIZER: Failed to sync teams to Firebase:", error)
                            console.error("❌ Full error details:", {
                              message: (error as any)?.message,
                              code: (error as any)?.code,
                              stack: (error as any)?.stack
                            })
                            toast({
                              title: "Sync Error",
                              description: `Failed to sync teams with participants: ${(error as any)?.message || 'Unknown error'}. Please try again.`,
                              variant: "destructive"
                            })
                          }
                        }
                      }}
                      disabled={session.currentState === "ended" || hasViewOnly}
                      readonly={hasViewOnly}
                      isParticipantView={false}
                      sessionId={session.id} // FIXED: Use actual session ID for proper Firebase sync
                      liveTeams={[]} // Organizer doesn't need live teams prop
                    />
                  )}

                  {/* Show Image Picker Wheel for image-picker wheel type */}
                  {(session.selectedWheelType?.id === 'image-picker' || session.wheelType === 'image-picker') && (
                    <ImagePickerWheel
                      slices={session.imageWheelSlices || (session.wheelItems ? session.wheelItems.map((item: string, index: number) => ({
                        id: `slice-${index}`,
                        text: item,
                        color: index % 2 === 0 ? "#8e0b16" : "#66181E"
                      })) : [])}
                      onSpinComplete={(result) => {
                        console.log("🎯 ORGANIZER Image Picker Wheel spin completed:", result)
                        toast({
                          title: "🎉 Image Winner Selected!",
                          description: `${result.winners?.[0]?.name || 'Winner'} selected from image wheel`,
                        })
                      }}
                      isLiveMode={true}
                      sessionId={session.id}
                      disabled={session.currentState === "ended" || hasViewOnly}
                      wheelTitle={customWheelTitle || session.selectedWheelType?.title || session.wheelTitle || 'Image Picker Wheel'}
                      enableRealTimeSync={enableRealTimeSync}
                      organizerMode={session.createdBy === user.uid || isActualOrganizer || hasFullAccess}
                      userPermissions={{
                        isFullAccessCollaborator: hasFullAccess && isCollaborator && !isActualOrganizer,
                        canTriggerSynchronizedSpin: (session.createdBy === user.uid || isActualOrganizer) ||
                          (isCollaborator && (hasFullAccess || collaboratorRole === 'organizer')),
                        synchronizationEnabled: enableRealTimeSync && !!session?.id,
                        sessionId: session?.id,
                        userRole: userRole || 'collaborator'
                      }}
                      useEnhancedSpinning={false}
                    />
                  )}

                  {/* Show EnhancedWheel for all other wheel types except team-picker and image-picker */}
                  {(session.selectedWheelType?.id !== 'team-picker' && session.wheelType !== 'team-picker' &&
                    session.selectedWheelType?.id !== 'image-picker' && session.wheelType !== 'image-picker') && (
                    <div className="relative">
                      {/* 🎯 STABILITY: Loading overlay for smooth updates */}
                      {session.isUpdating && (
                        <div className="absolute inset-0 bg-white/50 backdrop-blur-sm z-10 flex items-center justify-center rounded-lg">
                          <div className="bg-white p-4 rounded-lg shadow-lg">
                            <div className="flex items-center gap-3">
                              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#8e0b16]"></div>
                              <span className="text-sm font-medium text-gray-700">Updating wheel...</span>
                            </div>
                          </div>
                        </div>
                      )}
                      <EnhancedWheel
                      key={`wheel-${currentWheelTypeId}`}
                      participants={wheelParticipants}
                    // 🎯 CRITICAL FIX: Add customItems prop for instant item sync
                    customItems={wheelCustomItems}
                    customWinnerWord={customWinnerWord}
                    onSpinComplete={handleSpinComplete}
                    // CRITICAL FIX: Add onWinnersDetected callback to handle winner announcements
                    onWinnersDetected={async (winners) => {
                      const currentTime = Date.now()

                      // Prevent winner announcement loops by checking if we're already processing
                      if (isProcessingWinners || (currentTime - lastWinnerTimestamp) < 2000) {
                        console.log("🚫 Preventing winner announcement loop", {
                          isProcessingWinners,
                          timeSinceLastWinner: currentTime - lastWinnerTimestamp,
                          currentTime,
                          lastWinnerTimestamp
                        })
                        return
                      }

                      console.log("🎯 Winners detected by EnhancedWheel:", winners)

                      if (!winners || winners.length === 0) {
                        console.warn("⚠️ No winners detected")
                        return
                      }

                      try {
                        // Set processing flag to prevent loops
                        setIsProcessingWinners(true)
                        setLastWinnerTimestamp(currentTime)

                        // Create winner objects with proper structure
                        const winnerObjects = winners.map(winner => ({
                          id: winner.id || `winner-${Date.now()}-${Math.random()}`,
                          name: winner.name,
                          email: winner.email || undefined
                        }))

                        console.log("🔄 Updating local session state for immediate winner popup", {
                          winnerCount: winnerObjects.length,
                          winnerNames: winnerObjects.map(w => w.name)
                        })

                        // CRITICAL FIX: Update local session state FIRST for immediate popup display
                        setLiveSession(prev => {
                          if (!prev) return prev
                          return {
                            ...prev,
                            winners: winnerObjects,
                            currentState: 'completed' as const,
                            isSpinning: false
                          }
                        })

                        // Update session with winners
                        if (session?.id) {
                          // Sanitize all data to prevent Firebase undefined field errors
                          const sanitizedWinnerWord = customWinnerWord || 'Winner'
                          const sanitizedMessage = customMessage || "🎉 Congratulations {name}! 🎊"

                          const updateData = {
                            winners: winnerObjects,
                            currentState: "completed",
                            isSpinning: false,
                            updatedAt: serverTimestamp(),
                            resultNotification: {
                              message: winnerObjects.length === 1
                                ? sanitizedMessage.replace('{name}', winnerObjects[0].name).replace('{winner}', sanitizedWinnerWord.toLowerCase())
                                : `🎉 ${sanitizedWinnerWord}s: ${winnerObjects.map(w => w.name).join(', ')}!`,
                              winners: winnerObjects,
                              timestamp: serverTimestamp(),
                              isActive: true,
                              showConfetti: true,
                              priority: "immediate",
                              customWinnerWord: sanitizedWinnerWord
                            }
                          }

                          // Clean the data to remove any undefined values
                          const cleanData = (data: any): any => {
                            if (data === null || data === undefined) return null
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

                          const sanitizedUpdateData = cleanData(updateData)
                          console.log("🔍 SANITIZED UPDATE DATA:", JSON.stringify(sanitizedUpdateData, null, 2))

                          // Ensure no undefined values are sent to Firebase
                          const cleanUpdateData = JSON.parse(JSON.stringify(sanitizedUpdateData))
                          await updateDoc(doc(db, "liveDrawSessions", session.id), cleanUpdateData)

                            console.log("✅ Winners saved to session and notification sent:", {
                              winnerCount: winnerObjects.length,
                              winnerNames: winnerObjects.map(w => w.name),
                              sessionId: session.id
                            })

                            // Show winner popup only if not already shown
                                if (!showWinnerPopup) {
                                  setShowWinnerPopup(true)
                                }

                            toast({
                              title: "🎉 Winners Announced!",
                              description: `${winnerObjects.length} winner(s) selected and notified`,
                            })
                          }
                        } catch (error) {
                          console.error("❌ Error handling winners:", error)
                          toast({
                            title: "Error",
                            description: "Failed to announce winners",
                            variant: "destructive"
                          })
                        } finally {
                          // Clear the processing flag after a delay to allow for UI updates
                          setTimeout(() => {
                            setIsProcessingWinners(false)
                          }, 1000)
                        }
                      }}
                    isLiveMode={true}
                    sessionId={session.id}
                    disabled={false}
                    selectedWheelType={cachedWheelType as any}
                    wheelTitle={customWheelTitle || cachedWheelType?.title || session.selectedWheelType?.title || session.wheelTitle || session.title}
                    enableRealTimeSync={enableRealTimeSync}
                    // FIX: Override participant mode based on collaborator permissions
                    // ENHANCED: Full access collaborators get complete organizer control for synchronized spinning
                    organizerMode={session.createdBy === user.uid || isActualOrganizer || hasFullAccess}
                    studentMode={participantMode && !(session.createdBy === user.uid || isActualOrganizer || hasFullAccess) && hasViewOnly}
                    // Pass spin mode and number of winners from Custom Settings - per wheel type
                    spinModeByWheelType={spinModeByWheelType}
                    numberOfWinnersByWheelType={numberOfWinnersByWheelType}
                    numberOfWinners={currentNumberOfWinners}

                    // CRITICAL FIX: Pass isSpinning state as externalIsSpinning for collaborator synchronization
                    isSpinning={isSpinning}

                    // 🔥 CONSISTENT: Hide wheel text based on numberOfWinners setting (when 2+ winners selected)
                    // Text stays hidden during spin and only reveals after spin completes
                    hideWheelText={currentNumberOfWinners >= 2}
                    showWheelTextOnCompletion={currentNumberOfWinners >= 2}

                    // ENHANCED: Ensure real-time synchronization for organizers and organizer collaborators
                    userPermissions={{
                      isFullAccessCollaborator: hasFullAccess && isCollaborator && !isActualOrganizer,
                      // Allow synchronized spinning for organizers and organizer collaborators
                      canTriggerSynchronizedSpin: (session.createdBy === user.uid || isActualOrganizer) ||
                        (isCollaborator && (hasFullAccess || collaboratorRole === 'organizer')),
                      synchronizationEnabled: enableRealTimeSync && !!session?.id,
                      sessionId: session?.id,
                      userRole: userRole || 'collaborator'
                    }}
                    onSettingsChange={(settings: any) => {
                      // Update congratulations message if it's an Image Picker Wheel
                      if (cachedWheelType?.id === 'image-picker' && sessionSettings.customCongratsMessage) {
                        setSessionSettings(prev => ({
                          ...prev,
                          customCongratsMessage: settings.congratsMessage || prev.customCongratsMessage
                        }))
                      }

                      // Update session settings in Firebase if we have an active session
                      if (session?.id) {
                        updateDoc(doc(db, "liveDrawSessions", session.id), {
                          settings: {
                            ...session.settings,
                            ...settings
                          },
                          updatedAt: serverTimestamp()
                        }).catch(error => {
                          console.error("Error updating settings:", error)
                        })
                      }
                    }}
                    // 🎨 Pass the theme to the EnhancedWheel component
                    wheelTheme={(() => {
                      // Get theme from session data - prioritize wheelState.theme for real-time sync
                      const sessionTheme = session?.wheelState?.theme || session?.selectedTheme

                      console.log("🎨 LIVE DRAW MANAGER - PASSING THEME TO WHEEL:", {
                        sessionTheme: sessionTheme,
                        selectedTheme: session?.selectedTheme,
                        wheelStateTheme: session?.wheelState?.theme,
                        sessionId: session?.id,
                        timestamp: new Date().toISOString()
                      })

                      // If session has theme data, use it
                      if (sessionTheme && typeof sessionTheme === 'object' && sessionTheme !== null) {
                        const themeObj = sessionTheme as any
                        const themeResult = {
                          primary: themeObj.primaryColor || themeObj.primary || "#8e0b16",
                          secondary: themeObj.secondaryColor || themeObj.secondary || "#66181E",
                          accent: themeObj.accentColor || themeObj.accent || "#ffffff",
                          background: themeObj.backgroundColor || themeObj.background || "#ffffff"
                        }

                        console.log("🎨 USING SESSION THEME OBJECT:", themeResult)
                        return themeResult
                      }

                      // If session has theme name, get colors for it
                      if (typeof sessionTheme === 'string') {
                        const themeColors = getThemeColors(sessionTheme)
                        const themeResult = {
                          primary: themeColors.primary,
                          secondary: themeColors.secondary,
                          accent: themeColors.accent,
                          background: themeColors.background
                        }

                        console.log("🎨 USING SESSION THEME NAME:", {
                          themeName: sessionTheme,
                          themeColors: themeResult
                        })
                        return themeResult
                      }

                      // Default theme
                      const defaultTheme = {
                        primary: "#8e0b16",
                        secondary: "#66181E",
                        accent: "#ffffff",
                        background: "#ffffff"
                      }

                      console.log("🎨 USING DEFAULT THEME:", defaultTheme)
                      return defaultTheme
                    })()}
                  />
                    </div>
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
                  session.currentState === "spinning" ? "default" :
                  session.currentState === "completed" ? "default" : "destructive"
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
                  <span>📱 Invite Participant</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={generateQRCode}
                    className="flex items-center justify-center gap-1 text-xs border-2 hover:bg-gray-50 transition-colors h-7"
                    style={{borderColor: '#8e0b16', color: '#8e0b16'}}
                  >
                    <QrCode className="h-3 w-3" />
                    QR Code
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => setIsSendCodesDialogOpen(true)}
                    className="text-white text-xs px-2 py-1 hover:opacity-90 transition-opacity h-7"
                    style={{backgroundColor: '#8e0b16'}}
                  >
                    📧 Invite
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-1 sm:gap-2 pt-2 sm:pt-3 border-t border-gray-200">
                <div className="text-center p-1.5 sm:p-2 bg-gray-50 rounded-lg border">
                  <div className="text-sm sm:text-base font-bold" style={{color: '#8e0b16'}}>{session.participants?.length || 0}</div>
                  <div className="text-xs text-gray-600">Items</div>
                </div>
                <div className="text-center p-1.5 sm:p-2 bg-gray-50 rounded-lg border">
                  <div className="text-sm sm:text-base font-bold" style={{color: '#8e0b16'}}>{viewers?.length || 0}</div>
                  <div className="text-xs text-gray-600">Viewers</div>
                </div>
                <div className="text-center p-1.5 sm:p-2 bg-gray-50 rounded-lg border">
                  <div className="text-sm sm:text-base font-bold" style={{color: '#8e0b16'}}>{session.winners?.length || 0}</div>
                  <div className="text-xs text-gray-600">Selected</div>
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
                  {viewers.filter((v: any) => v.role !== 'collaborator').length === 0 ? 
                    "No participants have joined yet" : 
                    `Live Participants (${viewers.filter((v: any) => v.role !== 'collaborator').length})`
                  }
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-2 sm:p-3">
              {/* Show collaborators who have actually joined the session (role=collaborator in viewers) */}
              {viewers.filter((v: any) => v.role === 'collaborator').length > 0 && (
                <div className="mb-4 space-y-2">
                  <div className="text-xs font-semibold text-gray-700 flex items-center gap-2">
                    <Crown className="h-3 w-3 text-yellow-600" />
                    Collaborators ({viewers.filter((v: any) => v.role === 'collaborator').length})
                  </div>
                  {viewers
                    .filter((v: any) => v.role === 'collaborator')
                    .map((collaborator: any) => {
                      const isWebUser = !collaborator.platform || collaborator.platform === 'web'
                      const isMobileUser = collaborator.platform === 'mobile' || collaborator.platform === 'app'
                      const currentTime = new Date().getTime()
                      const timeDiff = currentTime - (collaborator.lastSeen?.getTime() || new Date().getTime())
                      const isActiveNow = timeDiff < 30000 // Active if seen in last 30 seconds
                      
                      return (
                        <div 
                          key={`collaborator-${collaborator.id}`} 
                          className={`flex items-center justify-between p-2 rounded-lg border-2 transition-all ${
                            isActiveNow ? 'shadow-md animate-pulse' : ''
                          }`}
                          style={{
                            backgroundColor: isActiveNow ? 'rgba(255, 215, 0, 0.2)' : 'rgba(255, 215, 0, 0.1)', 
                            borderColor: isActiveNow ? '#FFD700' : 'rgba(255, 215, 0, 0.5)'
                          }}
                        >
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${isActiveNow ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`}></div>
                            <Crown className="h-3 w-3 text-yellow-600" />
                            <span className="font-medium text-sm text-yellow-800">
                              {collaborator.name || 'Collaborator'}
                            </span>
                            {/* Platform Badge */}
                            {isMobileUser && (
                              <Badge variant="secondary" className="px-1 py-0 text-xs bg-blue-100 text-blue-700 flex items-center gap-1">
                                <Smartphone className="h-2.5 w-2.5" />
                                App
                              </Badge>
                            )}
                            {isWebUser && (
                              <Badge variant="secondary" className="px-1 py-0 text-xs bg-purple-100 text-purple-700 flex items-center gap-1">
                                <Monitor className="h-2.5 w-2.5" />
                                Web
                              </Badge>
                            )}
                            {/* Active Status */}
                            {isActiveNow && (
                              <Badge variant="secondary" className="px-1 py-0 text-xs bg-green-100 text-green-700">
                                Active
                              </Badge>
                            )}
                          </div>
                          <div className="text-xs text-yellow-600">
                            {collaborator.joinedAt ? getTimeAgo(new Date(collaborator.joinedAt)) : 'Just joined'}
                          </div>
                        </div>
                      )
                    })}
                </div>
              )}

              {/* Regular participants (non-collaborators and non-organizers) */}
              {/* CRITICAL FIX: Show ALL viewers regardless of role (organizers already excluded from registration) */}
              {viewers.filter((v: any) => v.role !== 'collaborator').length === 0 ? (
                <div className="text-center py-3 text-gray-500">
                  <div className="p-3 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                    <Users className="h-8 w-8 mx-auto mb-2 opacity-50" style={{color: '#8e0b16'}} />
                    <p className="text-xs font-medium mb-1" style={{color: '#8e0b16'}}>No participants have joined yet</p>
                    <p className="text-xs text-gray-600">Share the room code: </p>
                    <span className="font-mono font-bold text-sm" style={{color: '#8e0b16'}}>{session.roomCode}</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-gray-700 flex items-center gap-2">
                    <Users className="h-3 w-3" />
                    Participants ({viewers.filter((v: any) => v.role !== 'collaborator').length})
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-1.5">
                    {(() => {
                      const regularParticipants = viewers.filter((viewer: any) => viewer.role !== 'collaborator')
                      const participantCount = regularParticipants.length
                      
                      // OPTIMIZATION: For large groups (50+), show condensed view
                      if (participantCount > 50) {
                        return (
                          <div className="space-y-2">
                            {/* Show first 5 participants */}
                            {regularParticipants.slice(0, 5).map((viewer) => {
                              const viewerData = viewer as any
                              const isWebUser = !viewerData.platform || viewerData.platform === 'web'
                              const isMobileUser = viewerData.platform === 'mobile' || viewerData.platform === 'app'
                              const currentTime = new Date().getTime()
                              const timeDiff = currentTime - (viewer.lastSeen?.getTime() || new Date().getTime())
                              const isActiveNow = timeDiff < 30000 // Active if seen in last 30 seconds
                              
                              return (
                                <div 
                                  key={`viewer-${viewer.id}`} 
                                  className="flex items-center justify-between p-1.5 rounded-lg border transition-all"
                                  style={{
                                    backgroundColor: isActiveNow ? 'rgba(142, 11, 22, 0.1)' : 'rgba(142, 11, 22, 0.05)', 
                                    borderColor: isActiveNow ? '#8e0b16' : 'rgba(142, 11, 22, 0.3)'
                                  }}
                                >
                                  <div className="flex items-center gap-2">
                                    <div className={`w-1.5 h-1.5 rounded-full ${isActiveNow ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                                    <span className="font-medium text-xs" style={{color: '#8e0b16'}}>
                                      {viewer.name || 'Anonymous User'}
                                    </span>
                                    <Badge variant="secondary" className="px-1 py-0 text-xs bg-gray-100 text-gray-600">
                                      {isMobileUser ? '📱' : '💻'}
                                    </Badge>
                                  </div>
                                </div>
                              )
                            })}
                            
                            {/* Show summary for remaining participants */}
                            {participantCount > 5 && (
                              <div className="p-2 bg-gray-100 rounded-lg border-dashed border">
                                <div className="text-center text-xs text-gray-600">
                                  <p className="font-semibold">+ {participantCount - 5} more participants</p>
                                  <p className="mt-1">
                                    {regularParticipants.filter(v => {
                                      const timeDiff = new Date().getTime() - (v.lastSeen?.getTime() || new Date().getTime())
                                      return timeDiff < 30000
                                    }).length - 5} active, {regularParticipants.filter(v => v.platform === 'web').length} web, {regularParticipants.filter(v => v.platform === 'mobile' || v.platform === 'app').length} mobile
                                  </p>
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      }
                      
                      // OPTIMIZATION: For medium groups (10-50), show simplified view
                      if (participantCount > 10) {
                        return regularParticipants.map((viewer) => {
                          const viewerData = viewer as any
                          const isWebUser = !viewerData.platform || viewerData.platform === 'web'
                          const isMobileUser = viewerData.platform === 'mobile' || viewerData.platform === 'app'
                          const currentTime = new Date().getTime()
                          const timeDiff = currentTime - (viewer.lastSeen?.getTime() || new Date().getTime())
                          const isActiveNow = timeDiff < 30000 // Active if seen in last 30 seconds
                          
                          return (
                            <div 
                              key={`viewer-${viewer.id}`} 
                              className="flex items-center justify-between p-1.5 rounded-lg border transition-all"
                              style={{
                                backgroundColor: isActiveNow ? 'rgba(142, 11, 22, 0.1)' : 'rgba(142, 11, 22, 0.05)', 
                                borderColor: isActiveNow ? '#8e0b16' : 'rgba(142, 11, 22, 0.3)'
                              }}
                            >
                              <div className="flex items-center gap-2">
                                <div className={`w-1.5 h-1.5 rounded-full ${isActiveNow ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                                <span className="font-medium text-sm" style={{color: '#8e0b16'}}>
                                  {viewer.name || 'Anonymous User'}
                                </span>
                                <Badge variant="secondary" className="px-1 py-0 text-xs bg-gray-100 text-gray-600">
                                  {isMobileUser ? '📱' : '💻'}
                                </Badge>
                              </div>
                            </div>
                          )
                        })
                      }
                      
                      // Standard view for small groups (1-10)
                      return regularParticipants.map((viewer) => {
                        const viewerData = viewer as any
                        const isWebUser = !viewerData.platform || viewerData.platform === 'web'
                        const isMobileUser = viewerData.platform === 'mobile' || viewerData.platform === 'app'
                        const currentTime = new Date().getTime()
                        const timeDiff = currentTime - (viewer.lastSeen?.getTime() || new Date().getTime())
                        const isActiveNow = timeDiff < 30000 // Active if seen in last 30 seconds
                        
                        return (
                          <div 
                            key={`viewer-${viewer.id}`} 
                            className={`flex items-center justify-between p-2 rounded-lg border-2 transition-all ${
                              isActiveNow ? 'shadow-md' : ''
                            }`}
                            style={{
                              backgroundColor: isActiveNow ? 'rgba(142, 11, 22, 0.1)' : 'rgba(142, 11, 22, 0.05)', 
                              borderColor: isActiveNow ? '#8e0b16' : 'rgba(142, 11, 22, 0.3)'
                            }}
                          >
                            <div className="flex items-center gap-2">
                              <div className={`w-2 h-2 rounded-full ${isActiveNow ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></div>
                              <span className="font-medium text-sm" style={{color: '#8e0b16'}}>
                                {viewer.name || 'Anonymous User'}
                              </span>
                              {/* Platform Badge */}
                              {isMobileUser && (
                                <Badge variant="secondary" className="px-1 py-0 text-xs bg-blue-100 text-blue-700 flex items-center gap-1">
                                  <Smartphone className="h-2.5 w-2.5" />
                                  App
                                </Badge>
                              )}
                              {isWebUser && (
                                <Badge variant="secondary" className="px-1 py-0 text-xs bg-purple-100 text-purple-700 flex items-center gap-1">
                                  <Monitor className="h-2.5 w-2.5" />
                                  Web
                                </Badge>
                              )}
                              {/* Active Status */}
                              {isActiveNow && (
                                <Badge variant="secondary" className="px-1 py-0 text-xs bg-green-100 text-green-700">
                                  Active
                                </Badge>
                              )}
                            </div>
                            <div className="text-xs" style={{color: '#66181E'}}>
                              {viewer.joinedAt ? getTimeAgo(new Date(viewer.joinedAt)) : 'Just joined'}
                            </div>
                          </div>
                        )
                      })
                    })()}
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

            {/* End Session Button - Only for organizers */}
            {(session.createdBy === user.uid || isActualOrganizer) ? (
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
            ) : (
              <Button
                disabled
                variant="secondary"
                size="lg"
                className="bg-gray-400 cursor-not-allowed px-8 py-3 font-semibold"
                title="View-only mode - cannot end session"
              >
                <Lock className="h-5 w-5 mr-2" />
                View Only - Cannot End
              </Button>
            )}
          </div>
          <p className="text-center text-sm text-muted-foreground mt-3">
            {onBack ? "Return to activity or end the live session and save to history" : "This will end the live session, disconnect all participants, and save it to your history"}
          </p>
        </CardContent>
      </Card>



      {/* Enhanced Winner Popup */}
      {session.selectedWheelType?.id === 'image-picker' ? (
        <EnhancedWinnerPopup
          key={`enhanced-winner-popup-${session.selectedWheelType?.id}-${session.winners?.length || 0}-${lastWheelTypeChangeTime}`}
          isOpen={showWinnerPopup && session?.winners && session.winners.length > 0 && !isChangingWheelType}
          onClose={() => setShowWinnerPopup(false)}
          winners={session?.winners || []}
          congratsMessage={customMessage || "🎉 Congratulations {name}! 🎉"}
          customWinnerWord={customWinnerWord || "Winner"}
          showConfetti={true}
          autoClose={10}
          wheelType="image-picker"
          theme={{
            primary: session?.wheelState?.theme?.primary || session?.wheelState?.theme?.primaryColor || session.selectedWheelType?.color || '#8e0b16',
            secondary: session?.wheelState?.theme?.secondary || session?.wheelState?.theme?.secondaryColor || session.selectedWheelType?.color || '#66181E',
            accent: session?.wheelState?.theme?.accent || session?.wheelState?.theme?.accentColor || '#ffffff'
          }}
        />
      ) : (
        <TextWinnerPopup
          key={`text-winner-popup-${session.selectedWheelType?.id || 'text'}-${session.winners?.length || 0}-${lastWheelTypeChangeTime}`}
          isOpen={showWinnerPopup && session?.winners && session.winners.length > 0 && !isChangingWheelType}
          onClose={() => setShowWinnerPopup(false)}
          winners={session?.winners || []}
          congratsMessage={customMessage || "Congratulations {name}! 🎉"}
          customWinnerWord={customWinnerWord || "Winner"}
          showConfetti={true}
          autoClose={10}
          theme={{
            primary: session?.wheelState?.theme?.primary || session?.wheelState?.theme?.primaryColor || session.selectedWheelType?.color || '#8e0b16',
            secondary: session?.wheelState?.theme?.secondary || session?.wheelState?.theme?.secondaryColor || session.selectedWheelType?.color || '#66181E',
            accent: session?.wheelState?.theme?.accent || session?.wheelState?.theme?.accentColor || '#ffffff'
          }}
        />
      )}

      {/* QR Code Dialog */}
      <Dialog open={isQrDialogOpen} onOpenChange={setIsQrDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle style={{ color: schoolColors.primary }}>Share QR Code</DialogTitle>
            <DialogDescription>
              Participants can scan this QR code to join the live session
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center space-y-4">
            {qrCodeUrl && (
              <img src={qrCodeUrl} alt={`QR Code for room ${session.roomCode}`} className="border-2 rounded-lg shadow-lg" style={{borderColor: '#8e0b16'}} />
            )}
            <p className="text-center text-sm text-gray-600 max-w-xs">
              Participants can scan this QR code to join the live session.
            </p>
          </div>
          <DialogFooter>
            <Button onClick={() => setIsQrDialogOpen(false)} className="bg-[#8e0b16] hover:bg-[#66181E]">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Send Codes Dialog */}
      <Dialog open={isSendCodesDialogOpen} onOpenChange={setIsSendCodesDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle style={{ color: schoolColors.primary }}>
              Invite Collaborator
            </DialogTitle>
            <DialogDescription>
              Send a live session invitation to a collaborator via email
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Collaborator Invitation Section */}
            <div className="p-4 bg-gradient-to-r from-purple-50 to-indigo-50 border-2 border-purple-200 rounded-xl">
              <div className="flex items-center gap-2 mb-3">
                <Crown className="h-5 w-5 text-purple-600" />
                <h3 className="font-semibold text-purple-900">Invite Collaborator</h3>
              </div>
              
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="collaboratorEmail" className="text-sm font-medium text-purple-800">
                    Collaborator Email Address *
                  </Label>
                  <Input
                    id="collaboratorEmail"
                    type="email"
                    placeholder="Enter collaborator email"
                    value={collaboratorEmail}
                    onChange={(e) => setCollaboratorEmail(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && collaboratorEmail.trim() && inviteCollaborator()}
                    className="bg-white"
                  />
                  <p className="text-xs text-purple-600">
                    The collaborator will receive an email with a link to join this live session
                  </p>
                </div>

                {/* Permission Selection */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-purple-800">
                    Permission Level *
                  </Label>
                  <Select
                    value={collaboratorPermissionLevel}
                    onValueChange={(value) => setCollaboratorPermissionLevel(value)}
                  >
                    <SelectTrigger className="w-full bg-white">
                      <SelectValue placeholder="Select permission level" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="full_access">
                        <div className="flex flex-col">
                          <span className="font-medium">Full Access</span>
                          <span className="text-xs text-gray-500">Can control wheel, edit settings, manage participants</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="view_only">
                        <div className="flex flex-col">
                          <span className="font-medium">View Only</span>
                          <span className="text-xs text-gray-500">Can watch the session but cannot interact</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Session Info */}
                <div className="p-2 bg-white rounded border border-purple-300">
                  <div className="text-xs text-purple-700 mb-1">Session Details:</div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-600">Session:</span>
                      <span className="font-medium text-purple-800">{session?.title || 'Live Draw'}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-600">Room Code:</span>
                      <span className="font-mono font-bold text-purple-800">{session?.roomCode || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-600">Permissions:</span>
                      <span className="text-purple-700">
                        {collaboratorPermissionLevel === 'full_access' ? 'Full Access' : 'View Only'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* What collaborators can do */}
                <div className="p-2 bg-purple-50 rounded border border-purple-200">
                  <div className="text-xs font-medium text-purple-800 mb-1">Collaborator Capabilities:</div>
                  <ul className="space-y-1 text-xs text-purple-700">
                    <li className="flex items-center gap-1">
                      <span className="text-green-600">✓</span>
                      Control the wheel (spin, pause, reset)
                    </li>
                    <li className="flex items-center gap-1">
                      <span className="text-green-600">✓</span>
                      Edit wheel settings and items
                    </li>
                    <li className="flex items-center gap-1">
                      <span className="text-green-600">✓</span>
                      Manage participants
                    </li>
                    <li className="flex items-center gap-1">
                      <span className="text-red-600">✗</span>
                      End the session (organizer only)
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCollaboratorEmail("")
                setIsSendCodesDialogOpen(false)
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={inviteCollaborator}
              disabled={!collaboratorEmail.trim() || isInvitingCollaborator}
              className="bg-[#8e0b16] hover:bg-[#66181E]"
            >
              {isInvitingCollaborator ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Sending...
                </>
              ) : (
                <>
                  <Crown className="h-4 w-4 mr-2" />
                  Send Invitation
                </>
              )}
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
        <DialogContent className="w-[95vw] sm:w-[90vw] md:max-w-lg max-h-[90vh] overflow-y-auto mx-auto">
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
                  placeholder={`Default: ${cachedWheelType?.title || session?.selectedWheelType?.title || 'Live Wheel'}`}
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
                    {customWheelTitle || cachedWheelType?.title || session?.selectedWheelType?.title || 'Live Wheel'}
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
              
              {/* Custom Winner Word Input */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-green-800">Custom Winner Title</Label>
                <Input
                  placeholder="Winner"
                  value={customWinnerWord}
                  onChange={(e) => {
                    const newWinnerWord = e.target.value || "Winner"
                    setCustomWinnerWord(newWinnerWord)
                    // Update session settings for real-time use
                    if (session?.id) {
                      updateDoc(doc(db, "liveDrawSessions", session.id), {
                        customWinnerWord: newWinnerWord,
                        updatedAt: serverTimestamp()
                      }).catch(console.error)
                    }
                  }}
                  className="bg-white"
                />
                <p className="text-xs text-green-600">
                  Set a custom word to replace <code>{'{word}'}</code> (e.g., "Champion", "Star", "Hero")
                </p>
              </div>
              
              <div className="space-y-2">
                <Label className="text-sm font-medium text-green-800">Custom Message for Winners</Label>
                <Input
                  placeholder="🎉 Congratulations {name}! You're our lucky {word}! 🎊"
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
                  Use <code>{'{name}'}</code> to include the winner's name and <code>{'{word}'}</code> for the custom title. This message will be shown to all participants.
                </p>
              </div>
              
              {/* Message Preview */}
              <div className="p-2 bg-white rounded border border-green-300">
                <div className="text-xs text-green-700 mb-1">Preview:</div>
                <div className="text-sm font-medium">
                  {(customMessage || "🎉 Congratulations {name}! You're our lucky {word}! 🎊").replace('{name}', 'John Doe').replace('{word}', customWinnerWord?.toLowerCase() || 'winner')}
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
                    {(session?.selectedWheelType?.defaultItems || session?.participants?.map(p => p.name) || []).map((item, index) => (
                      <div key={`manual-${item.replace(/\s+/g, '-').toLowerCase()}-${index}`} className="flex items-center space-x-2">
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
                          if (session?.selectedWheelType?.defaultItems) {
                            return {
                              id: `manual-winner-${index}-${Date.now()}`,
                              name: item
                              // Removed email: undefined to prevent Firebase error
                            }
                          } else {
                            const participant = session?.participants?.find((p: any) => p.name === item)
                            return participant || {
                              id: `manual-winner-${index}-${Date.now()}`,
                              name: item
                              // Removed email: undefined to prevent Firebase error
                            }
                          }
                        })

                        // Update session with manually selected winners
                        if (session?.id) {
                          // Sanitize all data to prevent Firebase undefined field errors
                          const sanitizedWinnerWord = customWinnerWord || 'Winner'
                          const sanitizedMessage = customMessage || "🎉 {winner}: {name}!"

                          const updateData = {
                            winners: winners,
                            currentState: "completed",
                            isSpinning: false,
                            manuallySelected: true,
                            updatedAt: serverTimestamp(),
                            resultNotification: {
                              message: winners.length === 1
                                ? sanitizedMessage.replace('{name}', winners[0].name).replace('{winner}', sanitizedWinnerWord)
                                : `🎉 Manually Selected ${sanitizedWinnerWord}${winners.length > 1 ? 's' : ''}: ${winners.map(w => w.name).join(', ')}!`,
                              winners: winners,
                              timestamp: serverTimestamp(),
                              isActive: true,
                              showConfetti: true,
                              priority: "immediate",
                              isManualSelection: true,
                              customWinnerWord: sanitizedWinnerWord
                            }
                          }

                          // Clean the data to remove any undefined values
                          const cleanData = (data: any): any => {
                            if (data === null || data === undefined) return null
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

                          const sanitizedUpdateData = cleanData(updateData)
                          console.log("🔍 SANITIZED MANUAL SELECTION DATA:", JSON.stringify(sanitizedUpdateData, null, 2))

                          await updateDoc(doc(db, "liveDrawSessions", session.id), sanitizedUpdateData)
                          
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

          {/* Spin Mode and Number of Winners Section */}
          <div className="space-y-3 p-4 bg-indigo-50 rounded-lg border border-indigo-200">
            <div className="flex items-center gap-2">
              <span className="text-xl">🎯</span>
              <h3 className="font-semibold text-indigo-900">Spin Mode & Winners</h3>
            </div>

            <div className="space-y-4">
              {/* Spin Mode */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-indigo-800">Spin Mode</Label>
                <Select
                  value={currentSpinMode}
                  onValueChange={(value) => {
                    setSpinModeByWheelType(prev => ({
                      ...prev,
                      [currentWheelTypeId]: value
                    }))
                    // Update session for real-time sync
                    if (session?.id) {
                      updateDoc(doc(db, "liveDrawSessions", session.id), {
                        [`spinMode_${currentWheelTypeId}`]: value,
                        updatedAt: serverTimestamp()
                      }).catch(console.error)
                    }
                  }}
                >
                  <SelectTrigger className="bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="random">Random Spin</SelectItem>
                    <SelectItem value="elimination">Elimination Mode</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-indigo-600">
                  {currentSpinMode === 'random' && 'Each spin selects a completely random winner'}
                  {currentSpinMode === 'sequential' && 'Spins select winners in order from the wheel'}
                  {currentSpinMode === 'weighted' && 'Some items have higher chances of being selected'}
                  {currentSpinMode === 'elimination' && 'Selected winners are removed from future spins'}
                </p>
              </div>

              {/* Number of Random Winners */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-indigo-800">Number of Random Winners</Label>
                <Select
                  value={currentNumberOfWinners.toString()}
                  onValueChange={(value) => {
                    const numWinners = parseInt(value)
                    setNumberOfWinnersByWheelType(prev => ({
                      ...prev,
                      [currentWheelTypeId]: numWinners
                    }))
                    // Update session for real-time sync
                    if (session?.id) {
                      updateDoc(doc(db, "liveDrawSessions", session.id), {
                        [`numberOfWinners_${currentWheelTypeId}`]: numWinners,
                        updatedAt: serverTimestamp()
                      }).catch(console.error)
                    }
                    // Update EnhancedWheel props
                    if (onSettingsChange) {
                      onSettingsChange({
                        spinMode: currentSpinMode,
                        numberOfWinners: numWinners
                      })
                    }
                  }}
                >
                  <SelectTrigger className="bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 Winner</SelectItem>
                    <SelectItem value="2">2 Winners</SelectItem>
                    <SelectItem value="3">3 Winners</SelectItem>
                    <SelectItem value="4">4 Winners</SelectItem>
                    <SelectItem value="5">5 Winners</SelectItem>
                    <SelectItem value="6">6 Winners</SelectItem>
                    <SelectItem value="7">7 Winners</SelectItem>
                    <SelectItem value="8">8 Winners</SelectItem>
                    <SelectItem value="9">9 Winners</SelectItem>
                    <SelectItem value="10">10 Winners</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-indigo-600">
                  Select how many winners to pick in each spin (1-{Math.min(10, editableItems.length)} available)
                </p>
              </div>

              {/* Current Settings Preview */}
              <div className="p-3 bg-white rounded border border-indigo-300">
                <div className="text-xs font-medium text-indigo-800 mb-2">Current Settings for {cachedWheelType?.title || 'Current Wheel'}:</div>
                <div className="space-y-1 text-xs text-indigo-700">
                  <div className="flex justify-between">
                    <span>Spin Mode:</span>
                    <span className="font-medium capitalize">{currentSpinMode}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Number of Winners:</span>
                    <span className="font-medium">{currentNumberOfWinners}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Available Items:</span>
                    <span className="font-medium">{editableItems.length}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

            {/* Advanced Features Section */}
            <div className="space-y-3 p-4 bg-orange-50 rounded-lg border border-orange-200">
              <div className="flex items-center gap-2">
                <span className="text-xl">⚙️</span>
                <h3 className="font-semibold text-orange-900">Advanced Features</h3>
              </div>

              <div className="space-y-3">
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

      {/* Edit Text Dialog */}
      <Dialog open={isEditTextDialogOpen} onOpenChange={setIsEditTextDialogOpen}>
        <DialogContent className="w-[98vw] max-w-5xl max-h-[95vh] overflow-hidden flex flex-col mx-1 sm:mx-2 p-2 sm:p-4">
          <DialogHeader className="flex-shrink-0 space-y-2 sm:space-y-3">
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg md:text-xl pr-8">
              <Edit3 className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
              <span className="break-words">Edit Wheel Items</span>
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm md:text-base leading-relaxed">
              Customize the text that appears in the wheel segments
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-3 sm:space-y-4 md:space-y-6 px-1 min-h-0">
            {/* CSV/Excel Upload Section */}
            <div className="space-y-2 sm:space-y-3">
              <Label className="text-xs sm:text-sm md:text-base font-semibold">Upload CSV or Excel File</Label>
              <div className="p-2 sm:p-3 md:p-4 border-2 border-dashed rounded-lg border-gray-300 hover:border-blue-400 transition-colors">
                <div className="text-center mb-2 sm:mb-3 md:mb-4">
                  <Upload className="h-5 w-5 sm:h-6 sm:w-6 md:h-8 md:w-8 mx-auto mb-2 text-gray-400" />

                  {/* Hidden file input */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.xlsx,.xls,text/csv,text/plain,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) {
                        console.log("📁 File selected:", {
                          name: file.name,
                          size: file.size,
                          type: file.type
                        })

                        // Validate file type and size - Support CSV and Excel files
                        const fileName = file.name.toLowerCase()
                        const isValidFile = fileName.endsWith('.csv') ||
                                          fileName.endsWith('.xlsx') ||
                                          fileName.endsWith('.xls') ||
                                          file.type.includes('csv') ||
                                          file.type.includes('text') ||
                                          file.type.includes('spreadsheet') ||
                                          file.type.includes('excel')
                        
                        if (!isValidFile) {
                          toast({
                            title: "Invalid file type",
                            description: "Please select a CSV or Excel file (.csv, .xlsx, .xls)",
                            variant: "destructive"
                          })
                          return
                        }

                        if (file.size > 5 * 1024 * 1024) { // 5MB limit
                          toast({
                            title: "File too large",
                            description: "Please select a file smaller than 5MB",
                            variant: "destructive"
                          })
                          return
                        }

                        setCsvFile(file)
                      }
                    }}
                    style={{ display: 'none' }}
                  />

                  <Button
                    onClick={() => fileInputRef.current?.click()}
                    variant="outline"
                    size="sm"
                    disabled={isUploadingCsv}
                    className="hover:bg-blue-50 hover:border-blue-500 text-xs sm:text-sm h-8 sm:h-9 md:h-10"
                  >
                    {csvFile ? (
                      <>
                        <FileText className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2 flex-shrink-0" />
                        <span className="truncate max-w-24 sm:max-w-32 md:max-w-none break-words">{csvFile.name}</span>
                      </>
                    ) : (
                      <>
                        <Upload className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2 flex-shrink-0" />
                        <span className="break-words">Choose CSV/Excel File</span>
                      </>
                    )}
                  </Button>

                  <p className="text-xs text-gray-500 mt-2 px-1 sm:px-2 leading-relaxed">
                    {csvFile ? (
                      `Size: ${(csvFile.size / 1024).toFixed(1)} KB`
                    ) : (
                      "CSV or Excel files (.csv, .xlsx, .xls) • Maximum file size: 5MB"
                    )}
                  </p>
                </div>

                {/* Show selected file and upload button */}
                {csvFile && !isUploadingCsv && (
                  <div className="flex justify-center mt-2 sm:mt-3">
                    <Button
                      onClick={async () => {
                        if (!csvFile) {
                          toast({
                            title: "No file selected",
                            description: "Please select a CSV or Excel file to upload",
                            variant: "destructive"
                          })
                          return
                        }

                        console.log("📤 Starting file upload process")
                        setIsUploadingCsv(true)
                        setCsvUploadProgress(0)

                        try {
                          // Simulate progress while parsing
                          const progressInterval = setInterval(() => {
                            setCsvUploadProgress(prev => Math.min(prev + 10, 50))
                          }, 100)

                          const parseCsvFile = (file: File): Promise<string[]> => {
                            return new Promise((resolve, reject) => {
                              const fileName = file.name.toLowerCase()
                              const isExcel = fileName.endsWith('.xlsx') || fileName.endsWith('.xls')
                              
                              console.log("📄 Starting enhanced file parse for:", file.name, "Size:", (file.size / 1024).toFixed(1), "KB", "Type:", isExcel ? "Excel" : "CSV")

                              const reader = new FileReader()
                              
                              if (isExcel) {
                                // Handle Excel files (.xlsx, .xls)
                                reader.onload = (e) => {
                                  try {
                                    const data = new Uint8Array(e.target?.result as ArrayBuffer)
                                    const workbook = XLSX.read(data, { type: 'array' })
                                    const firstSheetName = workbook.SheetNames[0]
                                    const worksheet = workbook.Sheets[firstSheetName]
                                    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][]
                                    
                                    console.log("📊 Excel data loaded:", jsonData.length, "rows")
                                    
                                    if (jsonData.length < 2) {
                                      throw new Error("Excel file must contain at least a header row and one data row")
                                    }
                                    
                                    const header = jsonData[0].map((cell: any) => String(cell || '').toLowerCase().trim())
                                    console.log("📊 Excel header:", header)
                                    
                                    // Enhanced name column detection
                                    const nameIndex = header.findIndex(col =>
                                      col.includes('name') ||
                                      col.includes('participant') ||
                                      col.includes('student') ||
                                      col.includes('member') ||
                                      col.includes('person') ||
                                      col.includes('attendee') ||
                                      col.includes('user')
                                    )
                                    
                                    console.log("📊 Name column detection:", {
                                      detectedIndex: nameIndex,
                                      columnName: nameIndex >= 0 ? header[nameIndex] : 'FIRST_COLUMN'
                                    })
                                    
                                    // Extract names from subsequent rows
                                    const names: string[] = []
                                    const maxRows = 5000
                                    let processedRows = 0
                                    let skippedRows = 0
                                    
                                    for (let i = 1; i < jsonData.length && names.length < maxRows; i++) {
                                      try {
                                        const row = jsonData[i]
                                        if (!row || row.length === 0 || row.every((cell: any) => !cell)) {
                                          skippedRows++
                                          continue
                                        }
                                        
                                        processedRows++
                                        
                                        // Use detected name column or first non-empty column
                                        let name = ''
                                        if (nameIndex >= 0 && row[nameIndex]) {
                                          name = String(row[nameIndex]).trim()
                                        } else {
                                          // Find first non-empty cell
                                          name = row.find((cell: any) => cell && String(cell).trim())
                                          name = name ? String(name).trim() : ''
                                        }
                                        
                                        // Enhanced validation and cleaning
                                        if (name && name.length > 0) {
                                          name = name.replace(/\s+/g, ' ').trim()
                                          
                                          if (name.length >= 2 && !/^\d+$/.test(name) && name !== 'N/A' && name !== 'NULL' && name !== 'null') {
                                            names.push(name)
                                          } else {
                                            skippedRows++
                                          }
                                        } else {
                                          skippedRows++
                                        }
                                      } catch (rowError) {
                                        console.warn(`⚠️ Error parsing row ${i + 1}:`, rowError)
                                        skippedRows++
                                      }
                                    }
                                    
                                    console.log("📊 Excel processing summary:", {
                                      totalRows: jsonData.length,
                                      headerRows: 1,
                                      dataRows: jsonData.length - 1,
                                      processedRows,
                                      skippedRows,
                                      validNames: names.length,
                                      successRate: `${((names.length / (jsonData.length - 1)) * 100).toFixed(1)}%`
                                    })
                                    
                                    if (names.length === 0) {
                                      throw new Error("No valid names found in Excel file. Please check the file format and ensure names are in the first column or a column with 'name' in the header.")
                                    }
                                    
                                    console.log("✅ Excel parsing successful:", {
                                      totalNames: names.length,
                                      preview: names.slice(0, 5)
                                    })
                                    
                                    resolve(names)
                                    
                                  } catch (error) {
                                    console.error("❌ Excel parsing error:", error)
                                    reject(error)
                                  }
                                }
                                
                                reader.onerror = (error) => {
                                  console.error("❌ Excel file reading error:", error)
                                  reject(new Error("Failed to read the Excel file. Please check the file format and try again."))
                                }
                                
                                reader.readAsArrayBuffer(file)
                              } else {
                                // Handle CSV files
                                reader.onload = (e) => {
                                  try {
                                    const csv = e.target?.result as string
                                    console.log("📄 CSV content length:", csv.length, "characters")

                                  // Handle different line endings (Windows \r\n, Unix \n, Mac \r)
                                  const lines = csv.split(/\r\n|\r|\n/).map(line => line.trim()).filter(line => line.length > 0)
                                  console.log("📄 CSV lines found:", lines.length)

                                  if (lines.length < 2) {
                                    throw new Error("CSV file must contain at least a header row and one data row")
                                  }

                                  // Enhanced delimiter detection for Excel compatibility
                                  const firstLine = lines[0]
                                  let delimiter = ','

                                  // Count occurrences of each potential delimiter
                                  const commaCount = (firstLine.match(/,/g) || []).length
                                  const semicolonCount = (firstLine.match(/;/g) || []).length
                                  const tabCount = (firstLine.match(/\t/g) || []).length
                                  const pipeCount = (firstLine.match(/\|/g) || []).length

                                  // Choose delimiter with highest count (most Excel-compatible approach)
                                  const delimiterCounts = [
                                    { delimiter: ',', count: commaCount },
                                    { delimiter: ';', count: semicolonCount },
                                    { delimiter: '\t', count: tabCount },
                                    { delimiter: '|', count: pipeCount }
                                  ]

                                  const bestDelimiter = delimiterCounts.reduce((prev, current) =>
                                    current.count > prev.count ? current : prev
                                  )

                                  delimiter = bestDelimiter.delimiter

                                  console.log("📄 Enhanced delimiter detection:", {
                                    comma: commaCount,
                                    semicolon: semicolonCount,
                                    tab: tabCount,
                                    pipe: pipeCount,
                                    selected: delimiter === '\t' ? 'TAB' : delimiter === ';' ? 'SEMICOLON' : delimiter === '|' ? 'PIPE' : 'COMMA'
                                  })

                                  // Parse header with enhanced quote handling
                                  const parseCsvLine = (line: string): string[] => {
                                    const result: string[] = []
                                    let current = ''
                                    let inQuotes = false
                                    let quoteChar = ''

                                    for (let i = 0; i < line.length; i++) {
                                      const char = line[i]
                                      const nextChar = line[i + 1]

                                      if (!inQuotes && (char === '"' || char === "'")) {
                                        // Start of quoted field
                                        inQuotes = true
                                        quoteChar = char
                                      } else if (inQuotes && char === quoteChar) {
                                        // End of quoted field or escaped quote
                                        if (nextChar === quoteChar) {
                                          // Escaped quote
                                          current += char
                                          i++ // Skip next quote
                                        } else {
                                          // End of quoted field
                                          inQuotes = false
                                          quoteChar = ''
                                        }
                                      } else if (!inQuotes && char === delimiter) {
                                        // Field separator
                                        result.push(current.trim())
                                        current = ''
                                      } else {
                                        current += char
                                      }
                                    }

                                    // Add final field
                                    result.push(current.trim())
                                    return result
                                  }

                                  const header = parseCsvLine(firstLine).map(cell => cell.toLowerCase().trim())
                                  console.log("📄 Parsed header:", header)

                                  // Enhanced name column detection
                                  const nameIndex = header.findIndex(col =>
                                    col.includes('name') ||
                                    col.includes('participant') ||
                                    col.includes('student') ||
                                    col.includes('member') ||
                                    col.includes('person') ||
                                    col.includes('attendee') ||
                                    col.includes('user') ||
                                    col === 'name' ||
                                    col === 'participant' ||
                                    col === 'student'
                                  )

                                  console.log("📄 Name column detection:", {
                                    detectedIndex: nameIndex,
                                    columnName: nameIndex >= 0 ? header[nameIndex] : 'FIRST_COLUMN',
                                    availableColumns: header
                                  })

                                  // Extract names from subsequent rows with enhanced validation
                                  const names: string[] = []
                                  const maxRows = 5000 // Increased limit for large datasets
                                  let processedRows = 0
                                  let skippedRows = 0

                                  for (let i = 1; i < lines.length && names.length < maxRows; i++) {
                                    try {
                                      const cells = parseCsvLine(lines[i])

                                      if (cells.length === 0 || cells.every(cell => !cell.trim())) {
                                        skippedRows++
                                        continue
                                      }

                                      processedRows++

                                      // Use detected name column or first non-empty column
                                      let name = ''
                                      if (nameIndex >= 0 && cells[nameIndex]) {
                                        name = cells[nameIndex].trim()
                                      } else {
                                        // Find first non-empty cell
                                        name = cells.find(cell => cell.trim())?.trim() || ''
                                      }

                                      // Enhanced validation and cleaning
                                      if (name && name.length > 0) {
                                        // Remove extra whitespace and normalize
                                        name = name.replace(/\s+/g, ' ').trim()

                                        // Skip obviously invalid entries (too short, just numbers, etc.)
                                        if (name.length >= 2 && !/^\d+$/.test(name) && name !== 'N/A' && name !== 'NULL' && name !== 'null') {
                                          names.push(name)
                                        } else {
                                          console.log("⚠️ Skipped invalid name:", name)
                                          skippedRows++
                                        }
                                      } else {
                                        skippedRows++
                                      }
                                    } catch (rowError) {
                                      console.warn(`⚠️ Error parsing row ${i + 1}:`, rowError)
                                      skippedRows++
                                    }
                                  }

                                  console.log("📄 CSV processing summary:", {
                                    totalLines: lines.length,
                                    headerLines: 1,
                                    dataLines: lines.length - 1,
                                    processedRows,
                                    skippedRows,
                                    validNames: names.length,
                                    successRate: `${((names.length / (lines.length - 1)) * 100).toFixed(1)}%`
                                  })

                                  if (names.length === 0) {
                                    throw new Error("No valid names found in CSV file. Please check the file format and ensure names are in the first column or a column with 'name' in the header.")
                                  }

                                  if (names.length >= maxRows) {
                                    console.warn(`⚠️ Reached maximum limit of ${maxRows} names. Some names may have been truncated.`)
                                  }

                                  console.log("✅ Enhanced CSV parsing successful:", {
                                    totalNames: names.length,
                                    preview: names.slice(0, 5),
                                    delimiter: delimiter === '\t' ? 'TAB' : delimiter,
                                    encoding: 'UTF-8',
                                    maxSupported: maxRows
                                  })

                                  resolve(names)

                                } catch (error) {
                                  console.error("❌ Enhanced CSV parsing error:", error)
                                  reject(error)
                                }
                              }

                              reader.onerror = (error) => {
                                console.error("❌ File reading error:", error)
                                reject(new Error("Failed to read the CSV file. Please check the file format and try again."))
                              }

                              // Try UTF-8 first, fallback to other encodings if needed
                              reader.readAsText(file, 'utf-8')
                              }
                            })
                          }

                          const names = await parseCsvFile(csvFile)
                          clearInterval(progressInterval)
                          setCsvUploadProgress(100)

                          console.log("🎯 File upload successful, updating wheel items:", {
                            totalNames: names.length,
                            names: names.slice(0, 5),
                            fileType: csvFile.name.toLowerCase().endsWith('.xlsx') || csvFile.name.toLowerCase().endsWith('.xls') ? 'Excel' : 'CSV'
                          })

                          // Update editable items with CSV data
                          setEditableItems(names)
                          setCsvFile(null)
                          setCsvUploadProgress(0)

                          // Broadcast wheel items change to live session
                          if (enableRealTimeSync && session?.id && (effectiveOrganizerMode || userPermissions.isFullAccessCollaborator)) {
                            try {
                              const csvUpdateData = {
                                wheelItems: names,
                                itemsUpdatedAt: new Date(),
                                csvUploaded: true,
                                itemsCount: names.length,
                                // 🎨 CRITICAL FIX: Persist theme in Firebase to prevent reversion after items update
                                theme: wheelTheme
                              }

                              await updateDoc(doc(db, "liveDrawSessions", session.id), csvUpdateData)

                              console.log("🔥 Broadcasted wheel items update to Firebase")
                            } catch (error) {
                              console.error("❌ Failed to broadcast CSV update:", error)
                            }
                          }

                          toast({
                            title: csvFile.name.toLowerCase().endsWith('.xlsx') || csvFile.name.toLowerCase().endsWith('.xls') ? "✅ Excel Upload Successful!" : "✅ CSV Upload Successful!",
                            description: `Imported ${names.length} names to the wheel`,
                          })

                        } catch (error: any) {
                          console.error("❌ File upload failed:", error)
                          toast({
                            title: "File Upload Failed",
                            description: error.message || "Failed to process the file. Please check the format and try again.",
                            variant: "destructive"
                          })
                        } finally {
                          setIsUploadingCsv(false)
                          setCsvUploadProgress(0)
                          setCsvFile(null)
                        }
                      }}
                      size="sm"
                      style={{ backgroundColor: '#8e0b16', color: 'white' }}
                      className="hover:opacity-90 text-xs sm:text-sm h-8 sm:h-9 md:h-10"
                    >
                      <Upload className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2 flex-shrink-0" />
                      Upload & Apply
                    </Button>
                  </div>
                )}

                {/* Upload progress */}
                {isUploadingCsv && (
                  <div className="mt-2 sm:mt-3">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${csvUploadProgress}%` }}
                      />
                    </div>
                    <p className="text-xs text-center text-gray-600 mt-1">
                      {csvUploadProgress < 50 ? 'Parsing CSV file...' : `Processing ${csvUploadProgress}% complete...`}
                    </p>
                  </div>
                )}
              </div>

              {/* CSV/Excel format instructions */}
              <div className="p-2 sm:p-3 bg-blue-50 rounded-lg border border-blue-200">
                <h4 className="font-medium text-blue-900 mb-1 text-xs sm:text-sm">📊 File Format Tips:</h4>
                <p className="text-xs text-blue-800 leading-relaxed">
                  <strong>CSV Files:</strong> First row should be headers (e.g., "Name", "Participant", "Student"). Supports comma, semicolon, and tab delimiters.<br/>
                  <strong>Excel Files (.xlsx, .xls):</strong> First row should be headers. Export your Excel file or upload it directly - we'll extract the data automatically.
                </p>
              </div>
            </div>

            {/* Editable Items List - REAL-TIME SYNCHRONIZATION */}
            <div className="space-y-2">
              <Label className="text-xs sm:text-sm md:text-base font-semibold">
                Edit Current Wheel Items ({editableItems.length}) - Changes sync instantly
              </Label>

              {/* Add new item input - placed above the items list */}
              {editableItems.length > 0 && (
                <div className="p-2 sm:p-3 bg-green-50 rounded-lg border border-green-200">
                  <Label className="text-xs sm:text-sm font-medium text-green-800">Add New Item</Label>
                  <div className="flex gap-2 mt-2">
                    <Input
                      value={newItemText}
                      onChange={(e) => setNewItemText(e.target.value)}
                      placeholder="Enter new item text..."
                      className="flex-1 text-xs sm:text-sm h-8"
                      style={{ borderColor: '#8e0b16' }}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          if (newItemText.trim() && !editableItems.includes(newItemText.trim())) {
                            setEditableItems([...editableItems, newItemText.trim()])
                            setNewItemText("")
                          }
                        }
                      }}
                    />
                    <Button
                      onClick={() => {
                        if (newItemText.trim() && !editableItems.includes(newItemText.trim())) {
                          setEditableItems([...editableItems, newItemText.trim()])
                          setNewItemText("")
                        }
                      }}
                      disabled={!newItemText.trim() || editableItems.includes(newItemText.trim())}
                      size="sm"
                      className="h-8 px-3 text-xs"
                      style={{ backgroundColor: '#8e0b16', color: 'white' }}
                    >
                      Add
                    </Button>
                  </div>
                  <p className="text-xs text-green-700 mt-1">
                    Press Enter or click Add to add the item to the wheel
                  </p>
                </div>
              )}

              <div className="p-2 sm:p-3 bg-gray-50 rounded-lg border max-h-32 sm:max-h-40 md:max-h-48 overflow-y-auto">
                {/* Clear All Button */}
                {editableItems.length > 0 && (
                  <div className="flex justify-end mb-2">
                    <Button
                      onClick={() => setEditableItems([])}
                      variant="outline"
                      size="sm"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-300 hover:border-red-400 text-xs h-7"
                      title="Clear all items from the wheel"
                    >
                      <Trash2 className="h-3 w-3 mr-1" />
                      Clear All
                    </Button>
                  </div>
                )}

                <div className="space-y-2">
                  {editableItems.length > 0 ? (
                    editableItems.map((item, index) => (
                      <div key={`editable-${index}`} className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className="text-xs px-2 py-1 min-w-[60px] justify-center"
                          style={{ borderColor: '#8e0b16', color: '#8e0b16' }}
                        >
                          {index + 1}
                        </Badge>
                        <Input
                          value={item}
                          onChange={(e) => {
                            const updated = [...editableItems]
                            updated[index] = e.target.value
                            setEditableItems(updated)
                          }}
                          className="flex-1 text-xs sm:text-sm h-8"
                          placeholder={`Item ${index + 1}`}
                          style={{ borderColor: item.trim() ? '#8e0b16' : '#ef4444' }}
                        />
                        <Button
                          onClick={() => setEditableItems(editableItems.filter((_, i) => i !== index))}
                          variant="outline"
                          size="sm"
                          className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                          disabled={editableItems.length <= 1}
                          title="Remove this item"
                        >
                          ×
                        </Button>
                      </div>
                    ))
                  ) : (
                    <div className="text-center text-gray-500 text-sm py-4">
                      No items to edit. Use the text entry above or CSV upload.
                    </div>
                  )}
                </div>
              </div>

              <div className="text-xs text-muted-foreground bg-yellow-50 border border-yellow-200 rounded-md p-2">
                <div className="flex items-start gap-2">
                  <div className="text-yellow-600 font-bold">💫</div>
                  <div>
                    <p className="font-medium text-yellow-800">Real-time synchronization active</p>
                    <p className="text-yellow-700">
                      Changes you make here instantly sync to all participants and collaborators.
                      Everyone sees your edits immediately.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="flex-shrink-0 flex-col sm:flex-row gap-3 pt-3 sm:pt-4 border-t">
            <div className="flex gap-2 w-full sm:w-auto">
              <Button
                variant="outline"
                onClick={() => {
                  // Reset to original items
                  if (session?.selectedWheelType?.defaultItems) {
                    setEditableItems([...session.selectedWheelType.defaultItems])
                  } else if (session?.participants) {
                    setEditableItems(session.participants.map(p => p.name))
                  } else {
                    setEditableItems(["Option 1", "Option 2", "Option 3", "Option 4", "Option 5"])
                  }
                  setIsEditTextDialogOpen(false)
                }}
                className="text-gray-600 hover:text-gray-800 flex-1 sm:flex-none text-xs sm:text-sm md:text-base h-8 sm:h-9 md:h-10"
                size="sm"
              >
                <RotateCcw className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2 flex-shrink-0" />
                <span className="break-words">Reset to Default</span>
              </Button>

              {/* Fill with Live button - always show in Edit Text dialog */}
              {isLiveMode && (
                <Button
                  onClick={() => {
                    if (!isLiveMode) {
                      toast({
                        title: "Not in Live Mode",
                        description: "This feature is only available during live sessions",
                        variant: "destructive"
                      })
                      return
                    }

                    if (liveParticipants.length === 0) {
                      toast({
                        title: "No Live Participants",
                        description: "No participants have joined the live session yet",
                        variant: "destructive"
                      })
                      return
                    }

                    // 🎯 ADD live participants' names to existing items (don't replace)
                    const liveParticipantNames = liveParticipants.map(p => p.name)
                    
                    // 🎯 CRITICAL FIX: ADD to existing items, don't replace them
                    // Filter out duplicates to avoid adding the same participant twice
                    const existingItems = [...editableItems]
                    const newParticipants = liveParticipantNames.filter(name => !existingItems.includes(name))
                    const updatedItems = [...existingItems, ...newParticipants]
                    
                    // 🔥 INSTANT UPDATE: Set items immediately for instant UI feedback
                    setEditableItems(updatedItems)

                    console.log("🎯 ADD LIVE PARTICIPANTS: Added live session participants to existing items", {
                      existingItemsCount: existingItems.length,
                      liveParticipantsCount: liveParticipants.length,
                      newParticipantsAdded: newParticipants.length,
                      duplicatesSkipped: liveParticipantNames.length - newParticipants.length,
                      totalItemsCount: updatedItems.length,
                      sessionId: session?.id,
                      wheelTypeId: currentWheelTypeId
                    })

                    toast({
                      title: "✅ Live Participants Added",
                      description: newParticipants.length > 0 
                        ? `Added ${newParticipants.length} new participant(s) to wheel: ${newParticipants.slice(0, 3).join(', ')}${newParticipants.length > 3 ? '...' : ''}` 
                        : `All ${liveParticipantNames.length} participant(s) already in wheel`,
                    })

                    // 🔥 CRITICAL: Broadcast AND persist to Firebase to ensure participants stay permanently
                    if (enableRealTimeSync && session?.id && (effectiveOrganizerMode || userPermissions.isFullAccessCollaborator)) {
                      const broadcastData = {
                        wheelItems: updatedItems,
                        customItems: updatedItems,
                        itemsUpdatedAt: new Date(),
                        itemChangeSource: "add-live-participants",
                        itemsCount: updatedItems.length,
                        newParticipantsAdded: newParticipants.length,
                        broadcastSource: effectiveOrganizerMode ? 'organizer' : 'full-access-collaborator',
                        // 🔥 CRITICAL: Persist items per wheel type for permanent storage
                        [`wheelState.wheelTypesData.${currentWheelTypeId}.items`]: updatedItems,
                        [`wheelState.wheelTypesData.${currentWheelTypeId}.lastUpdated`]: Date.now(),
                        // 🎯 CRITICAL: Also update root wheelState for immediate sync
                        "wheelState.wheelItems": updatedItems,
                        "wheelState.customItems": updatedItems,
                        "wheelState.itemsUpdatedAt": new Date(),
                        "wheelState.itemChangeSource": "add-live-participants",
                        updatedAt: serverTimestamp()
                      }

                      updateDoc(doc(db, "liveDrawSessions", session.id), broadcastData).then(() => {
                        console.log("✅ BROADCASTED & PERSISTED LIVE PARTICIPANTS:", {
                          sessionId: session.id,
                          existingItemsCount: existingItems.length,
                          newParticipantsAdded: newParticipants.length,
                          totalItemsCount: updatedItems.length,
                          wheelTypeId: currentWheelTypeId,
                          broadcastSource: broadcastData.broadcastSource,
                          persistedToFirebase: true,
                          timestamp: new Date().toISOString()
                        })
                      }).catch((error) => {
                        console.error("❌ Failed to broadcast live participants addition:", error)
                        toast({
                          title: "⚠️ Sync Failed",
                          description: "Items added locally but failed to sync. Please try again.",
                          variant: "destructive"
                        })
                      })
                    }
                  }}
                  variant="outline"
                  disabled={!isLiveMode || liveParticipants.length === 0}
                  style={{
                    borderColor: liveParticipants.length > 0 ? '#10b981' : '#9ca3af',
                    color: liveParticipants.length > 0 ? '#10b981' : '#9ca3af',
                    backgroundColor: liveParticipants.length > 0 ? 'transparent' : '#f9fafb'
                  }}
                  className={`hover:bg-green-50 hover:border-green-600 hover:text-green-700 flex-1 sm:flex-none text-xs sm:text-sm md:text-base h-8 sm:h-9 md:h-10 ${!isLiveMode || liveParticipants.length === 0 ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
                  size="sm"
                  title={!isLiveMode ? 'Only available in live mode' : liveParticipants.length === 0 ? 'No live participants yet' : `Auto-fill wheel with ${liveParticipants.length} live participants`}
                >
                  <Users className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2 flex-shrink-0" />
                  <span className="break-words">
                    {liveParticipants.length > 0 ? `Fill with Live (${liveParticipants.length})` : 'Fill with Live (0)'}
                  </span>
                </Button>
              )}
            </div>

            <div className="flex gap-2 w-full sm:w-auto">
              <Button
                variant="outline"
                onClick={() => setIsEditTextDialogOpen(false)}
                className="flex-1 sm:flex-none text-xs sm:text-sm md:text-base h-8 sm:h-9 md:h-10"
                size="sm"
              >
                Cancel
              </Button>
              <Button
                onClick={async () => {
                  if (editableItems.length === 0) {
                    toast({
                      title: "No Items",
                      description: "Please add at least one item to the wheel",
                      variant: "destructive"
                    })
                    return
                  }

                  // Validate that all items have content
                  const validItems = editableItems.filter(item => item.trim().length > 0)
                  if (validItems.length !== editableItems.length) {
                    toast({
                      title: "Empty Items",
                      description: "Please ensure all items have content or remove empty ones",
                      variant: "destructive"
                    })
                    return
                  }

                  console.log("🎯 ORGANIZER: Applying edited wheel items:", {
                    itemsCount: validItems.length,
                    preview: validItems.slice(0, 3)
                  })

                  // Broadcast changes for organizers and full access collaborators
                  if (enableRealTimeSync && session?.id && (effectiveOrganizerMode || userPermissions.isFullAccessCollaborator)) {
                    try {
                      console.log("🎯 ORGANIZER: Broadcasting updated wheel items to participants:", {
                        itemsCount: validItems.length,
                        preview: validItems.slice(0, 3),
                        sessionId: session.id
                      })

                      const itemsUpdateData = {
                        wheelItems: validItems,
                        customItems: validItems,
                        itemsUpdatedAt: new Date(),
                        itemChangeSource: "direct-edit",
                        itemsCount: validItems.length,
                        broadcastSource: effectiveOrganizerMode ? 'organizer' : 'full-access-collaborator',
                        // 🔥 CRITICAL: Persist items per wheel type for consistent restoration
                        [`wheelState.wheelTypesData.${currentWheelTypeId}.items`]: validItems,
                        [`wheelState.wheelTypesData.${currentWheelTypeId}.lastUpdated`]: Date.now(),
                        // 🎯 CRITICAL FIX: Also update wheelState for EnhancedWheel listener
                        wheelState: {
                          wheelItems: validItems,
                          customItems: validItems,
                          itemsUpdatedAt: new Date(),
                          itemChangeSource: "direct-edit",
                          itemsCount: validItems.length,
                          broadcastSource: effectiveOrganizerMode ? 'organizer' : 'full-access-collaborator'
                        },
                        updatedAt: serverTimestamp()
                      }

                      await updateDoc(doc(db, "liveDrawSessions", session.id), itemsUpdateData)

                      console.log("✅ ORGANIZER: Successfully broadcasted wheel items update to Firebase")
                    } catch (error) {
                      console.error("❌ ORGANIZER: Failed to broadcast wheel items update:", error)
                    }
                  }

                  // Update local state and close dialog
                  setIsEditTextDialogOpen(false)

                  toast({
                    title: "✅ Items Updated Successfully!",
                    description: `Wheel updated with ${validItems.length} item${validItems.length === 1 ? '' : 's'}: ${validItems.slice(0, 3).join(', ')}${validItems.length > 3 ? '...' : ''}`,
                  })
                }}
                style={{ backgroundColor: '#8e0b16', color: 'white' }}
                className="flex-1 sm:flex-none text-xs sm:text-sm md:text-base h-8 sm:h-9 md:h-10 hover:opacity-90"
                size="sm"
              >
                Apply Items
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Participant Leave Popup Notification */}
      <Dialog open={showLeavePopup} onOpenChange={setShowLeavePopup}>
        <DialogContent className="max-w-md border-2" style={{ borderColor: '#8e0b16' }}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold" style={{ color: '#8e0b16' }}>
              <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(142, 11, 22, 0.1)' }}>
                👋
              </div>
              Participant Left
            </DialogTitle>
            <DialogDescription className="text-gray-600">
              A participant has disconnected from your live session
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border">
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg" style={{ backgroundColor: 'rgba(142, 11, 22, 0.1)', color: '#8e0b16' }}>
                👤
              </div>
              <div className="flex-1">
                <p className="font-semibold text-gray-900">
                  {leavePopupData?.participantName || 'Unknown Participant'}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs px-2 py-1 rounded-full bg-gray-200 text-gray-700">
                    {leavePopupData?.platform === 'web' ? '💻 Web' : 
                     leavePopupData?.platform === 'mobile' ? '📱 Mobile' : 
                     leavePopupData?.platform === 'app' ? '📱 App' : '❓ Unknown'}
                  </span>
                  <span className="text-xs text-gray-500">
                    {leavePopupData?.reason === 'browser_exit' ? 'Browser closed' :
                     leavePopupData?.reason === 'inactive_timeout' ? 'Inactive timeout' :
                     leavePopupData?.reason === 'disconnected' ? 'Connection lost' : 'Left session'}
                  </span>
                </div>
              </div>
            </div>
            
            <div className="text-center text-sm text-gray-600">
              <p>This participant is no longer connected to the live session.</p>
              <p className="mt-1">They can rejoin using the room code: <strong>{session?.roomCode}</strong></p>
            </div>
          </div>

          <DialogFooter>
            <Button 
              onClick={() => setShowLeavePopup(false)}
              className="w-full"
              style={{ backgroundColor: '#8e0b16', color: 'white' }}
            >
              Got it
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Export the component directly without provider wrapper
export default LiveDrawManager
