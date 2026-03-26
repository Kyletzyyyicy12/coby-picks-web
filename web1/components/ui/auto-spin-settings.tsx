"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Slider } from "@/components/ui/slider"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { toast } from "@/hooks/use-toast"
import { Play, Pause, Square, Settings, Clock, RotateCcw, AlertTriangle } from "lucide-react"

export interface AutoSpinConfig {
  enabled: boolean
  interval: number // seconds between spins
  maxSpins: number // maximum number of auto-spins
  autoReset: boolean // reset winners after each spin
  pauseOnWinner: boolean // pause when winner is selected
  spinDuration: number // how long each spin lasts
  showWinnerDelay: number // how long to show winner before next spin
  stopConditions: {
    maxDuration: number // max total duration in minutes
    onEmpty: boolean // stop when no more participants
    onManual: boolean // allow manual stop
  }
}

interface AutoSpinSettingsProps {
  config: AutoSpinConfig
  onConfigChange: (config: AutoSpinConfig) => void
  isRunning: boolean
  currentSpinCount: number
  onStart: () => void
  onPause: () => void
  onStop: () => void
  onReset: () => void
  totalParticipants?: number
  remainingParticipants?: number
  elapsedTime?: number
}

export function AutoSpinSettings({
  config,
  onConfigChange,
  isRunning,
  currentSpinCount,
  onStart,
  onPause,
  onStop,
  onReset,
  totalParticipants = 0,
  remainingParticipants = 0,
  elapsedTime = 0
}: AutoSpinSettingsProps) {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [localConfig, setLocalConfig] = useState<AutoSpinConfig>(config)

  useEffect(() => {
    setLocalConfig(config)
  }, [config])

  const updateConfig = (updates: Partial<AutoSpinConfig>) => {
    const newConfig = { ...localConfig, ...updates }
    setLocalConfig(newConfig)
    onConfigChange(newConfig)
  }

  const updateStopConditions = (updates: Partial<AutoSpinConfig['stopConditions']>) => {
    updateConfig({
      stopConditions: { ...localConfig.stopConditions, ...updates }
    })
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const getProgress = () => {
    if (localConfig.maxSpins === 0) return 0
    return (currentSpinCount / localConfig.maxSpins) * 100
  }

  const getRemainingTime = () => {
    if (localConfig.maxSpins === 0) return 0
    const remainingSpins = localConfig.maxSpins - currentSpinCount
    const timePerSpin = localConfig.interval + localConfig.spinDuration + localConfig.showWinnerDelay
    return remainingSpins * timePerSpin
  }

  const canStart = () => {
    return !isRunning && totalParticipants > 0 && localConfig.maxSpins > 0
  }

  const shouldShowWarnings = () => {
    return localConfig.interval < 5 || localConfig.maxSpins > 50
  }

  const saveSettings = () => {
    onConfigChange(localConfig)
    setIsSettingsOpen(false)
    toast({
      title: "Settings Saved",
      description: "Auto-spin configuration has been updated"
    })
  }

  return (
    <div className="space-y-4">
      {/* Status Card */}
      <Card className={`border-2 ${isRunning ? 'border-green-200 bg-green-50' : 'border-gray-200'}`}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-full ${isRunning ? 'bg-green-100' : 'bg-gray-100'}`}>
                {isRunning ? (
                  <Play className="h-4 w-4 text-green-600" />
                ) : (
                  <Pause className="h-4 w-4 text-gray-600" />
                )}
              </div>
              <div>
                <div className="font-medium text-sm">
                  {isRunning ? 'Auto-Spinning Active' : 'Auto-Spin Ready'}
                </div>
                <div className="text-xs text-muted-foreground">
                  {currentSpinCount}/{localConfig.maxSpins} spins • {formatTime(elapsedTime)} elapsed
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={isRunning ? "default" : "outline"}>
                {isRunning ? 'Running' : 'Stopped'}
              </Badge>
              {localConfig.enabled && (
                <Badge variant="outline" className="text-xs">
                  {localConfig.interval}s interval
                </Badge>
              )}
            </div>
          </div>
          
          {/* Progress Bar */}
          {localConfig.maxSpins > 0 && (
            <div className="mt-3">
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>Progress</span>
                <span>{Math.round(getProgress())}%</span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-blue-500 to-green-500 transition-all duration-300"
                  style={{ width: `${getProgress()}%` }}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Controls */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Button
          onClick={onStart}
          disabled={!canStart()}
          className="bg-green-600 hover:bg-green-700 text-white"
          size="sm"
        >
          <Play className="h-4 w-4 mr-1" />
          Start
        </Button>
        
        <Button
          onClick={onPause}
          disabled={!isRunning}
          variant="outline"
          size="sm"
        >
          <Pause className="h-4 w-4 mr-1" />
          Pause
        </Button>
        
        <Button
          onClick={onStop}
          disabled={!isRunning}
          variant="outline"
          className="border-red-200 text-red-600 hover:bg-red-50"
          size="sm"
        >
          <Square className="h-4 w-4 mr-1" />
          Stop
        </Button>
        
        <Button
          onClick={onReset}
          variant="outline"
          size="sm"
        >
          <RotateCcw className="h-4 w-4 mr-1" />
          Reset
        </Button>
      </div>

      {/* Quick Settings */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="auto-spin-enabled" className="text-sm font-medium">
              Enable Auto-Spin
            </Label>
            <Switch
              id="auto-spin-enabled"
              checked={localConfig.enabled}
              onCheckedChange={(enabled) => updateConfig({ enabled })}
            />
          </div>

          {localConfig.enabled && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm">Interval (seconds)</Label>
                  <Select 
                    value={localConfig.interval.toString()} 
                    onValueChange={(value) => updateConfig({ interval: parseInt(value) })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="3">3 seconds</SelectItem>
                      <SelectItem value="5">5 seconds</SelectItem>
                      <SelectItem value="10">10 seconds</SelectItem>
                      <SelectItem value="15">15 seconds</SelectItem>
                      <SelectItem value="30">30 seconds</SelectItem>
                      <SelectItem value="60">1 minute</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label className="text-sm">Max Spins</Label>
                  <Input
                    type="number"
                    min="1"
                    max="100"
                    value={localConfig.maxSpins}
                    onChange={(e) => updateConfig({ maxSpins: parseInt(e.target.value) || 1 })}
                  />
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="auto-reset" className="text-sm">Auto-reset after each spin</Label>
                  <Switch
                    id="auto-reset"
                    checked={localConfig.autoReset}
                    onCheckedChange={(autoReset) => updateConfig({ autoReset })}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <Label htmlFor="pause-on-winner" className="text-sm">Pause on winner selection</Label>
                  <Switch
                    id="pause-on-winner"
                    checked={localConfig.pauseOnWinner}
                    onCheckedChange={(pauseOnWinner) => updateConfig({ pauseOnWinner })}
                  />
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Advanced Settings Dialog */}
      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" className="w-full">
            <Settings className="h-4 w-4 mr-2" />
            Advanced Settings
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Advanced Auto-Spin Settings</DialogTitle>
            <DialogDescription>
              Configure detailed timing and behavior options for auto-spinning
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {/* Timing Settings */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium">Timing Configuration</h4>
              
              <div className="space-y-3">
                <div>
                  <Label className="text-sm">Spin Duration: {localConfig.spinDuration}s</Label>
                  <Slider
                    value={[localConfig.spinDuration]}
                    onValueChange={([value]) => updateConfig({ spinDuration: value })}
                    min={2}
                    max={10}
                    step={0.5}
                    className="mt-2"
                  />
                </div>
                
                <div>
                  <Label className="text-sm">Winner Display Delay: {localConfig.showWinnerDelay}s</Label>
                  <Slider
                    value={[localConfig.showWinnerDelay]}
                    onValueChange={([value]) => updateConfig({ showWinnerDelay: value })}
                    min={1}
                    max={10}
                    step={0.5}
                    className="mt-2"
                  />
                </div>
              </div>
            </div>

            {/* Stop Conditions */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium">Stop Conditions</h4>
              
              <div className="space-y-3">
                <div>
                  <Label className="text-sm">Maximum Duration (minutes)</Label>
                  <Input
                    type="number"
                    min="1"
                    max="120"
                    value={localConfig.stopConditions.maxDuration}
                    onChange={(e) => updateStopConditions({ 
                      maxDuration: parseInt(e.target.value) || 30 
                    })}
                    className="mt-1"
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <Label htmlFor="stop-on-empty" className="text-sm">Stop when no participants remain</Label>
                  <Switch
                    id="stop-on-empty"
                    checked={localConfig.stopConditions.onEmpty}
                    onCheckedChange={(onEmpty) => updateStopConditions({ onEmpty })}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <Label htmlFor="allow-manual-stop" className="text-sm">Allow manual stop</Label>
                  <Switch
                    id="allow-manual-stop"
                    checked={localConfig.stopConditions.onManual}
                    onCheckedChange={(onManual) => updateStopConditions({ onManual })}
                  />
                </div>
              </div>
            </div>

            {/* Warnings */}
            {shouldShowWarnings() && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-yellow-800">Configuration Warnings:</p>
                    <ul className="mt-1 text-yellow-700 list-disc list-inside">
                      {localConfig.interval < 5 && (
                        <li>Short intervals may cause performance issues</li>
                      )}
                      {localConfig.maxSpins > 50 && (
                        <li>High spin count may take a very long time</li>
                      )}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Preview */}
            <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
              <h5 className="text-sm font-medium text-blue-800 mb-2">Estimated Duration</h5>
              <div className="text-sm text-blue-700">
                <p>• Time per spin: ~{localConfig.interval + localConfig.spinDuration + localConfig.showWinnerDelay}s</p>
                <p>• Total estimated time: ~{formatTime(getRemainingTime())}</p>
                <p>• Remaining: {getRemainingTime() > 0 ? formatTime(getRemainingTime()) : 'Not started'}</p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSettingsOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveSettings}>
              Save Settings
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stats */}
      {totalParticipants > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div className="space-y-1">
            <div className="text-lg font-bold text-blue-600">{totalParticipants}</div>
            <div className="text-xs text-muted-foreground">Total Participants</div>
          </div>
          <div className="space-y-1">
            <div className="text-lg font-bold text-green-600">{remainingParticipants}</div>
            <div className="text-xs text-muted-foreground">Remaining</div>
          </div>
          <div className="space-y-1">
            <div className="text-lg font-bold text-orange-600">{currentSpinCount}</div>
            <div className="text-xs text-muted-foreground">Spins Done</div>
          </div>
          <div className="space-y-1">
            <div className="text-lg font-bold text-purple-600">{formatTime(elapsedTime)}</div>
            <div className="text-xs text-muted-foreground">Elapsed</div>
          </div>
        </div>
      )}
    </div>
  )
}