"use client"

import { useState, useEffect } from "react"
import { CobyPicksWheel } from "@/components/wheel/coby-picks-wheel"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { db } from "@/lib/firebase"
import { collection, addDoc, doc, setDoc } from "firebase/firestore"
import { toast } from "@/hooks/use-toast"
import { Toaster } from "@/components/ui/toaster"

export default function TestWheelPage() {
  const [wheelId, setWheelId] = useState<string>("")
  const [spinCount, setSpinCount] = useState(0)
  const [isCreatingWheel, setIsCreatingWheel] = useState(false)

  const createTestWheel = async () => {
    setIsCreatingWheel(true)
    try {
      // Create a test wheel document
      const wheelDoc = await addDoc(collection(db, "wheels"), {
        name: "Test Wheel",
        description: "A test wheel for Firebase verification",
        wheelType: "participant",
        createdAt: new Date(),
        createdBy: "test-user",
        isActive: true,
        spinCount: 0,
        settings: {
          spinSpeedLevel: 5,
          spinDuration: 3,
          manualStop: false,
          mysterySpin: false,
          randomInitialAngle: true,
          initialSpinning: false,
          confettiAndSound: true,
          wheelTheme: "default"
        }
      })

      // Add some test participants
      const participants = [
        { name: "Alice Johnson", email: "alice@test.com" },
        { name: "Bob Smith", email: "bob@test.com" },
        { name: "Charlie Brown", email: "charlie@test.com" },
        { name: "Diana Prince", email: "diana@test.com" },
        { name: "Eve Wilson", email: "eve@test.com" }
      ]

      for (const participant of participants) {
        await addDoc(collection(db, `wheels/${wheelDoc.id}/participants`), {
          ...participant,
          addedAt: new Date()
        })
      }

      setWheelId(wheelDoc.id)
      toast({
        title: "Test Wheel Created",
        description: `Wheel created with ID: ${wheelDoc.id}`,
      })
    } catch (error: any) {
      toast({
        title: "Error Creating Test Wheel",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setIsCreatingWheel(false)
    }
  }

  const handleSpinComplete = (newSpinCount: number) => {
    setSpinCount(newSpinCount)
    toast({
      title: "Spin Complete",
      description: `Total spins: ${newSpinCount}`,
    })
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-4xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Wheel Component Test
          </h1>
          <p className="text-gray-600">
            Test the CobyPicksWheel component with Firebase integration
          </p>
        </div>

        <div className="space-y-6">
          {/* Test Controls */}
          <Card>
            <CardHeader>
              <CardTitle>Test Controls</CardTitle>
              <CardDescription>
                Create a test wheel and verify Firebase integration
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <Button 
                  onClick={createTestWheel} 
                  disabled={isCreatingWheel || !!wheelId}
                >
                  {isCreatingWheel ? "Creating..." : "Create Test Wheel"}
                </Button>
                
                {wheelId && (
                  <div className="flex items-center gap-2">
                    <Badge variant="default">Wheel Created</Badge>
                    <span className="text-sm text-gray-600">ID: {wheelId}</span>
                  </div>
                )}
              </div>

              {spinCount > 0 && (
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">Spins: {spinCount}</Badge>
                  <span className="text-sm text-gray-600">
                    Firebase updates are working!
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Wheel Component */}
          {wheelId && (
            <Card>
              <CardHeader>
                <CardTitle>Test Wheel</CardTitle>
                <CardDescription>
                  This wheel is connected to Firestore and will save spin results
                </CardDescription>
              </CardHeader>
              <CardContent>
                <CobyPicksWheel
                  wheelId={wheelId}
                  congratulatoryMessage="🎉 Congratulations {winner}! You've been selected!"
                  wheelType="participant"
                  spinSpeedLevel={5}
                  spinDuration={3}
                  manualStop={false}
                  mysterySpin={false}
                  spinCount={spinCount}
                  randomInitialAngle={true}
                  initialSpinning={false}
                  wheelBgImage=""
                  centerImage=""
                  centerImageSize={50}
                  wheelBorderWidth={2}
                  wheelBorderColor="#A00000"
                  wheelShadow="md"
                  confettiAndSound={true}
                  onSpinComplete={handleSpinComplete}
                  wheelTheme="default"
                />
              </CardContent>
            </Card>
          )}

          {/* Instructions */}
          <Card>
            <CardHeader>
              <CardTitle>Test Instructions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>1. Click "Create Test Wheel" to create a wheel with test participants</p>
              <p>2. Once created, the wheel will appear below with 5 test participants</p>
              <p>3. Click "Spin Wheel" to test the Firebase integration</p>
              <p>4. Check that spin results are saved to Firestore</p>
              <p>5. Verify that the spin count updates correctly</p>
            </CardContent>
          </Card>
        </div>

        <div className="mt-8 text-center space-x-4">
          <a 
            href="/test-firebase" 
            className="text-blue-600 hover:text-blue-800 underline"
          >
            ← Firebase Tests
          </a>
          <a 
            href="/" 
            className="text-blue-600 hover:text-blue-800 underline"
          >
            Home
          </a>
        </div>
      </div>
      <Toaster />
    </div>
  )
}
