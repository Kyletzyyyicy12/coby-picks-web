#!/bin/bash

# 🚀 Firebase Security Rules Deployment Script
# This script deploys the updated security rules to fix permission errors

echo "🔥 Firebase Security Rules Deployment"
echo "=====================================​"

echo "📋 Pre-deployment Checklist:"
echo "✅ Updated Firebase security rules with participantEvents and participantRequests permissions"
echo "✅ Enhanced real-time synchronization fields for liveDrawSessions"
echo "✅ Added proper subcollection permissions for participant join notifications"
echo ""

echo "🚀 Deploying Firebase Security Rules..."
echo "Run the following commands in your terminal:"
echo ""

# Check if firebase CLI is installed
echo "1️⃣ Check Firebase CLI installation:"
echo "firebase --version"
echo ""

# Login to Firebase
echo "2️⃣ Login to Firebase (if not already logged in):"
echo "firebase login"
echo ""

# Initialize Firebase (if not already initialized)
echo "3️⃣ Initialize Firebase project (if needed):"
echo "firebase init firestore"
echo ""

# Deploy security rules
echo "4️⃣ Deploy the security rules:"
echo "firebase deploy --only firestore:rules"
echo ""

echo "🎯 Expected Output:"
echo "✅ Deploy complete!"
echo "✅ Firestore Rules: Released rules"
echo ""

echo "🔍 Verification Steps:"
echo "1. Check Firebase Console > Firestore Database > Rules"
echo "2. Verify participantEvents subcollection rules are deployed"
echo "3. Verify participantRequests collection rules are deployed"
echo "4. Test participant join functionality in mobile app"
echo "5. Test participant request system functionality"
echo ""

echo "🚨 If you encounter deployment errors:"
echo "• Ensure you're in the correct project directory"
echo "• Check that firestore.rules file exists"
echo "• Verify Firebase project ID is correct"
echo "• Run: firebase projects:list"
echo "• Run: firebase use [PROJECT_ID]"
echo ""

echo "📱 Testing Real-time Synchronization:"
echo "After deployment, test these features:"
echo "1. Organizer spins wheel → Participants see real-time spinning"
echo "2. Winner selected → Participants see winner immediately"
echo "3. Text input changes → Real-time sync to participants"
echo "4. Image upload in ImagePickerWheel → Instant sync to participants"
echo "5. Participant join → No Firebase permission errors"
echo "6. Participant requests → No Firebase permission errors"
echo ""

echo "🎉 Once deployed, all real-time synchronization features should work perfectly!"