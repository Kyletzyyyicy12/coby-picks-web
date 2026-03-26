// Main components


// Sub-components
export { WheelCanvas } from './components/WheelCanvas'
export { BulkUploadDialog } from './components/BulkUploadDialog'
export { WinnerDisplay } from './components/WinnerDisplay'
export { WheelErrorBoundary } from './components/ErrorBoundary'
export { LoadingSpinner, WheelSkeleton, SliceManagerSkeleton } from './components/LoadingSpinner'

// Hooks
export { useWheelCanvas } from './hooks/useWheelCanvas'
export { useRealtimeSync } from './hooks/useRealtimeSync'
export { useSliceManager } from './hooks/useSliceManager'
export { useImageUpload } from './hooks/useImageUpload'
export { useWheelSpin } from './hooks/useWheelSpin'
export { usePerformanceMonitor } from './hooks/usePerformanceMonitor'

// Enhanced types
export type {
  // Enhanced types
  WheelDimensions,
  SpinAnimationConfig,
  CanvasRenderingContext,
  SliceRenderingOptions,
  WheelState,
  RealtimeConnectionState,
  SliceValidationResult,
  ImageValidationResult,
  WheelPerformanceMetrics,
  BulkUploadState,
  WheelCanvasProps,
  SliceManagerProps,
  WinnerDisplayProps,
  WheelSpinHandler,
  SliceChangeHandler,
  WinnerHandler,
  ErrorHandler,
  ProgressHandler,
  WheelConfig,
  ImagePickerWheelProps,
  WheelError,
  ValidationError,
  NetworkError,
  RenderingError,
  Optional,
  RequiredFields,
  DeepPartial,
  WheelConstants,

  // Hook return types
  UseWheelCanvasReturn,
  UseRealtimeSyncReturn,
  UseSliceManagerReturn,
  UseImageUploadReturn,
  UseWheelSpinReturn,
} from './types/enhanced-wheel-types'

// Re-export original types for convenience
export type {
  ImageWheelSlice as Slice,
  WinnerResult as Winner,
  ImageUploadProgress as UploadProgress,
} from '@/types/image-wheel-types'

// Utility functions
export { validateImageFile } from '@/types/image-wheel-types'