// app/api/auth/verify-signup-code/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { verifyVerificationCode } from '@/lib/email-service'

export async function POST(request: NextRequest) {
  try {
    console.log('🔍 Signup code verification API called');
    
    // Parse request body with error handling
    let body;
    try {
      body = await request.json();
    } catch (parseError) {
      console.log('❌ Failed to parse request body:', parseError);
      return NextResponse.json(
        { error: 'Invalid request format' }, 
        { status: 400 }
      );
    }
    
    const { email, code } = body;

    console.log('📝 Request data:', { 
      email: email || 'missing', 
      code: code ? `${code.substring(0, 2)}****` : 'missing',
      codeLength: code?.length || 0,
      hasEmail: !!email,
      hasCode: !!code
    });

    // Validate required fields
    if (!email || !code) {
      console.log('❌ Missing required fields - email:', !!email, 'code:', !!code);
      return NextResponse.json(
        { error: 'Email and verification code are required' }, 
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      console.log('❌ Invalid email format:', email);
      return NextResponse.json(
        { error: 'Invalid email format' }, 
        { status: 400 }
      );
    }

    // Validate code format
    if (!/^\d{6}$/.test(code?.toString().trim() || '')) {
      console.log('❌ Invalid code format:', code);
      return NextResponse.json(
        { error: 'Verification code must be 6 digits' }, 
        { status: 400 }
      );
    }

    const emailLower = email.trim().toLowerCase();
    const cleanCode = code.toString().trim();
    
    console.log('🧽 Cleaned data:', {
      emailLower,
      cleanCode: `${cleanCode.substring(0, 2)}****`,
      cleanCodeLength: cleanCode.length
    });

    console.log('🔍 Starting verification process...');
    
    // Verify the code
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
          error: result.error || 'Invalid verification code',
          code: 'VERIFICATION_FAILED'
        }, 
        { status: 400 }
      );
    }

    console.log('✅ Verification successful!');
    
    // Code is valid - return success with detailed response
    return NextResponse.json({ 
      success: true, 
      message: 'Email verified successfully. You can now complete your registration.',
      verified: true,
      email: emailLower,
      timestamp: new Date().toISOString()
    }, { status: 200 });

  } catch (error: any) {
    console.error('💥 Verify signup code error:', error);
    console.error('📊 Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack?.split('\n').slice(0, 5).join('\n') // Limit stack trace
    });
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Internal server error during verification',
        code: 'INTERNAL_ERROR'
      }, 
      { status: 500 }
    );
  }
}