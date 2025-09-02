'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  sendPasswordResetEmail,
  updateProfile
} from 'firebase/auth'
import { auth, db } from '@/lib/firebase'
import { doc, setDoc, getDoc } from 'firebase/firestore'
import { Shield, AlertCircle, CheckCircle, XCircle, RefreshCw } from 'lucide-react'

export default function DebugAdminPage() {
  const [email] = useState('admin@cobypicks.com')
  const [password] = useState('AdminCobyPicks2024!')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<any[]>([])

  const addResult = (type: 'success' | 'error' | 'info', message: string, details?: any) => {
    const timestamp = new Date().toLocaleTimeString()
    setResults(prev => [...prev, { type, message, details, timestamp }])
  }

  const clearResults = () => {
    setResults([])
  }

  const testSignIn = async () => {
    setLoading(true)
    addResult('info', '🔍 Testing admin sign-in...')
    
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password)
      addResult('success', `✅ Sign-in successful! UID: ${userCredential.user.uid}`)
      addResult('info', `📧 Email verified: ${userCredential.user.emailVerified}`)
      
      // Check Firestore document
      try {
        const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid))
        if (userDoc.exists()) {
          const userData = userDoc.data()
          addResult('success', '✅ Firestore user document exists')
          addResult('info', `👤 Role: ${userData.role}`)
          addResult('info', `🔧 Is Hardcoded Admin: ${userData.isHardcodedAdmin}`)
        } else {
          addResult('error', '❌ Firestore user document does not exist')
        }
      } catch (firestoreError: any) {
        addResult('error', `❌ Firestore error: ${firestoreError.message}`)
      }
      
    } catch (error: any) {
      addResult('error', `❌ Sign-in failed: ${error.code} - ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const testCreateAccount = async () => {
    setLoading(true)
    addResult('info', '🔨 Testing admin account creation...')
    
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password)
      const user = userCredential.user
      
      addResult('success', `✅ Account created! UID: ${user.uid}`)
      
      // Update profile
      await updateProfile(user, {
        displayName: 'System Administrator'
      })
      addResult('success', '✅ Profile updated')
      
      // Create Firestore document
      await setDoc(doc(db, 'users', user.uid), {
        email: user.email,
        displayName: 'System Administrator',
        fullName: 'System Administrator',
        role: 'admin',
        isHardcodedAdmin: true,
        canDeleteCollections: true,
        createdAt: new Date(),
        lastActiveAt: new Date(),
        isActive: true,
        profileComplete: true
      })
      addResult('success', '✅ Firestore document created')
      
    } catch (error: any) {
      addResult('error', `❌ Account creation failed: ${error.code} - ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const testPasswordReset = async () => {
    setLoading(true)
    addResult('info', '📧 Sending password reset email...')
    
    try {
      await sendPasswordResetEmail(auth, email)
      addResult('success', '✅ Password reset email sent!')
      addResult('info', '📬 Check your email for reset instructions')
    } catch (error: any) {
      addResult('error', `❌ Password reset failed: ${error.code} - ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-4xl mx-auto pt-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Shield className="h-8 w-8 text-red-600" />
            Admin Login Diagnostic Tool
          </h1>
          <p className="text-muted-foreground mt-2">
            Debug admin authentication issues and test Firebase connections
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Controls */}
          <Card>
            <CardHeader>
              <CardTitle>Firebase Auth Tests</CardTitle>
              <CardDescription>
                Test different Firebase authentication scenarios
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Admin Email</Label>
                <Input value={email} disabled className="bg-muted" />
              </div>
              
              <div className="space-y-2">
                <Label>Admin Password</Label>
                <Input type="password" value={password} disabled className="bg-muted" />
              </div>
              
              <div className="space-y-2">
                <Button 
                  onClick={testSignIn}
                  disabled={loading}
                  className="w-full"
                >
                  {loading ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                  Test Sign In
                </Button>
                
                <Button 
                  onClick={testCreateAccount}
                  disabled={loading}
                  variant="outline"
                  className="w-full"
                >
                  {loading ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Shield className="h-4 w-4 mr-2" />}
                  Test Create Account
                </Button>
                
                <Button 
                  onClick={testPasswordReset}
                  disabled={loading}
                  variant="outline"
                  className="w-full"
                >
                  {loading ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <AlertCircle className="h-4 w-4 mr-2" />}
                  Send Password Reset
                </Button>
                
                <Button 
                  onClick={clearResults}
                  variant="destructive"
                  size="sm"
                  className="w-full"
                >
                  Clear Results
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Results */}
          <Card>
            <CardHeader>
              <CardTitle>Test Results</CardTitle>
              <CardDescription>
                Live results from Firebase authentication tests
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {results.length === 0 ? (
                  <p className="text-muted-foreground text-sm italic">
                    No tests run yet. Click a test button to start.
                  </p>
                ) : (
                  results.map((result, index) => (
                    <Alert key={index} className={
                      result.type === 'success' ? 'border-green-500 bg-green-50' :
                      result.type === 'error' ? 'border-red-500 bg-red-50' : 
                      'border-blue-500 bg-blue-50'
                    }>
                      {result.type === 'success' ? <CheckCircle className="h-4 w-4" /> :
                       result.type === 'error' ? <XCircle className="h-4 w-4" /> :
                       <AlertCircle className="h-4 w-4" />}
                      <AlertDescription>
                        <div className="flex justify-between items-start">
                          <span className="text-sm">{result.message}</span>
                          <Badge variant="outline" className="text-xs">
                            {result.timestamp}
                          </Badge>
                        </div>
                        {result.details && (
                          <pre className="text-xs mt-2 p-2 bg-muted rounded overflow-x-auto">
                            {JSON.stringify(result.details, null, 2)}
                          </pre>
                        )}
                      </AlertDescription>
                    </Alert>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Quick Fixes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>If sign-in works:</strong><br />
                  The admin account is properly configured. Use the normal login page.
                </AlertDescription>
              </Alert>
              
              <Alert>
                <XCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>If account creation fails with 'email-already-in-use':</strong><br />
                  Use the password reset option to set a new password.
                </AlertDescription>
              </Alert>
              
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>If both fail:</strong><br />
                  Check your Firebase project configuration and API keys.
                </AlertDescription>
              </Alert>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}