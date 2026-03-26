"use client"

import { useState, useCallback } from 'react'
import { ImageWheelSlice, ImageUploadProgress, validateImageFile } from '@/types/image-wheel-types'
import { toast } from "@/hooks/use-toast"

interface UseImageUploadProps {
  slices: ImageWheelSlice[]
  onSlicesChange: (slices: ImageWheelSlice[]) => void
  uploadProgress: Map<string, ImageUploadProgress>
  setUploadProgress: (progress: Map<string, ImageUploadProgress>) => void
}

export function useImageUpload({
  slices,
  onSlicesChange,
  uploadProgress,
  setUploadProgress
}: UseImageUploadProps) {

  const handleImageUpload = useCallback(async (sliceId: string, file: File) => {
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
    setUploadProgress(new Map(uploadProgress.set(sliceId, {
      sliceId,
      progress: 0,
      status: 'uploading'
    })))

    try {
      // Simulate upload progress
      for (let i = 0; i <= 100; i += 10) {
        await new Promise(resolve => setTimeout(resolve, 100))
        setUploadProgress(new Map(uploadProgress.set(sliceId, {
          sliceId,
          progress: i,
          status: 'uploading'
        })))
      }

      // Create object URL for preview
      const imageUrl = URL.createObjectURL(file)

      // Update slice with image
      const updatedSlices = slices.map(slice =>
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
      )

      onSlicesChange(updatedSlices)

      // Mark upload as complete
      setUploadProgress(new Map(uploadProgress.set(sliceId, {
        sliceId,
        progress: 100,
        status: 'success'
      })))

      toast({
        title: "Image Uploaded",
        description: "Image has been successfully uploaded to the slice"
      })

      setTimeout(() => {
        const newMap = new Map(uploadProgress)
        newMap.delete(sliceId)
        setUploadProgress(newMap)
      }, 2000)

    } catch (error) {
      console.error('Upload error:', error)
      setUploadProgress(new Map(uploadProgress.set(sliceId, {
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
  }, [slices, onSlicesChange, uploadProgress, setUploadProgress])

  const handleBulkImageUpload = useCallback(async (files: FileList | null) => {
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
    onSlicesChange(newSlices)

    toast({
      title: "✅ Bulk Upload Complete!",
      description: `Successfully uploaded ${validFiles.length} images to the wheel`
    })
  }, [onSlicesChange])

  const removeSliceImage = useCallback((sliceId: string) => {
    const updatedSlices = slices.map(slice =>
      slice.id === sliceId ? { ...slice, image: undefined } : slice
    )
    onSlicesChange(updatedSlices)
  }, [slices, onSlicesChange])

  return {
    handleImageUpload,
    handleBulkImageUpload,
    removeSliceImage
  }
}