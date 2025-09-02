"use client"

import { useState, useEffect, useRef } from "react"
import { auth, db } from "@/lib/firebase"
import { onAuthStateChanged, type User, signOut } from "firebase/auth"
// Removed legacy Dashboard to avoid flicker
import { LandingPage } from "@/components/landing/landing-page"
import { Toaster } from "@/components/ui/toaster"
import { doc, getDoc, setDoc } from "firebase/firestore"
import { AdminDashboard } from "@/components/admin/admin-dashboard"
import { TeacherDashboardEnhanced } from "@/components/dashboards/teacher-dashboard-enhanced"
import { OrganizerDashboard } from "@/components/dashboards/organizer-dashboard"
import { ParticipantDashboard, StudentDashboard } from "@/components/dashboards/student-dashboard"
import { WheelTypeProvider } from "@/components/providers/wheel-type-provider"
import { isHardcodedAdmin, ensureHardcodedAdminAccess } from "@/lib/hardcoded-admin"
import { toast } from "@/hooks/use-toast"

export default function Home() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [userRole, setUserRole] = useState<string | null>(null)

  // Rate limiting and caching state
  const lastFirestoreCallRef = useRef<{ [key: string]: number }>({})
  const userRoleCacheRef = useRef<{ [key: string]: { role: string; timestamp: number } }>({})
  const RATE_LIMIT_MS = 5000 // 5 seconds between Firestore calls
  const CACHE_DURATION_MS = 300000 // 5 minutes cache

  // Helper function to check rate limit
  const isRateLimited = (operationKey: string): boolean => {
    const now = Date.now()
    const lastCall = lastFirestoreCallRef.current[operationKey]
    if (!lastCall || (now - lastCall) > RATE_LIMIT_MS) {
      lastFirestoreCallRef.current[operationKey] = now
      return false
    }
    return true
  }

  // Helper function to get cached role
  const getCachedRole = (userId: string): string | null => {
    const cached = userRoleCacheRef.current[userId]
    if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION_MS) {
      return cached.role
    }
    return null
  }

  // Helper function to set cached role
  const setCachedRole = (userId: string, role: string): void => {
    userRoleCacheRef.current[userId] = { role, timestamp: Date.now() }
  }

  useEffect(() => {
    let isAutoLogoutInProgress = false
    let authInitialized = false

    // Automatically log out any existing user when the app launches
    const performLogout = async () => {
      try {
        isAutoLogoutInProgress = true
        await signOut(auth)
        console.log("🔄 Auto-logout completed on app launch")
        // Wait a bit before allowing normal auth processing
        setTimeout(() => {
          isAutoLogoutInProgress = false
          authInitialized = true
        }, 1000)
      } catch (error) {
        console.error("❌ Error during auto-logout:", error)
        isAutoLogoutInProgress = false
        authInitialized = true
      }
    }

    // Perform logout immediately when component mounts
    performLogout()

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      // Skip Firestore operations during auto-logout to prevent quota issues
      if (isAutoLogoutInProgress || !authInitialized) {
        setUser(currentUser)
        setUserRole(null)
        setLoading(false)
        return
      }
      setUser(currentUser)
      if (currentUser) {
        try {
          // Check cache first
          const cachedRole = getCachedRole(currentUser.uid)
          if (cachedRole) {
            console.log("✅ Using cached role:", cachedRole)
            setUserRole(cachedRole)
            setLoading(false)
            return
          }

          // Check if this is a hardcoded admin first
          if (isHardcodedAdmin(currentUser.email)) {
            console.log("🔑 Hardcoded admin detected:", currentUser.email)
            setUserRole("admin")
            setCachedRole(currentUser.uid, "admin")

            // Rate limit admin document creation
            if (!isRateLimited(`admin_${currentUser.uid}`)) {
              const userDocRef = doc(db, "users", currentUser.uid)
              await setDoc(
                userDocRef,
                {
                  email: currentUser.email,
                  displayName: currentUser.displayName || "Admin",
                  role: "admin",
                  lastActiveAt: new Date(),
                  lastActiveDevice: "web",
                  isActive: true,
                  isHardcodedAdmin: true,
                  createdAt: new Date(),
                },
                { merge: true }
              )
            }
          } else {
            // Rate limit regular user role checks
            if (!isRateLimited(`user_${currentUser.uid}`)) {
              // Regular user - check Firestore document
              const userDocRef = doc(db, "users", currentUser.uid)
              const userDocSnap = await getDoc(userDocRef)

              if (userDocSnap.exists()) {
                const userData = userDocSnap.data()
                const role = userData.role || "participant"
                setUserRole(role)
                setCachedRole(currentUser.uid, role)

                // Update last active timestamp and device (less frequently)
                if (!isRateLimited(`activity_${currentUser.uid}`)) {
                  await setDoc(
                    userDocRef,
                    {
                      lastActiveAt: new Date(),
                      lastActiveDevice: "web",
                      isActive: true,
                    },
                    { merge: true },
                  )
                }
              } else {
                // If user document does not exist (e.g., deleted by admin), sign them out
                await signOut(auth)
                setUser(null)
                setUserRole(null)
                toast({
                  title: "Account Removed",
                  description: "Your account has been removed by an administrator. Please contact support.",
                  variant: "destructive",
                })
                setLoading(false)
                return // Exit early as user is signed out
              }
            } else {
              // Rate limited, use default role
              console.log("⏱️ Rate limited, using default participant role")
              setUserRole("participant")
              setCachedRole(currentUser.uid, "participant")
            }
          }
        } catch (error) {
          console.error("Error fetching user role or updating active status:", error)

          // Handle quota exceeded errors specifically
          if (error instanceof Error && error.message.includes("quota exceeded")) {
            console.log("⚠️ Firestore quota exceeded, using cached/default role")
            const cachedRole = getCachedRole(currentUser.uid)
            if (cachedRole) {
              setUserRole(cachedRole)
            } else {
              // For hardcoded admins, still give admin access even if Firestore fails
              if (isHardcodedAdmin(currentUser.email)) {
                setUserRole("admin")
                toast({
                  title: "Admin Access Granted",
                  description: "Logged in as hardcoded administrator (offline mode)",
                })
              } else {
                setUserRole("participant")
              }
            }
          } else {
            // For hardcoded admins, still give admin access even if Firestore fails
            if (isHardcodedAdmin(currentUser.email)) {
              setUserRole("admin")
              toast({
                title: "Admin Access Granted",
                description: "Logged in as hardcoded administrator",
              })
            } else {
              setUserRole("participant")
            }
          }
        }
      } else {
        setUserRole(null)
      }
      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <p className="text-lg text-swu-red">Loading application...</p>
      </div>
    )
  }

  return (
    <WheelTypeProvider userRole={userRole || "participant"}>
      <div className="min-h-screen bg-gray-50">
        {user ? (
          userRole === "admin" ? (
            <AdminDashboard user={user} userRole={userRole} />
          ) : userRole === "organizer" ? (
            <OrganizerDashboard user={user} />
          ) : userRole === "participant" ? (
            <ParticipantDashboard user={user} participantName={user.displayName || undefined} />
          ) : (
            <ParticipantDashboard user={user} participantName={user.displayName || undefined} />
          )
        ) : (
          <LandingPage />
        )}
        <Toaster />
      </div>
    </WheelTypeProvider>
  )
}
