"use client"

import React, { useState, useEffect } from 'react'
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
  Loader2
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
  arrayUnion
} from "firebase/firestore"
import { useAuth } from "@/contexts/AuthContext"

interface CollaborationInvitation {
  id: string
  wheelId: string
  wheelName: string
  invitedBy: string
  invitedByName: string
  invitedByEmail: string
  invitedOrganizer: string
  invitedOrganizerName: string
  invitedOrganizerEmail: string
  status: 'sent' | 'accepted' | 'declined' | 'expired'
  createdAt: any
  expiresAt: any
  permissions: {
    canControlLive: boolean
    canEditWheel: boolean
    canManageParticipants: boolean
  }
}

export function WebCollaborationNotifications() {
  const { currentUser, userProfile } = useAuth()
  const [invitations, setInvitations] = useState<CollaborationInvitation[]>([])
  const [loading, setLoading] = useState<string | null>(null)
  const [showNotifications, setShowNotifications] = useState(false)

  // Listen for collaboration invitations for current organizer
  useEffect(() => {
    if (!currentUser || !userProfile) return

    // Only show for organizers/teachers
    const role = userProfile.role?.toLowerCase()
    if (role !== 'organizer' && role !== 'teacher') return

    const invitationsQuery = query(
      collection(db, 'collaborationInvitations'),
      where('invitedOrganizer', '==', currentUser.uid),
      where('status', '==', 'sent')
    )

    const unsubscribe = onSnapshot(
      invitationsQuery,
      (snapshot) => {
        const newInvitations: CollaborationInvitation[] = []

        snapshot.forEach((doc) => {
          const data = doc.data()
          const invitation: CollaborationInvitation = {
            id: doc.id,
            wheelId: data.wheelId,
            wheelName: data.wheelName,
            invitedBy: data.invitedBy,
            invitedByName: data.invitedByName,
            invitedByEmail: data.invitedByEmail,
            invitedOrganizer: data.invitedOrganizer,
            invitedOrganizerName: data.invitedOrganizerName,
            invitedOrganizerEmail: data.invitedOrganizerEmail,
            status: data.status,
            createdAt: data.createdAt,
            expiresAt: data.expiresAt,
            permissions: data.permissions
          }

          // Check if invitation hasn't expired
          const now = new Date()
          const expiresAt = data.expiresAt?.toDate ? data.expiresAt.toDate() : new Date(data.expiresAt)
          if (expiresAt && now < expiresAt) {
            newInvitations.push(invitation)
          }
        })

        setInvitations(newInvitations)

        // Show toast for new invitations
        if (newInvitations.length > 0) {
          const latestInvitation = newInvitations[0]
          const invitedAt = latestInvitation.createdAt?.toDate ? latestInvitation.createdAt.toDate() : new Date(latestInvitation.createdAt)
          const timeDiff = new Date().getTime() - invitedAt.getTime()
          const minutesDiff = timeDiff / (1000 * 60)

          // Show toast only if invitation is less than 5 minutes old
          if (minutesDiff < 5) {
            toast({
              title: "🤝 New Collaboration Invitation!",
              description: `${latestInvitation.invitedByName} wants to collaborate on "${latestInvitation.wheelName}"`,
              duration: 8000,
            })
          }
        }
      },
      (error) => {
        console.log('Permission denied for collaboration invitations (expected for some users):', error)
        setInvitations([])
      }
    )

    return () => unsubscribe()
  }, [currentUser, userProfile])

  const handleAcceptInvitation = async (invitation: CollaborationInvitation) => {
    if (!currentUser || !userProfile) return

    setLoading(invitation.id)
    try {
      // Update invitation status
      await updateDoc(doc(db, 'collaborationInvitations', invitation.id), {
        status: 'accepted',
        acceptedAt: serverTimestamp()
      })

      // Add current user to wheel collaborators
      await updateDoc(doc(db, 'wheels', invitation.wheelId), {
        collaborators: arrayUnion(currentUser.email),
        collaboratorDetails: arrayUnion({
          uid: currentUser.uid,
          email: currentUser.email,
          name: userProfile?.displayName || 'Organizer',
          acceptedAt: new Date(),
          permissions: invitation.permissions,
          status: 'active',
          platform: 'web',
          lastActive: serverTimestamp()
        })
      })

      // Create real-time presence notification for immediate reflection
      await addDoc(collection(db, 'organizerPresence'), {
        wheelId: invitation.wheelId,
        organizerId: currentUser.uid,
        organizerName: userProfile?.displayName || 'Organizer',
        organizerEmail: currentUser.email,
        status: 'joined_collaboration',
        joinedAt: serverTimestamp(),
        platform: 'web',
        isOnline: true
      })

      // Create acceptance notification for the inviter
      await addDoc(collection(db, 'announcements'), {
        title: '🎉 Collaboration Accepted!',
        message: `${userProfile?.displayName || 'An organizer'} has accepted your collaboration invitation for "${invitation.wheelName}". You can now work together on live sessions! They are now online and ready to collaborate.`,
        type: 'collaboration_accepted',
        targetRoles: ['organizer', 'teacher'],
        targetUserId: invitation.invitedBy,
        isActive: true,
        priority: 'high', // Increased priority for immediate visibility
        createdBy: currentUser.uid,
        createdByName: userProfile?.displayName || 'Organizer',
        createdAt: serverTimestamp(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        wheelId: invitation.wheelId,
        wheelName: invitation.wheelName,
        collaboratorInfo: {
          uid: currentUser.uid,
          name: userProfile?.displayName || 'Organizer',
          email: currentUser.email,
          platform: 'web',
          joinedAt: serverTimestamp(),
          isOnline: true
        }
      })

      // Remove from local state
      setInvitations(prev => prev.filter(inv => inv.id !== invitation.id))

      toast({
        title: "🤝 Collaboration Started!",
        description: `You're now a collaborator on "${invitation.wheelName}". You can control live sessions together with ${invitation.invitedByName}. The collaboration is active and ready for live sessions!`,
        duration: 6000,
      })

    } catch (error: any) {
      console.error('Error accepting collaboration invitation:', error)
      toast({
        title: "Error",
        description: "Failed to accept collaboration invitation. Please try again.",
        variant: "destructive"
      })
    } finally {
      setLoading(null)
    }
  }

  const handleDeclineInvitation = async (invitationId: string) => {
    setLoading(invitationId)
    try {
      await updateDoc(doc(db, 'collaborationInvitations', invitationId), {
        status: 'declined',
        declinedAt: serverTimestamp()
      })

      setInvitations(prev => prev.filter(inv => inv.id !== invitationId))

      toast({
        title: "Invitation Declined",
        description: "You have declined the collaboration invitation.",
      })
    } catch (error: any) {
      console.error('Error declining invitation:', error)
      toast({
        title: "Error",
        description: "Failed to decline invitation. Please try again.",
        variant: "destructive"
      })
    } finally {
      setLoading(null)
    }
  }

  if (invitations.length === 0) {
    return null // Don't render anything if no invitations
  }

  return (
    <div className="fixed top-4 right-4 z-50 max-w-md w-full">
      {/* Notification Bell */}
      <div className="mb-2 flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowNotifications(!showNotifications)}
          className="bg-white border-red-200 text-red-700 hover:bg-red-50"
        >
          <Bell className="h-4 w-4 mr-2" />
          Collaboration Invites
          <Badge variant="destructive" className="ml-2">
            {invitations.length}
          </Badge>
        </Button>
      </div>

      {/* Notifications Panel */}
      {showNotifications && (
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {invitations.map((invitation) => (
            <Card key={invitation.id} className="border-l-4 border-l-red-500 shadow-lg">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Users className="h-5 w-5 text-red-600" />
                  🤝 Collaboration Invitation
                </CardTitle>
                <div className="text-sm text-muted-foreground">
                  For: <span className="font-semibold text-red-700">{invitation.wheelName}</span>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm">
                    <span className="font-medium">{invitation.invitedByName}</span> has invited you to collaborate on their wheel.
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    From: {invitation.invitedByEmail}
                  </p>
                </div>

                <div className="bg-blue-50 p-3 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Crown className="h-4 w-4 text-blue-600" />
                    <span className="text-sm font-medium text-blue-900">You'll be able to:</span>
                  </div>
                  <div className="space-y-1">
                    {invitation.permissions.canControlLive && (
                      <div className="flex items-center gap-2 text-xs text-blue-800">
                        <Shield className="h-3 w-3" />
                        Control live sessions together
                      </div>
                    )}
                    {invitation.permissions.canEditWheel && (
                      <div className="flex items-center gap-2 text-xs text-blue-800">
                        <Shield className="h-3 w-3" />
                        Edit wheel settings
                      </div>
                    )}
                    {invitation.permissions.canManageParticipants && (
                      <div className="flex items-center gap-2 text-xs text-blue-800">
                        <Shield className="h-3 w-3" />
                        Manage participants
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  Expires: {new Date(
                    invitation.expiresAt?.toDate ? invitation.expiresAt.toDate() : invitation.expiresAt
                  ).toLocaleDateString()}
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeclineInvitation(invitation.id)}
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
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                  >
                    {loading === invitation.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Check className="h-3 w-3 mr-1" />
                    )}
                    Accept & Join
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}