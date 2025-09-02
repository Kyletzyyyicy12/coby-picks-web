// app/api/auth/send-signup-verification/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { adminAuth } from '@/lib/firebase-admin'
import { 
  generateVerificationCode, 
  storeVerificationCode, 
  sendVerificationEmail
} from '@/lib/email-service'

export async function POST(request: NextRequest) {
  try {
    console.log('📧 Signup verification API called');
    
    const body = await request.json()
    const { email, fullName } = body

    console.log('📝 Request data:', { email: email ? 'provided' : 'missing', fullName: fullName ? 'provided' : 'missing' });

    if (!email || !fullName) {
      console.log('❌ Missing required fields:', { email: !!email, fullName: !!fullName });
      return NextResponse.json(
        { error: 'Email and full name are required' }, 
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
          { error: 'An account with this email already exists' }, 
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
    const emailResult = await sendVerificationEmail(emailLower, verificationCode, 'signup', fullName)
    
    if (!emailResult.success) {
      console.error('❌ Email sending failed:', emailResult.error);
      return NextResponse.json(
        { error: emailResult.error || 'Failed to send verification email' }, 
        { status: 500 }
      )
    }

    console.log('✅ Signup verification email sent successfully to:', emailLower);
    // Return success
    return NextResponse.json({ 
      success: true, 
      message: 'Verification code sent to your email. Please check your inbox to complete registration.',
      email: emailLower
    })

  } catch (error: any) {
    console.error('❌ Send signup verification error:', error)
    return NextResponse.json(
      { error: 'Internal server error: ' + error.message }, 
      { status: 500 }
    )
  }
}