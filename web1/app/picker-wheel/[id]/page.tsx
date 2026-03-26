"use client"

import { useParams, useRouter } from "next/navigation"
import { useState, useEffect, useMemo } from "react"
import { DynamicPickerWheel } from "@/components/picker-wheels/dynamic-picker-wheel"
import { getPickerWheelById } from "@/lib/picker-wheel-types"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import type { PickerWheelType } from "@/lib/picker-wheel-types"
import { useAuth } from "@/contexts/AuthContext"

export default function PickerWheelPage() {
  const params = useParams()
  const router = useRouter()
  const wheelId = params.id as string
  const { userProfile } = useAuth()

  const [isLoading, setIsLoading] = useState(false)
  const [isFromSavedWheels, setIsFromSavedWheels] = useState(false)

  // Handle custom wheel from sessionStorage - create synchronously
  const customWheel = useMemo(() => {
    if (wheelId === 'custom') {
      const customWheelData = sessionStorage.getItem('customWheelData')
      const wheelSource = sessionStorage.getItem('wheelSource')
      
      // Check if this came from saved wheels manager
      if (wheelSource === 'saved-wheels-manager' || wheelSource === 'saved-wheels-manager-new') {
        setIsFromSavedWheels(true)
      }
      
      if (customWheelData) {
        try {
          const data = JSON.parse(customWheelData)
          // Create PickerWheelType from custom wheel data
          const customWheel: PickerWheelType = {
            id: `custom-${data.id}`,
            title: data.title,
            description: data.description,
            icon: "🎯",
            category: data.category || "personal",
            defaultItems: data.participants || [],
            color: "#8e0b16",
            isCustomizable: true
          }
          return customWheel
        } catch (error) {
          console.error('Error parsing custom wheel data:', error)
        }
      }
    }
    return null
  }, [wheelId])

  const wheelType = wheelId === 'custom' ? customWheel : getPickerWheelById(wheelId)

  // Don't clear sessionStorage - let DynamicPickerWheel handle it after save

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <p>Loading custom wheel...</p>
      </div>
    )
  }

  if (!wheelType && wheelId !== 'custom') {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="max-w-md mx-auto">
          <CardContent className="text-center py-12">
            <div className="text-6xl mb-4">🎯</div>
            <h2 className="text-2xl font-bold mb-2">Wheel Not Found</h2>
            <p className="text-muted-foreground mb-4">
              The picker wheel you're looking for doesn't exist.
            </p>
            <Button onClick={() => router.push("/picker-wheels")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Gallery
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!wheelType) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="max-w-md mx-auto">
          <CardContent className="text-center py-12">
            <div className="text-6xl mb-4">🎯</div>
            <h2 className="text-2xl font-bold mb-2">Wheel Not Available</h2>
            <p className="text-muted-foreground mb-4">
              The requested wheel could not be loaded.
            </p>
            <Button onClick={() => router.push("/picker-wheels")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Gallery
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const handleBackToGallery = () => {
    // All wheels go back to picker wheel gallery for solo mode
    router.push('/picker-wheels')
  }

  const handleBackToSavedWheels = () => {
    // Store state to return to saved wheels modal
    sessionStorage.setItem('returnToSavedWheels', 'true')
    sessionStorage.removeItem('wheelSource')

    // Navigate based on user role
    const userRole = userProfile?.role?.toLowerCase()
    if (userRole === 'participant') {
      // Navigate to participant dashboard with saved wheels modal open
      sessionStorage.setItem('openSavedWheelsModal', 'true')
      router.push('/participants')
    } else if (userRole === 'organizer' || userRole === 'teacher' || userRole === 'admin') {
      router.push('/organizer')
    } else {
      // Default fallback
      router.push('/participants')
    }
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <DynamicPickerWheel
        wheelType={wheelType}
        onBack={handleBackToGallery}
        onBackToSavedWheels={isFromSavedWheels ? handleBackToSavedWheels : undefined}
        soloMode={true}
        userRole={userProfile?.role?.toLowerCase() || 'participant'}
        externalParticipants={wheelId === 'custom' && customWheel ? customWheel.defaultItems.map((item: string, index: number) => ({
          id: `custom-${index}`,
          name: item
        })) : undefined}
      />
    </div>
  )
}
