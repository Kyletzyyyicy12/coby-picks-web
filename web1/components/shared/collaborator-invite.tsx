"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { db } from "@/lib/firebase"
import { doc, updateDoc, arrayUnion, collection, query, where, getDocs, addDoc, serverTimestamp, onSnapshot } from "firebase/firestore"
import { toast } from "@/hooks/use-toast"
import { UserPlus, Users, Check, X, Loader2, Crown, Mail } from "lucide-react"

interface CollaboratorInviteProps {
  wheelId: string
  ownerId: string // To prevent owner from adding themselves or to show owner status
  wheelName?: string // Optional wheel name for invitation context
  currentUser?: any // Current user context
}

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

interface OrganizerData {
  id: string
  email: string
  name: string
  role: string
}

export function CollaboratorInvite({ wheelId, ownerId, wheelName, currentUser }: CollaboratorInviteProps) {
  const [collaboratorEmail, setCollaboratorEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [validatingEmail, setValidatingEmail] = useState(false)
  const [emailValidation, setEmailValidation] = useState<{ isValid: boolean; organizerData?: OrganizerData; message: string } | null>(null)
  const [existingCollaborators, setExistingCollaborators] = useState<string[]>([])
  const [pendingInvitations, setPendingInvitations] = useState<CollaborationInvitation[]>([])
  const [showInvitations, setShowInvitations] = useState(false)

  // Validate if email belongs to an existing organizer
  const validateOrganizerEmail = async (email: string) => {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailValidation({ isValid: false, message: "Please enter a valid email address" })
      return
    }

    setValidatingEmail(true)
    try {
      // Check if user exists and is an organizer
      const usersQuery = query(
        collection(db, "users"), 
        where("email", "==", email)
      )
      const userSnapshot = await getDocs(usersQuery)
      
      if (userSnapshot.empty) {
        setEmailValidation({ isValid: false, message: "No user found with this email address" })
        return
      }

      const userData = userSnapshot.docs[0].data()
      const userRole = userData.role?.toLowerCase()

      if (userRole !== 'organizer' && userRole !== 'teacher') {
        setEmailValidation({ 
          isValid: false, 
          message: `This user is a ${userData.role || 'participant'}. Only organizers can be collaborators.` 
        })
        return
      }

      // Check if it's the wheel owner
      if (userSnapshot.docs[0].id === ownerId) {
        setEmailValidation({ isValid: false, message: "You cannot add yourself as a collaborator" })
        return
      }

      // Check if already a collaborator
      if (existingCollaborators.includes(email)) {
        setEmailValidation({ isValid: false, message: "This organizer is already a collaborator" })
        return
      }

      // Check if invitation already sent
      const existingInvitation = pendingInvitations.find(inv => 
        inv.invitedOrganizerEmail === email && inv.status === 'sent'
      )
      if (existingInvitation) {
        setEmailValidation({ isValid: false, message: "Invitation already sent to this organizer" })
        return
      }

      setEmailValidation({ 
        isValid: true, 
        organizerData: {
          id: userSnapshot.docs[0].id,
          email: userData.email,
          name: userData.displayName || userData.name || 'Organizer',
          role: userData.role
        },
        message: `Found organizer: ${userData.displayName || userData.name || userData.email}` 
      })

    } catch (error: any) {
      console.error("Error validating email:", error)
      setEmailValidation({ isValid: false, message: "Error validating email. Please try again." })
    } finally {
      setValidatingEmail(false)
    }
  }

  // Handle email input changes with real-time validation
  const handleEmailChange = (email: string) => {
    setCollaboratorEmail(email)
    setEmailValidation(null)
    
    // Validate after user stops typing for 500ms
    const timeoutId = setTimeout(() => {
      if (email.trim()) {
        validateOrganizerEmail(email.trim())
      }
    }, 500)

    return () => clearTimeout(timeoutId)
  }

  const handleAddCollaborator = async () => {
    if (!emailValidation?.isValid || !emailValidation.organizerData || !currentUser) {
      toast({
        title: "Cannot Send Invitation",
        description: "Please enter a valid organizer email address.",
        variant: "destructive",
      })
      return
    }

    setLoading(true)
    try {
      const { organizerData } = emailValidation
      
      // Create collaboration invitation notification
      const invitationData = {
        wheelId: wheelId,
        wheelName: wheelName || 'Unnamed Wheel',
        invitedBy: currentUser.uid,
        invitedByName: currentUser.displayName || currentUser.name || 'Organizer',
        invitedByEmail: currentUser.email,
        invitedOrganizer: organizerData.id,
        invitedOrganizerName: organizerData.name,
        invitedOrganizerEmail: organizerData.email,
        status: 'sent',
        createdAt: serverTimestamp(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days expiry
        permissions: {
          canControlLive: true,
          canEditWheel: true,
          canManageParticipants: true
        },
        type: 'wheel_collaboration',
        targetRoles: ['organizer', 'teacher'],
        targetUserId: organizerData.id
      }

      // Add to collaboration invitations collection
      await addDoc(collection(db, "collaborationInvitations"), invitationData)

      // Also add to general announcements for real-time notification
      await addDoc(collection(db, "announcements"), {
        title: `🤝 Collaboration Invitation for "${wheelName || 'Unnamed Wheel'}"`,
        message: `${currentUser.displayName || 'An organizer'} has invited you to collaborate on their wheel "${wheelName || 'Unnamed Wheel'}". You'll be able to control live sessions, edit the wheel, and manage participants together.`,
        type: "collaboration",
        targetRoles: ['organizer', 'teacher'],
        targetUserId: organizerData.id,
        isActive: true,
        priority: "high",
        createdBy: currentUser.uid,
        createdByName: currentUser.displayName || 'Organizer',
        createdAt: serverTimestamp(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        wheelId: wheelId,
        wheelName: wheelName || 'Unnamed Wheel',
        collaborationInviteId: 'pending'
      })

      // Update wheel with pending collaborator (will be confirmed when accepted)
      const wheelRef = doc(db, "wheels", wheelId)
      await updateDoc(wheelRef, {
        pendingCollaborators: arrayUnion({
          email: organizerData.email,
          name: organizerData.name,
          invitedAt: new Date(),
          invitedBy: currentUser.uid
        })
      })

      toast({
        title: "🤝 Collaboration Invitation Sent!",
        description: `${organizerData.name} will receive a notification and can join as a collaborator on both web and mobile apps.`,
      })
      
      setCollaboratorEmail("")
      setEmailValidation(null)

    } catch (error: any) {
      console.error("Error sending collaboration invitation:", error)
      toast({
        title: "Error Sending Invitation",
        description: error.message || "Failed to send collaboration invitation. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  // Load existing collaborators and pending invitations
  useEffect(() => {
    if (!wheelId) return

    // Listen to wheel document for existing collaborators
    const wheelRef = doc(db, "wheels", wheelId)
    const unsubscribeWheel = onSnapshot(wheelRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data()
        setExistingCollaborators(data.collaborators || [])
      }
    })

    // Listen to collaboration invitations for this wheel
    const invitationsQuery = query(
      collection(db, "collaborationInvitations"),
      where("wheelId", "==", wheelId),
      where("status", "==", "sent")
    )
    const unsubscribeInvitations = onSnapshot(invitationsQuery, (snapshot) => {
      const invitations = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as CollaborationInvitation[]
      setPendingInvitations(invitations)
    })

    return () => {
      unsubscribeWheel()
      unsubscribeInvitations()
    }
  }, [wheelId])

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Invite Wheel Collaborators
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="collaborator-email">Organizer Email Address</Label>
            <div className="flex gap-2">
              <div className="flex-1 space-y-2">
                <Input
                  id="collaborator-email"
                  type="email"
                  placeholder="organizer@example.com"
                  value={collaboratorEmail}
                  onChange={(e) => handleEmailChange(e.target.value)}
                  className={emailValidation?.isValid === false ? "border-red-500" : emailValidation?.isValid ? "border-green-500" : ""}
                />
                {validatingEmail && (
                  <div className="flex items-center gap-2 text-sm text-blue-600">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Validating organizer email...
                  </div>
                )}
                {emailValidation && (
                  <div className={`flex items-center gap-2 text-sm ${
                    emailValidation.isValid ? "text-green-600" : "text-red-600"
                  }`}>
                    {emailValidation.isValid ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <X className="h-4 w-4" />
                    )}
                    {emailValidation.message}
                  </div>
                )}
              </div>
              <Button
                onClick={handleAddCollaborator}
                disabled={loading || !emailValidation?.isValid || validatingEmail}
                className="bg-swu-red hover:bg-swu-red/90 text-white"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Mail className="h-4 w-4 mr-2" />
                    Send Invite
                  </>
                )}
              </Button>
            </div>
          </div>
          
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              <Crown className="h-4 w-4 inline mr-1" />
              <strong>Collaboration Features:</strong>
            </p>
            <ul className="text-xs text-blue-700 mt-2 space-y-1 ml-4">
              <li>• Both organizers can control live wheel sessions together</li>
              <li>• Shared access to wheel editing and participant management</li>
              <li>• Real-time notifications on both web and mobile apps</li>
              <li>• Automatic conflict prevention for simultaneous control</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Pending Invitations */}
      {pendingInvitations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Pending Invitations ({pendingInvitations.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pendingInvitations.map((invitation) => (
                <div key={invitation.id} className="flex items-center justify-between p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex-1">
                    <div className="font-medium text-yellow-800">
                      {invitation.invitedOrganizerName}
                    </div>
                    <div className="text-sm text-yellow-600">
                      {invitation.invitedOrganizerEmail}
                    </div>
                    <div className="text-xs text-yellow-500">
                      Invited {new Date(invitation.createdAt?.toDate?.() || invitation.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                    Pending
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Existing Collaborators */}
      {existingCollaborators.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Active Collaborators ({existingCollaborators.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {existingCollaborators.map((collaborator, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex-1">
                    <div className="font-medium text-green-800">{collaborator}</div>
                    <div className="text-xs text-green-600">
                      Can control live sessions and edit wheel
                    </div>
                  </div>
                  <Badge variant="default" className="bg-green-600">
                    Active
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {existingCollaborators.length === 0 && pendingInvitations.length === 0 && (
        <div className="text-center p-6 bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl">
          <Users className="h-12 w-12 text-gray-400 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Collaborators Yet</h3>
          <p className="text-gray-600 text-sm">
            Invite other organizers to collaborate on this wheel. They'll be able to control live sessions and manage the wheel together with you.
          </p>
        </div>
      )}
    </div>
  )
}
