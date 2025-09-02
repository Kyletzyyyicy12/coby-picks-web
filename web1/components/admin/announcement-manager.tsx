"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { toast } from "@/hooks/use-toast"
import { db } from "@/lib/firebase"
import {
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  where
} from "firebase/firestore"
import { Plus, Edit, Trash2, Send, Users, Clock, AlertCircle, CheckCircle, Eye } from "lucide-react"
import type { User as FirebaseUser } from "firebase/auth"

interface Announcement {
  id: string
  title: string
  message: string
  targetRoles: string[] // ["teacher", "organizer", "student"]
  isActive: boolean
  createdBy: string
  createdByName: string
  createdAt: Date
  updatedAt: Date
  readBy: Array<{
    userId: string
    userName: string
    readAt: Date
  }>
  deliveredTo: number // Count of users who received the announcement
}

interface AnnouncementManagerProps {
  user: FirebaseUser
}

export function AnnouncementManager({ user }: AnnouncementManagerProps) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null)
  const [newAnnouncement, setNewAnnouncement] = useState({
    title: "",
    message: "",
    targetRoles: ["teacher", "organizer", "student"] as string[],
    isActive: true
  })
  const [saving, setSaving] = useState(false)
  const [userStats, setUserStats] = useState({
    totalUsers: 0,
    teachers: 0,
    organizers: 0,
    students: 0,
    admins: 0
  })

  const fetchAnnouncements = useCallback(async () => {
    try {
      const q = query(collection(db, "announcements"))
      
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const fetchedAnnouncements = snapshot.docs.map(doc => {
          const data = doc.data()
          return {
            id: doc.id,
            title: data.title || '',
            message: data.message || '',
            targetRoles: data.targetRoles || [],
            isActive: data.isActive !== undefined ? data.isActive : true,
            createdBy: data.createdBy || '',
            createdByName: data.createdByName || '',
            createdAt: data.createdAt?.toDate() || new Date(),
            updatedAt: data.updatedAt?.toDate() || new Date(),
            readBy: data.readBy?.map((item: any) => ({
              ...item,
              readAt: item.readAt?.toDate() || new Date()
            })) || [],
            deliveredTo: data.deliveredTo || 0
          } as Announcement
        })

        // Sort by creation date (newest first) - client-side sorting
        fetchedAnnouncements.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())

        setAnnouncements(fetchedAnnouncements)
        setLoading(false)
      })

      return unsubscribe
    } catch (error) {
      console.error("Error fetching announcements:", error)
      toast({
        title: "Error",
        description: "Failed to load announcements",
        variant: "destructive"
      })
      setLoading(false)
    }
  }, [])

  const fetchUserStats = useCallback(async () => {
    try {
      const usersSnapshot = await getDocs(collection(db, "users"))
      const users = usersSnapshot.docs.map(doc => doc.data())
      
      const stats = {
        totalUsers: users.length,
        teachers: users.filter(u => u.role === "teacher").length,
        organizers: users.filter(u => u.role === "organizer").length,
        students: users.filter(u => u.role === "student").length,
        admins: users.filter(u => u.role === "admin").length
      }
      
      setUserStats(stats)
    } catch (error) {
      console.error("Error fetching user stats:", error)
    }
  }, [])

  useEffect(() => {
    const unsubscribe = fetchAnnouncements()
    fetchUserStats()
    
    return () => {
      if (unsubscribe) {
        unsubscribe.then(unsub => unsub && unsub())
      }
    }
  }, [fetchAnnouncements, fetchUserStats])

  const handleCreateAnnouncement = async () => {
    if (!newAnnouncement.title || !newAnnouncement.message) {
      toast({
        title: "Missing Information",
        description: "Please fill in title and message",
        variant: "destructive"
      })
      return
    }

    setSaving(true)
    try {
      const announcementData = {
        title: newAnnouncement.title,
        message: newAnnouncement.message,
        targetRoles: newAnnouncement.targetRoles,
        isActive: newAnnouncement.isActive,
        createdBy: user.uid,
        createdByName: user.displayName || user.email || "Admin",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        readBy: [],
        deliveredTo: 0
      }

      await addDoc(collection(db, "announcements"), announcementData)

      toast({
        title: "Announcement Created",
        description: `"${newAnnouncement.title}" has been sent to ${newAnnouncement.targetRoles.join(", ")} users`,
      })

      // Reset form
      setNewAnnouncement({
        title: "",
        message: "",
        targetRoles: ["teacher", "organizer", "student"],
        isActive: true
      })
      setIsCreateDialogOpen(false)
    } catch (error: any) {
      toast({
        title: "Error Creating Announcement",
        description: error.message,
        variant: "destructive"
      })
    } finally {
      setSaving(false)
    }
  }

  const handleUpdateAnnouncement = async () => {
    if (!editingAnnouncement) return

    setSaving(true)
    try {
      const announcementRef = doc(db, "announcements", editingAnnouncement.id)
      await updateDoc(announcementRef, {
        title: editingAnnouncement.title,
        message: editingAnnouncement.message,
        targetRoles: editingAnnouncement.targetRoles,
        isActive: editingAnnouncement.isActive,
        updatedAt: serverTimestamp()
      })

      toast({
        title: "Announcement Updated",
        description: `"${editingAnnouncement.title}" has been updated`,
      })

      setIsEditDialogOpen(false)
      setEditingAnnouncement(null)
    } catch (error: any) {
      toast({
        title: "Error Updating Announcement",
        description: error.message,
        variant: "destructive"
      })
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteAnnouncement = async (announcementId: string, title: string) => {
    if (!confirm(`Are you sure you want to delete "${title}"? This action cannot be undone.`)) {
      return
    }

    try {
      await deleteDoc(doc(db, "announcements", announcementId))
      toast({
        title: "Announcement Deleted",
        description: `"${title}" has been deleted`,
      })
    } catch (error: any) {
      toast({
        title: "Error Deleting Announcement",
        description: error.message,
        variant: "destructive"
      })
    }
  }


  const getTargetUserCount = (targetRoles: string[]) => {
    return targetRoles.reduce((count, role) => {
      switch (role) {
        case "teacher": return count + userStats.teachers
        case "organizer": return count + userStats.organizers
        case "student": return count + userStats.students
        default: return count
      }
    }, 0)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-swu-red">📢 Announcement Manager</h2>
          <p className="text-muted-foreground">
            Send real-time announcements to users across the platform
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-swu-red hover:bg-swu-red/90 text-white">
              <Plus className="h-4 w-4 mr-2" />
              Create Announcement
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Create New Announcement</DialogTitle>
              <DialogDescription>
                Send a real-time announcement to users. They will see it immediately when they log in.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="announcement-title">Title</Label>
                <Input
                  id="announcement-title"
                  value={newAnnouncement.title}
                  onChange={(e) => setNewAnnouncement({ ...newAnnouncement, title: e.target.value })}
                  placeholder="e.g., System Maintenance Notice"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="announcement-message">Message</Label>
                <Textarea
                  id="announcement-message"
                  value={newAnnouncement.message}
                  onChange={(e) => setNewAnnouncement({ ...newAnnouncement, message: e.target.value })}
                  placeholder="Enter your announcement message here..."
                  rows={4}
                />
              </div>
              <div className="grid gap-2">
                <Label>Target Roles</Label>
                <div className="flex flex-wrap gap-2">
                  {["teacher", "organizer", "student"].map((role) => (
                    <div key={role} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id={`role-${role}`}
                        checked={newAnnouncement.targetRoles.includes(role)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setNewAnnouncement({
                              ...newAnnouncement,
                              targetRoles: [...newAnnouncement.targetRoles, role]
                            })
                          } else {
                            setNewAnnouncement({
                              ...newAnnouncement,
                              targetRoles: newAnnouncement.targetRoles.filter(r => r !== role)
                            })
                          }
                        }}
                      />
                      <Label htmlFor={`role-${role}`} className="capitalize">
                        {role} ({role === "teacher" ? userStats.teachers : 
                              role === "organizer" ? userStats.organizers :
                              role === "student" ? userStats.students : 0})
                      </Label>
                    </div>
                  ))}
                </div>
                <p className="text-sm text-muted-foreground">
                  Will be sent to {getTargetUserCount(newAnnouncement.targetRoles)} users
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="is-active"
                  checked={newAnnouncement.isActive}
                  onCheckedChange={(checked) => setNewAnnouncement({ ...newAnnouncement, isActive: checked })}
                />
                <Label htmlFor="is-active">Active (users will see this announcement)</Label>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleCreateAnnouncement} disabled={saving}>
                <Send className="h-4 w-4 mr-2" />
                {saving ? "Sending..." : "Send Announcement"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* User Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{userStats.totalUsers}</div>
            <div className="text-sm text-muted-foreground">Total Users</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-green-600">{userStats.teachers}</div>
            <div className="text-sm text-muted-foreground">Teachers</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-purple-600">{userStats.organizers}</div>
            <div className="text-sm text-muted-foreground">Organizers</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-orange-600">{userStats.students}</div>
            <div className="text-sm text-muted-foreground">Students</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-red-600">{userStats.admins}</div>
            <div className="text-sm text-muted-foreground">Admins</div>
          </CardContent>
        </Card>
      </div>

      {/* Announcements Table */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="text-muted-foreground">Loading announcements...</div>
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Recent Announcements</CardTitle>
            <CardDescription>
              Manage and track your announcements
            </CardDescription>
          </CardHeader>
          <CardContent>
            {announcements.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No announcements created yet
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Target Roles</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Read By</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {announcements.map((announcement) => (
                    <TableRow key={announcement.id}>
                      <TableCell className="font-medium">{announcement.title}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {announcement.targetRoles.map(role => (
                            <Badge key={role} variant="outline" className="text-xs">
                              {role}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        {announcement.isActive ? (
                          <Badge className="bg-green-100 text-green-800">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Active
                          </Badge>
                        ) : (
                          <Badge className="bg-gray-100 text-gray-800">
                            Inactive
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Eye className="h-4 w-4" />
                          <span>{announcement.readBy.length}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {announcement.createdAt.toLocaleDateString()}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingAnnouncement(announcement)
                              setIsEditDialogOpen(true)
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDeleteAnnouncement(announcement.id, announcement.title)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Edit Announcement</DialogTitle>
            <DialogDescription>
              Update the announcement details
            </DialogDescription>
          </DialogHeader>
          {editingAnnouncement && (
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-title">Title</Label>
                <Input
                  id="edit-title"
                  value={editingAnnouncement.title}
                  onChange={(e) => setEditingAnnouncement({ ...editingAnnouncement, title: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-message">Message</Label>
                <Textarea
                  id="edit-message"
                  value={editingAnnouncement.message}
                  onChange={(e) => setEditingAnnouncement({ ...editingAnnouncement, message: e.target.value })}
                  rows={4}
                />
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="edit-is-active"
                  checked={editingAnnouncement.isActive}
                  onCheckedChange={(checked) => setEditingAnnouncement({ ...editingAnnouncement, isActive: checked })}
                />
                <Label htmlFor="edit-is-active">Active</Label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={handleUpdateAnnouncement} disabled={saving}>
              {saving ? "Updating..." : "Update Announcement"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
