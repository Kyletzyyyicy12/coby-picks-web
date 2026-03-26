// Enhanced Wheel Slice Types for Image Support
export interface ImageWheelSlice {
  id: string
  text: string
  color: string
  emoji?: string
  // Enhanced image support
  image?: {
    url: string
    file?: File
    fileName?: string
    uploadTimestamp?: Date
    isUploaded?: boolean
    imgElement?: HTMLImageElement // Pre-loaded image element for performance
    isBlobUrl?: boolean // Flag to indicate if URL is a blob URL (for real-time sync)
    blobUrl?: string // Blob URL for displaying OPFS images in React
    imageId?: string // Image ID for OPFS storage manager
    storageType?: 'opfs' | 'filesystem' | 'indexeddb' | 'local'
    // Enhanced error handling properties
    loadError?: boolean
    retryCount?: number
    lastError?: string
    errorReason?: 'CORS_BLOCKED' | 'NETWORK_ERROR' | 'INVALID_URL' | 'UNSUPPORTED_FORMAT'
    fallbackMode?: boolean // Indicates if slice is using fallback due to CORS restrictions
  }
  // Additional metadata
  description?: string
  metadata?: {
    category?: string
    tags?: string[]
    priority?: number
  }
}

export interface ImageWheelConfig {
  id: string
  title: string
  description: string
  slices: ImageWheelSlice[]
  settings: {
    allowImageUpload: boolean
    maxImageSize: number // in MB
    allowedImageTypes: string[] // ['image/jpeg', 'image/png', 'image/gif']
    requireImageForAllSlices: boolean
    showImageInWheel: boolean
    showWinnerImage: boolean
    winnerImageSize: 'small' | 'medium' | 'large'
    imageDisplayMode: 'thumbnail' | 'full' | 'overlay'
  }
  createdAt: Date
  updatedAt: Date
  createdBy: string
}

export interface WinnerResult {
  slice: ImageWheelSlice
  angle: number
  timestamp: Date
  spinDuration: number
  showConfetti?: boolean
  showWinnerImage?: boolean
}

export interface ImageUploadProgress {
  sliceId: string
  progress: number
  status: 'idle' | 'uploading' | 'success' | 'error'
  error?: string
}

// Firebase Storage paths
export const IMAGE_STORAGE_PATHS = {
  WHEELS: 'wheels',
  SLICES: 'wheel-slices',
  WINNERS: 'winner-images'
} as const

// Image validation constants
export const IMAGE_CONFIG = {
  MAX_SIZE_MB: 5,
  ALLOWED_TYPES: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'],
  THUMBNAIL_SIZE: { width: 150, height: 150 },
  WHEEL_SLICE_SIZE: { width: 80, height: 80 },
  WINNER_SIZES: {
    small: { width: 200, height: 200 },
    medium: { width: 400, height: 400 },
    large: { width: 600, height: 600 }
  }
} as const

// Helper type for backward compatibility
export interface LegacyWheelSlice {
  id: string
  text: string
  color: string
  emoji?: string
}

// Utility function to convert legacy slice to image slice
export const convertToImageSlice = (legacySlice: LegacyWheelSlice): ImageWheelSlice => {
  return {
    ...legacySlice,
    image: undefined,
    description: undefined,
    metadata: undefined
  }
}

// Utility function to validate image file
export const validateImageFile = (file: File): { isValid: boolean; error?: string } => {
  // Check file size
  if (file.size > IMAGE_CONFIG.MAX_SIZE_MB * 1024 * 1024) {
    return { isValid: false, error: `File size must be less than ${IMAGE_CONFIG.MAX_SIZE_MB}MB` }
  }

  // Check file type
  if (!IMAGE_CONFIG.ALLOWED_TYPES.includes(file.type as any)) {
    return { 
      isValid: false, 
      error: `File type must be one of: ${IMAGE_CONFIG.ALLOWED_TYPES.join(', ')}` 
    }
  }

  return { isValid: true }
}

// Utility function to generate thumbnail URL
export const generateThumbnailUrl = (originalUrl: string, size: 'thumbnail' | 'wheel' | 'winner' = 'thumbnail'): string => {
  // In a real implementation, this would use a service like Cloudinary or Firebase Storage transforms
  // For now, return the original URL
  return originalUrl
}

export default {
  IMAGE_STORAGE_PATHS,
  IMAGE_CONFIG,
  convertToImageSlice,
  validateImageFile,
  generateThumbnailUrl
}
