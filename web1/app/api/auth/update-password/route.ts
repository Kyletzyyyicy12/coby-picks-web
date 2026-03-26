// app/api/auth/update-password/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { adminAuth } from '@/lib/firebase-admin'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, newPassword } = body

    if (!email || !newPassword) {
      return NextResponse.json(
        { error: 'Email and new password are required' }, 
        { status: 400 }
      )
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters long' }, 
        { status: 400 }
      )
    }

    const emailLower = email.trim().toLowerCase()

    // Get user by email and update password
    const userRecord = await adminAuth.getUserByEmail(emailLower)
    
    if (!userRecord) {
      return NextResponse.json(
        { error: 'User not found' }, 
        { status: 404 }
      )
    }

    // Update password using Firebase Admin SDK
    await adminAuth.updateUser(userRecord.uid, {
      password: newPassword
    })

    return NextResponse.json({ 
      success: true, 
      message: 'Password updated successfully'
    })

  } catch (error: any) {
    console.error('Update password error:', error)
    
    // Handle specific Firebase errors
    let errorMessage = 'Failed to update password'
    
    if (error.code === 'auth/user-not-found') {
      errorMessage = 'No account found with this email address'
    } else if (error.code === 'auth/weak-password') {
      errorMessage = 'Password is too weak. Please choose a stronger password'
    }

    return NextResponse.json(
      { error: errorMessage }, 
      { status: 500 }
    )
  }
}