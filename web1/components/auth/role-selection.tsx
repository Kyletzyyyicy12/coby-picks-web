"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useRouter } from "next/navigation"
import { auth, db } from "@/lib/firebase"
import { updateDoc, doc, getDoc } from "firebase/firestore"
import { toast } from "@/hooks/use-toast"
import { Users, UserCheck, ArrowRight } from "lucide-react"

interface RoleSelectionProps {
  onRoleSelected?: (role: "organizer" | "participant") => void
}

export function RoleSelection({ onRoleSelected }: RoleSelectionProps) {
  const router = useRouter()
  const [selectedRole, setSelectedRole] = useState<"organizer" | "participant" | null>(null)
  const [loading, setLoading] = useState(false)

  const handleRoleSelect = async () => {
    if (!selectedRole || !auth.currentUser) return

    setLoading(true)

    // Immediately call callback to navigate instantly
    if (onRoleSelected) {
      onRoleSelected(selectedRole)
    } else {
      // Navigate to appropriate dashboard immediately
      const route = selectedRole === "organizer" ? "/organizer" : "/participants"
      router.push(route)
    }

    try {
      // Update user role in Firestore in the background
      const userDocRef = doc(db, "users", auth.currentUser.uid)
      await updateDoc(userDocRef, {
        role: selectedRole,
        lastRoleSelection: new Date()
      })

      toast({
        title: "Role Selected",
        description: `You are now set as ${selectedRole === "organizer" ? "an Organizer" : "a Participant"}.`,
      })
    } catch (error) {
      console.error("Error updating role:", error)
      toast({
        title: "Error",
        description: "Failed to save your role selection. Please try again.",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const roles = [
    {
      id: "organizer" as const,
      title: "Organizer",
      description: "Create activities, manage participants, coordinate events",
      icon: UserCheck,
      features: [
        "Create and manage live activities",
        "Invite participants to join",
        "View detailed analytics",
        "Manage multiple sessions"
      ],
      color: "#8e0b16"
    },
    {
      id: "participant" as const,
      title: "Participant",
      description: "Join activities, participate in live draws, view results",
      icon: Users,
      features: [
        "Join live sessions with room codes",
        "Participate in interactive draws",
        "Browse and use picker wheels",
        "View activity results"
      ],
      color: "#2563eb"
    }
  ]

  return (
    <div className="flex items-center justify-center min-h-screen p-4 bg-gradient-to-br from-gray-50 to-gray-100">
      <Card className="mx-auto max-w-4xl border-2 shadow-xl">
        <CardHeader className="text-center bg-gradient-to-r from-red-600 to-red-700 text-white rounded-t-lg p-8">
          <CardTitle className="text-3xl font-bold mb-2">
            Choose Your Role
          </CardTitle>
          <CardDescription className="text-white/90 text-lg">
            Select how you want to use Coby Picks today
          </CardDescription>
        </CardHeader>
        <CardContent className="p-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {roles.map((role) => {
              const IconComponent = role.icon
              const isSelected = selectedRole === role.id

              return (
                <div
                  key={role.id}
                  className={`relative p-6 border-2 rounded-xl cursor-pointer transition-all duration-200 hover:shadow-lg ${
                    isSelected
                      ? `border-[${role.color}] bg-[${role.color}]/5 shadow-md`
                      : "border-gray-200 hover:border-gray-300 bg-white"
                  }`}
                  onClick={() => setSelectedRole(role.id)}
                >
                  <div className="flex items-start gap-4">
                    <div
                      className="p-3 rounded-lg flex-shrink-0"
                      style={{ backgroundColor: `${role.color}15`, color: role.color }}
                    >
                      <IconComponent className="h-8 w-8" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-bold mb-2" style={{ color: role.color }}>
                        {role.title}
                      </h3>
                      <p className="text-gray-600 mb-4">{role.description}</p>

                      <div className="space-y-2">
                        {role.features.map((feature, index) => (
                          <div key={index} className="flex items-center gap-2">
                            <div
                              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                              style={{ backgroundColor: role.color }}
                            />
                            <span className="text-sm text-gray-700">{feature}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {isSelected && (
                    <div className="absolute top-4 right-4">
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: role.color }}
                      >
                        <ArrowRight className="h-4 w-4 text-white" />
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <div className="text-center">
            <Button
              onClick={handleRoleSelect}
              disabled={!selectedRole || loading}
              className="px-8 py-3 text-lg font-semibold"
              style={{
                backgroundColor: selectedRole ? roles.find(r => r.id === selectedRole)?.color : undefined
              }}
            >
              {loading ? "Setting up..." : "Continue as"} {selectedRole && roles.find(r => r.id === selectedRole)?.title}
            </Button>

            <p className="text-sm text-gray-500 mt-4">
              You can change your role anytime from your dashboard
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
