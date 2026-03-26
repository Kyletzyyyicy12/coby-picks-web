"use client"

import Link from "next/link"
import { AuthForm } from "@/components/auth/auth-form"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Shield } from "lucide-react"

export function LandingPage() {
  const schoolColors = {
    primary: "#8e0b16",
    secondary: "#66181E",
    accent: "#ffffff"
  }

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-6"
      style={{ 
        background: `linear-gradient(135deg, ${schoolColors.secondary} 0%, ${schoolColors.primary} 100%)` 
      }}
    >
      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
        {/* Welcome Section */}
        <div className="text-center lg:text-left text-white space-y-6">
          <div className="space-y-4">
            <h1 className="text-5xl lg:text-6xl font-bold">
              🎯 Coby Picks
            </h1>
            <p className="text-xl lg:text-2xl text-white/90">
              Interactive Randomizer for Educational Excellence
            </p>
          </div>
          
          <div className="space-y-4 text-lg">
            
            <div className="flex items-center gap-3 justify-center lg:justify-start">
              <div className="text-2xl">🙋‍♂️</div>
              <span>Participants can participate in live draws</span>
            </div>
            <div className="flex items-center gap-3 justify-center lg:justify-start">
              <div className="text-2xl">👤</div>
              <span>Organizers coordinate school-wide events</span>
            </div>
            <div className="flex items-center gap-3 justify-center lg:justify-start">
              <div className="text-2xl">🔴</div>
              <span>Real-time synchronization across devices</span>
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 space-y-3">
            <h3 className="text-xl font-semibold">Key Features</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
              <div>✅ Live Draw Synchronization</div>
              <div>✅ QR Code Access</div>
              <div>✅ Emoji Reactions</div>
              <div>✅ Multiple Winners</div>
              <div>✅ Custom Themes</div>
              <div>✅ Export Results</div>
              <div>✅ Student Management</div>
              <div>✅ Activity Templates</div>
            </div>
          </div>

          {/* Footer */}
          <div className="text-center text-white/80 text-sm space-y-2">
            <div>© 2025 Coby Picks. Interactive Randomizer for Educational Excellence.</div>
            <Link
              href="/privacy"
              className="inline-flex items-center gap-1 text-white/80 hover:text-white transition-colors"
            >
              <Shield className="h-4 w-4" />
              Privacy & Data Policy
            </Link>
          </div>
        </div>

        {/* Auth Form Section */}
        <div className="flex justify-center">
          <div className="w-full max-w-md">
            <AuthForm />
          </div>
        </div>
      </div>
    </div>
  )
}
