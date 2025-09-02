#!/bin/bash

echo "🚀 Deploying Firestore Security Rules Fix..."
echo "=============================================="
echo ""

echo "🔧 Fixing participant join broadcasting permissions..."
echo "🔧 Fixing participant request listening permissions..."
echo "🔧 Fixing spin history access permissions..."
echo "🔧 Fixing wheel history access permissions..."
echo ""

echo "📝 Updated Rules Summary:"
echo "- liveDrawSessions/particlesEvents collection: Added permissions for broadcasting joins/leaves"
echo "- liveDrawSessions/particlesRequests collection: Added permissions for listening to requests"
echo "- spinHistory collection: Now accessible to all authenticated users"
echo "- liveWheelHistory collection: Added complete rule set"
echo "- comments collection: Enhanced permissions for mobile app"
echo "- liveInvitations collection: Emergency fallback permissions"
echo "- Collaboration collections: Added new collections for advanced features"
echo ""

echo "⚡ Run this command to deploy the fixes:"
echo "firebase deploy --only firestore:rules --project cobypicksswu"
echo ""

echo "🎯 Expected Results After Deployment:"
echo "✅ No more 'Missing or insufficient permissions' errors"
echo "✅ Participant joins/leaves broadcast successfully"
echo "✅ Participant requests are listened to properly"
echo "✅ Spin history loads for all authenticated users"
echo "✅ Wheel synchronization works across web/mobile"
echo ""

echo "🧪 Test After Deployment:"
echo "1. Join live session as participant (mobile app)"
echo "2. Check console for permission errors ✅"
echo "3. Observer spins wheel from web dashboard"
echo "4. Participant wheel spins at same speed/timing ✅"
echo "5. Arrows point to identical winners ✅"
echo ""

echo "Deploy script created! Run 'firebase deploy --only firestore:rules' to apply the fixes."