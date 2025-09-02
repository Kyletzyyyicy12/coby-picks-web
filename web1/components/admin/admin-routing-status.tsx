"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge" 
import { Button } from "@/components/ui/button"
import { getAdminStatus, getRouteForUser } from "@/lib/admin-routing"
import { CheckCircle, Shield, Route } from "lucide-react"

interface AdminRoutingStatusProps {
  userEmail: string
  userRole: string
}

export function AdminRoutingStatus({ userEmail, userRole }: AdminRoutingStatusProps) {
  const [showDetails, setShowDetails] = useState(false)
  
  const adminStatus = getAdminStatus(userEmail, userRole)
  const expectedRoute = getRouteForUser(userEmail, userRole)
  const currentPath = window.location.pathname

  const isOnCorrectRoute = currentPath === expectedRoute

  return (
    <Card className="mb-4 border-green-200 bg-green-50">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-green-800">
          <Shield className="h-5 w-5" />
          Admin Access Verified
          <Badge variant={isOnCorrectRoute ? "default" : "destructive"} className="ml-2">
            {isOnCorrectRoute ? "Correct Route" : "Route Mismatch"}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <span className="text-sm">
              <strong>Admin Email:</strong> {userEmail}
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <span className="text-sm">
              <strong>Admin Type:</strong> {adminStatus.adminType} 
              <Badge variant="outline" className="ml-2 text-xs">
                {adminStatus.displayName}
              </Badge>
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            <Route className="h-4 w-4 text-blue-600" />
            <span className="text-sm">
              <strong>Current Route:</strong> {currentPath}
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            <Route className="h-4 w-4 text-blue-600" />
            <span className="text-sm">
              <strong>Expected Route:</strong> {expectedRoute}
            </span>
          </div>
        </div>
        
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => setShowDetails(!showDetails)}
          className="mt-3 text-green-700 hover:text-green-800"
        >
          {showDetails ? "Hide Details" : "Show Details"}
        </Button>
        
        {showDetails && (
          <div className="mt-3 p-3 bg-white rounded border text-xs space-y-2">
            <div><strong>Description:</strong> {adminStatus.description}</div>
            <div><strong>Routing Logic:</strong> Admin email always routes to admin dashboard</div>
            <div><strong>Protection Status:</strong> Account is protected from deletion</div>
            <div><strong>Access Level:</strong> Full system administration access</div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}