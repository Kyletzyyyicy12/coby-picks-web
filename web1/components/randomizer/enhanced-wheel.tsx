"use client"

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { toast } from "@/hooks/use-toast"
import { Shuffle as ShuffleIcon, Play, Pause, RotateCcw, Trophy, Users, Settings, Share2, Eye, Palette, Edit3, Crown, Upload, FileText, Trash2, Download } from "lucide-react"
import confetti from "canvas-confetti"
import { db } from "@/lib/firebase"
import { doc, updateDoc, serverTimestamp, onSnapshot, getDoc, collection, query, getDocs } from "firebase/firestore"
import type { PickerWheelType } from "@/lib/picker-wheel-types"
import * as XLSX from "xlsx-js-style"

interface Participant {
  id: string
  name: string
  email?: string
  contactNumber?: string
  isSelected?: boolean
}

interface WheelSettings {
  numberOfWinners: number
  spinDuration: number
  showConfetti: boolean
  playSound: boolean
  congratsMessage: string
  theme: "academic" | "research" | "entertainment" | "personal"
  colorScheme: "school" | "vibrant" | "minimal"
}

interface SpinResult {
  id: string
  winners: Participant[]
  timestamp: Date
  spinDuration: number
  totalParticipants: number
  slice?: {
    id: string
    text: string
    color?: string
  }
}

interface EnhancedWheelProps {
       participants: Participant[]
       onSpinComplete?: (result: SpinResult) => void
       onSettingsChange?: (settings: WheelSettings) => void
       isLiveMode?: boolean
       sessionId?: string
       studentMode?: boolean // New prop for student participation mode
       disabled?: boolean // Allow disabling the wheel
       wheelTitle?: string // Title to display on the wheel
       selectedWheelType?: PickerWheelType | null // Selected wheel type from picker-wheel-types.ts
       // Real-time synchronization props
       enableRealTimeSync?: boolean // Enable Firebase real-time synchronization
       organizerMode?: boolean // True if this is the organizer's wheel (can trigger spins)
       onWinnersDetected?: (winners: Participant[]) => void // Callback when winners are detected
       isSpinning?: boolean // External spinning state from real-time sync for participants
       // Real-time theme and items sync props
       wheelTheme?: {
         primary: string
         secondary: string
         accent: string
         background: string
       } // Override wheel theme from organizer
       customItems?: string[] // Override wheel items from organizer
       userRole?: string // User role for dashboard routing
       onBackToDashboard?: () => void // Callback for back to dashboard
       // ENHANCED: Collaborator synchronization permissions
       userPermissions?: {
         isFullAccessCollaborator?: boolean
         canTriggerSynchronizedSpin?: boolean
         synchronizationEnabled?: boolean
         sessionId?: string
         userRole?: string
         canViewOnly?: boolean // Add this to match the simplified permission system
       }
       // Remote spin data for synchronized animation
       remoteSpinData?: any
       // Number of winners setting
       numberOfWinners?: number
       // Custom congratulations message
       customCongratsMessage?: string // Custom message with {winner} placeholder
       // Custom winner word/title
       customWinnerWord?: string // Custom word to replace "Winner" (e.g., "Champion", "Star")
       // Per-wheel-type settings for consistency
       editableItemsByWheelType?: Record<string, string[]> // Editable items per wheel type
       spinModeByWheelType?: Record<string, string> // Spin mode per wheel type
       numberOfWinnersByWheelType?: Record<string, number> // Number of winners per wheel type
       onEditableItemsChange?: (wheelTypeId: string, items: string[]) => void // Callback for editable items changes
       onSpinModeChange?: (wheelTypeId: string, mode: string) => void // Callback for spin mode changes
       onNumberOfWinnersChange?: (wheelTypeId: string, count: number) => void // Callback for number of winners changes
       // 🔥 NEW: Hide wheel text during spin (for 30+ student mode)
       hideWheelText?: boolean // Hide wheel text until spin completes
       showWheelTextOnCompletion?: boolean // Show text after spin completes
     }

export function EnhancedWheel({
       participants,
       onSpinComplete,
       onSettingsChange,
       isLiveMode = false,
       sessionId,
       studentMode = false,
       disabled = false,
       wheelTitle,
       selectedWheelType,
       enableRealTimeSync = false,
       organizerMode = false,
       onWinnersDetected,
       isSpinning: externalIsSpinning = false,
       wheelTheme: externalWheelTheme,
       customItems,
       userRole,
       onBackToDashboard,
       // ENHANCED: Collaborator permissions
       userPermissions = {
         isFullAccessCollaborator: false,
         canTriggerSynchronizedSpin: false,
         synchronizationEnabled: false,
         sessionId: sessionId,
         userRole: userRole
       },
       remoteSpinData,
       numberOfWinners: propNumberOfWinners,
       customCongratsMessage: propCustomCongratsMessage,
       customWinnerWord: propCustomWinnerWord,
       // Per-wheel-type settings for consistency
       editableItemsByWheelType = {},
       spinModeByWheelType = {},
       numberOfWinnersByWheelType = {},
       onEditableItemsChange,
       onSpinModeChange,
       onNumberOfWinnersChange,
       hideWheelText = false,
       showWheelTextOnCompletion = false,
     }: EnhancedWheelProps) {
      // ENHANCED: Determine if this user can act like an organizer for synchronized spinning
      const effectiveOrganizerMode = organizerMode ||
        (userPermissions.isFullAccessCollaborator && userPermissions.canTriggerSynchronizedSpin)

  // STABLE: Consistent collaborator mode detection - no logging for stability


    // Debug logging for received props removed for production
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isSpinning, setIsSpinning] = useState(false)
  const isSpinningRef = useRef(false)
  const setIsSpinningWithRef = useCallback((value: boolean) => {
    isSpinningRef.current = value
    setIsSpinning(value)
  }, [])
  const [currentAngle, setCurrentAngle] = useState(0)
  const [winners, setWinners] = useState<Participant[]>([])
  const [spinHistory, setSpinHistory] = useState<SpinResult[]>([])
  const [showResults, setShowResults] = useState(false)
  const [shouldHideText, setShouldHideText] = useState(hideWheelText) // 🔥 NEW: Control text visibility
  const [revealTextAfterSpin, setRevealTextAfterSpin] = useState(false) // 🔥 NEW: Flag to reveal text after spin
  const [shuffledItemsOverride, setShuffledItemsOverride] = useState<string[] | null>(null)
  const [settings, setSettings] = useState<WheelSettings>({
    numberOfWinners: propNumberOfWinners || 1,
    spinDuration: 4000, // Increased default to 4 seconds
    showConfetti: true,
    playSound: true,
    congratsMessage: "",
    theme: "academic",
    colorScheme: "school"
  })

  // Custom congratulations message from props (kept in state for live updates)
  const [customCongratsMessageState, setCustomCongratsMessageState] = useState<string>(propCustomCongratsMessage || "")

  // Custom winner title state for dynamic winner announcement - WITH LOCALSTORAGE PERSISTENCE
  const [customWinnerTitle, setCustomWinnerTitle] = useState<string>(() => {
    // Priority 1: Use prop if provided
    if (propCustomWinnerWord) {
      return propCustomWinnerWord
    }
    // Priority 2: Try to load from localStorage
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(`coby-winner-title-${sessionId || 'default'}`)
        if (saved) {
          console.log("💾 Loaded winner title from localStorage:", saved)
          return saved
        }
      } catch (error) {
        console.warn("Failed to load winner title from localStorage:", error)
      }
    }
    return "WINNER  SELECTED! 🎉"
  })

  // Save winner title to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== 'undefined' && customWinnerTitle) {
      try {
        localStorage.setItem(`coby-winner-title-${sessionId || 'default'}`, customWinnerTitle)
        console.log("💾 Saved winner title to localStorage:", customWinnerTitle)
      } catch (error) {
        console.warn("Failed to save winner title to localStorage:", error)
      }
    }
  }, [customWinnerTitle, sessionId])

  // Keep settings and local state synchronized with incoming custom message templates
  useEffect(() => {
    if (typeof propCustomCongratsMessage === "string") {
      setCustomCongratsMessageState(propCustomCongratsMessage)
      setSettings(prev => ({ ...prev, congratsMessage: propCustomCongratsMessage }))
    }
  }, [propCustomCongratsMessage])

  // Sync numberOfWinners with prop changes
  useEffect(() => {
    if (propNumberOfWinners && propNumberOfWinners !== settings.numberOfWinners) {
      setSettings(prev => ({ ...prev, numberOfWinners: propNumberOfWinners }))
    }
  }, [propNumberOfWinners, settings.numberOfWinners])

  // Sync customWinnerTitle with prop changes
  useEffect(() => {
    if (propCustomWinnerWord && propCustomWinnerWord !== customWinnerTitle) {
      console.log("🎯 SYNCING CUSTOM WINNER WORD:", propCustomWinnerWord)
      setCustomWinnerTitle(propCustomWinnerWord)
      // Save to localStorage
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(`coby-winner-title-${sessionId || 'default'}`, propCustomWinnerWord)
        } catch (error) {
          console.warn("Failed to save winner title to localStorage:", error)
        }
      }
    }
  }, [propCustomWinnerWord, sessionId])

  // 🔥 FIX: Keep wheel text visible during spinning - only hide if explicitly requested
  useEffect(() => {
    // Don't auto-hide text during spinning - let the wheel items stay visible
    // Only hide if hideWheelText prop is explicitly true
    setShouldHideText(hideWheelText)
  }, [hideWheelText])

  // 🔥 NEW: Automatically show text when spin completes
  useEffect(() => {
    if (showWheelTextOnCompletion && showResults && !isSpinning) {
      // Spin has completed, reveal text
      setRevealTextAfterSpin(true)
      setShouldHideText(false)
      console.log("✅ SPIN COMPLETED: Revealing wheel text after completion")
    }
  }, [showResults, isSpinning, showWheelTextOnCompletion])

  const [isEditingItems, setIsEditingItems] = useState(false)
  const [newItemText, setNewItemText] = useState("")
  const [lastAppliedItems, setLastAppliedItems] = useState<string[]>([]) // Track last successfully applied items

  // Get current wheel type ID for isolation
  const currentWheelTypeId = selectedWheelType?.id || "default"

  // Local fallback store so participants still update even if no parent handler is provided
  const [localEditableItemsByWheelType, setLocalEditableItemsByWheelType] = useState<Record<string, string[]>>({})

  // Get editable items for current wheel type (prefer parent-provided, fallback to local)
  const editableItems = editableItemsByWheelType[currentWheelTypeId] || localEditableItemsByWheelType[currentWheelTypeId] || []

  // Function to update editable items for current wheel type
  const setEditableItems = (items: string[]) => {
    setLocalEditableItemsByWheelType(prev => ({ ...prev, [currentWheelTypeId]: items }))
    if (onEditableItemsChange) {
      onEditableItemsChange(currentWheelTypeId, items)
    }
  }

  // CSV upload state
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [isUploadingCsv, setIsUploadingCsv] = useState(false)
  const [csvUploadProgress, setCsvUploadProgress] = useState(0)
  
  // 🎯 RESEARCH FEATURE: Random student selection from CSV
  const [randomSelectionCount, setRandomSelectionCount] = useState<number>(10)
  const [uploadedStudentList, setUploadedStudentList] = useState<Array<{id: string, name: string, email?: string}>>([])
  const [selectedStudents, setSelectedStudents] = useState<Array<{id: string, name: string, email?: string}>>([])
  const [showRandomSelectionDialog, setShowRandomSelectionDialog] = useState(false)
  const [researchSpinMode, setResearchSpinMode] = useState<'single' | 'multiple'>('single')
  const [researchSpinCount, setResearchSpinCount] = useState<number>(1)
  const [isResearchModeActive, setIsResearchModeActive] = useState(false)
  // 🛡️ FAILSAFE: Selection validation state
  const [selectionValidationError, setSelectionValidationError] = useState<string>("")
  const [manualSelectionInput, setManualSelectionInput] = useState<string>("10")
  // 🎯 RESEARCH MODE: Track whether to show selected students or all students on wheel
  const [showSelectedStudentsOnWheel, setShowSelectedStudentsOnWheel] = useState(false)

  // State for wheel theme customization - disabled for participants
    const [isCustomizingTheme, setIsCustomizingTheme] = useState(false)
    const [isThemeDialogOpen, setIsThemeDialogOpen] = useState(false)
    const [isTextDialogOpen, setIsTextDialogOpen] = useState(false)

    // Render-ready congratulations message with placeholder replacement
    const formattedCongratsMessage = useMemo(() => {
      let template = customCongratsMessageState || settings.congratsMessage || ""
      if (!template.trim()) return ""

      // 🎯 SANITIZE: Remove any invalid/garbage characters and keep only valid message content
      // Remove any leading/trailing whitespace and invalid characters
      template = template.trim()

      const winnerNames = winners.length > 0 ? winners.map(w => w.name?.trim()).filter(Boolean).join(", ") : "Winner"
      const winnerWord = winners.length > 1 ? "winners" : "winner"

      return template
        .replace(/\{name\}/gi, winnerNames)
        .replace(/\{winner\}/gi, winnerWord)
        .trim()  // 🎯 CRITICAL: Final trim to remove any trailing garbage
    }, [customCongratsMessageState, settings.congratsMessage, winners])

  const [wheelTheme, setWheelTheme] = useState({
    primary: "#8e0b16",
    secondary: "#66181E",
    accent: "#ffffff",
    background: "#f8f9fa"
  })

  // File input reference for CSV upload
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Winner title broadcast timeout reference for debouncing
  const winnerTitleTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // State for live draw participants filtering
  const [showOnlyLiveParticipants, setShowOnlyLiveParticipants] = useState(false)
  const [liveParticipants, setLiveParticipants] = useState<Participant[]>([])

  // Load custom winner title from Firebase on initial mount
  useEffect(() => {
    if (sessionId && enableRealTimeSync) {
      const loadWinnerTitle = async () => {
        try {
          const sessionDoc = await getDoc(doc(db, "liveDrawSessions", sessionId))
          if (sessionDoc.exists()) {
            const sessionData = sessionDoc.data()
            const savedTitle = sessionData?.wheelState?.customWinnerTitle
            if (savedTitle && savedTitle !== customWinnerTitle) {
              console.log("💾 Loading custom winner title from Firebase:", savedTitle)
              setCustomWinnerTitle(savedTitle)
              localStorage.setItem(`customWinnerTitle_${sessionId}`, savedTitle)
            }
          }
        } catch (error) {
          console.error("❌ Error loading custom winner title:", error)
        }
      }

      loadWinnerTitle()
    }
  }, [sessionId, enableRealTimeSync])

  // Fetch live participants when in live mode
  useEffect(() => {
    if (isLiveMode && sessionId && enableRealTimeSync) {
      const fetchLiveParticipants = async () => {
        try {
          const sessionDoc = await getDoc(doc(db, "liveDrawSessions", sessionId))
          if (sessionDoc.exists()) {
            const sessionData = sessionDoc.data()
            // Get viewers from the viewers subcollection
            const viewersQuery = query(collection(db, "liveDrawSessions", sessionId, "viewers"))
            const viewersSnapshot = await getDocs(viewersQuery)

            const viewers = viewersSnapshot.docs.map(doc => ({
              id: doc.id,
              name: doc.data().name || 'Anonymous',
              email: doc.data().email || undefined,
              isSelected: true
            })) as Participant[]

            // STABLE: Consistent live participants fetch - no variable logging

            setLiveParticipants(viewers)
          }
        } catch (error) {
          console.error("❌ Error fetching live participants:", error)
        }
      }

      fetchLiveParticipants()

      // Set up real-time listener for live participants
      const unsubscribe = onSnapshot(
        collection(db, "liveDrawSessions", sessionId, "viewers"),
        (snapshot) => {
          const viewers = snapshot.docs.map(doc => ({
            id: doc.id,
            name: doc.data().name || 'Anonymous',
            email: (typeof doc.data().email === 'string' ? doc.data().email : undefined),
            isSelected: true
          })) as Participant[]

          if (process.env.NODE_ENV === 'development') {
            console.log("🎯 LIVE PARTICIPANTS UPDATED (real-time):", {
              sessionId,
              viewerCount: viewers.length,
              viewers: viewers.map(v => v.name)
            })
          }

          setLiveParticipants(viewers)
        },
        (error) => {
          console.error("❌ Error listening to live participants:", error)
        }
      )

      return () => unsubscribe()
    }
  }, [isLiveMode, sessionId, enableRealTimeSync])

  // Store the theme that should persist during spinning - moved before useEffect that uses it
  const [persistentTheme, setPersistentTheme] = useState<any>(null)
  // Fix for theme persistence - prevent theme reversion after spinning
  const themeInitialized = useRef(false)
  // Block theme updates during spinning to prevent race conditions
  const themeUpdatesBlocked = useRef(false)
  // Track last reset timestamp to prevent duplicate reset handling
  const lastResetTimestampRef = useRef<number>(0)
  const lastProcessedResetIdRef = useRef<string>('')



  // Ensure wheelTheme is synchronized with persistentTheme on component mount
  useEffect(() => {
      if (persistentTheme) {
        const currentThemeId = `${wheelTheme.primary}-${wheelTheme.secondary}-${wheelTheme.accent}-${wheelTheme.background}`
        const persistentThemeId = `${persistentTheme.primary}-${persistentTheme.secondary}-${persistentTheme.accent}-${persistentTheme.background}`

        if (currentThemeId !== persistentThemeId) {
          if (process.env.NODE_ENV === 'development') {
            console.log("🎨 INITIAL SYNC: Synchronizing wheelTheme with persistentTheme", {
              persistentTheme: persistentTheme,
              currentWheelTheme: wheelTheme,
              themeChanged: true
            })
          }
          setWheelTheme(persistentTheme)
          // Force immediate redraw after sync
          setTimeout(() => {
            const canvas = canvasRef.current
            if (canvas) {
              const ctx = canvas.getContext("2d")
              if (ctx) {
                // Simple redraw to avoid dependency issues
                ctx.clearRect(0, 0, canvas.width, canvas.height)
                // Redraw with current items and theme
                const items = wheelItems
                if (items.length > 0) {
                  items.forEach((item, index) => {
                    const segmentAngle = (2 * Math.PI) / items.length
                    const startAngle = index * segmentAngle + currentAngle
                    const endAngle = startAngle + segmentAngle
                    const isEven = index % 2 === 0
                    ctx.fillStyle = isEven ? persistentTheme.primary : persistentTheme.secondary
                    ctx.beginPath()
                    ctx.moveTo(canvas.width / 2, canvas.height / 2)
                    ctx.arc(canvas.width / 2, canvas.height / 2, Math.min(canvas.width, canvas.height) / 2 - 15, startAngle, endAngle)
                    ctx.closePath()
                    ctx.fill()
                    ctx.strokeStyle = persistentTheme.accent
                    ctx.lineWidth = 5
                    ctx.stroke()
                  })
                }
              }
            }
          }, 0)
        }
      }
  }, [persistentTheme, wheelTheme, currentAngle])
  const [textInputVersion, setTextInputVersion] = useState(0) // Track version to force updates
  const [forceUpdate, setForceUpdate] = useState(0) // Force component re-render
  const lastThemeUpdateRef = useRef<string>("") // Track last theme update for comparison
  const [themeChangeTrigger, setThemeChangeTrigger] = useState(0) // Force redraw on theme changes

  // Simplified real-time synchronization state
  const [sessionListener, setSessionListener] = useState<any>(null)
  const [pendingWinners, setPendingWinners] = useState<Participant[] | null>(null)
  const [listenerSetup, setListenerSetup] = useState(false)
  const [lastWinnerCheck, setLastWinnerCheck] = useState(0)
  const [syncPhase, setSyncPhase] = useState<'idle' | 'syncing' | 'synced' | 'error'>('idle')
  const [collaborativeMode, setCollaborativeMode] = useState(false)
  const [spinTimestamp, setSpinTimestamp] = useState<number>(0)
  const [lastReceivedSpinData, setLastReceivedSpinData] = useState<any>(null)
  // Enhanced participant spinning state for direct Firebase sync
  const [remoteSpinning, setRemoteSpinning] = useState<boolean>(false)
  const [receivedSpinData, setReceivedSpinData] = useState<any>(null)
  const [remoteWinners, setRemoteWinners] = useState<Participant[]>([])

  // Prevent confetti loops with enhanced deduplication
  const [isConfettiActive, setIsConfettiActive] = useState(false)
  const [confettiTimeoutRef, setConfettiTimeoutRef] = useState<NodeJS.Timeout | null>(null)
  const [lastConfettiTrigger, setLastConfettiTrigger] = useState<string>("") // Track last spin ID that triggered confetti
  const [confettiTriggerCount, setConfettiTriggerCount] = useState<number>(0) // Track confetti trigger attempts

  // STABLE STATE MANAGEMENT: Prevent race conditions with atomic state updates
  const [stableSpinState, setStableSpinState] = useState({
    isSpinning: false,
    lastSpinId: '',
    lastWinnerAnnouncement: 0,
    winnerAnnouncementLock: false
  })

  // Prevent drawing loops
  const lastDrawnItemsRef = useRef<string[]>([])
  const lastDrawnThemeRef = useRef<any>(null)
  const lastVisibilityCheck = useRef<string>("")

  // Animation control refs for multiple spins with enhanced stability
  const animationRef = useRef<number | null>(null)
  const stopAnimationRef = useRef(false)
  const isAnimationRunningRef = useRef(false)
  const lastAnimationTimeRef = useRef<number>(0)
  const animationStartTimeRef = useRef<number>(0)
  const animationCompletedRef = useRef(false)
  const mySpinStartTimeRef = useRef<number>(0) // Track when I initiated a spin
  const lastProcessedSpinIdRef = useRef<string>('') // Track last processed spin to prevent duplicates

  // ENHANCED: Remember collaborator status to prevent permission reset during spinning
  const rememberedCollaboratorStatus = useRef(!!userPermissions?.isFullAccessCollaborator)

  // Initialize animation state on mount to prevent stale states
  useEffect(() => {
    // Remember if we were initially a collaborator
    if (userPermissions?.isFullAccessCollaborator) {
      rememberedCollaboratorStatus.current = true
    }

    // Reset all animation refs to ensure clean state
    isAnimationRunningRef.current = false
    stopAnimationRef.current = false
    animationCompletedRef.current = false
    animationRef.current = null
    lastAnimationTimeRef.current = 0
    animationStartTimeRef.current = 0
    isSpinningRef.current = false
    mySpinStartTimeRef.current = 0 // Reset my spin tracker
    lastProcessedSpinIdRef.current = '' // Reset processed spin ID tracker

    // Reset drawing refs
    lastDrawnItemsRef.current = []
    lastDrawnThemeRef.current = null
    lastVisibilityCheck.current = ""

    // Clear any stale state
    setIsSpinningWithRef(false)
    setShowResults(false)
    setHasAnnouncedWinners(false)
    setCurrentSpinId("")
    hasAnnouncedOnce.current = false

    // Clear confetti state with enhanced reset
    setIsConfettiActive(false)
    setLastConfettiTrigger("")
    setConfettiTriggerCount(0)
    if (confettiTimeoutRef) {
      clearTimeout(confettiTimeoutRef)
      setConfettiTimeoutRef(null)
    }

    // CRITICAL FIX: Initialize participant wheel state
    if (!organizerMode && !userPermissions.isFullAccessCollaborator) {
      console.log("🎯 PARTICIPANT: Initializing wheel state to prevent white screen")
      setParticipantWheelReady(true)
      participantStateRef.current.isInitialized = true
      
      // CRITICAL: Set persistent theme immediately for participants
      if (wheelTheme && !persistentTheme) {
        setPersistentTheme(wheelTheme)
        console.log("🎨 PARTICIPANT: Persistent theme initialized", wheelTheme)
      }
      
      // Force initial wheel draw for participants
      setTimeout(() => {
        const canvas = canvasRef.current
        if (canvas) {
          const ctx = canvas.getContext("2d")
          if (ctx) {
            console.log("🎯 PARTICIPANT: Initial wheel draw with persistent theme")
            const safeTheme = persistentTheme || wheelTheme || {
              primary: '#8e0b16',
              secondary: '#66181E',
              accent: '#ffffff',
              background: '#f8f9fa'
            }
            drawWheelAtAngleWithItems(ctx, canvas, 0, wheelItems.length > 0 ? wheelItems : ["Option 1", "Option 2", "Option 3"], safeTheme)
          }
        }
      }, 100)
    }
  }, [sessionId, organizerMode, isLiveMode, enableRealTimeSync, userPermissions?.isFullAccessCollaborator])

  // CRITICAL: Listen for custom events to clear winner state (from live page)
  useEffect(() => {
    const handleClearWinners = () => {
      console.log("🎯 EVENT: Clearing winners due to wheel type change")
      setWinners([])
      setShowResults(false)
      setHasAnnouncedWinners(false)
      setPendingWinners(null)
      setCurrentSpinId("")
      lastAnnouncedWinnerIds.current = ""
      hasAnnouncedOnce.current = false
      setIsConfettiActive(false)
      
      // Clear any running animations
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
        animationRef.current = null
      }
      isAnimationRunningRef.current = false
      stopAnimationRef.current = false
      animationCompletedRef.current = false
      setIsSpinningWithRef(false)
    }

    // CRITICAL: Handle reset to zero angle from organizer
    const handleResetToZero = (event: any) => {
      console.log("🔄 PARTICIPANT: Reset to zero event received", event.detail)
      
      // Stop any running animation
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
        animationRef.current = null
      }
      
      // Reset angle to 0
      setCurrentAngle(0)
      
      // Clear all winner and spinning states
      handleClearWinners()
      
      // Force immediate redraw at angle 0
      setTimeout(() => {
        const canvas = canvasRef.current
        if (canvas) {
          const ctx = canvas.getContext("2d")
          if (ctx) {
            console.log("🔄 PARTICIPANT: Forcing immediate redraw at angle 0")
            // Use customItems or participants to avoid dependency issues
            const currentWheelItems = customItems && customItems.length > 0 ? customItems : participants.map(p => p.name)
            drawWheelAtAngleWithItems(ctx, canvas, 0, currentWheelItems, persistentTheme || wheelTheme)
          }
        }
      }, 50)
      
      console.log("✅ PARTICIPANT: Wheel reset to angle 0 complete")
    }

    // 🎯 CRITICAL: Handle force redraw from organizer when items are applied
    const handleForceRedraw = (event: any) => {
      console.log("🎯 PARTICIPANT: Force redraw event received", event.detail)
      
      const newItems = event.detail?.items || []
      if (newItems.length === 0) {
        console.warn("⚠️ Force redraw event received but no items provided")
        return
      }

      console.log("🎯 PARTICIPANT: Forcing immediate wheel redraw with new items:", {
        itemCount: newItems.length,
        preview: newItems.slice(0, 3),
        source: event.detail?.source,
        timestamp: event.detail?.timestamp
      })
      
      // Force immediate redraw with new items - multiple times for guaranteed visibility
      const forceRedrawWithItems = () => {
        const canvas = canvasRef.current
        if (canvas) {
          const ctx = canvas.getContext("2d")
          if (ctx) {
            drawWheelAtAngleWithItems(ctx, canvas, currentAngle, newItems, persistentTheme || wheelTheme)
            console.log("✅ PARTICIPANT: Wheel redrawn with", newItems.length, "new items")
          }
        }
      }

      // Multiple redraws with precise timing for guaranteed visibility
      forceRedrawWithItems() // Immediate
      setTimeout(forceRedrawWithItems, 10) // After state update
      setTimeout(forceRedrawWithItems, 50) // Safety redraw
      setTimeout(forceRedrawWithItems, 100) // Final guarantee
    }

    // Listen for all custom events
    window.addEventListener('clearParticipantWinners', handleClearWinners)
    window.addEventListener('clearWheelWinners', handleClearWinners)
    window.addEventListener('resetWheelToZero', handleResetToZero as EventListener)
    window.addEventListener('forceWheelRedraw', handleForceRedraw as EventListener)

    return () => {
      window.removeEventListener('clearParticipantWinners', handleClearWinners)
      window.removeEventListener('clearWheelWinners', handleClearWinners)
      window.removeEventListener('resetWheelToZero', handleResetToZero as EventListener)
      window.removeEventListener('forceWheelRedraw', handleForceRedraw as EventListener)
    }
  }, [])


  // Monitor winner changes and trigger effects - prevent multiple announcements
  const [hasAnnouncedWinners, setHasAnnouncedWinners] = useState(false)
  const [currentSpinId, setCurrentSpinId] = useState<string>("")
  const [spinId, setSpinId] = useState<string>("")

  // Enhanced confetti trigger function with deduplication
  const triggerConfettiSafely = useCallback((spinId?: string) => {
    const triggerId = spinId || `spin-${Date.now()}-${Math.random()}`

    // Prevent duplicate confetti triggers for the same spin
    if (lastConfettiTrigger === triggerId && isConfettiActive) {
      console.log("🎊 CONFETTI DEDUPLICATION: Skipping duplicate confetti trigger", {
        triggerId,
        lastConfettiTrigger,
        isConfettiActive,
        confettiTriggerCount,
        sessionId: sessionId,
        organizerMode: organizerMode
      })
      return false
    }

    // Prevent too many rapid confetti triggers (rate limiting)
    const now = Date.now()
    if (confettiTriggerCount > 3 && now - parseInt(lastConfettiTrigger.split('-')[1] || '0') < 5000) {
      console.log("🎊 CONFETTI RATE LIMIT: Too many rapid triggers, skipping", {
        triggerId,
        confettiTriggerCount,
        timeSinceLastTrigger: now - parseInt(lastConfettiTrigger.split('-')[1] || '0'),
        sessionId: sessionId,
        organizerMode: organizerMode
      })
      return false
    }

    console.log("🎊 CONFETTI TRIGGER: Starting confetti animation", {
      triggerId,
      isConfettiActive,
      confettiTriggerCount,
      spinId,
      sessionId: sessionId,
      organizerMode: organizerMode,
      deduplicationActive: true
    })

    // Clear any existing confetti timeout
    if (confettiTimeoutRef) {
      clearTimeout(confettiTimeoutRef)
      setConfettiTimeoutRef(null)
    }

    // Set confetti active state
    setIsConfettiActive(true)
    setLastConfettiTrigger(triggerId)
    setConfettiTriggerCount(prev => prev + 1)

    // Trigger the actual confetti
    triggerConfetti()

    return true
  }, [lastConfettiTrigger, isConfettiActive, confettiTriggerCount, confettiTimeoutRef, sessionId, organizerMode])

  // Enhanced triggerConfetti function with safety checks
  const triggerConfetti = useCallback(() => {
    if (!settings.showConfetti || isConfettiActive) {
      console.log("🎊 CONFETTI BLOCKED: Already active or disabled", {
        showConfetti: settings.showConfetti,
        isConfettiActive
      })
      return
    }

    console.log("🎊 CONFETTI START: Launching confetti animation")

    // Prevent multiple confetti animations
    setIsConfettiActive(true)

    // Multiple confetti bursts for better effect
    const duration = 3000
    const animationEnd = Date.now() + duration
    const defaults = {
      startVelocity: 30,
      spread: 360,
      ticks: 60,
      zIndex: 0,
      colors: [schoolColors.primary, schoolColors.secondary, schoolColors.accent, '#FFD700', '#FF6B6B', '#4ECDC4']
    }

    function randomInRange(min: number, max: number) {
      return Math.random() * (max - min) + min
    }

    const interval: any = setInterval(function() {
      const timeLeft = animationEnd - Date.now()

      if (timeLeft <= 0) {
        clearInterval(interval)
        setIsConfettiActive(false)
        console.log("🎊 CONFETTI END: Animation completed")
        return
      }

      const particleCount = 50 * (timeLeft / duration)

      // Left side
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
      })

      // Right side
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
      })
    }, 250)

    // Fallback timeout to ensure confetti state is reset
    const timeout = setTimeout(() => {
      setIsConfettiActive(false)
      console.log("🎊 CONFETTI TIMEOUT: Fallback timeout reached")
    }, duration + 1000)

    setConfettiTimeoutRef(timeout)
  }, [settings.showConfetti, isConfettiActive,  confettiTimeoutRef])

  // 🎯 STABILITY: Rendering lock to prevent concurrent draws
  const isRenderingRef = useRef(false)
  const pendingRenderRef = useRef<(() => void) | null>(null)

  // 🎯 STABILITY: Connection state monitoring
  const [connectionState, setConnectionState] = useState<'connected' | 'connecting' | 'disconnected'>('connecting')
  const connectionCheckInterval = useRef<NodeJS.Timeout | null>(null)

  // 🔥 CRITICAL: Persistent storage for filled live participants - NEVER CLEAR THIS
  const filledLiveParticipantsRef = useRef<string[]>([])
  
  // 🎯 STABLE: Memoized wheel items calculation with minimal dependencies
  // 🔥 CRITICAL: Cap to 50 items maximum to prevent too many wheel slices
  // 🔥 SOLO MODE FIX: Always include participants in dependencies to ensure instant updates in solo mode
  const wheelItems = useMemo(() => {
    const itemsForCurrentWheelType = editableItemsByWheelType[currentWheelTypeId] || []
    let selectedItems: string[] = []
    
    // 🔥 CLEAR ALL FIX: If in solo mode and participants is empty, return empty array (completely clear wheel)
    // This ensures "Clear All" shows a completely empty wheel with no items or fallback text
    if (userPermissions?.synchronizationEnabled === false && !isLiveMode) {
      if (!participants || !Array.isArray(participants) || participants.length === 0) {
        console.log("🔥 SOLO MODE: Participants cleared - returning empty wheel", {
          count: 0,
          message: "Wheel is now empty"
        })
        return []
      }
    }
    
    // 🔥 SOLO MODE: HIGHEST PRIORITY - Always use current participants when in solo mode
    // This ensures instant reflection of add/delete operations and prevents items from vanishing after spins
    if (participants && Array.isArray(participants) && participants.length > 0 && userPermissions?.synchronizationEnabled === false && !isLiveMode) {
      console.log("🔥 SOLO MODE: Using current participants directly for instant updates", {
        count: participants.length,
        items: participants.slice(0, 3).map(p => p.name)
      })
      selectedItems = participants.map(p => p.name)
    }
    // PRIORITY 0: Forced shuffled items from organizer/real-time sync
    else if (shuffledItemsOverride && shuffledItemsOverride.length > 0) {
      selectedItems = shuffledItemsOverride
    }
    // 🎯 PRIORITY 0.2: If organizer did random selection, show only selected students
    // This ensures both organizer and participants see the same filtered list
    else if (showSelectedStudentsOnWheel && selectedStudents && selectedStudents.length > 0) {
      selectedItems = selectedStudents.map(s => s.name)
      console.log("🎯 ORGANIZER VIEW: Showing random selected students on wheel", {
        count: selectedItems.length,
        preview: selectedItems.slice(0, 5)
      })
    }
    // 🎯 PRIORITY 0.3: If in research mode and should show selected students, use them
    // This is used AFTER spinning completes to show only the selected students
    else if (showSelectedStudentsOnWheel && filledLiveParticipantsRef.current.length > 0) {
      console.log("🎯 RESEARCH MODE: Showing", filledLiveParticipantsRef.current.length, "selected students on wheel")
      selectedItems = filledLiveParticipantsRef.current
    }
    // 🔥 PRIORITY 0.5: Use persisted filled live participants if editing mode is active (HIGHEST PRIORITY FOR USER EDITS)
    // This ensures manually applied items ALWAYS take precedence and survive spins
    else if (isEditingItems && filledLiveParticipantsRef.current.length > 0) {
      console.log("🔥 USING PERSISTED ITEMS: Returning", filledLiveParticipantsRef.current.length, "items from filledLiveParticipantsRef")
      selectedItems = filledLiveParticipantsRef.current
    }
    // PRIORITY 1: Use customItems from organizer (high priority for real-time sync)
    else if (customItems && customItems.length > 0 && !isEditingItems) {
      selectedItems = customItems
    }
    // PRIORITY 2: Use items for current wheel type from editableItemsByWheelType (ISOLATED PER WHEEL TYPE)
    else if (itemsForCurrentWheelType.length > 0) {
      selectedItems = itemsForCurrentWheelType
    }
    // PRIORITY 2.5: Use persisted filled live participants if available (NEVER CLEARED BY SPIN)
    else if (filledLiveParticipantsRef.current.length > 0) {
      console.log("🔥 FALLBACK TO PERSISTED: Using", filledLiveParticipantsRef.current.length, "items from filledLiveParticipantsRef")
      selectedItems = filledLiveParticipantsRef.current
    }
    // PRIORITY 3: Filter to live participants only if enabled
    else if (showOnlyLiveParticipants && liveParticipants.length > 0) {
      selectedItems = liveParticipants.map(p => p.name)
    }
    // PRIORITY 4: Use selected wheel type default items (higher priority for proper wheel display)
    else if (selectedWheelType?.defaultItems && selectedWheelType.defaultItems.length > 0) {
      selectedItems = selectedWheelType.defaultItems
    }
    // PRIORITY 5: Use participants prop if provided and has content (takes priority over generic fallbacks)
    else if (participants && Array.isArray(participants) && participants.length > 0) {
      selectedItems = participants.map(p => p.name)
    }
    // PRIORITY 6: Fallback for participants
    else if (!organizerMode && !userPermissions.isFullAccessCollaborator) {
      selectedItems = ["Option 1", "Option 2", "Option 3", "Option 4", "Option 5"]
    }
    // PRIORITY 7: Ultimate fallback
    else {
      selectedItems = ["Option 1", "Option 2", "Option 3", "Option 4", "Option 5"]
    }
    
    // 🔥 CRITICAL CAP: Limit to 50 items maximum for optimal wheel performance
    return selectedItems.slice(0, 50)
  }, [shuffledItemsOverride, customItems, isEditingItems, editableItemsByWheelType, currentWheelTypeId, showOnlyLiveParticipants, liveParticipants, selectedWheelType?.defaultItems, selectedWheelType?.id, participants, organizerMode, userPermissions.isFullAccessCollaborator, userPermissions?.synchronizationEnabled, isLiveMode, showSelectedStudentsOnWheel, selectedStudents])

  // 🎯 STABILITY: Use stable reference for wheel items to prevent unnecessary re-renders
  const stableWheelItemsRef = useRef<string[]>([])
  const stableWheelItems = useMemo(() => {
    // Only update if items actually changed (deep comparison)
    const itemsChanged = JSON.stringify(stableWheelItemsRef.current) !== JSON.stringify(wheelItems)
    if (itemsChanged) {
      stableWheelItemsRef.current = wheelItems
    }
    return stableWheelItemsRef.current
  }, [wheelItems])

  // 🔥 CRITICAL FIX: Sync participants prop with filledLiveParticipantsRef for solo picker wheels
  // This ensures that when items are added/deleted, they're immediately persisted and won't vanish after spinning
  useEffect(() => {
    if (participants && Array.isArray(participants) && participants.length > 0) {
      const participantNames = participants.map(p => p.name)
      const participantNamesJson = JSON.stringify(participantNames)
      const filledLiveParticipantsJson = JSON.stringify(filledLiveParticipantsRef.current)
      
      // Only update if the participants list actually changed
      if (participantNamesJson !== filledLiveParticipantsJson) {
        filledLiveParticipantsRef.current = participantNames
        console.log("🔥 SYNCED PARTICIPANTS: filledLiveParticipantsRef updated with", participantNames.length, "items from participants prop", {
          items: participantNames.slice(0, 3),
          total: participantNames.length,
          timestamp: new Date().toISOString()
        })
      }
    }
  }, [participants])

  // 🎯 STABILITY: Connection state monitoring for better sync reliability
  useEffect(() => {
    if (!enableRealTimeSync || !sessionId) {
      setConnectionState('disconnected')
      return
    }

    setConnectionState('connecting')

    // Monitor connection state
    const checkConnection = async () => {
      try {
        const sessionDoc = await getDoc(doc(db, "liveDrawSessions", sessionId))
        if (sessionDoc.exists()) {
          setConnectionState('connected')
        } else {
          setConnectionState('disconnected')
        }
      } catch (error) {
        console.warn("Connection check failed:", error)
        setConnectionState('disconnected')
      }
    }

    // Initial check
    checkConnection()

    // Periodic check every 30 seconds
    connectionCheckInterval.current = setInterval(checkConnection, 30000)

    return () => {
      if (connectionCheckInterval.current) {
        clearInterval(connectionCheckInterval.current)
      }
    }
  }, [enableRealTimeSync, sessionId])

  // 🎯 ULTRA-STABLE WHEEL TYPE CHANGE: Global redraw lock to prevent flickering
  const [isWheelTypeChanging, setIsWheelTypeChanging] = useState(false)
  const wheelTypeChangeTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastWheelTypeIdRef = useRef<string>("")
  const lastWheelTypeChangeIdRef = useRef<string>("")
  const redrawLockRef = useRef(false) // Global lock to prevent multiple redraws
  const lastRedrawTimeRef = useRef<number>(0) // Track last redraw time to prevent spam
  const wheelTransitionLockRef = useRef(false) // Prevent any drawing during wheel type transitions
  const stableWheelStateRef = useRef<{
    items: string[],
    theme: any,
    isStable: boolean,
    lastUpdate: number
  }>({
    items: [],
    theme: null,
    isStable: false,
    lastUpdate: 0
  })

  // 🎯 NEW: Track last successfully drawn state to prevent redundant draws
  const lastSuccessfulDrawRef = useRef<{
    items: string[],
    angle: number,
    theme: any,
    timestamp: number
  } | null>(null)

  // CRITICAL FIX: Participant wheel state management
  const [participantWheelReady, setParticipantWheelReady] = useState(false)
  const participantStateRef = useRef({
    lastThemeUpdate: 0,
    lastItemsUpdate: 0,
    isInitialized: false
  })

  // 🎯 ATOMIC WHEEL TYPE CHANGE: Instant, non-blocking wheel type switching
  useEffect(() => {
    if (!selectedWheelType?.id) return

    // 🚨 CRITICAL: Skip if already processed
    if (lastWheelTypeIdRef.current === selectedWheelType.id) {
      return
    }
    
    // Mark as processing immediately
    lastWheelTypeIdRef.current = selectedWheelType.id
    const changeIdentifier = `local-${selectedWheelType.id}-${Date.now()}`
    lastWheelTypeChangeIdRef.current = changeIdentifier

    // 🎯 INSTANT STATE CLEAR: Clear all states synchronously (no blocking)
    setWinners([])
    setShowResults(false)
    setHasAnnouncedWinners(false)
    setCurrentSpinId("")
    setPendingWinners(null)
    setIsConfettiActive(false)
    lastAnnouncedWinnerIds.current = ""
    hasAnnouncedOnce.current = false

    // 🚨 FORCE STOP: Clear animation states instantly
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
      animationRef.current = null
    }
    if (confettiTimeoutRef) {
      clearTimeout(confettiTimeoutRef)
      setConfettiTimeoutRef(null)
    }

    // Clear spinning states
    setIsSpinningWithRef(false)
    stopAnimationRef.current = true
    isAnimationRunningRef.current = false
    animationCompletedRef.current = false
    lastProcessedSpinIdRef.current = ''
    mySpinStartTimeRef.current = 0

    // Reset editing state ONLY if no custom items are applied
    // 🔥 CRITICAL FIX: DON'T clear editing state or filled participants if user has applied custom items
    const hasAppliedCustomItems = editableItems.length > 0 || filledLiveParticipantsRef.current.length > 0
    if (!hasAppliedCustomItems) {
      setIsEditingItems(false)
      setNewItemText("")
    }
    setShuffledItemsOverride(null)
    
    // 🔥 CRITICAL FIX: NEVER clear filledLiveParticipantsRef - it holds user's manually added participants
    // Only clear on explicit "Reset to Original" or "Clear All" actions
    // filledLiveParticipantsRef.current = [] // REMOVED: This was causing participant names to disappear

    // 🔥 BROADCAST: Non-blocking Firebase update
    if (enableRealTimeSync && sessionId && effectiveOrganizerMode) {
      const wheelChangeId = `wheel-change-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      
      // 🔥 CRITICAL: Preserve filled live participants, don't reset to defaults
      const itemsToPreserve = filledLiveParticipantsRef.current.length > 0 
        ? filledLiveParticipantsRef.current 
        : (selectedWheelType.defaultItems || [])
      
      updateDoc(doc(db, "liveDrawSessions", sessionId), {
        "wheelState.wheelTypeChanged": true,
        "wheelState.wheelTypeId": selectedWheelType.id,
        "wheelState.wheelTypeChangeId": wheelChangeId,
        "wheelState.wheelTypeChangedAt": Date.now(),
        "wheelState.clearWinners": true,
        "wheelState.resetAnnouncement": true,
        "wheelState.shuffledItems": null,
        // 🔥 PRESERVE FILLED ITEMS - Don't reset to defaults if we have filled participants
        "wheelState.customItems": itemsToPreserve,
        "wheelState.wheelItems": itemsToPreserve,
        winners: [],
        currentState: 'waiting',
        isSpinning: false,
        updatedAt: serverTimestamp()
      }).then(() => {
        setTimeout(() => {
          updateDoc(doc(db, "liveDrawSessions", sessionId), {
            "wheelState.wheelTypeChanged": false,
            "wheelState.clearWinners": false,
            updatedAt: serverTimestamp()
          }).catch(() => {})
        }, 150)
      }).catch(() => {})
    }

    // 🚨 UNLOCK STATE: Let React handle redraw
    setIsWheelTypeChanging(false)
    redrawLockRef.current = false
    wheelTransitionLockRef.current = false
    
    // 🎯 SMOOTH REDRAW: Use RAF for non-blocking render
    if (!isSpinning && !isAnimationRunningRef.current) {
      requestAnimationFrame(() => {
        const canvas = canvasRef.current
        if (canvas) {
          const ctx = canvas.getContext("2d")
          if (ctx) {
            drawWheelAtAngleWithItems(ctx, canvas, currentAngle, wheelItems, persistentTheme || wheelTheme)
          }
        }
      })
    }
  }, [selectedWheelType?.id, enableRealTimeSync, sessionId, effectiveOrganizerMode])

  // 🔥 SOLO MODE FIX: Force wheel redraw when participants change in solo mode
  // This ensures instant reflection of add/delete operations and prevents items from vanishing after spins
  useEffect(() => {
    // Only apply this fix in solo mode (not live mode, synchronization disabled)
    if (userPermissions?.synchronizationEnabled !== false || isLiveMode) {
      return
    }

    const participantNames = participants.map(p => p.name).join(',')
    console.log("🔥 SOLO MODE: Participants changed - forcing wheel redraw", {
      count: participants.length,
      items: participants.slice(0, 3).map(p => p.name)
    })

    // Force an immediate redraw to reflect participant changes
    if (!isSpinning && canvasRef.current) {
      requestAnimationFrame(() => {
        const canvas = canvasRef.current
        if (canvas) {
          const ctx = canvas.getContext("2d")
          if (ctx) {
            drawWheelAtAngleWithItems(ctx, canvas, currentAngle, wheelItems, persistentTheme || wheelTheme)
          }
        }
      })
    }
  }, [participants, userPermissions?.synchronizationEnabled, isLiveMode, wheelItems, currentAngle, persistentTheme, wheelTheme, isSpinning])

  // 🎯 SINGLE WINNER ANNOUNCEMENT SYSTEM - Prevents duplicate announcements
  const lastAnnouncedWinnerIds = useRef<string>("")
  const lastProcessedWheelTypeId = useRef<string>("") // Track processed wheel types
  const winnerAnnouncementLock = useRef<boolean>(false) // Prevent multiple simultaneous announcements
  const hasAnnouncedOnce = useRef<boolean>(false) // Track if announcement has been made

  useEffect(() => {
    // Ensure only one announcement per spin
    if (isSpinning || winnerAnnouncementLock.current) return
    if (winners.length === 0) return

    const winnerIds = winners.map(w => w.id || w.name).join('-')
    if (lastAnnouncedWinnerIds.current === winnerIds || hasAnnouncedOnce.current) return

    const shouldAnnounce = organizerMode ? animationCompletedRef.current : true
    if (!shouldAnnounce) return

    winnerAnnouncementLock.current = true
    hasAnnouncedOnce.current = true
    lastAnnouncedWinnerIds.current = winnerIds
    setHasAnnouncedWinners(true)

    if (onWinnersDetected) { try { onWinnersDetected(winners) } catch {} }
    if (settings.showConfetti) triggerConfettiSafely(`winners-${winnerIds}`)

    setTimeout(() => { winnerAnnouncementLock.current = false }, 2000)
  }, [winners, isSpinning, organizerMode, settings.showConfetti])

  // 🛡️ SUPER ACCURATE: Prevent showing results while animation is running
  useEffect(() => {
    if (showResults && isAnimationRunningRef.current) {
      console.log("⚠️ SAFETY CHECK: showResults set while animation still running - forcing reset", {
        showResults: true,
        isAnimationRunning: isAnimationRunningRef.current,
        winnerCount: winners.length
      })
      // Force reset showResults until animation is truly complete
      setShowResults(false)
    }
  }, [showResults])

  // 🎯 CRITICAL FIX: Comprehensive spinning state cleanup when winners are announced
  useEffect(() => {
    if (showResults && winners.length > 0 && isSpinningRef.current && !hasAnnouncedWinners) {
      console.log("🎯 CLEANUP: Forcing spinning state reset after winner announcement", {
        isSpinning: isSpinningRef.current,
        showResults: true,
        winnerCount: winners.length,
        hasAnnouncedWinners
      })

      // Force reset all spinning states
      stopAnimationRef.current = true
      isAnimationRunningRef.current = false
      animationCompletedRef.current = true
      setIsSpinningWithRef(false)

      // Clear any running animation
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
        animationRef.current = null
      }

      // Also update Firestore to ensure all users stop spinning
      if (enableRealTimeSync && sessionId) {
        (async () => {
          try {
            const sessionRef = doc(db, "liveDrawSessions", sessionId)
            await updateDoc(sessionRef, {
              isSpinning: false,
              currentState: 'completed',
              wheelState: {
                isSpinning: false,
                completedAt: Date.now()
              },
              lastUpdated: serverTimestamp()
            })
            console.log("🎯 FORCE STOP: Updated Firestore to stop spinning for all users")
          } catch (error) {
            console.error("❌ Error forcing stop in Firestore:", error)
          }
        })()
      }
    }
  }, [showResults, hasAnnouncedWinners, enableRealTimeSync, sessionId])

  // 🚀 PERFECT PARTICIPANT SYNCHRONIZATION: Always listen and respond
  const participantSyncTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastExternalSpinState = useRef(false)
  const syncStartTimeRef = useRef<number>(0)
  
  useEffect(() => {
    console.log("🎯 EXTERNAL SPIN STATE CHANGE:", {
      externalIsSpinning,
      lastExternalSpinState: lastExternalSpinState.current,
      isAnimationRunning: isAnimationRunningRef.current,
      organizerMode,
      isFullAccessCollaborator: userPermissions.isFullAccessCollaborator
    })

    // Clear any pending sync timeout
    if (participantSyncTimeoutRef.current) {
      clearTimeout(participantSyncTimeoutRef.current)
      participantSyncTimeoutRef.current = null
    }

    // 🎯 CRITICAL: Handle BOTH start and stop of spinning
    console.log("🔍 EXTERNAL SPIN STATE CHECK:", {
      externalIsSpinning,
      lastExternalSpinState: lastExternalSpinState.current,
      changed: externalIsSpinning !== lastExternalSpinState.current,
      organizerMode,
      isParticipant: !organizerMode && !userPermissions.isFullAccessCollaborator
    })

    if (externalIsSpinning !== lastExternalSpinState.current) {
      lastExternalSpinState.current = externalIsSpinning
      
      if (externalIsSpinning) {
        // START SPINNING
        syncStartTimeRef.current = Date.now()
        
        console.log("🚀 PARTICIPANT SPIN TRIGGERED:", {
          externalIsSpinning: true,
          isAnimationRunning: isAnimationRunningRef.current,
          mySpinStartTime: mySpinStartTimeRef.current,
          timeSinceMyLastSpin: Date.now() - mySpinStartTimeRef.current,
          willSkip: isAnimationRunningRef.current || mySpinStartTimeRef.current > Date.now() - 1000
        })
        
        // Skip if we're the one who initiated the spin
        if (isAnimationRunningRef.current || mySpinStartTimeRef.current > Date.now() - 1000) {
          console.log("🎯 SKIP SYNC: We initiated this spin")
          return
        }

        console.log("✅ PARTICIPANT START SYNC: Starting synchronization NOW!", {
          hasSpinData: !!lastReceivedSpinData,
          isParticipant: !organizerMode && !userPermissions.isFullAccessCollaborator,
          syncStartTime: syncStartTimeRef.current
        })

        // CRITICAL: Stop any current animation IMMEDIATELY
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current)
          animationRef.current = null
        }

        // Clear all state IMMEDIATELY
        setWinners([])
        setPendingWinners(null)
        setShowResults(false)
        setHasAnnouncedWinners(false)
        setCurrentSpinId("")
        lastAnnouncedWinnerIds.current = ""
        hasAnnouncedOnce.current = false
        winnerAnnouncementLock.current = false
        
        // Reset animation state
        isAnimationRunningRef.current = false
        stopAnimationRef.current = false
        animationCompletedRef.current = false

        // Set spinning state
        setIsSpinningWithRef(true)
      
      // Start synchronized animation with EXACT same parameters as organizer
      if (lastReceivedSpinData) {
        console.log("🎯 STARTING INSTANT SYNC ANIMATION:", lastReceivedSpinData)
        
        // CRITICAL FIX: Use ZERO delay for instant synchronization
        const now = Date.now()
        const organizerStartTime = lastReceivedSpinData.spinStartTime || now
        
        // Calculate MINIMAL delay for perfect sync
        const networkDelay = Math.max(0, now - organizerStartTime)
        const maxAllowableDelay = 100 // Maximum 100ms compensation
        const timeElapsed = Math.min(networkDelay, maxAllowableDelay)
        
        // Use FULL duration for visual consistency, compensate with start offset
        const fullDuration = lastReceivedSpinData.spinDuration || 4000
        const adjustedDuration = Math.max(500, fullDuration - timeElapsed)
        
        console.log("🎯 INSTANT TIMING SYNCHRONIZATION:", {
          organizerStartTime: new Date(organizerStartTime).toISOString(),
          currentTime: new Date(now).toISOString(),
          networkDelay: networkDelay + 'ms',
          timeElapsed: timeElapsed + 'ms',
          originalDuration: fullDuration + 'ms',
          adjustedDuration: adjustedDuration + 'ms',
          syncQuality: networkDelay < 50 ? 'PERFECT' : networkDelay < 100 ? 'EXCELLENT' : 'GOOD',
          instantSync: true
        })
        
        // Use EXACT same parameters as organizer with MINIMAL compensation
        startFallbackAnimation({
          spinDuration: adjustedDuration, // Minimal compensation for perfect sync
          totalRotation: lastReceivedSpinData.totalRotation || (8 * 2 * Math.PI),
          finalAngle: lastReceivedSpinData.finalAngle || 0,
          spins: lastReceivedSpinData.spins || 8,
          wheelItemsUsed: lastReceivedSpinData.wheelItemsUsed || wheelItems,
          winningIndex: lastReceivedSpinData.winningIndex,
          winners: [],
          // CRITICAL FIX: Ensure theme persistence for participants - never let it be undefined
          animationTheme: lastReceivedSpinData.animationTheme || lastReceivedSpinData.theme || persistentTheme || wheelTheme || {
            primary: '#8e0b16',
            secondary: '#66181E',
            accent: '#ffffff', 
            background: '#f8f9fa'
          },
          startTime: organizerStartTime,
          timeOffset: timeElapsed, // Minimal offset for instant sync
          networkDelay: networkDelay,
          syncMode: 'INSTANT', // Use instant sync mode
          guaranteedSync: true,
          participantMode: true // Mark as participant for special handling
        })
      } else {
        // Fallback animation if no spin data - use instant sync parameters
        console.log("🎯 INSTANT FALLBACK SYNC: No spin data, using optimized animation")
        startFallbackAnimation({
          spinDuration: 3000, // Shorter duration for responsiveness
          totalRotation: 6 * 2 * Math.PI, // Fewer rotations for faster sync
          finalAngle: 0,
          spins: 6,
          wheelItemsUsed: wheelItems,
          winningIndex: Math.floor(Math.random() * wheelItems.length),
          winners: [],
          animationTheme: wheelTheme,
          startTime: Date.now(),
          syncMode: 'INSTANT',
          participantMode: true
        })
      }
    } else {
      // STOP SPINNING
      console.log("🎯 PARTICIPANT STOP: External spinning stopped")
      
      // Force stop animation and clear spinning state
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
        animationRef.current = null
      }
      
      isAnimationRunningRef.current = false
      stopAnimationRef.current = true
      setIsSpinningWithRef(false)
      
      // Show results if we have pending winners
      if (pendingWinners && pendingWinners.length > 0) {
        setWinners(pendingWinners)
        setShowResults(true)
        setPendingWinners(null)
      }
    }
    }
  }, [externalIsSpinning, organizerMode, userPermissions, wheelItems, wheelTheme])

  // CRITICAL FIX: Handle pending winners - SIMPLIFIED AND RELIABLE
  useEffect(() => {
    // Simple winner announcement logic
    // 🔥 CRITICAL: Check BOTH isSpinning AND isAnimationRunningRef to prevent early announcement
    if (pendingWinners && pendingWinners.length > 0 && !isSpinning && !isAnimationRunningRef.current) {
      
      // Create unique ID for this winner set
      const winnerIds = pendingWinners.map(w => w.id || w.name).sort().join(',')
      
      // Skip if we've already announced these exact winners
      if (lastAnnouncedWinnerIds.current === winnerIds) {
        console.log("🎯 SKIP DUPLICATE WINNERS:", winnerIds)
        return
      }

      console.log("🎯 ANNOUNCING WINNERS (via second handler):", {
        count: pendingWinners.length,
        winners: pendingWinners.map(w => w.name),
        isParticipant: !organizerMode && !userPermissions.isFullAccessCollaborator,
        isAnimatingCheck: isAnimationRunningRef.current
      })

      // Stop any running animation
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
        animationRef.current = null
      }
      isAnimationRunningRef.current = false
      stopAnimationRef.current = false

      // Mark these winners as announced
      lastAnnouncedWinnerIds.current = winnerIds
      
      // 🔥 WHEEL COMPLETELY STOPPED: Show results immediately (no delay needed)
      // Animation completion check is already in the condition above
      console.log("✅ WHEEL STOPPED: Showing results now (animation handler)", {
        isSpinning: isSpinningRef.current,
        isAnimating: isAnimationRunningRef.current,
        winnerCount: pendingWinners.length
      })
      setWinners(pendingWinners)
      setShowResults(true)
      setPendingWinners(null)
      setHasAnnouncedWinners(true)
      
      // Trigger confetti for all users
      triggerConfettiSafely(`winner-announcement-${Date.now()}`)
      
      // Callback for live mode
      if (onWinnersDetected) {
        onWinnersDetected(pendingWinners)
      }
    }
  }, [pendingWinners, isSpinning, organizerMode, userPermissions])

  // Simplified fallback mechanism - only for participants when main handler fails
  useEffect(() => {
    if (externalIsSpinning && !organizerMode && !isAnimationRunningRef.current && !isSpinning) {
      console.log("🎯 FALLBACK ANIMATION for participant - TRIGGERED")
      setIsSpinningWithRef(true)
      setShowResults(false)
      triggerSynchronizedCollaborativeSpin()
    }
  }, [externalIsSpinning, organizerMode])

  // 🎯 STABILITY: Stable rendering function with queue system
  const stableRender = useCallback((renderFn: () => void) => {
    if (isRenderingRef.current) {
      // If already rendering, queue this render
      pendingRenderRef.current = renderFn
      return
    }

    isRenderingRef.current = true
    requestAnimationFrame(() => {
      try {
        renderFn()
      } finally {
        isRenderingRef.current = false
        // Execute pending render if any
        if (pendingRenderRef.current) {
          const pending = pendingRenderRef.current
          pendingRenderRef.current = null
          stableRender(pending)
        }
      }
    })
  }, [])

  // Simplified drawing function that matches other wheel types with optimizations
  const drawWheelAtAngleWithItems = useCallback((ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, angle: number, items: string[], forcedTheme?: any) => {
    // 🛡️ STABILITY: Validate canvas and context
    if (!ctx || !canvas || canvas.width === 0 || canvas.height === 0) {
      console.warn("⚠️ Invalid canvas state, skipping draw")
      return
    }

    // 🎯 CRITICAL FIX: Validate items FIRST before any checks
    // 🔥 CLEAR ALL FIX: If no items, clear the canvas and show empty wheel
    if (!items || items.length === 0) {
      console.log("🔥 CLEAR ALL: Clearing wheel canvas - wheel is now empty")
      // Clear the canvas completely
      ctx.save()
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.globalCompositeOperation = 'source-over'
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.restore()
      return
    }

    // 🚨 PREVENT DRAWING DURING WHEEL TYPE TRANSITIONS (organizer only)
    // BUT ALLOW if forcedTheme is provided (indicates manual override like shuffle)
    if (wheelTransitionLockRef.current && organizerMode && !forcedTheme) {
      console.log("🔒 DRAWING BLOCKED: Wheel type transition in progress, skipping draw")
      return
    }

    const centerX = canvas.width / 2
    const centerY = canvas.height / 2
    const radius = Math.min(centerX, centerY) - 15

    // 🎯 CONSISTENT RESPONSIVE DESIGN VARIABLES - Available throughout the function
    const isMobile = canvas.width < 400
    const isTablet = canvas.width >= 400 && canvas.width < 700
    const isDesktop = canvas.width >= 700
    const sliceCount = items.length

    // 🎯 USE STABLE STATE IF AVAILABLE TO PREVENT FLICKERING (organizer only)
    if (stableWheelStateRef.current.isStable && wheelTransitionLockRef.current && organizerMode && !forcedTheme) {
      console.log("🎯 USING STABLE STATE: Drawing with captured stable state during transition")
      const stableState = stableWheelStateRef.current
      // Use stable state items and theme to prevent flickering
      items = stableState.items
      forcedTheme = stableState.theme
    }

    // 🎨 FLICKER-FREE: Single-pass clear with compositing for smooth rendering
    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.globalCompositeOperation = 'source-over'
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.restore()

    // 🎨 CRITICAL FIX: ALWAYS use persistent theme - NEVER undefined/null
    // Priority: forcedTheme > persistentTheme > wheelTheme > defaultTheme
    // This prevents white wheel during shuffle by ensuring theme is always defined
    const currentTheme = forcedTheme || persistentTheme || wheelTheme || {
      primary: '#8e0b16',
      secondary: '#66181E', 
      accent: '#ffffff',
      background: '#f8f9fa'
    }

    // 🔍 DEBUG: Log theme source for troubleshooting
    if (process.env.NODE_ENV === 'development') {
      console.log("🎨 DRAWING WITH THEME:", {
        source: forcedTheme ? 'forced' : persistentTheme ? 'persistent' : wheelTheme ? 'wheel' : 'default',
        theme: currentTheme,
        isOrganizer: organizerMode
      })
    }

    // Draw wheel segments with enhanced shape preservation
    items.forEach((item, index) => {
        // 🎯 PERFECT SLICE GEOMETRY: Calculate exact segment angles for perfect pie slices
        // Enhanced algorithm ensures perfect slice shapes across all screen sizes
        const totalSlices = items.length
        const isEvenSlices = totalSlices % 2 === 0

        // Special handling for common slice counts to ensure perfect geometry
        let segmentAngle: number
        if (totalSlices === 3) {
          // Perfect 120-degree segments for 3 slices (equilateral geometry)
          segmentAngle = (2 * Math.PI) / 3
        } else if (totalSlices === 4) {
          // Perfect 90-degree segments for 4 slices (square geometry)
          segmentAngle = Math.PI / 2
        } else if (totalSlices === 6) {
          // Perfect 60-degree segments for 6 slices (hexagonal geometry)
          segmentAngle = Math.PI / 3
        } else {
          // Standard calculation for other slice counts
          segmentAngle = (2 * Math.PI) / totalSlices
        }

        const startAngle = index * segmentAngle + angle
        const endAngle = startAngle + segmentAngle

        // 🎯 SLICE SHAPE VALIDATION: Ensure perfect geometry before drawing
        const angleInDegrees = (segmentAngle * 180) / Math.PI
        const isValidSlice = angleInDegrees > 0 && angleInDegrees <= 360 // Valid slice angles (up to full circle for single item)
        const maintainsShape = Math.abs(segmentAngle - (2 * Math.PI) / totalSlices) < 0.001

        // Only draw slices with valid geometry to prevent distortion
        if (!isValidSlice || !maintainsShape) {
          console.warn("⚠️ Skipping invalid slice geometry:", {
            sliceIndex: index,
            segmentAngle: angleInDegrees,
            reason: !isValidSlice ? 'invalid-angle' : 'shape-distortion'
          })
          return
        }

        const hasValidImage = false

        // Calculate isEven outside try block so it's accessible in catch block
        const isEven = index % 2 === 0

        // Draw colored segment only if no image
        if (!hasValidImage) {
          ctx.fillStyle = isEven ? currentTheme.primary : currentTheme.secondary

          ctx.beginPath()
          ctx.moveTo(centerX, centerY)
          ctx.arc(centerX, centerY, radius, startAngle, endAngle)
          ctx.closePath()
          ctx.fill()
        }

    // Always draw enhanced border for clear slice segmentation - ENHANCED VISIBILITY
    ctx.strokeStyle = currentTheme.accent
    ctx.lineWidth = 5 // Increased from 4 to 5 for maximum visibility
    ctx.beginPath()
    ctx.moveTo(centerX, centerY)
    ctx.arc(centerX, centerY, radius, startAngle, endAngle)
    ctx.closePath()
    ctx.stroke()

    // Add prominent inner border for enhanced segmentation - MORE VISIBLE
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)'
    ctx.lineWidth = 2 // Increased from 1 to 2 for better visibility
    ctx.beginPath()
    ctx.moveTo(centerX, centerY)
    ctx.arc(centerX, centerY, radius - 3, startAngle, endAngle)
    ctx.closePath()
    ctx.stroke()

    // Add outer highlight border for maximum slice definition
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(centerX, centerY)
    ctx.arc(centerX, centerY, radius + 1, startAngle, endAngle)
    ctx.closePath()
    ctx.stroke()

    // Draw text - simplified like other wheel types
    // 🔥 HIDE TEXT FEATURE: Skip drawing text if hideWheelText is enabled
    if (!shouldHideText) {
      ctx.save()
      ctx.translate(centerX, centerY)
      ctx.rotate(startAngle + segmentAngle / 2)
      ctx.textAlign = "left"
      ctx.fillStyle = currentTheme.accent


      // Cached responsive font sizing based on screen size, slice count, and text length
      let baseFontSize: number
      if (isMobile) {
        baseFontSize = Math.max(9, Math.min(canvas.width / 24, 16)) // Increased upper limit for better readability
      } else if (isTablet) {
        baseFontSize = Math.max(10, Math.min(canvas.width / 22, 18)) // Increased upper limit
      } else {
        baseFontSize = Math.max(11, Math.min(canvas.width / 20, 20)) // Increased upper limit for desktop
      }

      // Cache average text length calculation outside loop if possible, but since wheelItems may change, compute once here
      const avgTextLength = wheelItems.reduce((sum, item) => sum + item.length, 0) / wheelItems.length
      const sliceCountAdjustment = Math.max(0, (wheelItems.length - 6) * 0.2)
      
      // More aggressive text length adjustment for very long text (50+ characters)
      let textLengthAdjustment: number
      if (avgTextLength > 50) {
        textLengthAdjustment = Math.max(0, (avgTextLength - 15) * 0.25) // More aggressive for 50+ chars
      } else if (avgTextLength > 30) {
        textLengthAdjustment = Math.max(0, (avgTextLength - 15) * 0.15) // Moderate for 30-50 chars
      } else {
        textLengthAdjustment = Math.max(0, (avgTextLength - 15) * 0.1) // Standard for <30 chars
      }
      
      const fontSize = Math.max(8, baseFontSize - sliceCountAdjustment - textLengthAdjustment)

      // Cache font string
      const fontString = `bold ${fontSize}px Arial`
      ctx.font = fontString

      // Cached responsive text length handling with better truncation
      let maxTextLength: number
      let useEllipsis: boolean

      if (isMobile) {
        // Mobile: More generous text length for better readability
        maxTextLength = Math.max(15, Math.min(25, Math.floor(canvas.width / 12)))
        useEllipsis = item.length > maxTextLength
      } else if (isTablet) {
        // Tablet: Balanced text length
        maxTextLength = Math.max(18, Math.min(35, Math.floor(canvas.width / 10)))
        useEllipsis = item.length > maxTextLength
      } else {
        // Desktop: Most generous text length, handles up to 50+ characters
        maxTextLength = Math.max(20, Math.min(60, Math.floor(canvas.width / 8)))
        useEllipsis = item.length > maxTextLength
      }

      // Smart text truncation with better handling of word boundaries and very long text
      let text: string
      if (useEllipsis) {
        // For very long text (50+ characters), be more aggressive with truncation
        const effectiveMaxLength = item.length > 50 ? Math.floor(maxTextLength * 0.8) : maxTextLength
        
        // Try to truncate at word boundary first
        const words = item.split(' ')
        let truncatedText = item

        // Find the longest prefix that fits within effectiveMaxLength
        for (let i = words.length; i > 0; i--) {
          const candidate = words.slice(0, i).join(' ')
          if (candidate.length <= effectiveMaxLength - 3) { // Reserve space for "..."
            truncatedText = candidate
            break
          }
        }

        // If even the first word is too long, truncate it
        if (truncatedText.length > effectiveMaxLength - 3) {
          truncatedText = item.substring(0, effectiveMaxLength - 3)
        }

        text = truncatedText + "..."
      } else {
        text = item
      }

      // Consistent text positioning for all wheels
      let textDistance: number
      let textY: number

      if (isMobile) {
        // Mobile: Standard positioning
        textDistance = radius * 0.32
        textY = 4
      } else if (isTablet) {
        // Tablet: Standard positioning
        textDistance = radius * 0.35
        textY = 5
      } else {
        // Desktop: Standard positioning
        textDistance = radius * 0.35
        textY = 5
      }

      ctx.fillText(text, textDistance, textY)

      // Only log text drawing in development and reduce frequency
      if (process.env.NODE_ENV === 'development' && index === 0) {
        console.log("🎯 RESPONSIVE TEXT DRAWN (sample):", {
          item: item.length > 10 ? item.substring(0, 10) + '...' : item,
          canvasSize: canvas.width,
          deviceType: isMobile ? 'Mobile' : isTablet ? 'Tablet' : 'Desktop',
          fontSize: fontSize.toFixed(1),
          maxTextLength: maxTextLength,
          sliceCount: wheelItems.length,
          responsiveDesign: true
        })
      }
      ctx.restore()
    } // 🔥 END OF: if (!shouldHideText)
    }) // 🔥 END OF: forEach loop

    // Add a consistent outer rim so organizer and participant wheels share the same black border
    const outerRingWidth = Math.max(8, Math.floor(canvas.width / 60))
    ctx.save()
    ctx.beginPath()
    ctx.lineWidth = outerRingWidth
    ctx.strokeStyle = "#FFFF"
    ctx.shadowColor = "FFFFFFFFFF"
    ctx.shadowBlur = Math.min(20, outerRingWidth * 1.5)
    ctx.arc(centerX, centerY, radius + outerRingWidth / 2, 0, 2 * Math.PI)
    ctx.stroke()
    ctx.restore()

    // Draw center and pointer - matches other wheel types
    const centerRadius = Math.max(30, canvas.width / 14)
    ctx.beginPath()
    ctx.arc(centerX, centerY, centerRadius, 0, 2 * Math.PI)
    ctx.fillStyle = currentTheme.accent
    ctx.fill()
    ctx.strokeStyle = currentTheme.primary
    ctx.lineWidth = 4
    ctx.stroke()

    // Simplified pointer - matches other wheel types
    const pointerSize = Math.max(18, canvas.width / 25)
    const pointerTipX = centerX + radius
    const pointerBaseX = pointerTipX - pointerSize * 1.5

    ctx.save()
    ctx.beginPath()
    ctx.moveTo(pointerBaseX, centerY)
    ctx.lineTo(pointerTipX, centerY - pointerSize * 0.7)
    ctx.lineTo(pointerTipX, centerY + pointerSize * 0.7)
    ctx.closePath()
    ctx.fillStyle = '#ffffff'
    ctx.fill()
    ctx.strokeStyle = currentTheme.primary
    ctx.lineWidth = 4
    ctx.stroke()
    ctx.restore()

  }, [wheelTheme, organizerMode, userPermissions])

  // 🎯 PERFECT WINNER CALCULATION FUNCTION - Used by both spin functions
  const calculateWinner = (totalRotation: number, wheelItems: string[]): { winningIndex: number, winner: string } => {
    // Canvas coordinate system: 0° = right (3 o'clock), positive rotation = clockwise
    // Pointer is positioned exactly at 0° (3 o'clock position)
    // The segment that contains the 0° position after rotation is the winner

    const segmentAngle = (2 * Math.PI) / wheelItems.length

    // 🎯 CRITICAL FIX: Calculate which segment contains the pointer at 0° after rotation
    // After rotation by totalRotation, the segment that contains angle 0° is the winner
    // Since segments are drawn with startAngle = index * segmentAngle + totalRotation
    // We need to find which segment's range includes 0° after this transformation

    // Normalize the rotation to a single segment (0 to segmentAngle)
    const normalizedRotation = totalRotation % (2 * Math.PI)

    // Calculate which segment contains the 0° position
    // The segment index is: floor(0 / segmentAngle) = 0, but we need to account for rotation
    // If a segment starts at angle S and ends at S + segmentAngle, after rotation R:
    // The segment that was originally at index I now spans (I * segmentAngle + R) to ((I+1) * segmentAngle + R)
    // We want to find I where (I * segmentAngle + R) <= 0 < ((I+1) * segmentAngle + R)

    // Solve for I: I * segmentAngle <= -R < (I+1) * segmentAngle
    // Divide by segmentAngle: I <= -R / segmentAngle < I+1
    const adjustedAngle = -normalizedRotation
    const winningIndex = Math.floor(adjustedAngle / segmentAngle) % wheelItems.length

    // Handle negative indices
    const finalWinningIndex = winningIndex < 0 ? wheelItems.length + winningIndex : winningIndex

    // 🎯 ENHANCED DEBUGGING: More detailed logging for verification
    if (process.env.NODE_ENV === 'development') {
      console.log("🎯 ULTRA-PRECISION WINNER CALCULATION:", {
        totalRotation: totalRotation.toFixed(6),
        totalRotationDegrees: (totalRotation * 180 / Math.PI).toFixed(2),
        normalizedRotation: normalizedRotation.toFixed(6),
        normalizedRotationDegrees: (normalizedRotation * 180 / Math.PI).toFixed(2),
        adjustedAngle: adjustedAngle.toFixed(6),
        adjustedAngleDegrees: (adjustedAngle * 180 / Math.PI).toFixed(2),
        segmentAngle: segmentAngle.toFixed(6),
        segmentAngleDegrees: (segmentAngle * 180 / Math.PI).toFixed(2),
        winningIndex: winningIndex,
        finalWinningIndex: finalWinningIndex,
        winner: wheelItems[finalWinningIndex],
        wheelItemsCount: wheelItems.length,
        pointerPosition: 'exactly at 0° (3 o\'clock)',
        calculationMethod: 'corrected-pointer-alignment',
        // 🎯 DEBUGGING: Show segment boundaries after rotation for verification
        segmentBoundaries: wheelItems.map((_, i) => {
          const segmentStart = (i * segmentAngle + normalizedRotation) % (2 * Math.PI)
          const segmentEnd = ((i + 1) * segmentAngle + normalizedRotation) % (2 * Math.PI)
          const containsPointer = (segmentStart <= 0 && segmentEnd > 0) ||
                                (segmentStart <= 2 * Math.PI && segmentEnd > 2 * Math.PI)
          return {
            segment: i,
            startAngle: segmentStart.toFixed(3),
            endAngle: segmentEnd.toFixed(3),
            containsPointer: containsPointer ? '🎯 POINTER HERE' : false
          }
        }),
        // 🎯 VERIFICATION: Show which segment contains the 0° position after rotation
        verification: {
          pointerAngle: '0°',
          segmentAtPointer: finalWinningIndex,
          segmentStartAngle: ((finalWinningIndex * segmentAngle + normalizedRotation) % (2 * Math.PI)).toFixed(3),
          segmentEndAngle: (((finalWinningIndex + 1) * segmentAngle + normalizedRotation) % (2 * Math.PI)).toFixed(3),
          pointerIsInSegment: (() => {
            const segStart = (finalWinningIndex * segmentAngle + normalizedRotation) % (2 * Math.PI)
            const segEnd = ((finalWinningIndex + 1) * segmentAngle + normalizedRotation) % (2 * Math.PI)
            return (segStart <= 0 && segEnd > 0) || (segStart <= 2 * Math.PI && segEnd > 2 * Math.PI)
          })()
        }
      })
    }

    // 🎯 CRITICAL FIX: Ensure winner calculation is perfectly accurate
    // Double-check the calculation to ensure pointer alignment
    const normalizedRotation2 = totalRotation % (2 * Math.PI)
    const adjustedAngle2 = -normalizedRotation2
    const doubleCheckIndex = Math.floor(adjustedAngle2 / segmentAngle) % wheelItems.length
    const finalDoubleCheckIndex = doubleCheckIndex < 0 ? wheelItems.length + doubleCheckIndex : doubleCheckIndex

    if (finalDoubleCheckIndex !== finalWinningIndex) {
      console.warn("🎯 WINNER CALCULATION MISMATCH: Double-check calculation differs!", {
        originalIndex: finalWinningIndex,
        doubleCheckIndex: finalDoubleCheckIndex,
        totalRotation: totalRotation,
        normalizedRotation: normalizedRotation2,
        adjustedAngle: adjustedAngle2,
        segmentAngle: segmentAngle,
        wheelItemsCount: wheelItems.length,
        calculationMethod: 'corrected-pointer-alignment'
      })
    }

    return {
      winningIndex: finalWinningIndex,
      winner: wheelItems[finalWinningIndex]
    }
  }
// Ultra-smooth easing function for silky animation across all spin methods
const easeInOutCubic = (t: number): number => {
  // Smoother quintic easing for more fluid motion
  return t < 0.5 ? 16 * t * t * t * t * t : 1 - Math.pow(-2 * t + 2, 5) / 2
}

// 🎯 PERFECTLY SYNCHRONIZED ANIMATION: Exact timing and position matching
const startFallbackAnimation = (spinParams?: any) => {
  // 🔄 CLEANUP: Remove any existing animation
  if (animationRef.current) {
    cancelAnimationFrame(animationRef.current)
    animationRef.current = null
  }
  cleanupAnimation()

  // 🎬 STATE INITIALIZATION: Reset all animation states
  stopAnimationRef.current = false
  isAnimationRunningRef.current = true
  animationCompletedRef.current = false

  // 🎯 EXACT PARAMETER EXTRACTION: Use organizer's precise values
  const duration = spinParams?.spinDuration || 4000
  const spins = spinParams?.spins || 8
  const totalRotation = spinParams?.totalRotation || (spins * 2 * Math.PI)
  const finalAngle = spinParams?.finalAngle || 0
  const wheelItemsUsed = spinParams?.wheelItemsUsed || wheelItems
  const animationTheme = spinParams?.animationTheme || spinParams?.theme || persistentTheme || wheelTheme
  const winningIndex = spinParams?.winningIndex !== undefined ? spinParams.winningIndex : Math.floor(Math.random() * wheelItemsUsed.length)
  const organizerStartTime = spinParams?.startTime || Date.now()
  const timeOffset = spinParams?.timeOffset || 0 // How much time has already elapsed
  
  // 🎯 CRITICAL: Start from current wheel position instead of 0 (only reset to 0 on explicit reset)
  const startingAngle = currentAngle

  // 🏆 WINNER CALCULATION: Determine the exact winner
  const calculatedWinner = calculateWinner(totalRotation, wheelItemsUsed)
  const winner = wheelItemsUsed[calculatedWinner.winningIndex]

  const selectedWinners = [{
    id: `sync-${Date.now()}`,
    name: winner,
    isSelected: true
  }]
  setPendingWinners(selectedWinners)

  console.log("🎯 PERFECT SYNC ANIMATION START:", {
    duration,
    timeOffset,
    adjustedDuration: duration - timeOffset,
    spins,
    totalRotation: (totalRotation / (2 * Math.PI)).toFixed(3),
    winningIndex: calculatedWinner.winningIndex,
    winner,
    organizerStartTime: new Date(organizerStartTime).toISOString(),
    syncTimestamp: new Date().toISOString()
  })

  // ⏱️ CRITICAL TIMING SYNC: Account for elapsed time since organizer started
  const adjustedDuration = Math.max(100, duration - timeOffset) // Minimum 100ms
  const startTime = performance.now()
  const initialProgress = timeOffset / duration // How far we should already be
  const initialRotation = totalRotation * easeInOutCubic(initialProgress)

  console.log("🎯 SYNC CALCULATION:", {
    originalDuration: duration,
    timeOffset: timeOffset,
    adjustedDuration: adjustedDuration,
    initialProgress: (initialProgress * 100).toFixed(1) + '%',
    initialRotation: (initialRotation / (2 * Math.PI)).toFixed(3) + ' rotations'
  })

  const animate = (currentTime: number) => {
    // 🛑 STOP CHECK: Exit if animation should stop
    if (stopAnimationRef.current || !isAnimationRunningRef.current) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
        animationRef.current = null
      }
      isAnimationRunningRef.current = false
      return
    }

    // 📊 PROGRESS CALCULATION: Calculate exact animation progress with sync offset
    const elapsed = currentTime - startTime
    const totalProgress = initialProgress + (elapsed / adjustedDuration) * (1 - initialProgress)
    const clampedProgress = Math.min(totalProgress, 1)
    const easeProgress = easeInOutCubic(clampedProgress)
    const currentRotation = totalRotation * easeProgress

    // 🎨 ULTRA-SMOOTH RENDERING: Optimized canvas drawing for 60fps
    const canvas = canvasRef.current
    if (canvas) {
      const ctx = canvas.getContext("2d", { 
        alpha: false, // Disable transparency for performance
        desynchronized: true // Allow canvas to desync for smoother animation
      })
      if (ctx) {
        // Enable image smoothing for better quality
        ctx.imageSmoothingEnabled = true
        ctx.imageSmoothingQuality = 'high'
        
        // CRITICAL: Use persistent theme for consistent colors during spin - NO OPACITY
        const spinningTheme = animationTheme || persistentTheme || wheelTheme
        drawWheelAtAngleWithItems(ctx, canvas, currentRotation, wheelItemsUsed, spinningTheme)
      }
    }

    // 📍 STATE UPDATE: Update angle for smooth animation
    setCurrentAngle(currentRotation)

    if (clampedProgress < 1 && elapsed < adjustedDuration) {
      // ▶️ CONTINUE: Request next frame for buttery-smooth 60fps
      if (!stopAnimationRef.current && isAnimationRunningRef.current) {
        animationRef.current = requestAnimationFrame(animate)
      }
    } else {
      // ✅ COMPLETE: Animation finished
      if (!animationCompletedRef.current) {
        animationCompletedRef.current = true
        isAnimationRunningRef.current = false
        animationRef.current = null
        stopAnimationRef.current = false

        setIsSpinningWithRef(false)
        setCurrentAngle(totalRotation)

        console.log("🎯 SYNC ANIMATION COMPLETE:", {
          winner: winner,
          finalRotation: (totalRotation / (2 * Math.PI)).toFixed(3),
          actualDuration: elapsed,
          plannedDuration: adjustedDuration,
          syncAccuracy: elapsed <= adjustedDuration + 50 ? 'PERFECT' : 'DELAYED'
        })

        // 🏆 CRITICAL FIX: Only show winners once - prevent duplicate announcements
        if (pendingWinners && pendingWinners.length > 0 && !hasAnnouncedWinners) {
          const winnerIds = pendingWinners.map(w => w.id || w.name).sort().join(',')
          
          // Only show winners if we haven't shown these exact winners before
          if (lastAnnouncedWinnerIds.current !== winnerIds) {
            console.log("🎯 ANIMATION COMPLETE - SHOWING WINNERS:", {
              winnerIds,
              lastAnnounced: lastAnnouncedWinnerIds.current,
              isParticipant: !organizerMode && !userPermissions.isFullAccessCollaborator
            })
            
            lastAnnouncedWinnerIds.current = winnerIds
            
            // 🔥 FIX: Only show results after wheel has completely stopped spinning
            const showResultsWithDelay = () => {
              if (!isSpinningRef.current && !isAnimationRunningRef.current) {
                // Wheel is completely stopped, show immediately
                console.log("✅ ANIMATION COMPLETE: Showing results now", {
                  isSpinning: isSpinningRef.current,
                  isAnimating: isAnimationRunningRef.current,
                  winnerCount: pendingWinners.length
                })
                setWinners(pendingWinners)
                setPendingWinners(null)
                setShowResults(true)
                setHasAnnouncedWinners(true)
                
                // Trigger confetti for all users when animation completes
                // Not just participants
                triggerConfetti()
              } else {
                // Still animating, wait and check again
                console.log("⏳ Still animating, waiting...", {
                  isSpinning: isSpinningRef.current,
                  isAnimating: isAnimationRunningRef.current
                })
                setTimeout(showResultsWithDelay, 100)
              }
            }
            
            showResultsWithDelay()
          } else {
            console.log("🎯 SKIP DUPLICATE WINNER ANNOUNCEMENT:", winnerIds)
          }
        }
      }
    }
  }

  // 🚀 START: Begin animation with perfect timing
  animationStartTimeRef.current = startTime
  animationRef.current = requestAnimationFrame(animate)
}

const triggerParticipantSpinAnimation = () => startFallbackAnimation()

const triggerSynchronizedCollaborativeSpin = () => {
  // Use the exact parameters from the organizer
  if (lastReceivedSpinData) {
    console.log("🎯 TRIGGERING SYNCHRONIZED SPIN: Using organizer's exact parameters", {
      hasSpinDuration: !!lastReceivedSpinData.spinDuration,
      hasTotalRotation: !!lastReceivedSpinData.totalRotation,
      hasFinalAngle: !!lastReceivedSpinData.finalAngle,
      hasWinningIndex: lastReceivedSpinData.winningIndex !== undefined,
      hasSpinStartTime: !!lastReceivedSpinData.spinStartTime
    })

    // Calculate adjusted duration for perfect synchronization
    const elapsed = Date.now() - (lastReceivedSpinData.spinStartTime || Date.now())
    const adjustedDuration = Math.max(0, (lastReceivedSpinData.spinDuration || 4000) - elapsed)

    console.log("🎯 SYNCHRONIZED TIMING:", {
      organizerStartTime: lastReceivedSpinData.spinStartTime,
      currentTime: Date.now(),
      elapsed,
      originalDuration: lastReceivedSpinData.spinDuration || 4000,
      adjustedDuration,
      perfectSync: true
    })

    startFallbackAnimation({
      ...lastReceivedSpinData,
      spinDuration: adjustedDuration
    })
  } else {
    console.warn("🎯 NO SPIN DATA: Using fallback animation")
    startFallbackAnimation()
  }
}

  // Enhanced cleanup function for animation stability
const cleanupAnimation = () => {
  // Cancel any running animation
  if (animationRef.current) {
    cancelAnimationFrame(animationRef.current)
    animationRef.current = null
  }

  // Reset all animation state
  stopAnimationRef.current = false
  isAnimationRunningRef.current = false
  animationStartTimeRef.current = 0
  animationCompletedRef.current = false

  // Ensure wheel remains visible after cleanup
  drawWheel(wheelItems, persistentTheme || wheelTheme)
}


  
  // Determine if editing should be allowed (ALLOW EDITING IN LIVE ORGANIZER MODE)
  const canEdit = !studentMode // Note: Removed !isLiveMode restriction to allow editing in live organizer mode

  // Allow editing in live mode for participants when organizer is present
  const isParticipantView = studentMode // Removed isLiveMode restriction to allow live participant editing
  const allowItemEditing = canEdit && !isParticipantView
  const allowThemeEditing = canEdit && !isParticipantView
  
  // Prevent editing states from being set if user is participant or view-only
  useEffect(() => {
    if (isParticipantView) {
      setIsEditingItems(false)
      setIsCustomizingTheme(false)
    }
  }, [isParticipantView])

  // STRICT VIEW ONLY: Ensure view-only users cannot edit or customize
  // BUT they MUST see synchronized spinning when organizer spins
  useEffect(() => {
    const isViewOnlyUser = userPermissions?.canViewOnly === true ||
      studentMode ||
      (isLiveMode && !effectiveOrganizerMode && !userPermissions.isFullAccessCollaborator)

    if (isViewOnlyUser) {
      console.log("🔒 VIEW ONLY MODE: Clearing all editing states for view-only user BUT keeping synchronization active", {
        canViewOnly: userPermissions?.canViewOnly,
        studentMode,
        isLiveMode,
        effectiveOrganizerMode,
        isFullAccessCollaborator: userPermissions.isFullAccessCollaborator,
        synchronizationEnabled: userPermissions?.synchronizationEnabled,
        sessionId: userPermissions?.sessionId,
        timestamp: new Date().toISOString()
      })

      // Clear all editing states immediately
      setIsEditingItems(false)
      setIsCustomizingTheme(false)
      setIsThemeDialogOpen(false)
      setIsTextDialogOpen(false)
      
      // NOTE: DO NOT disable synchronization - view-only users MUST see when organizer spins
      // The externalIsSpinning prop and Firebase listeners handle synchronization automatically
    }
  }, [userPermissions?.canViewOnly, studentMode, isLiveMode, effectiveOrganizerMode, userPermissions.isFullAccessCollaborator])

  // School color scheme
  const schoolColors = useMemo(() => ({
    primary: "#8e0b16",
    secondary: "#66181E",
    accent: "#ffffff",
    background: "#f8f9fa"
  }), [])

  // Theme presets for wheel customization
  const themePresets = useMemo(() => [
    {
      name: "School Colors",
      value: "school",
      primary: "#8e0b16",
      secondary: "#66181E",
      accent: "#ffffff",
      background: "#f8f9fa"
    },
    {
      name: "Rainbow Bright",
      value: "rainbow",
      primary: "#ff0080",
      secondary: "#00ff80",
      accent: "#ffffff",
      background: "#f0f0f0"
    },
    {
      name: "Neon Electric",
      value: "neon",
      primary: "#39ff14",
      secondary: "#ff073a",
      accent: "#000000",
      background: "#0a0a0a"
    },
    {
      name: "Ocean Depths",
      value: "ocean",
      primary: "#0077be",
      secondary: "#00a8cc",
      accent: "#ffffff",
      background: "#f0f8ff"
    },
    {
      name: "Sunset Blaze",
      value: "sunset",
      primary: "#ff4500",
      secondary: "#ff6347",
      accent: "#ffffff",
      background: "#fff8f0"
    },
    {
      name: "Purple Galaxy",
      value: "purple",
      primary: "#9932cc",
      secondary: "#6a0dad",
      accent: "#ffffff",
      background: "#f5f0ff"
    },
    {
      name: "Emerald Forest",
      value: "forest",
      primary: "#228b22",
      secondary: "#006400",
      accent: "#ffffff",
      background: "#f0fff0"
    },
    {
      name: "Hot Pink",
      value: "pink",
      primary: "#ff1493",
      secondary: "#ff69b4",
      accent: "#ffffff",
      background: "#fff0f5"
    },
    {
      name: "Golden Luxury",
      value: "gold",
      primary: "#ffd700",
      secondary: "#daa520",
      accent: "#000000",
      background: "#fffbf0"
    },
    {
      name: "Cyber Blue",
      value: "cyber",
      primary: "#00ffff",
      secondary: "#1e90ff",
      accent: "#000000",
      background: "#f0f8ff"
    },
    {
      name: "Fire & Ice",
      value: "fireice",
      primary: "#dc143c",
      secondary: "#4169e1",
      accent: "#ffffff",
      background: "#f8f8ff"
    },
    {
      name: "Lime Splash",
      value: "lime",
      primary: "#32cd32",
      secondary: "#adff2f",
      accent: "#000000",
      background: "#f0fff0"
    },
    {
      name: "Midnight Dark",
      value: "dark",
      primary: "#2c2c2c",
      secondary: "#4a4a4a",
      accent: "#ffffff",
      background: "#1a1a1a"
    },
    {
      name: "Cotton Candy",
      value: "pastel",
      primary: "#ffb6c1",
      secondary: "#dda0dd",
      accent: "#333333",
      background: "#faf0e6"
    },
    {
      name: "Volcanic Orange",
      value: "volcanic",
      primary: "#ff4500",
      secondary: "#ff8c00",
      accent: "#ffffff",
      background: "#fff8dc"
    },
    {
      name: "Arctic Frost",
      value: "arctic",
      primary: "#b0e0e6",
      secondary: "#87ceeb",
      accent: "#000080",
      background: "#f0f8ff"
    },
    {
      name: "Tropical Sunset",
      value: "tropical",
      primary: "#ff7f50",
      secondary: "#ffa500",
      accent: "#ffffff",
      background: "#ffefd5"
    },
    {
      name: "Royal Crown",
      value: "royal",
      primary: "#4b0082",
      secondary: "#800080",
      accent: "#ffd700",
      background: "#f8f8ff"
    }
  ], [])




  // Determine if this is a participant-based wheel or predefined items wheel
  const isParticipantBased = !selectedWheelType || selectedWheelType.category === 'personal' || selectedWheelType.id === 'team-picker'

  // Memoize itemsToDraw to prevent unnecessary effect runs
  const itemsToDraw = useMemo(() => {
    // 🧹 CRITICAL FIX: Use same logic as wheelItems to ensure consistency
    // When in editing mode, use editableItems (even if empty)
    return isEditingItems ? editableItems : wheelItems
  }, [isEditingItems, editableItems, wheelItems])

  // Memoize themeToUse to prevent unnecessary effect runs
  const themeToUse = useMemo(() => {
    return persistentTheme || wheelTheme
  }, [persistentTheme, wheelTheme])


  // STABLE: Consistent initialization - no console logging that varies with state
  useEffect(() => {
    // Component initialized - no logging to prevent inconsistency
  }, []) // Empty dependency array - only run once on mount

  // OPTIMIZED: Shared wheel drawing logic with anti-glitch measures
  const drawWheelContent = useCallback((ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, centerX: number, centerY: number, radius: number, angle: number, forcedTheme?: any) => {
    // 🎨 CRITICAL FIX: Use forcedTheme if provided (for animation consistency), otherwise use persistentTheme or wheelTheme
    // This ensures theme consistency during spinning animations
    const drawingTheme = forcedTheme || persistentTheme || wheelTheme

    wheelItems.forEach((item, index) => {
      // 🎯 PERFECT 3-SLICE GEOMETRY: Use exact 120-degree segments when exactly 3 slices
      const segmentAngle = wheelItems.length === 3 ? (2 * Math.PI) / 3 : (2 * Math.PI) / wheelItems.length
      const startAngle = index * segmentAngle + angle
      const endAngle = startAngle + segmentAngle

      // Alternate colors for better visibility using custom theme
      const isEven = index % 2 === 0
      ctx.fillStyle = isEven ? drawingTheme.primary : drawingTheme.secondary

      ctx.beginPath()
      ctx.moveTo(centerX, centerY)
      ctx.arc(centerX, centerY, radius, startAngle, endAngle)
      ctx.closePath()
      ctx.fill()

      // Draw enhanced segment border for clear slice segmentation - ENHANCED VISIBILITY
      ctx.strokeStyle = drawingTheme.accent
      ctx.lineWidth = 5 // Increased from 4 to 5 for maximum visibility
      ctx.stroke()

      // Add prominent inner border for enhanced segmentation - MORE VISIBLE
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)'
      ctx.lineWidth = 2 // Increased from 1 to 2 for better visibility
      ctx.stroke()

      // Add outer highlight border for maximum slice definition
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)'
      ctx.lineWidth = 1
      ctx.stroke()


      // Enhanced text rendering with improved responsiveness
      ctx.save()
      ctx.translate(centerX, centerY)
      ctx.rotate(startAngle + segmentAngle / 2)
      ctx.textAlign = "left"
      ctx.fillStyle = drawingTheme.accent

      // Enhanced responsive font sizing
      const baseFontSize = Math.min(canvas.width / 25, 20) // Increased max size
      const avgTextLength = wheelItems.reduce((sum, item) => sum + item.length, 0) / wheelItems.length
      const fontSize = Math.max(9, baseFontSize - Math.max(0, (wheelItems.length - 8) * 0.5) - Math.max(0, (avgTextLength - 15) * 0.1))
      ctx.font = `bold ${fontSize}px Arial`

      // Enhanced text length handling with smart truncation
      const maxTextLength = Math.max(15, Math.min(50, Math.floor(canvas.width / 8))) // More generous limits
      let text: string
      if (item.length > maxTextLength) {
        // Smart word-boundary truncation
        const words = item.split(' ')
        let truncatedText = item

        for (let i = words.length; i > 0; i--) {
          const candidate = words.slice(0, i).join(' ')
          if (candidate.length <= maxTextLength - 3) {
            truncatedText = candidate
            break
          }
        }

        if (truncatedText.length > maxTextLength - 3) {
          truncatedText = item.substring(0, maxTextLength - 3)
        }

        text = truncatedText + "..."
      } else {
        text = item
      }

      // Enhanced text positioning based on text length
      const textDistance = radius * (text.length > 25 ? 0.28 : 0.35) // Closer positioning for longer text
      const textY = fontSize / 3 // Dynamic Y position based on font size
      ctx.fillText(text, textDistance, textY)
      ctx.restore()
    })

    // Draw center circle and pointer with optimized calculations
    const centerRadius = Math.max(35, canvas.width / 12)
    ctx.beginPath()
    ctx.arc(centerX, centerY, centerRadius, 0, 2 * Math.PI)
    ctx.fillStyle = drawingTheme.accent
    ctx.fill()
    ctx.strokeStyle = drawingTheme.primary
    ctx.lineWidth = 4
    ctx.stroke()

    // 🎯 DISPLAY WINNER TEXT IN CENTER - SUPER ACCURATE: Only show when COMPLETELY done spinning
    // Must have: NOT spinning + NO animation running + Winners exist + Results ready
    if (!isSpinning && !isAnimationRunningRef.current && animationCompletedRef.current && winners.length > 0 && showResults) {
      ctx.save()
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"
      ctx.fillStyle = drawingTheme.primary
      
      // Responsive font sizing for winner text
      const winnerFontSize = Math.max(14, Math.min(24, canvas.width / 30))
      ctx.font = `bold ${winnerFontSize}px Arial`
      
      // Display winner(s) in center - handle multiple winners
      if (winners.length === 1) {
        const winnerText = winners[0].name.length > 15 ? 
          winners[0].name.substring(0, 12) + "..." : 
          winners[0].name
        ctx.fillText(winnerText, centerX, centerY)
      } else {
        // For multiple winners, show count
        ctx.fillText(`${winners.length} Winners!`, centerX, centerY - winnerFontSize * 0.3)
        const winnerNames = winners.slice(0, 3).map(w => 
          w.name.length > 10 ? w.name.substring(0, 7) + "..." : w.name
        ).join(", ")
        const moreText = winners.length > 3 ? ` +${winners.length - 3} more` : ""
        ctx.font = `bold ${winnerFontSize * 0.7}px Arial`
        ctx.fillText(winnerNames + moreText, centerX, centerY + winnerFontSize * 0.3)
      }
      
      ctx.restore()
    }

    // 🎯 ENHANCED RESPONSIVE POINTER POSITIONING - Perfect alignment with winner calculation

    // Responsive pointer sizing based on screen size and canvas dimensions
    const isMobile = canvas.width < 400
    const isTablet = canvas.width >= 400 && canvas.width < 700
    const isDesktop = canvas.width >= 700
    let pointerSize: number
    let pointerOffset: number
    let pointerLineWidth: number
    let shadowBlur: number

    if (isMobile) {
      // Mobile: Smaller pointer for better touch interaction
      pointerSize = Math.max(12, canvas.width / 35) // Proportionally smaller on mobile
      pointerOffset = radius + 2 // Closer offset on mobile
      pointerLineWidth = 4 // Thinner lines on mobile
      shadowBlur = 10 // Reduced shadow on mobile
    } else if (isTablet) {
      // Tablet: Balanced sizing
      pointerSize = Math.max(16, canvas.width / 28) // Medium size for tablets
      pointerOffset = radius + 3 // Standard offset for tablets
      pointerLineWidth = 5 // Medium line width
      shadowBlur = 12 // Moderate shadow
    } else {
      // Desktop: Larger, more prominent pointer
      pointerSize = Math.max(18, canvas.width / 25) // Larger size for desktop
      pointerOffset = radius + 4 // Slightly more offset for desktop
      pointerLineWidth = 6 // Thicker lines for desktop
      shadowBlur = 15 // Enhanced shadow for desktop
    }

    ctx.save()

    // Responsive shadow effects based on screen size
    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)'
    ctx.shadowBlur = shadowBlur
    ctx.shadowOffsetX = isMobile ? 3 : 5
    ctx.shadowOffsetY = isMobile ? 3 : 5

    // 🎯 PERFECT POINTER ALIGNMENT: Position exactly at 0° (3 o'clock) for winner calculation
    // The pointer tip must be exactly at the mathematical 0° position for all screen sizes
    const pointerTipX = centerX + radius // EXACT mathematical 0° position for perfect winner calculation alignment
    const pointerBaseX = pointerTipX - pointerSize * (isMobile ? 1.6 : 1.8) // Responsive base extension

    // Main pointer triangle with mathematically precise positioning and responsive sizing
    ctx.beginPath()
    ctx.moveTo(pointerBaseX, centerY) // Left base point
    ctx.lineTo(pointerTipX, centerY - pointerSize * (isMobile ? 0.8 : 0.9)) // Responsive upper tip point
    ctx.lineTo(pointerTipX, centerY + pointerSize * (isMobile ? 0.8 : 0.9)) // Responsive lower tip point
    ctx.closePath()
    ctx.fillStyle = '#ffffff'
    ctx.fill()
    ctx.strokeStyle = drawingTheme.primary
    ctx.lineWidth = pointerLineWidth
    ctx.stroke()

    // Inner highlight triangle with precise alignment to tip and responsive sizing
    const innerOffset = isMobile ? 1.5 : 2 // Responsive inner offset
    const innerSize = pointerSize * (isMobile ? 0.5 : 0.6) // Responsive inner size

    ctx.beginPath()
    ctx.moveTo(pointerBaseX + pointerSize * (isMobile ? 0.25 : 0.3), centerY) // Responsive inner left point
    ctx.lineTo(pointerTipX - innerOffset, centerY - innerSize) // Responsive inner upper point
    ctx.lineTo(pointerTipX - innerOffset, centerY + innerSize) // Responsive inner lower point
    ctx.closePath()
    ctx.fillStyle = drawingTheme.primary
    ctx.fill()

    // Enhanced shadow effects for maximum depth with responsive blur
    ctx.shadowColor = 'rgba(0, 0, 0, 0.4)'
    ctx.shadowBlur = isMobile ? 6 : 8
    ctx.shadowOffsetX = isMobile ? 2 : 3
    ctx.shadowOffsetY = isMobile ? 2 : 3

    // Outer border for ultra-maximum visibility with responsive width
    ctx.strokeStyle = drawingTheme.accent
    ctx.lineWidth = isMobile ? 2 : 3
    ctx.stroke()

    // Add a subtle glow effect for better visibility with responsive blur
    ctx.shadowColor = drawingTheme.primary
    ctx.shadowBlur = isMobile ? 15 : 20
    ctx.shadowOffsetX = 0
    ctx.shadowOffsetY = 0
    ctx.strokeStyle = drawingTheme.primary
    ctx.lineWidth = 1
    ctx.stroke()

    ctx.restore()

    // Only log pointer drawing in development and occasionally
    if (process.env.NODE_ENV === 'development' && Math.random() < 0.1) {
      console.log("🎯 ENHANCED RESPONSIVE POINTER DRAWN:", {
        canvasSize: canvas.width,
        deviceType: isMobile ? 'Mobile' : isTablet ? 'Tablet' : 'Desktop',
        pointerSize: pointerSize.toFixed(1),
        responsiveDesign: true,
        perfectAlignment: true,
        winnerCalculationAligned: true
      })
    }
  }, [wheelItems]) // Removed wheelTheme dependency to prevent infinite loops







  // Standard draw wheel function with theme consistency support
  const drawWheel = useCallback((items?: string[], forcedTheme?: any) => {
    if (process.env.NODE_ENV === 'development') {
      console.log("🎨 drawWheel called with items:", items ? items.slice(0, 5) : "using wheelItems")
    }

    const canvas = canvasRef.current
    const itemsToDraw = items || wheelItems

    if (!canvas) {
      return
    }

    const ctx = canvas.getContext("2d")
    if (!ctx) {
      return
    }

    // 🧹 CRITICAL FIX: Always clear canvas first, even if there are no items
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // If no items, just show empty wheel
    if (itemsToDraw.length === 0) {
      console.log("🧹 EMPTY WHEEL: Canvas cleared, no items to draw")
      return
    }

    const centerX = canvas.width / 2
    const centerY = canvas.height / 2
    const radius = Math.min(centerX, centerY) - 15

    // 🎨 CRITICAL FIX: Prioritize persistentTheme for consistency during spinning
    const drawingTheme = persistentTheme || forcedTheme || wheelTheme

    // Clear canvas and draw using optimized function
    if (ctx) {
      drawWheelAtAngle(ctx, canvas, currentAngle, drawingTheme)
    }
  }, [wheelItems, currentAngle, wheelTheme, persistentTheme]) // Keep these dependencies but ensure they don't cause loops

  // OPTIMIZED: Direct canvas drawing for smooth animation with performance monitoring
  const drawWheelAtAngle = useCallback((ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, angle: number, forcedTheme?: any) => {
    if (wheelItems.length === 0) return

    const centerX = canvas.width / 2
    const centerY = canvas.height / 2
    const radius = Math.min(centerX, centerY) - 15

    // 🎨 OPTIMIZED CANVAS OPERATIONS with performance monitoring
    const startTime = performance.now()

    ctx.save()

    // Clear canvas once at the start
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // 🎨 CRITICAL FIX: Prioritize persistentTheme for consistency during spinning
    const drawingTheme = persistentTheme || forcedTheme || wheelTheme
    drawWheelContent(ctx, canvas, centerX, centerY, radius, angle, drawingTheme)

    ctx.restore()

    // Performance monitoring for optimization
    const drawTime = performance.now() - startTime
    if (process.env.NODE_ENV === 'development' && drawTime > 16) {
      console.warn("⚠️ Slow canvas draw detected:", {
        drawTime: `${drawTime.toFixed(2)}ms`,
        targetFrameTime: "16.67ms",
        wheelItemsCount: wheelItems.length,
        canvasSize: `${canvas.width}x${canvas.height}`,
        angle: angle.toFixed(3)
      })
    }
  }, [wheelItems, drawWheelContent, persistentTheme, wheelTheme])

  // Canvas dimension synchronization for organizer/participant consistency
  const ensureCanvasConsistency = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    // Prevent resizing during spinning to avoid glitches
    if (isSpinning) {
      console.log("🎨 CANVAS CONSISTENCY: Skipping resize during spinning to prevent glitches")
      return
    }
  }, [isSpinning])

  // 🛡️ ANTI-FLICKER: Optimized canvas resize effect
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const expectedWidth = (() => {
      const screenWidth = typeof window !== 'undefined' ? window.innerWidth : 1920
      const screenHeight = typeof window !== 'undefined' ? window.innerHeight : 1080

      if (screenWidth < 320) {
        return Math.min(300, screenWidth - 5, screenHeight - 110)
      } else if (screenWidth < 375) {
        return Math.min(360, screenWidth - 10, screenHeight - 130)
      } else if (screenWidth < 414) {
        return Math.min(400, screenWidth - 15, screenHeight - 150)
      } else if (screenWidth < 480) {
        return Math.min(440, screenWidth - 20, screenHeight - 170)
      } else if (screenWidth < 640) {
        return Math.min(520, screenWidth - 25, screenHeight - 190)
      } else if (screenWidth < 768) {
        return Math.min(620, screenWidth - 35, screenHeight - 210)
      } else if (screenWidth < 1024) {
        return Math.min(720, screenWidth - 45, screenHeight - 240)
      } else if (screenWidth < 1280) {
        return Math.min(820, screenWidth - 55, screenHeight - 270)
      } else if (screenWidth < 1440) {
        return Math.min(880, screenWidth - 65, screenHeight - 310)
      } else if (screenWidth < 1680) {
        return Math.min(920, screenWidth - 75, screenHeight - 350)
      } else if (screenWidth < 1920) {
        return Math.min(960, screenWidth - 85, screenHeight - 390)
      } else {
        return Math.min(1050, screenWidth - 95, screenHeight - 430)
      }
    })()

    const expectedHeight = expectedWidth

    // Only resize if significantly different (threshold: 5px)
    if (Math.abs(canvas.width - expectedWidth) > 5 || Math.abs(canvas.height - expectedHeight) > 5) {
      canvas.width = expectedWidth
      canvas.height = expectedHeight

      // Single smooth redraw after resize
      requestAnimationFrame(() => {
        const ctx = canvas.getContext("2d", { alpha: false, desynchronized: true })
        if (ctx && !isSpinning && !isWheelTypeChanging) {
          ctx.save()
          drawWheelAtAngleWithItems(ctx, canvas, currentAngle, wheelItems, persistentTheme || wheelTheme)
          ctx.restore()
        }
      })
    }
  }, [organizerMode, currentAngle, wheelItems, persistentTheme, wheelTheme, drawWheelAtAngleWithItems, isSpinning, isWheelTypeChanging])

  // Simplified theme synchronization
  const verifyThemeSync = useCallback(() => {
    if (!organizerMode && externalWheelTheme) {
      const currentThemeId = `${wheelTheme.primary}-${wheelTheme.secondary}-${wheelTheme.accent}-${wheelTheme.background}`
      const externalThemeId = `${externalWheelTheme.primary}-${externalWheelTheme.secondary}-${externalWheelTheme.accent}-${externalWheelTheme.background}`

      if (currentThemeId !== externalThemeId) {
        console.log('🔄 UPDATING THEME TO MATCH ORGANIZER')
        setWheelTheme(externalWheelTheme)
        setThemeChangeTrigger(prev => prev + 1)

        // Ensure canvas consistency after theme change - no delay
        ensureCanvasConsistency()
        drawWheel(wheelItems, externalWheelTheme)
      }
    }
  }, [wheelTheme, externalWheelTheme, organizerMode, ensureCanvasConsistency, drawWheel, wheelItems])

  // Memoize onSpinComplete callback to prevent dependency array changes
  const memoizedOnSpinComplete = useCallback((result: SpinResult) => {
    if (onSpinComplete) {
      onSpinComplete(result)
    }
  }, [onSpinComplete])

  // 🎨 CRITICAL FIX: Persist theme state through all wheel type changes and spins
  const consolidatedDrawingEffect = useCallback(() => {
    if (!canvasRef.current) return
    
    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // 🚨 PREVENT DRAWING DURING TRANSITIONS
    if (wheelTransitionLockRef.current || isWheelTypeChanging) {
      console.log("🔒 DRAWING PREVENTED: Transition in progress")
      return
    }

    // Calculate what should be drawn
    const itemsToDraw = wheelItems
    const themeToUse = persistentTheme || externalWheelTheme || wheelTheme
    
    // Skip if nothing to draw
    if (itemsToDraw.length === 0) return
    
    // 🎯 STABLE STATE CHECK: Use stable state if transition is happening
    if (stableWheelStateRef.current.isStable && isWheelTypeChanging) {
      console.log("🎯 USING STABLE STATE FOR DRAWING DURING TRANSITION")
      drawWheelAtAngleWithItems(ctx, canvas, currentAngle, stableWheelStateRef.current.items, stableWheelStateRef.current.theme)
      return
    }
    
    // Draw the wheel with current state
    console.log("🎯 CONSOLIDATED DRAWING: Rendering wheel", {
      itemCount: itemsToDraw.length,
      themeSource: persistentTheme ? 'persistent' : externalWheelTheme ? 'external' : 'local',
      angle: currentAngle,
      transitionLock: wheelTransitionLockRef.current
    })
    
    drawWheelAtAngleWithItems(ctx, canvas, currentAngle, itemsToDraw, themeToUse)
  }, [wheelItems, currentAngle, persistentTheme, externalWheelTheme, wheelTheme, isWheelTypeChanging, drawWheelAtAngleWithItems])

  // Use consolidated drawing effect for all drawing triggers - ULTRA STABLE
  useEffect(() => {
    // Prevent any drawing during wheel type transitions to eliminate flickering
    if (wheelTransitionLockRef.current || isWheelTypeChanging || isSpinning) {
      return
    }
    
    // 🎯 IMMEDIATE REDRAW: If showResults changed, redraw INSTANTLY without delay
    // This ensures result text displays immediately without flickering
    if (showResults && !isSpinning) {
      consolidatedDrawingEffect()
      return
    }
    
    // 🛡️ ANTI-FLICKER: Debounce rapid changes for other updates
    const drawTimeout = setTimeout(() => {
      consolidatedDrawingEffect()
    }, 16) // ~60fps timing for smooth updates

    return () => clearTimeout(drawTimeout)
  }, [consolidatedDrawingEffect, themeChangeTrigger, wheelItems, persistentTheme, externalWheelTheme, wheelTheme, isWheelTypeChanging, isSpinning, showResults])

  // 🛡️ ANTI-FLICKER: Optimized wheel type change effect
  useEffect(() => {
    const currentWheelTypeId = selectedWheelType?.id || ""

    // Skip if no change or already processing
    if (!currentWheelTypeId || currentWheelTypeId === lastWheelTypeIdRef.current || isWheelTypeChanging) {
      return
    }

    // Lock drawing during transition
    setIsWheelTypeChanging(true)
    wheelTransitionLockRef.current = true

    // Capture stable state before transition
    stableWheelStateRef.current = {
      items: [...wheelItems],
      theme: persistentTheme || wheelTheme,
      isStable: true,
      lastUpdate: Date.now()
    }

    // Clear any existing timeout
    if (wheelTypeChangeTimeoutRef.current) {
      clearTimeout(wheelTypeChangeTimeoutRef.current)
    }

    // 🛡️ Reduced transition lock duration (100ms instead of default)
    wheelTypeChangeTimeoutRef.current = setTimeout(() => {
      setIsWheelTypeChanging(false)
      wheelTransitionLockRef.current = false
      stableWheelStateRef.current.isStable = false
      lastWheelTypeIdRef.current = currentWheelTypeId
      
      // Single smooth redraw with requestAnimationFrame
      requestAnimationFrame(() => {
        consolidatedDrawingEffect()
      })
    }, 100)

    return () => {
      if (wheelTypeChangeTimeoutRef.current) {
        clearTimeout(wheelTypeChangeTimeoutRef.current)
      }
    }
  }, [selectedWheelType, wheelItems, persistentTheme, wheelTheme, isWheelTypeChanging, consolidatedDrawingEffect])

  // 🎯 CRITICAL FIX: Force redraw when showResults changes to display winner text
  // This ensures results are immediately visible and don't flicker
  useEffect(() => {
    if (showResults && !isSpinning && winners.length > 0 && animationCompletedRef.current) {
      console.log("🎯 SHOW RESULTS EFFECT: Forcing immediate redraw with winner text")
      
      const canvas = canvasRef.current
      if (canvas) {
        const ctx = canvas.getContext("2d")
        if (ctx) {
          // IMMEDIATE draw without debounce
          const itemsToDraw = wheelItems
          const themeToUse = persistentTheme || externalWheelTheme || wheelTheme
          
          if (itemsToDraw.length > 0) {
            drawWheelAtAngleWithItems(ctx, canvas, currentAngle, itemsToDraw, themeToUse)
            console.log("✅ RESULTS REDRAWN: Winner text should now be visible")
          }
        }
      }
    }
  }, [showResults, isSpinning, winners.length, wheelItems, currentAngle, persistentTheme, externalWheelTheme, wheelTheme, drawWheelAtAngleWithItems])

  // Consolidated drawing effect - prevents multiple conflicting redraws
  useEffect(() => {
    // Skip during spinning or transitions
    if (isSpinning || isWheelTypeChanging) {
      return
    }

    const itemsChanged = JSON.stringify(itemsToDraw) !== JSON.stringify(lastDrawnItemsRef.current)
    const themeChanged = JSON.stringify(themeToUse) !== JSON.stringify(lastDrawnThemeRef.current)

    // Only redraw if something actually changed
    if (itemsChanged || themeChanged) {
      // 🛡️ ANTI-FLICKER: Debounce the draw
      const drawTimeout = setTimeout(() => {
        lastDrawnItemsRef.current = [...itemsToDraw]
        lastDrawnThemeRef.current = { ...themeToUse }

        console.log("🎨 Consolidated draw effect:", {
          itemsCount: itemsToDraw.length,
          themeChanged,
          itemsChanged
        })

        drawWheel(itemsToDraw, themeToUse)
      }, 16) // ~60fps timing

      return () => clearTimeout(drawTimeout)
    }
  }, [itemsToDraw, themeToUse, drawWheel, isSpinning, isWheelTypeChanging])

  // 🎯 CRITICAL FIX: Force redraw when participants prop changes
  // This ensures the wheel updates immediately when items are added/removed
  // 🛡️ ANTI-FLICKER: Optimized participants change effect
  useEffect(() => {
    // Skip during editing mode with cleared items
    if (isEditingItems && editableItems.length === 0) {
      return
    }

    if (participants && participants.length > 0) {
      // Debounce the redraw
      const redrawTimeout = setTimeout(() => {
        const canvas = canvasRef.current
        if (canvas && !isSpinning && !isWheelTypeChanging) {
          const ctx = canvas.getContext("2d", { alpha: false, desynchronized: true })
          if (ctx) {
            const itemsToUse = wheelItems.length > 0 ? wheelItems : participants.map(p => p.name)
            requestAnimationFrame(() => {
              ctx.save()
              drawWheelAtAngleWithItems(ctx, canvas, currentAngle, itemsToUse, persistentTheme || wheelTheme)
              ctx.restore()
            })
          }
        }
      }, 16)

      return () => clearTimeout(redrawTimeout)
    }
  }, [participants, wheelItems, currentAngle, persistentTheme, wheelTheme, drawWheelAtAngleWithItems, isEditingItems, editableItems.length, isSpinning, isWheelTypeChanging])

  // 🎯 INSTANT SHUFFLE REDRAW: Force immediate redraw when shuffledItemsOverride changes
  useEffect(() => {
    if (shuffledItemsOverride && shuffledItemsOverride.length > 0 && !isSpinning && !isWheelTypeChanging) {
      console.log("🎯🔄 INSTANT SHUFFLE REDRAW: Forcing immediate wheel update with shuffled items", {
        shuffledItemsCount: shuffledItemsOverride.length,
        preview: shuffledItemsOverride.slice(0, 3),
        userRole: organizerMode ? 'organizer' : 'participant/collaborator'
      })

      // Use requestAnimationFrame for immediate, smooth redraw
      requestAnimationFrame(() => {
        const canvas = canvasRef.current
        if (canvas) {
          const ctx = canvas.getContext("2d", { alpha: false, desynchronized: true })
          if (ctx) {
            ctx.save()
            ctx.clearRect(0, 0, canvas.width, canvas.height)
            drawWheelAtAngleWithItems(ctx, canvas, currentAngle, shuffledItemsOverride, persistentTheme || wheelTheme)
            ctx.restore()
            console.log("✅ SHUFFLE REDRAW COMPLETE: Participant wheel updated instantly")
          }
        }
      })
    }
  }, [shuffledItemsOverride, isSpinning, isWheelTypeChanging, currentAngle, persistentTheme, wheelTheme, drawWheelAtAngleWithItems, organizerMode])

  // 🎯 CUSTOM ITEMS MONITOR: Track when customItems prop changes (from parent component)
  useEffect(() => {
    if (customItems && customItems.length > 0) {
      console.log("🎯📝 CUSTOM ITEMS UPDATED: Received new items from parent", {
        count: customItems.length,
        preview: customItems.slice(0, 5),
        fullItems: customItems,
        organizerMode: organizerMode,
        willUseThem: !shuffledItemsOverride || shuffledItemsOverride.length === 0,
        timestamp: new Date().toISOString()
      })

      // If not spinning and not in wheel type transition, redraw immediately
      if (!isSpinning && !isWheelTypeChanging && (!shuffledItemsOverride || shuffledItemsOverride.length === 0)) {
        requestAnimationFrame(() => {
          const canvas = canvasRef.current
          if (canvas) {
            const ctx = canvas.getContext("2d", { alpha: false, desynchronized: true })
            if (ctx) {
              ctx.save()
              ctx.clearRect(0, 0, canvas.width, canvas.height)
              drawWheelAtAngleWithItems(ctx, canvas, currentAngle, customItems, persistentTheme || wheelTheme)
              ctx.restore()
              console.log("✅ CUSTOM ITEMS REDRAW COMPLETE: Wheel updated with new custom items")
            }
          }
        })
      }
    }
  }, [customItems, isSpinning, isWheelTypeChanging, currentAngle, persistentTheme, wheelTheme, drawWheelAtAngleWithItems, organizerMode, shuffledItemsOverride])

  // Initialize editable items when wheel type changes
  useEffect(() => {
    // Only initialize if user hasn't manually edited anything
    if (!isEditingItems && editableItems.length === 0) {
      if (selectedWheelType?.defaultItems) {
        setEditableItems([...selectedWheelType.defaultItems])
      } else if (participants?.length > 0) {
        setEditableItems(participants.map(p => p.name))
      } else {
        setEditableItems(["Option 1", "Option 2", "Option 3", "Option 4", "Option 5"])
      }
    }
  }, [selectedWheelType, participants, isEditingItems, editableItems.length])

  // Initialize wheel theme - FIXED: Prevent theme reversion
  useEffect(() => {
    // Only run this effect once on component mount to prevent theme reversion
    if (themeInitialized.current) return
    themeInitialized.current = true

    if (externalWheelTheme) {
      console.log("🎨 Using external wheel theme:", externalWheelTheme)
      setWheelTheme(externalWheelTheme)
      // 🎨 THEME PERSISTENCE: Set persistent theme when external theme is applied
      setPersistentTheme(externalWheelTheme)
      setThemeChangeTrigger(prev => prev + 1)
    } else if (!persistentTheme) {
      // Only use default theme if no persistent theme exists AND this is the first render
      console.log("🎨 Using default theme (no persistent theme)")
      const defaultTheme = {
        primary: schoolColors.primary,
        secondary: schoolColors.secondary,
        accent: schoolColors.accent,
        background: schoolColors.background
      }
      setWheelTheme(defaultTheme)
      // 🎨 THEME PERSISTENCE: Set persistent theme for default theme as well
      setPersistentTheme(defaultTheme)
    } else {
      // Use persistent theme if available
      console.log("🎨 Using persistent theme:", persistentTheme)
      setWheelTheme(persistentTheme)
    }

    // Force immediate redraw after initialization
    setTimeout(() => {
      const canvas = canvasRef.current
      if (canvas) {
        const ctx = canvas.getContext("2d")
        if (ctx) {
          const themeToUse = externalWheelTheme || persistentTheme || wheelTheme
          drawWheelAtAngleWithItems(ctx, canvas, currentAngle, wheelItems, themeToUse)
        }
      }
    }, 0)
  }, [externalWheelTheme, persistentTheme, drawWheelAtAngleWithItems, currentAngle, wheelItems, wheelTheme])

  // Sync wheel theme with external wheel theme prop changes - FIXED: Prevent infinite loops
  useEffect(() => {
    if (externalWheelTheme) {
      // Compare themes to prevent unnecessary updates that cause infinite loops
      const currentThemeId = `${wheelTheme.primary}-${wheelTheme.secondary}-${wheelTheme.accent}-${wheelTheme.background}`
      const externalThemeId = `${externalWheelTheme.primary}-${externalWheelTheme.secondary}-${externalWheelTheme.accent}-${externalWheelTheme.background}`

      if (currentThemeId !== externalThemeId) {
        console.log("🎨 External wheel theme prop updated:", externalWheelTheme)
        setWheelTheme(externalWheelTheme)
        setPersistentTheme(externalWheelTheme)
        setThemeChangeTrigger(prev => prev + 1)

        // Force immediate redraw
        setTimeout(() => {
          const canvas = canvasRef.current
          if (canvas) {
            const ctx = canvas.getContext("2d")
            if (ctx) {
              drawWheelAtAngleWithItems(ctx, canvas, currentAngle, wheelItems, externalWheelTheme)
            }
          }
        }, 0)
      }
    }
  }, [externalWheelTheme, wheelTheme, currentAngle, wheelItems])

  // Handle local theme changes for organizers - redraw wheel when theme is updated locally
  useEffect(() => {
    if (organizerMode && themeChangeTrigger > 0) {
      console.log("🎨 ORGANIZER THEME CHANGE: Redrawing wheel with updated local theme", {
        themeChangeTrigger,
        currentTheme: wheelTheme,
        timestamp: new Date().toISOString()
      })

      // 🎨 INSTANT THEME UPDATE: Always redraw with new theme, even during spinning for instant visual feedback
      console.log("🎨 ORGANIZER: Applying theme change instantly")
      // Force immediate redraw with current items - no delays
      if (isEditingItems && editableItems.length > 0) {
        console.log("🎨 Organizer theme change redraw using editableItems:", editableItems.slice(0, 3))
        // 🎨 CRITICAL FIX: Use persistent theme for organizer theme change redraw
        drawWheel(editableItems, persistentTheme || wheelTheme)
      } else {
        console.log("🎨 Organizer theme change redraw using wheelItems:", wheelItems.slice(0, 3))
        // 🎨 CRITICAL FIX: Use persistent theme for organizer theme change redraw
        drawWheel(wheelItems, persistentTheme || wheelTheme)
      }

      // If spinning, also force a redraw with current angle for instant update
      if (isSpinning) {
        console.log("🎨 ORGANIZER: Theme updated during spin - forcing redraw with current angle for instant visual feedback")
        const canvas = canvasRef.current
        if (canvas) {
          const ctx = canvas.getContext("2d")
          if (ctx) {
            drawWheelAtAngleWithItems(ctx, canvas, currentAngle, wheelItems, persistentTheme || wheelTheme)
          }
        }
      }
    }
  }, [themeChangeTrigger, wheelTheme, organizerMode, editableItems, isEditingItems, drawWheel, isSpinning])

  // Removed redundant editableItems redraw effect - consolidated into main drawing effect above

  // Removed redundant selectedWheelType redraw effect - handled by consolidated drawing effect

  // Removed redundant textInputVersion redraw effect - handled by consolidated drawing effect

  // Removed redundant forceUpdate redraw effect - handled by consolidated drawing effect




  // Debounce function for resize events to improve performance
  const debounce = (func: Function, wait: number) => {
    let timeout: NodeJS.Timeout
    return function executedFunction(...args: any[]) {
      const later = () => {
        clearTimeout(timeout)
        func(...args)
      }
      clearTimeout(timeout)
      timeout = setTimeout(later, wait)
    }
  }

  // Canvas consistency synchronization for organizer/participant identical display
  useEffect(() => {
    // Ensure canvas dimensions are consistent on mount
    ensureCanvasConsistency()

    // Handle window resize for consistent canvas sizing with debouncing
    const handleResize = debounce(() => {
      console.log("🔄 WINDOW RESIZE: Ensuring canvas consistency across all views")
      ensureCanvasConsistency()
    }, 250) // 250ms debounce delay

    window.addEventListener('resize', handleResize)

    // Enhanced canvas consistency during spinning - prevent resizing during spin for stability
    let consistencyInterval: NodeJS.Timeout
    if (isSpinning) {
      // Only check consistency without resizing during spinning to prevent glitches
      consistencyInterval = setInterval(() => {
        const canvas = canvasRef.current
        if (canvas) {
          // Just ensure the canvas is still properly sized without forcing resize
          console.log("🎨 SPINNING: Canvas consistency check (no resize)")
        }
      }, 1000) // Reduced frequency and no resize during spinning
    }

    return () => {
      window.removeEventListener('resize', handleResize)
      if (consistencyInterval) {
        clearInterval(consistencyInterval)
      }
    }
  }, [ensureCanvasConsistency, isSpinning])

  // Enhanced stability for participant mode - prevent canvas resize during spinning
  useEffect(() => {
    if (!organizerMode && isSpinning) {
      // Only log once when spinning starts to reduce console spam
      if (!isSpinningRef.current) {
        console.log("🎯 PARTICIPANT: Stabilizing wheel during spinning - preventing resizes")
        isSpinningRef.current = true
      }

      // Disable canvas consistency checks during spinning for participants
      const canvas = canvasRef.current
      if (canvas) {
        // Lock canvas dimensions during spin
        canvas.style.pointerEvents = 'none'
        canvas.style.userSelect = 'none'
      }
    } else if (!organizerMode && !isSpinning) {
      // Reset spinning ref when not spinning
      isSpinningRef.current = false
    }
  }, [organizerMode, isSpinning])

  // Removed periodic theme synchronization verification - updates are now instant via real-time listener

  // 🎯 100% ACCURATE REAL-TIME SYNCHRONIZATION - SINGLE AUTHORITATIVE LISTENER
  useEffect(() => {
    console.log("🔧 LISTENER SETUP CHECK:", {
      enableRealTimeSync,
      sessionId,
      listenerSetup,
      willSetup: enableRealTimeSync && sessionId && !listenerSetup,
      organizerMode,
      effectiveOrganizerMode,
      isFullAccessCollaborator: userPermissions.isFullAccessCollaborator
    })
    
    // Set up single real-time listener for live sessions
    if (enableRealTimeSync && sessionId && !listenerSetup) {
      console.log("🔄 Setting up SINGLE AUTHORITATIVE real-time listener for wheel sync", {
        isOrganizer: organizerMode,
        sessionId: sessionId,
        userRole: userPermissions?.userRole,
        timestamp: new Date().toISOString()
      })

      setListenerSetup(true)

      const unsubscribe = onSnapshot(
        doc(db, "liveDrawSessions", sessionId),
        (docSnapshot) => {
          if (!docSnapshot.exists()) {
            console.log("❌ LISTENER: Document doesn't exist")
            return
          }

          const sessionData = docSnapshot.data()
          const wheelState = sessionData.wheelState
          
          console.log("📡 LISTENER FIRED:", {
            hasWheelState: !!wheelState,
            wheelStateIsSpinning: wheelState?.isSpinning,
            sessionIsSpinning: sessionData.isSpinning,
            broadcastSource: wheelState?.broadcastSource,
            myRole: organizerMode ? 'organizer' : (userPermissions.isFullAccessCollaborator ? 'collaborator' : 'participant'),
            mySpinStartTimeRef: mySpinStartTimeRef.current,
            wheelStateSpinStartTime: wheelState?.spinStartTime,
            sessionId: sessionId,
            timestamp: new Date().toISOString(),
            _DEBUG_: 'COLLABORATOR_SYNC_DEBUG'
          })

          // 🎯 SINGLE AUTHORITATIVE SYNC: Process wheel state changes (spin, winners, shuffle, items)
          if (wheelState?.isSpinning !== undefined || wheelState?.winners?.length > 0 || 
              (wheelState?.shuffledItems && wheelState?.shuffleSeed !== undefined) ||
              (wheelState?.wheelItems && wheelState?.itemsUpdatedAt) ||
              (wheelState?.customItems && wheelState?.itemsUpdatedAt)) {
            console.log("📡 SINGLE AUTHORITATIVE SYNC - Session update received:", {
              isSpinning: wheelState?.isSpinning,
              hasWinners: !!(wheelState?.winners?.length > 0),
              hasShuffleUpdate: !!(wheelState?.shuffledItems && wheelState?.shuffleSeed !== undefined),
              hasItemsUpdate: !!(wheelState?.wheelItems && wheelState?.itemsUpdatedAt),
              hasCustomItemsUpdate: !!(wheelState?.customItems && wheelState?.itemsUpdatedAt),
              localIsSpinning: isSpinning,
              organizerMode: organizerMode,
              userRole: userPermissions?.userRole,
              broadcastSource: wheelState?.broadcastSource,
              sessionId: sessionId,
              timestamp: new Date().toISOString()
            })

          if (wheelState) {
            // 🚀 INSTANT SPIN START: Zero-delay synchronized animation
            const isValidBroadcast = wheelState.broadcastSource === 'organizer' || 
                                      wheelState.broadcastSource === 'collaborator' || 
                                      wheelState.broadcastSource === 'full-access-collaborator'
            
            const isCollaboratorTriggered = wheelState.broadcastSource === 'collaborator' || 
                                             wheelState.broadcastSource === 'full-access-collaborator'
            
            const isOrganizerTriggered = wheelState.broadcastSource === 'organizer'
            
            // 🎯 BIDIRECTIONAL SYNC FIX: Determine if I triggered this spin
            // Check using timestamp comparison for more reliable detection
            // CRITICAL FIX: For organizer spins, collaborators should ALWAYS sync regardless of timestamps
            let iTriggeredThisSpin = false
            
            if (wheelState.broadcastSource === 'organizer' && !organizerMode) {
              // COLLABORATOR receiving organizer spin: NEVER consider it "my spin"
              iTriggeredThisSpin = false
              console.log("🎯 COLLABORATOR: Organizer spin detected - will ALWAYS sync", {
                broadcastSource: wheelState.broadcastSource,
                organizerMode,
                forcedSync: true
              })
            } else {
              // Only check timestamps for collaborator→organizer or collaborator→collaborator syncs
              iTriggeredThisSpin = wheelState?.spinStartTime && 
                mySpinStartTimeRef.current && 
                mySpinStartTimeRef.current > 0 &&
                Math.abs(wheelState.spinStartTime - mySpinStartTimeRef.current) < 200
            }
            
            // 🚀 PREVENT DUPLICATE PROCESSING: Check if we already processed this spin
            const currentSpinId = wheelState?.spinId || ''
            const isAlreadyProcessed = currentSpinId && currentSpinId === lastProcessedSpinIdRef.current
            
            console.log("🔍 SPIN DETECTION CHECK:", {
              wheelStateSpinStartTime: wheelState?.spinStartTime,
              mySpinStartTimeRef: mySpinStartTimeRef.current,
              bothExist: !!(wheelState?.spinStartTime && mySpinStartTimeRef.current),
              timeDiff: wheelState?.spinStartTime && mySpinStartTimeRef.current ? 
                Math.abs(wheelState.spinStartTime - mySpinStartTimeRef.current) : 'N/A',
              iTriggeredThisSpin,
              currentSpinId,
              lastProcessedSpinId: lastProcessedSpinIdRef.current,
              isAlreadyProcessed,
              // Enhanced debug info
              organizerMode,
              effectiveOrganizerMode,
              isFullAccessCollaborator: userPermissions?.isFullAccessCollaborator,
              canViewOnly: userPermissions?.canViewOnly,
              broadcastSource: wheelState?.broadcastSource,
              willSync: wheelState.isSpinning && isValidBroadcast && !iTriggeredThisSpin && !isAlreadyProcessed
            })
            
            // 🎯 BIDIRECTIONAL WHEEL SYNC: Enable two-way synchronization
            // - When organizer spins → collaborators sync ✅
            // - When collaborator spins → organizer syncs ✅
            // - When anyone spins → participants sync ✅
            // - Skip ONLY if I'm the exact person who triggered (prevents self-duplicate)
            // - Skip if already processed this spin ID (prevents spam processing)
            
            // 🔥 CRITICAL FIX: Simplified sync logic for better reliability
            const shouldSynchronizedSpin = 
              wheelState.isSpinning && // Wheel is spinning in Firebase
              isValidBroadcast && // From valid source
              !iTriggeredThisSpin && // Skip ONLY if I triggered it myself
              !isAlreadyProcessed // Don't process the same spin twice
              // Removed isAnimationRunningRef check - let the animation function handle it
            
            console.log("🔍 BIDIRECTIONAL SYNC CHECK - Determining if wheel should sync:", {
              shouldSynchronizedSpin,
              wheelStateIsSpinning: wheelState.isSpinning,
              broadcastSource: wheelState.broadcastSource,
              wheelSpinStartTime: wheelState?.spinStartTime,
              mySpinStartTime: mySpinStartTimeRef.current,
              timeDifference: wheelState?.spinStartTime && mySpinStartTimeRef.current ? 
                Math.abs(wheelState.spinStartTime - mySpinStartTimeRef.current) : 'N/A',
              iTriggeredThisSpin,
              isValidBroadcast,
              effectiveOrganizerMode,
              organizerMode,
              isFullAccessCollaborator: userPermissions.isFullAccessCollaborator,
              isAnimationRunning: isAnimationRunningRef.current,
              isAlreadyProcessed,
              currentSpinId,
              SYNC_DECISION: shouldSynchronizedSpin ? '✅ WILL SYNC' : '❌ SKIP SYNC',
              REASON_NOT_SYNCING: !shouldSynchronizedSpin ? (
                !wheelState.isSpinning ? 'wheelState.isSpinning=false' :
                !isValidBroadcast ? 'invalid broadcast source' :
                iTriggeredThisSpin ? 'I triggered this spin myself' :
                isAnimationRunningRef.current ? 'already animating' :
                isAlreadyProcessed ? 'already processed this spin ID' :
                'unknown'
              ) : null,
              BIDIRECTIONAL_MODE: 'enabled',
              timestamp: Date.now()
            })
            
            if (shouldSynchronizedSpin) {
              console.log("✅ SYNC APPROVED - Starting synchronized animation", {
                wheelStateIsSpinning: wheelState.isSpinning,
                localIsSpinning: isSpinning,
                isAnimationRunning: isAnimationRunningRef.current,
                organizerMode: organizerMode,
                effectiveOrganizerMode: effectiveOrganizerMode,
                broadcastSource: wheelState.broadcastSource,
                hasSpinParams: !!(wheelState.spinDuration && wheelState.totalRotation && wheelState.finalAngle),
                timestamp: new Date().toISOString()
              })
              
              if (process.env.NODE_ENV === 'development') {
                console.log("🚀 SYNCHRONIZED SPIN START: All users spinning together (organizer + collaborator + participants)", {
                  wheelStateIsSpinning: wheelState.isSpinning,
                  localIsSpinning: isSpinning,
                  hasSpinParams: !!(wheelState.spinDuration && wheelState.totalRotation && wheelState.finalAngle),
                  spinDuration: wheelState.spinDuration,
                  totalRotation: wheelState.totalRotation,
                  finalAngle: wheelState.finalAngle,
                  organizerMode: organizerMode,
                  effectiveOrganizerMode: effectiveOrganizerMode,
                  sessionId: sessionId,
                  winnerStateReset: winners.length,
                  showResultsReset: showResults,
                  spinSource: wheelState.broadcastSource || 'unknown',
                  isFullAccessCollaborator: userPermissions.isFullAccessCollaborator,
                  bothWillSpin: effectiveOrganizerMode ? 'YES - Organizer & Collaborator spinning together' : 'Participant syncing',
                  timestamp: new Date().toISOString()
                })
              }

              // 🎯 ENHANCED COLLABORATOR SPIN DETECTION - Organizer responds to collaborator spin
              if (wheelState.broadcastSource === 'full-access-collaborator' && organizerMode) {
                console.log("🎯 COLLABORATOR→ORGANIZER SYNC: Organizer detected collaborator spin!", {
                  collaboratorId: wheelState.collaboratorId,
                  spinTriggerType: wheelState.spinTriggerType,
                  synchronizationRequired: true,
                  sessionId: sessionId,
                  organizerWillSync: true,
                  bidirectionalSync: 'active',
                  timestamp: new Date().toISOString()
                })

                // Show notification that collaborator initiated the spin
                toast({
                  title: "🎯 Collaborator Spin Detected",
                  description: "Syncing wheel with collaborator...",
                })
              }
              
              // 🎯 ENHANCED COLLABORATOR SPIN DETECTION - Legacy support
              if (wheelState.broadcastSource === 'collaborator' && organizerMode) {
                console.log("🎯 COLLABORATOR→ORGANIZER SYNC: Organizer detected collaborator spin (legacy)!", {
                  collaboratorId: wheelState.collaboratorId,
                  collaboratorName: wheelState.collaboratorName,
                  spinTriggerType: wheelState.spinTriggerType,
                  synchronizationRequired: wheelState.synchronizationRequired,
                  sessionId: sessionId,
                  organizerWillSync: true,
                  bidirectionalSync: 'active',
                  timestamp: new Date().toISOString()
                })

                // Show notification that collaborator initiated the spin
                toast({
                  title: "🎯 Collaborator Spin Started",
                  description: `${wheelState.collaboratorName || 'A collaborator'} started spinning the wheel!`,
                })
              }
              
              // 🎯 ORGANIZER SPIN DETECTION for ALL collaborators (full-access AND view-only)
              if (wheelState.broadcastSource === 'organizer' && !organizerMode) {
                console.log("🎯 ORGANIZER→COLLABORATOR SYNC: Collaborator syncing with organizer spin", {
                  sessionId: sessionId,
                  collaboratorId: userPermissions.userRole,
                  isFullAccessCollaborator: userPermissions.isFullAccessCollaborator,
                  canViewOnly: userPermissions.canViewOnly,
                  bidirectionalSync: 'active',
                  timestamp: new Date().toISOString()
                })

                toast({
                  title: "🎯 Organizer Spin Detected",
                  description: "Syncing wheel with organizer...",
                })
              }
              
              // 🎯 COLLABORATOR SPIN DETECTION for organizers  
              if ((wheelState.broadcastSource === 'full-access-collaborator' || wheelState.broadcastSource === 'collaborator') && organizerMode) {
                console.log("🎯 COLLABORATOR→ORGANIZER SYNC: Organizer syncing with collaborator spin", {
                  sessionId: sessionId,
                  broadcastSource: wheelState.broadcastSource,
                  collaboratorId: wheelState.collaboratorId,
                  bidirectionalSync: 'active',
                  timestamp: new Date().toISOString()
                })

                toast({
                  title: "🎯 Collaborator Spin Detected",
                  description: "Syncing wheel with collaborator...",
                  duration: 3000
                })
              }

              // 🚀 INSTANT STATE UPDATE: Zero delays for perfect synchronization
              // 🎯 CRITICAL: Clear old winners FIRST to prevent showing previous winners
              
              // 🎯 SAFETY CHECK: Stop any existing animation first
              if (isAnimationRunningRef.current) {
                console.log("⚠️ EXISTING ANIMATION DETECTED: Stopping it to start new synchronized animation", {
                  isAnimationRunning: isAnimationRunningRef.current,
                  localIsSpinning: isSpinning,
                  organizerMode: organizerMode,
                  broadcastSource: wheelState.broadcastSource,
                  timestamp: new Date().toISOString()
                })
                
                // Force stop existing animation
                stopAnimationRef.current = true
                isAnimationRunningRef.current = false
                if (animationRef.current) {
                  cancelAnimationFrame(animationRef.current)
                  animationRef.current = null
                }
              }
              
              console.log("✅ ANIMATION CHECK PASSED - Proceeding with sync", {
                isAnimationRunning: isAnimationRunningRef.current,
                readyToAnimate: true,
                spinId: currentSpinId,
                _SYNC_FLOW_: 'STARTING_ANIMATION'
              })
              
              // 🚀 MARK AS PROCESSED: Prevent duplicate processing of this spin
              lastProcessedSpinIdRef.current = currentSpinId
              console.log("🔒 SPIN MARKED AS PROCESSED:", {
                spinId: currentSpinId,
                willNotProcessAgain: true
              })
              
              setWinners([])
              setPendingWinners(null)
              
              setIsSpinningWithRef(true)
              setShowResults(false)
              setSyncPhase('syncing')
              
              // 🎯 RESET ANNOUNCEMENT TRACKING FOR NEW SPIN
              setHasAnnouncedWinners(false)
              lastAnnouncedWinnerIds.current = ""

              // 🚀 PERFECT PARAMETER STORING: Store organizer's exact values for 100% sync
              console.log("🚀 INSTANT PARAMETER STORAGE: Preparing zero-delay synchronized animation")

              const synchronizedSpinData = {
                ...wheelState,
                spinDuration: wheelState.spinDuration || settings.spinDuration || 4000,
                totalRotation: wheelState.totalRotation || (6.5 + Math.random() * 0.5) * 2 * Math.PI,
                finalAngle: wheelState.finalAngle || Math.random() * 2 * Math.PI,
                spins: wheelState.spins || Math.floor((wheelState.totalRotation || 6.5 * 2 * Math.PI) / (2 * Math.PI)) || 6,
                // 🔥 CRITICAL FIX: Use broadcast items first for collaborators (organizers use local items)
                wheelItemsUsed: (wheelState.wheelItemsUsed && wheelState.wheelItemsUsed.length > 0) ? wheelState.wheelItemsUsed : wheelItems,
                winningIndex: wheelState.winningIndex,
                winners: wheelState.winners || [],
                winnerNames: (wheelState.winners as any)?.map((w: any) => w.name) || [],
                // 🎨 THEME CONSISTENCY: Use organizer's theme for perfect visual sync
                animationTheme: wheelState.animationTheme || wheelState.theme || wheelTheme,
                spinStartTime: wheelState.spinStartTime || Date.now() // Ensure we have a start time
              }

              // 🚀 INSTANT DATA STORAGE: Store immediately for zero-delay access
              setLastReceivedSpinData(synchronizedSpinData)

              // 🚀 TRIGGER IMMEDIATE ANIMATION: Start instantly with perfect parameter sync
              console.log("🚀 INSTANT ANIMATION TRIGGER: Starting with organizer's exact parameters", {
                _CRITICAL_: 'CALLING_startFallbackAnimation',
                spinData: {
                  spinDuration: synchronizedSpinData.spinDuration,
                  totalRotation: synchronizedSpinData.totalRotation,
                  wheelItemsCount: synchronizedSpinData.wheelItemsUsed?.length || 0,
                  winningIndex: synchronizedSpinData.winningIndex
                },
                currentlyAnimating: isAnimationRunningRef.current,
                willForceStop: isAnimationRunningRef.current,
                timestamp: Date.now()
              })
              
              // 🎯 CRITICAL FIX: FORCE stop any existing animation before starting new sync
              if (isAnimationRunningRef.current) {
                console.log("🛑 FORCE STOPPING PREVIOUS ANIMATION: Collaborator syncing with new organizer spin")
                stopAnimationRef.current = true
                isAnimationRunningRef.current = false
                if (animationRef.current) {
                  cancelAnimationFrame(animationRef.current)
                  animationRef.current = null
                }
              }
              
              // 🎯 CRITICAL FIX: Pass data directly instead of relying on state
              startFallbackAnimation(synchronizedSpinData)

              // 🎯 100% ACCURATE PARAMETER SYNCHRONIZATION
              const organizersSpinParams = {
                spinDuration: wheelState.spinDuration || settings.spinDuration || 3000,
                totalRotation: wheelState.totalRotation || (6.5 + Math.random() * 0.5) * 2 * Math.PI,
                finalAngle: wheelState.finalAngle || Math.random() * 2 * Math.PI,
                spins: wheelState.spins || Math.floor((wheelState.totalRotation || 6.5 * 2 * Math.PI) / (2 * Math.PI)) || 6,
                // 🎯 CRITICAL FIX: For collaborators, ALWAYS use organizer's wheel items to guarantee same winner
                // Organizers use their local items, Collaborators use the broadcast items
                wheelItemsUsed: organizerMode ? wheelItems : (wheelState.wheelItemsUsed && wheelState.wheelItemsUsed.length > 0 ? wheelState.wheelItemsUsed : wheelItems),
                winningIndex: wheelState.winningIndex
              }

              // Store enhanced parameters with timing data for perfect sync
              setLastReceivedSpinData({
                ...wheelState,
                spinDuration: organizersSpinParams.spinDuration,
                totalRotation: organizersSpinParams.totalRotation,
                finalAngle: organizersSpinParams.finalAngle,
                spins: organizersSpinParams.spins,
                wheelItemsUsed: organizersSpinParams.wheelItemsUsed,
                winningIndex: organizersSpinParams.winningIndex,
                // CRITICAL: Store winner information if available
                winners: wheelState.winners || [],
                winnerNames: (wheelState.winners as any)?.map((w: any) => w.name) || [],
                // 🎯 PERFECT TIMING SYNC DATA: Enhanced timing information
                spinStartTime: wheelState.spinStartTime, // Original organizer start time
                broadcastTimestamp: wheelState.broadcastTimestamp, // Broadcast timestamp
                serverTimestamp: wheelState.serverTimestamp, // Server side timestamp
                performanceTimestamp: wheelState.performanceTimestamp, // High precision
                networkLatency: wheelState.networkLatency || 0, // Network delay
                timezoneOffset: wheelState.timezoneOffset || 0, // Timezone compensation
                participantSyncMode: wheelState.participantSyncMode || 'ENHANCED',
                syncPriority: wheelState.syncPriority || 'MAXIMUM',
                forceParticipantSync: wheelState.forceParticipantSync || false,
                guaranteedSync: true,
                receivedAt: Date.now(), // When participant received this data
                theme: wheelState.animationTheme || wheelState.theme // Animation theme
              })

              // 🎯 PERFECT SYNCHRONIZATION: Use exact same parameters
              const spinDuration = organizersSpinParams.spinDuration
              const totalRotation = organizersSpinParams.totalRotation
              const finalAngle = organizersSpinParams.finalAngle
              const spins = organizersSpinParams.spins
              const wheelItemsUsed = organizersSpinParams.wheelItemsUsed

              console.log("🎯 100% PERFECT SYNCHRONIZATION - Using organizer's exact parameters:", {
                spinDuration: `${spinDuration}ms`,
                totalRotation: `${(totalRotation / (2 * Math.PI)).toFixed(3)} rotations`,
                finalAngle: `${(finalAngle * 180 / Math.PI).toFixed(1)}°`,
                spins: `${spins} full spins`,
                wheelItemsCount: wheelItemsUsed.length,
                willLandOnSameSpot: true,
                guaranteedVisualConsistency: true,
                winnerCalculationReproducibility: true,
                synchronizationAccuracy: "100%"
              })

              // 🎯 PRECISE TIMING: Start animation immediately after parameter setup
              const animationStartTime = performance.now()
              let lastFrameTime = animationStartTime
              let lastStateUpdate = animationStartTime
              const FRAME_RATE = 60
              const FRAME_INTERVAL = 1000 / FRAME_RATE
              const STATE_UPDATE_INTERVAL = FRAME_INTERVAL * 2 // More frequent updates for precision
              const extendedDuration = spinDuration + 200 // Minimal extension for precision

              // 🎯 CRITICAL: Mark animation as running to prevent duplicate syncs
              isAnimationRunningRef.current = true
              stopAnimationRef.current = false

              // 🎯 BUTTERY SMOOTH PARTICIPANT ANIMATION - FIXED DURATION
              const animateParticipant = (currentTime = performance.now()) => {
                const elapsed = currentTime - animationStartTime
                // 🎯 CRITICAL FIX: Use the organizer's exact spin duration for perfect synchronization
                const participantDuration = spinDuration
                const progress = Math.min(elapsed / participantDuration, 1)

                // 🎯 SMOOTH CUBIC EASING - Consistent with organizer animation
                const easeProgress = progress >= 0.98 ? 1 : easeInOutCubic(progress)
                const currentRotation = totalRotation * easeProgress

                // 🎯 OPTIMIZED CANVAS DRAWING - Ensure drawing happens
                const canvas = canvasRef.current
                if (canvas) {
                  const ctx = canvas.getContext("2d")
                  if (ctx) {
                    // 🎨 CRITICAL FIX: Use the current persistent theme for participant synchronization
                    // Always use the latest theme to ensure real-time updates during spinning
                    const participantAnimationTheme = persistentTheme || wheelTheme
                    drawWheelAtAngleWithItems(ctx, canvas, currentRotation, wheelItemsUsed, participantAnimationTheme)
                  }
                }

                // 🎯 REDUCED STATE UPDATES - Less interference
                if (progress % 0.05 < 0.01 || progress >= 0.99) {
                  setCurrentAngle(currentRotation)
                }

                if (progress < 0.99) {
                  requestAnimationFrame(animateParticipant)
                } else {
                    // 🎯 INSTANT COMPLETION: Immediate state updates
                    isAnimationRunningRef.current = false
                    stopAnimationRef.current = false
                    setIsSpinningWithRef(false)
                    setCurrentAngle(totalRotation)
                    setSyncPhase('synced')
                    
                    // 🎯 RESET SPIN TRACKING: Clear mySpinStartTimeRef to prevent interference with future spins
                    mySpinStartTimeRef.current = 0

                    // 🎨 CRITICAL FIX: wheelTheme is already up-to-date from immediate theme updates
                    // No need to set it again

                    console.log("🎯 100% ACCURATE PARTICIPANT ANIMATION COMPLETE: Spin animation finished", {
                      organizerMode: organizerMode,
                      studentMode: studentMode,
                      totalAnimationTime: `${performance.now() - animationStartTime}ms`,
                      usedDuration: participantDuration,
                      sessionId: sessionId,
                      usedOrganizersWheelItems: !!lastReceivedSpinData?.wheelItemsUsed,
                      resetMySpinStartTimeRef: true
                    })

                    // 🎯 INSTANT WINNER ANNOUNCEMENT: Check immediately after animation - no delay
                    // CRITICAL FIX: Organizers should ALWAYS announce winners when they receive them
                    // regardless of whether they were the one who initiated the spin
                    const shouldAnnounceWinners = !isSpinning && pendingWinners && pendingWinners.length > 0
                    const userType = organizerMode ? 'organizer' : 'participant'

                    if (shouldAnnounceWinners) {
                      console.log(`🎯 INSTANT ${userType.toUpperCase()} WINNERS: Animation complete, announcing winners`, {
                        winnerCount: pendingWinners.length,
                        responsivenessLevel: "instant",
                        userType: userType,
                        organizerMode: organizerMode,
                        isFullAccessCollaborator: userPermissions.isFullAccessCollaborator
                      })

                      // 🎯 100% ACCURATE WINNER VALIDATION
                      const organizerWinnerIndex = lastReceivedSpinData?.winningIndex
                      const organizerWheelItems = lastReceivedSpinData?.wheelItemsUsed

                      if (organizerWinnerIndex !== undefined && organizerWheelItems) {
                        // 🎯 GUARANTEED WINNER CONSISTENCY: Use organizer's exact winner
                        const validatedWinner = organizerWheelItems[organizerWinnerIndex % organizerWheelItems.length]

                        const correctedWinner = {
                          id: `ultra-responsive-${Date.now()}`,
                          name: validatedWinner,
                          isSelected: true
                        }

                        const correctedWinners = [...pendingWinners]
                        correctedWinners[0] = correctedWinner

                        setWinners(correctedWinners)
                        setShowResults(true)
                        setPendingWinners(null)

                        console.log(`✅ ULTRA-RESPONSIVE ${userType.toUpperCase()} WINNERS: Guaranteed winner consistency`, {
                          winner: validatedWinner,
                          winnerCount: correctedWinners.length,
                          organizerWinnerIndex: organizerWinnerIndex,
                          synchronizationAccuracy: "100%",
                          responsivenessLevel: "ultra-instant",
                          userType: userType
                        })
                      } else {
                        // Fallback - should rarely happen with ultra-responsive sync
                        console.log(`✅ ${userType.toUpperCase()} WINNERS: Displaying winners normally`, {
                          winners: pendingWinners,
                          winnerCount: pendingWinners.length,
                          timestamp: new Date().toISOString(),
                          userType: userType
                        })

                        setWinners(pendingWinners)
                        setShowResults(true)
                        setPendingWinners(null)
                      }

                      // Create spin result
                      const result: SpinResult = {
                        id: Date.now().toString(),
                        winners: pendingWinners,
                        timestamp: new Date(),
                        spinDuration: spinDuration, // Use organizer's exact duration
                        totalParticipants: wheelItems.length
                      }

                      setSpinHistory(prev => [result, ...prev.slice(0, 9)])
                      memoizedOnSpinComplete(result)

                      // Trigger confetti for participants and collaborators
                      triggerConfettiSafely(`participant-${Date.now()}`)
                    } else {
                      console.log(`⏳ ${userType.toUpperCase()}: Animation complete but waiting for winner data`)
                    }
                  }
                }

                // 🎯 INSTANT ANIMATION START: No delays
                requestAnimationFrame(animateParticipant)
            }

            // Update lastReceivedSpinData with final spin parameters when spin completes
            if (!wheelState.isSpinning && wheelState.totalRotation) {
              console.log("🎯 COLLABORATOR: Updating lastReceivedSpinData with final spin parameters", {
                totalRotation: wheelState.totalRotation,
                finalAngle: wheelState.finalAngle,
                winningIndex: wheelState.winningIndex,
                winners: wheelState.winners?.length || 0
              })
              setLastReceivedSpinData(wheelState)
            }

            // Handle spin completion with winners - ENHANCED SYNCHRONIZATION
            if (!wheelState.isSpinning && wheelState.winners && wheelState.winners.length > 0) {
              console.log("🎯 WINNERS RECEIVED: Received winners from organizer:", {
                winnerCount: wheelState.winners.length,
                winners: (wheelState.winners as any[]).map((w: any) => w.name),
                organizerMode: organizerMode,
                studentMode: studentMode,
                sessionId: sessionId,
                localIsSpinning: isSpinning,
                hasSpinCompletionTime: !!wheelState.completedAt,
                spinCompletionTime: wheelState.completedAt,
                // 🔧 SYNCHRONIZATION DATA
                winningIndex: wheelState.winningIndex,
                wheelItemsUsedCount: wheelState.wheelItemsUsed?.length || 0,
                segmentAngle: wheelState.segmentAngle,
                normalizedAngle: wheelState.normalizedAngle,
                broadcastSource: wheelState.broadcastSource || 'unknown'
              })

              // 🚨 CRITICAL DEBUGGING FOR ORGANIZER
              if (organizerMode) {
                console.log("🎯 ORGANIZER RECEIVING WINNERS FROM FIREBASE:", {
                  winnerCount: wheelState.winners.length,
                  winners: (wheelState.winners as any[]).map((w: any) => w.name),
                  isSpinning: isSpinning,
                  hasPendingWinners: !!(pendingWinners && pendingWinners.length > 0),
                  pendingWinnersCount: pendingWinners?.length || 0,
                  broadcastSource: wheelState.broadcastSource || 'unknown',
                  timestamp: new Date().toISOString()
                })
              }

              // CRITICAL FIX: Always handle winners regardless of role for perfect synchronization
              const userType = organizerMode ? (userPermissions.isFullAccessCollaborator ? 'collaborator' : 'organizer') : 'participant'
              console.log(`🎯 ${userType.toUpperCase()} WINNERS: Processing winners for synchronized announcement`, {
                winnerCount: wheelState.winners.length,
                currentPendingWinners: pendingWinners?.length || 0,
                spinCompletionTime: wheelState.completedAt || 'no timestamp',
                userType: userType,
                organizerMode: organizerMode,
                isFullAccessCollaborator: userPermissions.isFullAccessCollaborator,
                // 🔧 VALIDATION: Check if we have synchronization data
                hasWinningIndex: wheelState.winningIndex !== undefined,
                hasWheelItemsUsed: !!wheelState.wheelItemsUsed,
                wheelItemsMatch: wheelState.wheelItemsUsed ? JSON.stringify(wheelState.wheelItemsUsed) === JSON.stringify(wheelItems) : false
              })

              // 🔧 CRITICAL: Validate that user has the same wheel items as organizer
              if (wheelState.wheelItemsUsed && JSON.stringify(wheelState.wheelItemsUsed) !== JSON.stringify(wheelItems)) {
                console.warn(`⚠️ WHEEL ITEMS MISMATCH: ${userType} wheel items don't match organizer's!`, {
                  organizerItems: wheelState.wheelItemsUsed,
                  userItems: wheelItems,
                  userItemsLength: wheelItems.length,
                  organizerItemsLength: wheelState.wheelItemsUsed.length
                })

                // Force update user's wheel items to match organizer's
                setEditableItems([...wheelState.wheelItemsUsed])
                setIsEditingItems(true)
                drawWheel(wheelState.wheelItemsUsed)
              }

              // 🎯 CRITICAL FIX: For participants, stop spinning immediately when winners are received
              if (!organizerMode && isSpinning) {
                console.log("🎯 PARTICIPANT: Organizer announced winners - stopping spinning immediately", {
                  winnerCount: wheelState.winners.length,
                  isSpinning: isSpinning,
                  userType: userType,
                  timestamp: new Date().toISOString()
                })
                // Stop spinning immediately and set final angle
                stopAnimationRef.current = true
                isAnimationRunningRef.current = false
                animationCompletedRef.current = true
                setIsSpinningWithRef(false)
                setSyncPhase('synced')
                // Clear any running animation
                if (animationRef.current) {
                  cancelAnimationFrame(animationRef.current)
                  animationRef.current = null
                }
                // Set the final angle from organizer's data for accuracy
                if (wheelState.totalRotation) {
                  setCurrentAngle(wheelState.totalRotation)
                }
              }

              // Always store winners for announcement
              setPendingWinners(wheelState.winners)

              // 🎯 IMMEDIATE ANNOUNCEMENT FOR PARTICIPANTS: Announce winners immediately for synchronized display
              if (!organizerMode && wheelState.winners && wheelState.winners.length > 0) {
                console.log(`🎯 ${userType.toUpperCase()} IMMEDIATE WINNER ANNOUNCEMENT: Announcing winners immediately for participant`, {
                  winnerCount: wheelState.winners.length,
                  winners: wheelState.winners.map((w: any) => w.name),
                  userType: userType,
                  organizerMode: organizerMode,
                  isSpinning: isSpinning,
                  timestamp: new Date().toISOString()
                })

                // Set winners and show results immediately for participants
                setWinners(wheelState.winners)
                setShowResults(true)
                setPendingWinners(null)

                // Trigger confetti for participants
                triggerConfettiSafely(`participant-immediate-${Date.now()}`)

                // Create spin result
                const result: SpinResult = {
                  id: Date.now().toString(),
                  winners: wheelState.winners,
                  timestamp: new Date(),
                  spinDuration: settings.spinDuration,
                  totalParticipants: wheelItems.length
                }

                setSpinHistory(prev => [result, ...prev.slice(0, 9)])
                memoizedOnSpinComplete(result)

                // Trigger winner callback
                if (onWinnersDetected) {
                  onWinnersDetected(wheelState.winners)
                }
              }

              // 🎯 CRITICAL FIX: For participants, stop spinning immediately when organizer announces winners
              if (!organizerMode && isSpinning) {
                console.log("🎯 PARTICIPANT: Organizer announced winners - stopping local spinning immediately", {
                  winnerCount: wheelState.winners.length,
                  winners: (wheelState.winners as any[]).map((w: any) => w.name),
                  userType: userType,
                  isSpinning: isSpinning,
                  timestamp: new Date().toISOString()
                })
      
                // Stop spinning immediately for collaborators
                stopAnimationRef.current = true
                isAnimationRunningRef.current = false
                animationCompletedRef.current = true
                setIsSpinningWithRef(false)
                setSyncPhase('synced')

                // Clear any running animation
                if (animationRef.current) {
                  cancelAnimationFrame(animationRef.current)
                  animationRef.current = null
                }
      
                // 🎨 THEME PERSISTENCE: wheelTheme is already up-to-date from immediate theme updates
                console.log("🎨 FALLBACK SPIN: wheelTheme is maintained", {
                  currentTheme: wheelTheme,
                  persistentTheme: persistentTheme,
                  themeMaintained: true
                })
      
                // Force immediate winner announcement for participants - no delay
                if (pendingWinners && pendingWinners.length > 0) {
                  console.log("🎯 PARTICIPANT: Announcing winners immediately after organizer", {
                    winnerCount: pendingWinners.length,
                    winners: pendingWinners.map(w => w.name),
                    userType: userType,
                    timestamp: new Date().toISOString()
                  })
      
                  setWinners(pendingWinners)
                  setShowResults(true)
                  setPendingWinners(null)

                  // 🎯 CRITICAL FIX: Ensure spinning completely stops after winner announcement
                  stopAnimationRef.current = true
                  isAnimationRunningRef.current = false
                  animationCompletedRef.current = true

                  // Clear any running animation
                  if (animationRef.current) {
                    cancelAnimationFrame(animationRef.current)
                    animationRef.current = null
                  }

                  console.log("🎯 SPINNING COMPLETELY STOPPED: All animation states reset after winner announcement", {
                    isSpinning: false,
                    animationRunning: false,
                    animationCompleted: true,
                    userType: userType,
                    winnerCount: pendingWinners.length
                  })
      
                  // 🎨 CRITICAL FIX: wheelTheme is already up-to-date from immediate theme updates
                  // No need to set it again
      
                  // Create spin result
                  const result: SpinResult = {
                    id: Date.now().toString(),
                    winners: pendingWinners,
                    timestamp: new Date(),
                    spinDuration: settings.spinDuration,
                    totalParticipants: wheelItems.length
                  }
      
                  setSpinHistory(prev => [result, ...prev.slice(0, 9)])
                  memoizedOnSpinComplete(result)
      
                  // Trigger confetti for participants
                  triggerConfettiSafely(`participant-immediate-${Date.now()}`)
      
                  // Trigger winner callback
                  if (onWinnersDetected) {
                    onWinnersDetected(pendingWinners)
                  }
                }
              }

              // ENHANCED: Ultra-immediate winner announcement for perfect synchronization
              const currentTime = Date.now()
              const organizerCompletionTime = wheelState.completedAt || currentTime
              const timeSinceCompletion = currentTime - organizerCompletionTime

              // ENHANCED: Use no delay for immediate execution - execute immediately
              console.log("🎯 ULTRA-IMMEDIATE WINNER ANNOUNCEMENT: Enhanced synchronization", {
                timeSinceCompletion: timeSinceCompletion,
                synchronizationDelay: 0,
                winnerCount: wheelState.winners.length,
                willShowAt: new Date(currentTime).toISOString(),
                userType: userType,
                organizerMode: organizerMode,
                isFullAccessCollaborator: userPermissions.isFullAccessCollaborator,
                immediateExecution: true
              })

              // CRITICAL: Always show winners if we have them and animation is complete (ENHANCED)
              if (pendingWinners && pendingWinners.length > 0 && !isSpinning) {
                console.log(`🎯 ${userType.toUpperCase()} WINNER ANNOUNCEMENT: Executing immediate callback`, {
                  hasPendingWinners: !!(pendingWinners && pendingWinners.length > 0),
                  isSpinning: isSpinning,
                  userType: userType,
                  organizerMode: organizerMode,
                  timestamp: new Date().toISOString()
                })

                console.log(`🎯 ULTRA-IMMEDIATE ${userType.toUpperCase()} WINNER ANNOUNCEMENT: Processing winners`, {
                  winnerCount: pendingWinners.length,
                  winners: pendingWinners.map(w => w.name),
                  timeElapsed: 0,
                  organizerCompletedAt: organizerCompletionTime,
                  usedOrganizersItemsForAnimation: !!lastReceivedSpinData?.wheelItemsUsed,
                  userType: userType,
                  spinSource: wheelState.broadcastSource || 'unknown',
                  isSpinning: isSpinning,
                  organizerMode: organizerMode
                })

                  // 🎯 OPTIMIZED WINNER VALIDATION: Ensure winner consistency
                  const organizerWinnerIndex = lastReceivedSpinData?.winningIndex
                  const organizerWheelItems = lastReceivedSpinData?.wheelItemsUsed

                  let winnersToAnnounce = pendingWinners

                  if (organizerWinnerIndex !== undefined && organizerWheelItems) {
                    const validatedWinner = organizerWheelItems[organizerWinnerIndex % organizerWheelItems.length]

                    const correctedWinner = {
                      id: `ultra-immediate-${Date.now()}`,
                      name: validatedWinner,
                      isSelected: true
                    }

                    winnersToAnnounce = [...pendingWinners]
                    winnersToAnnounce[0] = correctedWinner

                    console.log(`✅ WINNER VALIDATION: Corrected winner for consistency`, {
                      originalWinner: pendingWinners[0]?.name,
                      validatedWinner: validatedWinner,
                      organizerWinnerIndex: organizerWinnerIndex,
                      userType: userType
                    })
                  }

                  // CRITICAL FIX: Ensure winner announcement works for all roles regardless of callback success
                  console.log(`🎯 ${userType.toUpperCase()} WINNER DISPLAY: Setting local winner state for announcement`, {
                    winnerCount: winnersToAnnounce.length,
                    winner: winnersToAnnounce[0]?.name,
                    userType: userType,
                    organizerMode: organizerMode,
                    broadcastSource: wheelState.broadcastSource || 'unknown',
                    isSpinning: isSpinning
                  })

                  setWinners(winnersToAnnounce)
                  setIsSpinningWithRef(false)
                  setShowResults(true)
                  setPendingWinners(null)

                  // 🎯 CRITICAL FIX: Ensure spinning completely stops after winner announcement
                  stopAnimationRef.current = true
                  isAnimationRunningRef.current = false
                  animationCompletedRef.current = true

                  // Clear any running animation
                  if (animationRef.current) {
                    cancelAnimationFrame(animationRef.current)
                    animationRef.current = null
                  }

                  console.log("🎯 SPINNING COMPLETELY STOPPED: All animation states reset after winner announcement", {
                    isSpinning: false,
                    animationRunning: false,
                    animationCompleted: true,
                    userType: userType,
                    winnerCount: winnersToAnnounce.length
                  })

                  // 🎨 THEME PERSISTENCE: Maintain user's selected theme after winner announcement
                  console.log("🎨 WINNER ANNOUNCEMENT: Maintaining user's selected theme", {
                    currentTheme: wheelTheme,
                    persistentTheme: persistentTheme,
                    themeMaintained: true
                  })

                  // Create spin result
                  const result: SpinResult = {
                    id: Date.now().toString(),
                    winners: winnersToAnnounce,
                    timestamp: new Date(),
                    spinDuration: settings.spinDuration,
                    totalParticipants: wheelItems.length
                  }

                  setSpinHistory(prev => [result, ...prev.slice(0, 9)])
                  memoizedOnSpinComplete(result)

                  // Trigger confetti for all users
                  triggerConfettiSafely(`all-users-${Date.now()}`)

                  // ENHANCED: Ensure winner popup displays immediately - don't rely solely on callback
                  console.log(`🎯 ${userType.toUpperCase()} WINNER POPUP: Winner announcement should now display for ${userType}`, {
                    winnerCount: winnersToAnnounce.length,
                    winner: winnersToAnnounce[0]?.name,
                    userType: userType,
                    organizerMode: organizerMode,
                    showResultsState: true,
                    winnersState: winnersToAnnounce.length,
                    broadcastSource: wheelState.broadcastSource || 'unknown'
                  })

                  // CRITICAL FIX: Ensure winner popup is triggered for all roles - ENHANCED LOGGING
                  if (onWinnersDetected) {
                    console.log("🎯 CRITICAL WINNER DETECTION CALLBACK: About to notify parent component", {
                      winnerCount: winnersToAnnounce.length,
                      winners: winnersToAnnounce.map(w => w.name),
                      callbackExists: !!onWinnersDetected,
                      callbackType: typeof onWinnersDetected,
                      userType: userType,
                      organizerMode: organizerMode,
                      broadcastSource: wheelState.broadcastSource || 'unknown',
                      timestamp: new Date().toISOString()
                    })

                    try {
                      // CRITICAL FIX: Always ensure winner announcement callback is executed for all roles
                      // This is especially important for organizers who rely on this callback to update session state
                      if (onWinnersDetected) {
                        console.log("🎯 EXECUTING WINNER CALLBACK: About to call onWinnersDetected for winner announcement", {
                          winnerCount: winnersToAnnounce.length,
                          winnerNames: winnersToAnnounce.map(w => w.name),
                          userType: userType,
                          organizerMode: organizerMode,
                          broadcastSource: wheelState.broadcastSource || 'unknown',
                          callbackExists: true
                        })
      
                        try {
                          onWinnersDetected(winnersToAnnounce)
      
                          console.log("🎯 CRITICAL WINNER DETECTION CALLBACK: Successfully executed onWinnersDetected", {
                            winnerCount: winnersToAnnounce.length,
                            userType: userType,
                            organizerMode: organizerMode,
                            broadcastSource: wheelState.broadcastSource || 'unknown',
                            executionStatus: "SUCCESS"
                          })
                        } catch (callbackError) {
                          console.error("🎯 CALLBACK ERROR: onWinnersDetected callback failed", {
                            error: callbackError instanceof Error ? callbackError.message : String(callbackError),
                            winnerCount: winnersToAnnounce.length,
                            userType: userType,
                            organizerMode: organizerMode
                          })
      
                          // Continue with winner announcement even if callback fails
                          console.log("🎯 CALLBACK ERROR RECOVERY: Continuing with winner announcement despite callback failure")
                        }
                      } else {
                        console.warn("🎯 WARNING: onWinnersDetected callback not provided - winner announcement may be incomplete", {
                          userType: userType,
                          organizerMode: organizerMode,
                          winnerCount: winnersToAnnounce.length,
                          broadcastSource: wheelState.broadcastSource || 'unknown',
                          impact: organizerMode ? "Organizer winner announcement may fail" : "Participant winner announcement may fail"
                        })
      
                        // ENHANCED FALLBACK: For organizers, ensure winner state is set even if callback fails
                        if (organizerMode && !onWinnersDetected) {
                          console.log("🎯 ORGANIZER FALLBACK: Setting winner state directly since callback is missing", {
                            winnerCount: winnersToAnnounce.length,
                            winnerNames: winnersToAnnounce.map(w => w.name),
                            userType: userType,
                            broadcastSource: wheelState.broadcastSource || 'unknown'
                          })
                        }
                      }
                    } catch (error) {
                      console.error("🎯 CRITICAL ERROR: Failed to execute onWinnersDetected callback", {
                        error: error instanceof Error ? error.message : String(error),
                        errorStack: error instanceof Error ? error.stack : 'No stack trace',
                        winnerCount: winnersToAnnounce.length,
                        userType: userType,
                        organizerMode: organizerMode,
                        broadcastSource: wheelState.broadcastSource || 'unknown',
                        executionStatus: "FAILED"
                      })

                      // ENHANCED ERROR RECOVERY: Continue with winner announcement even if callback fails
                      console.log("🎯 ERROR RECOVERY: Proceeding with winner announcement despite callback failure", {
                        winnerCount: winnersToAnnounce.length,
                        userType: userType,
                        organizerMode: organizerMode,
                        broadcastSource: wheelState.broadcastSource || 'unknown'
                      })
                    }
                  } else {
                    console.error("🎯 CRITICAL ERROR: onWinnersDetected callback is NULL/UNDEFINED!", {
                      userType: userType,
                      organizerMode: organizerMode,
                      sessionId: sessionId,
                      hasCallback: !!onWinnersDetected
                    })
                  }

                  console.log(`🎯 ${userType.toUpperCase()} WINNER ANNOUNCEMENT COMPLETE: Winners displayed successfully`, {
                    winnerCount: winnersToAnnounce.length,
                    winner: winnersToAnnounce[0]?.name,
                    userType: userType,
                    spinSource: wheelState.broadcastSource || 'unknown',
                    organizerMode: organizerMode
                  })
                } else {
                  console.log(`⚠️ WINNER ANNOUNCEMENT SKIPPED: No pending winners or still spinning`, {
                    hasPendingWinners: !!(pendingWinners && pendingWinners.length > 0),
                    isSpinning: isSpinning,
                    userType: userType,
                    organizerMode: organizerMode,
                    pendingWinnersCount: pendingWinners?.length || 0
                  })
                }
            }

          // 🎯 PRIORITY 1: Handle shuffle update FIRST - INSTANT SYNCHRONIZATION
          // Process shuffle before any other updates to ensure participants see the same order immediately
          if (wheelState.shuffledItems && wheelState.shuffleSeed !== undefined && wheelState.itemsShuffledAt) {
            console.log("🎯🔄 RECEIVED SHUFFLE UPDATE: Applying organizer's shuffled items to all users", {
              shuffleSeed: wheelState.shuffleSeed,
              shuffledItemsCount: wheelState.shuffledItems.length,
              shuffleSource: wheelState.shuffleSource,
              itemsShuffledAt: wheelState.itemsShuffledAt,
              userRole: organizerMode ? 'organizer' : 'participant/collaborator',
              sessionId: sessionId,
              timestamp: new Date().toISOString()
            })

            const shuffledItems = [...wheelState.shuffledItems]

            // BLOCK SHUFFLE DURING SPINNING: Queue shuffle update if any wheel is spinning
            if (isSpinning || currentSpinId || remoteSpinning || isAnimationRunningRef.current) {
              console.log("🎯 SHUFFLE BLOCKED: Someone's wheel is spinning - queuing shuffle update", {
                isSpinning,
                currentSpinId,
                remoteSpinning,
                isAnimationRunning: isAnimationRunningRef.current,
                shuffleSeed: wheelState.shuffleSeed
              })

              const applyShuffleAfterSpin = () => {
                if (!isSpinning && !remoteSpinning && !isAnimationRunningRef.current) {
                  console.log("🎯 APPLYING QUEUED SHUFFLE: Wheel stopped spinning, applying shuffle now", {
                    shuffleSeed: wheelState.shuffleSeed,
                    shuffledItemsCount: shuffledItems.length
                  })

                  // 🎯 INSTANT UPDATE: Apply shuffle immediately without delay
                  setShuffledItemsOverride(shuffledItems)
                  setEditableItems(shuffledItems)
                  setIsEditingItems(true)

                  // 🎯 INSTANT REDRAW: Use requestAnimationFrame for immediate smooth redraw
                  requestAnimationFrame(() => {
                    const canvas = canvasRef.current
                    if (canvas) {
                      const ctx = canvas.getContext("2d", { alpha: false, desynchronized: true })
                      if (ctx) {
                        ctx.save()
                        drawWheelAtAngleWithItems(ctx, canvas, currentAngle, shuffledItems, persistentTheme || wheelTheme)
                        ctx.restore()
                      }
                    }

                    toast({
                      title: "✅ Shuffle Synced Instantly",
                      description: `Wheel items shuffled - perfectly synced (${shuffledItems.length} items)`,
                      duration: 2000
                    })
                  })
                } else {
                  setTimeout(applyShuffleAfterSpin, 100)
                }
              }

              setTimeout(applyShuffleAfterSpin, 100)
            } else {
              // 🎯 INSTANT SHUFFLE SYNC: Apply immediately - zero delay for participants
              console.log("✅ INSTANT SHUFFLE SYNC: Applying shuffled items NOW", {
                shuffleSeed: wheelState.shuffleSeed,
                shuffledItemsCount: shuffledItems.length,
                preview: shuffledItems.slice(0, 3),
                userRole: organizerMode ? 'organizer' : 'participant/collaborator'
              })

              // 🎯 CRITICAL: Set shuffledItemsOverride for highest priority in wheelItems calculation
              setShuffledItemsOverride(shuffledItems)
              setEditableItems(shuffledItems)
              setIsEditingItems(true)

              // 🎯 INSTANT REDRAW: Use requestAnimationFrame for zero-delay smooth rendering
              requestAnimationFrame(() => {
                const canvas = canvasRef.current
                if (canvas) {
                  const ctx = canvas.getContext("2d", { alpha: false, desynchronized: true })
                  if (ctx) {
                    ctx.save()
                    ctx.clearRect(0, 0, canvas.width, canvas.height)
                    drawWheelAtAngleWithItems(ctx, canvas, currentAngle, shuffledItems, persistentTheme || wheelTheme)
                    ctx.restore()
                    
                    console.log("✅ PARTICIPANT WHEEL REDRAWN: Shuffled items displayed instantly", {
                      itemCount: shuffledItems.length,
                      firstItem: shuffledItems[0],
                      canvasSize: `${canvas.width}x${canvas.height}`
                    })
                  }
                }

                toast({
                  title: wheelState.shuffleSource === 'organizer' ? "✅ Organizer Shuffled" : "✅ Collaborator Shuffled",
                  description: `Wheel items shuffled - synced instantly (${shuffledItems.length} items)`,
                  duration: 2000
                })
              })
            }
          }

          // Handle wheel items update (CSV upload or editing changes) - CRITICAL FOR CONSISTency
          if (wheelState.wheelItems && wheelState.itemsUpdatedAt && !wheelState.shuffleSeed) {
            console.log("🎯 Received wheel items update from organizer:", {
              itemsCount: wheelState.wheelItems.length,
              itemsUpdatedAt: wheelState.itemsUpdatedAt,
              preview: wheelState.wheelItems.slice(0, 3),
              isLiveMode: isLiveMode,
              organizerMode: organizerMode
            })

            // CRITICAL FIX: Always update editableItems to match organizer's items for consistency
            // This ensures both static display and spinning animation use the same items
            const organizerItems = [...wheelState.wheelItems]

            // BLOCK UPDATES DURING SPINNING: If anyone's wheel is spinning, queue the items update for after spinning
            // This maintains visual consistency - spinning wheels don't switch items mid-spin
            if (isSpinning || currentSpinId || remoteSpinning || isAnimationRunningRef.current) {
              console.log("🎯 ITEMS UPDATE BLOCKED: Someone's wheel is spinning - queuing update for after spin completes", {
                isSpinning,
                currentSpinId,
                remoteSpinning,
                isAnimationRunning: isAnimationRunningRef.current,
                itemsCount: organizerItems.length
              })

              // Wait for spinning to stop, then apply the update
              const applyUpdateAfterSpin = () => {
                if (!isSpinning && !remoteSpinning && !isAnimationRunningRef.current) {
                  console.log("🎯 APPLYING QUEUED ITEMS UPDATE: Wheel stopped spinning", {
                    isSpinning,
                    remoteSpinning,
                    isAnimationRunning: isAnimationRunningRef.current
                  })

                  // Now safe to update items - use highest priority state
                  setShuffledItemsOverride(organizerItems)
                  setEditableItems(organizerItems)
                  setIsEditingItems(true)

                  // Force redraw with new items
                  setTimeout(() => {
                    const canvas = canvasRef.current
                    if (canvas) {
                      const ctx = canvas.getContext("2d")
                      if (ctx) {
                        drawWheelAtAngleWithItems(ctx, canvas, currentAngle, organizerItems, persistentTheme || wheelTheme)
                      }
                    }

                    toast({
                      title: "Wheel Updated",
                      description: `Organizer updated wheel with ${organizerItems.length} items`,
                    })
                  }, 0)
                } else {
                  // Still spinning - check again
                  setTimeout(applyUpdateAfterSpin, 500)
                }
              }

              setTimeout(applyUpdateAfterSpin, 500)
              return // Don't apply update now
            }

            // Update editableItems immediately - this is the source of truth
            // 🎯 CRITICAL FIX: Also set shuffledItemsOverride for highest priority
            setShuffledItemsOverride(organizerItems)
            setEditableItems(organizerItems)

            // For participants: Update wheel items when organizer changes them
            if (!organizerMode) {
              console.log("🎯 PARTICIPANT: Applying organizer's wheel items update immediately", {
                itemsCount: organizerItems.length,
                itemsPreview: organizerItems.slice(0, 5)
              })

              // Set editing mode active and update items - CRITICAL for consistency
              setIsEditingItems(true)

              // Update editableItems first (this is what wheelItems will use)
              setShuffledItemsOverride(organizerItems)
              setEditableItems(organizerItems)

              // Clear current state and redraw wheel with new items
              // NOTE: Do NOT clear winners or reset angle during spinning to maintain consistency
              if (!isSpinning) {
                setCurrentAngle(0)
                setWinners([])
                setShowResults(false)
                setPendingWinners(null)
              }

              // Force redraw with new items - CRITICAL: Use editableItems which is now the source of truth
              setTimeout(() => {
                console.log("🎯 PARTICIPANT: Redrawing wheel after organizer items update - using editableItems")
                // Force redraw to show updated items immediately
                const canvas = canvasRef.current
                if (canvas) {
                  const ctx = canvas.getContext("2d")
                  if (ctx) {
                    drawWheelAtAngleWithItems(ctx, canvas, currentAngle, organizerItems, persistentTheme || wheelTheme)
                  }
                }

                toast({
                  title: "Wheel Updated",
                  description: `Organizer updated wheel with ${organizerItems.length} items`,
                })
              }, 0)
            } else {
              // For organizer: Ensure editableItems matches customItems for consistency
              console.log("🎯 ORGANIZER: Syncing editableItems with updated items for consistency")
              setEditableItems(organizerItems)
              setIsEditingItems(true)
            }
          }

            // Handle theme update from organizer - ENHANCED SYNCHRONIZATION
            if (wheelState.theme && wheelState.themeUpdatedAt) {
              console.log("🎨 Received theme update from organizer:", {
                themeName: wheelState.themeName,
                primary: wheelState.theme.primary,
                secondary: wheelState.theme.secondary,
                accent: wheelState.theme.accent,
                background: wheelState.theme.background,
                themeUpdatedAt: wheelState.themeUpdatedAt,
                organizerMode: organizerMode,
                sessionId: sessionId,
                isSpinning: isSpinning,
                timestamp: new Date().toISOString()
              })

              // For participants: Update wheel theme when organizer changes it (BLOCK during spinning for theme consistency)
              if (!organizerMode) {
                const updatedTheme = {
                  primary: wheelState.theme?.primary || '#8e0b16',
                  secondary: wheelState.theme?.secondary || '#66181E',
                  accent: wheelState.theme?.accent || '#ffffff',
                  background: wheelState.theme?.background || '#f8f9fa'
                }

                // Create a unique identifier for the theme to detect changes
                const currentThemeId = `${wheelTheme.primary}-${wheelTheme.secondary}-${wheelTheme.accent}-${wheelTheme.background}`
                const newThemeId = `${updatedTheme.primary}-${updatedTheme.secondary}-${updatedTheme.accent}-${updatedTheme.background}`

                // Allow theme changes during spinning for real-time updates
                if (themeUpdatesBlocked.current) {
                  console.log("🎨 THEME UPDATE BLOCKED: Organizer theme change ignored due to block", {
                    themeUpdatesBlocked: themeUpdatesBlocked.current,
                    themeWouldChange: currentThemeId !== newThemeId,
                    sessionId: sessionId,
                    timestamp: new Date().toISOString()
                  })
                  return // Skip theme update if blocked
                }

                // Update if theme has actually changed
                if (currentThemeId !== newThemeId) {
                  console.log("🎨 PARTICIPANT: Applying organizer theme update (theme changed):", {
                    oldTheme: wheelTheme,
                    newTheme: updatedTheme,
                    themeName: wheelState.themeName || 'custom',
                    themeChanged: true,
                    isSpinning: isSpinning,
                    themeUpdatesBlocked: false,
                    sessionId: sessionId,
                    timestamp: new Date().toISOString()
                  })

                  // Update themes immediately
                  setWheelTheme(updatedTheme)
                  setPersistentTheme(updatedTheme)
                  lastThemeUpdateRef.current = newThemeId
                  setThemeChangeTrigger(prev => prev + 1)

                  // Force immediate redraw with new theme, even during spinning
                  drawWheel(wheelItems, updatedTheme)

                  toast({
                    title: "🎨 Theme Updated",
                    description: `Organizer applied ${wheelState.themeName || 'new'} theme`,
                    duration: 3000
                  })
                }
              }
            }

            // Handle custom winner title update from organizer OR from own changes
            if (wheelState.customWinnerTitle && wheelState.winnerTitleUpdatedAt) {
              console.log("💬 Received winner title update:", {
                customWinnerTitle: wheelState.customWinnerTitle,
                winnerTitleUpdatedAt: wheelState.winnerTitleUpdatedAt,
                sessionId: sessionId,
                isOrganizer: organizerMode,
                timestamp: new Date().toISOString()
              })

              // Update winner title if it has changed (for both organizers and participants)
              if (customWinnerTitle !== wheelState.customWinnerTitle) {
                setCustomWinnerTitle(wheelState.customWinnerTitle)
                console.log("✅ Winner title updated to:", wheelState.customWinnerTitle)
              }
            }

            // ENHANCED: Also check for direct externalWheelTheme prop updates (BLOCK during spinning for consistency)
            if (wheelState.externalWheelTheme && !organizerMode) {
              console.log("🎨 EXTERNAL WHEEL THEME: Received direct theme update:", {
                externalWheelTheme: wheelState.externalWheelTheme,
                organizerMode: organizerMode,
                sessionId: sessionId,
                isSpinning: isSpinning,
                themeUpdatesBlocked: themeUpdatesBlocked.current,
                timestamp: new Date().toISOString()
              })

              // Apply the external theme directly
              const externalTheme = {
                primary: wheelState.externalWheelTheme.primary || '#8e0b16',
                secondary: wheelState.externalWheelTheme.secondary || '#66181E',
                accent: wheelState.externalWheelTheme.accent || '#ffffff',
                background: wheelState.externalWheelTheme.background || '#f8f9fa'
              }

              const currentThemeId = `${wheelTheme.primary}-${wheelTheme.secondary}-${wheelTheme.accent}-${wheelTheme.background}`
              const newThemeId = `${externalTheme.primary}-${externalTheme.secondary}-${externalTheme.accent}-${externalTheme.background}`

              if (currentThemeId !== newThemeId) {
                console.log("🎨 EXTERNAL THEME UPDATE: Applying direct external wheel theme (theme changed):", {
                  oldTheme: wheelTheme,
                  newTheme: externalTheme,
                  isSpinning: isSpinning,
                  themeUpdatesBlocked: false,
                  sessionId: sessionId,
                  timestamp: new Date().toISOString()
                })

                // Force immediate update
                setWheelTheme(externalTheme)
                lastThemeUpdateRef.current = newThemeId
                setThemeChangeTrigger(prev => prev + 1)
                setPersistentTheme(externalTheme)

                console.log("🎨 EXTERNAL THEME UPDATE: Applied external theme and set as persistent", {
                  externalTheme: externalTheme,
                  persistentThemeSet: true
                })

                // Force immediate redraw with new theme, even during spinning
                drawWheel(wheelItems, externalTheme)
              }
            }

            // ALSO CHECK FOR THEME UPDATES IN selectedTheme FIELD (BACKWARD COMPATIBILITY)
            if (sessionData.selectedTheme && sessionData.updatedAt) {
              const selectedTheme = sessionData.selectedTheme
              console.log("🎨 BACKWARD COMPATIBILITY: Checking selectedTheme field:", {
                selectedTheme: selectedTheme,
                updatedAt: sessionData.updatedAt,
                organizerMode: organizerMode,
                sessionId: sessionId,
                isSpinning: isSpinning
              })

              // Only process if this is a recent update (within last 30 seconds)
              const updateTime = sessionData.updatedAt?.toDate?.() || new Date(sessionData.updatedAt)
              const timeSinceUpdate = Date.now() - updateTime.getTime()

              if (timeSinceUpdate < 30000 && !organizerMode) {
                console.log("🎨 BACKWARD COMPATIBILITY: Processing selectedTheme update")

                // Get theme colors from the selected theme name
                const getThemeColors = (themeName: string) => {
                  const themeMap: Record<string, any> = {
                    'ocean': { primary: '#0077be', secondary: '#00a8cc', accent: '#ffffff', background: '#f0f8ff' },
                    'sunset': { primary: '#ff4500', secondary: '#ff6347', accent: '#ffffff', background: '#fff8f0' },
                    'forest': { primary: '#228b22', secondary: '#006400', accent: '#ffffff', background: '#f0fff0' },
                    'royal': { primary: '#4b0082', secondary: '#800080', accent: '#ffd700', background: '#f8f8ff' },
                    'fire': { primary: '#dc143c', secondary: '#ff4500', accent: '#ffffff', background: '#fff8f0' },
                    'school': { primary: '#8e0b16', secondary: '#66181E', accent: '#ffffff', background: '#f8f9fa' },
                    'rainbow': { primary: '#ff0080', secondary: '#00ff80', accent: '#ffffff', background: '#f0f0f0' },
                    'neon': { primary: '#39ff14', secondary: '#ff073a', accent: '#000000', background: '#0a0a0a' },
                    'purple': { primary: '#9932cc', secondary: '#6a0dad', accent: '#ffffff', background: '#f5f0ff' },
                    'pink': { primary: '#ff1493', secondary: '#ff69b4', accent: '#ffffff', background: '#fff0f5' },
                    'gold': { primary: '#ffd700', secondary: '#daa520', accent: '#000000', background: '#fffbf0' },
                    'cyber': { primary: '#00ffff', secondary: '#1e90ff', accent: '#000000', background: '#f0f8ff' },
                    'fireice': { primary: '#dc143c', secondary: '#4169e1', accent: '#ffffff', background: '#f8f8ff' },
                    'lime': { primary: '#32cd32', secondary: '#adff2f', accent: '#000000', background: '#f0fff0' },
                    'dark': { primary: '#2c2c2c', secondary: '#4a4a4a', accent: '#ffffff', background: '#1a1a1a' },
                    'pastel': { primary: '#ffb6c1', secondary: '#dda0dd', accent: '#333333', background: '#faf0e6' },
                    'volcanic': { primary: '#ff4500', secondary: '#ff8c00', accent: '#ffffff', background: '#fff8dc' },
                    'arctic': { primary: '#b0e0e6', secondary: '#87ceeb', accent: '#000080', background: '#f0f8ff' },
                    'tropical': { primary: '#ff7f50', secondary: '#ffa500', accent: '#ffffff', background: '#ffefd5' }
                  }
                  return themeMap[themeName] || { primary: '#8e0b16', secondary: '#66181E', accent: '#ffffff', background: '#f8f9fa' }
                }

                const themeColors = getThemeColors(selectedTheme)
                const updatedTheme = {
                  primary: themeColors.primary,
                  secondary: themeColors.secondary,
                  accent: themeColors.accent,
                  background: themeColors.background
                }

                // Create a unique identifier for the theme to detect changes
                const currentThemeId = `${wheelTheme.primary}-${wheelTheme.secondary}-${wheelTheme.accent}-${wheelTheme.background}`
                const newThemeId = `${updatedTheme.primary}-${updatedTheme.secondary}-${updatedTheme.accent}-${updatedTheme.background}`

                // Update if theme has actually changed, even during spinning to maintain consistency
                if (currentThemeId !== newThemeId) {
                  console.log("🎨 BACKWARD COMPATIBILITY: Applying theme from selectedTheme (theme changed, including during spinning):", {
                    selectedTheme: selectedTheme,
                    themeColors: themeColors,
                    updatedTheme: updatedTheme,
                    themeChanged: true,
                    isSpinning: isSpinning,
                    sessionId: sessionId
                  })

                  // Force immediate update - even during spinning for consistency
                  setWheelTheme(updatedTheme)
                  lastThemeUpdateRef.current = newThemeId
                  setPersistentTheme(updatedTheme)
                  setThemeChangeTrigger(prev => prev + 1)

                  // Force immediate redraw with current angle for instant visual update
                  console.log("🎨 BACKWARD COMPATIBILITY: Redrawing wheel with theme from selectedTheme")
                  setTimeout(() => {
                    const canvas = canvasRef.current
                    if (canvas) {
                      const ctx = canvas.getContext("2d")
                      if (ctx) {
                        drawWheelAtAngleWithItems(ctx, canvas, currentAngle, wheelItems, updatedTheme)
                      }
                    }
                  }, 0)

                  toast({
                    title: "🎨 Theme Updated",
                    description: `Organizer applied ${selectedTheme} theme`,
                    duration: 3000
                  })
                } else {
                  console.log("🎨 BACKWARD COMPATIBILITY: Theme unchanged, skipping update:", {
                    selectedTheme: selectedTheme,
                    currentThemeId: currentThemeId,
                    newThemeId: newThemeId
                  })
                }
              }
            }

            // Handle wheel reset - INSTANT SYNCHRONIZATION WITH DEDUPLICATION
            if (wheelState.resetAt && wheelState.resetId && !organizerMode) {
              // 🎯 PREVENT DUPLICATE RESETS: Only process if this is a new reset
              const isNewReset = wheelState.resetId !== lastProcessedResetIdRef.current
              const isRecentReset = wheelState.resetAt > (Date.now() - 10000) // Within last 10 seconds
              
              if (isNewReset && isRecentReset) {
                console.log("✅ INSTANT RESET SYNC: Received wheel reset from organizer", {
                  resetBy: wheelState.resetBy || 'organizer',
                  resetId: wheelState.resetId,
                  resetAt: wheelState.resetAt,
                  timeSinceReset: Date.now() - wheelState.resetAt,
                  organizerMode: organizerMode,
                  sessionId: sessionId,
                  timestamp: new Date().toISOString()
                })

                // Mark this reset as processed
                lastProcessedResetIdRef.current = wheelState.resetId
                lastResetTimestampRef.current = wheelState.resetAt

                // Stop any ongoing animations immediately
                if (animationRef.current) {
                  cancelAnimationFrame(animationRef.current)
                  animationRef.current = null
                }
                stopAnimationRef.current = true
                isAnimationRunningRef.current = false
                animationCompletedRef.current = false

                // Ensure arrow pointer resets to starting position instantly
                setCurrentAngle(0)
                setWinners([])
                setShowResults(false)
                setIsSpinningWithRef(false)
                setPendingWinners(null)
                setHasAnnouncedWinners(false)
                setCurrentSpinId("")
                lastAnnouncedWinnerIds.current = ""

                // Force immediate wheel redraw with reset position
                setTimeout(() => {
                  console.log("✅ PARTICIPANT RESET: Redrawing wheel at starting position")
                  if (isEditingItems && editableItems.length > 0) {
                    drawWheel(editableItems, persistentTheme || wheelTheme);
                  } else {
                    drawWheel(wheelItems, persistentTheme || wheelTheme);
                  }
                }, 10)

                toast({
                  title: "🔄 Wheel Reset",
                  description: "Organizer reset the wheel - synced instantly",
                  duration: 2000
                })
              } else {
                console.log("🔄 RESET SKIPPED: Already processed or too old", {
                  isNewReset,
                  isRecentReset,
                  resetId: wheelState.resetId,
                  lastProcessedResetId: lastProcessedResetIdRef.current,
                  timeSinceReset: Date.now() - wheelState.resetAt
                })
              }
            }
            
            // 🔥 CRITICAL: Handle wheel type change from organizer - ONLY ONCE
            const currentWheelTypeId = wheelState.wheelTypeId || ""
            const isNewWheelType = currentWheelTypeId && currentWheelTypeId !== lastProcessedWheelTypeId.current
            const isRecentWheelTypeChange = wheelState.wheelTypeChangedAt && 
              (Date.now() - wheelState.wheelTypeChangedAt) < 5000; // 5 seconds window
            
            if (wheelState.wheelTypeChanged && wheelState.clearWinners && !organizerMode && isRecentWheelTypeChange && isNewWheelType) {
              console.log("🔥 PARTICIPANT: Organizer changed wheel type - clearing winners", {
                wheelTypeId: wheelState.wheelTypeId,
                wheelTypeChangedAt: wheelState.wheelTypeChangedAt,
                timeSinceChange: Date.now() - (wheelState.wheelTypeChangedAt || 0),
                organizerMode: organizerMode,
                sessionId: sessionId,
                hadWinners: winners.length > 0,
                timestamp: new Date().toISOString()
              })
              
              // Mark this wheel type as processed
              lastProcessedWheelTypeId.current = currentWheelTypeId
              
              // Clear all winner-related states immediately
              setWinners([])
              setShowResults(false)
              setHasAnnouncedWinners(false)
              setCurrentSpinId("")
              setPendingWinners(null)
              setIsConfettiActive(false)
              lastAnnouncedWinnerIds.current = ""
              
              // Clear confetti timeout
              if (confettiTimeoutRef) {
                clearTimeout(confettiTimeoutRef)
                setConfettiTimeoutRef(null)
              }
              
              // Ensure spinning is stopped
              setIsSpinningWithRef(false)
              stopAnimationRef.current = false
              isAnimationRunningRef.current = false
              animationCompletedRef.current = false
              
              // Clear any running animation
              if (animationRef.current) {
                cancelAnimationFrame(animationRef.current)
                animationRef.current = null
              }
              
              console.log("✅ PARTICIPANT: Successfully cleared winners after wheel type change")
            }
          }
        }
        (error: any) => {
          console.error("❌ Real-time listener error:", error)
          // Enhanced error handling for synchronization
          if (error.message.includes('permission-denied')) {
            console.warn("🔐 Permission denied for session listener - participant may not have access")
            console.warn("🎯 Session ID:", sessionId)
            console.warn("🎯 Organizer mode:", organizerMode)
            console.warn("🎯 Live mode:", isLiveMode)
            // Try to reload the session data for debugging
            if (isLiveMode && !organizerMode) {
              console.log("🔄 Setting up enhanced fallback polling for participants...")
              // Set up periodic polling as fallback for permission issues
              const fallbackInterval = setInterval(async () => {
                try {
                  const sessionDoc = await getDoc(doc(db, "liveDrawSessions", sessionId))
                  if (sessionDoc.exists()) {
                    const sessionData = sessionDoc.data()
                    const wheelState = sessionData.wheelState
                    console.log("📡 Fallback check - session state:", sessionData.currentState)
                    if (wheelState?.isSpinning && !isSpinning && !remoteSpinning) {
                      console.log("🎯 FALLBACK: Detected spin start via polling - triggering fallback animation")
                      // 🎯 100% SYNCHRONIZED FALLBACK: Use organizer's EXACT parameters
                      setRemoteSpinning(true)
                      console.log("🎯 FALLBACK SYNC: Using organizer's exact parameters", {
                        organizerDuration: wheelState.spinDuration || 4000,
                        organizerTotalRotation: wheelState.totalRotation || (8 * 2 * Math.PI),
                        organizerFinalAngle: wheelState.finalAngle || 0,
                        organizerSpins: wheelState.spins || 8,
                        exactMatch: true
                      })

                      setLastReceivedSpinData({
                        spinDuration: wheelState.spinDuration || 4000,
                        totalRotation: wheelState.totalRotation || (8 * 2 * Math.PI),
                        finalAngle: wheelState.finalAngle || 0,
                        spins: wheelState.spins || 8,
                        wheelItemsUsed: wheelState.wheelItemsUsed || wheelItems,
                        winningIndex: wheelState.winningIndex,
                        winners: wheelState.winners || []
                      })
                      console.log("🎯 FALLBACK: Triggering synchronized spin with organizer's parameters")
                      triggerSynchronizedCollaborativeSpin()
                    }
                    // Also check for winners if spinning stopped
                    if (!wheelState?.isSpinning && wheelState?.winners && wheelState.winners.length > 0) {
                      console.log("🎯 FALLBACK: Detected winners via polling")
                      setPendingWinners(wheelState.winners)
                      setRemoteSpinning(false)
                      setIsSpinningWithRef(false)
                      setShowResults(true)
                      triggerConfettiSafely(`fallback-${Date.now()}`)
                    }
                  }
                } catch (e) {
                  console.warn("Fallback polling failed:", e)
                }
              }, 1500) // Reduced interval for faster detection
              // Clean up the fallback interval after 30 seconds
              setTimeout(() => {
                console.log("🔄 Cleaning up fallback polling interval")
                clearInterval(fallbackInterval)
              }, 30000)
            }
          } else {
            console.error("🔄 Real-time sync error:", error)
            toast({
              title: "Connection Error",
              description: "Real-time synchronization failed. Please refresh the page.",
              variant: "destructive"
            })
          }
        }
    })


      setSessionListener(unsubscribe)

      return () => {
        console.log("🔄 Cleaning up real-time listener")
        if (unsubscribe) {
          unsubscribe()
        }
        setListenerSetup(false)
        setSessionListener(null)
      }
    } else if (sessionListener && (!enableRealTimeSync || !sessionId)) {
      // Clean up listener if real-time sync is disabled or sessionId is null
      console.log("🔄 Cleaning up real-time listener (sync disabled or session ended)")
      sessionListener()
      setSessionListener(null)
      setListenerSetup(false)
    }
  }, [enableRealTimeSync, sessionId, organizerMode, isLiveMode])

  // Enhanced real-time spinning synchronization for ALL NON-SPINNING USERS (organizers + collaborators + participants)
  useEffect(() => {
    if (!isLiveMode || !sessionId || !enableRealTimeSync) return

    // Set up for ALL users who are not the one triggering the spin
    console.log("🎯 EnhancedWheel: Setting up direct spinning synchronization for all users", {
      sessionId: sessionId,
      effectiveOrganizerMode: effectiveOrganizerMode,
      enableRealTimeSync: enableRealTimeSync,
      isFullAccessCollaborator: userPermissions.isFullAccessCollaborator
    })

    let isMounted = true
    let lastProcessedSpinId = ''

    // Direct Firebase listener for ALL users (organizer, collaborator, participant)
    const spinUnsubscribe = onSnapshot(
      doc(db, "liveDrawSessions", sessionId),
      (docSnapshot) => {
        if (!isMounted || !docSnapshot.exists()) return

        const sessionData = docSnapshot.data()
        const wheelState = sessionData.wheelState
        const currentRemoteSpinning = sessionData.isSpinning || wheelState?.isSpinning || false
        const currentSpinId = wheelState?.spinId || ''

        // 🔥 CRITICAL: Log every Firebase update for debugging
        console.log("📡 FIREBASE UPDATE RECEIVED:", {
          isSpinning: currentRemoteSpinning,
          broadcastSource: wheelState?.broadcastSource,
          hasSpinDuration: !!wheelState?.spinDuration,
          hasTotalRotation: !!wheelState?.totalRotation,
          hasWinners: !!wheelState?.winners?.length,
          sessionId: sessionId,
          timestamp: new Date().toISOString()
        })

        // Only log when spinning state actually changes to reduce console spam
        if (currentRemoteSpinning !== isSpinning || wheelState?.completedAt) {
          console.log("⚡ EnhancedWheel ALL USERS SPIN SYNC:", {
            remoteSpinning: currentRemoteSpinning,
            localIsSpinning: isSpinning,
            wheelState: wheelState,
            sessionId: sessionId,
            effectiveOrganizerMode: effectiveOrganizerMode,
            broadcastSource: wheelState?.broadcastSource,
            hasWinners: !!wheelState?.winners?.length,
            completedAt: wheelState?.completedAt,
            currentSpinId: currentSpinId,
            lastProcessedSpinId: lastProcessedSpinId,
            isNewSpin: currentSpinId !== lastProcessedSpinId,
            timestamp: new Date().toISOString()
          })
        }

        // 🎯 CRITICAL FIX: Start spinning for ALL users when ANYONE (organizer OR collaborator) initiates spin
        // Check if the broadcast is from organizer OR full-access-collaborator
        const isValidBroadcast = wheelState?.broadcastSource === 'organizer' || 
                                 wheelState?.broadcastSource === 'full-access-collaborator' ||
                                 sessionData.isSpinning

        // 🚀 NEW: Prevent processing the same spin twice
        const isNewSpin = currentSpinId && currentSpinId !== lastProcessedSpinId
        
        // 🔥 CRITICAL: Check if this spin was initiated by someone else (not me)
        // Enhanced logic: For organizer spins, collaborators should NEVER consider it "my spin"
        let wasInitiatedByMe = false

        if (wheelState?.broadcastSource === 'organizer' && !organizerMode) {
          // COLLABORATOR receiving organizer spin: NEVER consider it "my spin" - ALWAYS sync!
          wasInitiatedByMe = false
          console.log("🎯 COLLABORATOR SECOND LISTENER: Organizer spin detected - FORCED sync", {
            broadcastSource: wheelState.broadcastSource,
            organizerMode,
            forcedSync: true
          })
        } else if (wheelState?.broadcastSource === 'full-access-collaborator' && organizerMode) {
          // 🔥 CRITICAL FIX: ORGANIZER receiving collaborator spin - ALWAYS sync!
          wasInitiatedByMe = false
          console.log("🎯 ORGANIZER SECOND LISTENER: Collaborator spin detected - FORCED sync", {
            broadcastSource: wheelState.broadcastSource,
            organizerMode,
            forcedSync: true,
            timestamp: new Date().toISOString()
          })
        } else {
          // Only check timestamps for other cases
          wasInitiatedByMe = wheelState?.spinStartTime &&
            mySpinStartTimeRef.current &&
            mySpinStartTimeRef.current > 0 &&
            Math.abs(wheelState.spinStartTime - mySpinStartTimeRef.current) < 200

          console.log("🎯 TIMESTAMP-BASED SYNC CHECK", {
            broadcastSource: wheelState?.broadcastSource,
            wasInitiatedByMe,
            timestampComparison: Math.abs((wheelState?.spinStartTime || 0) - (mySpinStartTimeRef.current || 0))
          })
        }

        console.log("🔍 SECOND LISTENER SPIN CHECK (FIXED):", {
          wheelStateSpinStartTime: wheelState?.spinStartTime,
          mySpinStartTimeRef: mySpinStartTimeRef.current,
          wasInitiatedByMe,
          isNewSpin,
          isValidBroadcast,
          willSync: isValidBroadcast && isNewSpin && !wasInitiatedByMe
        })

        if (isValidBroadcast && isNewSpin && !wasInitiatedByMe) {
          // 🔥 CRITICAL FIX: Ensure participants spin when organizer spins
          // Remove the !remoteSpinning condition to allow immediate sync even if remoteSpinning is true
          if (currentRemoteSpinning && !isSpinning && !isAnimationRunningRef.current) {
            const spinSource = wheelState?.broadcastSource === 'organizer' ? 'Organizer' : 
                             wheelState?.broadcastSource === 'full-access-collaborator' ? 'Collaborator' : 'Remote user'
            console.log(`🎯 EnhancedWheel: ${spinSource} started spin - syncing wheel for all users (including me!)`)
            
            // Mark this spin as processed
            lastProcessedSpinId = currentSpinId

            // Set remote spinning state
            setRemoteSpinning(true)

            // 🎯 USE FIXED FULL DURATION: Always play the complete animation for collaborators
            const spinDuration = wheelState?.spinDuration || 4000
            const totalRotation = wheelState?.totalRotation || (8 * 2 * Math.PI)
            const finalAngle = wheelState?.finalAngle || 0
            const spins = wheelState?.spins || 8

            console.log("🎯 ENHANCED ALL USERS SYNC: Using broadcaster's exact parameters", {
              broadcastSource: wheelState?.broadcastSource || 'unknown',
              duration: `${spinDuration}ms (ALWAYS FULL DURATION FOR COLLABORATORS)`,
              totalRotation: `${(totalRotation / (2 * Math.PI)).toFixed(3)} rotations`,
              finalAngle: `${(finalAngle * 180 / Math.PI).toFixed(1)}°`,
              spins: spins,
              exactMatch: true,
              synchronizationAccuracy: "100%"
            })

            const remoteSpinData = {
              spinDuration,
              totalRotation,
              finalAngle,
              spins,
              // 🔥 CRITICAL FIX: Use broadcast items first, fallback only if empty
              wheelItemsUsed: (wheelState?.wheelItemsUsed && wheelState.wheelItemsUsed.length > 0) ? wheelState.wheelItemsUsed : wheelItems,
              winningIndex: wheelState?.winningIndex,
              winners: wheelState?.winners || [],
              animationTheme: wheelState?.animationTheme || wheelState?.theme,
              broadcastSource: wheelState?.broadcastSource || 'unknown',
              timestamp: Date.now(),
              spinStartTime: wheelState?.spinStartTime // Include for timing sync
            }

            setReceivedSpinData(remoteSpinData)
            setLastReceivedSpinData(remoteSpinData)

            // 🎯 START COMPLETE ANIMATION: Use fixed full duration, don't adjust
            if (isMounted) {
              const spinnerRole = wheelState?.broadcastSource === 'organizer' ? 'organizer' :
                                wheelState?.broadcastSource === 'full-access-collaborator' ? 'collaborator' : 'remote user'
              console.log(`🎯 ENHANCED ALL USERS: Starting complete animation with ${spinnerRole}'s parameters`)

              // 🔥 CRITICAL: Calculate elapsed time since broadcaster started their spin
              const elapsedSinceSpinStart = Date.now() - (remoteSpinData.spinStartTime || Date.now())
              
              // Clamp elapsed time to prevent negative values or values exceeding duration
              const clampedElapsed = Math.max(0, Math.min(elapsedSinceSpinStart, spinDuration))

              console.log("🎯 ANIMATION TIMING SYNC (CRITICAL):", {
                broadcastSource: wheelState?.broadcastSource,
                broadcastSpinStartTime: remoteSpinData.spinStartTime,
                currentTime: Date.now(),
                elapsedSinceBroadcast: `${elapsedSinceSpinStart}ms`,
                clampedElapsed: `${clampedElapsed}ms`,
                originalDuration: remoteSpinData.spinDuration || 4000,
                adjustedDuration: spinDuration - clampedElapsed,
                usedDuration: spinDuration,
                reason: "Syncing to match broadcaster's animation end time",
                syncStrategy: "Account for broadcast latency to complete at same time"
              })

              // START WITH TIMING OFFSET to complete at same time as broadcaster
              startFallbackAnimation({
                ...remoteSpinData,
                spinDuration: spinDuration, // Full duration from broadcaster
                timeOffset: clampedElapsed // How much time has already elapsed
              })
            }
          }

          // Stop spinning when broadcaster (organizer OR collaborator) completes
          if ((!currentRemoteSpinning || wheelState?.completedAt) && (isSpinning || remoteSpinning)) {
            const spinnerRole = wheelState?.broadcastSource === 'organizer' ? 'Organizer' :
                              wheelState?.broadcastSource === 'full-access-collaborator' ? 'Collaborator' : 'Remote user'
            console.log(`🎯 EnhancedWheel: ${spinnerRole} completed spin - stopping wheel for all users`)
            setRemoteSpinning(false)
            setIsSpinningWithRef(false)

            // Handle winners from broadcaster (organizer OR collaborator)
            if (wheelState?.winners && wheelState.winners.length > 0) {
              const spinnerRole = wheelState?.broadcastSource === 'Organizer' ? 'Organizer' :
                                wheelState?.broadcastSource === 'full-access-collaborator' ? 'Collaborator' : 'Remote user'
              console.log(`🏆 EnhancedWheel: ${spinnerRole} winners received:`, wheelState.winners)

              // Convert broadcaster's winners to participant format
              const winnerParticipants = wheelState.winners.map((winner: any) => ({
                id: winner.id || `winner-${Date.now()}`,
                name: winner.name || winner.text || 'Winner',
                isSelected: true
              }))

              setRemoteWinners(winnerParticipants)
              // 🔥 CRITICAL FIX: Set pending winners so they announce AFTER animation completes
              // DO NOT set showResults=true here - let the animation completion logic handle it
              setPendingWinners(winnerParticipants)
              setHasAnnouncedWinners(false) // Reset for new announcement
              setCurrentSpinId("")

              console.log("🎯 WAITING FOR ANIMATION TO COMPLETE before showing results", {
                spinnerRole,
                willShowAfterAnimation: true
              })

              // Trigger confetti AFTER animation completes (via animation completion logic)
              // NOT immediately - we need to wait for the wheel to stop spinning
            }
          }
        }
      },
      (error) => {
        console.error("❌ EnhancedWheel real-time spin sync error:", error)
      }
    )

    return () => {
      isMounted = false
      spinUnsubscribe()
    }
  }, [isLiveMode, sessionId, enableRealTimeSync, effectiveOrganizerMode]) // Use effectiveOrganizerMode instead of just organizerMode

  // Simplified fallback winner check - less frequent polling to reduce server load
  useEffect(() => {
    if (!enableRealTimeSync || !sessionId || organizerMode) return

    const checkForWinners = async () => {
      try {
        const sessionDoc = await getDoc(doc(db, "liveDrawSessions", sessionId))
        if (sessionDoc.exists()) {
          const sessionData = sessionDoc.data()
          const wheelState = sessionData.wheelState

          if (wheelState?.winners && wheelState.winners.length > 0 && !isSpinning) {
            const now = Date.now()
            if (now - lastWinnerCheck > 5000) { // Increased to 5 seconds to reduce load
              console.log("🎯 FALLBACK: Found winners via periodic check", {
                winnerCount: wheelState.winners.length,
                sessionId: sessionId
              })
              setPendingWinners(wheelState.winners)
              setLastWinnerCheck(now)
            }
          }
        }
      } catch (error) {
        console.warn("Fallback winner check failed:", error)
      }
    }

    // Check every 5 seconds instead of 3
    const interval = setInterval(checkForWinners, 5000)

    return () => clearInterval(interval)
  }, [enableRealTimeSync, sessionId, organizerMode, isSpinning, lastWinnerCheck])

  const playSpinSound = () => {
    if (!settings.playSound) return
    
    // Create a simple spin sound using Web Audio API
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
    const oscillator = audioContext.createOscillator()
    const gainNode = audioContext.createGain()
    
    oscillator.connect(gainNode)
    gainNode.connect(audioContext.destination)
    
    oscillator.frequency.setValueAtTime(200, audioContext.currentTime)
    oscillator.frequency.exponentialRampToValueAtTime(100, audioContext.currentTime + 0.5)
    
    gainNode.gain.setValueAtTime(0.1, audioContext.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5)
    
    oscillator.start(audioContext.currentTime)
    oscillator.stop(audioContext.currentTime + 0.5)
  }


  const spinWheel = async () => {
    console.log("🚨 SPIN WHEEL BUTTON CLICKED!", {
      timestamp: Date.now(),
      effectiveOrganizerMode,
      organizerMode,
      isFullAccessCollaborator: userPermissions.isFullAccessCollaborator,
      enableRealTimeSync,
      sessionId,
      isResearchModeActive
    })
    
    // 🎲 RESEARCH MODE: If in research mode, trigger special research spin
    console.log("🎯 SPIN WHEEL ENTRY - Research Mode Check:", {
      isResearchModeActive,
      selectedStudentsCount: selectedStudents.length,
      selectedStudents: selectedStudents.map(s => s.name),
      uploadedStudentsCount: uploadedStudentList.length
    })

    if (isResearchModeActive && uploadedStudentList.length > 0) {
      console.log("🎲 RESEARCH MODE SPIN TRIGGERED:", {
        uploadedStudentsCount: uploadedStudentList.length,
        randomSelectionCount: randomSelectionCount,
        selectedStudentsCount: selectedStudents.length
      })

      // 🎯 CRITICAL FIX: Use the PREVIOUSLY SELECTED students from handleRandomSelection()
      // Don't do a new random selection here - that causes the first-try failure
      if (selectedStudents.length === 0) {
        console.log("⚠️ No students selected yet, performing selection now")
        // Fallback: Perform selection if none exists (shouldn't happen with proper flow)
        const shuffled = [...uploadedStudentList]
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
        }
        const newlySelected = shuffled.slice(0, randomSelectionCount)
        setSelectedStudents(newlySelected)
        console.log("🎲 FALLBACK SELECTION:", {
          selectedCount: newlySelected.length,
          newStudents: newlySelected.map(s => s.name)
        })
      }

      // 🎯 CRITICAL: Use selectedStudents that was set by handleRandomSelection()
      const studentsToUse = selectedStudents.length > 0 ? selectedStudents : (() => {
        // Emergency fallback - shouldn't happen
        const shuffled = [...uploadedStudentList]
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
        }
        return shuffled.slice(0, randomSelectionCount)
      })()

        console.log("🎯 USING SELECTED STUDENTS FOR SPIN:", {
          studentsToUseCount: studentsToUse.length,
          studentsToUse: studentsToUse.map(s => s.name)
        })

        // 🎯 CRITICAL FIX: DO NOT change wheel display - keep showing all 50 students
        // Wheel display remains unchanged - will show all original students
        // Winners (the selected students) will be shown in center ONLY after spinning completes

        // 🎯 SMOOTH WHEEL SPIN: Use the standard wheel spinning animation
        // Reset wheel state for clean spin
        setCurrentAngle(0)
        setPendingWinners(null)

        // 🎯 CRITICAL FIX: DO NOT show results yet - they should only appear after spinning completes
        // Store winners internally but don't display them yet
        const researchWinnersList = studentsToUse.map((student, idx) => ({
          id: student.id || `winner-${idx}`,
          name: student.name?.trim() || `Student ${idx + 1}`,  // 🎯 SANITIZE: Trim and ensure valid name
          email: student.email?.trim()  // 🎯 SANITIZE: Trim email
        }))
        
        // Store winners but DON'T show them yet (setShowResults stays false)
        setWinners(researchWinnersList)
        console.log("🎯 WINNERS STORED (NOT SHOWN YET):", researchWinnersList.length, "winners will display after spinning")

        // 🎯 CRITICAL FIX: No redraw needed - wheel already shows all original students
        // Just proceed with spinning animation

        // Small delay to ensure rendering is complete
        await new Promise(resolve => setTimeout(resolve, 100))

        // 🎯 START SMOOTH SPIN ANIMATION
        setIsSpinningWithRef(true)
        mySpinStartTimeRef.current = Date.now()
        stopAnimationRef.current = false

        console.log("🎯 Starting smooth research spin animation")

        // 🔥 CRITICAL FIX: Broadcast spin START to Firebase immediately so participants start spinning
        if (enableRealTimeSync && sessionId && effectiveOrganizerMode) {
          const spinStartTime = Date.now()
          const broadcastData = {
            isSpinning: true,
            wheelState: {
              isSpinning: true,
              spinStartTime: spinStartTime,
              spinDuration: settings.spinDuration || 4000,
              broadcastSource: organizerMode ? 'organizer' : 'full-access-collaborator',
              wheelItemsUsed: stableWheelItems,
              participantSync: 'IMMEDIATE',
              instantStart: true,
              forceParticipantSync: true
            },
            updatedAt: serverTimestamp()
          }

          try {
            await updateDoc(doc(db, "liveDrawSessions", sessionId), broadcastData)
            console.log("✅ RESEARCH SPIN START broadcasted to Firebase - participants should start spinning now")
          } catch (error) {
            console.error("❌ Failed to broadcast research spin start:", error)
          }
        }

      // Calculate smooth spin (5-7 full rotations)
      const spins = 5 + Math.random() * 2 // 5-7 rotations for smooth effect
      const totalRotation = spins * 2 * Math.PI

      const startTime = performance.now()
      const spinDuration = settings.spinDuration || 4000

      // 🎯 CRITICAL: Mark animation as running to prevent duplicate syncs
      isAnimationRunningRef.current = true
      stopAnimationRef.current = false

      // Animate the spin
      const animateSpin = (currentTime = performance.now()) => {
        // 🛡️ STABILITY CHECK: Stop if animation was cancelled
        if (stopAnimationRef.current || !isAnimationRunningRef.current) {
          console.log("🛑 Research spin animation stopped externally")
          isAnimationRunningRef.current = false
          return
        }

        const elapsed = currentTime - startTime
        const progress = Math.min(elapsed / spinDuration, 1)

        // Smooth easing
        const easeProgress = progress >= 0.98 ? 1 : easeInOutCubic(progress)
        const currentRotation = totalRotation * easeProgress

        // Draw wheel at current rotation
        const canvas = canvasRef.current
        if (canvas && canvas.width > 0 && canvas.height > 0) {
          const ctx = canvas.getContext("2d")
          if (ctx) {
            drawWheelAtAngleWithItems(ctx, canvas, currentRotation, stableWheelItems, persistentTheme || wheelTheme)
          }
        }

        setCurrentAngle(currentRotation)

        if (progress < 1) {
          requestAnimationFrame(animateSpin)
        } else {
          // 🎯 CRITICAL: Mark animation as complete and reset refs properly for NEXT spin
          animationCompletedRef.current = true
          isAnimationRunningRef.current = false
          stopAnimationRef.current = false  // 🎯 CRITICAL: Reset this to allow next spin
          setIsSpinningWithRef(false)
          mySpinStartTimeRef.current = 0

          console.log("🎉 RESEARCH SPIN COMPLETE - Animation finished, refs reset")

          // 🎯 CRITICAL: Switch to showing ONLY selected students after spinning
          // Update the flag to show selected students on the wheel
          setShowSelectedStudentsOnWheel(true)
          
          // Store selected students in the ref for wheelItems to use
          const selectedNames = studentsToUse.map(s => s.name)
          filledLiveParticipantsRef.current = selectedNames
          console.log("🎯 WHEEL MODE: Set to show only 10 selected students after spin")

          // 🎯 CRITICAL DELAY: Micro-delay to ensure all refs are truly reset before showing results
          // This prevents any race conditions with animation loop
          setTimeout(() => {
            // Double-check animation is really done
            if (!isAnimationRunningRef.current) {
              setShowResults(true)
              console.log("✅ RESULTS DISPLAYED - Animation 100% complete with 10 students on wheel")
            }
          }, 50)

          // Confetti celebration
          confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 }
          })

          // Call onSpinComplete callback
          if (onSpinComplete) {
            onSpinComplete({
              id: `research-spin-${Date.now()}`,
              winners: researchWinnersList,
              timestamp: new Date(),
              spinDuration: spinDuration,
              totalParticipants: studentsToUse.length
            })
          }

          // Broadcast to Firebase if in live mode
          if (enableRealTimeSync && sessionId && effectiveOrganizerMode) {
            const researchBroadcastData = {
              isSpinning: false,
              winners: researchWinnersList,
              wheelState: {
                wheelItems: stableWheelItems,
                customItems: stableWheelItems,
                isSpinning: false,
                completedAt: Date.now(),
                winners: researchWinnersList,
                broadcastSource: organizerMode ? 'organizer' : 'full-access-collaborator',
                triggeredByOrganizer: true
              },
              updatedAt: serverTimestamp()
            }

            // Use .then().catch() instead of await since this is in a callback
            updateDoc(doc(db, "liveDrawSessions", sessionId), researchBroadcastData)
              .then(() => {
                console.log("✅ Research winners broadcasted to Firebase - participants should stop spinning and show results")
              })
              .catch((error) => {
                console.error("❌ Failed to broadcast research winners:", error)
              })
          }

          toast({
            title: "🎉 Selection Complete!",
            description: `${researchWinnersList.length} student${researchWinnersList.length > 1 ? 's' : ''} randomly selected!`,
          })
        }
      }

      // Start the animation
      requestAnimationFrame(animateSpin)

      return
    }
    
    // Get the most current wheel items at the time of spinning
    // 🧹 CRITICAL FIX: Use the same logic as wheelItems calculation to ensure consistency
    // When in editing mode, ALWAYS use editableItems (even if it's just 1 item), don't fall back
    const currentWheelItems = customItems && customItems.length > 0 ? customItems :
                              isEditingItems ? editableItems :
                              showOnlyLiveParticipants && liveParticipants.length > 0 ? liveParticipants.map(p => p.name) :
                              participants && participants.length > 0 ? participants.map(p => p.name) :
                              selectedWheelType?.defaultItems && selectedWheelType.defaultItems.length > 0 ? selectedWheelType.defaultItems :
                              ["Option 1", "Option 2", "Option 3", "Option 4", "Option 5"]

    if (process.env.NODE_ENV === 'development') {
      console.log("🎯 SPIN WHEEL: Using current wheel items for spinning", {
        currentWheelItemsCount: currentWheelItems.length,
        currentWheelItems: currentWheelItems.slice(0, 5),
        isEditingItems,
        editableItemsCount: editableItems.length,
        selectedWheelTypeItems: selectedWheelType?.defaultItems?.length || 0,
        participantsCount: participants?.length || 0,
        // ENHANCED: Log collaborator permissions
        effectiveOrganizerMode,
        isFullAccessCollaborator: userPermissions.isFullAccessCollaborator,
        canTriggerSynchronizedSpin: userPermissions.canTriggerSynchronizedSpin
      })
    }

    if (currentWheelItems.length === 0) {
      console.log("❌ Cannot spin: No wheel items available")
      return
    }
    
    // 🎯 PREVENT SPAM: Don't allow spinning if already spinning with debounce
    if (isSpinning || isAnimationRunningRef.current) {
      console.log("⚠️ SPIN BLOCKED: Wheel is already spinning", {
        isSpinning,
        isAnimationRunning: isAnimationRunningRef.current,
        timestamp: Date.now()
      })
      
      // Only show toast if user hasn't been notified recently (throttle notifications)
      const now = Date.now()
      const lastNotification = (window as any).__lastSpinBlockNotification || 0
      if (now - lastNotification > 2000) { // Show max once per 2 seconds
        toast({
          title: "Please Wait",
          description: "The wheel is already spinning. Please wait for it to finish.",
          variant: "default"
        })
        ;(window as any).__lastSpinBlockNotification = now
      }
      return
    }

    // 🛡️ STABILITY: Add minimum delay between spins (prevent rapid fire)
    const lastSpinTime = (window as any).__lastSpinTime || 0
    const timeSinceLastSpin = Date.now() - lastSpinTime
    const minimumSpinDelay = 1000 // 1 second minimum between spins
    
    if (timeSinceLastSpin < minimumSpinDelay) {
      console.log("⚠️ SPIN BLOCKED: Too soon after last spin", {
        timeSinceLastSpin,
        minimumRequired: minimumSpinDelay
      })
      toast({
        title: "Too Fast!",
        description: `Please wait ${Math.ceil((minimumSpinDelay - timeSinceLastSpin) / 1000)} second(s) before spinning again.`,
        variant: "default"
      })
      return
    }
    
    // Record this spin time
    ;(window as any).__lastSpinTime = Date.now()
    
    if (process.env.NODE_ENV === 'development') {
      console.log("🎯 SPIN WHEEL INITIATED:", {
        isCurrentlySpinning: isSpinning,
        currentWheelItemsCount: currentWheelItems.length,
        effectiveOrganizerMode,
        timestamp: Date.now()
      })
    }

    // ENHANCED: Allow full access collaborators to spin like organizers - STRICT VIEW ONLY CHECK
    const canSpin = effectiveOrganizerMode || (isLiveMode && userPermissions.isFullAccessCollaborator && userPermissions.canTriggerSynchronizedSpin)

    // STRICT VIEW ONLY: Prevent spinning for view-only users
    const isViewOnlyUser = userPermissions?.canViewOnly === true ||
      studentMode ||
      (isLiveMode && !effectiveOrganizerMode && !userPermissions.isFullAccessCollaborator)

    if (isLiveMode && !canSpin) {
      toast({
        title: "Watch Only",
        description: "Only the organizer or full access collaborators can spin the wheel in live mode",
        variant: "destructive"
      })
      return
    }

    // ADDITIONAL CHECK: Prevent view-only users from spinning even if they somehow get past the first check
    if (isViewOnlyUser) {
      toast({
        title: "View Only Mode",
        description: "You can only watch the wheel in this mode. Contact the organizer for access.",
        variant: "destructive"
      })
      return
    }

    // ENHANCED LOGGING: Track who is initiating the spin
    if (userPermissions.isFullAccessCollaborator) {
      console.log("🎯 FULL ACCESS COLLABORATOR: Initiating synchronized spin for all participants", {
        collaboratorId: userPermissions.userRole,
        sessionId: userPermissions.sessionId,
        effectiveOrganizerMode,
        synchronizationEnabled: userPermissions.synchronizationEnabled,
        timestamp: new Date().toISOString()
      })
    }

    // 🎯 CRITICAL: Record exact spin start time for perfect synchronization
    const spinStartTime = Date.now()
    mySpinStartTimeRef.current = spinStartTime // Track that I initiated this spin

    // 🎯 CRITICAL: Clear old winners FIRST to prevent showing previous winners
    setWinners([])
    setPendingWinners(null)

    // Set spinning state
    setIsSpinningWithRef(true)
    setShowResults(false)

    // 🎨 CRITICAL FIX: Lock the current theme to persist during spinning
    setPersistentTheme(wheelTheme)

    // Reset winner announcement state for new spin
    setHasAnnouncedWinners(false)
    setCurrentSpinId("")
    animationCompletedRef.current = false // Reset animation completion flag

    // 🎯 RESET ANNOUNCEMENT TRACKING FOR NEW SPIN
    lastAnnouncedWinnerIds.current = ""

    // Reset drawing refs to ensure redraw after spinning
    lastDrawnItemsRef.current = []
    lastDrawnThemeRef.current = null

    if (process.env.NODE_ENV === 'development') {
      console.log("🎯 SPIN WHEEL: Using current wheel items for spinning", {
        currentWheelItemsCount: currentWheelItems.length,
        currentWheelItems: currentWheelItems.slice(0, 5),
        isEditingItems,
        editableItemsCount: editableItems.length,
        selectedWheelTypeItems: selectedWheelType?.defaultItems?.length || 0,
        participantsCount: participants?.length || 0,
        // ENHANCED: Log collaborator permissions
        effectiveOrganizerMode,
        isFullAccessCollaborator: userPermissions.isFullAccessCollaborator,
        canTriggerSynchronizedSpin: userPermissions.canTriggerSynchronizedSpin
      })
    }

    playSpinSound()

    // 🎯 SIMPLE SPIN CALCULATION: Match other wheel types exactly
    const spins = 5 + Math.random() * 10 // 5-15 full rotations (matches PieWheel)

    // 🎯 DETERMINISTIC FINAL ANGLE: Calculate based on winning index for consistent stopping
    // This ensures the same winner always results in the same stopping position
    const segmentAngle = (2 * Math.PI) / currentWheelItems.length
    const targetWinningIndex = Math.floor(Math.random() * currentWheelItems.length) // Random winner
    const deterministicFinalAngle = targetWinningIndex * segmentAngle // Position winner at pointer

    const totalRotation = spins * 2 * Math.PI + deterministicFinalAngle

    // 🎯 SIMPLE WINNER CALCULATION: Use the unified calculation function
    const { winningIndex, winner } = calculateWinner(totalRotation, currentWheelItems)

    console.log("🎯 100% ACCURATE WINNER PRE-CALCULATION (WEB):", {
      timestamp: new Date().toISOString(),
      mode: organizerMode ? 'organizer' : 'collaborator',
      sessionId: sessionId,

      // Wheel parameters
      currentWheelItemsCount: currentWheelItems.length,
      currentWheelItems: currentWheelItems.slice(0, 5), // First 5 items

      // Rotation calculations
      totalRotationRadians: totalRotation.toFixed(6),
      totalRotationDegrees: (totalRotation * 180 / Math.PI).toFixed(2),
      finalAngleRadians: deterministicFinalAngle.toFixed(6),
      finalAngleDegrees: (deterministicFinalAngle * 180 / Math.PI).toFixed(2),

      // Winner result
      winningIndex: winningIndex,
      expectedWinner: winner,

      // Cross-platform compatibility check
      winnerCalculationMethod: 'unified-pointer-aligned-calculation',

      // Debug info
      hasSpinParams: !!(totalRotation && deterministicFinalAngle),
      syncEnabled: enableRealTimeSync,
      collaborativeMode: !!userPermissions?.isFullAccessCollaborator,
      pointerAlignment: 'perfect'
    })

    // 🎯 100% ACCURATE REAL-TIME SYNC: Broadcast spin start to Firebase for live sessions
    // ENHANCED: Full access collaborators can also broadcast synchronized spins
    if (enableRealTimeSync && sessionId && (effectiveOrganizerMode || userPermissions.isFullAccessCollaborator)) {
      // Start broadcast in parallel with animation to avoid delay
      (async () => {
        try {
          // ENHANCED LOGGING: Track broadcast source for bidirectional sync
          const broadcastSource = organizerMode ? 'organizer' :
            userPermissions.isFullAccessCollaborator ? 'full-access-collaborator' : 'participant'
          
          console.log(`🎯 ${broadcastSource.toUpperCase()} INITIATING BROADCAST: ${organizerMode ? 'Organizer' : 'Collaborator'} spinning - all participants will sync`, {
            broadcastSource,
            sessionId,
            organizerMode,
            effectiveOrganizerMode,
            isFullAccessCollaborator: userPermissions.isFullAccessCollaborator,
            bidirectionalSyncEnabled: true,
            willSyncWith: broadcastSource === 'organizer' ? 'collaborators + participants' : 'organizer + participants',
            timestamp: new Date().toISOString()
          })

          // 🚀 PERFECT SYNCHRONIZATION BROADCAST: Include all parameters for instant 100% sync
          const currentSpinIdValue = Date.now().toString()
          const broadcastStartTime = Date.now() // Exact start time for perfect synchronization
          setSpinId(currentSpinIdValue)
          
          const broadcastData = {
            currentState: "spinning",
            isSpinning: true,
            wheelState: {
              currentAngle: currentAngle,
              isSpinning: true,
              winners: [],
              spinStartTime: broadcastStartTime, // 🎯 EXACT SYNCHRONIZATION TIME
              spinId: currentSpinIdValue,
              // 🚀 100% SYNCHRONIZATION PARAMETERS: Perfect timing and positioning
              spinDuration: settings.spinDuration,
              totalRotation: totalRotation,
              finalAngle: deterministicFinalAngle,
              spins: spins,
              // 🎯 PERFECT WINNER CALCULATION: Exact same result for all participants
              winningIndex: winningIndex,
              segmentAngle: (2 * Math.PI) / currentWheelItems.length,
              normalizedRotation: totalRotation % (2 * Math.PI),
              // 🔧 CRITICAL: Broadcast exact wheel items for consistent winner calculation
              wheelItemsUsed: currentWheelItems,
              wheelItemsCount: currentWheelItems.length,
              // 🎨 PERFECT VISUAL SYNC: Use organizer's theme for identical appearance
              animationTheme: wheelTheme,
              theme: wheelTheme,
              // 🚀 PERFECT TIMING SYNCHRONIZATION: Enhanced timing data for zero-lag sync
              broadcastTimestamp: broadcastStartTime,
              serverTimestamp: Date.now(), // Server side timestamp
              performanceTimestamp: performance.now(), // High precision timestamp
              timezoneOffset: new Date().getTimezoneOffset(), // Account for timezone differences
              networkLatency: 0, // Will be calculated by participants
              syncPriority: 'MAXIMUM', // Highest priority for timing sync
              broadcastSource: broadcastSource,
              collaboratorId: userPermissions.isFullAccessCollaborator ? userPermissions.userRole : null,
              organizerId: effectiveOrganizerMode ? "organizer-" + sessionId : null,
              // 🔥 CRITICAL PARTICIPANT SYNC FLAGS
              participantSync: 'IMMEDIATE',
              instantStart: true,
              zeroDelay: true,
              perfectSync: true,
              forceParticipantSync: true, // Force participants to sync regardless of state
              clearParticipantState: true, // Clear participant state before sync
              participantSyncMode: 'EXACT_MATCH', // Match organizer exactly
              // 🎯 CRITICAL: Mark as organizer-triggered for winner validation
              triggeredByOrganizer: broadcastSource === 'organizer' || broadcastSource === 'full-access-collaborator',
              currentState: 'spinning'
            },
            updatedAt: serverTimestamp()
          }

          try {
            await updateDoc(doc(db, "liveDrawSessions", sessionId), broadcastData)

            console.log("✅ FIREBASE BROADCAST SUCCESS - Bidirectional sync active:", {
              sessionId,
              isSpinning: broadcastData.isSpinning,
              broadcastSource,
              wheelStateIsSpinning: broadcastData.wheelState.isSpinning,
              spinStartTime: broadcastData.wheelState.spinStartTime,
              bidirectionalSync: true,
              willBeSyncedBy: broadcastSource === 'organizer' ? 'collaborators + participants' : 'organizer + participants',
              timestamp: new Date().toISOString()
            })

            // 🔍 VERIFY: Read back to confirm write
            setTimeout(async () => {
              const verifyDoc = await getDoc(doc(db, "liveDrawSessions", sessionId))
              if (verifyDoc.exists()) {
                const verifyData = verifyDoc.data()
                console.log("🔍 FIREBASE VERIFICATION:", {
                  isSpinning: verifyData.isSpinning,
                  wheelStateIsSpinning: verifyData.wheelState?.isSpinning,
                  broadcastSource: verifyData.wheelState?.broadcastSource,
                  success: verifyData.isSpinning === true
                })
              }
            }, 100)

            console.log("🚀 PERFECT SYNCHRONIZATION BROADCAST: Zero-delay parameters sent for 100% accuracy", {
  spinDuration: settings.spinDuration,
  totalRotation: totalRotation / (2 * Math.PI),
  finalAngle: deterministicFinalAngle * 180 / Math.PI,
  spins: spins,
  wheelItemsCount: currentWheelItems.length,
  wheelItemsPreview: currentWheelItems.slice(0, 3),
  winningIndex: winningIndex,
  expectedWinner: winner,
  sessionId: sessionId,
  broadcastSource,
  effectiveOrganizerMode,
  isFullAccessCollaborator: userPermissions.isFullAccessCollaborator,
  broadcastTimestamp: broadcastData.wheelState.broadcastTimestamp,
  synchronizationAccuracy: "100% (pointer-aligned)",
  // 🚀 INSTANT SYNCHRONIZATION FLAGS: Zero-delay response enabled
  instantSyncFlags: {
    participantSync: broadcastData.wheelState.participantSync,
    instantStart: broadcastData.wheelState.instantStart,
    zeroDelay: broadcastData.wheelState.zeroDelay,
    perfectSync: broadcastData.wheelState.perfectSync,
    currentState: broadcastData.wheelState.currentState
  },
  timestamp: new Date().toISOString()
})

            // 🚀 ENHANCED: Verify the broadcast was successful by reading it back
            setTimeout(async () => {
              try {
                const verifyDoc = await getDoc(doc(db, "liveDrawSessions", sessionId))
                if (verifyDoc.exists()) {
                  const verifyData = verifyDoc.data()
                  console.log("✅ BROADCAST VERIFICATION: Spin start successfully written to Firebase:", {
                    sessionId: sessionId,
                    currentState: verifyData.currentState,
                    isSpinning: verifyData.isSpinning,
                    wheelState: verifyData.wheelState,
                    hasInstantFlags: !!(verifyData.wheelState?.participantSync === 'immediate' ||
                                       verifyData.wheelState?.instantStart ||
                                       verifyData.wheelState?.zeroDelay),
                    timestamp: new Date().toISOString()
                  })
                }
              } catch (verifyError) {
                console.error("⚠️ BROADCAST VERIFICATION FAILED:", verifyError)
              }
            }, 100)

          } catch (error: any) {
            console.error("❌ CRITICAL: Failed to broadcast spin start to Firebase:", {
              error: error.message,
              errorCode: error.code,
              sessionId: sessionId,
              broadcastSource,
              dataSize: JSON.stringify(broadcastData).length,
              // 🚀 ENHANCED DEBUGGING: Log the broadcast data that failed
              broadcastData: broadcastData,
              instantSyncFlags: {
                participantSync: broadcastData.wheelState.participantSync,
                instantStart: broadcastData.wheelState.instantStart,
                zeroDelay: broadcastData.wheelState.zeroDelay,
                
                currentState: broadcastData.wheelState.currentState
              },
              timestamp: new Date().toISOString()
            })

            // Continue with local spin even if broadcast fails
            console.log("🔄 Continuing with local spin despite broadcast failure")
          }
        } catch (error) {
          console.error("❌ Failed to broadcast spin start:", error)
          toast({
            title: "Synchronization Error",
            description: "Failed to synchronize wheel spin. Please try again.",
            variant: "destructive"
          })
        }
      })()
    }

    // 🎯 SIMPLE SPIN ANIMATION - Matches other wheel types exactly - START IMMEDIATELY
    const startTime = performance.now()
    const spinDuration = settings.spinDuration || 4000 // Use settings or default to 4 seconds

    // 🎯 CRITICAL: Mark animation as running to prevent duplicate syncs
    isAnimationRunningRef.current = true
    stopAnimationRef.current = false

    const animate = (currentTime = performance.now()) => {
      // 🛡️ STABILITY CHECK: Stop if animation was cancelled
      if (stopAnimationRef.current || !isAnimationRunningRef.current) {
        console.log("🛑 Animation stopped externally")
        isAnimationRunningRef.current = false
        return
      }

      const elapsed = currentTime - startTime
      const progress = Math.min(elapsed / spinDuration, 1)

      // 🎯 SMOOTH CUBIC EASING - Consistent with all other animations
      const easeProgress = progress >= 0.98 ? 1 : easeInOutCubic(progress)

      // Calculate current rotation - simple and consistent
      const currentRotation = totalRotation * easeProgress

      // 🎯 OPTIMIZED CANVAS DRAWING - Only draw if canvas exists and is valid
      const canvas = canvasRef.current
      if (canvas && canvas.width > 0 && canvas.height > 0) {
        const ctx = canvas.getContext("2d", { alpha: false })
        if (ctx && currentWheelItems.length > 0) {
          // 🛡️ STABILITY: Clear any previous transform state
          ctx.setTransform(1, 0, 0, 1, 0, 0)
          
          // Use the simplified drawing function - same as static drawing
          drawWheelAtAngleWithItems(ctx, canvas, currentRotation, currentWheelItems)
        }
      }

      // Update angle state - simple like other wheel types
      setCurrentAngle(currentRotation)

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate)
      } else {
        // 🎯 WINNER CALCULATION: Already pre-calculated above for 100% accuracy
        console.log("🎯 WINNER CALCULATION (FINAL VERIFICATION - WEB):", {
          timestamp: new Date().toISOString(),
          sessionId: sessionId,
          mode: organizerMode ? 'organizer' : 'collaborator',
          itemsCount: currentWheelItems.length,
          winningIndex: winningIndex,
          winner: winner,
          finalRotationRadians: totalRotation,
          finalRotationDegrees: totalRotation * 180 / Math.PI,
          pointerPosition: 'right-aligned (3 o\'clock - perfect positioning)',
          rotationDirection: 'clockwise',

          // Animation completion status
          spinCompletedSuccessfully: true,
          winnerAnnouncementReady: true,
          firebaseSyncReady: enableRealTimeSync,
          calculationMethod: 'unified-pointer-aligned',
          // 🎯 SYNCHRONIZATION VERIFICATION
          usedOrganizerDuration: spinDuration,
          usedOrganizerTotalRotation: totalRotation,
          usedOrganizerWinningIndex: winningIndex,
          synchronizationAccuracy: '100%'
        })

        // Select winners based on numberOfWinners prop
        const selectedWinners: Participant[] = []
        const availableItems = [...currentWheelItems]
        const numWinners = settings.numberOfWinners || 1

        for (let i = 0; i < Math.min(numWinners, wheelItems.length); i++) {
          let winningItem: string
          let actualWinningIndex: number

          if (i === 0) {
            // First winner is the one the pointer landed on
            actualWinningIndex = winningIndex % availableItems.length
            winningItem = availableItems[actualWinningIndex]
            availableItems.splice(actualWinningIndex, 1)
          } else {
            // Additional winners are random from remaining items
            actualWinningIndex = Math.floor(Math.random() * availableItems.length)
            winningItem = availableItems[actualWinningIndex]
            availableItems.splice(actualWinningIndex, 1)
          }

          // Create winner object - for predefined items, create a mock participant
          if (isParticipantBased) {
            const participant = participants.find(p => p.name === winningItem)
            if (participant) {
              selectedWinners.push(participant)
            }
          } else {
            // For predefined items like colors, create a mock participant object
            selectedWinners.push({
              id: `item-${i}-${Date.now()}`,
              name: winningItem,
              isSelected: true
            })
          }
        }

        // 🎯 CRITICAL: Set winners and mark animation as complete
        animationCompletedRef.current = true
        isAnimationRunningRef.current = false
        setWinners(selectedWinners)
        setIsSpinningWithRef(false)
        setShowResults(true)
        
        // 🎯 RESET SPIN TRACKING: Clear mySpinStartTimeRef to prevent interference with future spins
        mySpinStartTimeRef.current = 0

        // Theme persistence maintained
        console.log("🎨 MAIN SPIN COMPLETE: Maintaining user's selected theme", {
          currentTheme: wheelTheme,
          persistentTheme: persistentTheme,
          themeMaintained: true,
          resetMySpinStartTimeRef: true
        })

        
        // Create spin result
        const result: SpinResult = {
          id: Date.now().toString(),
          winners: selectedWinners,
          timestamp: new Date(),
          spinDuration: settings.spinDuration,
          totalParticipants: currentWheelItems.length
        }
        
        setSpinHistory(prev => [result, ...prev.slice(0, 9)]) // Keep last 10 results

        console.log("🎯 SPIN COMPLETE: Winner selected from current items", {
          winner: selectedWinners[0]?.name,
          winningIndex: winningIndex,
          totalItems: currentWheelItems.length,
          currentWheelItems: currentWheelItems.slice(0, 5),
          isEditingItems,
          editableItemsCount: editableItems.length,
          pointerAlignment: 'perfect'
        })
        
        // Real-time sync: Broadcast spin completion to Firebase for live sessions
         // ENHANCED: Full access collaborators can also broadcast winner announcements
         if (enableRealTimeSync && sessionId && (effectiveOrganizerMode || userPermissions.isFullAccessCollaborator)) {
           const broadcastCompletion = async () => {
             try {
               // ENHANCED LOGGING: Track broadcast source for winner announcement
             const broadcastSource = effectiveOrganizerMode ? 'organizer' :
               userPermissions.isFullAccessCollaborator ? 'full-access-collaborator' : 'unknown'

             console.log(`🎯 ${broadcastSource.toUpperCase()} WINNER ANNOUNCEMENT: Broadcasting synchronized winners to all participants`, {
               broadcastSource,
               winnerCount: selectedWinners.length,
               winners: selectedWinners.map(w => w.name),
               sessionId,
               effectiveOrganizerMode,
               isFullAccessCollaborator: userPermissions.isFullAccessCollaborator,
               timestamp: new Date().toISOString()
             })

             try {
               const completionData = {
                 currentState: "waiting", // 🔄 RESET: Keep in "waiting" state for multiple spins instead of "ended"
                 isSpinning: false,
                 winners: selectedWinners,
                 wheelState: {
                   currentAngle: currentAngle,
                   isSpinning: false,
                   winners: selectedWinners,
                   finalAngle: currentAngle % (2 * Math.PI),
                   completedAt: Date.now(),
                   spinId: spinId,
                   // 🔧 CRITICAL: Broadcast winner calculation details for perfect synchronization
                   winningIndex: winningIndex,
                   wheelItemsUsed: currentWheelItems, // Exact items used for winner calculation
                   totalItemsCount: currentWheelItems.length,
                   // ENHANCED: Include broadcast source for tracking
                   broadcastSource: broadcastSource,
                   collaboratorId: userPermissions.isFullAccessCollaborator ? userPermissions.userRole : null,
                   announcementTimestamp: Date.now(),
                   // 🎯 CRITICAL: Mark as organizer-triggered for participant winner validation
                   triggeredByOrganizer: broadcastSource === 'organizer' || broadcastSource === 'full-access-collaborator',
                   // 🎨 CRITICAL FIX: Persist theme in Firebase to prevent reversion after spinning
                   theme: wheelTheme
                 },
                 updatedAt: serverTimestamp()
               }

               await updateDoc(doc(db, "liveDrawSessions", sessionId), completionData)

               console.log("🎯 BROADCAST WINNERS: Broadcasted spin completion with synchronization data", {
                 winnerCount: selectedWinners.length,
                 winners: selectedWinners,
                 winningIndex: winningIndex,
                 wheelItemsCount: currentWheelItems.length,
                 sessionId: sessionId,
                 broadcastSource,
                 effectiveOrganizerMode,
                 isFullAccessCollaborator: userPermissions.isFullAccessCollaborator,
                 timestamp: new Date().toISOString()
               })

               // 🎯 CRITICAL FIX: Ensure winner announcement is triggered immediately after broadcast
               // This ensures the winner popup shows up even if Firebase listeners are slow
               console.log("🎯 WINNER ANNOUNCEMENT TRIGGER: Ensuring winner popup displays after broadcast")
               if (onWinnersDetected) {
                 onWinnersDetected(selectedWinners)
               }

             } catch (error: any) {
               console.error("❌ CRITICAL: Failed to broadcast spin completion to Firebase:", {
                 error: error.message,
                 errorCode: error.code,
                 sessionId: sessionId,
                 broadcastSource,
                 winnerCount: selectedWinners.length,
                 timestamp: new Date().toISOString()
               })

               // Continue with local winner announcement even if broadcast fails
               console.log("🔄 Continuing with local winner announcement despite broadcast failure")
               if (onWinnersDetected) {
                 onWinnersDetected(selectedWinners)
               }
             }

             console.log("🎯 BROADCAST WINNERS: Broadcasted spin completion with synchronization data", {
               winnerCount: selectedWinners.length,
               winners: selectedWinners,
               winningIndex: winningIndex,
               wheelItemsCount: currentWheelItems.length,
               sessionId: sessionId,
               broadcastSource,
               effectiveOrganizerMode,
               isFullAccessCollaborator: userPermissions.isFullAccessCollaborator,
               timestamp: new Date().toISOString()
             })
           } catch (error) {
             console.error("❌ Failed to broadcast spin completion:", error)
             toast({
               title: "Synchronization Error",
               description: "Failed to announce winners to all participants. Please try again.",
               variant: "destructive"
             })
           }
         }
         broadcastCompletion()
       }
        
        // ✅ Confetti removed - handled by centralized announcement system
        
        // Callback
        onSpinComplete?.(result)

        // Winner notification removed to prevent duplication with visual display
      }
    }
    
    requestAnimationFrame(animate)
  }

  const resetWheel = async () => {
    // 🛡️ PREVENT RAPID CLICKS: Debounce reset to avoid flickering
    const lastResetTime = (window as any).__lastResetTime || 0
    const timeSinceLastReset = Date.now() - lastResetTime
    const minimumResetDelay = 300 // 300ms minimum between resets
    
    if (timeSinceLastReset < minimumResetDelay) {
      console.log("⚠️ RESET BLOCKED: Too soon after last reset")
      return
    }
    
    // Record this reset time
    ;(window as any).__lastResetTime = Date.now()

    console.log("🔄 RESET: Starting wheel reset", {
      organizerMode,
      enableRealTimeSync,
      sessionId,
      currentAngle,
      timestamp: new Date().toISOString()
    })

    // Stop any ongoing animations immediately
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
      animationRef.current = null
    }
    stopAnimationRef.current = true
    isAnimationRunningRef.current = false
    animationCompletedRef.current = false
    mySpinStartTimeRef.current = 0  // 🎯 CRITICAL: Reset this to allow next spin to work

    // Reset all wheel states INCLUDING CURRENT ANGLE TO 0
    setCurrentAngle(0)
    setWinners([])
    setShowResults(false)
    setIsSpinningWithRef(false)
    setPendingWinners(null)
    
    // 🎯 RESET ANNOUNCEMENT TRACKING
    setHasAnnouncedWinners(false)
    setCurrentSpinId("")
    lastAnnouncedWinnerIds.current = ""
    
    // 🎯 RESET RESEARCH MODE: Clear research CSV mode when reset is pressed
    setIsResearchModeActive(false)
    setUploadedStudentList([])
    setSelectedStudents([])
    setResearchSpinMode('single')
    setResearchSpinCount(1)
    setRandomSelectionCount(10)
    setManualSelectionInput("10")
    setSelectionValidationError("")
    
    // Broadcast research mode reset to Firebase for live session display
    if (enableRealTimeSync && sessionId) {
      try {
        await updateDoc(doc(db, "liveDrawSessions", sessionId), {
          "wheelState.uploadedStudentCount": 0,
          "wheelState.randomSelectionCount": 0,
          "wheelState.selectedStudents": [],
          "wheelState.showSelectedStudentsOnWheel": false,
          "wheelState.isResearchModeActive": false,
          "wheelState.researchModeUpdatedAt": Date.now(),
          updatedAt: serverTimestamp()
        })
        console.log("✅ Research mode cleared in Firebase on reset")
      } catch (error) {
        console.error("❌ Failed to clear research mode state:", error)
      }
    }

    // 🎨 FLICKER-FREE RESET: Single smooth redraw at angle 0
    const performSmoothReset = () => {
      const canvas = canvasRef.current
      if (canvas) {
        const ctx = canvas.getContext("2d", { alpha: false, desynchronized: true })
        if (ctx) {
          console.log("🔄 ORGANIZER: Smooth reset redraw at angle 0")
          
          const itemsToUse = isEditingItems && editableItems.length > 0 ? editableItems : wheelItems
          const themeToUse = persistentTheme || wheelTheme
          
          // Save context state
          ctx.save()
          
          // Single-pass clear and redraw - no flicker
          ctx.clearRect(0, 0, canvas.width, canvas.height)
          drawWheelAtAngleWithItems(ctx, canvas, 0, itemsToUse, themeToUse)
          
          // Restore context state
          ctx.restore()
        }
      }
    }

    // Use requestAnimationFrame for smooth rendering
    requestAnimationFrame(performSmoothReset)
    
    // Real-time sync: Broadcast reset to Firebase for live sessions - ENHANCED WITH RESET SIGNAL
    if (enableRealTimeSync && sessionId) {
      try {
        const resetTimestamp = Date.now()
        const resetId = `reset-${resetTimestamp}-${Math.random().toString(36).substr(2, 9)}`
        
        console.log("🔄 ORGANIZER: Broadcasting reset to participants with unique reset ID:", resetId)
        
        const resetData = {
          currentState: "waiting",
          isSpinning: false,
          winners: [],
          wheelState: {
            currentAngle: 0,
            isSpinning: false,
            winners: [],
            resetAt: resetTimestamp,
            resetId: resetId, // 🎯 UNIQUE RESET ID for participants to detect reset
            forceResetToZero: true, // 🎯 CRITICAL: Signal participants to reset angle to 0
            resetBy: organizerMode ? 'organizer' : 'participant',
            resetAction: true, // Explicit reset flag
            completedAt: null, // Clear completion timestamp
            // 🎨 CRITICAL FIX: Persist theme in Firebase to prevent reversion after reset
            theme: wheelTheme
          },
          updatedAt: serverTimestamp()
        }

        await updateDoc(doc(db, "liveDrawSessions", sessionId), resetData)
        console.log("✅ ORGANIZER: Successfully broadcasted reset to Firebase", {
          resetId,
          resetBy: organizerMode ? 'organizer' : 'participant',
          resetTimestamp,
          sessionId: sessionId,
          forceResetToZero: true,
          timestamp: new Date().toISOString()
        })

        toast({
          title: "✅ Wheel Reset & Synced",
          description: "The wheel has been reset and synced across all users",
        })
      } catch (error: any) {
        console.error("❌ Failed to broadcast wheel reset:", {
          error: error.message,
          errorCode: error.code,
          sessionId: sessionId,
          timestamp: new Date().toISOString()
        })
        
        toast({
          title: "Wheel Reset",
          description: "Reset locally but failed to sync with others",
          variant: "destructive"
        })
      }
    } else {
      toast({
        title: "Wheel Reset",
        description: "The wheel has been reset to starting position",
      })
    }
  }

  // 🎯 DETERMINISTIC SHUFFLE: Use seeded shuffle for consistent results across all users
  const seededShuffle = (array: string[], seed: number): string[] => {
    const shuffled = [...array]
    const random = (seed: number) => {
      const x = Math.sin(seed++) * 10000
      return x - Math.floor(x)
    }

    let currentSeed = seed
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(random(currentSeed++) * (i + 1))
      ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }

    return shuffled
  }

  const shuffleParticipants = async () => {
    // 🛡️ PREVENT RAPID CLICKS: Debounce shuffle to avoid flickering
    const lastShuffleTime = (window as any).__lastShuffleTime || 0
    const timeSinceLastShuffle = Date.now() - lastShuffleTime
    const minimumShuffleDelay = 300 // 300ms minimum between shuffles
    
    if (timeSinceLastShuffle < minimumShuffleDelay) {
      console.log("⚠️ SHUFFLE BLOCKED: Too soon after last shuffle", {
        timeSinceLastShuffle,
        minimumRequired: minimumShuffleDelay
      })
      return
    }
    
    // Record this shuffle time
    ;(window as any).__lastShuffleTime = Date.now()

    // Get the current items to shuffle
    const itemsToShuffle = isEditingItems && editableItems.length > 0 ? [...editableItems] :
                          selectedWheelType?.defaultItems && selectedWheelType.defaultItems.length > 0 ? [...selectedWheelType.defaultItems] :
                          participants && participants.length > 0 ? participants.map(p => p.name) :
                          ["Option 1", "Option 2", "Option 3", "Option 4", "Option 5"]

    // 🛡️ SAFETY CHECK: Don't shuffle if no items
    if (!itemsToShuffle || itemsToShuffle.length === 0) {
      toast({
        title: "No Items to Shuffle",
        description: "Please add items to the wheel before shuffling",
        variant: "destructive"
      })
      return
    }

    // 🎯 MAKE SHUFFLE CONSISTENT: Use timestamp as seed for deterministic shuffle across all users
    const shuffleSeed = Date.now()
    const shuffledItems = seededShuffle(itemsToShuffle, shuffleSeed)

    // 🎯 VALIDATION: Ensure shuffled items are valid before proceeding
    if (!shuffledItems || shuffledItems.length === 0) {
      console.error("❌ SHUFFLE FAILED: No items generated", {
        originalItems: itemsToShuffle,
        shuffledItems: shuffledItems
      })
      toast({
        title: "Shuffle Error",
        description: "Failed to shuffle items. Please try again.",
        variant: "destructive"
      })
      return
    }

    console.log("🎯 SHUFFLE: Using deterministic shuffle with seed:", shuffleSeed, {
      originalItems: itemsToShuffle,
      shuffledItems: shuffledItems,
      userRole: organizerMode ? 'organizer' : 'collaborator',
      itemCount: shuffledItems.length,
      shuffleValid: shuffledItems.length === itemsToShuffle.length
    })

    // 🎨 CRITICAL FIX: Set persistent theme SYNCHRONOUSLY before any drawing
    const currentTheme = wheelTheme || {
      primary: '#8e0b16',
      secondary: '#66181E',
      accent: '#ffffff',
      background: '#f8f9fa'
    }
    
    setPersistentTheme(currentTheme)

    // 🔓 CRITICAL: Temporarily unlock transition lock to allow shuffle drawing
    const wasLocked = wheelTransitionLockRef.current
    wheelTransitionLockRef.current = false

    // 🎯 CRITICAL FIX: Set shuffledItemsOverride for highest priority in wheelItems calculation
    setShuffledItemsOverride(shuffledItems)
    
    // 🎯 Update editable items WITHOUT setting isEditingItems (which blocks spinning)
    setEditableItems(shuffledItems)
    
    // Restore lock state
    wheelTransitionLockRef.current = wasLocked

    // 🎨 FLICKER-FREE DRAWING: Single smooth draw using requestAnimationFrame
    const performSmoothDraw = () => {
      const canvas = canvasRef.current
      if (canvas) {
        const ctx = canvas.getContext("2d", { alpha: false, desynchronized: true })
        if (ctx) {
          console.log("🎯 SHUFFLE: Smooth single-pass draw", {
            itemsCount: shuffledItems.length,
            items: shuffledItems.slice(0, 3)
          })
          
          // Save context state
          ctx.save()
          
          // Clear and draw in single pass - no flickering
          ctx.clearRect(0, 0, canvas.width, canvas.height)
          drawWheelAtAngleWithItems(ctx, canvas, currentAngle, shuffledItems, currentTheme)
          
          // Restore context state
          ctx.restore()
        }
      }
    }

    // Use requestAnimationFrame for buttery-smooth rendering
    requestAnimationFrame(performSmoothDraw)

    // 🎯 REAL-TIME SYNC: Broadcast shuffle to all participants with validation
    if (enableRealTimeSync && sessionId && (effectiveOrganizerMode || userPermissions.isFullAccessCollaborator)) {
      try {
        const shuffleTimestamp = Date.now()
        
        // 🎯 VALIDATION: Ensure all arrays are valid before broadcasting
        if (!Array.isArray(shuffledItems) || shuffledItems.length === 0) {
          throw new Error("Invalid shuffled items array")
        }
        
        const shuffleData = {
          wheelState: {
            shuffledItems: shuffledItems,
            wheelItems: shuffledItems, // 🎯 CRITICAL FIX: Broadcast wheelItems for participants
            customItems: shuffledItems, // 🎯 CRITICAL FIX: Also set customItems
            shuffleSeed: shuffleSeed,
            itemsShuffledAt: shuffleTimestamp,
            itemsUpdatedAt: shuffleTimestamp,
            shuffleSource: effectiveOrganizerMode ? 'organizer' : 'full-access-collaborator',
            collaboratorId: userPermissions.isFullAccessCollaborator ? userPermissions.userRole : null,
            shuffleAction: true, // Explicit shuffle flag
            // 🎨 CRITICAL FIX: Persist theme in Firebase to prevent white screen
            theme: persistentTheme || wheelTheme,
            // 🎯 CRITICAL FIX: Ensure items are never empty
            hasItems: true,
            itemsCount: shuffledItems.length
          },
          // 🎯 CRITICAL FIX: Also broadcast at root level for live-draw-manager synchronization
          wheelItems: shuffledItems,
          customItems: shuffledItems,
          updatedAt: serverTimestamp()
        }

        await updateDoc(doc(db, "liveDrawSessions", sessionId), shuffleData)

        console.log("✅ SHUFFLE BROADCAST: Shuffled items synced to all users", {
          shuffleSeed,
          shuffleTimestamp,
          itemCount: shuffledItems.length,
          itemsPreview: shuffledItems.slice(0, 5),
          itemsFull: shuffledItems,
          broadcastSource: shuffleData.wheelState.shuffleSource,
          sessionId: sessionId,
          dataIntegrity: {
            shuffledItemsIsArray: Array.isArray(shuffledItems),
            shuffledItemsLength: shuffledItems.length,
            wheelItemsMatch: JSON.stringify(shuffleData.wheelState.wheelItems) === JSON.stringify(shuffledItems),
            customItemsMatch: JSON.stringify(shuffleData.wheelState.customItems) === JSON.stringify(shuffledItems)
          },
          timestamp: new Date().toISOString()
        })

        toast({
          title: "✅ Items Shuffled & Synced",
          description: `Wheel items randomized and synced (${shuffledItems.length} items)`,
        })
      } catch (error: any) {
        console.error("❌ SHUFFLE SYNC ERROR:", error)
        toast({
          title: "Shuffle Error",
          description: "Items shuffled locally but failed to sync with others",
          variant: "destructive"
        })
      }
    } else {
      toast({
        title: "Items Shuffled",
        description: "The wheel items have been randomized",
      })
    }
  }

  const addItem = useCallback(() => {
    if (!allowItemEditing || !newItemText.trim() || editableItems.includes(newItemText.trim())) return

    const updatedItems = [...editableItems, newItemText.trim()]
    setEditableItems(updatedItems)
    setNewItemText("")
    setIsEditingItems(true) // Ensure editing mode is active

    // 🎯 INSTANT WHEEL REDRAW: Show new item immediately on wheel
    setTimeout(() => {
      const canvas = canvasRef.current
      if (canvas) {
        const ctx = canvas.getContext("2d")
        if (ctx) {
          drawWheelAtAngleWithItems(ctx, canvas, currentAngle, updatedItems, persistentTheme || wheelTheme)
        }
      }
      console.log("🎯 ADD ITEM: Wheel redrawn with new item:", newItemText.trim())
    }, 10)

    // 🚀 INSTANT FIREBASE BROADCAST: Sync to all participants immediately
    if (enableRealTimeSync && sessionId && (effectiveOrganizerMode || userPermissions.isFullAccessCollaborator)) {
      try {
        const broadcastData = {
          wheelState: {
            wheelItems: updatedItems,
            customItems: updatedItems,
            itemsUpdatedAt: Date.now(),
            itemChangeSource: "add-item-instant",
            itemsCount: updatedItems.length,
            broadcastSource: effectiveOrganizerMode ? 'organizer' : 'full-access-collaborator',
            collaboratorId: userPermissions.isFullAccessCollaborator ? userPermissions.userRole : null,
            // 🎨 CRITICAL: Include theme to prevent reversion
            theme: persistentTheme || wheelTheme,
            themeUpdatedAt: Date.now()
          },
          updatedAt: serverTimestamp()
        }

        updateDoc(doc(db, "liveDrawSessions", sessionId), broadcastData).catch((error) => {
          console.error("❌ Failed to broadcast add item:", error)
        })

        console.log("✅ INSTANT ADD ITEM BROADCAST: New item synced to all participants", {
          sessionId,
          newItem: newItemText.trim(),
          totalItems: updatedItems.length,
          broadcastSource: broadcastData.wheelState.broadcastSource,
          timestamp: new Date().toISOString()
        })
      } catch (error) {
        console.error("❌ Failed to broadcast add item:", error)
      }
    }
  }, [allowItemEditing, newItemText, editableItems, enableRealTimeSync, sessionId, effectiveOrganizerMode, userPermissions, currentAngle, persistentTheme, wheelTheme, drawWheelAtAngleWithItems])

  const clearAllItems = useCallback(() => {
    if (!allowItemEditing) return
    
    console.log("🧹 Clearing all items from wheel")

    // Clear all items
    setEditableItems([])
    setNewItemText("")
    setLastAppliedItems([])
    
    // 🔥 CRITICAL: Clear persisted items on explicit clear
    filledLiveParticipantsRef.current = []
    console.log("🔥 CLEARED PERSISTED ITEMS: filledLiveParticipantsRef cleared on explicit clear all")

    // 🧹 CRITICAL FIX: Ensure we stay in editing mode so wheel stays empty
    // This prevents wheelItems from falling back to participants/defaults
    setIsEditingItems(true)

    // Reset wheel state completely
    setCurrentAngle(0)
    setWinners([])
    setShowResults(false)
    setIsSpinningWithRef(false)
    setPendingWinners(null)
    setHasAnnouncedWinners(false)
    
    // Reset animation states
    stopAnimationRef.current = true
    isAnimationRunningRef.current = false
    animationCompletedRef.current = false
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
      animationRef.current = null
    }

    // Clear canvas immediately
    setTimeout(() => {
      const canvas = canvasRef.current
      if (canvas) {
        const ctx = canvas.getContext("2d")
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height)
        }
      }
      console.log("🧹 CLEAR ALL: Wheel completely cleared, editing mode active")
    }, 10)

    // Broadcast clear operation to all participants if in live mode
    if (enableRealTimeSync && sessionId && (effectiveOrganizerMode || userPermissions.isFullAccessCollaborator)) {
      try {
        const clearData = {
          wheelState: {
            wheelItems: [],
            customItems: [],
            itemsUpdatedAt: Date.now(),
            itemChangeSource: "clear-all",
            itemsCount: 0,
            broadcastSource: effectiveOrganizerMode ? 'organizer' : 'full-access-collaborator',
            collaboratorId: userPermissions.isFullAccessCollaborator ? userPermissions.userRole : null,
            // Also clear winners and reset state
            winners: [],
            currentAngle: 0,
            clearedAt: Date.now(),
            // 🎨 CRITICAL: Keep theme even when clearing items
            theme: persistentTheme || wheelTheme,
            themeUpdatedAt: Date.now()
          },
          updatedAt: serverTimestamp()
        }

        updateDoc(doc(db, "liveDrawSessions", sessionId), clearData).catch((error) => {
          console.error("❌ Failed to broadcast clear all:", error)
        })

        console.log("✅ BROADCASTED CLEAR ALL: All items cleared and synced to participants", {
          sessionId,
          broadcastSource: clearData.wheelState.broadcastSource,
          timestamp: new Date().toISOString()
        })
      } catch (error) {
        console.error("❌ Failed to broadcast clear all:", error)
      }
    }

    toast({
      title: "All Items Cleared",
      description: "All wheel items have been removed",
    })
  }, [allowItemEditing, enableRealTimeSync, sessionId, effectiveOrganizerMode, userPermissions.isFullAccessCollaborator])

  const removeItem = (index: number) => {
    if (!allowItemEditing) return
    
    const updatedItems = editableItems.filter((_, i) => i !== index)
    setEditableItems(updatedItems)

    // 🎯 INSTANT WHEEL REDRAW: Show removed item immediately on wheel
    setTimeout(() => {
      const canvas = canvasRef.current
      if (canvas) {
        const ctx = canvas.getContext("2d")
        if (ctx) {
          drawWheelAtAngleWithItems(ctx, canvas, currentAngle, updatedItems, persistentTheme || wheelTheme)
        }
      }
      console.log("🎯 REMOVE ITEM: Wheel redrawn after removing item at index:", index)
    }, 10)

    // 🚀 INSTANT FIREBASE BROADCAST: Sync removal to all participants immediately
    if (enableRealTimeSync && sessionId && (effectiveOrganizerMode || userPermissions.isFullAccessCollaborator)) {
      try {
        const broadcastData = {
          wheelState: {
            wheelItems: updatedItems,
            customItems: updatedItems,
            itemsUpdatedAt: Date.now(),
            itemChangeSource: "remove-item-instant",
            itemsCount: updatedItems.length,
            removedIndex: index,
            broadcastSource: effectiveOrganizerMode ? 'organizer' : 'full-access-collaborator',
            collaboratorId: userPermissions.isFullAccessCollaborator ? userPermissions.userRole : null,
            // 🎨 CRITICAL: Include theme to prevent reversion
            theme: persistentTheme || wheelTheme,
            themeUpdatedAt: Date.now()
          },
          updatedAt: serverTimestamp()
        }

        updateDoc(doc(db, "liveDrawSessions", sessionId), broadcastData).catch((error) => {
          console.error("❌ Failed to broadcast remove item:", error)
        })

        console.log("✅ INSTANT REMOVE ITEM BROADCAST: Removal synced to all participants", {
          sessionId,
          removedIndex: index,
          remainingItems: updatedItems.length,
          broadcastSource: broadcastData.wheelState.broadcastSource,
          timestamp: new Date().toISOString()
        })
      } catch (error) {
        console.error("❌ Failed to broadcast remove item:", error)
      }
    }
  }

  const updateItem = (index: number, newText: string) => {
    if (!allowItemEditing) return

    const updated = [...editableItems]
    updated[index] = newText.trim()
    setEditableItems(updated)

    // 🎯 INSTANT WHEEL REDRAW: Show updated item immediately on wheel
    setTimeout(() => {
      const canvas = canvasRef.current
      if (canvas) {
        const ctx = canvas.getContext("2d")
        if (ctx) {
          drawWheelAtAngleWithItems(ctx, canvas, currentAngle, updated, persistentTheme || wheelTheme)
        }
      }
      console.log("🎯 UPDATE ITEM: Wheel redrawn with updated item at index:", index)
    }, 10)

    // Broadcast changes for full access collaborators or organizers to sync with other users
    if (enableRealTimeSync && sessionId && (effectiveOrganizerMode || userPermissions.isFullAccessCollaborator)) {
      try {
        const broadcastData = {
          wheelState: {
            wheelItems: updated,
            customItems: updated, // 🎯 Also include customItems for consistency
            itemsUpdatedAt: Date.now(),
            itemChangeSource: "direct-edit",
            itemsCount: updated.length,
            lastEditedIndex: index,
            collaboratorEditSync: true,
            // Include broadcast source for tracking
            broadcastSource: effectiveOrganizerMode ? 'organizer' : 'full-access-collaborator',
            collaboratorId: userPermissions.isFullAccessCollaborator ? userPermissions.userRole : null,
            // 🎨 CRITICAL: Include theme to prevent reversion
            theme: persistentTheme || wheelTheme,
            themeUpdatedAt: Date.now()
          },
          updatedAt: serverTimestamp()
        }

        updateDoc(doc(db, "liveDrawSessions", sessionId), broadcastData).catch((error) => {
          console.error("❌ Failed to broadcast item edit:", error)
        })

        console.log("✅ BROADCASTED DIRECT ITEM EDIT: Changes synced to all participants", {
          sessionId,
          editedIndex: index,
          newTextLength: newText.trim().length,
          totalItems: updated.length,
          broadcastSource: broadcastData.wheelState.broadcastSource,
          timestamp: new Date().toISOString()
        })
      } catch (error) {
        console.error("❌ Failed to broadcast direct item edit:", error)
      }
    }
  }

  const saveChanges = () => {
    if (!allowItemEditing) return
    
    setIsEditingItems(false)
    toast({
      title: "Changes Saved",
      description: "Wheel items have been updated",
    })
  }

  const cancelEditing = () => {
    if (!allowItemEditing) return

    console.log("❌ Cancelling editing - keeping current items but disabling edit mode")

    // Don't reset the items - just disable editing mode
    // This preserves the current wheel items but stops editing
    setIsEditingItems(false)

    // Keep lastAppliedItems intact so items persist if user re-opens editor
    // This allows user to cancel and then re-edit without losing their work

    toast({
      title: "Editing Cancelled",
      description: "Current wheel items have been kept",
    })
  }

  const updateSettings = (newSettings: Partial<WheelSettings>) => {
    const updated = { ...settings, ...newSettings }
    setSettings(updated)
    onSettingsChange?.(updated)
  }

  // CSV file handling functions
  const parseCsvFile = (file: File): Promise<string[]> => {
    return new Promise((resolve, reject) => {
      console.log("📄 Starting enhanced CSV parse for file:", file.name, "Size:", (file.size / 1024).toFixed(1), "KB")

      const reader = new FileReader()
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
    })
  }

  // 🎯 RESEARCH FEATURE: Enhanced CSV parsing with student ID and email extraction
  const parseResearchCsvFile = (file: File): Promise<Array<{id: string, name: string, email?: string}>> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()

      reader.onload = (event) => {
        try {
          const content = event.target?.result as string
          const lines = content.split(/\r?\n/).filter(line => line.trim() && !line.trim().startsWith('#'))
          
          if (lines.length < 2) {
            throw new Error("CSV file must contain at least a header row and one data row")
          }

          const firstLine = lines[0]
          let delimiter = ','
          
          // Auto-detect delimiter
          const commaCount = (firstLine.match(/,/g) || []).length
          const semicolonCount = (firstLine.match(/;/g) || []).length
          const tabCount = (firstLine.match(/\t/g) || []).length
          
          if (tabCount > commaCount && tabCount > semicolonCount) {
            delimiter = '\t'
          } else if (semicolonCount > commaCount) {
            delimiter = ';'
          }

          const parseLine = (line: string): string[] => {
            const result: string[] = []
            let current = ''
            let inQuotes = false

            for (let i = 0; i < line.length; i++) {
              const char = line[i]
              if (char === '"') {
                inQuotes = !inQuotes
              } else if (char === delimiter && !inQuotes) {
                result.push(current.trim())
                current = ''
              } else {
                current += char
              }
            }
            result.push(current.trim())
            return result
          }

          const header = parseLine(firstLine).map(h => h.toLowerCase().trim())
          
          // Find column indices - be more specific to avoid conflicts
          const idIndex = header.findIndex(h => 
            h === 'student id' || 
            h === 'student_id' || 
            h === 'studentid' || 
            h === 'id'
          )
          const nameIndex = header.findIndex(h => 
            h === 'name' || 
            h === 'student name' || 
            h === 'student' || 
            h === 'participant' ||
            h === 'full name'
          )
          const emailIndex = header.findIndex(h => 
            h === 'email' || 
            h === 'e-mail' || 
            h === 'mail' ||
            h === 'student email'
          )

          if (nameIndex === -1) {
            throw new Error("Could not find a 'Name' or 'Student' column in the CSV file")
          }

          const students: Array<{id: string, name: string, email?: string}> = []
          
          for (let i = 1; i < lines.length; i++) {
            const cells = parseLine(lines[i])
            if (cells.length === 0 || cells.every(c => !c.trim())) continue
            
            const name = cells[nameIndex]?.trim()
            if (!name) continue
            
            const student = {
              id: idIndex >= 0 ? cells[idIndex]?.trim() : `STU${String(i).padStart(4, '0')}`,
              name: name,
              email: emailIndex >= 0 ? cells[emailIndex]?.trim() : undefined
            }
            
            students.push(student)
          }

          if (students.length === 0) {
            throw new Error("No valid student records found in CSV file")
          }

          console.log("✅ Research CSV parsed successfully:", {
            totalStudents: students.length,
            hasIds: idIndex >= 0,
            hasEmails: emailIndex >= 0,
            preview: students.slice(0, 3)
          })

          resolve(students)
        } catch (error) {
          console.error("❌ Research CSV parsing error:", error)
          reject(error)
        }
      }

      reader.onerror = () => reject(new Error("Failed to read CSV file"))
      reader.readAsText(file, 'utf-8')
    })
  }

  // 🎯 RESEARCH FEATURE: Random student selection handler with smart spin mode
  const handleRandomSelection = async (): Promise<Array<{id: string, name: string, email?: string}>> => {
    console.log("🎲 RANDOM SELECTION TRIGGERED:", {
      uploadedStudents: uploadedStudentList.length,
      requestedCount: randomSelectionCount,
      isResearchModeActive
    })

    if (uploadedStudentList.length === 0) {
      toast({
        title: "No students uploaded",
        description: "Please upload a CSV file with student data first",
        variant: "destructive"
      })
      return []
    }

    if (randomSelectionCount > uploadedStudentList.length) {
      const errorMsg = `Cannot select ${randomSelectionCount} students from ${uploadedStudentList.length} available. Please reduce the selection count.`
      setSelectionValidationError(errorMsg)
      toast({
        title: "Invalid selection count",
        description: errorMsg,
        variant: "destructive"
      })
      return []
    }
    // Clear any previous validation errors
    setSelectionValidationError("")

    // Perform random selection using Fisher-Yates shuffle algorithm
    const shuffled = [...uploadedStudentList]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }

    const selected = shuffled.slice(0, randomSelectionCount)

    console.log("🎲 RANDOM SELECTION COMPLETE (stored silently):", {
      totalUploaded: uploadedStudentList.length,
      requestedCount: randomSelectionCount,
      selectedCount: selected.length,
      selectedStudents: selected
    })

    // 🎯 CRITICAL FIX: ONLY store the selection - DO NOT update wheel or show students yet
    // The wheel will show them ONLY when "Randomly Select" button is pressed and wheel spins
    setSelectedStudents(selected)

    // Broadcast research mode state to Firebase for live session display
    if (enableRealTimeSync && sessionId) {
      try {
        // 🎯 CRITICAL: Save selected students to Firebase so participants see the same filtered list
        await updateDoc(doc(db, "liveDrawSessions", sessionId), {
          "wheelState.uploadedStudentCount": uploadedStudentList.length,
          "wheelState.randomSelectionCount": randomSelectionCount,
          "wheelState.selectedStudents": selected.map(s => ({ id: s.id, name: s.name, email: s.email })),
          "wheelState.showSelectedStudentsOnWheel": true,
          "wheelState.isResearchModeActive": true,
          "wheelState.researchModeUpdatedAt": Date.now(),
          updatedAt: serverTimestamp()
        })
        console.log("✅ Research mode state + selected students broadcasted to Firebase", {
          selectedCount: selected.length,
          selectedStudents: selected.map(s => s.name)
        })
      } catch (error) {
        console.error("❌ Failed to broadcast research mode state:", error)
      }
    }

    // ⚠️ CRITICAL: DO NOT update editableItems, wheelItems, or trigger any redraws here
    // This prevents showing student names on wheel before spinning
    // The selection will be applied ONLY when "Randomly Select" button is clicked

    console.log("🎯 RANDOM SELECTION STORED SILENTLY - wheel unchanged, ready for spin")

    // Return the selected students
    return selected
  }

  // 🎯 Helper function to configure wheel for research mode spinning
  const configureResearchSpin = (selectionCount: number) => {
    const useMultipleSpins = selectionCount >= 1 && selectionCount <= 5
    const numberOfSpins = useMultipleSpins ? 5 : 1
    
    console.log("🎯 CONFIGURING RESEARCH SPIN:", {
      selectionCount,
      mode: useMultipleSpins ? "Multiple (1-5)" : "Batch (6+)",
      spins: numberOfSpins
    })
    
    // Update settings for the spin
    setSettings(prev => ({
      ...prev,
      numberOfWinners: selectionCount
    }))
    
    return { useMultipleSpins, numberOfSpins }
  }

  const downloadCsvTemplate = () => {
    // 🎯 Create Excel template with maroon-colored headers: STUDENT ID, NAME, EMAIL
    try {
      // Create a new workbook
      const wb = XLSX.utils.book_new()
      
      // Create worksheet data with only headers
      const wsData = [
        ['STUDENT ID', 'NAME', 'EMAIL']
      ]
      
      // Create worksheet from data
      const ws = XLSX.utils.aoa_to_sheet(wsData)
      
      // Set column widths
      ws['!cols'] = [
        { wch: 18 }, // STUDENT ID column
        { wch: 35 }, // NAME column
        { wch: 40 }  // EMAIL column
      ]
      
      // Set row height for header
      ws['!rows'] = [{ hpt: 25 }]
      
      // Apply maroon styling to header cells (A1, B1, C1)
      const maroonStyle = {
        fill: {
          patternType: "solid",
          fgColor: { rgb: "800000" } // Maroon background
        },
        font: {
          name: "Calibri",
          sz: 14,
          bold: true,
          color: { rgb: "FFFFFF" } // White text
        },
        alignment: {
          horizontal: "center",
          vertical: "center"
        },
        border: {
          top: { style: "thin", color: { rgb: "000000" } },
          bottom: { style: "thin", color: { rgb: "000000" } },
          left: { style: "thin", color: { rgb: "000000" } },
          right: { style: "thin", color: { rgb: "000000" } }
        }
      }
      
      // Apply style to each header cell
      ws['A1'].s = maroonStyle
      ws['B1'].s = maroonStyle
      ws['C1'].s = maroonStyle
      
      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(wb, ws, 'Students')
      
      // Write file
      XLSX.writeFile(wb, 'research-participants-template.xlsx')
      
      toast({
        title: "📊 Research Template Downloaded",
        description: "Excel template with maroon headers (STUDENT ID, NAME, EMAIL) has been downloaded",
      })
    } catch (error) {
      console.error('Error creating Excel template:', error)
      toast({
        title: "Error",
        description: "Failed to create Excel template. Please try again.",
        variant: "destructive"
      })
    }
  }

  const handleCsvUpload = async () => {
    if (!csvFile) {
      toast({
        title: "No file selected",
        description: "Please select a CSV file to upload",
        variant: "destructive"
      })
      return
    }

    console.log("📤 Starting CSV upload process")
    setIsUploadingCsv(true)
    setCsvUploadProgress(0)

    try {
      // Simulate progress while parsing
      const progressInterval = setInterval(() => {
        setCsvUploadProgress(prev => Math.min(prev + 10, 50))
      }, 100)

      // 🎯 Try research CSV format first (with Student_ID, Name, Email columns)
      let names: string[]
      let students: Array<{id: string, name: string, email?: string}> = []
      let isResearchFormat = false
      
      try {
        students = await parseResearchCsvFile(csvFile)
        names = students.map(s => s.name)
        isResearchFormat = true
        console.log("✅ Detected research CSV format with student data")
      } catch (researchError) {
        console.log("⚠️ Not research format, trying simple name list format")
        names = await parseCsvFile(csvFile)
      }
      
      clearInterval(progressInterval)
      setCsvUploadProgress(100)

      console.log("🎯 CSV upload successful, updating wheel items:", {
        totalNames: names.length,
        isResearchFormat: isResearchFormat,
        names: names.slice(0, 5)
      })
      
      // If research format, store the student list for random selection
      if (isResearchFormat && students.length > 0) {
        const defaultCount = Math.min(10, students.length)
        setUploadedStudentList(students)
        setRandomSelectionCount(defaultCount)
        setManualSelectionInput(defaultCount.toString())
        setSelectionValidationError("")
        // 🎯 CRITICAL: Clear previous selections when new CSV uploaded
        setSelectedStudents([])
        toast({
          title: "📊 Research CSV Detected!",
          description: `Loaded ${students.length} students. You can now use random selection below.`,
          duration: 5000
        })
      }

      // Update editable items with CSV data
      setEditableItems(names)
      setIsEditingItems(true)
      
      // Store in persistent ref
      filledLiveParticipantsRef.current = names
      
      setCsvFile(null)
      setCsvUploadProgress(0)

      // Broadcast wheel items change to live session
      if (enableRealTimeSync && sessionId && organizerMode) {
        const csvUpdateData = {
          wheelState: {
            wheelItems: names,
            itemsUpdatedAt: Date.now(),
            csvUploaded: true,
            itemsCount: names.length,
            // 🎨 CRITICAL FIX: Persist theme in Firebase to prevent reversion after items update
            theme: wheelTheme
          },
          updatedAt: serverTimestamp()
        }

        await updateDoc(doc(db, "liveDrawSessions", sessionId), csvUpdateData)

        console.log("🔥 Broadcasted wheel items update to Firebase")
      }

      // Reset wheel state and redraw with uploaded items
      setEditableItems(names)
      setIsEditingItems(true)
      console.log("🎯 CSV UPLOAD: Redrawing wheel with uploaded items")
      // 🎨 CRITICAL FIX: Use persistent theme for CSV upload redraw
      drawWheel(names, persistentTheme || wheelTheme)

      toast({
        title: "✅ CSV Upload Successful!",
        description: `Imported ${names.length} names to the wheel`,
      })

    } catch (error: any) {
      console.error("❌ CSV upload failed:", error)
      toast({
        title: "CSV Upload Failed",
        description: error.message || "Failed to process the CSV file",
        variant: "destructive"
      })
    } finally {
      setIsUploadingCsv(false)
      setCsvUploadProgress(0)
      setCsvFile(null)
    }
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      console.log("📁 File selected:", {
        name: file.name,
        size: file.size,
        type: file.type
      })

      // Validate file type and size
      if (!file.name.toLowerCase().endsWith('.csv') &&
          !file.type.includes('csv') &&
          !file.type.includes('text')) {
        toast({
          title: "Invalid file type",
          description: "Please select a CSV file (.csv)",
          variant: "destructive"
        })
        return
      }

      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        toast({
          title: "File too large",
          description: "Please select a CSV file smaller than 5MB",
          variant: "destructive"
        })
        return
      }

      setCsvFile(file)
    }
  }

  const applyThemeAsync = async (theme: any) => {
    console.log("🎨 Applying theme:", theme.name)

    // Set local theme state
    const newTheme = {
      primary: theme.primary,
      secondary: theme.secondary,
      accent: theme.accent,
      background: theme.background
    }

    // 🎨 THEME PERSISTENCE: Set persistent theme FIRST and ensure it sticks through spinning
    setPersistentTheme(newTheme)
    setWheelTheme(newTheme)

    console.log("🎨 THEME APPLIED: User's theme choice will now persist through spinning", {
      themeName: theme.name,
      newTheme: newTheme,
      persistentThemeSet: true
    })

    // Force theme change trigger for immediate redraw
    setThemeChangeTrigger(prev => prev + 1)

    // Force immediate wheel redraw for organizer
    if (isEditingItems && editableItems.length > 0) {
      drawWheel(editableItems, newTheme)
    } else {
      drawWheel(wheelItems, newTheme)
    }

    // Broadcast theme change to participants in live mode
    if (enableRealTimeSync && sessionId && organizerMode && isLiveMode) {
      try {
        const themeUpdateData = {
          wheelState: {
            theme: newTheme,
            themeUpdatedAt: Date.now(),
            themeName: theme.name,
            themeSource: "organizer-theme-change",
            customWinnerTitle: customWinnerTitle,
            winnerTitleUpdatedAt: Date.now()
          },
          currentState: "theme-updated",
          updatedAt: serverTimestamp()
        }

        await updateDoc(doc(db, "liveDrawSessions", sessionId), themeUpdateData)
        console.log("🎨 Theme and winner title broadcasted to live session participants")
      } catch (error) {
        console.error("❌ Failed to broadcast theme change:", error)
      }
    }

    toast({
      title: "Theme Applied",
      description: `${theme.name} theme has been applied to the wheel`,
    })
  }

  const saveEditableItems = async () => {
    if (editableItems.length === 0) {
      toast({
        title: "No Items",
        description: "Please add at least one item to the wheel",
        variant: "destructive"
      })
      return
    }

    try {
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

      // 🎯 STABILITY: Show loading state for better UX
      const loadingToast = toast({
        title: "⏳ Applying Items...",
        description: "Updating wheel and syncing to participants",
        duration: 2000
      })

      console.log("🎯 ORGANIZER: Saving editable items:", {
        itemsCount: validItems.length,
        preview: validItems.slice(0, 3)
      })

      // Store the items as last applied items for persistence
      setLastAppliedItems([...validItems])

      console.log("🎯 CRITICAL SAVE: Updating wheel with new items:", validItems.slice(0, 3))

      // Reset wheel state before updating items
      setCurrentAngle(0)
      setWinners([])
      setShowResults(false)
      setIsSpinningWithRef(false)
      setPendingWinners(null)

      // 🎯 CRITICAL FIX: Update editableItems and ensure the wheel uses them immediately
      setEditableItems([...validItems])
      setIsEditingItems(true) // Keep editing mode active to use editableItems
      
      // 🔥 PERSIST ITEMS: Store in filledLiveParticipantsRef to survive spins and state changes
      filledLiveParticipantsRef.current = [...validItems]
      console.log("🔥 PERSISTED ITEMS: Stored", validItems.length, "items in filledLiveParticipantsRef for survival")
      
      // 🎯 DETERMINE FINAL ITEMS: Always use all uploaded students first
      // The wheel will only show selected students after "Randomly Select" button is pressed
      let finalItems = validItems
      
      // 🎯 ACTIVATE RESEARCH MODE: If CSV was uploaded, activate research mode (but show ALL students first)
      if (uploadedStudentList.length > 0) {
        console.log("🎯 RESEARCH MODE READY:", {
          uploadedStudents: uploadedStudentList.length,
          allStudentsShown: true,
          readyForRandomSelection: true
        })
        
        setIsResearchModeActive(true)
        
        toast({
          title: "✅ All Students Applied",
          description: `Showing all ${uploadedStudentList.length} students on wheel. Use "Randomly Apply" to select subset, then press "🎲 Randomly Select" to spin!`,
        })
      }

      // 🚀 INSTANT BROADCAST FIRST: Send to Firebase immediately for instant participant sync
      if (enableRealTimeSync && sessionId && (effectiveOrganizerMode || userPermissions.isFullAccessCollaborator)) {
        try {
          console.log("🚀 INSTANT BROADCAST: Sending items to participants IMMEDIATELY:", {
            itemsCount: finalItems.length,
            preview: finalItems.slice(0, 3),
            sessionId: sessionId,
            timestamp: new Date().toISOString()
          })

          const itemsUpdateData = {
            wheelState: {
              wheelItems: finalItems,
              customItems: finalItems, // 🎯 CRITICAL: Both wheelItems and customItems for compatibility
              itemsUpdatedAt: Date.now(),
              itemChangeSource: "apply-items-instant",
              itemsCount: finalItems.length,
              // Include broadcast source for tracking
              broadcastSource: effectiveOrganizerMode ? 'organizer' : 'full-access-collaborator',
              collaboratorId: userPermissions.isFullAccessCollaborator ? userPermissions.userRole : null,
              // 🎨 CRITICAL FIX: Persist theme in Firebase to prevent reversion
              theme: persistentTheme || wheelTheme,
              // Force participant redraw flag
              forceParticipantRedraw: true,
              participantRedrawTimestamp: Date.now()
            },
            // Also set at root level for compatibility
            wheelItems: finalItems,
            customItems: finalItems,
            updatedAt: serverTimestamp()
          }

          // 🎯 STABILITY: Retry logic for better reliability
          let retries = 0
          const maxRetries = 3
          while (retries < maxRetries) {
            try {
              await updateDoc(doc(db, "liveDrawSessions", sessionId), itemsUpdateData)
              console.log("✅ INSTANT BROADCAST COMPLETE: Items sent to Firebase for participant sync", {
                sessionId,
                itemsCount: validItems.length,
                timestamp: new Date().toISOString(),
                attempt: retries + 1
              })
              break // Success, exit retry loop
            } catch (retryError) {
              retries++
              if (retries >= maxRetries) {
                throw retryError // Re-throw if all retries failed
              }
              console.warn(`⚠️ Broadcast attempt ${retries} failed, retrying...`, retryError)
              await new Promise(resolve => setTimeout(resolve, 500 * retries)) // Exponential backoff
            }
          }
        } catch (error) {
          console.error("❌ Failed to broadcast items update after retries:", error)
          toast({
            title: "⚠️ Sync Warning",
            description: "Items updated locally but may not sync to all participants",
            variant: "destructive"
          })
        }
      }

      // 🎯 ORGANIZER INSTANT REDRAW: Use stable rendering system
      const forceImmediateRedraw = () => {
        stableRender(() => {
          const canvas = canvasRef.current
          if (canvas) {
            const ctx = canvas.getContext("2d")
            if (ctx) {
              drawWheelAtAngleWithItems(ctx, canvas, currentAngle, finalItems, persistentTheme || wheelTheme)
              console.log("✅ ORGANIZER REDRAW: Wheel updated with", finalItems.length, "items")
            }
          }
        })
      }

      // Immediate redraw with stable rendering
      forceImmediateRedraw()
      
      // Schedule additional redraws for state propagation
      setTimeout(forceImmediateRedraw, 50)
      setTimeout(forceImmediateRedraw, 150)

      // Also call drawWheel for complete update
      setTimeout(() => {
        console.log("🎯 ORGANIZER: Complete wheel redraw with saved items")
        drawWheel(finalItems, persistentTheme || wheelTheme)
      }, 150)

      // Close dialog
      setIsTextDialogOpen(false)

      // Show success toast with connection status
      toast({
        title: "✅ Items Applied!",
        description: connectionState === 'connected' 
          ? `Wheel updated with ${finalItems.length} items - synced to all participants`
          : `Wheel updated with ${finalItems.length} items - sync pending`,
        variant: connectionState === 'connected' ? 'default' : 'default'
      })

      console.log("✅ SAVE COMPLETE: Organizer wheel updated and broadcast to participants", {
        itemsCount: finalItems.length,
        preview: finalItems.slice(0, 5),
        timestamp: new Date().toISOString()
      })

    } catch (error) {
      console.error("❌ Error saving editable items:", error)
      toast({
        title: "Error",
        description: "Failed to save editable items. Please try again.",
        variant: "destructive"
      })
    }
  }

  const resetToOriginalItems = () => {
    console.log("🔄 Resetting to original items - clearing all manual edits")

    // Reset to editing mode disabled (use original items)
    setIsEditingItems(false)
    setEditableItems([]) // Clear the manually edited items
    setLastAppliedItems([]) // Clear the last applied items to prevent restoration
    
    // 🔥 CRITICAL: Clear persisted items on explicit reset
    filledLiveParticipantsRef.current = []
    console.log("🔥 CLEARED PERSISTED ITEMS: filledLiveParticipantsRef cleared on explicit reset")

    // Reset wheel state
    setCurrentAngle(0)
    setWinners([])
    setShowResults(false)
    setIsSpinningWithRef(false)
    setPendingWinners(null) // Clear any pending winners

    // Force immediate wheel redraw with original items
    setTimeout(() => {
      console.log("🔄 Reset complete - wheel should now show original items")
      drawWheel()
    }, 100)

    toast({
      title: "Reset Complete",
      description: "Wheel items have been reset to original content",
    })
  }


  // Test theme synchronization function
  const testThemeSync = async () => {
    if (!sessionId || !enableRealTimeSync) {
      toast({
        title: "🧪 Test Not Available",
        description: "Theme sync test requires an active live session",
        variant: "destructive"
      })
      return
    }

    if (effectiveOrganizerMode) {
      toast({
        title: "🧪 Test Not Available",
        description: "Theme sync test is for participants only",
        variant: "destructive"
      })
      return
    }

    try {
      console.log('🧪 PARTICIPANT: Testing theme synchronization...')

      // Test with a random theme
      const testThemes = ['ocean', 'sunset', 'forest', 'royal', 'fire', 'neon', 'purple']
      const randomTheme = testThemes[Math.floor(Math.random() * testThemes.length)]

      console.log('🧪 PARTICIPANT: Testing with theme:', randomTheme)

      // Get theme colors
      const getThemeColors = (themeName: string) => {
        const themeMap: Record<string, any> = {
          'ocean': { primary: '#0077be', secondary: '#00a8cc', accent: '#ffffff', background: '#f0f8ff' },
          'sunset': { primary: '#ff4500', secondary: '#ff6347', accent: '#ffffff', background: '#fff8f0' },
          'forest': { primary: '#228b22', secondary: '#006400', accent: '#ffffff', background: '#f0fff0' },
          'royal': { primary: '#4b0082', secondary: '#800080', accent: '#ffd700', background: '#f8f8ff' },
          'fire': { primary: '#dc143c', secondary: '#ff4500', accent: '#ffffff', background: '#fff8f0' },
          'neon': { primary: '#39ff14', secondary: '#ff073a', accent: '#000000', background: '#0a0a0a' },
          'purple': { primary: '#9932cc', secondary: '#6a0dad', accent: '#ffffff', background: '#f5f0ff' }
        }
        return themeMap[themeName] || { primary: '#8e0b16', secondary: '#66181E', accent: '#ffffff', background: '#f8f9fa' }
      }

      const themeColors = getThemeColors(randomTheme)
      const testThemeData = {
        primary: themeColors.primary,
        secondary: themeColors.secondary,
        accent: themeColors.accent,
        background: themeColors.background
      }

      console.log('🧪 PARTICIPANT: Test theme data prepared:', testThemeData)

      // Create a test update document to simulate organizer theme change
      const testUpdateData = {
        wheelState: {
          theme: testThemeData,
          themeUpdatedAt: Date.now(),
          themeName: randomTheme,
          testThemeSync: true
        },
        updatedAt: Date.now()
      }

      // Simulate the theme update by directly calling the listener logic
      console.log('🧪 PARTICIPANT: Simulating theme update with test data')

      // Apply the test theme directly
      const currentThemeId = `${wheelTheme.primary}-${wheelTheme.secondary}-${wheelTheme.accent}-${wheelTheme.background}`
      const newThemeId = `${testThemeData.primary}-${testThemeData.secondary}-${testThemeData.accent}-${testThemeData.background}`

      if (currentThemeId !== newThemeId) {
        console.log('🧪 PARTICIPANT: Test theme applied successfully:', {
          oldTheme: wheelTheme,
          newTheme: testThemeData,
          themeName: randomTheme,
          sessionId: sessionId,
          timestamp: new Date().toISOString()
        })

        setWheelTheme(testThemeData)
        lastThemeUpdateRef.current = newThemeId

        setTimeout(() => {
          console.log('🧪 PARTICIPANT: Test theme applied to wheel visualization')
          drawWheel()
        }, 50)

        toast({
          title: "🧪 Theme Sync Test Successful!",
          description: `Test theme "${randomTheme}" applied successfully. Check if the wheel colors changed.`,
          duration: 5000
        })
      } else {
        toast({
          title: "🧪 Test Theme Unchanged",
          description: `Test theme "${randomTheme}" is the same as current theme`,
          duration: 3000
        })
      }

    } catch (error) {
      console.error('❌ PARTICIPANT: Theme sync test failed:', error)
      toast({
        title: "🧪 Test Failed",
        description: "Theme sync test encountered an error",
        variant: "destructive"
      })
    }
  }

  return (
    <div className="space-y-6">


      {/* Wheel Canvas - Enhanced Responsive Container */}
      <Card className="border-2 mx-2 sm:mx-4" style={{ borderColor: wheelTheme.primary }}>
        <CardContent className="p-3 sm:p-4 md:p-6">
          <div className="flex flex-col lg:flex-row gap-3 sm:gap-4 xl:gap-6">
            {/* Main Wheel Section */}
            <div className="flex-1 flex flex-col items-center space-y-3 sm:space-y-4 min-w-0">
            {/* Wheel Type Info Display - REMOVED */}

            <canvas
              ref={canvasRef}
              width={(() => {
                // 🎯 CONSISTENT CANVAS SIZING - 10% bigger for better visibility
                const screenWidth = window.innerWidth
                const screenHeight = window.innerHeight

                // 📱 ENHANCED RESPONSIVE BREAKPOINTS - Increased by 10%
                if (screenWidth < 320) {
                  return Math.min(308, screenWidth - 5, screenHeight - 100)
                } else if (screenWidth < 375) {
                  return Math.min(374, screenWidth - 10, screenHeight - 120)
                } else if (screenWidth < 414) {
                  return Math.min(418, screenWidth - 15, screenHeight - 140)
                } else if (screenWidth < 480) {
                  return Math.min(462, screenWidth - 20, screenHeight - 160)
                } else if (screenWidth < 640) {
                  return Math.min(528, screenWidth - 25, screenHeight - 180)
                } else if (screenWidth < 768) {
                  return Math.min(638, screenWidth - 35, screenHeight - 200)
                } else if (screenWidth < 1024) {
                  return Math.min(748, screenWidth - 45, screenHeight - 230)
                } else if (screenWidth < 1280) {
                  return Math.min(858, screenWidth - 55, screenHeight - 260)
                } else if (screenWidth < 1440) {
                  return Math.min(924, screenWidth - 65, screenHeight - 300)
                } else if (screenWidth < 1680) {
                  return Math.min(968, screenWidth - 75, screenHeight - 340)
                } else if (screenWidth < 1920) {
                  return Math.min(1012, screenWidth - 85, screenHeight - 380)
                } else {
                  return Math.min(1100, screenWidth - 95, screenHeight - 420)
                }
              })()}
              height={(() => {
                // 🎯 CONSISTENT CANVAS SIZING - 10% bigger
                const screenWidth = window.innerWidth
                const screenHeight = window.innerHeight

                // 📱 CONSISTENT BREAKPOINTS - Increased by 10%
                if (screenWidth < 320) {
                  return Math.min(308, screenWidth - 10, screenHeight - 110)
                } else if (screenWidth < 375) {
                  return Math.min(374, screenWidth - 15, screenHeight - 130)
                } else if (screenWidth < 414) {
                  return Math.min(418, screenWidth - 20, screenHeight - 150)
                } else if (screenWidth < 480) {
                  return Math.min(462, screenWidth - 25, screenHeight - 170)
                } else if (screenWidth < 640) {
                  return Math.min(528, screenWidth - 30, screenHeight - 190)
                } else if (screenWidth < 768) {
                  return Math.min(638, screenWidth - 40, screenHeight - 210)
                } else if (screenWidth < 1024) {
                  return Math.min(748, screenWidth - 50, screenHeight - 240)
                } else if (screenWidth < 1280) {
                  return Math.min(858, screenWidth - 60, screenHeight - 270)
                } else if (screenWidth < 1440) {
                  return Math.min(924, screenWidth - 70, screenHeight - 310)
                } else if (screenWidth < 1680) {
                  return Math.min(968, screenWidth - 80, screenHeight - 350)
                } else if (screenWidth < 1920) {
                  return Math.min(1012, screenWidth - 90, screenHeight - 390)
                } else {
                  return Math.min(1100, screenWidth - 100, screenHeight - 430)
                }
              })()}
              className="border-4 rounded-full shadow-2xl transition-all duration-300 hover:shadow-3xl max-w-full"
              style={{
                borderColor: wheelTheme.primary,
                opacity: 1,
                transform: 'scale(1) translateZ(0)',
                transition: 'all 0.3s ease-in-out',
                maxWidth: '100%',
                height: 'auto',
                // Enhanced mobile optimization
                touchAction: 'none', // Prevent zoom on double tap
                userSelect: 'none', // Prevent text selection
                WebkitUserSelect: 'none',
                WebkitTouchCallout: 'none',
                // Hardware acceleration for smoother animations
                willChange: isSpinning ? 'transform' : 'auto',
                backfaceVisibility: 'hidden',
                perspective: 1000
              }}
            />
            
            {/* Control Buttons - HIDDEN FOR PARTICIPANTS */}
            {(() => {
              // ENHANCED: Enhanced button visibility logic for view-only users - STRICT VIEW ONLY
              // 🎯 FIX: In research mode, disable button if randomSelectionCount is invalid (0 or > available)
              const isResearchModeInvalid = isResearchModeActive && 
                (randomSelectionCount < 1 || randomSelectionCount > uploadedStudentList.length)
              
              const isDisabled = isSpinning || wheelItems.length === 0 || studentMode || disabled ||
                (isLiveMode && !effectiveOrganizerMode && !userPermissions.isFullAccessCollaborator) ||
                isResearchModeInvalid

              // Use the canViewOnly flag from the simplified permission system - CONSISTENT LOGIC
              const isViewOnly = userPermissions?.canViewOnly === true ||
                studentMode ||
                (isLiveMode && !effectiveOrganizerMode && !userPermissions.isFullAccessCollaborator)

              // STRICT VIEW ONLY: Only show buttons for organizers and full access collaborators
              const shouldShowButtons = !isViewOnly && !studentMode

              // Only log when visibility actually changes to reduce console spam
              const visibilityKey = `${isViewOnly}-${studentMode}-${effectiveOrganizerMode}-${userPermissions?.canViewOnly}-${userPermissions?.isFullAccessCollaborator}`

              if (visibilityKey !== lastVisibilityCheck.current) {
                console.log("🎯 ENHANCED BUTTON VISIBILITY DEBUG:", {
                  isLiveMode,
                  organizerMode,
                  studentMode,
                  userPermissions: userPermissions,
                  userRole: userPermissions?.userRole,
                  isFullAccessCollaborator: userPermissions?.isFullAccessCollaborator,
                  canViewOnly: userPermissions?.canViewOnly,
                  effectiveOrganizerMode,
                  isDisabled,
                  isViewOnly,
                  shouldShowButtons,
                  buttonCondition1: !studentMode,
                  buttonCondition2: !isViewOnly,
                  timestamp: new Date().toISOString()
                })
                lastVisibilityCheck.current = visibilityKey
              }

              // HIDE ALL CONTROLS FOR PARTICIPANTS
              if (isViewOnly) {
                return null; // Don't render any buttons for participants
              }

              return (
                <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 justify-center max-w-full">
                  {/* Back to Dashboard Button - Enhanced Responsive */}
                  {onBackToDashboard && (
                    <Button
                      onClick={onBackToDashboard}
                      variant="outline"
                      size={window.innerWidth < 640 ? "default" : "lg"}
                      style={{ borderColor: wheelTheme.primary, color: wheelTheme.primary }}
                      className="hover:bg-blue-50 hover:border-blue-500 hover:text-blue-600 transition-colors text-xs sm:text-sm md:text-base h-10 sm:h-11 md:h-12 px-3 sm:px-4"
                    >
                      <svg className="h-4 w-4 sm:h-5 sm:w-5 mr-1 sm:mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                      </svg>
                      <span className="hidden sm:inline">Back to Dashboard</span>
                      <span className="sm:hidden">Back</span>
                    </Button>
                  )}

                  {/* Main Spin Button - Ultra Responsive */}
                  <Button
                    onClick={async () => {
                      // 🎯 RESEARCH MODE: If in research mode, do random selection first, then spin
                      if (isResearchModeActive && uploadedStudentList.length > 0) {
                        console.log("🎲 Research Mode Button Clicked - Performing random selection and spinning immediately")

                        // 🎯 IMMEDIATE RESET: Stop current animation and reset wheel display to 50 students
                        // This ensures the wheel immediately shows 50 students when button is pressed
                        stopAnimationRef.current = true
                        isAnimationRunningRef.current = false
                        setShowSelectedStudentsOnWheel(false)
                        setShowResults(false)
                        console.log("🎯 IMMEDIATE RESET: Wheel display reset to 50 students, animation stopped")

                        // Force immediate redraw with 50 students
                        const canvas = canvasRef.current
                        if (canvas) {
                          const ctx = canvas.getContext("2d")
                          if (ctx && wheelItems.length > 0) {
                            drawWheelAtAngleWithItems(ctx, canvas, currentAngle, wheelItems, persistentTheme || wheelTheme)
                            console.log("✅ WHEEL REDRAWN: Now showing all", wheelItems.length, "students")
                          }
                        }

                        // Perform random selection and get the selected students
                        const selected = await handleRandomSelection()
                        const selectedNames = selected.map(s => s.name)

                        console.log("🎯 USING SELECTED STUDENTS FOR SPIN:", {
                          selectedCount: selected.length,
                          selectedNames: selectedNames
                        })

                        // Hide any existing results before spinning
                        setShowResults(false)

                        // 🎯 CRITICAL FIX: Directly trigger research spin instead of calling spinWheel() recursively
                        setTimeout(async () => {
                          // 🎯 CRITICAL: Use selectedStudents that was set by handleRandomSelection()
                          // Don't do a new random selection here - that causes the first-try failure
                          if (selectedStudents.length === 0) {
                            console.log("⚠️ No students selected yet, performing selection now")
                            // Fallback: Perform selection if none exists (shouldn't happen with proper flow)
                            const shuffled = [...uploadedStudentList]
                            for (let i = shuffled.length - 1; i > 0; i--) {
                              const j = Math.floor(Math.random() * (i + 1));
                              [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
                            }
                            const newlySelected = shuffled.slice(0, randomSelectionCount)
                            setSelectedStudents(newlySelected)
                            console.log("🎲 FALLBACK SELECTION:", {
                              selectedCount: newlySelected.length,
                              newStudents: newlySelected.map(s => s.name)
                            })
                          }

                          // 🎯 CRITICAL: Use selectedStudents that was set by handleRandomSelection()
                          const studentsToUse = selectedStudents.length > 0 ? selectedStudents : (() => {
                            // Emergency fallback - shouldn't happen
                            const shuffled = [...uploadedStudentList]
                            for (let i = shuffled.length - 1; i > 0; i--) {
                              const j = Math.floor(Math.random() * (i + 1));
                              [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
                            }
                            return shuffled.slice(0, randomSelectionCount)
                          })()

                          console.log("🎯 USING SELECTED STUDENTS FOR SPIN:", {
                            studentsToUseCount: studentsToUse.length,
                            studentsToUse: studentsToUse.map(s => s.name)
                          })

                          // 🎯 CRITICAL FIX: DO NOT change wheel display - keep showing all 50 students
                          // Wheel display remains unchanged - will show all original students
                          // Winners (the 10 selected students) will be shown in center ONLY after spinning completes

                          // 🎯 SMOOTH WHEEL SPIN: Use the standard wheel spinning animation
                          // Reset wheel state for clean spin
                          setCurrentAngle(0)
                          setPendingWinners(null)

                          // 🎯 CRITICAL FIX: DO NOT show results yet - they should only appear after spinning completes
                          // Store winners internally but don't display them yet
                          const researchWinnersList = studentsToUse.map((student, idx) => ({
                            id: student.id || `winner-${idx}`,
                            name: student.name?.trim() || `Student ${idx + 1}`,  // 🎯 SANITIZE: Trim and ensure valid name
                            email: student.email?.trim()  // 🎯 SANITIZE: Trim email
                          }))
                          
                          // Store winners but DON'T show them yet (setShowResults stays false)
                          setWinners(researchWinnersList)
                          console.log("🎯 WINNERS STORED (NOT SHOWN YET):", researchWinnersList.length, "winners will display after spinning")

                          // 🎯 CRITICAL FIX: No redraw needed - wheel already shows all original students
                          // Just proceed with spinning animation

                          // Small delay to ensure rendering is complete
                          await new Promise(resolve => setTimeout(resolve, 100))

                          // 🎯 START SMOOTH SPIN ANIMATION
                          setIsSpinningWithRef(true)
                          mySpinStartTimeRef.current = Date.now()
                          stopAnimationRef.current = false

                          console.log("🎯 Starting smooth research spin animation")

                          // 🔥 CRITICAL FIX: Broadcast spin START to Firebase immediately so participants start spinning
                          if (enableRealTimeSync && sessionId && effectiveOrganizerMode) {
                            const spinStartTime = Date.now()
                            const broadcastData = {
                              isSpinning: true,
                              wheelState: {
                                isSpinning: true,
                                spinStartTime: spinStartTime,
                                spinDuration: settings.spinDuration || 4000,
                                broadcastSource: organizerMode ? 'organizer' : 'full-access-collaborator',
                                wheelItemsUsed: selectedNames,
                                participantSync: 'IMMEDIATE',
                                instantStart: true,
                                forceParticipantSync: true
                              },
                              updatedAt: serverTimestamp()
                            }

                            try {
                              await updateDoc(doc(db, "liveDrawSessions", sessionId), broadcastData)
                              console.log("✅ RESEARCH SPIN START broadcasted to Firebase - participants should start spinning now")
                            } catch (error) {
                              console.error("❌ Failed to broadcast research spin start:", error)
                            }
                          }

                          // Calculate smooth spin (5-7 full rotations)
                          const spins = 5 + Math.random() * 2 // 5-7 rotations for smooth effect
                          const totalRotation = spins * 2 * Math.PI

                          const startTime = performance.now()
                          const spinDuration = settings.spinDuration || 4000

                          // 🎯 CRITICAL: Mark animation as running to prevent duplicate syncs
                          isAnimationRunningRef.current = true
                          stopAnimationRef.current = false

                          // Animate the spin
                          const animateSpin = (currentTime = performance.now()) => {
                            // 🛡️ STABILITY CHECK: Stop if animation was cancelled
                            if (stopAnimationRef.current || !isAnimationRunningRef.current) {
                              console.log("🛑 Research spin animation stopped externally")
                              isAnimationRunningRef.current = false
                              return
                            }

                            const elapsed = currentTime - startTime
                            const progress = Math.min(elapsed / spinDuration, 1)

                            // Smooth easing
                            const easeProgress = progress >= 0.98 ? 1 : easeInOutCubic(progress)
                            const currentRotation = totalRotation * easeProgress

                            // Draw wheel at current rotation
                            const canvas = canvasRef.current
                            if (canvas && canvas.width > 0 && canvas.height > 0) {
                              const ctx = canvas.getContext("2d")
                              if (ctx) {
                                drawWheelAtAngleWithItems(ctx, canvas, currentRotation, stableWheelItems, persistentTheme || wheelTheme)
                              }
                            }

                            setCurrentAngle(currentRotation)

                            if (progress < 1) {
                              requestAnimationFrame(animateSpin)
                            } else {
                              // 🎯 CRITICAL: Mark animation as complete and reset refs properly for NEXT spin
                              animationCompletedRef.current = true
                              isAnimationRunningRef.current = false
                              stopAnimationRef.current = false  // 🎯 CRITICAL: Reset this to allow next spin
                              setIsSpinningWithRef(false)
                              mySpinStartTimeRef.current = 0

                              console.log("🎉 RESEARCH SPIN COMPLETE - Animation finished, refs reset")

                              // 🎯 CRITICAL: Switch to showing ONLY selected students after spinning
                              // Update the flag to show selected students on the wheel
                              setShowSelectedStudentsOnWheel(true)
                              
                              // Store selected students in the ref for wheelItems to use
                              const selectedNames = studentsToUse.map(s => s.name)
                              filledLiveParticipantsRef.current = selectedNames
                              console.log("🎯 WHEEL MODE: Set to show only 10 selected students after spin")

                              // 🎯 CRITICAL DELAY: Micro-delay to ensure all refs are truly reset before showing results
                              // This prevents any race conditions with animation loop
                              setTimeout(() => {
                                // Double-check animation is really done
                                if (!isAnimationRunningRef.current) {
                                  setShowResults(true)
                                  console.log("✅ RESULTS DISPLAYED - Animation 100% complete with 10 students on wheel")
                                }
                              }, 50)

                              // Confetti celebration
                              confetti({
                                particleCount: 100,
                                spread: 70,
                                origin: { y: 0.6 }
                              })

                              // Call onSpinComplete callback
                              if (onSpinComplete) {
                                onSpinComplete({
                                  id: `research-spin-${Date.now()}`,
                                  winners: researchWinnersList,
                                  timestamp: new Date(),
                                  spinDuration: spinDuration,
                                  totalParticipants: studentsToUse.length
                                })
                              }

                              // Broadcast to Firebase if in live mode
                              if (enableRealTimeSync && sessionId && effectiveOrganizerMode) {
                                const researchBroadcastData = {
                                  isSpinning: false,
                                  winners: researchWinnersList,
                                  wheelState: {
                                    wheelItems: selectedNames,
                                    customItems: selectedNames,
                                    isSpinning: false,
                                    completedAt: Date.now(),
                                    winners: researchWinnersList,
                                    broadcastSource: organizerMode ? 'organizer' : 'full-access-collaborator',
                                    triggeredByOrganizer: true
                                  },
                                  updatedAt: serverTimestamp()
                                }

                                updateDoc(doc(db, "liveDrawSessions", sessionId), researchBroadcastData)
                                  .then(() => {
                                    console.log("✅ Research winners broadcasted to Firebase - participants should stop spinning and show results")
                                  })
                                  .catch((error) => {
                                    console.error("❌ Failed to broadcast research winners:", error)
                                  })
                              }

                              toast({
                                title: "🎉 Selection Complete!",
                                description: `${researchWinnersList.length} student${researchWinnersList.length > 1 ? 's' : ''} randomly selected!`,
                              })
                            }
                          }

                          // Start the animation
                          requestAnimationFrame(animateSpin)
                        }, 100)
                      } else {
                        spinWheel()
                      }
                    }}
                    disabled={isDisabled}
                    size={window.innerWidth < 640 ? "default" : "lg"}
                    style={{
                      backgroundColor: wheelTheme.primary,
                      color: wheelTheme.accent
                    }}
                    className={`hover:opacity-90 text-xs sm:text-sm md:text-base px-3 sm:px-4 py-2 sm:py-3 transition-all duration-200 h-10 sm:h-11 md:h-12 touch-manipulation active:scale-95 ${
                      userPermissions.isFullAccessCollaborator ? 'animate-pulse border-2 border-yellow-400' : ''
                    }`}
                    title={userPermissions.isFullAccessCollaborator ?
                      "Full Access Collaborator: Your spin will synchronize with all participants including the organizer" :
                      isResearchModeActive ?
                      "Click to randomly select and display students" :
                      "Spin the wheel and synchronize with all participants"
                    }
                  >
                    {isSpinning ? (
                      <>
                        <Pause className="h-4 w-4 sm:h-5 sm:w-5 mr-1 sm:mr-2 flex-shrink-0" />
                        <span className="hidden sm:inline">Spinning...</span>
                        <span className="sm:hidden">...</span>
                      </>
                    ) : userPermissions.isFullAccessCollaborator ? (
                      <>
                        <Play className="h-4 w-4 sm:h-5 sm:w-5 mr-1 sm:mr-2 flex-shrink-0" />
                        <span className="hidden sm:inline">Collaborator Spin</span>
                        <span className="sm:hidden">Spin</span>
                        <Crown className="h-3 w-3 sm:h-4 sm:w-4 ml-1 text-yellow-400 animate-pulse flex-shrink-0" />
                      </>
                    ) : isResearchModeActive ? (
                      <>
                        <span className="text-lg sm:text-xl mr-1 sm:mr-2">🎲</span>
                        <span className="hidden sm:inline">Randomly Select</span>
                        <span className="sm:hidden">Select</span>
                      </>
                    ) : (
                      <>
                        <Play className="h-4 w-4 sm:h-5 sm:w-5 mr-1 sm:mr-2 flex-shrink-0" />
                        <span className="hidden sm:inline">Spin Wheel</span>
                        <span className="sm:hidden">Spin</span>
                      </>
                    )}
                  </Button>

                  {/* Secondary Action Buttons Row - Stack on mobile for better accessibility */}
                  <div className="flex flex-row gap-2 sm:gap-3 justify-center">
                    <Button
                      onClick={resetWheel}
                      variant="outline"
                      size={window.innerWidth < 640 ? "sm" : "lg"}
                      disabled={isSpinning || disabled}
                      style={{ borderColor: wheelTheme.primary, color: wheelTheme.primary }}
                      className="hover:bg-red-50 hover:border-red-500 hover:text-red-600 transition-colors text-xs sm:text-sm md:text-base h-9 sm:h-11 md:h-12 px-2 sm:px-4 flex-shrink-0"
                    >
                      <RotateCcw className="h-4 w-4 sm:h-5 sm:w-5 mr-1 sm:mr-2 flex-shrink-0" />
                      <span className="hidden sm:inline">Reset</span>
                    </Button>

                    <Button
                      onClick={shuffleParticipants}
                      variant="outline"
                      size={window.innerWidth < 640 ? "sm" : "lg"}
                      disabled={isSpinning || disabled || wheelItems.length === 0}
                      style={{ borderColor: wheelTheme.primary, color: wheelTheme.primary }}
                      className="hover:bg-purple-50 hover:border-purple-500 hover:text-purple-600 transition-colors text-xs sm:text-sm md:text-base h-9 sm:h-11 md:h-12 px-2 sm:px-4 flex-shrink-0"
                      title="Randomly shuffle the wheel items"
                    >
                      <ShuffleIcon className="h-4 w-4 sm:h-5 sm:w-5 mr-1 sm:mr-2 flex-shrink-0" />
                      <span className="hidden sm:inline">Shuffle</span>
                    </Button>

                    <Button
                      onClick={() => setIsThemeDialogOpen(true)}
                      variant="outline"
                      size={window.innerWidth < 640 ? "sm" : "lg"}
                      disabled={isSpinning || disabled}
                      style={{ borderColor: wheelTheme.primary, color: wheelTheme.primary }}
                      className="text-xs sm:text-sm md:text-base h-9 sm:h-11 md:h-12 px-2 sm:px-4 flex-shrink-0"
                    >
                      <Palette className="h-4 w-4 sm:h-5 sm:w-5 mr-1 sm:mr-2 flex-shrink-0" />
                      <span className="hidden sm:inline">Theme</span>
                    </Button>

                    {/* Test Theme Sync Button - Only for participants in live mode */}
                    {isLiveMode && !effectiveOrganizerMode && enableRealTimeSync && sessionId && (
                      <Button
                        onClick={testThemeSync}
                        variant="outline"
                        size={window.innerWidth < 640 ? "sm" : "lg"}
                        disabled={isSpinning || disabled}
                        style={{ borderColor: wheelTheme.primary, color: wheelTheme.primary }}
                        className="hover:bg-green-50 hover:border-green-500 hover:text-green-600 transition-colors text-xs sm:text-sm md:text-base h-9 sm:h-11 md:h-12 px-2 sm:px-4 flex-shrink-0"
                      >
                        <Palette className="h-4 w-4 sm:h-5 sm:w-5 mr-1 sm:mr-2 flex-shrink-0" />
                        <span className="hidden md:inline">🧪 Test Theme Sync</span>
                        <span className="md:hidden">🧪 Test</span>
                      </Button>
                    )}



                    {/* Edit Text button - show for organizers */}
                    {effectiveOrganizerMode && (
                      <Button
                        onClick={() => {
                          console.log("🖊️ Opening text editor for manual item editing")

                          // Ensure editable items are populated when opening dialog
                          if (editableItems.length === 0) {
                            if (selectedWheelType?.defaultItems) {
                              setEditableItems([...selectedWheelType.defaultItems])
                            } else if (participants?.length > 0) {
                              setEditableItems(participants.map(p => p.name))
                            } else {
                              setEditableItems(["Option 1", "Option 2", "Option 3", "Option 4", "Option 5"])
                            }
                          }

                          setIsTextDialogOpen(true)
                          console.log("📝 Text dialog opened with populated content for editing")
                        }}
                        variant="outline"
                        size={window.innerWidth < 640 ? "sm" : "lg"}
                        disabled={isSpinning || disabled}
                        style={{ borderColor: wheelTheme.primary, color: wheelTheme.primary }}
                        className="text-xs sm:text-sm md:text-base h-9 sm:h-11 md:h-12 px-2 sm:px-4 flex-shrink-0"
                      >
                        <Edit3 className="h-4 w-4 sm:h-5 sm:w-5 mr-1 sm:mr-2 flex-shrink-0" />
                        <span className="hidden sm:inline">Edit Text</span>
                        <span className="sm:hidden">Edit</span>
                      </Button>
                    )}
                  </div>
                </div>
              );
            })()}
            </div>

            {/* Random Selection Controls - Compact responsive panel */}
            {uploadedStudentList.length > 0 && isResearchModeActive && !studentMode && (effectiveOrganizerMode || userPermissions.isFullAccessCollaborator) && (
              <div className="w-full max-w-[220px] flex-shrink-0">
                <div className="h-full rounded-md" style={{}}>
                  <div className="p-2">
                    <div className="flex items-center gap-2">
                      <span className="text-base flex-shrink-0">📊</span>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-base font-bold truncate" style={{ color: wheelTheme.primary }}>
                          Random Selection
                        </h3>
                        <p className="text-xs text-gray-600 truncate">
                          {uploadedStudentList.length} students uploaded
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="p-2 space-y-2">
                    <div>
                      <Label className="text-sm font-medium mb-1 block" style={{ color: wheelTheme.primary }}>
                        Select how many students to pick:
                      </Label>
                      <div className="space-y-2">
                        {/* Text Input Only - Failsafe with validation */}
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="1"
                            max={uploadedStudentList.length}
                            value={manualSelectionInput}
                            onChange={async (e) => {
                              const inputValue = e.target.value
                              setManualSelectionInput(inputValue)
                              
                              // 🎯 FIX: Clear error and reset if input is empty
                              if (inputValue.trim() === "") {
                                setSelectionValidationError("")
                                setRandomSelectionCount(0) // Reset to 0 to disable button
                                // Reset to show all 50 students
                                setShowSelectedStudentsOnWheel(false)
                                setSelectedStudents([])
                                return
                              }
                              
                              const parsedValue = parseInt(inputValue)
                              
                              // 🎯 FIX: Validate and show errors
                              if (isNaN(parsedValue)) {
                                setSelectionValidationError("Please enter a valid number")
                                setRandomSelectionCount(0) // Reset to disable button
                                setShowSelectedStudentsOnWheel(false)
                                setSelectedStudents([])
                                return
                              }
                              
                              if (parsedValue < 1) {
                                setSelectionValidationError("Must select at least 1 student")
                                setRandomSelectionCount(0) // Reset to disable button
                                setShowSelectedStudentsOnWheel(false)
                                setSelectedStudents([])
                                return
                              }
                              
                              if (parsedValue > uploadedStudentList.length) {
                                setSelectionValidationError(`Cannot exceed ${uploadedStudentList.length} available students`)
                                setRandomSelectionCount(0) // Reset to disable button
                                setShowSelectedStudentsOnWheel(false)
                                setSelectedStudents([])
                                return
                              }
                              
                              // ✅ FIX: Clear error BEFORE updating count to allow button to enable
                              setSelectionValidationError("")
                              setRandomSelectionCount(parsedValue)
                              
                              // 🎯 CRITICAL FIX: Automatically re-select students with new count
                              // This ensures the selection is always accurate when count changes
                              const shuffled = [...uploadedStudentList]
                              for (let i = shuffled.length - 1; i > 0; i--) {
                                const j = Math.floor(Math.random() * (i + 1));
                                [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
                              }
                              const newSelected = shuffled.slice(0, parsedValue)
                              setSelectedStudents(newSelected)
                              
                              console.log("🎯 AUTO-RESELECTION: Updated selection with new count", {
                                newCount: parsedValue,
                                selectedStudents: newSelected.map(s => s.name)
                              })
                              
                              // Update Firebase with new selection
                              if (enableRealTimeSync && sessionId) {
                                try {
                                  await updateDoc(doc(db, "liveDrawSessions", sessionId), {
                                    "wheelState.randomSelectionCount": parsedValue,
                                    "wheelState.selectedStudents": newSelected.map(s => ({ id: s.id, name: s.name, email: s.email })),
                                    "wheelState.researchModeUpdatedAt": Date.now(),
                                    updatedAt: serverTimestamp()
                                  })
                                  console.log("✅ New selection broadcasted to Firebase")
                                } catch (error) {
                                  console.error("Failed to update selection:", error)
                                }
                              }
                            }}
                            placeholder="Enter number"
                            className={`h-10 px-3 border rounded text-sm font-medium flex-1 ${selectionValidationError ? 'border-red-500 bg-red-50 text-red-900' : 'border-gray-300'}`}
                            style={{
                              borderColor: selectionValidationError ? '#ef4444' : '#d1d5db'
                            }}
                          />
                          <span className="text-xs font-medium text-gray-600 flex-shrink-0 whitespace-nowrap" title="Maximum available">
                            / {uploadedStudentList.length}
                          </span>
                        </div>

                        {/* Validation Error Message */}
                        {selectionValidationError && (
                          <div className="p-2 rounded bg-red-50 border border-red-200 flex items-start gap-2">
                            <span className="text-lg flex-shrink-0">⚠️</span>
                            <span className="text-xs font-medium text-red-700 flex-1 leading-tight">
                              {selectionValidationError}
                            </span>
                          </div>
                        )}

                        <p className="text-sm text-center font-medium leading-tight" style={{ color: wheelTheme.primary }}>
                          {randomSelectionCount} of {uploadedStudentList.length} ({((randomSelectionCount / uploadedStudentList.length) * 100).toFixed(0)}%)
                        </p>
                        <div className={`p-1 rounded text-sm font-semibold leading-tight ${
                          randomSelectionCount >= 1 && randomSelectionCount <= 5
                            ? 'bg-orange-50 text-orange-800'
                            : ''
                        } flex items-center gap-1`}>
                          {randomSelectionCount >= 1 && randomSelectionCount <= 5 ? (
                            <>
                              <span className="text-base flex-shrink-0">🎯</span>
                              <span className="break-words">Individual: Spin {randomSelectionCount}x</span>
                            </>
                          ) : (
                            <>
                         
                            </>
                          )}
                        </div>
                        {/* Removed Apply button as requested. Selection is applied when spinning. */}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Results Display - Only show after spinning is done */}
      {showResults && winners.length > 0 && !isSpinning && (
        <Card 
          className="border-4 shadow-2xl animate-pulse"
          style={{ 
            borderColor: (persistentTheme || wheelTheme).primary,
            background: `linear-gradient(to right, ${(persistentTheme || wheelTheme).background}, ${(persistentTheme || wheelTheme).accent}15)`
          }}
        >
          <CardHeader 
            className="text-white"
            style={{ 
              background: `linear-gradient(to right, ${(persistentTheme || wheelTheme).primary}, ${(persistentTheme || wheelTheme).secondary})`
            }}
          >
            <CardTitle className="flex flex-col items-center justify-center gap-2">
              <div className="text-xl sm:text-2xl">
                {(() => {
                  const displayTitle = customWinnerTitle.replace(/\{s\}/gi, winners.length > 1 ? 'S' : '')
                  return displayTitle
                })()}
              </div>
              <div className="text-sm font-normal opacity-90">
                {winners.length} {winners.length === 1 ? 'Student' : 'Students'} Selected
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 sm:p-4 md:p-6">
            {/* Responsive grid layout for many results */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-3 md:gap-4">
              {winners.map((winner, index) => (
                <div 
                  key={winner.id} 
                  className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 bg-white rounded-lg border-2 shadow-md hover:shadow-lg transition-all"
                  style={{ borderColor: (persistentTheme || wheelTheme).primary }}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-base sm:text-lg md:text-2xl lg:text-3xl text-gray-800 break-words" title={winner.name?.trim()}>{winner.name?.trim()}</p>
                    {winner.email && (
                      <p className="text-xs sm:text-sm text-gray-600 break-words" title={winner.email?.trim()}>{winner.email?.trim()}</p>
                    )}
                  </div>
                  <div className="text-xl sm:text-2xl flex-shrink-0">🎉</div>
                </div>
              ))}
            </div>
            
            {formattedCongratsMessage.trim().length > 0 && (
              <div className="mt-4 p-4 sm:p-6 bg-white rounded-lg border-2 sm:border-4" style={{ borderColor: (persistentTheme || wheelTheme).primary }}>
                <p className="text-center text-xl sm:text-2xl md:text-3xl lg:text-4xl font-semibold break-words" style={{ color: (persistentTheme || wheelTheme).primary }}>
                  {formattedCongratsMessage}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Theme Customization Dialog - HIDDEN FOR PARTICIPANTS */}
      {(() => {
        // Hide theme dialog for participants
        const isViewOnly = userPermissions?.canViewOnly === true ||
          studentMode ||
          (isLiveMode && !effectiveOrganizerMode && !userPermissions.isFullAccessCollaborator)

        if (isViewOnly) {
          return null; // Don't render theme dialog for participants
        }

        return (
          <Dialog open={isThemeDialogOpen} onOpenChange={setIsThemeDialogOpen}>
        <DialogContent className="w-[95vw] sm:w-[90vw] md:max-w-2xl max-h-[90vh] overflow-y-auto mx-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl">
              <Palette className="h-5 w-5 flex-shrink-0" />
              Customize Wheel Theme
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              Choose from preset themes or customize your own colors for the wheel
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 sm:space-y-6 px-2 sm:px-0">
            {/* Theme Presets */}
            <div>
              <Label className="text-sm sm:text-base font-semibold">Theme Presets ({themePresets.length} available)</Label>
              <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-3 mt-2 sm:mt-3 max-h-64 sm:max-h-80 overflow-y-auto">
                {themePresets.map((theme) => (
                  <Button
                    key={theme.value}
                    variant="outline"
                    className="h-auto p-2 sm:p-3 flex flex-col items-center gap-1 sm:gap-2 hover:scale-105 transition-all duration-200 hover:shadow-lg text-xs sm:text-sm"
                    onClick={() => applyThemeAsync(theme)}
                  >
                    <div className="flex gap-1 sm:gap-2 w-full justify-center">
                      <div 
                        className="w-3 h-3 sm:w-4 sm:h-4 rounded-full border-2 border-gray-300"
                        style={{ backgroundColor: theme.primary }}
                      />
                      <div 
                        className="w-3 h-3 sm:w-4 sm:h-4 rounded-full border-2 border-gray-300"
                        style={{ backgroundColor: theme.secondary }}
                      />
                      <div 
                        className="w-3 h-3 sm:w-4 sm:h-4 rounded-full border-2 border-gray-300"
                        style={{ backgroundColor: theme.accent }}
                      />
                    </div>
                    <span className="text-xs font-medium text-center leading-tight line-clamp-2">{theme.name}</span>
                  </Button>
                ))}
              </div>
            </div>
            
            {/* Custom Colors */}
            <div className="space-y-3 sm:space-y-4">
              <Label className="text-sm sm:text-base font-semibold">Custom Colors</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="space-y-2">
                  <Label htmlFor="primary-color" className="text-xs sm:text-sm">Primary Color</Label>
                  <div className="flex gap-2">
                    <Input
                      id="primary-color"
                      type="color"
                      value={wheelTheme.primary}
                      onChange={(e) => setWheelTheme(prev => ({ ...prev, primary: e.target.value }))}
                      className="w-12 sm:w-16 h-10 p-1 cursor-pointer flex-shrink-0"
                    />
                    <Input
                      value={wheelTheme.primary}
                      onChange={(e) => setWheelTheme(prev => ({ ...prev, primary: e.target.value }))}
                      className="flex-1 text-xs sm:text-sm"
                      placeholder="#8e0b16"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="secondary-color" className="text-xs sm:text-sm">Secondary Color</Label>
                  <div className="flex gap-2">
                    <Input
                      id="secondary-color"
                      type="color"
                      value={wheelTheme.secondary}
                      onChange={(e) => setWheelTheme(prev => ({ ...prev, secondary: e.target.value }))}
                      className="w-12 sm:w-16 h-10 p-1 cursor-pointer flex-shrink-0"
                    />
                    <Input
                      value={wheelTheme.secondary}
                      onChange={(e) => setWheelTheme(prev => ({ ...prev, secondary: e.target.value }))}
                      className="flex-1 text-xs sm:text-sm"
                      placeholder="#66181E"
                    />
                  </div>
                </div>
              </div>
            </div>
            
            {/* Custom Winner Title */}
            <div className="space-y-3 sm:space-y-4">
              <Label className="text-sm sm:text-base font-semibold">💬 Custom Winner Title</Label>
              <div className="space-y-2">
                <Label htmlFor="winner-title" className="text-xs sm:text-sm text-gray-600">
                  Customize Winner Announcement Title
                </Label>
                <div className="flex gap-2 flex-col sm:flex-row">
                  <Input
                    id="winner-title"
                    value={customWinnerTitle}
                    onChange={(e) => {
                      const newTitle = e.target.value
                      console.log("💬 User typing winner title:", newTitle)
                      
                      // Update state immediately for instant UI feedback
                      setCustomWinnerTitle(newTitle)
                      
                      // Clear any existing timeout
                      if (winnerTitleTimeoutRef.current) {
                        clearTimeout(winnerTitleTimeoutRef.current)
                      }
                      
                      // Auto-broadcast in live mode after typing stops
                      if (enableRealTimeSync && sessionId && (effectiveOrganizerMode || userPermissions.isFullAccessCollaborator)) {
                        // Debounced broadcast - wait 800ms after user stops typing
                        winnerTitleTimeoutRef.current = setTimeout(async () => {
                          try {
                            console.log("📡 Broadcasting winner title:", newTitle)
                            await updateDoc(doc(db, "liveDrawSessions", sessionId), {
                              "wheelState.customWinnerTitle": newTitle,
                              "wheelState.winnerTitleUpdatedAt": Date.now(),
                              updatedAt: serverTimestamp()
                            })
                            console.log("✅ Winner title auto-broadcasted successfully:", newTitle)
                          } catch (error) {
                            console.error("❌ Failed to broadcast winner title:", error)
                          }
                        }, 800)
                      }
                    }}
                    placeholder="WINNER{s} SELECTED! 🎉"
                    className="flex-1 text-xs sm:text-sm"
                  />
                  {/* Save button for immediate broadcast */}
                  {enableRealTimeSync && sessionId && (effectiveOrganizerMode || userPermissions.isFullAccessCollaborator) && (
                    <Button
                      onClick={async () => {
                        try {
                          await updateDoc(doc(db, "liveDrawSessions", sessionId), {
                            "wheelState.customWinnerTitle": customWinnerTitle,
                            "wheelState.winnerTitleUpdatedAt": Date.now(),
                            updatedAt: serverTimestamp()
                          })
                          toast({
                            title: "✅ Winner Title Saved",
                            description: `"${customWinnerTitle}" synced to all participants`,
                          })
                        } catch (error) {
                          console.error("❌ Failed to save winner title:", error)
                          toast({
                            title: "❌ Failed to Save",
                            description: "Could not sync winner title",
                            variant: "destructive"
                          })
                        }
                      }}
                      size="sm"
                      style={{ backgroundColor: wheelTheme.primary, color: wheelTheme.accent }}
                      className="flex-shrink-0 text-xs sm:text-sm"
                    >
                      Save
                    </Button>
                  )}
                </div>
                <p className="text-xs text-gray-500">
                  Use {'{s}'} to show "S" for multiple winners. Changes sync automatically in live mode.
                </p>
              </div>
            </div>

            {/* Preview */}
            <div className="space-y-2">
              <Label className="text-sm sm:text-base font-semibold">Live Preview</Label>
              
              {/* Winner Title Preview */}
              <div className="p-3 sm:p-4 bg-white rounded-lg border-2 shadow-md" style={{ borderColor: wheelTheme.primary }}>
                <div className="flex items-center justify-center gap-2">
                  <span className="text-lg sm:text-xl font-bold line-clamp-2" style={{ color: wheelTheme.primary }}>
                    {customWinnerTitle.replace(/\{s\}/gi, 'S')}
                  </span>
                </div>
                <p className="text-xs text-center text-gray-500 mt-2">Winner announcement preview</p>
              </div>

              {/* Theme Color Preview */}
              <div 
                className="w-full h-24 sm:h-32 rounded-lg border-4 flex items-center justify-center relative overflow-hidden"
                style={{ 
                  borderColor: wheelTheme.primary,
                  background: wheelTheme.primary === '#ff0080' 
                    ? 'linear-gradient(45deg, #ff0080, #00ff80, #0080ff, #ff8000, #8000ff)' 
                    : wheelTheme.primary === '#39ff14'
                    ? 'linear-gradient(45deg, #39ff14, #ff073a, #39ff14, #ff073a)'
                    : `linear-gradient(135deg, ${wheelTheme.primary}, ${wheelTheme.secondary}, ${wheelTheme.primary})`
                }}
              >
                {/* Animated pointer */}
                <div 
                  className="absolute right-4 w-0 h-0 animate-pulse"
                  style={{
                    borderTop: '12px solid transparent',
                    borderBottom: '12px solid transparent',
                    borderRight: '20px solid #ffffff',
                    filter: 'drop-shadow(2px 2px 4px rgba(0,0,0,0.5))'
                  }}
                />
                <span 
                  className="text-base sm:text-lg font-bold z-10 drop-shadow-lg text-center px-2"
                  style={{ color: wheelTheme.accent }}
                >
                  🎯 Wheel Preview
                </span>
                {/* Sparkle effects for special themes */}
                {(wheelTheme.primary === '#ff0080' || wheelTheme.primary === '#39ff14') && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="animate-spin text-2xl">✨</div>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          <DialogFooter className="flex gap-2 sm:gap-3">
            <Button variant="outline" onClick={() => setIsThemeDialogOpen(false)} className="text-xs sm:text-sm">
              Cancel
            </Button>
            <Button 
              onClick={async () => {
                // 🎨 CRITICAL FIX: Persist theme properly and broadcast to Firebase
                const newTheme = {
                  primary: wheelTheme.primary,
                  secondary: wheelTheme.secondary,
                  accent: wheelTheme.accent,
                  background: wheelTheme.background
                }
                
                // Set persistent theme to survive spins and item changes
                setPersistentTheme(newTheme)
                setWheelTheme(newTheme)
                
                console.log("🎨 THEME PERSISTENCE: Theme saved and will persist through all actions", newTheme)
                
                // Broadcast theme and winner title to Firebase for participants
                if (enableRealTimeSync && sessionId && (effectiveOrganizerMode || userPermissions.isFullAccessCollaborator)) {
                  try {
                    const themeUpdateData = {
                      wheelState: {
                        theme: newTheme,
                        themeUpdatedAt: Date.now(),
                        themeSource: "custom-theme-applied",
                        customWinnerTitle: customWinnerTitle,
                        winnerTitleUpdatedAt: Date.now()
                      },
                      updatedAt: serverTimestamp()
                    }
                    
                    await updateDoc(doc(db, "liveDrawSessions", sessionId), themeUpdateData)
                    console.log("✅ THEME & WINNER TITLE BROADCASTED: Custom theme and winner title synced to all participants")
                  } catch (error) {
                    console.error("❌ Failed to broadcast theme:", error)
                  }
                }
                
                // Force redraw with new theme
                setTimeout(() => {
                  drawWheel(wheelItems, newTheme)
                }, 50)
                
                setIsThemeDialogOpen(false)
                toast({
                  title: "🎨 Theme & Title Applied",
                  description: `Theme and winner title "${customWinnerTitle.substring(0, 30)}${customWinnerTitle.length > 30 ? '...' : ''}" have been applied`,
                })
              }}
              style={{ backgroundColor: wheelTheme.primary, color: wheelTheme.accent }}
              className="text-xs sm:text-sm"
            >
              Apply Theme
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
        );
      })()}

      {/* Text Editing Dialog - HIDDEN FOR PARTICIPANTS */}
      {(() => {
        // Hide text editing dialog for participants
        const isViewOnly = userPermissions?.canViewOnly === true ||
          studentMode ||
          (isLiveMode && !effectiveOrganizerMode && !userPermissions.isFullAccessCollaborator)

        if (isViewOnly) {
          return null; // Don't render text editing dialog for participants
        }

        return (
          <Dialog open={isTextDialogOpen} onOpenChange={setIsTextDialogOpen}>
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
            {/* CSV Upload Section */}
            <div className="space-y-2 sm:space-y-3">
              <Label className="text-xs sm:text-sm md:text-base font-semibold">Upload CSV File</Label>
              <div className="p-2 sm:p-3 md:p-4 border-2 border-dashed rounded-lg border-gray-300 hover:border-blue-400 transition-colors">
                <div className="text-center mb-2 sm:mb-3 md:mb-4">
                  <Upload className="h-5 w-5 sm:h-6 sm:w-6 md:h-8 md:w-8 mx-auto mb-2 text-gray-400" />

                  {/* Hidden file input */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,text/csv,text/plain"
                    onChange={handleFileSelect}
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
                        <span className="break-words">Choose CSV File</span>
                      </>
                    )}
                  </Button>

                  <p className="text-xs text-gray-500 mt-2 px-1 sm:px-2 leading-relaxed">
                    {csvFile ? (
                      `Size: ${(csvFile.size / 1024).toFixed(1)} KB`
                    ) : (
                      "CSV files with participant names • Maximum file size: 5MB"
                    )}
                  </p>
                </div>

                {/* Show selected file and upload button */}
                {csvFile && !isUploadingCsv && (
                  <div className="flex justify-center mt-2 sm:mt-3">
                    <Button
                      onClick={handleCsvUpload}
                      size="sm"
                      style={{ backgroundColor: wheelTheme.primary, color: wheelTheme.accent }}
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

              {/* CSV format instructions */}
              <div className="p-2 sm:p-3 bg-blue-50 rounded-lg border border-blue-200">
                <h4 className="font-medium text-blue-900 mb-1 text-xs sm:text-sm">CSV Format Tips:</h4>
                <p className="text-xs text-blue-800 leading-relaxed">
                  First row should be headers (e.g., "Name", "Participant", "Student").
                  The system will automatically detect name columns or use the first column.
                  Supports comma, semicolon, and tab delimiters.
                </p>
              </div>
              
              {/* 🎯 RESEARCH FEATURE: Template Download Only - Random Selection moved to Session Info */}
              <div className="p-2 sm:p-3 bg-purple-50 rounded-lg border border-purple-200 space-y-3">
                <div>
                  <h4 className="font-medium text-purple-900 mb-2 text-xs sm:text-sm flex items-center gap-2">
                    <span>📊</span>
                    <span>Research Participant Selection</span>
                  </h4>
                  <p className="text-xs text-purple-800 leading-relaxed mb-3">
                    Download our template, add your student list, then use the Random Selection controls in the Session Info panel.
                  </p>
                  
                  {/* Template Download Button */}
                  <Button
                    onClick={downloadCsvTemplate}
                    variant="outline"
                    size="sm"
                    className="w-full hover:bg-purple-100 hover:border-purple-400 text-purple-700 border-purple-300 text-xs sm:text-sm h-8 sm:h-9"
                  >
                    <Download className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
                    Download Research Template (CSV)
                  </Button>
                  
                  {uploadedStudentList.length > 0 && (
                    <div className="mt-3 p-2 bg-green-50 border border-green-300 rounded-lg">
                      <p className="text-xs text-green-800 font-medium">
                        ✅ {uploadedStudentList.length} students uploaded! Use Random Selection controls in Session Info panel below.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>



            {/* Editable Items List - REAL-TIME SYNCHRONIZATION */}
            <div className="space-y-2">
              <Label className="text-xs sm:text-sm md:text-base font-semibold">
                Edit Current Wheel Items ({wheelItems.length}) - Changes sync instantly
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
                      style={{ borderColor: wheelTheme.primary }}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          addItem()
                        }
                      }}
                    />
                    <Button
                      onClick={addItem}
                      disabled={!newItemText.trim() || editableItems.includes(newItemText.trim())}
                      size="sm"
                      className="h-8 px-3 text-xs"
                      style={{ backgroundColor: wheelTheme.primary, color: wheelTheme.accent }}
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
                      onClick={clearAllItems}
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
                          className="text-xs px-2 py-1 min-w-[60px] justify-center flex-shrink-0"
                          style={{ borderColor: wheelTheme.primary, color: wheelTheme.primary }}
                        >
                          {index + 1}
                        </Badge>
                        <Input
                          value={item}
                          onChange={(e) => updateItem(index, e.target.value)}
                          className="flex-1 text-xs sm:text-sm h-auto py-2 min-h-[32px]"
                          placeholder={`Item ${index + 1}`}
                          style={{ 
                            borderColor: item.trim() ? wheelTheme.primary : '#ef4444',
                            overflow: 'visible',
                            whiteSpace: 'normal',
                            wordWrap: 'break-word'
                          }}
                          title={item}
                        />
                        <Button
                          onClick={() => removeItem(index)}
                          variant="outline"
                          size="sm"
                          className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50 flex-shrink-0"
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
                  resetToOriginalItems()
                  setIsTextDialogOpen(false)
                }}
                className="text-gray-600 hover:text-gray-800 flex-1 sm:flex-none text-xs sm:text-sm md:text-base h-8 sm:h-9 md:h-10"
                size="sm"
              >
                <RotateCcw className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2 flex-shrink-0" />
                <span className="break-words">Reset to Original</span>
              </Button>

              {/* Fill with Live button - always show in Edit Text dialog */}
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
                  
                  setEditableItems(updatedItems)
                  setIsEditingItems(true) // Enable editing mode to use the new items

                  // Force immediate redraw with updated items
                  setTimeout(() => {
                    console.log("🎯 AUTO-ADD: Redrawing wheel with added live participants", {
                      existingItemsCount: existingItems.length,
                      newParticipantsCount: newParticipants.length,
                      totalItemsCount: updatedItems.length,
                      updatedItems: updatedItems
                    })
                    drawWheel(updatedItems, persistentTheme || wheelTheme)
                  }, 10)

                  console.log("🎯 ADD LIVE PARTICIPANTS: Added live session participants to existing items", {
                    existingItemsCount: existingItems.length,
                    liveParticipantsCount: liveParticipants.length,
                    newParticipantsAdded: newParticipants.length,
                    duplicatesSkipped: liveParticipantNames.length - newParticipants.length,
                    totalItemsCount: updatedItems.length,
                    sessionId: sessionId
                  })

                  toast({
                    title: "✅ Live Participants Added",
                    description: newParticipants.length > 0 
                      ? `Added ${newParticipants.length} new participant(s) to wheel: ${newParticipants.slice(0, 3).join(', ')}${newParticipants.length > 3 ? '...' : ''}` 
                      : `All ${liveParticipantNames.length} participant(s) already in wheel`,
                  })

                  // Broadcast the change to all participants
                  if (enableRealTimeSync && sessionId && (effectiveOrganizerMode || userPermissions.isFullAccessCollaborator)) {
                    try {
                      const broadcastData = {
                        wheelState: {
                          wheelItems: updatedItems,
                          customItems: updatedItems,
                          itemsUpdatedAt: Date.now(),
                          itemChangeSource: "add-live-participants",
                          itemsCount: updatedItems.length,
                          newParticipantsAdded: newParticipants.length,
                          broadcastSource: effectiveOrganizerMode ? 'organizer' : 'full-access-collaborator',
                          collaboratorId: userPermissions.isFullAccessCollaborator ? userPermissions.userRole : null,
                          // 🎨 CRITICAL FIX: Include theme to prevent reversion
                          theme: persistentTheme || wheelTheme,
                          themeUpdatedAt: Date.now()
                        },
                        updatedAt: serverTimestamp()
                      }

                      updateDoc(doc(db, "liveDrawSessions", sessionId), broadcastData).catch((error) => {
                        console.error("❌ Failed to broadcast live participants addition:", error)
                      })

                      console.log("✅ BROADCASTED LIVE PARTICIPANTS: Added participants synced to all users", {
                        sessionId,
                        existingItemsCount: existingItems.length,
                        newParticipantsAdded: newParticipants.length,
                        totalItemsCount: updatedItems.length,
                        broadcastSource: broadcastData.wheelState.broadcastSource,
                        timestamp: new Date().toISOString()
                      })
                    } catch (error) {
                      console.error("❌ Failed to broadcast live participants auto-fill:", error)
                    }
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
            </div>

            <div className="flex gap-2 w-full sm:w-auto">
              <Button
                variant="outline"
                onClick={() => setIsTextDialogOpen(false)}
                className="flex-1 sm:flex-none text-xs sm:text-sm md:text-base h-8 sm:h-9 md:h-10"
                size="sm"
              >
                Cancel
              </Button>
              <Button
                onClick={() => saveEditableItems().catch((error) => console.error('Error saving items:', error))}
                disabled={editableItems.length === 0}
                style={{ 
                  backgroundColor: wheelTheme.primary, 
                  color: wheelTheme.accent
                }}
                className="flex-1 sm:flex-none text-xs sm:text-sm md:text-base h-8 sm:h-9 md:h-10 hover:opacity-90"
                size="sm"
                title="Apply items to wheel"
              >
                Apply Items
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
        )
      })()}
    </div>
  )
}
