"use client"

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { auth, db } from '@/lib/firebase'
import { onAuthStateChanged, User } from 'firebase/auth'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { isHardcodedAdmin, ensureHardcodedAdminAccess } from '@/lib/hardcoded-admin'

interface UserProfile {
  uid: string
  email: string
  displayName?: string
  name?: string
  role?: string
}

interface AuthContextType {
  currentUser: User | null
  userProfile: UserProfile | null
  loading: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user)
      
      if (user) {
        try {
          let userRole = 'participant'
          let userDisplayName = user.displayName || 'User'
          
          // Check if this is a hardcoded admin first
          if (isHardcodedAdmin(user.email)) {
            userRole = 'admin'
            userDisplayName = user.email === 'admin@cobypicks.com' ? 'System Administrator' : userDisplayName
          } else {
            // Fetch user profile from Firestore for regular users
            const userDocRef = doc(db, 'users', user.uid)
            const userDocSnap = await getDoc(userDocRef)

            if (userDocSnap.exists()) {
              const userData = userDocSnap.data()
              userRole = userData.role || 'participant'
              userDisplayName = userData.displayName || user.displayName || 'User'
            } else {
              // User document doesn't exist, create a basic one
              console.log('Creating missing user document for:', user.uid)
              try {
                await setDoc(userDocRef, {
                  email: user.email,
                  displayName: user.displayName || user.email?.split('@')[0] || 'User',
                  role: 'participant',
                  createdAt: new Date(),
                  lastActiveAt: new Date(),
                  isActive: true,
                  profileComplete: false,
                  lastActiveDevice: 'Web App - Auto Created'
                })
                userRole = 'participant'
                userDisplayName = user.displayName || user.email?.split('@')[0] || 'User'
              } catch (createError) {
                console.warn('Failed to create user document, using fallback:', createError)
                userRole = 'participant'
                userDisplayName = user.displayName || 'User'
              }
            }
          }
          
          // Ensure hardcoded admin access is properly set
          const finalRole = ensureHardcodedAdminAccess(userRole, user.email)
          
          setUserProfile({
            uid: user.uid,
            email: user.email || '',
            displayName: userDisplayName,
            name: userDisplayName,
            role: finalRole
          })
        } catch (error: any) {
          // Enhanced error handling for different error types
          if (error.code === 'permission-denied') {
            console.warn('Permission denied fetching user profile - using fallback profile:', {
              uid: user.uid,
              email: user.email,
              isHardcodedAdmin: isHardcodedAdmin(user.email)
            })
          } else if (error.code === 'unavailable') {
            console.warn('Firestore temporarily unavailable - using fallback profile:', {
              uid: user.uid,
              email: user.email
            })
          } else {
            console.error('Error fetching user profile:', error)
          }

          // Fallback profile on error - still check for hardcoded admin
          const fallbackRole = isHardcodedAdmin(user.email) ? 'admin' : 'participant'
          setUserProfile({
            uid: user.uid,
            email: user.email || '',
            displayName: user.displayName || 'User',
            name: user.displayName || 'User',
            role: fallbackRole
          })
        }
      } else {
        setUserProfile(null)
      }
      
      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  const value = {
    currentUser,
    userProfile,
    loading
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export default AuthContext