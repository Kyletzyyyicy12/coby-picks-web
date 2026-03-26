"use client"

import React from 'react'
import { Card, CardContent } from "@/components/ui/card"
import { Loader2, ImageIcon } from 'lucide-react'

interface LoadingSpinnerProps {
  message?: string
  size?: 'sm' | 'md' | 'lg'
  showProgress?: boolean
  progress?: number
  className?: string
}

export function LoadingSpinner({
  message = 'Loading...',
  size = 'md',
  showProgress = false,
  progress,
  className = ''
}: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12'
  }

  const containerClasses = {
    sm: 'gap-2 p-4',
    md: 'gap-3 p-6',
    lg: 'gap-4 p-8'
  }

  return (
    <Card className={`w-full max-w-md mx-auto ${className}`}>
      <CardContent className={`flex flex-col items-center justify-center text-center ${containerClasses[size]}`}>
        <div className="relative">
          <Loader2 className={`${sizeClasses[size]} animate-spin text-blue-500`} />
          <div className="absolute inset-0 flex items-center justify-center">
            <ImageIcon className={`${size === 'sm' ? 'h-2 w-2' : size === 'md' ? 'h-3 w-3' : 'h-4 w-4'} text-blue-300`} />
          </div>
        </div>

        <div className="space-y-2">
          <p className={`text-gray-600 ${size === 'sm' ? 'text-sm' : size === 'md' ? 'text-base' : 'text-lg'}`}>
            {message}
          </p>

          {showProgress && typeof progress === 'number' && (
            <div className="w-full max-w-xs">
              <div className="bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {Math.round(progress)}% complete
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// Skeleton loader for wheel preview
export function WheelSkeleton({ size = 400, className = '' }: { size?: number; className?: string }) {
  return (
    <div
      className={`relative mx-auto bg-gray-100 border-4 border-gray-200 rounded-full animate-pulse ${className}`}
      style={{ width: size, height: size }}
    >
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center space-y-2">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400 mx-auto" />
          <p className="text-sm text-gray-500">Loading wheel...</p>
        </div>
      </div>
    </div>
  )
}

// Loading state for slice management
export function SliceManagerSkeleton({ sliceCount = 4, className = '' }: { sliceCount?: number; className?: string }) {
  return (
    <Card className={className}>
      <CardContent className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: sliceCount }).map((_, index) => (
            <Card key={index} className="animate-pulse">
              <CardContent className="p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 bg-gray-200 rounded-full" />
                  <div className="flex-1">
                    <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
                    <div className="h-3 bg-gray-200 rounded w-1/2" />
                  </div>
                  <div className="w-6 h-6 bg-gray-200 rounded" />
                </div>
                <div className="w-full h-32 bg-gray-200 rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}