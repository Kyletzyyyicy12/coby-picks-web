"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { auth } from "@/lib/firebase"
import { onAuthStateChanged, type User as FirebaseUser } from "firebase/auth"
import { StudentWheelParticipant } from "@/components/student/student-wheel-participant"

export default function ParticipateActivityPage() {
  const params = useParams()
  const activityId = params.activityId as string
  const [user, setUser] = useState<FirebaseUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser)
      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Loading...</p>
      </div>
    )
  }

  return (
    <StudentWheelParticipant 
      activityId={activityId}
      user={user}
      studentName={user?.displayName || undefined}
    />
  )
}
