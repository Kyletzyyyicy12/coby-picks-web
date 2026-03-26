// web1/app/api/auth/mobile-verify-reset-code/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { adminAuth } from '@/lib/firebase-admin'
import { verifyVerificationCode } from '@/lib/email-service'

export async function POST(request: NextRequest) {
  try {
    console.log('🔍 Mobile reset code verification API called');

    const body = await request.json()
    const { email, code } = body

    console.log('📝 Request data:', {
      email: email || 'missing',
      code: code ? `${code.substring(0, 2)}****` : 'missing'
    });

    // Validate required fields
    if (!email || !code) {
      console.log('❌ Missing required fields');
      return NextResponse.json(
        {
          success: false,
          error: 'Email and verification code are required'
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

    // Validate code format
    if (!/^\d{6}$/.test(code?.toString().trim() || '')) {
      console.log('❌ Invalid code format:', code);
      return NextResponse.json(
        { success: false, error: 'Verification code must be 6 digits' },
        { status: 400 }
      );
    }

    const emailLower = email.trim().toLowerCase()
    const cleanCode = code.toString().trim()

    console.log('🧽 Cleaned data:', {
      emailLower,
      cleanCode: `${cleanCode.substring(0, 2)}****`
    });

    console.log('🔍 Starting verification process...');

    // Verify the code
    const result = await verifyVerificationCode(emailLower, cleanCode, 'password-reset');

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

    console.log('✅ Verification successful - generating reset token...');

    // Verification successful - generate a password reset link using Firebase Auth
    try {
      // Generate a custom reset token for mobile app
      const resetToken = `reset_${Date.now()}_${Math.random().toString(36).substring(2)}`;

      console.log('🔑 Custom reset token generated for mobile app');

      // Return success with the reset token
      return NextResponse.json({
        success: true,
        message: 'Verification code confirmed. You can now reset your password.',
        verified: true,
        email: emailLower,
        resetToken: resetToken
      }, { status: 200 });

    } catch (resetError: any) {
      console.error('❌ Error generating reset link:', resetError);

      return NextResponse.json(
        {
          success: false,
          error: 'Failed to generate password reset link'
        },
        { status: 500 }
      );
    }

  } catch (error: any) {
    console.error('💥 Mobile verify reset code error:', error);
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