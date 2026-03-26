# Password Reset Testing Checklist

## 🧪 **How to Test Password Reset Functionality**

### **Web Application Testing**
1. **Navigate to login page** → `http://localhost:3000`
2. **Click "Forgot password?" link**
3. **Enter a valid email address** (use a real email you control)
4. **Click "Send Reset Email"**
5. **Check email inbox** (and spam folder)

### **Mobile Application Testing**
1. **Open mobile app** in simulator/device
2. **On login screen** → Tap "Forgot Password?"
3. **Enter email address**
4. **Tap "Send Reset Email"**
5. **Check email inbox**

### **Admin Testing (Web Only)**
1. **Login as admin** → `admin@cobypicks.com`
2. **Go to Debug Admin page** → `http://localhost:3000/debug-admin`
3. **Test password reset function**
4. **Or use Super Admin Manager** in admin dashboard

---

## ✅ **Expected Results**

### **For Existing Accounts:**
- ✅ Success message displayed
- ✅ Password reset email delivered to inbox
- ✅ Email contains Firebase reset link
- ✅ Link redirects to Firebase password reset page

### **For Non-Existent Accounts:**
- ✅ Same success message displayed (security feature)
- ❌ No email delivered (Firebase doesn't send to non-existent accounts)

### **Error Cases:**
- 🔴 Invalid email format → Error message
- 🔴 Empty email → Error message  
- 🔴 Rate limiting → Cooldown message with timer

---

## 🔧 **Quick Test Commands**

### **Test Web App:**
```bash
# Start development server
cd "c:\Users\mejan dia\ALLINONECOBYPICKSAPPWEB\web1"
npm run dev

# Then visit: http://localhost:3000
# Click "Forgot password?" and test
```

### **Test Mobile App:**
```bash
# Start Expo development
cd "c:\Users\mejan dia\ALLINONECOBYPICKSAPPWEB\app"  
npm start

# Open app and test forgot password functionality
```

---

## 📧 **Firebase Email Configuration**

**Email Templates Location:**
- Firebase Console → Authentication → Templates
- Customize email subject, body, and sender name
- Configure redirect URL after password reset

**Default Email Behavior:**
- Sender: `noreply@[your-project-id].firebaseapp.com`
- Subject: "Reset your password for [App Name]"
- Contains secure reset link valid for 1 hour

---

## 🚀 **Recommended Test Accounts**

1. **Your Personal Email** (for real delivery testing)
2. **admin@cobypicks.com** (if it exists in Firebase)
3. **Fake email** (to test security behavior)

---

## 🔍 **Verification Steps**

1. ✅ **Web form submits without errors**
2. ✅ **Mobile modal shows success message**
3. ✅ **Email arrives in inbox within 2-5 minutes**
4. ✅ **Reset link works and redirects properly**
5. ✅ **New password can be set and works**

---

## 🛠️ **Troubleshooting**

**No Email Received?**
- Check spam/junk folder
- Verify email address spelling
- Ensure account exists in Firebase Auth
- Check Firebase Console → Authentication → Users

**Reset Link Doesn't Work?**
- Link expires after 1 hour
- Can only be used once
- Must be opened in same browser/device

**Still Having Issues?**
- Check Firebase Console logs
- Verify email template settings
- Test with different email providers (Gmail, Outlook, etc.)