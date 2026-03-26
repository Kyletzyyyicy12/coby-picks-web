"use client"

import { useState, useCallback } from 'react'
import { ImageWheelSlice, ImageUploadProgress } from '@/types/image-wheel-types'
import { toast } from "@/hooks/use-toast"

interface UseSliceManagerProps {
  maxSlices?: number
  onSlicesChange?: (slices: ImageWheelSlice[]) => void
}

export function useSliceManager({ maxSlices = 12, onSlicesChange }: UseSliceManagerProps) {
  const [slices, setSlices] = useState<ImageWheelSlice[]>([
    { id: '1', text: 'Slice 1', color: '#FF6B6B' },
    { id: '2', text: 'Slice 2', color: '#4ECDC4' },
    { id: '3', text: 'Slice 3', color: '#45B7D1' },
    { id: '4', text: 'Slice 4', color: '#96CEB4' }
  ])

  const [uploadProgress, setUploadProgress] = useState<Map<string, ImageUploadProgress>>(new Map())

  const updateSlices = useCallback((newSlices: ImageWheelSlice[]) => {
    setSlices(newSlices)
    onSlicesChange?.(newSlices)
  }, [onSlicesChange])

  const addSlice = useCallback(() => {
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

    const updatedSlices = [...slices, newSlice]
    updateSlices(updatedSlices)
  }, [slices, maxSlices, updateSlices])

  const removeSlice = useCallback((sliceId: string) => {
    if (slices.length <= 2) {
      toast({
        title: "Minimum Slices Required",
        description: "You need at least 2 slices for the wheel",
        variant: "destructive"
      })
      return
    }

    const updatedSlices = slices.filter(slice => slice.id !== sliceId)
    updateSlices(updatedSlices)
  }, [slices, updateSlices])

  const updateSlice = useCallback((sliceId: string, updates: Partial<ImageWheelSlice>) => {
    const updatedSlices = slices.map(slice =>
      slice.id === sliceId ? { ...slice, ...updates } : slice
    )
    updateSlices(updatedSlices)
  }, [slices, updateSlices])

  const generateRandomSlices = useCallback((count: number, customTexts?: string[]) => {
    const newSlices: ImageWheelSlice[] = []
    for (let i = 0; i < count; i++) {
      newSlices.push({
        id: `random-${Date.now()}-${i}`,
        text: customTexts?.[i] || `Item ${i + 1}`,
        color: `hsl(${(i * 137.5) % 360}, 70%, 60%)`
      })
    }
    updateSlices(newSlices)
  }, [updateSlices])

  const generateRandomPhotos = useCallback(async (count: number = 12) => {
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

    updateSlices(newSlices)

    toast({
      title: "🖼️ Random Photos Generated!",
      description: `Created ${count} slices with random photos for your wheel`
    })
  }, [updateSlices])

  return {
    slices,
    uploadProgress,
    setUploadProgress,
    addSlice,
    removeSlice,
    updateSlice,
    generateRandomSlices,
    generateRandomPhotos,
    updateSlices
  }
}