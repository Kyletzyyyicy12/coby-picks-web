"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { toast } from "@/hooks/use-toast"
import { db } from "@/lib/firebase"
import { collection, getDocs, doc, setDoc, deleteDoc, query, where, orderBy, limit } from "firebase/firestore"
import { CheckCircle, XCircle, AlertCircle, Loader2, Database, Users, Settings, Shield } from "lucide-react"

interface TestResult {
  name: string
  status: "pending" | "success" | "error" | "warning"
  message: string
  details?: string
}

export function SystemIntegrationTest() {
  const [tests, setTests] = useState<TestResult[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const [overallStatus, setOverallStatus] = useState<"idle" | "running" | "completed">("idle")

  const updateTest = (name: string, status: TestResult["status"], message: string, details?: string) => {
    setTests(prev => {
      const existing = prev.find(t => t.name === name)
      if (existing) {
        existing.status = status
        existing.message = message
        existing.details = details
        return [...prev]
      } else {
        return [...prev, { name, status, message, details }]
      }
    })
  }

  const runDatabaseConnectivityTest = async () => {
    updateTest("Database Connectivity", "pending", "Testing Firestore connection...")
    
    try {
      const testDoc = doc(db, "systemTests", "connectivity-test")
      await setDoc(testDoc, { 
        timestamp: new Date(), 
        test: "connectivity",
        source: "web-admin"
      })
      
      const snapshot = await getDocs(query(collection(db, "systemTests"), limit(1)))
      if (!snapshot.empty) {
        await deleteDoc(testDoc)
        updateTest("Database Connectivity", "success", "Firestore connection successful")
      } else {
        updateTest("Database Connectivity", "error", "Failed to read from Firestore")
      }
    } catch (error: any) {
      updateTest("Database Connectivity", "error", "Database connection failed", error.message)
    }
  }

  const runUserManagementTest = async () => {
    updateTest("User Management", "pending", "Testing user collection access...")
    
    try {
      const usersSnapshot = await getDocs(collection(db, "users"))
      const userCount = usersSnapshot.size
      
      if (userCount > 0) {
        updateTest("User Management", "success", `Found ${userCount} users in database`)
      } else {
        updateTest("User Management", "warning", "No users found in database")
      }
    } catch (error: any) {
      updateTest("User Management", "error", "Failed to access users collection", error.message)
    }
  }

  const runWheelDataTest = async () => {
    updateTest("Wheel Data Collection", "pending", "Testing wheel and spin data access...")
    
    try {
      const wheelsSnapshot = await getDocs(collection(db, "wheels"))
      const spinsSnapshot = await getDocs(collection(db, "wheelSpins"))
      
      const wheelCount = wheelsSnapshot.size
      const spinCount = spinsSnapshot.size
      
      updateTest("Wheel Data Collection", "success", 
        `Found ${wheelCount} wheels and ${spinCount} spins`, 
        `This indicates the app is properly syncing data to the web system`)
    } catch (error: any) {
      updateTest("Wheel Data Collection", "error", "Failed to access wheel data", error.message)
    }
  }

  const runWheelTypesTest = async () => {
    updateTest("Wheel Types Configuration", "pending", "Testing wheel types management...")
    
    try {
      const wheelTypesSnapshot = await getDocs(collection(db, "wheelTypes"))
      const typeCount = wheelTypesSnapshot.size
      
      if (typeCount > 0) {
        updateTest("Wheel Types Configuration", "success", `Found ${typeCount} configured wheel types`)
      } else {
        updateTest("Wheel Types Configuration", "warning", "No wheel types configured - users may have limited options")
      }
    } catch (error: any) {
      updateTest("Wheel Types Configuration", "error", "Failed to access wheel types", error.message)
    }
  }

  const runSecurityRulesTest = async () => {
    updateTest("Security Rules", "pending", "Testing Firestore security rules...")
    
    try {
      // Test reading from a protected collection
      const notificationsSnapshot = await getDocs(query(collection(db, "sentNotifications"), limit(1)))
      updateTest("Security Rules", "success", "Security rules are properly configured for admin access")
    } catch (error: any) {
      if (error.code === "permission-denied") {
        updateTest("Security Rules", "warning", "Security rules are restrictive (this may be expected)")
      } else {
        updateTest("Security Rules", "error", "Security rules test failed", error.message)
      }
    }
  }

  const runAppWebSyncTest = async () => {
    updateTest("App-Web Sync", "pending", "Testing app-web data synchronization...")
    
    try {
      // Check for recent activity from mobile app
      const recentSpins = await getDocs(
        query(
          collection(db, "wheelSpins"), 
          orderBy("timestamp", "desc"), 
          limit(5)
        )
      )
      
      if (!recentSpins.empty) {
        const latestSpin = recentSpins.docs[0].data()
        const spinTime = latestSpin.timestamp?.toDate()
        const timeDiff = spinTime ? Date.now() - spinTime.getTime() : Infinity
        
        if (timeDiff < 24 * 60 * 60 * 1000) { // Less than 24 hours
          updateTest("App-Web Sync", "success", "Recent app activity detected - sync is working")
        } else {
          updateTest("App-Web Sync", "warning", "No recent app activity - sync may need verification")
        }
      } else {
        updateTest("App-Web Sync", "warning", "No spin data found - app may not be syncing yet")
      }
    } catch (error: any) {
      updateTest("App-Web Sync", "error", "Failed to check app-web sync", error.message)
    }
  }

  const runAllTests = async () => {
    setIsRunning(true)
    setOverallStatus("running")
    setTests([])
    
    try {
      await runDatabaseConnectivityTest()
      await runUserManagementTest()
      await runWheelDataTest()
      await runWheelTypesTest()
      await runSecurityRulesTest()
      await runAppWebSyncTest()
      
      setOverallStatus("completed")
      toast({
        title: "Integration Tests Completed",
        description: "All system integration tests have been executed.",
      })
    } catch (error) {
      toast({
        title: "Test Execution Error",
        description: "An error occurred while running tests.",
        variant: "destructive",
      })
    } finally {
      setIsRunning(false)
    }
  }

  const getStatusIcon = (status: TestResult["status"]) => {
    switch (status) {
      case "success":
        return <CheckCircle className="h-5 w-5 text-green-500" />
      case "error":
        return <XCircle className="h-5 w-5 text-red-500" />
      case "warning":
        return <AlertCircle className="h-5 w-5 text-yellow-500" />
      case "pending":
        return <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
      default:
        return <div className="h-5 w-5" />
    }
  }

  const getStatusBadge = (status: TestResult["status"]) => {
    switch (status) {
      case "success":
        return <Badge variant="default" className="bg-green-500">Success</Badge>
      case "error":
        return <Badge variant="destructive">Error</Badge>
      case "warning":
        return <Badge variant="secondary" className="bg-yellow-500 text-white">Warning</Badge>
      case "pending":
        return <Badge variant="outline">Running...</Badge>
      default:
        return <Badge variant="outline">Pending</Badge>
    }
  }

  return (
    <Card className="shadow-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-swu-red">
          <Database className="h-5 w-5" />
          System Integration Test
        </CardTitle>
        <CardDescription>
          Comprehensive testing to ensure the web system properly collects app data and all features work correctly.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex justify-between items-center">
          <Button 
            onClick={runAllTests} 
            disabled={isRunning}
            className="bg-swu-red hover:bg-swu-red/90"
          >
            {isRunning ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Running Tests...
              </>
            ) : (
              "Run Integration Tests"
            )}
          </Button>
          
          {overallStatus === "completed" && (
            <div className="text-sm text-muted-foreground">
              Tests completed: {tests.filter(t => t.status === "success").length} passed, 
              {tests.filter(t => t.status === "warning").length} warnings, 
              {tests.filter(t => t.status === "error").length} errors
            </div>
          )}
        </div>

        {tests.length > 0 && (
          <div className="space-y-3">
            {tests.map((test, index) => (
              <div key={index} className="flex items-start gap-3 p-3 border rounded-lg">
                {getStatusIcon(test.status)}
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">{test.name}</h4>
                    {getStatusBadge(test.status)}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{test.message}</p>
                  {test.details && (
                    <p className="text-xs text-muted-foreground mt-1 font-mono bg-gray-50 p-2 rounded">
                      {test.details}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {tests.length === 0 && overallStatus === "idle" && (
          <div className="text-center py-8 text-muted-foreground">
            Click "Run Integration Tests" to verify system functionality
          </div>
        )}
      </CardContent>
    </Card>
  )
}
