"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { SavedWheelsManager } from "@/components/teacher/saved-wheels-manager"
import { useAuth } from "@/contexts/AuthContext"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"

export default function SavedWheelsPage() {
  const { currentUser, userProfile, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !currentUser) {
      router.push('/')
      return
    }
  }, [currentUser, loading, router])

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto mb-4" style={{ borderColor: "#8e0b16" }}></div>
        <p>Loading...</p>
      </div>
    )
  }

  if (!currentUser) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="max-w-md mx-auto">
          <CardContent className="text-center py-12">
            <div className="text-6xl mb-4">🔒</div>
            <h2 className="text-2xl font-bold mb-2">Login Required</h2>
            <p className="text-muted-foreground mb-4">
              Please log in to access your saved wheels.
            </p>
            <Button onClick={() => router.push("/")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Go to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const handleBack = () => {
    // Navigate back based on user role
    const userRole = userProfile?.role?.toLowerCase()
    if (userRole === 'participant') {
      router.push('/participants')
    } else if (userRole === 'organizer' || userRole === 'teacher' || userRole === 'admin') {
      router.push('/organizer')
    } else {
      router.push('/')
    }
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <Button
          variant="outline"
          onClick={handleBack}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>
      </div>

      <SavedWheelsManager
        user={currentUser}
        onClose={handleBack}
      />
    </div>
  )
}
