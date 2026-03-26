// web1/app/api/auth/mobile-reset-verification/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { adminAuth, adminDb } from '@/lib/firebase-admin'
import {
  generateVerificationCode,
  storeVerificationCode,
  sendVerificationEmail
} from '@/lib/email-service'

export async function POST(request: NextRequest) {
  try {
    console.log('📧 Mobile reset verification API called');

    const body = await request.json()
    const { email } = body

    console.log('📝 Request data:', {
      email: email ? 'provided' : 'missing'
    });

    if (!email) {
      console.log('❌ Missing email');
      return NextResponse.json(
        {
          success: false,
          error: 'Email is required'
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

    // Check if user exists - try primary email first, then recovery email
    let targetEmail = emailLower
    let userExists = false

    try {
      // Try to get user by primary email
      const userRecord = await adminAuth.getUserByEmail(emailLower)
      if (userRecord) {
        userExists = true
        targetEmail = userRecord.email || emailLower
      }
    } catch (error: any) {
      if (error.code === 'auth/user-not-found') {
        // Try to find by recovery email in Firestore
        try {
          const usersRef = adminDb.collection('users')
          const snapshot = await usersRef.where('recoveryEmail', '==', emailLower).limit(1).get()

          if (!snapshot.empty) {
            const userData = snapshot.docs[0].data()
            const primaryEmail = userData?.email

            if (primaryEmail) {
              // Verify the primary email exists in Firebase Auth
              try {
                await adminAuth.getUserByEmail(primaryEmail)
                userExists = true
                targetEmail = primaryEmail
              } catch (authError) {
                console.warn('Recovery email found but primary email not in Auth:', primaryEmail)
              }
            }
          }
        } catch (firestoreError) {
          console.warn('Firestore recovery email lookup failed:', firestoreError)
        }
      }
    }

    if (!userExists) {
      // For security, return success even if user doesn't exist
      console.log('⚠️ User not found, but returning success for security');
      return NextResponse.json({
        success: true,
        message: 'If an account exists for this email, you will receive a verification code shortly.'
      })
    }

    console.log('🎲 Generating verification code...');
    // Generate and store verification code
    const verificationCode = generateVerificationCode()
    await storeVerificationCode(targetEmail, verificationCode, 'password-reset')

    console.log('📧 Sending verification email...');
    // Send verification email
    const emailResult = await sendVerificationEmail(targetEmail, verificationCode, 'password-reset')

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

    console.log('✅ Mobile reset verification email sent successfully to:', targetEmail);
    // Return success
    return NextResponse.json({
      success: true,
      message: 'If an account exists for this email, you will receive a verification code shortly.',
      email: targetEmail
    })

  } catch (error: any) {
    console.error('❌ Mobile send reset verification error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error: ' + error.message
      },
      { status: 500 }
    )
  }
}