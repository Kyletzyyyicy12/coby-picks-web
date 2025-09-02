"use client"

import React, { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { VerificationCodeInput } from './verification-code-input'
import { toast } from '@/hooks/use-toast'

interface SignupVerificationModalProps {
  isOpen: boolean
  onClose: () => void
  email: string
  fullName: string
  onSuccess: () => void
}

export function SignupVerificationModal({
  isOpen,
  onClose,
  email,
  fullName,
  onSuccess
}: SignupVerificationModalProps) {
  const [isLoading, setIsLoading] = useState(false)

  const handleVerifyCode = async (code: string): Promise<{ success: boolean; error?: string }> => {
    try {
      console.log('🔍 Modal: Starting verification...', {
        email,
        code: `${code.substring(0, 2)}****`,
        codeLength: code.length
      });
      
      // Validate code format before sending
      if (!/^\d{6}$/.test(code)) {
        console.log('❌ Modal: Invalid code format');
        return {
          success: false,
          error: 'Invalid code format. Please enter 6 digits.'
        };
      }
      
      const response = await fetch('/api/auth/verify-signup-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          code
        }),
      });

      console.log('📊 Modal: API response status:', response.status);
      
      let data;
      try {
        data = await response.json();
        console.log('📊 Modal: API response data:', {
          success: data.success,
          hasError: !!data.error,
          errorCode: data.code || 'none',
          verified: data.verified
        });
      } catch (parseError) {
        console.error('❌ Modal: Failed to parse response:', parseError);
        return {
          success: false,
          error: 'Invalid server response. Please try again.'
        };
      }

      if (response.ok && data.success) {
        console.log('✅ Modal: Verification successful, calling onSuccess');
        // Code verified successfully, proceed with account creation
        onSuccess();
        onClose();
        return { success: true };
      } else {
        console.log('❌ Modal: Verification failed:', {
          status: response.status,
          error: data.error,
          errorCode: data.code
        });
        
        // Provide user-friendly error messages
        let userError = data.error || 'Verification failed';
        
        // Handle specific error cases
        if (data.code === 'VERIFICATION_FAILED') {
          userError = data.error || 'Invalid verification code. Please check and try again.';
        } else if (data.code === 'INTERNAL_ERROR') {
          userError = 'Server error. Please try again in a moment.';
        } else if (response.status === 400) {
          userError = data.error || 'Invalid verification code. Please try again.';
        } else if (response.status >= 500) {
          userError = 'Server error. Please try again later.';
        }
        
        return { 
          success: false, 
          error: userError
        };
      }
    } catch (error) {
      console.error('💥 Modal: Code verification error:', error);
      return { 
        success: false, 
        error: 'Network error. Please check your connection and try again.' 
      };
    }
  }

  const handleResendCode = async (): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch('/api/auth/send-signup-verification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          fullName
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="sr-only">Email Verification Required</DialogTitle>
        </DialogHeader>
        
        <VerificationCodeInput
          title="Verify Your Email"
          description={`Hi ${fullName}! We've sent a verification code to your email address. Please enter the 6-digit code to complete your CobyPicks registration.`}
          email={email}
          onVerify={handleVerifyCode}
          onResend={handleResendCode}
          isLoading={isLoading}
          type="signup"
        />
      </DialogContent>
    </Dialog>
  )
}