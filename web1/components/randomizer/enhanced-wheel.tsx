"use client"

import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { toast } from "@/hooks/use-toast"
import { Shuffle, Play, Pause, RotateCcw, Trophy, Users, Settings, Share2, Eye, Palette, Edit3 } from "lucide-react"
import confetti from "canvas-confetti"
import { db } from "@/lib/firebase"
import { doc, updateDoc, serverTimestamp, onSnapshot, getDoc } from "firebase/firestore"

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
}

  // Helper function to sanitize objects for Firebase (remove undefined values)
  const sanitizeForFirebase = (obj: any): any => {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          // Recursively sanitize nested objects
          sanitized[key] = sanitizeForFirebase(value);
        } else if (Array.isArray(value)) {
          // Sanitize arrays but keep them as arrays
          sanitized[key] = value.map(item =>
            typeof item === 'object' && item !== null ? sanitizeForFirebase(item) : item
          );
        } else {
          sanitized[key] = value;
        }
      }
    }
    return sanitized;
  };

interface EnhancedWheelProps {
    participants: Participant[]
    onSpinComplete?: (result: SpinResult) => void
    onSettingsChange?: (settings: WheelSettings) => void
    isLiveMode?: boolean
    sessionId?: string
    studentMode?: boolean // New prop for student participation mode
    disabled?: boolean // Allow disabling the wheel
    wheelTitle?: string // Title to display on the wheel
    selectedWheelType?: {
      id: string
      title: string
      description: string
      icon: string
      category: string
      defaultItems: string[]
      color: string
      isCustomizable: boolean
    } | null // Selected wheel type from picker-wheel-types.ts
    // Real-time synchronization props
    enableRealTimeSync?: boolean // Enable Firebase real-time synchronization
    organizerMode?: boolean // True if this is the organizer's wheel (can trigger spins)
    onWinnersDetected?: (winners: Participant[]) => void // Callback when winners are detected
    isSpinning?: boolean // External spinning state from real-time sync for participants
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
  isSpinning: externalIsSpinning
}: EnhancedWheelProps) {
  // Enhanced logging for prop values
  console.log("[EnhancedWheel] Props:", {
    organizerMode,
    isLiveMode,
    studentMode,
    disabled,
    wheelItemsLength: participants?.length || 0,
    sessionId
  });

  // Debug logging for received props
  if (process.env.NODE_ENV === 'development') {
    console.log("🎡 EnhancedWheel received selectedWheelType:", {
      id: selectedWheelType?.id || 'none',
      title: selectedWheelType?.title,
      wheelTitle: wheelTitle,
      itemsCount: selectedWheelType?.defaultItems?.length || 0,
      items: selectedWheelType?.defaultItems?.slice(0, 3) || [],
      hasItems: !!selectedWheelType?.defaultItems?.length,
      participantsCount: participants?.length || 0
    })
  }

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isSpinning, setIsSpinning] = useState(false)
  const [currentAngle, setCurrentAngle] = useState(0)
  const [winners, setWinners] = useState<Participant[]>([])
  const [spinHistory, setSpinHistory] = useState<SpinResult[]>([])
  const [showResults, setShowResults] = useState(false)
  const [settings, setSettings] = useState<WheelSettings>({
    numberOfWinners: 1,
    spinDuration: 3000,
    showConfetti: true,
    playSound: true,
    congratsMessage: "Congratulations, {name}! 🎉",
    theme: "academic",
    colorScheme: "school"
  })

  // State for editing wheel items - disabled for participants
  const [isEditingItems, setIsEditingItems] = useState(false)
  const [editableItems, setEditableItems] = useState<string[]>([])
  const [newItemText, setNewItemText] = useState("")

  // State for wheel theme customization - disabled for participants
  const [isCustomizingTheme, setIsCustomizingTheme] = useState(false)
  const [isThemeDialogOpen, setIsThemeDialogOpen] = useState(false)
  const [isTextDialogOpen, setIsTextDialogOpen] = useState(false)
  const [customWheelText, setCustomWheelText] = useState("")
  const [wheelTheme, setWheelTheme] = useState({
    primary: "#8e0b16",
    secondary: "#66181E",
    accent: "#ffffff",
    background: "#f8f9fa"
  })

  // Enhanced real-time synchronization state
  const [sessionListener, setSessionListener] = useState<any>(null)
  const [pendingWinners, setPendingWinners] = useState<Participant[] | null>(null)
  const [listenerSetup, setListenerSetup] = useState(false)
  const [lastWinnerCheck, setLastWinnerCheck] = useState(0)
  const [syncPhase, setSyncPhase] = useState<'idle' | 'syncing' | 'synced' | 'error'>('idle')
  const [collaborativeMode, setCollaborativeMode] = useState(false)
  const [spinTimestamp, setSpinTimestamp] = useState<number>(0)
  const [lastReceivedSpinData, setLastReceivedSpinData] = useState<any>(null)

  // Monitor winner changes and trigger effects
  useEffect(() => {
    if (winners.length > 0 && !organizerMode) {
      console.log("🎯 WINNERS EFFECT: Winners detected, ensuring popup display", {
        winnerCount: winners.length,
        winners: winners,
        sessionId: sessionId
      })

      // Notify parent component that winners were detected
      if (onWinnersDetected) {
        console.log("🎯 WINNERS EFFECT: Notifying parent component of winners")
        onWinnersDetected(winners)
      }

      // Trigger confetti for participants when winners are set
      triggerConfetti()
    }
  }, [winners, organizerMode, sessionId, onWinnersDetected])

  // FIXED: Handle external spinning state for participant synchronization
  useEffect(() => {
    if (externalIsSpinning && !isSpinning && !organizerMode) {
      console.log("🎯 PARTICIPANT WHEEL: External spinning triggered, starting synchronized animation", {
        externalIsSpinning,
        isSpinning,
        organizerMode,
        enableRealTimeSync,
        sessionId,
        timestamp: new Date().toISOString()
      })

      // For participants receiving external spinning state, we trigger the local spinning animation
      // This will work even if Firebase permission errors occur
      triggerSynchronizedCollaborativeSpin()
    }
  }, [externalIsSpinning, isSpinning, organizerMode]) // externalIsSpinning is from props, aliased from isSpinning

  // ADDED: Fallback mechanism for cases where Firebase real-time updates fail
  // This ensures participants always see wheel animation even with permission errors
  useEffect(() => {
    if (externalIsSpinning && !isSpinning && !organizerMode && !enableRealTimeSync) {
      console.log("🔄 PARTICIPANT FALLBACK: Firebase sync disabled, triggering independent animation")

      // Set a fallback animation duration that matches typical spin time
      const fallbackDuration = 3500; // 3.5 seconds typical spin duration

      triggerSynchronizedCollaborativeSpin()

      // After animation period, check if we have winners to announce
      setTimeout(() => {
        if (!isSpinning && pendingWinners && pendingWinners.length > 0 && !organizerMode) {
          console.log("🎯 FALLBACK WINNER ANNOUNCEMENT: Announcing winners after animation complete")
          setWinners(pendingWinners)
          setPendingWinners(null)
          setShowResults(true)
          triggerConfetti()
        }
      }, fallbackDuration + 500)
    }
  }, [externalIsSpinning, isSpinning, organizerMode, enableRealTimeSync, pendingWinners])

  // Enhanced collaborative spin function with precision synchronization
  const triggerSynchronizedCollaborativeSpin = () => {
    if (isSpinning || wheelItems.length === 0) {
      console.log("⚠️ COLLABORATIVE SPIN CANCELLED:", {
        alreadySpinning: isSpinning,
        noItems: wheelItems.length === 0,
        reason: isSpinning ? "Already spinning" : "No wheel items"
      })
      return
    }

    console.log("🔄 COLLABORATIVE SPIN: Enhanced synchronization started", {
      wheelItemsLength: wheelItems.length,
      organizerMode,
      enableRealTimeSync,
      participantMode: !organizerMode,
      collaborativeMode,
      timestamp: new Date().toISOString()
    })

    // Set spinning state and collaborative mode
    setIsSpinning(true)
    setShowResults(false)
    setCollaborativeMode(true)
    setSyncPhase('syncing')

    // 🔧 PERFECT VISUAL SYNCHRONIZATION: Use stored organizer parameters with fallback
    let spinDuration = 3500
    let totalRotation = 0
    let finalAngle = 0
    let spins = 0
    let synchronizationType = "participant-only-fallback"

    // 🔧 PRIORITY 1: Always use the most recently stored organizer parameters for perfect sync
    if (lastReceivedSpinData && lastReceivedSpinData.spinDuration && lastReceivedSpinData.totalRotation !== undefined) {
      // Use organizer's exact parameters for perfect synchronization
      spinDuration = lastReceivedSpinData.spinDuration
      totalRotation = lastReceivedSpinData.totalRotation
      finalAngle = lastReceivedSpinData.finalAngle || Math.random() * 2 * Math.PI
      spins = lastReceivedSpinData.spins || Math.floor(totalRotation / (2 * Math.PI))
      synchronizationType = "organizer-parameters-guaranteed-visual-match"
    } else if (externalIsSpinning && externalIsSpinning === true) {
      // 🔧 FALLBACK: Use external spinning state for coordinated fallback (less precise)
      spinDuration = settings.spinDuration || 3500
      spins = 6.5 + Math.random() * 0.5 // Controlled variation but still reproducible-ish
      finalAngle = Math.random() * 2 * Math.PI
      totalRotation = spins * 2 * Math.PI + finalAngle
      synchronizationType = "external-trigger-controlled-fallback"
    } else {
      // 🔧 ULTIMATE FALLBACK: Independent participant mode
      spinDuration = 3500
      spins = 6 + Math.random() * 2
      finalAngle = Math.random() * 2 * Math.PI
      totalRotation = spins * 2 * Math.PI + finalAngle
      synchronizationType = "independent-participant-fallback"
    }

    const spinStartTime = Date.now()
    setSpinTimestamp(spinStartTime)
    setSyncPhase('syncing')

    console.log("🎯 COLLABORATIVE SPIN PARAMETERS:", {
      spinDuration: `${spinDuration}ms`,
      totalRotation: `${(totalRotation / (2 * Math.PI)).toFixed(2)} full rotations`,
      finalAngle: `${(finalAngle * 180 / Math.PI).toFixed(1)}°`,
      spins: spins.toFixed(1),
      synchronizationType,
      collaborativeMode: true,
      coordinationMode: "enhanced-precision",
      timestamp: new Date().toISOString()
    })

    // Animate the wheel
    const startTime = performance.now()
    let lastFrameTime = startTime
    let lastStateUpdate = startTime
    const FRAME_RATE = 60
    const FRAME_INTERVAL = 1000 / FRAME_RATE
    const STATE_UPDATE_INTERVAL = FRAME_INTERVAL * 3
    const extendedDuration = Math.max(spinDuration + 500, spinDuration * 1.3)

    const animate = () => {
      const currentTime = performance.now()
      const elapsed = currentTime - startTime

      if (currentTime - lastFrameTime < FRAME_INTERVAL) {
        requestAnimationFrame(animate)
        return
      }

      const progress = Math.min(elapsed / extendedDuration, 1)

      let easeValue
      if (progress < 0.7) {
        const adjustedProgress = progress / 0.7
        easeValue = adjustedProgress * adjustedProgress * adjustedProgress * 0.88
      } else {
        const decelerationPhase = (progress - 0.7) / 0.3
        const easedDecel = 1 - Math.pow(1 - decelerationPhase, 5)
        const overshoot = 1 + (Math.sin(decelerationPhase * Math.PI * 2.5) * 0.0012 * (1 - decelerationPhase))
        easeValue = 0.88 + (easedDecel * 0.12 * overshoot)
      }

      const currentRotation = progress >= 1 ? totalRotation : totalRotation * easeValue

      // Draw directly on canvas for smooth animation
      if (canvasRef.current) {
        const canvas = canvasRef.current
        const ctx = canvas.getContext("2d")
        if (ctx && wheelItems.length > 0) {
          drawWheelAtAngle(ctx, canvas, currentRotation)
        }
      }

      if (currentTime - lastStateUpdate >= STATE_UPDATE_INTERVAL || progress >= 1) {
        setCurrentAngle(currentRotation)
        lastStateUpdate = currentTime
      }

      if (progress < 1) {
        lastFrameTime = currentTime
        requestAnimationFrame(animate)
      } else {
          console.log("✅ PARTICIPANT SPIN COMPLETE: Animation finished, ready for winners")
          setIsSpinning(false)
          setSyncPhase('synced')

          // FIXED: Clear animation flag to allow winner display
          setTimeout(() => {
            console.log("🔄 PARTICIPANT: Animation cleanup - ready for winner announcement")
            setIsSpinning(false)
            // Trigger state update to ensure winners show properly
            setCollaborativeMode(false)
          }, 100)
        }
      }

    requestAnimationFrame(animate)
  }
  
  // Determine if editing should be allowed (NOT in student mode or live mode)
  const canEdit = !studentMode && !isLiveMode
  
  // Additional safety check for participant restrictions
  const isParticipantView = studentMode || isLiveMode
  const allowItemEditing = canEdit && !isParticipantView
  const allowThemeEditing = canEdit && !isParticipantView
  
  // Prevent editing states from being set if user is participant
  useEffect(() => {
    if (isParticipantView) {
      setIsEditingItems(false)
      setIsCustomizingTheme(false)
    }
  }, [isParticipantView])

  // School color scheme
  const schoolColors = {
    primary: "#8e0b16",
    secondary: "#66181E",
    accent: "#ffffff",
    background: "#f8f9fa"
  }

  // Theme presets for wheel customization
  const themePresets = [
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
  ]

  // Cache wheel items to prevent unnecessary recalculations with enhanced debugging
  const wheelItems = useMemo(() => {
    console.log("🔍 wheelItems useMemo recalculating:", {
      isEditingItems,
      editableItemsLength: editableItems.length,
      editableItemsPreview: editableItems.slice(0, 3),
      selectedWheelTypeId: selectedWheelType?.id,
      participantsLength: participants?.length || 0
    })
    
    // PRIORITY 1: Use editable items if in edit mode (CUSTOM TEXT)
    if (isEditingItems && editableItems.length > 0) {
      console.log("🎯 USING CUSTOM EDITABLE ITEMS:", {
        source: 'editableItems',
        items: editableItems.slice(0, 5),
        totalCount: editableItems.length,
        fullItems: editableItems
      })
      return editableItems
    }

    let items: string[] = []

    // PRIORITY 2: Use selected wheel type items (colors, countries, etc.)
    if (selectedWheelType && selectedWheelType.defaultItems && selectedWheelType.defaultItems.length > 0) {
      items = selectedWheelType.defaultItems
      console.log("🌐 USING WHEEL TYPE ITEMS:", {
        source: 'selectedWheelType.defaultItems',
        wheelType: selectedWheelType.id,
        items: items.slice(0, 3),
        totalCount: items.length
      })
    }
    // PRIORITY 3: Fall back to participant names for personal/team wheels
    else if (participants && participants.length > 0) {
      items = participants.map(p => p.name)
      console.log("👥 USING PARTICIPANT ITEMS:", {
        source: 'participants',
        participants: items.slice(0, 3),
        totalCount: items.length
      })
    }
    // PRIORITY 4: Ultimate fallback
    else {
      items = ["Option 1", "Option 2", "Option 3", "Option 4", "Option 5"]
      console.log("🔄 USING FALLBACK ITEMS:", {
        source: 'fallback',
        items: items
      })
    }

    return items
  }, [selectedWheelType, participants, isEditingItems, editableItems])

  // Determine if this is a participant-based wheel or predefined items wheel
  const isParticipantBased = !selectedWheelType || selectedWheelType.category === 'personal' || selectedWheelType.id === 'basic-picker' || selectedWheelType.id === 'team-picker'

  // Debug logging only in development
  if (process.env.NODE_ENV === 'development') {
    console.log("🎯 EnhancedWheel Debug:", {
      selectedWheelType: selectedWheelType?.id,
      wheelTitle: wheelTitle,
      wheelItemsLength: wheelItems.length,
      wheelItems: wheelItems.slice(0, 3), // Show first 3 items only
      isParticipantBased,
      hasDefaultItems: selectedWheelType?.defaultItems?.length || 0
    })

    // Enhanced logging for wheel type changes
    if (selectedWheelType) {
      console.log("🎡 WHEEL TYPE ACTIVE:", {
        id: selectedWheelType.id,
        title: selectedWheelType.title,
        itemsCount: selectedWheelType.defaultItems?.length || 0
      })
    }
  }

  // Special logging for specific wheel types (development only)
  if (process.env.NODE_ENV === 'development') {
    if (selectedWheelType?.id === 'country-picker') {
      console.log("🌍 COUNTRY PICKER:", {
        itemsCount: wheelItems.length,
        countries: wheelItems.slice(0, 3).join(', ') + (wheelItems.length > 3 ? '...' : '')
      })
    }

    if (selectedWheelType?.id === 'date-picker') {
      console.log("📅 DATE PICKER:", {
        itemsCount: wheelItems.length,
        days: wheelItems.slice(0, 3).join(', ') + (wheelItems.length > 3 ? '...' : '')
      })
    }
  }

  // OPTIMIZED: Shared wheel drawing logic
  const drawWheelContent = useCallback((ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, centerX: number, centerY: number, radius: number, angle: number) => {
    wheelItems.forEach((item, index) => {
      const segmentAngle = (2 * Math.PI) / wheelItems.length
      const startAngle = index * segmentAngle + angle
      const endAngle = startAngle + segmentAngle

      // Alternate colors for better visibility using custom theme
      const isEven = index % 2 === 0
      ctx.fillStyle = isEven ? wheelTheme.primary : wheelTheme.secondary

      ctx.beginPath()
      ctx.moveTo(centerX, centerY)
      ctx.arc(centerX, centerY, radius, startAngle, endAngle)
      ctx.closePath()
      ctx.fill()

      // Draw segment border - thicker for larger wheel
      ctx.strokeStyle = wheelTheme.accent
      ctx.lineWidth = 3
      ctx.stroke()

      // Draw text with optimized font calculation
      ctx.save()
      ctx.translate(centerX, centerY)
      ctx.rotate(startAngle + segmentAngle / 2)
      ctx.textAlign = "left"
      ctx.fillStyle = wheelTheme.accent
      const baseFontSize = Math.min(canvas.width / 25, 18)
      const fontSize = Math.max(baseFontSize - Math.max(0, (wheelItems.length - 8) * 0.5), 10)
      ctx.font = `bold ${fontSize}px Arial`

      const maxTextLength = Math.max(12, 20 - Math.floor(wheelItems.length / 4))
      const text = item.length > maxTextLength ? item.substring(0, maxTextLength - 3) + "..." : item

      ctx.fillText(text, radius * 0.35, 5)
      ctx.restore()
    })

    // Draw center circle and pointer with optimized calculations
    const centerRadius = Math.max(35, canvas.width / 12)
    ctx.beginPath()
    ctx.arc(centerX, centerY, centerRadius, 0, 2 * Math.PI)
    ctx.fillStyle = wheelTheme.accent
    ctx.fill()
    ctx.strokeStyle = wheelTheme.primary
    ctx.lineWidth = 4
    ctx.stroke()

    // Draw pointer with enhanced visibility and shadow effects
    const pointerSize = Math.max(25, canvas.width / 18)
    ctx.save()
    ctx.shadowColor = 'rgba(0, 0, 0, 0.7)'
    ctx.shadowBlur = 12
    ctx.shadowOffsetX = 4
    ctx.shadowOffsetY = 4

    // Main pointer triangle (larger and more visible)
    ctx.beginPath()
    ctx.moveTo(centerX + radius - pointerSize, centerY)
    ctx.lineTo(centerX + radius + pointerSize * 1.8, centerY - pointerSize)
    ctx.lineTo(centerX + radius + pointerSize * 1.8, centerY + pointerSize)
    ctx.closePath()
    ctx.fillStyle = '#ffffff'
    ctx.fill()
    ctx.strokeStyle = wheelTheme.primary
    ctx.lineWidth = 5
    ctx.stroke()

    // Inner highlight triangle
    ctx.beginPath()
    ctx.moveTo(centerX + radius - pointerSize * 0.6, centerY)
    ctx.lineTo(centerX + radius + pointerSize * 1.2, centerY - pointerSize * 0.7)
    ctx.lineTo(centerX + radius + pointerSize * 1.2, centerY + pointerSize * 0.7)
    ctx.closePath()
    ctx.fillStyle = wheelTheme.primary
    ctx.fill()

    // Add a secondary shadow for extra depth
    ctx.shadowColor = 'rgba(0, 0, 0, 0.3)'
    ctx.shadowBlur = 6
    ctx.shadowOffsetX = 2
    ctx.shadowOffsetY = 2

    // Outer border for maximum visibility
    ctx.strokeStyle = '#000000'
    ctx.lineWidth = 2
    ctx.stroke()

    ctx.restore()
  }, [wheelItems, wheelTheme])

  // Standard draw wheel function
  const drawWheel = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || wheelItems.length === 0) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const centerX = canvas.width / 2
    const centerY = canvas.height / 2
    const radius = Math.min(centerX, centerY) - 15

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    drawWheelContent(ctx, canvas, centerX, centerY, radius, currentAngle)
  }, [wheelItems, currentAngle, drawWheelContent])

  // OPTIMIZED: Direct canvas drawing for smooth animation
  const drawWheelAtAngle = useCallback((ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, angle: number) => {
    if (wheelItems.length === 0) return

    const centerX = canvas.width / 2
    const centerY = canvas.height / 2
    const radius = Math.min(centerX, centerY) - 15

    // Clear canvas with optimized clearing
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    drawWheelContent(ctx, canvas, centerX, centerY, radius, angle)
  }, [wheelItems, drawWheelContent])

  // Memoize onSpinComplete callback to prevent dependency array changes
  const memoizedOnSpinComplete = useCallback((result: SpinResult) => {
    if (onSpinComplete) {
      onSpinComplete(result)
    }
  }, [onSpinComplete])

  useEffect(() => {
    drawWheel()
  }, [drawWheel])

  // Initialize editable items when wheel type changes
  useEffect(() => {
    if (selectedWheelType?.defaultItems) {
      setEditableItems([...selectedWheelType.defaultItems])
    } else if (participants?.length > 0) {
      setEditableItems(participants.map(p => p.name))
    } else {
      setEditableItems(["Option 1", "Option 2", "Option 3", "Option 4", "Option 5"])
    }
  }, [selectedWheelType, participants])

  // Initialize wheel theme with school colors
  useEffect(() => {
    setWheelTheme({
      primary: schoolColors.primary,
      secondary: schoolColors.secondary,
      accent: schoolColors.accent,
      background: schoolColors.background
    })
  }, [])

  // Enhanced redraw wheel when editableItems change with better debugging
  useEffect(() => {
    console.log("🔄 editableItems useEffect triggered:", {
      isEditingItems,
      editableItemsLength: editableItems.length,
      editableItems: editableItems.slice(0, 5),
      wheelItemsLength: wheelItems.length
    })
    
    if (isEditingItems && editableItems.length > 0) {
      console.log("🎨 Starting wheel redraw sequence for editableItems:", {
        items: editableItems.slice(0, 5),
        totalCount: editableItems.length,
        isEditingMode: isEditingItems
      })
      
      // Immediate redraw
      drawWheel()
      
      // Multiple redraw attempts with different timings to ensure it works
      const redrawTimer1 = setTimeout(() => {
        console.log("🎨 Redraw timer 1 (50ms)")
        drawWheel()
      }, 50)
      
      const redrawTimer2 = setTimeout(() => {
        console.log("🎨 Redraw timer 2 (150ms)")
        drawWheel()
      }, 150)
      
      const redrawTimer3 = setTimeout(() => {
        console.log("🎨 Redraw timer 3 (300ms)")
        drawWheel()
      }, 300)
      
      const redrawTimer4 = setTimeout(() => {
        console.log("🎨 Redraw timer 4 (500ms)")
        drawWheel()
      }, 500)
      
      return () => {
        clearTimeout(redrawTimer1)
        clearTimeout(redrawTimer2)
        clearTimeout(redrawTimer3)
        clearTimeout(redrawTimer4)
      }
    }
  }, [editableItems, isEditingItems, drawWheel])

  // Redraw wheel when selectedWheelType changes
  useEffect(() => {
    if (selectedWheelType) {
      console.log("🔄 Redrawing wheel for selectedWheelType:", selectedWheelType.id)
      // Small delay to ensure DOM is ready
      setTimeout(() => drawWheel(), 100)
    }
  }, [selectedWheelType, drawWheel])

  // Initial draw when component mounts
  useEffect(() => {
    console.log("🎨 Initial wheel draw")
    const timer = setTimeout(() => drawWheel(), 200)
    return () => clearTimeout(timer)
  }, [])

  // Real-time synchronization listener
  useEffect(() => {
    // Allow both participants and collaborators to listen for updates
    // Participants: !organizerMode, Collaborators: organizerMode && isLiveMode
    if (enableRealTimeSync && sessionId && (!organizerMode || (organizerMode && isLiveMode)) && !listenerSetup) {
      console.log("🔄 Setting up real-time listener for wheel sync", {
        isOrganizer: organizerMode,
        isLiveMode: isLiveMode,
        sessionId: sessionId,
        enableRealTimeSync: enableRealTimeSync,
        studentMode: studentMode,
        listenerAlreadySetup: listenerSetup
      })

      setListenerSetup(true)

      const unsubscribe = onSnapshot(
        doc(db, "liveDrawSessions", sessionId),
        (docSnapshot) => {
          console.log("🔥 LISTENER TRIGGERED - Session update received", {
            sessionId: sessionId,
            organizerMode: organizerMode,
            studentMode: studentMode,
            timestamp: new Date().toISOString()
          })
          if (!docSnapshot.exists()) {
            console.log("⚠️ Session document doesn't exist")
            return
          }

          const sessionData = docSnapshot.data()
          const wheelState = sessionData.wheelState

          console.log("📡 Received session update:", {
            currentState: sessionData.currentState,
            isSpinning: sessionData.isSpinning,
            wheelState: wheelState,
            hasWheelState: !!wheelState,
            localIsSpinning: isSpinning,
            listenerActive: true,
            winners: sessionData.winners,
            hasWinners: !!(sessionData.winners && sessionData.winners.length > 0)
          })

          if (wheelState) {
            // Handle spin start - FIXED FOR MULTIPLE SPINS
            if (wheelState.isSpinning) {
              console.log("🎯 SPIN START: Received spin start from organizer - triggering synchronized animation", {
                wheelStateIsSpinning: wheelState.isSpinning,
                localIsSpinning: isSpinning,
                hasSpinParams: !!(wheelState.spinDuration && wheelState.totalRotation && wheelState.finalAngle),
                spinDuration: wheelState.spinDuration,
                totalRotation: wheelState.totalRotation,
                finalAngle: wheelState.finalAngle,
                organizerMode: organizerMode,
                studentMode: studentMode,
                sessionId: sessionId,
                winnerStateReset: winners.length,
                showResultsReset: showResults
              })

              // ALWAYS trigger spin animation for participants, even if !isSpinning check fails
              setIsSpinning(true)
              setShowResults(false)

              // Clear any pending winners from previous spins
              setPendingWinners(null)
              setWinners([])

              // 🔧 CRITICAL: Store organizer's EXACT spin parameters for visual synchronization
              const organizersSpinParams = {
                spinDuration: wheelState.spinDuration || settings.spinDuration || 3000,
                totalRotation: wheelState.totalRotation || (6.5 + Math.random() * 0.5) * 2 * Math.PI,
                finalAngle: wheelState.finalAngle || Math.random() * 2 * Math.PI,
                spins: wheelState.spins || Math.floor((wheelState.totalRotation || 6.5 * 2 * Math.PI) / (2 * Math.PI)) || 6
              }

              // Store these parameters for use in animation
              setLastReceivedSpinData({
                ...wheelState,
                spinDuration: organizersSpinParams.spinDuration,
                totalRotation: organizersSpinParams.totalRotation,
                finalAngle: organizersSpinParams.finalAngle,
                spins: organizersSpinParams.spins,
                // CRITICAL: Store winner information if available
                winners: wheelState.winners || [],
                winnerNames: (wheelState.winners as any)?.map((w: any) => w.name) || []
              })

              // 🔧 PASS: Direct visual synchronization - same parameters guarantee same landing position
              const spinDuration = organizersSpinParams.spinDuration
              const totalRotation = organizersSpinParams.totalRotation
              const finalAngle = organizersSpinParams.finalAngle
              const spins = organizersSpinParams.spins

              console.log("🎯 PERFECT VISUAL SYNCHRONIZATION - Using organizer's exact parameters:", {
                spinDuration: `${spinDuration}ms`,
                totalRotation: `${(totalRotation / (2 * Math.PI)).toFixed(2)} rotations`,
                finalAngle: `${(finalAngle * 180 / Math.PI).toFixed(1)}°`,
                spins: `${spins} full spins`,
                willLandOnSameSpot: true,
                guaranteedVisualConsistency: true,
                winnerCalculationReproducibility: true
              })

              const startTime = performance.now()
              let lastFrameTime = startTime
              let lastStateUpdate = startTime
              const FRAME_RATE = 60
              const FRAME_INTERVAL = 1000 / FRAME_RATE
              const STATE_UPDATE_INTERVAL = FRAME_INTERVAL * 3
              const extendedDuration = Math.max(spinDuration + 500, spinDuration * 1.3)

              const animate = () => {
                const currentTime = performance.now()
                const elapsed = currentTime - startTime

                if (currentTime - lastFrameTime < FRAME_INTERVAL) {
                  requestAnimationFrame(animate)
                  return
                }

                const progress = Math.min(elapsed / extendedDuration, 1)

                let easeValue
                if (progress < 0.7) {
                  const adjustedProgress = progress / 0.7
                  easeValue = adjustedProgress * adjustedProgress * adjustedProgress * 0.88
                } else {
                  const decelerationPhase = (progress - 0.7) / 0.3
                  const easedDecel = 1 - Math.pow(1 - decelerationPhase, 5)
                  const overshoot = 1 + (Math.sin(decelerationPhase * Math.PI * 2.5) * 0.0012 * (1 - decelerationPhase))
                  easeValue = 0.88 + (easedDecel * 0.12 * overshoot)
                }

                const currentRotation = progress >= 1 ? totalRotation : totalRotation * easeValue

                if (canvasRef.current) {
                  const canvas = canvasRef.current
                  const ctx = canvas.getContext("2d")
                  if (ctx && wheelItems.length > 0) {
                    drawWheelAtAngle(ctx, canvas, currentRotation)
                  }
                }

                if (currentTime - lastStateUpdate >= STATE_UPDATE_INTERVAL || progress >= 1) {
                  setCurrentAngle(currentRotation)
                  lastStateUpdate = currentTime
                }

                if (progress < 1) {
                  lastFrameTime = currentTime
                  requestAnimationFrame(animate)
                } else {
                   // Spin complete - check for pending winners
                   console.log("🎯 ANIMATION COMPLETE: Spin animation finished - checking for pending winners", {
                     organizerMode: organizerMode,
                     studentMode: studentMode,
                     hasPendingWinners: !!(pendingWinners && pendingWinners.length > 0),
                     pendingWinnersCount: pendingWinners?.length || 0,
                     sessionId: sessionId
                   })

                   // FIXED: Always set isSpinning to false when animation completes
                   setIsSpinning(false)

                   // FIXED: More reliable winner announcement timing
                   setTimeout(() => {
                     if (!organizerMode && !isSpinning) {
                       console.log("🎯 PARTICIPANT WINNERS CHECK: Animation complete, checking for winners", {
                         hasPendingWinners: !!(pendingWinners && pendingWinners.length > 0),
                         syncPhase: syncPhase
                       })

                       // Show winners immediately once available
                       if (pendingWinners && pendingWinners.length > 0) {
                         console.log("✅ PARTICIPANT WINNERS: Displaying winners after animation", {
                           winners: pendingWinners,
                           winnerCount: pendingWinners.length,
                           timestamp: new Date().toISOString()
                         })

                         setWinners(pendingWinners)
                         setShowResults(true)
                         setPendingWinners(null)

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
                         triggerConfetti()
                       } else {
                         console.log("⏳ PARTICIPANT: Animation complete but waiting for winner data")
                       }
                     }
                   }, 200) // Increased delay for better reliability
                 }
              }

              requestAnimationFrame(animate)
            }

            // Handle spin completion with winners
            if (!wheelState.isSpinning && wheelState.winners && wheelState.winners.length > 0) {
              console.log("🎯 WINNERS RECEIVED: Received winners from organizer:", {
                winnerCount: wheelState.winners.length,
                winners: wheelState.winners,
                organizerMode: organizerMode,
                studentMode: studentMode,
                sessionId: sessionId,
                localIsSpinning: isSpinning,
                hasSpinCompletionTime: !!wheelState.completedAt,
                spinCompletionTime: wheelState.completedAt
              })

              // For participants: Always store winners and wait for synchronization
              if (!organizerMode) {
                console.log("🎯 PARTICIPANT WINNERS: Storing winners for synchronized announcement", {
                  pendingWinnersCount: wheelState.winners.length,
                  currentPendingWinners: pendingWinners?.length || 0,
                  spinCompletionTime: wheelState.completedAt || 'no timestamp'
                })
                setPendingWinners(wheelState.winners)

                // Wait for participant's local animation to complete - ENHANCED TIMING CONTROL
                // This prevents premature winner announcement when participant animation hasn't started yet
                const currentTime = Date.now()
                const organizerCompletionTime = wheelState.completedAt || currentTime
                const timeSinceCompletion = currentTime - organizerCompletionTime
 
                  // ENHANCED: More robust timing calculation for winner announcement synchronization
                  const baseSynchronizationDelay = 1000 // Increased for better sync reliability
                  const organizerCompletenessCompensation = Math.max(0, timeSinceCompletion) // Account for organizer timing
                  const animationProgressFactor = (isSpinning ? 0.75 : 1) // Factor based on local animation state
                  const synchronizationDelay = Math.max(baseSynchronizationDelay, organizerCompletenessCompensation) * animationProgressFactor
 
                console.log("🎯 PARTICIPANT WINNERS: Scheduling synchronized announcement with enhanced timing", {
                  timeSinceCompletion: timeSinceCompletion,
                  baseDelay: baseSynchronizationDelay,
                  synchronizationDelay: synchronizationDelay,
                  previousWinners: winners.length,
                  willShowAt: new Date(currentTime + synchronizationDelay).toISOString()
                })
 
                setTimeout(() => {
                  // CRITICAL: Only show winners if local animation is completely finished
                  if (pendingWinners && pendingWinners.length > 0 && !isSpinning) {
                    console.log("🎯 ENHANCED WINNER ANNOUNCEMENT: Synchronized winner display with local animation", {
                      winnerCount: pendingWinners.length,
                      localAnimationComplete: !isSpinning,
                      timeElapsed: synchronizationDelay,
                      organizerCompletedAt: organizerCompletionTime
                    })
                    setWinners(pendingWinners)
                    setShowResults(true)
                    setPendingWinners(null)

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
                    triggerConfetti()
                  } else {
                    console.log("⚠️ WINNER ANNOUNCEMENT DELAYED: Local animation still in progress", {
                      hasPendingWinners: !!(pendingWinners && pendingWinners.length > 0),
                      isSpinning: isSpinning,
                      timeElapsed: synchronizationDelay,
                      willRetry: true
                    })

                    // Retry after additional delay if animation still running
                    setTimeout(() => {
                      if (pendingWinners && !isSpinning) {
                        console.log("🎯 RETRY WINNER ANNOUNCEMENT: Second attempt succeeded")
                        setWinners(pendingWinners)
                        setShowResults(true)
                        setPendingWinners(null)

                        const result: SpinResult = {
                          id: Date.now().toString(),
                          winners: pendingWinners,
                          timestamp: new Date(),
                          spinDuration: settings.spinDuration,
                          totalParticipants: wheelItems.length
                        }

                        setSpinHistory(prev => [result, ...prev.slice(0, 9)])
                        memoizedOnSpinComplete(result)
                        triggerConfetti()
                      }
                    }, 300)
                  }
                }, synchronizationDelay)
              } else {
                // For organizer: Show winners immediately
                console.log("🎯 ORGANIZER WINNERS: Showing winners immediately")
                setWinners(wheelState.winners)
                setIsSpinning(false)
                setShowResults(true)

                // Create spin result
                const result: SpinResult = {
                  id: Date.now().toString(),
                  winners: wheelState.winners,
                  timestamp: new Date(),
                  spinDuration: settings.spinDuration,
                  totalParticipants: wheelItems.length
                }

                setSpinHistory(prev => [result, ...prev.slice(0, 9)])
                onSpinComplete?.(result)

                // Trigger confetti for organizer
                triggerConfetti()
              }
            }

            // Handle wheel reset
            // Increased time window to 30 seconds to account for network delays
            if (wheelState.resetAt && wheelState.resetAt > (Date.now() - 30000)) {
              console.log("🎯 Received wheel reset from organizer")
              setCurrentAngle(0)
              setWinners([])
              setShowResults(false)
              setIsSpinning(false)
              // Increased delay for more reliable wheel redraw
              setTimeout(() => drawWheel(), 200)
            }
          }
        },
        (error) => {
          console.error("❌ Real-time listener error:", error)
          // Enhanced error handling for synchronization
          if (error.message.includes('permission-denied')) {
            console.warn("🔐 Permission denied for session listener - participant may not have access")
            console.warn("🎯 Session ID:", sessionId)
            console.warn("🎯 Organizer mode:", organizerMode)
            console.warn("🎯 Live mode:", isLiveMode)
            // Try to reload the session data for debugging
            if (isLiveMode) {
              console.log("🔄 Attempting fallback spin check...")
              // Set up periodic polling as fallback for permission issues
              const fallbackInterval = setInterval(async () => {
                try {
                  const sessionDoc = await getDoc(doc(db, "liveDrawSessions", sessionId))
                  if (sessionDoc.exists()) {
                    const sessionData = sessionDoc.data()
                    console.log("📡 Fallback check - session state:", sessionData.currentState)
                    if (sessionData.wheelState?.isSpinning && !isSpinning) {
                      console.log("🎯 FALLBACK: Detected spin start via polling")
                      // Could trigger spin here as fallback, but might cause conflicts
                    }
                  }
                } catch (e) {
                  console.warn("Fallback polling failed:", e)
                }
              }, 2000)
              // Clean up the fallback interval
              setTimeout(() => clearInterval(fallbackInterval), 30000) // Stop after 30 seconds
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
      )

      setSessionListener(unsubscribe)

      return () => {
        if (unsubscribe) {
          console.log("🔄 Cleaning up real-time listener")
          unsubscribe()
          setListenerSetup(false)
        }
      }
    } else if (sessionListener) {
      // Clean up listener if real-time sync is disabled or user becomes organizer
      console.log("🔄 Cleaning up real-time listener (sync disabled or became organizer)")
      sessionListener()
      setSessionListener(null)
      setListenerSetup(false)
    }
  }, [enableRealTimeSync, sessionId, organizerMode, isLiveMode])

  // Fallback winner check - periodically check for winners if real-time sync is enabled
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
            // Only update if we haven't checked recently (prevent spam)
            if (now - lastWinnerCheck > 2000) {
              console.log("🎯 FALLBACK: Found winners via periodic check", {
                winnerCount: wheelState.winners.length,
                winners: wheelState.winners,
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

    // Check every 3 seconds as fallback
    const interval = setInterval(checkForWinners, 3000)

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

  const triggerConfetti = () => {
    if (!settings.showConfetti) return

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
        return clearInterval(interval)
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
  }

  const spinWheel = async () => {
    if (isSpinning || wheelItems.length === 0) return

    // Prevent participants from spinning - only organizers can spin
    if (!organizerMode) {
      toast({
        title: "Watch Only",
        description: "Only the organizer can spin the wheel",
        variant: "destructive"
      })
      return
    }

    setIsSpinning(true)
    setShowResults(false)
    playSpinSound()
    
    // Calculate spin parameters FIRST (before broadcasting)
    const spins = 5 + Math.random() * 5 // 5-10 full rotations
    const finalAngle = Math.random() * 2 * Math.PI
    const totalRotation = spins * 2 * Math.PI + finalAngle

    // Real-time sync: Broadcast spin start to Firebase for live sessions
    if (enableRealTimeSync && sessionId && organizerMode) {
      try {
        await updateDoc(doc(db, "liveDrawSessions", sessionId), sanitizeForFirebase({
          currentState: "spinning",
          isSpinning: true,
          wheelState: {
            currentAngle: currentAngle,
            isSpinning: true,
            winners: [],
            spinStartTime: Date.now(),
            // Broadcast the exact same spin parameters for perfect synchronization
            spinDuration: settings.spinDuration,
            totalRotation: totalRotation,
            finalAngle: finalAngle,
            spins: spins
          },
          updatedAt: serverTimestamp()
        }))
        console.log("🎯 BROADCAST SPIN START: Broadcasted spin start to Firebase with synchronized parameters:", {
          spinDuration: settings.spinDuration,
          totalRotation: totalRotation / (2 * Math.PI),
          finalAngle: finalAngle * 180 / Math.PI,
          spins: spins,
          sessionId: sessionId,
          organizerMode: organizerMode,
          timestamp: new Date().toISOString()
        })
      } catch (error) {
        console.error("❌ Failed to broadcast spin start:", error)
      }
    }

    // 🎯 ULTRA-SMOOTH SPIN ANIMATION - Optimized for silky stopping motion
    const startTime = performance.now() // Use performance.now for microsecond precision
    let lastFrameTime = startTime
    let lastStateUpdate = startTime
    const FRAME_RATE = 60 // Target 60fps for buttery smooth animation
    const FRAME_INTERVAL = 1000 / FRAME_RATE // ~16.67ms per frame
    const STATE_UPDATE_INTERVAL = FRAME_INTERVAL * 3 // Update state every 50ms to reduce overhead

    // 🔧 Increase duration by 500ms to allow smoother deceleration to be more noticeable
    const extendedDuration = Math.max(settings.spinDuration + 500, settings.spinDuration * 1.3)

    const animate = () => {
      const currentTime = performance.now()
      const elapsed = currentTime - startTime

      // Skip frames if running too fast to prevent overwhelming the browser
      if (currentTime - lastFrameTime < FRAME_INTERVAL) {
        requestAnimationFrame(animate)
        return
      }

      const progress = Math.min(elapsed / extendedDuration, 1)

      // 🎯 ULTRA-SMOOTH EASING FUNCTION - Optimized for silky stopping motion
      // Combines multiple easing functions for natural deceleration near stopping point

      let easeValue

      if (progress < 0.7) {
        // Phase 1: Linear acceleration with slight ease-in for natural start
        const adjustedProgress = progress / 0.7
        easeValue = adjustedProgress * adjustedProgress * adjustedProgress * 0.88 // Cubic ease-in with dampening
      } else {
        // Phase 2: Ultra-smooth deceleration with overshoot-retreat effect
        const decelerationPhase = (progress - 0.7) / 0.3 // 0 to 1 range for deceleration phase

        // Quintic ease-out for extremely smooth slowing
        const easedDecel = 1 - Math.pow(1 - decelerationPhase, 5)

        // Add subtle overshoot-retract for natural stopping feeling (extremely subtle: 1.002x max)
        const overshoot = 1 + (Math.sin(decelerationPhase * Math.PI * 2.5) * 0.0012 * (1 - decelerationPhase))

        // Combine ultra-smooth quintic with minimal overshoot
        easeValue = 0.88 + (easedDecel * 0.12 * overshoot)
      }

      // 🏁 Ensure we reach exactly the target position with perfect precision
      const currentRotation = progress >= 1 ? totalRotation : totalRotation * easeValue

      // Draw directly on canvas without state update for smooth animation
      if (canvasRef.current) {
        const canvas = canvasRef.current
        const ctx = canvas.getContext("2d")
        if (ctx && wheelItems.length > 0) {
          drawWheelAtAngle(ctx, canvas, currentRotation)
        }
      }

      // Throttled state update - only update React state every few frames to reduce re-renders
      if (currentTime - lastStateUpdate >= STATE_UPDATE_INTERVAL || progress >= 1) {
        setCurrentAngle(currentRotation)
        lastStateUpdate = currentTime
      }

      if (progress < 1) {
        lastFrameTime = currentTime
        requestAnimationFrame(animate)
      } else {
        // Spin complete - determine winners
        const segmentAngle = (2 * Math.PI) / wheelItems.length
        const normalizedAngle = (currentRotation % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI)
        const landedIndex = (wheelItems.length - Math.floor(((normalizedAngle - 0) % (2 * Math.PI)) / segmentAngle)) % wheelItems.length
        const selectedWinners: Participant[] = [];
        const availableSegments = [...wheelItems];
        for (let i = 0; i < Math.min(settings.numberOfWinners, wheelItems.length); i++) {
          if (availableSegments.length === 0) break;
          const winnerIndex = (landedIndex + i) % availableSegments.length;
          const winningItem = availableSegments[winnerIndex];
          availableSegments.splice(winnerIndex, 1);
          if (isParticipantBased) {
            const participant = participants.find(p => p.name === winningItem);
            if (participant) {
              selectedWinners.push(participant);
            }
          } else {
            // For predefined items like colors, create a mock participant object
            selectedWinners.push({
              id: `item-${i}-${Date.now()}`,
              name: winningItem,
              isSelected: true
            });
          }
        }
        setWinners(selectedWinners);
        setShowResults(true);
        setIsSpinning(false);
        setPendingWinners(null);
        setTimeout(() => {
          setShowResults(false);
          (async () => {
            try {
              await updateDoc(doc(db, "liveDrawSessions", sessionId), sanitizeForFirebase({
                currentState: "waiting", // 🔄 RESET: Keep in "waiting" state for multiple spins instead of "ended"
                isSpinning: false,
                winners: selectedWinners,
                wheelState: {
                  currentAngle: currentAngle,
                  isSpinning: false,
                  winners: selectedWinners,
                  finalAngle: currentAngle % (2 * Math.PI),
                  completedAt: Date.now()
                },
                updatedAt: serverTimestamp()
              }));
              console.log("🎯 BROADCAST WINNERS: Broadcasted spin completion to Firebase - Ready for Next Spin!", {
                winnerCount: selectedWinners.length,
                winners: selectedWinners,
                sessionId: sessionId,
                organizerMode: organizerMode,
                timestamp: new Date().toISOString()
              });
            } catch (error) {
              console.error("❌ Failed to broadcast spin completion:", error);
            }
          })();
        }, 5000);
      }
      // Trigger effects
      triggerConfetti();
      // Callback
      onSpinComplete?.(result);
      // Winner notification removed to prevent duplication with visual display
    }
  }

  const resetWheel = async () => {
    // Reset all wheel states
    setCurrentAngle(0)
    setWinners([])
    setShowResults(false)
    setIsSpinning(false)
    setPendingWinners(null) // Clear any pending winners
    
    // Force immediate wheel redraw
    setTimeout(() => drawWheel(), 100)
    
    // Real-time sync: Broadcast reset to Firebase for live sessions
    if (enableRealTimeSync && sessionId && organizerMode) {
      try {
        await updateDoc(doc(db, "liveDrawSessions", sessionId), sanitizeForFirebase({
          currentState: "waiting",
          isSpinning: false,
          winners: [],
          wheelState: {
            currentAngle: 0,
            isSpinning: false,
            winners: [],
            resetAt: Date.now()
          },
          updatedAt: serverTimestamp()
        }))
        console.log("🎯 Broadcasted wheel reset to Firebase")
      } catch (error) {
        console.error("❌ Failed to broadcast wheel reset:", error)
      }
    }
    
    toast({
      title: "Wheel Reset",
      description: "The wheel has been reset to starting position",
    })
  }

  const shuffleParticipants = () => {
    // Shuffle the current wheel items
    const itemsToShuffle = [...wheelItems]
    
    // Fisher-Yates shuffle algorithm
    for (let i = itemsToShuffle.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[itemsToShuffle[i], itemsToShuffle[j]] = [itemsToShuffle[j], itemsToShuffle[i]]
    }
    
    // Update the editable items with shuffled order
    setEditableItems(itemsToShuffle)
    setIsEditingItems(true) // Enable editing mode to use shuffled items
    
    // Force wheel redraw
    setTimeout(() => drawWheel(), 100)
    
    toast({
      title: "Items Shuffled",
      description: "The wheel items have been randomized",
    })
  }

  const addItem = () => {
    if (!allowItemEditing || !newItemText.trim() || editableItems.includes(newItemText.trim())) return
    
    setEditableItems([...editableItems, newItemText.trim()])
    setNewItemText("")
  }

  const removeItem = (index: number) => {
    if (!allowItemEditing) return
    
    setEditableItems(editableItems.filter((_, i) => i !== index))
  }

  const updateItem = (index: number, newText: string) => {
    if (!allowItemEditing) return
    
    const updated = [...editableItems]
    updated[index] = newText.trim()
    setEditableItems(updated)
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
    
    // Reset to original items
    if (selectedWheelType?.defaultItems) {
      setEditableItems([...selectedWheelType.defaultItems])
    } else if (participants?.length > 0) {
      setEditableItems(participants.map(p => p.name))
    } else {
      setEditableItems(["Option 1", "Option 2", "Option 3", "Option 4", "Option 5"])
    }
    setIsEditingItems(false)
  }

  const updateSettings = (newSettings: Partial<WheelSettings>) => {
    const updated = { ...settings, ...newSettings }
    setSettings(updated)
    onSettingsChange?.(updated)
  }

  const applyTheme = (theme: any) => {
    setWheelTheme({
      primary: theme.primary,
      secondary: theme.secondary,
      accent: theme.accent,
      background: theme.background
    })
    toast({
      title: "Theme Applied",
      description: `${theme.name} theme has been applied to the wheel`,
    })
  }

  const saveCustomText = () => {
    console.log("🎯 saveCustomText called with:", { customWheelText: customWheelText.trim() })
    
    if (!customWheelText.trim()) {
      toast({
        title: "Empty Input",
        description: "Please enter some text for the wheel items",
        variant: "destructive"
      })
      return
    }

    try {
      // Split by commas or newlines and clean up
      const items = customWheelText
        .split(/[,\n]/) // Split by comma or newline
        .map(item => item.trim()) // Remove whitespace
        .filter(item => item.length > 0) // Remove empty items
      
      console.log("🎯 Processing custom text:", {
        originalText: customWheelText,
        parsedItems: items,
        itemCount: items.length,
        currentEditableItems: editableItems.length,
        currentIsEditingItems: isEditingItems
      })
      
      if (items.length === 0) {
        toast({
          title: "Invalid Input",
          description: "Please enter at least one valid text item",
          variant: "destructive"
        })
        return
      }

      // STEP 1: Update state immediately
      console.log("📝 Step 1: Setting new items", items)
      setEditableItems(items)
      setIsEditingItems(true)
      
      // STEP 2: Reset wheel state for clean start
      console.log("🔄 Step 2: Resetting wheel state")
      setCurrentAngle(0)
      setWinners([])
      setShowResults(false)
      setIsSpinning(false)
      setPendingWinners(null) // Clear any pending winners
      
      // STEP 3: Close dialog
      console.log("❌ Step 3: Closing dialog")
      setIsTextDialogOpen(false)
      
      // STEP 4: Force multiple wheel redraws with different timing
      console.log("🎨 Step 4: Forcing wheel redraws")
      
      // Immediate redraw
      drawWheel()
      
      // Multiple delayed redraws to ensure it works
      setTimeout(() => {
        console.log("🎨 Delayed redraw 1 (100ms)")
        drawWheel()
      }, 100)
      
      setTimeout(() => {
        console.log("🎨 Delayed redraw 2 (250ms)")
        drawWheel()
      }, 250)
      
      // Use requestAnimationFrame for smooth rendering
      requestAnimationFrame(() => {
        console.log("🎨 Animation frame redraw")
        drawWheel()
        
        // Additional frame-based redraw
        requestAnimationFrame(() => {
          console.log("🎨 Double animation frame redraw")
          drawWheel()
        })
      })
      
      toast({
        title: "✅ Items Applied Successfully!",
        description: `Wheel updated with ${items.length} custom item${items.length === 1 ? '' : 's'}: ${items.slice(0, 3).join(', ')}${items.length > 3 ? '...' : ''}`,
        })
        
        console.log("✅ Custom text applied successfully with", items.length, "items")
        
      } catch (error) {
        console.error("❌ Error applying custom text:", error)
        toast({
          title: "Error",
          description: "Failed to apply custom text. Please try again.",
          variant: "destructive"
        })
      }
  }

  const resetToOriginalItems = () => {
    // Reset to editing mode disabled (use original items)
    setIsEditingItems(false)
    setCustomWheelText("")

    // Reset wheel state
    setCurrentAngle(0)
    setWinners([])
    setShowResults(false)
    setIsSpinning(false)
    setPendingWinners(null) // Clear any pending winners
    
    // Force immediate wheel redraw with original items
    setTimeout(() => drawWheel(), 100)
    
    toast({
      title: "Reset Complete",
      description: "Wheel items have been reset to original content",
    })
  }

  return (
    <div className="space-y-6">


      {/* Wheel Canvas */}
      <Card className="border-2" style={{ borderColor: wheelTheme.primary }}>
        <CardContent className="p-6">
          <div className="flex flex-col items-center space-y-4">
            {/* Wheel Type Info Display - REMOVED */}

            <canvas
              ref={canvasRef}
              width={isLiveMode ? 500 : 450}
              height={isLiveMode ? 500 : 450}
              className="border-4 rounded-full shadow-2xl transition-all duration-300 hover:shadow-3xl"
              style={{ 
                borderColor: wheelTheme.primary,
                opacity: isLiveMode && !organizerMode && isSpinning ? 0.8 : 1,
                transform: isLiveMode && !organizerMode && isSpinning ? 'scale(1.02)' : 'scale(1)',
                transition: 'all 0.3s ease-in-out'
              }}
            />
            
            {/* Control Buttons */}
            <div className="flex gap-3 flex-wrap justify-center">
              {(() => {
                const isDisabled = isSpinning || wheelItems.length === 0 || studentMode || disabled || (isLiveMode && !organizerMode);
                const isWatchOnly = studentMode || (isLiveMode && !organizerMode);
                console.log("🎯 BUTTON STATUS:", {
                  isSpinning,
                  studentMode,
                  organizerMode,
                  isLiveMode,
                  disabled,
                  wheelItemsLength: wheelItems.length,
                  isDisabled,
                  isWatchOnly,
                  buttonText: isSpinning ? "Spinning..." : isWatchOnly ? "Watch Only" : "Spin Wheel"
                });
                return (
                  <Button
                    onClick={spinWheel}
                    disabled={isDisabled}
                    size="lg"
                    style={{ backgroundColor: wheelTheme.primary, color: wheelTheme.accent }}
                    className="hover:opacity-90"
                  >
                    {isSpinning ? (
                      <>
                        <Pause className="h-5 w-5 mr-2" />
                        Spinning...
                      </>
                    ) : isWatchOnly ? (
                      <>
                        <Eye className="h-5 w-5 mr-2" />
                        Watch Only
                      </>
                    ) : (
                      <>
                        <Play className="h-5 w-5 mr-2" />
                        Spin Wheel
                      </>
                    )}
                  </Button>
                );
              })()}
              
              {!studentMode && !(isLiveMode && !organizerMode) && (
                <>
                  <Button
                    onClick={resetWheel}
                    variant="outline"
                    size="lg"
                    disabled={isSpinning || disabled}
                    style={{ borderColor: wheelTheme.primary, color: wheelTheme.primary }}
                    className="hover:bg-red-50 hover:border-red-500 hover:text-red-600 transition-colors"
                  >
                    <RotateCcw className="h-5 w-5 mr-2" />
                    Reset
                  </Button>

                  <Button
                    onClick={shuffleParticipants}
                    variant="outline"
                    size="lg"
                    disabled={isSpinning || disabled}
                    style={{ borderColor: wheelTheme.primary, color: wheelTheme.primary }}
                    className="hover:bg-blue-50 hover:border-blue-500 hover:text-blue-600 transition-colors"
                  >
                    <Shuffle className="h-5 w-5 mr-2" />
                    Shuffle
                  </Button>

                  <Button
                    onClick={() => setIsThemeDialogOpen(true)}
                    variant="outline"
                    size="lg"
                    disabled={isSpinning || disabled}
                    style={{ borderColor: wheelTheme.primary, color: wheelTheme.primary }}
                  >
                    <Palette className="h-5 w-5 mr-2" />
                    Theme
                  </Button>

                  <Button
                    onClick={() => {
                      console.log("🖊️ Opening text editor with current items:", wheelItems)
                      // Pre-populate with current items - check if editing mode or original items
                      const currentItems = isEditingItems ? editableItems : wheelItems
                      setCustomWheelText(currentItems.join('\n'))
                      setIsTextDialogOpen(true)
                      console.log("📝 Text dialog opened with content:", currentItems.join('\n'))
                    }}
                    variant="outline"
                    size="lg"
                    disabled={isSpinning || disabled}
                    style={{ borderColor: wheelTheme.primary, color: wheelTheme.primary }}
                  >
                    <Edit3 className="h-5 w-5 mr-2" />
                    Edit Text
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results Display */}
      {showResults && winners.length > 0 && (
        <Card className="border-4 border-yellow-400 bg-gradient-to-r from-yellow-50 to-orange-50 shadow-2xl animate-pulse">
          <CardHeader className="bg-gradient-to-r from-yellow-400 to-orange-400 text-white">
            <CardTitle className="flex items-center justify-center gap-2 text-2xl">
              <Trophy className="h-8 w-8 animate-bounce" />
              🏆  WINNER{winners.length > 1 ? 'S' : ''} SELECTED! 🎉 🏆
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-4">
              {winners.map((winner, index) => (
                <div key={winner.id} className="flex items-center gap-4 p-4 bg-white rounded-xl border-2 border-yellow-300 shadow-lg transform hover:scale-105 transition-transform">
                  <Badge variant="default" className="bg-gradient-to-r from-red-600 to-red-700 text-white text-lg px-3 py-1">
                    #{index + 1}
                  </Badge>
                  <div className="flex-1">
                    <p className="font-bold text-2xl text-gray-800 mb-1">{winner.name}</p>
                    {winner.email && (
                      <p className="text-sm text-gray-600">{winner.email}</p>
                    )}
                  </div>
                  <div className="text-4xl animate-bounce">🏆</div>
                </div>
              ))}
            </div>
            
            <div className="mt-4 p-3 bg-white rounded-lg border">
              <p className="text-center text-lg font-medium" style={{ color: schoolColors.primary }}>
                {settings.congratsMessage.replace('{name}', winners.map(w => w.name).join(', '))}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Theme Customization Dialog */}
      <Dialog open={isThemeDialogOpen} onOpenChange={setIsThemeDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5" />
              Customize Wheel Theme
            </DialogTitle>
            <DialogDescription>
              Choose from preset themes or customize your own colors for the wheel
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Theme Presets */}
            <div>
              <Label className="text-base font-semibold">Theme Presets ({themePresets.length} available)</Label>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mt-3 max-h-96 overflow-y-auto">
                {themePresets.map((theme) => (
                  <Button
                    key={theme.value}
                    variant="outline"
                    className="h-auto p-3 flex flex-col items-start gap-2 hover:scale-105 transition-all duration-200 hover:shadow-lg"
                    onClick={() => applyTheme(theme)}
                  >
                    <div className="flex gap-2 w-full">
                      <div 
                        className="w-4 h-4 rounded-full border-2 border-gray-300"
                        style={{ backgroundColor: theme.primary }}
                      />
                      <div 
                        className="w-4 h-4 rounded-full border-2 border-gray-300"
                        style={{ backgroundColor: theme.secondary }}
                      />
                      <div 
                        className="w-4 h-4 rounded-full border-2 border-gray-300"
                        style={{ backgroundColor: theme.accent }}
                      />
                    </div>
                    <span className="text-xs font-medium text-left leading-tight">{theme.name}</span>
                  </Button>
                ))}
              </div>
            </div>
            
            {/* Custom Colors */}
            <div className="space-y-4">
              <Label className="text-base font-semibold">Custom Colors</Label>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="primary-color">Primary Color</Label>
                  <div className="flex gap-2">
                    <Input
                      id="primary-color"
                      type="color"
                      value={wheelTheme.primary}
                      onChange={(e) => setWheelTheme(prev => ({ ...prev, primary: e.target.value }))}
                      className="w-16 h-10 p-1 cursor-pointer"
                    />
                    <Input
                      value={wheelTheme.primary}
                      onChange={(e) => setWheelTheme(prev => ({ ...prev, primary: e.target.value }))}
                      className="flex-1"
                      placeholder="#8e0b16"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="secondary-color">Secondary Color</Label>
                  <div className="flex gap-2">
                    <Input
                      id="secondary-color"
                      type="color"
                      value={wheelTheme.secondary}
                      onChange={(e) => setWheelTheme(prev => ({ ...prev, secondary: e.target.value }))}
                      className="w-16 h-10 p-1 cursor-pointer"
                    />
                    <Input
                      value={wheelTheme.secondary}
                      onChange={(e) => setWheelTheme(prev => ({ ...prev, secondary: e.target.value }))}
                      className="flex-1"
                      placeholder="#66181E"
                    />
                  </div>
                </div>
              </div>
            </div>
            
            {/* Preview */}
            <div className="space-y-2">
              <Label className="text-base font-semibold">Live Preview</Label>
              <div 
                className="w-full h-32 rounded-lg border-4 flex items-center justify-center relative overflow-hidden"
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
                  className="text-lg font-bold z-10 drop-shadow-lg"
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
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsThemeDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => {
                setIsThemeDialogOpen(false)
                toast({
                  title: "Theme Applied",
                  description: "Your custom theme has been applied to the wheel",
                })
              }}
              style={{ backgroundColor: wheelTheme.primary, color: wheelTheme.accent }}
            >
              Apply Theme
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Text Editing Dialog */}
      <Dialog open={isTextDialogOpen} onOpenChange={setIsTextDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit3 className="h-5 w-5" />
              Edit Wheel Items
            </DialogTitle>
            <DialogDescription>
              Customize the text that appears in the wheel segments
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="custom-text">Wheel Items</Label>
              <textarea
                id="custom-text"
                value={customWheelText}
                onChange={(e) => setCustomWheelText(e.target.value)}
                placeholder="Enter items separated by commas or new lines...\n\nExample:\nApple\nBanana\nCherry\n\nOr: Apple, Banana, Cherry"
                className="w-full min-h-[120px] p-3 border rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="text-sm text-muted-foreground space-y-1">
                <p>• Separate items with commas (,) or new lines</p>
                <p>• Each item will become a wheel segment</p>
                <p>• Empty items will be automatically removed</p>
              </div>
            </div>
            
            {/* Preview of items that will be created */}
            {customWheelText.trim() && (
              <div className="space-y-2">
                <Label>Preview ({customWheelText.split(/[,\n]/).filter(item => item.trim().length > 0).length} items)</Label>
                <div className="p-3 bg-gray-50 rounded-lg border max-h-32 overflow-y-auto">
                  <div className="flex flex-wrap gap-2">
                    {customWheelText
                      .split(/[,\n]/)
                      .map(item => item.trim())
                      .filter(item => item.length > 0)
                      .slice(0, 20)
                      .map((item, index) => (
                        <Badge key={index} variant="default" className="text-xs" style={{ backgroundColor: index % 2 === 0 ? '#8e0b16' : '#66181E' }}>
                          {item.length > 15 ? item.substring(0, 15) + '...' : item}
                        </Badge>
                      ))
                    }
                    {customWheelText.split(/[,\n]/).filter(item => item.trim().length > 0).length > 20 && (
                      <Badge variant="outline" className="text-xs">
                        +{customWheelText.split(/[,\n]/).filter(item => item.trim().length > 0).length - 20} more
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            )}
            
            {/* Current Items Preview */}
            <div className="space-y-2">
              <Label>Current Wheel Items ({wheelItems.length})</Label>
              <div className="p-3 bg-gray-50 rounded-lg border max-h-32 overflow-y-auto">
                <div className="flex flex-wrap gap-2">
                  {wheelItems.slice(0, 10).map((item, index) => (
                    <Badge key={`current-${index}`} variant="secondary" className="text-xs">
                      {item}
                    </Badge>
                  ))}
                  {wheelItems.length > 10 && (
                    <Badge variant="outline" className="text-xs">
                      +{wheelItems.length - 10} more
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </div>
          
          <DialogFooter className="flex justify-between">
            <Button 
              variant="outline" 
              onClick={() => {
                resetToOriginalItems()
                setIsTextDialogOpen(false)
              }}
              className="text-gray-600 hover:text-gray-800"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset to Original
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setIsTextDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={saveCustomText}
                disabled={!customWheelText.trim()}
                style={{ backgroundColor: wheelTheme.primary, color: wheelTheme.accent }}
              >
                Apply Items
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
