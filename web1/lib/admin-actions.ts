import { db } from "@/lib/firebase"
import { collection, addDoc, serverTimestamp, getDocs, query, where } from "firebase/firestore"

// Email sending function for user welcome emails with passwords
// This function is now handled by the API route to avoid client-side server-only imports
export async function sendUserWelcomeEmail(
  userEmail: string,
  userName: string,
  password: string,
  role: string,
  adminEmail: string
) {
  try {
    console.log(`📧 Welcome email will be sent by API route for ${userEmail}`)

    // The actual email sending is now handled by the API route
    // This function is kept for compatibility but the real work is done server-side
    return { success: true, message: `Welcome email queued for ${userEmail}` }
  } catch (error: any) {
    console.error("Error in welcome email function:", error)
    return { success: false, message: `Failed to queue welcome email: ${error.message}` }
  }
}

export async function sendEmailNotification(
  recipient: string, 
  subject: string, 
  message: string, 
  adminUser?: any,
  options?: {
    duration?: number; // Duration in days
    priority?: "low" | "medium" | "urgent";
    type?: "info" | "warning" | "success" | "urgent";
  }
) {
  try {
    // Determine target roles and recipients
    let targetRoles: string[] = []
    let recipientCount = 0

    if (recipient.toLowerCase() === 'all') {
      // Send to all users
      targetRoles = [ 'organizer', 'participant',]
      
      // Count total users
      const usersSnapshot = await getDocs(collection(db, "users"))
      recipientCount = usersSnapshot.size
    } else if (recipient.toLowerCase().includes('participant') || recipient.toLowerCase().includes('student')) {
      targetRoles = ['participant', 'student']
      const participantsQuery = query(collection(db, "users"), where("role", "in", ['participant', 'student']))
      const participantsSnapshot = await getDocs(participantsQuery)
      recipientCount = participantsSnapshot.size
    } else if (recipient.toLowerCase().includes('organizer') || recipient.toLowerCase().includes('teacher')) {
      targetRoles = ['organizer', 'teacher']
      const organizersQuery = query(collection(db, "users"), where("role", "in", ['organizer', 'teacher']))
      const organizersSnapshot = await getDocs(organizersQuery)
      recipientCount = organizersSnapshot.size
    } else if (recipient.toLowerCase().includes('admin')) {
      targetRoles = ['admin']
      const adminsQuery = query(collection(db, "users"), where("role", "==", 'admin'))
      const adminsSnapshot = await getDocs(adminsQuery)
      recipientCount = adminsSnapshot.size
    } else {
      // Specific email address
      const userQuery = query(collection(db, "users"), where("email", "==", recipient))
      const userSnapshot = await getDocs(userQuery)
      
      if (userSnapshot.empty) {
        return { success: false, message: `User with email ${recipient} not found` }
      }
      
      const userData = userSnapshot.docs[0].data()
      targetRoles = [userData.role || 'participant']
      recipientCount = 1
    }

    // Extract options with defaults
    const duration = options?.duration || 30 // Default 30 days
    const priority = options?.priority || "medium"
    const type = options?.type || "info"

    // Create announcement in Firebase
    const announcementData = {
      title: subject,
      message: message,
      type: type,
      targetRoles: targetRoles,
      isActive: true,
      priority: priority,
      createdBy: adminUser?.uid || 'admin',
      createdByName: adminUser?.displayName || adminUser?.email || 'Admin',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      readBy: [],
      // Set expiry based on duration parameter
      expiresAt: new Date(Date.now() + duration * 24 * 60 * 60 * 1000)
    }

    // Add to announcements collection
    const docRef = await addDoc(collection(db, "announcements"), announcementData)

    // Also log for auditing/tracking
    await addDoc(collection(db, "sentNotifications"), {
      announcementId: docRef.id,
      recipient,
      subject,
      message,
      targetRoles,
      recipientCount,
      timestamp: serverTimestamp(),
      status: "sent",
      sentBy: adminUser?.uid || 'admin',
      sentByName: adminUser?.displayName || adminUser?.email || 'Admin',
    })

    console.log(`\u2705 Real-time announcement sent to ${recipientCount} users`)
    console.log(`Target roles: ${targetRoles.join(', ')}`)
    console.log(`Duration: ${duration} days`)
    console.log(`Priority: ${priority}`)
    console.log(`Type: ${type}`)
    console.log(`Subject: ${subject}`)
    console.log(`Message: ${message}`)

    return { 
      success: true, 
      message: `\u2705 Announcement sent successfully to ${recipientCount} users (${targetRoles.join(', ')}). Duration: ${duration} days, Priority: ${priority}. Users will see it immediately on both web and mobile apps.`,
      recipientCount,
      targetRoles,
      announcementId: docRef.id,
      duration,
      priority,
      type
    }
  } catch (error: any) {
    console.error("Error sending real-time announcement:", error)
    return { success: false, message: `Failed to send announcement: ${error.message}` }
  }
}
