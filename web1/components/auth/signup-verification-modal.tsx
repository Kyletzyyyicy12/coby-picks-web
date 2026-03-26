"use client"

import React, { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { VerificationCodeInput } from './verification-code-input'
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from '@/hooks/use-toast'
import { Shield } from 'lucide-react'

interface SignupVerificationModalProps {
  isOpen: boolean
  onClose: () => void
  email: string
  firstName: string
  lastName: string
  onSuccess: (consentData: { teacherConsent: boolean; dataProcessingConsent: boolean }) => void
}

export function SignupVerificationModal({
  isOpen,
  onClose,
  email,
  firstName,
  lastName,
  onSuccess
}: SignupVerificationModalProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [teacherConsent, setTeacherConsent] = useState(false)
  const [dataProcessingConsent, setDataProcessingConsent] = useState(false)
  const [verificationComplete, setVerificationComplete] = useState(false)

  const handleVerifyCode = async (code: string): Promise<{ success: boolean; error?: string }> => {
    try {
      // Validate code format before sending
      if (!/^\d{6}$/.test(code)) {
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

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          // Mark verification as complete but require consent before proceeding
          setVerificationComplete(true);
          toast({
            title: "Email Verified! ✅",
            description: "Please accept the privacy consent to complete registration.",
          });
          return { success: true };
        } else {
          return { success: false, error: data.error || 'Verification failed' };
        }
      } else {
        return { success: false, error: 'Verification failed' };
      }
    } catch (error) {
      return {
        success: false,
        error: 'Network error. Please try again.'
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
          firstName,
          lastName
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          return { success: true };
        } else {
          return { success: false, error: data.error || 'Failed to resend code' };
        }
      } else {
        return { success: false, error: 'Failed to resend code' };
      }
    } catch (error) {
      return {
        success: false,
        error: 'Network error. Please try again.'
      };
    }
  }

  const handleAcceptConsent = () => {
    if (!teacherConsent || !dataProcessingConsent) {
      toast({
        title: "Required Consent Missing",
        description: "Both user verification and data processing consent are required to complete registration.",
        variant: "destructive"
      });
      return;
    }

    if (!verificationComplete) {
      toast({
        title: "Email Not Verified",
        description: "Please verify your email first before accepting consent.",
        variant: "destructive"
      });
      return;
    }

    // Pass consent data to parent for account creation
    onSuccess({ teacherConsent, dataProcessingConsent });
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto [&>button]:hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[#8e0b16]">
            <Shield className="h-6 w-6" />
            {verificationComplete ? "Privacy & Data Consent" : "Email Verification Required"}
          </DialogTitle>
        </DialogHeader>
        
        {!verificationComplete ? (
          <VerificationCodeInput
            title="Verify Your Email"
            description={`Hi ${firstName} ${lastName}! We've sent a verification code to your email address. Please enter the 6-digit code to complete your CobyPicks registration.`}
            email={email}
            onVerify={handleVerifyCode}
            onResend={handleResendCode}
            isLoading={isLoading}
            type="signup"
          />
        ) : (
          <div className="space-y-6 py-4">
            <p className="text-sm text-muted-foreground">
              Please review and accept our data usage terms to complete your registration for Coby Picks
            </p>

            {/* User Verification */}
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <Checkbox
                  id="teacher-consent"
                  checked={teacherConsent}
                  onCheckedChange={(checked) => setTeacherConsent(checked as boolean)}
                />
                <div className="space-y-1">
                  <label htmlFor="teacher-consent" className="font-medium text-sm cursor-pointer">
                    User Verification *
                  </label>
                  <p className="text-sm text-muted-foreground">
                    I confirm that I am a teacher, educator, or authorized school personnel using this system
                    for legitimate educational purposes. I understand that this system is designed for
                    classroom and educational activities.
                  </p>
                </div>
              </div>
            </div>

            {/* Data Processing */}
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <Checkbox
                  id="data-consent"
                  checked={dataProcessingConsent}
                  onCheckedChange={(checked) => setDataProcessingConsent(checked as boolean)}
                />
                <div className="space-y-1">
                  <label htmlFor="data-consent" className="font-medium text-sm cursor-pointer">
                    Data Processing Consent *
                  </label>
                  <p className="text-sm text-muted-foreground">
                    I consent to the processing of participant data (names, emails, contact information)
                    for the purpose of conducting randomizer activities. Data will be stored securely
                    and used only for educational purposes.
                  </p>
                </div>
              </div>
            </div>

            {/* Data Usage Information */}
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <h4 className="font-medium text-blue-900 mb-2">How We Use Your Data</h4>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Participant data is stored temporarily for each activity</li>
                <li>• Names and emails are used only for randomizer functionality</li>
                <li>• Data is automatically deleted after 30 days of inactivity</li>
                <li>• No data is shared with third parties</li>
                <li>• You can export or delete your data at any time</li>
              </ul>
            </div>

            <p className="text-xs text-muted-foreground">
              * Required fields. By continuing, you acknowledge that you have read and understood
              our privacy policy and agree to the terms outlined above.
            </p>

            <div className="flex gap-3 pt-4">
              <button
                onClick={() => {
                  onClose();
                  setVerificationComplete(false);
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAcceptConsent}
                disabled={!teacherConsent || !dataProcessingConsent}
                className="flex-1 px-4 py-2 bg-[#8e0b16] text-white rounded-md hover:bg-[#66181E] disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                Accept & Complete Registration
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}