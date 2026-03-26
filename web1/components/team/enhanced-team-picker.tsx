
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
import { Checkbox } from "@/components/ui/checkbox"
import { Users, Target, RotateCcw, Trash2, Eye, Copy, Download, Upload, FileText, Settings, Shuffle, Crown, Tag, Weight, X, Plus, Search } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import * as XLSX from 'xlsx'
import { db } from "@/lib/firebase"
import { doc, updateDoc, serverTimestamp, onSnapshot } from "firebase/firestore"

interface Person {
  id: string
  name: string
  gender?: 'M' | 'F'
  label?: string
  isLeader?: boolean
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
    soloMode?: boolean
    isParticipantView?: boolean // New prop to explicitly indicate participant view
    sessionId?: string // For live mode synchronization
    liveTeams?: Team[] // Live teams data from parent component for participant sync
  }

export const EnhancedTeamPicker: React.FC<EnhancedTeamPickerProps> = ({
    initialNames = [],
    canEdit = true,
    onTeamsGenerated,
    disabled: externalDisabled = false,
    readonly: externalReadonly = false,
    soloMode = false,
    isParticipantView = false,
    sessionId,
    liveTeams: propLiveTeams
  }) => {
   // State for inputs
   const [inputText, setInputText] = useState("")
   const [peopleCount, setPeopleCount] = useState(0)
   const [inputMethod, setInputMethod] = useState<'manual' | 'csv'>('manual')
   const [peopleList, setPeopleList] = useState<Person[]>([])
   const [showPeopleEditor, setShowPeopleEditor] = useState(false)
   const [searchQuery, setSearchQuery] = useState("")

  // State for controller
  const [distributionType, setDistributionType] = useState<'groups' | 'size'>('groups')
  const [numGroups, setNumGroups] = useState(4)
  const [peoplePerGroup, setPeoplePerGroup] = useState(4)
  const [balanceType, setBalanceType] = useState<'default'>('default') // Only default option
  const [groupRules, setGroupRules] = useState<GroupRule[]>([])
  const [enableCustomization, setEnableCustomization] = useState(true)

  // State for results
  const [teams, setTeams] = useState<Team[]>([])
  const [showGroupsBoard, setShowGroupsBoard] = useState(false)
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false)
  const [showAnnouncementPopup, setShowAnnouncementPopup] = useState(false)
  const [isRevealing, setIsRevealing] = useState(false)
  const [liveTeams, setLiveTeams] = useState<Team[]>([])
  const [isAnnouncementTriggered, setIsAnnouncementTriggered] = useState(false)

  // Animation state for sequential reveal
  const [revealedGroups, setRevealedGroups] = useState<Set<number>>(new Set())
  const [revealedMembers, setRevealedMembers] = useState<Map<number, Set<number>>>(new Map())
  const [animatingMembers, setAnimatingMembers] = useState<Map<string, boolean>>(new Map())

  // Export options visibility toggle for participants
  const [showExportOptions, setShowExportOptions] = useState(false)

  // Initial component reveal animation state
  const [isInitialReveal, setIsInitialReveal] = useState(false)

  // Function to start smooth person-to-group reveal animation
  const startSmoothReveal = (teams: Team[]) => {
    console.log("🎬 Starting smooth person-to-group reveal animation for", teams.length, "teams")

    // Reset animation state
    setRevealedGroups(new Set())
    setRevealedMembers(new Map())
    setAnimatingMembers(new Map())

    // Calculate timing constants - SLOWER REVEAL AS REQUESTED
    const personStaggerDelay = 800 // ms delay between each name reveal (0.8 seconds - slower)
    const personAnimationDuration = 700 // ms per person animation (smooth pop-up effect)
    const groupRevealDelay = 300 // ms delay after group appears before first name
    const betweenGroupDelay = 500 // ms delay between groups

    const totalPeople = teams.reduce((sum, team) => sum + team.members.length, 0)
    const totalAnimationTime = (totalPeople * personStaggerDelay) + (teams.length * (groupRevealDelay + betweenGroupDelay)) + personAnimationDuration

    console.log(`🎬 Animation timing: ${teams.length} groups, ${totalPeople} people, ${totalAnimationTime}ms total`)

    // Create reveal sequence: Group 1 appears, then names fill Group 1 slowly, then Group 2 appears, then names fill Group 2 slowly, etc.
    let currentDelay = 0

    teams.forEach((team, teamIndex) => {
      // Step 1: Reveal the group header first
      setTimeout(() => {
        setRevealedGroups(prev => {
          const newSet = new Set(prev)
          newSet.add(teamIndex)
          return newSet
        })
        console.log(`🎬 Group ${teamIndex + 1} (${team.name}) header revealed`)
      }, currentDelay)

      currentDelay += groupRevealDelay // Wait before starting name reveals

      // Step 2: Reveal names in this group one by one with SLOWER pacing
      team.members.forEach((member, memberIndex) => {
        setTimeout(() => {
          // Start animation for this person
          setAnimatingMembers(prev => {
            const newMap = new Map(prev)
            newMap.set(`${member.id}`, true)
            return newMap
          })

          // After animation completes, add to revealed members
          setTimeout(() => {
            setRevealedMembers(prev => {
              const newMap = new Map(prev)
              const groupMembers = newMap.get(teamIndex) || new Set()
              groupMembers.add(memberIndex)
              newMap.set(teamIndex, groupMembers)
              return newMap
            })

            // Remove from animating
            setAnimatingMembers(prev => {
              const newMap = new Map(prev)
              newMap.delete(`${member.id}`)
              return newMap
            })

            console.log(`🎬 Person ${member.name} revealed in group ${teamIndex + 1} at position ${memberIndex + 1}`)
          }, personAnimationDuration)

        }, currentDelay)

        currentDelay += personStaggerDelay // Slower delay between each name reveal
      })

      currentDelay += betweenGroupDelay // Extra delay between groups
    })

    // Return the total animation time so caller can wait for completion
    return totalAnimationTime
  }

  // Ref to track previous teams for participant view
  const previousTeamsRef = useRef<Team[]>([])

  // File input ref
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Dialog state with simple isolation for participants
  const [isDialogUserInitiated, setIsDialogUserInitiated] = useState(false)

  // Determine if this is participant view (cannot edit or control)
  const isParticipantMode = isParticipantView || externalReadonly || externalDisabled

  // FIXED: Enhanced team detection for participants - prioritize prop data for immediate display
  let effectiveTeams: Team[] = []

  // For participants, prioritize prop data (from parent session) for immediate display
  if (isParticipantMode) {
    // FIXED PRIORITY: propLiveTeams first (immediate display), then liveTeams (Firebase updates), then empty
    effectiveTeams = (propLiveTeams && propLiveTeams.length > 0) ? propLiveTeams : (liveTeams.length > 0 ? liveTeams : [])
    
    console.log("🎯 PARTICIPANT: FIXED Team detection analysis", {
      sessionId,
      propLiveTeamsLength: (propLiveTeams?.length || 0),
      liveTeamsLength: liveTeams.length,
      effectiveTeamsLength: effectiveTeams.length,
      teamsSource: (propLiveTeams?.length || 0) > 0 ? 'propLiveTeams (parent prop - PRIORITY)' : (liveTeams.length > 0 ? 'liveTeams (Firebase)' : 'none'),
      propLiveTeamsData: propLiveTeams ? propLiveTeams.slice(0, 1) : null,
      liveTeamsData: liveTeams.length > 0 ? liveTeams.slice(0, 1) : null,
      timestamp: new Date().toISOString()
    })
    
    // Debug actual team data content
    if (effectiveTeams.length > 0) {
      console.log("🎯 PARTICIPANT: Teams found with content", {
        teamCount: effectiveTeams.length,
        firstTeamName: effectiveTeams[0]?.name || 'Unknown',
        firstTeamMembers: effectiveTeams[0]?.members?.map((m: any) => m.name) || [],
        allTeamNames: effectiveTeams.map(t => t.name),
        sessionId
      })
    } else {
      console.log("🎯 PARTICIPANT: No teams found in any source", {
        propTeamsEmpty: !propLiveTeams || (propLiveTeams?.length || 0) === 0,
        liveTeamsEmpty: liveTeams.length === 0,
        sessionId,
        timestamp: new Date().toISOString()
      })
    }
  } else {
    // Organizer mode: prioritize internal teams state, fallback to prop teams, then liveTeams
    effectiveTeams = teams.length > 0 ? teams : (propLiveTeams || liveTeams)
    
    console.log("🎯 ORGANIZER: Team source comparison", {
      hasPropTeams: !!propLiveTeams,
      propTeamsLength: propLiveTeams?.length || 0,
      hasLiveTeams: !!liveTeams,
      liveTeamsLength: liveTeams.length,
      hasInternalTeams: !!teams,
      internalTeamsLength: teams.length,
      effectiveTeamsLength: effectiveTeams.length,
      sessionId
    })
  }

  // Log overall comparison for debugging
  console.log("🎯 TEAM PICKER: Overall team state", {
    isParticipantMode,
    effectiveTeamsLength: effectiveTeams.length,
    sessionId,
    timestamp: new Date().toISOString(),
    // Show which source provided the teams
    teamsSource: isParticipantMode
      ? ((propLiveTeams?.length || 0) > 0 ? 'propLiveTeams (parent prop - PRIORITY)' :
         (liveTeams.length > 0 ? 'liveTeams (Firebase)' : 'none'))
      : (teams.length > 0 ? 'internal teams' :
         (propLiveTeams ? 'propLiveTeams' : 'liveTeams'))
  })

  // Initialize with provided names
  useEffect(() => {
    if (initialNames.length > 0 && inputText === "") {
      const namesText = initialNames.join("\n")
      setInputText(namesText)
      setPeopleCount(initialNames.length)
    }
  }, [initialNames])

  // Initial component reveal animation
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsInitialReveal(true)
    }, 300) // Small delay to ensure component is mounted

    return () => clearTimeout(timer)
  }, [])

  // Watch for prop teams changes (from parent Firebase listener) and trigger popup for participants
  React.useEffect(() => {
    if (!isParticipantMode) {
      console.log("🎯 PARTICIPANT: Skipping prop teams effect - not in participant mode")
      return
    }

    if (!propLiveTeams || propLiveTeams.length === 0) {
      console.log("🎯 PARTICIPANT: No prop teams to process", {
        hasPropTeams: !!propLiveTeams,
        propTeamsLength: propLiveTeams?.length || 0,
        sessionId: sessionId,
        timestamp: new Date().toISOString()
      })
      return
    }

    console.log("🎯 PARTICIPANT: Prop teams received from parent", {
      teamsCount: propLiveTeams.length,
      sessionId: sessionId,
      timestamp: new Date().toISOString(),
      firstTeamName: propLiveTeams[0]?.name || 'Unknown',
      allTeamNames: propLiveTeams.map(t => t.name || 'Unnamed'),
      firstTeamMembers: propLiveTeams[0]?.members?.map((m: any) => m.name) || [],
      teamsDataStructure: {
        hasIds: propLiveTeams.every(t => t.id),
        hasNames: propLiveTeams.every(t => t.name),
        hasMembers: propLiveTeams.every(t => t.members && Array.isArray(t.members)),
        memberCounts: propLiveTeams.map(t => t.members?.length || 0)
      }
    })

    // Start smooth person-to-group reveal animation
    const animationTime = startSmoothReveal(propLiveTeams)

    // CRITICAL FIX: Trigger announcement popup when teams are received from parent
    // Wait for animation to complete before showing popup
    setTimeout(() => {
      console.log("🎯 PARTICIPANT: Animation completed, triggering announcement popup from prop teams")
      setShowAnnouncementPopup(true)

      // Show success notification
      toast({
        title: "🎉 Teams Generated!",
        description: `Your teams have been created with ${propLiveTeams.length} groups`,
      })
    }, animationTime + 200) // Wait for animation + small buffer

    console.log("🎯 PARTICIPANT: Prop teams update completed", {
      popupTriggered: true,
      toastTriggered: true,
      sessionId: sessionId
    })
  }, [propLiveTeams, isParticipantMode, sessionId])

  // Set input method based on solo mode
  useEffect(() => {
    if (soloMode) {
      setInputMethod('manual')
    }
  }, [soloMode])

  // 🔥 BIDIRECTIONAL SYNC: Listen to Firebase inputText changes (for collaborator sync)
  useEffect(() => {
    if (!sessionId) return

    const unsubscribe = onSnapshot(
      doc(db, "liveDrawSessions", sessionId),
      (docSnapshot) => {
        if (docSnapshot.exists()) {
          const sessionData = docSnapshot.data()
          const firebaseInputText = sessionData.wheelState?.teamPickerInputText || ""
          
          // Only update if different (prevent loop)
          if (firebaseInputText && firebaseInputText !== inputText) {
            console.log("🔥 TEAM PICKER SYNC: Received inputText from Firebase", {
              sessionId,
              firebaseInputText: firebaseInputText.substring(0, 100),
              currentInputText: inputText.substring(0, 100),
              timestamp: new Date().toISOString()
            })
            
            setInputText(firebaseInputText)
          }
        }
      }
    )

    return () => unsubscribe()
  }, [sessionId])

  // 🔥 BIDIRECTIONAL SYNC: Upload inputText to Firebase when organizer changes it
  const syncInputTextToFirebase = async (text: string) => {
    if (!sessionId) return

    try {
      await updateDoc(doc(db, "liveDrawSessions", sessionId), {
        "wheelState.teamPickerInputText": text,
        "wheelState.teamPickerLastUpdated": serverTimestamp(),
        "lastUpdated": serverTimestamp()
      })

      console.log("🔥 TEAM PICKER SYNC: Uploaded inputText to Firebase", {
        sessionId,
        textPreview: text.substring(0, 100),
        timestamp: new Date().toISOString()
      })
    } catch (error) {
      console.error("❌ Error syncing inputText to Firebase:", error)
    }
  }

  // Update people count when input changes
  useEffect(() => {
    const names = inputText
      .split(/[\n,]/)
      .map(name => name.trim())
      .filter(name => name.length > 0)
    setPeopleCount(names.length)
    
    // Auto-update people list for editor
    if (names.length > 0) {
      const parsed = parseNamesSimple(inputText)
      setPeopleList(parsed)
    }

    // 🔥 SYNC: If organizer (not participant), upload to Firebase
    if (!isParticipantMode && sessionId) {
      syncInputTextToFirebase(inputText)
    }
  }, [inputText, sessionId, isParticipantMode])

  // Simple parse for initial list
  const parseNamesSimple = (text: string): Person[] => {
    const names = text
      .split(/[\n,]/)
      .map(name => name.trim())
      .filter(name => name.length > 0)
    
    return names.map((nameStr, index) => {
      const cleanName = nameStr
        .replace(/\((M|F)\)/gi, '')
        .replace(/\[[^\]]+\]/g, '')
        .trim()
      
      return {
        id: `person-${index}`,
        name: cleanName
      }
    })
  }

  // Update person in list
  const updatePerson = (id: string, updates: Partial<Person>) => {
    setPeopleList(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p))
  }

  // Remove person from list
  const removePerson = (id: string) => {
    setPeopleList(prev => prev.filter(p => p.id !== id))
    // Also update input text
    const updatedText = peopleList.filter(p => p.id !== id).map(p => p.name).join('\n')
    setInputText(updatedText)
  }

  // Add new person
  const addPerson = () => {
    const newPerson: Person = {
      id: `person-${Date.now()}`,
      name: ''
    }
    setPeopleList(prev => [...prev, newPerson])
  }

  // Apply changes from editor back to input text
  const applyPeopleEditorChanges = () => {
    const formattedText = peopleList.map(person => {
      let line = person.name
      if (person.isLeader) line += ' [Leader]'
      if (person.label) line += ` [${person.label}]`
      return line
    }).join('\n')
    
    setInputText(formattedText)
    setShowPeopleEditor(false)
    
    toast({
      title: "Settings Applied",
      description: `Updated ${peopleList.length} people with their settings`,
    })
  }



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

      // Parse isLeader: [Leader]
      const isLeader = /\s*\[leader\]/i.test(nameStr)
      
      // Clean name (remove gender, label, and leader markers)
      const cleanName = nameStr
        .replace(/\((M|F)\)/gi, '')
        .replace(/\[[^\]]+\]/g, '')
        .replace(/\s*\[leader\]/i, '')
        .trim()
      
      return {
        id: `person-${index}`,
        name: cleanName,
        gender,
        label,
        isLeader
      }
    })
  }

  // Generate teams with advanced distribution logic
  const generateTeams = async () => {
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

    // Separate leaders and other participants
    const leaders = people.filter(p => p.isLeader)
    const otherParticipants = people.filter(p => !p.isLeader)

    // Create teams
    const newTeams: Team[] = []
    for (let i = 0; i < actualNumGroups; i++) {
      newTeams.push({
        id: `team-${i}`,
        name: `Team ${i + 1}`,
        customName: `Team ${i + 1}`,
        members: []
      })
    }

    // Distribute leaders
    leaders.forEach((leader, index) => {
      const teamIndex = index % actualNumGroups
      newTeams[teamIndex].members.push(leader)
    })

    // Simple shuffle for other participants
    const shuffledPeople = [...otherParticipants].sort(() => Math.random() - 0.5)

    // Distribute other participants
    shuffledPeople.forEach((person) => {
      // Find the team with the fewest members
      newTeams.sort((a, b) => a.members.length - b.members.length)
      newTeams[0].members.push(person)
    })

    // Set all teams at once for instant display
    setTeams(newTeams)
    setIsRevealing(true)

    // Start smooth person-to-group reveal animation for organizers too
    const animationTime = startSmoothReveal(newTeams)

    onTeamsGenerated?.(newTeams)

    // Sync to Firebase for participants - send all teams at once
    if (sessionId && canEdit && !externalReadonly) {
      try {
        console.log("🎯 ORGANIZER: Saving teams to Firebase", {
          sessionId,
          teamsCount: newTeams.length,
          firstTeamName: newTeams[0]?.name || 'Unknown',
          timestamp: new Date().toISOString()
        })

        // Comprehensive cleanup function to remove all undefined values at all levels
        const cleanUndefinedValues = (obj: any): any => {
          if (obj === null || obj === undefined) return null
          if (typeof obj !== 'object') return obj

          if (Array.isArray(obj)) {
            return obj.map(item => cleanUndefinedValues(item)).filter(item => item !== null && item !== undefined)
          }

          const cleaned: any = {}
          Object.entries(obj).forEach(([key, value]) => {
            const cleanedValue = cleanUndefinedValues(value)
            if (cleanedValue !== null && cleanedValue !== undefined) {
              cleaned[key] = cleanedValue
            }
          })
          return cleaned
        }

        // Clean up wheelState and teams data to remove all undefined values
        const lastWheelState = (typeof window !== 'undefined' ? (window as any).lastWheelState : {}) || {}
        const cleanedWheelState = cleanUndefinedValues(lastWheelState)
        const cleanedTeams = cleanUndefinedValues(newTeams)

        console.log("🎯 ORGANIZER: Cleaning data before Firebase update", {
          sessionId,
          originalTeamsLength: newTeams.length,
          cleanedTeamsLength: cleanedTeams.length,
          hasOriginalUndefined: JSON.stringify(newTeams).includes('undefined'),
          hasCleanedUndefined: JSON.stringify(cleanedTeams).includes('undefined'),
          timestamp: new Date().toISOString()
        })

        await updateDoc(doc(db, "liveDrawSessions", sessionId), {
          teams: cleanedTeams,
          wheelState: {
            ...cleanedWheelState,
            teams: cleanedTeams,
            teamDistribution: true,
            revealedTeams: cleanedTeams.length
          },
          updatedAt: serverTimestamp()
        })

        console.log("🎯 ORGANIZER: Teams saved to Firebase successfully", {
          sessionId,
          teamsCount: newTeams.length,
          timestamp: new Date().toISOString()
        })
      } catch (error) {
        console.error("❌ ORGANIZER: Failed to sync teams:", error)
        toast({
          title: "Sync Error",
          description: "Failed to sync teams with participants. Please try again.",
          variant: "destructive"
        })
      }
    }

    // Wait for animation to complete before showing popup
    setTimeout(() => {
      console.log("🎯 ORGANIZER: Animation completed, showing announcement popup")
      setShowAnnouncementPopup(true)
    }, animationTime + 200) // Add small buffer
  }

  // JSX structure has been fixed - all parentheses and brackets are properly closed

  // Handle CSV/Excel import
  const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const fileExtension = file.name.split('.').pop()?.toLowerCase()

    if (fileExtension === 'xlsx') {
      // Handle XLSX files
      const reader = new FileReader()
      reader.onload = (e) => {
        const data = e.target?.result
        if (data) {
          try {
            const workbook = XLSX.read(data, { type: 'array' })
            const sheetName = workbook.SheetNames[0]
            const worksheet = workbook.Sheets[sheetName]
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][]

            const names: string[] = []
            let startRow = 0
            
            // Find the header row (skip title and empty rows)
            for (let i = 0; i < jsonData.length; i++) {
              const row = jsonData[i]
              if (row && row[0] && (row[0].toString().toLowerCase().includes('full name') || row[0].toString().toLowerCase().includes('name'))) {
                startRow = i + 1
                break
              }
            }

            // Process data rows
            for (let i = startRow; i < jsonData.length; i++) {
              const row = jsonData[i]
              if (row && row.length > 0) {
                const fullName = row[0]?.toString().trim()
                const label = row[1]?.toString().trim()
                const isLeader = row[2]?.toString().trim().toLowerCase() === 'yes'

                if (fullName && !fullName.toLowerCase().includes('instruction')) {
                  let nameEntry = fullName
                  
                  // Add label if present
                  if (label) {
                    nameEntry += ` [${label}]`
                  }
                  
                  // Add leader marker if present
                  if (isLeader) {
                    nameEntry += ` [Leader]`
                  }
                  
                  names.push(nameEntry)
                }
              }
            }

            if (names.length > 0) {
              setInputText(names.join('\n'))
              toast({
                title: "XLSX Imported Successfully",
                description: `Imported ${names.length} full names with their settings`,
              })
            } else {
              toast({
                title: "Import Failed",
                description: "No valid names found in XLSX file",
                variant: "destructive"
              })
            }
          } catch (error) {
            toast({
              title: "Import Error",
              description: "Failed to parse XLSX file. Please ensure it's a valid Excel file.",
              variant: "destructive"
            })
          }
        }
      }
      reader.readAsArrayBuffer(file)
    } else {
      // Handle CSV/TXT files as before
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
    }

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
  const removeAllGroups = async () => {
    setTeams([])
    toast({
      title: "All Groups Removed",
      description: "Teams have been cleared",
    })

    // Clear teams for participants via Firebase
    if (sessionId && canEdit && !externalReadonly) {
      try {
        console.log("🎯 ORGANIZER: Clearing teams for all participants", {
          sessionId,
          timestamp: new Date().toISOString()
        })

        await updateDoc(doc(db, "liveDrawSessions", sessionId), {
          teams: [],
          wheelState: {
            teams: [],
            teamDistribution: false,
            revealedTeams: 0,
            resetAt: serverTimestamp()
          },
          updatedAt: serverTimestamp()
        })

        console.log("🎯 ORGANIZER: Teams cleared for all participants", {
          sessionId,
          timestamp: new Date().toISOString()
        })
      } catch (error) {
        console.error("❌ ORGANIZER: Failed to clear teams for participants:", error)
        toast({
          title: "Sync Error",
          description: "Failed to clear teams for participants. Please try again.",
          variant: "destructive"
        })
      }
    }
  }

  // Reset for new randomization (for live room organizers) - FIXED: Don't auto-close user dialogs
  const resetForNewRun = () => {
    setTeams([])
    // REMOVED: Auto-closing dialogs - let user control when to close them
    // setShowGroupsBoard(false)
    // setShowAdvancedSettings(false)
    // setShowAnnouncementPopup(false)
    // Clear announcement trigger for new run
    setIsAnnouncementTriggered(false)
  }


  // REMOVED: Auto-recovery effect that was causing dialog interference

  // Firebase listener protection - CRITICAL: Don't close user-initiated dialogs
  React.useEffect(() => {
    if (!isParticipantMode || !sessionId || effectiveTeams.length === 0) return

    console.log("🔒 DIALOG PROTECTION: Setting up Firebase update protection for participant dialogs", {
      sessionId,
      effectiveTeamsLength: effectiveTeams.length,
      showGroupsBoard,
      showAnnouncementPopup,
      isDialogUserInitiated,
      timestamp: new Date().toISOString()
    })

    // Override Firebase listener to protect user dialogs
    const originalOnSnapshot = (window as any).__firebaseOnSnapshot || function() {}
    
    return () => {
      // Cleanup any protection mechanisms if needed
      console.log("🔒 DIALOG PROTECTION: Cleaning up participant dialog protection")
    }
  }, [isParticipantMode, sessionId, effectiveTeams.length, showGroupsBoard, showAnnouncementPopup, isDialogUserInitiated])

  // Expose reset function for parent components
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).resetTeamPicker = resetForNewRun
      console.log('🔧 Reset function available as window.resetTeamPicker')
    }
  }, [])

  // Listen for live team updates in participant mode - DIRECT FIREBASE LISTENER
  React.useEffect(() => {
    if (!sessionId || !isParticipantMode) {
      console.log("🎯 PARTICIPANT: Skipping direct Firebase listener setup", {
        sessionId: !!sessionId,
        isParticipantMode,
        reason: !sessionId ? "No sessionId" : "Not in participant mode"
      })
      return
    }

    console.log("🎯 PARTICIPANT: Setting up DIRECT Firebase listener for live teams", {
      sessionId,
      isParticipantMode,
      timestamp: new Date().toISOString()
    })

    const unsubscribe = onSnapshot(
      doc(db, "liveDrawSessions", sessionId),
      (docSnapshot) => {
        if (!docSnapshot.exists()) {
          console.log("🎯 PARTICIPANT: Session document does not exist")
          return
        }

        const data = docSnapshot.data()
        console.log("🎯 PARTICIPANT: DIRECT Firebase snapshot received", {
          hasData: !!data,
          hasTeams: !!data?.teams,
          hasWheelStateTeams: !!data?.wheelState?.teams,
          teamsLength: data?.teams?.length || 0,
          wheelStateTeamsLength: data?.wheelState?.teams?.length || 0,
          sessionId: sessionId,
          timestamp: new Date().toISOString()
        })

        // Check for teams in multiple possible locations
        const teamsData = data.teams || data.wheelState?.teams || []

        // Enhanced debugging for Firebase data analysis
        console.log("🎯 PARTICIPANT: DIRECT Teams data analysis", {
          hasData: !!data,
          hasTeamsField: !!data?.teams,
          hasWheelStateField: !!data?.wheelState,
          hasWheelStateTeamsField: !!data?.wheelState?.teams,
          teamsDataLength: teamsData.length,
          previousTeamsLength: previousTeamsRef.current.length,
          hasNewTeams: teamsData.length > 0 && JSON.stringify(teamsData) !== JSON.stringify(previousTeamsRef.current),
          sessionId: sessionId,
          teamsDataSource: data?.teams ? 'data.teams (top level)' : (data?.wheelState?.teams ? 'data.wheelState.teams' : 'no teams found'),
          firebasePath: `liveDrawSessions/${sessionId}`,
          timestamp: new Date().toISOString(),
          // Log the actual data structure for debugging
          rawTeamsData: teamsData.slice(0, 2), // First 2 teams for debugging
          dataKeys: Object.keys(data || {}),
          wheelStateKeys: Object.keys(data?.wheelState || {})
        })

        // Detailed comparison with previous teams
        const currentTeamsStr = JSON.stringify(teamsData)
        const previousTeamsStr = JSON.stringify(previousTeamsRef.current)
        const teamsChanged = currentTeamsStr !== previousTeamsStr

        console.log("🎯 PARTICIPANT: Teams comparison analysis", {
          teamsChanged,
          currentLength: teamsData.length,
          previousLength: previousTeamsRef.current.length,
          currentHasData: teamsData.length > 0,
          previousHadData: previousTeamsRef.current.length > 0,
          sessionId: sessionId,
          timestamp: new Date().toISOString()
        })

        if (teamsData && teamsData.length > 0) {
          console.log("🎯 PARTICIPANT: TEAMS FOUND - Processing update", {
            teamsCount: teamsData.length,
            source: data?.teams ? 'data.teams (top level)' : 'data.wheelState.teams',
            sessionId: sessionId,
            firebasePath: `liveDrawSessions/${sessionId}`,
            timestamp: new Date().toISOString(),
            firstTeamName: teamsData[0]?.name || 'Unknown',
            firstTeamMembers: teamsData[0]?.members?.map((m: any) => m.name) || [],
            allTeamNames: teamsData.map((t: Team) => t.name || 'Unnamed'),
            teamsChanged
          })

          // Update live teams state immediately
          setLiveTeams(teamsData)
          previousTeamsRef.current = [...teamsData] // Create copy to avoid reference issues

          console.log("🎯 PARTICIPANT: Live teams state updated", {
            newLiveTeamsLength: teamsData.length,
            previousTeamsLength: previousTeamsRef.current.length,
            sessionId
          })

          // Trigger reveal animation
          setIsRevealing(true)

          // Start smooth person-to-group reveal animation
          const animationTime = startSmoothReveal(teamsData)

          // CRITICAL FIX: Wait for animation to complete before showing popup
          setTimeout(() => {
            console.log("🎯 PARTICIPANT: Animation completed, triggering announcement popup and toast")
            setShowAnnouncementPopup(true)

            // Show success notification
            toast({
              title: "🎉 Teams Generated!",
              description: `Your teams have been created with ${teamsData.length} groups`,
            })
          }, animationTime + 200) // Wait for animation + small buffer

          console.log("🎯 PARTICIPANT: Teams update completed", {
            liveTeamsUpdated: true,
            popupTriggered: true,
            toastTriggered: true,
            sessionId: sessionId
          })
        } else if (teamsData && teamsData.length === 0 && previousTeamsRef.current.length > 0) {
          // Handle case where teams were cleared - FIXED: Always protect user dialogs
          console.log("🎯 PARTICIPANT: Teams cleared by organizer - PROTECTING USER DIALOGS", {
            previousTeamCount: previousTeamsRef.current.length,
            sessionId: sessionId,
            teamsDataLength: teamsData.length,
            hasCurrentTeams: effectiveTeams.length > 0,
            shouldPreserveTeams: isParticipantMode && effectiveTeams.length > 0,
            dialogOpen: showGroupsBoard,
            announcementOpen: showAnnouncementPopup,
            userInitiated: isDialogUserInitiated,
            protectionActive: true
          })
          
          // CRITICAL FIX: Never clear teams or close dialogs if participant currently has teams displayed
          // or if any dialog is open, regardless of Firebase data
          if (effectiveTeams.length > 0 || showGroupsBoard || showAnnouncementPopup || isDialogUserInitiated) {
            console.log("🎯 PARTICIPANT: PRESERVING TEAMS AND DIALOGS (User protection active)", {
              effectiveTeamsLength: effectiveTeams.length,
              dialogOpen: showGroupsBoard,
              announcementOpen: showAnnouncementPopup,
              userInitiated: isDialogUserInitiated,
              timestamp: new Date().toISOString()
            })
            
            // Keep teams visible even if Firebase shows empty
            if (effectiveTeams.length > 0) {
              setLiveTeams(effectiveTeams)
              previousTeamsRef.current = [...effectiveTeams]
            }
            
            // Do NOT clear announcement popup if user hasn't closed it
            if (showAnnouncementPopup && !isDialogUserInitiated) {
              console.log("🎯 PARTICIPANT: Clearing announcement popup (not user-initiated, no teams)")
              setShowAnnouncementPopup(false)
            }
          } else {
            console.log("🎯 PARTICIPANT: Teams safely cleared (no current teams, dialogs closed, not user-initiated)")
            setLiveTeams([])
            previousTeamsRef.current = []
            setShowAnnouncementPopup(false)
          }
        } else {
          console.log("🎯 PARTICIPANT: No team updates detected", {
            teamsDataLength: teamsData.length,
            previousTeamsLength: previousTeamsRef.current.length,
            hasTeamsData: !!teamsData,
            currentEffectiveTeams: effectiveTeams.length,
            sessionId: sessionId,
            timestamp: new Date().toISOString(),
            hasDisplayedTeams: effectiveTeams.length > 0,
            dialogOpen: showGroupsBoard,
            userInitiated: isDialogUserInitiated,
            willPersistTeams: teamsData.length === 0 && effectiveTeams.length > 0 ? "TEAMS WILL PERSIST" : "No persistence needed"
          })
        }
      },
      (error) => {
        console.error("❌ PARTICIPANT: DIRECT Error listening for team updates:", error)
        toast({
          title: "Connection Error",
          description: "Lost connection to live session. Please refresh the page.",
          variant: "destructive"
        })
      }
    )

    return () => {
      console.log("🎯 PARTICIPANT: DIRECT Cleaning up Firebase listener for live teams")
      unsubscribe()
    }
  }, [sessionId, isParticipantMode])

  // Open groups board with simplified state management
  const openGroupsBoard = () => {
    const teamsToCheck = isParticipantMode ? effectiveTeams : teams
    
    console.log("🎯 VIEW RESULT BUTTON CLICKED:", {
      isParticipantMode,
      effectiveTeamsLength: effectiveTeams.length,
      teamsToCheckLength: teamsToCheck.length,
      sessionId,
      timestamp: new Date().toISOString(),
      teamsToCheckFirstTeam: teamsToCheck[0]?.name || 'None'
    })
    
    if (teamsToCheck.length === 0) {
      console.log("🎯 VIEW RESULT BLOCKED: No teams available")
      toast({
        title: "No Teams Available",
        description: "Generate teams first to view the groups board",
        variant: "destructive"
      })
      return
    }
    
    // Mark as user-initiated to prevent Firebase interference
    setIsDialogUserInitiated(true)
    
    // For participants, use the same dialog state but prevent Firebase from closing it
    if (isParticipantMode) {
      console.log("🎯 PARTICIPANT: Opening dialog with user protection")
    }
    
    // Open the dialog
    setShowGroupsBoard(true)
  }

  // Close dialog function for both participants and organizers
  const closeDialog = () => {
    console.log("🎯 Closing dialog")
    setShowGroupsBoard(false)
    setIsDialogUserInitiated(false)
  }

  // Copy teams to clipboard
  const copyTeamsToClipboard = async () => {
    const teamsToCopy = effectiveTeams
    if (teamsToCopy.length === 0) return

    let text = "Team Distribution:\n\n"
    teamsToCopy.forEach((team, index) => {
      text += `${team.customName || team.name}:\n`
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

  // Handle paste functionality for solo mode
  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (text.trim()) {
        // Split by common delimiters and filter empty lines
        const names = text
          .split(/[\n,;]/)
          .map(name => name.trim())
          .filter(name => name.length > 0)

        if (names.length > 0) {
          setInputText(prevText => {
            const existingNames = prevText
              .split('\n')
              .map(name => name.trim())
              .filter(name => name.length > 0)

            // Combine existing and pasted names, removing duplicates
            const combinedNames = [...new Set([...existingNames, ...names])]
            return combinedNames.join('\n')
          })

          toast({
            title: "Names Pasted",
            description: `Added ${names.length} names from clipboard`,
          })
        }
      }
    } catch (error) {
      toast({
        title: "Paste Failed",
        description: "Could not access clipboard. Please paste manually.",
        variant: "destructive"
      })
    }
  }

  // Export teams as text file
  const exportTeams = () => {
    const teamsToExport = effectiveTeams
    if (teamsToExport.length === 0) return

    let text = "Team Distribution\n"
    text += "================\n\n"
    teamsToExport.forEach((team, index) => {
      text += `${team.customName || team.name}:\n`
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

  // Export teams to CSV
  const exportTeamsToCsv = () => {
    const teamsToExport = effectiveTeams
    if (teamsToExport.length === 0) return

    let csvContent = "Team Name,Member Name,Is Leader,Label\n"

    teamsToExport.forEach(team => {
      team.members.forEach(member => {
        const row = [
          team.customName || team.name,
          member.name,
          member.isLeader ? 'Yes' : 'No',
          member.label || ''
        ].join(',')
        csvContent += row + "\n"
      })
    })

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `team-distribution-${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)

    toast({
      title: "Teams Exported to CSV",
      description: "Team distribution saved as CSV file",
    })
  }

  // Export teams to XLSX
  const exportTeamsToXlsx = () => {
    const teamsToExport = effectiveTeams
    if (teamsToExport.length === 0) return

    const worksheetData = [["Team Name", "Member Name", "Is Leader", "Label"]]

    teamsToExport.forEach(team => {
      team.members.forEach(member => {
        worksheetData.push([
          team.customName || team.name,
          member.name,
          member.isLeader ? 'Yes' : 'No',
          member.label || ''
        ])
      })
    })

    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, "Team Distribution")

    XLSX.writeFile(workbook, `team-distribution-${Date.now()}.xlsx`)

    toast({
      title: "Teams Exported to XLSX",
      description: "Team distribution saved as XLSX file",
    })
  }

  // Download template with maroon color design
  const downloadTemplate = () => {
    // Create empty template
    const worksheetData = [
      ["Full Name", "Label (Optional)", "Is Leader (Yes/No)"],
      ["", "", ""],
      ["", "", ""],
      ["", "", ""],
      ["", "", ""],
      ["", "", ""],
      ["", "", ""],
      ["", "", ""],
      ["", "", ""],
      ["", "", ""],
      ["", "", ""]
    ]

    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData)

    // Apply maroon color styling - using RGB values for maroon (#8e0b16)
    const maroonFill: any = {
      patternType: "solid",
      fgColor: { rgb: "8e0b16" }
    }
    
    const lightMaroonFill: any = {
      patternType: "solid",
      fgColor: { rgb: "f5d5d7" }
    }

    const headerStyle: any = {
      font: { bold: true, color: { rgb: "FFFFFF" }, sz: 11 },
      fill: maroonFill,
      alignment: { horizontal: "center", vertical: "center" }
    }

    const dataStyle: any = {
      fill: lightMaroonFill,
      alignment: { horizontal: "left", vertical: "center" },
      border: {
        top: { style: "thin", color: { rgb: "8e0b16" } },
        bottom: { style: "thin", color: { rgb: "8e0b16" } },
        left: { style: "thin", color: { rgb: "8e0b16" } },
        right: { style: "thin", color: { rgb: "8e0b16" } }
      }
    }

    // Set column widths
    worksheet['!cols'] = [
      { wch: 35 }, // Full Name
      { wch: 25 }, // Label
      { wch: 20 }  // Is Leader
    ]

    // Apply styles to cells
    const ws = worksheet as any

    // Header row - Apply maroon background with white text
    const headerCells = ['A1', 'B1', 'C1']
    headerCells.forEach((cell: string) => {
      if (!ws[cell]) ws[cell] = { t: 's', v: '' }
      ws[cell].s = headerStyle
    })

    // Data rows
    const dataCols = ['A', 'B', 'C']
    for (let row = 1; row <= 10; row++) {
      dataCols.forEach((col: string) => {
        const cell = `${col}${row + 1}`
        if (!ws[cell]) ws[cell] = { t: 's', v: '' }
        ws[cell].s = dataStyle
      })
    }

    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, "Team Members Template")

    XLSX.writeFile(workbook, `team-members-template.xlsx`)

    toast({
      title: "Template Downloaded",
      description: "Fill in the template with full names and import it back",
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
      
      <Card className={`h-full shadow-2xl border-2 border-[#8e0b16]/20 ${soloMode ? 'max-w-none w-full' : 'max-w-5xl'} mx-auto`}>
        <CardHeader className="pb-4 rounded-t-lg">
          <CardTitle className="flex items-center gap-3 text-xl font-bold">
            {soloMode ? 'Solo Team Generator' : ''}
          </CardTitle>

        </CardHeader>
        <CardContent className="space-y-6 overflow-y-auto max-h-[calc(100vh-120px)] p-8">
          {/* Enhanced Responsive Grid Layout for Steps */}
           <div className={`grid gap-8 sm:gap-10 ${
             soloMode || isParticipantMode
               ? 'grid-cols-1 max-w-none w-full mx-auto'
               : 'grid-cols-1 lg:grid-cols-2 xl:grid-cols-3'
           } ${isParticipantMode ? 'max-w-6xl' : ''}`}>
             
            {/* 1. INPUT SECTION - Hidden for participants */}
            {!isParticipantMode && (
              <Card className="border-2 border-[#8e0b16]/20 shadow-lg hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-white to-gray-50 animate-in slide-in-from-left-4 fade-in">
                <CardHeader className="pb-3 bg-gradient-to-r from-[#8e0b16]/5 to-[#66181E]/5">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="text-sm font-bold bg-[#8e0b16] text-white border-0 shadow-md">1</Badge>
                    <h3 className="text-lg font-bold text-[#8e0b16]">Input Names</h3>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                {/* Import Method Section - Show only if not in solo mode */}
                {!soloMode && (
                  <div className="space-y-2">
                    <Label className="text-xs font-medium">Import method:</Label>
                    <RadioGroup
                      value={inputMethod}
                      onValueChange={(value: 'manual' | 'csv') => setInputMethod(value)}
                      className="flex flex-col gap-2"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="manual" id="manual" className="h-3 w-3" />
                        <Label htmlFor="manual" className="text-xs">Manual entry</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="csv" id="csv" className="h-3 w-3" />
                        <Label htmlFor="csv" className="text-xs">Import file</Label>
                      </div>
                    </RadioGroup>
                  </div>
                )}

                {/* Import Actions - Show only for CSV mode or when not in solo mode */}
                {(inputMethod === 'csv' || !soloMode) && (
                  <div className="space-y-2">
                    <div className="flex gap-1">
                      <Button
                        onClick={() => fileInputRef.current?.click()}
                        variant="outline"
                        size="sm"
                        className="text-xs flex-1"
                      >
                        <Upload className="h-3 w-3 mr-1" />
                        {soloMode ? 'Import File' : 'Choose File'}
                      </Button>
                      <Button
                        onClick={downloadTemplate}
                        variant="outline"
                        size="sm"
                        className="text-xs flex-1 border-[#8e0b16] text-[#8e0b16] hover:bg-[#8e0b16] hover:text-white"
                      >
                        <Download className="h-3 w-3 mr-1" />
                        Template
                      </Button>
                    </div>
                    <Button
                      onClick={() => setInputText("Alice Johnson\nBob Smith\nCarol Davis\nDavid Wilson [Teacher]\nEve Brown [Student]")}
                      variant="outline"
                      size="sm"
                      className="text-xs w-full"
                    >
                      Load Sample
                    </Button>

                  </div>
                )}

                {/* Solo Mode Quick Actions */}
                {soloMode && (
                  <div className="space-y-2">
                    <div className="flex gap-1">
                      <Button
                        onClick={() => setInputText("Alice\nBob\nCarol\nDavid\nEve")}
                        variant="outline"
                        size="sm"
                        className="text-xs flex-1"
                      >
                        Quick Sample
                      </Button>
                      <Button
                        onClick={handlePaste}
                        variant="outline"
                        size="sm"
                        className="text-xs flex-1"
                      >
                        📋 Paste
                      </Button>
                      <Button
                        onClick={() => setInputText("")}
                        variant="outline"
                        size="sm"
                        className="text-xs flex-1"
                      >
                        Clear All
                      </Button>
                    </div>
                    <div className="text-xs text-muted-foreground p-2 bg-blue-50 border border-blue-200 rounded">
                      💡 <strong>Solo Mode:</strong> Enter names manually (one per line) or use Quick Sample/Paste buttons
                    </div>
                  </div>
                )}

                {/* People Count Display */}
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="bg-[#8e0b16] text-white text-xs px-2 py-1">
                    {peopleCount}
                  </Badge>
                  <span className="text-xs text-muted-foreground">people</span>
                </div>

                {/* Input Area - Enhanced for Solo Mode */}
                <Textarea
                  id="nameInput"
                  placeholder={
                    soloMode
                      ? "Enter names for solo mode (one per line)\n\nAlice\nBob\nCarol\nDavid [Teacher]\nEve [Student]"
                      : inputMethod === 'manual'
                        ? "Enter names manually (one per line)\n\nAlice\nBob\nCarol [Teacher]"
                        : "Import file or enter names (one per line)\n\nAlice\nBob\nCarol [Teacher]"
                  }
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  disabled={false}
                  rows={soloMode ? 6 : 4}
                  className={`resize-none text-xs ${soloMode ? 'border-[#8e0b16] focus:ring-[#8e0b16]' : ''}`}
                />

                {/* Format Help - Replaced with Interactive Editor Button */}
                <Button
                  onClick={() => {
                    if (peopleCount === 0) {
                      toast({
                        title: "No Names Found",
                        description: "Please enter some names first",
                        variant: "destructive"
                      })
                      return
                    }
                    setShowPeopleEditor(true)
                  }}
                  variant="outline"
                  className="w-full text-xs border-[#8e0b16] text-[#8e0b16] hover:bg-[#8e0b16] hover:text-white"
                >
                  <Settings className="h-3 w-3 mr-2" />
                  Configure Names (Leaders & Labels)
                </Button>

              </CardContent>
            </Card>
             )}

            {/* 2 & 3. DISTRIBUTION AND GROUP SIZE SECTION - Combined - Hidden for participants */}
            {!isParticipantMode && (
              <Card className="border-2 border-[#8e0b16]/20 shadow-lg hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-white to-gray-50 animate-in slide-in-from-top-4 fade-in">
                <CardHeader className="pb-3 bg-gradient-to-r from-[#8e0b16]/5 to-[#66181E]/5">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="text-sm font-bold bg-[#8e0b16] text-white border-0 shadow-md">2</Badge>
                    <h3 className="text-lg font-bold text-[#8e0b16]">Setup & Distribution</h3>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                {/* Balance Type Selection */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Distribution balance:</Label>
                  <RadioGroup
                    value={balanceType}
                    onValueChange={(value: 'default') => setBalanceType(value)}
                    className="flex flex-col gap-2"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="default" id="default" className="h-3 w-3" />
                      <Label htmlFor="default" className="text-xs">Random</Label>
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
                          disabled={false}
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
                          disabled={false}
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
                    disabled={peopleCount === 0}
                    className="text-white text-sm py-3 font-bold transition-all duration-300 bg-[#8e0b16] hover:bg-[#66181E] hover:scale-105"
                    size="sm"
                  >
                    <Target className="h-4 w-4 mr-2" />
                    START RANDOMIZATION {teams.length > 0 ? '(AGAIN)' : ''}
                  </Button>

                  <div className="flex gap-1">
                    <Button
                      variant="outline"
                      onClick={openGroupsBoard}
                      disabled={effectiveTeams.length === 0}
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
             )}

            {/* 4. RESULTS SECTION - Optimized - Always visible, adjust badge for participants */}
            <Card className={`border-2 border-[#8e0b16]/20 shadow-lg hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-white to-gray-50 lg:col-span-1 xl:col-span-1 animate-in slide-in-from-right-4 fade-in ${isParticipantMode ? 'col-span-1' : ''} ${isParticipantMode ? 'transform scale-105' : ''}`}>
              <CardHeader className={`pb-3 bg-gradient-to-r from-[#8e0b16]/5 to-[#66181E]/5 ${isParticipantMode ? 'pb-2' : 'pb-3'}`}>
                <div className="flex items-center gap-2">
                  <div className={`font-bold bg-[#8e0b16] text-white border-0 shadow-md px-2 py-1 rounded inline-flex items-center justify-center min-w-[24px] min-h-[24px] ${isParticipantMode ? 'text-sm px-2 py-1 min-w-[24px] min-h-[24px]' : 'text-sm'}`}>
                    {isParticipantMode ? '1' : '3'}
                  </div>
                  <h3 className={`font-bold text-[#8e0b16] ${isParticipantMode ? 'text-lg' : 'text-lg'}`}>Results & Export</h3>
                </div>
              </CardHeader>
              <CardContent className={`${isParticipantMode ? 'space-y-3 p-4' : 'space-y-3'}`}>
                {(effectiveTeams && effectiveTeams.length > 0) ? (
                  <div className={`${isParticipantMode ? 'space-y-6' : 'space-y-3'}`}>
                    {/* Results Summary - Responsive sizing for participants */}
                    <div className={`flex items-center justify-between ${isParticipantMode ? 'p-1.5 sm:p-2 bg-green-50 border-2 border-green-200 rounded-lg' : 'p-2 bg-green-50 border border-green-200 rounded'}`}>
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        <Badge variant="default" className={`${isParticipantMode ? 'bg-green-600 text-xs sm:text-sm px-1.5 sm:px-2 py-0.5 sm:py-1 text-xs' : 'bg-green-600 text-xs px-2 py-1'}`}>
                          {effectiveTeams.length} Teams
                        </Badge>
                        <span className={`${isParticipantMode ? 'text-xs sm:text-sm text-green-700 font-medium' : 'text-xs text-green-700'}`}>
                          {peopleCount} people
                        </span>
                      </div>
                    </div>

                    {/* Export Buttons - Larger and more prominent for participants */}
                    <div className={`${isParticipantMode ? 'space-y-4' : 'space-y-2'}`}>
                      {/* VIEW RESULT BUTTON - ALWAYS VISIBLE & PROMINENT FOR PARTICIPANTS */}
                      {isParticipantMode && (
                        <Button
                          onClick={openGroupsBoard}
                          className="w-full bg-[#8e0b16] hover:bg-[#66181E] text-white font-bold py-4 text-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300"
                        >
                          <Eye className="h-6 w-6 mr-3" />
                          VIEW RESULT
                        </Button>
                      )}
                      <div className={`flex items-center justify-center gap-2 ${isParticipantMode ? '' : 'text-xs font-semibold text-gray-700'}`}>
                        <div className={`${isParticipantMode ? 'text-lg font-bold text-gray-700' : 'text-xs font-semibold text-gray-700'}`}>
                          Export Options:
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowExportOptions(!showExportOptions)}
                          className="text-gray-500 hover:text-gray-700 p-1 h-6 w-6"
                          title={showExportOptions ? "Hide export options" : "Show export options"}
                        >
                          {showExportOptions ? (
                            <Eye className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4 opacity-50" />
                          )}
                        </Button>
                      </div>
                      {showExportOptions && (
                        <div className={`${isParticipantMode ? 'space-y-4' : 'space-y-2'}`}>
                            <Button
                              variant="outline"
                              size={isParticipantMode ? "default" : "sm"}
                              onClick={copyTeamsToClipboard}
                              className={`${isParticipantMode ? 'text-base py-3' : 'text-xs'}`}
                            >
                              <Copy className={`${isParticipantMode ? 'h-5 w-5 mr-2' : 'h-3 w-3 mr-1'}`} />
                              Copy
                            </Button>
                            <Button
                              variant="outline"
                              size={isParticipantMode ? "default" : "sm"}
                              onClick={exportTeamsToCsv}
                              className={`${isParticipantMode ? 'text-base py-3' : 'text-xs'}`}
                              title="Export with leader & weight data"
                            >
                              <Download className={`${isParticipantMode ? 'h-5 w-5 mr-2' : 'h-3 w-3 mr-1'}`} />
                              CSV
                            </Button>
                            <Button
                              variant="outline"
                              size={isParticipantMode ? "default" : "sm"}
                              onClick={exportTeamsToXlsx}
                              className={`${isParticipantMode ? 'text-base py-3' : 'text-xs'}`}
                              title="Export with leader & weight data"
                            >
                              <Download className={`${isParticipantMode ? 'h-5 w-5 mr-2' : 'h-3 w-3 mr-1'}`} />
                              XLSX
                            </Button>
                            <Button
                              variant="outline"
                              size={isParticipantMode ? "default" : "sm"}
                              onClick={exportTeams}
                              className={`${isParticipantMode ? 'text-base py-3' : 'text-xs'}`}
                            >
                              <Download className={`${isParticipantMode ? 'h-5 w-5 mr-2' : 'h-3 w-3 mr-1'}`} />
                              TXT
                            </Button>
                          </div>
                      )}
                    </div>
                    {isParticipantMode ? (
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 gap-3 sm:gap-4 w-full
                                        xs:grid-cols-1
                                        sm:grid-cols-2
                                        md:grid-cols-2
                                        lg:grid-cols-3
                                        xl:grid-cols-4
                                        2xl:grid-cols-4">
                          {effectiveTeams.slice(0, 20).map((team, index) => {
                            // Apply reveal animation for participants
                            const isGroupRevealed = revealedGroups.has(index)
                            const revealedMemberIndices = revealedMembers.get(index) || new Set()

                            // For participants, only show revealed groups
                            if (!isGroupRevealed) return null

                            // Color themes for each team
                            const teamColors = [
                              { border: 'border-red-400', bg: 'bg-red-500', text: 'text-red-600', headerBg: 'bg-red-50' },
                              { border: 'border-blue-400', bg: 'bg-blue-500', text: 'text-blue-600', headerBg: 'bg-blue-50' },
                              { border: 'border-green-400', bg: 'bg-green-500', text: 'text-green-600', headerBg: 'bg-green-50' },
                              { border: 'border-purple-400', bg: 'bg-purple-500', text: 'text-purple-600', headerBg: 'bg-purple-50' },
                              { border: 'border-yellow-400', bg: 'bg-yellow-500', text: 'text-yellow-600', headerBg: 'bg-yellow-50' },
                              { border: 'border-pink-400', bg: 'bg-pink-500', text: 'text-pink-600', headerBg: 'bg-pink-50' },
                              { border: 'border-indigo-400', bg: 'bg-indigo-500', text: 'text-indigo-600', headerBg: 'bg-indigo-50' },
                              { border: 'border-teal-400', bg: 'bg-teal-500', text: 'text-teal-600', headerBg: 'bg-teal-50' }
                            ];
                            const colorScheme = teamColors[index % teamColors.length];

                            return (
                              <div
                                key={team.id}
                                className={`flex flex-col w-full border-2 ${colorScheme.border} rounded-xl bg-white shadow-lg transition-all duration-500 ${
                                  isRevealing ? 'animate-in slide-in-from-bottom-4 fade-in' : ''
                                }`}
                                style={{
                                  animationDelay: `${index * 100}ms`,
                                  minHeight: 'clamp(280px, 25vh, 400px)',
                                  maxHeight: 'clamp(320px, 35vh, 500px)'
                                }}
                              >
                                {/* Team Header with color theme */}
                                <div className={`p-2 sm:p-3 ${colorScheme.headerBg} border-b-2 ${colorScheme.border} rounded-t-xl flex-shrink-0`}>
                                  <div className="flex items-center justify-between">
                                    <h4 className={`font-bold ${colorScheme.text} text-sm sm:text-base md:text-lg truncate`}>
                                      {team.customName || team.name}
                                    </h4>
                                    <Badge className={`${colorScheme.bg} text-white text-xs px-2 py-1`}>
                                      {team.members.length}
                                    </Badge>
                                  </div>
                                </div>

                                {/* Scrollable Member List */}
                                <div className="flex-1 p-2 sm:p-3 overflow-y-auto min-h-0">
                                  <div className="space-y-2">
                                    {team.members.slice(0, 12).map((member, memberIndex) => {
                                      const isMemberRevealed = revealedMemberIndices.has(memberIndex)
                                      const isAnimating = animatingMembers.get(member.id)

                                      if (!isMemberRevealed) return null

                                      return (
                                        <div
                                          key={member.id}
                                          className={`text-xs sm:text-sm text-gray-800 flex items-start gap-2 p-2 bg-gray-50 rounded-lg ${isAnimating ? 'person-reveal' : ''}`}
                                        >
                                          <span className="w-4 h-4 sm:w-5 sm:h-5 bg-gray-600 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                                            {memberIndex + 1}
                                          </span>
                                          <div className="flex-1 min-w-0">
                                            <div className="font-medium break-words text-xs sm:text-sm">{member.name}</div>
                                            <div className="flex items-center gap-1 flex-wrap mt-1">
                                              {member.isLeader && (
                                                <Badge className="text-xs bg-yellow-500 text-white border-0 px-1 py-0.5">
                                                  👑
                                                </Badge>
                                              )}
                                              {member.label && (
                                                <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200 px-1 py-0.5">
                                                  {member.label}
                                                </Badge>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                      )
                                    })}
                                    {team.members.length > 12 && (
                                      <div className="text-xs text-gray-600 text-center py-1 bg-gray-100 rounded">
                                        +{team.members.length - 12} more
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                        {effectiveTeams.length > 20 && (
                          <div className="text-sm text-gray-600 text-center p-3 bg-gray-100 rounded-lg border-2 border-dashed border-gray-300">
                            +{effectiveTeams.length - 20} more teams (click View Results for all)
                          </div>
                        )}
                      </div>
                    ) : (
                      /* Organizer view - responsive vertical list with scroll */
                      <div className="w-full">
                        <div className="space-y-3 max-h-80 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
                          {effectiveTeams.slice(0, 10).map((team, index) => {
                            // Apply reveal animation to BOTH organizers and participants
                            const isGroupRevealed = revealedGroups.has(index)
                            const revealedMemberIndices = revealedMembers.get(index) || new Set()

                            // For organizers, show all groups immediately if no animation is running
                            // For participants, only show revealed groups
                            const shouldShowGroup = isGroupRevealed || !isRevealing

                            if (!shouldShowGroup) return null

                            return (
                              <div
                                key={team.id}
                                className="p-3 border-2 border-[#8e0b16]/10 rounded-lg bg-white shadow-sm transition-all duration-500 hover:shadow-md"
                                style={{ animationDelay: `${index * 100}ms` }}
                              >
                                <div className="flex items-center justify-between mb-2">
                                  <h4 className="font-bold text-[#8e0b16] text-sm sm:text-base truncate">
                                    {team.customName || team.name}
                                  </h4>
                                  <Badge variant="secondary" className="bg-[#8e0b16] text-white text-xs px-2 py-1">
                                    {team.members.length} {team.members.length === 1 ? 'member' : 'members'}
                                  </Badge>
                                </div>
                                <div className="space-y-2">
                                  {team.members.slice(0, 8).map((member, memberIndex) => {
                                    // Apply reveal animation to BOTH organizers and participants
                                    const isMemberRevealed = revealedMemberIndices.has(memberIndex)
                                    // Check if this member is currently animating
                                    const isAnimating = animatingMembers.get(member.id)

                                    // For organizers, show all members immediately if no animation is running
                                    // For participants, only show revealed members
                                    const shouldShowMember = isMemberRevealed || !isRevealing

                                    if (!shouldShowMember) return null

                                    return (
                                      <div
                                        key={member.id}
                                        className={`text-sm text-gray-800 flex items-start gap-2 p-2 bg-gray-50 rounded-md hover:bg-gray-100 transition-colors ${isAnimating ? 'person-reveal' : ''}`}
                                      >
                                        <span className="w-5 h-5 bg-[#8e0b16] text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                                          {memberIndex + 1}
                                        </span>
                                        <div className="flex-1 min-w-0">
                                          <div className="font-medium break-words">{member.name}</div>
                                          <div className="flex items-center gap-1 flex-wrap mt-1">
                                            {member.gender && (
                                              <span className="text-sm text-gray-500">
                                                {member.gender === 'M' ? '♂' : '♀'}
                                              </span>
                                            )}
                                            {member.isLeader && (
                                              <Badge className="text-xs bg-yellow-500 text-white border-0 px-2 py-0.5">
                                                👑 Leader
                                              </Badge>
                                            )}
                                            {member.label && (
                                              <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200 px-2 py-0.5">
                                                {member.label}
                                              </Badge>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    )
                                  })}
                                  {team.members.length > 8 && (
                                    <div className="text-sm text-gray-600 text-center py-1 bg-gray-100 rounded">
                                      +{team.members.length - 8} more members (click View Results for all)
                                    </div>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                          {effectiveTeams.length > 10 && (
                            <div className="text-sm text-gray-600 text-center p-3 bg-gray-100 rounded-lg border-2 border-dashed border-gray-300">
                              +{effectiveTeams.length - 10} more teams (click View Results for all)
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ) : isParticipantMode ? (
                  <div className="text-center py-6 text-muted-foreground">
                    <Users className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm font-semibold">Waiting for organizer</p>
                    <p className="text-xs">Teams will appear here once randomization starts</p>
                  </div>
                ) : (
                  <div className="text-center py-6 text-muted-foreground">
                    <Users className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm font-semibold">No teams yet</p>
                    <p className="text-xs">Enter names and start randomization</p>
                  </div>
                )}

                {/* REMOVED DUPLICATE TEAM DISPLAY - Teams already shown in main results section */}
              </CardContent>
            </Card>
          </div>

        </CardContent>
      </Card>



      {/* Enhanced Groups Board Dialog - Full Screen Responsive View */}
      <Dialog
        open={showGroupsBoard}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            setIsDialogUserInitiated(false)
          }
          setShowGroupsBoard(isOpen)
        }}
      >
        <DialogContent className="w-[95vw] max-w-7xl h-[95vh] max-h-[95vh] overflow-hidden p-0 flex flex-col">
          <div className="bg-gradient-to-r from-[#8e0b16] to-[#66181E] text-white p-6">
            <DialogHeader className="text-white">
              <DialogTitle className="flex items-center gap-3 text-2xl font-bold">
                <div className="p-2 bg-white/20 rounded-lg">
                  <Users className="h-7 w-7" />
                </div>
                Team Distribution Results
              </DialogTitle>
              <DialogDescription className="text-white/90 text-lg">
                {(isParticipantMode ? effectiveTeams.length : teams.length)} teams with {peopleCount} people total
              </DialogDescription>
            </DialogHeader>
          </div>
            <div className="flex-1 overflow-y-auto p-6">
             {(isParticipantMode ? effectiveTeams.length : teams.length) > 0 ? (
               <div className="space-y-6">
                 {/* Enhanced Export Actions */}
                 <div className="flex flex-col sm:flex-row gap-3 justify-center items-center bg-gray-50 p-4 rounded-lg animate-in fade-in slide-in-from-top-4 duration-500">
                   <Button
                     variant="outline"
                     onClick={copyTeamsToClipboard}
                     className="border-green-600 text-green-700 hover:bg-green-600 hover:text-white transition-all duration-300 hover:scale-105 shadow-md animate-in slide-in-from-left-4 duration-700"
                   >
                     <Copy className="h-4 w-4 mr-2" />
                     Copy All Teams
                   </Button>
                   <Button
                     variant="outline"
                     onClick={exportTeams}
                     className="border-blue-600 text-blue-700 hover:bg-blue-600 hover:text-white transition-all duration-300 hover:scale-105 shadow-md animate-in slide-in-from-right-4 duration-700"
                   >
                     <Download className="h-4 w-4 mr-2" />
                     Export Teams
                   </Button>
                 </div>

                 {/* Enhanced Responsive Team Grid */}
                 <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4 auto-rows-fr max-h-[calc(100vh-300px)] overflow-y-auto">
                   {(isParticipantMode ? effectiveTeams : teams).map((team, teamIndex) => {
                     const teamColors = [
                       { border: 'border-red-300', bg: 'bg-red-50', hover: 'hover:border-red-400', accent: 'bg-red-500' },
                       { border: 'border-blue-300', bg: 'bg-blue-50', hover: 'hover:border-blue-400', accent: 'bg-blue-500' },
                       { border: 'border-green-300', bg: 'bg-green-50', hover: 'hover:border-green-400', accent: 'bg-green-500' },
                       { border: 'border-purple-300', bg: 'bg-purple-50', hover: 'hover:border-purple-400', accent: 'bg-purple-500' },
                       { border: 'border-yellow-300', bg: 'bg-yellow-50', hover: 'hover:border-yellow-400', accent: 'bg-yellow-500' },
                       { border: 'border-pink-300', bg: 'bg-pink-50', hover: 'hover:border-pink-400', accent: 'bg-pink-500' }
                     ];
                     const colorScheme = teamColors[teamIndex % teamColors.length];

                     return (
                       <div
                         key={team.id}
                         className={`p-3 sm:p-4 border-2 ${colorScheme.border} rounded-lg bg-white ${colorScheme.hover} hover:shadow-xl transition-all duration-300 ${isRevealing ? 'animate-in slide-in-from-bottom-4 fade-in' : ''}`}
                         style={{ animationDelay: `${teamIndex * 100}ms` }}
                       >
                         <div className="flex items-center justify-between mb-3">
                           {enableCustomization ? (
                             <Input
                               value={team.customName || team.name}
                               onChange={(e) => renameTeam(team.id, e.target.value)}
                               className={`font-semibold text-[#8e0b16] border-none p-0 h-auto focus:ring-0 text-sm sm:text-base ${colorScheme.bg}`}
                               placeholder="Team name..."
                             />
                           ) : (
                             <h4 className={`font-semibold text-[#8e0b16] text-sm sm:text-base ${colorScheme.bg}`}>
                               {team.customName || team.name}
                             </h4>
                           )}
                           <Badge className={`${colorScheme.accent} text-white text-xs px-2 py-1`}>
                             {team.members.length}
                           </Badge>
                         </div>
                         <div className="space-y-1 sm:space-y-2 max-h-32 sm:max-h-40 overflow-y-auto">
                           {team.members.map((member, index) => (
                             <div key={member.id} className="text-xs sm:text-sm text-gray-700 flex items-start gap-2">
                               <Badge variant="outline" className="text-xs w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                                 {index + 1}
                               </Badge>
                               <div className="flex-1 min-w-0 space-y-1">
                                 <span className="block break-words">{member.name}</span>
                                 <div className="flex items-center gap-1 flex-wrap">
                                   {member.gender && (
                                     <span className="text-xs sm:text-sm text-gray-500">
                                       {member.gender === 'M' ? '♂' : '♀'}
                                     </span>
                                   )}
                                   {member.isLeader && (
                                     <Badge className="text-xs bg-yellow-500 text-white border-0">
                                       👑 Leader
                                     </Badge>
                                   )}
                                   {member.label && (
                                     <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                                       {member.label}
                                     </Badge>
                                   )}
                                 </div>
                               </div>
                             </div>
                           ))}
                         </div>
                       </div>
                     );
                   })}
                 </div>
               </div>
             ) : (
               <div className="text-center py-12 text-muted-foreground">
                 <Users className="h-16 w-16 mx-auto mb-4 opacity-30 text-[#8e0b16]" />
                 <p className="text-lg font-semibold text-[#8e0b16]">No teams generated yet</p>
                 <p className="text-sm">Generate teams first to see the results here</p>
               </div>
             )}
           </div>
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

      {/* Enhanced Results Popup with All Teams */}
      <Dialog
        open={showAnnouncementPopup}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            setIsDialogUserInitiated(false)
          }
          setShowAnnouncementPopup(isOpen)
        }}
      >
        <DialogContent className="w-[95vw] max-w-6xl max-h-[90vh] overflow-hidden p-0">
          {/* Confetti Animation */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="confetti-container">
              {[...Array(100)].map((_, i) => (
                <div
                  key={i}
                  className="confetti"
                  style={{
                    left: `${Math.random() * 100}%`,
                    backgroundColor: ['#8e0b16', '#66181E', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#06b6d4'][Math.floor(Math.random() * 7)],
                    animationDelay: `${Math.random() * 3}s`,
                    animationDuration: `${2 + Math.random() * 3}s`
                  }}
                />
              ))}
            </div>
          </div>

          <div className="p-6 space-y-4">
            {/* Header with single close button */}
            <div className="text-center relative">
              <h2 className="text-2xl sm:text-3xl font-bold text-[#8e0b16] mb-3">
                🎉 TEAMS GENERATED SUCCESSFULLY! 🎉
              </h2>
              <div className="bg-gradient-to-r from-[#8e0b16]/10 to-[#66181E]/10 p-3 sm:p-4 rounded-lg border border-[#8e0b16]/20">
                <div className="text-base sm:text-lg font-semibold text-[#8e0b16]">
                  {(isParticipantMode ? effectiveTeams.length : teams.length)} Teams • {peopleCount} People
                </div>
                <div className="text-xs sm:text-sm text-gray-600 mt-1">
                  Randomly distributed and ready to use!
                </div>
              </div>
            </div>

          <div className="space-y-4 relative z-10 max-h-[55vh] overflow-y-auto px-2">
            {/* Teams Grid Display - Responsive */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
              {(isParticipantMode ? effectiveTeams : teams).map((team, teamIndex) => {
                const teamColors = [
                  { border: 'border-red-300', bg: 'bg-red-50', hover: 'hover:border-red-400', accent: 'bg-red-500' },
                  { border: 'border-blue-300', bg: 'bg-blue-50', hover: 'hover:border-blue-400', accent: 'bg-blue-500' },
                  { border: 'border-green-300', bg: 'bg-green-50', hover: 'hover:border-green-400', accent: 'bg-green-500' },
                  { border: 'border-purple-300', bg: 'bg-purple-50', hover: 'hover:border-purple-400', accent: 'bg-purple-500' },
                  { border: 'border-yellow-300', bg: 'bg-yellow-50', hover: 'hover:border-yellow-400', accent: 'bg-yellow-500' },
                  { border: 'border-pink-300', bg: 'bg-pink-50', hover: 'hover:border-pink-400', accent: 'bg-pink-500' }
                ];
                const colorScheme = teamColors[teamIndex % teamColors.length];

                return (
                <Card key={team.id} className={`bg-white shadow-lg border-2 ${colorScheme.border} ${colorScheme.hover} transition-all duration-300 hover:shadow-xl ${isRevealing ? 'animate-in slide-in-from-bottom-4 fade-in' : ''}`} style={{ animationDelay: `${teamIndex * 150}ms` }}>
                  <CardHeader className="pb-2 sm:pb-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <h3 className="font-bold text-[#8e0b16] text-sm sm:text-base lg:text-lg">
                        {team.customName || team.name}
                      </h3>
                      <Badge
                        className="bg-[#8e0b16] text-white text-xs px-2 py-1 whitespace-nowrap"
                        style={{ backgroundColor: '#8e0b16' }}
                      >
                        {team.members.length} {team.members.length === 1 ? 'member' : 'members'}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="space-y-2">
                      {team.members.map((member, memberIndex) => (
                        <div
                          key={member.id}
                          className="flex items-start gap-2 p-2 bg-gray-50 rounded-lg border border-gray-200"
                        >
                          <div className="flex items-center justify-center w-5 h-5 sm:w-6 sm:h-6 bg-[#8e0b16] text-white text-xs font-bold rounded-full flex-shrink-0 mt-0.5">
                            {memberIndex + 1}
                          </div>
                          <div className="flex-1 min-w-0 space-y-1">
                            <div className="font-medium text-gray-800 text-xs sm:text-sm break-words">{member.name}</div>
                            <div className="flex items-center gap-1 flex-wrap">
                              {member.gender && (
                                <span className="text-sm sm:text-base">
                                  {member.gender === 'M' ? '👨' : '👩'}
                                </span>
                              )}
                              {member.isLeader && (
                                <Badge className="text-xs bg-yellow-500 text-white border-0 px-2 py-0.5 whitespace-nowrap">
                                  👑 Leader
                                </Badge>
                              )}
                              {member.label && (
                                <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200 px-2 py-0.5 whitespace-nowrap">
                                  {member.label}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
                );
              })}
            </div>

            {/* Action Buttons - Responsive */}
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 justify-center items-stretch sm:items-center pt-4 border-t border-gray-200">
              <Button
                onClick={() => {
                  setShowAnnouncementPopup(false)
                  setShowGroupsBoard(true)
                }}
                className="bg-[#8e0b16] hover:bg-[#66181E] text-white font-bold px-4 sm:px-6 py-2 text-sm sm:text-base w-full sm:w-auto"
              >
                <Eye className="h-4 w-4 mr-2" />
                View Full Details
              </Button>
              <Button
                onClick={copyTeamsToClipboard}
                variant="outline"
                className="border-[#8e0b16] text-[#8e0b16] hover:bg-[#8e0b16] hover:text-white px-4 sm:px-6 py-2 text-sm sm:text-base w-full sm:w-auto"
              >
                <Copy className="h-4 w-4 mr-2" />
                Copy Results
              </Button>
              <Button
                onClick={exportTeams}
                variant="outline"
                className="border-green-600 text-green-600 hover:bg-green-600 hover:text-white px-4 sm:px-6 py-2 text-sm sm:text-base w-full sm:w-auto"
              >
                <Download className="h-4 w-4 mr-2" />
                Export Teams
              </Button>
            </div>
          </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* People Editor Dialog - Interactive UI for setting labels, leaders */}
      <Dialog open={showPeopleEditor} onOpenChange={setShowPeopleEditor}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Settings className="h-5 w-5" />
              Configure People Settings
            </DialogTitle>
            <DialogDescription>
              Set leaders and labels for each person without typing format codes
            </DialogDescription>
          </DialogHeader>

          {/* Search Bar */}
          <div className="px-6 pt-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                type="text"
                placeholder="Search by full name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-10"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            {searchQuery && (
              <div className="mt-2 text-xs text-gray-600">
                Found {peopleList.filter(person =>
                  person.name.toLowerCase().includes(searchQuery.toLowerCase())
                ).length} of {peopleList.length} people
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 pr-2 px-6">
            {peopleList
              .filter(person =>
                person.name.toLowerCase().includes(searchQuery.toLowerCase())
              )
              .map((person, index) => (
              <Card key={person.id} className="border-2 border-gray-200 hover:border-[#8e0b16]/30 transition-all">
                <CardContent className="p-4">
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-start">
                    {/* Name Input */}
                    <div className="md:col-span-4">
                      <Label className="text-xs text-gray-600 mb-1 block">Name</Label>
                      <Input
                        value={person.name}
                        onChange={(e) => updatePerson(person.id, { name: e.target.value })}
                        placeholder="Enter name"
                        className="text-sm"
                      />
                    </div>

                    {/* Leader Checkbox */}
                    <div className="md:col-span-3">
                      <Label className="text-xs text-gray-600 mb-1 block">Leader</Label>
                      <div className="flex items-center gap-2 h-10 px-3 border rounded-md bg-white">
                        <input
                          type="checkbox"
                          checked={person.isLeader || false}
                          onChange={(e) => updatePerson(person.id, { isLeader: e.target.checked })}
                          className="w-4 h-4 text-[#8e0b16] focus:ring-[#8e0b16] rounded"
                        />
                        {person.isLeader && <Crown className="h-4 w-4 text-yellow-500" />}
                      </div>
                    </div>

                    {/* Label Input */}
                    <div className="md:col-span-4">
                      <Label className="text-xs text-gray-600 mb-1 block">Label (Optional)</Label>
                      <Input
                        value={person.label || ''}
                        onChange={(e) => updatePerson(person.id, { label: e.target.value })}
                        placeholder="e.g., Teacher, Student"
                        className="text-sm"
                      />
                    </div>

                    {/* Remove Button */}
                    <div className="md:col-span-1 flex items-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removePerson(person.id)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        title="Remove person"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Preview */}
                  <div className="mt-2 flex items-center gap-2 text-xs text-gray-600 flex-wrap">
                    <span className="font-medium">{person.name || 'Unnamed'}</span>
                    {person.isLeader && (
                      <Badge className="bg-yellow-500 text-white text-xs">
                        👑 Leader
                      </Badge>
                    )}
                    {person.label && (
                      <Badge variant="outline" className="bg-blue-50 text-blue-700 text-xs">
                        {person.label}
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}

            {/* Add Person Button */}
            <Button
              onClick={addPerson}
              variant="outline"
              className="w-full border-dashed border-2 border-[#8e0b16]/30 text-[#8e0b16] hover:bg-[#8e0b16]/5"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Another Person
            </Button>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t px-6">
            <Button
              variant="outline"
              onClick={() => {
                setShowPeopleEditor(false)
                setSearchQuery("")
              }}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                applyPeopleEditorChanges()
                setSearchQuery("")
              }}
              className="flex-1 bg-[#8e0b16] hover:bg-[#66181E] text-white"
            >
              Apply Settings
            </Button>
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

        @keyframes progress {
          0% { width: 0%; }
          50% { width: 80%; }
          100% { width: 60%; }
        }

        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes slide-in-from-left-4 {
          from {
            opacity: 0;
            transform: translateX(-1rem);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes slide-in-from-right-4 {
          from {
            opacity: 0;
            transform: translateX(1rem);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes slide-in-from-top-4 {
          from {
            opacity: 0;
            transform: translateY(-1rem);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes slide-in-from-bottom-4 {
          from {
            opacity: 0;
            transform: translateY(1rem);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes zoom-in-95 {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        .animate-in {
          animation-fill-mode: both;
        }

        .fade-in {
          animation-name: fade-in;
        }

        .slide-in-from-left-4 {
          animation-name: slide-in-from-left-4;
        }

        .slide-in-from-right-4 {
          animation-name: slide-in-from-right-4;
        }

        .slide-in-from-top-4 {
          animation-name: slide-in-from-top-4;
        }

        .slide-in-from-bottom-4 {
          animation-name: slide-in-from-bottom-4;
        }

        .zoom-in-95 {
          animation-name: zoom-in-95;
        }

        .duration-300 { animation-duration: 300ms; }
        .duration-500 { animation-duration: 500ms; }
        .duration-700 { animation-duration: 700ms; }

        /* Person-to-group reveal animations */
        @keyframes person-fade-up {
          0% {
            opacity: 0;
            transform: translateY(20px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes person-bounce-in {
          0% {
            opacity: 0;
            transform: scale(0.1) translateY(30px);
          }
          50% {
            opacity: 0.8;
            transform: scale(1.05) translateY(-5px);
          }
          70% {
            transform: scale(0.95) translateY(2px);
          }
          100% {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }

        @keyframes person-slide-up {
          0% {
            opacity: 0;
            transform: translateY(40px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }

        /* HEARTBEAT PACING: Fade-in + slight upward move + smooth timing */
        @keyframes person-heartbeat-reveal {
          0% {
            opacity: 0;
            transform: translateY(12px);
          }
          60% {
            opacity: 0.9;
            transform: translateY(-2px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .person-reveal {
          animation: person-heartbeat-reveal 0.7s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
        }

        .person-bounce {
          animation: person-bounce-in 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55) forwards;
        }

        .person-slide {
          animation: person-slide-up 0.4s ease-out forwards;
        }
      `}</style>
    </div>
  )
}

export default EnhancedTeamPicker
