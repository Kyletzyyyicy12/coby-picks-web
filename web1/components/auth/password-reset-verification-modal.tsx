"use client"

import React, { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { VerificationCodeInput } from './verification-code-input'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { KeyRound, Eye, EyeOff } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { auth } from '@/lib/firebase'
import { confirmPasswordReset, verifyPasswordResetCode } from 'firebase/auth'

interface PasswordResetVerificationModalProps {
  isOpen: boolean
  onClose: () => void
  email: string
}

export function PasswordResetVerificationModal({
  isOpen,
  onClose,
  email
}: PasswordResetVerificationModalProps) {
  const [step, setStep] = useState<'verify' | 'reset'>('verify')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [resetCode, setResetCode] = useState('')

  const handleVerifyCode = async (code: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch('/api/auth/verify-reset-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          code
        }),
      })

      const data = await response.json()

      if (response.ok && data.success) {
        // Code verified, move to password reset step
        setResetCode(code)
        setStep('reset')
        return { success: true }
      } else {
        return { 
          success: false, 
          error: data.error || 'Verification failed' 
        }
      }
    } catch (error) {
      console.error('Code verification error:', error)
      return { 
        success: false, 
        error: 'Network error. Please try again.' 
      }
    }
  }

  const handleResendCode = async (): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch('/api/auth/send-reset-verification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email
        }),
      })

      const data = await response.json()

      if (response.ok && data.success) {
        return { success: true }
      } else {
        return { 
          success: false, 
          error: data.error || 'Failed to resend code' 
        }
      }
    } catch (error) {
      console.error('Resend code error:', error)
      return { 
        success: false, 
        error: 'Network error. Please try again.' 
      }
    }
  }

  const handlePasswordReset = async () => {
    if (newPassword !== confirmPassword) {
      toast({
        title: 'Password Mismatch',
        description: 'The passwords you entered do not match.',
        variant: 'destructive',
      })
      return
    }

    if (newPassword.length < 8) {
      toast({
        title: 'Password Too Short',
        description: 'Password must be at least 8 characters long.',
        variant: 'destructive',
      })
      return
    }

    setIsLoading(true)
    try {
      // Update password using Admin SDK
      const response = await fetch('/api/auth/update-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          email,
          newPassword
        })
      })
      
      const data = await response.json()
      
      if (response.ok && data.success) {
        toast({
          title: 'Password Reset Successful',
          description: 'Your password has been reset successfully. Please log in with your new password.',
        })
        
        onClose()
        setStep('verify')
        setNewPassword('')
        setConfirmPassword('')
      } else {
        throw new Error(data.error || 'Failed to reset password')
      }
      
    } catch (error: any) {
      console.error('Password reset error:', error)
      toast({
        title: 'Password Reset Failed',
        description: error.message || 'Failed to reset password. Please try again.',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const renderVerificationStep = () => (
    <VerificationCodeInput
      title="Password Reset Verification"
      description="We've sent a verification code to your email address. Enter the 6-digit code to proceed with resetting your password."
      email={email}
      onVerify={handleVerifyCode}
      onResend={handleResendCode}
      isLoading={isLoading}
      type="password-reset"
    />
  )

  const renderPasswordResetStep = () => (
    <Card className="w-full max-w-md mx-auto border-red-200 bg-red-50">
      <CardHeader className="text-center space-y-4">
        <div className="mx-auto">
          <KeyRound className="h-8 w-8 text-red-600" />
        </div>
        <div>
          <CardTitle className="text-xl font-bold">Set New Password</CardTitle>
          <CardDescription className="mt-2">
            Your email has been verified. Please enter your new password below.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="newPassword">New Password</Label>
          <div className="relative">
            <Input
              id="newPassword"
              type={showPassword ? "text" : "password"}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new password"
              disabled={isLoading}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
              onClick={() => setShowPassword(!showPassword)}
              disabled={isLoading}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm New Password</Label>
          <div className="relative">
            <Input
              id="confirmPassword"
              type={showConfirmPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              disabled={isLoading}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              disabled={isLoading}
            >
              {showConfirmPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        <div className="text-xs text-gray-600 space-y-1">
          <p>Password requirements:</p>
          <ul className="list-disc list-inside ml-2 space-y-1">
            <li>At least 8 characters long</li>
            <li>Include uppercase and lowercase letters</li>
            <li>Include at least one number</li>
            <li>Include at least one special character</li>
          </ul>
        </div>

        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => setStep('verify')}
            disabled={isLoading}
            className="flex-1"
          >
            Back
          </Button>
          <Button
            onClick={handlePasswordReset}
            disabled={isLoading || !newPassword || !confirmPassword}
            className="flex-1 bg-red-600 hover:bg-red-700"
          >
            {isLoading ? 'Resetting...' : 'Reset Password'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="sr-only">
            {step === 'verify' ? 'Password Reset Verification' : 'Set New Password'}
          </DialogTitle>
        </DialogHeader>
        
        {step === 'verify' ? renderVerificationStep() : renderPasswordResetStep()}
      </DialogContent>
    </Dialog>
  )
}