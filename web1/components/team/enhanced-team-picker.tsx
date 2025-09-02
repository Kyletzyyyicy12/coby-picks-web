"use client"

import React, { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Users, Target, RotateCcw, Trash2, Eye, Copy, Download, Upload, FileText, Settings, Shuffle } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"

interface Person {
  id: string
  name: string
  gender?: 'M' | 'F'
  label?: string
}

interface Team {
  id: string
  name: string
  members: Person[]
  customName?: string
}

interface GroupRule {
  id: string
  type: 'together' | 'separate'
  names: string[]
  description: string
}

interface EnhancedTeamPickerProps {
  initialNames?: string[]
  canEdit?: boolean
  onTeamsGenerated?: (teams: Team[]) => void
  disabled?: boolean
  readonly?: boolean
}

export const EnhancedTeamPicker: React.FC<EnhancedTeamPickerProps> = ({
  initialNames = [],
  canEdit = true,
  onTeamsGenerated,
  disabled = false,
  readonly = false
}) => {
  // State for inputs
  const [inputText, setInputText] = useState("")
  const [peopleCount, setPeopleCount] = useState(0)
  const [inputMethod, setInputMethod] = useState<'csv'>('csv') // Only import file option

  // State for controller
  const [distributionType, setDistributionType] = useState<'groups' | 'size'>('groups')
  const [numGroups, setNumGroups] = useState(4)
  const [peoplePerGroup, setPeoplePerGroup] = useState(4)
  const [balanceType, setBalanceType] = useState<'default' | 'label'>('default') // Removed gender option
  const [groupRules, setGroupRules] = useState<GroupRule[]>([])
  const [enableCustomization, setEnableCustomization] = useState(true)

  // State for results
  const [teams, setTeams] = useState<Team[]>([])
  const [showGroupsBoard, setShowGroupsBoard] = useState(false)
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false)
  const [showAnnouncementPopup, setShowAnnouncementPopup] = useState(false)
  
  // File input ref
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Initialize with provided names
  useEffect(() => {
    if (initialNames.length > 0 && inputText === "") {
      const namesText = initialNames.join("\n")
      setInputText(namesText)
      setPeopleCount(initialNames.length)
    }
  }, [initialNames])

  // Update people count when input changes
  useEffect(() => {
    const names = inputText
      .split(/[\n,]/)
      .map(name => name.trim())
      .filter(name => name.length > 0)
    setPeopleCount(names.length)
  }, [inputText])

  // Parse names from input text with gender and label support
  const parseNames = (): Person[] => {
    const names = inputText
      .split(/[\n,]/) 
      .map(name => name.trim())
      .filter(name => name.length > 0)
    
    return names.map((nameStr, index) => {
      // Parse gender: (M) or (F)
      const genderMatch = nameStr.match(/\((M|F)\)/i)
      const gender = genderMatch ? (genderMatch[1].toUpperCase() as 'M' | 'F') : undefined
      
      // Parse label: [Label]
      const labelMatch = nameStr.match(/\[([^\]]+)\]/)
      const label = labelMatch ? labelMatch[1].trim() : undefined
      
      // Clean name (remove gender and label markers)
      const cleanName = nameStr
        .replace(/\((M|F)\)/gi, '')
        .replace(/\[[^\]]+\]/g, '')
        .trim()
      
      return {
        id: `person-${index}`,
        name: cleanName,
        gender,
        label
      }
    })
  }

  // Generate teams with advanced distribution logic
  const generateTeams = () => {
    const people = parseNames()
    
    if (people.length === 0) {
      toast({
        title: "No Names Found",
        description: "Please enter some names to generate teams",
        variant: "destructive"
      })
      return
    }

    // Calculate number of groups
    let actualNumGroups: number
    if (distributionType === 'groups') {
      actualNumGroups = Math.min(numGroups, people.length)
    } else {
      actualNumGroups = Math.ceil(people.length / peoplePerGroup)
    }

    // Ensure we have at least 1 group and max 100 groups
    actualNumGroups = Math.max(1, Math.min(100, actualNumGroups))

    // Shuffle people for random distribution
    let shuffledPeople = [...people]
    
    // Apply balance type distribution (removed gender balance)
    if (balanceType === 'label') {
      // Group by label and distribute evenly
      const labelGroups: { [key: string]: Person[] } = {}
      shuffledPeople.forEach(person => {
        const key = person.label || 'No Label'
        if (!labelGroups[key]) labelGroups[key] = []
        labelGroups[key].push(person)
      })
      
      // Shuffle each label group
      Object.keys(labelGroups).forEach(key => {
        labelGroups[key] = labelGroups[key].sort(() => Math.random() - 0.5)
      })
      
      // Interleave labels for even distribution
      shuffledPeople = []
      const labelKeys = Object.keys(labelGroups)
      const maxLabelLength = Math.max(...labelKeys.map(key => labelGroups[key].length))
      
      for (let i = 0; i < maxLabelLength; i++) {
        labelKeys.forEach(key => {
          if (i < labelGroups[key].length) {
            shuffledPeople.push(labelGroups[key][i])
          }
        })
      }
    } else {
      // Default random distribution
      shuffledPeople = shuffledPeople.sort(() => Math.random() - 0.5)
    }

    // Create teams with proper naming
    const newTeams: Team[] = []
    for (let i = 0; i < actualNumGroups; i++) {
      let teamName: string
      if (i < 3) {
        teamName = `group${i + 1}`
      } else {
        teamName = `Team ${i + 1}`
      }

      newTeams.push({
        id: `team-${i}`,
        name: teamName,
        customName: teamName,
        members: []
      })
    }

    // Distribute people evenly across teams
    shuffledPeople.forEach((person, index) => {
      const teamIndex = index % actualNumGroups
      newTeams[teamIndex].members.push(person)
    })

    // Apply group size constraints if using size-based distribution
    if (distributionType === 'size' && peoplePerGroup > 0) {
      const maxSize = peoplePerGroup
      
      // Redistribute if any team exceeds max size
      for (let i = 0; i < newTeams.length; i++) {
        while (newTeams[i].members.length > maxSize && newTeams.length < 100) {
          const spillPerson = newTeams[i].members.pop()!
          
          // Try to find a team with space
          let placed = false
          for (let j = 0; j < newTeams.length; j++) {
            if (newTeams[j].members.length < maxSize) {
              newTeams[j].members.push(spillPerson)
              placed = true
              break
            }
          }
          
          // Create new team if needed
          if (!placed && newTeams.length < 100) {
            const newTeamIndex = newTeams.length
            newTeams.push({
              id: `team-${newTeamIndex}`,
              name: `Team ${newTeamIndex + 1}`,
              customName: `Team ${newTeamIndex + 1}`,
              members: [spillPerson]
            })
          } else if (!placed) {
            // If we can't create more teams, put back in last team
            newTeams[newTeams.length - 1].members.push(spillPerson)
            break
          }
        }
      }
    }

    setTeams(newTeams)
    onTeamsGenerated?.(newTeams)

    // Show announcement popup with confetti
    setShowAnnouncementPopup(true)
    
    // Auto close popup after 3 seconds
    setTimeout(() => {
      setShowAnnouncementPopup(false)
    }, 3000)
  }

  // Handle CSV/Excel import
  const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      const content = e.target?.result as string
      const lines = content.split('\n')
      const names: string[] = []
      
      lines.forEach(line => {
        const trimmed = line.trim()
        if (trimmed) {
          // Handle CSV format - take first column or the entire line
          const firstValue = trimmed.split(',')[0].replace(/"/g, '').trim()
          if (firstValue) {
            names.push(firstValue)
          }
        }
      })
      
      if (names.length > 0) {
        setInputText(names.join('\n'))
        toast({
          title: "File Imported",
          description: `Imported ${names.length} names from file`,
        })
      } else {
        toast({
          title: "Import Failed",
          description: "No valid names found in file",
          variant: "destructive"
        })
      }
    }
    
    reader.readAsText(file)
    // Reset file input
    if (event.target) {
      event.target.value = ''
    }
  }

  // Rename team function
  const renameTeam = (teamId: string, newName: string) => {
    setTeams(prev => prev.map(team => 
      team.id === teamId 
        ? { ...team, customName: newName || team.name }
        : team
    ))
  }

  // Remove all groups
  const removeAllGroups = () => {
    setTeams([])
    toast({
      title: "All Groups Removed",
      description: "Teams have been cleared",
    })
  }

  // Open groups board
  const openGroupsBoard = () => {
    if (teams.length === 0) {
      toast({
        title: "No Teams Available",
        description: "Generate teams first to view the groups board",
        variant: "destructive"
      })
      return
    }
    setShowGroupsBoard(true)
  }

  // Copy teams to clipboard
  const copyTeamsToClipboard = async () => {
    if (teams.length === 0) return

    let text = "Team Distribution:\n\n"
    teams.forEach((team, index) => {
      text += `${team.name}:\n`
      team.members.forEach(member => {
        text += `  - ${member.name}\n`
      })
      text += "\n"
    })

    try {
      await navigator.clipboard.writeText(text)
      toast({
        title: "Copied to Clipboard",
        description: "Team distribution copied successfully",
      })
    } catch (error) {
      toast({
        title: "Copy Failed",
        description: "Could not copy to clipboard",
        variant: "destructive"
      })
    }
  }

  // Export teams as text file
  const exportTeams = () => {
    if (teams.length === 0) return

    let text = "Team Distribution\n"
    text += "================\n\n"
    teams.forEach((team, index) => {
      text += `${team.name}:\n`
      team.members.forEach(member => {
        text += `  - ${member.name}\n`
      })
      text += "\n"
    })

    const blob = new Blob([text], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `team-distribution-${Date.now()}.txt`
    a.click()
    URL.revokeObjectURL(url)

    toast({
      title: "Teams Exported",
      description: "Team distribution saved as text file",
    })
  }

  return (
    <div className="space-y-4 max-h-screen overflow-hidden">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.txt,.xlsx"
        onChange={handleFileImport}
        className="hidden"
      />
      
      <Card className="h-full">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Users className="h-5 w-5" />
            Team Picker Wheel – Random Team Generator
          </CardTitle>
          <CardDescription className="text-sm">
            Split names into equal groups, pairs, or custom sizes. Balance by labels.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 overflow-y-auto max-h-[calc(100vh-140px)]">
          {/* Responsive Grid Layout for Steps */}
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            
            {/* 1. INPUT SECTION */}
            <Card className="border border-gray-200">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-sm font-bold bg-[#8e0b16] text-white">1</Badge>
                  <h3 className="text-base font-semibold">Input Names</h3>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Import File Section */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Import method:</Label>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs">Import file</span>
                  </div>
                </div>

                {/* Import Actions */}
                <div className="flex gap-1">
                  <Button
                    onClick={() => fileInputRef.current?.click()}
                    variant="outline"
                    size="sm"
                    className="text-xs"
                  >
                    <Upload className="h-3 w-3 mr-1" />
                    Choose File
                  </Button>
                  <Button
                    onClick={() => setInputText("Alice Johnson\nBob Smith\nCarol Davis\nDavid Wilson [Teacher]\nEve Brown [Student]")}
                    variant="outline"
                    size="sm"
                    className="text-xs"
                  >
                    Sample
                  </Button>
                </div>

                {/* People Count Display */}
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="bg-[#8e0b16] text-white text-xs px-2 py-1">
                    {peopleCount}
                  </Badge>
                  <span className="text-xs text-muted-foreground">people</span>
                </div>

                {/* Input Area - Reduced Height */}
                <Textarea
                  id="nameInput"
                  placeholder="Import file or enter names (one per line)\n\nAlice\nBob\nCarol [Teacher]"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  disabled={disabled || readonly || !canEdit}
                  rows={4}
                  className="resize-none text-xs"
                />

                {/* Format Help - Compact */}
                <div className="p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700">
                  <strong>Tips:</strong> Add [Label] for groups
                </div>
              </CardContent>
            </Card>

            {/* 2 & 3. DISTRIBUTION AND GROUP SIZE SECTION - Combined */}
            <Card className="border border-gray-200">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-sm font-bold bg-[#8e0b16] text-white">2</Badge>
                  <h3 className="text-base font-semibold">Setup & Distribution</h3>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Balance Type Selection */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Distribution balance:</Label>
                  <RadioGroup
                    value={balanceType}
                    onValueChange={(value: 'default' | 'label') => setBalanceType(value)}
                    className="flex flex-col gap-2"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="default" id="default" className="h-3 w-3" />
                      <Label htmlFor="default" className="text-xs">Random</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="label" id="label" className="h-3 w-3" />
                      <Label htmlFor="label" className="text-xs">Label balance</Label>
                    </div>
                  </RadioGroup>
                </div>

                <Separator />

                {/* Group Size Section */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Group size method:</Label>
                  <RadioGroup
                    value={distributionType}
                    onValueChange={(value: 'groups' | 'size') => setDistributionType(value)}
                    className="space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="groups" id="groups" className="h-3 w-3" />
                        <Label htmlFor="groups" className="text-xs">Number of groups</Label>
                      </div>
                      {distributionType === 'groups' && (
                        <Input
                          type="number"
                          min="1"
                          max="100"
                          value={numGroups}
                          onChange={(e) => setNumGroups(Math.max(1, parseInt(e.target.value) || 4))}
                          disabled={disabled || readonly || !canEdit}
                          className="w-16 h-6 text-xs text-center"
                        />
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="size" id="size" className="h-3 w-3" />
                        <Label htmlFor="size" className="text-xs">People per group</Label>
                      </div>
                      {distributionType === 'size' && (
                        <Input
                          type="number"
                          min="1"
                          max="50"
                          value={peoplePerGroup}
                          onChange={(e) => setPeoplePerGroup(Math.max(1, parseInt(e.target.value) || 4))}
                          disabled={disabled || readonly || !canEdit}
                          className="w-16 h-6 text-xs text-center"
                        />
                      )}
                    </div>
                  </RadioGroup>
                </div>

                {/* Action Buttons - Compact */}
                <div className="flex flex-col gap-2 pt-2">
                  <Button
                    onClick={generateTeams}
                    disabled={disabled || readonly || !canEdit || peopleCount === 0}
                    className="bg-[#8e0b16] hover:bg-[#66181E] text-white text-sm py-2"
                    size="sm"
                  >
                    <Target className="h-3 w-3 mr-1" />
                    START RANDOMIZATION
                  </Button>

                  <div className="flex gap-1">
                    <Button
                      variant="outline"
                      onClick={openGroupsBoard}
                      disabled={teams.length === 0}
                      size="sm"
                      className="text-xs flex-1"
                    >
                      <Eye className="h-3 w-3 mr-1" />
                      View Results
                    </Button>
                    <Button
                      variant="outline"
                      onClick={removeAllGroups}
                      disabled={teams.length === 0}
                      size="sm"
                      className="text-xs flex-1"
                    >
                      <Trash2 className="h-3 w-3 mr-1" />
                      Clear
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 4. RESULTS SECTION - Optimized */}
            <Card className="border border-gray-200 lg:col-span-1 xl:col-span-1">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-sm font-bold bg-[#8e0b16] text-white">3</Badge>
                  <h3 className="text-base font-semibold">Results & Export</h3>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {teams.length > 0 ? (
                  <div className="space-y-3">
                    {/* Results Summary - Compact */}
                    <div className="flex items-center justify-between p-2 bg-green-50 border border-green-200 rounded">
                      <div className="flex items-center gap-2">
                        <Badge variant="default" className="bg-green-600 text-xs px-2 py-1">
                          {teams.length} Teams
                        </Badge>
                        <span className="text-xs text-green-700">
                          {peopleCount} people
                        </span>
                      </div>
                    </div>

                    {/* Export Buttons - Horizontal */}
                    <div className="flex gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={copyTeamsToClipboard}
                        className="text-xs flex-1"
                      >
                        <Copy className="h-3 w-3 mr-1" />
                        Copy
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={exportTeams}
                        className="text-xs flex-1"
                      >
                        <Download className="h-3 w-3 mr-1" />
                        Export
                      </Button>
                    </div>

                    {/* Team List - Compact with Max Height */}
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {teams.slice(0, 6).map((team) => (
                        <div
                          key={team.id}
                          className="p-2 border rounded bg-white"
                        >
                          <div className="flex items-center justify-between mb-1">
                            <h4 className="font-semibold text-[#8e0b16] text-xs">
                              {team.customName || team.name}
                            </h4>
                            <Badge variant="secondary" className="text-xs">
                              {team.members.length}
                            </Badge>
                          </div>
                          <div className="space-y-1">
                            {team.members.slice(0, 3).map((member, index) => (
                              <div key={member.id} className="text-xs text-gray-700 flex items-center gap-1">
                                <span className="w-3 h-3 bg-gray-100 rounded-full flex items-center justify-center text-xs">
                                  {index + 1}
                                </span>
                                <span className="flex-1 truncate">{member.name}</span>
                                {member.gender && (
                                  <span className="text-xs text-gray-500">
                                    {member.gender === 'M' ? '♂' : '♀'}
                                  </span>
                                )}
                              </div>
                            ))}
                            {team.members.length > 3 && (
                              <div className="text-xs text-gray-500 text-center">
                                +{team.members.length - 3} more
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                      {teams.length > 6 && (
                        <div className="text-xs text-gray-500 text-center p-2">
                          +{teams.length - 6} more teams (click View Results for all)
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-6 text-muted-foreground">
                    <Users className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm font-semibold">No teams yet</p>
                    <p className="text-xs">Enter names and start randomization</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Additional Features Info - Compact */}
          {teams.length > 0 && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded">
              <h4 className="font-semibold text-blue-800 mb-1 text-sm">Available Features:</h4>
              <div className="text-xs text-blue-700 grid grid-cols-2 gap-1">
                <p>✅ Confetti & sound effects</p>
                <p>✅ Custom branding</p>
                <p>✅ Save as image/CSV</p>
                <p>✅ Cloud storage</p>
                <p>✅ Share results link</p>
                <p>✅ Group constraints</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Groups Board Dialog - Full Screen View */}
      <Dialog open={showGroupsBoard} onOpenChange={setShowGroupsBoard}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Team Distribution Results
            </DialogTitle>
            <DialogDescription>
              {teams.length} teams with {peopleCount} people total
            </DialogDescription>
          </DialogHeader>
          
          {teams.length > 0 && (
            <div className="space-y-4">
              {/* Export Actions */}
              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  onClick={copyTeamsToClipboard}
                  className="border-green-500 text-green-600 hover:bg-green-500 hover:text-white"
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copy All Teams
                </Button>
                <Button
                  variant="outline"
                  onClick={exportTeams}
                  className="border-blue-500 text-blue-600 hover:bg-blue-500 hover:text-white"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export as CSV
                </Button>
              </div>

              {/* Full Team Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {teams.map((team) => (
                  <div
                    key={team.id}
                    className="p-4 border rounded-lg bg-white hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center justify-between mb-3">
                      {enableCustomization ? (
                        <Input
                          value={team.customName || team.name}
                          onChange={(e) => renameTeam(team.id, e.target.value)}
                          className="font-semibold text-[#8e0b16] border-none p-0 h-auto focus:ring-0"
                          placeholder="Team name..."
                        />
                      ) : (
                        <h4 className="font-semibold text-[#8e0b16]">
                          {team.customName || team.name}
                        </h4>
                      )}
                      <Badge variant="secondary" className="text-xs">
                        {team.members.length} members
                      </Badge>
                    </div>
                    <div className="space-y-2">
                      {team.members.map((member, index) => (
                        <div key={member.id} className="text-sm text-gray-700 flex items-center gap-2">
                          <Badge variant="outline" className="text-xs w-6 h-6 rounded-full flex items-center justify-center">
                            {index + 1}
                          </Badge>
                          <span className="flex-1">{member.name}</span>
                          {member.gender && (
                            <span className="text-xs text-gray-500">
                              {member.gender === 'M' ? '♂' : '♀'}
                            </span>
                          )}
                          {member.label && (
                            <Badge variant="outline" className="text-xs">
                              {member.label}
                            </Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Advanced Settings Dialog */}
      <Dialog open={showAdvancedSettings} onOpenChange={setShowAdvancedSettings}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Advanced Team Features
            </DialogTitle>
            <DialogDescription>
              Additional customization options for team generation
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h4 className="font-semibold text-blue-800 mb-2">Premium Features Available:</h4>
              <div className="text-sm text-blue-700 space-y-1">
                <p>✨ Confetti effects and custom sound notifications</p>
                <p>✨ Brand customization with colors and logos</p>
                <p>✨ Advanced group rules and constraints</p>
                <p>✨ Preset team templates and configurations</p>
                <p>✨ Enhanced export options (PDF, images)</p>
                <p>✨ Cloud storage and sharing capabilities</p>
              </div>
            </div>
            
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setShowAdvancedSettings(false)}
              >
                Close
              </Button>
              <Button
                className="bg-[#8e0b16] hover:bg-[#66181E] text-white"
                onClick={() => {
                  toast({
                    title: "Premium Features",
                    description: "Advanced features coming soon! Stay tuned for updates.",
                  })
                  setShowAdvancedSettings(false)
                }}
              >
                Learn More
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Announcement Popup with Confetti */}
      <Dialog open={showAnnouncementPopup} onOpenChange={setShowAnnouncementPopup}>
        <DialogContent className="max-w-md text-center relative overflow-hidden">
          {/* Confetti Animation */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="confetti-container">
              {[...Array(50)].map((_, i) => (
                <div
                  key={i}
                  className="confetti"
                  style={{
                    left: `${Math.random() * 100}%`,
                    backgroundColor: ['#8e0b16', '#66181E', '#f59e0b', '#10b981', '#ef4444'][Math.floor(Math.random() * 5)],
                    animationDelay: `${Math.random() * 3}s`,
                    animationDuration: `${3 + Math.random() * 2}s`
                  }}
                />
              ))}
            </div>
          </div>
          
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-[#8e0b16] mb-4">
              🎉 Teams Generated Successfully! 🎉
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="text-6xl">🎆</div>
            <div className="text-lg font-semibold text-gray-700">
              Created {teams.length} teams with {peopleCount} people!
            </div>
            <div className="text-sm text-gray-500">
              Your teams are ready! Check the results section below.
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <style jsx>{`
        .confetti-container {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          overflow: hidden;
        }
        
        .confetti {
          position: absolute;
          width: 8px;
          height: 8px;
          border-radius: 2px;
          animation: confetti-fall linear infinite;
        }
        
        @keyframes confetti-fall {
          0% {
            transform: translateY(-100vh) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) rotate(360deg);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  )
}

export default EnhancedTeamPicker
