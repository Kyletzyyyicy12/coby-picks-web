import { db } from './firebase';
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDoc,
  getDocs,
  query,
  where,
  onSnapshot,
  setDoc,
  Timestamp
} from 'firebase/firestore';

export interface UniversalSession {
  id: string;
  roomCode: string;
  wheelId?: string;
  wheelName: string;
  wheelData?: any;
  activityId?: string;
  createdBy: string;
  createdAt: any;
  isActive: boolean;
  isLive: boolean;
  platform: 'web' | 'mobile' | 'both';
  viewerCount: number;
  lastUpdated: any;
  settings: {
    allowComments: boolean;
    allowReactions: boolean;
    isShared: boolean;
    crossPlatformEnabled: boolean;
  };
  urls: {
    webUrl: string;
    mobileUrl: string;
    qrCodeUrl: string;
    deepLinkUrl: string;
  };
  metadata: {
    version: string;
    compatibility: string[];
    features: string[];
  };
  
  // Enhanced session properties for live sessions
  currentState?: 'waiting' | 'spinning' | 'completed';
  participants?: any[];
  winners?: any[];
  selectedWheelType?: any;
  wheelItems?: string[];
  
  // Enhanced wheel state for real-time synchronization
  wheelState?: {
    isSpinning: boolean;
    spinStartTime?: number;
    spinDuration?: number;
    totalRotation?: number;
    finalAngle?: number;
    currentAngle?: number;
    progress?: number;
    startedAt?: any;
    completedAt?: any;
    hasResults?: boolean;
  };
  
  // Real-time notifications
  spinningNotification?: {
    message: string;
    timestamp: any;
    isActive: boolean;
  };
  
  resultNotification?: {
    message: string;
    winners: any[];
    timestamp: any;
    isActive: boolean;
    showConfetti: boolean;
  };
  
  // Enhanced theme synchronization for cross-platform consistency
  themeConfig?: {
    organizerTheme: string; // Theme name selected by organizer
    customColors?: {
      primary: string;
      secondary: string;
      background: string;
      surface: string;
      text: string;
      accent: string;
    };
    wheelTheme?: string; // Selected wheel theme (school, vibrant, etc.)
    syncEnabled: boolean; // Whether to sync theme to participants
    lastThemeUpdate?: any; // Timestamp of last theme change
  };
}

export interface SessionViewer {
  id: string;
  name: string;
  platform: 'web' | 'mobile' | 'app';
  joinedAt: any;
  lastSeen: any;
  isActive: boolean;
  connectionId: string;
  userAgent?: string;
}

class CrossPlatformSessionManager {
  private static instance: CrossPlatformSessionManager;
  private activeListeners: Map<string, () => void> = new Map();

  static getInstance(): CrossPlatformSessionManager {
    if (!CrossPlatformSessionManager.instance) {
      CrossPlatformSessionManager.instance = new CrossPlatformSessionManager();
    }
    return CrossPlatformSessionManager.instance;
  }

  // Generate universal room code (alphanumeric, 6 characters)
  generateRoomCode(): string {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const numbers = '0123456789';
    const allChars = letters + numbers;

    let result = '';

    // Generate code with guaranteed mix
    for (let i = 0; i < 6; i++) {
      const char = allChars.charAt(Math.floor(Math.random() * allChars.length));
      result += char;
    }

    // Ensure we have at least 2 numbers and 2 letters for better mix
    const numberCount = (result.match(/\d/g) || []).length;
    const letterCount = (result.match(/[A-Z]/g) || []).length;

    if (numberCount < 2 || letterCount < 2) {
      // Regenerate with better distribution
      const positions = [0, 1, 2, 3, 4, 5];
      result = '';

      // Place at least 2 numbers and 2 letters
      const numberPositions: number[] = [];
      const letterPositions: number[] = [];

      // Select positions for numbers
      while (numberPositions.length < 2) {
        const pos = positions.splice(Math.floor(Math.random() * positions.length), 1)[0];
        numberPositions.push(pos);
      }

      // Select positions for letters
      while (letterPositions.length < 2) {
        const pos = positions.splice(Math.floor(Math.random() * positions.length), 1)[0];
        letterPositions.push(pos);
      }

      // Fill remaining positions randomly
      for (let i = 0; i < 6; i++) {
        if (numberPositions.includes(i)) {
          result += numbers.charAt(Math.floor(Math.random() * numbers.length));
        } else if (letterPositions.includes(i)) {
          result += letters.charAt(Math.floor(Math.random() * letters.length));
        } else {
          result += allChars.charAt(Math.floor(Math.random() * allChars.length));
        }
      }
    }

    return result;
  }

  // Create universal session that works on both platforms
  async createUniversalSession(
    wheelData: any,
    createdBy: string,
    platform: 'web' | 'mobile' = 'web',
    activityId?: string
  ): Promise<UniversalSession> {
    const roomCode = this.generateRoomCode();
    
    // Ensure unique room code
    const existingSession = await this.findSessionByRoomCode(roomCode);
    if (existingSession) {
      return this.createUniversalSession(wheelData, createdBy, platform, activityId);
    }

    const baseUrl = this.getBaseUrl();
    const sessionData: Omit<UniversalSession, 'id'> = {
      roomCode,
      wheelId: wheelData.id,
      wheelName: wheelData.name || 'Untitled Wheel',
      wheelData,
      activityId,
      createdBy,
      createdAt: Timestamp.fromDate(new Date()),
      isActive: true,
      isLive: true,
      platform: 'both', // Always enable both platforms
      viewerCount: 0,
      lastUpdated: Timestamp.fromDate(new Date()),
      settings: {
        allowComments: true,
        allowReactions: true,
        isShared: true,
        crossPlatformEnabled: true,
      },
      urls: {
        webUrl: `${baseUrl}/live/session/${roomCode}`,
        mobileUrl: `cobypicks://join?code=${roomCode}`,
        qrCodeUrl: `${baseUrl}/join?code=${roomCode}`,
        deepLinkUrl: `cobypicks://live?code=${roomCode}`,
      },
      metadata: {
        version: '2.0.0',
        compatibility: ['web', 'mobile', 'app'],
        features: ['real-time', 'cross-platform', 'qr-code', 'deep-link'],
      },
    };

    // Create session in liveDrawSessions collection
    console.log('🔍 DEBUG: Session data before addDoc:', JSON.stringify(sessionData, null, 2));

    // Validate no undefined values
    const validateData = (obj: any, path = ''): boolean => {
      for (const [key, value] of Object.entries(obj)) {
        const currentPath = path ? `${path}.${key}` : key;
        if (value === undefined) {
          console.error(`❌ Found undefined value at: ${currentPath}`);
          return false;
        }
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          if (!validateData(value, currentPath)) return false;
        }
      }
      return true;
    };

    if (!validateData(sessionData)) {
      throw new Error('Session data contains undefined values');
    }

    const docRef = await addDoc(collection(db, 'liveDrawSessions'), sessionData);
    
    // Also update the wheel document if it exists
    if (wheelData.id) {
      try {
        await updateDoc(doc(db, 'wheels', wheelData.id), {
          live: true,
          liveJoinCode: roomCode,
          liveSessionStartedAt: Timestamp.fromDate(new Date()),
          crossPlatformSession: docRef.id,
        });
      } catch (error) {
        console.log('Could not update wheel document:', error);
      }
    }

    // Update activity if provided
    if (activityId) {
      try {
        await updateDoc(doc(db, 'drawActivities', activityId), {
          isLive: true,
          liveSessionId: docRef.id,
          roomCode,
          crossPlatformEnabled: true,
          updatedAt: Timestamp.fromDate(new Date()),
        });
      } catch (error) {
        console.log('Could not update activity:', error);
      }
    }

    return { id: docRef.id, ...sessionData } as UniversalSession;
  }

  // Find session by room code (works for both platforms)
  async findSessionByRoomCode(roomCode: string): Promise<UniversalSession | null> {
    try {
      // Normalize to 6-character alphanumeric code
      const alphanumericCode = String(roomCode).replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 6);
      if (alphanumericCode.length !== 6) return null;

      // Check liveDrawSessions first
      const sessionsQuery = query(
        collection(db, 'liveDrawSessions'),
        where('roomCode', '==', alphanumericCode),
        where('isActive', '==', true)
      );
      
      const sessionsSnapshot = await getDocs(sessionsQuery);
      
      if (!sessionsSnapshot.empty) {
        const doc = sessionsSnapshot.docs[0];
        return { id: doc.id, ...doc.data() } as UniversalSession;
      }

      // Fallback: Check wheels collection
      const wheelsQuery = query(
        collection(db, 'wheels'),
        where('liveJoinCode', '==', alphanumericCode),
        where('live', '==', true)
      );
      
      const wheelsSnapshot = await getDocs(wheelsQuery);
      
      if (!wheelsSnapshot.empty) {
        const wheelDoc = wheelsSnapshot.docs[0];
        const wheelData = wheelDoc.data();
        
        // Create a universal session from wheel data
        return {
          id: wheelDoc.id,
          roomCode: alphanumericCode,
          wheelId: wheelDoc.id,
          wheelName: wheelData.name || 'Untitled Wheel',
          wheelData,
          createdBy: wheelData.userId || 'unknown',
          createdAt: wheelData.liveSessionStartedAt || new Date(),
          isActive: true,
          isLive: true,
          platform: 'both',
          viewerCount: 0,
          lastUpdated: new Date(),
          settings: {
            allowComments: true,
            allowReactions: true,
            isShared: true,
            crossPlatformEnabled: true,
          },
          urls: {
            webUrl: `${this.getBaseUrl()}/live/session/${alphanumericCode}`,
            mobileUrl: `cobypicks://join?code=${alphanumericCode}`,
            qrCodeUrl: `${this.getBaseUrl()}/join?code=${alphanumericCode}`,
            deepLinkUrl: `cobypicks://live?code=${alphanumericCode}`,
          },
          metadata: {
            version: '2.0.0',
            compatibility: ['web', 'mobile', 'app'],
            features: ['real-time', 'cross-platform', 'qr-code', 'deep-link'],
          },
        } as UniversalSession;
      }

      return null;
    } catch (error) {
      console.error('Error finding session by room code:', error);
      return null;
    }
  }

  // Add viewer to session (cross-platform)
  async addViewer(
    sessionId: string, 
    viewerName: string, 
    platform: 'web' | 'mobile' | 'app'
  ): Promise<string> {
    const viewerId = `viewer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const viewerData: SessionViewer = {
      id: viewerId,
      name: viewerName,
      platform,
      joinedAt: Timestamp.fromDate(new Date()),
      lastSeen: Timestamp.fromDate(new Date()),
      isActive: true,
      connectionId: viewerId,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
    };

    await setDoc(
      doc(db, 'liveDrawSessions', sessionId, 'viewers', viewerId),
      viewerData
    );

    // Update viewer count
    await this.updateViewerCount(sessionId);

    return viewerId;
  }

  // Update viewer count with better error handling and retry logic
  private async updateViewerCount(sessionId: string): Promise<void> {
    try {
      const viewersSnapshot = await getDocs(
        collection(db, 'liveDrawSessions', sessionId, 'viewers')
      );

      const activeViewers = viewersSnapshot.docs.filter(
        (doc: any) => doc.data().isActive
      ).length;

      // Use a more robust update that handles concurrent modifications
      const sessionRef = doc(db, 'liveDrawSessions', sessionId);
      const sessionDoc = await getDoc(sessionRef);

      if (sessionDoc.exists()) {
        const updateData: any = {
          viewerCount: activeViewers,
          lastUpdated: Timestamp.fromDate(new Date()),
        };

        // Only update viewerCount and lastUpdated to avoid permission conflicts
        // with other concurrent updates (like wheel spinning, theme changes, etc.)
        await updateDoc(sessionRef, updateData);
        console.log(`✅ Updated viewer count to ${activeViewers} for session ${sessionId}`);
      }
    } catch (error) {
      console.error('❌ Error updating viewer count:', error);

      // If it's a permission error, try a more targeted approach
      if (error instanceof Error && error.message.includes('Missing or insufficient permissions')) {
        console.log('🔄 Retrying viewer count update with minimal fields...');
        try {
          // Recalculate active viewers for retry
          const retryViewersSnapshot = await getDocs(
            collection(db, 'liveDrawSessions', sessionId, 'viewers')
          );
          const retryActiveViewers = retryViewersSnapshot.docs.filter(
            (doc: any) => doc.data().isActive
          ).length;

          // Retry with only the essential fields to avoid conflicts
          await updateDoc(doc(db, 'liveDrawSessions', sessionId), {
            viewerCount: retryActiveViewers,
            lastUpdated: Timestamp.fromDate(new Date()),
          });
          console.log(`✅ Retry successful: Updated viewer count to ${retryActiveViewers}`);
        } catch (retryError) {
          console.error('❌ Retry also failed:', retryError);
        }
      }
    }
  }

  // Listen to session updates (cross-platform)
  listenToSession(
    sessionId: string, 
    callback: (session: UniversalSession | null) => void
  ): () => void {
    const unsubscribe = onSnapshot(
      doc(db, 'liveDrawSessions', sessionId),
      (doc) => {
        if (doc.exists()) {
          callback({ id: doc.id, ...doc.data() } as UniversalSession);
        } else {
          callback(null);
        }
      },
      (error) => {
        console.error('Session listener error:', error);
        callback(null);
      }
    );

    this.activeListeners.set(sessionId, unsubscribe);
    return unsubscribe;
  }

  // End session (cross-platform)
  async endSession(sessionId: string): Promise<void> {
    try {
      // Update session with clear end signals for participants
      await updateDoc(doc(db, 'liveDrawSessions', sessionId), {
        isActive: false,
        isLive: false,
        endedAt: Timestamp.fromDate(new Date()),
        lastUpdated: Timestamp.fromDate(new Date()),
        endedExplicitly: true, // Flag to indicate organizer explicitly ended the session
        currentState: 'completed',
        // Ensure teacher presence is marked as offline
        'teacherPresence.isOnline': false,
        'teacherPresence.lastSeen': Timestamp.fromDate(new Date()),
        // Add session end notification
        sessionEndNotification: {
          message: 'This live session has been ended by the organizer',
          timestamp: Timestamp.fromDate(new Date()),
          isActive: true
        }
      });

      // Update associated wheel if exists
      const sessionDoc = await getDoc(doc(db, 'liveDrawSessions', sessionId));
      if (sessionDoc.exists()) {
        const sessionData = sessionDoc.data();
        if (sessionData.wheelId) {
          await updateDoc(doc(db, 'wheels', sessionData.wheelId), {
            live: false,
            liveJoinCode: null,
          });
        }
      }

      // Clean up listeners
      const unsubscribe = this.activeListeners.get(sessionId);
      if (unsubscribe) {
        unsubscribe();
        this.activeListeners.delete(sessionId);
      }

      console.log('✅ Session ended successfully:', sessionId);
    } catch (error) {
      console.error('Error ending session:', error);
      throw error;
    }
  }

  // Get base URL for the current environment
  private getBaseUrl(): string {
    if (typeof window !== 'undefined') {
      return window.location.origin;
    }
    return 'https://cobypicks.com'; // Default production URL
  }

  // Generate QR code data that works for both platforms
  generateUniversalQRCode(roomCode: string): string {
    const baseUrl = this.getBaseUrl();
    const webUrl = `${baseUrl}/join?code=${roomCode}`;
    const appUrl = `cobypicks://join?code=${roomCode}`;
    
    // QR code contains web URL with app fallback
    return `${webUrl}&app=${encodeURIComponent(appUrl)}`;
  }

  // Clean up all listeners
  cleanup(): void {
    this.activeListeners.forEach(unsubscribe => unsubscribe());
    this.activeListeners.clear();
  }

  // Theme synchronization methods for cross-platform consistency
  async updateSessionTheme(sessionId: string, themeConfig: {
    organizerTheme: string;
    customColors?: {
      primary: string;
      secondary: string;
      background: string;
      surface: string;
      text: string;
      accent: string;
    };
    wheelTheme?: string;
    syncEnabled?: boolean;
  }): Promise<void> {
    try {
      await updateDoc(doc(db, 'liveDrawSessions', sessionId), {
        'themeConfig.organizerTheme': themeConfig.organizerTheme,
        'themeConfig.customColors': themeConfig.customColors || null,
        'themeConfig.wheelTheme': themeConfig.wheelTheme || 'school',
        'themeConfig.syncEnabled': themeConfig.syncEnabled !== false,
        'themeConfig.lastThemeUpdate': Timestamp.fromDate(new Date()),
        lastUpdated: Timestamp.fromDate(new Date()),
      });
      console.log('✅ Theme updated for session:', sessionId);
    } catch (error) {
      console.error('❌ Error updating session theme:', error);
      throw error;
    }
  }

  // Get current theme for a session
  async getSessionTheme(sessionId: string): Promise<any> {
    try {
      const sessionDoc = await getDoc(doc(db, 'liveDrawSessions', sessionId));
      if (sessionDoc.exists()) {
        const data = sessionDoc.data();
        return data.themeConfig || {
          organizerTheme: 'light',
          wheelTheme: 'school',
          syncEnabled: true,
        };
      }
      return null;
    } catch (error) {
      console.error('Error getting session theme:', error);
      return null;
    }
  }
}

export default CrossPlatformSessionManager.getInstance();
