"use client"

import { useEffect, useState } from "react"
import { onAuthStateChanged, type User as FirebaseUser } from "firebase/auth"
import { auth, db } from "@/lib/firebase"
import { doc, getDoc } from "firebase/firestore"
import { useRouter } from "next/navigation"
import { OrganizerDashboard } from "@/components/dashboards/organizer-dashboard"

export default function OrganizerPage() {
  const [user, setUser] = useState<FirebaseUser | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u)
      if (!u) {
        setLoading(false)
        router.push("/")
        return
      }
      try {
        const snap = await getDoc(doc(db, "users", u.uid))
        const role = snap.exists() ? (snap.data().role as string) : "participant"
        if (role !== "organizer" && role !== "admin") {
          router.push("/participants")
          return
        }
      } finally {
        setLoading(false)
      }
    })
    return () => unsub()
  }, [router])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Loading...</p>
      </div>
    )
  }

  if (!user) return null

  return <OrganizerDashboard user={user} />
}
