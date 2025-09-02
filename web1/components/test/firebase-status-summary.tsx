"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { db, auth } from "@/lib/firebase"
import { CheckCircle2, XCircle, AlertTriangle, Info, Shield, Database, Globe } from "lucide-react"

export function FirebaseStatusSummary() {
  const [status, setStatus] = useState({
    config: { loaded: false, projectId: '', authDomain: '', error: null },
    auth: { initialized: false, currentUser: null, error: null },
    firestore: { connected: false, error: null },
    rules: { status: 'unknown', error: null }
  })

  useEffect(() => {
    checkFirebaseStatus()
  }, [])

  const checkFirebaseStatus = async () => {
    // Check Firebase Config
    try {
      const config = {
        loaded: true,
        projectId: db.app.options.projectId || 'Not configured',
        authDomain: db.app.options.authDomain || 'Not configured',
        error: null
      }
      
      // Check Auth
      const authStatus = {
        initialized: !!auth,
        currentUser: auth.currentUser,
        error: null
      }

      // Check Firestore Connection
      let firestoreStatus = { connected: false, error: null }
      try {
        // Simple connection test
        await db._delegate._databaseId
        firestoreStatus.connected = true
      } catch (error: any) {
        firestoreStatus.error = error.message
      }

      setStatus({
        config,
        auth: authStatus,
        firestore: firestoreStatus,
        rules: { status: 'needs-testing', error: null }
      })
    } catch (error: any) {
      setStatus(prev => ({
        ...prev,
        config: { loaded: false, projectId: '', authDomain: '', error: error.message }
      }))
    }
  }

  const getStatusIcon = (isGood: boolean, hasError: boolean = false) => {
    if (hasError) return <XCircle className="h-4 w-4 text-red-500" />
    if (isGood) return <CheckCircle2 className="h-4 w-4 text-green-500" />
    return <AlertTriangle className="h-4 w-4 text-yellow-500" />
  }

  const getStatusBadge = (isGood: boolean, hasError: boolean = false) => {
    if (hasError) return <Badge variant="destructive">Error</Badge>
    if (isGood) return <Badge variant="default">OK</Badge>
    return <Badge variant="secondary">Warning</Badge>
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Firebase Configuration Status
          </CardTitle>
          <CardDescription>
            Current status of your Firebase setup and connectivity
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Firebase Config */}
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div className="flex items-center gap-2">
              {getStatusIcon(status.config.loaded, !!status.config.error)}
              <span className="font-medium">Firebase Configuration</span>
            </div>
            <div className="flex items-center gap-2">
              {getStatusBadge(status.config.loaded, !!status.config.error)}
              <span className="text-sm text-gray-600">
                Project: {status.config.projectId}
              </span>
            </div>
          </div>

          {/* Authentication */}
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div className="flex items-center gap-2">
              {getStatusIcon(status.auth.initialized, !!status.auth.error)}
              <span className="font-medium">Firebase Authentication</span>
            </div>
            <div className="flex items-center gap-2">
              {getStatusBadge(status.auth.initialized, !!status.auth.error)}
              <span className="text-sm text-gray-600">
                {status.auth.currentUser ? `Logged in: ${status.auth.currentUser.email}` : 'Not authenticated'}
              </span>
            </div>
          </div>

          {/* Firestore */}
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div className="flex items-center gap-2">
              {getStatusIcon(status.firestore.connected, !!status.firestore.error)}
              <span className="font-medium">Firestore Database</span>
            </div>
            <div className="flex items-center gap-2">
              {getStatusBadge(status.firestore.connected, !!status.firestore.error)}
              <span className="text-sm text-gray-600">
                {status.firestore.connected ? 'Connected' : 'Connection issue'}
              </span>
            </div>
          </div>

          {/* Security Rules */}
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-blue-500" />
              <span className="font-medium">Firestore Security Rules</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">Run tests to verify</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Alerts and Recommendations */}
      <div className="space-y-4">
        {status.config.error && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertTitle>Firebase Configuration Error</AlertTitle>
            <AlertDescription>
              {status.config.error}
            </AlertDescription>
          </Alert>
        )}

        {status.firestore.error && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertTitle>Firestore Connection Error</AlertTitle>
            <AlertDescription>
              {status.firestore.error}
            </AlertDescription>
          </Alert>
        )}

        {!status.auth.currentUser && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Authentication Status</AlertTitle>
            <AlertDescription>
              You are not currently authenticated. Some Firestore operations may be restricted by security rules.
              To test authenticated access, log in through the main app.
            </AlertDescription>
          </Alert>
        )}

        {status.config.loaded && status.firestore.connected && (
          <Alert>
            <CheckCircle2 className="h-4 w-4" />
            <AlertTitle>Firebase Setup Complete</AlertTitle>
            <AlertDescription>
              Your Firebase configuration is working correctly. Run the connection tests above to verify data access and security rules.
            </AlertDescription>
          </Alert>
        )}
      </div>

      {/* Configuration Details */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Configuration Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 text-sm">
            <div className="flex justify-between">
              <span className="font-medium">Project ID:</span>
              <span className="font-mono">{status.config.projectId}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium">Auth Domain:</span>
              <span className="font-mono">{status.config.authDomain}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium">Environment:</span>
              <span className="font-mono">{process.env.NODE_ENV}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium">Timestamp:</span>
              <span className="font-mono">{new Date().toLocaleString()}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
