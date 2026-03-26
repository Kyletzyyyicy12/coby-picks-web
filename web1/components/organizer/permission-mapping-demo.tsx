"use client"

import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  Crown,
  Users,
  Play,
  Edit,
  Eye,
  Settings,
  Palette,
  Type,
  RotateCcw,
  Target,
  Shield,
  CheckCircle,
  XCircle,
  Zap,
  Radio,
  QrCode
} from "lucide-react"

interface PermissionLevel {
  id: 'full' | 'view'
  title: string
  description: string
  icon: React.ReactNode
  color: string
  capabilities: {
    canControlLive: boolean
    canEditWheel: boolean
    canManageParticipants: boolean
    canViewOnly: boolean
    canEndSession: boolean
    canInviteOthers: boolean
    canChangeTheme: boolean
    canEditText: boolean
    canTriggerSynchronizedSpin: boolean
    canAccessAllWheelControls: boolean
  }
}

const PERMISSION_LEVELS: PermissionLevel[] = [
  {
    id: 'full',
    title: 'Full Access (Control, Edit, Manage)',
    description: 'Complete organizer-level control over the live session',
    icon: <Crown className="h-5 w-5" />,
    color: 'bg-green-100 text-green-800 border-green-300',
    capabilities: {
      canControlLive: true,
      canEditWheel: true,
      canManageParticipants: true,
      canViewOnly: false,
      canEndSession: false, // Only primary organizer can end
      canInviteOthers: false,
      canChangeTheme: true,
      canEditText: true,
      canTriggerSynchronizedSpin: true,
      canAccessAllWheelControls: true
    }
  },
  {
    id: 'view',
    title: 'View Only',
    description: 'Can only view the session, cannot interact or make changes',
    icon: <Eye className="h-5 w-5" />,
    color: 'bg-gray-100 text-gray-800 border-gray-300',
    capabilities: {
      canControlLive: false,
      canEditWheel: false,
      canManageParticipants: false,
      canViewOnly: true,
      canEndSession: false,
      canInviteOthers: false,
      canChangeTheme: false,
      canEditText: false,
      canTriggerSynchronizedSpin: false,
      canAccessAllWheelControls: false
    }
  }
]

interface PermissionMappingDemoProps {
  selectedPermission?: 'full' | 'view'
  collaborators?: string[]
}

export function PermissionMappingDemo({
  selectedPermission = 'full',
  collaborators = ["teacher2@example.com", "coord@example.com"]
}: PermissionMappingDemoProps) {
  const selectedLevel = PERMISSION_LEVELS.find(level => level.id === selectedPermission)

  const getCapabilityIcon = (enabled: boolean) => {
    return enabled ? (
      <CheckCircle className="h-4 w-4 text-green-600" />
    ) : (
      <XCircle className="h-4 w-4 text-red-500" />
    )
  }

  const getCapabilityText = (enabled: boolean) => {
    return enabled ? '✅ Enabled' : '❌ Disabled'
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="border-2 border-blue-500 bg-gradient-to-r from-blue-50 to-indigo-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-blue-900">
            <Shield className="h-6 w-6" />
            Collaborator Permission Mapping Demo
          </CardTitle>
          <CardDescription className="text-blue-700">
            Detailed breakdown of what each permission level provides to collaborators
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Current Selection Display */}
      <Card className="border-2 border-green-500">
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-green-900">
            <Radio className="h-5 w-5" />
            Current Organizer Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium text-gray-700">Selected Permission Level:</Label>
              <div className="mt-2">
                <Badge className={`${selectedLevel?.color} px-3 py-1 text-sm font-medium`}>
                  {selectedLevel?.icon}
                  <span className="ml-2">{selectedLevel?.title}</span>
                </Badge>
              </div>
            </div>

            <div>
              <Label className="text-sm font-medium text-gray-700">Invited Collaborators:</Label>
              <div className="mt-2 space-y-1">
                {collaborators.map((email, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-blue-600" />
                    <span className="text-sm font-mono bg-blue-50 px-2 py-1 rounded">
                      {email}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {selectedLevel?.id.toUpperCase()}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <Separator />

          <div className="bg-green-50 p-4 rounded-lg border border-green-200">
            <h4 className="font-semibold text-green-900 mb-2">What These Collaborators Will Receive:</h4>
            <p className="text-green-800 text-sm">
              When the organizer creates a live session with "{selectedLevel?.title}" permissions,
              collaborators <strong>{collaborators.join(' and ')}</strong> will have access to:
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Permission Breakdown */}
      <Card className="border-2 border-purple-500">
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-purple-900">
            <Settings className="h-5 w-5" />
            Detailed Permission Breakdown
          </CardTitle>
          <CardDescription className="text-purple-700">
            Exact capabilities granted to collaborators with {selectedLevel?.title}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Live Session Control */}
            <div className="space-y-3">
              <h4 className="font-semibold text-lg flex items-center gap-2">
                <Radio className="h-5 w-5 text-purple-600" />
                Live Session Control
              </h4>
              <div className="space-y-2 pl-7">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Control live sessions</span>
                  {getCapabilityIcon(selectedLevel?.capabilities.canControlLive || false)}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">End session</span>
                  {getCapabilityIcon(selectedLevel?.capabilities.canEndSession || false)}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Invite others</span>
                  {getCapabilityIcon(selectedLevel?.capabilities.canInviteOthers || false)}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Manage participants</span>
                  {getCapabilityIcon(selectedLevel?.capabilities.canManageParticipants || false)}
                </div>
              </div>
            </div>

            {/* Wheel Control */}
            <div className="space-y-3">
              <h4 className="font-semibold text-lg flex items-center gap-2">
                <Target className="h-5 w-5 text-purple-600" />
                Wheel Control
              </h4>
              <div className="space-y-2 pl-7">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Control wheel</span>
                  {getCapabilityIcon(selectedLevel?.capabilities.canControlLive || false)}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Edit wheel settings</span>
                  {getCapabilityIcon(selectedLevel?.capabilities.canEditWheel || false)}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Edit wheel content</span>
                  {getCapabilityIcon(selectedLevel?.capabilities.canEditText || false)}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Synchronized spinning</span>
                  {getCapabilityIcon(selectedLevel?.capabilities.canTriggerSynchronizedSpin || false)}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Full wheel controls</span>
                  {getCapabilityIcon(selectedLevel?.capabilities.canAccessAllWheelControls || false)}
                </div>
              </div>
            </div>

            {/* Appearance & Content */}
            <div className="space-y-3">
              <h4 className="font-semibold text-lg flex items-center gap-2">
                <Palette className="h-5 w-5 text-purple-600" />
                Appearance & Content
              </h4>
              <div className="space-y-2 pl-7">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Change theme</span>
                  {getCapabilityIcon(selectedLevel?.capabilities.canChangeTheme || false)}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Edit text content</span>
                  {getCapabilityIcon(selectedLevel?.capabilities.canEditText || false)}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">View only mode</span>
                  {getCapabilityIcon(selectedLevel?.capabilities.canViewOnly || false)}
                </div>
              </div>
            </div>

            {/* Summary */}
            <div className="space-y-3">
              <h4 className="font-semibold text-lg flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-purple-600" />
                Permission Summary
              </h4>
              <div className="bg-purple-50 p-3 rounded-lg border border-purple-200">
                <p className="text-sm text-purple-800">
                  <strong>{selectedLevel?.title}</strong> collaborators will have{' '}
                  <strong>
                    {Object.values(selectedLevel?.capabilities || {}).filter(Boolean).length}
                  </strong> out of{' '}
                  <strong>{Object.keys(selectedLevel?.capabilities || {}).length}</strong> possible capabilities.
                </p>
                <div className="mt-2 text-xs text-purple-700">
                  {selectedLevel?.id === 'full' && (
                    <span>🎯 Same level of control as the primary organizer</span>
                  )}
                  {selectedLevel?.id === 'view' && (
                    <span>👁️ Can only observe the live session</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Technical Implementation Details */}
      <Card className="border-2 border-orange-500">
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-orange-900">
            <Zap className="h-5 w-5" />
            Technical Implementation
          </CardTitle>
          <CardDescription className="text-orange-700">
            How these permissions are stored and enforced in the system
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
              <h5 className="font-semibold text-orange-900 mb-2">Permission Object Structure:</h5>
              <pre className="text-xs bg-white p-2 rounded border overflow-x-auto">
{JSON.stringify({
  canControlLive: selectedLevel?.capabilities.canControlLive,
  canEditWheel: selectedLevel?.capabilities.canEditWheel,
  canManageParticipants: selectedLevel?.capabilities.canManageParticipants,
  canViewOnly: selectedLevel?.capabilities.canViewOnly,
  canEndSession: selectedLevel?.capabilities.canEndSession,
  canInviteOthers: selectedLevel?.capabilities.canInviteOthers,
  canChangeTheme: selectedLevel?.capabilities.canChangeTheme,
  canEditText: selectedLevel?.capabilities.canEditText,
  canTriggerSynchronizedSpin: selectedLevel?.capabilities.canTriggerSynchronizedSpin,
  canAccessAllWheelControls: selectedLevel?.capabilities.canAccessAllWheelControls
}, null, 2)}
              </pre>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                <h6 className="font-semibold text-blue-900 mb-1">Storage Location:</h6>
                <p className="text-sm text-blue-800">
                  <code>liveDrawSessions/{'{sessionId}'}/collaboratorDetails</code>
                </p>
              </div>

              <div className="bg-green-50 p-3 rounded-lg border border-green-200">
                <h6 className="font-semibold text-green-900 mb-1">Enforcement:</h6>
                <p className="text-sm text-green-800">
                  <code>LiveDrawManager.getCollaboratorPermissions()</code>
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* All Permission Levels Comparison */}
      <Card className="border-2 border-indigo-500">
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-indigo-900">
            <Shield className="h-5 w-5" />
            All Permission Levels Comparison
          </CardTitle>
          <CardDescription className="text-indigo-700">
            Complete overview of all available permission levels
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-indigo-50">
                  <th className="border border-indigo-200 p-3 text-left font-semibold text-indigo-900">Capability</th>
                  {PERMISSION_LEVELS.map(level => (
                    <th key={level.id} className="border border-indigo-200 p-3 text-center font-semibold text-indigo-900 min-w-[120px]">
                      <div className="flex flex-col items-center gap-1">
                        {level.icon}
                        <span className="text-xs">{level.title}</span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.keys(PERMISSION_LEVELS[0].capabilities).map(capability => (
                  <tr key={capability} className="hover:bg-gray-50">
                    <td className="border border-indigo-200 p-3 font-medium text-gray-700">
                      {capability.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                    </td>
                    {PERMISSION_LEVELS.map(level => (
                      <td key={level.id} className="border border-indigo-200 p-3 text-center">
                        {level.capabilities[capability as keyof typeof level.capabilities] ? (
                          <CheckCircle className="h-5 w-5 text-green-600 mx-auto" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-500 mx-auto" />
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// Helper component for labels (if not imported)
function Label({ children, className, ...props }: { children: React.ReactNode, className?: string, [key: string]: any }) {
  return (
    <label className={`text-sm font-medium text-gray-700 ${className || ''}`} {...props}>
      {children}
    </label>
  )
}