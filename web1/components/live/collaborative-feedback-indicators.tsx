import React, { useState, useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Users, Wifi, WifiOff, Clock, AlertCircle, CheckCircle, RefreshCw as Sync, Zap } from 'lucide-react'
import EnhancedCollaborativeLiveRoomManager from '@/lib/enhanced-collaborative-live-room-manager'

interface ParticipantStatus {
  id: string
  name: string
  status: 'online' | 'syncing' | 'error' | 'offline'
  ping: number
  lastSeen: number
  isReady: boolean
  role: 'organizer' | 'collaborator' | 'participant'
}

interface CollaborativeFeedbackIndicatorsProps {
  sessionId: string
  currentUserId: string
  isOrganizer?: boolean
  participants: ParticipantStatus[]
  syncStatus?: 'idle' | 'syncing' | 'synced' | 'error'
  showDetailed?: boolean
}

export function CollaborativeFeedbackIndicators({
  sessionId,
  currentUserId,
  isOrganizer = false,
  participants,
  syncStatus = 'idle',
  showDetailed = false
}: CollaborativeFeedbackIndicatorsProps) {
  const [connectionQuality, setConnectionQuality] = useState<'excellent' | 'good' | 'poor' | 'offline'>('excellent')
  const [collaborativeManager] = useState(() => EnhancedCollaborativeLiveRoomManager.getInstance())

  // Calculate overall connection quality
  useEffect(() => {
    if (participants.length === 0) {
      setConnectionQuality('offline')
      return
    }

    const onlineCount = participants.filter(p => p.status === 'online').length
    const errorCount = participants.filter(p => p.status === 'error').length

    if (errorCount > 0) {
      setConnectionQuality('poor')
    } else if (onlineCount === participants.length) {
      setConnectionQuality('excellent')
    } else {
      setConnectionQuality('good')
    }
  }, [participants])

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'online':
        return <CheckCircle className="h-3 w-3 text-green-500" />
      case 'syncing':
        return <Sync className="h-3 w-3 text-yellow-500 animate-spin" />
      case 'error':
        return <AlertCircle className="h-3 w-3 text-red-500" />
      case 'offline':
        return <WifiOff className="h-3 w-3 text-gray-500" />
      default:
        return <Wifi className="h-3 w-3 text-gray-400" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
        return 'bg-green-100 text-green-700 border-green-300'
      case 'syncing':
        return 'bg-yellow-100 text-yellow-700 border-yellow-300'
      case 'error':
        return 'bg-red-100 text-red-700 border-red-300'
      case 'offline':
        return 'bg-gray-100 text-gray-700 border-gray-300'
      default:
        return 'bg-blue-100 text-blue-700 border-blue-300'
    }
  }

  const getSyncStatusColor = (status: string) => {
    switch (status) {
      case 'idle':
        return 'bg-gray-100 text-gray-700'
      case 'syncing':
        return 'bg-blue-100 text-blue-700 animate-pulse'
      case 'synced':
        return 'bg-green-100 text-green-700'
      case 'error':
        return 'bg-red-100 text-red-700'
      default:
        return 'bg-gray-100 text-gray-700'
    }
  }

  const formatLastSeen = (timestamp: number) => {
    const now = Date.now()
    const diff = now - timestamp
    const seconds = Math.floor(diff / 1000)
    const minutes = Math.floor(seconds / 60)

    if (seconds < 30) return 'Active now'
    if (minutes < 1) return `${seconds}s ago`
    if (minutes < 60) return `${minutes}m ago`
    return new Date(timestamp).toLocaleTimeString()
  }

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'organizer':
        return <Users className="h-3 w-3 text-purple-600" />
      case 'collaborator':
        return <Zap className="h-3 w-3 text-orange-600" />
      default:
        return <Users className="h-3 w-3 text-blue-600" />
    }
  }

  // Compact view (always visible)
  if (!showDetailed) {
    return (
      <Card className="border-2">
        <CardContent className="p-3">
          <div className="flex items-center gap-3">
            {/* Connection Status */}
            <div className="flex items-center gap-2">
              {connectionQuality === 'excellent' && <Wifi className="h-4 w-4 text-green-500" />}
              {connectionQuality === 'good' && <Wifi className="h-4 w-4 text-yellow-500" />}
              {connectionQuality === 'poor' && <WifiOff className="h-4 w-4 text-red-500" />}
              {connectionQuality === 'offline' && <WifiOff className="h-4 w-4 text-gray-500" />}

              <Badge variant="secondary" className={`${getSyncStatusColor(syncStatus)} px-2 py-1`}>
                {syncStatus === 'syncing' && '🔄 Syncing...'}
                {syncStatus === 'synced' && '✅ In Sync'}
                {syncStatus === 'error' && '❌ Sync Error'}
                {syncStatus === 'idle' && '⏸️ Ready'}
              </Badge>
            </div>

            {/* Participant Summary */}
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <div className="flex items-center gap-1">
                <Users className="h-4 w-4" />
                <span className="font-medium">{participants.length}</span>
                <span>connected</span>
              </div>

              <div className="flex items-center gap-1">
                {participants.filter(p => p.status === 'online').length} online
              </div>

              {participants.filter(p => p.status === 'syncing').length > 0 && (
                <div className="flex items-center gap-1 text-yellow-600">
                  {participants.filter(p => p.status === 'syncing').length} syncing
                </div>
              )}

              {participants.filter(p => p.status === 'error').length > 0 && (
                <div className="flex items-center gap-1 text-red-600">
                  {participants.filter(p => p.status === 'error').length} issue
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Detailed view
  return (
    <div className="space-y-4">
      {/* Overall Status */}
      <Card className="border-2">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-600" />
              <h3 className="font-semibold text-lg">Collaborative Room Status</h3>
            </div>

            <div className="flex items-center gap-2">
              <Badge variant="secondary" className={`${getSyncStatusColor(syncStatus)} px-3 py-1 text-sm font-medium`}>
                {syncStatus === 'syncing' && (
                  <>
                    <Sync className="h-3 w-3 mr-1 animate-spin" />
                    Synchronizing...
                  </>
                )}
                {syncStatus === 'synced' && (
                  <>
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Perfect Sync
                  </>
                )}
                {syncStatus === 'error' && (
                  <>
                    <AlertCircle className="h-3 w-3 mr-1" />
                    Sync Issues
                  </>
                )}
                {syncStatus === 'idle' && (
                  <>
                    <Clock className="h-3 w-3 mr-1" />
                    Ready
                  </>
                )}
              </Badge>
            </div>
          </div>

          {/* Connection Quality Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div className="space-y-1">
              <div className={`text-2xl font-bold ${
                connectionQuality === 'excellent' ? 'text-green-600' :
                connectionQuality === 'good' ? 'text-yellow-600' :
                connectionQuality === 'poor' ? 'text-red-600' : 'text-gray-600'
              }`}>
                {connectionQuality === 'excellent' ? '🟢' :
                 connectionQuality === 'good' ? '🟡' :
                 connectionQuality === 'poor' ? '🔴' : '⚫'}
              </div>
              <div className="text-sm font-medium">Connection</div>
              <div className="text-xs text-gray-600 capitalize">{connectionQuality}</div>
            </div>

            <div className="space-y-1">
              <div className="text-2xl font-bold text-blue-600">
                {participants.length}
              </div>
              <div className="text-sm font-medium">Total</div>
              <div className="text-xs text-gray-600">Participants</div>
            </div>

            <div className="space-y-1">
              <div className="text-2xl font-bold text-green-600">
                {participants.filter(p => p.status === 'online').length}
              </div>
              <div className="text-sm font-medium">Online</div>
              <div className="text-xs text-gray-600">Active Now</div>
            </div>

            <div className="space-y-1">
              <div className="text-2xl font-bold text-purple-600">
                {participants.filter(p => p.isReady).length}
              </div>
              <div className="text-sm font-medium">Ready</div>
              <div className="text-xs text-gray-600">Synchronized</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Individual Participant Status */}
      {participants.length > 0 && (
        <Card className="border-2">
          <CardContent className="p-4">
            <h4 className="font-semibold mb-4 flex items-center gap-2">
              <Users className="h-4 w-4" />
              Participant Status ({participants.length})
            </h4>

            <div className="space-y-3 max-h-64 overflow-y-auto">
              {participants.map(participant => (
                <div
                  key={participant.id}
                  className={`flex items-center justify-between p-3 rounded-lg border-2 transition-all ${
                    getStatusColor(participant.status)
                  } ${participant.id === currentUserId ? 'ring-2 ring-blue-300' : ''}`}
                >
                  <div className="flex items-center gap-3">
                    {/* Status Indicator */}
                    <div className="flex items-center gap-1">
                      {getStatusIcon(participant.status)}
                      {getRoleIcon(participant.role)}
                    </div>

                    {/* Participant Info */}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {participant.name}
                          {participant.id === currentUserId && (
                            <Badge variant="outline" className="ml-2 text-xs px-1 py-0">
                              You
                            </Badge>
                          )}
                        </span>
                        <Badge variant="secondary" className="text-xs px-1 py-0 capitalize">
                          {participant.role}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-gray-600 capitalize">
                          {participant.status}
                        </span>

                        {participant.ping > -1 && (
                          <span className="text-xs text-gray-600">
                            🎯 {participant.ping}ms ping
                          </span>
                        )}

                        <span className="text-xs text-gray-600">
                          {formatLastSeen(participant.lastSeen)}
                        </span>

                        {participant.isReady && (
                          <Badge variant="secondary" className="text-xs px-1 py-0 bg-green-100 text-green-700">
                            <CheckCircle className="h-2 w-2 mr-1" />
                            Ready
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Ready Check */}
                  <div className="text-right">
                    {participant.isReady ? (
                      <div className="flex items-center gap-1 text-green-700">
                        <CheckCircle className="h-4 w-4" />
                        <span className="text-xs font-medium">Ready</span>
                      </div>
                    ) : participant.status === 'syncing' ? (
                      <div className="flex items-center gap-1 text-yellow-700">
                        <Sync className="h-4 w-4 animate-spin" />
                        <span className="text-xs font-medium">Syncing...</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-red-700">
                        <AlertCircle className="h-4 w-4" />
                        <span className="text-xs font-medium">Issue</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Help Text */}
      {connectionQuality !== 'excellent' && (
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="p-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-orange-600 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-orange-800 mb-1">
                  Synchronization Tips
                </p>
                <ul className="text-orange-700 space-y-0.5 text-xs">
                  <li>• Ensure reliable internet connection</li>
                  <li>• Close other browser tabs or applications</li>
                  <li>• Try refreshing if sync issues persist</li>
                  <li>• Check if other participants are experiencing the same issues</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}