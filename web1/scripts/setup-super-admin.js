// scripts/setup-super-admin.js
// This script creates the super admin account in Firebase Auth if it doesn't exist

const admin = require('firebase-admin');
require('dotenv').config({ path: '.env.local' });

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    });
    console.log('✅ Firebase Admin SDK initialized successfully.');
  } catch (error) {
    console.error('❌ Firebase Admin SDK initialization error:', error);
    process.exit(1);
  }
}

async function setupSuperAdmin() {
  const email = process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAIL;
  const password = process.env.NEXT_PUBLIC_SUPER_ADMIN_PASSWORD;

  if (!email || !password) {
    console.error('❌ Super admin credentials not found in environment variables');
    console.log('Please ensure NEXT_PUBLIC_SUPER_ADMIN_EMAIL and NEXT_PUBLIC_SUPER_ADMIN_PASSWORD are set in .env.local');
    process.exit(1);
  }

  try {
    console.log(`🔍 Checking if super admin account exists: ${email}`);
    
    // Try to get the user first
    let userRecord;
    try {
      userRecord = await admin.auth().getUserByEmail(email);
      console.log(`✅ Super admin account already exists: ${email}`);
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        console.log(`📝 Creating super admin account: ${email}`);
        
        // Create the user
        userRecord = await admin.auth().createUser({
          email: email,
          password: password,
          emailVerified: true,
          disabled: false,
          displayName: 'Super Administrator'
        });
        
        console.log(`✅ Super admin account created successfully: ${email}`);
      } else {
        throw error;
      }
    }

    // Ensure user document exists in Firestore
    console.log('📝 Creating/updating user document in Firestore...');
    
    await admin.firestore().collection('users').doc(userRecord.uid).set({
      email: email,
      displayName: 'Super Administrator',
      role: 'admin',
      isHardcodedAdmin: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      lastActiveAt: admin.firestore.FieldValue.serverTimestamp(),
      lastActiveDevice: 'setup-script',
      isActive: true,
      profileComplete: true
    }, { merge: true });

    console.log('✅ User document created/updated in Firestore');
    console.log('🎉 Super admin setup complete!');
    console.log(`📧 Email: ${email}`);
    console.log(`🔑 Password: ${password}`);
    console.log('🚀 You can now log in with these credentials');

  } catch (error) {
    console.error('❌ Error setting up super admin:', error);
    process.exit(1);
  }
}

// Run the setup
setupSuperAdmin()
  .then(() => {
    console.log('✅ Setup completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  });
