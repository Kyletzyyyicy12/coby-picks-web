"use client"

import { useState, useEffect } from 'react'
import { ImageWheelSlice, WinnerResult } from '@/types/image-wheel-types'
import { toast } from "@/hooks/use-toast"

// Utility function to clean Firebase data - remove undefined values
function cleanFirebaseData(data: any): any {
  if (data === null || data === undefined) return null
  if (typeof data !== 'object') return data

  if (Array.isArray(data)) {
    return data.map(cleanFirebaseData).filter(item => item !== undefined)
  }

  const cleaned: any = {}
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      cleaned[key] = cleanFirebaseData(value)
    }
  }
  return cleaned
}

interface UseRealtimeSyncProps {
  enableRealTimeSync: boolean
  sessionId?: string
  organizerMode: boolean
  slices: ImageWheelSlice[]
  onSlicesChange: (slices: ImageWheelSlice[]) => void
  onSpinStart?: () => void
  onSpinComplete?: (winner: WinnerResult) => void
}

export function useRealtimeSync({
  enableRealTimeSync,
  sessionId,
  organizerMode,
  slices,
  onSlicesChange,
  onSpinStart,
  onSpinComplete
}: UseRealtimeSyncProps) {
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'connecting'>('disconnected')
  const [syncedSpinning, setSyncedSpinning] = useState(false)

  // Listen for real-time updates from Firebase
  useEffect(() => {
    if (!enableRealTimeSync || !sessionId) return

    const { doc, onSnapshot } = require('firebase/firestore')
    const { db } = require('@/lib/firebase')

    console.log('🖼️ ImagePickerWheel: Setting up real-time synchronization')
    setConnectionStatus('connecting')

    const unsubscribe = onSnapshot(
      doc(db, "liveDrawSessions", sessionId),
      (docSnapshot: { exists: () => boolean; data: () => any }) => {
        if (docSnapshot.exists()) {
          const data = docSnapshot.data()
          setConnectionStatus('connected')

          // Handle real-time image wheel slice updates from organizer
          if (data.imageWheelSlices && Array.isArray(data.imageWheelSlices) && !organizerMode) {
            console.log('🎨 PARTICIPANT: Received image wheel slices update:', {
              sliceCount: data.imageWheelSlices.length,
              hasImages: data.imageWheelSlices.filter((s: any) => s.image?.url).length,
              priority: data.imageWheelSync?.priority
            })

            onSlicesChange(data.imageWheelSlices)

            // Show notification to participant about image wheel update
            if (data.imageWheelSync?.priority === 'immediate') {
              const hasImages = data.imageWheelSlices.filter((s: any) => s.image?.url).length
              toast({
                title: "🆼️ Image Wheel Updated!",
                description: `Organizer updated ${data.imageWheelSlices.length} slices (${hasImages} with images)`,
                duration: 5000,
              })
            }
          }

          // Handle real-time spinning state for image wheel
          if (data.wheelState && data.selectedWheelType?.id === 'image-picker') {
            const wheelState = data.wheelState

            if (wheelState.isSpinning && !syncedSpinning && !organizerMode) {
              console.log('⚡ PARTICIPANT: Image wheel spinning started!')
              setSyncedSpinning(true)
              onSpinStart?.()

              // Simulate synchronized spinning animation
              const spinStartTime = wheelState.spinStartTime || Date.now()
              const spinDuration = wheelState.duration || 3000
              const totalRotation = wheelState.totalRotation || (1440 + Math.random() * 720)

              // Animation will be handled by the parent component
              setTimeout(() => {
                setSyncedSpinning(false)
                if (data.winners && data.winners.length > 0) {
                  handleSpinComplete(data.winners[0], wheelState, data)
                }
              }, spinDuration)

            } else if (!wheelState.isSpinning && syncedSpinning && !organizerMode) {
              console.log('🏁 PARTICIPANT: Image wheel spinning completed')
              setSyncedSpinning(false)

              if (data.winners && data.winners.length > 0) {
                handleSpinComplete(data.winners[0], wheelState, data)
              }
            }
          }
        } else {
          setConnectionStatus('disconnected')
        }
      },
      (error: Error) => {
        console.error('❌ Image wheel real-time listener error:', error)
        setConnectionStatus('disconnected')
      }
    )

    return () => {
      console.log('🔄 Cleaning up image wheel real-time listener')
      unsubscribe()
    }
  }, [enableRealTimeSync, sessionId, organizerMode, syncedSpinning, onSlicesChange, onSpinStart])

  // Broadcast slice changes to participants (organizer only)
  useEffect(() => {
    if (enableRealTimeSync && sessionId && organizerMode && slices.length > 0) {
      const { doc, updateDoc, serverTimestamp } = require('firebase/firestore')
      const { db } = require('@/lib/firebase')

      const broadcastSlices = async () => {
        try {
          console.log('🌐 Broadcasting image wheel slices to participants:', {
            sliceCount: slices.length,
            withImages: slices.filter(s => s.image?.url).length
          })

          const updateData = {
            imageWheelSlices: slices,
            imageWheelUpdatedAt: serverTimestamp(),
            imageWheelUpdatedBy: 'organizer',
            lastUpdated: serverTimestamp(),

            // Priority sync flags for immediate participant update
            imageWheelSync: {
              sliceCount: slices.length,
              withImages: slices.filter(s => s.image?.url).length,
              updatedAt: Date.now(),
              priority: "immediate",
              syncVersion: Date.now()
            },

            // Sync heartbeat for immediate participant response
            syncHeartbeat: Date.now(),
            participantSync: "immediate"
          }

          await updateDoc(doc(db, "liveDrawSessions", sessionId), cleanFirebaseData(updateData))

        } catch (error: unknown) {
          console.error('❌ Failed to broadcast image wheel slices:', error)
        }
      }

      // Debounce the broadcast to avoid too many updates
      const timeoutId = setTimeout(broadcastSlices, 500)
      return () => clearTimeout(timeoutId)
    }
  }, [slices, enableRealTimeSync, sessionId, organizerMode])

  const handleSpinComplete = (winnerData: any, wheelState: any, sessionData: any) => {
    const winnerSlice = slices.find(s => s.id === winnerData.id) || {
      id: winnerData.id,
      text: winnerData.name,
      color: '#FFD700',
      image: winnerData.image
    }

    const result: WinnerResult = {
      slice: winnerSlice,
      angle: wheelState.finalAngle || 0,
      timestamp: new Date(),
      spinDuration: wheelState.spinDuration || 3000,
      showConfetti: true,
      showWinnerImage: Boolean(winnerSlice.image?.url)
    }

    onSpinComplete?.(result)

    toast({
      title: "🏆 Image Winner Selected!",
      description: `${winnerSlice.text} has been selected!`
    })
  }

  const broadcastSpinStart = async (spinData: {
    spinStartTime: number
    duration: number
    totalRotation: number
    finalRotation: number
  }) => {
    if (!enableRealTimeSync || !sessionId || !organizerMode) return

    try {
      const { doc, updateDoc, serverTimestamp } = require('firebase/firestore')
      const { db } = require('@/lib/firebase')

      await updateDoc(doc(db, "liveDrawSessions", sessionId), cleanFirebaseData({
        currentState: "spinning",
        isSpinning: true,
        wheelState: {
          isSpinning: true,
          spinStartTime: spinData.spinStartTime,
          spinDuration: spinData.duration,
          totalRotation: spinData.totalRotation,
          finalAngle: spinData.finalRotation % 360,
          currentAngle: 0,
          progress: 0,
          startedAt: serverTimestamp(),
          syncVersion: Date.now(),
          instantStart: true,
          participantSync: "immediate",
          wheelType: "image-picker"
        },
        spinningNotification: {
          message: "🖼️ IMAGE WHEEL SPINNING NOW! Watch the images!",
          timestamp: serverTimestamp(),
          isActive: true,
          priority: "immediate",
          duration: spinData.duration
        },
        lastUpdated: serverTimestamp(),
        syncHeartbeat: Date.now(),
        broadcastTime: Date.now()
      }))

      toast({
        title: "🖼️ Image Wheel Started Spinning!",
        description: "All participants can now see the image wheel spinning in real-time",
        duration: 3000,
      })
    } catch (error: unknown) {
      console.error("❌ Failed to initiate image wheel broadcast:", error)
    }
  }

  const broadcastSpinComplete = async (winner: WinnerResult, finalRotation: number) => {
    if (!enableRealTimeSync || !sessionId || !organizerMode) return

    try {
      const { doc, updateDoc, serverTimestamp } = require('firebase/firestore')
      const { db } = require('@/lib/firebase')

      await updateDoc(doc(db, "liveDrawSessions", sessionId), {
        currentState: "waiting",
        isSpinning: false,
        winners: [{
          id: winner.slice.id,
          name: winner.slice.text,
          image: winner.slice.image,
          color: winner.slice.color
        }],
        wheelState: {
          isSpinning: false,
          currentAngle: finalRotation || 0,
          finalAngle: winner.angle,
          progress: 1,
          winners: [winner.slice],
          completedAt: serverTimestamp(),
          spinId: winner.timestamp.getTime().toString(),
          instantResults: true,
          participantSync: "immediate",
          resultsReady: true,
          zeroDelay: true,
          wheelType: "image-picker"
        },
        resultNotification: {
          message: `🖼️ IMAGE WINNER: ${winner.slice.text}!`,
          winners: [winner.slice],
          timestamp: serverTimestamp(),
          isActive: true,
          showConfetti: true,
          priority: "immediate",
          zeroDelay: true,
          hasImage: Boolean(winner.slice.image?.url)
        },
        lastUpdated: serverTimestamp(),
        syncHeartbeat: Date.now(),
        winnerBroadcastTime: Date.now()
      })
    } catch (error: unknown) {
      console.error("❌ Failed to broadcast image wheel winner:", error)
    }
  }

  const broadcastSpinProgress = async (progress: number, currentAngle: number, elapsed: number, duration: number) => {
    if (!enableRealTimeSync || !sessionId || !organizerMode) return

    try {
      const { doc, updateDoc, serverTimestamp } = require('firebase/firestore')
      const { db } = require('@/lib/firebase')

      const updateData = {
        "wheelState.currentAngle": currentAngle || 0,
        "wheelState.progress": progress || 0,
        "wheelState.elapsedTime": elapsed || 0,
        "wheelState.remainingTime": Math.max(0, duration - (elapsed || 0)),
        lastUpdated: serverTimestamp(),
        syncHeartbeat: Date.now()
      }

      await updateDoc(doc(db, "liveDrawSessions", sessionId), cleanFirebaseData(updateData))
    } catch (error: unknown) {
      console.warn("⚠️ Minor image wheel sync error during spin:", error)
    }
  }

  return {
    connectionStatus,
    syncedSpinning,
    broadcastSpinStart,
    broadcastSpinComplete,
    broadcastSpinProgress
  }
}