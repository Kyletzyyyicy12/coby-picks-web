"use client"

import { useParams, useSearchParams } from "next/navigation"
import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { auth, db } from "@/lib/firebase"
import { onAuthStateChanged } from "firebase/auth"
import {
  doc,
  getDoc,
  onSnapshot,
  collection,
  addDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  query,
  where,
  getDocs
} from "firebase/firestore"
import LiveDrawManager from "@/components/live/live-draw-manager"
import { EnhancedWheel, } from "@/components/randomizer/enhanced-wheel"
import { EnhancedTeamPicker } from "@/components/team/enhanced-team-picker"
import { ImagePickerWheel } from "@/components/picker-wheels/image-picker-wheel"
// ImagePickerWheel functionality moved to enhanced-wheel.tsx but keeping direct import for fallback
import { uploadImageToFirebaseStorage } from "@/lib/firebase-storage"
import { ParticipantRequestSystem } from "@/components/live/participant-request-system"
import { TextWinnerPopup } from "@/components/shared/text-winner-popup"
import { CollaborativeFeedbackIndicators } from "@/components/live/collaborative-feedback-indicators"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { toast } from "@/hooks/use-toast"
import type { User as FirebaseUser } from "firebase/auth"
import type { PickerWheelType } from "@/lib/picker-wheel-types"
import { PICKER_WHEEL_TYPES } from "@/lib/picker-wheel-types"

// Simple participant view showing only wheel and comments with enhanced real-time synchronization
function ParticipantWheelView({
  sessionId,
  participantName,
  session: parentSession,
  user,
  isUserCollaborator: initialIsUserCollaborator
}: {
  sessionId: string,
  participantName?: string,
  session: any,
  user?: FirebaseUser,
  isUserCollaborator?: boolean
}) {
   const [session, setSession] = useState<any>(parentSession)
     const [loading, setLoading] = useState(true)
     const [reactions, setReactions] = useState<any[]>([])
     const [comments, setComments] = useState<any[]>([])
     const [newComment, setNewComment] = useState("")
     const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting')
     const [isUserCollaborator, setIsUserCollaborator] = useState<boolean>(initialIsUserCollaborator || false)
     // 🎯 INSTANT SPINNING STATE: Direct Firebase synchronization for ultra-responsive spinning
     const [isSpinning, setIsSpinning] = useState<boolean>(false)
     const [lastSpinData, setLastSpinData] = useState<any>(null)
     // 🎨 IMAGE PICKER STATE: Track image picker mode for participants
     const [imagePickerMode, setImagePickerMode] = useState<boolean>(false)
     const [lastImageUpdate, setLastImageUpdate] = useState<number>(0)
     const [instantImageUpdate, setInstantImageUpdate] = useState<number>(0)
     const [debouncedSliceImages, setDebouncedSliceImages] = useState<Map<string, any>>(new Map())
     const [participantSliceImages, setParticipantSliceImages] = useState<Map<string, any>>(new Map())
     const [participantLoadedImages, setParticipantLoadedImages] = useState<Map<string, HTMLImageElement>>(new Map())
     // Ensure participant winner popup shows only once per organizer spin
     const [showWinnerPopup, setShowWinnerPopup] = useState<boolean>(false)
     const [lastAnnouncedKey, setLastAnnouncedKey] = useState<string | null>(null)
     const [winners, setWinners] = useState<any[]>([])
     const [showResults, setShowResults] = useState<boolean>(false)
     const [hasAnnouncedWinners, setHasAnnouncedWinners] = useState<boolean>(false)
     const [currentSpinId, setCurrentSpinId] = useState<string>("")
     
     // 🎯 SHUFFLE SYNCHRONIZATION: Track shuffle updates to force wheel re-render
     const [shuffleUpdateKey, setShuffleUpdateKey] = useState<number>(0)
     const lastShuffleSeedRef = useRef<number | null>(null)
     const lastShuffledItemsRef = useRef<string[] | null>(null)
     
     // 🎯 WHEEL TYPE CHANGE TRACKING: Track wheel type changes with unique IDs
     const [currentWheelTypeId, setCurrentWheelTypeId] = useState<string>('')
     const lastWheelTypeChangeIdRef = useRef<string>('')

     // 🎯 STABILITY: Debounced state updates to prevent rapid re-renders
     const [stableSession, setStableSession] = useState<any>(parentSession)
     const sessionUpdateTimeout = useRef<NodeJS.Timeout | null>(null)
     const lastSessionUpdate = useRef<number>(0)

     // 🎯 STABILITY: Loading and connection states
     const [isUpdating, setIsUpdating] = useState(false)
     const [lastSyncTime, setLastSyncTime] = useState<number>(Date.now())

     // 🎯 REFS: Animation and reset tracking refs
     const animationRef = useRef<number | null>(null)
     const isAnimationRunningRef = useRef<boolean>(false)
     const stopAnimationRef = useRef<boolean>(false)
     const animationCompletedRef = useRef<boolean>(false)
     const lastResetTimestampRef = useRef<string>("")

     // 🎯 FIX: Determine correct imagePickerMode based on applied images
     const hasAppliedImages = session?.wheelState?.wheelImages && session.wheelState.wheelImages.length > 0
     const hasImageWheelSlices = session?.imageWheelSlices && session.imageWheelSlices.some((slice: any) => slice.image?.url)
     const hasWheelImages = session?.wheelImages && session.wheelImages.length > 0
     const hasWheelStateImages = session?.wheelState?.hasImages === true
     const shouldShowImages = hasAppliedImages || hasImageWheelSlices || hasWheelImages || hasWheelStateImages

     // 🎯 MEMOIZED WHEEL TEXT ITEMS: Stabilize and prevent unnecessary recalculations (moved to component level)
     const wheelTextItems = useMemo(() => {
       // 🎯 CRITICAL FIX: PRIORITIZE ORGANIZER RANDOM SELECTION - show only selected students if organizer did random selection
       const selectedStudentsFromWheel = session?.wheelState?.selectedStudents && session.wheelState.selectedStudents.length > 0
         ? session.wheelState.selectedStudents as Array<{id: string, name: string}>
         : null

       // 🎯 CRITICAL FIX: PRIORITIZE ORGANIZER SHUFFLE - use shuffled text items with highest priority
       const shuffledTextItems: string[] | null = (session?.wheelState?.shuffledItems && session.wheelState.shuffledItems.length > 0)
         ? session.wheelState.shuffledItems as string[]
         : (session?.wheelState?.wheelItems && session.wheelState.wheelItems.length > 0)
         ? session.wheelState.wheelItems as string[]
         : (session?.wheelState?.customItems && session.wheelState.customItems.length > 0)
         ? session.wheelState.customItems as string[]
         : null

       // Build text items in priority order with random selection as absolute highest priority
       let items: string[] = []
       if (selectedStudentsFromWheel && session?.wheelState?.showSelectedStudentsOnWheel) {
         items = selectedStudentsFromWheel.map((s: any) => s.name)
         console.log("🎯✅ PARTICIPANT USING RANDOM SELECTED STUDENTS FROM ORGANIZER", {
           count: items.length,
           preview: items.slice(0, 5),
           source: 'wheelState.selectedStudents',
           timestamp: new Date().toISOString()
         })
       } else if (shuffledTextItems) {
         items = [...shuffledTextItems]
         console.log("🎯✅ PARTICIPANT USING SHUFFLED/CUSTOM ITEMS FROM ORGANIZER", {
           count: items.length,
           preview: items.slice(0, 5),
           source: session?.wheelState?.shuffledItems ? 'shuffledItems' : 
                   session?.wheelState?.wheelItems ? 'wheelItems' : 'customItems',
           shuffleSeed: session?.wheelState?.shuffleSeed,
           shuffleUpdateKey: shuffleUpdateKey
         })
       } else if (session?.wheelItems && session.wheelItems.length > 0) {
         items = [...session.wheelItems]
         console.log("🎯 Using session.wheelItems:", items.length)
       } else if (session?.customItems && session.customItems.length > 0) {
         items = [...session.customItems]
         console.log("🎯 Using session.customItems:", items.length)
       } else if (session?.selectedWheelType?.defaultItems && session.selectedWheelType.defaultItems.length > 0) {
         items = [...session.selectedWheelType.defaultItems]
         console.log("🎯 Using selectedWheelType items:", items.length)
       } else if (session?.participants && session.participants.length > 0) {
         items = session.participants.map((p: any) => p.name)
         console.log("🎯 Using session participants:", items.length)
       } else {
         items = ["Option 1", "Option 2", "Option 3"]
         console.log("🎯 Using fallback items - no wheel data available")
       }
       
       return items
     }, [
       session?.wheelState?.shuffledItems,
       session?.wheelState?.wheelItems,
       session?.wheelState?.customItems,
       session?.wheelState?.shuffleSeed,
       session?.wheelState?.selectedStudents,
       session?.wheelState?.showSelectedStudentsOnWheel,
       session?.wheelItems,
       session?.customItems,
       session?.selectedWheelType?.defaultItems,
       session?.participants,
       shuffleUpdateKey
     ])

     // 🎯 SPIN REQUEST HANDLING: Handle participant spin requests with wheel data
     const handleParticipantSpinRequest = useCallback(async () => {
       if (!sessionId || !participantName) return

       // Get current wheel data to send with request
       const currentWheelData = {
         wheelType: session?.selectedWheelType?.id || session?.wheelType || 'default',
         wheelTitle: session?.selectedWheelType?.title || session?.wheelTitle || 'Wheel',
         wheelItems: wheelTextItems || [],
         wheelIcon: session?.selectedWheelType?.icon || session?.wheelIcon || '🎯',
         theme: session?.wheelState?.theme || { primary: '#8e0b16', secondary: '#66181E' },
         participantCount: wheelTextItems?.length || 0
       }

       console.log("🎯 PARTICIPANT SPIN REQUEST: Sending detailed request to organizer", {
         sessionId,
         participantName,
         wheelData: currentWheelData,
         timestamp: new Date().toISOString()
       })

       try {
         // Send spin request with current wheel data to organizer via Firebase
         await updateDoc(doc(db, "liveDrawSessions", sessionId), {
           spinRequest: {
             requestedBy: participantName,
             requestedAt: serverTimestamp(),
             status: 'pending',
             requestType: 'participant_spin',
             wheelData: currentWheelData,
             wheelItems: wheelTextItems || [],
             wheelType: currentWheelData.wheelType,
             wheelTitle: currentWheelData.wheelTitle,
             wheelIcon: currentWheelData.wheelIcon,
             message: `${participantName} is requesting a spin with the ${currentWheelData.wheelTitle}`
           },
           updatedAt: serverTimestamp()
         })

         console.log("✅ Spin request sent successfully with wheel data")

         // Show confirmation to participant
         const event = new CustomEvent('showToast', {
           detail: {
             title: "🎯 Request Sent!",
             description: `Your spin request for the ${currentWheelData.wheelTitle} has been sent to the organizer`,
             variant: "default"
           }
         })
         window.dispatchEvent(event)

       } catch (error) {
         console.error("❌ Failed to send spin request:", error)
         const event = new CustomEvent('showToast', {
           detail: {
             title: "Request Failed",
             description: "Could not send spin request. Please try again.",
             variant: "destructive"
           }
         })
         window.dispatchEvent(event)
       }
     }, [sessionId, participantName, session, wheelTextItems])
 
     // 🎯 STABILITY: Debounced session updates to prevent flickering
     useEffect(() => {
       const now = Date.now()
       const timeSinceLastUpdate = now - lastSessionUpdate.current
       const minUpdateDelay = 100 // Minimum 100ms between updates

       // Clear existing timeout
       if (sessionUpdateTimeout.current) {
         clearTimeout(sessionUpdateTimeout.current)
       }

       // If enough time has passed, update immediately
       if (timeSinceLastUpdate >= minUpdateDelay) {
         setStableSession(session)
         lastSessionUpdate.current = now
         setLastSyncTime(now)
       } else {
         // Otherwise, schedule update after delay
         sessionUpdateTimeout.current = setTimeout(() => {
           setStableSession(session)
           lastSessionUpdate.current = Date.now()
           setLastSyncTime(Date.now())
         }, minUpdateDelay - timeSinceLastUpdate)
       }

       return () => {
         if (sessionUpdateTimeout.current) {
           clearTimeout(sessionUpdateTimeout.current)
         }
       }
     }, [session])

     // Memoize initial slices to prevent infinite re-renders with enhanced image handling
     const imagePickerInitialSlices = useMemo(() => {
       // Create a stable key based on the data that actually changes the slices
       const participantSliceKeys = Array.from(participantSliceImages.keys()).sort().join(',')
       const imageWheelSlicesKeys = session?.imageWheelSlices?.map((s: any) => s.id || s.text).sort().join(',') || ''
       const wheelImagesKeys = session?.wheelImages?.map((w: any) => w.sliceId).sort().join(',') || ''
       const wheelItemsKeys = session?.wheelItems?.sort().join(',') || ''

       console.log('🎨 PARTICIPANT WHEEL: Computing imagePickerInitialSlices:', {
         participantSliceKeys,
         imageWheelSlicesKeys,
         wheelImagesKeys,
         wheelItemsKeys,
         participantSliceImagesSize: participantSliceImages.size,
         participantLoadedImagesSize: participantLoadedImages.size,
         shouldShowImages
       })

       // 🎯 PRIORITY 1: Use debounced participant slice images data (most current and stable)
       if (debouncedSliceImages.size > 0) {
         console.log('🎨 PARTICIPANT WHEEL: Using debounced participant slice images data')
         const slicesFromParticipantData = Array.from(debouncedSliceImages.entries()).map(([sliceId, sliceData], index) => ({
           id: sliceId,
           text: sliceId, // Use sliceId as text since we don't have text in participant data
           color: index % 2 === 0 ? "#8e0b16" : "#66181E",
           image: sliceData.url ? {
             url: sliceData.url,
             alt: sliceData.alt || `Image for ${sliceId}`,
             isLoaded: sliceData.isLoaded !== false,
             error: sliceData.error || false,
             imgElement: participantLoadedImages.get(sliceId)
           } : undefined
         }))
         console.log('✅ PARTICIPANT SLICES CREATED FROM PARTICIPANT DATA:', slicesFromParticipantData.length)
         return slicesFromParticipantData
       }

       // 🎯 PRIORITY 2: For participants, prioritize imageWheelSlices from organizer
       if (session?.imageWheelSlices && Array.isArray(session.imageWheelSlices) && session.imageWheelSlices.length > 0) {
         console.log('🎨 PARTICIPANT WHEEL: Using organizer imageWheelSlices:', session.imageWheelSlices.length)
         return session.imageWheelSlices.map((slice: any, index: number) => ({
           id: slice.id || `slice-${index}`,
           text: slice.text || `Slice ${index + 1}`,
           color: slice.color || (index % 2 === 0 ? "#8e0b16" : "#66181E"),
           image: slice.image ? {
             url: slice.image.url,
             alt: slice.image.alt || `Image for ${slice.text || `Slice ${index + 1}`}`,
             isLoaded: slice.image.isLoaded !== false,
             error: slice.image.error || false,
             imgElement: participantLoadedImages.get(slice.id || `slice-${index}`)
           } : undefined
         }))
       }

       // 🎯 PRIORITY 3: Also check for wheelImages format from organizer
       if (session?.wheelImages && Array.isArray(session.wheelImages) && session.wheelImages.length > 0) {
         console.log('🎨 PARTICIPANT WHEEL: Using organizer wheelImages:', session.wheelImages.length)
         return session.wheelImages.map((imgData: any, index: number) => ({
           id: imgData.sliceId || `slice-${index}`,
           text: imgData.sliceId || `Slice ${index + 1}`,
           color: index % 2 === 0 ? "#8e0b16" : "#66181E",
           image: imgData.url ? {
             url: imgData.url,
             alt: imgData.alt || `Image for ${imgData.sliceId || `Slice ${index + 1}`}`,
             isLoaded: imgData.isLoaded !== false,
             error: imgData.error || false,
             imgElement: participantLoadedImages.get(imgData.sliceId || `slice-${index}`)
           } : undefined
         }))
       }

       // 🎯 PRIORITY 4: Fallback to wheelItems if available
       if (session?.wheelItems && Array.isArray(session.wheelItems) && session.wheelItems.length > 0) {
         const convertedSlices = session.wheelItems.map((item: string, index: number) => ({
           id: `slice-${index}`,
           text: item,
           color: index % 2 === 0 ? "#8e0b16" : "#66181E",
           image: participantSliceImages.get(`slice-${index}`) ? {
             url: participantSliceImages.get(`slice-${index}`)?.url,
             alt: `Image for ${item}`,
             isLoaded: participantLoadedImages.get(`slice-${index}`) ? true : false,
             error: false,
             imgElement: participantLoadedImages.get(`slice-${index}`)
           } : undefined
         }))
         console.log('🎨 PARTICIPANT WHEEL: Converting wheelItems to slices with participant images:', convertedSlices.length)
         return convertedSlices
       }

       // 🎯 PRIORITY 5: Final fallback for participants - ensure they always see something
       console.log('🎨 PARTICIPANT WHEEL: Using default slices for participant view')
       return [
         { id: '1', text: 'Waiting for organizer...', color: '#8e0b16' },
         { id: '2', text: 'Slice 2', color: '#66181E' },
         { id: '3', text: 'Slice 3', color: '#8e0b16' },
         { id: '4', text: 'Slice 4', color: '#66181E' },
         { id: '5', text: 'Slice 5', color: '#8e0b16' },
         { id: '6', text: 'Slice 6', color: '#66181E' }
       ]
     }, [
       debouncedSliceImages, // Use the debounced Map directly instead of size
       session?.imageWheelSlices, // Use the array directly
       session?.wheelImages, // Use the array directly
       session?.wheelItems, // Use the array directly
       participantLoadedImages, // Use the Map directly
       shouldShowImages
     ])

     // 🎯 FIX: Determine correct imagePickerMode based on applied images (moved up to fix dependency issue)

     // Debounce slice images updates to prevent flickering
     useEffect(() => {
       const timeoutId = setTimeout(() => {
         setDebouncedSliceImages(participantSliceImages)
       }, 100) // 100ms debounce

       return () => clearTimeout(timeoutId)
     }, [participantSliceImages])

     // 🎯 ENHANCED DEBUGGING: More detailed logging for image detection
     console.log("🎯 PARTICIPANT IMAGE DEBUG - DETAILED:", {
       sessionId: sessionId,
       wheelType: session.selectedWheelType?.id || session.wheelType,
       isImagePicker: session.selectedWheelType?.id === 'image-picker' || session.wheelType === 'image-picker',
       hasAppliedImages,
       hasImageWheelSlices,
       hasWheelImages,
       hasWheelStateImages,
       shouldShowImages,
       // Session data details
       wheelStateImages: session?.wheelState?.wheelImages?.length || 0,
       imageWheelSlices: session?.imageWheelSlices?.length || 0,
       wheelImages: session?.wheelImages?.length || 0,
       wheelStateHasImages: session?.wheelState?.hasImages,
       // Local state
       participantSliceImages: participantSliceImages.size,
       participantLoadedImages: participantLoadedImages.size,
       imagePickerMode: shouldShowImages,
       // Slice details
       imagePickerInitialSlices: imagePickerInitialSlices.length,
       slicesWithImages: imagePickerInitialSlices.filter((s: any) => s.image?.url).length,
       timestamp: new Date().toISOString()
     })

     console.log("🎯 PARTICIPANT IMAGE DEBUG:", {
       hasAppliedImages,
       hasImageWheelSlices,
       hasWheelImages,
       hasWheelStateImages,
       shouldShowImages,
       wheelStateImages: session?.wheelState?.wheelImages?.length || 0,
       imageWheelSlices: session?.imageWheelSlices?.length || 0,
       wheelImages: session?.wheelImages?.length || 0,
       wheelStateHasImages: session?.wheelState?.hasImages,
       sessionId: sessionId,
       imagePickerMode: shouldShowImages,
       wheelType: session.selectedWheelType?.id || session.wheelType,
       isImagePicker: session.selectedWheelType?.id === 'image-picker' || session.wheelType === 'image-picker'
     })

     // Force image picker mode if we have images
     if (shouldShowImages && !imagePickerMode) {
       console.log("🎨 FORCING IMAGE PICKER MODE ACTIVE for participant")
       setImagePickerMode(true)
     }
 
    // Stabilize onClose function to prevent infinite re-render loop in Dialog component
    const handleWinnerPopupClose = useCallback(() => {
      console.log("🎯 WINNER POPUP: Participant closed winner announcement popup")
      setShowWinnerPopup(false)
      setSession((prev: any) => prev ? { ...prev, winners: [] } : null)
    }, [])
 
    // Add event listener for custom toast events
  useEffect(() => {
    const handleToastEvent = (event: any) => {
      const { title, description, variant } = event.detail
      toast({
        title,
        description,
        variant: variant || "default"
      })
    }

    window.addEventListener('showToast', handleToastEvent)

    return () => {
      window.removeEventListener('showToast', handleToastEvent)
    }
  }, [])

  // 🎯 SHUFFLE VALIDATION: Monitor shuffle changes and validate data integrity
  useEffect(() => {
    if (session?.wheelState?.shuffledItems && session.wheelState.shuffledItems.length > 0) {
      const currentItems = JSON.stringify(session.wheelState.shuffledItems)
      const lastItems = JSON.stringify(lastShuffledItemsRef.current)
      
      if (currentItems !== lastItems) {
        console.log("🎯✅ SHUFFLE VALIDATION: Detected new shuffled items from organizer", {
          itemCount: session.wheelState.shuffledItems.length,
          firstItem: session.wheelState.shuffledItems[0],
          lastItem: session.wheelState.shuffledItems[session.wheelState.shuffledItems.length - 1],
          shuffleSeed: session.wheelState.shuffleSeed,
          shuffleUpdateKey: shuffleUpdateKey,
          itemsPreview: session.wheelState.shuffledItems.slice(0, 5),
          timestamp: new Date().toISOString()
        })
        
        lastShuffledItemsRef.current = [...session.wheelState.shuffledItems]
      }
    }
  }, [session?.wheelState?.shuffledItems, session?.wheelState?.shuffleSeed, shuffleUpdateKey])

  // 🎯 ULTRA-RESPONSIVE SPINNING: Direct Firebase listener for instant wheel synchronization
  useEffect(() => {
    let isMounted = true
    console.log("🔄 Setting up ULTRA-FAST spin listener for session:", sessionId)

    const spinUnsubscribe = onSnapshot(
      doc(db, "liveDrawSessions", sessionId),
      (docSnapshot) => {
        if (!isMounted || !docSnapshot.exists()) return

        const sessionData = docSnapshot.data()
        const wheelState = sessionData.wheelState
        const currentIsSpinning = sessionData.isSpinning || wheelState?.isSpinning || false

        console.log("⚡ INSTANT SPIN DETECTOR:", {
          currentIsSpinning,
          wheelStateIsSpinning: wheelState?.isSpinning,
          localIsSpinning: isSpinning,
          hasWheelState: !!wheelState,
          sessionId: sessionId,
          sessionDataKeys: Object.keys(sessionData || {}),
          wheelStateKeys: Object.keys(wheelState || {}),
          timestamp: new Date().toISOString()
        })

        // 🔄 CRITICAL: Handle reset signal from organizer
        if (wheelState?.resetId && wheelState.resetId !== lastResetTimestampRef.current) {
          console.log("🔄 PARTICIPANT: Reset detected from organizer", {
            resetId: wheelState.resetId,
            forceResetToZero: wheelState.forceResetToZero,
            currentAngle: wheelState.currentAngle,
            sessionId: sessionId
          })

          // Update last processed reset ID
          lastResetTimestampRef.current = wheelState.resetId

          // Stop any running animation
          if (animationRef.current) {
            cancelAnimationFrame(animationRef.current)
            animationRef.current = null
          }

          // Reset all states to match organizer
          setIsSpinning(false)
          setLastSpinData(null)
          setWinners([])
          setShowResults(false)
          setHasAnnouncedWinners(false)
          setCurrentSpinId("")
          setLastAnnouncedKey(null)
          setShowWinnerPopup(false)
          
          // Clear animation refs
          isAnimationRunningRef.current = false
          stopAnimationRef.current = false
          animationCompletedRef.current = false

          // CRITICAL: Dispatch custom event to reset EnhancedWheel to angle 0
          console.log("🔄 PARTICIPANT: Dispatching wheel reset event to EnhancedWheel")
          const resetEvent = new CustomEvent('resetWheelToZero', {
            detail: {
              resetId: wheelState.resetId,
              angle: 0,
              source: 'organizer',
              timestamp: Date.now()
            }
          })
          window.dispatchEvent(resetEvent)

          // Show notification
          const toastEvent = new CustomEvent('showToast', {
            detail: {
              title: "🔄 Wheel Reset",
              description: "Organizer has reset the wheel",
              variant: "default"
            }
          })
          window.dispatchEvent(toastEvent)

          console.log("✅ PARTICIPANT: Reset complete - wheel should be at angle 0")
        }

        // 🎯 SHUFFLE SYNCHRONIZATION: Detect shuffle updates and force wheel re-render with validation
        if (wheelState?.shuffleSeed !== undefined && wheelState?.shuffleSeed !== lastShuffleSeedRef.current) {
          // Additional validation: ensure we have actual shuffled items
          const hasValidShuffledItems = wheelState.shuffledItems && 
                                        Array.isArray(wheelState.shuffledItems) && 
                                        wheelState.shuffledItems.length > 0
          
          if (hasValidShuffledItems) {
            console.log("🎯🔄 PARTICIPANT: Valid shuffle detected - forcing wheel text update", {
              newShuffleSeed: wheelState.shuffleSeed,
              oldShuffleSeed: lastShuffleSeedRef.current,
              shuffledItemsCount: wheelState.shuffledItems.length,
              shuffledItemsPreview: wheelState.shuffledItems.slice(0, 5),
              shuffledItemsFull: wheelState.shuffledItems,
              shuffleSource: wheelState.shuffleSource,
              itemsShuffledAt: wheelState.itemsShuffledAt,
              timestamp: new Date().toISOString()
            })

            // Update shuffle seed reference
            lastShuffleSeedRef.current = wheelState.shuffleSeed
            
            // Update shuffled items reference for validation
            lastShuffledItemsRef.current = [...wheelState.shuffledItems]

            // Force component re-render to pick up new shuffled items
            setShuffleUpdateKey(prev => {
              const newKey = prev + 1
              console.log("✅ PARTICIPANT: Shuffle update key incremented", {
                oldKey: prev,
                newKey: newKey,
                willForceRerender: true
              })
              return newKey
            })

            // Also update session state immediately to ensure props update
            setSession((prevSession: any) => ({
              ...prevSession,
              wheelState: {
                ...prevSession?.wheelState,
                shuffledItems: wheelState.shuffledItems,
                shuffleSeed: wheelState.shuffleSeed,
                itemsShuffledAt: wheelState.itemsShuffledAt
              }
            }))

            console.log("✅ PARTICIPANT: Shuffle synchronization complete - wheel will re-render with new text order")
          } else {
            console.warn("⚠️ PARTICIPANT: Shuffle seed changed but no valid shuffled items array found", {
              shuffleSeed: wheelState.shuffleSeed,
              shuffledItems: wheelState.shuffledItems,
              hasShuffledItems: !!wheelState.shuffledItems,
              isArray: Array.isArray(wheelState.shuffledItems),
              length: wheelState.shuffledItems?.length
            })
          }
        }

        // 🎯 WHEEL TYPE CHANGE: Handled atomically in session listener below (lines 1270-1298)
        // Removed duplicate handler to prevent race conditions

        // 🚀 ENHANCED INSTANT SPIN START: Perfect synchronization with force sync support
        if (currentIsSpinning && !isSpinning) {
          // Hide any previous popup when a new spin starts
          setShowWinnerPopup(false)
          const spinData = sessionData.wheelState || {}
          
          console.log("🎯 PARTICIPANT SYNC: Organizer started spin - perfect synchronization", {
            hasForceSync: !!spinData.forceParticipantSync,
            syncMode: spinData.participantSyncMode || 'STANDARD',
            spinStartTime: spinData.spinStartTime,
            networkDelay: spinData.spinStartTime ? Date.now() - spinData.spinStartTime : 0,
            clearStateRequested: !!spinData.clearParticipantState,
            timestamp: new Date().toISOString()
          })

          // CRITICAL: Handle force participant sync with state clearing
          if (spinData.forceParticipantSync && spinData.clearParticipantState) {
            console.log("🎯 FORCE SYNC: Clearing participant state for perfect sync")
            setIsSpinning(false)
            setLastSpinData(null)
            // Small delay to ensure state is cleared
            setTimeout(() => {
              // Proceed with sync after state clear
              initiatePerfectSync(spinData)
            }, 10)
            return
          }

          // Standard or enhanced sync
          initiatePerfectSync(spinData)
        }

        function initiatePerfectSync(spinData: any) {
          // Calculate exact timing compensation
          const now = Date.now()
          const organizerStartTime = spinData.spinStartTime || now
          const networkDelay = Math.max(0, now - organizerStartTime)
          // Use full duration to keep animations aligned visually
          // Use organizer params exactly for perfect sync
          const remainingDuration = spinData.spinDuration || 3000

          console.log("🎯 PERFECT TIMING CALCULATION:", {
            organizerStartTime: new Date(organizerStartTime).toISOString(),
            networkDelay: networkDelay + 'ms',
            originalDuration: spinData.spinDuration + 'ms',
            adjustedDuration: remainingDuration + 'ms',
            syncQuality: networkDelay < 100 ? 'PERFECT' : networkDelay < 500 ? 'GOOD' : 'DELAYED'
          })

          // Enhanced: Store comprehensive spin data with timing compensation
          const enhancedSpinData = {
            wheelItemsUsed: spinData.wheelItemsUsed || sessionData.wheelItems || [],
            spinDuration: remainingDuration, // Compensated duration
            totalRotation: spinData.totalRotation || (5 + Math.random() * 3) * 2 * Math.PI,
            finalAngle: spinData.finalAngle || Math.random() * 2 * Math.PI,
            spins: spinData.spins || 5 + Math.random() * 3,
            winningIndex: spinData.winningIndex,
            winners: spinData.winners || [],
            animationTheme: spinData.animationTheme || spinData.theme,
            broadcastSource: spinData.broadcastSource || 'organizer',
            // Perfect sync timing data
            organizerStartTime: organizerStartTime,
            participantStartTime: now,
            networkCompensation: networkDelay,
            syncMode: spinData.participantSyncMode || 'ENHANCED',
            guaranteedSync: true,
            participantMode: true,
            timestamp: now
          }

          // Set spinner state immediately for zero-latency response
          setIsSpinning(true)
          setLastSpinData({ ...enhancedSpinData, spinStartTime: organizerStartTime })
          setConnectionStatus('connected')

          console.log("🎯 ENHANCED PERFECT PARTICIPANT SYNC:", {
            spinDuration: enhancedSpinData.spinDuration,
            totalRotation: (enhancedSpinData.totalRotation / (2 * Math.PI)).toFixed(2) + ' rotations',
            finalAngle: (enhancedSpinData.finalAngle * 180 / Math.PI).toFixed(1) + '°',
            spins: enhancedSpinData.spins,
            wheelItemsCount: enhancedSpinData.wheelItemsUsed?.length || 0,
            winningIndex: enhancedSpinData.winningIndex,
            networkCompensation: enhancedSpinData.networkCompensation + 'ms',
            syncQuality: enhancedSpinData.networkCompensation < 100 ? 'PERFECT' : 'GOOD',
            participantMode: true,
            guaranteedSync: true
          })

          // Show sync status notification
          const event = new CustomEvent('showToast', {
            detail: {
              title: networkDelay < 100 ? "🎯 Perfect Sync" : "🎯 Synchronized",
              description: networkDelay < 100 ? "Perfectly synchronized with organizer!" : 
                          networkDelay < 500 ? "Synchronized with organizer" : 
                          "Synchronized (network delay detected)",
              variant: networkDelay < 500 ? "default" : "destructive",
              duration: 2000
            }
          })
          window.dispatchEvent(event)
        }

        // 🎯 PERFECT SPIN END: Stop spinning when organizer completes with enhanced-wheel.tsx compatibility
        if ((!currentIsSpinning || wheelState?.completedAt) && isSpinning) {
          console.log("🎯 PERFECT SPIN COMPLETED - Stopping synchronized animation")
          setIsSpinning(false)

          console.log("⚡ PERFECT SYNCHRONIZATION ACHIEVED:", {
            spinCompleted: true,
            enhancedWheelIntegration: true,
            frameRate: '60 FPS',
            timing: 'perfectly synchronized',
            sessionId: sessionId,
            completedAt: wheelState?.completedAt
          })
        }

        // 🛡️ SAFETY CHECK: Stop spinning if winners are present (handles manual winner announcements)
        if (wheelState?.winners && wheelState.winners.length > 0 && wheelState.completedAt && isSpinning) {
          console.log("🛡️ SAFETY STOP - Winners detected while spinning, forcing stop")
          setIsSpinning(false)
        }

        // 🏆 CRITICAL FIX: CONSISTENT WINNER DETECTION FOR ALL PARTICIPANTS
        if (wheelState?.winners && wheelState.winners.length > 0) {
          console.log("🎯 WINNERS RECEIVED - PROCESSING FOR PARTICIPANT:", {
            winners: wheelState.winners.length,
            winnerNames: (wheelState.winners as Array<{name: string}>).map((w: {name: string}) => w.name),
            completedAt: wheelState.completedAt,
            isSpinning: wheelState.isSpinning,
            localIsSpinning: isSpinning,
            triggeredByOrganizer: wheelState.triggeredByOrganizer,
            spinStartTime: wheelState.spinStartTime,
            sessionId: sessionId
          })

          // 🛑 FORCE STOP SPINNING IMMEDIATELY when winners received
          if (isSpinning) {
            console.log("🛑 STOPPING SPIN - Winners received")
            setIsSpinning(false)
          }

          // 🎯 SHOW WINNER POPUP - Simple and reliable
          const key = `${wheelState.completedAt || Date.now()}-${(wheelState.winners as any[]).map(w=>w.id||w.name).join(',')}`
          if (lastAnnouncedKey !== key) {
            console.log("🎯 SHOWING WINNER POPUP:", {
              key,
              winners: wheelState.winners.map((w: any) => w.name)
            })
            setShowWinnerPopup(true)
            setLastAnnouncedKey(key)
          }

          // Always update session winners
          setSession((prev: any) => prev ? { ...prev, winners: wheelState.winners } : { winners: wheelState.winners })
        }

        // 🎨 THEME CHANGES: Handle real-time theme updates from organizer
        // Only apply theme changes when not spinning and not announcing winners
        if (wheelState?.theme && wheelState.themeUpdatedAt && !wheelState.winners && !wheelState.completedAt && !wheelState.isSpinning && !isSpinning) {
          console.log("🎨 PARTICIPANT: Organizer updated theme", {
            theme: wheelState.theme,
            themeUpdatedAt: wheelState.themeUpdatedAt,
            sessionId: sessionId
          })

          // Update session with new theme for real-time sync
          setSession((prev: any) => prev ? {
            ...prev,
            wheelState: {
              ...prev.wheelState,
              theme: wheelState.theme,
              themeUpdatedAt: wheelState.themeUpdatedAt
            }
          } : null)
        }

        // 📝 WHEEL ITEMS CHANGES: Handle real-time wheel item updates from organizer
        if (wheelState?.wheelItems && wheelState.itemsUpdatedAt) {
          console.log("📝 PARTICIPANT: Organizer updated wheel items", {
            newItemsCount: wheelState.wheelItems.length,
            itemsUpdatedAt: wheelState.itemsUpdatedAt,
            source: wheelState.itemChangeSource || 'unknown',
            forceRedraw: wheelState.forceParticipantRedraw,
            sessionId: sessionId,
            timestamp: new Date().toISOString()
          })

          // 🎯 STABILITY: Show updating indicator
          setIsUpdating(true)

          // Update session with new wheel items for real-time sync
          setSession((prev: any) => prev ? {
            ...prev,
            wheelState: {
              ...prev.wheelState,
              wheelItems: wheelState.wheelItems,
              customItems: wheelState.customItems || wheelState.wheelItems,
              itemsUpdatedAt: wheelState.itemsUpdatedAt,
              itemChangeSource: wheelState.itemChangeSource,
              forceParticipantRedraw: wheelState.forceParticipantRedraw,
              participantRedrawTimestamp: wheelState.participantRedrawTimestamp
            },
            wheelItems: wheelState.wheelItems,
            customItems: wheelState.customItems || wheelState.wheelItems
          } : null)

          // 🎯 FORCE PARTICIPANT REDRAW: Trigger custom event for EnhancedWheel to redraw immediately
          if (wheelState.forceParticipantRedraw) {
            console.log("🎯 FORCING PARTICIPANT WHEEL REDRAW with new items")
            
            // Use requestAnimationFrame for smooth update
            requestAnimationFrame(() => {
              const redrawEvent = new CustomEvent('forceWheelRedraw', {
                detail: {
                  items: wheelState.wheelItems,
                  source: 'organizer-apply-items',
                  timestamp: wheelState.participantRedrawTimestamp || Date.now()
                }
              })
              window.dispatchEvent(redrawEvent)

              // Clear updating indicator after a short delay
              setTimeout(() => setIsUpdating(false), 300)
            })

            // Show notification with better UX
            const toastEvent = new CustomEvent('showToast', {
              detail: {
                title: "🎯 Wheel Updated!",
                description: `Organizer updated wheel with ${wheelState.wheelItems.length} items`,
                variant: "default",
                duration: 2000
              }
            })
            window.dispatchEvent(toastEvent)
          } else {
            // No forced redraw, just clear updating indicator
            setTimeout(() => setIsUpdating(false), 100)
          }
        }

        // 🚀 CRITICAL FIX: CONSISTENT SPINNING SYNC - Always listen and respond
        if (wheelState && typeof wheelState.isSpinning === 'boolean' && wheelState.isSpinning !== isSpinning) {
          console.log("🎯 SPINNING STATE CHANGE - SYNCING:", {
            organizerSpinning: wheelState?.isSpinning,
            participantSpinning: isSpinning,
            willUpdate: wheelState?.isSpinning,
            sessionId: sessionId,
            timestamp: Date.now()
          })
          setIsSpinning(!!(wheelState && wheelState.isSpinning))
        }

        // 🎨 INSTANT IMAGE UPDATES: Handle real-time image updates from organizer
        if (sessionData.wheelImages && sessionData.lastImageUpdate) {
          const imageUpdateTime = sessionData.lastImageUpdate?.toMillis?.() || sessionData.lastImageUpdate
          const shouldUpdateImages = imageUpdateTime > lastImageUpdate

          if (shouldUpdateImages) {
            console.log("🎨 INSTANT IMAGE UPDATE DETECTED: Organizer added/updated images", {
              imageCount: sessionData.wheelImages.length,
              lastImageUpdate: imageUpdateTime,
              previousUpdate: lastImageUpdate,
              sessionId: sessionId,
              timestamp: new Date().toISOString()
            })

            // Load images for participant display with improved error handling
            const loadParticipantImages = async () => {
              const newSliceImages = new Map<string, any>()
              const newLoadedImages = new Map<string, HTMLImageElement>()
              let loadedCount = 0

              for (const imgData of sessionData.wheelImages) {
                if (imgData.url && imgData.sliceId) {
                  const sliceImage = {
                    url: imgData.url,
                    alt: imgData.alt || `Image for ${imgData.sliceId}`,
                    isLoaded: imgData.isLoaded !== false,
                    error: imgData.error || false
                  }
                  newSliceImages.set(imgData.sliceId, sliceImage)

                  // Load the actual image immediately for instant display
                  if (imgData.isLoaded !== false && imgData.url) {
                    const img = new Image()
                    img.crossOrigin = "anonymous"
                    img.onload = () => {
                      console.log("✅ PARTICIPANT IMAGE LOADED:", imgData.sliceId, imgData.url)
                      loadedCount++
                      setParticipantLoadedImages(prev => {
                        const updated = new Map(prev)
                        updated.set(imgData.sliceId, img)
                        return updated
                      })

                      // Show success notification when all images are loaded
                      if (loadedCount === sessionData.wheelImages.length) {
                        setTimeout(() => {
                          const event = new CustomEvent('showToast', {
                            detail: {
                              title: "🖼️ Images Updated!",
                              description: `All ${loadedCount} image${loadedCount === 1 ? '' : 's'} loaded successfully`,
                              variant: "default"
                            }
                          })
                          window.dispatchEvent(event)
                        }, 200)
                      }
                    }
                    img.onerror = () => {
                      console.warn("❌ PARTICIPANT IMAGE LOAD FAILED:", imgData.sliceId, imgData.url)
                      loadedCount++
                      // Still add placeholder to loaded images map to trigger UI update
                      setParticipantLoadedImages(prev => {
                        const updated = new Map(prev)
                        updated.set(imgData.sliceId, img)
                        return updated
                      })
                    }
                    img.src = imgData.url
                    newLoadedImages.set(imgData.sliceId, img)
                  }
                }
              }

              // Update slice images immediately
              setParticipantSliceImages(newSliceImages)
              setParticipantLoadedImages(newLoadedImages)
            }

            // Load images synchronously first for immediate display
            loadParticipantImages()

            // Update session with new images for instant participant reflection
            setSession((prev: any) => prev ? {
              ...prev,
              wheelImages: sessionData.wheelImages,
              imageWheelSlices: sessionData.imageWheelSlices,
              wheelState: {
                ...prev.wheelState,
                hasImages: sessionData.wheelImages.length > 0,
                imageCount: sessionData.wheelImages.length,
                imagesApplied: true,
                imagePickerMode: true,
                lastImageUpdate: imageUpdateTime
              },
              lastImageUpdate: imageUpdateTime
            } : null)

            // Force immediate image picker mode activation and UI update
            setImagePickerMode(true)
            setLastImageUpdate(imageUpdateTime)

            console.log("✅ INSTANT IMAGE REFLECTION: Participants should see images immediately", {
              sessionId,
              imageCount: sessionData.wheelImages.length,
              updateTimestamp: new Date().toISOString(),
              instantUpdateTriggered: true,
              multipleUpdates: true
            })
          }
        }

        // Also check for imageWheelSlices format updates
        if (sessionData.imageWheelSlices && sessionData.lastImageUpdate) {
          const imageUpdateTime = sessionData.lastImageUpdate?.toMillis?.() || sessionData.lastImageUpdate
          const shouldUpdateImageSlices = imageUpdateTime > lastImageUpdate

          if (shouldUpdateImageSlices) {
            console.log("🎨 INSTANT IMAGE SLICES UPDATE DETECTED: Organizer updated image slices", {
              sliceCount: sessionData.imageWheelSlices.length,
              lastImageUpdate: imageUpdateTime,
              previousUpdate: lastImageUpdate,
              sessionId: sessionId,
              timestamp: new Date().toISOString()
            })

            // Load images for participant display immediately with improved error handling
            const loadParticipantSliceImages = async () => {
              const newSliceImages = new Map<string, any>()
              const newLoadedImages = new Map<string, HTMLImageElement>()
              let loadedCount = 0

              for (const slice of sessionData.imageWheelSlices) {
                if (slice.image?.url) {
                  const sliceKey = slice.id || slice.text || `slice-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
                  const sliceImage = {
                    url: slice.image.url,
                    alt: slice.image.alt || `Image for ${slice.text || slice.name || 'Slice'}`,
                    isLoaded: slice.image.isLoaded !== false,
                    error: slice.image.error || false
                  }
                  newSliceImages.set(sliceKey, sliceImage)

                  // Load the actual image immediately for instant display
                  if (slice.image.isLoaded !== false && slice.image.url) {
                    const img = new Image()
                    img.crossOrigin = "anonymous"
                    img.onload = () => {
                      console.log("✅ PARTICIPANT SLICE IMAGE LOADED:", sliceKey, slice.image.url)
                      loadedCount++
                      setParticipantLoadedImages(prev => {
                        const updated = new Map(prev)
                        updated.set(sliceKey, img)
                        return updated
                      })

                      // Show success notification when all images are loaded
                      if (loadedCount === sessionData.imageWheelSlices.filter((s: any) => s.image?.url).length) {
                        setTimeout(() => {
                          const event = new CustomEvent('showToast', {
                            detail: {
                              title: "🖼️ Images Updated!",
                              description: `All ${loadedCount} image${loadedCount === 1 ? '' : 's'} loaded successfully`,
                              variant: "default"
                            }
                          })
                          window.dispatchEvent(event)
                        }, 200)
                      }
                    }
                    img.onerror = () => {
                      console.warn("❌ PARTICIPANT SLICE IMAGE LOAD FAILED:", sliceKey, slice.image.url)
                      loadedCount++
                      // Still add placeholder to loaded images map to trigger UI update
                      setParticipantLoadedImages(prev => {
                        const updated = new Map(prev)
                        updated.set(sliceKey, img)
                        return updated
                      })
                    }
                    img.src = slice.image.url
                    newLoadedImages.set(sliceKey, img)
                  }
                }
              }

              // Update slice images immediately
              setParticipantSliceImages(newSliceImages)
              setParticipantLoadedImages(newLoadedImages)
            }

            // Load images synchronously first for immediate display
            loadParticipantSliceImages()

            // Update session with new image slices for instant participant reflection
            setSession((prev: any) => prev ? {
              ...prev,
              imageWheelSlices: sessionData.imageWheelSlices,
              wheelImages: sessionData.wheelImages,
              wheelState: {
                ...prev.wheelState,
                hasImages: sessionData.imageWheelSlices.some((slice: any) => slice.image?.url),
                imageCount: sessionData.imageWheelSlices.filter((slice: any) => slice.image?.url).length,
                imagesApplied: true,
                imagePickerMode: true,
                lastImageUpdate: imageUpdateTime
              },
              lastImageUpdate: imageUpdateTime
            } : null)

            // Force immediate image picker mode activation and UI update
            setImagePickerMode(true)
            setLastImageUpdate(imageUpdateTime)

            console.log("✅ INSTANT IMAGE SLICES REFLECTION: Participants should see image slices immediately", {
              sessionId,
              sliceCount: sessionData.imageWheelSlices.length,
              updateTimestamp: new Date().toISOString(),
              instantUpdateTriggered: true,
              multipleUpdates: true
            })
          }
        }

        // 🎯 WHEEL TYPE CHANGES: Handle real-time wheel type updates from organizer
        if (wheelState?.selectedWheelType && wheelState.wheelTypeUpdatedAt) {
          console.log("🎯 PARTICIPANT: Organizer changed wheel type", {
            wheelType: wheelState.selectedWheelType.id,
            wheelTypeUpdatedAt: wheelState.wheelTypeUpdatedAt,
            sessionId: sessionId
          })

          // Update session with new wheel type for real-time sync
          setSession((prev: any) => prev ? {
            ...prev,
            selectedWheelType: wheelState.selectedWheelType,
            wheelState: {
              ...prev.wheelState,
              selectedWheelType: wheelState.selectedWheelType,
              wheelTypeUpdatedAt: wheelState.wheelTypeUpdatedAt
            }
          } : null)
        }
      },
      (error) => {
        console.error("❌ Ultra-fast spin listener error:", error)
        if (isMounted) setConnectionStatus('disconnected')
      }
    )

    return () => {
      isMounted = false
      console.log("🔄 Cleaning up ultra-fast spin listener")
      spinUnsubscribe()
    }
  }, [sessionId])

  // ⚠️ LEGACY: Keep original session listener for other session data
  // 🎯 This handles reactions/comments/participants but NOT spinning (handled above for speed)
  useEffect(() => {
    let isMounted = true
    let sessionUnsubscribe: (() => void) | null = null
    let reactionsUnsubscribe: (() => void) | null = null
    let commentsUnsubscribe: (() => void) | null = null
    let heartbeatInterval: NodeJS.Timeout | null = null

    // 🎯 SPIN REQUEST LISTENER: Listen for participant spin requests (organizer only)
    const setupSpinRequestListener = () => {
      // Check if current user is organizer or collaborator
      const currentIsActualOrganizer = session && user && session.createdBy === user.uid
      const currentIsCollaborator = session && user && (
        session.collaboratorDetails?.some((collab: any) => collab.uid === user.uid) ||
        session.collaborators?.includes(user.email)
      )

      if (!currentIsActualOrganizer && !currentIsCollaborator) return // Only organizers handle spin requests

      console.log("🎯 ORGANIZER: Setting up spin request listener for participant requests")

      const spinRequestUnsubscribe = onSnapshot(
        doc(db, "liveDrawSessions", sessionId),
        (docSnapshot) => {
          if (!isMounted || !docSnapshot.exists()) return

          const sessionData = docSnapshot.data()

          // Handle spin requests from participants
          if (sessionData.spinRequest && sessionData.spinRequest.status === 'pending' && (currentIsActualOrganizer || currentIsCollaborator)) {
            console.log("🎯 SPIN REQUEST RECEIVED: Participant requested spin, triggering wheel spin", {
              spinRequest: sessionData.spinRequest,
              sessionId: sessionId,
              isActualOrganizer: currentIsActualOrganizer,
              isCollaborator: currentIsCollaborator,
              timestamp: new Date().toISOString()
            })

            // Clear the spin request
            updateDoc(doc(db, "liveDrawSessions", sessionId), {
              spinRequest: {
                status: 'processed',
                processedAt: serverTimestamp(),
                processedBy: user?.uid || 'organizer'
              },
              updatedAt: serverTimestamp()
            }).catch(error => {
              console.error("❌ Failed to clear spin request:", error)
            })

            // Trigger the spin by setting isSpinning to true
            setIsSpinning(true)

            // Show notification to organizer with wheel details
            const wheelTitle = sessionData.spinRequest.wheelTitle || 'Wheel'
            const wheelIcon = sessionData.spinRequest.wheelIcon || '🎯'
            const participantName = sessionData.spinRequest.requestedBy || 'Participant'
            const itemCount = sessionData.spinRequest.wheelItems?.length || 0
            
            const event = new CustomEvent('showToast', {
              detail: {
                title: `${wheelIcon} Spin Request from ${participantName}`,
                description: `Spinning ${wheelTitle} (${itemCount} items) as requested by ${participantName}`,
                variant: "default"
              }
            })
            window.dispatchEvent(event)
          }
        },
        (error) => {
          console.error("❌ Spin request listener error:", error)
        }
      )

      return spinRequestUnsubscribe
    }

    // Helper function to determine collaborator status
    const determineCollaboratorStatus = (sessionData: any, user: FirebaseUser | null | undefined) => {
      if (!sessionData || !user) return false

      const isCollaborator = sessionData.collaboratorDetails?.some((collab: any) => collab.uid === user.uid) ||
                            sessionData.collaborators?.includes(user.email)

      if (process.env.NODE_ENV === 'development') {
        console.log(`🤝 Real-time collaborator check for ${user.email}:`, {
          userUid: user.uid,
          sessionCollaborators: sessionData.collaborators,
          sessionCollaboratorDetails: sessionData.collaboratorDetails,
          isCollaborator: isCollaborator
        })
      }

      return isCollaborator
    }

    // 🔧 SESSION STATUS ONLY - EnhancedWheel handles wheel synchronization
    // Wait for authentication to be initialized before setting up listeners
    const setupListeners = async () => {
      try {
        console.log("🔧 Setting up Firestore listeners for session:", sessionId)

        // Session listener with enhanced error handling
        sessionUnsubscribe = onSnapshot(
          doc(db, "liveDrawSessions", sessionId),
          (doc) => {
            if (!isMounted) return

            if (doc.exists()) {
              const data = doc.data()
              const updatedSession: any = { ...data, id: doc.id }
 
              // Extract winners from wheelState with improved synchronization
              // CRITICAL FIX: Always update winners to ensure proper announcement
              if (data.wheelState?.winners && data.wheelState.winners.length > 0 && data.wheelState.completedAt) {
                // Always update winners for proper announcement - less strict conditions
                updatedSession.winners = data.wheelState.winners
                console.log("🎯 SESSION LISTENER: Extracted winners from wheelState:", {
                  winnerCount: data.wheelState.winners.length,
                  winners: data.wheelState.winners,
                  completedAt: data.wheelState.completedAt,
                  isSpinning: data.isSpinning,
                  wheelStateIsSpinning: data.wheelState.isSpinning,
                  localIsSpinning: isSpinning,
                  sessionId: sessionId
                })
              }

              // 🎯 ATOMIC WHEEL TYPE CHANGE: Process all state updates synchronously
              const incomingWheelTypeChangeId = data.wheelState?.wheelTypeChangeId || ''
              const incomingWheelTypeId = data.selectedWheelType?.id || ''
              
              if (incomingWheelTypeChangeId && 
                  incomingWheelTypeChangeId !== lastWheelTypeChangeIdRef.current &&
                  incomingWheelTypeId !== currentWheelTypeId) {
                console.log("🔄 PARTICIPANT: ATOMIC wheel type change detected", {
                  from: currentWheelTypeId,
                  to: incomingWheelTypeId,
                  changeId: incomingWheelTypeChangeId,
                  wheelTitle: data.selectedWheelType?.title,
                  wasSpinning: isSpinning,
                  timestamp: new Date().toISOString()
                })
                
                // 🎯 PHASE 1: Update tracking refs FIRST
                lastWheelTypeChangeIdRef.current = incomingWheelTypeChangeId
                setCurrentWheelTypeId(incomingWheelTypeId)
                
                // 🎯 PHASE 2: Clear ALL participant states atomically
                setWinners([])
                setShowWinnerPopup(false)
                setShowResults(false)
                setHasAnnouncedWinners(false)
                setCurrentSpinId('')
                setLastAnnouncedKey(null)
                setLastSpinData(null)
                
                // 🚨 CRITICAL: Force stop spinning immediately
                setIsSpinning(false)
                
                // 🎯 PHASE 3: Dispatch clear events to wheel components
                window.dispatchEvent(new CustomEvent('clearParticipantWinners'))
                window.dispatchEvent(new CustomEvent('clearWheelWinners'))
                
                // 🎯 PHASE 4: Show user notification
                window.dispatchEvent(new CustomEvent('showToast', {
                  detail: {
                    title: "🔄 Wheel Type Changed",
                    description: `Organizer changed to "${data.selectedWheelType?.title}" - Wheel reset`,
                    variant: "default"
                  }
                }))
                
                console.log("✅ PARTICIPANT: ATOMIC wheel type change complete - all states cleared")
              }

              // Update collaborator status in real-time
              const isCollaborator = determineCollaboratorStatus(updatedSession, user)
              setIsUserCollaborator(isCollaborator)

              // Only update session if it's meaningfully different to prevent unnecessary re-renders
              setSession((prevSession: any) => {
                // 🎯 CRITICAL FIX: Include theme and items in essential fields to detect organizer changes
                // This ensures participants see theme/item updates IMMEDIATELY, not just when spinning
                const essentialFields = [
                  'wheelImages', 
                  'imageWheelSlices', 
                  'wheelState', 
                  'winners', 
                  'isSpinning', 
                  'currentState', 
                  'teams',
                  'wheelState.theme',           // 🎨 Theme changes
                  'wheelState.wheelItems',      // 📝 Item changes from Apply Items
                  'wheelState.customItems',     // 📝 Item changes from Fill with Live
                  'wheelState.itemsUpdatedAt',  // 🕒 Item update timestamp
                  'wheelState.themeUpdatedAt'   // 🕒 Theme update timestamp
                ]
                
                const hasChanged = essentialFields.some(field => {
                  // Handle nested field paths (e.g., 'wheelState.theme')
                  const getNestedValue = (obj: any, path: string) => {
                    return path.split('.').reduce((current, key) => current?.[key], obj)
                  }
                  
                  const prevValue = JSON.stringify(getNestedValue(prevSession, field))
                  const newValue = JSON.stringify(getNestedValue(updatedSession, field))
                  return prevValue !== newValue
                })

                if (hasChanged) {
                  // 🎯 Enhanced logging to show what changed
                  const changedFields = essentialFields.filter(field => {
                    const getNestedValue = (obj: any, path: string) => {
                      return path.split('.').reduce((current, key) => current?.[key], obj)
                    }
                    const prevValue = JSON.stringify(getNestedValue(prevSession, field))
                    const newValue = JSON.stringify(getNestedValue(updatedSession, field))
                    return prevValue !== newValue
                  })
                  
                  console.log("🎯 SESSION LISTENER: Updating session state", {
                    changedFields: changedFields,
                    hasTeams: !!updatedSession.teams,
                    teamsLength: updatedSession.teams?.length || 0,
                    hasThemeChange: changedFields.includes('wheelState.theme'),
                    hasItemsChange: changedFields.includes('wheelState.wheelItems') || changedFields.includes('wheelState.customItems'),
                    newTheme: updatedSession.wheelState?.theme,
                    newItemsCount: updatedSession.wheelState?.wheelItems?.length || updatedSession.wheelState?.customItems?.length || 0,
                    sessionId: sessionId
                  })
                  return updatedSession
                }

                // CRITICAL FIX: Always update if teams data has changed, even if other fields haven't
                // This ensures participants see teams immediately when organizer generates them
                const teamsChanged = JSON.stringify(prevSession?.teams) !== JSON.stringify(updatedSession.teams)
                const wheelStateTeamsChanged = JSON.stringify(prevSession?.wheelState?.teams) !== JSON.stringify(updatedSession.wheelState?.teams)

                if (teamsChanged || wheelStateTeamsChanged) {
                  console.log("🎯 SESSION LISTENER: TEAMS UPDATE DETECTED - Forcing session update", {
                    teamsChanged,
                    wheelStateTeamsChanged,
                    newTeamsLength: updatedSession.teams?.length || 0,
                    newWheelStateTeamsLength: updatedSession.wheelState?.teams?.length || 0,
                    sessionId: sessionId,
                    timestamp: new Date().toISOString()
                  })
                  return updatedSession
                }

                return prevSession
              })

              setConnectionStatus('connected')

              // Check if session has been ended
              if (!data.isActive && !data.isLive) {
                console.log('🏁 Session has been ended by organizer')
                const event = new CustomEvent('showToast', {
                  detail: {
                    title: "Session Ended",
                    description: "This live session has been ended by the organizer.",
                    variant: "destructive"
                  }
                })
                window.dispatchEvent(event)

                // Redirect to home page after a delay
                setTimeout(() => {
                  if (isMounted) {
                    window.location.href = '/'
                  }
                }, 3000)
                return
              }
            } else {
              setConnectionStatus('disconnected')
              const event = new CustomEvent('showToast', {
                detail: {
                  title: "Session Not Found",
                  description: "This live session may have ended or is no longer available",
                  variant: "destructive"
                }
              })
              window.dispatchEvent(event)
            }
            setLoading(false)
          },
          (error: any) => {
            if (!isMounted) return

            // Enhanced error handling for different error types
            if (error.code === 'permission-denied') {
              console.warn("⚠️ Permission denied for session listener - this may be normal for anonymous users accessing public sessions")
              setConnectionStatus('connected') // Don't mark as disconnected for permission issues
              setLoading(false)
              return // Don't show error toast for permission issues
            } else if (error.code === 'unavailable') {
              console.error("❌ Session listener unavailable:", error)
              setConnectionStatus('disconnected')
            } else {
              console.error("❌ Session listener error:", error)
              setConnectionStatus('disconnected')
            }

            setLoading(false)

            // Only show error toast for non-permission errors
            if (error.code !== 'permission-denied') {
              let errorMessage = "Lost connection to live session. Please refresh the page."
              if (error.code === 'unavailable') {
                errorMessage = "Service temporarily unavailable. Please try again in a moment."
              }

              const event = new CustomEvent('showToast', {
                detail: {
                  title: "Connection Error",
                  description: errorMessage,
                  variant: "destructive"
                }
              })
              window.dispatchEvent(event)
            }
          }
        )

        // Reactions listener with error handling
        reactionsUnsubscribe = onSnapshot(
          collection(db, "liveDrawSessions", sessionId, "reactions"),
          (snapshot) => {
            if (!isMounted) return
            const reactionList = snapshot.docs.map(doc => {
              const data = doc.data()
              const timestamp = data.timestamp?.toDate() || new Date()
              return { id: doc.id, ...data, timestamp }
            })
            setReactions(reactionList.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()).slice(0, 15))
          },
          (error: any) => {
            if (!isMounted) return
            if (error.code === 'permission-denied') {
              console.warn("⚠️ Permission denied for reactions listener - this may be normal for anonymous users")
              // Don't show error toast for reactions as they're not critical
            } else {
              console.error("❌ Reactions listener error:", error)
            }
          }
        )

        // Comments listener with error handling
        commentsUnsubscribe = onSnapshot(
          collection(db, "liveDrawSessions", sessionId, "comments"),
          (snapshot) => {
            if (!isMounted) return
            const commentList = snapshot.docs.map(doc => {
              const data = doc.data()
              const timestamp = data.timestamp?.toDate() || new Date()
              return { id: doc.id, ...data, timestamp }
            })
            setComments(commentList.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()).slice(0, 20))
          },
          (error: any) => {
            if (!isMounted) return
            if (error.code === 'permission-denied') {
              console.warn("⚠️ Permission denied for comments listener - this may be normal for anonymous users")
              // Don't show error toast for comments as they're not critical
            } else {
              console.error("❌ Comments listener error:", error)
            }
          }
        )

        console.log("✅ Firestore listeners set up successfully")

      } catch (error) {
        console.error("❌ Failed to set up listeners:", error)
        setConnectionStatus('disconnected')
        setLoading(false)
      }
    }

    // Always set up listeners - they will handle auth permissions appropriately
    setupListeners()

    // Set up spin request listener for organizers
    const spinRequestUnsubscribe = setupSpinRequestListener()

    return () => {
      if (spinRequestUnsubscribe) spinRequestUnsubscribe()
    }

    // 🚨 CRITICAL SAFETY: Clear any local winners on participant mode
    // Participants should NEVER have local winners - only organizer winners from Firebase
    if (!isUserCollaborator && session && session.winners) {
      console.log("🛡️ SAFETY CHECK: Clearing any local winners for participants")
      setSession((prev: any) => prev ? { ...prev, winners: null } : null)
    }

    // Auto-register as viewer/collaborator for ALL users accessing the session
    // CRITICAL FIX: Register ALL non-organizer users, even without explicit participantName
    if (true) { // Always attempt registration for any user accessing the session
      const registerAsViewer = async () => {
        if (!isMounted) return

        // CRITICAL FIX: Determine if this user is the organizer FIRST
        const sessionDoc = await getDoc(doc(db, "liveDrawSessions", sessionId))
        if (!sessionDoc.exists()) {
          console.warn("❌ Session does not exist, cannot register as viewer")
          return
        }

        const sessionData = sessionDoc.data()
        const isActualOrganizer = user && sessionData.createdBy === user.uid
        
        // CRITICAL: Do NOT register organizers as viewers
        if (isActualOrganizer) {
          console.log("🚫 Skipping viewer registration - user is the organizer")
          return
        }

        console.log("🚀 VIEWER REGISTRATION STARTING:", {
          participantName,
          isUserCollaborator,
          user: user ? { uid: user.uid, email: user.email, displayName: user.displayName } : null,
          sessionId,
          isActualOrganizer
        })

        try {
          // Enhanced participant name validation - handle both explicit names and collaborator names
          let validatedName = participantName?.trim()
          if (!validatedName && user) {
            // For collaborators without explicit participantName, use their display name
            validatedName = user.displayName || user.email?.split('@')[0] || 'Collaborator'
          }

          // CRITICAL FIX: Generate fallback name for ALL anonymous/unnamed users
          // This ensures every participant is counted in "Live Participants"
          if (!validatedName) {
            // For anonymous users, generate a unique name with platform info
            const timestamp = Date.now()
            const randomId = Math.random().toString(36).substr(2, 5)
            const platform = typeof navigator !== 'undefined' && navigator?.userAgent?.toLowerCase().includes('mobile') ? 'Mobile' : 'Web'
            validatedName = `${platform} Visitor ${randomId}`
            console.log("📝 Generated fallback name for unnamed participant:", validatedName)
          }

          console.log(`🎯 STARTING REGISTRATION: Name='${validatedName}', SessionId='${sessionId}', Collaborator=${isUserCollaborator}`)

          // Check participant limit before allowing new registrations
          const activeViewersQuery = query(
            collection(db, "liveDrawSessions", sessionId, "viewers"),
            where("isActive", "==", true)
          )
          const activeViewersSnapshot = await getDocs(activeViewersQuery)
          const currentActiveCount = activeViewersSnapshot.size

          // Get session settings to check maxParticipants
          const sessionDoc = await getDoc(doc(db, "liveDrawSessions", sessionId))
          if (sessionDoc.exists()) {
            const sessionData = sessionDoc.data()
            const maxParticipants = sessionData.settings?.maxParticipants || sessionData.maxParticipants || 50

            // Check if adding this participant would exceed the limit
            if (currentActiveCount >= maxParticipants) {
              console.warn(`⚠️ Session is full! Current: ${currentActiveCount}, Max: ${maxParticipants}`)

              // Show user-friendly toast notification instead of alert
              const event = new CustomEvent('showToast', {
                detail: {
                  title: "Session Full",
                  description: `This live session is full! Maximum ${maxParticipants} participants allowed. Currently ${currentActiveCount}/${maxParticipants} participants.`,
                  variant: "destructive"
                }
              })
              window.dispatchEvent(event)

              return
            }

            if (process.env.NODE_ENV === 'development') {
              console.log(`✅ Participant limit check passed: ${currentActiveCount}/${maxParticipants}`)
            }
          }

          // Check if viewerId is provided in URL (from EnhancedStudentJoin)
          const urlParams = new URLSearchParams(window.location.search)
          const existingViewerId = urlParams.get('viewerId')

          if (existingViewerId) {
            // Viewer already registered by EnhancedStudentJoin, just update activity
            console.log(`📋 ${validatedName} already registered with ID: ${existingViewerId}, updating activity...`)
            console.log(`✅ PARTICIPANT FROM /JOIN PAGE: Name="${validatedName}", ViewerId="${existingViewerId}"`)
            const updateData: any = {
              name: validatedName, // Ensure name is updated in case it changed
              lastSeen: serverTimestamp(),
              lastActivity: serverTimestamp(),
              isActive: true,
              isOnline: true,
              role: isUserCollaborator ? 'collaborator' : 'participant' // Track collaborator role
            }

            // Only set userId if we have a valid user
            if (isUserCollaborator && user) {
              updateData.userId = user.uid
            }

            await setDoc(doc(db, "liveDrawSessions", sessionId, "viewers", existingViewerId), updateData, { merge: true })
            if (process.env.NODE_ENV === 'development') {
              console.log(`✅ Updated existing viewer: ${existingViewerId} with name: ${validatedName} (role: ${isUserCollaborator ? 'collaborator' : 'participant'})`)
            }
            return
          }

          // Check if participant is already registered with this name OR as a collaborator
          // ENHANCED: For web participants, also check by platform and connection pattern
          let existingViewersQuery
          
          if (isUserCollaborator && user) {
            // For collaborators, search by user ID
            existingViewersQuery = query(
              collection(db, "liveDrawSessions", sessionId, "viewers"),
              where("userId", "==", user.uid),
              where("isActive", "==", true)
            )
          } else {
            // For regular participants, search by name but be more flexible
            existingViewersQuery = query(
              collection(db, "liveDrawSessions", sessionId, "viewers"),
              where("name", "==", validatedName),
              where("isActive", "==", true)
            )
          }

          console.log(`🔍 Searching for existing viewer: ${isUserCollaborator ? 'by userId' : 'by name'} = ${isUserCollaborator && user ? user.uid : validatedName}`)
          const existingViewersSnapshot = await getDocs(existingViewersQuery)

          if (!existingViewersSnapshot.empty) {
            // Update existing viewer instead of creating duplicate
            const existingViewerDoc = existingViewersSnapshot.docs[0]
            const existingViewerData = existingViewerDoc.data()
            if (process.env.NODE_ENV === 'development') {
              console.log(`📋 Found existing viewer with name: ${validatedName}, updating activity...`)
            }

            const updateData: any = {
              ...existingViewerData,
              lastSeen: serverTimestamp(),
              lastActivity: serverTimestamp(),
              isActive: true,
              isOnline: true,
              platform: (typeof navigator !== 'undefined' && navigator?.userAgent?.toLowerCase().includes('mobile')) ? 'mobile' : 'web',
              role: isUserCollaborator ? 'collaborator' : 'participant' // Track collaborator role
            }

            // Only set userId if we have a valid user
            if (isUserCollaborator && user) {
              updateData.userId = user.uid
            }

            await setDoc(doc(db, "liveDrawSessions", sessionId, "viewers", existingViewerDoc.id), updateData, { merge: true })

            if (process.env.NODE_ENV === 'development') {
              console.log(`✅ Updated existing viewer: ${existingViewerDoc.id} for ${validatedName} (role: ${isUserCollaborator ? 'collaborator' : 'participant'})`)
            }
            return
          }

          // Fallback registration if not coming from EnhancedStudentJoin
          // ENHANCED: Generate more consistent IDs for web participants
          let viewerId: string
          if (isUserCollaborator && user) {
            viewerId = `collab-${user.uid}` // Use consistent ID for collaborators
          } else if (user) {
            // For authenticated users, use their UID
            viewerId = `web-user-${user.uid}`
          } else {
            // For anonymous users, generate a unique ID with session info
            const timestamp = Date.now()
            const randomId = Math.random().toString(36).substr(2, 9)
            viewerId = `web-anon-${sessionId.substr(0, 8)}-${timestamp}-${randomId}`
          }

          const platform = typeof navigator !== 'undefined' && navigator?.userAgent ? (navigator.userAgent.toLowerCase().includes('mobile') ? 'mobile' : 'web') : 'web'

          console.log(`📋 NEW WEB PARTICIPANT REGISTRATION:`, {
            name: validatedName,
            viewerId: viewerId,
            platform: platform,
            role: isUserCollaborator ? 'collaborator' : 'participant',
            hasUser: !!user,
            userEmail: user?.email,
            sessionId: sessionId
          })

          const viewerData: any = {
            name: validatedName,
            joinedAt: serverTimestamp(),
            isActive: true,
            lastSeen: serverTimestamp(),
            platform: platform,
            connectionId: viewerId,
            userAgent: (typeof navigator !== 'undefined' && navigator?.userAgent) || 'Unknown',
            sessionId: sessionId,
            isOnline: true,
            lastActivity: serverTimestamp(),
            role: isUserCollaborator ? 'collaborator' : 'participant' // Track collaborator role
          }

          // Only set userId if we have a valid user
          if (isUserCollaborator && user) {
            viewerData.userId = user.uid
          }

          await setDoc(doc(db, "liveDrawSessions", sessionId, "viewers", viewerId), viewerData)

          console.log(`✅ WEB PARTICIPANT REGISTRATION SUCCESS:`, {
            name: validatedName,
            viewerId: viewerId,
            platform: platform,
            role: viewerData.role,
            firestorePath: `liveDrawSessions/${sessionId}/viewers/${viewerId}`,
            timestamp: new Date().toISOString()
          })
          console.log(`🎉 NEW PARTICIPANT REGISTERED: Name="${validatedName}", ViewerId="${viewerId}", Role="${viewerData.role}"`)
          console.log(`📍 VIEWER REGISTERED IN FIRESTORE PATH: liveDrawSessions/${sessionId}/viewers/${viewerId}`)
          console.log(`📊 VIEWER SHOULD APPEAR IN ORGANIZER'S "Live Participants" LIST`)

          // CRITICAL: Force a small delay to ensure Firestore write completes
          await new Promise(resolve => setTimeout(resolve, 500))

        } catch (error) {
          console.error("❌ Error with viewer registration:", error)
          console.error("Registration details:", {
            participantName: participantName,
            sessionId: sessionId,
            timestamp: new Date().toISOString()
          })
          // Don't block the user experience if viewer registration fails
        }
      }

      registerAsViewer()
    }

    // CRITICAL FIX: Set up heartbeat for ALL active viewers (not just those with participantName)
    // This ensures all participants remain active in the Live Participants list
    heartbeatInterval = setInterval(async () => {
      if (!isMounted) return

      try {
        // ENHANCED: Update last seen for the current participant using their actual viewer ID
        // Use the same ID generation logic as registration for consistency
        let currentViewerId: string
        if (isUserCollaborator && user) {
          currentViewerId = `collab-${user.uid}`
        } else if (user) {
          currentViewerId = `web-user-${user.uid}`
        } else {
          // For anonymous users, we need to find them by name since we can't reproduce their random ID
          console.log("💓 Heartbeat: Searching for anonymous user by active status")
          const activeViewersQuery = query(
            collection(db, "liveDrawSessions", sessionId, "viewers"),
            where("isActive", "==", true),
            where("platform", "==", "web")
          )
          const snapshot = await getDocs(activeViewersQuery)
          
          if (!snapshot.empty) {
            // Update the first active web viewer (assuming it's this user)
            const viewerDoc = snapshot.docs[0]
            await updateDoc(doc(db, "liveDrawSessions", sessionId, "viewers", viewerDoc.id), {
              lastSeen: serverTimestamp(),
              isOnline: true,
              lastActivity: serverTimestamp()
            })
            console.log(`💓 Heartbeat updated for anonymous web viewer: ${viewerDoc.id}`)
          }
          return
        }
        
        // For identified users, update by their specific ID
        console.log(`💓 Heartbeat update for: ${currentViewerId}`)
        await updateDoc(doc(db, "liveDrawSessions", sessionId, "viewers", currentViewerId), {
          lastSeen: serverTimestamp(),
          isOnline: true,
          lastActivity: serverTimestamp()
        })
        console.log(`💓 Heartbeat updated successfully for: ${currentViewerId}`)
      } catch (error) {
        // Silently handle heartbeat errors
        console.warn("💓 Heartbeat update failed:", error)
      }
    }, 30000) // Update every 30 seconds

    return () => {
      isMounted = false
      if (sessionUnsubscribe) sessionUnsubscribe()
      if (reactionsUnsubscribe) reactionsUnsubscribe()
      if (commentsUnsubscribe) commentsUnsubscribe()
      if (heartbeatInterval) clearInterval(heartbeatInterval)
    }
  }, [sessionId, participantName, user, isUserCollaborator])

  // 🚀 INSTANT SPINNER CLEANUP: Ensure spinning state resets on unmount
  useEffect(() => {
    return () => {
      setIsSpinning(false)
      setLastSpinData(null)
    }
  }, [])

  // Wheel animation is now handled by EnhancedWheel component
  const handleWheelAnimation = () => {
    // EnhancedWheel component manages all animations and synchronization
    console.log('🎯 Wheel animation delegated to EnhancedWheel component')
  }

  const sendComment = async () => {
    if (!newComment.trim() || !participantName) return

    try {
      await addDoc(collection(db, "liveDrawSessions", sessionId, "comments"), {
        text: newComment.trim(),
        userName: participantName,
        timestamp: serverTimestamp()
      })
      setNewComment("")
    } catch (error) {
      console.error("Error sending comment:", error)
    }
  }

  const sendReaction = async (emoji: string) => {
    if (!participantName) return

    try {
      await addDoc(collection(db, "liveDrawSessions", sessionId, "reactions"), {
        emoji,
        userId: `viewer-${Date.now()}`,
        userName: participantName,
        timestamp: serverTimestamp()
      })
    } catch (error) {
      console.error("Error sending reaction:", error)
    }
  }

  const leaveLiveRoom = async () => {
    if (!participantName || !sessionId) return

    try {
      // Find the participant's viewer document
      const viewersQuery = isUserCollaborator && user
        ? query(
            collection(db, "liveDrawSessions", sessionId, "viewers"),
            where("userId", "==", user.uid),
            where("isActive", "==", true)
          )
        : query(
            collection(db, "liveDrawSessions", sessionId, "viewers"),
            where("name", "==", participantName),
            where("isActive", "==", true)
          )

      const viewersSnapshot = await getDocs(viewersQuery)

      if (!viewersSnapshot.empty) {
        const viewerDoc = viewersSnapshot.docs[0]

        // Update viewer record to mark as left
        await updateDoc(doc(db, "liveDrawSessions", sessionId, "viewers", viewerDoc.id), {
          isActive: false,
          leftAt: serverTimestamp(),
          lastActivity: serverTimestamp()
        })

        // Send notification to organizer about participant leaving
        await addDoc(collection(db, "liveDrawSessions", sessionId, "notifications"), {
          type: "participant_left",
          participantName: participantName,
          participantId: viewerDoc.id,
          timestamp: serverTimestamp(),
          message: `${participantName} left the live session`
        })

        // Save session to participant's spin history if they are logged in
        if (user && user.uid) {
          try {
            const historyData = {
              activityId: sessionId,
              activityTitle: session?.title || "Live Session",
              winners: (session?.winners || []).map((w: any) => w.name || w),
              participantCount: session?.participants?.length || 0,
              timestamp: serverTimestamp(),
              category: session?.selectedWheelType?.category || session?.wheelCategory || "live-session",
              numberOfWinners: session?.winners?.length || 0,
              spinDuration: 3000, // Default duration for live sessions
              createdBy: user.uid, // Save under participant's account
              isParticipantHistory: true, // Mark as participant history
              roomCode: session?.roomCode,
              sessionDuration: Math.round((new Date().getTime() - (session?.createdAt?.toMillis() || Date.now())) / 1000),
              viewerCount: session?.viewerCount || 0,
              participantRole: isUserCollaborator ? "collaborator" : "participant",
              participantName: participantName
            }

            await addDoc(collection(db, "spinHistory"), historyData)
            console.log(`✅ Saved live session to participant history: ${participantName}`)
          } catch (historyError) {
            console.error("Error saving participant history:", historyError)
            // Don't block the leave process if history saving fails
          }
        }

        console.log(`✅ ${participantName} left the live session`)

        // Navigate to participant dashboard (home page for logged-in users) instead of home
        if (user) {
          // Logged-in user: go to participant dashboard (home page)
          window.location.href = '/'
        } else {
          // Anonymous user: go to home
          window.location.href = '/'
        }
      } else {
        console.warn("Could not find active viewer record to update")
        // Still navigate back
        if (user) {
          window.location.href = '/participant-dashboard'
        } else {
          window.location.href = '/'
        }
      }
    } catch (error) {
      console.error("Error leaving live room:", error)
      // Still navigate back even if there's an error
      if (user) {
        window.location.href = '/participant-dashboard'
      } else {
        window.location.href = '/'
      }
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4" style={{ borderColor: "#8e0b16" }}></div>
          <p className="text-lg text-gray-600">Loading session...</p>
        </div>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <p className="text-gray-600">Session not found</p>
        </div>
      </div>
    )
  }

  const schoolColors = { primary: "#8e0b16", secondary: "#66181E", accent: "#ffffff" }
  const reactionEmojis = [
    { emoji: "👏", label: "Clap" },
    { emoji: "👍", label: "Thumbs Up" },
    { emoji: "❤️", label: "Heart" },
    { emoji: "⭐", label: "Star" },
    { emoji: "🎉", label: "Celebrate" }
  ]

  // 🎨 TRANSFORM THEME: Convert theme object to expected format for components
  // Always provide a fallback theme to prevent white displays
  const transformedTheme = session?.wheelState?.theme ? {
    primary: session.wheelState.theme.primaryColor || session.wheelState.theme.primary || session.wheelState.theme.colors?.[0] || "#8e0b16",
    secondary: session.wheelState.theme.secondary || session.wheelState.theme.colors?.[1] || "#66181E",
    accent: session.wheelState.theme.accent || session.wheelState.theme.colors?.[2] || "#ffffff",
    background: session.wheelState.theme.background || "#ffffff"
  } : {
    primary: "#8e0b16",
    secondary: "#66181E",
    accent: "#ffffff",
    background: "#ffffff"
  }

  // Debug logging for theme changes
  if (process.env.NODE_ENV === 'development') {
    console.log("🎨 PARTICIPANT THEME DEBUG:", {
      hasSessionWheelStateTheme: !!session?.wheelState?.theme,
      themeObject: session?.wheelState?.theme,
      transformedTheme: transformedTheme,
      sessionId: sessionId,
      timestamp: new Date().toISOString()
    })
  }

  // Force wheel re-render when theme or images change
  const wheelKey = `wheel-${sessionId}-${JSON.stringify(transformedTheme)}`

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="flex-1 container mx-auto p-4 space-y-6 max-w-7xl">
        {/* Live Session Header */}
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-4 mb-4">
            <div className="p-4 bg-gradient-to-r from-[#8e0b16] to-[#66181E] rounded-xl shadow-lg">
              <div className="text-5xl">🎯</div>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Live Randomizer Session
              </h1>
              <div className="flex items-center justify-center gap-3 mt-2">
                <Badge className="bg-blue-600 text-white px-4 py-2 text-base font-bold border-2 border-blue-700 shadow-lg">
                  👤 Participant: {participantName || "Participant"}
                </Badge>
              </div>
              <p className="text-lg text-gray-600 mt-2">
                Interactive live session with real-time synchronization
              </p>
            </div>
          </div>

          {/* Status Indicators */}
          <div className="flex justify-center gap-4">
            <div className="flex items-center gap-2 px-4 py-2 bg-green-100 text-green-800 rounded-full border border-green-300">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-sm font-medium">Connected</span>
            </div>
            {session?.currentState === "spinning" && (
              <div className="flex items-center gap-2 px-4 py-2 bg-yellow-100 text-yellow-800 rounded-full border border-yellow-300">
                <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
                <span className="text-sm font-medium">🎯 Wheel Spinning...</span>
              </div>
            )}
            {/* Image Sync Indicator */}
            {imagePickerMode && session?.wheelState?.hasImages && (
              <div className="flex items-center gap-2 px-4 py-2 bg-green-100 text-green-800 rounded-full border border-green-300">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-sm font-medium">🖼️ Images Active</span>
              </div>
            )}
            {session?.currentState === "completed" && (
              <div className="flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-800 rounded-full border border-blue-300">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <span className="text-sm font-medium">🎉 Winner Announced</span>
              </div>
            )}
            {/* Spin Request Indicator for Organizers */}
            {session?.spinRequest && session.spinRequest.status === 'pending' && session && user && (
              session.createdBy === user.uid ||
              session.collaboratorDetails?.some((collab: any) => collab.uid === user.uid) ||
              session.collaborators?.some((c: any) => c?.email && user?.email && c.email === user.email)
            ) && (
              <div className="flex items-center gap-2 px-4 py-2 bg-orange-100 text-orange-800 rounded-full border border-orange-300 animate-pulse">
                <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                <span className="text-sm font-medium">🎯 Spin Requested</span>
              </div>
            )}
          </div>

          {/* Welcome Message */}
          <div className="text-center">
            {isUserCollaborator && (
              <div className="mt-2">
                <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 border border-yellow-300 px-4 py-2 text-base font-bold">
                  🤝 Collaborator Access
                </Badge>
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-4 lg:gap-6 h-full">
          {/* Main Content - Wheel */}
          <div className="lg:col-span-3 flex flex-col min-h-0">
            <Card className="border-2 shadow-xl flex-1 flex flex-col min-h-0" style={{borderColor: '#8e0b16'}}>
              <CardHeader className="bg-gradient-to-r from-[#8e0b16] to-[#66181E] text-white rounded-t-lg p-4 lg:p-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-white/20 rounded-lg">
                    <div className="text-4xl">
                      {session?.selectedWheelType?.icon || session?.wheelIcon || '🎯'}
                    </div>
                  </div>
                  <div>
                    <CardTitle className="text-2xl font-bold flex items-center gap-3">
                      <span>
                        {session?.selectedWheelType?.title || session?.wheelTitle || 'Live Wheel'}
                      </span>
                    </CardTitle>
                    <div className="text-white/90 mt-2 flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                      <span className="text-sm">Synchronized with organizer</span>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col p-4 sm:p-6 lg:p-8 min-h-0">
                {/* Real-time wheel display */}
                <div className="flex-1 flex justify-center items-center min-h-0">
                  <div className="w-full max-w-none h-full flex items-center justify-center">
                    {(() => {
                      // 🎯 wheelTextItems is already memoized at component level for stability
                      // No need to recalculate here - using the memoized value from above

                      // Participant objects for EnhancedWheel participants prop
                      const participantsArray = wheelTextItems.map((text, index) => ({
                        id: `wheel-item-${index}`,
                        name: text,
                        isSelected: true
                      }))

                      console.log("🎯 ParticipantWheelView - EnhancedWheel props:", {
                        participantsCount: participantsArray.length,
                        isSpinning: isSpinning,
                        directSpinningState: isSpinning,
                        sessionSpinningState: session.isSpinning,
                        instantSynchronized: isSpinning && session.isSpinning,
                        timestamp: new Date().toISOString()
                      })

                      // Define necessary variables first
                      const isActualOrganizer = user && session && session.createdBy === user.uid
                      const isCollaboratorBasedOnEmail = session?.collaborators?.includes(user?.email)
                      const collaboratorFromDetails = session?.collaboratorDetails?.find((collab: any) =>
                        collab.uid === user?.uid || collab.email === user?.email
                      )
                      const isFullUserCollaborator = isUserCollaborator || isCollaboratorBasedOnEmail || !!collaboratorFromDetails

                      console.log("🎯 PERMISSION CONTEXT:", {
                        userUid: user?.uid,
                        userEmail: user?.email,
                        sessionCreatedBy: session?.createdBy,
                        isActualOrganizer: isActualOrganizer,
                        isCollaborator: isUserCollaborator,
                        isCollaboratorBasedOnEmail: isCollaboratorBasedOnEmail,
                        collaboratorDetails: collaboratorFromDetails,
                        sessionCollaborators: session?.collaborators
                      })

                      // Determine collaborator permissions from session data - corrected variable name
                      const collaboratorPermissions = collaboratorFromDetails

                      console.log("🎯 COLLABORATOR PERMISSIONS DETECTED:", {
                        isUserCollaborator,
                        isActualOrganizer,
                        collaboratorDetails: session.collaboratorDetails,
                        userUid: user?.uid,
                        userEmail: user?.email,
                        foundPermissions: collaboratorPermissions,
                        sessionCreatedBy: session?.createdBy,
                        isSessionCreator: user && session && user.uid === session.createdBy,
                        // ENHANCED: Detect if current user is invited as a FULL ORGANIZER
                        isFullOrganizerInvite: collaboratorPermissions?.level === 'full' || false,
                        permissionLevel: collaboratorPermissions?.level || (isUserCollaborator ? 'full' : 'viewer'),
                        canControlLive: collaboratorPermissions?.canControlLive || false,
                        canTriggerSynchronizedSpin: collaboratorPermissions?.canTriggerSynchronizedSpin || false
                      })

                      // ENHANCED: Detect if this user is a FULL ORGANIZER (either session creator or invited as full organizer)
                      const isFullOrganizer = isActualOrganizer || (collaboratorPermissions?.level === 'full')
                      const userRole = isFullOrganizer ? 'full' : (collaboratorPermissions?.level || (isUserCollaborator ? 'full' : 'viewer'))
                      const canControlLive = isFullOrganizer || collaboratorPermissions?.canControlLive
                      const canTriggerSynchronizedSpin = isFullOrganizer || collaboratorPermissions?.canTriggerSynchronizedSpin

                      console.log("🎯 FULL ORGANIZER STATUS:", {
                        isActualOrganizer,
                        collaboratorPermissionsLevel: collaboratorPermissions?.level,
                        isFullOrganizer,
                        userRole,
                        canControlLive,
                        canTriggerSynchronizedSpin,
                        reason: isFullOrganizer ? "Session creator or invited as full organizer" : "Limited collaborator permissions"
                      })

                      // Define isOrganizer for use in component props
                      const isOrganizer = isFullOrganizer

                      // Check wheel type and render appropriate component
                      // 🎯 ENHANCED DEBUGGING: Track team data before passing to EnhancedTeamPicker
                      const teamsFromSession = session?.teams || []
                      const teamsFromWheelState = session?.wheelState?.teams || []
                      const finalLiveTeams = teamsFromSession.length > 0 ? teamsFromSession : (teamsFromWheelState.length > 0 ? teamsFromWheelState : [])
                      
                      console.log("🎯 PARTICIPANT: About to render EnhancedTeamPicker with liveTeams", {
                        sessionId: sessionId,
                        teamsFromSession: teamsFromSession,
                        teamsFromSessionLength: teamsFromSession.length,
                        teamsFromWheelState: teamsFromWheelState,
                        teamsFromWheelStateLength: teamsFromWheelState.length,
                        finalLiveTeams: finalLiveTeams,
                        finalLiveTeamsLength: finalLiveTeams.length,
                        sessionTeamsSource: teamsFromSession.length > 0 ? 'session.teams' : (teamsFromWheelState.length > 0 ? 'session.wheelState.teams' : 'none'),
                        timestamp: new Date().toISOString()
                      })
                      
                      if (session.selectedWheelType?.id === 'team-picker' || session.wheelType === 'team-picker') {
                        return (
                          <EnhancedTeamPicker
                            initialNames={participantsArray.map((p: any) => p.name)}
                            canEdit={canControlLive}
                            onTeamsGenerated={(teams) => {
                              console.log("Team picker generated teams:", teams)
                            }}
                            disabled={!canControlLive}
                            readonly={!canControlLive}
                            soloMode={false}
                            isParticipantView={true}
                            sessionId={sessionId}
                            liveTeams={finalLiveTeams} // Use computed teams for better debugging
                          />
                        )
                      } else {
                        console.log("🎯 PARTICIPANT WHEEL DEBUG:", {
                          wheelType: session.selectedWheelType?.id || session.wheelType,
                          isImagePicker: session.selectedWheelType?.id === 'image-picker' || session.wheelType === 'image-picker',
                          wheelItemsCount: participantsArray.length,
                          hasImageSlices: imagePickerInitialSlices.length,
                          imageSlicesWithImages: imagePickerInitialSlices.filter((s: any) => s.image?.url).length,
                          participantsArrayCount: participantsArray.length,
                          sessionId: sessionId,
                          shouldShowImages: shouldShowImages,
                          imagePickerMode: shouldShowImages,
                          // Enhanced debugging for image data
                          participantSliceImagesSize: participantSliceImages.size,
                          participantLoadedImagesSize: participantLoadedImages.size,
                          sessionImageWheelSlices: session?.imageWheelSlices?.length || 0,
                          sessionWheelImages: session?.wheelImages?.length || 0,
                          willUseImagePickerWheel: !!(session.selectedWheelType?.id === 'image-picker' || session.wheelType === 'image-picker')
                        })

                        // 🎯 FIX: Handle image-picker wheels properly for participants
                        // For image-picker wheels, use the image wheel slices as the wheel items
                        const wheelItemsForDisplay = (session.selectedWheelType?.id === 'image-picker' || session.wheelType === 'image-picker')
                          ? imagePickerInitialSlices.map((slice: any) => slice.text || slice.name || 'Slice')
                          : wheelTextItems

                        // 🎯 CRITICAL FIX: For image picker wheels, we need to pass ONLY strings to customItems
                        // The image data should be passed separately via sliceImages prop, not mixed with customItems
                        const wheelItemsWithImages = (session.selectedWheelType?.id === 'image-picker' || session.wheelType === 'image-picker')
                          ? imagePickerInitialSlices.map((slice: any) => slice.text || slice.name || 'Slice') // Only pass strings
                          : wheelTextItems

                        // 🎯 ENHANCED FALLBACK: If we don't have participant image data but session has images,
                        // try to use session data directly as fallback
                        let finalSliceImages = participantSliceImages
                        let finalLoadedImages = participantLoadedImages
                        let finalImagePickerMode = imagePickerMode

                        if (shouldShowImages && participantSliceImages.size === 0 && (session?.imageWheelSlices?.length > 0 || session?.wheelImages?.length > 0)) {
                          console.log("🎯 FALLBACK: Using session image data directly for participant display")

                          // Convert session imageWheelSlices to the expected format
                          const fallbackSliceImages = new Map()
                          const fallbackLoadedImages = new Map()

                          // Try imageWheelSlices format first
                          const imageSource = session.imageWheelSlices && session.imageWheelSlices.length > 0
                            ? session.imageWheelSlices
                            : session.wheelImages || []

                          imageSource.forEach((slice: any) => {
                            if (slice.image?.url) {
                              const sliceKey = slice.id || slice.text || slice.sliceId || `slice-${Date.now()}`
                              fallbackSliceImages.set(sliceKey, {
                                url: slice.image.url,
                                alt: slice.image.alt || `Image for ${slice.text || slice.name || slice.sliceId || 'Slice'}`,
                                isLoaded: slice.image.isLoaded !== false,
                                error: slice.image.error || false
                              })

                              // Create a basic image element for the loaded images map with enhanced error handling
                              const img = new Image()
                              img.crossOrigin = "anonymous"
                              img.onload = () => {
                                console.log("✅ FALLBACK IMAGE LOADED:", sliceKey, slice.image.url)
                                setParticipantLoadedImages(prev => {
                                  const updated = new Map(prev)
                                  updated.set(sliceKey, img)
                                  return updated
                                })
                              }
                              img.onerror = () => {
                                console.warn("❌ FALLBACK IMAGE LOAD FAILED:", sliceKey, slice.image.url)
                                setParticipantLoadedImages(prev => {
                                  const updated = new Map(prev)
                                  updated.set(sliceKey, img)
                                  return updated
                                })
                              }
                              img.src = slice.image.url
                              fallbackLoadedImages.set(sliceKey, img)
                            }
                          })

                          finalSliceImages = fallbackSliceImages
                          finalLoadedImages = fallbackLoadedImages
                          finalImagePickerMode = true

                          // Update participant image states immediately
                          setParticipantSliceImages(fallbackSliceImages)
                          setParticipantLoadedImages(fallbackLoadedImages)
                          setImagePickerMode(true)

                          console.log("✅ FALLBACK IMAGE DATA CREATED AND APPLIED:", {
                            fallbackSliceImagesSize: fallbackSliceImages.size,
                            fallbackLoadedImagesSize: fallbackLoadedImages.size,
                            slicesWithImages: imageSource.filter((s: any) => s.image?.url).length,
                            instantUpdateTriggered: true
                          })
                        }

                        // Force image picker mode if we have images
                        if (shouldShowImages && !imagePickerMode) {
                          console.log("🎨 FORCING IMAGE PICKER MODE ACTIVE for participant")
                          setImagePickerMode(true)
                        }
                  
                        // 🎯 CRITICAL FIX: Force immediate slice recreation when images are detected
                        // This ensures participants see images instantly when organizer adds them
                        if (shouldShowImages && (session?.imageWheelSlices?.length > 0 || session?.wheelImages?.length > 0)) {
                          console.log("🎯 FORCING IMMEDIATE SLICE RECREATION FOR PARTICIPANT IMAGE DISPLAY")
                          // Slice recreation happens automatically via dependency updates
                        }

                        // 🎯 ENHANCED: Use ImagePickerWheel for image-picker wheel type to ensure proper image persistence
                         if (session.selectedWheelType?.id === 'image-picker' || session.wheelType === 'image-picker') {
                           console.log("🎨 PARTICIPANT RENDERING IMAGE PICKER WHEEL - Using ImagePickerWheel component")
                           console.log("🎯 PARTICIPANT IMAGE DEBUG - SLICES DATA:", {
                             imagePickerInitialSlicesCount: imagePickerInitialSlices.length,
                             slicesWithImages: imagePickerInitialSlices.filter((s: any) => s.image?.url).length,
                             participantSliceImagesSize: participantSliceImages.size,
                             participantLoadedImagesSize: participantLoadedImages.size,
                             shouldShowImages: shouldShowImages,
                             instantImageUpdate: instantImageUpdate
                           })

                           return (
                             <ImagePickerWheel
                               key={`image-picker-wheel-${sessionId}-${JSON.stringify(transformedTheme)}-${imagePickerInitialSlices.length}`}
                               slices={imagePickerInitialSlices}
                               onSpinComplete={(result) => {
                                 console.log("🎯 PARTICIPANT ImagePickerWheel spin completed:", result)
                                 // Handle spin completion from participant view
                               }}
                               isLiveMode={true}
                               sessionId={sessionId}
                               disabled={!canControlLive}
                               wheelTitle={session.selectedWheelType?.title || session.wheelTitle || session.title}
                               enableRealTimeSync={true}
                               organizerMode={false} // PARTICIPANT MODE - Force participant mode
                               userPermissions={{
                                 isFullAccessCollaborator: false, // PARTICIPANT MODE - No edit permissions
                                 canTriggerSynchronizedSpin: false, // PARTICIPANT MODE - No spin control
                                 synchronizationEnabled: true, // PARTICIPANT MODE - Enable sync only
                                 sessionId: sessionId,
                                 userRole: 'participant'
                               }}
                               useEnhancedSpinning={false}
                               wheelTheme={transformedTheme}
                             />
                           )
                         }

                        console.log("🎯 RENDERING ENHANCED WHEEL - Non-image-picker wheel type")
                        return (
                          <EnhancedWheel
                            key={`participant-wheel-${sessionId}-${shuffleUpdateKey}`}
                            participants={participantsArray}
                            onSpinComplete={(result) => {
                              console.log("Live wheel spin completed:", result)
                            }}
                            onWinnersDetected={(detectedWinners) => {
                              console.log("🎯 WINNER DETECTION TRIGGERED:", {
                                winnerCount: detectedWinners.length,
                                winners: detectedWinners,
                                userRole: isOrganizer ? 'organizer' : 'participant',
                                sessionId: sessionId,
                                isUserCollaborator: isUserCollaborator
                              })

                              // CRITICAL FIX: Handle winners for both organizers and participants
                              // Organizers can set winners immediately, participants wait for Firebase sync
                              if (isOrganizer || isUserCollaborator) {
                                // Organizers and collaborators can set winners immediately
                                console.log("🎯 ORGANIZER/COLLABORATOR: Setting winners immediately")
                                setSession((prev: any) => prev ? { ...prev, winners: detectedWinners } : { winners: detectedWinners })
                              } else {
                                // Participants: Wait for Firebase synchronization to ensure consistency
                                console.log("🎯 PARTICIPANT: Waiting for Firebase winner synchronization")
                                // The Firebase listener will handle setting winners for participants
                              }
                            }}
                            isLiveMode={true}
                            sessionId={sessionId}
                            disabled={!canControlLive} // 🔧 ENHANCED: Use detailed collaborator permissions
                            wheelTitle={session.selectedWheelType?.title || session.wheelTitle || session.title}
                            selectedWheelType={session.selectedWheelType}
                            studentMode={!canControlLive} // 🔧 ENHANCED: More precise student mode detection
                            enableRealTimeSync={true} // ⚡ CRITICAL: Enable real-time synchronization with organizer
                            organizerMode={isOrganizer} // 🔧 FIX: Use isOrganizer instead of isUserCollaborator for proper organizer mode detection
                            isSpinning={isSpinning} // 🚀 ULTRA-RESPONSIVE: Uses direct Firebase state for instant spinning
                            // 🎨 REAL-TIME THEME SYNC: Pass transformed theme from organizer
                            wheelTheme={transformedTheme}
                            // 📝 REAL-TIME ITEMS SYNC: Override default items with organizer's changes
                            customItems={wheelTextItems}
                            customCongratsMessage={session.settings?.congratsMessage || session.customMessage || ""}
                            customWinnerWord={session.customWinnerWord || "Winner"}
                            // 🎯 ENHANCED: Add detailed collaborator permissions for bidirectional synchronization
                            userPermissions={{
                              isFullAccessCollaborator: userRole === 'full',
                              canTriggerSynchronizedSpin: canTriggerSynchronizedSpin,
                              synchronizationEnabled: canTriggerSynchronizedSpin,
                              sessionId: sessionId,
                              userRole: userRole
                            }}
                            // 🎨 PARTICIPANT IMAGE DATA: Pass participant image data for proper display
                          />
                        )
                      }
                    })()}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar - Request Wheel Changes and Live Comments */}
          <div className="lg:col-span-1 space-y-4 lg:space-y-6 max-h-full overflow-hidden">
            {/* Request Wheel Changes */}
            <Card className="border-2 shadow-lg" style={{borderColor: '#8e0b16'}}>
              <CardHeader className="bg-gradient-to-r from-[#8e0b16] to-[#66181E] text-white rounded-t-lg p-4">
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <span>🎯</span>
                  Request Changes
                </CardTitle>
                <CardDescription className="text-white/80">
                  Suggest wheel type changes or topics to the organizer
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4">
                <div className="space-y-4">
                  {/* Spin Request */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-700">Request Spin</Label>
                    <div className="text-xs text-gray-600 mb-2">
                      Ask the organizer to spin the wheel
                    </div>
                    <Button
                      onClick={handleParticipantSpinRequest}
                      className="w-full bg-[#8e0b16] hover:bg-[#66181E] text-white font-semibold"
                      disabled={!participantName || isSpinning}
                      title={`Request spin with: ${session?.selectedWheelType?.title || 'Current Wheel'}`}
                    >
                      <span className="mr-2">🎯</span>
                      {isSpinning ? "Request Pending..." : "Request Spin"}
                    </Button>
                    {session?.selectedWheelType && (
                      <div className="text-xs text-gray-500 mt-2 p-2 bg-gray-100 rounded">
                        📊 Current: {session.selectedWheelType.title} ({wheelTextItems?.length || 0} items)
                      </div>
                    )}
                  </div>

                  {/* Wheel Type Request */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-700">Request Wheel Type Change</Label>
                    <div className="text-xs text-gray-600 mb-2">
                      Choose a different wheel type for the session
                    </div>
                    <Button
                      onClick={() => {
                        // Send wheel type change request to organizer
                        console.log("🎯 PARTICIPANT: Requesting wheel type change")
                        toast({
                          title: "Request Sent! 🎯",
                          description: "Your wheel type change request has been sent to the organizer",
                        })
                      }}
                      className="w-full bg-[#8e0b16] hover:bg-[#66181E] text-white"
                      disabled={!participantName}
                    >
                      <span className="mr-2">🎯</span>
                      Make a Request
                    </Button>
                  </div>

                  {/* Leave Live Room */}
                  <div className="space-y-2 pt-4 border-t">
                    <Label className="text-sm font-medium text-gray-700">Leave Session</Label>
                    <div className="text-xs text-gray-600 mb-2">
                      Exit the live session and notify the organizer
                    </div>
                    <Button
                      onClick={leaveLiveRoom}
                      className="w-full bg-red-600 hover:bg-red-700 text-white"
                      disabled={!participantName}
                    >
                      <span className="mr-2">🚪</span>
                      Leave Live Room
                    </Button>
                  </div>

                </div>
              </CardContent>
            </Card>

            {/* Live Comments */}
            <Card className="border-2 shadow-lg flex-1 flex flex-col min-h-0" style={{borderColor: '#8e0b16'}}>
              <CardHeader className="bg-gradient-to-r from-[#8e0b16] to-[#66181E] text-white rounded-t-lg p-4">
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <span>💬</span>
                  Live Comments ({comments.length})
                </CardTitle>
                <CardDescription className="text-white/80">
                  Real-time comments from participants
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col p-4 min-h-0">
                <div className="flex-1 flex flex-col space-y-4 min-h-0">
                  {/* Comment Input */}
                  <div className="flex gap-2 flex-shrink-0">
                    <input
                      placeholder="Type a comment..."
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      onKeyPress={(e) => e.key === "Enter" && sendComment()}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#8e0b16] focus:border-transparent"
                    />
                    <button
                      onClick={sendComment}
                      disabled={!newComment.trim()}
                      className="px-4 py-2 bg-[#8e0b16] text-white rounded text-sm hover:bg-[#66181E] disabled:opacity-50 transition-colors"
                    >
                      Send
                    </button>
                  </div>

                  {/* Comments List */}
                  <div className="flex-1 space-y-2 overflow-y-auto min-h-0">
                    {comments.map((comment: any) => (
                      <div key={comment.id} className="p-3 bg-gray-50 rounded-lg border">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-sm text-[#8e0b16]">{comment.userName}</span>
                          <span className="text-xs text-gray-500">
                            {comment.timestamp ? comment.timestamp.toLocaleTimeString() : 'Just now'}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700">{comment.text}</p>
                      </div>
                    ))}
                    {comments.length === 0 && (
                      <div className="text-center py-4 text-gray-500">
                        <div className="text-2xl mb-2">💬</div>
                        <p className="text-sm">No comments yet</p>
                        <p className="text-xs">Be the first to comment!</p>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Enhanced Winner Popup */}
        {session?.winners && session.winners.length > 0 && session.wheelState?.completedAt && showWinnerPopup && (
          <TextWinnerPopup
            isOpen={true}
            onClose={handleWinnerPopupClose}
            winners={session.winners}
            congratsMessage={session.settings?.congratsMessage || session.customMessage || "Congratulations, {name}! 🎉"}
            customWinnerMessage={session.customMessage || ""}
            customWinnerWord={session.customWinnerWord || "Winner"}
            showConfetti={true}
            autoClose={15}
            customTitle={session.title}
            theme={transformedTheme}
          />
        )}

        {/* Footer for mobile - sticky bottom navigation */}
        <div className="sm:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-3">
          <div className="flex items-center justify-center gap-2 text-xs text-gray-600">
            <div className={`w-2 h-2 rounded-full ${
              connectionStatus === 'connected' ? 'bg-green-500 animate-pulse' :
              connectionStatus === 'connecting' ? 'bg-yellow-500 animate-pulse' : 'bg-red-500'
            }`}></div>
            <span>
              {connectionStatus === 'connected' ? 'Live Connected' :
               connectionStatus === 'connecting' ? 'Connecting...' : 'Disconnected'}
            </span>
          </div>
        </div>
      </div>
    </div>
    )
  }

export default function LiveSessionPage() {
    const params = useParams()
    const searchParams = useSearchParams()
    const sessionId = params.sessionId as string

    // 🎯 ENHANCED: Detect collaborative session entry from invitation
    const isCollaborativeEntry = searchParams.get('collaborative') === 'true'
    const invitationId = searchParams.get('invitationId')
    const managerType = searchParams.get('manager') || 'standard'
    const [collaborativeManagerUsed, setCollaborativeManagerUsed] = useState(false)

    // 🔥 CRITICAL FIX: Force web participant registration
    const [forceRegistered, setForceRegistered] = useState(false)

    console.log("🎯 Collaborative Session Detection:", {
      isCollaborativeEntry,
      invitationId,
      managerType,
      sessionId,
      urlSearchParams: Object.fromEntries(searchParams.entries()),
      timestamp: new Date().toISOString()
    })

    // Enhanced name extraction with multiple fallbacks
    const extractParticipantName = () => {
      // Try to get name from URL parameter
      const nameFromUrl = searchParams.get("name")
      if (nameFromUrl && nameFromUrl.trim()) {
        return decodeURIComponent(nameFromUrl.trim())
      }

      // Try alternative parameter names
      const participantName = searchParams.get("participantName")
      if (participantName && participantName.trim()) {
        return decodeURIComponent(participantName.trim())
      }

      const studentName = searchParams.get("studentName")
      if (studentName && studentName.trim()) {
        return decodeURIComponent(studentName.trim())
      }

      // Try to extract from hash if present
      if (typeof window !== 'undefined' && window.location.hash) {
        const hashParams = new URLSearchParams(window.location.hash.substring(1))
        const hashName = hashParams.get("name")
        if (hashName && hashName.trim()) {
          return decodeURIComponent(hashName.trim())
        }
      }

      return undefined
    }

    const studentName = extractParticipantName()
    const platform = searchParams.get("platform") || "web"
    const [user, setUser] = useState<FirebaseUser | null>(null)
    const [loading, setLoading] = useState(true)
    const [isOrganizer, setIsOrganizer] = useState(false)
    const [session, setSession] = useState<any>(null)
    const [authInitialized, setAuthInitialized] = useState(false)
    const [collaborativeInvitationContext, setCollaborativeInvitationContext] = useState<any>(null)
    
    // Session end notification state
    const [showSessionEndPopup, setShowSessionEndPopup] = useState(false)
    const [sessionEndReason, setSessionEndReason] = useState<string>("")

  // If studentName is provided, treat as participant regardless of auth status
  const isParticipantMode = !!studentName

  // REMOVED: Organizer registration as viewer - organizers should not appear in Live Participants
  // Only register actual participants and collaborators, not organizers

  // Debug logging for participant mode detection --enhanced for collaborative
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log("🎯 LiveSessionPage - Enhanced Participant/Collaborative mode detection:", {
        studentName,
        isParticipantMode,
        isCollaborativeEntry,
        invitationId,
        managerType,
        userEmail: user?.email,
        userUid: user?.uid,
        isOrganizer,
        sessionId,
        sessionCreatedBy: session?.createdBy,
        isActualOrganizer: session && user && session.createdBy === user.uid,
        collaborativeManagerUsed: collaborativeManagerUsed,
        timestamp: new Date().toISOString()
      })
    }
  }, [studentName, isParticipantMode, isCollaborativeEntry, invitationId, managerType, user, isOrganizer, session, collaborativeManagerUsed])

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser)
      
      // Wait a moment for auth to fully initialize
      await new Promise(resolve => setTimeout(resolve, 100))
      setAuthInitialized(true)

      // If in participant mode (has studentName), always show participant view
      if (isParticipantMode) {
        setIsOrganizer(false)
        console.log(`👤 Participant mode detected for: ${studentName}`)

        // Get session data for participant view
        try {
          const sessionDoc = await getDoc(doc(db, "liveDrawSessions", sessionId))
          if (sessionDoc.exists()) {
            const sessionData = sessionDoc.data()
            // Check if session is active AND live
            if (sessionData.isActive && sessionData.isLive) {
              setSession({ ...sessionData, id: sessionDoc.id })
              console.log(`✅ Session loaded for participant: ${sessionData.title}`)
            } else {
              console.log("❌ Session has ended or is inactive for participant")
              // Show ended session message
              setSession({ ...sessionData, id: sessionDoc.id, isEnded: true })
            }
          } else {
            console.log("❌ Session not found for participant")
            setSession(null)
          }
        } catch (error) {
          console.log("❌ Error loading session for participant:", error)
          setSession(null)
        }
        setLoading(false)
        return
      }

      // Only check session ownership if user is authenticated and NOT in participant mode
      if (currentUser && sessionId && !isParticipantMode) {
        try {
           // Check if the current user is the creator of the live session
           const sessionDoc = await getDoc(doc(db, "liveDrawSessions", sessionId))
           if (sessionDoc.exists()) {
             const sessionData = sessionDoc.data()

             // Check if current user is actually a session collaborator (from accepted invitation)
             const isCollaborator = sessionData.collaboratorDetails?.some((collab: any) => collab.uid === currentUser.uid) ||
                                   sessionData.collaborators?.some((c: any) => c?.email && currentUser?.email && c.email === currentUser.email)

             // The user who created the session is the organizer, OR if they're a collaborator,
             // they also get organizer privileges (but not marked as "isOrganizer" to distinguish primary from collaborators)
             const isActualOrganizer = sessionData.createdBy === currentUser.uid
             const shouldShowOrganizerView = isActualOrganizer || isCollaborator
             setIsOrganizer(shouldShowOrganizerView)

             // Set session data for both organizer and participant views
             setSession({ ...sessionData, id: sessionDoc.id })

             console.log(`🎯 Authenticated user ${isActualOrganizer ? '(organizer)' : '(collaborator)'}: ${sessionData.title}`)
             if (isCollaborator) {
               console.log(`🤝 User is joining as collaborator: ${currentUser.email}`)
             }
           } else {
             console.log("Session not found, treating as participant")
             setIsOrganizer(false)
             setSession(null)
           }
        } catch (error: any) {
          // Handle permission errors gracefully during auth transitions
          if (error.code === 'permission-denied') {
            console.log("Permission denied during auth transition, treating as participant")
          } else {
            console.log("Error checking session ownership, treating as participant:", error)
          }
          setIsOrganizer(false)

          // Try to get session data anyway for participant view
          try {
            const sessionDoc = await getDoc(doc(db, "liveDrawSessions", sessionId))
            if (sessionDoc.exists()) {
              setSession({ ...sessionDoc.data(), id: sessionDoc.id })
            }
          } catch (secondError) {
            console.log("Could not fetch session for participant view:", secondError)
          }
        }
      } else if (!currentUser && !isParticipantMode) {
        // User not authenticated and not in participant mode, treat as anonymous participant
        setIsOrganizer(false)
        
        // Try to get session data for guest/anonymous participant view
        try {
          const sessionDoc = await getDoc(doc(db, "liveDrawSessions", sessionId))
          if (sessionDoc.exists() && sessionDoc.data().isActive) {
            setSession({ ...sessionDoc.data(), id: sessionDoc.id })
            console.log("👤 Anonymous participant mode:", sessionDoc.data().title)
          } else {
            setSession(null)
          }
        } catch (error) {
          console.log("Could not fetch session for anonymous view:", error)
          setSession(null)
        }
      }

      setLoading(false)
    })

    return () => unsubscribe()
  }, [sessionId, isParticipantMode, studentName])

  // 🔥 CRITICAL FIX: Force registration for ALL web users who are not organizers
  useEffect(() => {
    if (!authInitialized || loading || forceRegistered) return
    
    const forceRegisterWebParticipant = async () => {
      try {
        console.log("🔥 FORCE REGISTRATION CHECK:", {
          user: user ? { uid: user.uid, email: user.email } : "no user",
          isOrganizer,
          session: session ? { id: session.id, createdBy: session.createdBy } : "no session",
          authInitialized,
          loading,
          forceRegistered
        })

        // Only register if we have session data and user is not the organizer
        if (!session || !session.id) {
          console.log("🔥 No session available for force registration")
          return
        }

        const isActualOrganizer = user && session.createdBy === user.uid
        if (isActualOrganizer) {
          console.log("🔥 User is organizer, skipping force registration")
          return
        }

        // Generate participant name
        const participantName = user?.displayName || user?.email?.split('@')[0] || `Web-User-${Date.now()}`
        
        console.log("🔥 FORCE REGISTERING WEB PARTICIPANT:", {
          participantName,
          sessionId: session.id,
          hasUser: !!user,
          userEmail: user?.email
        })

        // Generate viewer ID
        let viewerId: string
        if (user) {
          viewerId = `force-web-${user.uid}`
        } else {
          viewerId = `force-anon-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        }

        const platform = typeof navigator !== 'undefined' && navigator?.userAgent?.toLowerCase().includes('mobile') ? 'mobile' : 'web'

        const viewerData: any = {
          name: participantName,
          joinedAt: serverTimestamp(),
          isActive: true,
          lastSeen: serverTimestamp(),
          platform: platform,
          connectionId: viewerId,
          userAgent: (typeof navigator !== 'undefined' && navigator?.userAgent) || 'Unknown',
          sessionId: session.id,
          isOnline: true,
          lastActivity: serverTimestamp(),
          role: 'participant'
        }

        if (user) {
          viewerData.userId = user.uid
        }

        // Register in Firestore
        await setDoc(doc(db, "liveDrawSessions", session.id, "viewers", viewerId), viewerData)

        console.log("🔥 FORCE REGISTRATION SUCCESS:", {
          name: participantName,
          viewerId: viewerId,
          platform: platform,
          path: `liveDrawSessions/${session.id}/viewers/${viewerId}`
        })

        setForceRegistered(true)

        // Set up heartbeat for force-registered participant
        const heartbeatInterval = setInterval(async () => {
          try {
            await updateDoc(doc(db, "liveDrawSessions", session.id, "viewers", viewerId), {
              lastSeen: serverTimestamp(),
              isOnline: true,
              lastActivity: serverTimestamp()
            })
            console.log("🔥 Force-registered participant heartbeat updated")
          } catch (error) {
            console.warn("🔥 Force-registered participant heartbeat failed:", error)
          }
        }, 30000)

        // Store heartbeat interval for cleanup
        ;(window as any).forceRegisterHeartbeat = heartbeatInterval

      } catch (error) {
        console.error("🔥 FORCE REGISTRATION FAILED:", error)
      }
    }

    // Run force registration with a small delay to ensure everything is ready
    setTimeout(forceRegisterWebParticipant, 1000)
  }, [authInitialized, loading, session, user, isOrganizer, forceRegistered])

  // Calculate collaborator status for cleanup logic
  const isCollaborator = session && user && (
    session.collaboratorDetails?.some((collab: any) => collab.uid === user.uid) ||
    session.collaborators?.some((c: any) => c?.email && user?.email && c.email === user.email)
  )

  // Cleanup force registration heartbeat and mark participant as inactive on leave
  useEffect(() => {
    const handleBeforeUnload = async () => {
      // Mark participant as inactive when leaving
      if (forceRegistered && session?.id) {
        try {
          let viewerId: string
          if (isCollaborator && user) {
            viewerId = `collab-${user.uid}`
          } else if (user) {
            viewerId = `force-web-${user.uid}`
          } else {
            // For anonymous users, we can't easily identify them, so skip cleanup
            return
          }
          
          console.log("👋 WEB PARTICIPANT LEAVING - marking as inactive:", viewerId)
          
          // Get participant name first
          const viewerDoc = await getDoc(doc(db, "liveDrawSessions", session.id, "viewers", viewerId))
          const participantName = viewerDoc.exists() ? viewerDoc.data().name : "Unknown Participant"
          
          // Mark as inactive
          await updateDoc(doc(db, "liveDrawSessions", session.id, "viewers", viewerId), {
            isActive: false,
            isOnline: false,
            leftAt: serverTimestamp()
          })
          
          // Create leave notification for organizer
          await addDoc(collection(db, "liveDrawSessions", session.id, "notifications"), {
            type: 'leave',
            message: `${participantName} has left the live session`,
            userId: viewerId,
            userName: participantName,
            timestamp: serverTimestamp(),
            participantName: participantName,
            platform: 'web',
            reason: 'browser_exit'
          })
          
          console.log(`👋 WEB PARTICIPANT EXIT COMPLETE: ${participantName} marked as left with notification`)
        } catch (error) {
          console.warn("Failed to mark participant as inactive on leave:", error)
        }
      }
    }

    const handleUnload = () => {
      handleBeforeUnload()
    }

    // Add event listeners
    window.addEventListener('beforeunload', handleUnload)
    window.addEventListener('pagehide', handleUnload)
    
    return () => {
      if ((window as any).forceRegisterHeartbeat) {
        clearInterval((window as any).forceRegisterHeartbeat)
        console.log("🔥 Force registration heartbeat cleaned up")
      }
      
      // Mark as inactive when component unmounts
      handleBeforeUnload()
      
      // Remove event listeners
      window.removeEventListener('beforeunload', handleUnload)
      window.removeEventListener('pagehide', handleUnload)
    }
  }, [forceRegistered, session?.id, user, isCollaborator])

  // ENHANCED: Monitor session status for end detection
  useEffect(() => {
    if (!session?.id || !authInitialized) return

    console.log("🔍 Setting up session end monitoring for participants")

    const sessionRef = doc(db, "liveDrawSessions", session.id)
    const unsubscribe = onSnapshot(sessionRef, (snapshot) => {
      if (snapshot.exists()) {
        const sessionData = snapshot.data()
        const isActualOrganizer = user && sessionData.createdBy === user.uid
        
        // Only show popup for participants/collaborators, not the organizer
        if (!isActualOrganizer) {
          // Check if session was ended
          if (sessionData.isActive === false || sessionData.currentState === 'ended') {
            console.log("📢 SESSION ENDED - Showing notification to participant")
            
            setSessionEndReason(
              sessionData.endReason || 
              sessionData.currentState === 'ended' ? "Session completed" : "Session ended by organizer"
            )
            setShowSessionEndPopup(true)
          }
        }
      } else {
        // Session document was deleted
        const isActualOrganizer = user && session.createdBy === user.uid
        if (!isActualOrganizer) {
          console.log("📢 SESSION DELETED - Showing notification to participant")
          setSessionEndReason("Session was deleted by the organizer")
          setShowSessionEndPopup(true)
        }
      }
    }, (error) => {
      console.error("❌ Error monitoring session status:", error)
      // If there's an error accessing the session, it might have been deleted
      const isActualOrganizer = user && session.createdBy === user.uid
      if (!isActualOrganizer) {
        setSessionEndReason("Unable to connect to session")
        setShowSessionEndPopup(true)
      }
    })

    return () => {
      unsubscribe()
      console.log("🧹 Session end monitoring cleaned up")
    }
  }, [session?.id, authInitialized, user])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4" style={{ borderColor: "#8e0b16" }}></div>
          <p className="text-lg text-gray-600">Loading session...</p>
          {isParticipantMode && (
            <p className="text-sm text-gray-500 mt-2">Welcome, {studentName}!</p>
          )}
        </div>
      </div>
    )
  }

  // REMOVE PARTICIPANTS VIEW LIVE ROOM: Show everyone the same unified organizer view
  // Both organizers and participants will see the same interface but with different controls

  // 🎯 DETERMINE IF USER IS THE ACTUAL ORGANIZER (do this first for all routes)
  const isActualOrganizer = session && user && session.createdBy === user.uid

  // If user is authenticated and is the organizer, show the live draw manager
  if (user && isOrganizer && !isParticipantMode) {
    // Debug logging
    if (process.env.NODE_ENV === 'development') {
      console.log("🎯 LiveSessionPage - Passing to LiveDrawManager:", {
        selectedWheelType: session?.selectedWheelType?.id || 'none',
        wheelTitle: session?.wheelTitle,
        sessionLoaded: !!session,
        isActualOrganizer: isActualOrganizer
      })
    }

    return (
      <LiveDrawManager
        user={user}
        activityId={sessionId}
        participants={[]}
        onBack={() => window.location.href = '/'}
        onAddParticipant={() => {}}
        onRealUsersChange={() => {}}
        autoStart={true}
        selectedWheelType={session?.selectedWheelType ? session.selectedWheelType as any : null}
        isActualOrganizer={isActualOrganizer}
      />
    )
  }

  // 🎯 ENHANCED COLLABORATIVE ROUTING: Prioritize collaborative manager for invited organizers
  console.log(`🎯 ENHANCED COLLABORATIVE ROUTING: Routing with collaborative manager priority`)

  const participantName = studentName || user?.displayName || user?.email?.split('@')[0] || "Participant"

  console.log(`🤝 Enhanced User detection for ${participantName}:`, {
    userEmail: user?.email,
    userUid: user?.uid,
    sessionCreatedBy: session?.createdBy,
    isActualOrganizer: isActualOrganizer,
    isCollaborator: isCollaborator,
    isParticipantMode: isParticipantMode,
    isCollaborativeEntry: isCollaborativeEntry,
    invitationId: invitationId,
    managerType: managerType,
    studentName: studentName
  })

  // 🎯 COLLABORATIVE MANAGER PRIORITY: If entering from invitation, ensure collaborative manager is used
  if (isCollaborativeEntry && !isParticipantMode) {
    console.log(`🎯 COLLABORATIVE ENTRY DETECTED: ${participantName} - Routing to enhanced collaborative manager`)
    setCollaborativeManagerUsed(true)

    // Enhanced collaborative context
    const collaborativeContext = {
      isCollaborativeEntry,
      invitationId,
      managerType,
      enteredViaInvitation: true,
      organizerRole: isActualOrganizer ? 'primary' : 'secondary',
      timestamp: new Date().toISOString()
    }

    console.log("🎯 Collaborative Context:", collaborativeContext)
  }

  // 🎯 CRITICAL FIX: Route participants to ParticipantWheelView for collaborative spinning
  // Include anonymous users and any non-organizer users
  if (isParticipantMode || (!user && !isActualOrganizer && !isCollaborator) || (user && !isActualOrganizer && !isCollaborator)) {
    // 🔧 FIX: Ensure participantName always has a value for proper registration
    const effectiveParticipantName: string = participantName || 
      user?.displayName || 
      user?.email?.split('@')[0] || 
      `Web-Participant-${Date.now()}`
    
    console.log(`👥 SHOWING PARTICIPANT VIEW: ${effectiveParticipantName} - using ParticipantWheelView for collaborative experience`, {
      originalParticipantName: participantName,
      effectiveParticipantName,
      hasUser: !!user,
      userEmail: user?.email,
      timestamp: new Date().toISOString()
    })

    return (
      <>
        <ParticipantWheelView
          sessionId={sessionId}
          participantName={effectiveParticipantName}
          session={session}
          user={user || undefined}
          isUserCollaborator={isCollaborator}
        />
        
        {/* Session End Notification Popup for Participants */}
        {showSessionEndPopup && (
          <>
            <style jsx>{`
              @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
              }
              
              @keyframes slideIn {
                from { 
                  opacity: 0;
                  transform: translateY(-50px) scale(0.9);
                }
                to { 
                  opacity: 1;
                  transform: translateY(0) scale(1);
                }
              }
              
              .animate-fadeIn {
                animation: fadeIn 0.3s ease-out;
              }
              
              .animate-slideIn {
                animation: slideIn 0.4s ease-out;
              }
            `}</style>
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 animate-fadeIn">
              <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6 border-2 transform animate-slideIn" style={{ borderColor: '#8e0b16' }}>
                <div className="text-center">
                  {/* Icon */}
                  <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full mb-4 animate-pulse" style={{ backgroundColor: 'rgba(142, 11, 22, 0.1)' }}>
                    <span className="text-3xl">🔚</span>
                  </div>
                  
                  {/* Title */}
                  <h2 className="text-xl font-bold mb-2" style={{ color: '#8e0b16' }}>
                    Session Ended
                  </h2>
                  
                  {/* Message */}
                  <p className="text-gray-600 mb-6 leading-relaxed">
                    {sessionEndReason || "This live session has been ended by the organizer."}
                    {" "}You can return to the dashboard to join other activities or explore more features.
                  </p>
                  
                  {/* Buttons */}
                  <div className="space-y-3">
                    <button
                      onClick={() => {
                        console.log("🏠 Participant navigating to dashboard after session end")
                        window.location.href = '/'
                      }}
                      className="w-full px-4 py-3 text-white rounded-lg font-medium transition-all duration-200 hover:shadow-lg hover:scale-105"
                      style={{ backgroundColor: '#8e0b16' }}
                      onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => { e.currentTarget.style.backgroundColor = '#66181E' }}
                      onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => { e.currentTarget.style.backgroundColor = '#8e0b16' }}
                    >
                      🏠 Go to Dashboard
                    </button>
                    
                    <button
                      onClick={() => {
                        console.log("👀 Participant chose to stay on session page")
                        setShowSessionEndPopup(false)
                      }}
                      className="w-full px-4 py-3 text-gray-600 bg-gray-100 rounded-lg font-medium hover:bg-gray-200 transition-all duration-200"
                    >
                      👀 Stay on Page
                    </button>
                  </div>
                  
                  {/* Additional Info */}
                  <div className="mt-6 p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-500">
                      <strong>Session Info:</strong><br/>
                      Room Code: <span className="font-mono font-bold">{session?.roomCode || 'N/A'}</span> (No longer active)<br/>
                      Ended at: {new Date().toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </>
    )
  }

  // 🎯 ENHANCED ORGANIZER ROUTING: Ensure collaborative manager features are prioritized
  console.log(`🎯 SHOWING ENHANCED ORGANIZER VIEW: ${participantName} - using LiveDrawManager with collaborative manager integration`)

  return (
    <LiveDrawManager
      user={user || { uid: `participant-${Date.now()}`, email: `${studentName || 'anonymous'}@live.session` } as FirebaseUser}
      activityId={sessionId}
      participants={[]}
      onBack={() => window.location.href = '/'}
      onAddParticipant={() => {}}
      onRealUsersChange={() => {}}
      autoStart={true}
      selectedWheelType={session?.selectedWheelType ? session.selectedWheelType as any : null}
      isActualOrganizer={isActualOrganizer}
      isCollaborator={isCollaborator}
    />
  )
}
