"use client"

import React, { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Mail, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react'
import { toast } from '@/hooks/use-toast'

interface VerificationCodeInputProps {
  title: string
  description: string
  email: string
  onVerify: (code: string) => Promise<{ success: boolean; error?: string }>
  onResend?: () => Promise<{ success: boolean; error?: string }>
  isLoading?: boolean
  type: 'password-reset' | 'signup'
}

export function VerificationCodeInput({
  title,
  description,
  email,
  onVerify,
  onResend,
  isLoading = false,
  type
}: VerificationCodeInputProps) {
  const [code, setCode] = useState(['', '', '', '', '', ''])
  const [verifying, setVerifying] = useState(false)
  const [resending, setResending] = useState(false)
  const [timeLeft, setTimeLeft] = useState(600) // 10 minutes in seconds
  const [canResend, setCanResend] = useState(false)
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  // Countdown timer
  useEffect(() => {
    if (timeLeft > 0) {
      const timer = setTimeout(() => {
        setTimeLeft(timeLeft - 1)
      }, 1000)
      return () => clearTimeout(timer)
    } else {
      setCanResend(true)
    }
  }, [timeLeft])

  // Format time display
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Handle input change
  const handleInputChange = (index: number, value: string) => {
    if (value.length > 1) {
      // Handle paste
      const pastedCode = value.slice(0, 6).split('')
      const newCode = [...code]
      pastedCode.forEach((digit, i) => {
        if (index + i < 6 && /^\d$/.test(digit)) {
          newCode[index + i] = digit
        }
      })
      setCode(newCode)
      
      // Focus on the next empty input or the last input
      const nextIndex = Math.min(index + pastedCode.length, 5)
      inputRefs.current[nextIndex]?.focus()
      
      // Auto-verify if all 6 digits are filled
      if (newCode.every(digit => digit !== '')) {
        handleVerify(newCode.join(''))
      }
      return
    }

    if (!/^\d*$/.test(value)) return // Only allow digits

    const newCode = [...code]
    newCode[index] = value
    setCode(newCode)

    // Move to next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }

    // Auto-verify when all 6 digits are entered
    if (value && newCode.every(digit => digit !== '')) {
      handleVerify(newCode.join(''))
    }
  }

  // Handle backspace
  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  // Handle verification
  const handleVerify = async (verificationCode?: string) => {
    const codeToVerify = verificationCode || code.join('')
    
    if (codeToVerify.length !== 6) {
      toast({
        title: 'Invalid Code',
        description: 'Please enter all 6 digits of the verification code.',
        variant: 'destructive',
      })
      return
    }

    setVerifying(true)
    try {
      const result = await onVerify(codeToVerify)
      
      if (result.success) {
        toast({
          title: 'Verification Successful',
          description: 'Your verification code has been confirmed.',
        })
      } else {
        toast({
          title: 'Verification Failed',
          description: result.error || 'Invalid verification code. Please try again.',
          variant: 'destructive',
        })
        // Clear the code on failure
        setCode(['', '', '', '', '', ''])
        inputRefs.current[0]?.focus()
      }
    } catch (error) {
      toast({
        title: 'Verification Error',
        description: 'An unexpected error occurred. Please try again.',
        variant: 'destructive',
      })
    } finally {
      setVerifying(false)
    }
  }

  // Handle resend
  const handleResend = async () => {
    if (!onResend || !canResend) return

    setResending(true)
    try {
      const result = await onResend()
      
      if (result.success) {
        toast({
          title: 'Code Resent',
          description: 'A new verification code has been sent to your email.',
        })
        // Reset timer
        setTimeLeft(600)
        setCanResend(false)
        // Clear current code
        setCode(['', '', '', '', '', ''])
        inputRefs.current[0]?.focus()
      } else {
        toast({
          title: 'Resend Failed',
          description: result.error || 'Failed to resend verification code. Please try again.',
          variant: 'destructive',
        })
      }
    } catch (error) {
      toast({
        title: 'Resend Error',
        description: 'Failed to resend verification code. Please try again.',
        variant: 'destructive',
      })
    } finally {
      setResending(false)
    }
  }

  const getIcon = () => {
    switch (type) {
      case 'password-reset':
        return <Mail className="h-8 w-8 text-[#8e0b16]" />
      case 'signup':
        return <CheckCircle className="h-8 w-8 text-[#8e0b16]" />
      default:
        return <Mail className="h-8 w-8 text-gray-600" />
    }
  }

  const getColorClass = () => {
    switch (type) {
      case 'password-reset':
        return 'border-[#8e0b16]/20 bg-[#8e0b16]/5'
      case 'signup':
        return 'border-[#8e0b16]/20 bg-[#8e0b16]/5'
      default:
        return 'border-gray-200 bg-gray-50'
    }
  }

  return (
    <Card className={`w-full max-w-md mx-auto ${getColorClass()}`}>
      <CardHeader className="text-center space-y-4">
        <div className="mx-auto">
          {getIcon()}
        </div>
        <div>
          <CardTitle className="text-xl font-bold">{title}</CardTitle>
          <CardDescription className="mt-2">
            {description}
          </CardDescription>
          <div className="text-sm font-medium text-gray-600 mt-2">
            Sent to: <span className="text-gray-900">{email}</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Verification Code Input */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">
            Enter 6-digit verification code
          </label>
          <div className="flex gap-2 justify-center">
            {code.map((digit, index) => (
              <Input
                key={index}
                ref={el => { inputRefs.current[index] = el }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleInputChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                className="w-12 h-12 text-center text-lg font-bold border-2 focus:border-[#8e0b16]"
                disabled={verifying || isLoading}
              />
            ))}
          </div>
        </div>

        {/* Timer and Status */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2 text-sm text-gray-600">
            <AlertCircle className="h-4 w-4" />
            <span>Code expires in: {formatTime(timeLeft)}</span>
          </div>
          
          {canResend && onResend && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleResend}
              disabled={resending}
              className="text-[#8e0b16] border-[#8e0b16] hover:bg-[#8e0b16]/10"
            >
              {resending ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Mail className="h-4 w-4 mr-2" />
                  Resend Code
                </>
              )}
            </Button>
          )}
        </div>

        {/* Verify Button */}
        <Button
          onClick={() => handleVerify()}
          disabled={verifying || isLoading || code.join('').length !== 6}
          className="w-full"
        >
          {verifying ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Verifying...
            </>
          ) : (
            <>
              <CheckCircle className="h-4 w-4 mr-2" />
              Verify Code
            </>
          )}
        </Button>

        {/* Help Text */}
        <div className="text-xs text-gray-500 text-center">
          <p>Didn't receive the code? Check your spam folder.</p>
          <p>Still having issues? Contact support for assistance.</p>
        </div>
      </CardContent>
    </Card>
  )
}