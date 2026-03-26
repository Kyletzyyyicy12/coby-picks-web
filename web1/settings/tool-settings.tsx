"use client"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { THEMES } from "@/lib/wheel-data"

interface ToolSettingsProps {
  wheel: any // Use 'any' for now to avoid circular dependency with Dashboard's Wheel type
  onUpdateWheel: (updatedWheel: any) => void
}

export function ToolSettings({ wheel, onUpdateWheel }: ToolSettingsProps) {
  const handleSettingChange = (key: string, value: any) => {
    onUpdateWheel({ ...wheel, [key]: value })
  }

  return (
    <Accordion type="multiple" className="w-full" defaultValue={["spin-behavior", "tool-colors"]}>
      <AccordionItem value="spin-behavior">
        <AccordionTrigger className="text-lg font-semibold text-swu-red">Spin Behavior</AccordionTrigger>
        <AccordionContent className="grid gap-4 p-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="confetti-sound">Confetti & Sound</Label>
            <Switch
              id="confetti-sound"
              checked={wheel.confettiAndSound || false}
              onCheckedChange={(checked) => handleSettingChange("confettiAndSound", checked)}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="spin-speed-level">Spinning Speed Level: {wheel.spinSpeedLevel || 5}</Label>
            <Slider
              id="spin-speed-level"
              min={1}
              max={10}
              step={1}
              value={[wheel.spinSpeedLevel || 5]}
              onValueChange={(val) => handleSettingChange("spinSpeedLevel", val[0])}
            />
            <p className="text-sm text-muted-foreground">1 (Slow) - 10 (Fast)</p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="spin-duration">Spinning Duration: {wheel.spinDuration || 10}s</Label>
            <Slider
              id="spin-duration"
              min={3}
              max={30}
              step={1}
              value={[wheel.spinDuration || 10]}
              onValueChange={(val) => handleSettingChange("spinDuration", val[0])}
            />
            <p className="text-sm text-muted-foreground">How long the wheel spins before stopping.</p>
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="manual-stop">Manually Stop (Max 1 min)</Label>
            <Switch
              id="manual-stop"
              checked={wheel.manualStop || false}
              onCheckedChange={(checked) => handleSettingChange("manualStop", checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="mystery-spin">Mystery Spin (Hide inputs on wheel)</Label>
            <Switch
              id="mystery-spin"
              checked={wheel.mysterySpin || false}
              onCheckedChange={(checked) => handleSettingChange("mysterySpin", checked)}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="spin-count">Spin Count (Total spins for this wheel)</Label>
            <Input id="spin-count" type="number" value={wheel.spinCount || 0} readOnly className="w-24 bg-muted" />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="random-initial-angle">Random Initial Angle</Label>
            <Switch
              id="random-initial-angle"
              checked={wheel.randomInitialAngle || false}
              onCheckedChange={(checked) => handleSettingChange("randomInitialAngle", checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="initial-spinning">Initial Spinning (Slowly after page load)</Label>
            <Switch
              id="initial-spinning"
              checked={wheel.initialSpinning || false}
              onCheckedChange={(checked) => handleSettingChange("initialSpinning", checked)}
            />
          </div>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="tool-colors">
        <AccordionTrigger className="text-lg font-semibold text-swu-red">Tool Colors & Appearance</AccordionTrigger>
        <AccordionContent className="grid gap-4 p-4">
          <div className="grid gap-2">
            <Label htmlFor="wheel-theme">Wheel Colors Theme</Label>
            <Select value={wheel.theme || "default"} onValueChange={(value) => handleSettingChange("theme", value)}>
              <SelectTrigger id="wheel-theme">
                <SelectValue placeholder="Select a theme" />
              </SelectTrigger>
              <SelectContent>
                {THEMES.map((theme) => (
                  <SelectItem key={theme.value} value={theme.value}>
                    {theme.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">Choose a predefined color palette for the wheel segments.</p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="wheel-bg-image">Wheel Background Image URL</Label>
            <Input
              id="wheel-bg-image"
              type="url"
              value={wheel.wheelBgImage || ""}
              onChange={(e) => handleSettingChange("wheelBgImage", e.target.value)}
              placeholder="e.g., https://example.com/wheel-bg.png"
            />
            <p className="text-sm text-muted-foreground">An image to display behind the segments of the wheel.</p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="center-image">Image at the Center of the Wheel URL</Label>
            <Input
              id="center-image"
              type="url"
              value={wheel.centerImage || ""}
              onChange={(e) => handleSettingChange("centerImage", e.target.value)}
              placeholder="e.g., https://example.com/logo.png"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="center-image-size">Center Image Size: {wheel.centerImageSize || 50}px</Label>
            <Slider
              id="center-image-size"
              min={10}
              max={200}
              step={5}
              value={[wheel.centerImageSize || 50]}
              onValueChange={(val) => handleSettingChange("centerImageSize", val[0])}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="page-bg-color">Page Background Color</Label>
            <Input
              id="page-bg-color"
              type="color"
              value={wheel.pageBackgroundColor || "#f8fafc"} // Default to gray-50
              onChange={(e) => handleSettingChange("pageBackgroundColor", e.target.value)}
            />
            <p className="text-sm text-muted-foreground">Sets the background color of the entire page.</p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="wheel-border-width">Wheel Border Width: {wheel.wheelBorderWidth || 2}px</Label>
            <Slider
              id="wheel-border-width"
              min={0}
              max={10}
              step={1}
              value={[wheel.wheelBorderWidth || 2]}
              onValueChange={(val) => handleSettingChange("wheelBorderWidth", val[0])}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="wheel-border-color">Wheel Border Color</Label>
            <Input
              id="wheel-border-color"
              type="color"
              value={wheel.wheelBorderColor || "#A00000"} // Default to swu-red
              onChange={(e) => handleSettingChange("wheelBorderColor", e.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="wheel-shadow">Wheel Shadow</Label>
            <Select
              value={wheel.wheelShadow || "none"}
              onValueChange={(value) => handleSettingChange("wheelShadow", value)}
            >
              <SelectTrigger id="wheel-shadow">
                <SelectValue placeholder="Select shadow style" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="sm">Small</SelectItem>
                <SelectItem value="md">Medium</SelectItem>
                <SelectItem value="lg">Large</SelectItem>
                <SelectItem value="xl">Extra Large</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}
