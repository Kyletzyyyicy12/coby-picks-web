"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/hooks/use-toast"
import { db } from "@/lib/firebase"
import { doc, updateDoc, getDoc } from "firebase/firestore"
import { 
  Palette, 
  Volume2, 
  VolumeX, 
  Sparkles, 
  Type, 
  Clock, 
  Save, 
  RotateCcw,
  Eye,
  Settings
} from "lucide-react"
import type { User as FirebaseUser } from "firebase/auth"

interface WheelSettings {
  theme: string
  primaryColor: string
  secondaryColor: string
  textColor: string
  backgroundColor: string
  hasSound: boolean
  soundVolume: number
  hasConfetti: boolean
  confettiDuration: number
  spinDuration: number
  fontFamily: string
  fontSize: number
  congratsMessage: string
  winnerDisplayDuration: number
}

interface WheelCustomizationProps {
  user: FirebaseUser
  activityId?: string
  onClose?: () => void
  onSettingsChange?: (settings: WheelSettings) => void
}

export function WheelCustomization({ user, activityId, onClose, onSettingsChange }: WheelCustomizationProps) {
  const [settings, setSettings] = useState<WheelSettings>({
    theme: "school",
    primaryColor: "#8e0b16",
    secondaryColor: "#66181E",
    textColor: "#ffffff",
    backgroundColor: "#f8f9fa",
    hasSound: true,
    soundVolume: 50,
    hasConfetti: true,
    confettiDuration: 3000,
    spinDuration: 3000,
    fontFamily: "Inter",
    fontSize: 16,
    congratsMessage: "🎉 Congratulations, {name}! Well done!",
    winnerDisplayDuration: 5000
  })
  const [loading, setLoading] = useState(false)
  const [previewMode, setPreviewMode] = useState(false)

  const schoolColors = {
    primary: "#8e0b16",
    secondary: "#66181E",
    accent: "#ffffff"
  }

  const themePresets = [
    {
      name: "School Colors",
      value: "school",
      colors: { primary: "#8e0b16", secondary: "#66181E", text: "#ffffff", bg: "#f8f9fa" }
    },
    {
      name: "Vibrant",
      value: "vibrant",
      colors: { primary: "#ff6b6b", secondary: "#4ecdc4", text: "#ffffff", bg: "#f8f9fa" }
    },
    {
      name: "Ocean",
      value: "ocean",
      colors: { primary: "#0077be", secondary: "#00a8cc", text: "#ffffff", bg: "#f0f8ff" }
    },
    {
      name: "Forest",
      value: "forest",
      colors: { primary: "#2d5016", secondary: "#4a7c59", text: "#ffffff", bg: "#f0f8f0" }
    },
    {
      name: "Sunset",
      value: "sunset",
      colors: { primary: "#ff7f50", secondary: "#ff6347", text: "#ffffff", bg: "#fff8f0" }
    },
    {
      name: "Minimal",
      value: "minimal",
      colors: { primary: "#333333", secondary: "#666666", text: "#ffffff", bg: "#ffffff" }
    }
  ]

  const fontOptions = [
    { name: "Inter (Default)", value: "Inter" },
    { name: "Arial", value: "Arial" },
    { name: "Helvetica", value: "Helvetica" },
    { name: "Georgia", value: "Georgia" },
    { name: "Times New Roman", value: "Times New Roman" },
    { name: "Courier New", value: "Courier New" }
  ]

  useEffect(() => {
    if (activityId) {
      loadActivitySettings()
    }
  }, [activityId])

  const loadActivitySettings = async () => {
    if (!activityId) return

    try {
      const activityDoc = await getDoc(doc(db, "drawActivities", activityId))
      if (activityDoc.exists()) {
        const data = activityDoc.data()
        if (data.customization) {
          setSettings(prev => ({ ...prev, ...data.customization }))
        }
      }
    } catch (error) {
      console.error("Error loading activity settings:", error)
    }
  }

  const handleThemeChange = (themeName: string) => {
    const theme = themePresets.find(t => t.value === themeName)
    if (theme) {
      setSettings(prev => ({
        ...prev,
        theme: themeName,
        primaryColor: theme.colors.primary,
        secondaryColor: theme.colors.secondary,
        textColor: theme.colors.text,
        backgroundColor: theme.colors.bg
      }))
    }
  }

  const handleSaveSettings = async () => {
    setLoading(true)
    try {
      if (activityId) {
        await updateDoc(doc(db, "drawActivities", activityId), {
          customization: settings,
          updatedAt: new Date()
        })
      }

      // Also save as user preferences
      await updateDoc(doc(db, "users", user.uid), {
        wheelCustomization: settings,
        updatedAt: new Date()
      })

      if (onSettingsChange) {
        onSettingsChange(settings)
      }

      toast({
        title: "Settings Saved",
        description: "Your wheel customization has been saved successfully"
      })
    } catch (error) {
      console.error("Error saving settings:", error)
      toast({
        title: "Error",
        description: "Failed to save settings. Please try again.",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const resetToDefaults = () => {
    setSettings({
      theme: "school",
      primaryColor: "#8e0b16",
      secondaryColor: "#66181E",
      textColor: "#ffffff",
      backgroundColor: "#f8f9fa",
      hasSound: true,
      soundVolume: 50,
      hasConfetti: true,
      confettiDuration: 3000,
      spinDuration: 3000,
      fontFamily: "Inter",
      fontSize: 16,
      congratsMessage: "🎉 Congratulations, {name}! Well done!",
      winnerDisplayDuration: 5000
    })
    toast({
      title: "Reset",
      description: "Settings reset to defaults"
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: schoolColors.primary }}>
            ⚙️ Customize Wheel
          </h2>
          <p className="text-muted-foreground">
            Personalize your wheel's appearance and behavior
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={() => setPreviewMode(!previewMode)}
            variant="outline"
          >
            <Eye className="h-4 w-4 mr-2" />
            {previewMode ? "Hide Preview" : "Show Preview"}
          </Button>
          {onClose && (
            <Button onClick={onClose} variant="outline">
              Close
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Settings Panel */}
        <div className="space-y-6">
          {/* Theme Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5" />
                Theme & Colors
              </CardTitle>
              <CardDescription>
                Choose a preset theme or customize colors
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Theme Preset</Label>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {themePresets.map((theme) => (
                    <Button
                      key={theme.value}
                      variant={settings.theme === theme.value ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleThemeChange(theme.value)}
                      className="justify-start"
                    >
                      <div 
                        className="w-4 h-4 rounded mr-2"
                        style={{ backgroundColor: theme.colors.primary }}
                      />
                      {theme.name}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="primaryColor">Primary Color</Label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      id="primaryColor"
                      type="color"
                      value={settings.primaryColor}
                      onChange={(e) => setSettings(prev => ({ ...prev, primaryColor: e.target.value }))}
                      className="w-16 h-10 p-1"
                    />
                    <Input
                      value={settings.primaryColor}
                      onChange={(e) => setSettings(prev => ({ ...prev, primaryColor: e.target.value }))}
                      placeholder="#8e0b16"
                      className="flex-1"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="secondaryColor">Secondary Color</Label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      id="secondaryColor"
                      type="color"
                      value={settings.secondaryColor}
                      onChange={(e) => setSettings(prev => ({ ...prev, secondaryColor: e.target.value }))}
                      className="w-16 h-10 p-1"
                    />
                    <Input
                      value={settings.secondaryColor}
                      onChange={(e) => setSettings(prev => ({ ...prev, secondaryColor: e.target.value }))}
                      placeholder="#66181E"
                      className="flex-1"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Sound Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Volume2 className="h-5 w-5" />
                Sound & Effects
              </CardTitle>
              <CardDescription>
                Configure audio and visual effects
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Enable Sound Effects</Label>
                  <p className="text-sm text-muted-foreground">Play sounds during wheel spin</p>
                </div>
                <Switch
                  checked={settings.hasSound}
                  onCheckedChange={(checked) => setSettings(prev => ({ ...prev, hasSound: checked }))}
                />
              </div>

              {settings.hasSound && (
                <div>
                  <Label>Sound Volume: {settings.soundVolume}%</Label>
                  <Slider
                    value={[settings.soundVolume]}
                    onValueChange={([value]) => setSettings(prev => ({ ...prev, soundVolume: value }))}
                    max={100}
                    step={5}
                    className="mt-2"
                  />
                </div>
              )}

              <div className="flex items-center justify-between">
                <div>
                  <Label>Enable Confetti</Label>
                  <p className="text-sm text-muted-foreground">Show confetti when winners are selected</p>
                </div>
                <Switch
                  checked={settings.hasConfetti}
                  onCheckedChange={(checked) => setSettings(prev => ({ ...prev, hasConfetti: checked }))}
                />
              </div>

              {settings.hasConfetti && (
                <div>
                  <Label>Confetti Duration: {settings.confettiDuration / 1000}s</Label>
                  <Slider
                    value={[settings.confettiDuration]}
                    onValueChange={([value]) => setSettings(prev => ({ ...prev, confettiDuration: value }))}
                    min={1000}
                    max={10000}
                    step={500}
                    className="mt-2"
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Typography */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Type className="h-5 w-5" />
                Typography
              </CardTitle>
              <CardDescription>
                Customize text appearance
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Font Family</Label>
                <Select value={settings.fontFamily} onValueChange={(value) => setSettings(prev => ({ ...prev, fontFamily: value }))}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {fontOptions.map((font) => (
                      <SelectItem key={font.value} value={font.value}>
                        {font.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Font Size: {settings.fontSize}px</Label>
                <Slider
                  value={[settings.fontSize]}
                  onValueChange={([value]) => setSettings(prev => ({ ...prev, fontSize: value }))}
                  min={12}
                  max={24}
                  step={1}
                  className="mt-2"
                />
              </div>
            </CardContent>
          </Card>

          {/* Animation Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Animation & Timing
              </CardTitle>
              <CardDescription>
                Control animation speeds and durations
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Spin Duration: {settings.spinDuration / 1000}s</Label>
                <Slider
                  value={[settings.spinDuration]}
                  onValueChange={([value]) => setSettings(prev => ({ ...prev, spinDuration: value }))}
                  min={1000}
                  max={8000}
                  step={500}
                  className="mt-2"
                />
              </div>

              <div>
                <Label>Winner Display Duration: {settings.winnerDisplayDuration / 1000}s</Label>
                <Slider
                  value={[settings.winnerDisplayDuration]}
                  onValueChange={([value]) => setSettings(prev => ({ ...prev, winnerDisplayDuration: value }))}
                  min={2000}
                  max={15000}
                  step={1000}
                  className="mt-2"
                />
              </div>
            </CardContent>
          </Card>

          {/* Messages */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                Messages
              </CardTitle>
              <CardDescription>
                Customize congratulatory messages
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div>
                <Label htmlFor="congratsMessage">Congratulations Message</Label>
                <Textarea
                  id="congratsMessage"
                  value={settings.congratsMessage}
                  onChange={(e) => setSettings(prev => ({ ...prev, congratsMessage: e.target.value }))}
                  placeholder="🎉 Congratulations, {name}! Well done!"
                  className="mt-1"
                  rows={3}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Use {"{name}"} to insert the winner's name
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Preview Panel */}
        {previewMode && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Live Preview</CardTitle>
                <CardDescription>
                  See how your customizations will look
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div 
                  className="w-full h-64 rounded-lg border-2 flex items-center justify-center"
                  style={{ 
                    backgroundColor: settings.backgroundColor,
                    borderColor: settings.primaryColor,
                    fontFamily: settings.fontFamily,
                    fontSize: `${settings.fontSize}px`
                  }}
                >
                  <div className="text-center">
                    <div 
                      className="w-32 h-32 rounded-full mx-auto mb-4 flex items-center justify-center"
                      style={{ backgroundColor: settings.primaryColor }}
                    >
                      <span style={{ color: settings.textColor, fontSize: '24px' }}>🎯</span>
                    </div>
                    <p style={{ color: settings.primaryColor }}>
                      Sample Wheel Preview
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Message Preview</CardTitle>
              </CardHeader>
              <CardContent>
                <div 
                  className="p-4 rounded-lg text-center"
                  style={{ 
                    backgroundColor: settings.primaryColor,
                    color: settings.textColor,
                    fontFamily: settings.fontFamily,
                    fontSize: `${settings.fontSize}px`
                  }}
                >
                  {settings.congratsMessage.replace('{name}', 'John Doe')}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-4 pt-6 border-t">
        <Button 
          onClick={handleSaveSettings}
          disabled={loading}
          className="text-white"
          style={{ backgroundColor: schoolColors.primary }}
        >
          <Save className="h-4 w-4 mr-2" />
          {loading ? "Saving..." : "Save Settings"}
        </Button>
        <Button onClick={resetToDefaults} variant="outline">
          <RotateCcw className="h-4 w-4 mr-2" />
          Reset to Defaults
        </Button>
      </div>
    </div>
  )
}
