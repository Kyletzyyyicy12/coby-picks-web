export interface ParticipantRequest {
  id: string
  sessionId: string
  participantId: string
  participantName: string
  requestType: 'wheel_type_change' | 'topic_suggestion'
  requestedWheelType?: {
    id: string
    title: string
    description: string
    icon: string
    category: string
    defaultItems: string[]
    color: string
  }
  topicSuggestion?: string
  message?: string
  status: 'pending' | 'approved' | 'denied'
  createdAt: Date
  respondedAt?: Date
  respondedBy?: string
  organizerResponse?: string
}

export interface RequestNotification {
  id: string
  type: 'new_request' | 'request_approved' | 'request_denied'
  title: string
  message: string
  participantName: string
  requestType: string
  timestamp: Date
  isRead: boolean
}

export interface LiveSessionRequestState {
  activeRequests: ParticipantRequest[]
  requestHistory: ParticipantRequest[]
  pendingCount: number
  allowParticipantRequests: boolean
  autoApproveRequests: boolean
}