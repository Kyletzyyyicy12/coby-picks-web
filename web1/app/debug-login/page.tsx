"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { auth, db } from "@/lib/firebase"
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, deleteUser } from "firebase/auth"
import { setDoc, doc, deleteDoc } from "firebase/firestore"
import { getRouteForUser, shouldHaveAdminAccess, getAdminStatus } from "@/lib/admin-routing"

export default function LoginDebugPage() {
  const [result, setResult] = useState("")
  const [loading, setLoading] = useState(false)

  const ADMIN_EMAIL = 'admin@cobypicks.com'
  const ADMIN_PASSWORD = 'AdminCobyPicks2024!'

  const log = (message: string) => {
    const timestamp = new Date().toLocaleTimeString()
    setResult(prev => `${prev}[${timestamp}] ${message}\n`)
    console.log(message)
  }

  const clearLogs = () => {
    setResult("")
  }

  const testFirebaseConnection = async () => {
    setLoading(true)
    try {
      log("🔧 Testing Firebase connection...")
      log(`📋 Auth domain: ${auth.app.options.authDomain}`)
      log(`📋 Project ID: ${auth.app.options.projectId}`)
      log(`📋 API Key: ${auth.app.options.apiKey?.substring(0, 10)}...`)
      log("✅ Firebase connection test passed")
    } catch (error: any) {
      log(`❌ Firebase connection failed: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const testAdminLogin = async () => {
    setLoading(true)
    try {
      log(`🔍 Testing admin login with: ${ADMIN_EMAIL}`)
      const userCredential = await signInWithEmailAndPassword(auth, ADMIN_EMAIL, ADMIN_PASSWORD)
      log(`✅ Login successful! User ID: ${userCredential.user.uid}`)
      log(`📧 Email verified: ${userCredential.user.emailVerified}`)
      log(`👤 Display name: ${userCredential.user.displayName}`)
    } catch (error: any) {
      log(`❌ Login failed: ${error.code} - ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const testCreateAdmin = async () => {
    setLoading(true)
    try {
      log(`🔨 Creating admin account: ${ADMIN_EMAIL}`)
      const userCredential = await createUserWithEmailAndPassword(auth, ADMIN_EMAIL, ADMIN_PASSWORD)
      const user = userCredential.user
      log(`✅ Account created! User ID: ${user.uid}`)

      // Create Firestore document
      await setDoc(doc(db, "users", user.uid), {
        email: user.email,
        displayName: "System Administrator",
        role: "admin",
        isHardcodedAdmin: true,
        createdAt: new Date(),
        lastActiveAt: new Date(),
        isActive: true,
        profileComplete: true,
        lastActiveDevice: "debug-test"
      })
      log(`✅ Firestore document created`)
    } catch (error: any) {
      log(`❌ Account creation failed: ${error.code} - ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const testAdminRouting = () => {
    log("🎯 Testing admin routing logic...");
    
    const testCases = [
      { email: ADMIN_EMAIL, role: undefined, expected: "/admin-dashboard" },
      { email: ADMIN_EMAIL, role: "admin", expected: "/admin-dashboard" },
      { email: ADMIN_EMAIL, role: "participant", expected: "/admin-dashboard" }, // Admin email overrides role
      { email: "teacher@example.com", role: "admin", expected: "/admin-dashboard" },
      { email: "organizer@example.com", role: "organizer", expected: "/organizer" },
      { email: "student@example.com", role: "participant", expected: "/participants" },
      { email: "user@example.com", role: undefined, expected: "/participants" }
    ];
    
    testCases.forEach(test => {
      const actualRoute = getRouteForUser(test.email, test.role);
      const hasAdminAccess = shouldHaveAdminAccess(test.email, test.role);
      const adminStatus = getAdminStatus(test.email, test.role);
      
      const isCorrect = actualRoute === test.expected;
      const status = isCorrect ? "✅" : "❌";
      
      log(`${status} ${test.email} (${test.role || 'no role'}) -> ${actualRoute} (expected: ${test.expected})`);
      log(`   Admin access: ${hasAdminAccess}, Status: ${adminStatus.adminType || 'none'}`);
    });
    
    log("🎯 Admin routing test completed!");
  };

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>🔧 Firebase Admin Login Debug Tool</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button onClick={testFirebaseConnection} disabled={loading} variant="outline">
              Test Firebase Connection
            </Button>
            <Button onClick={testAdminLogin} disabled={loading} variant="default">
              Test Admin Login
            </Button>
            <Button onClick={testCreateAdmin} disabled={loading} variant="secondary">
              Create Admin Account
            </Button>
            <Button onClick={testAdminRouting} disabled={loading} variant="outline">
              Test Admin Routing
            </Button>
            <Button onClick={clearLogs} disabled={loading} variant="ghost">
              Clear Logs
            </Button>
          </div>
          
          <div className="mt-4">
            <p className="text-sm font-medium mb-2">Expected Credentials:</p>
            <p className="text-xs bg-gray-100 p-2 rounded">
              Email: {ADMIN_EMAIL}<br/>
              Password: {ADMIN_PASSWORD}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>📋 Debug Logs</CardTitle>
        </CardHeader>
        <CardContent>
          <textarea
            value={result}
            readOnly
            className="w-full h-96 p-3 text-sm font-mono bg-gray-50 border rounded"
            placeholder="Debug logs will appear here..."
          />
        </CardContent>
      </Card>
    </div>
  )
}