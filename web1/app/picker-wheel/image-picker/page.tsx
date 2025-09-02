"use client"

import React, { useState } from 'react'
import { ImagePickerWheel } from '@/components/wheels/ImagePickerWheel'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ImageWheelSlice, WinnerResult } from '@/types/image-wheel-types'
import { ArrowLeft, Info, Upload, Trophy, Camera } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function ImagePickerWheelPage() {
  const router = useRouter()
  const [wheelSlices, setWheelSlices] = useState<ImageWheelSlice[]>([])
  const [lastWinner, setLastWinner] = useState<WinnerResult | null>(null)
  const [totalSpins, setTotalSpins] = useState(0)

  const handleSpinComplete = (winner: WinnerResult) => {
    setLastWinner(winner)
    setTotalSpins(prev => prev + 1)
  }

  const handleSlicesChange = (slices: ImageWheelSlice[]) => {
    setWheelSlices(slices)
  }

  const getSlicesWithImages = () => {
    return wheelSlices.filter(slice => slice.image?.url).length
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 p-4">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            onClick={() => router.back()}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
              🖼️ Image Picker Wheel
              <Badge variant="secondary" className="bg-purple-100 text-purple-800">
                Beta
              </Badge>
            </h1>
            <p className="text-gray-600">Upload images for each slice and reveal the winner's picture!</p>
          </div>
        </div>

        {/* Features Info */}
        <Card className="border-purple-200 bg-purple-50/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-purple-800">
              <Info className="h-5 w-5" />
              How it Works
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="flex items-start gap-3">
                <div className="bg-purple-500 text-white p-2 rounded-full">
                  <Upload className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="font-semibold text-purple-800">1. Upload Images</h4>
                  <p className="text-purple-600">Add a unique image to each wheel slice (JPG, PNG, GIF supported)</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="bg-purple-500 text-white p-2 rounded-full">
                  <Trophy className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="font-semibold text-purple-800">2. Spin the Wheel</h4>
                  <p className="text-purple-600">Click to spin and watch the wheel select a random slice</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="bg-purple-500 text-white p-2 rounded-full">
                  <Camera className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="font-semibold text-purple-800">3. Reveal Winner</h4>
                  <p className="text-purple-600">The winner's image is revealed in a beautiful modal display</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Statistics */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Slices</p>
                  <p className="text-2xl font-bold text-gray-900">{wheelSlices.length}</p>
                </div>
                <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-xl">🎯</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">With Images</p>
                  <p className="text-2xl font-bold text-gray-900">{getSlicesWithImages()}</p>
                </div>
                <div className="h-12 w-12 bg-green-100 rounded-full flex items-center justify-center">
                  <span className="text-xl">🖼️</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Spins</p>
                  <p className="text-2xl font-bold text-gray-900">{totalSpins}</p>
                </div>
                <div className="h-12 w-12 bg-purple-100 rounded-full flex items-center justify-center">
                  <span className="text-xl">🎲</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Wheel Component */}
        <ImagePickerWheel
          onSpinComplete={handleSpinComplete}
          onSlicesChange={handleSlicesChange}
          size={400}
          showWinnerModal={true}
          allowEdit={true}
          maxSlices={12}
        />

        {/* Last Winner Display */}
        {lastWinner && (
          <Card className="border-yellow-200 bg-yellow-50/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-yellow-800">
                <Trophy className="h-5 w-5" />
                Latest Winner
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                {lastWinner.slice.image?.url ? (
                  <img
                    src={lastWinner.slice.image.url}
                    alt={lastWinner.slice.text}
                    className="w-16 h-16 object-cover rounded-full border-2 border-yellow-400"
                  />
                ) : (
                  <div 
                    className="w-16 h-16 rounded-full border-2 border-yellow-400 flex items-center justify-center text-white font-bold"
                    style={{ backgroundColor: lastWinner.slice.color }}
                  >
                    🏆
                  </div>
                )}
                <div>
                  <h4 className="font-bold text-yellow-900">{lastWinner.slice.text}</h4>
                  <p className="text-sm text-yellow-700">
                    Won at {lastWinner.timestamp.toLocaleTimeString()}
                  </p>
                  {lastWinner.slice.image?.url && (
                    <Badge className="bg-yellow-200 text-yellow-800 text-xs">
                      Image Winner
                    </Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tips Section */}
        <Card className="border-gray-200">
          <CardHeader>
            <CardTitle className="text-gray-800">💡 Pro Tips</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-gray-600">
              <li>• <strong>Image Quality:</strong> Use high-quality images (max 5MB) for best results</li>
              <li>• <strong>Supported Formats:</strong> JPG, PNG, GIF, and WebP are all supported</li>
              <li>• <strong>Perfect for:</strong> Photo contests, memory games, random selections with visual impact</li>
              <li>• <strong>No Images Required:</strong> You can mix slices with and without images</li>
              <li>• <strong>Mobile Friendly:</strong> Works great on mobile devices for touch interactions</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}