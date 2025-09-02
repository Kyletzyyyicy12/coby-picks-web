"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/hooks/use-toast"
import { db } from "@/lib/firebase"
import { collection, addDoc, serverTimestamp, onSnapshot, query, where, orderBy } from "firebase/firestore"
import { MessageSquare, Send, Clock, CheckCircle, XCircle, Lightbulb, Settings, Smartphone } from "lucide-react"
import { ParticipantRequest } from "@/types/participant-requests"

interface ParticipantRequestMobileProps {
  sessionId: string
  participantId: string
  participantName: string
  availableWheelTypes: Array<{
    id: string
    title: string
    description: string
    icon: string
    category: string
    defaultItems: string[]
    color: string
  }>
}

export function ParticipantRequestMobile({
  sessionId,
  participantId,
  participantName,
  availableWheelTypes
}: ParticipantRequestMobileProps) {
  const [requests, setRequests] = useState<ParticipantRequest[]>([])
  const [showRequestDialog, setShowRequestDialog] = useState(false)
  const [requestType, setRequestType] = useState<'wheel_type_change' | 'topic_suggestion'>('wheel_type_change')
  const [selectedWheelType, setSelectedWheelType] = useState<string>('')
  const [topicSuggestion, setTopicSuggestion] = useState('')
  const [message, setMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Listen to requests in real-time
  useEffect(() => {
    if (!sessionId) return

    const requestsQuery = query(
      collection(db, "participantRequests"),
      where("sessionId", "==", sessionId),
      where("participantId", "==", participantId),
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
    })

    return () => unsubscribe()
  }, [sessionId, participantId])

  const submitRequest = async () => {
    if (!sessionId || !participantId) return

    if (requestType === 'wheel_type_change' && !selectedWheelType) {
      toast({
        title: "Please select a wheel type",
        variant: "destructive"
      })
      return
    }

    if (requestType === 'topic_suggestion' && !topicSuggestion.trim()) {
      toast({
        title: "Please enter a topic suggestion",
        variant: "destructive"
      })
      return
    }

    setIsSubmitting(true)

    try {
      const selectedWheel = availableWheelTypes.find(wheel => wheel.id === selectedWheelType)
      
      const requestData: Omit<ParticipantRequest, 'id'> = {
        sessionId,
        participantId,
        participantName,
        requestType,
        ...(requestType === 'wheel_type_change' && selectedWheel && {
          requestedWheelType: selectedWheel
        }),
        ...(requestType === 'topic_suggestion' && {
          topicSuggestion: topicSuggestion.trim()
        }),
        ...(message.trim() && { message: message.trim() }), // Only include message if it's not empty
        status: 'pending',
        createdAt: new Date()
      }

      await addDoc(collection(db, "participantRequests"), {
        ...requestData,
        createdAt: serverTimestamp()
      })

      toast({
        title: "✅ Request Submitted!",
        description: "Your request has been sent to the organizer"
      })

      // Reset form
      setSelectedWheelType('')
      setTopicSuggestion('')
      setMessage('')
      setShowRequestDialog(false)

    } catch (error) {
      console.error("Error submitting request:", error)
      toast({
        title: "Error",
        description: "Failed to submit request. Please try again.",
        variant: "destructive"
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-3 w-3 text-yellow-500" />
      case 'approved':
        return <CheckCircle className="h-3 w-3 text-green-500" />
      case 'denied':
        return <XCircle className="h-3 w-3 text-red-500" />
      default:
        return <Clock className="h-3 w-3 text-gray-500" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800'
      case 'approved':
        return 'bg-green-100 text-green-800'
      case 'denied':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const pendingRequests = requests.filter(req => req.status === 'pending')

  return (
    <div className="max-w-md mx-auto space-y-4">
      {/* Mobile-optimized header */}
      <Card className="border-2 border-blue-200">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Smartphone className="h-5 w-5 text-blue-600" />
            <span>Request Wheel Changes</span>
            {pendingRequests.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {pendingRequests.length} pending
              </Badge>
            )}
          </CardTitle>
          <CardDescription className="text-sm">
            Suggest wheel types or topics to the organizer
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Quick request button */}
          <Dialog open={showRequestDialog} onOpenChange={setShowRequestDialog}>
            <DialogTrigger asChild>
              <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white">
                <Send className="h-4 w-4 mr-2" />
                Make Request
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle className="text-lg">Submit Request</DialogTitle>
                <DialogDescription className="text-sm">
                  Request changes or suggest topics
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium">Request Type</Label>
                  <Select value={requestType} onValueChange={(value) => setRequestType(value as any)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="wheel_type_change">
                        <div className="flex items-center gap-2">
                          <Settings className="h-3 w-3" />
                          Change Wheel Type
                        </div>
                      </SelectItem>
                      <SelectItem value="topic_suggestion">
                        <div className="flex items-center gap-2">
                          <Lightbulb className="h-3 w-3" />
                          Suggest Topic
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {requestType === 'wheel_type_change' && (
                  <div>
                    <Label className="text-sm font-medium">Wheel Type</Label>
                    <Select value={selectedWheelType} onValueChange={setSelectedWheelType}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select wheel type" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableWheelTypes.slice(0, 8).map((wheelType) => (
                          <SelectItem key={wheelType.id} value={wheelType.id}>
                            <div className="flex items-center gap-2">
                              <span className="text-lg">{wheelType.icon}</span>
                              <div>
                                <div className="font-medium text-sm">{wheelType.title}</div>
                              </div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {requestType === 'topic_suggestion' && (
                  <div>
                    <Label className="text-sm font-medium">Topic</Label>
                    <Input
                      value={topicSuggestion}
                      onChange={(e) => setTopicSuggestion(e.target.value)}
                      placeholder="Enter topic..."
                      className="text-base"
                    />
                  </div>
                )}

                <div>
                  <Label className="text-sm font-medium">Message (Optional)</Label>
                  <Textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Additional details..."
                    rows={2}
                    className="text-base"
                  />
                </div>

                <Button 
                  onClick={submitRequest} 
                  disabled={isSubmitting}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                >
                  {isSubmitting ? "Submitting..." : "Submit Request"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* My Requests */}
          {requests.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-semibold text-sm text-gray-800">My Requests</h3>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {requests.slice(0, 5).map((request) => (
                  <div key={request.id} className="border rounded-lg p-3 space-y-2 bg-white shadow-sm">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(request.status)}
                        <Badge className={`${getStatusColor(request.status)} text-xs`}>
                          {request.status}
                        </Badge>
                      </div>
                      <span className="text-xs text-gray-500">
                        {request.createdAt.toLocaleTimeString()}
                      </span>
                    </div>
                    
                    <div className="text-sm">
                      <span className="font-medium">
                        {request.requestType === 'wheel_type_change' ? 'Wheel Change:' : 'Topic:'}
                      </span>
                      {request.requestType === 'wheel_type_change' && request.requestedWheelType && (
                        <div className="text-blue-600 font-medium mt-1">
                          {request.requestedWheelType.icon} {request.requestedWheelType.title}
                        </div>
                      )}
                      {request.requestType === 'topic_suggestion' && (
                        <div className="text-purple-600 font-medium mt-1">
                          {request.topicSuggestion}
                        </div>
                      )}
                    </div>

                    {request.organizerResponse && (
                      <div className="text-xs bg-blue-50 p-2 rounded border">
                        <strong>Response:</strong> {request.organizerResponse}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Mobile-optimized instructions */}
          <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
            <div className="text-sm text-blue-800">
              <strong>📱 Mobile Features:</strong>
              <ul className="mt-1 space-y-1 text-xs">
                <li>• Request wheel type changes</li>
                <li>• Suggest topics for the session</li>
                <li>• Real-time status updates</li>
                <li>• Organizer responses</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}