"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { db } from "@/lib/firebase"
import { collection, query, getDocs } from "firebase/firestore"
import { toast } from "@/hooks/use-toast"
import Papa from "papaparse"
import { Download, FileText, Filter, Users } from "lucide-react"
import { THEMES } from "@/lib/wheel-data"

interface WinnerExportProps {
  wheelId: string
  wheelTheme?: string // Accept string theme value
}

interface SpinLog {
  id: string
  timestamp: Date
  numberOfWinners: number
  winners: { id?: string; name: string }[] // id is optional for non-participant wheels
  wheelType?: string // New: to differentiate logs
}

interface Participant {
  id: string
  name: string
  email?: string
  contactNumber?: string
  studentId?: string
  grade?: string
  section?: string
  originalHeaders?: Record<string, string>
  customFields?: Record<string, string>
}

interface ExportPreset {
  id: string
  name: string
  columns: string[]
  description: string
}

export function WinnerExport({ wheelId, wheelTheme }: WinnerExportProps) {
  // Default theme if none provided
  const defaultTheme = {
    primary: "#8e0b16",
    secondary: "#66181E",
    accent: "#ffffff",
    background: "#f8f9fa"
  }

  // Convert string theme to theme object
  const getThemeObject = (themeString?: string) => {
    if (!themeString || themeString === "default") {
      return defaultTheme
    }

    const theme = THEMES.find(t => t.value === themeString)
    if (!theme || !theme.colors || theme.colors.length === 0) {
      return defaultTheme
    }

    return {
      primary: theme.colors[0] || defaultTheme.primary,
      secondary: theme.colors[1] || defaultTheme.secondary,
      accent: theme.colors[2] || defaultTheme.accent,
      background: defaultTheme.background
    }
  }

  const currentTheme = getThemeObject(wheelTheme)

  const [spinLogs, setSpinLogs] = useState<SpinLog[]>([])
  const [allParticipants, setAllParticipants] = useState<Participant[]>([]) // Only for 'participant' type
  const [selectedColumns, setSelectedColumns] = useState<string[]>([])
  const [availableColumns, setAvailableColumns] = useState<string[]>([])
  const [filteredSpinLogs, setFilteredSpinLogs] = useState<SpinLog[]>([])
  const [dateFilter, setDateFilter] = useState<string>("all")
  const [wheelTypeFilter, setWheelTypeFilter] = useState<string>("all")
  const [exportPresets] = useState<ExportPreset[]>([
    { id: 'basic', name: 'Basic Info', columns: ['name', 'email'], description: 'Name and email only' },
    { id: 'contact', name: 'Contact Details', columns: ['name', 'email', 'contactNumber'], description: 'Name, email, and contact' },
    { id: 'student', name: 'Student Info', columns: ['name', 'email', 'studentId', 'grade', 'section'], description: 'Student data' },
    { id: 'complete', name: 'All Data', columns: [], description: 'All available columns' }
  ])
  const [selectedPreset, setSelectedPreset] = useState<string>('')

  useEffect(() => {
    const fetchData = async () => {
      if (!wheelId) return

      // Fetch spin logs
      const logsQuery = query(collection(db, `wheels/${wheelId}/spinLogs`))
      const logsSnapshot = await getDocs(logsQuery)
      const fetchedLogs: SpinLog[] = logsSnapshot.docs.map((doc) => ({
        id: doc.id,
        timestamp: doc.data().timestamp.toDate(),
        numberOfWinners: doc.data().numberOfWinners,
        winners: doc.data().winners,
        wheelType: doc.data().wheelType || "participant", // Default to participant for old logs
      }))
      const sortedLogs = fetchedLogs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      setSpinLogs(sortedLogs)
      setFilteredSpinLogs(sortedLogs)

      // Fetch all participants to get full data for export (only if there are participant logs)
      const hasParticipantLogs = fetchedLogs.some((log) => log.wheelType === "participant")
      if (hasParticipantLogs) {
        const participantsQuery = query(collection(db, `wheels/${wheelId}/participants`))
        const participantsSnapshot = await getDocs(participantsQuery)
        const fetchedParticipants: Participant[] = participantsSnapshot.docs.map((doc) => ({
          id: doc.id,
          name: doc.data().name || '',
          email: doc.data().email,
          contactNumber: doc.data().contactNumber,
          studentId: doc.data().studentId,
          grade: doc.data().grade,
          section: doc.data().section,
          originalHeaders: doc.data().originalHeaders,
          customFields: doc.data().customFields,
          ...doc.data(),
        }))
        setAllParticipants(fetchedParticipants)

        // Determine available columns from participant data
        if (fetchedParticipants.length > 0) {
          const allColumns = new Set<string>()
          
          // Add standard columns
          allColumns.add("name")
          allColumns.add("email")
          allColumns.add("contactNumber")
          allColumns.add("studentId")
          allColumns.add("grade")
          allColumns.add("section")
          
          // Add custom columns from originalHeaders and customFields
          fetchedParticipants.forEach(participant => {
            // From originalHeaders
            if (participant.originalHeaders) {
              Object.keys(participant.originalHeaders).forEach(key => {
                if (key !== "id") allColumns.add(key)
              })
            }
            // From customFields  
            if (participant.customFields) {
              Object.keys(participant.customFields).forEach(key => {
                allColumns.add(key)
              })
            }
          })
          
          const columns = Array.from(allColumns).filter(col => {
            // Check if any participant has data for this column
            return fetchedParticipants.some(p => 
              p[col as keyof Participant] || 
              p.originalHeaders?.[col] || 
              p.customFields?.[col]
            )
          })
          
          setAvailableColumns(columns)
          setSelectedColumns(["name"]) // Default to name
        }
      } else {
        // For non-participant wheels, only 'name' (value) is available
        setAvailableColumns(["name"])
        setSelectedColumns(["name"])
      }
    }
    fetchData()
  }, [wheelId])

  // Filter spin logs based on date and wheel type
  useEffect(() => {
    let filtered = [...spinLogs]
    
    // Date filter
    if (dateFilter !== "all") {
      const now = new Date()
      const filterDate = new Date()
      
      switch (dateFilter) {
        case "today":
          filterDate.setHours(0, 0, 0, 0)
          filtered = filtered.filter(log => log.timestamp >= filterDate)
          break
        case "week":
          filterDate.setDate(now.getDate() - 7)
          filtered = filtered.filter(log => log.timestamp >= filterDate)
          break
        case "month":
          filterDate.setMonth(now.getMonth() - 1)
          filtered = filtered.filter(log => log.timestamp >= filterDate)
          break
      }
    }
    
    // Wheel type filter
    if (wheelTypeFilter !== "all") {
      filtered = filtered.filter(log => log.wheelType === wheelTypeFilter)
    }
    
    setFilteredSpinLogs(filtered)
  }, [spinLogs, dateFilter, wheelTypeFilter])

  const handleColumnToggle = (column: string) => {
    setSelectedColumns((prev) => (prev.includes(column) ? prev.filter((c) => c !== column) : [...prev, column]))
  }

  const applyPreset = (presetId: string) => {
    const preset = exportPresets.find(p => p.id === presetId)
    if (!preset) return
    
    if (preset.id === 'complete') {
      setSelectedColumns([...availableColumns])
    } else {
      const validColumns = preset.columns.filter(col => availableColumns.includes(col))
      setSelectedColumns(validColumns)
    }
    setSelectedPreset(presetId)
  }

  const handleExport = () => {
    if (filteredSpinLogs.length === 0) {
      toast({
        title: "No Spin Logs",
        description: "No spin results match your current filters.",
        variant: "destructive",
      })
      return
    }
    if (selectedColumns.length === 0) {
      toast({
        title: "No Columns Selected",
        description: "Please select at least one column to export.",
        variant: "destructive",
      })
      return
    }

    const exportData: Record<string, string>[] = []

    filteredSpinLogs.forEach((log) => {
      log.winners.forEach((winnerRef) => {
        const row: Record<string, string> = {
          "Spin Timestamp": log.timestamp.toLocaleString(),
          "Wheel Type": log.wheelType || "participant",
          "Winner Value": winnerRef.name, // Generic for any wheel type
        }

        if (log.wheelType === "participant") {
          const fullWinnerData = allParticipants.find((p) => p.id === winnerRef.id)
          if (fullWinnerData) {
            selectedColumns.forEach((col) => {
              if (col === "name") {
                // Already handled by "Winner Value"
              } else if (col === "email" && fullWinnerData.email) {
                row["Email"] = fullWinnerData.email
              } else if (col === "contactNumber" && fullWinnerData.contactNumber) {
                row["Contact Number"] = fullWinnerData.contactNumber
              } else if (col === "studentId" && fullWinnerData.studentId) {
                row["Student ID"] = fullWinnerData.studentId
              } else if (col === "grade" && fullWinnerData.grade) {
                row["Grade"] = fullWinnerData.grade
              } else if (col === "section" && fullWinnerData.section) {
                row["Section"] = fullWinnerData.section
              } else if (fullWinnerData.originalHeaders && fullWinnerData.originalHeaders[col]) {
                row[col.charAt(0).toUpperCase() + col.slice(1)] = fullWinnerData.originalHeaders[col]
              } else if (fullWinnerData.customFields && fullWinnerData.customFields[col]) {
                row[col.charAt(0).toUpperCase() + col.slice(1)] = fullWinnerData.customFields[col]
              }
            })
          }
        }
        exportData.push(row)
      })
    })

    const csv = Papa.unparse(exportData)
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob)
      link.setAttribute("href", url)
      link.setAttribute("download", `coby_picks_winners_${wheelId}.csv`)
      link.style.visibility = "hidden"
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      toast({
        title: "Export Successful",
        description: "Winner data has been downloaded as a CSV file.",
      })
    } else {
      toast({
        title: "Export Failed",
        description: "Your browser does not support downloading files directly.",
        variant: "destructive",
      })
    }
  }

  return (
    <div className="space-y-6">
      {/* Export Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold" style={{ color: currentTheme.primary }}>{spinLogs.length}</div>
            <p className="text-sm text-muted-foreground">Total Spins</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold" style={{ color: currentTheme.primary }}>{filteredSpinLogs.length}</div>
            <p className="text-sm text-muted-foreground">Filtered Results</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold" style={{ color: currentTheme.primary }}>{availableColumns.length}</div>
            <p className="text-sm text-muted-foreground">Available Columns</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Export Filters
          </CardTitle>
          <CardDescription>
            Filter which spin results to include in the export
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Date Range</Label>
              <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Select date range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="week">Last 7 Days</SelectItem>
                  <SelectItem value="month">Last 30 Days</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Wheel Type</Label>
              <Select value={wheelTypeFilter} onValueChange={setWheelTypeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Select wheel type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="participant">Participant</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                  <SelectItem value="number">Number</SelectItem>
                  <SelectItem value="color">Color</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Column Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Column Selection
          </CardTitle>
          <CardDescription>
            Choose which participant data columns to include in the export
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Export Presets */}
          <div className="space-y-2">
            <Label>Quick Presets</Label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {exportPresets.map((preset) => (
                <Button
                  key={preset.id}
                  variant={selectedPreset === preset.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => applyPreset(preset.id)}
                  className="h-auto p-3 flex flex-col items-start"
                >
                  <div className="font-medium text-xs">{preset.name}</div>
                  <div className="text-xs text-muted-foreground mt-1">{preset.description}</div>
                </Button>
              ))}
            </div>
          </div>

          {/* Manual Column Selection */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Custom Selection</Label>
              <Badge variant="outline">
                {selectedColumns.length} of {availableColumns.length} selected
              </Badge>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 max-h-48 overflow-y-auto border rounded-md p-3">
              {availableColumns.length === 0 && allParticipants.length === 0 ? (
                <p className="text-sm text-muted-foreground col-span-full text-center py-4">
                  Upload participants or spin a wheel to see available columns.
                </p>
              ) : (
                availableColumns.map((col) => (
                  <div key={col} className="flex items-center space-x-2">
                    <Checkbox
                      id={`col-${col}`}
                      checked={selectedColumns.includes(col)}
                      onCheckedChange={() => handleColumnToggle(col)}
                      className="data-[state=checked]:text-white"
                      style={{ '--checked-bg': currentTheme.primary } as React.CSSProperties}
                    />
                    <Label htmlFor={`col-${col}`} className="capitalize text-sm cursor-pointer">
                      {col.replace(/([A-Z])/g, " $1").trim()}
                    </Label>
                  </div>
                ))
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Export Action */}
      <div className="flex justify-between items-center">
        <div className="text-sm text-muted-foreground">
          {filteredSpinLogs.length === 0 ? "No results to export" : 
           selectedColumns.length === 0 ? "Select at least one column" :
           `Ready to export ${filteredSpinLogs.reduce((acc, log) => acc + log.winners.length, 0)} winner records`}
        </div>
        <Button
          onClick={handleExport}
          disabled={filteredSpinLogs.length === 0 || selectedColumns.length === 0}
          className="text-white hover:opacity-90"
          style={{ backgroundColor: currentTheme.primary }}
          size="lg"
        >
          <Download className="h-4 w-4 mr-2" />
          Export Winners CSV
        </Button>
      </div>
      {/* Recent Spin Logs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Recent Spin Results
          </CardTitle>
          <CardDescription>
            Preview of the most recent spin results that will be exported
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredSpinLogs.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-8">
              No spin results match your current filters.
            </p>
          ) : (
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {filteredSpinLogs.slice(0, 10).map((log) => (
                <div key={log.id} className="border border-gray-200 rounded-md p-3 text-sm hover:bg-gray-50 transition-colors">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium" style={{ color: currentTheme.primary }}>
                          {log.timestamp.toLocaleDateString()} at {log.timestamp.toLocaleTimeString()}
                        </p>
                        <Badge variant="outline" className="text-xs">
                          {log.wheelType || "participant"}
                        </Badge>
                      </div>
                      <p className="text-muted-foreground text-xs">
                        {log.numberOfWinners} winner{log.numberOfWinners > 1 ? "s" : ""} selected
                      </p>
                    </div>
                    <div className="flex-1 text-right">
                      <div className="flex flex-wrap gap-1 justify-end">
                        {log.winners.slice(0, 3).map((winner, index) => (
                          <Badge
                            key={index}
                            className="text-white text-xs hover:opacity-90"
                            style={{ backgroundColor: currentTheme.primary }}
                          >
                            {winner.name}
                          </Badge>
                        ))}
                        {log.winners.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{log.winners.length - 3} more
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {filteredSpinLogs.length > 10 && (
                <div className="text-center pt-3 border-t">
                  <p className="text-sm text-muted-foreground">
                    Showing 10 of {filteredSpinLogs.length} results
                  </p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
