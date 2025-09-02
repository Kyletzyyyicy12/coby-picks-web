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
import { Badge } from "@/components/ui/badge"
import { Palette, Volume2, VolumeX, Sun, Moon, Monitor, Sparkles } from "lucide-react"

interface ThemeSettings {
  colorScheme: "school" | "vibrant" | "minimal" | "custom"
  darkMode: boolean
  primaryColor: string
  secondaryColor: string
  accentColor: string
  fontFamily: "inter" | "roboto" | "poppins" | "custom"
  fontSize: number
  borderRadius: number
  animations: boolean
  soundEffects: boolean
  confettiEnabled: boolean
  customCss?: string
}

interface WheelCustomization {
  congratsMessage: string
  spinDuration: number
  numberOfWinners: number
  showParticipantEmails: boolean
  allowReactions: boolean
  autoShare: boolean
}

interface ThemeManagerProps {
  themeSettings: ThemeSettings
  wheelSettings: WheelCustomization
  onThemeChange: (settings: ThemeSettings) => void
  onWheelChange: (settings: WheelCustomization) => void
}

export function ThemeManager({ 
  themeSettings, 
  wheelSettings, 
  onThemeChange, 
  onWheelChange 
}: ThemeManagerProps) {
  const [activeTab, setActiveTab] = useState<"appearance" | "behavior" | "messages">("appearance")

  const schoolColors = {
    primary: "#8e0b16",
    secondary: "#66181E",
    accent: "#ffffff"
  }

  const colorSchemes = {
    school: {
      name: "School Colors",
      primary: "#8e0b16",
      secondary: "#66181E",
      accent: "#ffffff",
      description: "Official school branding colors"
    },
    vibrant: {
      name: "Vibrant",
      primary: "#3b82f6",
      secondary: "#8b5cf6",
      accent: "#10b981",
      description: "Bright and energetic colors"
    },
    minimal: {
      name: "Minimal",
      primary: "#374151",
      secondary: "#6b7280",
      accent: "#f3f4f6",
      description: "Clean and professional"
    },
    custom: {
      name: "Custom",
      primary: themeSettings.primaryColor,
      secondary: themeSettings.secondaryColor,
      accent: themeSettings.accentColor,
      description: "Your custom color palette"
    }
  }

  const updateTheme = (updates: Partial<ThemeSettings>) => {
    onThemeChange({ ...themeSettings, ...updates })
  }

  const updateWheel = (updates: Partial<WheelCustomization>) => {
    onWheelChange({ ...wheelSettings, ...updates })
  }

  const applyColorScheme = (scheme: keyof typeof colorSchemes) => {
    const colors = colorSchemes[scheme]
    updateTheme({
      colorScheme: scheme,
      primaryColor: colors.primary,
      secondaryColor: colors.secondary,
      accentColor: colors.accent
    })
  }

  const previewStyle = {
    backgroundColor: themeSettings.accentColor,
    color: themeSettings.primaryColor,
    borderColor: themeSettings.secondaryColor,
    borderRadius: `${themeSettings.borderRadius}px`,
    fontSize: `${themeSettings.fontSize}px`,
    fontFamily: themeSettings.fontFamily === "custom" ? "inherit" : themeSettings.fontFamily
  }

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="flex gap-2 border-b">
        <Button
          variant={activeTab === "appearance" ? "default" : "ghost"}
          onClick={() => setActiveTab("appearance")}
          className={activeTab === "appearance" ? "bg-[#8e0b16] text-white" : ""}
        >
          <Palette className="h-4 w-4 mr-2" />
          Appearance
        </Button>
        <Button
          variant={activeTab === "behavior" ? "default" : "ghost"}
          onClick={() => setActiveTab("behavior")}
          className={activeTab === "behavior" ? "bg-[#8e0b16] text-white" : ""}
        >
          <Sparkles className="h-4 w-4 mr-2" />
          Behavior
        </Button>
        <Button
          variant={activeTab === "messages" ? "default" : "ghost"}
          onClick={() => setActiveTab("messages")}
          className={activeTab === "messages" ? "bg-[#8e0b16] text-white" : ""}
        >
          Messages
        </Button>
      </div>

      {/* Appearance Tab */}
      {activeTab === "appearance" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-6">
            {/* Color Schemes */}
            <Card>
              <CardHeader>
                <CardTitle>Color Scheme</CardTitle>
                <CardDescription>Choose a predefined color palette or create your own</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-3">
                  {Object.entries(colorSchemes).map(([key, scheme]) => (
                    <div
                      key={key}
                      className={`p-3 border rounded-lg cursor-pointer transition-all ${
                        themeSettings.colorScheme === key ? "border-[#8e0b16] bg-red-50" : "border-gray-200 hover:border-gray-300"
                      }`}
                      onClick={() => applyColorScheme(key as keyof typeof colorSchemes)}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium">{scheme.name}</h4>
                          <p className="text-sm text-muted-foreground">{scheme.description}</p>
                        </div>
                        <div className="flex gap-1">
                          <div 
                            className="w-4 h-4 rounded-full border" 
                            style={{ backgroundColor: scheme.primary }}
                          />
                          <div 
                            className="w-4 h-4 rounded-full border" 
                            style={{ backgroundColor: scheme.secondary }}
                          />
                          <div 
                            className="w-4 h-4 rounded-full border" 
                            style={{ backgroundColor: scheme.accent }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Custom Colors */}
                {themeSettings.colorScheme === "custom" && (
                  <div className="space-y-3 pt-4 border-t">
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <Label htmlFor="primary-color">Primary</Label>
                        <Input
                          id="primary-color"
                          type="color"
                          value={themeSettings.primaryColor}
                          onChange={(e) => updateTheme({ primaryColor: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="secondary-color">Secondary</Label>
                        <Input
                          id="secondary-color"
                          type="color"
                          value={themeSettings.secondaryColor}
                          onChange={(e) => updateTheme({ secondaryColor: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="accent-color">Accent</Label>
                        <Input
                          id="accent-color"
                          type="color"
                          value={themeSettings.accentColor}
                          onChange={(e) => updateTheme({ accentColor: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Typography */}
            <Card>
              <CardHeader>
                <CardTitle>Typography</CardTitle>
                <CardDescription>Customize fonts and text appearance</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4">
                  <div>
                    <Label htmlFor="font-family">Font Family</Label>
                    <Select 
                      value={themeSettings.fontFamily} 
                      onValueChange={(value: any) => updateTheme({ fontFamily: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="inter">Inter (Default)</SelectItem>
                        <SelectItem value="roboto">Roboto</SelectItem>
                        <SelectItem value="poppins">Poppins</SelectItem>
                        <SelectItem value="custom">Custom</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="font-size">Font Size: {themeSettings.fontSize}px</Label>
                    <Slider
                      id="font-size"
                      min={12}
                      max={20}
                      step={1}
                      value={[themeSettings.fontSize]}
                      onValueChange={(value) => updateTheme({ fontSize: value[0] })}
                      className="mt-2"
                    />
                  </div>

                  <div>
                    <Label htmlFor="border-radius">Border Radius: {themeSettings.borderRadius}px</Label>
                    <Slider
                      id="border-radius"
                      min={0}
                      max={20}
                      step={1}
                      value={[themeSettings.borderRadius]}
                      onValueChange={(value) => updateTheme({ borderRadius: value[0] })}
                      className="mt-2"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Display Options */}
            <Card>
              <CardHeader>
                <CardTitle>Display Options</CardTitle>
                <CardDescription>Control visual effects and animations</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="dark-mode">Dark Mode</Label>
                    <p className="text-sm text-muted-foreground">Switch to dark theme</p>
                  </div>
                  <Switch
                    id="dark-mode"
                    checked={themeSettings.darkMode}
                    onCheckedChange={(checked) => updateTheme({ darkMode: checked })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="animations">Animations</Label>
                    <p className="text-sm text-muted-foreground">Enable smooth transitions</p>
                  </div>
                  <Switch
                    id="animations"
                    checked={themeSettings.animations}
                    onCheckedChange={(checked) => updateTheme({ animations: checked })}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Preview */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Live Preview</CardTitle>
                <CardDescription>See how your customizations will look</CardDescription>
              </CardHeader>
              <CardContent>
                <div 
                  className="p-6 border-2 rounded-lg space-y-4"
                  style={previewStyle}
                >
                  <h3 className="text-xl font-bold">Coby Picks Randomizer</h3>
                  <p className="text-sm opacity-80">Sample wheel interface with your theme</p>
                  
                  <div className="flex gap-2">
                    <Button 
                      size="sm"
                      style={{ 
                        backgroundColor: themeSettings.primaryColor,
                        color: themeSettings.accentColor 
                      }}
                    >
                      Spin Wheel
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      style={{ 
                        borderColor: themeSettings.secondaryColor,
                        color: themeSettings.secondaryColor 
                      }}
                    >
                      Reset
                    </Button>
                  </div>

                  <div 
                    className="p-3 rounded border"
                    style={{ 
                      backgroundColor: themeSettings.secondaryColor,
                      color: themeSettings.accentColor 
                    }}
                  >
                    <p className="text-sm">🎉 Winner: John Doe</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Behavior Tab */}
      {activeTab === "behavior" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Wheel Behavior</CardTitle>
              <CardDescription>Configure how the randomizer works</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="spin-duration">Spin Duration: {wheelSettings.spinDuration / 1000}s</Label>
                <Slider
                  id="spin-duration"
                  min={1000}
                  max={8000}
                  step={500}
                  value={[wheelSettings.spinDuration]}
                  onValueChange={(value) => updateWheel({ spinDuration: value[0] })}
                  className="mt-2"
                />
              </div>

              <div>
                <Label htmlFor="winners">Number of Winners</Label>
                <Select 
                  value={wheelSettings.numberOfWinners.toString()} 
                  onValueChange={(value) => updateWheel({ numberOfWinners: parseInt(value) })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
                      <SelectItem key={num} value={num.toString()}>{num} Winner{num > 1 ? 's' : ''}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="sound-effects">Sound Effects</Label>
                  <p className="text-sm text-muted-foreground">Play sounds during spin</p>
                </div>
                <Switch
                  id="sound-effects"
                  checked={themeSettings.soundEffects}
                  onCheckedChange={(checked) => updateTheme({ soundEffects: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="confetti">Confetti Effect</Label>
                  <p className="text-sm text-muted-foreground">Show confetti when winners are selected</p>
                </div>
                <Switch
                  id="confetti"
                  checked={themeSettings.confettiEnabled}
                  onCheckedChange={(checked) => updateTheme({ confettiEnabled: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="show-emails">Show Participant Emails</Label>
                  <p className="text-sm text-muted-foreground">Display email addresses in results</p>
                </div>
                <Switch
                  id="show-emails"
                  checked={wheelSettings.showParticipantEmails}
                  onCheckedChange={(checked) => updateWheel({ showParticipantEmails: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="allow-reactions">Allow Student Reactions</Label>
                  <p className="text-sm text-muted-foreground">Let students react during live draws</p>
                </div>
                <Switch
                  id="allow-reactions"
                  checked={wheelSettings.allowReactions}
                  onCheckedChange={(checked) => updateWheel({ allowReactions: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="auto-share">Auto-Share Results</Label>
                  <p className="text-sm text-muted-foreground">Automatically share results with participants</p>
                </div>
                <Switch
                  id="auto-share"
                  checked={wheelSettings.autoShare}
                  onCheckedChange={(checked) => updateWheel({ autoShare: checked })}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Messages Tab */}
      {activeTab === "messages" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Custom Messages</CardTitle>
              <CardDescription>Personalize messages shown to participants</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="congrats-message">Congratulations Message</Label>
                <Textarea
                  id="congrats-message"
                  value={wheelSettings.congratsMessage}
                  onChange={(e) => updateWheel({ congratsMessage: e.target.value })}
                  placeholder="Use {name} for winner's name"
                  rows={3}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Use {"{name}"} to insert the winner's name
                </p>
              </div>

              <div className="p-3 bg-gray-50 rounded border">
                <h4 className="font-medium mb-2">Preview:</h4>
                <p className="text-sm">
                  {wheelSettings.congratsMessage.replace('{name}', 'John Doe')}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
