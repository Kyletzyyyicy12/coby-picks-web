"use client"

import { useRef, useEffect, useCallback } from 'react'
import { ImageWheelSlice } from '@/types/image-wheel-types'

interface UseWheelCanvasProps {
  slices: ImageWheelSlice[]
  size: number
  isSpinning: boolean
  currentRotation: number
}

export function useWheelCanvas({
  slices,
  size,
  isSpinning,
  currentRotation
}: UseWheelCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const drawWheel = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const centerX = size / 2
    const centerY = size / 2
    const radius = Math.min(centerX, centerY) - 20
    const anglePerSlice = (2 * Math.PI) / slices.length

    // Clear canvas
    ctx.clearRect(0, 0, size, size)

    // Draw slices
    slices.forEach((slice, index) => {
      const startAngle = index * anglePerSlice - Math.PI / 2
      const endAngle = (index + 1) * anglePerSlice - Math.PI / 2

      // Draw pie slice
      ctx.beginPath()
      ctx.moveTo(centerX, centerY)
      ctx.arc(centerX, centerY, radius, startAngle, endAngle)
      ctx.closePath()
      ctx.fillStyle = slice.color
      ctx.fill()
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 3
      ctx.stroke()

      // Draw slice image if available
      if (slice.image?.url) {
        const img = new Image()
        img.onload = () => {
          ctx.save()

          // Create pie slice clipping path
          ctx.beginPath()
          ctx.moveTo(centerX, centerY)
          ctx.arc(centerX, centerY, radius, startAngle, endAngle)
          ctx.closePath()
          ctx.clip()

          // Calculate image dimensions and position
          const sliceAngle = startAngle + anglePerSlice / 2
          const sliceCenterX = centerX + Math.cos(sliceAngle) * (radius * 0.5)
          const sliceCenterY = centerY + Math.sin(sliceAngle) * (radius * 0.5)

          // Calculate image size to fill slice
          const aspectRatio = img.width / img.height
          let drawWidth = radius * 2
          let drawHeight = radius * 2

          if (drawHeight * aspectRatio > drawWidth) {
            drawHeight = drawWidth / aspectRatio
          } else {
            drawWidth = drawHeight * aspectRatio
          }

          ctx.drawImage(
            img,
            sliceCenterX - drawWidth / 2,
            sliceCenterY - drawHeight / 2,
            drawWidth,
            drawHeight
          )

          ctx.restore()

          // Draw text overlay
          drawSliceText(ctx, slice, centerX, centerY, radius, startAngle, anglePerSlice)
        }
        img.src = slice.image.url
      } else {
        // Draw text label if no image
        drawSliceText(ctx, slice, centerX, centerY, radius, startAngle, anglePerSlice)
      }
    })

    // Draw center circle
    ctx.beginPath()
    ctx.arc(centerX, centerY, 30, 0, 2 * Math.PI)
    ctx.fillStyle = '#333333'
    ctx.fill()
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 3
    ctx.stroke()

    // Draw "SPIN" text
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 12px Arial'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('SPIN', centerX, centerY)

    // Draw pointer
    ctx.beginPath()
    ctx.moveTo(centerX + radius + 10, centerY)
    ctx.lineTo(centerX + radius - 10, centerY - 15)
    ctx.lineTo(centerX + radius - 10, centerY + 15)
    ctx.closePath()
    ctx.fillStyle = '#333333'
    ctx.fill()
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 2
    ctx.stroke()
  }, [slices, size])

  const drawSliceText = (
    ctx: CanvasRenderingContext2D,
    slice: ImageWheelSlice,
    centerX: number,
    centerY: number,
    radius: number,
    startAngle: number,
    anglePerSlice: number
  ) => {
    ctx.save()
    const textAngle = startAngle + anglePerSlice / 2
    const textRadius = radius * 0.7
    const textX = centerX + Math.cos(textAngle) * textRadius
    const textY = centerY + Math.sin(textAngle) * textRadius

    ctx.translate(textX, textY)
    ctx.rotate(textAngle + Math.PI / 2)
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 14px Arial'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(slice.text, 0, 0)
    ctx.restore()
  }

  // Redraw wheel when dependencies change
  useEffect(() => {
    drawWheel()
  }, [drawWheel])

  return {
    canvasRef,
    drawWheel,
    redraw: () => drawWheel()
  }
}