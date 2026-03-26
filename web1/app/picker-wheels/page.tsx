"use client"

import { useState, useEffect } from "react"
import { ParticipantPickerWheelGallery } from "@/components/participant/participant-picker-wheel-gallery"
import { auth, db } from "@/lib/firebase"
import { onAuthStateChanged, type User } from "firebase/auth"
import { useRouter } from "next/navigation"
import { doc, getDoc } from "firebase/firestore"

export default function PickerWheelsPage() {
  const router = useRouter()
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
            const role = userData.role || "participant"
            setUserRole(role)
          } else {
            setUserRole("participant") // Default to participant if no document
          }
        } catch (error) {
          console.error("Error fetching user role:", error)
          setUserRole("participant") // Default to participant on error
        }
      } else {
        setUserRole(null)
      }
    })
    return () => unsubscribe()
  }, [])

  const handleBackToDashboard = () => {
    // Route to appropriate dashboard based on user role
    if (userRole === 'admin') {
      router.push('/admin-dashboard')
    } else if (userRole === 'organizer') {
      router.push('/organizer')
    } else if (userRole === 'participant') {
      router.push('/participants')
    } else {
      router.push('/') // Default to main dashboard
    }
  }

  return (
    <ParticipantPickerWheelGallery
      user={user}
      onBack={handleBackToDashboard}
      userRole={userRole || "participant"}
    />
  )
}
