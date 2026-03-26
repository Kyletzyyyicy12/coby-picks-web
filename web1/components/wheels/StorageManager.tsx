"use client"

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  HardDrive,
  Trash2,
  Download,
  Upload,
  AlertTriangle,
  CheckCircle,
  Info,
  Settings,
  RefreshCw
} from 'lucide-react'
import { toast } from "@/hooks/use-toast"
import { imageStorageManager, type StorageStats } from "@/lib/image-storage-manager"

interface StorageManagerProps {
  onStorageChange?: (stats: StorageStats) => void
  compact?: boolean
}

export function StorageManager({ onStorageChange, compact = false }: StorageManagerProps) {
  const [storageStats, setStorageStats] = useState<StorageStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [cleaning, setCleaning] = useState(false)
  const [showDetails, setShowDetails] = useState(!compact)

  useEffect(() => {
    loadStorageStats()

    // Auto-refresh every 30 seconds
    const interval = setInterval(loadStorageStats, 30000)
    return () => clearInterval(interval)
  }, [])

  const loadStorageStats = async () => {
    try {
      setLoading(true)
      const stats = await imageStorageManager.getStorageStats()
      setStorageStats(stats)
      onStorageChange?.(stats)
    } catch (error) {
      console.error('Error loading storage stats:', error)
      toast({
        title: "Storage Error",
        description: "Could not load storage information",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const handleCleanup = async () => {
    try {
      setCleaning(true)
      const deletedCount = await imageStorageManager.cleanupOldImages(30)

      toast({
        title: "Cleanup Complete",
        description: `Removed ${deletedCount} old images. Storage freed up!`
      })

      // Refresh stats
      await loadStorageStats()
    } catch (error) {
      console.error('Cleanup error:', error)
      toast({
        title: "Cleanup Failed",
        description: "Could not clean up old images",
        variant: "destructive"
      })
    } finally {
      setCleaning(false)
    }
  }

  const formatBytes = (bytes: number): string => {
    const units = ['B', 'KB', 'MB', 'GB', 'TB']
    let value = bytes
    let unitIndex = 0

    while (value >= 1024 && unitIndex < units.length - 1) {
      value /= 1024
      unitIndex++
    }

    return `${value.toFixed(1)} ${units[unitIndex]}`
  }

  const getUsagePercentage = (): number => {
    if (!storageStats || storageStats.total === 0) return 0
    return (storageStats.used / storageStats.total) * 100
  }

  const getUsageColor = (): string => {
    const percentage = getUsagePercentage()
    if (percentage > 90) return 'text-red-600'
    if (percentage > 75) return 'text-yellow-600'
    return 'text-green-600'
  }

  const getUsageBgColor = (): string => {
    const percentage = getUsagePercentage()
    if (percentage > 90) return 'bg-red-100'
    if (percentage > 75) return 'bg-yellow-100'
    return 'bg-green-100'
  }

  if (loading) {
    return (
      <Card className={`border-2 ${compact ? 'border-blue-200' : 'border-blue-300'}`}>
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span className="text-sm">Loading storage info...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (compact) {
    return (
      <div className={`p-3 rounded-lg border-2 ${getUsageBgColor()} ${getUsageColor()}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HardDrive className="h-4 w-4" />
            <span className="text-sm font-medium">
              {formatBytes(storageStats?.used || 0)} / {formatBytes(storageStats?.total || 0)}
            </span>
          </div>
          <Badge variant={getUsagePercentage() > 75 ? "destructive" : "secondary"} className="text-xs">
            {getUsagePercentage().toFixed(0)}%
          </Badge>
        </div>
        {getUsagePercentage() > 75 && (
          <Button
            onClick={handleCleanup}
            disabled={cleaning}
            size="sm"
            variant="outline"
            className="w-full mt-2 text-xs"
          >
            {cleaning ? (
              <>
                <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                Cleaning...
              </>
            ) : (
              <>
                <Trash2 className="h-3 w-3 mr-1" />
                Free Space
              </>
            )}
          </Button>
        )}
      </div>
    )
  }

  return (
    <Card className="border-2 border-blue-300">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <HardDrive className="h-5 w-5 text-blue-600" />
          Storage Management
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowDetails(!showDetails)}
            className="ml-auto"
          >
            <Settings className="h-4 w-4" />
          </Button>
        </CardTitle>
        <CardDescription>
          Manage your local image storage (up to 2GB+)
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {storageStats && (
          <>
            {/* Storage Overview */}
            <div className={`p-4 rounded-lg ${getUsageBgColor()}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Storage Usage</span>
                <Badge
                  variant={getUsagePercentage() > 75 ? "destructive" : "secondary"}
                  className="text-xs"
                >
                  {getUsagePercentage().toFixed(1)}%
                </Badge>
              </div>

              <Progress value={getUsagePercentage()} className="h-2 mb-2" />

              <div className="grid grid-cols-3 gap-4 text-sm">
                <div className="text-center">
                  <div className={`font-bold ${getUsageColor()}`}>
                    {formatBytes(storageStats.used)}
                  </div>
                  <div className="text-gray-600">Used</div>
                </div>
                <div className="text-center">
                  <div className="font-bold text-green-600">
                    {formatBytes(storageStats.available)}
                  </div>
                  <div className="text-gray-600">Available</div>
                </div>
                <div className="text-center">
                  <div className="font-bold text-blue-600">
                    {storageStats.images}
                  </div>
                  <div className="text-gray-600">Images</div>
                </div>
              </div>
            </div>

            {/* Storage Warnings */}
            {getUsagePercentage() > 90 && (
              <Alert className="border-red-200 bg-red-50">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-red-800">
                  Storage is almost full! Consider cleaning up old images to free space.
                </AlertDescription>
              </Alert>
            )}

            {getUsagePercentage() > 75 && getUsagePercentage() <= 90 && (
              <Alert className="border-yellow-200 bg-yellow-50">
                <Info className="h-4 w-4 text-yellow-600" />
                <AlertDescription className="text-yellow-800">
                  Storage usage is high. You may want to clean up old images soon.
                </AlertDescription>
              </Alert>
            )}

            {/* Storage Actions */}
            <div className="flex gap-2">
              <Button
                onClick={handleCleanup}
                disabled={cleaning || storageStats.images === 0}
                variant="outline"
                size="sm"
                className="flex-1"
              >
                {cleaning ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Cleaning...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Cleanup Old Images
                  </>
                )}
              </Button>

              <Button
                onClick={loadStorageStats}
                variant="outline"
                size="sm"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>

            {/* Detailed Information */}
            {showDetails && (
              <div className="space-y-3 pt-3 border-t">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="p-2 bg-gray-50 rounded">
                    <div className="font-medium text-gray-700">Total Capacity</div>
                    <div className="text-gray-600">{formatBytes(storageStats.total)}</div>
                  </div>
                  <div className="p-2 bg-gray-50 rounded">
                    <div className="font-medium text-gray-700">Images Stored</div>
                    <div className="text-gray-600">{storageStats.images} files</div>
                  </div>
                </div>

                {/* Storage Tips */}
                <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-start gap-2">
                    <Info className="h-4 w-4 text-blue-600 mt-0.5" />
                    <div className="text-sm text-blue-800">
                      <div className="font-medium mb-1">💡 Storage Tips:</div>
                      <ul className="space-y-1 text-xs">
                        <li>• Images are stored locally on your device</li>
                        <li>• Automatic cleanup removes images older than 30 days</li>
                        <li>• Large images are automatically compressed</li>
                        <li>• Storage is private and secure</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {!storageStats && (
          <div className="text-center py-4 text-gray-500">
            <HardDrive className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Unable to load storage information</p>
            <Button
              onClick={loadStorageStats}
              variant="outline"
              size="sm"
              className="mt-2"
            >
              <RefreshCw className="h-4 w-4 mr-1" />
              Retry
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}