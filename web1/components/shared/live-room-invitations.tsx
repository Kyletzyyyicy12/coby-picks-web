"use client"

import React, { useState, useEffect } from 'react'
import { cn } from "@/lib/utils"
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { toast } from "@/hooks/use-toast"
import { 
  Bell, 
  Users, 
  Check, 
  X, 
  Clock, 
  Crown, 
  Shield,
  Loader2,
  Radio,
  UserPlus,
  Eye,
  ChevronDown,
  ChevronUp,
  CheckSquare,
  QrCode
} from "lucide-react"
import { db } from "@/lib/firebase"
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
  addDoc,
  serverTimestamp,
  getDoc,
  getDocs
} from "firebase/firestore"
import { useAuth } from "@/contexts/AuthContext"

interface LiveRoomInvitation {
  id: string
  sessionId: string
  sessionTitle: string
  sessionDescription: string
  wheelType: string
  wheelTitle: string
  wheelIcon: string
  roomCode: string
  
  // Inviter information
  invitedBy: string
  invitedByName: string
  invitedByEmail: string
  
  // Invitee information
  invitedOrganizerEmail: string
  invitedOrganizer: string | null
  
  // Invitation details
  status: 'sent' | 'accepted' | 'declined' | 'expired'
  type: 'live_room_invitation'
  createdAt: any
  expiresAt: any
  
  // Session configuration
  sessionConfig: {
    maxParticipants: number
    allowReactions: boolean
    confettiEffect: boolean
    soundEffects: boolean
    liveSession: boolean
    allowDataSync: boolean
  }
  
  // Collaboration permissions
  permissions: {
    canControlLive: boolean
    canEditWheel: boolean
    canManageParticipants: boolean
    canEndSession: boolean
    canInviteOthers: boolean
  }
  
  // Notification metadata
  isRealTimeNotification: boolean
  priority: 'high' | 'normal' | 'low'
  requiresImmediateAttention: boolean
}

interface LiveRoomInvitationsProps {
  user?: any
}

export function LiveRoomInvitations({ user }: LiveRoomInvitationsProps) {
  const { currentUser, userProfile } = useAuth()
  const [invitations, setInvitations] = useState<LiveRoomInvitation[]>([])
  const [loading, setLoading] = useState<string | null>(null)
  const [showNotifications, setShowNotifications] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)

  // Use the passed user prop or fall back to currentUser from auth context
  const activeUser = user || currentUser

  // Listen for live room invitations for current organizer
  useEffect(() => {
    if (!activeUser?.email) {
      console.log("❌ No user email available for live room invitations")
      return
    }

    console.log("🔔 Setting up live room invitation listener for:", activeUser.email)

    // Query for invitations by email (since we may not have their UID yet)
    const invitationsQuery = query(
      collection(db, 'liveRoomInvitations'),
      where('invitedOrganizerEmail', '==', activeUser.email),
      where('status', '==', 'sent')
    )

    const unsubscribe = onSnapshot(
      invitationsQuery,
      (snapshot) => {
        const newInvitations: LiveRoomInvitation[] = []

        snapshot.forEach((doc) => {
          const data = doc.data()
          
          // Check if invitation hasn't expired
          const now = new Date()
          const expiresAt = data.expiresAt instanceof Date ? data.expiresAt : 
                          data.expiresAt?.toDate ? data.expiresAt.toDate() : 
                          new Date(data.expiresAt)
          
          if (expiresAt && now < expiresAt) {
            const invitation: LiveRoomInvitation = {
              id: doc.id,
              sessionId: data.sessionId,
              sessionTitle: data.sessionTitle,
              sessionDescription: data.sessionDescription,
              wheelType: data.wheelType,
              wheelTitle: data.wheelTitle,
              wheelIcon: data.wheelIcon,
              roomCode: data.roomCode,
              invitedBy: data.invitedBy,
              invitedByName: data.invitedByName,
              invitedByEmail: data.invitedByEmail,
              invitedOrganizerEmail: data.invitedOrganizerEmail,
              invitedOrganizer: data.invitedOrganizer,
              status: data.status,
              type: data.type,
              createdAt: data.createdAt,
              expiresAt: data.expiresAt,
              sessionConfig: data.sessionConfig,
              permissions: data.permissions,
              isRealTimeNotification: data.isRealTimeNotification,
              priority: data.priority,
              requiresImmediateAttention: data.requiresImmediateAttention
            }
            
            newInvitations.push(invitation)
          } else {
            console.log("⏰ Invitation expired, skipping:", doc.id)
          }
        })

        console.log(`🔔 Found ${newInvitations.length} active live room invitations`, 
          newInvitations.map(inv => ({
            id: inv.id,
            from: inv.invitedByName,
            sessionTitle: inv.sessionTitle,
            roomCode: inv.roomCode
          }))
        )

        setInvitations(newInvitations)

        // Show toast for new invitations (only for very recent ones)
        if (newInvitations.length > 0) {
          const latestInvitation = newInvitations[0]
          const invitedAt = latestInvitation.createdAt?.toDate ? 
                           latestInvitation.createdAt.toDate() : 
                           new Date(latestInvitation.createdAt)
          const timeDiff = new Date().getTime() - invitedAt.getTime()
          const minutesDiff = timeDiff / (1000 * 60)

          // Show toast only if invitation is less than 2 minutes old (very fresh)
          if (minutesDiff < 2) {
            console.log("🔔 Showing toast for fresh live room invitation")
            toast({
              title: "🎯 Live Room Invitation Received!",
              description: `${latestInvitation.invitedByName} has invited you to join live session "${latestInvitation.sessionTitle}" (Room: ${latestInvitation.roomCode})`,
              duration: 10000,
            })
            
            // Auto-expand notifications for immediate attention
            setShowNotifications(true)
          }
        }
      },
      (error) => {
        console.error('❌ Error listening for live room invitations:', error)
        setInvitations([])
      }
    )

    return () => {
      console.log("🔕 Cleaning up live room invitation listener")
      unsubscribe()
    }
  }, [activeUser?.email])

  const handleAcceptInvitation = async (invitation: LiveRoomInvitation) => {
    if (!activeUser) {
      toast({
        title: "Authentication Required",
        description: "Please log in to accept the invitation",
        variant: "destructive"
      })
      return
    }

    setLoading(invitation.id)
    try {
      console.log(`✅ Accepting live room invitation:`, {
        invitationId: invitation.id,
        sessionId: invitation.sessionId,
        roomCode: invitation.roomCode,
        invitedBy: invitation.invitedByName
      })

      // Update invitation status and add user UID
      await updateDoc(doc(db, 'liveRoomInvitations', invitation.id), {
        status: 'accepted',
        acceptedAt: serverTimestamp(),
        invitedOrganizer: activeUser.uid, // Now we have their UID
        acceptedByName: activeUser.displayName || activeUser.email?.split('@')[0] || 'Organizer'
      })

      // Get the live session first to retrieve the associated wheel ID
      const sessionRef = doc(db, 'liveDrawSessions', invitation.sessionId)
      const sessionDoc = await getDoc(sessionRef)

      if (!sessionDoc.exists()) {
        console.error(`❌ Live session not found: ${invitation.sessionId}`)
        toast({
          title: "Error",
          description: "Live session not found. It may have been deleted.",
          variant: "destructive"
        })
        return
      }

      const sessionData = sessionDoc.data()
      const wheelId = sessionData?.wheelId

      // Verify user is a collaborator on the associated wheel before adding to live session
      if (wheelId) {
        const wheelRef = doc(db, 'wheels', wheelId)
        const wheelDoc = await getDoc(wheelRef)

        if (wheelDoc.exists()) {
          const wheelData = wheelDoc.data()
          const wheelCollaborators = wheelData?.collaboratorDetails || []
          const isWheelCollaborator = wheelCollaborators.some((c: any) =>
            c.uid === activeUser.uid || c.email === activeUser.email
          )

          if (!isWheelCollaborator) {
            console.error(`❌ User ${activeUser.email} is not authorized as a collaborator on wheel ${wheelId}`)
            toast({
              title: "Access Denied",
              description: "You are not authorized to join this live session. Only collaborators can access this session.",
              variant: "destructive"
            })
            return
          }
        } else {
          console.error(`❌ Associated wheel not found: ${wheelId}`)
          toast({
            title: "Error",
            description: "Could not verify your authorization for this live session.",
            variant: "destructive"
          })
          return
        }
      }

      // Add collaborator to the live session

      if (sessionDoc.exists()) {
        const sessionData = sessionDoc.data()
        const currentCollaborators = sessionData.collaboratorDetails || []

        // Add new collaborator
        const newCollaborator = {
          uid: activeUser.uid,
          email: activeUser.email,
          name: activeUser.displayName || activeUser.email?.split('@')[0] || 'Organizer',
          acceptedAt: new Date(), // Use new Date() instead of serverTimestamp() for array elements
          permissions: invitation.permissions,
          status: 'active',
          platform: 'web',
          lastActive: new Date(), // Use new Date() instead of serverTimestamp() for array elements
          invitationId: invitation.id,
          joinedVia: 'live_room_invitation'
        }

        await updateDoc(sessionRef, {
          collaboratorDetails: [...currentCollaborators, newCollaborator],
          // Also update the simple collaborators array with emails
          collaborators: [...(sessionData.collaborators || []), activeUser.email],
          lastCollaboratorJoined: {
            email: activeUser.email,
            name: newCollaborator.name,
            joinedAt: new Date() // Use new Date() instead of serverTimestamp() for nested objects
          },
          updatedAt: serverTimestamp()
        })

        console.log("✅ Added collaborator to live session:", invitation.sessionId)
      }

      // Create acceptance notification for the inviter
      await addDoc(collection(db, 'liveSessionNotifications'), {
        title: '🎉 Collaborator Joined Live Room!',
        message: `${activeUser.displayName || 'An organizer'} has accepted your live room invitation and joined "${invitation.sessionTitle}" (Room: ${invitation.roomCode}). They can now collaborate on the live session!`,
        type: 'live_room_accepted',
        sessionId: invitation.sessionId,
        roomCode: invitation.roomCode,
        targetUserId: invitation.invitedBy,
        isActive: true,
        priority: 'high',
        createdBy: activeUser.uid,
        createdByName: activeUser.displayName || activeUser.email?.split('@')[0] || 'Organizer',
        createdAt: serverTimestamp(),
        expiresAt: new Date(Date.now() + 3 * 60 * 60 * 1000), // 3 hours
        collaboratorInfo: {
          uid: activeUser.uid,
          name: activeUser.displayName || activeUser.email?.split('@')[0] || 'Organizer',
          email: activeUser.email,
          platform: 'web',
          joinedAt: new Date(), // Use new Date() instead of serverTimestamp() in nested object
          isOnline: true
        }
      })

      // Remove from local state immediately
      setInvitations(prev => prev.filter(inv => inv.id !== invitation.id))

      // Show success toast with shorter duration
      toast({
        title: "🎯 Joined Live Room!",
        description: `Successfully joined "${invitation.sessionTitle}". Entering live session...`,
        duration: 1000 // Shorter toast duration
      })

      // Navigate immediately to the live session (no artificial delay)
      console.log("🚀 Redirecting to live session...")
      try {
        // Use the current URL pattern consistently
        window.location.href = `/live/${invitation.sessionId}`

        // Fallback in case window.location fails
        setTimeout(() => {
          if (window.location.pathname !== `/live/${invitation.sessionId}`) {
            console.warn("⚠️ Direct navigation failed, attempting retry...")
            window.location.href = `/live/${invitation.sessionId}`
          }
        }, 500)
      } catch (navError) {
        console.error("❌ Navigation error:", navError)
        toast({
          title: "Navigation Error",
          description: "Failed to redirect to live session. Please refresh and try again.",
          variant: "destructive"
        })
      }

    } catch (error: any) {
      console.error('❌ Error accepting live room invitation:', error)
      toast({
        title: "Error",
        description: "Failed to accept live room invitation. Please try again.",
        variant: "destructive"
      })
    } finally {
      setLoading(null)
    }
  }

  const handleDeclineInvitation = async (invitationId: string, sessionTitle: string) => {
    setLoading(invitationId)
    try {
      await updateDoc(doc(db, 'liveRoomInvitations', invitationId), {
        status: 'declined',
        declinedAt: new Date(), // Use new Date() instead for consistency
        declinedBy: activeUser?.uid,
        declinedByName: activeUser?.displayName || activeUser?.email?.split('@')[0] || 'Organizer'
      })

      setInvitations(prev => prev.filter(inv => inv.id !== invitationId))

      toast({
        title: "Live Room Invitation Declined",
        description: `You have declined the invitation to "${sessionTitle}".`,
      })
    } catch (error: any) {
      console.error('❌ Error declining live room invitation:', error)
      toast({
        title: "Error",
        description: "Failed to decline invitation. Please try again.",
        variant: "destructive"
      })
    } finally {
      setLoading(null)
    }
  }

  const handleJoinSession = (sessionId: string, roomCode: string, sessionTitle: string) => {
    console.log(`🚀 Joining live session:`, {
      sessionId,
      roomCode,
      sessionTitle
    })
    
    toast({
      title: "Joining Live Session...",
      description: `Connecting to "${sessionTitle}" (Room: ${roomCode})`,
    })
    
    // Navigate to live session
    window.location.href = `/live/${sessionId}`
  }

  if (invitations.length === 0) {
    return null // Don't render anything if no invitations
  }

  return (
    <div className="mb-6">
      {/* Live Room Invitations Card */}
      <Card className={cn(
        "border-2 border-red-500 bg-red-50 shadow-xl transition-all duration-300",
        invitations.some(inv => inv.requiresImmediateAttention) 
          ? "animate-pulse border-yellow-400 bg-yellow-50" 
          : "border-red-500 bg-red-50"
      )}>
        <CardHeader 
          className="bg-gradient-to-r from-red-600 to-red-700 text-white cursor-pointer hover:from-red-700 hover:to-red-800 transition-all"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-3 text-xl">
              <div className="p-2 bg-white/20 rounded-lg">
                <Radio className="h-6 w-6" />
              </div>
              <div className="flex items-center gap-2">
                <Bell className="h-5 w-5 animate-bounce" />
                Live Room Invitations
                <Badge variant="destructive" className="bg-yellow-500 text-black font-bold">
                  {invitations.length} NEW
                </Badge>
              </div>
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="text-white hover:bg-white/20"
                onClick={(e) => {
                  e.stopPropagation()
                  setIsExpanded(!isExpanded)
                }}
              >
                {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          <div className="text-white/90">
            You have been invited to collaborate on live sessions! Click to view details.
          </div>
        </CardHeader>

        {isExpanded && (
          <CardContent className="p-6">
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {invitations.map((invitation) => (
                <Card key={invitation.id} className="border-l-4 border-l-red-500 shadow-lg bg-white">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <span className="text-2xl">{invitation.wheelIcon}</span>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Radio className="h-5 w-5 text-red-600" />
                          Live Room Collaboration
                        </div>
                        <div className="text-sm font-normal text-muted-foreground mt-1">
                          Session: <span className="font-semibold text-red-700">{invitation.sessionTitle}</span>
                        </div>
                      </div>
                      <Badge className="bg-red-100 text-red-700 border-red-300">
                        🔴 LIVE
                      </Badge>
                    </CardTitle>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    {/* Invitation Details */}
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                      <div className="flex items-start gap-3">
                        <UserPlus className="h-5 w-5 text-blue-600 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-blue-900">
                            <span className="font-bold">{invitation.invitedByName}</span> has invited you to collaborate on their live session
                          </p>
                          <p className="text-xs text-blue-700 mt-1">
                            From: {invitation.invitedByEmail}
                          </p>
                          <div className="mt-2 p-2 bg-white rounded border border-blue-300">
                            <div className="text-xs text-blue-600 mb-1">Session Details:</div>
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 text-sm">
                                <span className="text-lg">{invitation.wheelIcon}</span>
                                <span className="font-semibold">{invitation.wheelTitle}</span>
                              </div>
                              <div className="text-xs text-gray-600">{invitation.sessionDescription}</div>
                              <div className="flex items-center gap-4 text-xs">
                                <div className="flex items-center gap-1">
                                  <QrCode className="h-3 w-3 text-red-600" />
                                  <span className="font-mono font-bold text-red-600">Room: {invitation.roomCode}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Users className="h-3 w-3 text-blue-600" />
                                  <span>Max: {invitation.sessionConfig.maxParticipants}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Permissions Preview */}
                    <div className="bg-green-50 p-3 rounded-lg border border-green-200">
                      <div className="flex items-center gap-2 mb-2">
                        <Crown className="h-4 w-4 text-green-600" />
                        <span className="text-sm font-medium text-green-900">As a collaborator, you'll be able to:</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {invitation.permissions.canControlLive && (
                          <div className="flex items-center gap-2 text-xs text-green-800">
                            <Shield className="h-3 w-3" />
                            Control live sessions
                          </div>
                        )}
                        {invitation.permissions.canEditWheel && (
                          <div className="flex items-center gap-2 text-xs text-green-800">
                            <Shield className="h-3 w-3" />
                            Edit wheel settings
                          </div>
                        )}
                        {invitation.permissions.canManageParticipants && (
                          <div className="flex items-center gap-2 text-xs text-green-800">
                            <Shield className="h-3 w-3" />
                            Manage participants
                          </div>
                        )}
                        <div className="flex items-center gap-2 text-xs text-red-700">
                          <X className="h-3 w-3" />
                          Cannot end session
                        </div>
                      </div>
                    </div>

                    {/* Session Features */}
                    <div className="bg-purple-50 p-3 rounded-lg border border-purple-200">
                      <div className="text-xs text-purple-700 mb-2">Live Session Features:</div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="flex items-center gap-1">
                          <CheckSquare className={`h-3 w-3 ${invitation.sessionConfig.allowReactions ? 'text-green-600' : 'text-gray-400'}`} />
                          <span className={invitation.sessionConfig.allowReactions ? 'text-green-700' : 'text-gray-500'}>
                            Reactions {invitation.sessionConfig.allowReactions ? 'ON' : 'OFF'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <CheckSquare className={`h-3 w-3 ${invitation.sessionConfig.confettiEffect ? 'text-green-600' : 'text-gray-400'}`} />
                          <span className={invitation.sessionConfig.confettiEffect ? 'text-green-700' : 'text-gray-500'}>
                            Confetti {invitation.sessionConfig.confettiEffect ? 'ON' : 'OFF'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <CheckSquare className={`h-3 w-3 ${invitation.sessionConfig.soundEffects ? 'text-green-600' : 'text-gray-400'}`} />
                          <span className={invitation.sessionConfig.soundEffects ? 'text-green-700' : 'text-gray-500'}>
                            Sound {invitation.sessionConfig.soundEffects ? 'ON' : 'OFF'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <CheckSquare className={`h-3 w-3 ${invitation.sessionConfig.allowDataSync ? 'text-green-600' : 'text-gray-400'}`} />
                          <span className={invitation.sessionConfig.allowDataSync ? 'text-green-700' : 'text-gray-500'}>
                            Data Sync {invitation.sessionConfig.allowDataSync ? 'ON' : 'OFF'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Expiration Timer */}
                    <div className="flex items-center gap-2 text-xs text-muted-foreground bg-gray-50 p-2 rounded">
                      <Clock className="h-3 w-3" />
                      Expires: {new Date(
                        invitation.expiresAt?.toDate ? invitation.expiresAt.toDate() : invitation.expiresAt
                      ).toLocaleDateString()} at {new Date(
                        invitation.expiresAt?.toDate ? invitation.expiresAt.toDate() : invitation.expiresAt
                      ).toLocaleTimeString()}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2 pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeclineInvitation(invitation.id, invitation.sessionTitle)}
                        disabled={loading === invitation.id}
                        className="flex-1 border-red-200 text-red-700 hover:bg-red-50"
                      >
                        {loading === invitation.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <X className="h-3 w-3 mr-1" />
                        )}
                        Decline
                      </Button>
                      
                      <Button
                        size="sm"
                        onClick={() => handleAcceptInvitation(invitation)}
                        disabled={loading === invitation.id}
                        className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                      >
                        {loading === invitation.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Check className="h-3 w-3 mr-1" />
                        )}
                        Accept & Join Live Room
                      </Button>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleJoinSession(invitation.sessionId, invitation.roomCode, invitation.sessionTitle)}
                        className="border-blue-200 text-blue-700 hover:bg-blue-50"
                        title="Preview session before accepting"
                      >
                        <Eye className="h-3 w-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            
            {/* Summary footer */}
            <div className="mt-4 pt-4 border-t border-red-200">
              <div className="text-center text-sm text-red-700">
                <div className="flex items-center justify-center gap-2">
                  <Radio className="h-4 w-4" />
                  <span className="font-medium">
                    {invitations.length} live room invitation{invitations.length > 1 ? 's' : ''} awaiting your response
                  </span>
                </div>
                <div className="text-xs text-red-600 mt-1">
                  Join live sessions to collaborate in real-time with other organizers
                </div>
              </div>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  )
}
