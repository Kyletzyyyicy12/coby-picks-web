"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { toast } from "@/hooks/use-toast"
import { db } from "@/lib/firebase"
import { collection, addDoc, getDocs, query, where, deleteDoc, doc, updateDoc } from "firebase/firestore"
import { 
  Users, 
  Plus, 
  Upload, 
  Download, 
  Trash2, 
  Edit, 
  Save, 
  X,
  FileSpreadsheet,
  UserPlus,
  Search
} from "lucide-react"
import type { User as FirebaseUser } from "firebase/auth"

interface Student {
  id: string
  name: string
  email: string
  studentId?: string
  grade?: string
  section?: string
  notes?: string
}

interface StudentList {
  id: string
  name: string
  description: string
  students: Student[]
  createdAt: Date
  updatedAt: Date
}

interface StudentListManagerProps {
  user: FirebaseUser
  onClose?: () => void
}

export function StudentListManager({ user, onClose }: StudentListManagerProps) {
  const [studentLists, setStudentLists] = useState<StudentList[]>([])
  const [loading, setLoading] = useState(true)
  const [editingList, setEditingList] = useState<StudentList | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")

  const schoolColors = {
    primary: "#8e0b16",
    secondary: "#66181E",
    accent: "#ffffff"
  }

  useEffect(() => {
    fetchStudentLists()
  }, [user])

  const fetchStudentLists = async () => {
    try {
      const listsQuery = query(
        collection(db, "studentLists"),
        where("createdBy", "==", user.uid)
      )
      const listsSnapshot = await getDocs(listsQuery)
      const lists = listsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date()
      })) as StudentList[]

      setStudentLists(lists)
    } catch (error) {
      console.error("Error fetching student lists:", error)
      toast({
        title: "Error",
        description: "Failed to load student lists",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const handleCreateList = async (formData: FormData) => {
    const name = formData.get("name") as string
    const description = formData.get("description") as string

    if (!name.trim()) {
      toast({
        title: "Error",
        description: "List name is required",
        variant: "destructive"
      })
      return
    }

    try {
      const newList = {
        name: name.trim(),
        description: description.trim(),
        students: [],
        createdBy: user.uid,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      const docRef = await addDoc(collection(db, "studentLists"), newList)
      const createdList = { id: docRef.id, ...newList }
      setStudentLists(prev => [createdList, ...prev])
      setShowCreateForm(false)

      toast({
        title: "Success",
        description: "Student list created successfully"
      })
    } catch (error) {
      console.error("Error creating student list:", error)
      toast({
        title: "Error",
        description: "Failed to create student list",
        variant: "destructive"
      })
    }
  }

  const handleDeleteList = async (listId: string) => {
    if (!confirm("Are you sure you want to delete this student list?")) return

    try {
      await deleteDoc(doc(db, "studentLists", listId))
      setStudentLists(prev => prev.filter(list => list.id !== listId))
      toast({
        title: "Deleted",
        description: "Student list deleted successfully"
      })
    } catch (error) {
      console.error("Error deleting student list:", error)
      toast({
        title: "Error",
        description: "Failed to delete student list",
        variant: "destructive"
      })
    }
  }

  const handleAddStudent = (listId: string, student: Student) => {
    setStudentLists(prev => prev.map(list => 
      list.id === listId 
        ? { ...list, students: [...list.students, student] }
        : list
    ))
  }

  const handleRemoveStudent = (listId: string, studentId: string) => {
    setStudentLists(prev => prev.map(list => 
      list.id === listId 
        ? { ...list, students: list.students.filter(s => s.id !== studentId) }
        : list
    ))
  }

  const exportList = (list: StudentList) => {
    const csvContent = [
      ["Name", "Email", "Student ID", "Grade", "Section", "Notes"],
      ...list.students.map(student => [
        student.name,
        student.email,
        student.studentId || "",
        student.grade || "",
        student.section || "",
        student.notes || ""
      ])
    ].map(row => row.join(",")).join("\n")

    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${list.name.replace(/\s+/g, "-")}-students.csv`
    a.click()
    URL.revokeObjectURL(url)

    toast({
      title: "Exported",
      description: `${list.name} exported successfully`
    })
  }

  const handleFileUpload = async (listId: string, file: File) => {
    if (!file.name.endsWith('.csv')) {
      toast({
        title: "Error",
        description: "Please upload a CSV file",
        variant: "destructive"
      })
      return
    }

    try {
      const text = await file.text()
      const lines = text.split('\n').filter(line => line.trim())
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase())
      
      const students: Student[] = lines.slice(1).map((line, index) => {
        const values = line.split(',').map(v => v.trim())
        return {
          id: `imported-${Date.now()}-${index}`,
          name: values[headers.indexOf('name')] || values[0] || `Student ${index + 1}`,
          email: values[headers.indexOf('email')] || values[1] || '',
          studentId: values[headers.indexOf('student id')] || values[2] || '',
          grade: values[headers.indexOf('grade')] || values[3] || '',
          section: values[headers.indexOf('section')] || values[4] || '',
          notes: values[headers.indexOf('notes')] || values[5] || ''
        }
      })

      setStudentLists(prev => prev.map(list => 
        list.id === listId 
          ? { ...list, students: [...list.students, ...students] }
          : list
      ))

      toast({
        title: "Success",
        description: `Imported ${students.length} students`
      })
    } catch (error) {
      console.error("Error importing students:", error)
      toast({
        title: "Error",
        description: "Failed to import students",
        variant: "destructive"
      })
    }
  }

  const filteredLists = studentLists.filter(list =>
    list.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    list.description.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto mb-4" style={{ borderColor: schoolColors.primary }}></div>
          <p>Loading student lists...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: schoolColors.primary }}>
            🧾 Manage Student Lists
          </h2>
          <p className="text-muted-foreground">
            Create and manage your student participant lists
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={() => setShowCreateForm(true)}
            className="text-white"
            style={{ backgroundColor: schoolColors.primary }}
          >
            <Plus className="h-4 w-4 mr-2" />
            New List
          </Button>
          {onClose && (
            <Button onClick={onClose} variant="outline">
              Close
            </Button>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="h-4 w-4 absolute left-3 top-3 text-muted-foreground" />
        <Input
          placeholder="Search student lists..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Create Form */}
      {showCreateForm && (
        <Card>
          <CardHeader>
            <CardTitle>Create New Student List</CardTitle>
            <CardDescription>
              Create a new list to organize your students
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={handleCreateList} className="space-y-4">
              <div>
                <Label htmlFor="name">List Name *</Label>
                <Input
                  id="name"
                  name="name"
                  placeholder="e.g., Grade 10 Section A"
                  required
                />
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  name="description"
                  placeholder="Optional description for this list"
                  rows={3}
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" className="text-white" style={{ backgroundColor: schoolColors.primary }}>
                  <Save className="h-4 w-4 mr-2" />
                  Create List
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowCreateForm(false)}>
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Student Lists */}
      {filteredLists.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No Student Lists</h3>
            <p className="text-muted-foreground mb-4">
              {studentLists.length === 0 
                ? "Create your first student list to get started" 
                : "No lists match your search"}
            </p>
            {studentLists.length === 0 && (
              <Button 
                onClick={() => setShowCreateForm(true)}
                className="text-white"
                style={{ backgroundColor: schoolColors.primary }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Your First List
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6">
          {filteredLists.map((list) => (
            <Card key={list.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5" style={{ color: schoolColors.primary }} />
                      {list.name}
                    </CardTitle>
                    {list.description && (
                      <CardDescription className="mt-1">
                        {list.description}
                      </CardDescription>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="outline">
                      {list.students.length} students
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Student List */}
                  {list.students.length > 0 ? (
                    <div className="grid gap-2 max-h-40 overflow-y-auto">
                      {list.students.map((student) => (
                        <div key={student.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                          <div>
                            <span className="font-medium">{student.name}</span>
                            {student.email && (
                              <span className="text-sm text-muted-foreground ml-2">({student.email})</span>
                            )}
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleRemoveStudent(list.id, student.id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-4 text-muted-foreground">
                      No students in this list yet
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2 pt-4 border-t">
                    <Button size="sm" variant="outline">
                      <UserPlus className="h-4 w-4 mr-2" />
                      Add Student
                    </Button>
                    <Button size="sm" variant="outline">
                      <Upload className="h-4 w-4 mr-2" />
                      Import CSV
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => exportList(list)}>
                      <Download className="h-4 w-4 mr-2" />
                      Export
                    </Button>
                    <Button size="sm" variant="outline">
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => handleDeleteList(list.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
