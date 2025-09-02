// Hardcoded Admin Management
// This ensures certain admin accounts always have access even if their Firestore document is deleted

export const HARDCODED_ADMINS = [
  'admin@cobypicks.com'
]

export const isHardcodedAdmin = (email: string | null | undefined): boolean => {
  if (!email) return false
  return HARDCODED_ADMINS.includes(email.toLowerCase())
}

export const getHardcodedAdminRole = (email: string | null | undefined): string | null => {
  if (isHardcodedAdmin(email)) {
    return 'admin'
  }
  return null
}

export const ensureHardcodedAdminAccess = (userRole: string | null, userEmail: string | null): string => {
  // If user is a hardcoded admin, always return admin role regardless of Firestore data
  if (isHardcodedAdmin(userEmail)) {
    return 'admin'
  }
  
  // Otherwise return the provided role or default to 'user'
  return userRole || 'user'
}

// Admin account information for display purposes
export const ADMIN_ACCOUNTS = [
  {
    email: 'admin@cobypicks.com', 
    displayName: 'System Administrator',
    description: 'Hardcoded administrator with collection deletion permissions',
    isHardcoded: true,
    password: 'AdminCobyPicks2024!'
  }
]

export const getAdminAccountInfo = (email: string) => {
  return ADMIN_ACCOUNTS.find(account => account.email.toLowerCase() === email.toLowerCase())
}
