"use client"

import React, { createContext, useContext, useEffect, useState, ReactNode, useRef } from "react"
import { db, auth } from "@/lib/firebase"
import { collection, query, orderBy, onSnapshot, where } from "firebase/firestore"
// Removed toasts from provider to avoid noisy popups on realtime updates

interface WheelTypeConfig {
  id: string
  value: string
  label: string
  description: string
  enabled: boolean
  order: number
  allowedRoles: string[]
  isActivityWheel: boolean
  canBeShared: boolean
  hiddenForNewUsers?: boolean // Controls visibility for new organizers and participants
  icon?: string // Icon for display
  category?: string // Category for grouping
  isPreset?: boolean // Indicates if added as preset
  defaultItems?: string[] // Default input text for the wheel
  defaultSettings: {
    allowRealTimeCollection: boolean
    maxParticipants?: number
    requiresApproval: boolean
    congratsMessage?: string
  }
  createdAt: Date
  updatedAt: Date
}

interface WheelTypeContextType {
  wheelTypes: WheelTypeConfig[]
  enabledWheelTypes: WheelTypeConfig[]
  loading: boolean
  error: string | null
  getWheelTypesByRole: (userRole: string) => WheelTypeConfig[]
  getVisibleWheelTypesByRole: (userRole: string, adminOverrides?: Set<string>) => WheelTypeConfig[]
  getWheelTypeById: (id: string) => WheelTypeConfig | undefined
  refreshWheelTypes: () => void
}

const WheelTypeContext = createContext<WheelTypeContextType | undefined>(undefined)

interface WheelTypeProviderProps {
  children: ReactNode
  userRole?: string
}

export function WheelTypeProvider({ children, userRole = "student" }: WheelTypeProviderProps) {
  const [wheelTypes, setWheelTypes] = useState<WheelTypeConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const hasInitializedRef = useRef(false)
  const lastUpdateTimeRef = useRef<number>(0)

  useEffect(() => {
    // Wait for auth to be ready before setting up the listener
    const authCheckInterval = setInterval(() => {
      if (auth.currentUser !== undefined) { // Check for both null and user objects
        clearInterval(authCheckInterval)
        setupWheelTypesListener()
      }
    }, 100)

    // Timeout after 5 seconds to prevent infinite waiting
    setTimeout(() => {
      clearInterval(authCheckInterval)
      if (!hasInitializedRef.current) {
        setupWheelTypesListener()
      }
    }, 5000)

    const setupWheelTypesListener = () => {
      console.log("🎯 Setting up real-time wheel types listener...")

      const q = query(collection(db, "wheelTypes"), orderBy("order", "asc"))

      const unsubscribe = onSnapshot(
        q,
        (querySnapshot) => {
          const fetchedTypes: WheelTypeConfig[] = querySnapshot.docs.map((doc) => ({
            id: doc.id,
            value: doc.data().value,
            label: doc.data().label,
            description: doc.data().description,
            enabled: doc.data().enabled,
            order: doc.data().order,
            allowedRoles: doc.data().allowedRoles || ["teacher", "organizer"],
            isActivityWheel: doc.data().isActivityWheel || false,
            canBeShared: doc.data().canBeShared || false,
            hiddenForNewUsers: doc.data().hiddenForNewUsers || false,
            icon: doc.data().icon, // Icon from preset
            category: doc.data().category, // Category from preset
            isPreset: doc.data().isPreset || false, // Indicates if added as preset
            defaultItems: doc.data().defaultItems, // Default input text for the wheel
            defaultSettings: doc.data().defaultSettings || {
              allowRealTimeCollection: false,
              requiresApproval: false,
              congratsMessage: "Congratulations, {winner}!"
            },
            createdAt: doc.data().createdAt?.toDate() || new Date(),
            updatedAt: doc.data().updatedAt?.toDate() || new Date(),
          }))

          setWheelTypes(fetchedTypes)
          setLoading(false)
          setError(null)

          // Track updates silently without toasts
          const now = Date.now()
          lastUpdateTimeRef.current = now
          if (!hasInitializedRef.current) {
            hasInitializedRef.current = true
          }

          console.log(`✅ Loaded ${fetchedTypes.length} wheel types`)
        },
        (error) => {
          console.error("❌ Error in wheel types listener:", error)
          
          // Don't set error state for permission issues during auth transitions
          if (error.code === 'permission-denied' && !auth.currentUser) {
            console.log("Permission denied during auth transition, retrying later...")
            // Retry after a short delay when auth state changes
            setTimeout(() => {
              if (auth.currentUser && !hasInitializedRef.current) {
                setupWheelTypesListener()
              }
            }, 2000)
            return
          }
          
          setError(error.message)
          setLoading(false)
        }
      )

      return () => {
        console.log("🔌 Cleaning up wheel types listener")
        unsubscribe()
      }
    }

    return () => {
      clearInterval(authCheckInterval)
    }
  }, [])

  // Removed cross-app toasts for system notifications to avoid noisy popups
  // If needed in the future, surface notifications in admin-only views.

  const enabledWheelTypes = wheelTypes.filter(type => type.enabled)

  const getWheelTypesByRole = (role: string): WheelTypeConfig[] => {
    return enabledWheelTypes.filter(type => 
      type.allowedRoles.includes(role) || type.allowedRoles.includes("all")
    )
  }

  const getVisibleWheelTypesByRole = (role: string, adminOverrides?: Set<string>): WheelTypeConfig[] => {
    return enabledWheelTypes.filter(type => {
      // Check role permission first
      const hasRolePermission = type.allowedRoles.includes(role) || type.allowedRoles.includes("all")
      if (!hasRolePermission) {
        return false
      }
      
      // Admin role: can see all wheels
      if (role === 'admin') {
        return true
      }
      
      // If wheel is not hidden for new users, show it
      if (!type.hiddenForNewUsers) {
        return true
      }
      
      // If admin has overridden visibility for this wheel, show it
      if (adminOverrides && adminOverrides.has(type.id)) {
        return true
      }
      
      // Hide the wheel for new organizers and participants
      return false
    })
  }

  const getWheelTypeById = (id: string): WheelTypeConfig | undefined => {
    return wheelTypes.find(type => type.id === id || type.value === id)
  }

  const refreshWheelTypes = () => {
    // Force refresh by updating timestamp
    lastUpdateTimeRef.current = 0
  }

  const contextValue: WheelTypeContextType = {
    wheelTypes,
    enabledWheelTypes,
    loading,
    error,
    getWheelTypesByRole,
    getVisibleWheelTypesByRole,
    getWheelTypeById,
    refreshWheelTypes
  }

  return (
    <WheelTypeContext.Provider value={contextValue}>
      {children}
    </WheelTypeContext.Provider>
  )
}

export function useWheelTypes() {
  const context = useContext(WheelTypeContext)
  if (context === undefined) {
    throw new Error("useWheelTypes must be used within a WheelTypeProvider")
  }
  return context
}

// Hook for getting wheel types filtered by user role
export function useWheelTypesByRole(userRole: string) {
  const { getWheelTypesByRole, loading, error } = useWheelTypes()
  const [filteredTypes, setFilteredTypes] = useState<WheelTypeConfig[]>([])

  useEffect(() => {
    if (!loading) {
      setFilteredTypes(getWheelTypesByRole(userRole))
    }
  }, [userRole, loading, getWheelTypesByRole])

  return {
    wheelTypes: filteredTypes,
    loading,
    error
  }
}

// Hook for getting a specific wheel type
export function useWheelType(wheelTypeId: string) {
  const { getWheelTypeById, loading, error } = useWheelTypes()
  const [wheelType, setWheelType] = useState<WheelTypeConfig | undefined>()

  useEffect(() => {
    if (!loading) {
      setWheelType(getWheelTypeById(wheelTypeId))
    }
  }, [wheelTypeId, loading, getWheelTypeById])

  return {
    wheelType,
    loading,
    error
  }
}
