"use client"

import { useState, useCallback } from 'react'
import { ImageWheelSlice, WinnerResult } from '@/types/image-wheel-types'
import { toast } from "@/hooks/use-toast"

interface UseWheelSpinProps {
  slices: ImageWheelSlice[]
  onSpinComplete?: (winner: WinnerResult) => void
  onSpinStart?: () => void
  onSpinProgress?: (progress: number, angle: number, elapsed: number, remaining: number) => void
}

export function useWheelSpin({
  slices,
  onSpinComplete,
  onSpinStart,
  onSpinProgress
}: UseWheelSpinProps) {
  const [isSpinning, setIsSpinning] = useState(false)
  const [currentRotation, setCurrentRotation] = useState(0)
  const [winner, setWinner] = useState<WinnerResult | null>(null)

  const spinWheel = useCallback(async (
    enableRealTimeSync?: boolean,
    sessionId?: string,
    organizerMode?: boolean,
    isLiveMode?: boolean,
    disabled?: boolean,
    broadcastSpinStart?: (spinData: any) => Promise<void>,
    broadcastSpinComplete?: (winner: WinnerResult, finalRotation: number) => Promise<void>,
    broadcastSpinProgress?: (progress: number, currentAngle: number, elapsed: number, duration: number) => Promise<void>
  ) => {
    if (isSpinning || slices.length === 0) return

    // Handle mode-specific validation
    if (enableRealTimeSync) {
      // Real-time mode validation
      if (isLiveMode && !organizerMode) {
        toast({
          title: "Watch Only",
          description: "Only the organizer can spin the image wheel in live mode",
          variant: "destructive"
        })
        return
      }

      if (disabled) {
        toast({
          title: "Wheel Disabled",
          description: "The image wheel is currently disabled",
          variant: "destructive"
        })
        return
      }
    } else {
      // Solo mode validation
      if (disabled) {
        toast({
          title: "Wheel Disabled",
          description: "The image wheel is currently disabled",
          variant: "destructive"
        })
        return
      }
    }

    setIsSpinning(true)
    setWinner(null)

    onSpinStart?.()

    // Calculate random spin with enhanced parameters
    const minRotation = 1440 // 4 full rotations
    const maxRotation = 2160 // 6 full rotations
    const randomRotation = Math.random() * (maxRotation - minRotation) + minRotation
    const finalRotation = currentRotation + randomRotation
    const spinStartTime = Date.now()
    const duration = 3000

    console.log('🖼️ Starting image wheel spin with parameters:', {
      spinStartTime,
      duration,
      randomRotation,
      finalRotation,
      sliceCount: slices.length
    })

    // Broadcast spin start for real-time sync
    if (enableRealTimeSync && broadcastSpinStart) {
      try {
        await broadcastSpinStart({
          spinStartTime,
          duration,
          totalRotation: randomRotation,
          finalRotation
        })
      } catch (error) {
        console.warn('Failed to broadcast spin start:', error)
      }
    }

    // Animate rotation
    const startTime = spinStartTime
    const startRotation = currentRotation

    const animate = async () => {
      const now = Date.now()
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)

      // Easing function for smooth deceleration
      const easeOut = 1 - Math.pow(1 - progress, 3)
      const rotation = startRotation + (randomRotation * easeOut)

      setCurrentRotation(rotation)

      // Broadcast spin progress for real-time sync
      if (enableRealTimeSync && broadcastSpinProgress) {
        try {
          await broadcastSpinProgress(progress, rotation, elapsed, duration)
        } catch (error) {
          console.warn('Failed to broadcast spin progress:', error)
        }
      }

      onSpinProgress?.(progress, rotation, elapsed, duration)

      if (progress < 1) {
        requestAnimationFrame(animate)
      } else {
        // Determine winner
        const normalizedAngle = (rotation % 360 + 360) % 360
        const sliceAngle = 360 / slices.length
        const winnerIndex = Math.floor((360 - normalizedAngle + sliceAngle / 2) / sliceAngle) % slices.length
        const winnerSlice = slices[winnerIndex]

        const result: WinnerResult = {
          slice: winnerSlice,
          angle: normalizedAngle,
          timestamp: new Date(),
          spinDuration: duration,
          showConfetti: true,
          showWinnerImage: Boolean(winnerSlice.image?.url)
        }

        setWinner(result)
        setIsSpinning(false)

        // Broadcast spin completion for real-time sync
        if (enableRealTimeSync && broadcastSpinComplete) {
          try {
            await broadcastSpinComplete(result, rotation)
          } catch (error) {
            console.warn('Failed to broadcast spin completion:', error)
          }
        }

        onSpinComplete?.(result)

        toast({
          title: "✓ Image Winner Selected!",
          description: `${winnerSlice.text} has been selected!`
        })
      }
    }

    animate()
  }, [isSpinning, slices, currentRotation, onSpinComplete, onSpinStart, onSpinProgress])

  return {
    isSpinning,
    currentRotation,
    winner,
    setCurrentRotation,
    spinWheel
  }
}