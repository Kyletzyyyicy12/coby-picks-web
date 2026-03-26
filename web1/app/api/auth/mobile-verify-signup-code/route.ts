// web1/app/api/auth/mobile-verify-signup-code/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { adminAuth, adminDb } from '@/lib/firebase-admin'
import { verifyVerificationCode } from '@/lib/email-service'
import { Timestamp } from 'firebase-admin/firestore'

export async function POST(request: NextRequest) {
  try {
    console.log('🔍 Mobile signup code verification API called');

    const body = await request.json()
    const { email, code, firstName, lastName, recoveryEmail, role, password, teacherConsent, dataProcessingConsent } = body

    console.log('📝 Request data:', {
      email: email || 'missing',
      code: code ? `${code.substring(0, 2)}****` : 'missing',
      firstName: firstName ? 'provided' : 'missing',
      lastName: lastName ? 'provided' : 'missing',
      recoveryEmail: recoveryEmail ? 'provided' : 'optional - not provided',
      role: role || 'missing',
      password: password ? 'provided' : 'missing',
      teacherConsent: teacherConsent === true ? 'yes' : 'missing',
      dataProcessingConsent: dataProcessingConsent === true ? 'yes' : 'missing'
    });

    // Validate required fields (recoveryEmail is now optional)
    if (!email || !code || !firstName || !lastName || !role || !password) {
      console.log('❌ Missing required fields');
      return NextResponse.json(
        {
          success: false,
          error: 'Email, verification code, first name, last name, role, and password are required'
        },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      console.log('❌ Invalid email format:', email);
      return NextResponse.json(
        { success: false, error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Validate code format - allow special "VERIFIED" code for web completion
    const isWebCompletion = code?.toString().trim() === 'VERIFIED';
    if (!isWebCompletion && !/^\d{6}$/.test(code?.toString().trim() || '')) {
      console.log('❌ Invalid code format:', code);
      return NextResponse.json(
        { success: false, error: 'Verification code must be 6 digits' },
        { status: 400 }
      );
    }

    const emailLower = email.trim().toLowerCase()
    const cleanCode = code.toString().trim()

    const fullName = `${firstName.trim()} ${lastName.trim()}`;
    console.log('🧽 Cleaned data:', {
      emailLower,
      cleanCode: `${cleanCode.substring(0, 2)}****`,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      fullName: fullName,
      recoveryEmail: recoveryEmail ? recoveryEmail.trim() : 'not provided (optional)',
      role
    });

    console.log('🔍 Starting verification process...');

    // Skip verification for web completion (already verified via modal)
    let verificationPassed = false;
    if (isWebCompletion) {
      console.log('✅ Web verification completion - skipping code verification');
      verificationPassed = true;
    } else {
      // Verify the code for mobile users
      const result = await verifyVerificationCode(emailLower, cleanCode, 'signup');

      console.log('📊 Verification result:', {
        valid: result.valid,
        hasError: !!result.error,
        error: result.error || 'none'
      });

      if (!result.valid) {
        console.log('❌ Verification failed:', result.error);
        return NextResponse.json(
          {
            success: false,
            error: result.error || 'Invalid verification code'
          },
          { status: 400 }
        );
      }
      verificationPassed = true;
    }

    console.log('✅ Verification successful - creating user account...');

    // Verification successful - create the user account
    try {
      // Create user in Firebase Auth
      const userRecord = await adminAuth.createUser({
        email: emailLower,
        password: password,
        displayName: fullName.trim(),
        emailVerified: true // Since they verified via email
      });

      console.log('👤 User created in Firebase Auth:', userRecord.uid);

      // Create user profile in Firestore
      const now = new Date();
      const userProfile: Record<string, any> = {
        uid: userRecord.uid,
        email: emailLower,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        fullName: fullName,
        displayName: fullName,
        role: role,
        collaborators: [],
        dataPrivacyConsentGiven: (teacherConsent === true && dataProcessingConsent === true) ? true : false,
        createdAt: Timestamp.fromDate(now),
        lastLoginAt: Timestamp.fromDate(now),
        lastActiveAt: Timestamp.fromDate(now),
        lastActiveDevice: teacherConsent !== undefined ? "Web App" : "Mobile App",
        isActive: true,
        roleLocked: true,
        roleLockedAt: Timestamp.fromDate(now),
        roleChangedBy: 'system',
        roleChangeHistory: [{
          oldRole: 'none',
          newRole: role,
          changedBy: 'system',
          changedAt: now,
          reason: 'Mobile app user registration with email verification'
        }]
      };

      // Only add recovery email if provided
      if (recoveryEmail && recoveryEmail.trim()) {
        userProfile.recoveryEmail = recoveryEmail.trim();
      }

      await adminDb.collection('users').doc(userRecord.uid).set(userProfile);

      console.log('📝 User profile created in Firestore');

      // Save privacy consent if provided (web registration flow)
      if (teacherConsent !== undefined && dataProcessingConsent !== undefined) {
        console.log('📋 Saving privacy consent data...');
        await adminDb.collection('privacyConsents').doc(userRecord.uid).set({
          userId: userRecord.uid,
          teacherConsent: teacherConsent === true,
          dataProcessingConsent: dataProcessingConsent === true,
          consentDate: Timestamp.fromDate(now),
          version: '1.0',
          userAgent: request.headers.get('user-agent') || 'unknown',
          ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
        });
        console.log('✅ Privacy consent saved to Firestore');
      }

      // Return success
      return NextResponse.json({
        success: true,
        message: 'Account created successfully! You can now log in.',
        user: {
          uid: userRecord.uid,
          email: emailLower,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          fullName: fullName,
          role: role
        }
      }, { status: 200 });

    } catch (createError: any) {
      console.error('❌ Error creating user account:', createError);

      // Handle specific Firebase Auth errors
      let errorMessage = 'Failed to create user account';
      if (createError.code === 'auth/email-already-in-use') {
        errorMessage = 'An account with this email already exists';
      } else if (createError.code === 'auth/weak-password') {
        errorMessage = 'Password is too weak';
      } else if (createError.code === 'auth/invalid-email') {
        errorMessage = 'Invalid email address';
      }

      return NextResponse.json(
        {
          success: false,
          error: errorMessage
        },
        { status: 400 }
      );
    }

  } catch (error: any) {
    console.error('💥 Mobile verify signup code error:', error);
    console.error('📊 Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack?.split('\n').slice(0, 5).join('\n') // Limit stack trace
    });

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error during verification'
      },
      { status: 500 }
    );
  }
}