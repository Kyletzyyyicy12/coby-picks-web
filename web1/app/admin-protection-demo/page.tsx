"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "@/hooks/use-toast"
import { 
  isProtectedAdmin, 
  canDeleteUser, 
  preserveAdminDuringClear,
  filterOutProtectedAdmins,
  logAdminProtection,
  safeDeleteCheck
} from "@/lib/admin-protection"
import { isHardcodedAdmin } from "@/lib/hardcoded-admin"
import { Shield, Lock, User, AlertTriangle, CheckCircle } from "lucide-react"

export default function AdminProtectionDemo() {
  const [testEmail, setTestEmail] = useState("")
  const [testUserId, setTestUserId] = useState("")
  const [protectionResults, setProtectionResults] = useState<any[]>([])

  const runProtectionTest = (email: string, uid?: string) => {
    const results = []

    // Test 1: Basic protection check
    const isProtected = isProtectedAdmin(email, uid)
    results.push({
      test: "Admin Protection Check",
      result: isProtected,
      message: isProtected ? "Account is protected" : "Account can be modified",
      type: isProtected ? "success" : "info"
    })

    // Test 2: Hardcoded admin check
    const isHardcoded = isHardcodedAdmin(email)
    results.push({
      test: "Hardcoded Admin Check",
      result: isHardcoded,
      message: isHardcoded ? "Hardcoded admin detected" : "Not a hardcoded admin",
      type: isHardcoded ? "success" : "info"
    })

    // Test 3: Deletion permission check
    const deleteCheck = canDeleteUser(email, uid)
    results.push({
      test: "Deletion Permission",
      result: deleteCheck.canDelete,
      message: deleteCheck.canDelete ? "Can be deleted" : deleteCheck.reason || "Cannot be deleted",
      type: deleteCheck.canDelete ? "warning" : "success"
    })

    // Test 4: Data clearing preservation
    const clearPreservation = preserveAdminDuringClear(email)
    results.push({
      test: "Data Clear Preservation",
      result: clearPreservation.shouldPreserve,
      message: clearPreservation.shouldPreserve ? clearPreservation.message || "Will be preserved" : "Standard data clearing",
      type: clearPreservation.shouldPreserve ? "success" : "info"
    })

    return results
  }

  const testProtection = () => {
    if (!testEmail) {
      toast({
        title: "Email Required",
        description: "Please enter an email to test",
        variant: "destructive"
      })
      return
    }

    const results = runProtectionTest(testEmail, testUserId || undefined)
    setProtectionResults(results)

    // Log the test for demonstration
    logAdminProtection('PROTECTION_TEST', testEmail, 'Admin protection demo test performed')
  }

  const testSafeDelete = () => {
    if (!testEmail) {
      toast({
        title: "Email Required", 
        description: "Please enter an email to test",
        variant: "destructive"
      })
      return
    }

    try {
      safeDeleteCheck(testEmail, testUserId || undefined)
      toast({
        title: "Safe to Delete",
        description: `Account ${testEmail} can be safely deleted`,
      })
    } catch (error: any) {
      toast({
        title: "Deletion Blocked",
        description: error.message,
        variant: "destructive"
      })
    }
  }

  const testBulkProtection = () => {
    const testUsers = [
      { email: "admin@cobypicks.com", name: "System Admin" },
      { email: "teacher@example.com", name: "Teacher User" },
      { email: "student@example.com", name: "Student User" },
      { email: "organizer@example.com", name: "Organizer User" }
    ]

    const safeToDelete = filterOutProtectedAdmins(testUsers)
    
    toast({
      title: "Bulk Protection Test",
      description: `${testUsers.length - safeToDelete.length} protected accounts filtered out of ${testUsers.length} total users`,
    })
  }

  const predefinedTests = [
    { email: "admin@cobypicks.com", description: "Protected Admin Account" },
    { email: "teacher@example.com", description: "Regular Teacher Account" },
    { email: "student@example.com", description: "Regular Student Account" }
  ]

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-blue-600" />
            Admin Protection System Demo
          </CardTitle>
          <p className="text-sm text-gray-600">
            Test the comprehensive admin account protection system that prevents accidental deletion of admin accounts.
          </p>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Test Input */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Protection Test
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="test-email">Email Address</Label>
              <Input
                id="test-email"
                type="email"
                placeholder="Enter email to test"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
              />
            </div>
            
            <div>
              <Label htmlFor="test-uid">User ID (Optional)</Label>
              <Input
                id="test-uid"
                placeholder="Enter user ID (optional)"
                value={testUserId}
                onChange={(e) => setTestUserId(e.target.value)}
              />
            </div>

            <div className="flex gap-2">
              <Button onClick={testProtection} className="flex-1">
                Test Protection
              </Button>
              <Button onClick={testSafeDelete} variant="outline">
                Test Delete Safety
              </Button>
            </div>

            <Button onClick={testBulkProtection} variant="secondary" className="w-full">
              Test Bulk Protection
            </Button>
          </CardContent>
        </Card>

        {/* Predefined Tests */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5" />
              Quick Tests
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {predefinedTests.map((test, index) => (
              <div key={index} className="flex items-center justify-between p-3 border rounded">
                <div>
                  <p className="font-medium">{test.email}</p>
                  <p className="text-sm text-gray-600">{test.description}</p>
                </div>
                <Button
                  size="sm"
                  onClick={() => {
                    setTestEmail(test.email)
                    setTestUserId("")
                    const results = runProtectionTest(test.email)
                    setProtectionResults(results)
                  }}
                >
                  Test
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Results */}
      {protectionResults.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Protection Test Results for: {testEmail}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {protectionResults.map((result, index) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded">
                  <div className="flex items-center gap-3">
                    {result.type === "success" && <Lock className="h-4 w-4 text-green-600" />}
                    {result.type === "warning" && <AlertTriangle className="h-4 w-4 text-orange-600" />}
                    {result.type === "info" && <CheckCircle className="h-4 w-4 text-blue-600" />}
                    
                    <div>
                      <p className="font-medium">{result.test}</p>
                      <p className="text-sm text-gray-600">{result.message}</p>
                    </div>
                  </div>
                  
                  <Badge 
                    variant={result.type === "success" ? "default" : result.type === "warning" ? "destructive" : "secondary"}
                  >
                    {result.result ? "Protected" : "Allowed"}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Protection Features */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>🛡️ Protection Features</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h4 className="font-semibold text-green-600">✅ Protected Actions</h4>
              <ul className="text-sm space-y-1">
                <li>• Admin account deletion prevention</li>
                <li>• Data clearing with admin preservation</li>
                <li>• Self-deletion protection</li>
                <li>• Firestore security rules enforcement</li>
                <li>• Bulk operation filtering</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h4 className="font-semibold text-blue-600">🔒 Protection Layers</h4>
              <ul className="text-sm space-y-1">
                <li>• Frontend validation</li>
                <li>• Backend protection functions</li>
                <li>• Firestore security rules</li>
                <li>• Audit logging</li>
                <li>• Multiple verification checks</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}