"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { toast } from "@/hooks/use-toast"
import { db } from "@/lib/firebase"
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
  arrayUnion,
  serverTimestamp,
  orderBy
} from "firebase/firestore"
import { 
  Bell, 
  X, 
  AlertCircle, 
  Info, 
  CheckCircle, 
  AlertTriangle,
  Clock,
  Eye,
  Target,
  Settings
} from "lucide-react"
import type { User as FirebaseUser } from "firebase/auth"

interface Announcement {
  id: string
  title: string
  message: string
  type?: "info" | "warning" | "success" | "urgent"  // Optional for backward compatibility
  targetRoles: string[]
  isActive: boolean
  priority?: "low" | "medium" | "high" | "urgent"  // Optional for backward compatibility
  expiresAt?: Date
  createdBy: string
  createdByName: string
  createdAt: Date
  updatedAt: Date
  readBy: Array<{
    userId: string
    userName: string
    readAt: Date
  }>
  // New fields for system notifications
  wheelTypeId?: string
  isSystemNotification?: boolean
}

interface AnnouncementDisplayProps {
  user: FirebaseUser
  userRole: string
}

export function AnnouncementDisplay({ user, userRole }: AnnouncementDisplayProps) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [allFetchedAnnouncements, setAllFetchedAnnouncements] = useState<{
    announcements?: Announcement[],
    systemNotifications?: Announcement[]
  }>({})
  const [unreadCount, setUnreadCount] = useState(0)
  const [showModal, setShowModal] = useState(false)
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null)
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [hasNewAnnouncements, setHasNewAnnouncements] = useState(false)

  const fetchAnnouncements = useCallback(async () => {
    try {
      // Listen to both announcements and systemNotifications
      const announcementsQuery = query(
        collection(db, "announcements"),
        where("isActive", "==", true)
      )
      
      const systemNotificationsQuery = query(
        collection(db, "systemNotifications"),
        where("isActive", "==", true)
      )
      
      const unsubscribe1 = onSnapshot(announcementsQuery, (snapshot) => {
        processAnnouncements(snapshot, 'announcements')
      })
      
      const unsubscribe2 = onSnapshot(systemNotificationsQuery, (snapshot) => {
        processAnnouncements(snapshot, 'systemNotifications')
      })
      
      // Return combined unsubscribe function
      return () => {
        unsubscribe1()
        unsubscribe2()
      }
    } catch (error) {
      console.error("Error setting up announcement listeners:", error)
    }
  }, [user.uid, userRole, announcements.length])

  const processAnnouncements = (snapshot: any, source: 'announcements' | 'systemNotifications') => {
    const fetchedItems = snapshot.docs.map((doc: any) => {
      const data = doc.data()
      
      if (source === 'systemNotifications') {
        // Transform systemNotifications to announcement format
        return {
          id: doc.id,
          title: data.wheelTypeLabel ? `🎯 New Wheel Type: ${data.wheelTypeLabel}` : data.title || 'System Notification',
          message: data.message || '',
          type: data.type === 'wheelTypeAdded' ? 'info' : (data.type || 'info'),
          targetRoles: data.targetRoles || ['organizer', 'participant'],
          isActive: data.isActive !== false,
          priority: data.priority || 'medium',
          expiresAt: data.expiresAt?.toDate(),
          createdBy: 'system',
          createdByName: 'CobyPicks System',
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
          readBy: data.readBy?.map((item: any) => ({
            ...item,
            readAt: item.readAt?.toDate() || new Date()
          })) || [],
          wheelTypeId: data.wheelTypeId,
          isSystemNotification: true
        }
      } else {
        // Regular announcements
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
          expiresAt: data.expiresAt?.toDate(),
          readBy: data.readBy?.map((item: any) => ({
            ...item,
            readAt: item.readAt?.toDate() || new Date()
          })) || [],
          isSystemNotification: false
        }
      }
    })

    // Store all fetched items and process them
    setAllFetchedAnnouncements(prev => {
      const updated = { ...prev, [source]: fetchedItems }
      const combined = [...(updated.announcements || []), ...(updated.systemNotifications || [])]
      
      // Sort by creation date (newest first)
      combined.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())

      // Filter for user role and expired announcements - include system notifications
      const userAnnouncements = combined.filter(announcement => {
        const roleMatch = announcement.targetRoles.includes(userRole) || 
                         (announcement.isSystemNotification && 
                          (userRole === 'organizer' || userRole === 'participant'))
        return roleMatch && userRole !== 'admin'
      })

      const activeAnnouncements = userAnnouncements.filter(announcement => {
        if (!announcement.expiresAt) return true
        return announcement.expiresAt > new Date()
      })
      
      // Check for new announcements
      const previousIds = announcements.map(a => a.id)
      const newAnnouncementIds = activeAnnouncements
        .filter(a => !previousIds.includes(a.id))
        .map(a => a.id)
      
      if (newAnnouncementIds.length > 0 && announcements.length > 0) {
        setHasNewAnnouncements(true)
        // Show toast for urgent announcements and wheel type additions
        const urgentNew = activeAnnouncements.filter(a => 
          newAnnouncementIds.includes(a.id) && 
          ((a.priority === "urgent" || a.type === "urgent") || a.isSystemNotification)
        )
        
        urgentNew.forEach(announcement => {
          if (announcement.isSystemNotification) {
            toast({
              title: "🎯 New Wheel Type Available!",
              description: announcement.title,
              duration: 8000,
            })
          } else {
            toast({
              title: "🚨 Urgent Announcement",
              description: announcement.title,
              duration: 10000,
            })
          }
        })
      }
      
      setAnnouncements(activeAnnouncements)
      
      // Calculate unread count
      const unread = activeAnnouncements.filter(announcement => 
        !announcement.readBy.some(reader => reader.userId === user.uid)
      )
      setUnreadCount(unread.length)
      
      // Auto-show modal for unread announcements on first load (prefer urgent; otherwise first unread)
      if (announcements.length === 0 && unread.length > 0) {
        const urgentUnread = unread.filter(a => a.priority === "urgent" || a.type === "urgent" || a.isSystemNotification)
        const firstToShow = urgentUnread[0] || unread[0]
        setSelectedAnnouncement(firstToShow)
        setShowModal(true)
      }
      
      return updated
    })
  }

  useEffect(() => {
    const unsubscribe = fetchAnnouncements()
    
    return () => {
      if (unsubscribe) {
        unsubscribe.then(unsub => unsub && unsub())
      }
    }
  }, [fetchAnnouncements])

  const markAsRead = async (announcement: Announcement) => {
    try {
      const isAlreadyRead = announcement.readBy.some(reader => reader.userId === user.uid)
      if (isAlreadyRead) return

      const collectionName = announcement.isSystemNotification ? "systemNotifications" : "announcements"
      const announcementRef = doc(db, collectionName, announcement.id)
      await updateDoc(announcementRef, {
        readBy: arrayUnion({
          userId: user.uid,
          userName: user.displayName || user.email || "Unknown",
          readAt: serverTimestamp()
        })
      })
    } catch (error) {
      console.error("Error marking announcement as read:", error)
    }
  }

  const handleAnnouncementClick = (announcement: Announcement) => {
    setSelectedAnnouncement(announcement)
    setShowModal(true)
    markAsRead(announcement)
  }

  const handleModalClose = (open: boolean) => {
    if (!open && selectedAnnouncement) {
      // Mark as read when modal is closed
      markAsRead(selectedAnnouncement)
    }
    setShowModal(open)
  }

  const getTypeIcon = (announcement: Announcement) => {
    // Special handling for system notifications
    if (announcement.isSystemNotification) {
      if (announcement.wheelTypeId) {
        return <Target className="h-4 w-4" />  // Wheel type notification
      }
      return <Settings className="h-4 w-4" />  // Other system notifications
    }
    
    // Regular announcement icons
    switch (announcement.type) {
      case "info": return <Info className="h-4 w-4" />
      case "warning": return <AlertTriangle className="h-4 w-4" />
      case "success": return <CheckCircle className="h-4 w-4" />
      case "urgent": return <AlertCircle className="h-4 w-4" />
      default: return <Info className="h-4 w-4" />
    }
  }

  const getTypeColor = (announcement: Announcement) => {
    // Special styling for system notifications
    if (announcement.isSystemNotification) {
      return "bg-purple-100 text-purple-800 border-purple-200"  // Purple for system notifications
    }
    
    // Regular announcement colors
    switch (announcement.type) {
      case "info": return "bg-blue-100 text-blue-800 border-blue-200"
      case "warning": return "bg-yellow-100 text-yellow-800 border-yellow-200"
      case "success": return "bg-green-100 text-green-800 border-green-200"
      case "urgent": return "bg-red-100 text-red-800 border-red-200"
      default: return "bg-gray-100 text-gray-800 border-gray-200"
    }
  }

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case "low": return "bg-gray-100 text-gray-800"
      case "medium": return "bg-blue-100 text-blue-800"
      case "high": return "bg-orange-100 text-orange-800"
      case "urgent": return "bg-red-100 text-red-800"
      default: return "bg-gray-100 text-gray-800"
    }
  }

  const isUnread = (announcement: Announcement) => {
    return !announcement.readBy.some(reader => reader.userId === user.uid)
  }

  if (announcements.length === 0) {
    return null
  }

  return (
    <>
      {/* Notification Bell */}
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetTrigger asChild>
          <Button 
            variant="outline" 
            size="sm" 
            className="relative"
            onClick={() => setHasNewAnnouncements(false)}
          >
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <Badge 
                className="absolute -top-2 -right-2 h-5 w-5 rounded-full p-0 flex items-center justify-center bg-red-500 text-white text-xs"
              >
                {unreadCount > 9 ? "9+" : unreadCount}
              </Badge>
            )}
            {hasNewAnnouncements && (
              <div className="absolute -top-1 -right-1 h-3 w-3 bg-red-500 rounded-full animate-pulse" />
            )}
          </Button>
        </SheetTrigger>
        <SheetContent className="w-[400px] sm:w-[540px]">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Announcements
              {unreadCount > 0 && (
                <Badge className="bg-red-500 text-white">
                  {unreadCount} new
                </Badge>
              )}
            </SheetTitle>
            <SheetDescription>
              Latest announcements and updates
            </SheetDescription>
          </SheetHeader>
          
          <div className="mt-6 space-y-4 max-h-[calc(100vh-200px)] overflow-y-auto">
            {announcements.map((announcement) => (
              <Card 
                key={announcement.id} 
                className={`cursor-pointer transition-all hover:shadow-md ${
                  isUnread(announcement) ? 'ring-2 ring-blue-200 bg-blue-50/50' : ''
                }`}
                onClick={() => handleAnnouncementClick(announcement)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`p-1 rounded ${getTypeColor(announcement)}`}>
                        {getTypeIcon(announcement)}
                      </div>
                      <CardTitle className="text-sm">{announcement.title}</CardTitle>
                    </div>
                    <div className="flex items-center gap-1">
                      {isUnread(announcement) && (
                        <div className="h-2 w-2 bg-blue-500 rounded-full" />
                      )}
                      {announcement.priority && (
                        <Badge className={getPriorityColor(announcement.priority)} variant="outline">
                          {announcement.priority}
                        </Badge>
                      )}
                      {announcement.isSystemNotification && (
                        <Badge variant="secondary" className="text-xs">
                          🔧 System
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {announcement.message}
                  </p>
                  <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                    <span>By {announcement.createdByName}</span>
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      <span>{announcement.createdAt.toLocaleDateString()}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </SheetContent>
      </Sheet>

      {/* Announcement Detail Modal */}
      <Dialog open={showModal} onOpenChange={handleModalClose}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <div className="flex items-center gap-2">
              {selectedAnnouncement && (
                <>
                  <div className={`p-2 rounded ${getTypeColor(selectedAnnouncement)}`}>
                    {getTypeIcon(selectedAnnouncement)}
                  </div>
                  <div>
                    <DialogTitle>{selectedAnnouncement.title}</DialogTitle>
                    <DialogDescription>
                      From {selectedAnnouncement.createdByName} • {selectedAnnouncement.createdAt.toLocaleString()}
                    </DialogDescription>
                  </div>
                </>
              )}
            </div>
          </DialogHeader>
          
          {selectedAnnouncement && (
            <div className="space-y-4">
              <div className="flex gap-2">
                <Badge className={getTypeColor(selectedAnnouncement)} variant="outline">
                  {selectedAnnouncement.isSystemNotification ? 'System' : selectedAnnouncement.type}
                </Badge>
                {selectedAnnouncement.priority && (
                  <Badge className={getPriorityColor(selectedAnnouncement.priority)} variant="outline">
                    {selectedAnnouncement.priority} priority
                  </Badge>
                )}
                {selectedAnnouncement.isSystemNotification && (
                  <Badge variant="secondary">
                    🔧 System Notification
                  </Badge>
                )}
              </div>
              
              <div className="prose prose-sm max-w-none">
                <p className="whitespace-pre-wrap">{selectedAnnouncement.message}</p>
                {selectedAnnouncement.isSystemNotification && selectedAnnouncement.wheelTypeId && (
                  <div className="mt-3 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                    <div className="flex items-center gap-2 text-purple-800">
                      <Target className="h-4 w-4" />
                      <span className="font-medium">New Wheel Type Available</span>
                    </div>
                    <p className="text-sm text-purple-700 mt-1">
                      Check your wheel galleries to see the new wheel type in action!
                    </p>
                  </div>
                )}
              </div>
              
              {selectedAnnouncement.expiresAt && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>Expires: {selectedAnnouncement.expiresAt.toLocaleString()}</span>
                </div>
              )}
              
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Eye className="h-4 w-4" />
                <span>Read by {selectedAnnouncement.readBy.length} users</span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
