"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Copy, RefreshCw, Wifi, WifiOff } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { getNetworkStatus, getRecommendedUrls, validateNetworkConnectivity } from "@/lib/network-utils"

export function NetworkStatus() {
  const [networkStatus, setNetworkStatus] = useState<any>(null)
  const [recommendedUrls, setRecommendedUrls] = useState<any>(null)
  const [isConnected, setIsConnected] = useState<boolean | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    updateNetworkStatus()
  }, [])

  const updateNetworkStatus = async () => {
    setIsLoading(true)
    try {
      const status = getNetworkStatus()
      const urls = getRecommendedUrls()
      const connectivity = await validateNetworkConnectivity()
      
      setNetworkStatus(status)
      setRecommendedUrls(urls)
      setIsConnected(connectivity)
    } catch (error) {
      console.error('Failed to get network status:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast({
        title: "Copied!",
        description: `${label} copied to clipboard`,
      })
    } catch (error) {
      toast({
        title: "Copy Failed",
        description: "Could not copy to clipboard",
        variant: "destructive"
      })
    }
  }

  if (!networkStatus) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <RefreshCw className="h-6 w-6 animate-spin" />
            <span className="ml-2">Loading network status...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Network Status Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {isConnected ? (
              <Wifi className="h-5 w-5 text-green-500" />
            ) : (
              <WifiOff className="h-5 w-5 text-red-500" />
            )}
            Network Status
            <Button
              size="sm"
              variant="outline"
              onClick={updateNetworkStatus}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-sm font-medium">Environment:</span>
              <Badge variant={networkStatus.isProduction ? "default" : "secondary"}>
                {networkStatus.isProduction ? "Production" : "Development"}
              </Badge>
            </div>
            <div>
              <span className="text-sm font-medium">Network:</span>
              <Badge variant={networkStatus.isLocalNetwork ? "outline" : "default"}>
                {networkStatus.isLocalNetwork ? "Local Network" : "Internet"}
              </Badge>
            </div>
            <div>
              <span className="text-sm font-medium">Protocol:</span>
              <Badge variant={networkStatus.isSecure ? "default" : "destructive"}>
                {networkStatus.protocol}
              </Badge>
            </div>
            <div>
              <span className="text-sm font-medium">Connectivity:</span>
              <Badge variant={isConnected ? "default" : "destructive"}>
                {isConnected ? "Connected" : "Disconnected"}
              </Badge>
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="text-sm">
              <span className="font-medium">Current Host:</span> {networkStatus.currentHost}:{networkStatus.currentPort}
            </div>
            <div className="text-sm">
              <span className="font-medium">Base URL:</span> {networkStatus.baseUrl}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recommended URLs */}
      {recommendedUrls && (
        <Card>
          <CardHeader>
            <CardTitle>Recommended URLs for Deployment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <div className="flex items-center justify-between p-2 bg-blue-50 rounded">
                <div>
                  <div className="font-medium text-sm">👨‍🏫 Teacher Access URL</div>
                  <div className="text-xs text-muted-foreground font-mono">
                    {recommendedUrls.teacherUrl}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copyToClipboard(recommendedUrls.teacherUrl, "Teacher URL")}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>

              <div className="flex items-center justify-between p-2 bg-green-50 rounded">
                <div>
                  <div className="font-medium text-sm">👨‍🎓 Student Join URL</div>
                  <div className="text-xs text-muted-foreground font-mono">
                    {recommendedUrls.studentJoinUrl}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copyToClipboard(recommendedUrls.studentJoinUrl, "Student Join URL")}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>

              <div className="flex items-center justify-between p-2 bg-purple-50 rounded">
                <div>
                  <div className="font-medium text-sm">📱 Mobile App URL</div>
                  <div className="text-xs text-muted-foreground font-mono">
                    {recommendedUrls.mobileAppUrl}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copyToClipboard(recommendedUrls.mobileAppUrl, "Mobile App URL")}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Deployment Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>🚀 Deployment Instructions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-sm space-y-2">
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded">
              <div className="font-medium text-yellow-800">For Local Network Deployment:</div>
              <ol className="list-decimal list-inside mt-2 space-y-1 text-yellow-700">
                <li>Use the Network URL: <code className="bg-yellow-100 px-1 rounded">{networkStatus.networkUrl}</code></li>
                <li>Share this URL with teachers and students</li>
                <li>Ensure all devices are on the same network</li>
                <li>Check firewall settings allow port 3001</li>
              </ol>
            </div>

            <div className="p-3 bg-blue-50 border border-blue-200 rounded">
              <div className="font-medium text-blue-800">For Production Deployment:</div>
              <ol className="list-decimal list-inside mt-2 space-y-1 text-blue-700">
                <li>Deploy to a hosting service (Vercel, Netlify, etc.)</li>
                <li>Configure custom domain</li>
                <li>Update environment variables</li>
                <li>Enable HTTPS for security</li>
              </ol>
            </div>

            <div className="p-3 bg-green-50 border border-green-200 rounded">
              <div className="font-medium text-green-800">Testing Checklist:</div>
              <ul className="list-disc list-inside mt-2 space-y-1 text-green-700">
                <li>✅ Teacher can create wheel activities</li>
                <li>✅ Live sessions auto-start correctly</li>
                <li>✅ Students can join via room code</li>
                <li>✅ Real-time updates work across devices</li>
                <li>✅ QR codes work on mobile devices</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
