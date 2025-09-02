// lib/admin-routing.ts
// Admin Routing Utility
// Ensures admin@cobypicks.com always routes to the correct dashboard

import { isHardcodedAdmin } from './hardcoded-admin'

export const ADMIN_EMAIL = 'admin@cobypicks.com'
export const ADMIN_DASHBOARD_PATH = '/admin-dashboard'

/**
 * Determine the correct route for a user based on their email and role
 */
export const getRouteForUser = (email: string | null | undefined, role?: string): string => {
  // First priority: Check if this is the hardcoded admin email
  if (email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
    console.log(`🔒 Admin email detected: ${email} -> routing to ${ADMIN_DASHBOARD_PATH}`)
    return ADMIN_DASHBOARD_PATH
  }

  // Second priority: Check if this is a hardcoded admin via utility function
  if (isHardcodedAdmin(email)) {
    console.log(`🔑 Hardcoded admin detected: ${email} -> routing to ${ADMIN_DASHBOARD_PATH}`)
    return ADMIN_DASHBOARD_PATH
  }

  // Third priority: Check role-based routing
  if (role === 'admin') {
    console.log(`👨‍💼 Admin role detected: ${email} -> routing to ${ADMIN_DASHBOARD_PATH}`)
    return ADMIN_DASHBOARD_PATH
  }

  if (role === 'organizer') {
    console.log(`👤 Organizer role detected: ${email} -> routing to /organizer`)
    return '/organizer'
  }

  if (role === 'participant') {
    console.log(`👥 Participant role detected: ${email} -> routing to /participants`)
    return '/participants'
  }

  // Default route
  console.log(`🏠 Default routing for ${email} -> routing to /participants`)
  return '/participants'
}

/**
 * Check if a user should have admin access
 */
export const shouldHaveAdminAccess = (email: string | null | undefined, role?: string): boolean => {
  // Always grant admin access to the hardcoded admin email
  if (email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
    return true
  }

  // Check hardcoded admin function
  if (isHardcodedAdmin(email)) {
    return true
  }

  // Check role-based admin access
  if (role === 'admin') {
    return true
  }

  return false
}

/**
 * Validate and redirect admin users to the correct dashboard
 */
export const validateAdminRoute = (
  email: string | null | undefined, 
  role: string | null | undefined,
  currentPath: string
): { shouldRedirect: boolean; targetPath?: string } => {
  const hasAdminAccess = shouldHaveAdminAccess(email, role || undefined)
  
  if (hasAdminAccess && currentPath !== ADMIN_DASHBOARD_PATH) {
    console.log(`🔄 Admin user ${email} on ${currentPath} -> should be on ${ADMIN_DASHBOARD_PATH}`)
    return { shouldRedirect: true, targetPath: ADMIN_DASHBOARD_PATH }
  }

  return { shouldRedirect: false }
}

/**
 * Get admin status for display purposes
 */
export const getAdminStatus = (email: string | null | undefined, role?: string) => {
  if (email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
    return {
      isAdmin: true,
      adminType: 'hardcoded',
      displayName: 'System Administrator',
      description: 'Hardcoded admin with full system access'
    }
  }

  if (isHardcodedAdmin(email)) {
    return {
      isAdmin: true,
      adminType: 'hardcoded',
      displayName: 'System Administrator',
      description: 'Hardcoded admin with full system access'
    }
  }

  if (role === 'admin') {
    return {
      isAdmin: true,
      adminType: 'role-based',
      displayName: 'Administrator',
      description: 'Role-based admin access'
    }
  }

  return {
    isAdmin: false,
    adminType: null,
    displayName: null,
    description: null
  }
}