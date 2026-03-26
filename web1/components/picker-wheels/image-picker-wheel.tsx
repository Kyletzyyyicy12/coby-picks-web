"use client"

import { useState, useEffect, useRef, useCallback, useMemo, memo } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { toast } from "@/hooks/use-toast"
import { Play, Pause, RotateCcw, Settings, Edit3, Upload, Link, RefreshCw } from "lucide-react"
import confetti from "canvas-confetti"
import { EnhancedWheel } from "@/components/randomizer/enhanced-wheel"
import { ImageWheelSlice } from "@/types/image-wheel-types"
import { imageStorageManager } from "@/lib/image-storage-manager"
import { EnhancedWinnerPopup } from "@/components/shared/enhanced-winner-popup"

// Firebase imports for real-time synchronization
import { db } from "@/lib/firebase"
import { onSnapshot, doc, updateDoc, serverTimestamp, getDoc } from "firebase/firestore"

// Enhanced wheel integration props
interface EnhancedImagePickerWheelProps extends ImagePickerWheelProps {
  useEnhancedSpinning?: boolean
  enhancedWheelProps?: any
}

interface ImagePickerWheelProps {
  slices?: ImageWheelSlice[]
  onSpinComplete?: (result: any) => void
  onSettingsChange?: (settings: any) => void
  isLiveMode?: boolean
  sessionId?: string
  disabled?: boolean
  wheelTitle?: string
  enableRealTimeSync?: boolean
  organizerMode?: boolean
  userPermissions?: any
  wheelTheme?: {
    primary?: string
    secondary?: string
    accent?: string
    background?: string
  }
  session?: any // Session data for synchronization
  isSpinning?: boolean // External spinning state for synchronization
}

export const ImagePickerWheel = memo(function ImagePickerWheel({
    slices: initialSlices = [],
    onSpinComplete,
    onSettingsChange,
    isLiveMode = false,
    sessionId,
    disabled = false,
    wheelTitle = "Image Picker Wheel",
    enableRealTimeSync = false,
    organizerMode = false,
    userPermissions = {},
    useEnhancedSpinning = true,
    enhancedWheelProps = {},
    wheelTheme,
    session,
    isSpinning: externalIsSpinning = false,
  }: EnhancedImagePickerWheelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isSpinning, setIsSpinning] = useState(false)
  const [currentAngle, setCurrentAngle] = useState(0)
  const [winners, setWinners] = useState<ImageWheelSlice[]>([])
  const [showResults, setShowResults] = useState(false)
  const [showWinnerPopup, setShowWinnerPopup] = useState(false)

  // Image slice management - memoize to prevent unnecessary re-renders
  const [slices, setSlices] = useState<ImageWheelSlice[]>(initialSlices)

  // Memoize slices to prevent unnecessary re-renders
  const memoizedSlices = useMemo(() => slices, [slices])
  const [isEditingImages, setIsEditingImages] = useState(false)
  const [imageUrlInputs, setImageUrlInputs] = useState<{[key: string]: string}>({})
  const [pendingImageUrls, setPendingImageUrls] = useState<{[key: string]: string}>({})
  const [imageLoadStates, setImageLoadStates] = useState<{[key: string]: 'loading' | 'loaded' | 'error'}>({})

  // Pre-loaded images for performance with persistent caching
  const [preloadedImages, setPreloadedImages] = useState<{[key: string]: HTMLImageElement}>({})
  const [imageUrlCache, setImageUrlCache] = useState<{[key: string]: string}>({})
  const [imageValidationCache, setImageValidationCache] = useState<{[key: string]: boolean}>({})

  // Real-time synchronization state
  const [lastImageUpdate, setLastImageUpdate] = useState<number>(0)
  const [imageSyncInProgress, setImageSyncInProgress] = useState(false)

  // Image persistence tracking
  const [spinCount, setSpinCount] = useState<number>(0)
  const [lastKnownGoodImages, setLastKnownGoodImages] = useState<{[key: string]: HTMLImageElement}>({})

  // Enhanced wheel integration for live sessions
  const [remoteSpinning, setRemoteSpinning] = useState<boolean>(false)
  const [remoteSpinData, setRemoteSpinData] = useState<any>(null)
  const [remoteWinners, setRemoteWinners] = useState<ImageWheelSlice[]>([])

  // Mode detection and role management
  const isSoloMode = !isLiveMode
  const isParticipantMode = isLiveMode && !organizerMode && !userPermissions.isFullAccessCollaborator
  const isCollaboratorMode = isLiveMode && userPermissions.isFullAccessCollaborator
  const canEditImages = organizerMode || isCollaboratorMode || isSoloMode
  const canSpinWheel = organizerMode || isCollaboratorMode || isSoloMode

  // Use theme colors from organizer or default colors
  const themeColors = wheelTheme || {
    primary: "#8e0b16",
    secondary: "#66181E",
    accent: "#ffffff",
    background: "#ffffff"
  }

  // Enhanced responsive canvas sizing - matches EnhancedWheel exactly
  const getCanvasSize = useCallback(() => {
    const screenWidth = typeof window !== 'undefined' ? window.innerWidth : 1024
    const screenHeight = typeof window !== 'undefined' ? window.innerHeight : 768

    // 🎯 ENHANCED RESPONSIVE BREAKPOINTS - More responsive sizing for all wheels
    if (screenWidth < 320) {
      return Math.min(300, screenWidth - 5, screenHeight - 110) // Increased from 280
    } else if (screenWidth < 375) {
      return Math.min(360, screenWidth - 10, screenHeight - 130) // Increased from 340
    } else if (screenWidth < 414) {
      return Math.min(400, screenWidth - 15, screenHeight - 150) // Increased from 380
    } else if (screenWidth < 480) {
      return Math.min(440, screenWidth - 20, screenHeight - 170) // Increased from 420
    } else if (screenWidth < 640) {
      return Math.min(520, screenWidth - 25, screenHeight - 190) // Increased from 480
    } else if (screenWidth < 768) {
      return Math.min(620, screenWidth - 35, screenHeight - 210) // Increased from 580
    } else if (screenWidth < 1024) {
      return Math.min(720, screenWidth - 45, screenHeight - 240) // Increased from 680
    } else if (screenWidth < 1280) {
      return Math.min(820, screenWidth - 55, screenHeight - 270) // Increased from 780
    } else if (screenWidth < 1440) {
      return Math.min(880, screenWidth - 65, screenHeight - 310) // Increased from 840
    } else if (screenWidth < 1680) {
      return Math.min(920, screenWidth - 75, screenHeight - 350) // Increased from 880
    } else if (screenWidth < 1920) {
      return Math.min(960, screenWidth - 85, screenHeight - 390) // Increased from 920
    } else {
      return Math.min(1050, screenWidth - 95, screenHeight - 430) // Increased from 1000
    }
  }, [])

  const [canvasSize, setCanvasSize] = useState(720)

  // Responsive canvas sizing - matches EnhancedWheel exactly
  useEffect(() => {
    const updateCanvasSize = () => {
      const canvas = canvasRef.current
      if (canvas) {
        const newSize = getCanvasSize()
        canvas.width = newSize
        canvas.height = newSize
        setCanvasSize(newSize)
        console.log("🎨 ImagePickerWheel canvas resized:", {
          newSize,
          screenWidth: typeof window !== 'undefined' ? window.innerWidth : 'N/A',
          screenHeight: typeof window !== 'undefined' ? window.innerHeight : 'N/A'
        })
      }
    }

    updateCanvasSize()
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', updateCanvasSize)
      return () => window.removeEventListener('resize', updateCanvasSize)
    }
    return () => {}
  }, [getCanvasSize])


  // Initialize slices with default data if none provided
  useEffect(() => {
    if (initialSlices.length === 0) {
      const defaultSlices: ImageWheelSlice[] = Array.from({ length: 6 }, (_, index) => ({
        id: `slice-${index}`,
        text: ` ${index + 1}`,
        color: index % 2 === 0 ? "#8e0b16" : "#66181E",
        image: undefined,
        description: undefined,
        metadata: undefined
      }))
      setSlices(defaultSlices)
    } else {
      setSlices(initialSlices)
    }
  }, [initialSlices])

  // Add one slice dynamically
  const addSlice = useCallback(() => {
    if (!canEditImages) {
      toast({
        title: "Permission Denied",
        description: "You don't have permission to add slices in this mode",
        variant: "destructive"
      })
      return
    }

    if (slices.length >= 20) {
      toast({
        title: "Maximum Reached",
        description: "Wheel can have a maximum of 20 slices",
        variant: "destructive"
      })
      return
    }

    const sliceNumber = slices.length + 1
    const newSlice: ImageWheelSlice = {
      id: `slice-${Date.now()}`,
      text: `Slice ${sliceNumber}`,
      color: sliceNumber % 2 === 0 ? "#8e0b16" : "#66181E",
      image: undefined,
      description: undefined,
      metadata: undefined
    }

    setSlices(prev => [...prev, newSlice])

    toast({
      title: "Slice Added",
      description: `Added Slice ${sliceNumber} to the wheel`,
    })
  }, [canEditImages, slices.length])

  // Remove slices dynamically
  const removeSlice = useCallback((sliceId: string) => {
    if (!canEditImages) {
      toast({
        title: "Permission Denied",
        description: "You don't have permission to remove slices in this mode",
        variant: "destructive"
      })
      return
    }

    if (slices.length <= 2) {
      toast({
        title: "Cannot Remove Slice",
        description: "Wheel must have at least 2 slices",
        variant: "destructive"
      })
      return
    }

    setSlices(prev => prev.filter(slice => slice.id !== sliceId))

    // Clean up related state for this slice
    setPreloadedImages(prev => {
      const newPreloaded = { ...prev }
      delete newPreloaded[sliceId]
      return newPreloaded
    })
    setImageLoadStates(prev => {
      const newStates = { ...prev }
      delete newStates[sliceId]
      return newStates
    })
    setImageUrlCache(prev => {
      const newCache = { ...prev }
      delete newCache[sliceId]
      return newCache
    })
    setLastKnownGoodImages(prev => {
      const newLastKnown = { ...prev }
      delete newLastKnown[sliceId]
      return newLastKnown
    })

    toast({
      title: "Slice Removed",
      description: "Slice has been removed from the wheel",
    })
  }, [canEditImages, slices.length])

  // Real-time image synchronization effect
  useEffect(() => {
    if (!enableRealTimeSync || !sessionId || !organizerMode) return

    console.log("🔄 Setting up real-time image synchronization for organizer mode")

    // In a real implementation, this would listen to Firebase for image updates
    // For now, we'll simulate the synchronization
    const syncInterval = setInterval(() => {
      // Check for image updates from other participants
      console.log("🔄 Checking for image updates...")
    }, 5000)

    return () => clearInterval(syncInterval)
  }, [enableRealTimeSync, sessionId, organizerMode])

  // Enhanced real-time spinning synchronization for live sessions
  useEffect(() => {
    if (!isLiveMode || !sessionId || !enableRealTimeSync) return

    console.log("🎯 Setting up real-time spinning synchronization for live session:", sessionId, {
      isParticipantMode: !organizerMode,
      hasUserPermissions: !!userPermissions,
      enableRealTimeSync: enableRealTimeSync
    })

    let isMounted = true

    // Listen for spinning state changes from other users (organizer or collaborator)
    const spinUnsubscribe = onSnapshot(
      doc(db, "liveDrawSessions", sessionId),
      (docSnapshot) => {
        if (!isMounted || !docSnapshot.exists()) return

        const sessionData = docSnapshot.data()
        const wheelState = sessionData.wheelState
        const currentRemoteSpinning = sessionData.isSpinning || wheelState?.isSpinning || false
        const broadcastSource = wheelState?.broadcastSource || 'unknown'

        console.log("⚡ LIVE SPIN SYNC DETECTION:", {
          remoteSpinning: currentRemoteSpinning,
          localSpinning: isSpinning,
          broadcastSource: broadcastSource,
          organizerMode: organizerMode,
          isCollaboratorMode: isCollaboratorMode,
          shouldRespond: organizerMode ? false : true,
          wheelType: wheelState?.wheelType,
          sessionId: sessionId,
          timestamp: new Date().toISOString()
        })

        // 🔥 CRITICAL STABILITY: Only non-organizers respond to remote spins
        // Organizers handle their own spinning, collaborators sync to organizer/other collaborator spins
        const shouldRespondToRemoteSpin = !organizerMode && (broadcastSource === 'organizer' || broadcastSource === 'collaborator')

        if (shouldRespondToRemoteSpin) {
          // Start spinning if remote spin initiated
          if (currentRemoteSpinning && !isSpinning && !remoteSpinning) {
            console.log("🎯 REMOTE SPIN DETECTED - Syncing wheel", { broadcastSource, organizerMode, isCollaboratorMode })

            // Set remote spinning state to prevent re-triggering
            setRemoteSpinning(true)

            // Calculate spin parameters from remote data
            const spinDuration = wheelState?.spinDuration || 3000
            const totalRotation = wheelState?.totalRotation || (5 + Math.random() * 3) * 2 * Math.PI
            const finalAngle = wheelState?.finalAngle || Math.random() * 2 * Math.PI
            const spins = wheelState?.spins || 5 + Math.random() * 3

            const remoteSpinData = {
              spinDuration,
              totalRotation,
              finalAngle,
              spins,
              wheelItemsUsed: wheelState?.wheelItemsUsed || slices.map(s => s.text),
              winningIndex: wheelState?.winningIndex,
              winners: wheelState?.winners || [],
              animationTheme: wheelState?.animationTheme || wheelState?.theme,
              broadcastSource: broadcastSource,
              timestamp: Date.now()
            }

            setRemoteSpinData(remoteSpinData)

            // Start synchronized animation
            startSynchronizedSpin(remoteSpinData)
          }

          // Stop spinning when remote completes
          if ((!currentRemoteSpinning || wheelState?.completedAt) && (isSpinning || remoteSpinning)) {
            console.log("🎯 REMOTE SPIN COMPLETED - Stopping local wheel", { broadcastSource })
            setRemoteSpinning(false)
            setIsSpinning(false)

            // Handle winners from remote
            if (wheelState?.winners && wheelState.winners.length > 0) {
              console.log("🏆 REMOTE WINNERS RECEIVED:", wheelState.winners, { broadcastSource })

              // Convert remote winners to local slice format
              const winnerSlices = wheelState.winners.map((winner: any) => {
                // Find matching slice by text/name
                const matchingSlice = slices.find(slice => slice.text === winner.name || slice.id === winner.id)
                return matchingSlice || {
                  id: winner.id || `winner-${Date.now()}`,
                  text: winner.name || winner.text || 'Winner',
                  color: winner.color || '#8e0b16'
                }
              })

              setRemoteWinners(winnerSlices)
              setWinners(winnerSlices)
              setShowResults(true)
              setShowWinnerPopup(true)

              // Trigger confetti
              triggerConfetti()

              // Callback with remote results
              if (onSpinComplete) {
                onSpinComplete({
                  id: Date.now().toString(),
                  winners: winnerSlices,
                  timestamp: new Date(),
                  spinDuration: remoteSpinData?.spinDuration || 3000,
                  totalParticipants: slices.length,
                  source: broadcastSource
                })
              }
            }
          }
        }
      },
      (error) => {
        console.error("❌ Real-time spin sync error:", error)
      }
    )

    return () => {
      isMounted = false
      spinUnsubscribe()
    }
  }, [isLiveMode, sessionId, enableRealTimeSync, isSpinning, remoteSpinning, slices, onSpinComplete, organizerMode, isCollaboratorMode])

  // Enhanced image synchronization for participants
  useEffect(() => {
    if (!isLiveMode || !sessionId || !enableRealTimeSync || organizerMode) return

    console.log("🖼️ Setting up enhanced image synchronization for participants")

    let isMounted = true

    // Listen for image updates from organizer
    const imageUnsubscribe = onSnapshot(
      doc(db, "liveDrawSessions", sessionId),
      (docSnapshot) => {
        if (!isMounted || !docSnapshot.exists()) return

        const sessionData = docSnapshot.data()

        // Handle image wheel slices updates
        if (sessionData.imageWheelSlices && Array.isArray(sessionData.imageWheelSlices)) {
          console.log("🖼️ PARTICIPANT: Received image wheel slices from organizer:", {
            sliceCount: sessionData.imageWheelSlices.length,
            slicesWithImages: sessionData.imageWheelSlices.filter((s: any) => s.image?.url).length,
            sessionId: sessionId
          })

          // Update local slices with organizer's image data
          const updatedSlices = sessionData.imageWheelSlices.map((slice: any, index: number) => ({
            id: slice.id || `slice-${index}`,
            text: slice.text || `Slice ${index + 1}`,
            color: slice.color || `hsl(${(index * 137.5) % 360}, 70%, 60%)`,
            image: slice.image ? {
              url: slice.image.url,
              alt: slice.image.alt || `Image for ${slice.text || `Slice ${index + 1}`}`,
              isLoaded: slice.image.isLoaded !== false,
              error: slice.image.error || false
            } : undefined
          }))

          setSlices(updatedSlices)
          setLastImageUpdate(Date.now())
        }

        // Handle wheel images format updates
        if (sessionData.wheelImages && Array.isArray(sessionData.wheelImages)) {
          console.log("🖼️ PARTICIPANT: Received wheel images from organizer:", {
            imageCount: sessionData.wheelImages.length,
            sessionId: sessionId
          })

          // Convert wheel images to slices format for participant display
          const updatedSlices = sessionData.wheelImages.map((imgData: any, index: number) => ({
            id: imgData.sliceId || `slice-${index}`,
            text: imgData.sliceId || `Slice ${index + 1}`,
            color: `hsl(${(index * 137.5) % 360}, 70%, 60%)`,
            image: imgData.url ? {
              url: imgData.url,
              alt: imgData.alt || `Image for ${imgData.sliceId || `Slice ${index + 1}`}`,
              isLoaded: imgData.isLoaded !== false,
              error: imgData.error || false
            } : undefined
          }))

          setSlices(updatedSlices)
          setLastImageUpdate(Date.now())
        }
      },
      (error) => {
        console.error("❌ Enhanced image sync error:", error)
      }
    )

    return () => {
      isMounted = false
      imageUnsubscribe()
    }
  }, [isLiveMode, sessionId, enableRealTimeSync, organizerMode])

  // Persistent image preloading with enhanced caching - isolated per slice
  const sliceData = useMemo(() => memoizedSlices.map(s => ({ id: s.id, image: s.image })), [memoizedSlices])

  useEffect(() => {
    // Process slices in batches to avoid overwhelming the browser with many slices
    const batchSize = 5 // Process 5 slices at a time
    const batches = []

    for (let i = 0; i < sliceData.length; i += batchSize) {
      batches.push(sliceData.slice(i, i + batchSize))
    }

    // Process each batch with a delay between batches
    batches.forEach((batch, batchIndex) => {
      setTimeout(() => {
        batch.forEach((slice, index) => {
          if (slice.image?.url) {
            const imageUrl = slice.image.url
            const sliceId = slice.id

            // Use setTimeout to stagger the processing of each slice
            setTimeout(() => {
          // Cache the URL for persistence (only if not already cached or changed)
          setImageUrlCache(prev => {
            const currentUrl = prev[sliceId]
            if (currentUrl !== imageUrl) {
              console.log(`📦 Caching URL for slice ${sliceId}:`, imageUrl)
              return { ...prev, [sliceId]: imageUrl }
            }
            return prev
          })

          // Get current state for this specific slice
          const currentCachedUrl = imageUrlCache[sliceId]
          const currentPreloadedImage = preloadedImages[sliceId]
          const currentValidation = imageValidationCache[sliceId]
          const currentLoadState = imageLoadStates[sliceId]
          const lastKnownGood = lastKnownGoodImages[sliceId]
          const currentImgElement = slices.find(s => s.id === sliceId)?.image?.imgElement

          // More robust reload logic - only reload if truly needed
          const needsReload =
            // No preloaded image for this slice
            !currentPreloadedImage ||
            // No imgElement for this slice
            !currentImgElement ||
            // URL changed for this slice
            (currentCachedUrl && imageUrl !== currentCachedUrl) ||
            // Load state indicates error for this slice
            currentLoadState === 'error'

          // Additional check: don't reload if already loading this specific URL
          const isLoadingThisUrl = currentLoadState === 'loading' &&
                                   currentCachedUrl === imageUrl

          if (needsReload && currentCachedUrl && !isLoadingThisUrl) {
            console.log(`🔄 Loading image for slice ${sliceId}:`, imageUrl)

            // Set loading state for this specific slice
            setImageLoadStates(prev => ({ ...prev, [sliceId]: 'loading' }))

            const img = new Image()
            img.crossOrigin = "anonymous"

            img.onload = () => {
              console.log(`✅ Image loaded successfully for slice ${sliceId}`)

              // Update all related states for this specific slice atomically
              setPreloadedImages(prev => ({ ...prev, [sliceId]: img }))
              setImageLoadStates(prev => ({ ...prev, [sliceId]: 'loaded' }))
              setImageValidationCache(prev => ({ ...prev, [sliceId]: true }))
              setLastKnownGoodImages(prev => ({ ...prev, [sliceId]: img }))

              // Update slice with the loaded image element
              setSlices(prev => prev.map(s => {
                if (s.id === sliceId && s.image) {
                  return {
                    ...s,
                    image: {
                      ...s.image,
                      imgElement: img
                    }
                  }
                }
                return s
              }))
            }

            img.onerror = (error) => {
              console.error(`❌ Failed to load image for slice ${sliceId}:`, {
                url: imageUrl,
                error,
                sliceId
              })

              // Update error states for this specific slice
              setImageLoadStates(prev => ({ ...prev, [sliceId]: 'error' }))
              setImageValidationCache(prev => ({ ...prev, [sliceId]: false }))

              // Try to recover from last known good image for this slice only
              if (lastKnownGood && lastKnownGood !== currentPreloadedImage) {
                console.log(`🔄 Attempting recovery for slice ${sliceId} from cache`)
                setPreloadedImages(prev => ({ ...prev, [sliceId]: lastKnownGood }))
                setImageLoadStates(prev => ({ ...prev, [sliceId]: 'loaded' }))
              }
            }

            img.src = imageUrl
          } else if (currentPreloadedImage && currentLoadState === 'loaded') {
            // Ensure validation cache is set for already loaded images
            setImageValidationCache(prev => {
              if (prev[sliceId] !== true) {
                console.log(`🔧 Fixing validation cache for slice ${sliceId}`)
                return { ...prev, [sliceId]: true }
              }
              return prev
            })

            // Ensure imgElement is set for already loaded images (no update needed, using preloadedImages)
          }
            }, 0) // Immediate processing for faster updates
          }
        })
      }, batchIndex * 100) // 100ms delay between batches
    })
  }, [sliceData, imageUrlCache, preloadedImages, imageLoadStates, lastKnownGoodImages]) // Depend on necessary cache states

  // Enhanced wheel drawing function with image support - memoized for stability
  const drawWheelAtAngleWithImages = useCallback((ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, angle: number, wheelSlices: ImageWheelSlice[]) => {
    if (wheelSlices.length === 0) return

    const centerX = canvas.width / 2
    const centerY = canvas.height / 2
    // Adjust radius based on slice count for better visibility with more slices
    const baseRadius = Math.min(centerX, centerY) - 10 // Reduced padding for larger wheel
    const sliceCount = wheelSlices.length
    const radius = sliceCount > 12 ? baseRadius * 0.92 : sliceCount > 8 ? baseRadius * 0.96 : baseRadius

    // 🎯 RESPONSIVE DESIGN: Match EnhancedWheel responsive logic
    const isMobile = canvas.width < 400
    const isTablet = canvas.width >= 400 && canvas.width < 700
    const isDesktop = canvas.width >= 700

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    wheelSlices.forEach((slice, index) => {
      const segmentAngle = (2 * Math.PI) / wheelSlices.length
      const startAngle = index * segmentAngle + angle
      const endAngle = startAngle + segmentAngle

      // Draw the slice background (fallback color)
      const isEven = index % 2 === 0
      ctx.fillStyle = isEven ? slice.color : slice.color
      ctx.beginPath()
      ctx.moveTo(centerX, centerY)
      ctx.arc(centerX, centerY, radius, startAngle, endAngle)
      ctx.closePath()
      ctx.fill()

      // Draw image with enhanced persistence and error recovery
      if (slice.image?.url) {
        console.log(`🎨 Drawing image for slice ${slice.id}:`, {
          url: slice.image.url,
          hasPreloadedImage: !!preloadedImages[slice.id],
          hasLastKnownGood: !!lastKnownGoodImages[slice.id],
          loadState: imageLoadStates[slice.id],
          hasCache: !!imageUrlCache[slice.id]
        })

        // CRITICAL FIX: More robust image selection with multiple fallbacks
        let img: HTMLImageElement | undefined

        // Priority 1: Use preloaded image if valid (primary source)
        if (preloadedImages[slice.id] && preloadedImages[slice.id].complete && preloadedImages[slice.id].naturalWidth > 0) {
          img = preloadedImages[slice.id]
        }
        // Priority 2: Use slice's direct imgElement if valid
        else if (slice.image?.imgElement && slice.image.imgElement.complete && slice.image.imgElement.naturalWidth > 0) {
          img = slice.image.imgElement
        }
        // Priority 3: Use last known good image if valid
        else if (lastKnownGoodImages[slice.id] && lastKnownGoodImages[slice.id].complete && lastKnownGoodImages[slice.id].naturalWidth > 0) {
          img = lastKnownGoodImages[slice.id]
          // Update preloaded for consistency
          setPreloadedImages(prev => ({ ...prev, [slice.id]: img! }))
        }
        // Priority 4: No valid image found
        else {
          img = undefined
        }

        if (img) {
          console.log(`✅ Drawing image for slice ${slice.id}:`, {
            hasImg: !!img,
            naturalWidth: img.naturalWidth,
            naturalHeight: img.naturalHeight,
            complete: img.complete,
            src: img.src?.substring(0, 50) + '...'
          })

          // Calculate image dimensions and position for perfect fit
          const sliceRadius = radius

          // 🎯 RESPONSIVE IMAGE SIZING: Match EnhancedWheel responsive scaling
          let imageScale: number
          if (isMobile) {
            imageScale = 1.6 // Smaller scale on mobile for better fit
          } else if (isTablet) {
            imageScale = 1.7 // Medium scale for tablets
          } else {
            imageScale = 1.8 // Original scale for desktop
          }

          const imageSize = sliceRadius * imageScale

          // Save context for image clipping
          ctx.save()

          // Create circular clipping path for this slice
          ctx.beginPath()
          ctx.moveTo(centerX, centerY)
          ctx.arc(centerX, centerY, sliceRadius, startAngle, endAngle)
          ctx.closePath()
          ctx.clip()

          // Calculate image dimensions to cover the slice without gaps
          const sliceDiameter = radius * 2
          const imgAspectRatio = img.width / img.height

          let drawWidth, drawHeight

          if (imgAspectRatio > 1) {
            // Image is wider than tall, scale to cover width
            drawWidth = sliceDiameter
            drawHeight = drawWidth / imgAspectRatio
          } else {
            // Image is taller, scale to cover height
            drawHeight = sliceDiameter
            drawWidth = drawHeight * imgAspectRatio
          }

          // Center the image in the slice
          const drawX = centerX - drawWidth / 2
          const drawY = centerY - drawHeight / 2

          try {
            // Draw the image with error handling
            ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight)
            console.log(`🎨 Successfully drew image for slice ${slice.id}`)
          } catch (error) {
            console.error(`❌ Error drawing image for slice ${slice.id}:`, error)
            // Try to recover the image if drawing fails
            if (lastKnownGoodImages[slice.id] && lastKnownGoodImages[slice.id] !== img) {
              console.log(`🔄 Attempting recovery draw for slice ${slice.id}`)
              try {
                ctx.drawImage(lastKnownGoodImages[slice.id], drawX, drawY, drawWidth, drawHeight)
                console.log(`✅ Recovered image draw for slice ${slice.id}`)
              } catch (recoveryError) {
                console.error(`❌ Recovery draw failed for slice ${slice.id}:`, recoveryError)
              }
            }
          }

          // Restore context
          ctx.restore()
        } else {
          // No preloaded image, but URL exists - draw placeholder
          if (slice.image?.url) {
            console.log(`⏳ Drawing placeholder for slice ${slice.id} - image loading...`)

            // Calculate image dimensions for placeholder
            const sliceRadius = radius
            const imageSize = sliceRadius * 1.8 // Slightly larger than slice for cover effect

            // Save context for image clipping
            ctx.save()

            // Create circular clipping path for this slice
            ctx.beginPath()
            ctx.moveTo(centerX, centerY)
            ctx.arc(centerX, centerY, sliceRadius, startAngle, endAngle)
            ctx.closePath()
            ctx.clip()

            // Calculate dimensions for placeholder
            const drawWidth = imageSize
            const drawHeight = imageSize
            const drawX = centerX - drawWidth / 2
            const drawY = centerY - drawHeight / 2

            // Draw a placeholder background
            ctx.fillStyle = '#f0f0f0'
            ctx.fillRect(drawX, drawY, drawWidth, drawHeight)

            // Draw loading text
            ctx.fillStyle = '#666'
            ctx.font = '16px Arial'
            ctx.textAlign = 'center'
            ctx.fillText('Loading...', centerX, centerY + 10)

            // Restore context
            ctx.restore()

          } else {
            console.log(`⚠️ No image URL for slice ${slice.id}, trying recovery...`)

            // Try to recover from cache
            if (imageUrlCache[slice.id] && !imageSyncInProgress) {
              const recoveryImg = new Image()
              recoveryImg.crossOrigin = "anonymous"

              recoveryImg.onload = () => {
                setPreloadedImages(prev => ({ ...prev, [slice.id]: recoveryImg }))
                setImageLoadStates(prev => ({ ...prev, [slice.id]: 'loaded' }))
                setLastKnownGoodImages(prev => ({ ...prev, [slice.id]: recoveryImg }))
                console.log(`✅ Image recovered for slice ${slice.id}`)
              }

              recoveryImg.onerror = (error) => {
                console.error(`❌ Recovery failed for slice ${slice.id}:`, error)
              }

              recoveryImg.src = imageUrlCache[slice.id]
            }
          }
        }
      }

      // Draw enhanced borders for better slice definition
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)'
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.moveTo(centerX, centerY)
      ctx.arc(centerX, centerY, radius, startAngle, endAngle)
      ctx.closePath()
      ctx.stroke()

    })

    // Draw center circle with responsive sizing
    let centerRadius: number
    let centerLineWidth: number

    if (isMobile) {
      centerRadius = Math.max(25, canvas.width / 15)
      centerLineWidth = 3
    } else if (isTablet) {
      centerRadius = Math.max(30, canvas.width / 13)
      centerLineWidth = 4
    } else {
      centerRadius = Math.max(35, canvas.width / 12)
      centerLineWidth = 4
    }

    ctx.beginPath()
    ctx.arc(centerX, centerY, centerRadius, 0, 2 * Math.PI)
    ctx.fillStyle = themeColors.accent || "#ffffff"
    ctx.fill()
    ctx.strokeStyle = themeColors.primary || "#8e0b16"
    ctx.lineWidth = centerLineWidth
    ctx.stroke()

    // Draw pointer with responsive sizing
    let pointerSize: number
    let pointerOffset: number
    let pointerLineWidth: number

    if (isMobile) {
      pointerSize = Math.max(12, canvas.width / 35)
      pointerOffset = radius + 2
      pointerLineWidth = 4
    } else if (isTablet) {
      pointerSize = Math.max(16, canvas.width / 28)
      pointerOffset = radius + 3
      pointerLineWidth = 5
    } else {
      pointerSize = Math.max(18, canvas.width / 25)
      pointerOffset = radius + 4
      pointerLineWidth = 6
    }

    const pointerTipX = centerX + radius
    const pointerBaseX = pointerTipX - pointerSize * (isMobile ? 1.6 : 1.8)

    ctx.save()
    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)'
    ctx.shadowBlur = isMobile ? 10 : 15
    ctx.shadowOffsetX = isMobile ? 3 : 5
    ctx.shadowOffsetY = isMobile ? 3 : 5

    ctx.beginPath()
    ctx.moveTo(pointerBaseX, centerY)
    ctx.lineTo(pointerTipX, centerY - pointerSize * (isMobile ? 0.8 : 0.9))
    ctx.lineTo(pointerTipX, centerY + pointerSize * (isMobile ? 0.8 : 0.9))
    ctx.closePath()
    ctx.fillStyle = themeColors.accent || "#ffffff"
    ctx.fill()
    ctx.strokeStyle = themeColors.primary || "#8e0b16"
    ctx.lineWidth = pointerLineWidth
    ctx.stroke()
    ctx.restore()
  }, [preloadedImages, lastKnownGoodImages, imageLoadStates, imageUrlCache, imageSyncInProgress, themeColors])

  // Image validation and recovery before spinning
  const validateAndRecoverImages = useCallback(() => {
    slices.forEach(slice => {
      if (slice.image?.url && imageUrlCache[slice.id]) {
        const sliceId = slice.id
        const cachedImage = preloadedImages[sliceId]
        const lastKnownGood = lastKnownGoodImages[sliceId]

        // Check if image is still valid
        if (cachedImage && imageValidationCache[sliceId]) {
          // Test if image is still accessible
          if (cachedImage.complete && cachedImage.naturalWidth === 0) {
            console.log(`🔄 Image lost for slice ${sliceId}, attempting recovery...`)
            setImageValidationCache(prev => ({ ...prev, [sliceId]: false }))

            // Try to reload from last known good image
            if (lastKnownGood) {
              setPreloadedImages(prev => ({ ...prev, [sliceId]: lastKnownGood }))
              setImageLoadStates(prev => ({ ...prev, [sliceId]: 'loaded' }))
              console.log(`✅ Recovered image for slice ${sliceId}`)
            }
          }
        }
      }
    })
  }, [slices, imageUrlCache, imageValidationCache, lastKnownGoodImages])

   // Synchronized spin function for live sessions
   const startSynchronizedSpin = useCallback((spinData: any) => {
     if (isSpinning || slices.length === 0) return

     console.log("🎯 Starting synchronized spin with data:", spinData)

     // Set spinning state
     setIsSpinning(true)
     setShowResults(false)

     // Calculate winner based on organizer's data
     const segmentAngle = (2 * Math.PI) / slices.length
     const normalizedRotation = spinData.totalRotation % (2 * Math.PI)
     const adjustedAngle = -normalizedRotation
     const winningIndex = Math.floor(adjustedAngle / segmentAngle) % slices.length
     const finalWinningIndex = winningIndex < 0 ? slices.length + winningIndex : winningIndex
     const winner = slices[finalWinningIndex]

     // Animation using organizer's parameters
     const startTime = performance.now()
     const spinDuration = spinData.spinDuration || 3000
     const totalRotation = spinData.totalRotation || (5 + Math.random() * 3) * 2 * Math.PI

     let animationId: number

     const animate = () => {
       const currentTime = performance.now()
       const elapsed = currentTime - startTime
       const progress = Math.min(elapsed / spinDuration, 1)

       // Smooth easing
       const easeProgress = 1 - Math.pow(1 - progress, 3)
       const currentRotation = totalRotation * easeProgress

       // Validate images during synchronized animation
       if (Math.floor(elapsed / 500) % 2 === 0) {
         validateAndRecoverImages()
       }

       // Draw wheel with current rotation
       const canvas = canvasRef.current
       if (canvas) {
         const ctx = canvas.getContext("2d")
         if (ctx) {
           try {
             drawWheelAtAngleWithImages(ctx, canvas, currentRotation, memoizedSlices)
           } catch (error) {
             console.error("Error during synchronized wheel animation:", error)
           }
         }
       }

       setCurrentAngle(currentRotation)

       if (progress < 1) {
         animationId = requestAnimationFrame(animate)
       } else {
         // Animation complete
         setIsSpinning(false)
         setRemoteSpinning(false)
         setCurrentAngle(totalRotation)
         setWinners([winner])
         setShowResults(true)
         setShowWinnerPopup(true)

         // Final image validation
         validateAndRecoverImages()

         // Redraw final state
         const canvas = canvasRef.current
         if (canvas) {
           const ctx = canvas.getContext("2d")
           if (ctx) {
             try {
               drawWheelAtAngleWithImages(ctx, canvas, totalRotation, memoizedSlices)
             } catch (error) {
               console.error("Error drawing final synchronized state:", error)
             }
           }
         }

         // Trigger confetti
         triggerConfetti()

         // Callback
         if (onSpinComplete) {
           onSpinComplete({
             id: Date.now().toString(),
             winners: [winner],
             timestamp: new Date(),
             spinDuration: spinDuration,
             totalParticipants: slices.length,
             source: 'synchronized'
           })
         }
       }
     }

     animationId = requestAnimationFrame(animate)
   }, [isSpinning, memoizedSlices, drawWheelAtAngleWithImages, onSpinComplete, validateAndRecoverImages])

   // Enhanced spinning function that maintains image quality and respects user roles
   const spinWheel = useCallback(() => {
     if (isSpinning || slices.length === 0) return

     // Check permissions based on mode
     if (isLiveMode && !canSpinWheel) {
       toast({
         title: "Permission Denied",
         description: "Only organizers and collaborators can spin the wheel in live mode",
         variant: "destructive"
       })
       return
     }

     // Track spin count for debugging
     setSpinCount(prev => prev + 1)

     // CRITICAL FIX: Validate and recover images BEFORE starting spin
     validateAndRecoverImages()

     // Allow unlimited spinning - reset any previous state
     setIsSpinning(true)
     setShowResults(false)

     // Calculate spin parameters
     const spinDuration = 3000
     const spins = 5 + Math.random() * 3
     const finalAngle = Math.random() * 2 * Math.PI
     const totalRotation = spins * 2 * Math.PI + finalAngle

     // Calculate winner
     const segmentAngle = (2 * Math.PI) / slices.length
     const normalizedRotation = totalRotation % (2 * Math.PI)
     const adjustedAngle = -normalizedRotation
     const winningIndex = Math.floor(adjustedAngle / segmentAngle) % slices.length
     const finalWinningIndex = winningIndex < 0 ? slices.length + winningIndex : winningIndex
     const winner = slices[finalWinningIndex]

     // 🔥 CRITICAL: Broadcast spin to live session for BOTH organizers AND collaborators
     // Only broadcast if NOT already spinning to prevent duplicate broadcasts
     if (isLiveMode && enableRealTimeSync && sessionId && !session?.isSpinning) {
       const broadcastSource = organizerMode ? 'organizer' : (isCollaboratorMode ? 'collaborator' : 'unknown')
       console.log("📡 Broadcasting spin to live session", { 
         broadcastSource, 
         organizerMode, 
         isCollaboratorMode,
         sessionId 
       })

       // Sanitize data to remove undefined values before sending to Firebase
       const sanitizeForFirestore = (data: any): any => {
         if (data === null || data === undefined) return null
         if (typeof data === 'object' && !Array.isArray(data)) {
           const cleaned: any = {}
           for (const [key, value] of Object.entries(data)) {
             const cleanedValue = sanitizeForFirestore(value)
             if (cleanedValue !== null && cleanedValue !== undefined) {
               cleaned[key] = cleanedValue
             }
           }
           return Object.keys(cleaned).length > 0 ? cleaned : null
         }
         if (Array.isArray(data)) {
           const cleanedArray = data.map(sanitizeForFirestore).filter(item => item !== null && item !== undefined)
           return cleanedArray.length > 0 ? cleanedArray : null
         }
         return data
       }

       const wheelStateData = {
         isSpinning: true,
         spinDuration: spinDuration || 3000,
         totalRotation: totalRotation || (5 + Math.random() * 3) * 2 * Math.PI,
         finalAngle: finalAngle || Math.random() * 2 * Math.PI,
         spins: spins || 5 + Math.random() * 3,
         winningIndex: finalWinningIndex || 0,
         wheelItemsUsed: slices.map(s => s.text || 'Unknown'),
         startedAt: new Date(),
         broadcastSource: 'organizer',
         wheelType: 'image-picker',
         sessionId: sessionId
       }

       const sanitizedData = {
         isSpinning: true,
         wheelState: sanitizeForFirestore(wheelStateData),
         updatedAt: serverTimestamp()
       }

       console.log("📡 Broadcasting sanitized data:", sanitizedData)

       // Update Firebase with spinning state and parameters (non-blocking)
       updateDoc(doc(db, "liveDrawSessions", sessionId), sanitizedData).then(() => {
         console.log("✅ Spin broadcasted to all participants")
       }).catch((error) => {
         console.error("❌ Failed to broadcast spin:", error)
       })
     }

    // Animation
    const startTime = performance.now()
    let animationId: number

    const animate = () => {
      const currentTime = performance.now()
      const elapsed = currentTime - startTime
      const progress = Math.min(elapsed / spinDuration, 1)

      // Smooth easing
      const easeProgress = 1 - Math.pow(1 - progress, 3)
      const currentRotation = totalRotation * easeProgress

      // CRITICAL FIX: Validate images during animation to prevent vanishing
      if (Math.floor(elapsed / 500) % 2 === 0) { // Check every 500ms during spin
        validateAndRecoverImages()
      }

      // Draw wheel with current rotation - ensures images remain visible during spinning
      const canvas = canvasRef.current
      if (canvas) {
        const ctx = canvas.getContext("2d")
        if (ctx) {
          try {
            drawWheelAtAngleWithImages(ctx, canvas, currentRotation, memoizedSlices)
          } catch (error) {
            console.error("Error during wheel animation:", error)
            // Continue animation even if there's a drawing error
          }
        }
      }

      setCurrentAngle(currentRotation)

      if (progress < 1) {
        animationId = requestAnimationFrame(animate)
      } else {
        // Animation complete - ensure final state is properly drawn and allow for unlimited spins
        setIsSpinning(false)
        setCurrentAngle(totalRotation)
        setWinners([winner])
        setShowResults(true)
        setShowWinnerPopup(true)

        // CRITICAL FIX: Final image validation and recovery after spin
        validateAndRecoverImages()

        // Redraw wheel with final position to ensure images are visible and persist
        const canvas = canvasRef.current
        if (canvas) {
          const ctx = canvas.getContext("2d")
          if (ctx) {
            try {
              drawWheelAtAngleWithImages(ctx, canvas, totalRotation, memoizedSlices)
            } catch (error) {
              console.error("Error drawing final wheel state:", error)
            }
          }
        }

        // 🔥 CRITICAL: Broadcast completion and winners to live session for BOTH organizers AND collaborators
        // Only broadcast if this spin was initiated by this user (prevent duplicate broadcasts)
        if (isLiveMode && enableRealTimeSync && sessionId && (organizerMode || isCollaboratorMode)) {
          const broadcastSource = organizerMode ? 'organizer' : (isCollaboratorMode ? 'collaborator' : 'unknown')
          console.log("📡 Broadcasting spin completion and winners to all participants", { 
            broadcastSource, 
            organizerMode, 
            isCollaboratorMode 
          })

          // Sanitize winner data for Firebase
          const sanitizeForFirestore = (data: any): any => {
            if (data === null || data === undefined) return null
            if (typeof data === 'object' && !Array.isArray(data)) {
              const cleaned: any = {}
              for (const [key, value] of Object.entries(data)) {
                const cleanedValue = sanitizeForFirestore(value)
                if (cleanedValue !== null && cleanedValue !== undefined) {
                  cleaned[key] = cleanedValue
                }
              }
              return Object.keys(cleaned).length > 0 ? cleaned : null
            }
            if (Array.isArray(data)) {
              const cleanedArray = data.map(sanitizeForFirestore).filter(item => item !== null && item !== undefined)
              return cleanedArray.length > 0 ? cleanedArray : null
            }
            return data
          }

          const winnerData = {
            isSpinning: false,
            completedAt: new Date(),
            winners: [{
              id: winner.id || `winner-${Date.now()}`,
              name: winner.text || 'Winner',
              color: winner.color || '#8e0b16',
              image: winner.image ? {
                url: winner.image.url || ''
              } : null
            }],
            winningIndex: finalWinningIndex || 0,
            wheelItemsUsed: slices.map(s => s.text || 'Unknown'),
            spinDuration: spinDuration || 3000,
            totalRotation: totalRotation || (5 + Math.random() * 3) * 2 * Math.PI,
            finalAngle: finalAngle || Math.random() * 2 * Math.PI,
            spins: spins || 5 + Math.random() * 3,
            broadcastSource: 'organizer',
            completed: true
          }

          const sanitizedData = {
            isSpinning: false,
            wheelState: sanitizeForFirestore(winnerData),
            updatedAt: serverTimestamp()
          }

          console.log("📡 Broadcasting sanitized winner data:", sanitizedData)

          // Update Firebase with completion and winners (non-blocking)
          updateDoc(doc(db, "liveDrawSessions", sessionId), sanitizedData).then(() => {
            console.log("✅ Spin completion broadcasted to all participants")
          }).catch((error) => {
            console.error("❌ Failed to broadcast spin completion:", error)
          })
        }

        // Trigger confetti
        triggerConfetti()

        // Callback
        if (onSpinComplete) {
          onSpinComplete({
            id: Date.now().toString(),
            winners: [winner],
            timestamp: new Date(),
            spinDuration: spinDuration,
            totalParticipants: slices.length,
            source: 'organizer'
          })
        }
      }
    }

    animationId = requestAnimationFrame(animate)
  }, [isSpinning, memoizedSlices, drawWheelAtAngleWithImages, onSpinComplete, validateAndRecoverImages])

  // Add image URL to slice with enhanced validation and real-time sync
  const addImageToSlice = async (sliceId: string, imageUrl: string) => {
    if (!imageUrl.trim()) return

    let trimmedUrl = imageUrl.trim()

    // Enhanced URL validation and normalization
    try {
      // Handle URLs without protocol by adding https://
      if (!trimmedUrl.startsWith('http://') && !trimmedUrl.startsWith('https://')) {
        // Check if it looks like a domain/path (contains dots or slashes)
        if (trimmedUrl.includes('.') || trimmedUrl.includes('/')) {
          trimmedUrl = 'https://' + trimmedUrl
          console.log(`🔗 Added https:// protocol to URL: ${trimmedUrl}`)
        } else {
          toast({
            title: "Invalid URL Format",
            description: "Please enter a complete image URL (e.g., https://example.com/image.jpg)",
            variant: "destructive"
          })
          return
        }
      }

      // Basic URL validation - less strict than new URL()
      const urlPattern = /^https?:\/\/.+/i
      if (!urlPattern.test(trimmedUrl)) {
        toast({
          title: "Invalid URL",
          description: "Please enter a valid image URL starting with http:// or https://",
          variant: "destructive"
        })
        return
      }

      // Additional validation for image-like URLs
      if (trimmedUrl.includes(' ')) {
        toast({
          title: "Invalid URL",
          description: "URL cannot contain spaces. Please check the URL and try again.",
          variant: "destructive"
        })
        return
      }

      console.log(`✅ URL validation passed for: ${trimmedUrl}`)
    } catch (error) {
      console.error(`❌ URL validation error:`, error)
      toast({
        title: "URL Processing Error",
        description: "There was an error processing the URL. Please check the format and try again.",
        variant: "destructive"
      })
      return
    }

    setImageSyncInProgress(true)

    // Update local state immediately for instant feedback - more defensive approach
    setSlices(prev => {
      const existingSlice = prev.find(s => s.id === sliceId)
      if (!existingSlice) return prev

      // Preserve existing image data from other slices
      return prev.map(slice => {
        if (slice.id === sliceId) {
          return {
            ...slice,
            image: {
              url: trimmedUrl,
              uploadTimestamp: new Date(),
              isUploaded: false,
              loadError: false,
              retryCount: 0,
              lastError: undefined,
              errorReason: undefined,
              fallbackMode: false
            }
          }
        }
        return slice // Keep other slices unchanged
      })
    })

    // Clear input after a short delay to allow for multiple pastes
    setTimeout(() => {
      setImageUrlInputs(prev => ({ ...prev, [sliceId]: '' }))
    }, 500)

    // Preload image for validation
    const img = new Image()
    img.crossOrigin = "anonymous"

    img.onload = () => {
      console.log(`✅ Image loaded successfully for slice ${sliceId}:`, trimmedUrl)

      // Use original URL for direct mobile access
      const imageUrl = trimmedUrl;

      setPreloadedImages(prev => ({ ...prev, [sliceId]: img }))
      setImageLoadStates(prev => ({ ...prev, [sliceId]: 'loaded' }))
      setImageSyncInProgress(false)

      // Update slice with original URL
      setSlices(prev => prev.map(slice => {
        if (slice.id === sliceId && slice.image) {
          return {
            ...slice,
            image: {
              ...slice.image,
              url: imageUrl,
              loadError: false,
              lastError: undefined,
              errorReason: undefined,
              retryCount: 0,
              fallbackMode: false
            }
          }
        }
        return slice
      }))

      // Broadcast image update to live session
      if (enableRealTimeSync && sessionId && organizerMode) {
        broadcastImageUpdate(sliceId, imageUrl)
      }

      toast({
        title: "✅ Image Added Successfully",
        description: "Image has been loaded and applied to the slice",
      })
    }

    img.onerror = (error: Event | string) => {
      console.error(`❌ Failed to load image for slice ${sliceId}:`, {
        url: trimmedUrl,
        error: error,
        errorType: typeof error === 'object' ? (error as any)?.type : 'unknown',
        errorCode: typeof error === 'object' ? (error as any)?.code : 'unknown'
      })

      setImageLoadStates(prev => ({ ...prev, [sliceId]: 'error' }))
      setImageSyncInProgress(false)

      // Update slice with detailed error state - isolated update
      setSlices(prev => {
        return prev.map(slice => {
          if (slice.id === sliceId && slice.image) {
            const currentRetryCount = slice.image.retryCount || 0
            return {
              ...slice,
              image: {
                ...slice.image,
                loadError: true,
                lastError: String(error),
                errorReason: 'NETWORK_ERROR',
                retryCount: currentRetryCount + 1,
                fallbackMode: currentRetryCount >= 2 // Enable fallback after 2 retries
              }
            }
          }
          return slice // Keep other slices unchanged
        })
      })

      // Provide more specific error messages based on error type
      let errorMessage = "Please check the URL and try again"

      // Check if it's an Event object (HTMLImageElement error event)
      if (typeof error === 'object' && error.target) {
        const target = error.target as HTMLImageElement
        const errorUrl = target.src || trimmedUrl

        if (errorUrl.includes('example.com')) {
          errorMessage = "Example URL detected. Please use a real image URL."
        } else {
          // Try to determine error type based on image properties
          if (target.naturalWidth === 0 && target.naturalHeight === 0) {
            errorMessage = "Image could not be loaded. Please check if the URL is correct and accessible."
          } else {
            errorMessage = "Network error. Please check your internet connection and the URL."
          }
        }
      }

      toast({
        title: "❌ Failed to Load Image",
        description: errorMessage,
        variant: "destructive"
      })
    }

    setImageLoadStates(prev => ({ ...prev, [sliceId]: 'loading' }))
    img.src = trimmedUrl
  }

  // Broadcast image updates to live session - for both organizers AND collaborators
  const broadcastImageUpdate = async (sliceId: string, imageUrl: string) => {
    if (!enableRealTimeSync || !sessionId || (!organizerMode && !isCollaboratorMode)) return

    try {
      const source = organizerMode ? 'organizer' : 'collaborator'
      console.log("📡 Broadcasting image update to live session:", {
        source,
        sliceId,
        imageUrl,
        sessionId,
        timestamp: new Date().toISOString()
      })

      // Find the slice to get its text
      const slice = slices.find(s => s.id === sliceId)
      if (!slice) return

      // Create updated slice data
      const updatedSlice = {
        id: sliceId,
        text: slice.text || `Slice ${sliceId}`,
        color: slice.color || "#8e0b16",
        image: {
          url: imageUrl,
          uploadTimestamp: new Date(),
          isUploaded: false,
          loadError: false,
          retryCount: 0,
          uploadedBy: source
        }
      }

      // Sanitize slices data to remove undefined values
      const sanitizedSlices = slices.map(slice => {
        const sanitizedSlice: any = {
          id: slice.id,
          text: slice.text || `Slice ${slice.id}`,
          color: slice.color || '#8e0b16'
        }
        if (slice.image && slice.image.url) {
          sanitizedSlice.image = {
            url: slice.image.url,
            uploadTimestamp: slice.image.uploadTimestamp,
            isUploaded: slice.image.isUploaded,
            loadError: slice.image.loadError,
            uploadedBy: source
          }
        }
        return sanitizedSlice
      })

      await updateDoc(doc(db, "liveDrawSessions", sessionId), {
        imageWheelSlices: sanitizedSlices,
        wheelImages: sanitizedSlices.filter(s => s.image?.url).map(s => ({
          id: s.id,
          sliceId: s.id,
          url: s.image.url,
          alt: s.text,
          isLoaded: true,
          error: false,
          uploadedBy: source
        })),
        lastImageUpdate: serverTimestamp(),
        wheelState: {
          hasImages: true,
          imageCount: slices.filter(s => s.image?.url).length,
          imagesApplied: true,
          lastImageUpdate: new Date(),
          imageSource: source
        },
        updatedAt: serverTimestamp()
      })

      console.log("✅ Image update broadcasted to participants:", {
        sliceId,
        imageUrl,
        sessionId
      })

      // Update last image update timestamp
      setLastImageUpdate(Date.now())

    } catch (error) {
      console.error("❌ Failed to broadcast image update:", error)
    }
  }

  // Remove image from slice
  const removeImageFromSlice = (sliceId: string) => {
    setSlices(prev => prev.map(slice => {
      if (slice.id === sliceId) {
        return {
          ...slice,
          image: undefined
        }
      }
      return slice
    }))

    // Remove from preloaded images and reset load state
    setPreloadedImages(prev => {
      const newPreloaded = { ...prev }
      delete newPreloaded[sliceId]
      return newPreloaded
    })
    setImageLoadStates(prev => {
      const newStates = { ...prev }
      delete newStates[sliceId]
      return newStates
    })
    setLastKnownGoodImages(prev => {
      const newLastKnown = { ...prev }
      delete newLastKnown[sliceId]
      return newLastKnown
    })

    toast({
      title: "Image Removed",
      description: "Image has been removed from the slice",
    })
  }

  // Retry loading a failed image
  const retryImageLoad = (sliceId: string) => {
    const slice = slices.find(s => s.id === sliceId)
    if (!slice?.image?.url) return

    // Reset load state
    setImageLoadStates(prev => ({ ...prev, [sliceId]: 'loading' }))

    // Remove from preloaded images to force reload
    setPreloadedImages(prev => {
      const newPreloaded = { ...prev }
      delete newPreloaded[sliceId]
      return newPreloaded
    })

    // Reload the image
    const img = new Image()
    img.crossOrigin = "anonymous"

    img.onload = () => {
      setPreloadedImages(prev => ({ ...prev, [sliceId]: img }))
      setImageLoadStates(prev => ({ ...prev, [sliceId]: 'loaded' }))

      // Update preloaded images (no slice update to prevent loops)

      toast({
        title: "Image Reloaded",
        description: "Image has been successfully loaded",
      })
    }

    img.onerror = (error) => {
      console.error(`Failed to reload image for slice ${sliceId}:`, error)
      setImageLoadStates(prev => ({ ...prev, [sliceId]: 'error' }))
      toast({
        title: "Failed to Reload Image",
        description: "Please check the URL and try again",
        variant: "destructive"
      })
    }

    img.src = slice.image.url
  }

  // Demo image generation with random images from Picsum
  const generateDemoImages = useCallback(() => {
    if (!canEditImages) {
      toast({
        title: "Permission Denied",
        description: "You don't have permission to add demo images in this mode",
        variant: "destructive"
      })
      return
    }

    console.log("🎲 Generating demo images for all slices...")

    // Array of demo image IDs from Picsum for variety
    const demoImageIds = [
      100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110,
      111, 112, 113, 114, 115, 116, 117, 118, 119, 120,
      200, 201, 202, 203, 204, 205, 206, 207, 208, 209, 210,
      300, 301, 302, 303, 304, 305, 306, 307, 308, 309, 310,
      400, 401, 402, 403, 404, 405, 406, 407, 408, 409, 410,
      500, 501, 502, 503, 504, 505, 506, 507, 508, 509, 510,
      600, 601, 602, 603, 604, 605, 606, 607, 608, 609, 610,
      700, 701, 702, 703, 704, 705, 706, 707, 708, 709, 710,
      800, 801, 802, 803, 804, 805, 806, 807, 808, 809, 810,
      900, 901, 902, 903, 904, 905, 906, 907, 908, 909, 910
    ]

    // Shuffle the demo image IDs for randomness
    const shuffledIds = [...demoImageIds].sort(() => Math.random() - 0.5)

    // Assign random demo images to all slices
    const updatedSlices = slices.map((slice, index) => {
      // Get a random image ID from the shuffled array
      const randomImageId = shuffledIds[index % shuffledIds.length]
      const demoImageUrl = `https://picsum.photos/400/400?random=${randomImageId}`

      console.log(`🎲 Assigning demo image to slice ${slice.id}:`, demoImageUrl)

      return {
        ...slice,
        image: {
          url: demoImageUrl,
          uploadTimestamp: new Date(),
          isUploaded: false,
          loadError: false,
          retryCount: 0,
          lastError: undefined,
          errorReason: undefined,
          fallbackMode: false
        }
      }
    })

    // Update slices state with demo images
    setSlices(updatedSlices)

    // Set loading states for all slices
    const loadingStates: {[key: string]: 'loading' | 'loaded' | 'error'} = {}
    updatedSlices.forEach(slice => {
      if (slice.image?.url) {
        loadingStates[slice.id] = 'loading'
      }
    })
    setImageLoadStates(loadingStates)

    toast({
      title: "🎲 Demo Images Added!",
      description: `Added ${updatedSlices.length} random demo images to all wheel slices`,
    })

    // Broadcast demo image updates to live session if organizer or collaborator
    if (enableRealTimeSync && sessionId && (organizerMode || isCollaboratorMode)) {
      const source = organizerMode ? 'organizer' : 'collaborator'
      console.log("📡 Broadcasting demo images to live session participants", { source })

      // Sanitize slices data to remove undefined values
      const sanitizedSlices = updatedSlices.map(slice => {
        const sanitizedSlice: any = {
          id: slice.id,
          text: slice.text || `Slice ${slice.id}`,
          color: slice.color || '#8e0b16'
        }
        if (slice.image && slice.image.url) {
          sanitizedSlice.image = {
            url: slice.image.url,
            uploadTimestamp: slice.image.uploadTimestamp,
            isUploaded: slice.image.isUploaded,
            loadError: slice.image.loadError,
            uploadedBy: source
          }
        }
        return sanitizedSlice
      })

      // Broadcast the sanitized updated slices array
      updateDoc(doc(db, "liveDrawSessions", sessionId), {
        imageWheelSlices: sanitizedSlices,
        wheelImages: sanitizedSlices.filter(s => s.image?.url).map(s => ({
          id: s.id,
          sliceId: s.id,
          url: s.image.url,
          alt: s.text,
          isLoaded: true,
          error: false
        })),
        lastImageUpdate: serverTimestamp(),
        wheelState: {
          hasImages: true,
          imageCount: updatedSlices.filter(s => s.image?.url).length,
          imagesApplied: true,
          lastImageUpdate: new Date()
        },
        updatedAt: serverTimestamp()
      }).then(() => {
        console.log("✅ Demo images broadcasted to participants")
      }).catch((error) => {
        console.error("❌ Failed to broadcast demo images:", error)
      })
    }
  }, [canEditImages, slices, enableRealTimeSync, sessionId, organizerMode])

  // Apply all pending images at once
  const applyPendingImages = async () => {
    if (Object.keys(pendingImageUrls).length === 0) {
      toast({
        title: "No Images to Apply",
        description: "Please paste URLs in the input fields first",
      })
      return
    }

    console.log(`🚀 Applying ${Object.keys(pendingImageUrls).length} pending images`)

    // Update all slices with their pending URLs at once
    const updatedSlices = slices.map(slice => {
      const pendingUrl = pendingImageUrls[slice.id]
      if (pendingUrl && pendingUrl.trim()) {
        console.log(`✅ Applying image to slice ${slice.id}:`, pendingUrl)
        return {
          ...slice,
          image: {
            url: pendingUrl.trim(),
            uploadTimestamp: new Date(),
            isUploaded: false,
            loadError: false,
            retryCount: 0,
            lastError: undefined,
            errorReason: undefined,
            fallbackMode: false
          }
        }
      }
      return slice
    })

    setSlices(updatedSlices)

    // Clear pending URLs immediately after updating slices
    setPendingImageUrls({})
    setImageUrlInputs({})

    console.log(`✅ All pending images applied to slices`)

    // Broadcast the full updated slices array to live session if organizer or collaborator
    if (enableRealTimeSync && sessionId && (organizerMode || isCollaboratorMode)) {
      const source = organizerMode ? 'organizer' : 'collaborator'
      console.log("📡 Broadcasting applied images to live session participants", { source })

      // Sanitize slices data to remove undefined values
      const sanitizedSlices = updatedSlices.map(slice => {
        const sanitizedSlice: any = {
          id: slice.id,
          text: slice.text || `Slice ${slice.id}`,
          color: slice.color || '#8e0b16'
        }
        if (slice.image && slice.image.url) {
          sanitizedSlice.image = {
            url: slice.image.url,
            uploadTimestamp: slice.image.uploadTimestamp,
            isUploaded: slice.image.isUploaded,
            loadError: slice.image.loadError,
            uploadedBy: source
          }
        }
        return sanitizedSlice
      })

      updateDoc(doc(db, "liveDrawSessions", sessionId), {
        imageWheelSlices: sanitizedSlices,
        wheelImages: sanitizedSlices.filter(s => s.image?.url).map(s => ({
          id: s.id,
          sliceId: s.id,
          url: s.image.url,
          alt: s.text,
          isLoaded: true,
          error: false,
          uploadedBy: source
        })),
        lastImageUpdate: serverTimestamp(),
        wheelState: {
          hasImages: true,
          imageCount: updatedSlices.filter(s => s.image?.url).length,
          imagesApplied: true,
          lastImageUpdate: new Date()
        },
        updatedAt: serverTimestamp()
      }).then(() => {
        console.log("✅ Applied images broadcasted to participants")
      }).catch((error) => {
        console.error("❌ Failed to broadcast applied images:", error)
      })
    }

    toast({
      title: "✅ Images Applied Successfully",
      description: `Applied ${Object.keys(pendingImageUrls).length} images to wheel slices`,
    })
  }

  // Apply single image immediately when Enter is pressed
  const applySingleImage = (sliceId: string, url: string) => {
    if (!url.trim()) return

    console.log(`⚡ Applying single image to slice ${sliceId}:`, url)

    // Update slice state
    setSlices(prev => {
      const newSlices = prev.map(slice => {
        if (slice.id === sliceId) {
          return {
            ...slice,
            image: {
              url: url.trim(),
              uploadTimestamp: new Date(),
              isUploaded: false,
              loadError: false,
              retryCount: 0,
              lastError: undefined,
              errorReason: undefined,
              fallbackMode: false
            }
          }
        }
        return slice
      })

      return newSlices
    })

    // Cache the URL immediately
    setImageUrlCache(prev => ({ ...prev, [sliceId]: url.trim() }))

    // Clear this input
    setImageUrlInputs(prev => ({ ...prev, [sliceId]: '' }))

    // Set loading state immediately
    setImageLoadStates(prev => ({ ...prev, [sliceId]: 'loading' }))

    // Preload the image immediately
    const img = new Image()
    img.crossOrigin = "anonymous"

    img.onload = () => {
      console.log(`✅ Image preloaded for slice ${sliceId}`)

      // Convert image to base64 for stable mobile display
      let dataUrl = url.trim(); // Fallback to original URL
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (ctx) {
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        ctx.drawImage(img, 0, 0);

        // Convert to base64 with compression
        const base64 = canvas.toDataURL('image/jpeg', 0.8);
        dataUrl = `data:image/jpeg;base64,${base64.split(',')[1]}`;
      }

      setPreloadedImages(prev => ({ ...prev, [sliceId]: img }))
      setImageLoadStates(prev => ({ ...prev, [sliceId]: 'loaded' }))
      setImageValidationCache(prev => ({ ...prev, [sliceId]: true }))
      setLastKnownGoodImages(prev => ({ ...prev, [sliceId]: img }))

      // Update slice with the loaded image element and stable data URL
      setSlices(prev => prev.map(slice => {
        if (slice.id === sliceId && slice.image) {
          return {
            ...slice,
            image: {
              ...slice.image,
              url: dataUrl,
              originalUrl: url.trim(),
              imgElement: img
            }
          }
        }
        return slice
      }))

      // Cache the data URL
      setImageUrlCache(prev => ({ ...prev, [sliceId]: dataUrl }))

      // Success feedback
      toast({
        title: "✅ Image Added Successfully",
        description: "Image has been loaded and applied to the slice",
      })
    }

    img.onerror = (error) => {
      console.error(`❌ Failed to preload image for slice ${sliceId}:`, error)
      setImageLoadStates(prev => ({ ...prev, [sliceId]: 'error' }))
      setImageValidationCache(prev => ({ ...prev, [sliceId]: false }))
    }

    img.src = url.trim()
  }

  // Trigger confetti effect
  const triggerConfetti = () => {
    const duration = 3000
    const animationEnd = Date.now() + duration

    const interval = setInterval(() => {
      const timeLeft = animationEnd - Date.now()

      if (timeLeft <= 0) {
        clearInterval(interval)
        return
      }

      const particleCount = 50 * (timeLeft / duration)

      confetti({
        particleCount,
        startVelocity: 30,
        spread: 360,
        origin: { x: 0.5, y: 0.5 },
        colors: ['#8e0b16', '#66181E', '#ffffff', '#FFD700', '#FF6B6B']
      })
    }, 250)
  }

  // Reset wheel for unlimited spinning
  const resetWheel = () => {
    setCurrentAngle(0)
    setWinners([])
    setShowResults(false)
    setShowWinnerPopup(false)
    setIsSpinning(false)

    // CRITICAL FIX: Ensure all images are validated and recovered before reset
    validateAndRecoverImages()

    // Redraw wheel at starting position to ensure images are visible and ready for next spin
    const canvas = canvasRef.current
    if (canvas) {
      const ctx = canvas.getContext("2d")
      if (ctx) {
        try {
          drawWheelAtAngleWithImages(ctx, canvas, 0, memoizedSlices)
        } catch (error) {
          console.error("Error resetting wheel:", error)
        }
      }
    }

    toast({
      title: "Wheel Reset",
      description: "Ready for next spin!",
    })
  }

  // Initial draw and redraw when dependencies change - optimized for stability
  useEffect(() => {
    const canvas = canvasRef.current
    if (canvas && memoizedSlices.length > 0) {
      const ctx = canvas.getContext("2d")
      if (ctx) {
        try {
          drawWheelAtAngleWithImages(ctx, canvas, currentAngle, memoizedSlices)
          console.log(`🎨 Canvas redrawn for ${memoizedSlices.length} slices`)
        } catch (error) {
          console.error("Error drawing wheel:", error)
          // Fallback: draw without images if there's an error
          drawWheelAtAngleWithImages(ctx, canvas, currentAngle, memoizedSlices)
        }
      }
    }
  }, [memoizedSlices, currentAngle, drawWheelAtAngleWithImages, canvasSize])



  // Convert image slices to participant format for EnhancedWheel
  const participantsForEnhancedWheel = useMemo(() => {
    return memoizedSlices.map(slice => ({
      id: slice.id,
      name: slice.text,
      isSelected: false
    }))
  }, [memoizedSlices])

  // Handle spin completion from EnhancedWheel
  const handleEnhancedSpinComplete = (result: any) => {
    console.log("🎯 Enhanced wheel spin completed:", result)

    // Find the winning slice based on the winner name
    const winningSlice = slices.find(slice => slice.text === result.winners[0]?.name)

    if (winningSlice) {
      setWinners([winningSlice])
      setShowResults(true)
      triggerConfetti()

      if (onSpinComplete) {
        onSpinComplete({
          ...result,
          slice: winningSlice
        })
      }
    }
  }


  return (
    <div className="space-y-6">

      {useEnhancedSpinning ? (
        /* Enhanced Wheel Version with Image Support */
        <div className="space-y-4">
          {/* Custom Image Wheel Canvas (for image display) */}
          <Card className="border-2" style={{ borderColor: themeColors.primary }}>
            <CardContent className="p-4">
              <div className="flex flex-col items-center space-y-4">
                <canvas
                  ref={canvasRef}
                  width={canvasSize}
                  height={canvasSize}
                  className="rounded-full shadow-2xl transition-all duration-300 hover:shadow-3xl max-w-full"
                  style={{
                    maxWidth: '100%',
                    height: 'auto',
                    touchAction: 'none',
                    userSelect: 'none',
                    WebkitUserSelect: 'none',
                    WebkitTouchCallout: 'none'
                  }}
                />

                {/* Enhanced Wheel Integration Info */}
                <div className="text-center text-sm text-gray-600">
                  <p>🎯 Powered by Enhanced Wheel Spinning Engine</p>
                  <p>✨ Images with Cover Mode • Real-time Sync • Advanced Animation</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Enhanced Wheel Component for Spinning */}
          <EnhancedWheel
            participants={participantsForEnhancedWheel}
            onSpinComplete={handleEnhancedSpinComplete}
            isLiveMode={isLiveMode}
            sessionId={sessionId}
            disabled={disabled || (isLiveMode && !canSpinWheel)}
            wheelTitle={`${wheelTitle} (Image Version)`}
            enableRealTimeSync={enableRealTimeSync}
            organizerMode={organizerMode}
            userPermissions={userPermissions}
            {...enhancedWheelProps}
          />
        </div>
      ) : (
        /* Standalone Version */
        <Card className="border-2" style={{ borderColor: themeColors.primary }}>
          <CardContent className="p-4">
            <div className="flex flex-col items-center space-y-4">
              <canvas
                ref={canvasRef}
                width={canvasSize}
                height={canvasSize}
                className="rounded-full shadow-2xl transition-all duration-300 hover:shadow-3xl max-w-full"
                style={{
                  maxWidth: '100%',
                  height: 'auto',
                  touchAction: 'none',
                  userSelect: 'none',
                  WebkitUserSelect: 'none',
                  WebkitTouchCallout: 'none'
                }}
              />

              {/* Control Buttons - Only show for organizers/collaborators, hide for participants */}
              {((organizerMode || isCollaboratorMode || isSoloMode) && !isParticipantMode) && (
                <div className="flex flex-wrap gap-3 justify-center">
                  <Button
                    onClick={spinWheel}
                    disabled={isSpinning || disabled || slices.length === 0}
                    size="lg"
                    style={{
                      backgroundColor: themeColors.primary,
                      color: themeColors.accent
                    }}
                    className="hover:opacity-90"
                  >
                    {isSpinning ? (
                      <>
                        <Pause className="h-5 w-5 mr-2" />
                        Spinning...
                      </>
                    ) : (
                      <>
                        <Play className="h-5 w-5 mr-2" />
                        Spin Wheel
                      </>
                    )}
                  </Button>

                  <Button
                    onClick={resetWheel}
                    variant="outline"
                    disabled={isSpinning || disabled}
                    style={{ borderColor: themeColors.primary, color: themeColors.primary }}
                  >
                    <RotateCcw className="h-5 w-5 mr-2" />
                    Reset
                  </Button>

                  <Button
                    onClick={() => setIsEditingImages(true)}
                    variant="outline"
                    disabled={isSpinning || disabled || !canEditImages}
                    style={{ borderColor: themeColors.primary, color: themeColors.primary }}
                    title={!canEditImages ? "No edit permissions in current mode" : "Add and manage slice images"}
                    className="font-semibold"
                  >
                    <Upload className="h-5 w-5 mr-2" />
                    {isParticipantMode ? "View Images" : "Add Images"}
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Winner Popup - Stable for both organizer and participant */}
      {showWinnerPopup && (() => {
        // Determine which winners to display based on mode - more robust logic
        let displayWinners: ImageWheelSlice[] = []

        if (isLiveMode && !organizerMode) {
          // Participant mode: use remote winners from organizer
          displayWinners = remoteWinners.length > 0 ? remoteWinners : winners
        } else {
          // Organizer/Solo mode: use local winners
          displayWinners = winners.length > 0 ? winners : remoteWinners
        }

        if (displayWinners.length === 0) {
          console.log("No winners available for popup")
          return null
        }

        const winner = displayWinners[0]
        if (!winner) {
          console.log("Winner object is empty")
          return null
        }

        console.log("🏆 Showing winner popup:", {
          winner: winner.text,
          hasImage: !!winner.image?.url,
          mode: isLiveMode && !organizerMode ? 'participant' : 'organizer',
          source: displayWinners === remoteWinners ? 'remote' : 'local'
        })

        // Convert winner to the format expected by EnhancedWinnerPopup
         const popupWinners = [{
           id: winner.id || `winner-${Date.now()}`,
           name: winner.text || 'Winner',
           image: winner.image?.url ? {
             url: winner.image.url,
             alt: winner.text || 'Winner'
           } : undefined,
           color: winner.color || "#8e0b16" // Use consistent maroon theme
         }]

        return (
          <EnhancedWinnerPopup
            isOpen={showWinnerPopup}
            onClose={() => {
              console.log("Closing winner popup")
              setShowWinnerPopup(false)
            }}
            winners={popupWinners}
            wheelType="image-picker"
            showConfetti={true}
            autoClose={0} // Disable auto-close for stability
            theme={{
              primary: "#8e0b16", // Consistent maroon primary
              secondary: "#66181E", // Consistent maroon secondary
              accent: "#ffffff"
            }}
            imageSize="xl"
            customTitle=""
            customWinnerMessage=""
            customWinnerWord="WINNER"
            congratsMessage="🎉 Selected! 🎉"
          />
        )
      })()}

      {/* Enhanced Image Editing Dialog */}
      <Dialog open={isEditingImages} onOpenChange={(open) => {
        setIsEditingImages(open)
        if (!open) {
          // Clear pending URLs when dialog is closed
          setPendingImageUrls({})
          setImageUrlInputs({})
        }
      }}>
        <DialogContent className="max-w-6xl max-h-[95vh] overflow-hidden flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Upload className="h-6 w-6" />
              Add Images to Wheel Slices
              {!canEditImages && (
                <Badge variant="destructive" className="ml-2">View Only</Badge>
              )}
            </DialogTitle>
            <DialogDescription className="text-base">
              <strong>Add images to each wheel slice</strong> - paste image URLs in the input fields below, then click "Apply Images" to load them all at once
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-6 min-h-0">



            {/* Slice Image Management */}
            <div className="grid gap-4 md:grid-cols-2">
              {slices.map((slice, index) => (
                <Card key={slice.id} className="p-4">
                  <div className="space-y-4">
                    {/* Slice Header */}
                    <div className="flex items-center gap-3">
                      {/* Enhanced Slice Preview */}
                      <div className="w-20 h-20 rounded-xl border-3 flex-shrink-0 flex items-center justify-center relative overflow-hidden"
                           style={{ borderColor: slice.color, backgroundColor: `${slice.color}15` }}>
                        {slice.image?.url && preloadedImages[slice.id] ? (
                          <>
                            <img
                              src={slice.image.url}
                              alt={slice.text}
                              className="w-full h-full object-cover"
                            />
                            {imageLoadStates[slice.id] === 'loading' && (
                              <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                                <RefreshCw className="h-6 w-6 text-white animate-spin" />
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="flex flex-col items-center gap-1">
                            <div className="text-3xl" style={{ color: slice.color }}>
                              📷
                            </div>
                            <span className="text-xs text-gray-500">No Image</span>
                          </div>
                        )}
                      </div>

                      {/* Slice Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-lg truncate">{slice.text}</h3>
                          {canEditImages && slices.length > 2 && (
                            <Button
                              onClick={() => removeSlice(slice.id)}
                              variant="ghost"
                              size="sm"
                              className="text-red-500 hover:text-red-700 hover:bg-red-50 h-6 w-6 p-0"
                              title="Remove this slice"
                            >
                              ×
                            </Button>
                          )}
                        </div>
                        <p className="text-sm text-gray-600">Slice {index + 1} of {slices.length}</p>
                        {slice.description && (
                          <p className="text-xs text-gray-500 truncate">{slice.description}</p>
                        )}
                      </div>
                    </div>

                    {/* Image URL Input */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Image URL</Label>
                      <div className="flex gap-2">
                        <Input
                          placeholder="https://example.com/image.jpg"
                          value={imageUrlInputs[slice.id] || ''}
                          onChange={(e) => {
                            const value = e.target.value
                            console.log(`🔗 URL input changed for slice ${slice.id}:`, value)
                            setImageUrlInputs(prev => ({ ...prev, [slice.id]: value }))
                          }}
                          onBlur={(e) => {
                            // Store URL in pending state when user finishes editing
                            const value = e.target.value.trim()
                            if (value) {
                              console.log(`📝 Storing pending URL for slice ${slice.id}:`, value)
                              setPendingImageUrls(prev => ({ ...prev, [slice.id]: value }))
                            }
                          }}
                          onPaste={(e) => {
                            // Handle paste events to clean up URLs
                            const pastedText = e.clipboardData?.getData('text') || ''
                            console.log(`📋 URL pasted for slice ${slice.id}:`, pastedText)

                            // Clean up common paste artifacts
                            let cleanedUrl = pastedText.trim()

                            // Remove any surrounding quotes
                            cleanedUrl = cleanedUrl.replace(/^["']|["']$/g, '')

                            // If it doesn't have a protocol but looks like a URL, add https
                            if (!cleanedUrl.startsWith('http://') && !cleanedUrl.startsWith('https://')) {
                              if (cleanedUrl.includes('.') || cleanedUrl.includes('/')) {
                                cleanedUrl = 'https://' + cleanedUrl
                                console.log(`🔗 Auto-corrected pasted URL: ${cleanedUrl}`)
                              }
                            }

                            // Apply immediately when pasting
                            if (cleanedUrl) {
                              console.log(`⚡ Immediately applying pasted URL to slice ${slice.id}:`, cleanedUrl)
                              applySingleImage(slice.id, cleanedUrl)
                            } else {
                              toast({
                                title: "Invalid URL",
                                description: "Please paste a valid image URL",
                                variant: "destructive"
                              })
                            }
                          }}
                          className="flex-1"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault() // Prevent form submission
                              const urlToAdd = imageUrlInputs[slice.id] || ''
                              if (urlToAdd.trim()) {
                                console.log(`⚡ Enter pressed for slice ${slice.id}, applying URL:`, urlToAdd)
                                applySingleImage(slice.id, urlToAdd)
                              }
                            }
                          }}
                        />
                        {Object.keys(pendingImageUrls).length === 0 ? (
                          <Button
                            onClick={() => addImageToSlice(slice.id, imageUrlInputs[slice.id] || '')}
                            disabled={!canEditImages || !imageUrlInputs[slice.id]?.trim() || imageSyncInProgress}
                            size="sm"
                            style={{ backgroundColor: slice.color, color: "#ffffff" }}
                            className="px-3"
                            title={!canEditImages ? "No edit permissions in current mode" : "Add image to slice"}
                          >
                            {imageSyncInProgress ? (
                              <RefreshCw className="h-4 w-4 animate-spin" />
                            ) : (
                              <Link className="h-4 w-4" />
                            )}
                          </Button>
                        ) : (
                          <div className="px-3 py-2 text-xs bg-gray-100 rounded text-gray-600">
                            Pending
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Current Image Info */}
                    {slice.image?.url && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">Current Image:</span>
                          <Button
                            onClick={() => removeImageFromSlice(slice.id)}
                            disabled={!canEditImages}
                            variant="outline"
                            size="sm"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
                            title={!canEditImages ? "No edit permissions in current mode" : "Remove image from slice"}
                          >
                            Remove
                          </Button>
                        </div>

                        <div className="p-2 bg-gray-50 rounded-lg">
                          <div className="flex items-center gap-2">
                            {imageLoadStates[slice.id] === 'loading' && (
                              <Badge variant="secondary" className="text-xs">
                                <RefreshCw className="h-3 w-3 animate-spin mr-1" />
                                Loading...
                              </Badge>
                            )}
                            {imageLoadStates[slice.id] === 'error' && (
                              <div className="flex items-center gap-1">
                                <Badge variant="destructive" className="text-xs">
                                  Load Error
                                </Badge>
                                <Button
                                  onClick={() => retryImageLoad(slice.id)}
                                  variant="outline"
                                  size="sm"
                                  className="text-xs h-6 px-2"
                                  title="Retry loading image"
                                >
                                  Retry
                                </Button>
                              </div>
                            )}
                            {imageLoadStates[slice.id] === 'loaded' && (
                              <Badge className="text-xs bg-green-100 text-green-800">
                                ✓ Loaded
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                  </div>
                </Card>
              ))}
            </div>

          </div>

          <DialogFooter className="flex-shrink-0 border-t pt-4">
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-4">
                {!canEditImages && (
                  <Badge variant="outline" className="text-orange-600 border-orange-300">
                    View Only Mode
                  </Badge>
                )}
                {canEditImages && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600">{slices.length}/20 slices</span>
                    <Button
                      onClick={addSlice}
                      disabled={slices.length >= 20}
                      style={{ backgroundColor: "#10b981", color: "#ffffff" }}
                      size="sm"
                      title="Add one slice to the wheel"
                    >
                      + Add Slice
                    </Button>
                    <Button
                      onClick={generateDemoImages}
                      style={{
                        background: "linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)",
                        color: "#ffffff",
                        border: "none"
                      }}
                      size="sm"
                      title="Add random demo images to all slices"
                    >
                      🎲 Demo Images
                    </Button>
                    {Object.keys(pendingImageUrls).length > 0 && (
                      <Button
                        onClick={applyPendingImages}
                        style={{ backgroundColor: "#3b82f6", color: "#ffffff" }}
                        size="sm"
                        title="Apply all pasted image URLs"
                      >
                        🚀 Apply Images ({Object.keys(pendingImageUrls).length})
                      </Button>
                    )}
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setIsEditingImages(false)}>
                  {canEditImages ? "Close Editor" : "Close"}
                </Button>
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
})
