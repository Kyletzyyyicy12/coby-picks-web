"use client"

import { NetworkStatus } from "@/components/debug/network-status"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, ExternalLink } from "lucide-react"
import Link from "next/link"

export default function NetworkConfigPage() {
  return (
    <div className="container mx-auto p-4 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/">
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Home
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">🌐 Network Configuration</h1>
          <p className="text-muted-foreground">
            Configure and test network settings for live sessions
          </p>
        </div>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>🚀 Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link href="/test-live">
              <Button variant="outline" className="w-full h-20 flex flex-col gap-2">
                <span className="text-lg">🧪</span>
                <span className="text-sm">Test Live Sessions</span>
              </Button>
            </Link>
            
            <Link href="/join">
              <Button variant="outline" className="w-full h-20 flex flex-col gap-2">
                <span className="text-lg">👨‍🎓</span>
                <span className="text-sm">Student Join Page</span>
              </Button>
            </Link>
            
            <Link href="/">
              <Button variant="outline" className="w-full h-20 flex flex-col gap-2">
                <span className="text-lg">👨‍🏫</span>
                <span className="text-sm">Teacher Dashboard</span>
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Network Status Component */}
      <NetworkStatus />

      {/* Troubleshooting Guide */}
      <Card>
        <CardHeader>
          <CardTitle>🔧 Troubleshooting Guide</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="p-3 border border-red-200 bg-red-50 rounded">
              <div className="font-medium text-red-800 mb-2">❌ Common Issues & Solutions:</div>
              <div className="space-y-2 text-sm text-red-700">
                <div>
                  <strong>Cross-origin request error:</strong>
                  <ul className="list-disc list-inside ml-4 mt-1">
                    <li>Use the Network URL instead of localhost</li>
                    <li>Ensure allowedDevOrigins is configured in next.config.js</li>
                    <li>Check firewall settings</li>
                  </ul>
                </div>
                <div>
                  <strong>Students can't join sessions:</strong>
                  <ul className="list-disc list-inside ml-4 mt-1">
                    <li>Verify all devices are on the same network</li>
                    <li>Use the correct Network URL for QR codes</li>
                    <li>Check if live session is actually active</li>
                  </ul>
                </div>
                <div>
                  <strong>Real-time updates not working:</strong>
                  <ul className="list-disc list-inside ml-4 mt-1">
                    <li>Check Firebase connection</li>
                    <li>Verify Firestore rules allow anonymous access</li>
                    <li>Ensure WebSocket connections are not blocked</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="p-3 border border-green-200 bg-green-50 rounded">
              <div className="font-medium text-green-800 mb-2">✅ Best Practices:</div>
              <div className="space-y-1 text-sm text-green-700">
                <div>• Always use the Network URL for production deployment</div>
                <div>• Test on multiple devices before going live</div>
                <div>• Keep room codes simple and easy to type</div>
                <div>• Provide clear instructions to students</div>
                <div>• Have a backup plan for technical issues</div>
              </div>
            </div>

            <div className="p-3 border border-blue-200 bg-blue-50 rounded">
              <div className="font-medium text-blue-800 mb-2">📱 Mobile Compatibility:</div>
              <div className="space-y-1 text-sm text-blue-700">
                <div>• QR codes work on all mobile devices</div>
                <div>• Students can type room codes manually</div>
                <div>• Mobile browsers support all features</div>
                <div>• No app installation required</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Testing Checklist */}
      <Card>
        <CardHeader>
          <CardTitle>✅ Pre-Deployment Testing Checklist</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <input type="checkbox" id="test1" className="rounded" />
              <label htmlFor="test1" className="text-sm">
                Teacher can access dashboard using Network URL
              </label>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="test2" className="rounded" />
              <label htmlFor="test2" className="text-sm">
                Teacher can create wheel activities successfully
              </label>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="test3" className="rounded" />
              <label htmlFor="test3" className="text-sm">
                Live sessions auto-start when enabled
              </label>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="test4" className="rounded" />
              <label htmlFor="test4" className="text-sm">
                Students can join using room codes
              </label>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="test5" className="rounded" />
              <label htmlFor="test5" className="text-sm">
                QR codes work on mobile devices
              </label>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="test6" className="rounded" />
              <label htmlFor="test6" className="text-sm">
                Real-time updates work across devices
              </label>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="test7" className="rounded" />
              <label htmlFor="test7" className="text-sm">
                Teacher can see students joining in real-time
              </label>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="test8" className="rounded" />
              <label htmlFor="test8" className="text-sm">
                Wheel spinning works and students see results
              </label>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
