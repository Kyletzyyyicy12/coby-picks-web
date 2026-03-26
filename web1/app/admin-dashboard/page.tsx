'use client'

import { useAuth } from '@/contexts/AuthContext'
import { AdminDashboard } from '@/components/admin/admin-dashboard'
import { useRouter } from 'next/navigation'
import { isHardcodedAdmin } from '@/lib/hardcoded-admin'
import { useEffect } from 'react'

export default function AdminDashboardPage() {
  const { currentUser, userProfile, loading } = useAuth()
  const router = useRouter()

  // Handle redirections in useEffect to avoid setState during render
  useEffect(() => {
    if (!loading) {
      if (!currentUser) {
        router.push('/')
        return
      }

      const isAdmin = userProfile?.role === 'admin' || isHardcodedAdmin(currentUser?.email)
      
      if (!isAdmin) {
        router.push('/')
        return
      }
    }
  }, [currentUser, userProfile, loading, router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-lg text-swu-red">Loading...</p>
      </div>
    )
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-lg text-swu-red">Redirecting...</p>
      </div>
    )
  }

  const isAdmin = userProfile?.role === 'admin' || isHardcodedAdmin(currentUser?.email)

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-lg text-swu-red">Access denied. Redirecting...</p>
      </div>
    )
  }

  // Use the AdminDashboard component with required props
  return (
    <AdminDashboard 
      user={currentUser} 
      userRole={userProfile?.role || 'admin'} 
    />
  )
}
