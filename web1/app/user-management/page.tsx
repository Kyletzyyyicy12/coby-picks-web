'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Users, UserPlus, Download, Upload, FileSpreadsheet, Plus, AlertCircle } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useAuth } from '@/contexts/AuthContext'
import { collection, getDocs, addDoc } from 'firebase/firestore'
import { createUserWithEmailAndPassword } from 'firebase/auth'
import { auth, db } from '@/lib/firebase'
import { isHardcodedAdmin } from '@/lib/hardcoded-admin'
import { toast } from '@/hooks/use-toast'
import Papa from 'papaparse'

interface UserData {
  id: string
  firstName: string
  lastName: string
  email: string
  role: string
  isActive: boolean
  createdAt?: any
  createdBy?: string
}

interface CsvUser {
  'First Name': string
  'Last Name': string
  'Email': string
  'Role': string
  'Password': string
}

export default function UserManagement() {
  const { currentUser, userProfile } = useAuth()
  const [users, setUsers] = useState<UserData[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddDialog, setShowAddDialog] = useState(false)
  
  // Individual Add User Form - Separate First and Last Name
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('participant')
  const [password, setPassword] = useState('')
  const [addingUser, setAddingUser] = useState(false)
  
  // Bulk Upload States
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [totalRecords, setTotalRecords] = useState<number>(0)
  const [uploadingBulk, setUploadingBulk] = useState(false)
  const [uploadResults, setUploadResults] = useState<{
    success: number
    failed: number
    errors: string[]
  } | null>(null)

  const isAdmin = userProfile?.role === 'admin' || isHardcodedAdmin(currentUser?.email)

  useEffect(() => {
    if (isAdmin) loadUsers()
  }, [isAdmin])

  const loadUsers = async () => {
    try {
      const usersSnapshot = await getDocs(collection(db, 'users'))
      const usersList = usersSnapshot.docs.map(doc => {
        const data = doc.data()
        return {
          id: doc.id,
          firstName: data.firstName || data.displayName?.split(' ')[0] || '',
          lastName: data.lastName || data.displayName?.split(' ').slice(1).join(' ') || '',
          email: data.email || '',
          role: data.role || 'participant',
          isActive: data.isActive ?? true,
          createdAt: data.createdAt,
          createdBy: data.createdBy
        }
      }).filter(user => {
        // Comprehensive admin exclusion: exclude any user with admin role or hardcoded admin email
        const isAdminRole = user.role === 'admin' || user.role === 'super-admin'
        const isHardcodedAdminEmail = isHardcodedAdmin(user.email)
        const isSystemAdmin = user.email?.toLowerCase().includes('admin@cobypicks.com')
        
        return !isAdminRole && !isHardcodedAdminEmail && !isSystemAdmin
      })
      setUsers(usersList)
    } catch (error) {
      toast({ title: "Error", description: "Failed to load users", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const handleAddUser = async () => {
    if (!firstName.trim() || !lastName.trim() || !email.trim() || !password.trim()) {
      toast({ title: "Error", description: "Please fill all fields", variant: "destructive" })
      return
    }

    setAddingUser(true)
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password)
      
      await addDoc(collection(db, 'users'), {
        uid: userCredential.user.uid,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        displayName: `${firstName.trim()} ${lastName.trim()}`,
        email: email.trim(),
        role: role,
        isActive: true,
        createdAt: new Date(),
        createdBy: currentUser?.email
      })

      toast({ title: "Success", description: `${firstName} ${lastName} added successfully` })
      setFirstName(''); setLastName(''); setEmail(''); setPassword('')
      setShowAddDialog(false)
      await loadUsers()
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    } finally {
      setAddingUser(false)
    }
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
      toast({ title: "Error", description: "Please select a CSV file", variant: "destructive" })
      return
    }

    setSelectedFile(file)
    
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const data = results.data as CsvUser[]
        setTotalRecords(data.length) // Just count the records
      },
      error: (error) => {
        toast({ title: "Error", description: `Failed to parse CSV: ${error.message}`, variant: "destructive" })
      }
    })
  }

  const handleBulkUpload = async () => {
    if (!selectedFile) {
      toast({ title: "Error", description: "Please select a CSV file", variant: "destructive" })
      return
    }

    setUploadingBulk(true)
    setUploadResults(null)
    
    try {
      Papa.parse(selectedFile, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
          const data = results.data as CsvUser[]
          let successCount = 0
          let failedCount = 0
          const errors: string[] = []

          for (const row of data) {
            try {
              const firstName = row['First Name']?.trim()
              const lastName = row['Last Name']?.trim()
              const email = row['Email']?.trim().toLowerCase()
              const role = row['Role']?.trim().toLowerCase() || 'participant'
              const password = row['Password']?.trim()

              if (!firstName || !lastName || !email || !password) {
                errors.push(`Row with email ${email || 'unknown'}: Missing required fields`)
                failedCount++
                continue
              }

              if (!['participant', 'organizer'].includes(role)) {
                errors.push(`${email}: Invalid role '${role}'. Must be 'participant' or 'organizer'`)
                failedCount++
                continue
              }

              const userCredential = await createUserWithEmailAndPassword(auth, email, password)
              
              await addDoc(collection(db, 'users'), {
                uid: userCredential.user.uid,
                firstName,
                lastName,
                displayName: `${firstName} ${lastName}`,
                email,
                role,
                isActive: true,
                createdAt: new Date(),
                createdBy: currentUser?.email,
                importedAt: new Date()
              })

              successCount++
            } catch (error: any) {
              failedCount++
              const email = row['Email'] || 'unknown'
              if (error.code === 'auth/email-already-in-use') {
                errors.push(`${email}: Email already exists`)
              } else {
                errors.push(`${email}: ${error.message}`)
              }
            }
          }

          setUploadResults({ success: successCount, failed: failedCount, errors })
          
          if (successCount > 0) {
            await loadUsers()
            toast({ 
              title: "Bulk Upload Complete", 
              description: `${successCount} users added successfully${failedCount > 0 ? `, ${failedCount} failed` : ''}` 
            })
          }
        },
        error: (error) => {
          toast({ title: "Error", description: `Failed to process CSV: ${error.message}`, variant: "destructive" })
        }
      })
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    } finally {
      setUploadingBulk(false)
    }
  }

  const clearUpload = () => {
    setSelectedFile(null)
    setTotalRecords(0)
    setUploadResults(null)
  }

  const downloadTemplate = () => {
    const csvContent = 'First Name,Last Name,Email,Role,Password'
    
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'coby_picks_user_template.csv'
    link.click()
    URL.revokeObjectURL(url)
    toast({ title: "Success", description: "Template downloaded successfully" })
  }

  if (!isAdmin) return <div className="p-8">Access denied</div>

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Users className="h-8 w-8" />
              User Management Dashboard
            </h1>
            <p className="text-gray-600 mt-2">Manage participant and organizer accounts. Admin users are automatically excluded from this view.</p>
          </div>
          <div className="text-right">
            <Badge variant="outline" className="text-sm mb-2 block">
              {users.length} total users
            </Badge>
            <Badge variant="secondary" className="text-xs">
              Admin users excluded
            </Badge>
          </div>
        </div>

        {/* Unified Add User Section */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <UserPlus className="h-5 w-5 text-green-600" />
            <h2 className="text-xl font-semibold text-gray-900">Add Users</h2>
          </div>
          <p className="text-gray-600 mb-6">Add individual users manually or upload multiple users at once using a CSV file.</p>
        </div>
        <Card className="shadow-lg border-2 border-green-100 hover:border-green-200 transition-colors mb-8">
          <CardHeader className="bg-gradient-to-r from-green-50 via-green-50 to-emerald-50 border-b border-green-200">
            <CardTitle className="flex items-center justify-between text-green-800">
              <div className="flex items-center gap-2">
                <UserPlus className="h-5 w-5" />
                Add Users - Individual & Bulk Entry
              </div>
              <Badge variant="outline" className="text-xs text-green-700 border-green-700">
                Manual & File Upload
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              
              {/* Left Side: Individual User Addition */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                    <span className="text-green-600 font-semibold text-sm">1</span>
                  </div>
                  <h3 className="font-semibold text-gray-900">Add Individual User</h3>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-900">First Name *</Label>
                    <Input 
                      placeholder="Enter first name"
                      value={firstName} 
                      onChange={(e) => setFirstName(e.target.value)} 
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-900">Last Name *</Label>
                    <Input 
                      placeholder="Enter last name"
                      value={lastName} 
                      onChange={(e) => setLastName(e.target.value)} 
                      className="mt-1"
                    />
                  </div>
                </div>
                
                <div>
                  <Label className="text-sm font-medium text-gray-900">Email Address *</Label>
                  <Input 
                    type="email" 
                    placeholder="user@example.com"
                    value={email} 
                    onChange={(e) => setEmail(e.target.value)} 
                    className="mt-1"
                  />
                </div>
                
                <div>
                  <Label className="text-sm font-medium text-gray-900">Role</Label>
                  <Select value={role} onValueChange={setRole}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="participant">Participant</SelectItem>
                      <SelectItem value="organizer">Organizer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label className="text-sm font-medium text-gray-900">Password *</Label>
                  <Input 
                    type="password" 
                    placeholder="Enter secure password"
                    value={password} 
                    onChange={(e) => setPassword(e.target.value)} 
                    className="mt-1"
                  />
                </div>
                
                <Button 
                  onClick={handleAddUser} 
                  disabled={addingUser || !firstName || !lastName || !email || !password} 
                  className="w-full bg-green-600 hover:bg-green-700"
                >
                  {addingUser ? (
                    <><div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2" />Adding...</>
                  ) : (
                    <><Plus className="h-4 w-4 mr-2" />Add User</>
                  )}
                </Button>
              </div>
              
              {/* Right Side: Bulk Upload */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                    <span className="text-blue-600 font-semibold text-sm">2</span>
                  </div>
                  <h3 className="font-semibold text-gray-900">Bulk Upload from CSV</h3>
                </div>
                
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <Label className="text-sm font-medium text-gray-900">CSV File Upload</Label>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={downloadTemplate}
                      className="text-blue-600 border-blue-600 hover:bg-blue-50 hover:border-blue-700"
                    >
                      <Download className="h-3 w-3 mr-1" />Download Template
                    </Button>
                  </div>
                  
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
                    <p className="text-xs text-blue-800 font-medium mb-1">Required CSV Columns:</p>
                    <p className="text-xs text-blue-700">First Name, Last Name, Email, Role (participant/organizer), Password</p>
                  </div>
                  
                  <Input 
                    type="file" 
                    accept=".csv" 
                    onChange={handleFileSelect}
                    className="mt-1"
                  />
                </div>

                {selectedFile && (
                  <Alert className="border-blue-200 bg-blue-50">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>File selected:</strong> {selectedFile.name} ({selectedFile.size} bytes)
                      <br />
                      <strong>Records found:</strong> {totalRecords} users to be processed
                    </AlertDescription>
                  </Alert>
                )}

                <div className="flex gap-2">
                  <Button 
                    onClick={handleBulkUpload} 
                    disabled={!selectedFile || uploadingBulk} 
                    className="flex-1 bg-blue-600 hover:bg-blue-700"
                  >
                    {uploadingBulk ? (
                      <><div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2" />Uploading...</>
                    ) : (
                      <><Upload className="h-4 w-4 mr-2" />Upload Users</>
                    )}
                  </Button>
                  {selectedFile && (
                    <Button variant="outline" onClick={clearUpload}>
                      Clear
                    </Button>
                  )}
                </div>

                {uploadResults && (
                  <Alert className={uploadResults.failed > 0 ? "border-orange-200 bg-orange-50" : "border-green-200 bg-green-50"}>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      <div className="space-y-1">
                        <p><strong>Upload Results:</strong></p>
                        <p>✅ Success: {uploadResults.success} users</p>
                        {uploadResults.failed > 0 && (
                          <>
                            <p>❌ Failed: {uploadResults.failed} users</p>
                            {uploadResults.errors.length > 0 && (
                              <div className="mt-2">
                                <p className="font-medium">Errors:</p>
                                <ul className="list-disc list-inside text-xs space-y-1">
                                  {uploadResults.errors.slice(0, 5).map((error, index) => (
                                    <li key={index}>{error}</li>
                                  ))}
                                  {uploadResults.errors.length > 5 && (
                                    <li>... and {uploadResults.errors.length - 5} more errors</li>
                                  )}
                                </ul>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Users Directory - Excel-like List View */}
        <Card className="shadow-lg">
          <CardHeader className="bg-gradient-to-r from-gray-50 to-slate-50 border-b">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-gray-700" />
                User Directory
              </CardTitle>
              <div className="flex items-center gap-4">
                <Badge variant="outline" className="text-sm">
                  {users.filter(u => u.role === 'participant').length} Participants
                </Badge>
                <Badge variant="outline" className="text-sm">
                  {users.filter(u => u.role === 'organizer').length} Organizers
                </Badge>
                <Badge variant="secondary" className="text-sm">
                  {users.length} Total Users
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mr-3" />
                <span className="text-lg">Loading users...</span>
              </div>
            ) : users.length === 0 ? (
              <div className="text-center py-12">
                <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 mb-2">No users found</p>
                <p className="text-sm text-gray-500">Add individual users or upload a CSV file to get started</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Table-like view for better organization */}
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                  {users.map((user) => (
                    <Card key={user.id} className="border hover:shadow-md transition-all duration-200 hover:border-blue-300">
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 via-purple-500 to-indigo-600 text-white flex items-center justify-center font-semibold text-sm shadow-md">
                            {user.firstName.charAt(0).toUpperCase()}{user.lastName.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between">
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-gray-900 truncate">{user.firstName} {user.lastName}</p>
                                <p className="text-sm text-gray-600 truncate">{user.email}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 mt-2">
                              <Badge 
                                variant={user.role === 'organizer' ? 'default' : 'secondary'} 
                                className={`text-xs ${
                                  user.role === 'organizer' 
                                    ? 'bg-purple-100 text-purple-800 border-purple-200' 
                                    : 'bg-blue-100 text-blue-800 border-blue-200'
                                }`}
                              >
                                {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                              </Badge>
                              <Badge 
                                variant="outline" 
                                className={`text-xs ${
                                  user.isActive 
                                    ? 'text-green-700 border-green-300 bg-green-50' 
                                    : 'text-red-700 border-red-300 bg-red-50'
                                }`}
                              >
                                {user.isActive ? 'Active' : 'Inactive'}
                              </Badge>
                            </div>
                            {user.createdBy && (
                              <p className="text-xs text-gray-500 mt-1 truncate">
                                Added by: {user.createdBy}
                              </p>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                
                {/* Summary Statistics */}
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-200">
                  <h3 className="font-medium text-gray-900 mb-2">Directory Summary</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div className="text-center">
                      <div className="font-semibold text-blue-600">{users.length}</div>
                      <div className="text-gray-600">Total Users</div>
                    </div>
                    <div className="text-center">
                      <div className="font-semibold text-purple-600">{users.filter(u => u.role === 'organizer').length}</div>
                      <div className="text-gray-600">Organizers</div>
                    </div>
                    <div className="text-center">
                      <div className="font-semibold text-green-600">{users.filter(u => u.role === 'participant').length}</div>
                      <div className="text-gray-600">Participants</div>
                    </div>
                    <div className="text-center">
                      <div className="font-semibold text-emerald-600">{users.filter(u => u.isActive).length}</div>
                      <div className="text-gray-600">Active</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}