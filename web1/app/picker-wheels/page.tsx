"use client"

import { useState, useEffect } from "react"
import { PickerWheelGallery } from "@/components/picker-wheels/picker-wheel-gallery"
import { DynamicPickerWheel } from "@/components/picker-wheels/dynamic-picker-wheel"
import { WheelTypeProvider } from "@/components/providers/wheel-type-provider"
import { type PickerWheelType } from "@/lib/picker-wheel-types"
import { auth, db } from "@/lib/firebase"
import { onAuthStateChanged, type User } from "firebase/auth"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import { doc, getDoc } from "firebase/firestore"

export default function PickerWheelsPage() {
  const router = useRouter()
  const [selectedWheel, setSelectedWheel] = useState<PickerWheelType | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [userRole, setUserRole] = useState<string | null>(null)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser)

      if (currentUser) {
        try {
          const userDocRef = doc(db, "users", currentUser.uid)
          const userDocSnap = await getDoc(userDocRef)

          if (userDocSnap.exists()) {
            const userData = userDocSnap.data()
            const role = userData.role || "student"
            setUserRole(role)
            
            // Redirect organizers to dashboard - they should use ActivityConfiguration
            if (role === "organizer") {
              router.push("/")
              return
            }
          } else {
            setUserRole("student") // Default to student if no document
          }
        } catch (error) {
          console.error("Error fetching user role:", error)
          setUserRole("student") // Default to student on error
        }
      } else {
        setUserRole(null)
      }
    })
    return () => unsubscribe()
  }, [])

  // Allow students and guests to use wheels directly without live sessions
  // Only teachers and organizers need to go through activity creation
  const canUseWheelDirectly = !user || userRole === "student"

  if (selectedWheel && canUseWheelDirectly) {
    return (
      <div className="container mx-auto px-4 py-8">
        <DynamicPickerWheel
          wheelType={selectedWheel}
          onBack={() => setSelectedWheel(null)}
          isStudentMode={userRole === "student"}
          user={user}
        />
      </div>
    )
  }

  return (
    <WheelTypeProvider userRole={userRole || "guest"}>
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <div
            className="w-full py-4 px-4 rounded-xl text-white shadow-sm"
            style={{ background: "linear-gradient(135deg, #66181E 0%, #8e0b16 100%)" }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  aria-label="Back to Dashboard"
                  onClick={() => router.push("/")}
                  className="inline-flex items-center justify-center h-8 w-8 rounded-md bg-white/10 hover:bg-white/20 transition-colors"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <div>
                  <h1 className="text-xl font-semibold leading-tight">Picker Wheel Gallery</h1>
                  <p className="text-xs opacity-90">Browse and create wheels for your activities</p>
                </div>
              </div>
              {user && (
                <div className="text-sm opacity-90 px-2 py-1 rounded-md bg-white/10">
                  {user.displayName || user.email}
                </div>
              )}
            </div>
          </div>
        </div>
        <PickerWheelGallery
          onSelectWheel={canUseWheelDirectly ? setSelectedWheel : undefined}
          userRole={userRole}
          user={user}
        />
      </div>
    </WheelTypeProvider>
  )
}
