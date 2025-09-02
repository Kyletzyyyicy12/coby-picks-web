"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { db } from "@/lib/firebase"
import { collection, getDocs, query, limit, orderBy } from "firebase/firestore"
import { RefreshCw, Database, Users, Settings, Activity } from "lucide-react"

interface CollectionData {
  name: string
  count: number
  sampleDocs: any[]
  error?: string
}

export function FirestoreDataViewer() {
  const [collections, setCollections] = useState<CollectionData[]>([])
  const [loading, setLoading] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const collectionsToCheck = [
    'users',
    'wheels', 
    'announcements',
    'liveDrawSessions',
    'drawActivities',
    'wheelTypes',
    'participantLists',
    'systemSettings',
    'connectionTest'
  ]

  const fetchCollectionData = async () => {
    setLoading(true)
    const results: CollectionData[] = []

    for (const collectionName of collectionsToCheck) {
      try {
        console.log(`📊 Checking collection: ${collectionName}`)
        
        // Get total count
        const collRef = collection(db, collectionName)
        const snapshot = await getDocs(collRef)
        
        // Get sample documents (first 3)
        const sampleQuery = query(collRef, limit(3))
        const sampleSnapshot = await getDocs(sampleQuery)
        const sampleDocs = sampleSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }))

        results.push({
          name: collectionName,
          count: snapshot.size,
          sampleDocs: sampleDocs
        })

        console.log(`✅ ${collectionName}: ${snapshot.size} documents`)
      } catch (error: any) {
        console.error(`❌ Error checking ${collectionName}:`, error)
        results.push({
          name: collectionName,
          count: 0,
          sampleDocs: [],
          error: error.message
        })
      }
    }

    setCollections(results)
    setLastUpdated(new Date())
    setLoading(false)
  }

  useEffect(() => {
    fetchCollectionData()
  }, [])

  const getCollectionIcon = (name: string) => {
    switch (name) {
      case 'users':
        return <Users className="h-4 w-4" />
      case 'wheels':
      case 'wheelTypes':
        return <Settings className="h-4 w-4" />
      case 'liveDrawSessions':
      case 'drawActivities':
        return <Activity className="h-4 w-4" />
      default:
        return <Database className="h-4 w-4" />
    }
  }

  const formatTimestamp = (timestamp: any) => {
    if (!timestamp) return 'N/A'
    
    try {
      if (timestamp.toDate) {
        return timestamp.toDate().toLocaleString()
      } else if (timestamp instanceof Date) {
        return timestamp.toLocaleString()
      } else {
        return new Date(timestamp).toLocaleString()
      }
    } catch {
      return 'Invalid date'
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Firestore Data Overview
          </CardTitle>
          <CardDescription>
            Current data in your Firestore collections
            {lastUpdated && (
              <span className="block text-xs text-gray-500 mt-1">
                Last updated: {lastUpdated.toLocaleString()}
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button 
            onClick={fetchCollectionData} 
            disabled={loading}
            className="mb-4"
          >
            {loading ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Refreshing...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh Data
              </>
            )}
          </Button>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {collections.map((collection) => (
              <Card key={collection.name} className={collection.error ? 'border-red-200' : 'border-gray-200'}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    {getCollectionIcon(collection.name)}
                    {collection.name}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  {collection.error ? (
                    <div className="space-y-2">
                      <Badge variant="destructive">Error</Badge>
                      <p className="text-xs text-red-600">{collection.error}</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge variant={collection.count > 0 ? 'default' : 'secondary'}>
                          {collection.count} documents
                        </Badge>
                      </div>
                      
                      {collection.sampleDocs.length > 0 && (
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-gray-600">Sample documents:</p>
                          {collection.sampleDocs.map((doc, index) => (
                            <div key={index} className="text-xs bg-gray-50 p-2 rounded">
                              <div className="font-mono text-blue-600">ID: {doc.id}</div>
                              {doc.email && <div>Email: {doc.email}</div>}
                              {doc.role && <div>Role: {doc.role}</div>}
                              {doc.name && <div>Name: {doc.name}</div>}
                              {doc.title && <div>Title: {doc.title}</div>}
                              {doc.wheelType && <div>Type: {doc.wheelType}</div>}
                              {doc.createdAt && <div>Created: {formatTimestamp(doc.createdAt)}</div>}
                              {doc.timestamp && <div>Time: {formatTimestamp(doc.timestamp)}</div>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
