// app/api/auth/test-email/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { generateVerificationCode, sendVerificationEmail } from '@/lib/email-service'

export async function POST(request: NextRequest) {
  try {
    console.log('🧪 Email test API called');
    
    const body = await request.json()
    const { email } = body

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required for testing' }, 
        { status: 400 }
      )
    }

    console.log('📧 Testing email configuration...');
    console.log('🔧 Environment variables check:');
    console.log('EMAIL_USER:', process.env.EMAIL_USER ? 'configured' : 'missing');
    console.log('EMAIL_PASSWORD:', process.env.EMAIL_PASSWORD ? `configured (${process.env.EMAIL_PASSWORD.length} chars)` : 'missing');
    console.log('EMAIL_FROM:', process.env.EMAIL_FROM || 'using default');

    // Generate test verification code
    const testCode = generateVerificationCode()
    console.log('🎲 Generated test code:', testCode);

    // Send test email
    console.log('📤 Sending test email...');
    const emailResult = await sendVerificationEmail(
      email, 
      testCode, 
      'signup', 
      'Test User'
    )
    
    if (emailResult.success) {
      console.log('✅ Test email sent successfully');
      return NextResponse.json({ 
        success: true, 
        message: `Test verification email sent successfully to ${email}`,
        code: testCode, // Include code for testing purposes
        config: {
          emailUser: process.env.EMAIL_USER,
          emailFrom: process.env.EMAIL_FROM,
          hasPassword: !!process.env.EMAIL_PASSWORD
        }
      })
    } else {
      console.error('❌ Test email failed:', emailResult.error);
      return NextResponse.json(
        { 
          error: `Test email failed: ${emailResult.error}`,
          config: {
            emailUser: process.env.EMAIL_USER,
            emailFrom: process.env.EMAIL_FROM,
            hasPassword: !!process.env.EMAIL_PASSWORD
          }
        }, 
        { status: 500 }
      )
    }

  } catch (error: any) {
    console.error('❌ Email test error:', error)
    return NextResponse.json(
      { 
        error: `Email test failed: ${error.message}`,
        details: {
          name: error.name,
          code: error.code,
          response: error.response
        }
      }, 
      { status: 500 }
    )
  }
}