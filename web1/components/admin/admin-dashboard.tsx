"use client"

import React from "react"
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@/components/ui/sidebar"

import { auth, db } from "@/lib/firebase"
import { signOut, updatePassword, reauthenticateWithCredential, EmailAuthProvider, type User as FirebaseUser } from "firebase/auth"
import { collection, getDocs, doc, deleteDoc, onSnapshot, query, where, orderBy, serverTimestamp, updateDoc, writeBatch } from "firebase/firestore"
import { toast } from "@/hooks/use-toast"
import Papa, { ParseResult } from "papaparse"
import {
  Send,
  LayoutDashboard,
  UserCog,
  History,
  Bell,
  LogOut,
  Plus,
  Edit,
  ArrowUpDown,
  Trash2,
  List,
  Shield,
  Settings,
  Database,
  Download,
  User,
  ChevronDown,
} from "lucide-react"
import { sendEmailNotification } from "@/lib/admin-actions"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Table, TableBody, TableHead, TableHeader, TableRow, TableCell, TableCaption } from "@/components/ui/table"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"
import { useState, useEffect, useMemo, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

import { SuperAdminManager } from "@/components/auth/super-admin-manager"
import { WheelTypeManager } from "@/components/admin/wheel-type-manager"
import { SystemIntegrationTest } from "@/components/admin/system-integration-test"
import { AnnouncementManager } from "@/components/admin/announcement-manager"
import { isHardcodedAdmin, ensureHardcodedAdminAccess } from "@/lib/hardcoded-admin"
import { isProtectedAdmin, canDeleteUser, logAdminProtection } from "@/lib/admin-protection"
import { WebAdminRoleManager, type RoleChangeRequest } from '@/lib/AdminRoleManager'
import { AnnouncementDisplay } from "@/components/shared/announcement-display"

interface AdminDashboardProps {
  user: FirebaseUser
  userRole: string
}

interface SpinLog {
  id: string
  timestamp: Date
  numberOfWinners: number
  winners: { id?: string; name: string }[]
  wheelType?: string
  wheelName?: string
  result?: string  // Added: for spin result
  userEmail?: string  // Added: for user email
  userName?: string  // Added: for user name
}

interface UserData {
  uid: string
  email: string
  displayName?: string
  role: string
  createdAt: Date
  lastActiveAt: Date
  lastActiveDevice?: string
  isActive?: boolean // Re-added: to indicate if user is currently active
}

interface AdminDashboardData {
  totalUsers: number
  totalSpins: number
  activeNow: number
  recentSpinLogs: SpinLog[]
  allUsers: UserData[]
  totalActivities: number
  totalWheels: number
  totalStudentLists: number
  totalLiveSessions: number
  systemHealth: {
    databaseConnected: boolean
    authConnected: boolean
    storageConnected: boolean
    lastBackup?: Date
  }
  userAnalytics: {
    newUsersToday: number
    newUsersThisWeek: number
    newUsersThisMonth: number
    activeUsersToday: number
    activeUsersThisWeek: number
    mostActiveUsers: UserData[]
  }
  activityAnalytics: {
    spinsToday: number
    spinsThisWeek: number
    spinsThisMonth: number
    popularCategories: { category: string; count: number }[]
    averageParticipants: number
  }
}

export function AdminDashboard({ user, userRole }: AdminDashboardProps) {
  const [dashboardData, setDashboardData] = useState<AdminDashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [emailRecipient, setEmailRecipient] = useState("")
  const [emailSubject, setEmailSubject] = useState("")
  const [emailMessage, setEmailMessage] = useState("")
  const [sendingEmail, setSendingEmail] = useState(false)
  // Enhanced notification states
  const [notificationDuration, setNotificationDuration] = useState("30") // Default 30 days
  const [notificationPriority, setNotificationPriority] = useState("medium")
  const [notificationType, setNotificationType] = useState("info")
  const [activeView, setActiveView] = useState("user-management") // Default to user management for admin

  // User Management States
  const [isAddUserDialogOpen, setIsAddUserDialogOpen] = useState(false)
  const [newUserFirstName, setNewUserFirstName] = useState("")
  const [newUserLastName, setNewUserLastName] = useState("")
  const [newUserEmail, setNewUserEmail] = useState("")
  const [newUserPassword, setNewUserPassword] = useState("")
  const [newUserRole, setNewUserRole] = useState("participant")
  const [addingUser, setAddingUser] = useState(false)

  const [isEditUserDialogOpen, setIsEditUserDialogOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<UserData | null>(null)
  const [editingUserRole, setEditingUserRole] = useState("")
  const [editingUserReason, setEditingUserReason] = useState("")  // New: For role change reason
  const [updatingUser, setUpdatingUser] = useState(false)

  const [sortConfig, setSortConfig] = useState<{ key: keyof UserData; direction: "asc" | "desc" } | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [usersPerPage, setUsersPerPage] = useState(10)
  const [roleFilter, setRoleFilter] = useState("all")
  const [emailFilter, setEmailFilter] = useState("")

  // Spin History States
  const [spinHistoryFilterType, setSpinHistoryFilterType] = useState("all")
  const [spinHistoryPage, setSpinHistoryPage] = useState(1)
  const [spinHistoryPerPage, setSpinHistoryPerPage] = useState(10)
  const [spinHistorySortBy, setSpinHistorySortBy] = useState("timestamp")
  const [spinHistorySortOrder, setSpinHistorySortOrder] = useState<"asc" | "desc">("desc")
  const [spinHistorySearch, setSpinHistorySearch] = useState("")

  // Real-time active users
  const [activeUsers, setActiveUsers] = useState<UserData[]>([])
  const [realTimeConnected, setRealTimeConnected] = useState(false)

  // Profile management
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [changingPassword, setChangingPassword] = useState(false)

  // File upload states
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadingFile, setUploadingFile] = useState(false)
  const [parsedData, setParsedData] = useState<any[]>([])

  // Combined UI states
  const [activeUserTab, setActiveUserTab] = useState<'individual' | 'bulk'>('individual')

  // Profile section state
  const [showProfileSection, setShowProfileSection] = useState(false)

  // Template download function
  const downloadExcelTemplate = () => {
    // Create empty template with only headers (no sample data)
    const headers = ['name', 'email', 'contact']
    const csvContent = headers.join(',')

    // Create and download the file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', 'coby-picks-user-template.csv')
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    toast({
      title: "Template Downloaded",
      description: "Empty template downloaded. Fill in your user information and upload the file.",
      duration: 4000,
    })
  }

  // Helper function to format relative time
  const formatRelativeTime = (date: Date | undefined): string => {
    if (!date) return "N/A"
    const now = new Date()
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000)

    if (seconds < 60) return "just now"
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes} min${minutes === 1 ? "" : "s"} ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`
    const days = Math.floor(hours / 24)
    if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`

    return date.toLocaleDateString()
  }

  // Centralized data fetching function
  const fetchAdminData = useCallback(async () => {
    try {
      console.log("Fetching comprehensive admin data...")

      // Fetch All Users and Total Users
      const usersSnapshot = await getDocs(collection(db, "users"))
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      const oneMonthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

      const allUsers: UserData[] = usersSnapshot.docs.map((doc) => {
        const data = doc.data()
        const lastActiveAt = data.lastActiveAt?.toDate()
        const createdAt = data.createdAt?.toDate()
        return {
          uid: doc.id,
          email: data.email,
          displayName: data.displayName || "",
          role: data.role,
          createdAt: createdAt,
          lastActiveAt: lastActiveAt,
          isActive: lastActiveAt ? lastActiveAt > fiveMinutesAgo : false,
          lastActiveDevice: data.lastActiveDevice,
        }
      })
      // Filter out admin users from the total count (admins should not be counted as regular users)
      const nonAdminUsers = allUsers.filter((user) => user.role !== "admin")
      const totalUsers = nonAdminUsers.length
      console.log("Total Users fetched (excluding admins):", totalUsers)
      console.log("Admin users excluded from count:", allUsers.length - totalUsers)

      const activeUsersCount = allUsers.filter((u) => u.isActive).length

      // User Analytics
      const newUsersToday = allUsers.filter(u => u.createdAt && u.createdAt > oneDayAgo).length
      const newUsersThisWeek = allUsers.filter(u => u.createdAt && u.createdAt > oneWeekAgo).length
      const newUsersThisMonth = allUsers.filter(u => u.createdAt && u.createdAt > oneMonthAgo).length
      const activeUsersToday = allUsers.filter(u => u.lastActiveAt && u.lastActiveAt > oneDayAgo).length
      const activeUsersThisWeek = allUsers.filter(u => u.lastActiveAt && u.lastActiveAt > oneWeekAgo).length
      const mostActiveUsers = allUsers
        .filter(u => u.lastActiveAt)
        .sort((a, b) => (b.lastActiveAt?.getTime() || 0) - (a.lastActiveAt?.getTime() || 0))
        .slice(0, 10)

      // Fetch Total Spins and Recent Spin Logs
      let totalSpins = 0
      const allSpinLogs: SpinLog[] = []
      const wheelsSnapshot = await getDocs(collection(db, "wheels"))
      console.log("Total Wheels fetched:", wheelsSnapshot.docs.length)

      for (const wheelDoc of wheelsSnapshot.docs) {
        const wheelData = wheelDoc.data()
        const currentSpinCount = wheelData.spinCount || 0
        totalSpins += currentSpinCount
        console.log(`  Wheel '${wheelData.name}' (ID: ${wheelDoc.id}) - Spin Count: ${currentSpinCount}`)

        const spinLogsSnapshot = await getDocs(collection(db, `wheels/${wheelDoc.id}/spinLogs`))
        console.log(`    Spin logs for wheel '${wheelData.name}': ${spinLogsSnapshot.docs.length}`)

        spinLogsSnapshot.docs.forEach((logDoc) => {
          const logData = logDoc.data()
          const timestamp =
            logData.timestamp && typeof logData.timestamp.toDate === "function"
              ? logData.timestamp.toDate()
              : new Date()

          allSpinLogs.push({
            id: logDoc.id,
            timestamp: timestamp,
            numberOfWinners: logData.numberOfWinners || 0,
            winners: logData.winners || [],
            wheelType: logData.wheelType || "participant",
            wheelName: wheelData.name || "Unnamed Wheel",
            userEmail: logData.userEmail || wheelData.userEmail || "Unknown User",
            userName: logData.userName || wheelData.userName || "Unknown",
            result: logData.result || (logData.winners && logData.winners.length > 0 ? logData.winners.map((w: any) => w.name || w).join(", ") : "No result")
          })
        })
      }

      // Fetch additional collections for comprehensive data with error handling
      let totalActivities = 0
      let totalStudentLists = 0
      let totalLiveSessions = 0

      try {
        const activitiesSnapshot = await getDocs(collection(db, "drawActivities"))
        totalActivities = activitiesSnapshot.docs.length
      } catch (error) {
        console.log("drawActivities collection not accessible or doesn't exist")
      }

      try {
        const studentListsSnapshot = await getDocs(collection(db, "studentLists"))
        totalStudentLists = studentListsSnapshot.docs.length
      } catch (error) {
        console.log("studentLists collection not accessible or doesn't exist")
      }

      try {
        const liveSessionsSnapshot = await getDocs(collection(db, "liveDrawSessions"))
        totalLiveSessions = liveSessionsSnapshot.docs.length
      } catch (error) {
        console.log("liveDrawSessions collection not accessible or doesn't exist")
      }

      // Fetch global spin history with error handling
      try {
        const spinHistorySnapshot = await getDocs(collection(db, "spinHistory"))
        spinHistorySnapshot.docs.forEach((logDoc) => {
          const logData = logDoc.data()
          const timestamp = logData.timestamp?.toDate() || new Date()

          allSpinLogs.push({
            id: logDoc.id,
            timestamp: timestamp,
            numberOfWinners: logData.numberOfWinners || 0,
            winners: logData.winners?.map((name: string) => ({ name })) || [],
            wheelType: logData.category || "academic",
            wheelName: logData.activityTitle || "Unknown Activity",
            userEmail: logData.userEmail || logData.createdBy || "Unknown User",
            userName: logData.userName || "Unknown",
            result: logData.result || (logData.winners && logData.winners.length > 0 ? logData.winners.join(", ") : "No result")
          })
        })
      } catch (error) {
        console.log("spinHistory collection not accessible or doesn't exist")
      }

      // Fetch live wheel history with error handling
      try {
        const liveWheelHistorySnapshot = await getDocs(collection(db, "liveWheelHistory"))
        liveWheelHistorySnapshot.docs.forEach((logDoc) => {
          const logData = logDoc.data()
          const timestamp = logData.endedAt?.toDate() || logData.timestamp?.toDate() || new Date()

          allSpinLogs.push({
            id: logDoc.id,
            timestamp: timestamp,
            numberOfWinners: logData.winners?.length || 0,
            winners: logData.winners?.map((w: any) => ({ name: w.name || w })) || [],
            wheelType: "live-session", // Mark as live session
            wheelName: logData.title || "Live Session",
            userEmail: logData.createdBy || "Unknown User",
            userName: "Live Session Organizer",
            result: logData.winners && logData.winners.length > 0 
              ? logData.winners.map((w: any) => w.name || w).join(", ")
              : `Room: ${logData.roomCode || 'Unknown'} - ${logData.participants?.length || 0} participants`
          })
        })
      } catch (error) {
        console.log("liveWheelHistory collection not accessible or doesn't exist")
      }

      const recentSpinLogs = allSpinLogs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())

      // Calculate analytics
      const spinsToday = allSpinLogs.filter(log => log.timestamp > oneDayAgo).length
      const spinsThisWeek = allSpinLogs.filter(log => log.timestamp > oneWeekAgo).length
      const spinsThisMonth = allSpinLogs.filter(log => log.timestamp > oneMonthAgo).length

      const categoryCount: { [key: string]: number } = {}
      allSpinLogs.forEach(log => {
        const category = log.wheelType || 'unknown'
        categoryCount[category] = (categoryCount[category] || 0) + 1
      })
      const popularCategories = Object.entries(categoryCount)
        .map(([category, count]) => ({ category, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)

      const totalParticipants = allSpinLogs.reduce((sum, log) => sum + (log.winners?.length || 0), 0)
      const averageParticipants = allSpinLogs.length > 0 ? Math.round(totalParticipants / allSpinLogs.length) : 0

      const newDashboardData = {
        totalUsers,
        totalSpins: allSpinLogs.length,
        activeNow: activeUsersCount,
        recentSpinLogs,
        allUsers,
        totalActivities,
        totalWheels: wheelsSnapshot.docs.length,
        totalStudentLists,
        totalLiveSessions,
        systemHealth: {
          databaseConnected: true,
          authConnected: true,
          storageConnected: true,
          lastBackup: new Date()
        },
        userAnalytics: {
          newUsersToday,
          newUsersThisWeek,
          newUsersThisMonth,
          activeUsersToday,
          activeUsersThisWeek,
          mostActiveUsers
        },
        activityAnalytics: {
          spinsToday,
          spinsThisWeek,
          spinsThisMonth,
          popularCategories,
          averageParticipants
        }
      }
      console.log("Comprehensive Dashboard Data:", newDashboardData)
      setDashboardData(newDashboardData)
    } catch (error: any) {
      console.error("Detailed Error Fetching Admin Data:", error)
      toast({
        title: "Error Fetching Admin Data",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAdminData()

    // Set up real-time listener for active users
    const setupRealTimeActiveUsers = () => {
      try {
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)
        const activeUsersQuery = query(
          collection(db, "users"),
          where("lastActiveAt", ">=", fiveMinutesAgo),
          orderBy("lastActiveAt", "desc")
        )

        const unsubscribe = onSnapshot(
          activeUsersQuery,
          (snapshot) => {
            const activeUsersList: UserData[] = snapshot.docs.map((doc) => ({
              uid: doc.id,  // Add uid property
              email: doc.data().email || "",
              role: doc.data().role || "student",
              displayName: doc.data().displayName || "",
              lastActiveAt: doc.data().lastActiveAt?.toDate(),
              createdAt: doc.data().createdAt?.toDate(),
              isActive: doc.data().isActive ?? true,
              lastActiveDevice: doc.data().lastActiveDevice || ""
            }))

            setActiveUsers(activeUsersList)
            setRealTimeConnected(true)
            console.log(`📊 Real-time: ${activeUsersList.length} active users`)
          },
          (error) => {
            console.error("Real-time active users error:", error)
            setRealTimeConnected(false)
          }
        )

        return unsubscribe
      } catch (error) {
        console.error("Failed to set up real-time listener:", error)
        setRealTimeConnected(false)
        return () => {}
      }
    }

    // Listen for session ended events to refresh history immediately
    const handleSessionEnded = (event: CustomEvent) => {
      console.log('🔄 Admin Dashboard: Session ended, refreshing data:', event.detail)
      // Small delay to ensure Firestore has processed the new history entry
      setTimeout(() => {
        fetchAdminData()
      }, 1000)
    }

    const unsubscribeActiveUsers = setupRealTimeActiveUsers()
    const refreshInterval = setInterval(fetchAdminData, 30 * 1000)

    if (typeof window !== 'undefined') {
      window.addEventListener('sessionEnded', handleSessionEnded as EventListener)
    }

    return () => {
      clearInterval(refreshInterval)
      unsubscribeActiveUsers()
      if (typeof window !== 'undefined') {
        window.removeEventListener('sessionEnded', handleSessionEnded as EventListener)
      }
    }
  }, [fetchAdminData])

  const handleLogout = async () => {
    try {
      await signOut(auth)
      toast({
        title: "Logged Out",
        description: "You have been successfully logged out.",
      })
    } catch (error: any) {
      toast({
        title: "Logout Error",
        description: error.message,
        variant: "destructive",
      })
    }
  }

  // Comprehensive data export function
  const exportAllData = async () => {
    try {
      const exportData = {
        exportDate: new Date().toISOString(),
        systemStats: {
          totalUsers: dashboardData?.totalUsers || 0,
          totalSpins: dashboardData?.totalSpins || 0,
          totalActivities: dashboardData?.totalActivities || 0,
          totalWheels: dashboardData?.totalWheels || 0,
          totalStudentLists: dashboardData?.totalStudentLists || 0,
          totalLiveSessions: dashboardData?.totalLiveSessions || 0,
        },
        users: dashboardData?.allUsers || [],
        spinHistory: dashboardData?.recentSpinLogs || [],
        userAnalytics: dashboardData?.userAnalytics || {},
        activityAnalytics: dashboardData?.activityAnalytics || {},
        systemHealth: dashboardData?.systemHealth || {}
      }

      const jsonString = JSON.stringify(exportData, null, 2)
      const blob = new Blob([jsonString], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `coby-picks-admin-export-${new Date().toISOString().split('T')[0]}.json`
      a.click()
      URL.revokeObjectURL(url)

      toast({
        title: "Export Complete",
        description: "All system data has been exported successfully"
      })
    } catch (error: any) {
      toast({
        title: "Export Error",
        description: error.message,
        variant: "destructive"
      })
    }
  }

  // System maintenance functions
  const performSystemMaintenance = async () => {
    try {
      // Refresh all data
      await fetchAdminData()

      toast({
        title: "Maintenance Complete",
        description: "System data has been refreshed"
      })
    } catch (error: any) {
      toast({
        title: "Maintenance Error",
        description: error.message,
        variant: "destructive"
      })
    }
  }

  const handleSendEmail = async () => {
    if (!emailRecipient || !emailSubject || !emailMessage) {
      toast({
        title: "Missing Information",
        description: "Please fill in all fields (recipient, subject, and message).",
        variant: "destructive",
      })
      return
    }

    setSendingEmail(true)
    try {
      const result = await sendEmailNotification(
        emailRecipient, 
        emailSubject, 
        emailMessage,
        user, // Pass admin user information
        {
          duration: parseInt(notificationDuration),
          priority: notificationPriority as "low" | "medium" | "high" | "urgent",
          type: notificationType as "info" | "warning" | "success" | "urgent"
        }
      )
      
      if (result.success) {
        toast({
          title: "Notification Sent Successfully!",
          description: result.message,
          duration: 6000,
        })
        
        // Clear form after successful send
        setEmailRecipient("")
        setEmailSubject("")
        setEmailMessage("")
        setNotificationDuration("30")
        setNotificationPriority("medium")
        setNotificationType("info")
        
        console.log('\u2705 Real-time announcement created:', {
          recipient: emailRecipient,
          subject: emailSubject,
          recipientCount: result.recipientCount,
          targetRoles: result.targetRoles,
          announcementId: result.announcementId
        })
      } else {
        toast({
          title: "Failed to Send Notification",
          description: result.message,
          variant: "destructive",
        })
      }
    } catch (error: any) {
      console.error("Error sending notification:", error)
      toast({
        title: "Error Sending Notification",
        description: error.message || "An unexpected error occurred while sending the notification.",
        variant: "destructive",
      })
    } finally {
      setSendingEmail(false)
    }
  }

  // Enhanced handleDeleteUser with comprehensive admin protection
  const handleDeleteUser = async (userId: string, userEmail: string) => {
    // First check: Use new comprehensive admin protection system
    const protectionCheck = canDeleteUser(userEmail, userId)
    if (!protectionCheck.canDelete) {
      logAdminProtection('USER_DELETE_ATTEMPT', userEmail, protectionCheck.reason || 'Protected admin account')
      toast({
        title: "Cannot Delete Protected Account",
        description: protectionCheck.reason || "This account is protected from deletion.",
        variant: "destructive",
      })
      return
    }

    // Second check: Legacy protection for backwards compatibility
    if (isHardcodedAdmin(userEmail)) {
      logAdminProtection('LEGACY_ADMIN_DELETE_ATTEMPT', userEmail, 'Hardcoded admin protection triggered')
      toast({
        title: "Cannot Delete Admin",
        description: "Hardcoded administrator accounts cannot be deleted for security reasons.",
        variant: "destructive",
      })
      return
    }

    // Third check: Prevent admin from deleting themselves
    if (user.email?.toLowerCase() === userEmail.toLowerCase()) {
      logAdminProtection('SELF_DELETE_ATTEMPT', userEmail, 'Admin attempted to delete own account')
      toast({
        title: "Cannot Delete Own Account",
        description: "You cannot delete your own admin account. This would lock you out of the system.",
        variant: "destructive",
      })
      return
    }

    // Enhanced confirmation dialog with protection warning
    const isTargetAdmin = isProtectedAdmin(userEmail, userId)
    const confirmMessage = isTargetAdmin 
      ? `⚠️ WARNING: You are about to delete an admin account "${userEmail}". This is a protected operation and should only be done with extreme caution. This action cannot be undone.\n\nAre you absolutely sure you want to proceed?`
      : `Are you sure you want to permanently delete user "${userEmail}"'s data? This action cannot be undone.`

    if (!confirm(confirmMessage)) {
      console.log(`🛑 User deletion cancelled for: ${userEmail}`)
      return
    }

    try {
      // Log the deletion attempt for audit purposes
      console.log(`🗑️ Attempting to delete user: ${userEmail} (ID: ${userId})`)
      
      // Delete user's Firestore document
      await deleteDoc(doc(db, "users", userId))
      
      // Log successful deletion
      console.log(`✅ Successfully deleted user: ${userEmail}`)
      
      toast({
        title: "User Data Deleted",
        description: `User "${userEmail}"'s data has been removed from Firestore.`,
      })

      // Update local state
      setDashboardData((prev) => {
        if (!prev) return null
        const updatedUsers = prev.allUsers.filter((u) => u.uid !== userId)
        // Filter out admin users from the total count (same logic as in fetchAdminData)
        const nonAdminUsers = updatedUsers.filter((user) => user.role !== "admin")
        return {
          ...prev,
          allUsers: updatedUsers,
          totalUsers: nonAdminUsers.length,
        }
      })
    } catch (error: any) {
      console.error(`❌ Error deleting user data for ${userEmail}:`, error)
      
      // Log the error for admin protection audit
      logAdminProtection('DELETE_ERROR', userEmail, `Deletion failed: ${error.message}`)
      
      toast({
        title: "Error Deleting User Data",
        description: error.message,
        variant: "destructive",
      })
    }
  }

  // Client-side fallback removed to prevent authentication redirection issues
  // All user creation now happens server-side via Firebase Admin SDK

  const handleAddUser = async () => {
    if (!newUserFirstName || !newUserLastName || !newUserEmail || !newUserPassword || !newUserRole) {
      toast({
        title: "Missing Information",
        description: "Please fill in all fields (First Name, Last Name, Email, Password, Role).",
        variant: "destructive",
      })
      return
    }

    setAddingUser(true)
    try {
      // Combine first and last name for full name
      const fullName = `${newUserFirstName.trim()} ${newUserLastName.trim()}`

      // Using Firebase Admin SDK for real user creation
      const response = await fetch('/api/admin/create-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: fullName,
          email: newUserEmail,
          password: newUserPassword,
          role: newUserRole,
          adminEmail: user.email,
        }),
      })

      // Check if response is JSON or HTML
      const contentType = response.headers.get('content-type')
      let result
      
      if (contentType && contentType.includes('application/json')) {
        result = await response.json()
      } else {
        // Server returned HTML (likely an error page)
        const htmlText = await response.text()
        console.error('Server returned HTML instead of JSON:', htmlText)
        throw new Error(`Server error: API returned HTML instead of JSON. Status: ${response.status}`)
      }

      if (!response.ok) {
        // Always throw an error if server-side creation fails
        // Do NOT fallback to client-side creation as it causes auth redirection
        throw new Error(result.error || 'Failed to create user')
      }
      
      toast({
        title: "User Added Successfully",
        description: `User ${newUserEmail} has been created with role ${newUserRole}. Refreshing user list...`,
      })
      
      // IMPORTANT: Immediately ensure we stay on user management
      setActiveView("user-management")
      
      // Show loading state while refreshing
      setLoading(true)
      
      try {
        // Real mode: fetch actual data from Firebase database
        console.log('🔄 Refreshing admin data to show new user...')
        
        // Small delay to ensure the user document is fully written to Firestore
        await new Promise(resolve => setTimeout(resolve, 1000))
        
        // Refresh the admin data
        await fetchAdminData()
        
        // Ensure we stay on user management view
        setActiveView("user-management")
        
        // Show confirmation that the list was updated
        toast({
          title: "User Added to List",
          description: `✅ ${newUserEmail} is now visible in the user management table.`,
          duration: 3000,
        })
        
        console.log('✅ User management view refreshed with new user')
      } finally {
        setLoading(false)
      }

      // Clear form and close dialog
      setNewUserFirstName("")
      setNewUserLastName("")
      setNewUserEmail("")
      setNewUserPassword("")
      setNewUserRole("participant")
      setIsAddUserDialogOpen(false)

    } catch (error: any) {
      console.error("Error adding user:", error)

      // Handle API error responses
      const errorMessage = error.message || "An unexpected error occurred."
      
      if (errorMessage.includes("email already exists") || errorMessage.includes("already exists")) {
        toast({
          title: "Email Already in Use",
          description: "A user with this email address already exists.",
          variant: "destructive",
        })
      } else if (errorMessage.includes("invalid email")) {
        toast({
          title: "Invalid Email",
          description: "Please enter a valid email address.",
          variant: "destructive",
        })
      } else if (errorMessage.includes("weak password") || errorMessage.includes("too weak")) {
        toast({
          title: "Weak Password",
          description: "Password should be at least 6 characters long.",
          variant: "destructive",
        })
      } else if (errorMessage.includes("Unauthorized")) {
        toast({
          title: "Access Denied",
          description: "You don't have permission to create users.",
          variant: "destructive",
        })
      } else if (errorMessage.includes("Firebase Admin SDK") || errorMessage.includes("configuration") || errorMessage.includes("Configuration Required")) {
        toast({
          title: "Firebase Admin SDK Setup Required",
          description: "Your .env.local file has placeholder values. Please follow QUICK_SETUP.md to replace them with real Firebase credentials.",
          variant: "destructive",
        })
        console.error("🚫 Firebase Admin SDK Configuration Issue:")
        console.error("1. Open .env.local file in web1 folder")
        console.error("2. Replace FIREBASE_CLIENT_EMAIL placeholder with real service account email")
        console.error("3. Replace FIREBASE_PRIVATE_KEY placeholder with real private key")
        console.error("4. Follow QUICK_SETUP.md for detailed instructions")
        console.error("5. Visit http://localhost:3000/api/admin/config-check to verify setup")
      } else if (errorMessage.includes("API returned HTML") || errorMessage.includes("Server error")) {
        toast({
          title: "Server Error",
          description: "The server encountered an error. Please check the console for details and try again.",
          variant: "destructive",
        })
      } else if (errorMessage.includes("Unexpected token") && errorMessage.includes("DOCTYPE")) {
        toast({
          title: "Server Configuration Issue",
          description: "The API is returning an error page instead of JSON. Please check server configuration.",
          variant: "destructive",
        })
      } else {
        toast({
          title: "Error Adding User",
          description: errorMessage,
          variant: "destructive",
        })
      }
    } finally {
      setAddingUser(false)
    }
  }

  const handleFileUpload = async () => {
    if (!uploadFile) {
      toast({
        title: "No File Selected",
        description: "Please select a CSV or Excel file to upload.",
        variant: "destructive",
      })
      return
    }

    setUploadingFile(true)
    try {
      // Store current admin user to prevent auth state confusion during bulk creation
      const currentAdminUser = user
      
      // Parse CSV file
      Papa.parse(uploadFile, {
        header: true,
        skipEmptyLines: true,
        complete: async (results: ParseResult<any>) => {
          try {
            const data = results.data as any[]
            setParsedData(data)

            if (data.length === 0) {
              toast({
                title: "Empty File",
                description: "The uploaded file contains no data.",
                variant: "destructive",
              })
              return
            }

            // Validate required columns
            const requiredColumns = ['name', 'email']
            const headers = Object.keys(data[0] || {})
            const missingColumns = requiredColumns.filter(col => 
              !headers.some(header => header.toLowerCase().includes(col.toLowerCase()))
            )

            if (missingColumns.length > 0) {
              toast({
                title: "Missing Required Columns",
                description: `The file must contain columns for: ${missingColumns.join(', ')}`,
                variant: "destructive",
              })
              return
            }

            // Process each row and create user accounts
            let successCount = 0
            let errorCount = 0
            let duplicateCount = 0
            const errors: string[] = []
            const duplicates: string[] = []

            for (const row of data) {
              // Extract data from row (handle different column name variations)
              const name = row.name || row.Name || row.fullname || row['Full Name'] || row['full name'] || ''
              const email = row.email || row.Email || row['email address'] || row['Email Address'] || ''
              const contactNumber = row.contact || row.Contact || row['contact number'] || row['Contact Number'] || row.phone || row.Phone || ''

              if (!name.trim() || !email.trim()) {
                errorCount++
                errors.push(`Row with email '${email}' is missing required name or email`)
                continue
              }

              try {
                // Generate a temporary password (users will need to reset it)
                const tempPassword = 'TempPass123!'

                // Use server-side API to create user without affecting current session
                const response = await fetch('/api/admin/create-user', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    name: name.trim(),
                    email: email.trim(),
                    password: tempPassword,
                    role: "participant", // Default role for uploaded users
                    adminEmail: user.email,
                    contactNumber: contactNumber.trim() || null,
                    needsPasswordReset: true, // Flag that they need to reset password
                    isImport: true, // Flag this as a bulk import
                  }),
                })

                const result = await response.json()

                if (!response.ok) {
                  if (response.status === 409) {
                    // Handle duplicate user (409 Conflict)
                    duplicateCount++
                    duplicates.push(email.trim())
                  } else {
                    throw new Error(result.error || 'Failed to create user')
                  }
                } else {
                  successCount++
                }
                
              } catch (error: any) {
                errorCount++
                const errorMessage = error.message || 'Unknown error'
                
                if (errorMessage.includes('already exists')) {
                  duplicateCount++
                  duplicates.push(email)
                } else if (errorMessage.includes('invalid email')) {
                  errors.push(`Invalid email format: ${email}`)
                } else if (errorMessage.includes('weak password') || errorMessage.includes('too weak')) {
                  errors.push(`Weak password for ${email}`)
                } else {
                  errors.push(`Error creating user ${email}: ${errorMessage}`)
                }
              }
            }

            // Show results with better duplicate handling
            console.log('Upload processing complete:', { successCount, duplicateCount, errorCount, totalRows: data.length })
            
            if (successCount > 0) {
              // Some users were successfully created
              setActiveView("user-management")
              
              let message = `${successCount} users successfully imported`
              if (duplicateCount > 0) {
                message += `, ${duplicateCount} users already existed (skipped)`
              }
              if (errorCount > 0) {
                message += `, ${errorCount} errors occurred`
              }
              
              toast({
                title: "Import Started",
                description: `${message}. Please wait while we refresh the user list...`,
                duration: 4000,
              })

              // IMPORTANT: Ensure admin stays logged in after bulk user creation
              if (auth.currentUser?.uid !== currentAdminUser?.uid) {
                console.log("🔄 Admin session changed during bulk user creation, maintaining admin session")
              }

              // Show loading state while refreshing
              setLoading(true)

              try {
                // Refresh admin data to show new users immediately
                console.log(`🔄 Refreshing admin data to show ${successCount} new users...`)
                
                // Small delay to ensure all user documents are fully written to Firestore
                await new Promise(resolve => setTimeout(resolve, 3000))
                
                // Refresh the admin data
                await fetchAdminData()

                // Ensure we stay on user management view
                setActiveView("user-management")
                
                // Show final confirmation that the list was updated
                let finalMessage = `✅ ${successCount} users successfully imported`
                if (duplicateCount > 0) {
                  finalMessage += `. ${duplicateCount} existing users were skipped.`
                } else {
                  finalMessage += ` and added to the user management table.`
                }
                
                toast({
                  title: "Import Complete!",
                  description: finalMessage,
                  duration: 5000,
                })
                
                console.log('✅ User management view refreshed with new imported users')
              } finally {
                setLoading(false)
              }
            } else if (duplicateCount > 0) {
              // All users were duplicates, no new users created
              toast({
                title: "All Users Already Exist",
                description: `All ${duplicateCount} users in the CSV file already exist in the system. No new users were created.`,
                variant: "default",
              })
              console.log(`📝 All ${duplicateCount} users already exist, no action needed`)
            } else if (errorCount > 0) {
              // Only errors, no successes or duplicates
              console.error('All users failed to create due to errors:', errors)
            }

            // Handle remaining errors (not duplicates which are already handled above)
            if (errorCount > 0) {
              console.log('Upload summary:', { successCount, duplicateCount, errorCount, errors, duplicates })
              
              // Real errors occurred (excluding duplicates which are handled above)
              const configErrors = errors.filter(error => 
                error.includes('Firebase Admin SDK Configuration Required') ||
                error.includes('Missing required environment variables') ||
                error.includes('placeholder values')
              )
              
              if (configErrors.length === errors.length) {
                // All errors are configuration issues
                toast({
                  title: "Firebase Admin SDK Setup Required",
                  description: `All ${errorCount} users failed to create due to missing Firebase configuration. Please check QUICK_SETUP.md and update your .env.local file.`,
                  variant: "destructive",
                })
                console.error("🚫 All upload errors are due to Firebase Admin SDK configuration:")
                console.error("1. Open .env.local file in web1 folder")
                console.error("2. Replace placeholder values with real Firebase credentials")
                console.error("3. Follow QUICK_SETUP.md for step-by-step instructions")
                console.error("4. Visit http://localhost:3000/api/admin/config-check to verify setup")
              } else {
                // Mixed errors or other issues
                let errorMessage = `${errorCount} error(s) occurred`
                if (duplicateCount > 0) {
                  errorMessage += ` (${duplicateCount} duplicates were skipped)`
                }
                
                toast({
                  title: errorMessage,
                  description: errors.slice(0, 2).join('; ') + (errors.length > 2 ? '...' : ''),
                  variant: "destructive",
                })
              }
            }

            // Reset file input
            setUploadFile(null)
            setParsedData([])
            const fileInput = document.getElementById('file-upload') as HTMLInputElement
            if (fileInput) fileInput.value = ''

          } catch (parseError: any) {
            toast({
              title: "Processing Error",
              description: parseError.message,
              variant: "destructive",
            })
          } finally {
            setUploadingFile(false)
          }
        },
        error: (error: any) => {
          setUploadingFile(false)
          toast({
            title: "File Parse Error",
            description: error.message,
            variant: "destructive",
          })
        }
      })
    } catch (error: any) {
      setUploadingFile(false)
      toast({
        title: "Upload Error",
        description: error.message,
        variant: "destructive",
      })
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setUploadFile(e.target.files[0])
    }
  }

  const handleEditUser = async () => {
    if (!editingUser || !editingUserRole) {
      toast({
        title: "Missing Information",
        description: "Please select a user and role to update.",
        variant: "destructive",
      })
      return
    }

    if (!editingUserReason || editingUserReason.trim().length === 0) {
      toast({
        title: "Reason Required",
        description: "A reason is required for role changes for security audit purposes.",
        variant: "destructive",
      })
      return
    }

    setUpdatingUser(true)
    try {
      // Use secure WebAdminRoleManager instead of Cloud Functions
      const roleChangeRequest: RoleChangeRequest = {
        targetUserId: editingUser.uid,
        targetUserEmail: editingUser.email,
        newRole: editingUserRole as 'participant' | 'organizer' | 'admin',
        reason: editingUserReason.trim(),
        adminUserId: user.uid,
        adminEmail: user.email!
      }

      const success = await WebAdminRoleManager.changeUserRole(roleChangeRequest)
      
      if (success) {
        // Role change was successful, refresh data
        await fetchAdminData()
        setIsEditUserDialogOpen(false)
        setEditingUser(null)
        setEditingUserRole("")
        setEditingUserReason("")  // Clear reason
        
        console.log(`🔐 ADMIN ACTION: ${user.email} changed ${editingUser.email} role to ${editingUserRole}`)
      }
      // Note: Error handling is done inside WebAdminRoleManager.changeUserRole via toast
    } catch (error: any) {
      console.error("❌ Error updating user role:", error)
      toast({
        title: "Error Updating User",
        description: "An unexpected error occurred while updating the user role.",
        variant: "destructive",
      })
    } finally {
      setUpdatingUser(false)
    }
  }

  // Password change handler
  const handlePasswordChange = async () => {
    if (!newPassword || !confirmPassword || !currentPassword) {
      toast({
        title: "Missing Information",
        description: "Please fill in all password fields",
        variant: "destructive"
      })
      return
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: "Password Mismatch",
        description: "New password and confirmation don't match",
        variant: "destructive"
      })
      return
    }

    if (newPassword.length < 6) {
      toast({
        title: "Password Too Short",
        description: "Password must be at least 6 characters long",
        variant: "destructive"
      })
      return
    }

    setChangingPassword(true)
    try {
      // Re-authenticate user with current password
      const credential = EmailAuthProvider.credential(user.email!, currentPassword)
      await reauthenticateWithCredential(user, credential)

      // Update password
      await updatePassword(user, newPassword)

      toast({
        title: "Password Updated",
        description: "Your password has been successfully changed",
      })

      // Clear form
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
    } catch (error: any) {
      console.error("Password change error:", error)
      if (error.code === "auth/wrong-password") {
        toast({
          title: "Incorrect Current Password",
          description: "Please check your current password and try again",
          variant: "destructive"
        })
      } else if (error.code === "auth/weak-password") {
        toast({
          title: "Weak Password",
          description: "Please choose a stronger password",
          variant: "destructive"
        })
      } else {
        toast({
          title: "Password Change Failed",
          description: error.message || "An error occurred while changing your password",
          variant: "destructive"
        })
      }
    } finally {
      setChangingPassword(false)
    }
  }

  // Sorting logic
  const requestSort = (key: keyof UserData) => {
    let direction: "asc" | "desc" = "asc"
    if (sortConfig && sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc"
    }
    setSortConfig({ key, direction })
  }

  const sortedAndFilteredUsers = useMemo(() => {
    let sortableUsers = dashboardData?.allUsers ? [...dashboardData.allUsers] : []

    // Filter out admin users from the list (admin users should not be shown in user management)
    sortableUsers = sortableUsers.filter((user) => user.role !== "admin")

    // Filter by role
    if (roleFilter !== "all") {
      sortableUsers = sortableUsers.filter((user) => user.role === roleFilter)
    }

    // Filter by email
    if (emailFilter.trim()) {
      sortableUsers = sortableUsers.filter((user) =>
        user.email.toLowerCase().includes(emailFilter.toLowerCase())
      )
    }

    if (sortConfig !== null) {
      sortableUsers.sort((a, b) => {
        const aValue = a[sortConfig.key]
        const bValue = b[sortConfig.key]

        if (aValue === null || aValue === undefined) return sortConfig.direction === "asc" ? 1 : -1
        if (bValue === null || bValue === undefined) return sortConfig.direction === "asc" ? -1 : 1

        if (typeof aValue === "string" && typeof bValue === "string") {
          return sortConfig.direction === "asc" ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue)
        }
        if (typeof aValue === "number" && typeof bValue === "number") {
          return sortConfig.direction === "asc" ? aValue - bValue : bValue - aValue
        }
        if (aValue instanceof Date && bValue instanceof Date) {
          return sortConfig.direction === "asc"
            ? aValue.getTime() - bValue.getTime()
            : bValue.getTime() - aValue.getTime()
        }
        return 0
      })
    }
    return sortableUsers
  }, [dashboardData?.allUsers, sortConfig, roleFilter, emailFilter])

  // Pagination logic
  const indexOfLastUser = currentPage * usersPerPage
  const indexOfFirstUser = indexOfLastUser - usersPerPage
  const currentUsers = sortedAndFilteredUsers.slice(indexOfFirstUser, indexOfLastUser)
  const totalPages = Math.ceil(sortedAndFilteredUsers.length / usersPerPage)

  const paginate = (pageNumber: number) => setCurrentPage(pageNumber)

  // Enhanced Spin History Logs with sorting, filtering, and pagination
  const uniqueWheelTypes = useMemo(() => {
    const types = new Set<string>()
    dashboardData?.recentSpinLogs.forEach((log) => {
      if (log.wheelType) types.add(log.wheelType)
    })
    return ["all", ...Array.from(types)]
  }, [dashboardData?.recentSpinLogs])

  const filteredAndSortedSpinLogs = useMemo(() => {
    if (!dashboardData?.recentSpinLogs) return []

    let filtered = dashboardData.recentSpinLogs

    // Apply type filter
    if (spinHistoryFilterType !== "all") {
      filtered = filtered.filter((log) => log.wheelType === spinHistoryFilterType)
    }

    // Apply search filter
    if (spinHistorySearch.trim()) {
      const searchTerm = spinHistorySearch.toLowerCase()
      filtered = filtered.filter((log) => {
        const result = log.result || "";
        const wheelType = log.wheelType || "";
        const userEmail = log.userEmail || "";
        const userName = log.userName || "";
        return (
          result.toLowerCase().includes(searchTerm) ||
          wheelType.toLowerCase().includes(searchTerm) ||
          userEmail.toLowerCase().includes(searchTerm) ||
          userName.toLowerCase().includes(searchTerm)
        );
      });
    }

    // Apply sorting
    const sorted = [...filtered].sort((a, b) => {
      let aValue: any, bValue: any

      switch (spinHistorySortBy) {
        case "timestamp":
          aValue = a.timestamp.getTime()
          bValue = b.timestamp.getTime()
          break
        case "result":
          aValue = a.result || ""
          bValue = b.result || ""
          break
        case "wheelType":
          aValue = a.wheelType || ""
          bValue = b.wheelType || ""
          break
        case "userEmail":
          aValue = a.userEmail || ""
          bValue = b.userEmail || ""
          break
        default:
          aValue = a.timestamp.getTime()
          bValue = b.timestamp.getTime()
      }

      if (typeof aValue === "string") {
        aValue = aValue.toLowerCase()
        bValue = bValue.toLowerCase()
      }

      if (spinHistorySortOrder === "asc") {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0
      } else {
        return aValue < bValue ? 1 : aValue > bValue ? -1 : 0
      }
    })

    return sorted
  }, [dashboardData?.recentSpinLogs, spinHistoryFilterType, spinHistorySearch, spinHistorySortBy, spinHistorySortOrder])

  // Pagination for spin history
  const totalSpinLogs = filteredAndSortedSpinLogs.length
  const totalSpinPages = Math.ceil(totalSpinLogs / spinHistoryPerPage)
  const indexOfLastSpinLog = spinHistoryPage * spinHistoryPerPage
  const indexOfFirstSpinLog = indexOfLastSpinLog - spinHistoryPerPage
  const currentSpinLogs = filteredAndSortedSpinLogs.slice(indexOfFirstSpinLog, indexOfLastSpinLog)

  const renderMainContent = (): JSX.Element => {
    return (
      <div>
        {activeView === "overview" && (
          <React.Fragment>
            <h2 className="text-3xl font-bold mb-6">Welcome, {user.email}!</h2>

            {/* Overview Section */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <Card className="shadow-md">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg font-semibold">Total Users</CardTitle>
                  <CardDescription className="text-sm text-muted-foreground">
                    Current number of registered users.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-4xl font-bold">{dashboardData?.totalUsers.toLocaleString()}</div>
                </CardContent>
              </Card>

              {/* Real-time Active Now card */}
              <Card className="shadow-md border-l-4 border-l-green-500">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg font-semibold flex items-center gap-2">
                    Active Now
                    {realTimeConnected ? (
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    ) : (
                      <div className="w-2 h-2 bg-gray-400 rounded-full" />
                    )}
                  </CardTitle>
                  <CardDescription className="text-sm text-muted-foreground">
                    {realTimeConnected ? "Live users (last 5 minutes)" : "Users currently active"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-4xl font-bold text-green-600">
                    {realTimeConnected ? activeUsers.length : (dashboardData?.activeNow || 0)}
                  </div>
                  {realTimeConnected && activeUsers.length > 0 && (
                    <div className="mt-2 text-xs text-muted-foreground">
                      Last active: {activeUsers[0]?.lastActiveAt?.toLocaleTimeString() || "Unknown"}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="shadow-md">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg font-semibold">Total Spins</CardTitle>
                  <CardDescription className="text-sm text-muted-foreground">
                    All-time spins across all wheels.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-4xl font-bold">{dashboardData?.totalSpins.toLocaleString()}</div>
                </CardContent>
              </Card>
            </div>



            {/* Real-time Active Users */}
            {realTimeConnected && activeUsers.length > 0 && (
              <React.Fragment>
                <h3 className="text-2xl font-semibold mb-4 flex items-center gap-2">
                  🔴 Live Active Users
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                    {activeUsers.length} online
                  </Badge>
                </h3>
                <Card className="shadow-md mb-8">
                  <CardHeader>
                    <CardTitle className="text-lg">Users Active in Last 5 Minutes</CardTitle>
                    <CardDescription>Real-time monitoring of user activity</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-3 max-h-60 overflow-y-auto">
                      {activeUsers.map((user) => (
                        <div key={user.uid} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                            <div>
                              <div className="font-medium">{user.displayName || user.email}</div>
                              <div className="text-sm text-muted-foreground">{user.email}</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <Badge variant="outline" className="text-xs">
                              {user.role}
                            </Badge>
                            <div className="text-xs text-muted-foreground mt-1">
                              {user.lastActiveAt ? formatRelativeTime(user.lastActiveAt) : "Just now"}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </React.Fragment>
            )}

            {/* Spin History Logs */}
            <h2 className="text-2xl font-semibold mb-4">📊 Recent Spin History</h2>
            <Card className="shadow-md p-6 mb-8">
              <div className="flex flex-col gap-4 mb-6">
                <CardDescription className="text-muted-foreground">Admin view: See all users and their spin activity across different wheel types and sessions.</CardDescription>

                {/* Enhanced Filters */}
                <div className="flex flex-wrap gap-4 items-center">
                  <div className="flex-1 min-w-[200px]">
                    <Input
                      placeholder="Search by user, wheel name, or result..."
                      value={spinHistorySearch}
                      onChange={(e) => setSpinHistorySearch(e.target.value)}
                      className="w-full"
                    />
                  </div>

                  <Select value={spinHistoryFilterType} onValueChange={setSpinHistoryFilterType}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Filter by Wheel Type" />
                    </SelectTrigger>
                    <SelectContent>
                      {uniqueWheelTypes.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type === "all" ? "All Types" : 
                           type === "live-session" ? "🔴 Live Sessions" :
                           type === "academic" ? "📚 Academic" :
                           type === "personal" ? "👤 Personal" :
                           type === "entertainment" ? "🎮 Entertainment" :
                           type === "research" ? "🔬 Research" :
                           type.charAt(0).toUpperCase() + type.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={spinHistorySortBy} onValueChange={setSpinHistorySortBy}>
                    <SelectTrigger className="w-[160px]">
                      <SelectValue placeholder="Sort by" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="timestamp">Date/Time</SelectItem>
                      <SelectItem value="userEmail">User</SelectItem>
                      <SelectItem value="wheelType">Wheel Type</SelectItem>
                      <SelectItem value="result">Result</SelectItem>
                    </SelectContent>
                  </Select>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSpinHistorySortOrder(spinHistorySortOrder === "asc" ? "desc" : "asc")}
                  >
                    {spinHistorySortOrder === "asc" ? "↑" : "↓"}
                  </Button>
                </div>

                {/* User Spin Activity Details */}
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead className="font-semibold text-gray-700">User</TableHead>
                        <TableHead className="font-semibold text-gray-700">Wheel Type</TableHead>
                        <TableHead className="font-semibold text-gray-700">Activity</TableHead>
                        <TableHead className="font-semibold text-gray-700">Session Type</TableHead>
                        <TableHead className="font-semibold text-gray-700">Last Activity</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredAndSortedSpinLogs.length > 0 ? (
                        filteredAndSortedSpinLogs.slice(0, 10).map((log) => (
                          <TableRow key={log.id} className="hover:bg-gray-50">
                            <TableCell className="font-medium">
                              <div className="flex flex-col">
                                <span className="text-sm font-semibold text-swu-red">
                                  {log.userName || "Unknown User"}
                                </span>
                                <span className="text-xs text-gray-500">
                                  {log.userEmail || "No email"}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={`text-xs ${
                                  log.wheelType === 'participant' ? 'border-blue-300 text-blue-700' :
                                  log.wheelType === 'organizer' ? 'border-green-300 text-green-700' :
                                  log.wheelType === 'live' ? 'border-red-300 text-red-700' :
                                  'border-gray-300 text-gray-700'
                                }`}
                              >
                                {log.wheelType === 'participant' ? '👥 Participant' :
                                 log.wheelType === 'organizer' ? '👤 Organizer' :
                                 log.wheelType === 'live' ? '🔴 Live Session' :
                                 log.wheelType || 'Regular'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm">
                              <div className="flex flex-col">
                                <span className="font-medium">{log.wheelName || "Unnamed Wheel"}</span>
                                <span className="text-xs text-gray-500">
                                  {log.numberOfWinners || 0} winner{log.numberOfWinners !== 1 ? 's' : ''}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="secondary"
                                className={`text-xs ${
                                  log.wheelType === 'live' ? 'bg-red-100 text-red-800' :
                                  log.wheelType === 'participant' ? 'bg-blue-100 text-blue-800' :
                                  log.wheelType === 'organizer' ? 'bg-green-100 text-green-800' :
                                  'bg-gray-100 text-gray-800'
                                }`}
                              >
                                {log.wheelType === 'live' ? '🎯 Live Draw' :
                                 log.wheelType === 'participant' ? '🎲 Participant Spin' :
                                 log.wheelType === 'organizer' ? '⚙️ Organizer Spin' :
                                 '🎡 Regular Spin'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-gray-600">
                              <div className="flex flex-col">
                                <span>{log.timestamp.toLocaleDateString()}</span>
                                <span className="text-xs">{log.timestamp.toLocaleTimeString()}</span>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                            <div className="flex flex-col items-center gap-2">
                              <div className="text-2xl">🎯</div>
                              <div className="text-sm">No spin activity found</div>
                              <div className="text-xs">Users haven't used any spin wheels yet</div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>

                {/* Spin Categories Breakdown */}
                {totalSpinLogs > 0 && (
                  <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <h4 className="text-sm font-semibold text-gray-800 mb-3">📊 Spin Activity by Category</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {(() => {
                        const categoryStats = filteredAndSortedSpinLogs.reduce((acc, log) => {
                          const category = log.wheelType || 'regular';
                          acc[category] = (acc[category] || 0) + 1;
                          return acc;
                        }, {} as Record<string, number>);

                        const topCategories = Object.entries(categoryStats)
                          .sort(([,a], [,b]) => b - a)
                          .slice(0, 4);

                        return topCategories.map(([category, count]) => (
                          <div key={category} className="text-center">
                            <div className="text-lg font-bold text-gray-700">{count}</div>
                            <div className="text-xs text-gray-600 capitalize">
                              {category === 'participant' ? '👥 Participants' :
                               category === 'organizer' ? '👤 Organizers' :
                               category === 'live' ? '🔴 Live Sessions' :
                               category === 'regular' ? '🎯 Regular Spins' :
                               category}
                            </div>
                          </div>
                        ));
                      })()}
                    </div>
                  </div>
                )}
              </div>

              {currentSpinLogs.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No spin logs available matching your criteria.
                </p>
              ) : (
                <div className="space-y-4">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableCaption>Comprehensive overview of all users' wheel usage and spin events.</TableCaption>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[150px]">User</TableHead>
                          <TableHead className="w-[200px]">Wheel Name</TableHead>
                          <TableHead className="w-[120px]">Type</TableHead>
                          <TableHead className="w-[150px]">Date/Time</TableHead>
                          <TableHead className="w-[100px]"># Winners</TableHead>
                          <TableHead>Results/Winners</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {currentSpinLogs.map((log) => (
                          <TableRow key={log.id} className="hover:bg-gray-50">
                            <TableCell className="font-medium">
                              <div className="flex flex-col">
                                <span className="text-sm font-semibold text-swu-red">
                                  {log.userName || "Unknown User"}
                                </span>
                                <span className="text-xs text-gray-500">
                                  {log.userEmail || "No email"}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="font-medium">
                              <div className="flex flex-col">
                                <span className="text-sm font-semibold">
                                  {log.wheelName || "Unknown Wheel"}
                                </span>
                                <span className="text-xs text-gray-500">
                                  {log.result || "No result data"}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">
                                {log.wheelType || "Unknown"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm">
                              <div className="flex flex-col">
                                <span>{log.timestamp.toLocaleDateString()}</span>
                                <span className="text-xs text-gray-500">
                                  {log.timestamp.toLocaleTimeString()}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant="secondary" className="text-xs">
                                {log.numberOfWinners || log.winners?.length || 0}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="max-w-[300px]">
                                {log.winners && log.winners.length > 0 ? (
                                  <div className="flex flex-wrap gap-1">
                                    {log.winners.slice(0, 3).map((winner, index) => (
                                      <Badge key={index} variant="default" className="text-xs bg-green-100 text-green-800">
                                        {winner.name}
                                      </Badge>
                                    ))}
                                    {log.winners.length > 3 && (
                                      <Badge variant="outline" className="text-xs">
                                        +{log.winners.length - 3} more
                                      </Badge>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-xs text-gray-500">No winners recorded</span>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Enhanced Pagination */}
                  <div className="flex items-center justify-between pt-4">
                    <div className="text-sm text-muted-foreground">
                      Showing {indexOfFirstSpinLog + 1} to {Math.min(indexOfLastSpinLog, totalSpinLogs)} of {totalSpinLogs} entries
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSpinHistoryPage(Math.max(1, spinHistoryPage - 1))}
                        disabled={spinHistoryPage === 1}
                      >
                        Previous
                      </Button>
                      <div className="flex items-center space-x-1">
                        {Array.from({ length: Math.min(5, totalSpinPages) }, (_, i) => {
                          const pageNum = spinHistoryPage <= 3 ? i + 1 :
                                          spinHistoryPage >= totalSpinPages - 2 ? totalSpinPages - 4 + i :
                                          spinHistoryPage - 2 + i
                          return pageNum > 0 && pageNum <= totalSpinPages ? (
                            <Button
                              key={pageNum}
                              variant={pageNum === spinHistoryPage ? "default" : "outline"}
                              size="sm"
                              className={pageNum === spinHistoryPage ? "bg-swu-red hover:bg-swu-red/90" : ""}
                              onClick={() => setSpinHistoryPage(pageNum)}
                            >
                              {pageNum}
                            </Button>
                          ) : null
                        })}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSpinHistoryPage(Math.min(totalSpinPages, spinHistoryPage + 1))}
                        disabled={spinHistoryPage === totalSpinPages}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </Card>


          </React.Fragment>
        )}

        {activeView === "user-management" && (
          <React.Fragment>
            <div className="flex items-center gap-3 mb-6">
              <h2 className="text-3xl font-bold">User Management</h2>
              {loading && (
                <div className="flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
                  <div className="animate-spin w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                  Refreshing...
                </div>
              )}
            </div>
            <Card className="shadow-md p-6">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
                <CardDescription className="text-muted-foreground">
                
                </CardDescription>
                <div className="flex flex-col md:flex-row items-start md:items-center gap-2">
                  <Input
                    placeholder="Search by email..."
                    value={emailFilter}
                    onChange={(e) => setEmailFilter(e.target.value)}
                    className="w-[200px]"
                  />
                  <Select value={roleFilter} onValueChange={setRoleFilter}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Filter by Role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Roles</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="organizer">Organizer</SelectItem>
                      <SelectItem value="participant">Participant</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={usersPerPage.toString()} onValueChange={(value) => setUsersPerPage(Number(value))}>
                    <SelectTrigger className="w-[120px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">5 per page</SelectItem>
                      <SelectItem value="10">10 per page</SelectItem>
                      <SelectItem value="25">25 per page</SelectItem>
                      <SelectItem value="50">50 per page</SelectItem>
                    </SelectContent>
                  </Select>
                  <Dialog open={isAddUserDialogOpen} onOpenChange={setIsAddUserDialogOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm" className="gap-1 bg-swu-red hover:bg-swu-red/90 text-white">
                        <Plus className="h-4 w-4" />
                        Add Users
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle className="text-swu-red">Add Users - Individual & Bulk Upload</DialogTitle>
                        <DialogDescription>
                          Create new user accounts individually or upload multiple users from Excel/CSV files.
                          <br />
                          <span className="text-xs text-green-600 mt-1 block">
                            ✓ Server-side creation - admin session preserved
                          </span>
                          <span className="text-xs text-blue-600 mt-1 block">
                            ℹ️ All users will be saved to Firebase database
                          </span>
                        </DialogDescription>
                      </DialogHeader>

                      {/* Excel-like Tabbed Interface */}
                      <div className="py-4">
                        <div className="border-b border-gray-200 mb-4">
                          <div className="flex space-x-1">
                            <button
                              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                                activeUserTab === 'individual'
                                  ? 'border-swu-red text-swu-red'
                                  : 'border-transparent text-gray-500 hover:text-gray-700'
                              }`}
                              onClick={() => setActiveUserTab('individual')}
                            >
                              👤 Individual User
                            </button>
                            <button
                              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                                activeUserTab === 'bulk'
                                  ? 'border-swu-red text-swu-red'
                                  : 'border-transparent text-gray-500 hover:text-gray-700'
                              }`}
                              onClick={() => setActiveUserTab('bulk')}
                            >
                              📊 Bulk Upload (Excel/CSV)
                            </button>
                          </div>
                        </div>

                        {/* Individual User Tab */}
                        {activeUserTab === 'individual' && (
                          <div className="space-y-4">
                            <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                              <h4 className="text-sm font-medium text-blue-800 mb-2">📝 Individual User Creation</h4>
                              <p className="text-xs text-blue-600">Create a single user account with manual data entry</p>
                            </div>

                            <div className="grid gap-4">
                              <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                  <Label htmlFor="new-user-first-name" className="text-sm font-medium">First Name *</Label>
                                  <Input
                                    id="new-user-first-name"
                                    type="text"
                                    placeholder="John"
                                    value={newUserFirstName}
                                    onChange={(e) => setNewUserFirstName(e.target.value)}
                                    className="border-gray-300 focus:border-swu-red"
                                    required
                                  />
                                </div>
                                <div className="grid gap-2">
                                  <Label htmlFor="new-user-last-name" className="text-sm font-medium">Last Name *</Label>
                                  <Input
                                    id="new-user-last-name"
                                    type="text"
                                    placeholder="Doe"
                                    value={newUserLastName}
                                    onChange={(e) => setNewUserLastName(e.target.value)}
                                    className="border-gray-300 focus:border-swu-red"
                                    required
                                  />
                                </div>
                              </div>
                              <div className="grid gap-2">
                                <Label htmlFor="new-user-email" className="text-sm font-medium">Email Address *</Label>
                                <Input
                                  id="new-user-email"
                                  type="email"
                                  placeholder="user@example.com"
                                  value={newUserEmail}
                                  onChange={(e) => setNewUserEmail(e.target.value)}
                                  className="border-gray-300 focus:border-swu-red"
                                  required
                                />
                              </div>
                              <div className="grid gap-2">
                                <Label htmlFor="new-user-password" className="text-sm font-medium">Password *</Label>
                                <Input
                                  id="new-user-password"
                                  type="password"
                                  placeholder="Enter temporary password"
                                  value={newUserPassword}
                                  onChange={(e) => setNewUserPassword(e.target.value)}
                                  className="border-gray-300 focus:border-swu-red"
                                  required
                                />
                                <p className="text-xs text-gray-500">User will be prompted to change password on first login</p>
                              </div>
                              <div className="grid gap-2">
                                <Label htmlFor="new-user-role" className="text-sm font-medium">Role *</Label>
                                <Select value={newUserRole} onValueChange={setNewUserRole}>
                                  <SelectTrigger id="new-user-role" className="border-gray-300 focus:border-swu-red">
                                    <SelectValue placeholder="Select user role" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="participant">👥 Participant</SelectItem>
                                    <SelectItem value="organizer">👤 Organizer</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>

                            <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                              <p className="text-xs text-yellow-700">
                                <strong>Note:</strong> Individual user creation is best for adding 1-5 users. For larger groups, use the Bulk Upload tab.
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Bulk Upload Tab */}
                        {activeUserTab === 'bulk' && (
                          <div className="space-y-4">
                            <div className="bg-green-50 p-3 rounded-lg border border-green-200">
                              <h4 className="text-sm font-medium text-green-800 mb-2">📊 Bulk User Upload</h4>
                              <p className="text-xs text-green-600">Upload multiple users from Excel or CSV files with Excel-like data sections</p>
                            </div>

                            {/* Excel-like Data Sections */}
                            <div className="space-y-4">
                              <div className="border rounded-lg p-4 bg-gray-50">
                                <div className="flex items-center justify-between mb-3">
                                  <h5 className="text-sm font-medium text-gray-700">📋 Required Data Format</h5>
                                  <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">
                                    💡 Download template above for easy setup
                                  </span>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                                  <div className="bg-white p-3 rounded border">
                                    <div className="font-medium text-swu-red mb-1">Column A: Name</div>
                                    <div className="text-gray-600">Full name (required)</div>
                                    <div className="text-gray-500 mt-1">Example: John Doe</div>
                                  </div>
                                  <div className="bg-white p-3 rounded border">
                                    <div className="font-medium text-swu-red mb-1">Column B: Email</div>
                                    <div className="text-gray-600">Email address (required)</div>
                                    <div className="text-gray-500 mt-1">Example: john@example.com</div>
                                  </div>
                                  <div className="bg-white p-3 rounded border">
                                    <div className="font-medium text-blue-600 mb-1">Column C: Contact (Optional)</div>
                                    <div className="text-gray-600">Phone/Contact number</div>
                                    <div className="text-gray-500 mt-1">Example: +1234567890</div>
                                  </div>
                                </div>
                                <div className="mt-3 text-xs text-gray-600 bg-yellow-50 p-2 rounded border border-yellow-200">
                                  <strong>Tip:</strong> Use the template download button above to get a properly formatted empty Excel file. Fill it with your actual user information.
                                </div>
                              </div>

                              <div className="grid gap-4">
                                {/* Template Download Section */}
                                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <h5 className="text-sm font-medium text-blue-800 mb-1">📥 Need a Template?</h5>
                                      <p className="text-xs text-blue-600">Download our empty Excel template to get started quickly</p>
                                    </div>
                                    <Button
                                      onClick={downloadExcelTemplate}
                                      variant="outline"
                                      size="sm"
                                      className="border-blue-300 text-blue-700 hover:bg-blue-100"
                                    >
                                      <Download className="h-4 w-4 mr-2" />
                                      Download Template
                                    </Button>
                                  </div>
                                </div>

                                <div className="grid gap-2">
                                  <Label htmlFor="file-upload" className="text-sm font-medium">Select Excel/CSV File *</Label>
                                  <Input
                                    id="file-upload"
                                    type="file"
                                    accept=".csv,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                                    onChange={handleFileChange}
                                    disabled={uploadingFile}
                                    className="border-gray-300 focus:border-swu-red"
                                  />
                                  {uploadFile && (
                                    <div className="flex items-center gap-2 text-sm text-green-600">
                                      <span>✅</span>
                                      <span>Selected: {uploadFile.name}</span>
                                    </div>
                                  )}
                                </div>

                                {parsedData.length > 0 && (
                                  <div className="border rounded-lg p-4 bg-green-50 border-green-200">
                                    <div className="flex items-center justify-between">
                                      <h5 className="text-sm font-medium text-green-800">📊 File Processed</h5>
                                      <Badge variant="outline" className="text-green-600">
                                        {parsedData.length} records ready to upload
                                      </Badge>
                                    </div>
                                    <p className="text-xs text-green-600 mt-2">
                                      File has been validated and is ready for bulk upload.
                                    </p>
                                  </div>
                                )}
                              </div>

                              <div className="bg-orange-50 p-3 rounded-lg border border-orange-200">
                                <p className="text-xs text-orange-700">
                                  <strong>Important:</strong> All uploaded users will be created as "Participant" role with temporary passwords.
                                  They will be prompted to change their password on first login.
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      <DialogFooter className="flex justify-between">
                        <div className="text-xs text-gray-500">
                          {activeUserTab === 'individual' ? 'Creating individual user...' : 'Bulk upload processing...'}
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            onClick={() => setIsAddUserDialogOpen(false)}
                            disabled={addingUser || uploadingFile}
                          >
                            Cancel
                          </Button>
                          <Button
                            onClick={activeUserTab === 'individual' ? handleAddUser : handleFileUpload}
                            disabled={
                              addingUser || uploadingFile ||
                              (activeUserTab === 'individual' && (!newUserFirstName || !newUserLastName || !newUserEmail || !newUserPassword || !newUserRole)) ||
                              (activeUserTab === 'bulk' && !uploadFile)
                            }
                            className="bg-swu-red hover:bg-swu-red/90 text-white"
                          >
                            {addingUser || uploadingFile ? (
                              <div className="flex items-center gap-2">
                                <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                                {activeUserTab === 'individual' ? 'Creating...' : 'Uploading...'}
                              </div>
                            ) : (
                              activeUserTab === 'individual' ? 'Create User' : 'Upload & Create Users'
                            )}
                          </Button>
                        </div>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
              {sortedAndFilteredUsers.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">No user accounts found matching criteria.</p>
              ) : (
                <div className="max-h-[calc(100vh-250px)] overflow-y-auto pr-2">
                  <Table>
                    <TableCaption>Overview of all registered user accounts (admin users excluded for security).</TableCaption>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="cursor-pointer" onClick={() => requestSort("displayName")}>
                          First Name
                          <ArrowUpDown className="ml-2 h-4 w-4 inline" />
                        </TableHead>
                        <TableHead className="cursor-pointer" onClick={() => requestSort("displayName")}>
                          Last Name
                          <ArrowUpDown className="ml-2 h-4 w-4 inline" />
                        </TableHead>
                        <TableHead className="cursor-pointer" onClick={() => requestSort("email")}>
                          Email
                          <ArrowUpDown className="ml-2 h-4 w-4 inline" />
                        </TableHead>
                        <TableHead className="cursor-pointer" onClick={() => requestSort("role")}>
                          Role
                          <ArrowUpDown className="ml-2 h-4 w-4 inline" />
                        </TableHead>
                        <TableHead className="cursor-pointer" onClick={() => requestSort("lastActiveAt")}>
                          Last Active
                          <ArrowUpDown className="ml-2 h-4 w-4 inline" />
                        </TableHead>
                        <TableHead>Device</TableHead>
                        <TableHead className="cursor-pointer" onClick={() => requestSort("createdAt")}>
                          Created At
                          <ArrowUpDown className="ml-2 h-4 w-4 inline" />
                        </TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {currentUsers.map((userItem) => {
                        // Split displayName into first and last name
                        const nameParts = (userItem.displayName || "").split(" ")
                        const firstName = nameParts[0] || ""
                        const lastName = nameParts.slice(1).join(" ") || ""

                        return (
                          <TableRow key={userItem.uid}>
                            <TableCell className="font-medium">{firstName || "Not provided"}</TableCell>
                            <TableCell className="font-medium">{lastName || "Not provided"}</TableCell>
                            <TableCell>{userItem.email}</TableCell>
                            <TableCell className="capitalize">
                              <Badge
                                variant={userItem.role === "admin" ? "destructive" : userItem.role === "organizer" ? "default" : "outline"}
                                className={userItem.role === "organizer" ? "bg-[#2196F3] text-white" : ""}
                              >
                                {userItem.role === "organizer" ? "👤" : userItem.role === "participant" ? "👥" : "👑"} {userItem.role}
                              </Badge>
                            </TableCell>
                            <TableCell>
                             <div className="flex items-center gap-2">
                               <span
                                 className={`h-2.5 w-2.5 rounded-full ${
                                   userItem.isActive ? "bg-green-500" : "bg-red-500"
                                 }`}
                                 title={userItem.isActive ? "Active Now" : "Inactive"}
                               />
                               {formatRelativeTime(userItem.lastActiveAt)}
                             </div>
                            </TableCell>
                          <TableCell>
                            {typeof userItem.lastActiveDevice === "object" && userItem.lastActiveDevice !== null
                              ? (userItem.lastActiveDevice as any).deviceName || "Unknown Device"
                              : userItem.lastActiveDevice || "N/A"}
                          </TableCell>
                          <TableCell>{userItem.createdAt ? userItem.createdAt.toLocaleString() : "N/A"}</TableCell>
                          <TableCell className="flex gap-2">
                            <Dialog
                              open={isEditUserDialogOpen && editingUser?.uid === userItem.uid}
                              onOpenChange={setIsEditUserDialogOpen}
                            >
                              <DialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-blue-500 hover:bg-blue-500/10"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setEditingUser(userItem)
                                    setEditingUserRole(userItem.role)
                                    setEditingUserReason("")  // Reset reason
                                    setIsEditUserDialogOpen(true)
                                  }}
                                >
                                  <Edit className="h-4 w-4" />
                                  <span className="sr-only">Edit User</span>
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="sm:max-w-[425px]">
                                <DialogHeader>
                                  <DialogTitle className="text-swu-red">Edit User: {editingUser?.email}</DialogTitle>
                                  <DialogDescription>Update the role for this user.</DialogDescription>
                                </DialogHeader>
                                <div className="grid gap-4 py-4">
                                  <div className="grid gap-2">
                                    <Label htmlFor="edit-user-role">Role</Label>
                                    <Select value={editingUserRole} onValueChange={setEditingUserRole}>
                                      <SelectTrigger id="edit-user-role">
                                        <SelectValue placeholder="Select Role" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="participant">Participant</SelectItem>
                                        <SelectItem value="organizer">Organizer</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div className="grid gap-2">
                                    <Label htmlFor="edit-user-reason">Reason for Change *</Label>
                                    <Textarea
                                      id="edit-user-reason"
                                      placeholder="Required: Please provide a reason for this role change (for security audit)"
                                      value={editingUserReason}
                                      onChange={(e) => setEditingUserReason(e.target.value)}
                                      className="min-h-[80px]"
                                    />
                                    <div className="text-xs text-muted-foreground">
                                      This reason will be logged for security audit purposes.
                                    </div>
                                  </div>
                                </div>
                                <DialogFooter>
                                  <Button
                                    onClick={handleEditUser}
                                    disabled={updatingUser}
                                    className="bg-swu-red hover:bg-swu-red/90 text-white"
                                  >
                                    {updatingUser ? "Updating..." : "Save Changes"}
                                  </Button>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>

                            {userItem.role !== "admin" && ( // Only show delete button if user is NOT an admin
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-red-500 hover:bg-red-500/10"
                                onClick={() => handleDeleteUser(userItem.uid, userItem.email)}
                              >
                                <Trash2 className="h-4 w-4" />
                                <span className="sr-only">Delete User</span>
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    </TableBody>
                  </Table>
                  <div className="flex flex-col sm:flex-row justify-between items-center mt-4 gap-4">
                    <div className="text-sm text-muted-foreground">
                      Showing {indexOfFirstUser + 1} to {Math.min(indexOfLastUser, sortedAndFilteredUsers.length)} of {sortedAndFilteredUsers.length} users
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => paginate(1)}
                        disabled={currentPage === 1}
                        className="border-swu-red text-swu-red hover:bg-swu-red hover:text-white"
                      >
                        First
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => paginate(currentPage - 1)}
                        disabled={currentPage === 1}
                        className="border-swu-red text-swu-red hover:bg-swu-red hover:text-white"
                      >
                        Previous
                      </Button>

                      {/* Page numbers */}
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum;
                        if (totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (currentPage <= 3) {
                          pageNum = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i;
                        } else {
                          pageNum = currentPage - 2 + i;
                        }

                        return (
                          <Button
                            key={pageNum}
                            variant={currentPage === pageNum ? "default" : "outline"}
                            size="sm"
                            onClick={() => paginate(pageNum)}
                            className={`${currentPage === pageNum ? "bg-swu-red text-white" : "border-swu-red text-swu-red hover:bg-swu-red hover:text-white"}`}
                          >
                            {pageNum}
                          </Button>
                        );
                      })}

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => paginate(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        className="border-swu-red text-swu-red hover:bg-swu-red hover:text-white"
                      >
                        Next
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => paginate(totalPages)}
                        disabled={currentPage === totalPages}
                        className="border-swu-red text-swu-red hover:bg-swu-red hover:text-white"
                      >
                        Last
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </Card>
          </React.Fragment>
        )}


        {activeView === "notifications" && (
          <React.Fragment>
            <div className="max-w-5xl">
              {/* Main Notification Form */}
              <Card className="shadow-md">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg text-swu-red flex items-center gap-2">
                    <Bell className="h-4 w-4" />
                    Create Announcement
                  </CardTitle>
                  <CardDescription className="text-sm">
                    Craft and send notifications instantly
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 p-5">
                  {/* Recipients Section */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-swu-red" />
                      <Label className="text-sm font-semibold">Recipients</Label>
                    </div>

                    <div className="space-y-2">
                      <Select value={emailRecipient} onValueChange={setEmailRecipient}>
                        <SelectTrigger className="h-10 border-swu-red/20 focus:border-swu-red">
                          <SelectValue placeholder="Select recipient group" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">🌐 All Users</SelectItem>
                          <SelectItem value="participants">👥 All Participants</SelectItem>
                          <SelectItem value="organizers">👤 All Organizers</SelectItem>
                        </SelectContent>
                      </Select>

                      <div className="relative">
                        <Input
                          id="recipient-email"
                          type="email"
                          placeholder="Or enter specific email address"
                          value={emailRecipient.includes('@') ? emailRecipient : ''}
                          onChange={(e) => setEmailRecipient(e.target.value)}
                          className="h-10 border-swu-red/20 focus:border-swu-red pl-3 pr-20"
                        />
                        {emailRecipient.includes('@') && (
                          <div className="absolute right-2 top-1/2 -translate-y-1/2">
                            <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200 px-2 py-0.5">
                              ✓ Specific
                            </Badge>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Message Content */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Send className="h-4 w-4 text-swu-red" />
                      <Label className="text-sm font-semibold">Message</Label>
                    </div>

                    <div className="grid gap-3">
                      <div className="space-y-1">
                        <Label htmlFor="email-subject" className="text-xs font-medium">Title *</Label>
                        <Input
                          id="email-subject"
                          type="text"
                          placeholder="Enter announcement title"
                          value={emailSubject}
                          onChange={(e) => setEmailSubject(e.target.value)}
                          className="h-10 border-swu-red/20 focus:border-swu-red"
                          required
                        />
                      </div>

                      <div className="space-y-1">
                        <Label htmlFor="email-message" className="text-xs font-medium">Details *</Label>
                        <Textarea
                          id="email-message"
                          placeholder="Enter your message..."
                          rows={3}
                          value={emailMessage}
                          onChange={(e) => setEmailMessage(e.target.value)}
                          className="border-swu-red/20 focus:border-swu-red resize-none text-sm"
                          required
                        />
                        <p className="text-xs text-muted-foreground">
                          {emailMessage.length}/500 characters
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Notification Settings */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Settings className="h-4 w-4 text-swu-red" />
                      <Label className="text-sm font-semibold">Settings</Label>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <Label htmlFor="notification-type" className="text-xs font-medium">Type</Label>
                        <Select value={notificationType} onValueChange={setNotificationType}>
                          <SelectTrigger id="notification-type" className="h-10 border-swu-red/20 focus:border-swu-red">
                            <SelectValue placeholder="Type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="information">📋 Information</SelectItem>
                            <SelectItem value="warning">⚠️ Warning</SelectItem>
                            <SelectItem value="success">✅ Success</SelectItem>
                            <SelectItem value="urgent">🚨 Urgent</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1">
                        <Label htmlFor="notification-priority" className="text-xs font-medium">Priority</Label>
                        <Select value={notificationPriority} onValueChange={setNotificationPriority}>
                          <SelectTrigger id="notification-priority" className="h-10 border-swu-red/20 focus:border-swu-red">
                            <SelectValue placeholder="Priority" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="low">🔵 Low</SelectItem>
                            <SelectItem value="urgent">🔴 Urgent</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1">
                        <Label htmlFor="notification-duration" className="text-xs font-medium">Duration</Label>
                        <Select value={notificationDuration} onValueChange={setNotificationDuration}>
                          <SelectTrigger id="notification-duration" className="h-10 border-swu-red/20 focus:border-swu-red">
                            <SelectValue placeholder="Duration" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1">1 Day</SelectItem>
                            <SelectItem value="3">3 Days</SelectItem>
                            <SelectItem value="7">1 Week</SelectItem>
                            <SelectItem value="14">2 Weeks</SelectItem>
                            <SelectItem value="30">1 Month</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Compact Settings Info */}
                    <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div className="text-center">
                          <div className="font-medium text-blue-900">Type</div>
                          <div className="text-blue-700">Visual style</div>
                        </div>
                        <div className="text-center">
                          <div className="font-medium text-blue-900">Priority</div>
                          <div className="text-blue-700">Urgent = popup</div>
                        </div>
                        <div className="text-center">
                          <div className="font-medium text-blue-900">Duration</div>
                          <div className="text-blue-700">Auto-expiry</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Send Button */}
                  <div className="pt-4 border-t border-gray-200">
                    <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
                      <Button
                        onClick={handleSendEmail}
                        disabled={sendingEmail || !emailRecipient || !emailSubject || !emailMessage || !notificationDuration || !notificationPriority || !notificationType}
                        className="bg-swu-red hover:bg-swu-red/90 text-white font-medium h-11 px-6"
                      >
                        {sendingEmail ? (
                          <div className="flex items-center gap-2">
                            <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                            <span>Sending...</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <Send className="h-4 w-4" />
                            <span>Send Notification</span>
                          </div>
                        )}
                      </Button>

                      {/* Success/Error States */}
                      {emailRecipient && emailSubject && emailMessage && (
                        <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-md">
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          <span className="text-sm text-green-800 font-medium">Ready to send</span>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </React.Fragment>
        )}

        {activeView === "my-profile" && (
          <React.Fragment>
            <div className="mb-6">
              <h2 className="text-3xl font-bold">My Profile</h2>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              {/* Account Information */}
              <Card className="shadow-md">
                <CardHeader>
                  <CardTitle className="text-lg text-swu-red flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Account Information
                  </CardTitle>
                  <CardDescription>Your account details and role information</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <span className="font-medium">Email:</span>
                      <span className="text-swu-red font-medium">{user.email}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <span className="font-medium">Role:</span>
                      <Badge variant="default" className="bg-swu-red">
                        {userRole?.toUpperCase()}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <span className="font-medium">Account Created:</span>
                      <span className="text-sm text-muted-foreground">
                        {user.metadata?.creationTime ? new Date(user.metadata.creationTime).toLocaleDateString() : "Unknown"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <span className="font-medium">Last Sign In:</span>
                      <span className="text-sm text-muted-foreground">
                        {user.metadata?.lastSignInTime ? new Date(user.metadata.lastSignInTime).toLocaleDateString() : "Unknown"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <span className="font-medium">Email Verified:</span>
                      <Badge variant={user.emailVerified ? "default" : "secondary"} className={user.emailVerified ? "bg-green-500" : ""}>
                        {user.emailVerified ? "✓ Verified" : "⚠ Not Verified"}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <span className="font-medium">Account ID:</span>
                      <span className="text-xs text-muted-foreground font-mono">{user.uid}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Change Password */}
              <Card className="shadow-md">
                <CardHeader>
                  <CardTitle className="text-lg text-swu-red">Change Password</CardTitle>
                  <CardDescription>Update your account password for security</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="current-password">Current Password</Label>
                      <Input
                        id="current-password"
                        type="password"
                        placeholder="Enter current password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        disabled={changingPassword}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="new-password">New Password</Label>
                      <Input
                        id="new-password"
                        type="password"
                        placeholder="Enter new password (min 6 characters)"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        disabled={changingPassword}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="confirm-password">Confirm New Password</Label>
                      <Input
                        id="confirm-password"
                        type="password"
                        placeholder="Confirm new password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        disabled={changingPassword}
                      />
                    </div>

                    <Button
                      onClick={handlePasswordChange}
                      disabled={changingPassword || !currentPassword || !newPassword || !confirmPassword}
                      className="w-full bg-swu-red hover:bg-red-700"
                    >
                      {changingPassword ? "Updating..." : "Update Password"}
                    </Button>

                    <div className="text-xs text-muted-foreground">
                      <p>• Password must be at least 6 characters long</p>
                      <p>• You will need to sign in again after changing your password</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </React.Fragment>
        )}

        {activeView === "wheel-types" && (
          <React.Fragment>
            <h2 className="text-3xl font-bold mb-6">Activity Wheel Type Management</h2>
            <WheelTypeManager />
          </React.Fragment>
        )}

        {activeView === "announcements" && (
          <React.Fragment>
            <h2 className="text-3xl font-bold mb-6">Send Notifications</h2>
            <AnnouncementManager user={user} />
          </React.Fragment>
        )}

        {/* File Upload functionality has been moved to the combined Add Users dialog */}

        {activeView === "super-admin" && user.email === process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAIL && (
          <React.Fragment>
            <h2 className="text-3xl font-bold mb-6">Super Admin Settings</h2>
            <SuperAdminManager userEmail={user.email!} />
          </React.Fragment>
        )}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <p className="text-lg text-swu-red">Loading admin dashboard...</p>
      </div>
    )
  }

  return (
    <SidebarProvider>
      <Sidebar collapsible="none" side="left" className="border-r border-gray-200">
        <SidebarHeader className="p-4 pb-2">
          <div
            className="flex items-center gap-2 text-lg font-bold text-swu-red cursor-pointer"
            onClick={() => setActiveView("overview")}
          >
            <LayoutDashboard className="h-6 w-6" />
            Coby Picks Dashboard
          </div>
        </SidebarHeader>
        <SidebarContent className="p-2">
          <p className="text-sm font-semibold text-muted-foreground px-2 py-2">Navigation</p>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={activeView === "overview"}
                onClick={() => setActiveView("overview")}
                className="text-sm font-medium"
              >
                <LayoutDashboard />
                <span>Dashboard</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={activeView === "user-management"}
                onClick={() => setActiveView("user-management")}
                className="text-sm font-medium"
              >
                <UserCog />
                <span>Manage Users</span>
              </SidebarMenuButton>
            </SidebarMenuItem>

            {/* My Profile removed from navigation - account info now in main header */}

            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={activeView === "wheel-types"}
                onClick={() => setActiveView("wheel-types")}
                className="text-sm font-medium"
              >
                <Settings className="h-4 w-4" />
                <span>Wheel Preset</span>
              </SidebarMenuButton>
            </SidebarMenuItem>

            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={activeView === "notifications"}
                onClick={() => setActiveView("notifications")}
                className="text-sm font-medium"
              >
                <Bell className="h-4 w-4" />
                <span>Notifications</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            {/* File Upload functionality has been integrated into Add Users dialog */}
            {/* Logout and Super Admin removed from navigation - now in head logo dropdown */}
          </SidebarMenu>
        </SidebarContent>
      </Sidebar>
      <SidebarInset className="bg-gray-50">
        <header className="flex h-16 shrink-0 items-center justify-end gap-2 border-b px-4">
          <div className="flex items-center gap-3">
            {/* Head-shaped Logo with Dropdown Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="relative h-12 w-12 hover:bg-gray-100 transition-colors p-0"
                >
                  {/* Simple Person Icon */}
                  <User className="h-10 w-10 text-swu-red" />
                  <ChevronDown className="absolute -bottom-1 -right-1 h-4 w-4 text-gray-600" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                {/* User Profile Section */}
                <div className="px-4 py-3 border-b border-gray-200">
                  <div className="flex items-center gap-3">
                    <User className="h-8 w-8 text-swu-red" />
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-gray-900">
                        {user.displayName || user.email?.split('@')[0] || 'Admin User'}
                      </span>
                      <span className="text-xs text-gray-500">{user.email}</span>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <Badge variant="default" className="bg-swu-red text-xs">
                      {userRole?.toUpperCase()}
                    </Badge>
                    <span className="text-xs text-gray-500">
                      Created: {user.metadata?.creationTime ? new Date(user.metadata.creationTime).toLocaleDateString() : "Unknown"}
                    </span>
                  </div>
                </div>

                {/* Menu Items */}
                <DropdownMenuItem
                  className="cursor-pointer py-3 px-4 hover:bg-gray-50"
                  onClick={() => {
                    setShowProfileSection(true);
                    setActiveView("my-profile");
                  }}
                >
                  <User className="mr-3 h-4 w-4 text-swu-red" />
                  <span>My Profile</span>
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                <DropdownMenuItem
                  className="cursor-pointer py-3 px-4 hover:bg-red-50 text-red-600"
                  onClick={handleLogout}
                >
                  <LogOut className="mr-3 h-4 w-4" />
                  <span>Logout</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

          </div>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-6">{renderMainContent()}</div>
      </SidebarInset>
    </SidebarProvider>
  )
}


