// lib/admin-protection.ts
// Admin Account Protection System
// Ensures admin accounts are never deleted during data clearing operations

import { isHardcodedAdmin } from './hardcoded-admin'

// Admin email that must be protected
const PROTECTED_ADMIN_EMAIL = 'admin@cobypicks.com'

// Protected admin user IDs (can be expanded)
const PROTECTED_ADMIN_UIDS: string[] = []

/**
 * Check if a user should be protected from deletion
 */
export const isProtectedAdmin = (email: string | null | undefined, uid?: string): boolean => {
  // Check by email
  if (email && (isHardcodedAdmin(email) || email.toLowerCase() === PROTECTED_ADMIN_EMAIL.toLowerCase())) {
    return true
  }
  
  // Check by UID if provided
  if (uid && PROTECTED_ADMIN_UIDS.includes(uid)) {
    return true
  }
  
  return false
}

/**
 * Add a user ID to the protected list (for runtime protection)
 */
export const addProtectedAdminUID = (uid: string): void => {
  if (!PROTECTED_ADMIN_UIDS.includes(uid)) {
    PROTECTED_ADMIN_UIDS.push(uid)
    console.log(`🔒 Added admin UID to protection list: ${uid}`)
  }
}

/**
 * Filter out protected admins from a list of users before deletion
 */
export const filterOutProtectedAdmins = (users: any[]): any[] => {
  return users.filter(user => {
    const isProtected = isProtectedAdmin(user.email, user.uid || user.id)
    if (isProtected) {
      console.log(`🛡️ Protected admin account from deletion: ${user.email}`)
    }
    return !isProtected
  })
}

/**
 * Validate that a user can be safely deleted
 */
export const canDeleteUser = (email: string | null | undefined, uid?: string): { canDelete: boolean; reason?: string } => {
  if (isProtectedAdmin(email, uid)) {
    return {
      canDelete: false,
      reason: `Cannot delete protected admin account: ${email}. This account is essential for system administration.`
    }
  }
  
  return { canDelete: true }
}

/**
 * Safe deletion function that checks protection before deletion
 */
export const safeDeleteCheck = (email: string | null | undefined, uid?: string): boolean => {
  const check = canDeleteUser(email, uid)
  if (!check.canDelete) {
    console.warn(`🚫 Deletion blocked: ${check.reason}`)
    throw new Error(check.reason)
  }
  return true
}

/**
 * Log admin protection activity
 */
export const logAdminProtection = (action: string, email: string, reason: string): void => {
  console.log(`🔐 Admin Protection: ${action} blocked for ${email} - ${reason}`)
  
  // You can extend this to write to Firebase audit logs
  // await addDoc(collection(db, 'adminProtectionLogs'), {
  //   action,
  //   email,
  //   reason,
  //   timestamp: new Date(),
  //   type: 'ADMIN_PROTECTION'
  // })
}

/**
 * Check if current user is trying to delete themselves (admin safety check)
 */
export const isSelfDeletion = (currentUserEmail: string, targetEmail: string): boolean => {
  return currentUserEmail?.toLowerCase() === targetEmail?.toLowerCase()
}

/**
 * Admin account preservation during data clearing
 */
export const preserveAdminDuringClear = (currentUserEmail: string): { 
  shouldPreserve: boolean; 
  message?: string 
} => {
  if (isHardcodedAdmin(currentUserEmail)) {
    return {
      shouldPreserve: true,
      message: "Admin account will be preserved during data clearing to maintain system access."
    }
  }
  
  return { shouldPreserve: false }
}

export { PROTECTED_ADMIN_EMAIL }