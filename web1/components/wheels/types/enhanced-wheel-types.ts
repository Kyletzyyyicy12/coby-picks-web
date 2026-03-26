import { ImageWheelSlice, WinnerResult, ImageUploadProgress } from '@/types/image-wheel-types'

// Enhanced types for better type safety
export interface WheelDimensions {
  width: number
  height: number
  radius: number
  centerX: number
  centerY: number
}

export interface SpinAnimationConfig {
  duration: number
  minRotation: number
  maxRotation: number
  easingFunction: 'linear' | 'easeOut' | 'easeInOut'
}

export interface CanvasRenderingContext {
  clearRect: (x: number, y: number, width: number, height: number) => void
  beginPath: () => void
  moveTo: (x: number, y: number) => void
  arc: (x: number, y: number, radius: number, startAngle: number, endAngle: number) => void
  closePath: () => void
  fill: () => void
  stroke: () => void
  fillStyle: string | CanvasGradient | CanvasPattern
  strokeStyle: string | CanvasGradient | CanvasPattern
  lineWidth: number
  save: () => void
  restore: () => void
  clip: () => void
  drawImage: (image: CanvasImageSource, dx: number, dy: number, dw?: number, dh?: number) => void
  translate: (x: number, y: number) => void
  rotate: (angle: number) => void
  font: string
  textAlign: CanvasTextAlign
  textBaseline: CanvasTextBaseline
  fillText: (text: string, x: number, y: number) => void
  measureText: (text: string) => TextMetrics
}

export interface SliceRenderingOptions {
  showText: boolean
  showImage: boolean
  textColor: string
  textSize: number
  textFont: string
  imageScale: number
  imageOpacity: number
}

export interface WheelState {
  isSpinning: boolean
  currentRotation: number
  targetRotation: number
  spinStartTime: number
  duration: number
  progress: number
  winner?: WinnerResult
}

export interface RealtimeConnectionState {
  status: 'connected' | 'disconnected' | 'connecting' | 'error'
  lastHeartbeat?: number
  error?: string
  retryCount: number
}

export interface SliceValidationResult {
  isValid: boolean
  error?: string
  warnings?: string[]
}

export interface ImageValidationResult {
  isValid: boolean
  error?: string
  metadata?: {
    width: number
    height: number
    fileSize: number
    format: string
  }
}

export interface WheelPerformanceMetrics {
  renderTime: number
  memoryUsage: number
  frameRate: number
  lastUpdate: number
}

export interface BulkUploadState {
  isUploading: boolean
  progress: number
  totalFiles: number
  completedFiles: number
  errors: Array<{ file: string; error: string }>
  warnings: Array<{ file: string; warning: string }>
}

// Enhanced hook return types
export interface UseWheelCanvasReturn {
  canvasRef: React.RefObject<HTMLCanvasElement>
  drawWheel: () => void
  redraw: () => void
  getCanvasContext: () => CanvasRenderingContext2D | null
  clearCanvas: () => void
  getDimensions: () => WheelDimensions
}

export interface UseRealtimeSyncReturn {
  connectionStatus: RealtimeConnectionState['status']
  syncedSpinning: boolean
  error?: string
  broadcastSpinStart: (spinData: SpinAnimationConfig & { spinStartTime: number }) => Promise<void>
  broadcastSpinComplete: (winner: WinnerResult, finalRotation: number) => Promise<void>
  broadcastSpinProgress: (progress: number, currentAngle: number, elapsed: number, duration: number) => Promise<void>
  disconnect: () => void
}

export interface UseSliceManagerReturn {
  slices: ImageWheelSlice[]
  uploadProgress: Map<string, ImageUploadProgress>
  setUploadProgress: React.Dispatch<React.SetStateAction<Map<string, ImageUploadProgress>>>
  addSlice: () => void
  removeSlice: (sliceId: string) => void
  updateSlice: (sliceId: string, updates: Partial<ImageWheelSlice>) => void
  generateRandomSlices: (count: number, customTexts?: string[]) => void
  generateRandomPhotos: (count: number) => Promise<void>
  updateSlices: (slices: ImageWheelSlice[]) => void
  validateSlice: (slice: ImageWheelSlice) => SliceValidationResult
  reorderSlices: (fromIndex: number, toIndex: number) => void
}

export interface UseImageUploadReturn {
  handleImageUpload: (sliceId: string, file: File) => Promise<void>
  handleBulkImageUpload: (files: FileList) => Promise<void>
  removeSliceImage: (sliceId: string) => void
  validateImage: (file: File) => ImageValidationResult
  compressImage: (file: File, maxWidth?: number, maxHeight?: number, quality?: number) => Promise<File>
  getImageDimensions: (file: File) => Promise<{ width: number; height: number }>
}

export interface UseWheelSpinReturn {
  isSpinning: boolean
  currentRotation: number
  winner: WinnerResult | null
  setCurrentRotation: (rotation: number) => void
  spinWheel: (
    enableRealTimeSync?: boolean,
    sessionId?: string,
    organizerMode?: boolean,
    isLiveMode?: boolean,
    disabled?: boolean,
    broadcastSpinStart?: (spinData: any) => Promise<void>,
    broadcastSpinComplete?: (winner: WinnerResult, finalRotation: number) => Promise<void>,
    broadcastSpinProgress?: (progress: number, currentAngle: number, elapsed: number, duration: number) => Promise<void>
  ) => void
  reset: () => void
  pause: () => void
  resume: () => void
}

// Component prop interfaces
export interface WheelCanvasProps {
  slices: ImageWheelSlice[]
  size?: number
  isSpinning: boolean
  currentRotation: number
  onSpin: () => void
  disabled?: boolean
  className?: string
  style?: React.CSSProperties
  showPointer?: boolean
  pointerColor?: string
  backgroundColor?: string
  renderOptions?: SliceRenderingOptions
}

export interface SliceManagerProps {
  slices: ImageWheelSlice[]
  uploadProgress: Map<string, ImageUploadProgress>
  allowEdit?: boolean
  maxSlices?: number
  onSliceUpdate: (sliceId: string, updates: Partial<ImageWheelSlice>) => void
  onSliceRemove: (sliceId: string) => void
  onImageUpload: (sliceId: string, file: File) => void
  onImageRemove: (sliceId: string) => void
  onAddSlice: () => void
  onBulkUpload: () => void
  className?: string
  layout?: 'grid' | 'list'
  showProgress?: boolean
  showValidation?: boolean
}

export interface WinnerDisplayProps {
  winner: WinnerResult | null
  showWinner: boolean
  onClose: () => void
  showConfetti?: boolean
  autoClose?: boolean
  autoCloseDelay?: number
  customMessage?: string
  className?: string
}

// Event handler types
export type WheelSpinHandler = (event: { rotation: number; duration: number; winner?: WinnerResult }) => void
export type SliceChangeHandler = (slices: ImageWheelSlice[]) => void
export type WinnerHandler = (winner: WinnerResult) => void
export type ErrorHandler = (error: Error, context?: string) => void
export type ProgressHandler = (progress: number, context?: string) => void

// Configuration interfaces
export interface WheelConfig {
  size: number
  maxSlices: number
  animation: SpinAnimationConfig
  rendering: SliceRenderingOptions
  validation: {
    maxImageSize: number
    allowedFormats: string[]
    maxFileSize: number
  }
  realTime: {
    enabled: boolean
    heartbeatInterval: number
    retryAttempts: number
    retryDelay: number
  }
}

export interface ImagePickerWheelProps {
  initialSlices?: ImageWheelSlice[]
  onSpinComplete?: WinnerHandler
  onSlicesChange?: SliceChangeHandler
  onError?: ErrorHandler
  onProgress?: ProgressHandler
  size?: number
  showWinnerModal?: boolean
  allowEdit?: boolean
  maxSlices?: number
  config?: Partial<WheelConfig>
  // Real-time synchronization props
  enableRealTimeSync?: boolean
  sessionId?: string
  organizerMode?: boolean
  isLiveMode?: boolean
  disabled?: boolean
  className?: string
  'data-testid'?: string
}

// Error types
export class WheelError extends Error {
  constructor(
    message: string,
    public code: string,
    public context?: Record<string, any>
  ) {
    super(message)
    this.name = 'WheelError'
  }
}

export class ValidationError extends WheelError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 'VALIDATION_ERROR', context)
    this.name = 'ValidationError'
  }
}

export class NetworkError extends WheelError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 'NETWORK_ERROR', context)
    this.name = 'NetworkError'
  }
}

export class RenderingError extends WheelError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 'RENDERING_ERROR', context)
    this.name = 'RenderingError'
  }
}

// Utility types
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>
export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P]
}

// Constants
export const WHEEL_CONSTANTS = {
  DEFAULT_SIZE: 400,
  MIN_SLICES: 2,
  MAX_SLICES: 12,
  DEFAULT_ANIMATION_DURATION: 3000,
  MIN_ANIMATION_DURATION: 1000,
  MAX_ANIMATION_DURATION: 10000,
  CANVAS_SCALE_FACTOR: window.devicePixelRatio || 1,
  SUPPORTED_IMAGE_FORMATS: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  MAX_IMAGE_SIZE: 10 * 1024 * 1024, // 10MB
  MAX_IMAGE_DIMENSION: 4096,
  HEARTBEAT_INTERVAL: 30000,
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000,
} as const

export type WheelConstants = typeof WHEEL_CONSTANTS