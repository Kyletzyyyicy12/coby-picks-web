"use client"

import React from 'react'
import { Button } from "@/components/ui/button"
import { Trophy, RotateCcw } from 'lucide-react'
import { useWheelCanvas } from '../hooks/useWheelCanvas'

interface WheelCanvasProps {
  slices: any[]
  size?: number
  isSpinning: boolean
  currentRotation: number
  onSpin: () => void
}

export function WheelCanvas({
  slices,
  size = 400,
  isSpinning,
  currentRotation,
  onSpin
}: WheelCanvasProps) {
  const { canvasRef } = useWheelCanvas({
    slices,
    size,
    isSpinning,
    currentRotation
  })

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        width={size}
        height={size}
        style={{
          transform: `rotate(${currentRotation}deg)`,
          transition: isSpinning ? 'transform 3s cubic-bezier(0.25, 0.1, 0.25, 1)' : 'none',
          cursor: isSpinning ? 'not-allowed' : 'pointer'
        }}
        onClick={onSpin}
        className="border-4 border-gray-200 rounded-full shadow-lg"
      />

      <Button
        onClick={onSpin}
        disabled={isSpinning || slices.length === 0}
        size="lg"
        className="absolute -bottom-4 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
      >
        {isSpinning ? (
          <>
            <RotateCcw className="h-5 w-5 mr-2 animate-spin" />
            Spinning...
          </>
        ) : (
          <>
            <Trophy className="h-5 w-5 mr-2" />
            Spin the Wheel
          </>
        )}
      </Button>

      <div className="text-center text-sm text-muted-foreground mt-2">
        Click the wheel or button to spin • {slices.length} slice{slices.length !== 1 ? 's' : ''}
      </div>
    </div>
  )
}