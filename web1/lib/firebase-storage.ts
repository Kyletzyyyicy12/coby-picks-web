/**
 * FREE IMAGE SHARING SOLUTION - No Firebase Storage Required!
 * Alternative approach using base64 encoding for cross-session image sharing
 */

import { toast } from '@/hooks/use-toast'

export interface ImageUploadResult {
  dataUrl: string
  imageId: string
  fileName: string
  fileSize: number
  uploadTimestamp: Date
  isBase64: boolean
}

/**
 * Convert file to base64 data URL for cross-session sharing - OPTIMIZED for speed
 * @param file - The image file to convert
 * @returns Promise with base64 data URL
 */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    // Optimize for faster reading
    reader.onload = () => {
      const result = reader.result as string
      if (result) {
        resolve(result)
      } else {
        reject(new Error('Failed to convert file to base64'))
      }
    }

    reader.onerror = () => reject(new Error('File reading failed'))

    // Use readAsDataURL for immediate conversion
    reader.readAsDataURL(file)
  })
}

/**
 * Check if we can store data in localStorage without exceeding quota
 * @param dataSize - Size of data to store in bytes
 * @returns boolean indicating if storage is available
 */
function canStoreInLocalStorage(dataSize: number): boolean {
  try {
    // Check if localStorage is available
    if (typeof Storage === 'undefined') return false

    // Try to store a test item to check quota
    const testKey = '__storage_test__'
    const testData = 'x'.repeat(100) // 100 bytes test

    try {
      localStorage.setItem(testKey, testData)
      localStorage.removeItem(testKey)
    } catch (testError) {
      console.warn('localStorage quota test failed:', testError)
      return false
    }

    // Estimate current usage (rough calculation)
    let currentUsage = 0
    for (let key in localStorage) {
      if (localStorage.hasOwnProperty(key)) {
        currentUsage += localStorage.getItem(key)?.length || 0
      }
    }

    // Leave 1MB buffer for other data and browser overhead
    const availableSpace = 4 * 1024 * 1024 // Assume 5MB total, leave 1MB buffer
    const neededSpace = currentUsage + dataSize

    return neededSpace < availableSpace
  } catch (error) {
    console.warn('Error checking localStorage availability:', error)
    return false
  }
}

/**
 * Force cleanup when storage is already full
 * @returns boolean indicating if cleanup freed enough space
 */
function forceCleanupForFullStorage(): boolean {
  try {
    console.log('🔥 Force cleanup: localStorage is full, removing oldest images...')

    const imageCache = JSON.parse(localStorage.getItem('wheel-images') || '{}')
    const images: [string, any][] = Object.entries(imageCache)

    if (images.length === 0) {
      console.log('📭 No images to clean up')
      return false
    }

    // Sort by stored date (oldest first) and remove 50% of oldest images
    images.sort((a, b) => {
      const dateA = new Date(a[1].storedAt).getTime()
      const dateB = new Date(b[1].storedAt).getTime()
      return dateA - dateB
    })

    const toRemove = Math.ceil(images.length * 0.5) // Remove 50% of oldest images
    let removedCount = 0
    let freedBytes = 0

    for (let i = 0; i < toRemove && i < images.length; i++) {
      const [key, value] = images[i]
      const imageSize = JSON.stringify(value).length
      delete imageCache[key]
      freedBytes += imageSize
      removedCount++
    }

    localStorage.setItem('wheel-images', JSON.stringify(imageCache))

    console.log(`🧹 Force cleanup: removed ${removedCount} images, freed ${Math.round(freedBytes / 1024)}KB`)

    // Test if we can now store data
    try {
      const testKey = '__storage_test_after_cleanup__'
      const testData = 'x'.repeat(1000) // 1KB test
      localStorage.setItem(testKey, testData)
      localStorage.removeItem(testKey)

      toast({
        title: "🧹 Storage Cleaned",
        description: `Removed ${removedCount} old images (${Math.round(freedBytes / 1024)}KB freed)`,
      })

      return true
    } catch (testError) {
      console.warn('Still not enough space after cleanup:', testError)
      return false
    }

  } catch (error) {
    console.warn('Force cleanup failed:', error)
    return false
  }
}

/**
 * Clean up old images to free up space
 * @param targetReductionBytes - How many bytes to free up
 * @returns Number of bytes freed
 */
function cleanupOldImagesForSpace(targetReductionBytes: number): number {
  try {
    const imageCache = JSON.parse(localStorage.getItem('wheel-images') || '{}')
    const images: [string, any][] = Object.entries(imageCache)

    if (images.length === 0) return 0

    // Sort by stored date (oldest first) - fix TypeScript issues
    images.sort((a, b) => {
      const dateA = new Date(a[1].storedAt).getTime()
      const dateB = new Date(b[1].storedAt).getTime()
      return dateA - dateB
    })

    let freedBytes = 0
    let cleanedCount = 0

    // Remove oldest images until we free enough space
    for (const [key, value] of images) {
      const imageSize = JSON.stringify(value).length
      delete imageCache[key]
      freedBytes += imageSize
      cleanedCount++

      if (freedBytes >= targetReductionBytes) break
    }

    localStorage.setItem('wheel-images', JSON.stringify(imageCache))
    console.log(`🧹 Cleaned up ${cleanedCount} old images, freed ${freedBytes} bytes`)

    return freedBytes
  } catch (error) {
    console.warn('Failed to cleanup old images:', error)
    return 0
  }
}

/**
 * Schedule automatic cleanup of old images
 */
let cleanupScheduled = false
function scheduleAutomaticCleanup(): void {
  if (cleanupScheduled) return

  cleanupScheduled = true

  // Clean up old images every hour
  setInterval(() => {
    try {
      cleanupOldImages(1) // Clean images older than 1 day
      console.log('🧹 Automatic cleanup completed')
    } catch (error) {
      console.warn('Automatic cleanup failed:', error)
    }
  }, 60 * 60 * 1000) // Every hour
}

/**
 * Compress base64 image data if it's too large
 * @param dataUrl - The base64 data URL
 * @param maxSizeKB - Maximum size in KB (default 500KB)
 * @returns Compressed data URL or original if compression not possible
 */
function compressImageData(dataUrl: string, maxSizeKB: number = 500): string {
  try {
    // If already under limit, return as-is
    if (dataUrl.length < maxSizeKB * 1024) {
      return dataUrl
    }

    // For now, we'll implement a simple size check and reject very large images
    // In a production environment, you might want to implement actual image compression
    if (dataUrl.length > 2 * 1024 * 1024) { // 2MB limit
      throw new Error('Image too large for localStorage. Please use a smaller image.')
    }

    return dataUrl
  } catch (error) {
    console.warn('Image compression failed:', error)
    throw error
  }
}

/**
 * Store image data in localStorage for persistence across sessions
 * @param imageId - Unique identifier for the image
 * @param imageData - Base64 data URL or image metadata
 */
function storeImageData(imageId: string, imageData: any): void {
  try {
    // Check if we have enough space
    const dataToStore = JSON.stringify({
      ...imageData,
      storedAt: new Date().toISOString()
    })

    if (!canStoreInLocalStorage(dataToStore.length)) {
      console.log('⚠️ localStorage quota nearly full, attempting cleanup...')

      // Try to free up space by removing old images
      const freedBytes = cleanupOldImagesForSpace(dataToStore.length)

      // If that didn't work, try force cleanup (remove 50% of oldest images)
      if (freedBytes === 0 || !canStoreInLocalStorage(dataToStore.length)) {
        console.log('🔥 Standard cleanup insufficient, trying force cleanup...')
        const forceCleanupWorked = forceCleanupForFullStorage()

        if (!forceCleanupWorked || !canStoreInLocalStorage(dataToStore.length)) {
          throw new Error('localStorage quota exceeded. Please clear some images or use smaller files.')
        }
      }
    }

    // Compress if necessary
    if (imageData.dataUrl) {
      imageData.dataUrl = compressImageData(imageData.dataUrl)
    }

    const imageCache = JSON.parse(localStorage.getItem('wheel-images') || '{}')
    imageCache[imageId] = {
      ...imageData,
      storedAt: new Date().toISOString()
    }

    localStorage.setItem('wheel-images', JSON.stringify(imageCache))

    // Schedule automatic cleanup every hour
    scheduleAutomaticCleanup()

  } catch (error) {
    console.warn('Failed to store image in localStorage:', error)

    // If it's a quota exceeded error, provide helpful guidance
    if (error instanceof Error && error.message.includes('quota exceeded')) {
      toast({
        title: "💾 Storage Full",
        description: "localStorage is full. Try using smaller images or run cleanupOldImages() in console.",
        variant: "destructive"
      })
    } else {
      toast({
        title: "Storage Error",
        description: "Failed to save image. Please try again or use a smaller file.",
        variant: "destructive"
      })
    }

    throw error
  }
}

/**
 * Retrieve image data from localStorage
 * @param imageId - Unique identifier for the image
 * @returns Stored image data or null if not found
 */
function getStoredImageData(imageId: string): any | null {
  try {
    const imageCache = JSON.parse(localStorage.getItem('wheel-images') || '{}')
    return imageCache[imageId] || null
  } catch (error) {
    console.warn('Failed to retrieve image from localStorage:', error)
    return null
  }
}

/**
 * Upload an image file and convert to base64 for cross-session sharing - ULTRA FAST
 * @param file - The image file to upload
 * @param sessionId - The live session ID for organizing files
 * @param sliceId - The wheel slice ID for organizing files
 * @returns Promise with upload result containing data URL and metadata
 */
export async function uploadImageToFirebaseStorage(
  file: File,
  sessionId: string,
  sliceId: string
): Promise<ImageUploadResult> {
  try {
    // Validate file size (max 5MB for localStorage)
    const maxSize = 5 * 1024 * 1024 // 5MB
    if (file.size > maxSize) {
      throw new Error(`Image too large (${Math.round(file.size / 1024 / 1024)}MB). Please use images smaller than 5MB.`)
    }

    console.log('⚡ ULTRA-FAST base64 conversion for instant reflection:', {
      fileName: file.name,
      fileSize: file.size,
      sessionId: sessionId,
      sliceId: sliceId
    })

    // Convert file to base64 data URL - optimized for speed
    const dataUrl = await fileToBase64(file)

    // Create unique image ID with high precision timestamp
    const timestamp = Date.now()
    const imageId = `img_${sessionId}_${sliceId}_${timestamp}_${Math.random().toString(36).substr(2, 9)}`

    // Store image data for persistence - immediate storage
    const imageData = {
      dataUrl,
      fileName: file.name,
      fileSize: file.size,
      sessionId,
      sliceId,
      imageId,
      storedAt: new Date().toISOString()
    }

    // Store immediately for instant availability
    storeImageData(imageId, imageData)

    console.log('⚡ Image converted and stored instantly:', {
      imageId: imageId,
      fileName: file.name,
      fileSize: file.size,
      dataUrlLength: dataUrl.length,
      conversionTime: 'minimal'
    })

    return {
      dataUrl,
      imageId,
      fileName: file.name,
      fileSize: file.size,
      uploadTimestamp: new Date(),
      isBase64: true
    }

  } catch (error) {
    console.error('❌ Failed to convert image to base64:', error)

    // Provide more specific error messages
    let errorMessage = 'Unknown error'
    if (error instanceof Error) {
      if (error.message.includes('too large')) {
        errorMessage = error.message
      } else if (error.message.includes('quota')) {
        errorMessage = 'Storage full. Please clear some old images or use smaller files.'
      } else {
        errorMessage = `Failed to process image: ${error.message}`
      }
    }

    toast({
      title: "Upload Failed",
      description: errorMessage,
      variant: "destructive"
    })
    throw error
  }
}

/**
 * Get image data by ID (for cross-session retrieval)
 * @param imageId - The unique image identifier
 * @returns Image data or null if not found
 */
export function getImageById(imageId: string): ImageUploadResult | null {
  const storedData = getStoredImageData(imageId)
  if (!storedData) return null

  return {
    dataUrl: storedData.dataUrl,
    imageId: storedData.imageId,
    fileName: storedData.fileName,
    fileSize: storedData.fileSize,
    uploadTimestamp: new Date(storedData.storedAt),
    isBase64: true
  }
}

/**
 * Upload multiple images for bulk operations
 * @param files - Array of files to upload
 * @param sessionId - The live session ID
 * @param sliceIds - Array of slice IDs corresponding to each file
 * @returns Promise with array of upload results
 */
export async function uploadMultipleImagesToFirebaseStorage(
  files: File[],
  sessionId: string,
  sliceIds: string[]
): Promise<ImageUploadResult[]> {
  const uploadPromises = files.map((file, index) =>
    uploadImageToFirebaseStorage(file, sessionId, sliceIds[index] || `slice-${index}`)
  )

  try {
    const results = await Promise.all(uploadPromises)
    console.log(`✅ Successfully processed ${results.length} images to base64`)
    return results
  } catch (error) {
    console.error('❌ Failed to process multiple images:', error)
    toast({
      title: "Bulk Upload Failed",
      description: "Some images failed to process. Please try again.",
      variant: "destructive"
    })
    throw error
  }
}

/**
 * Clean up old images from localStorage (optional maintenance)
 * @param olderThanDays - Remove images older than this many days
 */
export function cleanupOldImages(olderThanDays: number = 7): void {
  try {
    const imageCache = JSON.parse(localStorage.getItem('wheel-images') || '{}')
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays)

    let cleanedCount = 0
    Object.keys(imageCache).forEach(key => {
      const storedAt = new Date(imageCache[key].storedAt)
      if (storedAt < cutoffDate) {
        delete imageCache[key]
        cleanedCount++
      }
    })

    localStorage.setItem('wheel-images', JSON.stringify(imageCache))
    console.log(`🧹 Cleaned up ${cleanedCount} old images from localStorage`)

    if (cleanedCount > 0) {
      toast({
        title: "🧹 Storage Cleaned",
        description: `Removed ${cleanedCount} old images to free up space`,
      })
    }
  } catch (error) {
    console.warn('Failed to cleanup old images:', error)
  }
}

/**
 * Get storage usage information
 * @returns Object with storage statistics
 */
export function getStorageInfo(): {
  totalImages: number
  totalSize: number
  oldestImage?: string
  newestImage?: string
  canStoreMore: boolean
} {
  try {
    const imageCache = JSON.parse(localStorage.getItem('wheel-images') || '{}')
    const images = Object.entries(imageCache)

    if (images.length === 0) {
      return {
        totalImages: 0,
        totalSize: 0,
        canStoreMore: true
      }
    }

    let totalSize = 0
    let oldestDate: Date | null = null
    let newestDate: Date | null = null
    let oldestKey = ''
    let newestKey = ''

    images.forEach(([key, value]: [string, any]) => {
      const size = JSON.stringify(value).length
      totalSize += size

      const storedAt = new Date(value.storedAt)
      if (!oldestDate || storedAt < oldestDate) {
        oldestDate = storedAt
        oldestKey = key
      }
      if (!newestDate || storedAt > newestDate) {
        newestDate = storedAt
        newestKey = key
      }
    })

    // Estimate if we can store more (leave 1MB buffer)
    const canStoreMore = (totalSize + 1024 * 1024) < (5 * 1024 * 1024)

    return {
      totalImages: images.length,
      totalSize,
      oldestImage: oldestKey,
      newestImage: newestKey,
      canStoreMore
    }
  } catch (error) {
    console.warn('Failed to get storage info:', error)
    return {
      totalImages: 0,
      totalSize: 0,
      canStoreMore: false
    }
  }
}

/**
 * Clear all stored images (nuclear option)
 */
export function clearAllStoredImages(): void {
  try {
    localStorage.removeItem('wheel-images')
    console.log('🗑️ Cleared all stored images from localStorage')

    toast({
      title: "🗑️ Storage Cleared",
      description: "All stored images have been removed",
    })
  } catch (error) {
    console.warn('Failed to clear stored images:', error)
  }
}

// Extend window interface for debugging functions
declare global {
  interface Window {
    debugImageStorage?: () => void
    cleanupOldImages?: (days?: number) => void
    clearAllStoredImages?: () => void
    getStorageInfo?: () => any
  }
}

/**
 * Debug function - can be called from browser console
 * Usage: window.debugImageStorage()
 */
export function debugImageStorage(): void {
  const info = getStorageInfo()
  console.log('🖼️ Image Storage Debug Info:', info)

  if (info.totalImages > 0) {
    console.log(`📊 Storing ${info.totalImages} images (${Math.round(info.totalSize / 1024)}KB total)`)

    if (!info.canStoreMore) {
      console.warn('⚠️ Storage nearly full! Consider cleaning up old images.')
    }
  } else {
    console.log('📊 No images stored')
  }

  // Make this function globally available for debugging
  if (typeof window !== 'undefined') {
    window.debugImageStorage = debugImageStorage
    window.cleanupOldImages = cleanupOldImages
    window.clearAllStoredImages = clearAllStoredImages
    window.getStorageInfo = getStorageInfo
  }
}

// Auto-run debug setup when module loads
if (typeof window !== 'undefined') {
  // Delay to ensure it runs after page load
  setTimeout(debugImageStorage, 1000)
}