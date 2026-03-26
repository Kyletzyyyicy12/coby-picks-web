// Test utility for live room invitation system
// This file helps verify that the invitation system is working correctly

import { db } from "@/lib/firebase"
import { collection, addDoc, serverTimestamp, query, where, getDocs } from "firebase/firestore"

export interface TestInvitationData {
  sessionId: string
  sessionTitle: string
  sessionDescription: string
  wheelType: string
  wheelTitle: string
  wheelIcon: string
  roomCode: string
  invitedByName: string
  invitedByEmail: string
  invitedOrganizerEmail: string
  invitedBy: string
}

// Create a test live room invitation
export async function createTestLiveRoomInvitation(data: TestInvitationData) {
  try {
    console.log("📧 Creating test live room invitation:", data)
    
    const invitationData = {
      sessionId: data.sessionId,
      sessionTitle: data.sessionTitle,
      sessionDescription: data.sessionDescription,
      wheelType: data.wheelType,
      wheelTitle: data.wheelTitle,
      wheelIcon: data.wheelIcon,
      roomCode: data.roomCode,
      
      // Inviter information
      invitedBy: data.invitedBy,
      invitedByName: data.invitedByName,
      invitedByEmail: data.invitedByEmail,
      
      // Invitee information
      invitedOrganizerEmail: data.invitedOrganizerEmail,
      invitedOrganizer: null, // Will be filled when they accept
      
      // Invitation details
      status: 'sent',
      type: 'live_room_invitation',
      createdAt: serverTimestamp(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      
      // Session configuration
      sessionConfig: {
        maxParticipants: 50,
        allowReactions: true,
        confettiEffect: true,
        soundEffects: true,
        liveSession: true,
        allowDataSync: true
      },
      
      // Collaboration permissions
      permissions: {
        canControlLive: true,
        canEditWheel: true,
        canManageParticipants: true,
        canEndSession: false, // Only primary organizer can end
        canInviteOthers: false
      },
      
      // Notification metadata
      isRealTimeNotification: true,
      priority: 'high',
      requiresImmediateAttention: true,
      
      // Track notification delivery
      notificationSent: true,
      sentAt: serverTimestamp()
    }
    
    const docRef = await addDoc(collection(db, "liveRoomInvitations"), invitationData)
    console.log("✅ Test live room invitation created:", docRef.id)
    
    return {
      success: true,
      invitationId: docRef.id,
      message: `Test invitation sent to ${data.invitedOrganizerEmail}`
    }
    
  } catch (error) {
    console.error("❌ Error creating test invitation:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    }
  }
}

// Check if invitations exist for a specific email
export async function checkInvitationsForEmail(email: string) {
  try {
    console.log("🔍 Checking invitations for email:", email)
    
    const invitationsQuery = query(
      collection(db, 'liveRoomInvitations'),
      where('invitedOrganizerEmail', '==', email),
      where('status', '==', 'sent')
    )
    
    const snapshot = await getDocs(invitationsQuery)
    const invitations = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }))
    
    console.log(`Found ${invitations.length} active invitations for ${email}:`, 
      invitations.map(inv => ({
        id: inv.id,
        sessionTitle: inv.sessionTitle,
        roomCode: inv.roomCode,
        invitedBy: inv.invitedByName
      }))
    )
    
    return {
      success: true,
      count: invitations.length,
      invitations: invitations
    }
    
  } catch (error) {
    console.error("❌ Error checking invitations:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    }
  }
}

// Test the complete invitation flow
export async function testInvitationFlow() {
  console.log("🧪 Testing live room invitation flow...")
  
  // Test data
  const testData: TestInvitationData = {
    sessionId: `test-session-${Date.now()}`,
    sessionTitle: "Test Live Room Session",
    sessionDescription: "Testing the real-time invitation system",
    wheelType: "basic-picker",
    wheelTitle: "Test Picker Wheel",
    wheelIcon: "🎯",
    roomCode: "TEST123",
    invitedByName: "Test Organizer",
    invitedByEmail: "test.organizer@example.com",
    invitedOrganizerEmail: "invited.organizer@example.com",
    invitedBy: "test-user-uid"
  }
  
  // Create test invitation
  const result = await createTestLiveRoomInvitation(testData)
  
  if (result.success) {
    console.log("✅ Test invitation created successfully!")
    
    // Check if invitation can be retrieved
    const checkResult = await checkInvitationsForEmail(testData.invitedOrganizerEmail)
    
    if (checkResult.success && checkResult.count > 0) {
      console.log("✅ Test invitation can be retrieved successfully!")
      return {
        success: true,
        message: "Live room invitation system is working correctly",
        details: {
          invitationId: result.invitationId,
          retrievedCount: checkResult.count
        }
      }
    } else {
      console.log("❌ Test invitation could not be retrieved")
      return {
        success: false,
        message: "Invitation created but cannot be retrieved"
      }
    }
  } else {
    console.log("❌ Test invitation creation failed")
    return {
      success: false,
      message: "Failed to create test invitation",
      error: result.error
    }
  }
}

// Helper function for organizers to validate email format
export function validateCollaboratorEmails(emailString: string): { valid: string[], invalid: string[] } {
  const emails = emailString
    .split(',')
    .map(email => email.trim())
    .filter(email => email.length > 0)
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  
  const valid: string[] = []
  const invalid: string[] = []
  
  emails.forEach(email => {
    if (emailRegex.test(email)) {
      valid.push(email)
    } else {
      invalid.push(email)
    }
  })
  
  return { valid, invalid }
}

export default {
  createTestLiveRoomInvitation,
  checkInvitationsForEmail,
  testInvitationFlow,
  validateCollaboratorEmails
}
