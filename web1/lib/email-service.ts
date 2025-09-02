// lib/email-service.ts
import nodemailer from 'nodemailer'
import { adminDb } from './firebase-admin'

export interface EmailTemplate {
  subject: string
  html: string
  text: string
}

export interface VerificationCodeData {
  code: string
  email: string
  type: 'password-reset' | 'signup'
  expiresAt: Date
  createdAt: Date
  attempts: number
}

// Professional email transporter configuration
const createTransporter = () => {
  console.log('🔍 Configuring email transporter...');
  
  // Check if Gmail credentials are configured
  if (process.env.EMAIL_USER && process.env.EMAIL_PASSWORD) {
    console.log('✅ Using Gmail SMTP configuration');
    
    // Clean the app password by removing any spaces (common formatting issue)
    const cleanPassword = process.env.EMAIL_PASSWORD.replace(/\s+/g, '');
    
    console.log('📧 Gmail settings:', {
      user: process.env.EMAIL_USER,
      originalPasswordLength: process.env.EMAIL_PASSWORD?.length || 0,
      cleanPasswordLength: cleanPassword.length,
      from: process.env.EMAIL_FROM
    });
    
    return nodemailer.createTransport({
      service: 'Gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: cleanPassword,
      },
      debug: true, // Enable debugging
      logger: true // Enable logging
    })
  }
  
  // Check if SendGrid is configured
  if (process.env.SENDGRID_API_KEY) {
    console.log('✅ Using SendGrid configuration');
    return nodemailer.createTransport({
      host: 'smtp.sendgrid.net',
      port: 587,
      secure: false,
      auth: {
        user: 'apikey',
        pass: process.env.SENDGRID_API_KEY,
      },
    })
  }
  
  // Check if AWS SES is configured
  if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
    console.log('✅ Using AWS SES configuration');
    return nodemailer.createTransport({
      host: `email-smtp.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com`,
      port: 587,
      secure: false,
      auth: {
        user: process.env.AWS_ACCESS_KEY_ID,
        pass: process.env.AWS_SECRET_ACCESS_KEY,
      },
    })
  }
  
  // Fallback to Ethereal Email for development/testing
  console.log('⚠️ No production email provider configured, using Ethereal Email for testing');
  console.log('📧 Ethereal settings:', {
    user: process.env.ETHEREAL_USER || 'test@ethereal.email',
    pass: process.env.ETHEREAL_PASS ? '[configured]' : '[default]'
  });
  
  return nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    secure: false,
    auth: {
      user: process.env.ETHEREAL_USER || 'test@ethereal.email',
      pass: process.env.ETHEREAL_PASS || 'test-password',
    },
  })
}

// Generate secure 6-digit verification code
export const generateVerificationCode = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

// Store verification code in Firestore
export const storeVerificationCode = async (
  email: string, 
  code: string, 
  type: 'password-reset' | 'signup'
): Promise<void> => {
  const codeData: VerificationCodeData = {
    code,
    email: email.toLowerCase(),
    type,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
    createdAt: new Date(),
    attempts: 0,
  }

  // Store in Firestore with email+type as document ID
  const docId = `${email.toLowerCase()}_${type}`
  await adminDb.collection('verificationCodes').doc(docId).set(codeData)
}

// Verify and consume verification code
export const verifyVerificationCode = async (
  email: string,
  code: string,
  type: 'password-reset' | 'signup'
): Promise<{ valid: boolean; error?: string }> => {
  try {
    console.log('🔍 Starting code verification...');
    console.log('📧 Verification details:', {
      email: email,
      codeLength: code?.length || 0,
      type: type,
      timestamp: new Date().toISOString()
    });
    
    // Input validation
    if (!email || !code || !type) {
      console.log('❌ Missing required parameters');
      return { valid: false, error: 'Missing required verification parameters.' };
    }
    
    // Normalize inputs
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedCode = code.trim();
    
    console.log('🧽 Normalized inputs:', {
      email: normalizedEmail,
      code: `${normalizedCode.substring(0, 2)}****`,
      codeLength: normalizedCode.length
    });
    
    // Validate code format (should be 6 digits)
    if (!/^\d{6}$/.test(normalizedCode)) {
      console.log('❌ Invalid code format');
      return { valid: false, error: 'Invalid verification code format. Code must be 6 digits.' };
    }
    
    const docId = `${normalizedEmail}_${type}`;
    console.log('🔑 Document ID:', docId);
    
    // Get verification document
    const doc = await adminDb.collection('verificationCodes').doc(docId).get();
    console.log('📄 Document exists:', doc.exists);

    if (!doc.exists) {
      console.log('❌ No verification code document found');
      return { valid: false, error: 'No verification code found. Please request a new code.' };
    }

    const data = doc.data() as VerificationCodeData;
    
    // Validate document data
    if (!data || !data.code || !data.expiresAt) {
      console.log('❌ Invalid verification document data');
      await adminDb.collection('verificationCodes').doc(docId).delete();
      return { valid: false, error: 'Invalid verification data. Please request a new code.' };
    }
    
    // Convert Firestore timestamp to Date if needed
    const expiresAt = data.expiresAt instanceof Date ? data.expiresAt : data.expiresAt.toDate();
    const now = new Date();
    
    console.log('📊 Stored verification data:', {
      storedCode: data.code,
      inputCode: normalizedCode,
      codesMatch: data.code === normalizedCode,
      expiresAt: expiresAt.toISOString(),
      now: now.toISOString(),
      isExpired: now > expiresAt,
      attempts: data.attempts || 0
    });

    // Check if expired
    if (now > expiresAt) {
      console.log('⏰ Code has expired, cleaning up...');
      await adminDb.collection('verificationCodes').doc(docId).delete();
      return { valid: false, error: 'Verification code has expired. Please request a new code.' };
    }

    // Check attempt limit (max 5 attempts)
    const attempts = data.attempts || 0;
    if (attempts >= 5) {
      console.log('🚫 Too many attempts, cleaning up...');
      await adminDb.collection('verificationCodes').doc(docId).delete();
      return { valid: false, error: 'Too many failed attempts. Please request a new code.' };
    }

    // Check if code matches - with detailed comparison
    const storedCode = data.code.toString().trim();
    const codesMatch = storedCode === normalizedCode;
    
    console.log('🔍 Detailed code comparison:', {
      storedCode: `'${storedCode}'`,
      inputCode: `'${normalizedCode}'`,
      storedCodeLength: storedCode.length,
      inputCodeLength: normalizedCode.length,
      storedCodeType: typeof storedCode,
      inputCodeType: typeof normalizedCode,
      codesMatch: codesMatch,
      charByCharComparison: storedCode.split('').map((char, index) => ({
        index,
        stored: char,
        input: normalizedCode[index] || 'undefined',
        match: char === (normalizedCode[index] || '')
      }))
    });
    
    if (!codesMatch) {
      console.log('❌ Code mismatch - incrementing attempts');
      
      // Increment attempts
      try {
        await adminDb.collection('verificationCodes').doc(docId).update({
          attempts: attempts + 1
        });
        console.log('📈 Attempts incremented to:', attempts + 1);
      } catch (updateError) {
        console.error('❌ Failed to increment attempts:', updateError);
      }
      
      return { valid: false, error: 'Invalid verification code. Please try again.' };
    }

    console.log('✅ Code verification successful - deleting code');
    
    // Code is valid - delete it (single use)
    try {
      await adminDb.collection('verificationCodes').doc(docId).delete();
      console.log('🗑️ Verification code deleted successfully');
    } catch (deleteError) {
      console.error('⚠️ Failed to delete verification code:', deleteError);
      // Still return success since verification was valid
    }
    
    return { valid: true };

  } catch (error: any) {
    console.error('💥 Error verifying code:', error);
    console.error('📊 Error details:', {
      name: error.name,
      message: error.message,
      code: error.code,
      stack: error.stack?.split('\n').slice(0, 5).join('\n') // Limit stack trace
    });
    return { valid: false, error: 'Verification system error. Please try again.' };
  }
}

export const createPasswordResetVerificationTemplate = (code: string, userEmail: string): EmailTemplate => {
  const subject = 'CobyPicks - Password Reset Verification Code'
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Password Reset - CobyPicks</title>
        <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; }
            .container { max-width: 600px; margin: 0 auto; background-color: white; }
            .header { background: linear-gradient(135deg, #8e0b16 0%, #66181E 100%); color: white; padding: 40px 20px; text-align: center; }
            .content { padding: 40px 20px; }
            .code-box { background-color: #fff5f5; border: 2px dashed #8e0b16; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0; }
            .verification-code { font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #8e0b16; }
            .footer { background-color: #f8f9fa; padding: 20px; text-align: center; font-size: 14px; color: #666; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🔒 CobyPicks</h1>
                <p>Password Reset Request</p>
            </div>
            <div class="content">
                <h2>Password Reset Verification</h2>
                <p>You requested to reset your password for your CobyPicks account. Please enter the verification code below to proceed:</p>
                
                <div class="code-box">
                    <div class="verification-code">${code}</div>
                </div>
                
                <p><strong>Important Security Information:</strong></p>
                <ul>
                    <li>This code expires in <strong>10 minutes</strong></li>
                    <li>Only use this code if you requested a password reset</li>
                    <li>Never share this code with anyone</li>
                    <li>After verification, you'll be able to set a new password</li>
                </ul>
                
                <p><strong>If you didn't request a password reset:</strong></p>
                <ul>
                    <li>Ignore this email - your account is safe</li>
                    <li>Consider changing your password as a precaution</li>
                    <li>Contact support if you have security concerns</li>
                </ul>
                
                <p>Best regards,<br>The CobyPicks Team</p>
            </div>
            <div class="footer">
                <p>This is an automated security email from CobyPicks</p>
                <p>© 2024 CobyPicks. All rights reserved.</p>
            </div>
        </div>
    </body>
    </html>
  `

  const text = `
CobyPicks - Password Reset Verification Code

Password Reset Verification

You requested to reset your password for your CobyPicks account. Please enter the verification code below to proceed:

Verification Code: ${code}

Important Security Information:
- This code expires in 10 minutes
- Only use this code if you requested a password reset
- Never share this code with anyone
- After verification, you'll be able to set a new password

If you didn't request a password reset:
- Ignore this email - your account is safe
- Consider changing your password as a precaution
- Contact support if you have security concerns

Best regards,
The CobyPicks Team

This is an automated security email from CobyPicks
© 2024 CobyPicks. All rights reserved.
  `

  return { subject, html, text }
}

export const createSignupVerificationTemplate = (code: string, userEmail: string, fullName?: string): EmailTemplate => {
  const subject = 'CobyPicks - Verify Your Email to Complete Registration'
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Email Verification - CobyPicks</title>
        <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; }
            .container { max-width: 600px; margin: 0 auto; background-color: white; }
            .header { background: linear-gradient(135deg, #8e0b16 0%, #66181E 100%); color: white; padding: 40px 20px; text-align: center; }
            .content { padding: 40px 20px; }
            .code-box { background-color: #fff5f5; border: 2px dashed #8e0b16; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0; }
            .verification-code { font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #8e0b16; }
            .footer { background-color: #f8f9fa; padding: 20px; text-align: center; font-size: 14px; color: #666; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🎯 CobyPicks</h1>
                <p>Welcome to CobyPicks!</p>
            </div>
            <div class="content">
                <h2>Hi${fullName ? ` ${fullName}` : ''}! 👋</h2>
                <p>Thank you for signing up for CobyPicks! To complete your registration and secure your account, please verify your email address by entering the code below:</p>
                
                <div class="code-box">
                    <div class="verification-code">${code}</div>
                </div>
                
                <p><strong>What happens next?</strong></p>
                <ul>
                    <li>Enter this code in the verification form</li>
                    <li>Complete your account setup</li>
                    <li>Start creating and joining interactive wheel sessions</li>
                    <li>Collaborate with teams and organize fun activities</li>
                </ul>
                
                <p><strong>Important Security Information:</strong></p>
                <ul>
                    <li>This code expires in <strong>10 minutes</strong></li>
                    <li>Only use this code if you just signed up</li>
                    <li>Never share this code with anyone</li>
                    <li>If you didn't create this account, please ignore this email</li>
                </ul>
                
                <p>We're excited to have you join our community!</p>
                
                <p>Best regards,<br>The CobyPicks Team</p>
            </div>
            <div class="footer">
                <p>This is an automated registration email from CobyPicks</p>
                <p>© 2024 CobyPicks. All rights reserved.</p>
            </div>
        </div>
    </body>
    </html>
  `

  const text = `
CobyPicks - Verify Your Email to Complete Registration

Hi${fullName ? ` ${fullName}` : ''}!

Thank you for signing up for CobyPicks! To complete your registration and secure your account, please verify your email address by entering the code below:

Verification Code: ${code}

What happens next?
- Enter this code in the verification form
- Complete your account setup
- Start creating and joining interactive wheel sessions
- Collaborate with teams and organize fun activities

Important Security Information:
- This code expires in 10 minutes
- Only use this code if you just signed up
- Never share this code with anyone
- If you didn't create this account, please ignore this email

We're excited to have you join our community!

Best regards,
The CobyPicks Team

This is an automated registration email from CobyPicks
© 2024 CobyPicks. All rights reserved.
  `

  return { subject, html, text }
}

// Send verification email
export const sendVerificationEmail = async (
  email: string,
  code: string,
  type: 'password-reset' | 'signup',
  fullName?: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    console.log('📧 Starting email send process...');
    console.log('📧 Email details:', { 
      to: email, 
      type, 
      fullName: fullName ? 'provided' : 'not provided',
      code: code ? `${code.substring(0, 2)}****` : 'missing'
    });
    
    // Test transporter creation
    console.log('🔧 Creating email transporter...');
    const transporter = createTransporter()
    
    // Test connection
    console.log('🔌 Testing SMTP connection...');
    try {
      await transporter.verify();
      console.log('✅ SMTP connection verified successfully');
    } catch (verifyError) {
      console.error('❌ SMTP connection failed:', verifyError);
      return { success: false, error: `SMTP connection failed: ${verifyError.message}` };
    }
    
    console.log('📝 Generating email template...');
    let template: EmailTemplate
    switch (type) {
      case 'password-reset':
        template = createPasswordResetVerificationTemplate(code, email)
        break
      case 'signup':
        template = createSignupVerificationTemplate(code, email, fullName)
        break
      default:
        throw new Error('Invalid email type')
    }

    const fromAddress = process.env.EMAIL_FROM || '"CobyPicks Security" <noreply@cobypicks.com>';
    console.log('📮 Email configuration:', {
      from: fromAddress,
      to: email,
      subject: template.subject,
      hasHtml: !!template.html,
      hasText: !!template.text
    });

    const mailOptions = {
      from: fromAddress,
      to: email,
      subject: template.subject,
      text: template.text,
      html: template.html,
    }

    console.log('🚀 Sending email...');
    const result = await transporter.sendMail(mailOptions)
    console.log('✅ Email sent successfully!');
    console.log('📨 Send result:', {
      messageId: result.messageId,
      accepted: result.accepted,
      rejected: result.rejected,
      pending: result.pending,
      response: result.response
    });
    
    // Additional Gmail-specific information
    if (result.messageId) {
      console.log('📬 Gmail Message ID:', result.messageId);
    }
    
    return { success: true }
  } catch (error: any) {
    console.error('❌ Email sending failed with error:', error);
    console.error('📊 Error details:', {
      name: error.name,
      message: error.message,
      code: error.code,
      command: error.command,
      response: error.response,
      responseCode: error.responseCode
    });
    
    let errorMessage = 'Failed to send verification email. Please try again.';
    
    // Provide specific error messages for common Gmail issues
    if (error.code === 'EAUTH') {
      errorMessage = 'Email authentication failed. Please check your Gmail app password.';
    } else if (error.code === 'ECONNECTION') {
      errorMessage = 'Unable to connect to Gmail servers. Please check your internet connection.';
    } else if (error.message?.includes('Invalid login')) {
      errorMessage = 'Invalid Gmail credentials. Please verify your email and app password.';
    } else if (error.message?.includes('quota')) {
      errorMessage = 'Gmail sending quota exceeded. Please try again later.';
    }
    
    return { success: false, error: `${errorMessage} (${error.message})` }
  }
}

// Clean up expired verification codes (run periodically)
export const cleanupExpiredCodes = async (): Promise<void> => {
  try {
    const now = new Date()
    const snapshot = await adminDb.collection('verificationCodes')
      .where('expiresAt', '<', now)
      .get()

    const batch = adminDb.batch()
    snapshot.docs.forEach(doc => {
      batch.delete(doc.ref)
    })

    await batch.commit()
    console.log(`Cleaned up ${snapshot.docs.length} expired verification codes`)
  } catch (error) {
    console.error('Error cleaning up expired codes:', error)
  }
}