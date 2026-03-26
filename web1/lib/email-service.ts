// lib/email-service.ts
import nodemailer from 'nodemailer'
import { adminDb } from './firebase-admin'
import { Timestamp } from 'firebase-admin/firestore'

export interface EmailTemplate {
  subject: string
  html: string
  text: string
}

export interface VerificationCodeData {
  code: string
  email: string
  type: 'password-reset' | 'signup'
  expiresAt: Timestamp
  createdAt: Timestamp
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
      host: 'smtp.gmail.com',
      port: 587,
      secure: false, // Use TLS
      requireTLS: true,
      auth: {
        user: process.env.EMAIL_USER,
        pass: cleanPassword,
      },
      // Gmail-specific settings
      tls: {
        ciphers: 'SSLv3',
        rejectUnauthorized: false // Only for development
      },
      debug: true,
      logger: true,
      // Connection timeout
      connectionTimeout: 30000, // 30 seconds
      greetingTimeout: 30000,
      socketTimeout: 30000,
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
    expiresAt: Timestamp.fromDate(new Date(Date.now() + 10 * 60 * 1000)), // 10 minutes
    createdAt: Timestamp.now(),
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

export const createWelcomeEmailTemplate = (userName: string, password: string, role: string, adminEmail: string): EmailTemplate => {
  const subject = `Welcome to CobyPicks - Your Account Details`

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to CobyPicks</title>
        <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; }
            .container { max-width: 600px; margin: 0 auto; background-color: white; }
            .header { background: linear-gradient(135deg, #8e0b16 0%, #66181E 100%); color: white; padding: 40px 20px; text-align: center; }
            .content { padding: 40px 20px; }
            .credentials-box { background-color: #fff5f5; border: 2px solid #8e0b16; border-radius: 8px; padding: 20px; margin: 20px 0; }
            .credential-item { margin: 10px 0; padding: 10px; background-color: white; border-radius: 4px; border-left: 4px solid #8e0b16; }
            .password-warning { background-color: #fff3cd; border: 1px solid #ffeaa7; border-radius: 4px; padding: 15px; margin: 20px 0; }
            .footer { background-color: #f8f9fa; padding: 20px; text-align: center; font-size: 14px; color: #666; }
            .button { display: inline-block; background-color: #8e0b16; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 0; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🎯 Welcome to CobyPicks!</h1>
                <p>Your account has been created successfully</p>
            </div>
            <div class="content">
                <h2>Hi ${userName}! 👋</h2>
                <p>Welcome to CobyPicks! Your account has been created and is ready to use. Here are your login credentials:</p>

                <div class="credentials-box">
                    <h3 style="margin-top: 0; color: #8e0b16;">Your Account Details</h3>
                    <div class="credential-item">
                        <strong>Full Name:</strong> ${userName}
                    </div>
                    <div class="credential-item">
                        <strong>Role:</strong> ${role.charAt(0).toUpperCase() + role.slice(1)}
                    </div>
                    <div class="credential-item">
                        <strong>Password:</strong> <code style="background-color: #f8f9fa; padding: 2px 4px; border-radius: 3px;">${password}</code>
                    </div>
                </div>

                <div class="password-warning">
                    <strong>🔒 Security Notice:</strong>
                    <ul style="margin: 10px 0; padding-left: 20px;">
                        <li>Please save these credentials in a secure location</li>
                        <li>You will be prompted to change your password on first login</li>
                        <li>For security, we recommend setting up a recovery email</li>
                    </ul>
                </div>

                <p><strong>What happens when you log in?</strong></p>
                <ul>
                    <li>You'll be prompted to change your password for security</li>
                    <li>You can optionally add a recovery email address</li>
                    <li>After setup, you'll be taken to your dashboard</li>
                </ul>

                <p><strong>Need help getting started?</strong></p>
                <ul>
                    <li>Check out our user guide for tips and tutorials</li>
                    <li>Contact support if you have any questions</li>
                    <li>Explore the different features available for your role</li>
                </ul>

                <p>We're excited to have you join our community!</p>

                <p>Best regards,<br>The CobyPicks Team</p>
                <p style="font-size: 12px; color: #666;">This account was created by: ${adminEmail}</p>
            </div>
            <div class="footer">
                <p>This is an automated welcome email from CobyPicks</p>
                <p>© 2024 CobyPicks. All rights reserved.</p>
            </div>
        </div>
    </body>
    </html>
  `

  const text = `
Welcome to CobyPicks - You are now a ${role.charAt(0).toUpperCase() + role.slice(1)}

Hi ${userName}!

Welcome to CobyPicks! Your account has been created by an administrator and is ready to use.

======================================================================
🎯 ROLE ASSIGNMENT CONFIRMATION
======================================================================

You have been assigned the role: ${role.charAt(0).toUpperCase() + role.slice(1)}

${role === 'organizer'
    ? 'As an Organizer, you can create and manage activities, organize live sessions, and manage participants.'
    : 'As a Participant, you can join activities, participate in spins, and collaborate in live sessions.'}

Features available to you as a ${role.charAt(0).toUpperCase() + role.slice(1)}:
${role === 'organizer'
    ? '- Create picker wheel activities\n- Organize live sessions\n- Manage participants\n- View analytics and reports'
    : '- Join picker wheel activities\n- Participate in live draws\n- View activity results\n- Collaborate with organizers'}

======================================================================
🔐 YOUR LOGIN CREDENTIALS
======================================================================

Full Name: ${userName}
Assigned Role: ${role.charAt(0).toUpperCase() + role.slice(1)}
Temporary Password: ${password}

======================================================================
⚠️  IMPORTANT SECURITY STEPS
======================================================================

1. Save these credentials securely - you'll need them to log in
2. Change your password immediately when you first log in
3. Set up a recovery email for account security
4. Keep your role assignment in mind when using the platform

======================================================================

What happens when you log in?
- You'll be prompted to change your temporary password
- You can optionally add a recovery email address
- You'll be taken to your role-specific dashboard
- You can start exploring features available to ${role}s

Need help getting started?
- Check out our user guide for ${role}-specific tutorials
- Contact support if you have any questions
- Explore the features available in your ${role} dashboard

We're excited to have you join our community as a ${role.charAt(0).toUpperCase() + role.slice(1)}!

Best regards,
The CobyPicks Team

This account was created by: ${adminEmail}

This is an automated welcome email from CobyPicks
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

// Send welcome email for new users
export const sendWelcomeEmail = async (
  email: string,
  userName: string,
  password: string,
  role: string,
  adminEmail: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    console.log('📧 Starting welcome email send process...');
    console.log('📧 Welcome email details:', {
      to: email,
      userName,
      role,
      adminEmail,
      password: password ? `${password.substring(0, 2)}****` : 'missing'
    });

    // Create transporter
    console.log('🔧 Creating email transporter...');
    const transporter = createTransporter()

    // Test connection
    console.log('🔌 Testing SMTP connection...');
    try {
      await transporter.verify();
      console.log('✅ SMTP connection verified successfully');
    } catch (verifyError: any) {
      console.error('❌ SMTP connection failed:', verifyError);
      return { success: false, error: `SMTP connection failed: ${verifyError.message || 'Unknown error'}` };
    }

    console.log('📝 Generating welcome email template...');
    const template = createWelcomeEmailTemplate(userName, password, role, adminEmail)

    const fromAddress = process.env.EMAIL_FROM || '"CobyPicks" <noreply@cobypicks.com>';
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

    console.log('🚀 Sending welcome email...');
    const result = await transporter.sendMail(mailOptions)
    console.log('✅ Welcome email sent successfully!');
    console.log('📨 Send result:', {
      messageId: result.messageId,
      accepted: result.accepted,
      rejected: result.rejected,
      pending: result.pending,
      response: result.response
    });

    return { success: true }
  } catch (error: any) {
    console.error('❌ Welcome email sending failed with error:', error);
    console.error('📊 Error details:', {
      name: error.name,
      message: error.message,
      code: error.code,
      command: error.command,
      response: error.response,
      responseCode: error.responseCode
    });

    let errorMessage = 'Failed to send welcome email. Please try again.';

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
    } catch (verifyError: any) {
      console.error('❌ SMTP connection failed:', verifyError);
      return { success: false, error: `SMTP connection failed: ${verifyError.message || 'Unknown error'}` };
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
// Test Gmail connection and configuration
export const testGmailConnection = async (): Promise<{ success: boolean; error?: string; details?: any }> => {
  try {
    console.log('🔧 Testing Gmail connection...');

    const transporter = createTransporter();
    console.log('📧 Transporter created, attempting to verify...');

    const verificationResult = await transporter.verify();
    console.log('✅ Gmail connection verified successfully!', verificationResult);

    return {
      success: true,
      details: {
        verificationResult,
        emailUser: process.env.EMAIL_USER,
        emailFrom: process.env.EMAIL_FROM,
        timestamp: new Date().toISOString()
      }
    };
  } catch (error: any) {
    console.error('❌ Gmail connection test failed:', error);
    console.error('📊 Error details:', {
      name: error.name,
      message: error.message,
      code: error.code,
      command: error.command,
      response: error.response,
      responseCode: error.responseCode
    });

    let errorMessage = 'Gmail connection failed';
    let suggestions = '';

    if (error.code === 'EAUTH') {
      errorMessage = 'Gmail authentication failed';
      suggestions = 'Please check your Gmail app password and email address.';
    } else if (error.code === 'ECONNECTION') {
      errorMessage = 'Cannot connect to Gmail servers';
      suggestions = 'Please check your internet connection and firewall settings.';
    } else if (error.code === 'ETIMEDOUT') {
      errorMessage = 'Connection to Gmail servers timed out';
      suggestions = 'Please check your internet connection and try again.';
    } else if (error.message?.includes('Invalid login')) {
      errorMessage = 'Invalid Gmail login credentials';
      suggestions = 'Please verify your Gmail address and app password.';
    }

    return {
      success: false,
      error: `${errorMessage}: ${error.message}`,
      details: {
        suggestions,
        originalError: error.message,
        errorCode: error.code,
        timestamp: new Date().toISOString()
      }
    };
  }
}

// Send test email to verify Gmail setup
export const sendTestEmail = async (testEmail: string): Promise<{ success: boolean; error?: string }> => {
  try {
    console.log('📧 Sending test email to:', testEmail);

    const transporter = createTransporter();

    // First verify connection
    const connectionTest = await testGmailConnection();
    if (!connectionTest.success) {
      return { success: false, error: `Connection test failed: ${connectionTest.error}` };
    }

    const testTemplate = {
      subject: 'CobyPicks - Gmail Test Email',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Gmail Test - CobyPicks</title>
            <style>
                body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; }
                .container { max-width: 600px; margin: 0 auto; background-color: white; }
                .header { background: linear-gradient(135deg, #8e0b16 0%, #66181E 100%); color: white; padding: 40px 20px; text-align: center; }
                .content { padding: 40px 20px; }
                .success-box { background-color: #d4edda; border: 2px solid #8e0b16; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0; }
                .footer { background-color: #f8f9fa; padding: 20px; text-align: center; font-size: 14px; color: #666; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>✅ CobyPicks</h1>
                    <p>Gmail Configuration Test</p>
                </div>
                <div class="content">
                    <h2>Gmail Test Successful! 🎉</h2>
                    <p>Great news! Your Gmail configuration is working perfectly.</p>

                    <div class="success-box">
                        <h3 style="margin-top: 0; color: #155724;">Email Configuration Verified</h3>
                        <p>Your Gmail SMTP settings are correctly configured and ready to send emails.</p>
                        <p><strong>Test completed at:</strong> ${new Date().toLocaleString()}</p>
                    </div>

                    <p>This means:</p>
                    <ul>
                        <li>✅ Gmail authentication is successful</li>
                        <li>✅ SMTP connection is working</li>
                        <li>✅ Verification emails will be sent properly</li>
                        <li>✅ Password reset emails will work</li>
                        <li>✅ Welcome emails will be delivered</li>
                    </ul>

                    <p>You can now safely use all email features in CobyPicks!</p>
                </div>
                <div class="footer">
                    <p>This is a test email from CobyPicks</p>
                    <p>© 2024 CobyPicks. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>
      `,
      text: `
CobyPicks - Gmail Configuration Test Successful!

Great news! Your Gmail configuration is working perfectly.

Email Configuration Verified
Your Gmail SMTP settings are correctly configured and ready to send emails.
Test completed at: ${new Date().toLocaleString()}

This means:
- Gmail authentication is successful
- SMTP connection is working
- Verification emails will be sent properly
- Password reset emails will work
- Welcome emails will be delivered

You can now safely use all email features in CobyPicks!

This is a test email from CobyPicks
© 2024 CobyPicks. All rights reserved.
      `
    };

    const fromAddress = process.env.EMAIL_FROM || '"CobyPicks Security" <noreply@cobypicks.com>';

    const mailOptions = {
      from: fromAddress,
      to: testEmail,
      subject: testTemplate.subject,
      text: testTemplate.text,
      html: testTemplate.html,
    };

    console.log('🚀 Sending test email...');
    const result = await transporter.sendMail(mailOptions);
    console.log('✅ Test email sent successfully!');
    console.log('📨 Send result:', {
      messageId: result.messageId,
      accepted: result.accepted,
      rejected: result.rejected,
      response: result.response
    });

    return { success: true };

  } catch (error: any) {
    console.error('❌ Test email sending failed:', error);
    return {
      success: false,
      error: `Test email failed: ${error.message}`
    };
  }
}

export const cleanupExpiredCodes = async (): Promise<void> => {
  try {
    const now = Timestamp.now()
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

