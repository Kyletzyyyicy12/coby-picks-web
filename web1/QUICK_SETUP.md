# Quick Firebase Admin Setup (2 minutes)

## ❌ Current Issue
You're getting: `Firebase Admin SDK Configuration Required`

Your `.env.local` file has placeholder values that need to be replaced with real Firebase credentials.

## ✅ Quick Fix

### Step 1: Get Firebase Service Account Key
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your **cobypicksswu** project
3. Project Settings (gear icon) → **Service Accounts** tab
4. Click **"Generate new private key"**
5. Download the JSON file

### Step 2: Update Your .env.local File
Replace these lines in `c:\Users\mejan dia\ALLINONECOBYPICKSAPPWEB\web1\.env.local`:

**Replace this:**
```bash
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xyz@cobypicksswu.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY_HERE\n-----END PRIVATE KEY-----"
```

**With actual values from your downloaded JSON file:**
```bash
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-[actual-id]@cobypicksswu.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC...
[paste your entire private key here]
-----END PRIVATE KEY-----"
```

### Step 3: Copy Values from Downloaded JSON
Open the downloaded JSON file and copy these specific values:

**From JSON file:**
```json
{
  "client_email": "firebase-adminsdk-abc123@cobypicks.iam.gserviceaccount.com",  ← Copy this
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvg...\n-----END PRIVATE KEY-----\n"  ← Copy this
}
```

**To .env.local file:**
- `client_email` → `FIREBASE_CLIENT_EMAIL`
- `private_key` → `FIREBASE_PRIVATE_KEY` (keep the quotes)

### Step 4: Restart Development Server
```bash
cd web1
pnpm dev
```

## 🧪 Test Configuration
After setup, visit: http://localhost:3000/api/admin/config-check

You should see: `"status": "ready"`

## ✅ Verify It Works
1. Try uploading a CSV file through admin dashboard
2. Try creating a single user through admin dashboard  
3. Both should work without 500 errors
4. Users should appear in the user management table
5. Admin should stay on user management page

## Important Notes
- Keep the `"` quotes around the private key
- Keep the `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----` markers
- The `.env.local` file should be in the `web1` directory
- Don't commit `.env.local` to git (it's already in .gitignore)

## Still Having Issues?
If you still get errors after setup:

1. **Copy private key exactly** as it appears in the JSON file
2. **Check file location**: `.env.local` must be in `web1` folder
3. **Restart server**: Always restart after adding environment variables
4. **Check quotes**: Private key must be wrapped in double quotes

That's it! Your user creation and CSV upload should now work properly and store in Firebase.