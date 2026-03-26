// scripts/create-admin-account.js
// This script creates the admin account in Firebase Auth

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

// Admin credentials from firestore rules
const ADMIN_EMAIL = 'admin@cobypicks.com';
const ADMIN_PASSWORD = 'AdminCobyPicks2024!';

async function createAdminAccount() {
  try {
    console.log(`🔍 Checking if admin account exists: ${ADMIN_EMAIL}`);
    
    // Try to get the user first
    let userRecord;
    try {
      userRecord = await admin.auth().getUserByEmail(ADMIN_EMAIL);
      console.log(`✅ Admin account already exists: ${ADMIN_EMAIL}`);
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        console.log(`📝 Creating admin account: ${ADMIN_EMAIL}`);
        
        // Create the user
        userRecord = await admin.auth().createUser({
          email: ADMIN_EMAIL,
          password: ADMIN_PASSWORD,
          emailVerified: true,
          disabled: false,
          displayName: 'System Administrator'
        });
        
        console.log(`✅ Admin account created successfully: ${ADMIN_EMAIL}`);
      } else {
        throw error;
      }
    }

    // Create/update user document in Firestore
    console.log('📝 Creating/updating user document in Firestore...');
    
    await admin.firestore().collection('users').doc(userRecord.uid).set({
      email: ADMIN_EMAIL,
      displayName: 'System Administrator',
      role: 'admin',
      isHardcodedAdmin: true,
      canDeleteCollections: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      lastActiveAt: admin.firestore.FieldValue.serverTimestamp(),
      lastActiveDevice: 'setup-script',
      isActive: true,
      profileComplete: true
    }, { merge: true });

    console.log('✅ User document created/updated in Firestore');
    console.log('🎉 Admin account setup complete!');
    console.log(`📧 Email: ${ADMIN_EMAIL}`);
    console.log(`🔑 Password: ${ADMIN_PASSWORD}`);
    console.log('🚀 You can now log in with these credentials on the web');

  } catch (error) {
    console.error('❌ Error creating admin account:', error);
    process.exit(1);
  }
}

// Run the setup
createAdminAccount()
  .then(() => {
    console.log('✅ Setup completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  });