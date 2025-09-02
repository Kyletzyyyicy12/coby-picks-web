"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { toast } from "@/hooks/use-toast"
import { Upload, FileSpreadsheet, Users, Plus, Trash2, Edit, Filter, SortAsc, SortDesc, Download, Search, X, FilterX } from "lucide-react"

interface FilterOptions {
  searchText: string
  grade: string
  section: string
  emailDomain: string
  hasEmail: string // 'all', 'yes', 'no'
  hasContact: string // 'all', 'yes', 'no'
  isSelected: string // 'all', 'selected', 'unselected'
}

interface SortOption {
  field: keyof Participant
  direction: 'asc' | 'desc'
}

interface Participant {
  id: string
  name: string
  email?: string
  contactNumber?: string
  studentId?: string
  grade?: string
  section?: string
  isSelected: boolean
  customFields?: Record<string, string>
}

interface ParticipantManagerProps {
  participants: Participant[]
  onParticipantsChange: (participants: Participant[]) => void
  onSelectionChange?: (selected: Participant[]) => void
}

export function ParticipantManager({ 
  participants, 
  onParticipantsChange, 
  onSelectionChange 
}: ParticipantManagerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [sortOptions, setSortOptions] = useState<SortOption[]>([{ field: "name", direction: "asc" }])
  const [filters, setFilters] = useState<FilterOptions>({
    searchText: "",
    grade: "all",
    section: "all",
    emailDomain: "all",
    hasEmail: "all",
    hasContact: "all",
    isSelected: "all"
  })
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)
  const [availableGrades, setAvailableGrades] = useState<string[]>([])
  const [availableSections, setAvailableSections] = useState<string[]>([])
  const [availableEmailDomains, setAvailableEmailDomains] = useState<string[]>([])
  const [selectedFields, setSelectedFields] = useState({
    name: true,
    email: true,
    contactNumber: false,
    studentId: false,
    grade: false,
    section: false
  })
  
  // New participant form
  const [newParticipant, setNewParticipant] = useState({
    name: "",
    email: "",
    contactNumber: "",
    studentId: "",
    grade: "",
    section: ""
  })

  const schoolColors = {
    primary: "#8e0b16",
    secondary: "#66181E",
    accent: "#ffffff"
  }

  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string
        const lines = text.split('\n').filter(line => line.trim())
        const jsonData = lines.map(line => line.split(',').map(cell => cell.trim().replace(/"/g, '')))

        if (jsonData.length < 2) {
          toast({
            title: "Invalid File",
            description: "File must contain at least a header row and one data row",
            variant: "destructive"
          })
          return
        }

        const headers = jsonData[0].map(h => h?.toString().toLowerCase().trim())
        const rows = jsonData.slice(1)

        const newParticipants: Participant[] = rows
          .filter(row => row.some(cell => cell?.toString().trim()))
          .map((row, index) => {
            const participant: Participant = {
              id: `imported-${Date.now()}-${index}`,
              name: "",
              isSelected: false,
              customFields: {}
            }

            headers.forEach((header, colIndex) => {
              const value = row[colIndex]?.toString().trim() || ""

              if (header.includes("name") || header.includes("student")) {
                participant.name = value
              } else if (header.includes("email") && value) {
                participant.email = value
              } else if ((header.includes("contact") || header.includes("phone")) && value) {
                participant.contactNumber = value
              } else if ((header.includes("id") || header.includes("number")) && value) {
                participant.studentId = value
              } else if ((header.includes("grade") || header.includes("level")) && value) {
                participant.grade = value
              } else if ((header.includes("section") || header.includes("class")) && value) {
                participant.section = value
              } else if (value) {
                participant.customFields![header] = value
              }
            })

            return participant
          })
          .filter(p => p.name.trim())

        onParticipantsChange([...participants, ...newParticipants])
        
        toast({
          title: "Import Successful",
          description: `Imported ${newParticipants.length} participants`,
        })
      } catch (error) {
        console.error("Error parsing file:", error)
        toast({
          title: "Import Error",
          description: "Failed to parse the uploaded file",
          variant: "destructive"
        })
      }
    }
    
    reader.readAsText(file)
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }, [participants, onParticipantsChange])

  const addParticipant = () => {
    if (!newParticipant.name.trim()) {
      toast({
        title: "Name Required",
        description: "Please enter a participant name",
        variant: "destructive"
      })
      return
    }

    const participant: Participant = {
      id: `manual-${Date.now()}`,
      name: newParticipant.name.trim(),
      isSelected: false,
      // Only include optional fields if they have values
      ...(newParticipant.email.trim() && { email: newParticipant.email.trim() }),
      ...(newParticipant.contactNumber.trim() && { contactNumber: newParticipant.contactNumber.trim() }),
      ...(newParticipant.studentId.trim() && { studentId: newParticipant.studentId.trim() }),
      ...(newParticipant.grade.trim() && { grade: newParticipant.grade.trim() }),
      ...(newParticipant.section.trim() && { section: newParticipant.section.trim() })
    }

    onParticipantsChange([...participants, participant])
    
    setNewParticipant({
      name: "",
      email: "",
      contactNumber: "",
      studentId: "",
      grade: "",
      section: ""
    })
    
    setIsAddDialogOpen(false)
    
    toast({
      title: "Participant Added",
      description: `${participant.name} has been added`,
    })
  }

  const removeParticipant = (id: string) => {
    onParticipantsChange(participants.filter(p => p.id !== id))
  }

  const toggleParticipantSelection = (id: string) => {
    const updated = participants.map(p => 
      p.id === id ? { ...p, isSelected: !p.isSelected } : p
    )
    onParticipantsChange(updated)
    onSelectionChange?.(updated.filter(p => p.isSelected))
  }

  const selectAll = () => {
    const updated = participants.map(p => ({ ...p, isSelected: true }))
    onParticipantsChange(updated)
    onSelectionChange?.(updated)
  }

  const selectNone = () => {
    const updated = participants.map(p => ({ ...p, isSelected: false }))
    onParticipantsChange(updated)
    onSelectionChange?.([])
  }

  const handleSort = (field: keyof Participant) => {
    // Update primary sort option
    setSortOptions(prev => {
      const newOptions = [...prev]
      if (newOptions[0].field === field) {
        newOptions[0].direction = newOptions[0].direction === "asc" ? "desc" : "asc"
      } else {
        newOptions[0] = { field, direction: "asc" }
      }
      return newOptions
    })
  }

  const exportToCSV = () => {
    const headers = ["Name", "Email", "Contact", "Student ID", "Grade", "Section"]
    const csvContent = [
      headers.join(","),
      ...participants.map(p => [
        p.name,
        p.email || "",
        p.contactNumber || "",
        p.studentId || "",
        p.grade || "",
        p.section || ""
      ].map(field => `"${field}"`).join(","))
    ].join("\n")

    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "participants.csv"
    a.click()
    URL.revokeObjectURL(url)
  }

  const filteredAndSortedParticipants = participants
    .filter(p => {
      // Search text filter
      const searchLower = filters.searchText.toLowerCase()
      const matchesSearch = !filters.searchText || 
        p.name.toLowerCase().includes(searchLower) ||
        p.email?.toLowerCase().includes(searchLower) ||
        p.studentId?.toLowerCase().includes(searchLower) ||
        p.contactNumber?.toLowerCase().includes(searchLower)
      
      // Grade filter
      const matchesGrade = filters.grade === "all" || p.grade === filters.grade
      
      // Section filter
      const matchesSection = filters.section === "all" || p.section === filters.section
      
      // Email domain filter
      const matchesEmailDomain = filters.emailDomain === "all" || 
        (p.email && p.email.includes('@') && p.email.split('@')[1] === filters.emailDomain)
      
      // Has email filter
      const matchesHasEmail = filters.hasEmail === "all" ||
        (filters.hasEmail === "yes" && p.email) ||
        (filters.hasEmail === "no" && !p.email)
      
      // Has contact filter  
      const matchesHasContact = filters.hasContact === "all" ||
        (filters.hasContact === "yes" && p.contactNumber) ||
        (filters.hasContact === "no" && !p.contactNumber)
      
      // Selection filter
      const matchesSelected = filters.isSelected === "all" ||
        (filters.isSelected === "selected" && p.isSelected) ||
        (filters.isSelected === "unselected" && !p.isSelected)
      
      return matchesSearch && matchesGrade && matchesSection && 
             matchesEmailDomain && matchesHasEmail && matchesHasContact && matchesSelected
    })
    .sort((a, b) => {
      // Apply multiple sort criteria
      for (const sortOption of sortOptions) {
        const aValue = a[sortOption.field]?.toString().toLowerCase() || ""
        const bValue = b[sortOption.field]?.toString().toLowerCase() || ""
        const comparison = aValue.localeCompare(bValue)
        
        if (comparison !== 0) {
          return sortOption.direction === "asc" ? comparison : -comparison
        }
      }
      return 0
    })

  const selectedCount = participants.filter(p => p.isSelected).length

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2" style={{ color: schoolColors.primary }}>
            <Users className="h-6 w-6" />
            Participant Management
          </CardTitle>
          <CardDescription>
            Upload, manage, and select participants for your randomizer activity
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4">
            {/* File Upload */}
            <div className="flex-1">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="hidden"
              />
              <Button
                onClick={() => fileInputRef.current?.click()}
                variant="outline"
                className="w-full"
                style={{ borderColor: schoolColors.primary, color: schoolColors.primary }}
              >
                <Upload className="h-4 w-4 mr-2" />
                Upload Excel/CSV
              </Button>
            </div>

            {/* Manual Add */}
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-[#8e0b16] hover:bg-[#66181E]">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Manually
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle style={{ color: schoolColors.primary }}>Add Participant</DialogTitle>
                  <DialogDescription>
                    Enter participant details manually
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="name">Name *</Label>
                    <Input
                      id="name"
                      value={newParticipant.name}
                      onChange={(e) => setNewParticipant(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Full name"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={newParticipant.email}
                      onChange={(e) => setNewParticipant(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="email@example.com"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="contact">Contact Number</Label>
                    <Input
                      id="contact"
                      value={newParticipant.contactNumber}
                      onChange={(e) => setNewParticipant(prev => ({ ...prev, contactNumber: e.target.value }))}
                      placeholder="Phone number"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="studentId">Student ID</Label>
                      <Input
                        id="studentId"
                        value={newParticipant.studentId}
                        onChange={(e) => setNewParticipant(prev => ({ ...prev, studentId: e.target.value }))}
                        placeholder="ID number"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="grade">Grade</Label>
                      <Input
                        id="grade"
                        value={newParticipant.grade}
                        onChange={(e) => setNewParticipant(prev => ({ ...prev, grade: e.target.value }))}
                        placeholder="Grade level"
                      />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="section">Section</Label>
                    <Input
                      id="section"
                      value={newParticipant.section}
                      onChange={(e) => setNewParticipant(prev => ({ ...prev, section: e.target.value }))}
                      placeholder="Class section"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={addParticipant} className="bg-[#8e0b16] hover:bg-[#66181E]">
                    Add Participant
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Export */}
            {participants.length > 0 && (
              <Button
                onClick={exportToCSV}
                variant="outline"
                style={{ borderColor: schoolColors.primary, color: schoolColors.primary }}
              >
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Participants List */}
      {participants.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <CardTitle>Participants ({participants.length})</CardTitle>
                <CardDescription>
                  {selectedCount} selected • {filteredAndSortedParticipants.length} of {participants.length} shown
                </CardDescription>
              </div>
              
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={selectAll}
                  style={{ borderColor: schoolColors.primary, color: schoolColors.primary }}
                >
                  Select All
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={selectNone}
                  style={{ borderColor: schoolColors.primary, color: schoolColors.primary }}
                >
                  Select None
                </Button>
              </div>
            </div>
            
            {/* Search and Filter Controls */}
            <div className="space-y-4">
              {/* Basic Search */}
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search participants..."
                    value={filters.searchText}
                    onChange={(e) => updateFilter('searchText', e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Button
                  variant="outline"
                  onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                  className="flex items-center gap-2"
                >
                  <Filter className="h-4 w-4" />
                  Filters
                  {activeFiltersCount > 0 && (
                    <Badge variant="secondary" className="ml-1">
                      {activeFiltersCount}
                    </Badge>
                  )}
                </Button>
                {activeFiltersCount > 0 && (
                  <Button
                    variant="outline"
                    onClick={clearFilters}
                    size="sm"
                    className="px-2"
                  >
                    <FilterX className="h-4 w-4" />
                  </Button>
                )}
              </div>

              {/* Advanced Filters */}
              {showAdvancedFilters && (
                <Card className="p-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Grade Filter */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Grade</Label>
                      <Select value={filters.grade} onValueChange={(value) => updateFilter('grade', value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="All grades" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Grades</SelectItem>
                          {availableGrades.map(grade => (
                            <SelectItem key={grade} value={grade}>{grade}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Section Filter */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Section</Label>
                      <Select value={filters.section} onValueChange={(value) => updateFilter('section', value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="All sections" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Sections</SelectItem>
                          {availableSections.map(section => (
                            <SelectItem key={section} value={section}>{section}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Email Domain Filter */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Email Domain</Label>
                      <Select value={filters.emailDomain} onValueChange={(value) => updateFilter('emailDomain', value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="All domains" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Domains</SelectItem>
                          {availableEmailDomains.map(domain => (
                            <SelectItem key={domain} value={domain}>@{domain}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Has Email Filter */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Has Email</Label>
                      <Select value={filters.hasEmail} onValueChange={(value) => updateFilter('hasEmail', value)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All</SelectItem>
                          <SelectItem value="yes">With Email</SelectItem>
                          <SelectItem value="no">Without Email</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Has Contact Filter */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Has Contact</Label>
                      <Select value={filters.hasContact} onValueChange={(value) => updateFilter('hasContact', value)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All</SelectItem>
                          <SelectItem value="yes">With Contact</SelectItem>
                          <SelectItem value="no">Without Contact</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Selection Status Filter */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Selection Status</Label>
                      <Select value={filters.isSelected} onValueChange={(value) => updateFilter('isSelected', value)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All</SelectItem>
                          <SelectItem value="selected">Selected</SelectItem>
                          <SelectItem value="unselected">Not Selected</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </Card>
              )}

              {/* Multi-Column Sort */}
              <Card className="p-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Sort Options</Label>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={addSortOption}
                      disabled={sortOptions.length >= 3}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add Sort
                    </Button>
                  </div>
                  
                  <div className="space-y-2">
                    {sortOptions.map((option, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs min-w-0">
                          {index + 1}
                        </Badge>
                        <Select 
                          value={option.field} 
                          onValueChange={(field) => updateSortOption(index, { field: field as keyof Participant })}
                        >
                          <SelectTrigger className="flex-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="name">Name</SelectItem>
                            <SelectItem value="email">Email</SelectItem>
                            <SelectItem value="studentId">Student ID</SelectItem>
                            <SelectItem value="grade">Grade</SelectItem>
                            <SelectItem value="section">Section</SelectItem>
                            <SelectItem value="contactNumber">Contact</SelectItem>
                          </SelectContent>
                        </Select>
                        <Select 
                          value={option.direction} 
                          onValueChange={(direction) => updateSortOption(index, { direction: direction as 'asc' | 'desc' })}
                        >
                          <SelectTrigger className="w-24">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="asc">A-Z</SelectItem>
                            <SelectItem value="desc">Z-A</SelectItem>
                          </SelectContent>
                        </Select>
                        {sortOptions.length > 1 && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => removeSortOption(index)}
                            className="px-2"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedCount === participants.length}
                        onCheckedChange={(checked) => checked ? selectAll() : selectNone()}
                      />
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-gray-50 select-none"
                      onClick={() => handleSort("name")}
                    >
                      <div className="flex items-center gap-1">
                        Name
                        {sortOptions[0]?.field === "name" && (
                          sortOptions[0].direction === "asc" ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />
                        )}
                      </div>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer hover:bg-gray-50 select-none"
                      onClick={() => handleSort("email")}
                    >
                      <div className="flex items-center gap-1">
                        Email
                        {sortOptions[0]?.field === "email" && (
                          sortOptions[0].direction === "asc" ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />
                        )}
                      </div>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer hover:bg-gray-50 select-none"
                      onClick={() => handleSort("contactNumber")}
                    >
                      <div className="flex items-center gap-1">
                        Contact
                        {sortOptions[0]?.field === "contactNumber" && (
                          sortOptions[0].direction === "asc" ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />
                        )}
                      </div>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer hover:bg-gray-50 select-none"
                      onClick={() => handleSort("studentId")}
                    >
                      <div className="flex items-center gap-1">
                        Student ID
                        {sortOptions[0]?.field === "studentId" && (
                          sortOptions[0].direction === "asc" ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />
                        )}
                      </div>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer hover:bg-gray-50 select-none"
                      onClick={() => handleSort("grade")}
                    >
                      <div className="flex items-center gap-1">
                        Grade
                        {sortOptions[0]?.field === "grade" && (
                          sortOptions[0].direction === "asc" ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />
                        )}
                      </div>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer hover:bg-gray-50 select-none"
                      onClick={() => handleSort("section")}
                    >
                      <div className="flex items-center gap-1">
                        Section
                        {sortOptions[0]?.field === "section" && (
                          sortOptions[0].direction === "asc" ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />
                        )}
                      </div>
                    </TableHead>
                    <TableHead className="w-12">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAndSortedParticipants.map((participant) => (
                    <TableRow key={participant.id}>
                      <TableCell>
                        <Checkbox
                          checked={participant.isSelected}
                          onCheckedChange={() => toggleParticipantSelection(participant.id)}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{participant.name}</TableCell>
                      <TableCell>{participant.email || "-"}</TableCell>
                      <TableCell>{participant.contactNumber || "-"}</TableCell>
                      <TableCell>{participant.studentId || "-"}</TableCell>
                      <TableCell>{participant.grade || "-"}</TableCell>
                      <TableCell>{participant.section || "-"}</TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => removeParticipant(participant.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
