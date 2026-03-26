import { doc, setDoc, getDoc, updateDoc, collection, getDocs, query, where, serverTimestamp } from 'firebase/firestore'
import { db } from './firebase'
import { toast } from '@/hooks/use-toast'

export interface RoleChangeRequest {
  targetUserId: string
  targetUserEmail: string
  newRole: 'participant' | 'organizer' | 'admin'
  reason: string
  adminUserId: string
  adminEmail: string
}

export interface RoleChangeHistory {
  oldRole: string
  newRole: string
  changedBy: string
  changedAt: Date
  reason: string
  adminEmail: string
}

/**
 * SECURITY: Web Admin Role Manager
 * Only administrators can use these functions to change user roles
 * All role changes are logged and tracked for security audit
 */
export class WebAdminRoleManager {
  
  /**
   * Verify if the current user is an admin and can change roles
   */
  static async verifyAdminPermissions(adminUserId: string): Promise<boolean> {
    try {
      if (!db || !adminUserId) {
        console.error('🚫 SECURITY: Invalid admin verification request')
        return false
      }

      const adminDoc = await getDoc(doc(db, 'users', adminUserId))
      if (!adminDoc.exists()) {
        console.error('🚫 SECURITY: Admin user not found')
        return false
      }

      const adminData = adminDoc.data()
      const isAdmin = adminData.role?.toLowerCase() === 'admin'
      
      if (!isAdmin) {
        console.warn(`🚫 SECURITY: Non-admin user ${adminUserId} attempted role management`)
      }
      
      return isAdmin
    } catch (error) {
      console.error('🚫 SECURITY: Error verifying admin permissions:', error)
      return false
    }
  }

  /**
   * Change a user's role (admin only)
   */
  static async changeUserRole(request: RoleChangeRequest): Promise<boolean> {
    try {
      // Verify admin permissions
      const isAuthorized = await this.verifyAdminPermissions(request.adminUserId)
      if (!isAuthorized) {
        toast({
          title: 'Access Denied',
          description: 'Only administrators can change user roles. This incident will be logged.',
          variant: 'destructive'
        })
        return false
      }

      // Get current user data
      const userDoc = await getDoc(doc(db, 'users', request.targetUserId))
      if (!userDoc.exists()) {
        toast({
          title: 'Error',
          description: 'Target user not found.',
          variant: 'destructive'
        })
        return false
      }

      const userData = userDoc.data()
      const oldRole = userData.role || 'participant'
      
      // Prevent changing roles to the same role
      if (oldRole === request.newRole) {
        toast({
          title: 'No Change',
          description: 'User already has this role.',
          variant: 'destructive'
        })
        return false
      }

      // Create role change history entry
      const now = new Date()
      const historyEntry: RoleChangeHistory = {
        oldRole,
        newRole: request.newRole,
        changedBy: request.adminUserId,
        changedAt: now,
        reason: request.reason,
        adminEmail: request.adminEmail
      }

      // Update existing history or create new array
      const existingHistory = userData.roleChangeHistory || []
      const updatedHistory = [...existingHistory, historyEntry]

      // Update user document with new role and security tracking
      await updateDoc(doc(db, 'users', request.targetUserId), {
        role: request.newRole,
        roleLocked: true, // Always lock roles after admin changes
        roleLockedAt: now,
        roleChangedBy: request.adminUserId,
        roleChangeHistory: updatedHistory,
        lastActiveAt: now,
        // Add audit trail
        lastRoleChangeReason: request.reason,
        lastRoleChangeAdmin: request.adminEmail,
        updatedAt: serverTimestamp()
      })

      // Log the role change for security audit
      console.log(`🔐 ADMIN ROLE CHANGE: ${request.adminEmail} changed ${request.targetUserEmail} from ${oldRole} to ${request.newRole}`)
      
      // Create audit log entry
      await this.createAuditLog({
        action: 'ROLE_CHANGE',
        adminUserId: request.adminUserId,
        adminEmail: request.adminEmail,
        targetUserId: request.targetUserId,
        targetUserEmail: request.targetUserEmail,
        oldRole,
        newRole: request.newRole,
        reason: request.reason,
        timestamp: now
      })

      toast({
        title: 'Role Changed Successfully',
        description: `User ${request.targetUserEmail} role changed from ${oldRole} to ${request.newRole}.`,
      })
      
      return true
    } catch (error) {
      console.error('❌ Error changing user role:', error)
      toast({
        title: 'Error',
        description: 'Failed to change user role. Please try again.',
        variant: 'destructive'
      })
      return false
    }
  }

  /**
   * Get role change history for a user (admin only)
   */
  static async getRoleHistory(userId: string, adminUserId: string): Promise<RoleChangeHistory[]> {
    try {
      const isAuthorized = await this.verifyAdminPermissions(adminUserId)
      if (!isAuthorized) return []

      const userDoc = await getDoc(doc(db, 'users', userId))
      if (!userDoc.exists()) return []

      const userData = userDoc.data()
      return userData.roleChangeHistory || []
    } catch (error) {
      console.error('Error getting role history:', error)
      return []
    }
  }

  /**
   * Create audit log entry for security tracking
   */
  private static async createAuditLog(logData: any): Promise<void> {
    try {
      await setDoc(doc(collection(db, 'auditLogs')), {
        ...logData,
        createdAt: serverTimestamp(),
        type: 'SECURITY_ROLE_CHANGE'
      })
    } catch (error) {
      console.error('Failed to create audit log:', error)
      // Don't fail the main operation if audit logging fails
    }
  }

  /**
   * Get all users for admin management (admin only)
   */
  static async getAllUsers(adminUserId: string): Promise<any[]> {
    try {
      const isAuthorized = await this.verifyAdminPermissions(adminUserId)
      if (!isAuthorized) return []

      const usersSnapshot = await getDocs(collection(db, 'users'))
      const users: any[] = []
      
      usersSnapshot.forEach((doc) => {
        const userData = doc.data()
        users.push({
          id: doc.id,
          ...userData,
          // Hide sensitive data
          password: undefined,
          recoveryEmail: userData.recoveryEmail ? '***@***.***' : undefined
        })
      })

      return users
    } catch (error) {
      console.error('Error getting all users:', error)
      return []
    }
  }

  /**
   * Prevent role tampering by checking role integrity
   */
  static async validateRoleIntegrity(userId: string): Promise<boolean> {
    try {
      const userDoc = await getDoc(doc(db, 'users', userId))
      if (!userDoc.exists()) return false

      const userData = userDoc.data()
      
      // Check if role is properly locked
      if (!userData.roleLocked) {
        console.warn(`⚠️ SECURITY: User ${userId} has unlocked role - potential tampering`)
        return false
      }

      // Check if role change history exists
      if (!userData.roleChangeHistory || userData.roleChangeHistory.length === 0) {
        console.warn(`⚠️ SECURITY: User ${userId} missing role change history`)
        return false
      }

      return true
    } catch (error) {
      console.error('Error validating role integrity:', error)
      return false
    }
  }

  /**
   * Bulk role changes (admin only) - useful for organizing events
   */
  static async bulkRoleChange(
    userIds: string[], 
    newRole: 'participant' | 'organizer' | 'admin',
    reason: string,
    adminUserId: string,
    adminEmail: string
  ): Promise<{ successful: number; failed: number }> {
    try {
      const isAuthorized = await this.verifyAdminPermissions(adminUserId)
      if (!isAuthorized) {
        toast({
          title: 'Access Denied',
          description: 'Only administrators can perform bulk role changes.',
          variant: 'destructive'
        })
        return { successful: 0, failed: userIds.length }
      }

      let successful = 0
      let failed = 0

      for (const userId of userIds) {
        try {
          const userDoc = await getDoc(doc(db, 'users', userId))
          if (!userDoc.exists()) {
            failed++
            continue
          }

          const userData = userDoc.data()
          const request: RoleChangeRequest = {
            targetUserId: userId,
            targetUserEmail: userData.email || 'unknown',
            newRole,
            reason: `Bulk change: ${reason}`,
            adminUserId,
            adminEmail
          }

          const success = await this.changeUserRole(request)
          if (success) {
            successful++
          } else {
            failed++
          }
        } catch (error) {
          console.error(`Failed to change role for user ${userId}:`, error)
          failed++
        }
      }

      toast({
        title: 'Bulk Role Change Completed',
        description: `Successfully changed ${successful} users. ${failed} failed.`,
      })

      return { successful, failed }
    } catch (error) {
      console.error('Error in bulk role change:', error)
      return { successful: 0, failed: userIds.length }
    }
  }
}

export default WebAdminRoleManager