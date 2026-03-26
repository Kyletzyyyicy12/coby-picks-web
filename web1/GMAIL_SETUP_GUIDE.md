# Gmail Email Service Setup Guide for CobyPicks

## 🎯 Overview

This guide will help you set up Gmail email service for CobyPicks to send verification emails, password reset emails, and welcome emails.

## 📧 Gmail Configuration

Your Gmail is already configured in the environment file with these settings:

```bash
EMAIL_USER=kyse.quimada.swu@phinmaed.com
EMAIL_PASSWORD=eevdmjhynotvjryz
EMAIL_FROM="CobyPicks Security <noreply@cobypicks.com>"
```

## 🔧 Gmail App Password Setup (IMPORTANT)

Since you're using Gmail, you need to use an **App Password** instead of your regular password for SMTP authentication.

### How to Generate Gmail App Password:

1. **Go to Google Account Settings:**
   - Visit: https://myaccount.google.com/
   - Sign in with your Gmail account: `kyse.quimada.swu@phinmaed.com`

2. **Enable 2-Factor Authentication (2FA):**
   - If you haven't already, enable 2FA on your Google account
   - Go to Security → 2-Step Verification → Turn on

3. **Generate App Password:**
   - After enabling 2FA, go to Security → 2-Step Verification
   - Scroll down to "App passwords"
   - Click "App passwords"
   - Select "Mail" and "Other (custom name)"
   - Enter "CobyPicks" as the name
   - Click "Generate"

4. **Copy the App Password:**
   - Google will show you a 16-character password
   - **Copy this password immediately** (you won't see it again)
   - Remove any spaces from the password

5. **Update Environment File:**
   - If the generated password is different from `eevdmjhynotvjryz`
   - Update the `EMAIL_PASSWORD` in `.env.local`:
   ```bash
   EMAIL_PASSWORD=your-16-character-app-password
   ```

## 🧪 Testing Email Service

### Method 1: Test Connection Only
```bash
cd web1
npm run test:email
```

This will test the SMTP connection without sending an email.

### Method 2: Test with Email Sending
```bash
cd web1
npm run test:email your-email@example.com
```

Replace `your-email@example.com` with your actual email address to receive a test email.

## ✅ Verification Steps

### 1. Check Environment Variables
Ensure your `.env.local` file contains:
```bash
EMAIL_USER=kyse.quimada.swu@phinmaed.com
EMAIL_PASSWORD=eevdmjhynotvjryz
EMAIL_FROM="CobyPicks Security <noreply@cobypicks.com>"
```

### 2. Test SMTP Connection
```bash
cd web1
npm run test:email
```

Expected output:
```
🔧 Testing CobyPicks Email Service
=====================================
📧 Gmail User: kyse.quimada.swu@phinmaed.com
📧 From Address: "CobyPicks Security <noreply@cobypicks.com>"
🔑 Password Length: 16

🔧 Creating Gmail transporter...
🔌 Testing SMTP connection...
✅ SMTP connection verified successfully!
```

### 3. Test Email Sending
```bash
cd web1
npm run test:email your-email@example.com
```

Expected output:
```
✅ Test email sent successfully!
📨 Send result: {
  messageId: 'xxx@gmail.com',
  accepted: ['your-email@example.com'],
  rejected: [],
  pending: []
}
```

## 🔧 Troubleshooting

### Common Issues and Solutions:

#### ❌ "EAUTH: Invalid login credentials"
**Cause:** Incorrect app password
**Solution:**
1. Generate a new app password in Google Account settings
2. Update `EMAIL_PASSWORD` in `.env.local`
3. Make sure there are no spaces in the password
4. Test again: `npm run test:email`

#### ❌ "ECONNECTION: Connection failed"
**Cause:** Network or firewall issues
**Solution:**
1. Check your internet connection
2. Disable VPN temporarily
3. Check firewall settings (allow port 587)
4. Try again

#### ❌ "ETIMEDOUT: Connection timed out"
**Cause:** Gmail servers are blocking or slow
**Solution:**
1. Wait a few minutes and try again
2. Check if Gmail is down (search "Gmail status")
3. Try from a different network

#### ❌ "Invalid login" error
**Cause:** Using regular password instead of app password
**Solution:**
1. Generate an app password as described above
2. Update the environment variable
3. Test again

## 📧 Email Features in CobyPicks

Once configured, the email service will handle:

### ✅ User Signup Verification
- Sends 6-digit verification code
- Code expires in 10 minutes
- Links to `/api/auth/send-signup-verification`

### ✅ Password Reset
- Sends secure reset codes
- Includes security warnings
- Links to `/api/auth/send-password-reset`

### ✅ Welcome Emails
- Sent to new users after account creation
- Includes login credentials
- Contains setup instructions

### ✅ Admin Notifications
- User registration notifications
- Account activity alerts
- System status updates

## 🚀 Usage in Code

### Send Verification Email
```typescript
import { sendVerificationEmail } from '@/lib/email-service';

const result = await sendVerificationEmail(
  'user@example.com',
  '123456',
  'signup',
  'John Doe'
);

if (result.success) {
  console.log('Verification email sent!');
} else {
  console.error('Failed to send email:', result.error);
}
```

### Send Welcome Email
```typescript
import { sendWelcomeEmail } from '@/lib/email-service';

const result = await sendWelcomeEmail(
  'user@example.com',
  'John Doe',
  'secure-password',
  'participant',
  'admin@cobypicks.com'
);
```

## 🔒 Security Best Practices

1. **Never commit app passwords to Git**
2. **Rotate app passwords regularly**
3. **Use environment variables for sensitive data**
4. **Enable 2FA on all Gmail accounts**
5. **Monitor email sending activity**

## 📞 Support

If you continue to have issues:

1. **Check the console output** when running tests
2. **Verify your Gmail settings** in Google Account
3. **Ensure 2FA is enabled** on your Gmail account
4. **Try generating a new app password**
5. **Check Gmail's sending limits** (500 emails/day for free accounts)

## 🎉 Success Indicators

✅ **Connection test passes**
✅ **Test email is received in inbox (not spam)**
✅ **Signup verification emails work**
✅ **Password reset emails work**
✅ **Welcome emails are delivered**

Once all tests pass, your CobyPicks email service is fully operational! 🎯