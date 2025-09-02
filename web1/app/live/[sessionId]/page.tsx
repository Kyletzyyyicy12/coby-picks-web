"use client"

import { useParams, useSearchParams } from "next/navigation"
import { useState, useEffect, useCallback } from "react"
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
import { EnhancedWheel } from "@/components/randomizer/enhanced-wheel"
import { EnhancedTeamPicker } from "@/components/team/enhanced-team-picker"
import { ParticipantRequestSystem } from "@/components/live/participant-request-system"
import { EnhancedWinnerPopup } from "@/components/shared/enhanced-winner-popup"
import { CollaborativeFeedbackIndicators } from "@/components/live/collaborative-feedback-indicators"
import { Badge } from "@/components/ui/badge"
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
 
    // Stabilize onClose function to prevent infinite re-render loop in Dialog component
    const handleWinnerPopupClose = useCallback(() => {
      console.log("🎯 WINNER POPUP: Participant closed winner announcement popup")
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
        const currentIsSpinning = sessionData.isSpinning || false

        console.log("⚡ INSTANT SPIN DETECTOR:", {
          currentIsSpinning,
          localIsSpinning: isSpinning,
          hasWheelState: !!wheelState,
          sessionId: sessionId,
          timestamp: new Date().toISOString()
        })

        // 🚀 INSTANT SPIN START: Immediate response to spin triggers
        // --- RESET SYNC LOGIC (resetAt) ---
        if (wheelState?.resetAt !== undefined) {
          if (!lastSpinData || lastSpinData.resetAt !== wheelState.resetAt) {
            // The resetAt field changed: force instant reset
            console.log("🔄 RESET SYNC: Detected resetAt change, forcing instant reset", {
              resetAt: wheelState.resetAt,
              prevResetAt: lastSpinData?.resetAt,
              sessionId
            });
            setIsSpinning(false);
            setLastSpinData(wheelState);
            setSession((prev: any) => prev ? { ...prev, winners: [], wheelState: { ...wheelState } } : null);
            // Optionally, trigger a UI update or animation reset here if your wheel component supports it
          }
        }
        // --- END RESET SYNC LOGIC ---
        if (currentIsSpinning && !isSpinning && wheelState) {
          console.log("🎯 INSTANT SPIN TRIGGERED - Starting ultra-fast synchronization")

          // Set spinner state immediately for zero-latency response
          setIsSpinning(true)
          setLastSpinData(wheelState)

          // Show spinning status immediately
          setConnectionStatus('connected')

          console.log("⚡ SPIN SYNCHRONIZED INSTANTLY:", {
            spinDuration: wheelState.spinDuration,
            totalRotation: wheelState.totalRotation,
            finalAngle: wheelState.finalAngle,
            spins: wheelState.spins,
            responseTime: Date.now()
          })
        }

        // 🎯 INSTANT SPIN END: Stop spinning when organizer completes
        if (!currentIsSpinning && isSpinning) {
          console.log("🎯 INSTANT SPIN COMPLETED - Stopping animation")
          setIsSpinning(false)
        }

        // 🏆 ORGANIZER WINNER DETECTION: ONLY use organizer's winners - NEVER calculate locally
        if (wheelState?.winners && wheelState.winners.length > 0) {
          console.log("🎯 ORGANIZER WINNERS RECEIVED - EXACT MATCH GUARANTEED:", {
            winners: wheelState.winners.length,
            winnerNames: (wheelState.winners as Array<{name: string}>).map((w: {name: string}) => w.name),
            completedAt: wheelState.completedAt,
            isOrganizerWinners: true,
            preventsLocalOverride: true,
            sessionId: sessionId
          })

          // CRITICAL: Use only organizer's winners - ignore any local calculations
          setSession((prev: any) => prev ? { ...prev, winners: wheelState.winners } : null)
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
  }, [sessionId, isSpinning])

  // ⚠️ LEGACY: Keep original session listener for other session data
  // 🎯 This handles reactions/comments/participants but NOT spinning (handled above for speed)
  useEffect(() => {
    let isMounted = true
    let sessionUnsubscribe: (() => void) | null = null
    let reactionsUnsubscribe: (() => void) | null = null
    let commentsUnsubscribe: (() => void) | null = null
    let heartbeatInterval: NodeJS.Timeout | null = null

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
 
              // Extract winners from wheelState if they exist, but don't override current winners
              // The EnhancedWheel component manages winner announcement timing independently
              if (data.wheelState?.winners && data.wheelState.winners.length > 0) {
                // Only set winners if we don't already have winners (prevents race condition)
                if (!session.winners || session.winners.length === 0) {
                  updatedSession.winners = data.wheelState.winners
                  console.log("🎯 SESSION LISTENER: Extracted winners from wheelState:", {
                    winnerCount: data.wheelState.winners.length,
                    winners: data.wheelState.winners,
                    sessionId: sessionId
                  })
                } else {
                  console.log("🎯 SESSION LISTENER: Skipping winners update - winners already set by wheel component")
                }
              }

              // Update collaborator status in real-time
              const isCollaborator = determineCollaboratorStatus(updatedSession, user)
              setIsUserCollaborator(isCollaborator)

              // Only update session if it's different to prevent unnecessary re-renders
              setSession((prevSession: any) => {
                if (JSON.stringify(prevSession) !== JSON.stringify(updatedSession)) {
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

    // 🚨 CRITICAL SAFETY: Clear any local winners on participant mode
    // Participants should NEVER have local winners - only organizer winners from Firebase
    if (!isUserCollaborator && session && session.winners) {
      console.log("🛡️ SAFETY CHECK: Clearing any local winners for participants")
      setSession((prev: any) => prev ? { ...prev, winners: null } : null)
    }

    // Auto-register as viewer/collaborator if participantName is provided OR if user is a collaborator and not already registered
    if (participantName || (user && isUserCollaborator)) {
      const registerAsViewer = async () => {
        if (!isMounted) return

        try {
          // Enhanced participant name validation - handle both explicit names and collaborator names
          let validatedName = participantName?.trim()
          if (!validatedName && user) {
            // For collaborators without explicit participantName, use their display name
            validatedName = user.displayName || user.email?.split('@')[0] || 'Collaborator'
          }

          if (!validatedName) {
            console.warn("⚠️ Participant/collaborator name is empty, skipping registration")
            return
          }

          if (process.env.NODE_ENV === 'development') {
            console.log(`🎯 STARTING REGISTRATION: Name='${validatedName}', SessionId='${sessionId}', Collaborator=${isUserCollaborator}`)
          }

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
            if (process.env.NODE_ENV === 'development') {
              console.log(`📋 ${validatedName} already registered with ID: ${existingViewerId}, updating activity...`)
            }
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
          const existingViewersQuery = isUserCollaborator && user
            ? query(
                collection(db, "liveDrawSessions", sessionId, "viewers"),
                where("userId", "==", user.uid),
                where("isActive", "==", true)
              )
            : query(
                collection(db, "liveDrawSessions", sessionId, "viewers"),
                where("name", "==", validatedName),
                where("isActive", "==", true)
              )

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
              platform: navigator.userAgent.toLowerCase().includes('mobile') ? 'mobile' : 'web',
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
          const viewerId = isUserCollaborator && user
            ? `collab-${user.uid}` // Use consistent ID for collaborators
            : `viewer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

          const platform = navigator.userAgent.toLowerCase().includes('mobile') ? 'mobile' : 'web'

          if (process.env.NODE_ENV === 'development') {
            console.log(`📋 Fallback registration for ${validatedName} with ID: ${viewerId} on platform: ${platform} (role: ${isUserCollaborator ? 'collaborator' : 'participant'})`)
          }

          const viewerData: any = {
            name: validatedName,
            joinedAt: serverTimestamp(),
            isActive: true,
            lastSeen: serverTimestamp(),
            platform: platform,
            connectionId: viewerId,
            userAgent: navigator.userAgent,
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

          if (process.env.NODE_ENV === 'development') {
            console.log(`✅ Fallback registration completed for ${validatedName} with data:`, viewerData)
            console.log(`🎉 REGISTRATION SUCCESSFUL: ${validatedName} → ${viewerId} in session ${sessionId}`)
          }

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
    } else {
      console.warn(`⚠️ No participant name provided for session ${sessionId}, skipping auto-registration`)
    }

    // Set up heartbeat for active participants
    if (participantName) {
      heartbeatInterval = setInterval(async () => {
        if (!isMounted) return

        try {
          // Update last seen for active viewers
          const activeViewersQuery = query(
            collection(db, "liveDrawSessions", sessionId, "viewers"),
            where("isActive", "==", true),
            where("name", "==", participantName)
          )
          const snapshot = await getDocs(activeViewersQuery)

          if (!snapshot.empty) {
            const viewerDoc = snapshot.docs[0]
            await updateDoc(doc(db, "liveDrawSessions", sessionId, "viewers", viewerDoc.id), {
              lastSeen: serverTimestamp(),
              isOnline: true
            })
          }
        } catch (error) {
          // Silently handle heartbeat errors
          console.warn("Heartbeat update failed:", error)
        }
      }, 30000) // Update every 30 seconds
    }

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

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto p-4 space-y-4 sm:space-y-6 max-w-4xl">
        {/* Page Header */}
        <div className="text-center py-4">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
            🎯 Live Randomizer Session
          </h1>
          <p className="text-sm sm:text-base text-gray-600">
            {session?.title || 'Watch the live wheel spinning experience'}
          </p>
          {isUserCollaborator && (
            <div className="mt-2">
              <Badge variant="secondary" className="bg-blue-100 text-blue-700 border border-blue-300">
                🤝 You're a Collaborator - Enhanced Permissions
              </Badge>
            </div>
          )}
        </div>
        {/* Header */}
        <div className="text-center space-y-3">
          <h1 className="text-3xl font-bold" style={{ color: schoolColors.primary }}>
            {session.title}
          </h1>

          {/* Collaborative Feedback Indicators */}
          <div className="flex justify-center">
            <CollaborativeFeedbackIndicators
              sessionId={sessionId}
              currentUserId={user?.uid || `participant-${participantName}`}
              isOrganizer={false}
              participants={[]} // Pass actual participant data
              syncStatus="synced"
              showDetailed={false} // Compact view for header
            />
          </div>

          {/* Selected Wheel Type in Header */}
          {session.selectedWheelType && (
            <div className="inline-flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-blue-100 to-indigo-100 border-2 border-blue-300 rounded-full shadow-lg">
              <div className="text-2xl">{session.selectedWheelType.icon}</div>
              <div className="text-left">
                <h2 className="text-lg font-bold text-blue-900">
                  {session.selectedWheelType.title}
                </h2>
                <p className="text-sm text-blue-700">
                  {session.selectedWheelType.category} • {session.selectedWheelType.defaultItems?.length || 0} items
                </p>
              </div>
            </div>
          )}

          {session.wheelTitle && !session.selectedWheelType && (
            <h2 className="text-xl font-semibold text-gray-700">
              {session.wheelTitle}
            </h2>
          )}
          {session.wheelType && !session.selectedWheelType && (
            <p className="text-sm text-gray-500">
              Wheel Type: {session.wheelType}
            </p>
          )}
          <p className="text-gray-600">Welcome, {participantName || "Participant"}!</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content - Wheel */}
          <div className="lg:col-span-2">
            {/* Selected Wheel Type Display - Prominent */}
            {session.selectedWheelType && (
              <div className="mb-6 p-6 bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-300 rounded-xl shadow-lg">
                <div className="flex items-center gap-4 mb-3">
                  <div className="text-4xl p-3 bg-white rounded-lg shadow-sm">{session.selectedWheelType.icon}</div>
                  <div className="flex-1">
                    <h3 className="text-2xl font-bold text-blue-900 mb-1">{session.selectedWheelType.title}</h3>
                    <p className="text-base text-blue-700 font-medium">{session.selectedWheelType.description}</p>
                  </div>
                </div>
                <div className="bg-white/60 p-3 rounded-lg border border-blue-200">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-semibold text-blue-800">Category:</span>
                      <span className="ml-2 text-blue-700">{session.selectedWheelType.category}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-blue-800">Items:</span>
                      <span className="ml-2 text-blue-700">{session.selectedWheelType.defaultItems?.length || 0} loaded</span>
                    </div>
                  </div>
                  <p className="text-xs text-blue-600 mt-2 font-medium">
                    🎯 This wheel type was selected by the organizer for this live session
                  </p>
                  {/* Show sample items */}
                  {session.selectedWheelType.defaultItems && session.selectedWheelType.defaultItems.length > 0 && (
                    <div className="mt-3">
                      <p className="text-xs font-semibold text-blue-800 mb-1">Sample Items:</p>
                      <div className="flex flex-wrap gap-1">
                        {session.selectedWheelType.defaultItems.slice(0, 5).map((item: string, index: number) => (
                          <span key={index} className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                            {item}
                          </span>
                        ))}
                        {session.selectedWheelType.defaultItems.length > 5 && (
                          <span className="text-xs text-blue-600 px-2 py-1">
                            +{session.selectedWheelType.defaultItems.length - 5} more
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="bg-white rounded-lg border-2 p-6" style={{ borderColor: schoolColors.primary }}>
              {/* Real-time wheel display - Always show the wheel */}
              <div className="space-y-4">

                {/* Session Status Badge */}
                <div className="flex items-center justify-center mb-4">
                  {session.currentState === "waiting" && (
                    <div className="flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-800 rounded-full border border-blue-300">
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                      <span className="text-sm font-medium">Organizer is preparing the wheel...</span>
                    </div>
                  )}
                  {session.currentState === "spinning" && (
                    <div className="flex items-center gap-2 px-4 py-2 bg-yellow-100 text-yellow-800 rounded-full border border-yellow-300">
                      <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
                      <span className="text-sm font-medium">🎯 Wheel is spinning...</span>
                    </div>
                  )}
                  {session.currentState === "completed" && (
                    <div className="flex items-center gap-2 px-4 py-2 bg-green-100 text-green-800 rounded-full border border-green-300">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-sm font-medium">🎉 Results are ready!</span>
                    </div>
                  )}
                </div>

                {/* Render Team Picker for team-picker wheel type, otherwise use regular wheel */}
                {(session.selectedWheelType?.id === 'team-picker' || session.wheelType === 'team-picker') ? (
                  <div className="bg-white rounded-lg p-4 border-2 border-blue-200">
                    <div className="text-center mb-4">
                      <h3 className="text-lg font-semibold text-blue-900 mb-2">
                        👥 Team Picker Wheel
                      </h3>
                      <p className="text-sm text-blue-700">
                        The organizer is using Team Picker to generate random teams
                      </p>
                    </div>
                    <EnhancedTeamPicker
                      initialNames={session.selectedWheelType?.defaultItems || session.participants?.map((p: any) => p.name) || []}
                      canEdit={false}
                      disabled={true}
                      readonly={true}
                      onTeamsGenerated={(teams) => {
                        console.log("Participant view: Teams generated by organizer:", teams)
                      }}
                    />
                    <div className="mt-3 text-center text-xs text-blue-600">
                      🎯 Synchronized with organizer's team generation
                    </div>
                  </div>
                ) : (
                  /* 🚀 PERFECT SYNCHRONIZATION: EnhancedWheel handles ALL wheel operations */
                  (() => {
                    // Debug participants array construction
                    let participantsArray = []

                    if (session.selectedWheelType?.defaultItems && session.selectedWheelType.defaultItems.length > 0) {
                      participantsArray = session.selectedWheelType.defaultItems.map((item: string, index: number) => ({
                        id: `wheel-item-${index}`,
                        name: item,
                        email: undefined,
                        isSelected: true
                      }))
                      console.log("🎯 Using selectedWheelType items:", participantsArray.length)
                    } else if (session.participants && session.participants.length > 0) {
                      participantsArray = session.participants.map((p: any) => ({
                        id: p.id,
                        name: p.name,
                        email: p.email,
                        isSelected: true
                      }))
                      console.log("🎯 Using session participants:", participantsArray.length)
                    } else {
                      // Fallback: Create default items if nothing else is available
                      participantsArray = [
                        { id: 'fallback-1', name: 'Option 1', email: undefined, isSelected: true },
                        { id: 'fallback-2', name: 'Option 2', email: undefined, isSelected: true },
                        { id: 'fallback-3', name: 'Option 3', email: undefined, isSelected: true }
                      ]
                      console.log("🎯 Using fallback items - no wheel data available")
                    }

                    console.log("🎯 ParticipantWheelView - ULTRA-RESPONSIVE EnhancedWheel props:", {
                      participantsCount: participantsArray.length,
                      isSpinning: isSpinning,
                      directSpinningState: isSpinning,
                      sessionSpinningState: session.isSpinning,
                      instantSynchronized: isSpinning && session.isSpinning,
                      timestamp: new Date().toISOString()
                    })

                    return (
                      <EnhancedWheel
                        participants={participantsArray}
                        onSpinComplete={(result) => {
                          console.log("Live wheel spin completed:", result)
                        }}
                        onWinnersDetected={(detectedWinners) => {
                          // 🚫 DISABLED FOR PARTICIPANTS: Local winner calculations disabled
                          // Participants ONLY use organizers winners from Firebase
                          console.log("🎯 PARTICIPANT WHEEL: Local winner calculation received", {
                            winnerCount: detectedWinners.length,
                            winners: detectedWinners,
                            action: "IGNORED - Using organizer winners only",
                            sessionId: sessionId,
                            isParticipant: !isUserCollaborator
                          })

                          // Participants ignore local winner calculations - wait for organizer winners
                          if (isUserCollaborator) {
                            // Only organizers use local calculations
                            setSession((prev: any) => prev ? { ...prev, winners: detectedWinners } : null)
                          }
                          // Participants get winners from Firebase listener only
                        }}
                        isLiveMode={true}
                        sessionId={sessionId}
                        disabled={!isUserCollaborator} // 🔧 FIX: Collaborators can control, regular participants watch only
                        wheelTitle={session.selectedWheelType?.title || session.wheelTitle || session.title}
                        selectedWheelType={session.selectedWheelType}
                        studentMode={!isUserCollaborator} // 🔧 FIX: Collaborators get full mode, participants get student mode
                        enableRealTimeSync={true} // ⚡ CRITICAL: Enable real-time synchronization with organizer
                        organizerMode={isUserCollaborator} // 🔧 FIX: Collaborators get organizer mode for real-time sync
                        isSpinning={isSpinning} // 🚀 ULTRA-RESPONSIVE: Uses direct Firebase state for instant spinning
                      />
                    )
                  })()
                )}


                {/* Real-time wheel type change notification */}
                {session.selectedWheelType && (
                  <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="flex items-center gap-2 text-blue-800">
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                      <span className="text-sm font-medium">
                        🔄 Synchronized with organizer's wheel: {session.selectedWheelType.title}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Reaction Buttons */}
              {session.settings?.allowReactions && (
                <div className="mt-6">
                  <p className="text-sm text-gray-600 mb-3">Send a reaction:</p>
                  <div className="flex justify-center gap-3 flex-wrap">
                    {reactionEmojis.map(({ emoji, label }) => (
                      <button
                        key={emoji}
                        onClick={() => sendReaction(emoji)}
                        className="text-2xl hover:scale-110 transition-transform p-2 rounded border hover:bg-gray-50"
                        title={label}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar - Requests, Reactions, and Comments */}
          <div className="space-y-4">
            {/* Participant Request System - Only show for participants */}
            {participantName && (
              <div className="bg-white rounded-lg border p-4">
                <h3 className="font-semibold mb-3" style={{ color: schoolColors.primary }}>
                  📝 Request Wheel Changes
                </h3>
                <ParticipantRequestSystem
                  sessionId={sessionId}
                  participantId={participantName ? `participant-${participantName.toLowerCase().replace(/\s+/g, '-')}` : 'anonymous'}
                  participantName={participantName}
                  isOrganizer={false}
                  availableWheelTypes={PICKER_WHEEL_TYPES}
                />
              </div>
            )}

            {/* Recent Reactions */}
            {reactions.length > 0 && (
              <div className="bg-white rounded-lg border p-4">
                <h3 className="font-semibold mb-3" style={{ color: schoolColors.primary }}>
                  Recent Reactions
                </h3>
                <div className="flex gap-2 flex-wrap">
                  {reactions.slice(0, 12).map((reaction: any) => (
                    <div
                      key={reaction.id}
                      className="text-2xl animate-bounce"
                      title={`${reaction.userName} reacted`}
                      style={{ animationDelay: `${Math.random() * 2}s` }}
                    >
                      {reaction.emoji}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Comments */}
            <div className="bg-white rounded-lg border p-4">
              <h3 className="font-semibold mb-3" style={{ color: schoolColors.primary }}>
                Live Comments
              </h3>
              <div className="space-y-4">
                {/* Comment Input */}
                <div className="flex gap-2">
                  <input
                    placeholder="Type a comment..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && sendComment()}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm"
                  />
                  <button
                    onClick={sendComment}
                    disabled={!newComment.trim()}
                    className="px-4 py-2 bg-[#8e0b16] text-white rounded text-sm hover:bg-[#66181E] disabled:opacity-50"
                  >
                    Send
                  </button>
                </div>

                {/* Comments List */}
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {comments.map((comment: any) => (
                    <div key={comment.id} className="p-2 bg-gray-50 rounded">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm">{comment.userName}</span>
                        <span className="text-xs text-gray-500">
                          {comment.timestamp ? comment.timestamp.toLocaleTimeString() : 'Just now'}
                        </span>
                      </div>
                      <p className="text-sm">{comment.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 🎯 ORGANIZER-DRIVEN WINNER ANNOUNCEMENT ONLY - NO LOCAL CALCULATIONS */}
      {session?.winners && session.winners.length > 0 && (
        <>
          {console.log("🎯 WINNER ANNOUNCEMENT - ORGANIZER SYNCHRONIZED:", {
            winnerCount: session.winners.length,
            winnerNames: (session.winners as Array<{name: string}>).map((w: {name: string}) => w.name),
            source: "Organizer's Firebase winners only",
            participantsLocalCalculations: "DISABLED",
            proofOfExactMatch: "All participants see identical winners",
            organizerDependent: "Only shows when organizer spins",
            sessionId: sessionId,
            sessionTitle: session.title,
            timestamp: new Date().toISOString()
          })}
          <EnhancedWinnerPopup
            isOpen={true}
            onClose={handleWinnerPopupClose}
            winners={session.winners}
            congratsMessage={session.settings?.congratsMessage || "Congratulations, {name}! 🎉"}
            customWinnerMessage="🎊 Congratulations! 🎊"
            customWinnerWord="Winner"
            showConfetti={true}
            autoClose={15} // Auto-close after 15 seconds for participants (increased from 8)
            customTitle={session.title}
          />
        </>
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
  )
}

export default function LiveSessionPage() {
   const params = useParams()
   const searchParams = useSearchParams()
   const sessionId = params.sessionId as string
   
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

  // If studentName is provided, treat as participant regardless of auth status
  const isParticipantMode = !!studentName

  // Debug logging for participant mode detection
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log("🎯 LiveSessionPage - Participant mode detection:", {
        studentName,
        isParticipantMode,
        userEmail: user?.email,
        userUid: user?.uid,
        isOrganizer,
        sessionId,
        sessionCreatedBy: session?.createdBy,
        isActualOrganizer: session && user && session.createdBy === user.uid
      })
    }
  }, [studentName, isParticipantMode, user, isOrganizer, session])

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
                                   sessionData.collaborators?.includes(currentUser.email)

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

  // If user is authenticated and is the organizer, show the live draw manager
  if (user && isOrganizer && !isParticipantMode) {
    // Debug logging
    if (process.env.NODE_ENV === 'development') {
      console.log("🎯 LiveSessionPage - Passing to LiveDrawManager:", {
        selectedWheelType: session?.selectedWheelType?.id || 'none',
        wheelTitle: session?.wheelTitle,
        sessionLoaded: !!session
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
      />
    )
  }

  // 🎯 ENHANCED COLLABORATIVE ROUTING: Show ParticipantWheelView for proper collaborative experience
  console.log(`🎯 COLLABORATIVE ROUTING: Routing to appropriate view`)

  const participantName = studentName || user?.displayName || user?.email?.split('@')[0] || "Participant"
  const isCollaborator = session && user && (
    session.collaboratorDetails?.some((collab: any) => collab.uid === user.uid) ||
    session.collaborators?.includes(user.email)
  )
  const isActualOrganizer = session && user && session.createdBy === user.uid

  console.log(`🤝 User detection for ${participantName}:`, {
    userEmail: user?.email,
    userUid: user?.uid,
    sessionCreatedBy: session?.createdBy,
    isActualOrganizer: isActualOrganizer,
    isCollaborator: isCollaborator,
    isParticipantMode: isParticipantMode,
    studentName: studentName
  })

  // 🎯 CRITICAL FIX: Route participants to ParticipantWheelView for collaborative spinning
  if (isParticipantMode || (!user && !isActualOrganizer && !isCollaborator)) {
    console.log(`👥 SHOWING PARTICIPANT VIEW: ${participantName} - using ParticipantWheelView for collaborative experience`)

    return (
      <ParticipantWheelView
        sessionId={sessionId}
        participantName={participantName}
        session={session}
        user={user || undefined}
        isUserCollaborator={isCollaborator}
      />
    )
  }

  // Organizer/Collaborator view
  console.log(`🎯 SHOWING ORGANIZER VIEW: ${participantName} - using LiveDrawManager for controls`)

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
      // PASS PARTICIPANT CONTEXT so LiveDrawManager knows this is a participant
      participantMode={isParticipantMode}
      participantName={participantName}
      isCollaborator={isCollaborator}
      isActualOrganizer={isActualOrganizer}
    />
  )
}
