"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { toast } from "@/hooks/use-toast"
import { db } from "@/lib/firebase"
import { collection, onSnapshot, query, where, orderBy, doc, updateDoc, serverTimestamp } from "firebase/firestore"
import { CheckCircle, XCircle, Clock, MessageSquare, Users, Settings, Bell, AlertCircle } from "lucide-react"
import { ParticipantRequest } from "@/types/participant-requests"

interface OrganizerRequestManagerProps {
  sessionId: string
  organizerId: string
  onWheelTypeChange?: (wheelType: any) => void
  onTopicSuggestion?: (topic: string) => void
}

export function OrganizerRequestManager({
  sessionId,
  organizerId,
  onWheelTypeChange,
  onTopicSuggestion
}: OrganizerRequestManagerProps) {
  const [requests, setRequests] = useState<ParticipantRequest[]>([])
  const [selectedRequest, setSelectedRequest] = useState<ParticipantRequest | null>(null)
  const [responseMessage, setResponseMessage] = useState('')
  const [isResponding, setIsResponding] = useState(false)
  const [showResponseDialog, setShowResponseDialog] = useState(false)
  const [showNewRequestPopup, setShowNewRequestPopup] = useState(false)
  const [newRequestData, setNewRequestData] = useState<ParticipantRequest | null>(null)

  // Listen to requests in real-time
  useEffect(() => {
    if (!sessionId) return

    const requestsQuery = query(
      collection(db, "participantRequests"),
      where("sessionId", "==", sessionId),
      orderBy("createdAt", "desc")
    )

    const unsubscribe = onSnapshot(requestsQuery, (snapshot) => {
      const requestsData: ParticipantRequest[] = []
      snapshot.forEach((doc) => {
        const data = doc.data()
        requestsData.push({
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
          respondedAt: data.respondedAt?.toDate()
        } as ParticipantRequest)
      })
      setRequests(requestsData)

      // Show toast for new pending requests
      const newPendingRequests = requestsData.filter(
        req => req.status === 'pending' && 
        Date.now() - req.createdAt.getTime() < 5000 // Within last 5 seconds
      )

      newPendingRequests.forEach(req => {
        // Show prominent popup notification
        setNewRequestData(req)
        setShowNewRequestPopup(true)
        
        // Play notification sound (if supported)
        try {
          const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+jxr2EbBz2W3/LGeSwGKHfH8N+PQAkVYLXn6qhTFApCnOLyu2IaBzyR1/LNeSsFJHfH8N+PQAkVYLXo66hSFApAmOL0rmEbBz2W3/LGeSwGKHfH8N+PQAkUYLXn66hTFApAmeLyr2EbBz2W3/LHeiwGKHfH8N+PQAkUYLPo66hSFApAmePzr2EaBz2Y3/LHeSsGKHfH8N+PQAkUYLPp6ahSFAlAmeSzr2IbBz2Y3/LHeSsGKHfH8N+PQAkUYLPp6KhSFAlAmeSzr2IbBz2Y3/LHeSsGKHfH8N+PQAkUYLPp6KhSFAlAmeSzr2IbBz2Y3/LHeSsGKHfH8N+PQAkUYLPp6KhSFAlAmeSzr2IbBz2Y3/LHeSsGKHfH8N+PQAkUYLPp6KhSFAlAmeSzr2IbBz2Y3/LHeSsGKHfH8N+PQAkUYLPp6KhSFAlAmeSzr2IbBz2Y3/LHeSsGKHfH8N+PQAkUYLPp6KhSFAlAmeSzr2IbBz2Y3/LHeSsGKHfH8N+PQAkUYLPp6KhSFAlAmeSzr2IbBz2Y3/LHeSsGKHfH8N+PQAkUYLPp6KhSFAlAmeSzr2IbBz2Y3/LHeSsGKHfH8N+PQAkUYLPp6KhSFAlAmeSzr2IbBz2Y3/LHeSsGKHfH8N+PQAkUYLPp6KhSFAlAmeSzr2IbBz2Y3/LHeSsGKHfH8N+PQAkUYLPp6KhSFAlAmeSzr2IbBz2Y3/LHeSsGKHfH8N+PQAkUYLPp6KhSFAlAmeSzr2IbBz2Y3/LHeSsGKHfH8N+PQAkUYLPp6KhSFAlAmeSzr2IbBz2Y3/LHeSsGKHfH8N+PQAkUYLPp6KhSFAlAmeSzr2IbBz2Y3/LHeSsGKHfH8N+PQAkUYLPp6KhSFAlAmeSzr2IbBz2Y3/LHeSsGKHfH8N+PQAkUYLPp6KhSFAlAmeSzr2IbBz2Y3/LHeSsGKHfH8N+PQAkUYLPp6KhSFAlAmeSzr2IbBz2Y3/LHeSsGKHfH8N+PQAkUYLPp6KhSFAlAmeSzr2IbBz2Y3/LHeSsGKHfH8N+PQAkUYLPp6KhSFAlAmeSzr2IbBz2Y3/LHeSsGKHfH8N+PQAkUYLPp6KhSFAlAmeSzr2IbBz2Y3/LHeSsGKHfH8N+PQAkUYLPp6KhSFAlAmeSzr2IbBz2Y3/LHeSsGKHfH8N+PQAkUYLPp6KhSFAlAmeSzr2IbBz2Y3/LHeSsGKHfH8N+PQAkUYLPp6KhSFAlAmeSzr2IbBz2Y3/LHeSsGKHfH8N+PQAkUYLPp6KhSFAlAmeSzr2IbBz2Y3/LHeSsGKHfH8N+PQAkUYLPp6KhSFAlAmeSzr2IbBz2Y3/LHeSsGKHfH8N+PQAkUYLPp6KhSFAlAmeSzr2IbBz2Y3/LHeSsGKHfH8N+PQAkUYLPp6KhSFApAmeSzr2IbBz2Y3/LHeSsGKHfH8N+PQAkUYLPp6KhSFApAmuSzr2IbBz2Y3/LHeSsGKHfH8N+PQAkUYLPp6KhSFApAmua0r2IbBz2Y3/LHeSsGKHfH8N+PQAkUYLPp6KhSFApAk+a1r2IbBz2Y3/LHeSsGKHfH8N+PQAkUYLPp6KhSFApAk+O4') // Simple notification beep
          audio.volume = 0.3
          audio.play().catch(() => {})
        } catch (e) {
          // Sound not supported, continue without error
        }
        
        // Also show toast for backup
        toast({
          title: "🔔 New Request!",
          description: `${req.participantName} requested ${req.requestType === 'wheel_type_change' ? 'wheel type change' : 'topic suggestion'}`,
          duration: 8000, // Longer duration for important notifications
        })
      })
    })

    return () => unsubscribe()
  }, [sessionId])

  const handleRequestResponse = async (request: ParticipantRequest, status: 'approved' | 'denied') => {
    setIsResponding(true)

    try {
      // Update request status
      await updateDoc(doc(db, "participantRequests", request.id), {
        status,
        respondedAt: serverTimestamp(),
        respondedBy: organizerId,
        organizerResponse: responseMessage.trim() || undefined
      })

      // If approved and it's a wheel type change, trigger the change
      if (status === 'approved') {
        if (request.requestType === 'wheel_type_change' && request.requestedWheelType) {
          onWheelTypeChange?.(request.requestedWheelType)
          toast({
            title: "✅ Request Approved & Applied!",
            description: `Wheel type changed to ${request.requestedWheelType.title}`
          })
        } else if (request.requestType === 'topic_suggestion' && request.topicSuggestion) {
          onTopicSuggestion?.(request.topicSuggestion)
          toast({
            title: "✅ Topic Suggestion Approved!",
            description: `Topic suggestion noted: ${request.topicSuggestion}`
          })
        }
      } else {
        toast({
          title: "❌ Request Denied",
          description: `Request from ${request.participantName} has been denied`
        })
      }

      setShowResponseDialog(false)
      setSelectedRequest(null)
      setResponseMessage('')

    } catch (error) {
      console.error("Error responding to request:", error)
      toast({
        title: "Error",
        description: "Failed to respond to request. Please try again.",
        variant: "destructive"
      })
    } finally {
      setIsResponding(false)
    }
  }

  const openResponseDialog = (request: ParticipantRequest) => {
    setSelectedRequest(request)
    setResponseMessage('')
    setShowResponseDialog(true)
  }

  const pendingRequests = requests.filter(req => req.status === 'pending')
  const respondedRequests = requests.filter(req => req.status !== 'pending')

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />
      case 'approved':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'denied':
        return <XCircle className="h-4 w-4 text-red-500" />
      default:
        return <Clock className="h-4 w-4 text-gray-500" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'approved':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'denied':
        return 'bg-red-100 text-red-800 border-red-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  return (
    <div className="space-y-6">
      {/* Pending Requests */}
      {pendingRequests.length > 0 && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-yellow-800">
              <MessageSquare className="h-5 w-5" />
              Pending Requests
              <Badge className="bg-yellow-200 text-yellow-800">
                {pendingRequests.length}
              </Badge>
            </CardTitle>
            <CardDescription>
              Participants have submitted requests that need your attention
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {pendingRequests.map((request) => (
                <div key={request.id} className="border border-yellow-200 rounded-lg p-4 bg-white">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-blue-500" />
                        <span className="font-medium">{request.participantName}</span>
                        <Badge variant="outline">
                          {request.requestType === 'wheel_type_change' ? 'Wheel Change' : 'Topic Suggestion'}
                        </Badge>
                      </div>

                      {request.requestType === 'wheel_type_change' && request.requestedWheelType && (
                        <div className="ml-6">
                          <div className="flex items-center gap-2 text-sm">
                            <Settings className="h-4 w-4" />
                            <span>Wants to change to:</span>
                            <Badge className="bg-blue-100 text-blue-800">
                              {request.requestedWheelType.icon} {request.requestedWheelType.title}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground ml-6 mt-1">
                            {request.requestedWheelType.description}
                          </p>
                        </div>
                      )}

                      {request.requestType === 'topic_suggestion' && (
                        <div className="ml-6">
                          <div className="text-sm">
                            <strong>Suggested Topic:</strong> {request.topicSuggestion}
                          </div>
                        </div>
                      )}

                      {request.message && (
                        <div className="ml-6 text-sm text-muted-foreground">
                          <strong>Message:</strong> {request.message}
                        </div>
                      )}

                      <div className="ml-6 text-xs text-muted-foreground">
                        Requested {request.createdAt.toLocaleString()}
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 ml-4">
                      <Button
                        size="sm"
                        className="bg-green-600 hover:bg-green-700"
                        onClick={() => {
                          if (request.requestType === 'wheel_type_change') {
                            openResponseDialog(request)
                          } else {
                            handleRequestResponse(request, 'approved')
                          }
                        }}
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => openResponseDialog(request)}
                      >
                        <XCircle className="h-4 w-4 mr-1" />
                        Deny
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Request History */}
      {respondedRequests.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Request History
            </CardTitle>
            <CardDescription>
              Previously responded to participant requests
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {respondedRequests.map((request) => (
                <div key={request.id} className={`border rounded-lg p-3 ${getStatusColor(request.status)}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(request.status)}
                      <span className="font-medium">{request.participantName}</span>
                      <Badge variant="outline">
                        {request.requestType === 'wheel_type_change' ? 'Wheel Change' : 'Topic'}
                      </Badge>
                    </div>
                    <span className="text-xs">
                      {request.respondedAt?.toLocaleString()}
                    </span>
                  </div>

                  {request.requestType === 'wheel_type_change' && request.requestedWheelType && (
                    <div className="text-sm mt-1">
                      Requested: {request.requestedWheelType.icon} {request.requestedWheelType.title}
                    </div>
                  )}

                  {request.requestType === 'topic_suggestion' && (
                    <div className="text-sm mt-1">
                      Suggested: {request.topicSuggestion}
                    </div>
                  )}

                  {request.organizerResponse && (
                    <div className="text-sm mt-2 p-2 bg-white/50 rounded">
                      <strong>Your response:</strong> {request.organizerResponse}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Response Dialog */}
      <Dialog open={showResponseDialog} onOpenChange={setShowResponseDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Respond to {selectedRequest?.participantName}'s Request
            </DialogTitle>
            <DialogDescription>
              {selectedRequest?.requestType === 'wheel_type_change' 
                ? `They want to change the wheel to: ${selectedRequest?.requestedWheelType?.title}`
                : `Topic suggestion: ${selectedRequest?.topicSuggestion}`
              }
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Response Message (Optional)</Label>
              <Textarea
                value={responseMessage}
                onChange={(e) => setResponseMessage(e.target.value)}
                placeholder="Add a message to explain your decision..."
                rows={3}
              />
            </div>

            <div className="flex gap-2">
              <Button
                className="flex-1 bg-green-600 hover:bg-green-700"
                onClick={() => selectedRequest && handleRequestResponse(selectedRequest, 'approved')}
                disabled={isResponding}
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Approve & Apply
              </Button>
              <Button
                className="flex-1"
                variant="destructive"
                onClick={() => selectedRequest && handleRequestResponse(selectedRequest, 'denied')}
                disabled={isResponding}
              >
                <XCircle className="h-4 w-4 mr-2" />
                Deny Request
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* No Requests State */}
      {requests.length === 0 && (
        <Card>
          <CardContent className="text-center py-8">
            <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-muted-foreground mb-2">
              No Participant Requests Yet
            </h3>
            <p className="text-muted-foreground">
              Participants can request wheel type changes and suggest topics during the live session.
            </p>
          </CardContent>
        </Card>
      )}

      {/* New Request Popup Notification */}
      <Dialog open={showNewRequestPopup} onOpenChange={setShowNewRequestPopup}>
        <DialogContent className="max-w-md border-2 border-yellow-400 bg-gradient-to-br from-yellow-50 to-orange-50">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-yellow-800">
              <div className="relative">
                <Bell className="h-6 w-6 text-yellow-600" />
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
              </div>
              🔔 New Participant Request!
            </DialogTitle>
            <DialogDescription className="text-yellow-700">
              A participant has submitted a new request that needs your attention.
            </DialogDescription>
          </DialogHeader>
          
          {newRequestData && (
            <div className="space-y-4">
              {/* Request Details */}
              <div className="bg-white p-4 rounded-lg border border-yellow-200 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <Users className="h-5 w-5 text-blue-500" />
                  <span className="font-semibold text-lg">{newRequestData.participantName}</span>
                  <Badge className="bg-yellow-200 text-yellow-800">
                    {newRequestData.requestType === 'wheel_type_change' ? 'Wheel Change' : 'Topic Suggestion'}
                  </Badge>
                </div>
                
                {newRequestData.requestType === 'wheel_type_change' && newRequestData.requestedWheelType && (
                  <div className="space-y-2">
                    <p className="text-sm text-gray-600">Wants to change wheel to:</p>
                    <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <span className="text-2xl">{newRequestData.requestedWheelType.icon}</span>
                      <div>
                        <p className="font-medium text-blue-900">{newRequestData.requestedWheelType.title}</p>
                        <p className="text-sm text-blue-700">{newRequestData.requestedWheelType.description}</p>
                      </div>
                    </div>
                  </div>
                )}
                
                {newRequestData.requestType === 'topic_suggestion' && (
                  <div className="space-y-2">
                    <p className="text-sm text-gray-600">Suggested Topic:</p>
                    <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                      <p className="font-medium text-green-900">{newRequestData.topicSuggestion}</p>
                    </div>
                  </div>
                )}
                
                {newRequestData.message && (
                  <div className="mt-3 space-y-1">
                    <p className="text-sm text-gray-600">Message:</p>
                    <p className="text-sm text-gray-800 italic bg-gray-50 p-2 rounded">{newRequestData.message}</p>
                  </div>
                )}
              </div>
              
              {/* Action Buttons */}
              <div className="flex gap-3">
                <Button
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                  onClick={() => {
                    setShowNewRequestPopup(false)
                    setSelectedRequest(newRequestData)
                    if (newRequestData.requestType === 'wheel_type_change') {
                      setShowResponseDialog(true)
                    } else {
                      handleRequestResponse(newRequestData, 'approved')
                    }
                  }}
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Approve & Apply
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={() => {
                    setShowNewRequestPopup(false)
                    setSelectedRequest(newRequestData)
                    setShowResponseDialog(true)
                  }}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Deny Request
                </Button>
              </div>
              
              {/* View All Requests */}
              <Button
                variant="outline"
                className="w-full text-sm"
                onClick={() => setShowNewRequestPopup(false)}
              >
                View All Requests Below
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}