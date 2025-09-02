// app/api/auth/send-reset-verification/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { adminAuth, adminDb } from '@/lib/firebase-admin'
import { 
  generateVerificationCode, 
  storeVerificationCode, 
  sendVerificationEmail 
} from '@/lib/email-service'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email } = body

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' }, 
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
      return NextResponse.json({ 
        success: true, 
        message: 'If an account exists for this email, you will receive a verification code shortly.'
      })
    }

    // Generate and store verification code
    const verificationCode = generateVerificationCode()
    await storeVerificationCode(targetEmail, verificationCode, 'password-reset')

    // Send verification email
    const emailResult = await sendVerificationEmail(targetEmail, verificationCode, 'password-reset')
    
    if (!emailResult.success) {
      return NextResponse.json(
        { error: emailResult.error || 'Failed to send verification email' }, 
        { status: 500 }
      )
    }

    // Return success
    return NextResponse.json({ 
      success: true, 
      message: 'If an account exists for this email, you will receive a verification code shortly.',
      email: targetEmail
    })

  } catch (error: any) {
    console.error('Send reset verification error:', error)
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    )
  }
}