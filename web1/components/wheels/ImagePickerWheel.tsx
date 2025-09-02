"use client"

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { EnhancedWinnerPopup } from "@/components/shared/enhanced-winner-popup"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { AlertCircle, Upload, Image as ImageIcon, X, Trophy, RotateCcw, Plus, Edit3 } from 'lucide-react'
import { toast } from "@/hooks/use-toast"
import {
  ImageWheelSlice,
  ImageWheelConfig,
  WinnerResult,
  ImageUploadProgress,
  IMAGE_CONFIG,
  validateImageFile
} from '@/types/image-wheel-types'

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

interface ImagePickerWheelProps {
  initialSlices?: ImageWheelSlice[]
  onSpinComplete?: (winner: WinnerResult) => void
  onSlicesChange?: (slices: ImageWheelSlice[]) => void
  size?: number
  showWinnerModal?: boolean
  allowEdit?: boolean
  maxSlices?: number
  // 🚀 Real-time synchronization props for live sessions
  enableRealTimeSync?: boolean
  sessionId?: string
  organizerMode?: boolean
  isLiveMode?: boolean
  disabled?: boolean
}

export function ImagePickerWheel({
  initialSlices = [],
  onSpinComplete,
  onSlicesChange,
  size = 400,
  showWinnerModal = true,
  allowEdit = true,
  maxSlices = 12,
  // 🚀 Real-time synchronization props
  enableRealTimeSync = false,
  sessionId,
  organizerMode = false,
  isLiveMode = false,
  disabled = false
}: ImagePickerWheelProps) {
  const [slices, setSlices] = useState<ImageWheelSlice[]>(
    initialSlices.length > 0 ? initialSlices : [
      { id: '1', text: 'Slice 1', color: '#FF6B6B' },
      { id: '2', text: 'Slice 2', color: '#4ECDC4' },
      { id: '3', text: 'Slice 3', color: '#45B7D1' },
      { id: '4', text: 'Slice 4', color: '#96CEB4' }
    ]
  )
  
  const [isSpinning, setIsSpinning] = useState(false)
  const [currentRotation, setCurrentRotation] = useState(0)
  const [winner, setWinner] = useState<WinnerResult | null>(null)
  const [showWinner, setShowWinner] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<Map<string, ImageUploadProgress>>(new Map())
  const [editingSlice, setEditingSlice] = useState<string | null>(null)
  const [showAddSlice, setShowAddSlice] = useState(false)
  const [showBulkUpload, setShowBulkUpload] = useState(false)
  const [bulkImages, setBulkImages] = useState<File[]>([])
  
  // 🚀 Real-time synchronization state
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'connecting'>('disconnected')
  const [syncedSpinning, setSyncedSpinning] = useState(false)
  
  const wheelRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // 🚀 Real-time Firebase synchronization for live sessions
  useEffect(() => {
    if (!enableRealTimeSync || !sessionId) return

    const { doc, updateDoc, onSnapshot, serverTimestamp } = require('firebase/firestore')
    const { db } = require('@/lib/firebase')

    console.log('🖼️ ImagePickerWheel: Setting up real-time synchronization')
    setConnectionStatus('connecting')

    const unsubscribe = onSnapshot(
      doc(db, "liveDrawSessions", sessionId),
      (doc) => {
        if (doc.exists()) {
          const data = doc.data()
          setConnectionStatus('connected')
          
          // 🚀 Handle real-time image wheel slice updates from organizer
          if (data.imageWheelSlices && Array.isArray(data.imageWheelSlices) && !organizerMode) {
            console.log('🎨 PARTICIPANT: Received image wheel slices update:', {
              sliceCount: data.imageWheelSlices.length,
              hasImages: data.imageWheelSlices.filter((s: any) => s.image?.url).length,
              priority: data.imageWheelSync?.priority
            })
            
            setSlices(data.imageWheelSlices)
            
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
          
          // 🚀 Handle real-time spinning state for image wheel
          if (data.wheelState && data.selectedWheelType?.id === 'image-picker') {
            const wheelState = data.wheelState
            
            if (wheelState.isSpinning && !syncedSpinning && !organizerMode) {
              console.log('⚡ PARTICIPANT: Image wheel spinning started!')
              setSyncedSpinning(true)
              setIsSpinning(true)
              setWinner(null)
              setShowWinner(false)
              
              // Start synchronized spinning for participants
              const spinStartTime = wheelState.spinStartTime || Date.now()
              const spinDuration = wheelState.spinDuration || 3000
              const totalRotation = wheelState.totalRotation || (1440 + Math.random() * 720)
              
              const animate = () => {
                const elapsed = Date.now() - spinStartTime
                const progress = Math.min(elapsed / spinDuration, 1)
                const easeOut = 1 - Math.pow(1 - progress, 3)
                const rotation = totalRotation * easeOut
                
                setCurrentRotation(rotation)
                
                if (progress < 1 && syncedSpinning) {
                  requestAnimationFrame(animate)
                }
              }
              
              requestAnimationFrame(animate)
              
            } else if (!wheelState.isSpinning && syncedSpinning && !organizerMode) {
              console.log('🏁 PARTICIPANT: Image wheel spinning completed')
              setSyncedSpinning(false)
              setIsSpinning(false)
              
              // Show winner if available
              if (data.winners && data.winners.length > 0) {
                const winnerData = data.winners[0]
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
                  spinDuration: spinDuration,
                  showConfetti: true,
                  showWinnerImage: Boolean(winnerSlice.image?.url)
                }
                
                setWinner(result)
                if (showWinnerModal) {
                  setShowWinner(true)
                }
                
                toast({
                  title: "🏆 Image Winner Selected!",
                  description: `${winnerSlice.text} has been selected!`
                })
              }
            }
          }
        } else {
          setConnectionStatus('disconnected')
        }
      },
      (error) => {
        console.error('❌ Image wheel real-time listener error:', error)
        setConnectionStatus('disconnected')
      }
    )

    return () => {
      console.log('🔄 Cleaning up image wheel real-time listener')
      unsubscribe()
    }
  }, [enableRealTimeSync, sessionId, organizerMode, syncedSpinning, slices, showWinnerModal])

  // Update parent when slices change + real-time sync for organizers
  useEffect(() => {
    onSlicesChange?.(slices)
    
    // 🚀 Real-time broadcast slice changes to participants (organizer only)
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

        } catch (error) {
          console.error('❌ Failed to broadcast image wheel slices:', error)
        }
      }
      
      // Debounce the broadcast to avoid too many updates
      const timeoutId = setTimeout(broadcastSlices, 500)
      return () => clearTimeout(timeoutId)
    }
  }, [slices, onSlicesChange, enableRealTimeSync, sessionId, organizerMode])

  // Wheel drawing function
  const drawWheel = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const centerX = canvas.width / 2
    const centerY = canvas.height / 2
    const radius = Math.min(centerX, centerY) - 20
    const anglePerSlice = (2 * Math.PI) / slices.length

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)

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
          
          // Create pie slice clipping path for the entire slice
          ctx.beginPath()
          ctx.moveTo(centerX, centerY)
          ctx.arc(centerX, centerY, radius, startAngle, endAngle)
          ctx.closePath()
          ctx.clip()
          
          // Calculate image dimensions to fill the slice
          const sliceWidth = radius * 2
          const sliceHeight = radius * 2
          
          // Calculate the center point of the slice
          const sliceAngle = startAngle + anglePerSlice / 2
          const sliceCenterX = centerX + Math.cos(sliceAngle) * (radius * 0.5)
          const sliceCenterY = centerY + Math.sin(sliceAngle) * (radius * 0.5)
          
          // Draw image to fill the entire clipped slice area
          // Scale image to cover the slice while maintaining aspect ratio
          const aspectRatio = img.width / img.height
          let drawWidth = sliceWidth
          let drawHeight = sliceWidth / aspectRatio
          
          if (drawHeight < sliceHeight) {
            drawHeight = sliceHeight
            drawWidth = sliceHeight * aspectRatio
          }
          
          ctx.drawImage(
            img,
            sliceCenterX - drawWidth / 2,
            sliceCenterY - drawHeight / 2,
            drawWidth,
            drawHeight
          )
          
          ctx.restore()
          
          // Draw text overlay on top of the image
          ctx.save()
          const textAngle = startAngle + anglePerSlice / 2
          const textRadius = radius * 0.8
          const textX = centerX + Math.cos(textAngle) * textRadius
          const textY = centerY + Math.sin(textAngle) * textRadius

          ctx.translate(textX, textY)
          ctx.rotate(textAngle + Math.PI / 2)
          
          // Add text background for better visibility
          ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'
          ctx.font = 'bold 12px Arial'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          const textMetrics = ctx.measureText(slice.text)
          const textWidth = textMetrics.width
          ctx.fillRect(-textWidth / 2 - 4, -8, textWidth + 8, 16)
          
          // Draw white text
          ctx.fillStyle = '#ffffff'
          ctx.fillText(slice.text, 0, 0)
          ctx.restore()
        }
        img.src = slice.image.url
      } else {
        // Draw text label if no image
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
  }, [slices])

  // Redraw wheel when slices change or component mounts
  useEffect(() => {
    drawWheel()
  }, [drawWheel])

  // Handle image upload
  const handleImageUpload = async (sliceId: string, file: File) => {
    const validation = validateImageFile(file)
    if (!validation.isValid) {
      toast({
        title: "Invalid File",
        description: validation.error,
        variant: "destructive"
      })
      return
    }

    // Create upload progress entry
    setUploadProgress(prev => new Map(prev.set(sliceId, {
      sliceId,
      progress: 0,
      status: 'uploading'
    })))

    try {
      // Simulate upload progress
      for (let i = 0; i <= 100; i += 10) {
        await new Promise(resolve => setTimeout(resolve, 100))
        setUploadProgress(prev => new Map(prev.set(sliceId, {
          sliceId,
          progress: i,
          status: 'uploading'
        })))
      }

      // Create object URL for preview
      const imageUrl = URL.createObjectURL(file)
      
      // Update slice with image
      setSlices(prev => prev.map(slice => 
        slice.id === sliceId 
          ? {
              ...slice,
              image: {
                url: imageUrl,
                file,
                fileName: file.name,
                uploadTimestamp: new Date(),
                isUploaded: true
              }
            }
          : slice
      ))

      // Mark upload as complete
      setUploadProgress(prev => new Map(prev.set(sliceId, {
        sliceId,
        progress: 100,
        status: 'success'
      })))

      toast({
        title: "Image Uploaded",
        description: "Image has been successfully uploaded to the slice"
      })

      setTimeout(() => {
        setUploadProgress(prev => {
          const newMap = new Map(prev)
          newMap.delete(sliceId)
          return newMap
        })
      }, 2000)

    } catch (error) {
      console.error('Upload error:', error)
      setUploadProgress(prev => new Map(prev.set(sliceId, {
        sliceId,
        progress: 0,
        status: 'error',
        error: 'Upload failed'
      })))
      
      toast({
        title: "Upload Failed",
        description: "Failed to upload image. Please try again.",
        variant: "destructive"
      })
    }
  }

  // Spin wheel function with real-time synchronization
  const spinWheel = async () => {
    if (isSpinning || syncedSpinning || slices.length === 0) return
    
    // Prevent participants from spinning in live mode
    if (isLiveMode && !organizerMode) {
      toast({
        title: "Watch Only",
        description: "Only the organizer can spin the image wheel in live mode",
        variant: "destructive"
      })
      return
    }
    
    // Disable if in disabled mode
    if (disabled) {
      toast({
        title: "Wheel Disabled",
        description: "The image wheel is currently disabled",
        variant: "destructive"
      })
      return
    }

    setIsSpinning(true)
    setWinner(null)
    setShowWinner(false)

    // Calculate random spin with enhanced parameters
    const minRotation = 1440 // 4 full rotations
    const maxRotation = 2160 // 6 full rotations
    const randomRotation = Math.random() * (maxRotation - minRotation) + minRotation
    const finalRotation = currentRotation + randomRotation
    const spinStartTime = Date.now()
    const duration = 3000

    console.log('🖼️ ORGANIZER: Starting image wheel spin with parameters:', {
      spinStartTime,
      duration,
      randomRotation,
      finalRotation,
      sliceCount: slices.length
    })
    
    // 🚀 PRIORITY: INSTANT ZERO-DELAY broadcast for immediate participant synchronization
    if (enableRealTimeSync && sessionId && organizerMode) {
      try {
        const { doc, updateDoc, serverTimestamp } = require('firebase/firestore')
        const { db } = require('@/lib/firebase')
        
        // IMMEDIATE broadcast with highest priority - no awaiting for speed
        const instantBroadcast = updateDoc(doc(db, "liveDrawSessions", sessionId), cleanFirebaseData({
          currentState: "spinning",
          isSpinning: true,
          wheelState: {
            isSpinning: true,
            spinStartTime,
            spinDuration: duration,
            totalRotation: randomRotation,
            finalAngle: finalRotation % 360,
            currentAngle: currentRotation,
            progress: 0,
            startedAt: serverTimestamp(),
            syncVersion: Date.now(),
            // 🔥 INSTANT synchronization flags for image wheel
            instantStart: true,
            participantSync: "immediate",
            wheelType: "image-picker"
          },
          // 🚀 PRIORITY notification for instant participant response
          spinningNotification: {
            message: "🖼️ IMAGE WHEEL SPINNING NOW! Watch the images!",
            timestamp: serverTimestamp(),
            isActive: true,
            priority: "immediate",
            duration: duration
          },
          lastUpdated: serverTimestamp(),
          // 💥 Force immediate sync heartbeat
          syncHeartbeat: Date.now(),
          broadcastTime: Date.now()
        }))
        
        // Execute broadcast without blocking animation start
        instantBroadcast.then(() => {
          console.log("⚡ INSTANT image wheel spin broadcast completed - zero delay!")
        }).catch((error) => {
          console.warn("⚠️ Image wheel broadcast failed but continuing spin:", error)
        })
        
        toast({
          title: "🖼️ Image Wheel Started Spinning!",
          description: "All participants can now see the image wheel spinning in real-time",
          duration: 3000,
        })
      } catch (error) {
        console.error("❌ Failed to initiate image wheel broadcast:", error)
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
      
      // 🚀 OPTIMIZED real-time angle updates for image wheel
      if (enableRealTimeSync && sessionId && organizerMode && progress < 1) {
        // Update every 300ms for optimal balance
        if (elapsed % 300 < 16) {
          try {
            const { doc, updateDoc, serverTimestamp } = require('firebase/firestore')
            const { db } = require('@/lib/firebase')
            
            const updateData = {
              "wheelState.currentAngle": rotation || 0,
              "wheelState.progress": progress || 0,
              "wheelState.elapsedTime": elapsed || 0,
              "wheelState.remainingTime": Math.max(0, duration - (elapsed || 0)),
              lastUpdated: serverTimestamp(),
              syncHeartbeat: Date.now()
            }

            updateDoc(doc(db, "liveDrawSessions", sessionId), cleanFirebaseData(updateData)).catch((error) => {
              console.warn("⚠️ Minor image wheel sync error during spin:", error)
            })
          } catch (error) {
            console.warn("⚠️ Minor image wheel sync error during spin:", error)
          }
        }
      }

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
        
        if (showWinnerModal) {
          setShowWinner(true)
        }
        
        // 🚀 PRIORITY: INSTANT ZERO-DELAY winner broadcast for image wheel
        if (enableRealTimeSync && sessionId && organizerMode) {
          try {
            const { doc, updateDoc, serverTimestamp } = require('firebase/firestore')
            const { db } = require('@/lib/firebase')
            
            const instantWinnerBroadcast = updateDoc(doc(db, "liveDrawSessions", sessionId), {
              currentState: "waiting",
              isSpinning: false,
              winners: [{
                id: winnerSlice.id,
                name: winnerSlice.text,
                image: winnerSlice.image,
                color: winnerSlice.color
              }],
              wheelState: {
                isSpinning: false,
                currentAngle: rotation || 0,
                finalAngle: normalizedAngle,
                progress: 1,
                winners: [winnerSlice],
                completedAt: serverTimestamp(),
                spinId: result.timestamp.getTime().toString(),
                // 🔥 INSTANT result flags for zero-delay display
                instantResults: true,
                participantSync: "immediate",
                resultsReady: true,
                zeroDelay: true,
                wheelType: "image-picker"
              },
              // 🚀 PRIORITY winner notification for instant participant response
              resultNotification: {
                message: `🖼️ IMAGE WINNER: ${winnerSlice.text}!`,
                winners: [winnerSlice],
                timestamp: serverTimestamp(),
                isActive: true,
                showConfetti: true,
                priority: "immediate",
                zeroDelay: true,
                hasImage: Boolean(winnerSlice.image?.url)
              },
              lastUpdated: serverTimestamp(),
              syncHeartbeat: Date.now(),
              winnerBroadcastTime: Date.now()
            })
            
            instantWinnerBroadcast.then(() => {
              console.log("⚡ INSTANT image wheel winner broadcast completed!")
            }).catch((error) => {
              console.error("❌ Failed to broadcast image wheel winner:", error)
            })
          } catch (error) {
            console.error("❌ Failed to broadcast image wheel completion:", error)
          }
        }
        
        onSpinComplete?.(result)

        toast({
          title: "🏆 Image Winner Selected!",
          description: `${winnerSlice.text} has been selected!`
        })
      }
    }

    animate()
  }

  // Add new slice
  const addSlice = () => {
    if (slices.length >= maxSlices) {
      toast({
        title: "Maximum Slices Reached",
        description: `You can only have up to ${maxSlices} slices`,
        variant: "destructive"
      })
      return
    }

    const newSlice: ImageWheelSlice = {
      id: Date.now().toString(),
      text: `Slice ${slices.length + 1}`,
      color: `hsl(${Math.random() * 360}, 70%, 60%)`
    }

    setSlices(prev => [...prev, newSlice])
    setShowAddSlice(false)
  }

  // Remove slice
  const removeSlice = (sliceId: string) => {
    if (slices.length <= 2) {
      toast({
        title: "Minimum Slices Required",
        description: "You need at least 2 slices for the wheel",
        variant: "destructive"
      })
      return
    }

    setSlices(prev => prev.filter(slice => slice.id !== sliceId))
  }

  // Update slice
  const updateSlice = (sliceId: string, updates: Partial<ImageWheelSlice>) => {
    setSlices(prev => prev.map(slice => 
      slice.id === sliceId ? { ...slice, ...updates } : slice
    ))
  }

  // Handle bulk image upload
  const handleBulkImageUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return

    const fileArray = Array.from(files)
    const validFiles: File[] = []

    // Validate all files first
    for (const file of fileArray) {
      const validation = validateImageFile(file)
      if (validation.isValid) {
        validFiles.push(file)
      } else {
        toast({
          title: `Invalid file: ${file.name}`,
          description: validation.error,
          variant: "destructive"
        })
      }
    }

    if (validFiles.length === 0) return

    setBulkImages(validFiles)

    // Create new slices for each image
    const newSlices: ImageWheelSlice[] = []
    for (let i = 0; i < validFiles.length; i++) {
      const file = validFiles[i]
      const imageUrl = URL.createObjectURL(file)
      const fileName = file.name.replace(/\.[^/.]+$/, "") // Remove extension
      
      newSlices.push({
        id: `bulk-${Date.now()}-${i}`,
        text: fileName,
        color: `hsl(${(i * 137.5) % 360}, 70%, 60%)`,
        image: {
          url: imageUrl,
          file,
          fileName: file.name,
          uploadTimestamp: new Date(),
          isUploaded: true
        }
      })
    }

    // Replace existing slices with new ones
    setSlices(newSlices)
    setShowBulkUpload(false)

    toast({
      title: "✅ Bulk Upload Complete!",
      description: `Successfully uploaded ${validFiles.length} images to the wheel`
    })
  }

  // Generate random slices with text
  const generateRandomSlices = (count: number, customTexts?: string[]) => {
    const newSlices: ImageWheelSlice[] = []
    for (let i = 0; i < count; i++) {
      newSlices.push({
        id: `random-${Date.now()}-${i}`,
        text: customTexts?.[i] || `Item ${i + 1}`,
        color: `hsl(${(i * 137.5) % 360}, 70%, 60%)`
      })
    }
    setSlices(newSlices)
  }

  // Generate many random photos for organizer
  const generateManyRandomPhotos = async (count: number = 12) => {
    setBulkImages([])
    setShowBulkUpload(false)
    
    // Create slices with placeholder images from popular image services
    const photoCategories = [
      'nature', 'animals', 'food', 'travel', 'architecture', 
      'people', 'technology', 'sports', 'art', 'flowers',
      'sunset', 'ocean', 'mountain', 'city', 'forest'
    ]
    
    const newSlices: ImageWheelSlice[] = []
    for (let i = 0; i < count; i++) {
      const category = photoCategories[i % photoCategories.length]
      const imageUrl = `https://picsum.photos/300/300?random=${Date.now()}-${i}&category=${category}`
      
      newSlices.push({
        id: `photo-${Date.now()}-${i}`,
        text: `Photo ${i + 1}`,
        color: `hsl(${(i * 137.5) % 360}, 70%, 60%)`,
        image: {
          url: imageUrl,
          fileName: `random-photo-${i + 1}.jpg`,
          uploadTimestamp: new Date(),
          isUploaded: true
        }
      })
    }
    
    setSlices(newSlices)
    
    toast({
      title: "🖼️ Random Photos Generated!",
      description: `Created ${count} slices with random photos for your wheel`
    })
  }

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* Wheel Display */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5" />
            Image Picker Wheel
          </CardTitle>
          <CardDescription>
            Upload images for each slice and spin to reveal the winner with their picture!
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center space-y-4">
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
              onClick={spinWheel}
              className="border-4 border-gray-200 rounded-full shadow-lg"
            />
          </div>
          
          <Button
            onClick={spinWheel}
            disabled={isSpinning || slices.length === 0}
            size="lg"
            className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
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

          <div className="text-center text-sm text-muted-foreground">
            Click the wheel or button to spin • {slices.length} slice{slices.length !== 1 ? 's' : ''}
          </div>
        </CardContent>
      </Card>

      {/* Slice Management */}
      {allowEdit && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Manage Slices</span>
              <div className="flex gap-2">
                <Button
                  onClick={() => setShowBulkUpload(true)}
                  size="sm"
                  variant="outline"
                  className="bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100"
                >
                  <Upload className="h-4 w-4 mr-1" />
                  Bulk Upload
                </Button>
                <Button
                  onClick={() => setShowAddSlice(true)}
                  size="sm"
                  variant="outline"
                  disabled={slices.length >= maxSlices}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Slice
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {slices.map((slice) => {
                const progress = uploadProgress.get(slice.id)
                
                return (
                  <Card key={slice.id} className="relative">
                    <CardContent className="p-4">
                      {/* Slice Preview */}
                      <div className="flex items-center gap-3 mb-3">
                        <div 
                          className="w-8 h-8 rounded-full border-2 border-white shadow-sm"
                          style={{ backgroundColor: slice.color }}
                        />
                        <div className="flex-1">
                          {editingSlice === slice.id ? (
                            <Input
                              value={slice.text}
                              onChange={(e) => updateSlice(slice.id, { text: e.target.value })}
                              onBlur={() => setEditingSlice(null)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') setEditingSlice(null)
                              }}
                              autoFocus
                              className="text-sm"
                            />
                          ) : (
                            <div 
                              className="font-medium cursor-pointer hover:text-blue-600"
                              onClick={() => setEditingSlice(slice.id)}
                            >
                              {slice.text}
                            </div>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeSlice(slice.id)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>

                      {/* Image Upload/Display */}
                      <div className="space-y-2">
                        {slice.image?.url ? (
                          <div className="relative">
                            <img
                              src={slice.image.url}
                              alt={slice.text}
                              className="w-full h-32 object-cover rounded-md border-2 border-gray-200"
                            />
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => updateSlice(slice.id, { image: undefined })}
                              className="absolute top-1 right-1 text-red-500 hover:text-red-700 bg-white/80 hover:bg-white"
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : (
                          <div className="border-2 border-dashed border-gray-300 rounded-md p-4 text-center">
                            <ImageIcon className="h-8 w-8 mx-auto text-gray-400 mb-2" />
                            <p className="text-sm text-gray-500 mb-2">Upload an image</p>
                            <label className="cursor-pointer">
                              <input
                                type="file"
                                accept={IMAGE_CONFIG.ALLOWED_TYPES.join(',')}
                                onChange={(e) => {
                                  const file = e.target.files?.[0]
                                  if (file) handleImageUpload(slice.id, file)
                                }}
                                className="hidden"
                              />
                              <Button size="sm" variant="outline" asChild>
                                <span>
                                  <Upload className="h-3 w-3 mr-1" />
                                  Choose File
                                </span>
                              </Button>
                            </label>
                          </div>
                        )}

                        {/* Upload Progress */}
                        {progress && progress.status === 'uploading' && (
                          <div className="space-y-1">
                            <Progress value={progress.progress} className="h-2" />
                            <p className="text-xs text-center text-gray-500">
                              Uploading... {progress.progress}%
                            </p>
                          </div>
                        )}

                        {progress && progress.status === 'error' && (
                          <div className="flex items-center gap-1 text-red-600 text-sm">
                            <AlertCircle className="h-3 w-3" />
                            {progress.error}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Enhanced Winner Display Popup - Web Only */}
      <EnhancedWinnerPopup
        isOpen={showWinner}
        onClose={() => setShowWinner(false)}
        winners={winner ? [{
          id: winner.slice.id,
          name: winner.slice.text,
          image: winner.slice.image ? {
            url: winner.slice.image.url,
            alt: winner.slice.text
          } : undefined,
          color: winner.slice.color
        }] : []}
        congratsMessage="🎉 Congratulations! Your image has been selected! 🎉"
        wheelType="image-picker"
        showConfetti={true}
        customTitle="🖼️ IMAGE WINNER! 🖼️"
      />

      {/* Add Slice Dialog */}
      <Dialog open={showAddSlice} onOpenChange={setShowAddSlice}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Slice</DialogTitle>
            <DialogDescription>
              Create a new slice for your image picker wheel
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Button onClick={addSlice} className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              Add Slice
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Upload Dialog */}
      <Dialog open={showBulkUpload} onOpenChange={setShowBulkUpload}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Bulk Upload Images
            </DialogTitle>
            <DialogDescription>
              Upload multiple images at once to create wheel slices automatically
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* File Upload Area */}
            <div className="border-2 border-dashed border-purple-300 rounded-lg p-8 text-center hover:border-purple-400 transition-colors">
              <ImageIcon className="h-12 w-12 mx-auto text-purple-400 mb-4" />
              <h3 className="text-lg font-semibold text-purple-800 mb-2">
                Upload Multiple Images
              </h3>
              <p className="text-purple-600 mb-4">
                Select multiple images to create wheel slices automatically
              </p>
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept={IMAGE_CONFIG.ALLOWED_TYPES.join(',')}
                  onChange={(e) => handleBulkImageUpload(e.target.files)}
                  className="hidden"
                  multiple
                />
                <Button className="bg-purple-600 hover:bg-purple-700">
                  <Upload className="h-4 w-4 mr-2" />
                  Choose Images
                </Button>
              </label>
              <p className="text-xs text-purple-500 mt-2">
                Supported formats: JPG, PNG, GIF • Max {maxSlices} images
              </p>
            </div>

            {/* Quick Generation Options */}
            <div className="space-y-4">
              <h4 className="font-semibold text-gray-800">Quick Generation</h4>
              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    generateRandomSlices(6)
                    setShowBulkUpload(false)
                  }}
                  className="flex flex-col items-center p-4 h-auto"
                >
                  <span className="text-2xl mb-2">🎲</span>
                  <span className="text-sm font-medium">6 Random Slices</span>
                  <span className="text-xs text-muted-foreground">Perfect for games</span>
                </Button>
                
                <Button
                  variant="outline"
                  onClick={() => {
                    generateRandomSlices(8)
                    setShowBulkUpload(false)
                  }}
                  className="flex flex-col items-center p-4 h-auto"
                >
                  <span className="text-2xl mb-2">🎆</span>
                  <span className="text-sm font-medium">8 Random Slices</span>
                  <span className="text-xs text-muted-foreground">Standard wheel</span>
                </Button>
                
                <Button
                  variant="outline"
                  onClick={() => {
                    generateRandomSlices(10)
                    setShowBulkUpload(false)
                  }}
                  className="flex flex-col items-center p-4 h-auto"
                >
                  <span className="text-2xl mb-2">✨</span>
                  <span className="text-sm font-medium">10 Random Slices</span>
                  <span className="text-xs text-muted-foreground">More options</span>
                </Button>
                
                <Button
                  variant="outline"
                  onClick={() => {
                    generateRandomSlices(12)
                    setShowBulkUpload(false)
                  }}
                  className="flex flex-col items-center p-4 h-auto"
                >
                  <span className="text-2xl mb-2">🌈</span>
                  <span className="text-sm font-medium">12 Random Slices</span>
                  <span className="text-xs text-muted-foreground">Maximum variety</span>
                </Button>
              </div>
            </div>

            {/* Many Random Photos for Organizers */}
            <div className="space-y-4">
              <h4 className="font-semibold text-gray-800 flex items-center gap-2">
                🖼️ Many Random Photos
                <Badge className="bg-purple-100 text-purple-800 text-xs">ORGANIZER FEATURE</Badge>
              </h4>
              <p className="text-sm text-gray-600">
                Generate wheel slices with many random photos from various categories
              </p>
              <div className="grid grid-cols-2 gap-3">
                <Button
                  onClick={() => generateManyRandomPhotos(8)}
                  className="flex flex-col items-center p-4 h-auto bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white"
                >
                  <span className="text-2xl mb-2">🇺️</span>
                  <span className="text-sm font-medium">8 Random Photos</span>
                  <span className="text-xs text-white/80">Nature, Animals, Food</span>
                </Button>
                
                <Button
                  onClick={() => generateManyRandomPhotos(12)}
                  className="flex flex-col items-center p-4 h-auto bg-gradient-to-r from-green-500 to-teal-600 hover:from-green-600 hover:to-teal-700 text-white"
                >
                  <span className="text-2xl mb-2">🌄</span>
                  <span className="text-sm font-medium">12 Random Photos</span>
                  <span className="text-xs text-white/80">Travel, Architecture, Art</span>
                </Button>
                
                <Button
                  onClick={() => generateManyRandomPhotos(16)}
                  className="flex flex-col items-center p-4 h-auto bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white"
                >
                  <span className="text-2xl mb-2">🗺️</span>
                  <span className="text-sm font-medium">16 Random Photos</span>
                  <span className="text-xs text-white/80">Mixed Categories</span>
                </Button>
                
                <Button
                  onClick={() => generateManyRandomPhotos(20)}
                  className="flex flex-col items-center p-4 h-auto bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white"
                >
                  <span className="text-2xl mb-2">🌈</span>
                  <span className="text-sm font-medium">20 Random Photos</span>
                  <span className="text-xs text-white/80">Maximum Variety</span>
                </Button>
              </div>
              
              <div className="bg-purple-50 p-3 rounded-lg border border-purple-200">
                <div className="flex items-start gap-2">
                  <div className="text-purple-600 flex-shrink-0">💡</div>
                  <div className="text-sm text-purple-800">
                    <strong>Pro Tip:</strong> Random photos are perfect for:
                    <ul className="mt-1 space-y-1 text-xs">
                      <li>• Quick setup without uploading your own images</li>
                      <li>• Demonstration purposes and testing</li>
                      <li>• When you need diverse visual options instantly</li>
                      <li>• Creating engaging wheels for any audience</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {/* Instructions */}
            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="font-semibold text-blue-800 mb-2">Tips:</h4>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• Image names will be used as slice text</li>
                <li>• Images will be automatically resized to fit</li>
                <li>• You can edit slice text and upload individual images later</li>
                <li>• Random slices create text-only slices that you can add images to</li>
              </ul>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}