// web1/app/api/auth/mobile-signup-verification/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { adminAuth } from '@/lib/firebase-admin'
import {
  generateVerificationCode,
  storeVerificationCode,
  sendVerificationEmail
} from '@/lib/email-service'

export async function POST(request: NextRequest) {
  try {
    console.log('📧 Mobile signup verification API called');

    const body = await request.json()
    const { email, firstName, lastName, recoveryEmail, role } = body

    console.log('📝 Request data:', {
      email: email ? 'provided' : 'missing',
      firstName: firstName ? 'provided' : 'missing',
      lastName: lastName ? 'provided' : 'missing',
      recoveryEmail: recoveryEmail ? 'provided' : 'missing',
      role: role || 'not provided'
    });

    if (!email || !firstName || !lastName || !recoveryEmail || !role) {
      console.log('❌ Missing required fields:', {
        email: !!email,
        firstName: !!firstName,
        lastName: !!lastName,
        recoveryEmail: !!recoveryEmail,
        role: !!role
      });
      return NextResponse.json(
        {
          success: false,
          error: 'Email, first name, last name, recovery email, and role are required'
        },
        { status: 400 }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { success: false, error: 'Invalid email format' },
        { status: 400 }
      )
    }

    const emailLower = email.trim().toLowerCase()
    console.log('🔍 Checking for existing user:', emailLower);

    // Check if user already exists
    try {
      const existingUser = await adminAuth.getUserByEmail(emailLower)
      if (existingUser) {
        console.log('❌ User already exists:', emailLower);
        return NextResponse.json(
          {
            success: false,
            error: 'An account with this email already exists'
          },
          { status: 400 }
        )
      }
    } catch (error: any) {
      console.log('✅ User lookup result:', error.code);
      // User doesn't exist, which is good for signup
      if (error.code !== 'auth/user-not-found') {
        console.error('❌ Unexpected error during user lookup:', error);
        throw error
      }
    }

    console.log('🎲 Generating verification code...');
    // Generate and store verification code
    const verificationCode = generateVerificationCode()

    console.log('💾 Storing verification code...');
    await storeVerificationCode(emailLower, verificationCode, 'signup')

    console.log('📧 Sending verification email...');
    // Send verification email
    const fullName = `${firstName.trim()} ${lastName.trim()}`;
    const emailResult = await sendVerificationEmail(emailLower, verificationCode, 'signup', fullName)

    if (!emailResult.success) {
      console.error('❌ Email sending failed:', emailResult.error);
      return NextResponse.json(
        {
          success: false,
          error: emailResult.error || 'Failed to send verification email'
        },
        { status: 500 }
      )
    }

    console.log('✅ Mobile signup verification email sent successfully to:', emailLower);
    // Return success
    return NextResponse.json({
      success: true,
      message: 'Verification code sent to your email. Please check your inbox to complete registration.',
      email: emailLower,
      data: {
        email: emailLower,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        fullName: fullName,
        recoveryEmail: recoveryEmail.trim(),
        role: role
      }
    })

  } catch (error: any) {
    console.error('❌ Mobile send signup verification error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error: ' + error.message
      },
      { status: 500 }
    )
  }
}