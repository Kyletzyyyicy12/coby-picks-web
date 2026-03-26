// lib/wheel-sync-service.ts
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, where, orderBy } from 'firebase/firestore'
import { db } from './firebase'

export interface WheelData {
  id?: string
  title: string
  items: string[]
  createdBy: string
  createdAt: Date
  updatedAt: Date
  isPublic: boolean
  allowedRoles: ('admin' | 'organizer' | 'participant')[]
  category?: string
  description?: string
}

export class WheelSyncService {
  
  /**
   * Create a new wheel that syncs across all platforms
   */
  static async createWheel(wheelData: Omit<WheelData, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, 'wheels'), {
        ...wheelData,
        createdAt: new Date(),
        updatedAt: new Date(),
        // Ensure admin wheels are visible to all user types
        isPublic: wheelData.allowedRoles.includes('participant') || wheelData.allowedRoles.includes('organizer'),
        syncEnabled: true,
        platformAccess: {
          web: true,
          mobile: true,
          admin: true
        }
      })
      
      console.log('Wheel created with cross-platform sync:', docRef.id)
      return docRef.id
    } catch (error) {
      console.error('Error creating wheel:', error)
      throw error
    }
  }

  /**
   * Update wheel and sync across platforms
   */
  static async updateWheel(wheelId: string, updates: Partial<WheelData>): Promise<void> {
    try {
      await updateDoc(doc(db, 'wheels', wheelId), {
        ...updates,
        updatedAt: new Date(),
        lastSyncAt: new Date()
      })
      
      console.log('Wheel updated with sync:', wheelId)
    } catch (error) {
      console.error('Error updating wheel:', error)
      throw error
    }
  }

  /**
   * Delete wheel from all platforms
   */
  static async deleteWheel(wheelId: string): Promise<void> {
    try {
      await deleteDoc(doc(db, 'wheels', wheelId))
      console.log('Wheel deleted from all platforms:', wheelId)
    } catch (error) {
      console.error('Error deleting wheel:', error)
      throw error
    }
  }

  /**
   * Get wheels visible to specific user role
   */
  static getWheelsForRole(userRole: 'admin' | 'organizer' | 'participant', callback: (wheels: WheelData[]) => void) {
    let wheelQuery
    
    if (userRole === 'admin') {
      // Admin can see all wheels
      wheelQuery = query(collection(db, 'wheels'), orderBy('updatedAt', 'desc'))
    } else {
      // Organizers and participants see public wheels or wheels they can access
      wheelQuery = query(
        collection(db, 'wheels'),
        where('allowedRoles', 'array-contains', userRole),
        orderBy('updatedAt', 'desc')
      )
    }

    return onSnapshot(wheelQuery, (snapshot) => {
      const wheels = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as WheelData))
      
      callback(wheels)
    })
  }

  /**
   * Sync admin-created wheels to organizer and participant views
   */
  static async syncAdminWheelsToAllUsers(adminWheels: WheelData[]): Promise<void> {
    try {
      for (const wheel of adminWheels) {
        if (wheel.id) {
          await this.updateWheel(wheel.id, {
            allowedRoles: ['admin', 'organizer', 'participant'],
            isPublic: true,
            syncEnabled: true
          })
        }
      }
      console.log('Admin wheels synced to all users')
    } catch (error) {
      console.error('Error syncing admin wheels:', error)
      throw error
    }
  }
}

// Export default for easier imports
export default WheelSyncService