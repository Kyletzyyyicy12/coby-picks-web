"use client"

import { useState, useEffect, useCallback, useRef } from 'react'
import { WheelPerformanceMetrics } from '../types/enhanced-wheel-types'

interface PerformanceMonitorOptions {
  enabled?: boolean
  sampleRate?: number // How often to sample (in ms)
  maxSamples?: number
  onMetricsUpdate?: (metrics: WheelPerformanceMetrics) => void
}

export function usePerformanceMonitor({
  enabled = true,
  sampleRate = 1000,
  maxSamples = 60,
  onMetricsUpdate
}: PerformanceMonitorOptions = {}) {
  const [metrics, setMetrics] = useState<WheelPerformanceMetrics>({
    renderTime: 0,
    memoryUsage: 0,
    frameRate: 0,
    lastUpdate: Date.now()
  })

  const samplesRef = useRef<number[]>([])
  const lastFrameTimeRef = useRef<number>(0)
  const frameCountRef = useRef<number>(0)

  // Monitor frame rate
  useEffect(() => {
    if (!enabled) return

    let animationId: number

    const measureFrameRate = (currentTime: number) => {
      frameCountRef.current++

      if (lastFrameTimeRef.current > 0) {
        const deltaTime = currentTime - lastFrameTimeRef.current
        const fps = 1000 / deltaTime

        // Store sample
        samplesRef.current.push(fps)
        if (samplesRef.current.length > maxSamples) {
          samplesRef.current.shift()
        }

        // Calculate average FPS
        const averageFps = samplesRef.current.reduce((a, b) => a + b, 0) / samplesRef.current.length

        setMetrics(prev => ({
          ...prev,
          frameRate: Math.round(averageFps),
          lastUpdate: Date.now()
        }))
      }

      lastFrameTimeRef.current = currentTime
      animationId = requestAnimationFrame(measureFrameRate)
    }

    animationId = requestAnimationFrame(measureFrameRate)

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId)
      }
    }
  }, [enabled, maxSamples])

  // Monitor memory usage and render performance
  const recordMetrics = useCallback((operation: string, startTime: number) => {
    if (!enabled) return

    const endTime = performance.now()
    const duration = endTime - startTime

    // Get memory usage if available
    let memoryUsage = 0
    if ('memory' in performance) {
      memoryUsage = (performance as any).memory.usedJSHeapSize / 1024 / 1024 // MB
    }

    const newMetrics: WheelPerformanceMetrics = {
      renderTime: duration,
      memoryUsage: Math.round(memoryUsage * 100) / 100,
      frameRate: metrics.frameRate,
      lastUpdate: Date.now()
    }

    setMetrics(newMetrics)
    onMetricsUpdate?.(newMetrics)

    // Log slow operations in development
    if (process.env.NODE_ENV === 'development' && duration > 16) {
      console.warn(`Slow ${operation}: ${duration.toFixed(2)}ms`)
    }
  }, [enabled, metrics.frameRate, onMetricsUpdate])

  // Start timing for an operation
  const startTiming = useCallback(() => {
    return performance.now()
  }, [])

  // Monitor canvas performance specifically
  const monitorCanvasRender = useCallback((canvas: HTMLCanvasElement) => {
    if (!enabled || !canvas) return

    const startTime = performance.now()

    // Check if canvas context is hardware accelerated
    const context = canvas.getContext('2d')
    if (context) {
      const imageData = context.getImageData(0, 0, 1, 1)
      // This forces a GPU sync if hardware accelerated
    }

    recordMetrics('canvas_render', startTime)
  }, [enabled, recordMetrics])

  // Monitor image loading performance
  const monitorImageLoad = useCallback((img: HTMLImageElement, src: string) => {
    if (!enabled) return

    const startTime = performance.now()

    return new Promise<void>((resolve) => {
      const originalOnload = img.onload
      const originalOnerror = img.onerror

      img.onload = (event) => {
        recordMetrics(`image_load:${src}`, startTime)
        originalOnload?.call(img, event)
        resolve()
      }

      img.onerror = (event) => {
        recordMetrics(`image_load_error:${src}`, startTime)
        originalOnerror?.call(img, event)
        resolve()
      }
    })
  }, [enabled, recordMetrics])

  // Get performance recommendations
  const getRecommendations = useCallback(() => {
    const recommendations: string[] = []

    if (metrics.frameRate < 30) {
      recommendations.push('Frame rate is low. Consider reducing wheel complexity or image sizes.')
    }

    if (metrics.memoryUsage > 50) {
      recommendations.push('High memory usage detected. Consider reducing the number of cached images.')
    }

    if (metrics.renderTime > 16) {
      recommendations.push('Slow render times detected. Consider optimizing canvas operations.')
    }

    return recommendations
  }, [metrics])

  return {
    metrics,
    recordMetrics,
    startTiming,
    monitorCanvasRender,
    monitorImageLoad,
    getRecommendations,
    isEnabled: enabled
  }
}