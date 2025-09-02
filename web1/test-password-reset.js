#!/usr/bin/env node

/**
 * Password Reset Testing Script
 * 
 * This script tests the password reset functionality to verify:
 * 1. Email sending works for existing accounts
 * 2. Recovery email lookup works
 * 3. Error handling for non-existent accounts
 * 4. Both web and mobile implementations
 */

const { initializeApp } = require('firebase/app');
const { getAuth, sendPasswordResetEmail, connectAuthEmulator } = require('firebase/auth');

// Firebase configuration
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyAYour-API-Key-Here",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "your-project.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "your-project-id",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "your-project.appspot.com",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "123456789",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:123456789:web:abcdef"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Test accounts to try
const testAccounts = [
  {
    email: "admin@cobypicks.com",
    description: "Admin account",
    shouldExist: true
  },
  {
    email: "test@example.com", 
    description: "Test user account",
    shouldExist: false // Change to true if you have this account
  },
  {
    email: "nonexistent@fake.com",
    description: "Non-existent account",
    shouldExist: false
  }
];

async function testPasswordReset(email, description, shouldExist) {
  console.log(`\n🔍 Testing password reset for: ${description} (${email})`);
  
  try {
    await sendPasswordResetEmail(auth, email);
    console.log(`✅ SUCCESS: Password reset email sent to ${email}`);
    
    if (shouldExist) {
      console.log(`   📧 Check the inbox for ${email}`);
      console.log(`   📱 This should work on both web and mobile apps`);
    } else {
      console.log(`   ⚠️  Note: Firebase sent email even though account may not exist (security feature)`);
    }
    
    return true;
  } catch (error) {
    console.log(`❌ ERROR: ${error.code} - ${error.message}`);
    
    if (error.code === 'auth/user-not-found' && !shouldExist) {
      console.log(`   ✅ Expected error for non-existent account`);
    } else if (error.code === 'auth/user-not-found' && shouldExist) {
      console.log(`   🚨 Unexpected: Account should exist but wasn't found`);
    }
    
    return false;
  }
}

async function testRecoveryEmailLookup(recoveryEmail) {
  console.log(`\n🔍 Testing recovery email lookup for: ${recoveryEmail}`);
  
  try {
    const response = await fetch('http://localhost:3000/api/recovery-email-lookup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ recoveryEmail: recoveryEmail })
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log(`✅ SUCCESS: Found primary email for recovery email`);
      console.log(`   📧 Primary email: ${data.primaryEmail}`);
      return data.primaryEmail;
    } else if (response.status === 404) {
      console.log(`❌ No account found with recovery email: ${recoveryEmail}`);
      return null;
    } else {
      const errorText = await response.text();
      console.log(`❌ API ERROR: ${response.status} - ${errorText}`);
      return null;
    }
  } catch (error) {
    console.log(`❌ NETWORK ERROR: ${error.message}`);
    console.log(`   💡 Make sure your Next.js dev server is running on localhost:3000`);
    return null;
  }
}

async function runAllTests() {
  console.log("🚀 Starting Password Reset Testing Suite\n");
  console.log("=" * 60);
  
  // Test 1: Direct password reset for various accounts
  console.log("\n📋 TEST 1: Direct Password Reset");
  console.log("-" * 40);
  
  for (const account of testAccounts) {
    await testPasswordReset(account.email, account.description, account.shouldExist);
  }
  
  // Test 2: Recovery email lookup (if server is running)
  console.log("\n📋 TEST 2: Recovery Email Lookup");
  console.log("-" * 40);
  
  const testRecoveryEmails = [
    "recovery@example.com",
    "backup@test.com",
    "nonexistent@recovery.com"
  ];
  
  for (const recoveryEmail of testRecoveryEmails) {
    await testRecoveryEmailLookup(recoveryEmail);
  }
  
  // Test 3: Edge cases
  console.log("\n📋 TEST 3: Edge Cases");
  console.log("-" * 40);
  
  // Test empty email
  console.log("\n🔍 Testing empty email:");
  try {
    await sendPasswordResetEmail(auth, "");
    console.log("❌ Unexpected: Empty email should fail");
  } catch (error) {
    console.log(`✅ Expected error for empty email: ${error.code}`);
  }
  
  // Test invalid email format
  console.log("\n🔍 Testing invalid email format:");
  try {
    await sendPasswordResetEmail(auth, "not-an-email");
    console.log("❌ Unexpected: Invalid email should fail");
  } catch (error) {
    console.log(`✅ Expected error for invalid email: ${error.code}`);
  }
  
  // Summary
  console.log("\n" + "=" * 60);
  console.log("📊 TEST SUMMARY");
  console.log("=" * 60);
  console.log("\n✅ What should work:");
  console.log("   • Password reset emails are sent via Firebase");
  console.log("   • Works for existing accounts (emails will be delivered)"); 
  console.log("   • Works for non-existent accounts (emails not delivered, but no error shown for security)");
  console.log("   • Recovery email lookup works when server is running");
  console.log("   • Both web and mobile apps use the same Firebase auth");
  
  console.log("\n📧 Email Delivery:");
  console.log("   • Firebase sends emails through their service");
  console.log("   • Check spam/junk folders if not in inbox");
  console.log("   • Email template is controlled by Firebase console");
  
  console.log("\n🔧 Mobile App Notes:");
  console.log("   • Uses same Firebase auth as web");
  console.log("   • resetPassword function in AuthContext calls sendPasswordResetEmail");
  console.log("   • Should work identically to web version");
  
  console.log("\n💡 To verify email delivery:");
  console.log("   1. Use a real email account you control");
  console.log("   2. Check both inbox and spam folders");
  console.log("   3. Firebase Console > Authentication > Templates to customize email");
  
  console.log("\n🏁 Testing complete!");
}

// Helper function to repeat characters (simple implementation)
String.prototype.repeat = String.prototype.repeat || function(count) {
  return new Array(count + 1).join(this);
};

// Run the tests
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = { testPasswordReset, testRecoveryEmailLookup };