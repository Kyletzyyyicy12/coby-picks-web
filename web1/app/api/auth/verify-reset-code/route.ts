// app/api/auth/verify-reset-code/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { verifyVerificationCode } from '@/lib/email-service'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, code } = body

    if (!email || !code) {
      return NextResponse.json(
        { error: 'Email and verification code are required' }, 
        { status: 400 }
      )
    }

    const emailLower = email.trim().toLowerCase()
    const cleanCode = code.trim()

    // Verify the code
    const result = await verifyVerificationCode(emailLower, cleanCode, 'password-reset')
    
    if (!result.valid) {
      return NextResponse.json(
        { error: result.error || 'Invalid verification code' }, 
        { status: 400 }
      )
    }

    // Code is valid - return success
    // The client can now proceed with password reset using Firebase's sendPasswordResetEmail
    return NextResponse.json({ 
      success: true, 
      message: 'Verification code confirmed. You can now reset your password.',
      verified: true,
      email: emailLower
    })

  } catch (error: any) {
    console.error('Verify reset code error:', error)
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    )
  }
}