# 2FA Email Verification System - Setup Guide

## 🛡️ Overview

This system implements professional 2FA (Two-Factor Authentication) with email verification codes for:
- **Login Verification**: Users receive a 6-digit code to complete login
- **Password Reset Verification**: Users receive a code before they can reset their password

## 🚀 Features

- ✅ Professional email templates with beautiful HTML design
- ✅ 6-digit verification codes with 10-minute expiration
- ✅ Rate limiting (max 5 attempts per code)
- ✅ Automatic cleanup of expired codes
- ✅ Fallback to direct login if email service fails
- ✅ Admin login bypasses 2FA (for system access)
- ✅ Support for multiple email providers
- ✅ Mobile and web compatible

## 📧 Email Provider Setup

### Option 1: Gmail (Recommended for Development)

1. **Enable 2-Step Verification** on your Gmail account
2. **Generate App Password**:
   - Go to Google Account Settings
   - Security → 2-Step Verification → App passwords
   - Generate password for "Mail"
3. **Configure Environment Variables**:
   ```bash
   EMAIL_USER=your-email@gmail.com
   EMAIL_PASSWORD=your-16-character-app-password
   EMAIL_FROM="CobyPicks Security <noreply@cobypicks.com>"
   ```

### Option 2: SendGrid (Recommended for Production)

1. **Create SendGrid Account** at sendgrid.com
2. **Create API Key**:
   - Settings → API Keys → Create API Key
   - Choose "Restricted Access" and enable Mail Send permissions
3. **Configure Environment Variables**:
   ```bash
   SENDGRID_API_KEY=your_sendgrid_api_key
   EMAIL_FROM="CobyPicks Security <noreply@cobypicks.com>"
   ```
4. **Update Email Service**: Modify `lib/email-service.ts` to use SendGrid transporter

### Option 3: AWS SES (For Enterprise)

1. **Setup AWS SES** in your AWS console
2. **Verify Domain** and create SMTP credentials
3. **Configure Environment Variables**:
   ```bash
   AWS_REGION=us-east-1
   AWS_ACCESS_KEY_ID=your_access_key
   AWS_SECRET_ACCESS_KEY=your_secret_key
   EMAIL_FROM="CobyPicks Security <verified@yourdomain.com>"
   ```

## 🔧 Installation Steps

### 1. Environment Configuration

Copy `.env.example` to `.env.local` and configure your email provider:

```bash
cp .env.example .env.local
```

Edit `.env.local` with your email provider settings.

### 2. Firebase Firestore Rules

Add these rules to allow verification code storage:

```javascript
// Add to your Firestore rules
match /verificationCodes/{codeId} {
  allow read, write: if request.auth != null;
}
```

### 3. Test Email Configuration

Create a test script to verify your email setup:

```javascript
// test-email-config.js
const { sendVerificationEmail } = require('./lib/email-service');

async function testEmail() {
  const result = await sendVerificationEmail(
    'your-test-email@example.com',
    '123456',
    'login'
  );
  console.log('Email test result:', result);
}

testEmail();
```

## 🎯 How It Works

### Login Flow with 2FA

1. User enters email/password
2. System validates credentials exist
3. Sends 6-digit code to user's email
4. User enters code in verification modal
5. System verifies code and completes login

### Password Reset Flow with 2FA

1. User requests password reset
2. System sends 6-digit verification code
3. User enters code in verification modal
4. System verifies code and allows password reset
5. User sets new password

### Admin Login (Bypasses 2FA)

- Admin credentials (`admin@cobypicks.com`) skip 2FA for system access
- This ensures admins can always access the system even if email service fails

## 🔐 Security Features

### Code Generation
- Cryptographically secure 6-digit codes
- 10-minute expiration time
- Single-use codes (automatically deleted after verification)

### Rate Limiting
- Maximum 5 verification attempts per code
- Automatic code deletion after limit exceeded
- Cooldown periods for failed attempts

### Email Security
- Professional templates with security warnings
- Clear expiration information
- Instructions to ignore suspicious emails

## 📱 Mobile App Integration

The system is designed to work with both web and mobile apps:

### For React Native (Mobile)

Create corresponding API calls in your mobile app:

```javascript
// services/authService.js
export const sendLoginVerification = async (email, password) => {
  const response = await fetch(`${API_BASE}/api/auth/send-login-verification`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  return response.json();
};

export const verifyLoginCode = async (email, code) => {
  const response = await fetch(`${API_BASE}/api/auth/verify-login-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, code })
  });
  return response.json();
};
```

## 🧪 Testing

### Development Testing

1. **Use Ethereal Email** for development (configured automatically)
2. **Check Console Logs** for email preview URLs
3. **Test All Flows**: Login, password reset, error handling

### Production Testing

1. **Test with Real Email** addresses you control
2. **Verify Email Delivery** times and formatting
3. **Test Error Scenarios**: Invalid codes, expired codes, rate limiting

### Test Checklist

- [ ] Login with valid credentials sends verification code
- [ ] Verification code email is received and formatted correctly
- [ ] Valid code completes login successfully
- [ ] Invalid code shows appropriate error message
- [ ] Expired code shows expiration error
- [ ] Rate limiting works after 5 failed attempts
- [ ] Password reset sends verification code
- [ ] Password reset verification allows password change
- [ ] Admin login bypasses 2FA
- [ ] Email service failure falls back to direct login

## 🚨 Troubleshooting

### Email Not Sending

1. **Check Environment Variables**: Ensure all email settings are correct
2. **Verify Provider Settings**: Test SMTP credentials separately
3. **Check Firewall/Network**: Ensure SMTP ports are not blocked
4. **Review Logs**: Check console for detailed error messages

### Code Not Verifying

1. **Check Firestore Rules**: Ensure verification codes can be read/written
2. **Verify Time Synchronization**: Server time affects expiration
3. **Test Network Connectivity**: Ensure API endpoints are accessible

### Common Issues

- **Gmail App Password**: Use App Password, not regular password
- **SendGrid Domain**: Verify your sending domain is authenticated
- **AWS SES Sandbox**: Move out of sandbox for production use
- **Rate Limiting**: Firebase may have additional rate limits

## 📊 Monitoring

### Email Delivery Monitoring

Track email delivery success rates:

```javascript
// Add to your monitoring system
console.log('Email delivery stats:', {
  sent: emailsSent,
  delivered: emailsDelivered,
  bounced: emailsBounced,
  opened: emailsOpened
});
```

### Security Monitoring

Monitor failed verification attempts:

```javascript
// Log suspicious activity
console.warn('Multiple failed verification attempts:', {
  email: userEmail,
  attempts: failedAttempts,
  timestamp: new Date()
});
```

## 🔄 Maintenance

### Regular Cleanup

The system automatically cleans up expired codes, but you can run manual cleanup:

```javascript
// Manual cleanup script
import { cleanupExpiredCodes } from './lib/email-service';
await cleanupExpiredCodes();
```

### Update Email Templates

Modify templates in `lib/email-service.ts` to match your branding:

```javascript
// Customize colors, logos, and messaging
const html = `
  <div style="background: linear-gradient(135deg, #yourcolor1, #yourcolor2);">
    <!-- Your custom template -->
  </div>
`;
```

## 🎉 Success!

Your 2FA email verification system is now ready! Users will enjoy enhanced security with a professional email verification experience.

For support or questions, check the implementation files:
- `lib/email-service.ts` - Core email functionality
- `components/auth/verification-code-input.tsx` - UI component
- `app/api/auth/*` - API endpoints