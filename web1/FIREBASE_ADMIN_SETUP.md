# Firebase Admin SDK Setup Guide

This guide helps you set up Firebase Admin SDK for server-side user creation in the admin dashboard.

## Why Firebase Admin SDK?

When admins create users through the dashboard, using client-side Firebase Auth (`createUserWithEmailAndPassword`) automatically signs in the newly created user, which logs out the admin. The Firebase Admin SDK allows server-side user creation without affecting the current authentication session.

## Setup Steps

### 1. Generate Service Account Key

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Go to **Project Settings** (gear icon) → **Service Accounts** tab
4. Click **"Generate new private key"**
5. Click **"Generate key"** to download the JSON file

### 2. Extract Environment Variables

From the downloaded JSON file, extract these values:

```json
{
  "type": "service_account",
  "project_id": "your-project-id",           // ← Copy this
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",  // ← Copy this
  "client_email": "firebase-adminsdk-...@your-project-id.iam.gserviceaccount.com",  // ← Copy this
  "client_id": "...",
  "auth_uri": "...",
  "token_uri": "...",
  "auth_provider_x509_cert_url": "..."
}
```

### 3. Set Environment Variables

Create a `.env.local` file in the `web1` directory:

```bash
# web1/.env.local

FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project-id.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC...
...your actual private key content...
-----END PRIVATE KEY-----"
```

**Important Notes:**
- Keep the quotes around the private key
- Keep the `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----` markers
- You can use actual newlines or `\n` characters in the private key

### 4. Restart Development Server

After setting up the environment variables:

```bash
cd web1
pnpm dev
```

## Verification

1. Try creating a user through the admin dashboard
2. Check the browser console for success message: "✅ Firebase Admin SDK initialized successfully"
3. The admin should stay logged in after creating users

## Troubleshooting

### Error: "Invalid PEM formatted message"
- Check that your private key includes the BEGIN/END markers
- Ensure there are no extra quotes or escape characters
- Try copying the private key directly from the JSON file

### Error: "Missing Firebase Admin SDK configuration"
- Verify all three environment variables are set
- Check that your `.env.local` file is in the `web1` directory
- Restart your development server after adding variables

### Fallback Mode
If Firebase Admin SDK is not configured, the system will:
1. Show a warning in the console
2. Use client-side creation (requires page refresh)
3. Display a message asking to refresh the page

## Production Deployment

For production deployments (Vercel, Netlify, etc.):

1. Add the environment variables in your hosting platform's dashboard
2. For the private key, you may need to:
   - Replace newlines with `\n`
   - Escape quotes properly
   - Use the exact format from your JSON file

Example for Vercel/Netlify:
```bash
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvgIBADA...\n-----END PRIVATE KEY-----\n"
```

## Security Notes

- **Never commit** the service account JSON file to your repository
- **Never commit** the `.env.local` file to your repository  
- Add `.env.local` to your `.gitignore` file
- Store environment variables securely in your hosting platform
- Regularly rotate service account keys if needed

## Testing

You can test the setup by:
1. Creating a test user through the admin dashboard
2. Verifying the admin stays logged in
3. Checking the new user appears in Firebase Auth console
4. Confirming no authentication session interruption occurred