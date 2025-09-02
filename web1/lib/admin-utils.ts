/**
 * Admin utility functions for consistent admin email detection
 * across web and mobile platforms
 */

// Hardcoded admin emails that should match the Firestore security rules
export const HARDCODED_ADMIN_EMAILS = [
  'superadmin@cobypicks.com',
  'admin@cobypicks.com', 
  'youradmin@cobypicks.com',
  'customadmin@cobypicks.com',
  'sysadmin@cobypicks.com',
  'mejan.dia@cobypicks.com'
] as const

/**
 * Check if an email is in the hardcoded admin list
 * @param email - Email address to check
 * @returns true if the email is a hardcoded admin email
 */
export function isHardcodedAdminEmail(email: string): boolean {
  return HARDCODED_ADMIN_EMAILS.includes(email.toLowerCase() as any)
}

/**
 * Auto-detect the appropriate role based on email address
 * @param email - User's email address
 * @param selectedRole - Role selected by user during registration
 * @returns 'admin' if email is hardcoded admin, otherwise the selected role
 */
export function autoDetectRole(email: string, selectedRole: string): string {
  return isHardcodedAdminEmail(email) ? 'admin' : selectedRole
}

/**
 * Get admin role assignment details for audit trail
 * @param email - User's email address
 * @param selectedRole - Role selected by user
 * @returns Object with role assignment details
 */
export function getAdminRoleAssignmentDetails(email: string, selectedRole: string) {
  const isAdmin = isHardcodedAdminEmail(email)
  const finalRole = autoDetectRole(email, selectedRole)
  
  return {
    finalRole,
    isHardcodedAdmin: isAdmin,
    roleChangedBy: isAdmin ? 'system-auto-detect' : 'user-selection',
    reason: isAdmin 
      ? 'Auto-detected admin email during registration'
      : 'User-selected role during registration',
    roleLocked: true // All roles are locked by default for security
  }
}