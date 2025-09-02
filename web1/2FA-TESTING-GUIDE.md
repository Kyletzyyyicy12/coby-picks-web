# 2FA Verification System Testing Guide

## System Overview

Your CobyPicks application now has 2FA email verification for:
- ✅ **Signup Verification** - Required for new account registration  
- ✅ **Password Reset Verification** - Required for password reset
- 🚫 **Login Verification** - **REMOVED** (users login directly)

## Email Configuration Status
- **Email Provider**: Gmail SMTP
- **Email Address**: kyse.quimada.swu@phinmaed.com
- **Status**: ✅ Configured with App Password

---

## 📋 Manual Testing Checklist

### 1. Signup Verification Flow Test

**Steps to Test:**
1. Navigate to the login page
2. Click "Sign up" to switch to registration mode
3. Fill in the registration form:
   - Full Name: `Test User`
   - Email: Use a real email address you can access
   - Password: At least 6 characters
   - Role: Select Participant or Organizer
4. Click "Register"

**Expected Results:**
- ✅ You should see: "Verification Code Sent" toast message
- ✅ A signup verification modal should appear
- ✅ Check your email inbox for a verification code
- ✅ The email should have a green theme and CobyPicks branding
- ✅ Enter the 6-digit code in the verification form
- ✅ After successful verification, account should be created
- ✅ You should be automatically logged in and redirected to dashboard

**Common Issues to Check:**
- Email in spam/junk folder
- Code expires after 10 minutes
- Maximum 5 attempts per code
- Code is single-use only

### 2. Password Reset Verification Flow Test

**Steps to Test:**
1. From the login page, click "Forgot password?"
2. Enter the email address of an existing account
3. Click "Send Reset Email"

**Expected Results:**
- ✅ You should see: "Verification Code Sent" toast message  
- ✅ A password reset verification modal should appear
- ✅ Check your email inbox for a verification code
- ✅ The email should have a red theme and password reset branding
- ✅ Enter the 6-digit code in the verification form
- ✅ After verification, you should see a password reset form
- ✅ Enter and confirm your new password
- ✅ Password should be updated successfully
- ✅ You should be able to login with the new password

**Common Issues to Check:**
- Works with both primary email and recovery email
- Password must be at least 8 characters
- Passwords must match in confirmation field

### 3. Login Flow Test (No 2FA)

**Steps to Test:**
1. Use existing credentials to login
2. Enter email and password
3. Click "Login"

**Expected Results:**
- ✅ Should login directly without any verification code
- ✅ No verification modal should appear
- ✅ Should redirect to appropriate dashboard

### 4. Admin Bypass Test

**Steps to Test:**
1. Login with admin credentials:
   - Email: `admin@cobypicks.com`
   - Password: `AdminCobyPicks2024!`

**Expected Results:**
- ✅ Should login directly without any verification
- ✅ Should redirect to admin dashboard
- ✅ Admin bypasses all 2FA verification

---

## 🔧 Troubleshooting

### Email Not Received
1. **Check spam/junk folder**
2. **Wait up to 2 minutes** for email delivery
3. **Verify email address** is typed correctly
4. **Try resending** the code using the "Resend Code" button

### Verification Code Issues
- **Invalid Code**: Ensure you're entering the exact 6-digit code
- **Expired Code**: Request a new code (codes expire in 10 minutes)
- **Too Many Attempts**: Wait and request a fresh code after 5 failed attempts

### Password Reset Issues
- **Account Not Found**: Ensure the email has an existing account
- **Password Requirements**: Must be at least 8 characters
- **Password Mismatch**: Ensure both password fields match exactly

---

## 📊 Success Indicators

Your 2FA system is working correctly if:

1. ✅ Signup requires email verification before account creation
2. ✅ Password reset requires email verification before password change
3. ✅ Login works directly without verification (no 2FA for login)
4. ✅ Admin login bypasses all verification
5. ✅ Email delivery works reliably 
6. ✅ Verification codes expire properly (10 minutes)
7. ✅ Rate limiting works (max 5 attempts)
8. ✅ Error handling provides clear messages

---

## 🚀 Ready for Production

Once all tests pass:
1. **Email Service**: Consider switching to SendGrid for production
2. **Environment**: Update `.env.local` for production environment
3. **Testing**: Test with multiple email providers
4. **Security**: Review rate limiting and error messages
5. **Documentation**: Update user guides with new flows

---

**System Status**: 🟢 **READY FOR TESTING**

Both signup verification and password reset verification flows are properly implemented and configured!