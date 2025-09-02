 rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Helpers
    function isAuthenticated() {
      return request.auth != null;
    }

    function getUserRole() {
      return isAuthenticated() && exists(/databases/$(database)/documents/users/$(request.auth.uid))
        ? get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role
        : 'participant';
    }

    function isAdmin() {
      return isAuthenticated() && (
        getUserRole() == 'admin' ||
        isHardcodedAdmin()
      );
    }

    function isOrganizer() {
      return isAuthenticated() && getUserRole() == 'organizer';
    }

    function isParticipant() {
      return isAuthenticated() && getUserRole() == 'participant';
    }

    function isOrganizerOrAdmin() {
      return isOrganizer() || isAdmin();
    }

    function isOrganizerOrTeacher() {
      return isOrganizer() || isAdmin();
    }

    function isSuperAdmin() {
      return isAuthenticated() && (
        request.auth.token.email == 'superadmin@cobypicks.com' ||
        request.auth.token.email == 'admin@cobypicks.com'
      );
    }

    function isHardcodedAdmin() {
      return isAuthenticated() && (
        request.auth.token.email == 'superadmin@cobypicks.com' ||
        request.auth.token.email == 'admin@cobypicks.com'
      );
    }

    // Users - Enhanced security for role management
    match /users/{userId} {
      // Allow all authenticated users to read all user profiles (needed for active users list)
      allow read: if isAuthenticated();
      
      // SECURITY: Allow write for own profile BUT prevent role changes
      allow write: if isAuthenticated() && request.auth.uid == userId &&
                   (!('role' in request.resource.data.diff(resource.data).affectedKeys()) &&
                    !('roleLocked' in request.resource.data.diff(resource.data).affectedKeys()) &&
                    !('roleChangedBy' in request.resource.data.diff(resource.data).affectedKeys()) &&
                    !('roleChangeHistory' in request.resource.data.diff(resource.data).affectedKeys()));
      
      allow create: if isAuthenticated();
      // Admin override - admins can modify any user including roles
      allow read, write: if isAdmin();
    }

    // Participants - only organizers can manage participants they created
    match /participants/{participantId} {
      // Participants can read their own data
      allow read: if isAuthenticated() && request.auth.uid == resource.data.userId;
      // Organizers can read all participants they created
      allow read: if isAuthenticated() && isOrganizer() && request.auth.uid == resource.data.userId;
      // Admins can read all participants
      allow read: if isAdmin();
      // Only the creator can write to their own participants
      allow write: if isAuthenticated() && request.auth.uid == resource.data.userId;
      // Admins can write to any participant
      allow write: if isAdmin();
      // Anyone authenticated can create participants (for adding new ones)
      allow create: if isAuthenticated();
    }

    // Wheels (owner-based access is recommended; currently open to all authenticated)
    match /wheels/{wheelId} {
      // Owners can read and write their own wheels
      allow read, write: if isAuthenticated() && request.auth.uid == resource.data.userId;
      // Admins can read and write all wheels
      allow read, write: if isAdmin();

      // Participants can read wheels that are live
      allow read: if isParticipant() && resource.data.live == true;

      // Subcollections
      match /{subcollection=**}/{docId} {
        // Owners can read and write subcollections of their wheels
        allow read, write: if isAuthenticated() && get(/databases/$(database)/documents/wheels/$(wheelId)).data.userId == request.auth.uid;
        // Admins can read and write all subcollections
        // Participants can read comments and history of live wheels
        allow read: if isParticipant() && get(/databases/$(database)/documents/wheels/$(wheelId)).data.live == true &&
                     (subcollection == 'comments' || subcollection == 'history');
      }

      // Viewers subcollection for live sessions
      match /viewers/{viewerId} {
        allow read: if true;
        allow create: if isAuthenticated() || request.auth == null;
        allow update: if isAuthenticated() || request.auth == null;
        allow delete: if isAuthenticated() || request.auth == null;
      }
    }

    // Wheel Types
    match /wheelTypes/{wheelTypeId} {
      allow read: if isAuthenticated();
      allow write: if isAdmin();
    }

    // Wheel Spins
    match /wheelSpins/{spinId} {
      allow read: if isAuthenticated();
      allow create: if isOrganizerOrAdmin();
      allow update: if isAuthenticated();
      allow delete: if isOrganizerOrAdmin();
    }

    // Data Privacy Consent
    match /dataPrivacyConsent/{consentId} {
      allow read, write: if isAuthenticated();
      allow read: if isAdmin();
    }

    // Sent Notifications (admin only)
    match /sentNotifications/{notificationId} {
      allow read, write: if isAdmin();
    }

    // Topics/Projects
    match /topics/{topicId} {
      allow read, write: if isAuthenticated();
      allow read, write: if isAdmin();
    }
    match /projects/{projectId} {
      allow read, write: if isAuthenticated();
      allow read, write: if isAdmin();
    }

    // Admin-specific collections
    match /adminLogs/{logId} {
      allow read, write: if isAdmin();
    }

    match /systemSettings/{settingId} {
      allow read: if isAuthenticated();
      allow write: if isSuperAdmin();
    }

    // User activity tracking
    match /userActivity/{activityId} {
      allow create: if isAuthenticated() && request.auth.uid == resource.data.userId;
      allow read: if isAuthenticated() && (request.auth.uid == resource.data.userId || isAdmin());
    }

    // Announcements
    match /announcements/{announcementId} {
      allow create: if isAdmin();
      allow read: if isAuthenticated();
      allow update: if isAuthenticated() && (
        isAdmin() ||
        ("readBy" in request.resource.data.diff(resource.data).affectedKeys())
      );
      allow delete: if isAdmin();
    }

    // App sync
    match /appSyncData/{syncId} {
      allow read, write: if isAuthenticated();
      allow read, write: if isAdmin();
    }

    // Error logs
    match /errorLogs/{errorId} {
      allow create: if isAuthenticated();
      allow read: if isAdmin();
    }

    // Live Draw Sessions (cross-platform web/app realtime)
    match /liveDrawSessions/{sessionId} {
      // Read allowed for all authenticated users
      allow read: if isAuthenticated();

      // Create by any authenticated user
      allow create: if isAuthenticated();

      // Updates by authenticated users
      allow update: if isAuthenticated();

      allow delete: if isAuthenticated() && request.auth.uid == resource.data.createdBy;

      // Viewers subcollection (open reads; join while active)
      match /viewers/{viewerId} {
        allow read: if true;

        allow create: if isAuthenticated() ||
                       (request.auth == null &&
                        get(/databases/$(database)/documents/liveDrawSessions/$(sessionId)).data.isActive == true) ||
                       isParticipant();

        allow update: if isAuthenticated() ||
                       (request.auth == null &&
                        get(/databases/$(database)/documents/liveDrawSessions/$(sessionId)).data.isActive == true) ||
                       isAdmin() ||
                       isParticipant();

        allow delete: if isAuthenticated() && (
          request.auth.uid == resource.data.userId ||
          get(/databases/$(database)/documents/liveDrawSessions/$(sessionId)).data.createdBy == request.auth.uid ||
          isAdmin()
        ) ||
        (request.auth == null &&
         get(/databases/$(database)/documents/liveDrawSessions/$(sessionId)).data.isActive == true) ||
        isParticipant();
      }

      // Reactions subcollection
      match /reactions/{reactionId} {
        allow read: if true;

        allow create: if isAuthenticated() ||
                       (request.auth == null &&
                        get(/databases/$(database)/documents/liveDrawSessions/$(sessionId)).data.isActive == true);

        allow update, delete: if isAuthenticated() && (
          request.auth.uid == resource.data.userId ||
          get(/databases/$(database)/documents/liveDrawSessions/$(sessionId)).data.createdBy == request.auth.uid ||
          isAdmin()
        );
      }

      // Comments subcollection
      match /comments/{commentId} {
        allow read: if isAuthenticated() || isParticipant();
        allow create: if isAuthenticated() || isParticipant();
      }

      // Organizer/Teacher presence
      match /teacherActivity/{teacherId} {
        allow read: if isAuthenticated();
        allow create, update, delete: if isAuthenticated() && request.auth.uid == teacherId;
      }

      // Live draw data
      match /drawData/{dataId} {
        allow read: if isAuthenticated();
        allow write: if isOrganizerOrAdmin();
      }

      // Spin results
      match /spinResults/{resultId} {
        allow read: if isAuthenticated();
        allow create: if isAuthenticated();
        allow update, delete: if isOrganizerOrAdmin();
      }
    }

    // Real-time invitations used by NotificationContext
    match /liveInvitations/{invitationId} {
      // All authenticated users can read invitations
      allow read: if isAuthenticated();
      // Only organizers/teachers can create invitations
      allow create: if isAuthenticated();
      // All authenticated users can update invitations
      allow update: if isAuthenticated();
      // All authenticated users can delete invitations
      allow delete: if isAuthenticated();
    }

    // Fallback invitations used by LiveRoomScreen
    match /invitations/{invitationId} {
      allow read: if isAuthenticated() && (
        request.auth.uid == resource.data.studentId ||
        request.auth.uid == resource.data.invitedBy ||
        isAdmin()
      );
      allow create: if isOrganizerOrAdmin();
      allow update: if isAuthenticated() && (
        request.auth.uid == resource.data.studentId ||
        request.auth.uid == resource.data.invitedBy ||
        isAdmin()
      );
      allow delete: if isAuthenticated() && (
        request.auth.uid == resource.data.invitedBy || isAdmin()
      );
    }

    // Room Code Invitations
    match /roomCodeInvitations/{invitationId} {
      // All authenticated users can read invitations
      allow read: if isAuthenticated();
      // All authenticated users can create invitations
      allow create: if isAuthenticated();
      // All authenticated users can update invitations
      allow update: if isAuthenticated();
      // All authenticated users can delete invitations
      allow delete: if isAuthenticated();
    }

    // Draw Activities
    match /drawActivities/{activityId} {
      allow read: if isAuthenticated() && (
        request.auth.uid == resource.data.createdBy ||
        resource.data.isShared == true ||
        resource.data.settings.isShared == true ||
        isAdmin()
      );
      allow create: if isAuthenticated();
      allow update: if isAuthenticated() && (
        request.auth.uid == resource.data.createdBy ||
        resource.data.isShared == true ||
        resource.data.settings.isShared == true ||
        isAdmin()
      );
      allow delete: if isAuthenticated() && (
        request.auth.uid == resource.data.createdBy || isAdmin()
      );
    }

    // Participant Lists
    match /participantLists/{listId} {
      allow read, write: if isAuthenticated() && (
        request.auth.uid == resource.data.createdBy || isAdmin()
      );
    }

    // Draw Results
    match /drawResults/{resultId} {
      allow read: if isAuthenticated() && (
        request.auth.uid == resource.data.createdBy ||
        resource.data.isPublic == true ||
        isAdmin()
      );
      allow write: if isAuthenticated() && (
        request.auth.uid == resource.data.createdBy || isAdmin()
      );
    }

    // Privacy Consents
    match /privacyConsents/{consentId} {
      allow read, write: if isAuthenticated() && request.auth.uid == resource.data.userId;
      allow read: if isAdmin();
    }

    // Wheel Presets
    match /wheelPresets/{presetId} {
      allow read, write: if isAuthenticated() && (
        request.auth.uid == resource.data.createdBy || isAdmin()
      );
    }

    // Spin History
    match /spinHistory/{historyId} {
      allow read: if isAuthenticated() && (
        request.auth.uid == resource.data.createdBy || isAdmin()
      );
      allow create: if isAuthenticated();
      allow update, delete: if isAuthenticated() && (
        request.auth.uid == resource.data.createdBy || isAdmin()
      );
    }

    // Student Lists
    match /studentLists/{listId} {
      allow read, write: if isAuthenticated() && (
        request.auth.uid == resource.data.createdBy || isAdmin()
      );
      allow read: if isAdmin();
    }

    // Admin dashboard collections
    match /adminStats/{statId} {
      allow read, write: if isAdmin();
    }

    match /systemMetrics/{metricId} {
      allow read, write: if isAdmin();
    }

    match /userAnalytics/{analyticsId} {
      allow read: if isAdmin();
      allow create: if isAuthenticated();
    }

    match /activityAnalytics/{analyticsId} {
      allow read: if isAdmin();
      allow create: if isAuthenticated();
    }

    match /systemHealth/{healthId} {
      allow read, write: if isAdmin();
    }

    match /backupData/{backupId} {
      allow read, write: if isSuperAdmin();
    }

    match /auditLogs/{logId} {
      allow read: if isAdmin();
      allow create: if isAuthenticated();
    }

    match /performanceMetrics/{metricId} {
      allow read: if isAdmin();
      allow create: if isAuthenticated();
    }

    // Admin catch-alls
    match /{collection}/{document} {
      allow read: if isAdmin();
    }

    match /{collection}/{document}/{subcollection}/{subdocument} {
      allow read: if isAdmin();
    }

    // Block everything else
    match /{document=**} {
      allow read, write: if false;
    }
  }
}