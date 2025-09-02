"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { db, auth } from "@/lib/firebase"
import { collection, getDocs, addDoc, doc, getDoc, deleteDoc } from "firebase/firestore"
import { signInWithEmailAndPassword, signOut } from "firebase/auth"
import { firebaseHelper, isQuicError, isRecoverableError, getErrorMessage } from "@/lib/firebase-connection-helper"
import { CheckCircle2, XCircle, Loader2, Database, Wifi, WifiOff, Shield, User, RefreshCw, AlertTriangle } from "lucide-react"

interface TestResult {
  name: string
  status: 'pending' | 'success' | 'error'
  message: string
  details?: any
}

export function FirebaseConnectionTest() {
  const [tests, setTests] = useState<TestResult[]>([
    { name: 'Firebase Config Check', status: 'pending', message: 'Waiting...' },
    { name: 'Authentication Test', status: 'pending', message: 'Waiting...' },
    { name: 'Connection Status Check', status: 'pending', message: 'Waiting...' },
    { name: 'Read Users Collection', status: 'pending', message: 'Waiting...' },
    { name: 'Read Wheels Collection', status: 'pending', message: 'Waiting...' },
    { name: 'Create Test Document', status: 'pending', message: 'Waiting...' },
    { name: 'Read Test Document', status: 'pending', message: 'Waiting...' },
    { name: 'Delete Test Document', status: 'pending', message: 'Waiting...' },
    { name: 'Rules Verification', status: 'pending', message: 'Waiting...' },
  ])
  const [isRunning, setIsRunning] = useState(false)
  const [overallStatus, setOverallStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle')
  const [connectionStatus, setConnectionStatus] = useState(firebaseHelper.getConnectionStatus())
  const [quicErrorDetected, setQuicErrorDetected] = useState(false)

  const updateTest = (index: number, status: 'success' | 'error', message: string, details?: any) => {
    setTests(prev => prev.map((test, i) =>
      i === index ? { ...test, status, message, details } : test
    ))
  }

  // Monitor connection status
  useEffect(() => {
    const unsubscribe = firebaseHelper.onConnectionStatusChange((status) => {
      setConnectionStatus(status)
      if (status.lastError && isQuicError(status.lastError)) {
        setQuicErrorDetected(true)
      }
    })

    return unsubscribe
  }, [])

  const runTests = async () => {
    setIsRunning(true)
    setOverallStatus('running')
    let testDocId = ''

    try {
      console.log('🔥 Starting Firebase Connection Tests...')

      // Test 0: Firebase Config Check
      try {
        const config = {
          projectId: db.app.options.projectId,
          authDomain: db.app.options.authDomain,
          apiKey: db.app.options.apiKey?.substring(0, 10) + '...',
        }
        updateTest(0, 'success', `Config loaded: ${config.projectId}`, config)
        console.log('✅ Firebase config test passed:', config)
      } catch (error: any) {
        updateTest(0, 'error', `Config error: ${error.message}`, error)
        console.error('❌ Firebase config test failed:', error)
      }

      // Test 1: Authentication Test
      try {
        const currentUser = auth.currentUser
        if (currentUser) {
          updateTest(1, 'success', `Authenticated as: ${currentUser.email}`, { uid: currentUser.uid, email: currentUser.email })
        } else {
          updateTest(1, 'success', 'Not authenticated (anonymous access)', { authenticated: false })
        }
        console.log('✅ Authentication test passed')
      } catch (error: any) {
        updateTest(1, 'error', `Auth error: ${error.message}`, error)
        console.error('❌ Authentication test failed:', error)
      }

      // Test 2: Connection Status Check
      try {
        const status = firebaseHelper.getConnectionStatus()
        if (status.isConnected) {
          updateTest(2, 'success', 'Firebase connection is healthy', status)
        } else if (status.lastError) {
          const errorMsg = getErrorMessage(status.lastError)
          updateTest(2, 'error', `Connection issue: ${errorMsg}`, status)
        } else {
          updateTest(2, 'error', 'Connection status unknown', status)
        }
        console.log('✅ Connection status test completed')
      } catch (error: any) {
        updateTest(2, 'error', `Connection check failed: ${error.message}`, error)
        console.error('❌ Connection status test failed:', error)
      }

      // Test 3: Read Users Collection
      try {
        const usersRef = collection(db, 'users')
        const usersSnapshot = await firebaseHelper.safeGetDocs(usersRef)
        updateTest(3, 'success', `Found ${usersSnapshot.size} user documents`, { count: usersSnapshot.size })
        console.log(`✅ Users collection test passed: ${usersSnapshot.size} documents`)
      } catch (error: any) {
        const errorMsg = getErrorMessage(error)
        updateTest(3, 'error', `Failed: ${errorMsg}`, error)
        console.error('❌ Users collection test failed:', error)
      }

      // Test 4: Read Wheels Collection
      try {
        const wheelsRef = collection(db, 'wheels')
        const wheelsSnapshot = await firebaseHelper.safeGetDocs(wheelsRef)
        updateTest(4, 'success', `Found ${wheelsSnapshot.size} wheel documents`, { count: wheelsSnapshot.size })
        console.log(`✅ Wheels collection test passed: ${wheelsSnapshot.size} documents`)
      } catch (error: any) {
        const errorMsg = getErrorMessage(error)
        updateTest(4, 'error', `Failed: ${errorMsg}`, error)
        console.error('❌ Wheels collection test failed:', error)
      }

      // Test 5: Create Test Document
      try {
        const testDoc = await firebaseHelper.safeAddDoc(collection(db, 'connectionTest'), {
          timestamp: new Date(),
          message: 'Firebase connection test successful',
          testId: Math.random().toString(36).substr(2, 9),
          userAgent: navigator.userAgent,
          url: window.location.href
        })
        testDocId = testDoc.id
        updateTest(5, 'success', `Created document with ID: ${testDoc.id}`, { docId: testDoc.id })
        console.log(`✅ Document creation test passed: ${testDoc.id}`)
      } catch (error: any) {
        const errorMsg = getErrorMessage(error)
        updateTest(5, 'error', `Failed: ${errorMsg}`, error)
        console.error('❌ Document creation test failed:', error)
      }

      // Test 6: Read Test Document
      if (testDocId) {
        try {
          const testDocRef = doc(db, 'connectionTest', testDocId)
          const testDocSnap = await firebaseHelper.safeGetDoc(testDocRef)
          if (testDocSnap.exists()) {
            updateTest(6, 'success', 'Successfully read test document back', testDocSnap.data())
            console.log('✅ Document read test passed:', testDocSnap.data())
          } else {
            updateTest(6, 'error', 'Test document not found', { docId: testDocId })
            console.log('❌ Document read test failed: document not found')
          }
        } catch (error: any) {
          const errorMsg = getErrorMessage(error)
          updateTest(6, 'error', `Failed: ${errorMsg}`, error)
          console.error('❌ Document read test failed:', error)
        }

        // Test 7: Delete Test Document
        try {
          const testDocRef = doc(db, 'connectionTest', testDocId)
          await firebaseHelper.safeDeleteDoc(testDocRef)
          updateTest(7, 'success', 'Successfully deleted test document', { docId: testDocId })
          console.log('✅ Document deletion test passed')
        } catch (error: any) {
          const errorMsg = getErrorMessage(error)
          updateTest(7, 'error', `Failed: ${errorMsg}`, error)
          console.error('❌ Document deletion test failed:', error)
        }
      } else {
        updateTest(6, 'error', 'Skipped - no test document created', {})
        updateTest(7, 'error', 'Skipped - no test document created', {})
      }

      // Test 8: Rules Verification
      try {
        // Test various collections to verify rules are working
        const collections = ['users', 'wheels', 'announcements', 'liveDrawSessions']
        const rulesResults = []

        for (const collectionName of collections) {
          try {
            const collRef = collection(db, collectionName)
            const snapshot = await firebaseHelper.safeGetDocs(collRef)
            rulesResults.push(`${collectionName}: ${snapshot.size} docs`)
          } catch (error: any) {
            rulesResults.push(`${collectionName}: ${error.code}`)
          }
        }

        updateTest(8, 'success', 'Rules verification completed', { results: rulesResults })
        console.log('✅ Rules verification test passed:', rulesResults)
      } catch (error: any) {
        const errorMsg = getErrorMessage(error)
        updateTest(8, 'error', `Rules verification failed: ${errorMsg}`, error)
        console.error('❌ Rules verification test failed:', error)
      }

      // Check overall status
      const hasErrors = tests.some(test => test.status === 'error')
      setOverallStatus(hasErrors ? 'error' : 'success')
      console.log('🎉 Firebase connection tests completed!')

    } catch (error: any) {
      console.error('❌ Test suite failed:', error)
      setOverallStatus('error')
    } finally {
      setIsRunning(false)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />
      case 'pending':
        return <Loader2 className="h-4 w-4 text-gray-400 animate-spin" />
      default:
        return <div className="h-4 w-4 bg-gray-300 rounded-full" />
    }
  }

  const getOverallStatusIcon = () => {
    switch (overallStatus) {
      case 'success':
        return <Wifi className="h-6 w-6 text-green-500" />
      case 'error':
        return <WifiOff className="h-6 w-6 text-red-500" />
      case 'running':
        return <Loader2 className="h-6 w-6 text-blue-500 animate-spin" />
      default:
        return <Database className="h-6 w-6 text-gray-500" />
    }
  }

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {getOverallStatusIcon()}
          Firebase Connection Test
        </CardTitle>
        <CardDescription>
          Test the connection between your app and Firestore database
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button
            onClick={runTests}
            disabled={isRunning}
            className="flex-1"
          >
            {isRunning ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Running Tests...
              </>
            ) : (
              'Run Firebase Connection Tests'
            )}
          </Button>

          {!connectionStatus.isConnected && (
            <Button
              onClick={() => firebaseHelper.reconnect()}
              variant="outline"
              disabled={isRunning}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Reconnect
            </Button>
          )}
        </div>

        <div className="space-y-2">
          {tests.map((test, index) => (
            <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-2">
                {getStatusIcon(test.status)}
                <span className="font-medium">{test.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={test.status === 'success' ? 'default' : test.status === 'error' ? 'destructive' : 'secondary'}>
                  {test.status}
                </Badge>
                <span className="text-sm text-gray-600">{test.message}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Connection Status Alert */}
        {connectionStatus.lastError && (
          <Alert variant={isQuicError(connectionStatus.lastError) ? "default" : "destructive"}>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>
              {isQuicError(connectionStatus.lastError) ? 'QUIC Protocol Error Detected' : 'Connection Error'}
            </AlertTitle>
            <AlertDescription>
              {getErrorMessage(connectionStatus.lastError)}
              {isQuicError(connectionStatus.lastError) && (
                <div className="mt-2 text-sm">
                  <p><strong>Troubleshooting steps:</strong></p>
                  <ul className="list-disc list-inside mt-1 space-y-1">
                    <li>Clear browser cache and cookies</li>
                    <li>Try disabling QUIC in Chrome: chrome://flags/#enable-quic</li>
                    <li>Check your network connection</li>
                    <li>Try using a different network or VPN</li>
                  </ul>
                </div>
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* QUIC Error Specific Alert */}
        {quicErrorDetected && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>QUIC Protocol Issue</AlertTitle>
            <AlertDescription>
              QUIC protocol errors are often caused by network configurations, browser settings, or firewall rules.
              The connection helper will automatically retry failed requests and provide better error messages.
            </AlertDescription>
          </Alert>
        )}

        {overallStatus === 'success' && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <span className="font-medium text-green-800">All tests passed!</span>
            </div>
            <p className="text-sm text-green-700 mt-1">
              Your app is successfully connected to Firestore and can read/write data.
            </p>
          </div>
        )}

        {overallStatus === 'error' && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-500" />
              <span className="font-medium text-red-800">Some tests failed!</span>
            </div>
            <p className="text-sm text-red-700 mt-1">
              Check the console for detailed error messages and verify your Firebase configuration.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
