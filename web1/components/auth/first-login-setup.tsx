"use client"

import React, { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { auth, db } from "@/lib/firebase"
import { updatePassword, updateEmail, reauthenticateWithCredential, EmailAuthProvider } from "firebase/auth"
import { doc, updateDoc } from "firebase/firestore"
import { toast } from "@/hooks/use-toast"
import { Loader2, Shield, Mail, Lock } from "lucide-react"

interface FirstLoginSetupProps {
  user: any
  onComplete: () => void
}

export function FirstLoginSetup({ user, onComplete }: FirstLoginSetupProps) {
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [recoveryEmail, setRecoveryEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState<'password' | 'recovery'>('password')
  const [skippedPassword, setSkippedPassword] = useState(false)

  const handlePasswordUpdate = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast({
        title: "Missing Information",
        description: "Please fill in all password fields",
        variant: "destructive"
      })
      return
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: "Password Mismatch",
        description: "New password and confirmation don't match",
        variant: "destructive"
      })
      return
    }

    if (newPassword.length < 6) {
      toast({
        title: "Password Too Short",
        description: "Password must be at least 6 characters long",
        variant: "destructive"
      })
      return
    }

    setLoading(true)
    try {
      // Re-authenticate with current password
      const credential = EmailAuthProvider.credential(user.email, currentPassword)
      await reauthenticateWithCredential(user, credential)

      // Update password
      await updatePassword(user, newPassword)

      // Update user document to mark password as changed
      await updateDoc(doc(db, "users", user.uid), {
        needsPasswordReset: false,
        passwordChangedAt: new Date(),
        lastActiveAt: new Date()
      })

      toast({
        title: "Password Updated",
        description: "Your password has been successfully changed",
      })

      setStep('recovery')
    } catch (error: any) {
      console.error("Password update error:", error)
      if (error.code === "auth/wrong-password") {
        toast({
          title: "Incorrect Current Password",
          description: "Please check your current password and try again",
          variant: "destructive"
        })
      } else {
        toast({
          title: "Password Change Failed",
          description: error.message || "An error occurred while changing your password",
          variant: "destructive"
        })
      }
    } finally {
      setLoading(false)
    }
  }

  const handleRecoveryEmailUpdate = async () => {
    if (!recoveryEmail) {
      toast({
        title: "Missing Recovery Email",
        description: "Please enter a recovery email address",
        variant: "destructive"
      })
      return
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(recoveryEmail)) {
      toast({
        title: "Invalid Email",
        description: "Please enter a valid email address",
        variant: "destructive"
      })
      return
    }

    setLoading(true)
    try {
      // Update recovery email in user document
      await updateDoc(doc(db, "users", user.uid), {
        recoveryEmail: recoveryEmail,
        profileComplete: true,
        lastActiveAt: new Date()
      })

      toast({
        title: "Setup Complete",
        description: "Your account setup is now complete!",
      })

      onComplete()
    } catch (error: any) {
      console.error("Recovery email update error:", error)
      toast({
        title: "Setup Failed",
        description: error.message || "An error occurred while saving your recovery email",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const skipRecoveryEmail = async () => {
    setLoading(true)
    try {
      await updateDoc(doc(db, "users", user.uid), {
        profileComplete: true,
        lastActiveAt: new Date()
      })

      toast({
        title: "Setup Complete",
        description: "You can add a recovery email later in your profile settings",
      })

      onComplete()
    } catch (error: any) {
      console.error("Skip recovery email error:", error)
      toast({
        title: "Setup Failed",
        description: error.message || "An error occurred",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4">
            <Shield className="w-6 h-6 text-blue-600" />
          </div>
          <CardTitle className="text-2xl font-bold text-gray-900">
            Welcome to Coby Picks!
          </CardTitle>
          <CardDescription className="text-gray-600">
            {step === 'password'
              ? "Let's secure your account by setting up a new password"
              : "Add a recovery email for account security"
            }
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {step === 'password' ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="current-password" className="flex items-center gap-2">
                  <Lock className="w-4 h-4" />
                  Current Password
                </Label>
                <Input
                  id="current-password"
                  type="password"
                  placeholder="Enter the password from your welcome email"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <Input
                  id="new-password"
                  type="password"
                  placeholder="Enter your new password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm New Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  placeholder="Confirm your new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={loading}
                />
              </div>

              <div className="flex gap-2">
              <Button
                onClick={handlePasswordUpdate}
                disabled={loading || !currentPassword || !newPassword || !confirmPassword}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Updating...
                  </div>
                ) : (
                  "Set New Password"
                )}
              </Button>
              <Button
                  onClick={() => setStep('recovery')}
                  disabled={loading}
                  variant="outline"
                  className="flex-1"
                >
                  Skip for Now
                </Button>
                </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="recovery-email" className="flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  Recovery Email (Required)
                </Label>
                <Input
                  id="recovery-email"
                  type="email"
                  placeholder="Enter a recovery email address"
                  value={recoveryEmail}
                  onChange={(e) => setRecoveryEmail(e.target.value)}
                  disabled={loading}
                />
                <p className="text-xs text-gray-500">
                  This email is required to secure your account.
                </p>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={handleRecoveryEmailUpdate}
                  disabled={loading || !recoveryEmail}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                >
                  {loading ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving...
                    </div>
                  ) : (
                    "Save and Continue"
                  )}
                </Button>
              </div>
            </div>
          )}

          <div className="text-center text-sm text-gray-500">
            Step {step === 'password' ? '1' : '2'} of 2
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
