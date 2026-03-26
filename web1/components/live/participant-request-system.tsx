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
import { MessageSquare, Send, Clock, CheckCircle, XCircle, Lightbulb, Settings } from "lucide-react"
import { ParticipantRequest } from "@/types/participant-requests"

interface ParticipantRequestSystemProps {
  sessionId: string
  participantId: string
  participantName: string
  isOrganizer?: boolean
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

export function ParticipantRequestSystem({
  sessionId,
  participantId,
  participantName,
  isOrganizer = false,
  availableWheelTypes
}: ParticipantRequestSystemProps) {
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
  }, [sessionId])

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
        return 'bg-yellow-100 text-yellow-800'
      case 'approved':
        return 'bg-green-100 text-green-800'
      case 'denied':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  // Filter requests based on role
  const displayRequests = isOrganizer 
    ? requests 
    : requests.filter(req => req.participantId === participantId)

  const pendingRequests = requests.filter(req => req.status === 'pending')

  return (
    <div className="space-y-4">
      {!isOrganizer && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Request Wheel Changes
              {pendingRequests.length > 0 && (
                <Badge variant="secondary">
                  {pendingRequests.length} pending
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Request wheel type changes or suggest topics to the organizer
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Dialog open={showRequestDialog} onOpenChange={setShowRequestDialog}>
              <DialogTrigger asChild>
                <Button className="w-full">
                  <Send className="h-4 w-4 mr-2" />
                  Make a Request
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Submit Request to Organizer</DialogTitle>
                  <DialogDescription>
                    Request a wheel type change or suggest a topic for the session
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4">
                  <div>
                    <Label>Request Type</Label>
                    <Select value={requestType} onValueChange={(value) => setRequestType(value as any)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="wheel_type_change">
                          <div className="flex items-center gap-2">
                            <Settings className="h-4 w-4" />
                            Change Wheel Type
                          </div>
                        </SelectItem>
                        <SelectItem value="topic_suggestion">
                          <div className="flex items-center gap-2">
                            <Lightbulb className="h-4 w-4" />
                            Suggest Topic
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {requestType === 'wheel_type_change' && (
                    <div>
                      <Label>Requested Wheel Type</Label>
                      <Select value={selectedWheelType} onValueChange={setSelectedWheelType}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a wheel type" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableWheelTypes.map((wheelType) => (
                            <SelectItem key={wheelType.id} value={wheelType.id}>
                              <div className="flex items-center gap-2">
                                <span>{wheelType.icon}</span>
                                <div>
                                  <div className="font-medium">{wheelType.title}</div>
                                  <div className="text-xs text-muted-foreground">{wheelType.description}</div>
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
                      <Label>Topic Suggestion</Label>
                      <Input
                        value={topicSuggestion}
                        onChange={(e) => setTopicSuggestion(e.target.value)}
                        placeholder="Enter your topic suggestion..."
                      />
                    </div>
                  )}

                  <div>
                    <Label>Additional Message (Optional)</Label>
                    <Textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Add any additional details about your request..."
                      rows={3}
                    />
                  </div>

                  <Button 
                    onClick={submitRequest} 
                    disabled={isSubmitting}
                    className="w-full"
                  >
                    {isSubmitting ? "Submitting..." : "Submit Request"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      )}

      {/* Request History */}
      {displayRequests.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>
              {isOrganizer ? "Participant Requests" : "Your Requests"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {displayRequests.map((request) => (
                <div key={request.id} className="border rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(request.status)}
                      <span className="font-medium">
                        {isOrganizer ? request.participantName : 'You'}
                      </span>
                      <Badge className={getStatusColor(request.status)}>
                        {request.status}
                      </Badge>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {request.createdAt.toLocaleTimeString()}
                    </span>
                  </div>
                  
                  <div>
                    <span className="text-sm font-medium">
                      {request.requestType === 'wheel_type_change' ? 'Wheel Type Change' : 'Topic Suggestion'}:
                    </span>
                    {request.requestType === 'wheel_type_change' && request.requestedWheelType && (
                      <div className="ml-2 text-sm">
                        {request.requestedWheelType.icon} {request.requestedWheelType.title}
                      </div>
                    )}
                    {request.requestType === 'topic_suggestion' && (
                      <div className="ml-2 text-sm">{request.topicSuggestion}</div>
                    )}
                  </div>

                  {request.message && (
                    <div className="text-sm text-muted-foreground">
                      <strong>Message:</strong> {request.message}
                    </div>
                  )}

                  {request.organizerResponse && (
                    <div className="text-sm bg-blue-50 p-2 rounded">
                      <strong>Organizer Response:</strong> {request.organizerResponse}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}