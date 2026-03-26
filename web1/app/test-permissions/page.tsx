"use client"

import React, { useState } from 'react'
import { PermissionMappingDemo } from '@/components/organizer/permission-mapping-demo'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import {
  Users,
  Crown,
  Play,
  Target,
  Eye,
  Settings,
  TestTube,
  CheckCircle,
  AlertCircle
} from "lucide-react"

export default function TestPermissionsPage() {
  const [selectedPermission, setSelectedPermission] = useState<'full' | 'view'>('full')
  const [collaborators, setCollaborators] = useState("teacher2@example.com, coord@example.com")
  const [showDemo, setShowDemo] = useState(false)

  const permissionOptions = [
    {
      value: 'full',
      label: 'Full Access (Control, Edit, Manage)',
      description: 'Complete organizer-level control',
      icon: <Crown className="h-4 w-4" />,
      color: 'bg-green-100 text-green-800'
    },
    {
      value: 'view',
      label: 'View Only',
      description: 'Read-only access',
      icon: <Eye className="h-4 w-4" />,
      color: 'bg-gray-100 text-gray-800'
    }
  ]

  const selectedOption = permissionOptions.find(opt => opt.value === selectedPermission)

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <Card className="border-2 border-blue-500 bg-gradient-to-r from-blue-50 to-indigo-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-3 text-blue-900">
              <TestTube className="h-6 w-6" />
              Collaborator Permissions Test Suite
            </CardTitle>
            <CardDescription className="text-blue-700">
              Test and verify collaborator permission mappings for live room sessions
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Test Configuration */}
        <Card className="border-2 border-green-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-3 text-green-900">
              <Settings className="h-5 w-5" />
              Test Configuration
            </CardTitle>
            <CardDescription className="text-green-700">
              Configure the permission test scenario
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Permission Level Selection */}
            <div className="space-y-3">
              <Label className="text-base font-semibold text-gray-900">
                Default Permissions for Collaborators
              </Label>
              <Select
                value={selectedPermission}
                onValueChange={(value: any) => setSelectedPermission(value)}
              >
                <SelectTrigger className="w-full h-12">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {permissionOptions.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="flex items-center gap-3">
                        {option.icon}
                        <div>
                          <div className="font-medium">{option.label}</div>
                          <div className="text-xs text-muted-foreground">{option.description}</div>
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Selected Permission Display */}
              {selectedOption && (
                <div className="mt-3 p-4 bg-gradient-to-r from-green-50 to-blue-50 rounded-lg border border-green-200">
                  <div className="flex items-center gap-3">
                    <Badge className={`${selectedOption.color} px-3 py-1`}>
                      {selectedOption.icon}
                      <span className="ml-2">{selectedOption.label}</span>
                    </Badge>
                    <span className="text-sm text-gray-700">{selectedOption.description}</span>
                  </div>
                </div>
              )}
            </div>

            <Separator />

            {/* Collaborator Emails */}
            <div className="space-y-3">
              <Label className="text-base font-semibold text-gray-900">
                Add Collaborators (emails, comma-separated)
              </Label>
              <Input
                value={collaborators}
                onChange={(e) => setCollaborators(e.target.value)}
                placeholder="teacher2@example.com, coord@example.com"
                className="h-12"
              />

              {/* Collaborator Preview */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">Collaborator Preview:</Label>
                <div className="flex flex-wrap gap-2">
                  {collaborators.split(',').map((email, index) => {
                    const trimmedEmail = email.trim()
                    if (!trimmedEmail) return null
                    return (
                      <Badge key={index} variant="outline" className="px-3 py-1">
                        <Users className="h-3 w-3 mr-2" />
                        {trimmedEmail}
                        <Badge variant="secondary" className="ml-2 text-xs">
                          {selectedPermission.toUpperCase()}
                        </Badge>
                      </Badge>
                    )
                  })}
                </div>
              </div>
            </div>

            <Separator />

            {/* Test Action */}
            <div className="flex justify-center">
              <Button
                onClick={() => setShowDemo(!showDemo)}
                className="px-8 py-3 text-lg font-semibold bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                size="lg"
              >
                {showDemo ? 'Hide' : 'Show'} Permission Mapping Demo
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Permission Mapping Demo */}
        {showDemo && (
          <div className="space-y-6">
            <Card className="border-2 border-yellow-500 bg-gradient-to-r from-yellow-50 to-orange-50">
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-yellow-900">
                  <CheckCircle className="h-5 w-5" />
                  Test Results: Permission Mapping for Selected Configuration
                </CardTitle>
                <CardDescription className="text-yellow-700">
                  This shows exactly what permissions will be granted when the organizer creates a live session
                </CardDescription>
              </CardHeader>
            </Card>

            <PermissionMappingDemo
              selectedPermission={selectedPermission}
              collaborators={collaborators.split(',').map(email => email.trim()).filter(email => email.length > 0)}
            />
          </div>
        )}

        {/* Test Summary */}
        <Card className="border-2 border-purple-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-3 text-purple-900">
              <AlertCircle className="h-5 w-5" />
              Test Summary & Expected Behavior
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <h4 className="font-semibold text-purple-900">When Organizer Sets:</h4>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Crown className="h-4 w-4 text-green-600" />
                    <span className="text-sm">Full Access (Control, Edit, Manage)</span>
                  </div>
                  <p className="text-xs text-gray-600 ml-6">
                    Collaborators get complete organizer-level control
                  </p>
                </div>


                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Eye className="h-4 w-4 text-gray-600" />
                    <span className="text-sm">View Only</span>
                  </div>
                  <p className="text-xs text-gray-600 ml-6">
                    Collaborators can only view the session
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="font-semibold text-purple-900">Technical Implementation:</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span>Permissions stored in session.collaboratorDetails</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span>LiveDrawManager enforces permissions via userPermissions</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span>EnhancedWheel component respects permission flags</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span>Real-time synchronization for Full Access collaborators</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}