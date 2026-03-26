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
  const [shownAnnouncementIds, setShownAnnouncementIds] = useState<Set<string>>(new Set())

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
                         announcement.targetRoles.includes('participant') ||
                         announcement.targetRoles.includes('student') ||
                         (announcement.isSystemNotification && 
                          (userRole === 'organizer' || userRole === 'participant' || userRole === 'student'))
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
      // Only show if not already shown before
      if (announcements.length === 0 && unread.length > 0) {
        const urgentUnread = unread.filter(a => 
          (a.priority === "urgent" || a.type === "urgent" || a.isSystemNotification) &&
          !shownAnnouncementIds.has(a.id)
        )
        const otherUnread = unread.filter(a => !shownAnnouncementIds.has(a.id))
        const firstToShow = urgentUnread[0] || otherUnread[0]
        
        if (firstToShow) {
          setSelectedAnnouncement(firstToShow)
          setShowModal(true)
          // Mark this announcement as shown
          setShownAnnouncementIds(prev => new Set([...prev, firstToShow.id]))
          // Immediately mark as read when auto-shown
          markAsRead(firstToShow)
        }
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
          readAt: new Date()
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

  const clearAllAnnouncements = async () => {
    try {
      // Mark all unread announcements as read
      const unreadAnnouncements = announcements.filter(a => isUnread(a))
      
      await Promise.all(
        unreadAnnouncements.map(announcement => markAsRead(announcement))
      )

      toast({
        title: "✅ All Cleared",
        description: `Marked ${unreadAnnouncements.length} announcement${unreadAnnouncements.length === 1 ? '' : 's'} as read`,
      })
    } catch (error) {
      console.error("Error clearing announcements:", error)
      toast({
        title: "Error",
        description: "Failed to clear announcements. Please try again.",
        variant: "destructive"
      })
    }
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
                className="absolute -top-2 -right-2 h-5 w-5 rounded-full p-0 flex items-center justify-center text-white text-xs"
                style={{ backgroundColor: '#8e0b16' }}
              >
                {unreadCount > 9 ? "9+" : unreadCount}
              </Badge>
            )}
            {hasNewAnnouncements && (
              <div className="absolute -top-1 -right-1 h-3 w-3 rounded-full animate-pulse" style={{ backgroundColor: '#8e0b16' }} />
            )}
          </Button>
        </SheetTrigger>
        <SheetContent className="w-[400px] sm:w-[540px]" style={{ backgroundColor: '#f8f9fa' }}>
          <SheetHeader className="border-b pb-4 -mx-6 px-6 -mt-6 pt-6" style={{ backgroundColor: '#8e0b16' }}>
            <SheetTitle className="flex items-center gap-3 text-lg">
              <div className="p-2 rounded-lg" style={{ backgroundColor: 'rgba(255, 255, 255, 0.15)' }}>
                <Bell className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-white">Announcements</span>
                  {unreadCount > 0 && (
                    <Badge className="text-xs px-2 py-0.5" style={{ backgroundColor: '#66181E', color: 'white' }}>
                      {unreadCount} New
                    </Badge>
                  )}
                </div>
              </div>
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    clearAllAnnouncements()
                  }}
                  className="text-white hover:bg-white/20 text-xs h-8 px-3"
                >
                  Clear All
                </Button>
              )}
            </SheetTitle>
            <SheetDescription className="text-sm text-white/95 mt-1">
              Official announcements and system notifications
            </SheetDescription>
          </SheetHeader>
          
          <div className="mt-6 space-y-3 max-h-[calc(100vh-200px)] overflow-y-auto pr-2">
            {announcements.map((announcement) => (
              <Card 
                key={announcement.id} 
                className={`cursor-pointer transition-all duration-200 border hover:border-gray-400 ${
                  isUnread(announcement) 
                    ? 'bg-white shadow-sm' 
                    : 'bg-white border-gray-200 hover:bg-gray-50'
                }`}
                style={isUnread(announcement) ? { borderColor: '#8e0b16', borderWidth: '2px' } : {}}
                onClick={() => handleAnnouncementClick(announcement)}
              >
                <CardHeader className="pb-3 pt-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className={`p-2 rounded-md flex-shrink-0 ${getTypeColor(announcement)}`}>
                        {getTypeIcon(announcement)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <CardTitle className="text-sm font-semibold text-gray-900 line-clamp-1">
                            {announcement.title}
                          </CardTitle>
                          {isUnread(announcement) && (
                            <div className="h-2 w-2 rounded-full flex-shrink-0" title="Unread" style={{ backgroundColor: '#8e0b16' }} />
                          )}
                        </div>
                        <p className="text-xs text-gray-600 line-clamp-2 leading-relaxed">
                          {announcement.message}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                      {announcement.priority && (
                        <Badge className={`${getPriorityColor(announcement.priority)} text-xs px-2 py-0.5`} variant="outline">
                          {announcement.priority.toUpperCase()}
                        </Badge>
                      )}
                      {announcement.isSystemNotification && (
                        <Badge variant="secondary" className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 border-purple-200">
                          System
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 pb-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500 flex items-center gap-1">
                      <span className="font-medium text-gray-700">From:</span>
                      {announcement.createdByName}
                    </span>
                    <div className="flex items-center gap-1.5 text-gray-500">
                      <Clock className="h-3 w-3" />
                      <span>{announcement.createdAt.toLocaleDateString('en-US', { 
                        month: 'short', 
                        day: 'numeric', 
                        year: 'numeric' 
                      })}</span>
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
        <DialogContent className="sm:max-w-[650px] max-h-[85vh] overflow-y-auto">
          <DialogHeader className="space-y-3 pb-4" style={{ borderBottom: '2px solid #8e0b16' }}>
            <div className="flex items-start gap-3">
              {selectedAnnouncement && (
                <>
                  <div className={`p-3 rounded-lg ${getTypeColor(selectedAnnouncement)}`}>
                    {getTypeIcon(selectedAnnouncement)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <DialogTitle className="text-xl font-semibold text-gray-900 mb-2">
                      {selectedAnnouncement.title}
                    </DialogTitle>
                    <DialogDescription className="text-sm text-gray-600">
                      <div className="flex flex-col gap-1">
                        <span className="flex items-center gap-1.5">
                          <span className="font-medium text-gray-700">From:</span>
                          {selectedAnnouncement.createdByName}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5" />
                          {selectedAnnouncement.createdAt.toLocaleString('en-US', {
                            dateStyle: 'full',
                            timeStyle: 'short'
                          })}
                        </span>
                      </div>
                    </DialogDescription>
                  </div>
                </>
              )}
            </div>
          </DialogHeader>
          
          {selectedAnnouncement && (
            <div className="space-y-5 pt-4">
              <div className="flex flex-wrap gap-2">
                <Badge className={`${getTypeColor(selectedAnnouncement)} text-xs px-3 py-1`} variant="outline">
                  {selectedAnnouncement.isSystemNotification ? 'System Notification' : (selectedAnnouncement.type || 'Info').toUpperCase()}
                </Badge>
                {selectedAnnouncement.priority && (
                  <Badge className={`${getPriorityColor(selectedAnnouncement.priority)} text-xs px-3 py-1`} variant="outline">
                    {selectedAnnouncement.priority.toUpperCase()} PRIORITY
                  </Badge>
                )}
              </div>
              
              <div className="rounded-lg p-5 border" style={{ backgroundColor: '#fef8f8', borderColor: '#e8d4d4' }}>
                <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: '#2d1517' }}>
                  {selectedAnnouncement.message}
                </p>
              </div>
              
              {selectedAnnouncement.isSystemNotification && selectedAnnouncement.wheelTypeId && (
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-purple-900 mb-2">
                    <Target className="h-5 w-5" />
                    <span className="font-semibold">New Wheel Type Available</span>
                  </div>
                  <p className="text-sm text-purple-800">
                    A new wheel type has been added to the system. Check your wheel galleries to explore it!
                  </p>
                </div>
              )}
              
              {selectedAnnouncement.expiresAt && (
                <div className="flex items-center gap-2 text-sm text-white rounded-md px-3 py-2 mt-3" style={{ backgroundColor: '#8e0b16' }}>
                  <Clock className="h-4 w-4" />
                  <span>
                    <span className="font-semibold">Expires:</span> {selectedAnnouncement.expiresAt.toLocaleString('en-US', {
                      dateStyle: 'medium',
                      timeStyle: 'short'
                    })}
                  </span>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
