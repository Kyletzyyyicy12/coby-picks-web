// scripts/reset-admin-account.js
// This script helps reset the admin account when there are credential mismatches

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

async function resetAdminAccount() {
  const email = 'admin@cobypicks.com';
  const password = 'AdminCobyPicks2024!';

  console.log(`🔄 Resetting admin account: ${email}`);
  
  try {
    // First, try to get the existing user
    let userRecord;
    try {
      userRecord = await admin.auth().getUserByEmail(email);
      console.log(`📋 Found existing admin account: ${email}`);
      
      // Delete the existing user
      await admin.auth().deleteUser(userRecord.uid);
      console.log(`🗑️ Deleted existing admin account: ${email}`);
      
      // Also delete the Firestore document
      try {
        await admin.firestore().collection('users').doc(userRecord.uid).delete();
        console.log(`🗑️ Deleted Firestore document for user: ${userRecord.uid}`);
      } catch (firestoreError) {
        console.log(`⚠️ Could not delete Firestore document (may not exist): ${firestoreError.message}`);
      }
      
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        console.log(`ℹ️ No existing admin account found for: ${email}`);
      } else {
        throw error;
      }
    }

    // Create a new admin account with the correct credentials
    console.log(`🔨 Creating new admin account: ${email}`);
    userRecord = await admin.auth().createUser({
      email: email,
      password: password,
      emailVerified: true,
      disabled: false,
      displayName: 'System Administrator'
    });
    
    console.log(`✅ New admin account created successfully: ${email}`);

    // Create user document in Firestore
    console.log('📝 Creating user document in Firestore...');
    
    await admin.firestore().collection('users').doc(userRecord.uid).set({
      email: email,
      displayName: 'System Administrator',
      fullName: 'System Administrator',
      firstName: 'System',
      lastName: 'Administrator',
      role: 'admin',
      isHardcodedAdmin: true,
      canDeleteCollections: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      lastActiveAt: admin.firestore.FieldValue.serverTimestamp(),
      lastLoginAt: admin.firestore.FieldValue.serverTimestamp(),
      isActive: true,
      profileComplete: true,
      lastActiveDevice: 'reset-script',
      collaborators: [],
      dataPrivacyConsentGiven: true,
      createdBy: 'admin-reset-script'
    });

    console.log('✅ User document created in Firestore');
    console.log('🎉 Admin account reset complete!');
    console.log(`📧 Email: ${email}`);
    console.log(`🔑 Password: ${password}`);
    console.log('🚀 You can now log in with these credentials');

  } catch (error) {
    console.error('❌ Error resetting admin account:', error);
    process.exit(1);
  }
}

// Run the reset
resetAdminAccount()
  .then(() => {
    console.log('✅ Reset completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Reset failed:', error);
    process.exit(1);
  });