"use client"

import dynamic from "next/dynamic"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ImageWheelSlice } from "@/types/image-wheel-types"

const ImagePickerWheel = dynamic(() => import("@/components/picker-wheels/image-picker-wheel").then(mod => ({default: mod.ImagePickerWheel})), { ssr: false })

export default function ImagePickerWheelDemoPage() {
  // Demo slices with sample images
  const [demoSlices, setDemoSlices] = useState<ImageWheelSlice[]>([
    {
      id: "slice-1",
      text: "Pizza",
      color: "#8e0b16",
      image: {
        url: "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=400&h=400&fit=crop&crop=center",
        uploadTimestamp: new Date(),
        isUploaded: true
      }
    },
    {
      id: "slice-2",
      text: "Burger",
      color: "#66181E",
      image: {
        url: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&h=400&fit=crop&crop=center",
        uploadTimestamp: new Date(),
        isUploaded: true
      }
    },
    {
      id: "slice-3",
      text: "Sushi",
      color: "#8e0b16",
      image: {
        url: "https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?w=400&h=400&fit=crop&crop=center",
        uploadTimestamp: new Date(),
        isUploaded: true
      }
    },
    {
      id: "slice-4",
      text: "Pasta",
      color: "#66181E",
      image: {
        url: "https://images.unsplash.com/photo-1551892374-ecf87916f7f6?w=400&h=400&fit=crop&crop=center",
        uploadTimestamp: new Date(),
        isUploaded: true
      }
    },
    {
      id: "slice-5",
      text: "Salad",
      color: "#8e0b16",
      image: {
        url: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=400&fit=crop&crop=center",
        uploadTimestamp: new Date(),
        isUploaded: true
      }
    },
    {
      id: "slice-6",
      text: "Dessert",
      color: "#66181E",
      image: {
        url: "https://images.unsplash.com/photo-1551024506-0bccd828d307?w=400&h=400&fit=crop&crop=center",
        uploadTimestamp: new Date(),
        isUploaded: true
      }
    }
  ])

  const [useEnhancedSpinning, setUseEnhancedSpinning] = useState(true)
  const [isLiveMode, setIsLiveMode] = useState(false)
  const [organizerMode, setOrganizerMode] = useState(true)

  const handleSpinComplete = (result: any) => {
    console.log("🎉 Spin completed:", result)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <Card className="border-0 shadow-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
          <CardHeader className="text-center">
            <CardTitle className="text-4xl font-bold mb-2">
              🎯 Image Picker Wheel Demo
            </CardTitle>
            <CardDescription className="text-blue-100 text-lg">
              Advanced spinning wheel with image support, cover-mode display, and real-time synchronization
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap justify-center gap-3">
              <Badge variant="secondary" className="bg-white/20 text-white border-white/30">
                ✨ Background-size: Cover
              </Badge>
              <Badge variant="secondary" className="bg-white/20 text-white border-white/30">
                🎨 No Image Distortion
              </Badge>
              <Badge variant="secondary" className="bg-white/20 text-white border-white/30">
                🔄 Real-time Sync
              </Badge>
              <Badge variant="secondary" className="bg-white/20 text-white border-white/30">
                📱 Responsive Design
              </Badge>
              <Badge variant="secondary" className="bg-white/20 text-white border-white/30">
                ⚡ Enhanced Spinning
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Controls */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              ⚙️ Demo Controls
            </CardTitle>
            <CardDescription>
              Configure the wheel behavior and test different modes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Spinning Engine</label>
                <div className="flex gap-2">
                  <Button
                    variant={useEnhancedSpinning ? "default" : "outline"}
                    size="sm"
                    onClick={() => setUseEnhancedSpinning(true)}
                    className="flex-1"
                  >
                    Enhanced
                  </Button>
                  <Button
                    variant={!useEnhancedSpinning ? "default" : "outline"}
                    size="sm"
                    onClick={() => setUseEnhancedSpinning(false)}
                    className="flex-1"
                  >
                    Standalone
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Session Mode</label>
                <div className="flex gap-2">
                  <Button
                    variant={isLiveMode ? "default" : "outline"}
                    size="sm"
                    onClick={() => setIsLiveMode(true)}
                    className="flex-1"
                  >
                    Live Session
                  </Button>
                  <Button
                    variant={!isLiveMode ? "default" : "outline"}
                    size="sm"
                    onClick={() => setIsLiveMode(false)}
                    className="flex-1"
                  >
                    Solo Mode
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">User Role</label>
                <div className="flex gap-2">
                  <Button
                    variant={organizerMode ? "default" : "outline"}
                    size="sm"
                    onClick={() => setOrganizerMode(true)}
                    className="flex-1"
                  >
                    Organizer
                  </Button>
                  <Button
                    variant={!organizerMode ? "default" : "outline"}
                    size="sm"
                    onClick={() => setOrganizerMode(false)}
                    className="flex-1"
                  >
                    Participant
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Current Mode</label>
                <div className="text-sm p-2 bg-gray-50 rounded border">
                  {isLiveMode ? (
                    <div className="space-y-1">
                      <div className="font-medium text-blue-700">
                        {organizerMode ? "🔵 Live - Organizer" : "🟠 Live - Participant"}
                      </div>
                      <div className="text-xs text-gray-600">
                        {organizerMode ? "Can edit & spin" : "View only"}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <div className="font-medium text-green-700">🟢 Solo Mode</div>
                      <div className="text-xs text-gray-600">Full control</div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Mode-specific Information */}
            <div className="mt-4 p-3 rounded-lg border-2"
                 style={{ borderColor: isLiveMode ? (organizerMode ? "#3b82f6" : "#f97316") : "#22c55e" }}>
              {isLiveMode ? (
                <div>
                  <h3 className="font-semibold mb-2">
                    {organizerMode ? "🔵 Organizer Mode Active" : "🟠 Participant Mode Active"}
                  </h3>
                  <div className="text-sm space-y-1">
                    {organizerMode ? (
                      <>
                        <p>• You can edit images and spin the wheel</p>
                        <p>• Changes are broadcast to all participants</p>
                        <p>• Real-time synchronization enabled</p>
                      </>
                    ) : (
                      <>
                        <p>• View-only mode - images update automatically</p>
                        <p>• Cannot edit or spin in live sessions</p>
                        <p>• Receives real-time updates from organizer</p>
                      </>
                    )}
                  </div>
                </div>
              ) : (
                <div>
                  <h3 className="font-semibold mb-2">🟢 Solo Mode Active</h3>
                  <div className="text-sm space-y-1">
                    <p>• Full control over wheel and images</p>
                    <p>• No real-time synchronization</p>
                    <p>• Perfect for individual use</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Main Image Picker Wheel */}
        <ImagePickerWheel
          slices={demoSlices}
          onSpinComplete={handleSpinComplete}
          wheelTitle="Food Picker Wheel"
          useEnhancedSpinning={useEnhancedSpinning}
          isLiveMode={isLiveMode}
          organizerMode={organizerMode}
          enableRealTimeSync={isLiveMode}
          sessionId={isLiveMode ? "demo-session-123" : undefined}
          userPermissions={{
            isFullAccessCollaborator: !organizerMode,
            canTriggerSynchronizedSpin: true,
            synchronizationEnabled: isLiveMode,
            userRole: organizerMode ? "organizer" : "participant"
          }}
        />

        {/* Features Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              ✨ Key Features Demonstrated
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="space-y-2">
                <h3 className="font-semibold text-green-700">🎨 Image Display</h3>
                <ul className="text-sm space-y-1 text-gray-600">
                  <li>• Background-size: cover behavior</li>
                  <li>• No image distortion or stretching</li>
                  <li>• Perfect slice filling</li>
                  <li>• Responsive image scaling</li>
                </ul>
              </div>

              <div className="space-y-2">
                <h3 className="font-semibold text-blue-700">🔄 Real-time Sync</h3>
                <ul className="text-sm space-y-1 text-gray-600">
                  <li>• Instant image updates</li>
                  <li>• Live session synchronization</li>
                  <li>• Organizer/participant modes</li>
                  <li>• Cross-platform compatibility</li>
                </ul>
              </div>

              <div className="space-y-2">
                <h3 className="font-semibold text-purple-700">⚡ Enhanced Spinning</h3>
                <ul className="text-sm space-y-1 text-gray-600">
                  <li>• Powered by enhanced-wheel.tsx</li>
                  <li>• Smooth animations</li>
                  <li>• Perfect winner calculation</li>
                  <li>• Advanced easing functions</li>
                </ul>
              </div>

              <div className="space-y-2">
                <h3 className="font-semibold text-orange-700">🛠️ Management</h3>
                <ul className="text-sm space-y-1 text-gray-600">
                  <li>• Easy image URL input</li>
                  <li>• Real-time image validation</li>
                  <li>• Instant preview updates</li>
                  <li>• Error handling and retry</li>
                </ul>
              </div>

              <div className="space-y-2">
                <h3 className="font-semibold text-red-700">📱 Responsive</h3>
                <ul className="text-sm space-y-1 text-gray-600">
                  <li>• Mobile-optimized interface</li>
                  <li>• Touch-friendly controls</li>
                  <li>• Adaptive canvas sizing</li>
                  <li>• Cross-device compatibility</li>
                </ul>
              </div>

              <div className="space-y-2">
                <h3 className="font-semibold text-indigo-700">🎯 Accuracy</h3>
                <ul className="text-sm space-y-1 text-gray-600">
                  <li>• Perfect winner calculation</li>
                  <li>• Image stability during spin</li>
                  <li>• Consistent slice geometry</li>
                  <li>• Mathematical precision</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Usage Instructions */}
        <Card className="bg-gradient-to-r from-gray-50 to-gray-100">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              📖 How to Use
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">🎯 Basic Usage:</h3>
                <ol className="list-decimal list-inside space-y-1 text-sm text-gray-700">
                  <li>Click "Edit Images" to open the image management dialog</li>
                  <li>Add image URLs for each slice you want to customize</li>
                  <li>Images will display with cover-mode (no distortion)</li>
                  <li>Click "Spin Wheel" to start spinning with enhanced animation</li>
                  <li>Watch as images remain perfectly fitted during spinning</li>
                </ol>
              </div>

              <div>
                <h3 className="font-semibold mb-2">🔄 Real-time Features:</h3>
                <ol className="list-decimal list-inside space-y-1 text-sm text-gray-700">
                  <li>Enable "Live Session" mode to test synchronization</li>
                  <li>Switch between Organizer and Participant roles</li>
                  <li>Image changes sync instantly across all users</li>
                  <li>Test with "Enhanced Wheel" for full feature set</li>
                </ol>
              </div>

              <div>
                <h3 className="font-semibold mb-2">💡 Pro Tips:</h3>
                <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
                  <li>Use square or landscape images for best results</li>
                  <li>High contrast images work better on colored backgrounds</li>
                  <li>Test different spinning modes to see the differences</li>
                  <li>Try the live mode to experience real-time synchronization</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}