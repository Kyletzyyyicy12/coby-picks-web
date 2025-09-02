"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, Eye, EyeOff, Shield, CheckCircle, AlertTriangle } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { migrateWheelVisibility } from "../../scripts/migrate-wheel-visibility"

export function WheelVisibilityMigration() {
  const [isRunning, setIsRunning] = useState(false)
  const [lastResult, setLastResult] = useState<any>(null)

  const WHEEL_TYPES_TO_HIDE = [
    { id: "yes-no-picker", name: "Yes No Picker Wheel" },
    { id: "number-picker", name: "Number Picker Wheel" },
    { id: "country-picker", name: "Country Picker Wheel" },
    { id: "color-picker", name: "Color Picker Wheel" },
    { id: "image-picker", name: "Image Picker Wheel" },
    { id: "date-picker", name: "Date Picker Wheel" },
    { id: "instagram-comment-picker", name: "Instagram Comment Picker Wheel" },
    { id: "mlb-picker", name: "MLB Picker Wheel" },
    { id: "nba-picker", name: "NBA Picker Wheel" },
    { id: "nfl-picker", name: "NFL Picker Wheel" }
  ]

  const handleRunMigration = async () => {
    setIsRunning(true)
    try {
      const result = await migrateWheelVisibility()
      setLastResult(result)
      
      if (result.success) {
        toast({
          title: "✅ Migration Completed",
          description: `Updated ${result.updated} wheel types, skipped ${result.skipped}`,
        })
      } else {
        toast({
          title: "❌ Migration Failed",
          description: result.error,
          variant: "destructive",
        })
      }
    } catch (error: any) {
      toast({
        title: "❌ Migration Error",
        description: error.message,
        variant: "destructive",
      })
      setLastResult({
        success: false,
        error: error.message
      })
    } finally {
      setIsRunning(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-orange-600" />
            <CardTitle className="text-lg">Wheel Type Visibility Migration</CardTitle>
          </div>
          <CardDescription>
            Apply the new visibility settings to hide specific wheel types from new organizers and participants.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Admin Action Required:</strong> This migration will update existing wheel types in the database
              to hide specific wheels from new users. This action can be safely run multiple times.
            </AlertDescription>
          </Alert>

          <div>
            <h4 className="font-medium mb-3 flex items-center gap-2">
              <EyeOff className="h-4 w-4 text-orange-600" />
              Wheel Types to be Hidden for New Users:
            </h4>
            <div className="grid grid-cols-2 gap-2">
              {WHEEL_TYPES_TO_HIDE.map((wheel) => (
                <Badge key={wheel.id} variant="outline" className="justify-start p-2">
                  <EyeOff className="h-3 w-3 mr-2 text-orange-600" />
                  {wheel.name}
                </Badge>
              ))}
            </div>
          </div>

          <div className="bg-blue-50 p-4 rounded-lg">
            <h4 className="font-medium text-blue-900 mb-2">What this migration does:</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Hides specified wheel types from new organizers and participants</li>
              <li>• Existing users continue to see all wheels they had access to</li>
              <li>• Admins can manually unhide wheels for specific users via the Manage Wheel Types interface</li>
              <li>• Safe to run multiple times - only updates what needs to be changed</li>
            </ul>
          </div>

          <Button
            onClick={handleRunMigration}
            disabled={isRunning}
            className="w-full bg-orange-600 hover:bg-orange-700 text-white"
          >
            {isRunning ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Running Migration...
              </>
            ) : (
              <>
                <Shield className="mr-2 h-4 w-4" />
                Apply Wheel Visibility Settings
              </>
            )}
          </Button>

          {lastResult && (
            <Card className={lastResult.success ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-2">
                  {lastResult.success ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                  )}
                  <span className={`font-medium ${lastResult.success ? "text-green-800" : "text-red-800"}`}>
                    {lastResult.success ? "Migration Completed Successfully" : "Migration Failed"}
                  </span>
                </div>
                {lastResult.success ? (
                  <div className="text-sm text-green-700 space-y-1">
                    <p>📊 Statistics:</p>
                    <p>• Updated: {lastResult.updated} wheel types</p>
                    <p>• Skipped: {lastResult.skipped} wheel types (already correct)</p>
                    <p>• Total: {lastResult.total} wheel types processed</p>
                  </div>
                ) : (
                  <p className="text-sm text-red-700">Error: {lastResult.error}</p>
                )}
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  )
}