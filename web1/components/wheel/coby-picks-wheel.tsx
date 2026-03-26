"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardTitle } from "@/components/ui/card"
import { db } from "@/lib/firebase"
import { collection, getDocs, addDoc, doc, updateDoc } from "firebase/firestore"
import { toast } from "@/hooks/use-toast"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { TextWinnerPopup } from "@/components/shared/text-winner-popup"
import { EnhancedWinnerPopup } from "@/components/shared/enhanced-winner-popup"
import { CheckCircle2 } from "lucide-react"
import {
  YES_NO_OPTIONS,
  LETTERS_OPTIONS,
  COLORS_OPTIONS,
  MLB_TEAMS,
  NBA_TEAMS,
  NFL_TEAMS,
  COUNTRIES_OPTIONS,
  STATES_OPTIONS,
  generateNumberRange,
  generateDateRange,
  THEMES,
} from "@/lib/wheel-data"

type WheelType =
  | "participant"
  | "category"
  | "yes-no"
  | "number"
  | "letter"
  | "country"
  | "state"
  | "color"
  | "image"
  | "date"
  | "mlb"
  | "nba"
  | "nfl"
  | string // Allow for custom/dynamic types

interface Participant {
  id: string
  name: string
  email?: string
  contactNumber?: string
  originalHeaders?: Record<string, string>
}

interface CobyPicksWheelProps {
  wheelId: string
  congratulatoryMessage: string
  wheelType: WheelType
  numberMin?: number
  numberMax?: number
  dateStart?: string // YYYY-MM-DD
  dateEnd?: string // YYYY-MM-DD
  imageUrls?: string[] // For image picker
  categoryItems?: string[] // For category picker (now optional, can be fetched)

  // New settings props
  spinSpeedLevel?: number
  spinDuration?: number
  manualStop?: boolean
  mysterySpin?: boolean
  spinCount?: number
  randomInitialAngle?: boolean
  initialSpinning?: boolean
  wheelBgImage?: string
  centerImage?: string
  centerImageSize?: number
  wheelBorderWidth?: number
  wheelBorderColor?: string
  wheelShadow?: string
  confettiAndSound?: boolean
  onSpinComplete: (newSpinCount: number) => void // Callback to update spin count in dashboard
  wheelTheme?: string // Declare the wheel variable here
}

export function CobyPicksWheel({
  wheelId,
  congratulatoryMessage,
  wheelType,
  numberMin = 1,
  numberMax = 100,
  dateStart = "",
  dateEnd = "",
  imageUrls = [],
  categoryItems: propCategoryItems = [], // Renamed to avoid conflict with state

  // New settings props
  spinSpeedLevel = 5,
  spinDuration = 10,
  manualStop = false,
  mysterySpin = false,
  spinCount = 0,
  randomInitialAngle = false,
  initialSpinning = false,
  wheelBgImage = "",
  centerImage = "",
  centerImageSize = 50,
  wheelBorderWidth = 2,
  wheelBorderColor = "#A00000",
  wheelShadow = "none",
  confettiAndSound = false,
  onSpinComplete,
  wheelTheme, // Use the wheel variable here
}: CobyPicksWheelProps) {
  const [participants, setParticipants] = useState<Participant[]>([]) // Only for 'participant' type
  const [numWinners, setNumWinners] = useState(1)
  const [spinning, setSpinning] = useState(false)
  const [winners, setWinners] = useState<string[]>([]) // Store winner names/values
  const [showWinnersDialog, setShowWinnersDialog] = useState(false)
  const [showEnhancedWinnerPopup, setShowEnhancedWinnerPopup] = useState(false)
  const [spinDegree, setSpinDegree] = useState(0)
  const spinTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const initialSpinRef = useRef<NodeJS.Timeout | null>(null)




  const segments = useMemo(() => {
    switch (wheelType) {
      case "participant":
        return participants.map((p) => p.name)
      case "yes-no":
        return YES_NO_OPTIONS
      case "number":
        return generateNumberRange(numberMin, numberMax)
      case "letter":
        return LETTERS_OPTIONS
      case "country":
        return COUNTRIES_OPTIONS
      case "state":
        return STATES_OPTIONS
      case "color":
        return COLORS_OPTIONS
      case "image":
        return imageUrls
      case "date":
        return generateDateRange(dateStart, dateEnd)
      case "mlb":
        return MLB_TEAMS
      case "nba":
        return NBA_TEAMS
      case "nfl":
        return NFL_TEAMS
      case "category":
        return propCategoryItems.length > 0
          ? propCategoryItems
          : ["Category 1", "Category 2", "Category 3"]
      default:
        // For any custom/dynamic wheel types, assume propCategoryItems or a default
        return propCategoryItems.length > 0 ? propCategoryItems : ["Item 1", "Item 2", "Item 3"]
    }
  }, [
    wheelType,
    participants,
    numberMin,
    numberMax,
    dateStart,
    dateEnd,
    imageUrls,
    propCategoryItems,

  ])

  useEffect(() => {
    if (wheelType === "participant") {
      const fetchParticipants = async () => {
        if (!wheelId) return
        const q = collection(db, `wheels/${wheelId}/participants`)
        const querySnapshot = await getDocs(q)
        const fetchedParticipants: Participant[] = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Participant[]
        setParticipants(fetchedParticipants)
      }
      fetchParticipants()
    } else {
      setParticipants([]) // Clear participants if not a participant wheel
    }
  }, [wheelId, wheelType])

  // Initial angle and spinning effect
  useEffect(() => {
    if (randomInitialAngle) {
      setSpinDegree(Math.floor(Math.random() * 360))
    }

    if (initialSpinning) {
      initialSpinRef.current = setTimeout(() => {
        setSpinDegree((prev) => prev + 360 * 2) // Spin slowly twice
      }, 500) // Start after a short delay
    }

    return () => {
      if (initialSpinRef.current) {
        clearTimeout(initialSpinRef.current)
      }
    }
  }, [randomInitialAngle, initialSpinning])

  const handleSpin = async () => {
    if (segments.length === 0) {
      toast({
        title: "No Items",
        description: "There are no items to spin on this wheel. Please configure it.",
        variant: "destructive",
      })
      return
    }
    if (numWinners <= 0 || numWinners > segments.length) {
      toast({
        title: "Invalid Number of Winners",
        description: `Please enter a number between 1 and ${segments.length}.`,
        variant: "destructive",
      })
      return
    }

    setSpinning(true)
    setWinners([])

    // Clear any existing timeout
    if (spinTimeoutRef.current) {
      clearTimeout(spinTimeoutRef.current)
    }

    // Calculate target degree based on spin speed and duration
    const totalRotations = spinSpeedLevel * 5 // More rotations for higher speed
    const randomOffset = Math.floor(Math.random() * 360)
    const targetDegree = spinDegree + totalRotations * 360 + randomOffset

    setSpinDegree(targetDegree)

    spinTimeoutRef.current = setTimeout(async () => {
      // 🎯 FIXED: Use visual position for winner calculation instead of random selection
      const wheelElement = document.getElementById("spinning-wheel")
      if (!wheelElement) {
        console.error("Wheel element not found for winner calculation")
        return
      }

      const style = window.getComputedStyle(wheelElement)
      const transform = style.getPropertyValue("transform")
      const matrix = new DOMMatrixReadOnly(transform)

      // 🎯 FIXED: Correct rotation angle extraction from CSS transform matrix
      const currentRotation = Math.atan2(-matrix.m21, matrix.m11) * (180 / Math.PI)
      const normalizedCurrentRotation = ((currentRotation % 360) + 360) % 360

      // Calculate winners based on visual position
      const segmentAngleCalc = 360 / segments.length
      const pointerAngle = normalizedCurrentRotation
      const winningIndices: number[] = []

      // Get all winning segments based on numWinners
      for (let i = 0; i < numWinners && i < segments.length; i++) {
        const winnerIndex = Math.floor((pointerAngle + i * segmentAngleCalc) / segmentAngleCalc) % segments.length
        winningIndices.push(winnerIndex)
      }

      const selectedWinners = winningIndices.map(index => segments[index])

      setWinners(selectedWinners)
      setShowWinnersDialog(true)
      setShowEnhancedWinnerPopup(true) // Show enhanced popup for web
      setSpinning(false)

      // Update spin count in Firebase
      const newSpinCount = (spinCount || 0) + 1
      try {
        await updateDoc(doc(db, "wheels", wheelId), { spinCount: newSpinCount })
        onSpinComplete(newSpinCount) // Notify parent component
      } catch (error: any) {
        toast({
          title: "Error Updating Spin Count",
          description: error.message,
          variant: "destructive",
        })
      }

      // Save spin log to Firebase
      if (wheelType === "participant") {
        try {
          const fullWinnerParticipants = selectedWinners
            .map((name) => participants.find((p) => p.name === name))
            .filter(Boolean) as Participant[]
          await addDoc(collection(db, `wheels/${wheelId}/spinLogs`), {
            timestamp: new Date(),
            numberOfWinners: numWinners,
            winners: fullWinnerParticipants.map((w) => ({ id: w.id, name: w.name })),
            wheelType: wheelType,
          })
          toast({
            title: "Spin Logged",
            description: "The spin results have been saved.",
          })
        } catch (error: any) {
          toast({
            title: "Error Logging Spin",
            description: error.message,
            variant: "destructive",
          })
        }
      } else {
        // Log generic wheel spins
        try {
          await addDoc(collection(db, `wheels/${wheelId}/spinLogs`), {
            timestamp: new Date(),
            numberOfWinners: numWinners,
            winners: selectedWinners.map((name) => ({ name: name })), // Store just the name/value
            wheelType: wheelType,
          })
          toast({
            title: "Spin Logged",
            description: "The spin results have been saved.",
          })
        } catch (error: any) {
          toast({
            title: "Error Logging Spin",
            description: error.message,
            variant: "destructive",
          })
        }
      }

      if (confettiAndSound) {
        // Placeholder for confetti and sound
        console.log("Confetti and sound effect triggered!")
        // Example: new Audio('/path/to/sound.mp3').play();
        // For confetti, you'd typically use a library like react-confetti
      }
    }, spinDuration * 1000) // Match this with CSS transition duration
  }

  const handleManualStop = () => {
    if (spinning && spinTimeoutRef.current) {
      clearTimeout(spinTimeoutRef.current)
      // Calculate the current rotation and stop it there
      const wheelElement = document.getElementById("spinning-wheel")
      if (!wheelElement) return

      const style = window.getComputedStyle(wheelElement)
      const transform = style.getPropertyValue("transform")
      const matrix = new DOMMatrixReadOnly(transform)
      // 🎯 FIXED: Correct rotation angle extraction from CSS transform matrix
      // CSS rotate(θ) creates matrix [cosθ, sinθ; -sinθ, cosθ]
      // So θ = atan2(sinθ, cosθ) = atan2(matrix.m12, matrix.m11)
      // Or θ = atan2(-matrix.m21, matrix.m11) for the same result
      const currentRotation = Math.atan2(-matrix.m21, matrix.m11) * (180 / Math.PI)

      // Set the spinDegree to the current visual rotation, normalized to 0-360
      const normalizedCurrentRotation = ((currentRotation % 360) + 360) % 360
      setSpinDegree(normalizedCurrentRotation)

      // Immediately determine winner based on current rotation
      const segmentAngleCalc = 360 / segments.length

      // 🎯 FIXED: Correct angle calculation for precise pointer alignment
      // COORDINATE SYSTEM: Canvas 0° = right (3 o'clock), but wheel displays with pointer at top
      // For wheel display: 0° = top, clockwise rotation
      // Pointer is positioned at the top (0° position)
      // The wheel segments are drawn starting from angle 0 at top

      // Convert the normalized rotation to match the wheel's coordinate system
      // normalizedCurrentRotation is in degrees, we need to convert to match pointer position
      const pointerAngle = normalizedCurrentRotation // Current wheel rotation in degrees

      // Find which segment contains the pointer (0° position at top)
      // Since segments are numbered 0, 1, 2, ... clockwise from 0° (top)
      const winningIndex = Math.floor(pointerAngle / segmentAngleCalc) % segments.length

      const selectedWinner = segments[winningIndex]
      setWinners([selectedWinner])
      setShowWinnersDialog(true)
      setShowEnhancedWinnerPopup(true) // Show enhanced popup for manual stop
      setSpinning(false)

      // Update spin count and log (similar to auto-stop)
      const newSpinCount = (spinCount || 0) + 1
      updateDoc(doc(db, "wheels", wheelId), { spinCount: newSpinCount })
      onSpinComplete(newSpinCount)

      // Log generic wheel spins for manual stop
      addDoc(collection(db, `wheels/${wheelId}/spinLogs`), {
        timestamp: new Date(),
        numberOfWinners: 1, // Manual stop usually picks one
        winners: [{ name: selectedWinner }],
        wheelType: wheelType,
        manualStop: true,
      })
      toast({
        title: "Manual Stop",
        description: `The wheel was manually stopped. Winner: ${selectedWinner}`,
      })
    }
  }

  const getConicGradient = () => {
    if (segments.length === 0) return "none"
    const selectedTheme = THEMES.find((t) => t.value === wheelTheme) // Use wheelTheme instead of wheel.theme
    const colors = selectedTheme?.colors || []

    if (colors.length === 0) {
      // Fallback to dynamic HSL if no specific colors are defined for the theme
      let gradient = "conic-gradient("
      let currentAngle = 0
      segments.forEach((_, index) => {
        const segmentAngle = 360 / segments.length
        const color = `hsl(${index * segmentAngle}, 70%, 60%)` // Dynamic color based on hue
        gradient += `${color} ${currentAngle}deg ${currentAngle + segmentAngle}deg`
        if (index < segments.length - 1) {
          gradient += ", "
        }
        currentAngle += segmentAngle
      })
      gradient += ")"
      return gradient
    } else {
      // Use predefined colors from the theme
      let gradient = "conic-gradient("
      let currentAngle = 0
      segments.forEach((_, index) => {
        const segmentAngle = 360 / segments.length
        const color = colors[index % colors.length] // Cycle through theme colors
        gradient += `${color} ${currentAngle}deg ${currentAngle + segmentAngle}deg`
        if (index < segments.length - 1) {
          gradient += ", "
        }
        currentAngle += segmentAngle
      })
      gradient += ")"
      return gradient
    }
  }

  const getShadowClass = (shadowStyle: string) => {
    switch (shadowStyle) {
      case "sm":
        return "shadow-sm"
      case "md":
        return "shadow-md"
      case "lg":
        return "shadow-lg"
      case "xl":
        return "shadow-xl"
      case "none":
      default:
        return ""
    }
  }

  return (
    <div className="grid gap-4">
      <div className="flex items-center gap-2">
        <Label htmlFor="num-winners" className="whitespace-nowrap">
          Number of Winners:
        </Label>
        <Input
          id="num-winners"
          type="number"
          min="1"
          max={segments.length || 1}
          value={numWinners}
          onChange={(e) => setNumWinners(Number.parseInt(e.target.value) || 1)}
          className="w-24"
        />
        <Button
          onClick={handleSpin}
          disabled={spinning || segments.length === 0}
          className={`bg-swu-red hover:bg-swu-red/90 text-white transition-all duration-300 ${
            spinning ? "animate-pulse" : ""
          }`}
        >
          {spinning ? "Spinning..." : "Spin Wheel"}
        </Button>
        {manualStop && spinning && (
          <Button onClick={handleManualStop} className="bg-yellow-500 hover:bg-yellow-600 text-white ml-2">
            Stop
          </Button>
        )}
      </div>

      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>Total Spins: {spinCount}</span>
      </div>

      <div
        className={`relative w-full mx-auto rounded-full ${getShadowClass(wheelShadow)}`}
        style={{
          width: (() => {
            // 🎯 CONSISTENT SIZING - Same size for all wheels
            const screenWidth = window.innerWidth
            const screenHeight = window.innerHeight

            // 📱 ENHANCED RESPONSIVE BREAKPOINTS - More responsive sizing for all wheels
            if (screenWidth < 320) {
              return `${Math.min(300, screenWidth - 5, screenHeight - 110)}px`
            } else if (screenWidth < 375) {
              return `${Math.min(360, screenWidth - 10, screenHeight - 130)}px`
            } else if (screenWidth < 414) {
              return `${Math.min(400, screenWidth - 15, screenHeight - 150)}px`
            } else if (screenWidth < 480) {
              return `${Math.min(440, screenWidth - 20, screenHeight - 170)}px`
            } else if (screenWidth < 640) {
              return `${Math.min(520, screenWidth - 25, screenHeight - 190)}px`
            } else if (screenWidth < 768) {
              return `${Math.min(620, screenWidth - 35, screenHeight - 210)}px`
            } else if (screenWidth < 1024) {
              return `${Math.min(720, screenWidth - 45, screenHeight - 240)}px`
            } else if (screenWidth < 1280) {
              return `${Math.min(820, screenWidth - 55, screenHeight - 270)}px`
            } else if (screenWidth < 1440) {
              return `${Math.min(880, screenWidth - 65, screenHeight - 310)}px`
            } else if (screenWidth < 1680) {
              return `${Math.min(920, screenWidth - 75, screenHeight - 350)}px`
            } else if (screenWidth < 1920) {
              return `${Math.min(960, screenWidth - 85, screenHeight - 390)}px`
            } else {
              return `${Math.min(1050, screenWidth - 95, screenHeight - 430)}px`
            }
          })(),
          height: (() => {
            // 🎯 CONSISTENT SIZING - Same size for all wheels
            const screenWidth = window.innerWidth
            const screenHeight = window.innerHeight

            // 📱 CONSISTENT BREAKPOINTS - Fixed sizing for all wheels
            if (screenWidth < 320) {
              return `${Math.min(280, screenWidth - 10, screenHeight - 120)}px`
            } else if (screenWidth < 375) {
              return `${Math.min(340, screenWidth - 15, screenHeight - 140)}px`
            } else if (screenWidth < 414) {
              return `${Math.min(380, screenWidth - 20, screenHeight - 160)}px`
            } else if (screenWidth < 480) {
              return `${Math.min(420, screenWidth - 25, screenHeight - 180)}px`
            } else if (screenWidth < 640) {
              return `${Math.min(480, screenWidth - 30, screenHeight - 200)}px`
            } else if (screenWidth < 768) {
              return `${Math.min(580, screenWidth - 40, screenHeight - 220)}px`
            } else if (screenWidth < 1024) {
              return `${Math.min(680, screenWidth - 50, screenHeight - 250)}px`
            } else if (screenWidth < 1280) {
              return `${Math.min(780, screenWidth - 60, screenHeight - 280)}px`
            } else if (screenWidth < 1440) {
              return `${Math.min(840, screenWidth - 70, screenHeight - 320)}px`
            } else if (screenWidth < 1680) {
              return `${Math.min(880, screenWidth - 80, screenHeight - 360)}px`
            } else if (screenWidth < 1920) {
              return `${Math.min(920, screenWidth - 90, screenHeight - 400)}px`
            } else {
              return `${Math.min(1000, screenWidth - 100, screenHeight - 440)}px`
            }
          })(),
          border: `${wheelBorderWidth}px solid ${wheelBorderColor}`,
          backgroundImage: wheelBgImage ? `url(${wheelBgImage})` : "none",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        {/* The spinning wheel container */}
        <div
          id="spinning-wheel"
          className="absolute inset-0 rounded-full ease-out"
          style={{
            background: getConicGradient(),
            transform: `rotate(${spinDegree}deg)`,
            transition: spinning ? `transform ${spinDuration}s cubic-bezier(0.25, 0.1, 0.25, 1)` : "none",
          }}
        >
          {segments.length > 0 ? (
            segments.map((segment, index) => {
              const segmentCount = segments.length
              const angle = 360 / segmentCount
              const midAngle = index * angle + angle / 2 // Midpoint angle of the segment

              // Enhanced responsive text positioning for larger wheels
              // Adjusted radius ratio for better text fit with larger wheels
              const screenWidth = window.innerWidth
              const textRadiusRatio = screenWidth < 640 ? 0.65 : screenWidth < 1024 ? 0.68 : 0.72 // Closer positioning for better fit

              const x = 50 + textRadiusRatio * 50 * Math.sin((midAngle * Math.PI) / 180)
              const y = 50 - textRadiusRatio * 50 * Math.cos((midAngle * Math.PI) / 180)

              return (
                <div
                  key={index}
                  className="absolute text-white font-bold flex items-center justify-center"
                  style={{
                    left: `${x}%`,
                    top: `${y}%`,
                    transform: `translate(-50%, -50%) rotate(-${spinDegree}deg)`, // Counter-rotate text to keep it upright
                    whiteSpace: "nowrap",
                    textAlign: "center",
                    pointerEvents: "none", // Prevent text from interfering with wheel clicks
                    // Enhanced responsive font sizing for all wheels
                    fontSize: (() => {
                      const screenWidth = window.innerWidth

                      // More responsive font sizing
                      if (screenWidth < 400) {
                        return '14px' // Increased from 12px
                      } else if (screenWidth < 700) {
                        return '16px' // Increased from 14px
                      } else if (screenWidth < 1024) {
                        return '18px' // Increased from 16px
                      } else {
                        return '20px' // Increased for larger screens
                      }
                    })(),
                    // Enhanced responsive max width based on segment angle and text length
                    maxWidth: `${Math.max(15, Math.min(angle * 0.8, 90))}%`,
                    maxHeight: "25%", // Increased height for better text fit
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    opacity: mysterySpin && spinning ? 0 : 1, // Hide text during mystery spin
                    transition: "opacity 0.3s ease-in-out",
                  }}
                >
                  {wheelType === "image" ? (
                    <img
                      src={segment || "/placeholder.svg"}
                      alt={`Wheel item ${index + 1}`}
                      className="max-w-[80%] max-h-[80%] object-contain"
                      crossOrigin="anonymous"
                    />
                  ) : (
                    segment
                  )}
                </div>
              )
            })
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">No items to display.</div>
          )}
        </div>
        {/* Fixed pointer - changed to gold for contrast */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[10px] border-l-transparent border-r-[10px] border-r-transparent border-b-[20px] border-b-yellow-500 z-10" />

        {centerImage && (
          <img
            src={centerImage || "/placeholder.svg"}
            alt="Center of wheel"
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 object-contain z-20"
            style={{ width: `${centerImageSize}px`, height: `${centerImageSize}px` }}
            crossOrigin="anonymous"
          />
        )}
      </div>

      <Dialog open={showWinnersDialog} onOpenChange={setShowWinnersDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-swu-red">
              <CheckCircle2 className="h-6 w-6 text-green-500" />
              Winners!
            </DialogTitle>
            <DialogDescription>{congratulatoryMessage.replace("{winner}", winners.join(", "))}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            {winners.map((winner, index) => (
              <Card key={index} className="p-3 border-swu-red/50">
                <CardTitle className="text-lg text-swu-red">{winner}</CardTitle>
                {/* For participant type, you might want to show more details */}
                {wheelType === "participant" && participants.find((p) => p.name === winner) && (
                  <>
                    {participants.find((p) => p.name === winner)?.email && (
                      <p className="text-sm text-muted-foreground">
                        {participants.find((p) => p.name === winner)?.email}
                      </p>
                    )}
                    {participants.find((p) => p.name === winner)?.contactNumber && (
                      <p className="text-sm text-muted-foreground">
                        {participants.find((p) => p.name === winner)?.contactNumber}
                      </p>
                    )}
                  </>
                )}
              </Card>
            ))}
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Enhanced Winner Popup - Web Only */}
      <EnhancedWinnerPopup
        isOpen={showEnhancedWinnerPopup}
        onClose={() => setShowEnhancedWinnerPopup(false)}
        winners={winners.map((winner, index) => {
          // For participant wheels, try to get full participant data
          const participant = wheelType === "participant" ? participants.find(p => p.name === winner) : null
          return {
            id: participant?.id || `winner-${index}`,
            name: winner,
            email: participant?.email,
            contactNumber: participant?.contactNumber,
            color: `hsl(${(index * 137.5) % 360}, 70%, 50%)`
          }
        })}
        congratsMessage={congratulatoryMessage}
        wheelType={wheelType === "image" ? "image-picker" : "regular"}
        showConfetti={confettiAndSound}
      />
    </div>
  )
}
