"use client"

import { EnhancedStudentJoin } from "@/components/live/enhanced-student-join"
import { Toaster } from "@/components/ui/toaster"

export default function JoinPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="mb-4">
            <div className="w-16 h-16 bg-[#8e0b16] rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl text-white">🎯</span>
            </div>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Join Live Session
          </h1>
          <p className="text-gray-600 text-lg">
            Enter your teacher's room code to join the live wheel session
          </p>
          <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-sm text-blue-800">
              📱 <strong>Works on all devices:</strong> Web, Mobile, and App
            </p>
          </div>
        </div>

        <EnhancedStudentJoin />

        <div className="mt-8 text-center space-y-4">
          <div className="text-sm text-gray-500">
            <p>💡 <strong>Need help?</strong></p>
            <p>Ask your teacher for the 6-character room code</p>
          </div>

          <div className="border-t pt-4">
            <a
              href="/"
              className="inline-flex items-center gap-2 text-[#8e0b16] hover:text-[#66181E] font-medium text-sm"
            >
              ← Back to Home
            </a>
          </div>
        </div>
      </div>
      <Toaster />
    </div>
  )
}
