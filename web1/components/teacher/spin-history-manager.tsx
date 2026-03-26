"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { toast } from "@/hooks/use-toast"
import { db } from "@/lib/firebase"
import { collection, getDocs, query, where, orderBy, deleteDoc, doc, addDoc } from "firebase/firestore"
import { 
  History, 
  Calendar, 
  Users, 
  Trophy, 
  Search, 
  Filter, 
  Download, 
  Trash2,
  Eye,
  RotateCcw
} from "lucide-react"
import type { User as FirebaseUser } from "firebase/auth"

interface SpinHistoryItem {
   id: string
   activityTitle: string
   winners: string[]
   participantCount: number
   participants?: string[]
   collaborators?: string[]
   timestamp: Date
   category: string
   numberOfWinners: number
   spinDuration: number
   isLiveSession?: boolean
   roomCode?: string
   sessionDuration?: number
   viewerCount?: number
   isParticipantHistory?: boolean
   participantRole?: string
   participantName?: string
}

interface SpinHistoryManagerProps {
  user: FirebaseUser
  onClose?: () => void
}

export function SpinHistoryManager({ user, onClose }: SpinHistoryManagerProps) {
  const [spinHistory, setSpinHistory] = useState<SpinHistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [sortBy, setSortBy] = useState("newest")
  const [selectedWheelName, setSelectedWheelName] = useState("all")
  const [showDetailsDialog, setShowDetailsDialog] = useState(false)
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<SpinHistoryItem | null>(null)

  const schoolColors = {
    primary: "#8e0b16",
    secondary: "#66181E",
    accent: "#ffffff"
  }

  useEffect(() => {
    fetchSpinHistory()

    // Listen for session ended events to refresh history immediately
    const handleSessionEnded = (event: CustomEvent) => {
      console.log('🔄 SpinHistoryManager: Session ended, refreshing history:', event.detail)
      // Small delay to ensure Firestore has processed the new history entry
      setTimeout(() => {
        fetchSpinHistory()
      }, 1000)
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('sessionEnded', handleSessionEnded as EventListener)

      return () => {
        window.removeEventListener('sessionEnded', handleSessionEnded as EventListener)
      }
    }
  }, [user])



  const fetchSpinHistory = async () => {
    try {
      // Fetch from both spinHistory and liveWheelHistory collections
      const [spinHistorySnapshot, liveHistorySnapshot] = await Promise.all([
        getDocs(query(
          collection(db, "spinHistory"),
          where("createdBy", "==", user.uid)
        )),
        getDocs(query(
          collection(db, "liveWheelHistory"),
          where("createdBy", "==", user.uid)
        ))
      ])
      
      // Process regular spin history
      const spinHistory = spinHistorySnapshot.docs.map(doc => {
        const data = doc.data()
        return {
          id: doc.id,
          ...data,
          timestamp: data.timestamp?.toDate() || new Date(),
          isLiveSession: data.isLiveSession || false,
          isParticipantHistory: data.isParticipantHistory || false
        }
      }) as (SpinHistoryItem & { isLiveSession: boolean; isParticipantHistory?: boolean })[]
      
      // Process live session history
      const liveHistory = liveHistorySnapshot.docs.map(doc => {
        const data = doc.data()

        // Extract participant names and separate collaborators
        const participants: string[] = []
        const collaborators: string[] = []

        if (data.participants && Array.isArray(data.participants)) {
          data.participants.forEach((participant: any) => {
            const name = participant.name || participant.displayName || participant.email || 'Unknown'
            if (participant.role === 'collaborator') {
              collaborators.push(name)
            } else {
              participants.push(name)
            }
          })
        }

        return {
          id: doc.id,
          activityTitle: data.title,
          winners: (data.winners || []).map((w: any) => w.name || w),
          participantCount: data.participants?.length || 0,
          participants: participants,
          collaborators: collaborators,
          timestamp: data.timestamp?.toDate() || data.endedAt?.toDate() || new Date(),
          category: data.selectedWheelType?.category || data.category || "personal",
          numberOfWinners: data.winners?.length || 0,
          spinDuration: data.sessionDuration || 0,
          isLiveSession: true,
          roomCode: data.roomCode,
          sessionDuration: Math.round(data.sessionDuration || 0),
          viewerCount: data.viewerCount || 0
        }
      }) as (SpinHistoryItem & { isLiveSession: boolean; roomCode?: string; sessionDuration?: number; viewerCount?: number; participants?: string[]; collaborators?: string[] })[]
      
      // Combine and sort all history
      const allHistory = [...spinHistory, ...liveHistory]
      allHistory.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      setSpinHistory(allHistory)

      console.log(`Fetched ${spinHistory.length} spin records and ${liveHistory.length} live session records for user ${user.uid}`)
    } catch (error) {
      console.error("Error fetching spin history:", error)

      // Check if it's a permission error
      if (error instanceof Error && error.message.includes("permission")) {
        console.error("🔐 Firestore permission error - user cannot read spin history collections")
        toast({
          title: "🔐 Permission Required",
          description: "Unable to access spin history due to permission settings. Please contact your administrator to configure Firestore security rules for user spin history access.",
          variant: "destructive"
        })
      } else if (error instanceof Error && error.message.includes("auth")) {
        console.error("🔐 Authentication error - user not properly authenticated")
        toast({
          title: "Authentication Required",
          description: "Please log in again to view your spin history.",
          variant: "destructive"
        })
      } else {
        toast({
          title: "Error Loading History",
          description: "Failed to load spin history. Please try again.",
          variant: "destructive"
        })
      }
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteSpin = async (spinId: string) => {
    if (!confirm("Are you sure you want to delete this spin record?")) return

    try {
      await deleteDoc(doc(db, "spinHistory", spinId))
      setSpinHistory(prev => prev.filter(item => item.id !== spinId))
      toast({
        title: "Deleted",
        description: "Spin record deleted successfully"
      })
    } catch (error) {
      console.error("Error deleting spin:", error)
      toast({
        title: "Error",
        description: "Failed to delete spin record",
        variant: "destructive"
      })
    }
  }

  const exportHistory = () => {
    const dataToExport = spinHistory

    const csvContent = [
      ["Activity", "Winners", "Participants", "Date", "Category", "Type"],
      ...dataToExport.map(item => [
        item.activityTitle,
        item.winners.join("; "),
        item.participantCount.toString(),
        item.timestamp.toLocaleDateString(),
        item.category,
        item.isLiveSession ? "Live Session" : "Regular Spin"
      ])
    ].map(row => row.join(",")).join("\n")

    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `spin-history-all-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)

    toast({
      title: "Exported",
      description: `${dataToExport.length} records exported successfully`
    })
  }

  const exportSingleHistory = (item: SpinHistoryItem) => {
    const csvContent = [
      ["Activity", "Winners", "Participants", "Date", "Time", "Category", "Type", "Room Code", "Duration", "Viewers"],
      [
        item.activityTitle,
        item.winners.join("; "),
        item.participantCount.toString(),
        item.timestamp.toLocaleDateString(),
        item.timestamp.toLocaleTimeString(),
        item.category,
        item.isLiveSession ? "Live Session" : "Regular Spin",
        item.roomCode || "N/A",
        item.sessionDuration ? `${Math.floor(item.sessionDuration / 60)}m ${item.sessionDuration % 60}s` : "N/A",
        item.viewerCount?.toString() || "N/A"
      ]
    ].map(row => row.join(",")).join("\n")

    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    const cleanTitle = item.activityTitle.replace(/[^a-z0-9]/gi, '-').toLowerCase()
    a.download = `spin-${cleanTitle}-${item.timestamp.toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)

    toast({
      title: "Exported",
      description: `${item.activityTitle} exported successfully`
    })
  }

  const handleViewDetails = (item: SpinHistoryItem) => {
    setSelectedHistoryItem(item)
    setShowDetailsDialog(true)
  }



  const filteredHistory = spinHistory.filter(item => {
    const matchesSearch = item.activityTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.winners.some(winner => winner.toLowerCase().includes(searchTerm.toLowerCase()))
    const matchesCategory = categoryFilter === "all" || 
                           item.category?.toLowerCase() === categoryFilter.toLowerCase() ||
                           (!item.category && categoryFilter === "personal")
    const matchesWheelName = selectedWheelName === "all" || 
                            item.activityTitle.toLowerCase().includes(selectedWheelName.toLowerCase())
    return matchesSearch && matchesCategory && matchesWheelName
  }).sort((a, b) => {
    switch (sortBy) {
      case "newest":
        return b.timestamp.getTime() - a.timestamp.getTime()
      case "oldest":
        return a.timestamp.getTime() - b.timestamp.getTime()
      case "activity":
        return a.activityTitle.localeCompare(b.activityTitle)
      case "participants":
        return b.participantCount - a.participantCount
      default:
        return 0
    }
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto mb-4" style={{ borderColor: schoolColors.primary }}></div>
          <p>Loading spin history...</p>
        </div>
      </div>
    )
  }

  // Get unique wheel names for the filter dropdown
  const uniqueWheelNames = Array.from(new Set(spinHistory.map(item => {
    let cleanTitle = item.activityTitle.replace(/ for \w+( \w+)?$/i, '').trim()
    cleanTitle = cleanTitle.replace(/\s*Activity\s+Activity\s*/gi, ' Activity ').trim()
    cleanTitle = cleanTitle.replace(/\s*Activity\s*$/i, '').trim() || 'Unnamed Activity'
    return cleanTitle
  }))).sort()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: schoolColors.primary }}>
            📊 Spin History
          </h2>
          <p className="text-muted-foreground">
            View and manage your wheel spin history
          </p>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <Button onClick={exportHistory} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          {onClose && (
            <Button onClick={onClose} variant="outline">
              Close
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Search</label>
              <div className="relative">
                <Search className="h-4 w-4 absolute left-3 top-3 text-muted-foreground" />
                <Input
                  placeholder="Search activities or winners..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Wheel Name</label>
              <Select value={selectedWheelName} onValueChange={setSelectedWheelName}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Wheels</SelectItem>
                  {uniqueWheelNames.map((wheelName) => (
                    <SelectItem key={wheelName} value={wheelName}>
                      {wheelName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Category</label>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="academic">📚 Academic</SelectItem>
                  <SelectItem value="research">🔬 Research</SelectItem>
                  <SelectItem value="entertainment">🎮 Entertainment</SelectItem>
                  <SelectItem value="personal">👤 Personal</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Sort By</label>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest First</SelectItem>
                  <SelectItem value="oldest">Oldest First</SelectItem>
                  <SelectItem value="activity">Activity Name</SelectItem>
                  <SelectItem value="participants">Participant Count</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button 
                onClick={() => {
                  setSearchTerm("")
                  setCategoryFilter("all")
                  setSelectedWheelName("all")
                  setSortBy("newest")
                }}
                variant="outline"
                className="w-full"
              >
                <Filter className="h-4 w-4 mr-2" />
                Clear Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* History List */}
      {filteredHistory.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <History className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No Spin History</h3>
            <p className="text-muted-foreground mb-4">
              {spinHistory.length === 0
                ? "You haven't created any spins yet. Start by creating wheel activities or joining live sessions!"
                : "No spins match your current filters"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredHistory.map((item) => (
            <Card key={item.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-lg">
                        {(() => {
                          let cleanTitle = item.activityTitle.replace(/ for \w+( \w+)?$/i, '').trim();
                          // Remove duplicate "Activity Activity" patterns
                          cleanTitle = cleanTitle.replace(/\s*Activity\s+Activity\s*/gi, ' Activity ').trim();
                          // Ensure it doesn't end with extra "Activity" if it's a generic prefix
                          cleanTitle = cleanTitle.replace(/\s*Activity\s*$/i, '').trim() || 'Unnamed Activity';
                          return cleanTitle;
                        })()}
                      </h3>
                      <Badge variant="outline">{item.category}</Badge>
                      {/* Live Session Indicator */}
                      {item.isLiveSession && (
                        <Badge className="bg-red-100 border-red-500 text-red-600">
                          🔴 Live Session
                        </Badge>
                      )}
                      {/* Participant History Indicator */}
                      {item.isParticipantHistory && (
                        <Badge className="bg-blue-100 border-blue-500 text-blue-600">
                          👥 Participated
                        </Badge>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-muted-foreground mb-3">
                      <div className="flex items-center gap-1">
                        <Trophy className="h-4 w-4" />
                        <span>{item.winners.length} winner(s)</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Users className="h-4 w-4" />
                        <span>{item.participantCount} participants</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        <span>{item.timestamp.toLocaleDateString()}</span>
                      </div>
                    </div>

                    {/* Additional Live Session Info */}
                    {item.isLiveSession && (
                      <div className="bg-red-50 border border-red-200 rounded p-3 mb-3">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-red-700">
                          {item.roomCode && (
                            <div className="flex items-center gap-2">
                              <span className="font-semibold">🏠 Room Code:</span>
                              <code className="bg-white px-2 py-1 rounded font-mono">{item.roomCode}</code>
                            </div>
                          )}
                          {item.sessionDuration && (
                            <div className="flex items-center gap-1">
                              <span className="font-semibold">⏱️ Duration:</span>
                              <span>{Math.floor(item.sessionDuration / 60)}m {item.sessionDuration % 60}s</span>
                            </div>
                          )}
                          {typeof item.viewerCount !== 'undefined' && (
                            <div className="flex items-center gap-1">
                              <span className="font-semibold">👥 Peak Viewers:</span>
                              <span>{item.viewerCount}</span>
                            </div>
                          )}
                        </div>
                        {/* Participant History Info */}
                        {item.isParticipantHistory && (
                          <div className="mt-2 pt-2 border-t border-red-300">
                            <div className="text-sm text-red-600">
                              {item.participantRole === 'collaborator' && (
                                <span className="font-semibold">🤝 You participated as a collaborator in this session</span>
                              )}
                              {(!item.participantRole || item.participantRole === 'participant') && (
                                <span className="font-semibold">👥 You participated in this live session</span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="mb-3">
                      <p className="text-sm font-medium mb-1">Winners:</p>
                      <div className="flex flex-wrap gap-1">
                        {item.winners.map((winner, index) => (
                          <Badge key={index} style={{ backgroundColor: schoolColors.primary, color: "white" }}>
                            {winner}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 ml-4">
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => exportSingleHistory(item)}
                      title="Export this spin"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleViewDetails(item)}
                      title="View details"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="outline" title="Re-spin">
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => handleDeleteSpin(item.id)}
                      className="text-red-600 hover:text-red-700"
                      title="Delete this spin"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Spin Details</DialogTitle>
            <DialogDescription>
              Complete information about this spin session
            </DialogDescription>
          </DialogHeader>

          {selectedHistoryItem && (
            <div className="space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-semibold mb-2">Activity</h4>
                  <p className="text-lg">{selectedHistoryItem.activityTitle}</p>
                  <Badge variant="outline" className="mt-1">{selectedHistoryItem.category}</Badge>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Date & Time</h4>
                  <p>{selectedHistoryItem.timestamp.toLocaleDateString()}</p>
                  <p className="text-sm text-muted-foreground">{selectedHistoryItem.timestamp.toLocaleTimeString()}</p>
                </div>
              </div>

              {/* Winners Section */}
              <div>
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <Trophy className="h-5 w-5" />
                  Winners ({selectedHistoryItem.winners.length})
                </h4>
                <div className="flex flex-wrap gap-2">
                  {selectedHistoryItem.winners.map((winner, index) => (
                    <Badge
                      key={index}
                      style={{ backgroundColor: schoolColors.primary, color: "white" }}
                      className="text-sm px-3 py-1"
                    >
                      {winner}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Participants Section */}
              {selectedHistoryItem.isLiveSession && (
                <div className="space-y-4">
                  {/* Collaborators */}
                  {selectedHistoryItem.collaborators && selectedHistoryItem.collaborators.length > 0 && (
                    <div>
                      <h4 className="font-semibold mb-3 flex items-center gap-2">
                        🤝 Collaborators ({selectedHistoryItem.collaborators.length})
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {selectedHistoryItem.collaborators.map((collaborator, index) => (
                          <Badge
                            key={index}
                            variant="secondary"
                            className="text-sm px-3 py-1 bg-blue-100 text-blue-800"
                          >
                            {collaborator}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Regular Participants */}
                  {selectedHistoryItem.participants && selectedHistoryItem.participants.length > 0 && (
                    <div>
                      <h4 className="font-semibold mb-3 flex items-center gap-2">
                        <Users className="h-5 w-5" />
                        Participants ({selectedHistoryItem.participants.length})
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {selectedHistoryItem.participants.map((participant, index) => (
                          <Badge
                            key={index}
                            variant="outline"
                            className="text-sm px-3 py-1"
                          >
                            {participant}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Fallback for when no specific names are available */}
                  {(!selectedHistoryItem.participants || selectedHistoryItem.participants.length === 0) &&
                   (!selectedHistoryItem.collaborators || selectedHistoryItem.collaborators.length === 0) && (
                    <div>
                      <h4 className="font-semibold mb-3 flex items-center gap-2">
                        <Users className="h-5 w-5" />
                        Participants ({selectedHistoryItem.participantCount})
                      </h4>
                      <p className="text-muted-foreground">
                        {selectedHistoryItem.participantCount > 0
                          ? `${selectedHistoryItem.participantCount} participants joined this session`
                          : "No participants recorded for this session"
                        }
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* For non-live sessions */}
              {!selectedHistoryItem.isLiveSession && (
                <div>
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Participants ({selectedHistoryItem.participantCount})
                  </h4>
                  <p className="text-muted-foreground">
                    {selectedHistoryItem.participantCount > 0
                      ? `${selectedHistoryItem.participantCount} participants joined this session`
                      : "No participants recorded for this session"
                    }
                  </p>
                </div>
              )}

              {/* Live Session Info */}
              {selectedHistoryItem.isLiveSession && (
                <div className="bg-red-50 border border-red-200 rounded p-4">
                  <h4 className="font-semibold mb-3 text-red-700">Live Session Information</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    {selectedHistoryItem.roomCode && (
                      <div>
                        <span className="font-medium">Room Code:</span>
                        <code className="ml-2 bg-white px-2 py-1 rounded font-mono">{selectedHistoryItem.roomCode}</code>
                      </div>
                    )}
                    {selectedHistoryItem.sessionDuration && (
                      <div>
                        <span className="font-medium">Duration:</span>
                        <span className="ml-2">{Math.floor(selectedHistoryItem.sessionDuration / 60)}m {selectedHistoryItem.sessionDuration % 60}s</span>
                      </div>
                    )}
                    {typeof selectedHistoryItem.viewerCount !== 'undefined' && (
                      <div>
                        <span className="font-medium">Peak Viewers:</span>
                        <span className="ml-2">{selectedHistoryItem.viewerCount}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Additional Info */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="font-medium">Type:</span>
                  <span className="ml-2">{selectedHistoryItem.isLiveSession ? "Live Session" : "Regular Spin"}</span>
                </div>
                <div>
                  <span className="font-medium">Number of Winners:</span>
                  <span className="ml-2">{selectedHistoryItem.numberOfWinners}</span>
                </div>
                <div>
                  <span className="font-medium">Spin Duration:</span>
                  <span className="ml-2">{selectedHistoryItem.spinDuration}s</span>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetailsDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  )
}
