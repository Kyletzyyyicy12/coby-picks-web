'use client'

import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { signOut } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { useRouter } from 'next/navigation'
import { Shield, User, Mail, Settings, LogOut } from 'lucide-react'
import { isHardcodedAdmin } from '@/lib/hardcoded-admin'

export default function AdminTestPage() {
  const { currentUser, userProfile, loading } = useAuth()
  const router = useRouter()

  const handleLogout = async () => {
    try {
      await signOut(auth)
      router.push('/')
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Authentication Required
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              Please log in to access this admin test page.
            </p>
            <Button onClick={() => router.push('/')} className="w-full">
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const isAdmin = userProfile?.role === 'admin' || isHardcodedAdmin(currentUser?.email)

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-4xl mx-auto pt-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Shield className="h-8 w-8" />
            Admin Test Dashboard
          </h1>
          <p className="text-muted-foreground mt-2">
            Testing admin authentication and role verification
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                User Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Email:</span>
                <span className="text-sm">{currentUser?.email}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Display Name:</span>
                <span className="text-sm">{userProfile?.displayName || 'Not set'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Role:</span>
                <Badge variant={isAdmin ? 'default' : 'secondary'}>
                  {userProfile?.role || 'Unknown'}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Email Verified:</span>
                <Badge variant={currentUser?.emailVerified ? 'default' : 'destructive'}>
                  {currentUser?.emailVerified ? 'Yes' : 'No'}
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Admin Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Is Hardcoded Admin:</span>
                <Badge variant={isHardcodedAdmin(currentUser?.email) ? 'default' : 'secondary'}>
                  {isHardcodedAdmin(currentUser?.email) ? 'Yes' : 'No'}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Admin Access:</span>
                <Badge variant={isAdmin ? 'default' : 'destructive'}>
                  {isAdmin ? 'Granted' : 'Denied'}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Can Delete Collections:</span>
                <Badge variant={isAdmin ? 'default' : 'destructive'}>
                  {isAdmin ? 'Yes' : 'No'}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Authentication Test Results</CardTitle>
            <CardDescription>
              This page tests the admin authentication system
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isAdmin ? (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <h3 className="font-semibold text-green-800 mb-2">✅ Admin Authentication Successful!</h3>
                <ul className="text-sm text-green-700 space-y-1">
                  <li>• User is properly authenticated</li>
                  <li>• Admin role is correctly assigned</li>
                  <li>• Hardcoded admin detection is working</li>
                  <li>• User can access admin features</li>
                </ul>
              </div>
            ) : (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <h3 className="font-semibold text-red-800 mb-2">❌ Not an Admin User</h3>
                <p className="text-sm text-red-700">
                  This user does not have admin privileges. Please log in with admin credentials.
                </p>
              </div>
            )}

            <div className="pt-4 border-t">
              <Button 
                onClick={handleLogout}
                variant="outline"
                className="flex items-center gap-2"
              >
                <LogOut className="h-4 w-4" />
                Logout
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}