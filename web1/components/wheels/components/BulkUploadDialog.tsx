"use client"

import React from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Upload, Image as ImageIcon } from 'lucide-react'

interface BulkUploadDialogProps {
  isOpen: boolean
  onClose: () => void
  onBulkUpload: (files: FileList) => void
  onGenerateRandom: (count: number) => void
  onGeneratePhotos: (count: number) => void
  maxSlices?: number
}

export function BulkUploadDialog({
  isOpen,
  onClose,
  onBulkUpload,
  onGenerateRandom,
  onGeneratePhotos,
  maxSlices = 12
}: BulkUploadDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Bulk Upload Images
          </DialogTitle>
          <DialogDescription>
            Upload multiple images at once to create wheel slices automatically
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* File Upload Area */}
          <div className="border-2 border-dashed border-purple-300 rounded-lg p-8 text-center hover:border-purple-400 transition-colors">
            <ImageIcon className="h-12 w-12 mx-auto text-purple-400 mb-4" />
            <h3 className="text-lg font-semibold text-purple-800 mb-2">
              Upload Multiple Images
            </h3>
            <p className="text-purple-600 mb-4">
              Select multiple images to create wheel slices automatically
            </p>
            <label className="cursor-pointer">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const files = e.target.files
                  if (files) {
                    onBulkUpload(files)
                    onClose()
                  }
                }}
                className="hidden"
                multiple
              />
              <Button className="bg-purple-600 hover:bg-purple-700">
                <Upload className="h-4 w-4 mr-2" />
                Choose Images
              </Button>
            </label>
            <p className="text-xs text-purple-500 mt-2">
              Supported formats: JPG, PNG, GIF • Max {maxSlices} images
            </p>
          </div>

          {/* Quick Generation Options */}
          <div className="space-y-4">
            <h4 className="font-semibold text-gray-800">Quick Generation</h4>
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  onGenerateRandom(6)
                  onClose()
                }}
                className="flex flex-col items-center p-4 h-auto"
              >
                <span className="text-2xl mb-2">🎲</span>
                <span className="text-sm font-medium">6 Random Slices</span>
                <span className="text-xs text-muted-foreground">Perfect for games</span>
              </Button>

              <Button
                variant="outline"
                onClick={() => {
                  onGenerateRandom(8)
                  onClose()
                }}
                className="flex flex-col items-center p-4 h-auto"
              >
                <span className="text-2xl mb-2">🎆</span>
                <span className="text-sm font-medium">8 Random Slices</span>
                <span className="text-xs text-muted-foreground">Standard wheel</span>
              </Button>

              <Button
                variant="outline"
                onClick={() => {
                  onGenerateRandom(10)
                  onClose()
                }}
                className="flex flex-col items-center p-4 h-auto"
              >
                <span className="text-2xl mb-2">✨</span>
                <span className="text-sm font-medium">10 Random Slices</span>
                <span className="text-xs text-muted-foreground">More options</span>
              </Button>

              <Button
                variant="outline"
                onClick={() => {
                  onGenerateRandom(12)
                  onClose()
                }}
                className="flex flex-col items-center p-4 h-auto"
              >
                <span className="text-2xl mb-2">🌈</span>
                <span className="text-sm font-medium">12 Random Slices</span>
                <span className="text-xs text-muted-foreground">Maximum variety</span>
              </Button>
            </div>
          </div>

          {/* Many Random Photos for Organizers */}
          <div className="space-y-4">
            <h4 className="font-semibold text-gray-800 flex items-center gap-2">
              🖼️ Many Random Photos
              <Badge className="bg-purple-100 text-purple-800 text-xs">ORGANIZER FEATURE</Badge>
            </h4>
            <p className="text-sm text-gray-600">
              Generate wheel slices with many random photos from various categories
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Button
                onClick={() => {
                  onGeneratePhotos(8)
                  onClose()
                }}
                className="flex flex-col items-center p-4 h-auto bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white"
              >
                <span className="text-2xl mb-2">🇺️</span>
                <span className="text-sm font-medium">8 Random Photos</span>
                <span className="text-xs text-white/80">Nature, Animals, Food</span>
              </Button>

              <Button
                onClick={() => {
                  onGeneratePhotos(12)
                  onClose()
                }}
                className="flex flex-col items-center p-4 h-auto bg-gradient-to-r from-green-500 to-teal-600 hover:from-green-600 hover:to-teal-700 text-white"
              >
                <span className="text-2xl mb-2">🌄</span>
                <span className="text-sm font-medium">12 Random Photos</span>
                <span className="text-xs text-white/80">Travel, Architecture, Art</span>
              </Button>

              <Button
                onClick={() => {
                  onGeneratePhotos(16)
                  onClose()
                }}
                className="flex flex-col items-center p-4 h-auto bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white"
              >
                <span className="text-2xl mb-2">🗺️</span>
                <span className="text-sm font-medium">16 Random Photos</span>
                <span className="text-xs text-white/80">Mixed Categories</span>
              </Button>

              <Button
                onClick={() => {
                  onGeneratePhotos(20)
                  onClose()
                }}
                className="flex flex-col items-center p-4 h-auto bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white"
              >
                <span className="text-2xl mb-2">🌈</span>
                <span className="text-sm font-medium">20 Random Photos</span>
                <span className="text-xs text-white/80">Maximum Variety</span>
              </Button>
            </div>

            <div className="bg-purple-50 p-3 rounded-lg border border-purple-200">
              <div className="flex items-start gap-2">
                <div className="text-purple-600 flex-shrink-0">💡</div>
                <div className="text-sm text-purple-800">
                  <strong>Pro Tip:</strong> Random photos are perfect for:
                  <ul className="mt-1 space-y-1 text-xs">
                    <li>• Quick setup without uploading your own images</li>
                    <li>• Demonstration purposes and testing</li>
                    <li>• When you need diverse visual options instantly</li>
                    <li>• Creating engaging wheels for any audience</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Instructions */}
          <div className="bg-blue-50 p-4 rounded-lg">
            <h4 className="font-semibold text-blue-800 mb-2">Tips:</h4>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• Image names will be used as slice text</li>
              <li>• Images will be automatically resized to fit</li>
              <li>• You can edit slice text and upload individual images later</li>
              <li>• Random slices create text-only slices that you can add images to</li>
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}