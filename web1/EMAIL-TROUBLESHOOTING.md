# Email Delivery Troubleshooting Guide

## 🔧 **Issue Fixed: Gmail App Password Format**

**Problem**: Gmail App Passwords with spaces cause authentication failures.

**Solution Applied**: 
- Fixed `.env.local` to remove spaces: `eevdmjhynotvjryz` (was `eevd mjhy notv jryz`)
- Added automatic space removal in email service code

---

## 📧 **Gmail Configuration Checklist**

### ✅ **Step 1: Verify Gmail App Password**
Your Gmail account (`kyse.quimada.swu@phinmaed.com`) needs:

1. **2-Factor Authentication enabled**
2. **App Password generated** (not regular password)
3. **App Password format**: 16 characters, no spaces
   - ❌ Wrong: `eevd mjhy notv jryz`
   - ✅ Correct: `eevdmjhynotvjryz`

### ✅ **Step 2: Test Email Configuration**

Use the test endpoint to verify configuration:

```bash
# Test email sending
curl -X POST http://localhost:3000/api/auth/test-email \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'
```

### ✅ **Step 3: Check Console Logs**

Look for these debug messages:
- `🔧 Using Gmail SMTP configuration`
- `🔌 Testing SMTP connection...`
- `✅ SMTP connection verified successfully`
- `✅ Email sent successfully!`

---

## 🚨 **Common Email Issues & Solutions**

### **Issue 1: "Invalid Login" Error**
**Causes:**
- Wrong app password
- Spaces in app password
- Using regular password instead of app password
- 2FA not enabled

**Solution:**
1. Go to Gmail Account Settings → Security → 2-Step Verification
2. Generate new App Password
3. Use 16-character password without spaces

### **Issue 2: "Connection Timeout"**
**Causes:**
- Firewall blocking SMTP (port 587)
- Network restrictions
- ISP blocking SMTP

**Solution:**
1. Check firewall settings
2. Try different network
3. Contact ISP about SMTP restrictions

### **Issue 3: "Quota Exceeded"**
**Causes:**
- Gmail sending limits reached
- Too many emails sent quickly

**Solution:**
1. Wait 1 hour for quota reset
2. Reduce email frequency
3. Consider SendGrid for production

---

## 🧪 **Testing Steps**

### **Step 1: Test with Debug Logs**
1. Start development server: `npm run dev`
2. Try signup verification
3. Check browser console and server logs
4. Look for detailed SMTP debug information

### **Step 2: Manual Email Test**
```javascript
// Call test endpoint
fetch('/api/auth/test-email', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'your-test-email@gmail.com' })
})
```

### **Step 3: Verify Gmail Settings**
1. Login to `kyse.quimada.swu@phinmaed.com`
2. Check if 2FA is enabled
3. Generate fresh app password if needed
4. Update `.env.local` with new password

---

## 📝 **Current Configuration**

```env
EMAIL_USER=kyse.quimada.swu@phinmaed.com
EMAIL_PASSWORD=eevdmjhynotvjryz  # Fixed: removed spaces
EMAIL_FROM="CobyPicks Security <noreply@cobypicks.com>"
```

---

## ⚡ **Quick Fix Applied**

The main issue was **spaces in the Gmail App Password**. This has been fixed:

1. ✅ Removed spaces from password in `.env.local`
2. ✅ Added automatic space cleaning in code
3. ✅ Enhanced debugging and error messages
4. ✅ Added SMTP connection verification

**Try the signup verification now - it should work!**

---

## 🔍 **Alternative Solutions**

If Gmail still doesn't work:

1. **Use SendGrid** (more reliable for production):
   ```env
   SENDGRID_API_KEY=your_sendgrid_api_key
   ```

2. **Use Outlook SMTP**:
   ```env
   EMAIL_HOST=smtp-mail.outlook.com
   EMAIL_PORT=587
   EMAIL_USER=your-email@outlook.com
   EMAIL_PASSWORD=your-password
   ```

3. **Use AWS SES** (enterprise solution):
   ```env
   AWS_REGION=us-east-1
   AWS_ACCESS_KEY_ID=your_access_key
   AWS_SECRET_ACCESS_KEY=your_secret_key
   ```