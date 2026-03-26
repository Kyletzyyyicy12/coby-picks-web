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
import { sendEmailNotification, sendUserWelcomeEmail } from "@/lib/admin-actions"
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
import { Checkbox } from "@/components/ui/checkbox"
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

// Type assertion to fix TypeScript issue with WheelTypeManager
const TypedWheelTypeManager = WheelTypeManager as React.ComponentType
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
  participants?: number  // Added: for participant count
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
  isImport?: boolean // Added: to indicate if user was imported via bulk upload
}

interface AdminDashboardData {
  totalUsers: number
  totalSpins: number
  activeNow: number
  wheelCreated: number
  recentSpinLogs: SpinLog[]
  allUsers: UserData[]
  totalActivities: number
  totalWheels: number
  totalStudentLists: number
  totalLiveSessions: number
  wheelTypes: { [value: string]: string } // Mapping from wheel type value to label
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

  // Bulk delete states
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set())
  const [isBulkDeleting, setIsBulkDeleting] = useState(false)
  const [showUserCheckboxes, setShowUserCheckboxes] = useState(false)

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

  // Professional Excel template download function with proper formatting
  const downloadExcelTemplate = async () => {
    try {
      console.log('Creating Excel template with role column...')

      // Import ExcelJS dynamically to avoid bundle issues
      const ExcelJS = (await import('exceljs')).default

      // Create workbook and worksheet using ExcelJS
      const workbook = new ExcelJS.Workbook()
      const worksheet = workbook.addWorksheet('User Template')

      // Define the data with headers including role column
      const headers = ['First Name', 'Last Name', 'Email', 'Password', 'Role']

      // Add headers
      worksheet.addRow(headers)

      // Set column widths
      worksheet.getColumn(1).width = 20 // First Name
      worksheet.getColumn(2).width = 20 // Last Name
      worksheet.getColumn(3).width = 35 // Email
      worksheet.getColumn(4).width = 15 // Password
      worksheet.getColumn(5).width = 15 // Role

      // Style the header row (row 1)
      const headerRow = worksheet.getRow(1)
      headerRow.height = 25

      // Apply maroon background and white text to header cells
      headerRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF800000' } }
      headerRow.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF800000' } }
      headerRow.getCell(3).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF800000' } }
      headerRow.getCell(4).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF800000' } }
      headerRow.getCell(5).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF800000' } }

      headerRow.getCell(1).font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 12 }
      headerRow.getCell(2).font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 12 }
      headerRow.getCell(3).font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 12 }
      headerRow.getCell(4).font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 12 }
      headerRow.getCell(5).font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 12 }

      headerRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' }
      headerRow.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' }
      headerRow.getCell(3).alignment = { horizontal: 'center', vertical: 'middle' }
      headerRow.getCell(4).alignment = { horizontal: 'center', vertical: 'middle' }
      headerRow.getCell(5).alignment = { horizontal: 'center', vertical: 'middle' }



      // Generate and download the file
      const buffer = await workbook.xlsx.writeBuffer()
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      })

      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'coby_picks_user_template.xlsx'
      link.click()
      URL.revokeObjectURL(url)

      toast({
        title: "Professional Excel Template Downloaded Successfully",
        description: "Excel template downloaded with maroon headers and role column. Fill in your user data with specific roles (organizer).",
        duration: 6000,
      })

    } catch (error) {
      console.error('Error creating Excel template:', error)
      toast({
        title: "Error",
        description: "Failed to create Excel template. Please try again.",
        variant: "destructive"
      })
    }
  }

  // Helper function to parse Excel files
  const parseExcelFile = async (file: File): Promise<any[]> => {
    console.log('Starting Excel file parsing...')
    const ExcelJS = (await import('exceljs')).default
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(await file.arrayBuffer())

    const worksheet = workbook.worksheets[0] // Get first worksheet
    console.log('Worksheet loaded, name:', worksheet.name)
    const data: any[] = []

    // Get headers from first row
    const headerRow = worksheet.getRow(1)
    const headers: string[] = []
    headerRow.eachCell((cell, colNumber) => {
      const cellValue = cell.value?.toString() || ''
      headers.push(cellValue)
      console.log(`Header ${colNumber}: "${cellValue}"`)
    })
    console.log('All headers:', headers)

    // Parse data rows (skip header row)
    let rowCount = 0
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return // Skip header row

      const rowData: any = {}
      let hasData = false

      row.eachCell((cell, colNumber) => {
        const header = headers[colNumber - 1]
        if (header) {
          // Handle different cell value types properly
          let cellValue = ''
          if (cell.value !== null && cell.value !== undefined) {
            // Check if it's a rich text value
            if (typeof cell.value === 'object' && cell.value !== null && 'richText' in cell.value) {
              const richTextValue = cell.value as any
              cellValue = richTextValue.richText?.map((rt: any) => rt.text || '').join('') || ''
            }
            // Check if it's a hyperlink or formula with text
            else if (typeof cell.value === 'object' && cell.value !== null && 'text' in cell.value) {
              const textValue = cell.value as any
              cellValue = textValue.text || ''
            }
            // Check if it's a formula with result
            else if (typeof cell.value === 'object' && cell.value !== null && 'result' in cell.value) {
              const formulaValue = cell.value as any
              cellValue = formulaValue.result !== undefined ? String(formulaValue.result) : ''
            }
            // For all other cases, convert to string
            else {
              cellValue = String(cell.value)
            }
          }

          rowData[header] = cellValue.trim()
          if (cellValue.trim()) hasData = true
        }
      })

      // Only add rows that have some data
      if (hasData) {
        data.push(rowData)
        rowCount++
        console.log(`Row ${rowNumber} data:`, rowData)
      }
    })

    console.log(`Parsed ${rowCount} data rows from Excel file`)
    return data
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
          isImport: data.isImport || false, // Add import status
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

      // Fetch wheel types for mapping and count
      const wheelTypesSnapshot = await getDocs(collection(db, "wheelTypes"))
      const wheelTypesCount = wheelTypesSnapshot.docs.length
      console.log("Total Wheel Types (presets) fetched:", wheelTypesCount)

      // Create mapping from wheel type value to label
      const wheelTypesMap: { [value: string]: string } = {}
      wheelTypesSnapshot.docs.forEach((doc) => {
        const data = doc.data()
        wheelTypesMap[data.value] = data.label
      })
      console.log("Wheel Types Mapping:", wheelTypesMap)

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

          // Create descriptive wheel name showing activity and wheel type
          const wheelType = wheelData.type || logData.wheelType || 'participant'
          const wheelTypeLabel = dashboardData?.wheelTypes?.[wheelType] || wheelType

          // Start with the original wheel name but clean up excessive prefixes
          let activityName = wheelData.name || "Unnamed Wheel"

          // Clean common generic prefixes but keep the custom activity content
          activityName = activityName
            .replace(/^Custom(?:\s+Wheel)?\s+Activity\s*/i, '')
            .replace(/\s*Activity\s+Activity\s*/gi, ' Activity')
            .replace(/\s*Activity\s*$/i, '')
            .trim()

          // Create descriptive name showing both activity and wheel type
          let cleanWheelName = activityName

          // If it's a meaningful custom activity name, show it with wheel type
          if (cleanWheelName && !cleanWheelName.toLowerCase().includes('unnamed') && !cleanWheelName.toLowerCase().includes('unknown')) {
            // Format: "Activity Name (Wheel Type)"
            const typeFormatted = wheelTypeLabel.charAt(0).toUpperCase() + wheelTypeLabel.slice(1).toLowerCase()
            cleanWheelName = `${cleanWheelName} (${typeFormatted})`
          } else {
            // Fallback for generic names - show wheel type prominently
            cleanWheelName = `${wheelTypeLabel.charAt(0).toUpperCase() + wheelTypeLabel.slice(1).toLowerCase()} Wheel`
          }

          // Enhanced winner and participant count calculation
          // For team picker wheels, participants might be stored differently
          let numberOfWinners = logData.numberOfWinners || 0
          let participantCount = logData.participantCount || logData.participants?.length || 0
          let winners = logData.winners || []

          // If winners array is present but numberOfWinners isn't, use array length
          if (winners.length > 0 && numberOfWinners === 0) {
            numberOfWinners = winners.length
          }

          // For team picker wheels, check if we have team data
          if (wheelData.type === 'team-picker' && logData.teams) {
            participantCount = logData.teams.length || participantCount
            // Winners for team pickers might be picked teams
            if (logData.pickedTeams && logData.pickedTeams.length > 0) {
              numberOfWinners = logData.pickedTeams.length
              winners = logData.pickedTeams.map((team: any) => ({ name: team.name || team }))
            }
          }

          // Default to wheel participants if available (for saved wheels)
          if (participantCount === 0 && wheelData.data?.participants?.length > 0) {
            participantCount = wheelData.data.participants.length
          }

          // Ensure participant count is at least the number of winners
          if (participantCount < numberOfWinners) {
            participantCount = numberOfWinners
          }

          allSpinLogs.push({
            id: logDoc.id,
            timestamp: timestamp,
            numberOfWinners: numberOfWinners,
            winners: winners,
            participants: participantCount, // Add participant count for better tracking
            wheelType: logData.wheelType || "participant",
            wheelName: cleanWheelName,
            userEmail: logData.userEmail || wheelData.userEmail || "Unknown User",
            userName: logData.userName || wheelData.userName || "Unknown",
            result: logData.result || (winners && winners.length > 0 ? winners.map((w: any) => w.name || w).join(", ") : "No result")
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
        wheelCreated: wheelTypesCount,
        recentSpinLogs,
        allUsers,
        totalActivities,
        totalWheels: wheelsSnapshot.docs.length,
        totalStudentLists,
        totalLiveSessions,
        wheelTypes: wheelTypesMap,
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
          priority: notificationPriority as "low" | "medium" | "urgent",
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

  // Bulk delete handler for multiple users
  const handleBulkDeleteUsers = async () => {
    if (selectedUsers.size === 0) {
      toast({
        title: "No Users Selected",
        description: "Please select users to delete.",
        variant: "destructive",
      })
      return
    }

    const selectedUsersArray = Array.from(selectedUsers)
    const confirmMessage = `Are you sure you want to permanently delete ${selectedUsersArray.length} user(s)? This action cannot be undone.`

    if (!confirm(confirmMessage)) {
      console.log(`🛑 Bulk user deletion cancelled`)
      return
    }

    setIsBulkDeleting(true)
    let successCount = 0
    let errorCount = 0

    try {
      for (const userId of selectedUsersArray) {
        const user = sortedAndFilteredUsers.find(u => u.uid === userId)
        if (!user) continue

        // Check protection for each user
        const protectionCheck = canDeleteUser(user.email, userId)
        if (!protectionCheck.canDelete) {
          logAdminProtection('BULK_USER_DELETE_ATTEMPT', user.email, protectionCheck.reason || 'Protected admin account')
          errorCount++
          continue
        }

        try {
          await deleteDoc(doc(db, "users", userId))
          console.log(`✅ Successfully deleted user: ${user.email}`)
          successCount++
        } catch (error: any) {
          console.error(`❌ Error deleting user ${user.email}:`, error)
          logAdminProtection('BULK_DELETE_ERROR', user.email, `Deletion failed: ${error.message}`)
          errorCount++
        }
      }

      // Clear selection
      setSelectedUsers(new Set())

      // Show results
      if (successCount > 0) {
        toast({
          title: "Bulk Delete Completed",
          description: `Successfully deleted ${successCount} user(s)${errorCount > 0 ? `, ${errorCount} failed` : ''}.`,
        })

        // Refresh data
        await fetchAdminData()
      } else {
        toast({
          title: "Bulk Delete Failed",
          description: `Failed to delete any users. Check the console for details.`,
          variant: "destructive",
        })
      }
    } catch (error: any) {
      console.error("Error in bulk delete:", error)
      toast({
        title: "Bulk Delete Error",
        description: error.message || "An unexpected error occurred during bulk delete.",
        variant: "destructive",
      })
    } finally {
      setIsBulkDeleting(false)
    }
  }

  // Handle select all checkbox
  const handleSelectAllUsers = (checked: boolean) => {
    if (checked) {
      const allUserIds = new Set(sortedAndFilteredUsers
        .filter(user => user.role !== "admin") // Don't allow selecting admin users
        .map(user => user.uid))
      setSelectedUsers(allUserIds)
    } else {
      setSelectedUsers(new Set())
    }
  }

  // Handle individual user selection
  const handleSelectUser = (userId: string, checked: boolean) => {
    const newSelected = new Set(selectedUsers)
    if (checked) {
      newSelected.add(userId)
    } else {
      newSelected.delete(userId)
    }
    setSelectedUsers(newSelected)
  }

  // Toggle user selection mode
  const toggleUserSelectMode = () => {
    if (showUserCheckboxes) {
      // Exiting select mode, clear selections
      setSelectedUsers(new Set())
    }
    setShowUserCheckboxes(!showUserCheckboxes)
  }

  // Client-side fallback removed to prevent authentication redirection issues
  // All user creation now happens server-side via Firebase Admin SDK

  const handleAddUser = async () => {
    const trimmedFirst = newUserFirstName.trim()
    const trimmedLast = newUserLastName.trim()
    const trimmedEmail = newUserEmail.trim().toLowerCase()

    if (!trimmedFirst || !trimmedLast || !trimmedEmail || !newUserPassword || !newUserRole) {
      toast({
        title: "Missing Information",
        description: "Please fill in all fields (First Name, Last Name, Email, Password, Role).",
        variant: "destructive",
      })
      return
    }

    // Validate password length
    if (newUserPassword.length < 7) {
      toast({
        title: "Password Too Short",
        description: "Password must be at least 7 characters long.",
        variant: "destructive",
      })
      return
    }

    setAddingUser(true)
    try {
      // Combine first and last name for full name
      const fullName = `${trimmedFirst} ${trimmedLast}`

      // Using Firebase Admin SDK for real user creation
      const response = await fetch('/api/admin/create-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: fullName,
          email: trimmedEmail,
          password: newUserPassword,
          role: newUserRole,
          adminEmail: user.email,
          needsPasswordReset: true, // Flag that they need to reset password
          isImport: false, // Individual user creation
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
      
      // Send welcome email asynchronously (non-blocking)
      sendUserWelcomeEmail(
        newUserEmail,
        fullName,
        newUserPassword,
        newUserRole,
        user.email || "admin@cobypicks.com"
      ).then((emailResult) => {
        if (!emailResult.success) {
          console.warn(`⚠️ Failed to send welcome email for ${newUserEmail}: ${emailResult.message}`)
        }
      }).catch((emailError) => {
        console.warn(`⚠️ Error sending welcome email for ${newUserEmail}:`, emailError)
      })

      toast({
        title: "User Added Successfully",
        description: `User ${trimmedEmail} has been created with role ${newUserRole}. Welcome email sent with login credentials. Refreshing user list...`,
      })

      // Keep the UI snappy: close dialog and clear form immediately
      setIsAddUserDialogOpen(false)
      setNewUserFirstName("")
      setNewUserLastName("")
      setNewUserEmail("")
      setNewUserPassword("")
      setNewUserRole("participant")

      // Stay on user management view
      setActiveView("user-management")

      // Refresh in background to keep button responsive
      ;(async () => {
        setLoading(true)
        try {
          await fetchAdminData()
          setActiveView("user-management")
          toast({
            title: "User Added to List",
            description: `✅ ${trimmedEmail} is now visible in the user management table.`,
            duration: 3000,
          })
          console.log('✅ User management view refreshed with new user')
        } catch (refreshError) {
          console.error('Error refreshing admin data:', refreshError)
        } finally {
          setLoading(false)
        }
      })()

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
    console.log('Starting fast, optimized bulk upload process...')

    if (!uploadFile) {
      console.log('No file selected')
      toast({
        title: "No File Selected",
        description: "Please select a CSV or Excel file to upload.",
        variant: "destructive",
      })
      return
    }

    // Fast file size check (5MB limit)
    const maxSize = 5 * 1024 * 1024 // 5MB
    if (uploadFile.size > maxSize) {
      toast({
        title: "File Too Large",
        description: "Please upload a file smaller than 5MB.",
        variant: "destructive",
      })
      return
    }

    console.log('File selected:', uploadFile.name, uploadFile.size, 'bytes')
    setUploadingFile(true)

    try {
      // Pre-validation: Determine file type
      const fileName = uploadFile.name.toLowerCase()
      if (!fileName.endsWith('.csv') && !fileName.endsWith('.xlsx') && !fileName.endsWith('.xls')) {
        throw new Error('Unsupported file format. Please upload a CSV or Excel file.')
      }

      // Fast parsing phase
      let rawData: any[] = []
      try {
        if (fileName.endsWith('.csv')) {
          rawData = await new Promise((resolve, reject) => {
            Papa.parse(uploadFile, {
              header: true,
              skipEmptyLines: true,
              complete: (results: ParseResult<any>) => {
                if (results.errors && results.errors.length > 0) {
                  reject(new Error(`CSV parsing error: ${results.errors[0].message}`))
                } else {
                  resolve(results.data as any[])
                }
              },
              error: (error: any) => reject(new Error(`CSV parsing error: ${error.message}`))
            })
          })
        } else {
          rawData = await parseExcelFile(uploadFile)
        }
      } catch (parseError: any) {
        throw new Error(`File parsing failed: ${parseError?.message || 'Unknown parsing error'}`)
      }

      if (rawData.length === 0) {
        toast({
          title: "Empty File",
          description: "The uploaded file contains no data.",
          variant: "destructive",
        })
        return
      }

      // Fast validation phase - check headers first
      const headers = Object.keys(rawData[0] || {})
      const requiredColumns = ['firstname', 'lastname', 'email', 'password', 'role']

      // Flexible column matching
      const findColumnName = (possibleNames: string[]): string | null => {
        for (const name of possibleNames) {
          const found = headers.find(header =>
            header.toLowerCase().includes(name.toLowerCase()) ||
            header.toLowerCase().replace(' ', '') === name.toLowerCase() ||
            header.toLowerCase() === name.toLowerCase()
          )
          if (found) return found
        }
        return null
      }

      const columnMapping = {
        firstname: findColumnName(['firstname', 'firstName', 'First Name', 'first name', 'FirstName']),
        lastname: findColumnName(['lastname', 'lastName', 'Last Name', 'last name', 'LastName']),
        email: findColumnName(['email', 'Email', 'email address', 'Email Address']),
        password: findColumnName(['password', 'Password']),
        role: findColumnName(['role', 'Role', 'userrole', 'UserRole', 'user_role', 'User Role'])
      }

      console.log('Column mapping:', columnMapping)

      const missingColumns = requiredColumns.filter(col => !columnMapping[col as keyof typeof columnMapping])
      if (missingColumns.length > 0) {
        toast({
          title: "Missing Required Columns",
          description: `The file must contain columns for: ${missingColumns.join(', ')}. Found columns: ${headers.join(', ')}`,
          variant: "destructive",
        })
        return
      }

      // Fast filtering: Remove invalid/empty rows and validate required fields
      const validRows = rawData.filter((row, index) => {
        const getColumnValue = (columnName: string): string => {
          const mappedColumn = columnMapping[columnName as keyof typeof columnMapping]
          if (mappedColumn && row[mappedColumn] !== undefined && row[mappedColumn] !== null) {
            return String(row[mappedColumn]).trim()
          }
          return ''
        }

        const firstname = getColumnValue('firstname')
        const lastname = getColumnValue('lastname')
        const email = getColumnValue('email')
        const password = getColumnValue('password')

        // Basic validation checks
        if (!firstname || !lastname || !email || password.length < 6) {
          console.log(`Skipping invalid row ${index + 1}: incomplete data`)
          return false
        }

        // Fast email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(email)) {
          console.log(`Skipping row ${index + 1}: invalid email ${email}`)
          return false
        }

        return true
      })

      const totalValidRows = validRows.length
      console.log(`Found ${totalValidRows} valid rows out of ${rawData.length} total rows`)

      if (totalValidRows === 0) {
        toast({
          title: "No Valid Data",
          description: "The file contains no valid user data. Check your column headers and data format.",
          variant: "destructive",
        })
        return
      }

      // Success counter and batch processing
      let successCount = 0
      let errorCount = 0
      let duplicateCount = 0
      const errors: string[] = []
      const duplicates: string[] = []

      // Create user accounts in optimized batches
      const batchSize = 10 // Process 10 users at a time
      const batches = []

      for (let i = 0; i < validRows.length; i += batchSize) {
        batches.push(validRows.slice(i, i + batchSize))
      }

      console.log(`Processing ${batches.length} batches of up to ${batchSize} users each...`)

      // Process batches concurrently for better performance
      for (const batch of batches) {
        const batchPromises = batch.map(async (row) => {
          const getColumnValue = (columnName: string): string => {
            const mappedColumn = columnMapping[columnName as keyof typeof columnMapping]
            return mappedColumn ? String(row[mappedColumn]).trim() : ''
          }

          const firstname = getColumnValue('firstname')
          const lastname = getColumnValue('lastname')
          const email = getColumnValue('email')
          const password = getColumnValue('password')
          const csvRole = getColumnValue('role').toLowerCase()

          // Validate role from CSV - allow both 'organizer' and 'participant' (case insensitive)
          const normalizedRole = csvRole.toLowerCase().trim()
          const validRole = normalizedRole === 'organizer' ? 'organizer' :
                           normalizedRole === 'participant' ? 'participant' : 'organizer' // Default to organizer if invalid

          try {
            // Use the role from CSV file
            const userData = {
              name: `${firstname} ${lastname}`,
              email: email.toLowerCase().trim(), // Normalize email to lowercase
              password: password.trim(),
              role: validRole, // Use role from CSV file
              adminEmail: user.email,
              needsPasswordReset: true,
              isImport: true,
            }

            const response = await fetch('/api/admin/create-user', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(userData),
            })

            const result = await response.json()

            if (!response.ok) {
              if (response.status === 409) {
                duplicateCount++
                duplicates.push(email)
              } else {
                throw new Error(result.error || 'Failed to create user')
              }
            } else {
              successCount++
              // Return success for email processing
              return { email: email, firstname: firstname, lastname: lastname, success: true }
            }

          } catch (error: any) {
            errorCount++
            const errorMessage = error.message || 'Unknown error'

            if (errorMessage.includes('already exists') || errorMessage.includes('409')) {
              duplicateCount++
              duplicates.push(email)
            } else {
              errors.push(`Error creating user: ${errorMessage}`)
            }

            return { email: email, success: false, error: errorMessage }
          }
        })

        // Wait for batch to complete
        const batchResults = await Promise.all(batchPromises)
        console.log(`Completed batch with ${batchResults.filter(r => r?.success).length} successes`)
      }

      // Send emails in non-blocking parallel fashion for successful users
      setParsedData(validRows)

      console.log('Upload processing complete:', { successCount, duplicateCount, errorCount, totalRows: totalValidRows })

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
          title: "Import Completed",
          description: `${message}. Users are now available in the system.`,
          duration: 4000,
        })

        // Show loading state while refreshing
        setLoading(true)

        try {
          // Refresh admin data to show new users immediately
          console.log(`🔄 Refreshing admin data to show ${successCount} new users...`)

          // Brief delay to ensure user documents are written
          await new Promise(resolve => setTimeout(resolve, 100))

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
          description: `All ${duplicateCount} users in the file already exist in the system. No new users were created.`,
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

    } catch (error: any) {
      setUploadingFile(false)
      toast({
        title: "Upload Error",
        description: error.message || "An unexpected error occurred during file upload.",
        variant: "destructive",
      })
    } finally {
      // Always reset uploading state
      setUploadingFile(false)
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

              {/* Wheel Created card */}
              <Card className="shadow-md border-l-4 border-l-blue-500">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg font-semibold flex items-center gap-2">
                    Wheel Created
                    <div className="w-2 h-2 bg-blue-500 rounded-full" />
                  </CardTitle>
                  <CardDescription className="text-sm text-muted-foreground">
                    Total wheel type presets available
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-4xl font-bold text-blue-600">
                    {dashboardData?.wheelCreated || 0}
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    Wheel type presets managed
                  </div>
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
                          <TableHead className="w-[120px]"># Joined</TableHead>
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
                                {dashboardData?.wheelTypes?.[log.wheelType || ''] || log.wheelType || "Unknown"}
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
                            <TableCell className="text-center">
                              <Badge variant="outline" className="text-xs">
                                {log.participants || log.numberOfWinners || log.winners?.length || 0}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="max-w-[300px]">
                                {log.winners && log.winners.length > 0 ? (
                                  <div className="flex flex-wrap gap-1">
                                    {log.winners.slice(0, 3).map((winner, index) => (
                                      <Badge key={index} variant="default" className="text-xs bg-green-100 text-green-800">
                                        {typeof winner === 'string' ? winner : winner.name}
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
                  {selectedUsers.size > 0 && (
                    <Button
                      onClick={handleBulkDeleteUsers}
                      disabled={isBulkDeleting}
                      variant="destructive"
                      size="sm"
                    >
                      {isBulkDeleting ? (
                        <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  )}
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
                  <Button
                    onClick={toggleUserSelectMode}
                    variant={showUserCheckboxes ? "default" : "outline"}
                    size="sm"
                  >
                    {showUserCheckboxes ? "Cancel" : "Select"}
                  </Button>
                  <Dialog open={isAddUserDialogOpen} onOpenChange={setIsAddUserDialogOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm" className="gap-1 bg-swu-red hover:bg-swu-red/90 text-white">
                        <Plus className="h-4 w-4" />
                        Add Users
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
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
                              👤 Individual User Creation
                            </button>
                            <button
                              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                                activeUserTab === 'bulk'
                                  ? 'border-swu-red text-swu-red'
                                  : 'border-transparent text-gray-500 hover:text-gray-700'
                              }`}
                              onClick={() => setActiveUserTab('bulk')}
                            >
                              📊 Bulk Upload System (Excel/CSV)
                            </button>
                          </div>
                        </div>

                        {/* Individual User Tab */}
                        {activeUserTab === 'individual' && (
                          <div className="space-y-4">
                            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                              <h4 className="text-sm font-semibold text-blue-800 mb-2">📝 Individual User Account Creation</h4>
                              <p className="text-sm text-blue-700">Create a single user account through manual data entry with comprehensive validation</p>
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
                                  placeholder="Enter temporary password (minimum 7 characters)"
                                  value={newUserPassword}
                                  onChange={(e) => setNewUserPassword(e.target.value)}
                                  className="border-gray-300 focus:border-swu-red"
                                  required
                                />
                                <p className="text-xs text-gray-500">User will receive welcome email with login credentials and be prompted to change password and add recovery email on first login. Password must be at least 7 characters long.</p>
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
                              <p className="text-xs text-green-600">Upload multiple users from CSV files with structured data columns</p>
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
                              <div className="grid grid-cols-1 md:grid-cols-5 gap-4 text-xs">
                                <div className="bg-white p-3 rounded border">
                                  <div className="font-medium text-swu-red mb-1">Column A: First Name</div>
                                  <div className="text-gray-600">First name (required)</div>
                                  <div className="text-gray-500 mt-1">Example: John</div>
                                </div>
                                <div className="bg-white p-3 rounded border">
                                  <div className="font-medium text-swu-red mb-1">Column B: Last Name</div>
                                  <div className="text-gray-600">Last name (required)</div>
                                  <div className="text-gray-500 mt-1">Example: Doe</div>
                                </div>
                                <div className="bg-white p-3 rounded border">
                                  <div className="font-medium text-swu-red mb-1">Column C: Email</div>
                                  <div className="text-gray-600">Email address (required)</div>
                                  <div className="text-gray-500 mt-1">Example: john@example.com</div>
                                </div>
                                <div className="bg-white p-3 rounded border">
                                  <div className="font-medium text-swu-red mb-1">Column D: Password</div>
                                  <div className="text-gray-600">Password (required, min 7 chars)</div>
                                  <div className="text-gray-500 mt-1">Example: MyPass123</div>
                                </div>
                                <div className="bg-white p-3 rounded border">
                                  <div className="font-medium text-swu-red mb-1">Column E: Role</div>
                                  <div className="text-gray-600">Role (required)</div>
                                  <div className="text-gray-500 mt-1">Example: organizer</div>
                                </div>
                              </div>
                                <div className="mt-3 text-xs text-gray-600 bg-yellow-50 p-2 rounded border border-yellow-200">
                                  <strong>Tip:</strong> Use the Excel template download button above to get a properly formatted file with maroon headers. Fill it with your actual user information.
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
                                  <Label htmlFor="file-upload" className="text-sm font-medium">Select Excel/CSV File <span className="text-red-900">*</span></Label>
                                  <Input
                                    id="file-upload"
                                    type="file"
                                    accept=".csv,.xlsx,.xls"
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

                                {/* Role Type Dropdown for Import */}


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
                    <TableCaption>Overview of all registered user accounts (admin users excluded for security). Use checkboxes to select multiple users for bulk deletion.</TableCaption>
                    <TableHeader>
                      <TableRow>
                        {showUserCheckboxes && (
                          <TableHead className="w-[50px]">
                            <Checkbox
                              checked={selectedUsers.size === sortedAndFilteredUsers.filter(u => u.role !== "admin").length && sortedAndFilteredUsers.filter(u => u.role !== "admin").length > 0}
                              onCheckedChange={handleSelectAllUsers}
                              aria-label="Select all users"
                            />
                          </TableHead>
                        )}
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
                            {showUserCheckboxes && (
                              <TableCell>
                                {userItem.role !== "admin" && (
                                  <Checkbox
                                    checked={selectedUsers.has(userItem.uid)}
                                    onCheckedChange={(checked) => handleSelectUser(userItem.uid, checked as boolean)}
                                    aria-label={`Select ${userItem.email}`}
                                  />
                                )}
                              </TableCell>
                            )}
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
                    Post Announcement
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
                            <SelectItem value="medium">🟡 Medium</SelectItem>
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
                    {isHardcodedAdmin(user.email || '') && (
                      <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <span className="font-medium">Account Type:</span>
                        <Badge variant="outline" className="border-blue-300 text-blue-700">
                          🔐 Hardcoded Admin
                        </Badge>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Change Password - Only show for non-hardcoded admins */}
              {!isHardcodedAdmin(user.email || '') && (
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
              )}

              {/* Hardcoded Admin Notice */}
              {isHardcodedAdmin(user.email || '') && (
                <Card className="shadow-md">
                  <CardHeader>
                    <CardTitle className="text-lg text-blue-600 flex items-center gap-2">
                      <Shield className="h-5 w-5" />
                      System Administrator
                    </CardTitle>
                    <CardDescription>Special account configuration</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                      <div className="flex items-start gap-3">
                        <Shield className="h-5 w-5 text-blue-600 mt-0.5" />
                        <div className="space-y-2">
                          <h4 className="font-medium text-blue-900">Hardcoded Administrator Account</h4>
                          <p className="text-sm text-blue-700">
                            This is a system administrator account with special privileges. Password changes are disabled for security reasons.
                          </p>
                          <div className="text-xs text-blue-600 space-y-1">
                            <p>• Account recreation is automatic if deleted</p>
                            <p>• Password is managed by system configuration</p>
                            <p>• Enhanced security measures are in place</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </React.Fragment>
        )}

        {activeView === "wheel-types" && (
          <React.Fragment>
            <h2 className="text-3xl font-bold mb-6">Activity Wheel Type Management</h2>
            <TypedWheelTypeManager />
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
