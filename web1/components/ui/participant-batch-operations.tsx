"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { toast } from "@/hooks/use-toast"
import { Users, Download, FileSpreadsheet, CheckCircle, XCircle, Filter, UserCheck, UserX, Mail, Phone, GraduationCap, Building } from "lucide-react"

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

interface BatchOperationsProps {
  participants: Participant[]
  onParticipantsChange: (participants: Participant[]) => void
  onSelectionChange?: (selected: Participant[]) => void
}

interface BatchCriteria {
  grade: string
  section: string
  hasEmail: string
  hasContact: string
  emailDomain: string
}

interface ExportConfig {
  format: 'csv' | 'json' | 'xlsx'
  includeSelected: boolean
  includeUnselected: boolean
  columns: string[]
  customFilters: BatchCriteria
}

export function ParticipantBatchOperations({
  participants,
  onParticipantsChange,
  onSelectionChange
}: BatchOperationsProps) {
  const [isBatchDialogOpen, setIsBatchDialogOpen] = useState(false)
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false)
  const [batchCriteria, setBatchCriteria] = useState<BatchCriteria>({
    grade: "all",
    section: "all", 
    hasEmail: "all",
    hasContact: "all",
    emailDomain: "all"
  })
  const [exportConfig, setExportConfig] = useState<ExportConfig>({
    format: 'csv',
    includeSelected: true,
    includeUnselected: true,
    columns: ['name', 'email', 'contactNumber', 'studentId', 'grade', 'section'],
    customFilters: {
      grade: "all",
      section: "all",
      hasEmail: "all", 
      hasContact: "all",
      emailDomain: "all"
    }
  })

  // Get unique values for filtering
  const getUniqueGrades = () => [...new Set(participants.filter(p => p.grade).map(p => p.grade!))].sort()
  const getUniqueSections = () => [...new Set(participants.filter(p => p.section).map(p => p.section!))].sort()
  const getUniqueEmailDomains = () => [...new Set(
    participants.filter(p => p.email && p.email.includes('@')).map(p => p.email!.split('@')[1])
  )].sort()

  // Filter participants based on criteria
  const filterParticipants = (criteria: BatchCriteria) => {
    return participants.filter(p => {
      const matchesGrade = criteria.grade === "all" || p.grade === criteria.grade
      const matchesSection = criteria.section === "all" || p.section === criteria.section
      const matchesHasEmail = criteria.hasEmail === "all" ||
        (criteria.hasEmail === "yes" && p.email) ||
        (criteria.hasEmail === "no" && !p.email)
      const matchesHasContact = criteria.hasContact === "all" ||
        (criteria.hasContact === "yes" && p.contactNumber) ||
        (criteria.hasContact === "no" && !p.contactNumber)
      const matchesEmailDomain = criteria.emailDomain === "all" ||
        (p.email && p.email.includes('@') && p.email.split('@')[1] === criteria.emailDomain)
      
      return matchesGrade && matchesSection && matchesHasEmail && matchesHasContact && matchesEmailDomain
    })
  }

  // Batch selection operations
  const selectByCriteria = () => {
    const filteredParticipants = filterParticipants(batchCriteria)
    const updated = participants.map(p => ({
      ...p,
      isSelected: filteredParticipants.includes(p) ? true : p.isSelected
    }))
    onParticipantsChange(updated)
    onSelectionChange?.(updated.filter(p => p.isSelected))
    
    toast({
      title: "Batch Selection Applied",
      description: `Selected ${filteredParticipants.length} participants based on criteria`,
    })
    setIsBatchDialogOpen(false)
  }

  const deselectByCriteria = () => {
    const filteredParticipants = filterParticipants(batchCriteria)
    const updated = participants.map(p => ({
      ...p,
      isSelected: filteredParticipants.includes(p) ? false : p.isSelected
    }))
    onParticipantsChange(updated)
    onSelectionChange?.(updated.filter(p => p.isSelected))
    
    toast({
      title: "Batch Deselection Applied",
      description: `Deselected ${filteredParticipants.length} participants based on criteria`,
    })
    setIsBatchDialogOpen(false)
  }

  const selectAll = () => {
    const updated = participants.map(p => ({ ...p, isSelected: true }))
    onParticipantsChange(updated)
    onSelectionChange?.(updated)
    toast({
      title: "All Selected",
      description: `Selected all ${participants.length} participants`,
    })
  }

  const selectNone = () => {
    const updated = participants.map(p => ({ ...p, isSelected: false }))
    onParticipantsChange(updated)
    onSelectionChange?.([])
    toast({
      title: "None Selected",
      description: "Deselected all participants",
    })
  }

  const invertSelection = () => {
    const updated = participants.map(p => ({ ...p, isSelected: !p.isSelected }))
    onParticipantsChange(updated)
    onSelectionChange?.(updated.filter(p => p.isSelected))
    toast({
      title: "Selection Inverted",
      description: "Inverted participant selection",
    })
  }

  // Export operations
  const getExportData = () => {
    // Filter by selection status
    let dataToExport = participants
    if (!exportConfig.includeSelected && !exportConfig.includeUnselected) {
      return []
    }
    if (!exportConfig.includeSelected) {
      dataToExport = dataToExport.filter(p => !p.isSelected)
    }
    if (!exportConfig.includeUnselected) {
      dataToExport = dataToExport.filter(p => p.isSelected)
    }

    // Apply custom filters
    const filteredData = dataToExport.filter(p => {
      const criteria = exportConfig.customFilters
      const matchesGrade = criteria.grade === "all" || p.grade === criteria.grade
      const matchesSection = criteria.section === "all" || p.section === criteria.section
      const matchesHasEmail = criteria.hasEmail === "all" ||
        (criteria.hasEmail === "yes" && p.email) ||
        (criteria.hasEmail === "no" && !p.email)
      const matchesHasContact = criteria.hasContact === "all" ||
        (criteria.hasContact === "yes" && p.contactNumber) ||
        (criteria.hasContact === "no" && !p.contactNumber)
      const matchesEmailDomain = criteria.emailDomain === "all" ||
        (p.email && p.email.includes('@') && p.email.split('@')[1] === criteria.emailDomain)
      
      return matchesGrade && matchesSection && matchesHasEmail && matchesHasContact && matchesEmailDomain
    })

    // Select only requested columns
    return filteredData.map(p => {
      const row: Record<string, any> = {}
      exportConfig.columns.forEach(col => {
        switch (col) {
          case 'name':
            row['Name'] = p.name
            break
          case 'email':
            row['Email'] = p.email || ''
            break
          case 'contactNumber':
            row['Contact Number'] = p.contactNumber || ''
            break
          case 'studentId':
            row['Student ID'] = p.studentId || ''
            break
          case 'grade':
            row['Grade'] = p.grade || ''
            break
          case 'section':
            row['Section'] = p.section || ''
            break
          case 'isSelected':
            row['Selected'] = p.isSelected ? 'Yes' : 'No'
            break
          default:
            if (p.customFields && p.customFields[col]) {
              row[col.charAt(0).toUpperCase() + col.slice(1)] = p.customFields[col]
            }
        }
      })
      return row
    })
  }

  const exportData = () => {
    const data = getExportData()
    if (data.length === 0) {
      toast({
        title: "No Data to Export",
        description: "No participants match your export criteria",
        variant: "destructive"
      })
      return
    }

    if (exportConfig.format === 'csv') {
      const headers = Object.keys(data[0])
      const csvContent = [
        headers.join(','),
        ...data.map(row => headers.map(header => `"${row[header]}"`).join(','))
      ].join('\n')

      const blob = new Blob([csvContent], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `participants-export-${new Date().toISOString().split('T')[0]}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } else if (exportConfig.format === 'json') {
      const jsonContent = JSON.stringify(data, null, 2)
      const blob = new Blob([jsonContent], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `participants-export-${new Date().toISOString().split('T')[0]}.json`
      a.click()
      URL.revokeObjectURL(url)
    }

    toast({
      title: "Export Successful",
      description: `Exported ${data.length} participants as ${exportConfig.format.toUpperCase()}`,
    })
    setIsExportDialogOpen(false)
  }

  const getCriteriaPreview = () => {
    return filterParticipants(batchCriteria)
  }

  const getExportPreview = () => {
    return getExportData()
  }

  const selectedCount = participants.filter(p => p.isSelected).length

  return (
    <div className="space-y-4">
      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{participants.length}</div>
            <div className="text-xs text-muted-foreground">Total Participants</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-green-600">{selectedCount}</div>
            <div className="text-xs text-muted-foreground">Selected</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-orange-600">{participants.length - selectedCount}</div>
            <div className="text-xs text-muted-foreground">Unselected</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-purple-600">{getUniqueGrades().length}</div>
            <div className="text-xs text-muted-foreground">Grades</div>
          </CardContent>
        </Card>
      </div>

      {/* Batch Operations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Batch Operations
          </CardTitle>
          <CardDescription>
            Perform operations on multiple participants at once
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {/* Quick Selection */}
            <Button
              onClick={selectAll}
              variant="outline"
              className="flex items-center gap-2"
            >
              <CheckCircle className="h-4 w-4" />
              Select All
            </Button>
            
            <Button
              onClick={selectNone}
              variant="outline"
              className="flex items-center gap-2"
            >
              <XCircle className="h-4 w-4" />
              Select None
            </Button>
            
            <Button
              onClick={invertSelection}
              variant="outline"
              className="flex items-center gap-2"
            >
              <UserCheck className="h-4 w-4" />
              Invert Selection
            </Button>

            {/* Batch Select Dialog */}
            <Dialog open={isBatchDialogOpen} onOpenChange={setIsBatchDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  Select by Criteria
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Batch Selection by Criteria</DialogTitle>
                  <DialogDescription>
                    Select or deselect participants based on specific criteria
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4">
                  {/* Criteria Selection */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Grade</Label>
                      <Select 
                        value={batchCriteria.grade} 
                        onValueChange={(value) => setBatchCriteria(prev => ({ ...prev, grade: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Grades</SelectItem>
                          {getUniqueGrades().map(grade => (
                            <SelectItem key={grade} value={grade}>{grade}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Section</Label>
                      <Select 
                        value={batchCriteria.section} 
                        onValueChange={(value) => setBatchCriteria(prev => ({ ...prev, section: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Sections</SelectItem>
                          {getUniqueSections().map(section => (
                            <SelectItem key={section} value={section}>{section}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Has Email</Label>
                      <Select 
                        value={batchCriteria.hasEmail} 
                        onValueChange={(value) => setBatchCriteria(prev => ({ ...prev, hasEmail: value }))}
                      >
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
                    
                    <div className="space-y-2">
                      <Label>Email Domain</Label>
                      <Select 
                        value={batchCriteria.emailDomain} 
                        onValueChange={(value) => setBatchCriteria(prev => ({ ...prev, emailDomain: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Domains</SelectItem>
                          {getUniqueEmailDomains().map(domain => (
                            <SelectItem key={domain} value={domain}>@{domain}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  {/* Preview */}
                  <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <Label className="text-blue-800 font-medium">Preview</Label>
                    <p className="text-sm text-blue-600 mt-1">
                      {getCriteriaPreview().length} participants match these criteria
                    </p>
                    {getCriteriaPreview().length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {getCriteriaPreview().slice(0, 10).map(p => (
                          <Badge key={p.id} variant="outline" className="text-xs">
                            {p.name}
                          </Badge>
                        ))}
                        {getCriteriaPreview().length > 10 && (
                          <Badge variant="outline" className="text-xs">
                            +{getCriteriaPreview().length - 10} more
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsBatchDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={deselectByCriteria}
                    variant="outline"
                    className="border-red-200 text-red-600 hover:bg-red-50"
                  >
                    <UserX className="h-4 w-4 mr-2" />
                    Deselect
                  </Button>
                  <Button onClick={selectByCriteria}>
                    <UserCheck className="h-4 w-4 mr-2" />
                    Select
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>

      {/* Advanced Export */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Advanced Export
          </CardTitle>
          <CardDescription>
            Export participants with custom filters and format options
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Dialog open={isExportDialogOpen} onOpenChange={setIsExportDialogOpen}>
            <DialogTrigger asChild>
              <Button className="w-full">
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Configure Export
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Advanced Export Configuration</DialogTitle>
                <DialogDescription>
                  Customize your participant data export with filters and format options
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-6">
                {/* Export Format */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold">Export Format</Label>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { value: 'csv', label: 'CSV', icon: '📊', desc: 'Spreadsheet format' },
                      { value: 'json', label: 'JSON', icon: '📄', desc: 'Data format' },
                      { value: 'xlsx', label: 'Excel', icon: '📈', desc: 'Excel format' }
                    ].map((format) => (
                      <Button
                        key={format.value}
                        variant={exportConfig.format === format.value ? "default" : "outline"}
                        onClick={() => setExportConfig(prev => ({ ...prev, format: format.value as any }))}
                        className="h-auto p-3 flex flex-col items-center gap-1"
                      >
                        <span className="text-lg">{format.icon}</span>
                        <span className="font-medium text-sm">{format.label}</span>
                        <span className="text-xs text-muted-foreground">{format.desc}</span>
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Selection Filter */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold">Include Participants</Label>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="include-selected"
                        checked={exportConfig.includeSelected}
                        onCheckedChange={(checked) => 
                          setExportConfig(prev => ({ ...prev, includeSelected: !!checked }))
                        }
                      />
                      <Label htmlFor="include-selected" className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        Selected participants ({selectedCount})
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="include-unselected"
                        checked={exportConfig.includeUnselected}
                        onCheckedChange={(checked) => 
                          setExportConfig(prev => ({ ...prev, includeUnselected: !!checked }))
                        }
                      />
                      <Label htmlFor="include-unselected" className="flex items-center gap-2">
                        <XCircle className="h-4 w-4 text-gray-600" />
                        Unselected participants ({participants.length - selectedCount})
                      </Label>
                    </div>
                  </div>
                </div>

                {/* Column Selection */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold">Columns to Export</Label>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { value: 'name', label: 'Name', icon: <Users className="h-4 w-4" /> },
                      { value: 'email', label: 'Email', icon: <Mail className="h-4 w-4" /> },
                      { value: 'contactNumber', label: 'Contact', icon: <Phone className="h-4 w-4" /> },
                      { value: 'studentId', label: 'Student ID', icon: <GraduationCap className="h-4 w-4" /> },
                      { value: 'grade', label: 'Grade', icon: <Building className="h-4 w-4" /> },
                      { value: 'section', label: 'Section', icon: <Building className="h-4 w-4" /> },
                      { value: 'isSelected', label: 'Selection Status', icon: <CheckCircle className="h-4 w-4" /> }
                    ].map((column) => (
                      <div key={column.value} className="flex items-center space-x-2">
                        <Checkbox
                          id={`column-${column.value}`}
                          checked={exportConfig.columns.includes(column.value)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setExportConfig(prev => ({
                                ...prev,
                                columns: [...prev.columns, column.value]
                              }))
                            } else {
                              setExportConfig(prev => ({
                                ...prev,
                                columns: prev.columns.filter(c => c !== column.value)
                              }))
                            }
                          }}
                        />
                        <Label htmlFor={`column-${column.value}`} className="flex items-center gap-2 cursor-pointer">
                          {column.icon}
                          {column.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Preview */}
                <div className="space-y-2">
                  <Label className="text-base font-semibold">Export Preview</Label>
                  <div className="p-3 bg-gray-50 rounded-lg border max-h-32 overflow-y-auto">
                    {getExportPreview().length > 0 ? (
                      <div>
                        <p className="text-sm font-medium text-gray-700 mb-2">
                          {getExportPreview().length} participants will be exported
                        </p>
                        <div className="text-xs text-gray-600">
                          <p>Columns: {exportConfig.columns.join(', ')}</p>
                          <p>Format: {exportConfig.format.toUpperCase()}</p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-red-600">No participants match your export criteria</p>
                    )}
                  </div>
                </div>
              </div>
              
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsExportDialogOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={exportData}
                  disabled={getExportPreview().length === 0 || exportConfig.columns.length === 0}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export Data
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    </div>
  )
}