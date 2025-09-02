// Mobile App Integration for Cross-Platform Live Sessions
// Handles deep links, app communication, and real-time synchronization

export interface AppMessage {
  type: 'JOIN_SESSION' | 'SESSION_UPDATE' | 'WHEEL_SPIN' | 'WINNER_SELECTED' | 'CONNECTION_STATUS'
  data: any
  timestamp: number
}

export interface SessionData {
  sessionId: string
  roomCode: string
  wheelType: string
  wheelTitle: string
  participants: Array<{ id: string; name: string }>
  isActive: boolean
  currentState: string
  teacherPresence: {
    isOnline: boolean
    lastSeen: Date
  }
}

// Deep link URL schemes for mobile app
export const APP_SCHEMES = {
  MAIN: 'cobypicks://',
  JOIN: 'cobypicks://join',
  LIVE: 'cobypicks://live',
  ROOM: 'cobypicks://room'
}

// Platform detection
export const detectPlatform = (): 'web' | 'mobile' | 'app' => {
  if (typeof window === 'undefined') return 'web'
  
  const userAgent = navigator.userAgent.toLowerCase()
  const isApp = window.location.protocol === 'cobypicks:' || 
                window.location.href.includes('app://') ||
                (window as any).ReactNativeWebView !== undefined
  
  if (isApp) return 'app'
  if (userAgent.includes('mobile') || userAgent.includes('android') || userAgent.includes('iphone')) {
    return 'mobile'
  }
  return 'web'
}

// Generate deep link URLs for mobile app
export const generateDeepLink = (type: 'join' | 'live', params: Record<string, string>): string => {
  const baseUrl = type === 'join' ? APP_SCHEMES.JOIN : APP_SCHEMES.LIVE
  const queryString = new URLSearchParams(params).toString()
  return `${baseUrl}?${queryString}`
}

// Generate universal link that works on both web and app
export const generateUniversalLink = (sessionId: string, roomCode: string, studentName?: string): {
  webUrl: string
  appUrl: string
  qrCodeData: string
} => {
  const baseWebUrl = typeof window !== 'undefined' ? window.location.origin : 'https://cobypicks.com'
  
  const webUrl = studentName 
    ? `${baseWebUrl}/live/${sessionId}?name=${encodeURIComponent(studentName)}`
    : `${baseWebUrl}/join?code=${roomCode}`
  
  const appUrl = studentName
    ? generateDeepLink('live', { sessionId, name: studentName })
    : generateDeepLink('join', { code: roomCode })
  
  // QR code should contain web URL with app fallback
  const qrCodeData = `${webUrl}&app=${encodeURIComponent(appUrl)}`
  
  return { webUrl, appUrl, qrCodeData }
}

// Send message to mobile app (if running in WebView)
export const sendMessageToApp = (message: AppMessage): void => {
  try {
    // React Native WebView communication
    if ((window as any).ReactNativeWebView) {
      (window as any).ReactNativeWebView.postMessage(JSON.stringify(message))
    }
    
    // Cordova/PhoneGap communication
    if ((window as any).cordova) {
      (window as any).cordova.exec(
        null, null, 'CobyPicksPlugin', 'handleMessage', [message]
      )
    }
    
    // Custom app bridge
    if ((window as any).CobyPicksApp) {
      (window as any).CobyPicksApp.handleMessage(message)
    }
    
    console.log('📱 Message sent to app:', message)
  } catch (error) {
    console.error('Error sending message to app:', error)
  }
}

// Listen for messages from mobile app
export const listenForAppMessages = (callback: (message: AppMessage) => void): (() => void) => {
  const handleMessage = (event: MessageEvent) => {
    try {
      const message = JSON.parse(event.data) as AppMessage
      callback(message)
    } catch (error) {
      console.error('Error parsing app message:', error)
    }
  }
  
  // Listen for WebView messages
  window.addEventListener('message', handleMessage)
  
  // Listen for custom app events
  const handleAppEvent = (event: CustomEvent) => {
    callback(event.detail as AppMessage)
  }
  
  window.addEventListener('cobypicks-app-message', handleAppEvent as EventListener)
  
  // Cleanup function
  return () => {
    window.removeEventListener('message', handleMessage)
    window.removeEventListener('cobypicks-app-message', handleAppEvent as EventListener)
  }
}

// Create QR code with app support
export const createQRCodeWithAppSupport = (sessionId: string, roomCode: string): string => {
  const { qrCodeData } = generateUniversalLink(sessionId, roomCode)
  return `https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(qrCodeData)}`
}

// Handle app installation prompts
export const promptAppInstall = (): void => {
  const platform = detectPlatform()
  
  if (platform === 'mobile') {
    const userAgent = navigator.userAgent.toLowerCase()
    let storeUrl = ''
    
    if (userAgent.includes('android')) {
      storeUrl = 'https://play.google.com/store/apps/details?id=com.cobypicks.app'
    } else if (userAgent.includes('iphone') || userAgent.includes('ipad')) {
      storeUrl = 'https://apps.apple.com/app/cobypicks/id123456789'
    }
    
    if (storeUrl) {
      const shouldInstall = confirm(
        'For the best experience, install the CobyPicks mobile app. Would you like to download it now?'
      )
      
      if (shouldInstall) {
        window.open(storeUrl, '_blank')
      }
    }
  }
}

// Real-time session synchronization for apps
export const syncSessionWithApp = (sessionData: SessionData): void => {
  const message: AppMessage = {
    type: 'SESSION_UPDATE',
    data: sessionData,
    timestamp: Date.now()
  }
  
  sendMessageToApp(message)
}

// Handle connection status updates
export const updateConnectionStatus = (isConnected: boolean, sessionId?: string): void => {
  const message: AppMessage = {
    type: 'CONNECTION_STATUS',
    data: { isConnected, sessionId },
    timestamp: Date.now()
  }
  
  sendMessageToApp(message)
}

// Enhanced mobile app detection and integration
export const enhancedMobileDetection = (): {
  platform: 'web' | 'mobile' | 'app';
  capabilities: string[];
  recommendedAction: string;
} => {
  const platform = detectPlatform()
  const capabilities: string[] = []
  let recommendedAction = ''

  // Check for app capabilities
  if ((window as any).ReactNativeWebView) {
    capabilities.push('webview', 'native-bridge', 'push-notifications')
    recommendedAction = 'Use native app features'
  } else if (platform === 'mobile') {
    capabilities.push('web-browser', 'responsive-design')
    recommendedAction = 'Suggest app installation'
  } else {
    capabilities.push('desktop-browser', 'full-features')
    recommendedAction = 'Use full web experience'
  }

  // Check for PWA capabilities
  if ('serviceWorker' in navigator) {
    capabilities.push('pwa-support')
  }

  // Check for notification support
  if ('Notification' in window) {
    capabilities.push('web-notifications')
  }

  return { platform, capabilities, recommendedAction }
}

// Sync session data between platforms
export const syncCrossPlatformSession = async (sessionData: SessionData): Promise<void> => {
  try {
    // Send to mobile app if available
    syncSessionWithApp(sessionData)

    // Store in localStorage for web persistence
    if (typeof window !== 'undefined') {
      localStorage.setItem('cobypicks-current-session', JSON.stringify({
        ...sessionData,
        lastSync: Date.now()
      }))
    }

    // Broadcast to other tabs/windows
    if (typeof window !== 'undefined' && window.BroadcastChannel) {
      const channel = new BroadcastChannel('cobypicks-session')
      channel.postMessage({
        type: 'SESSION_SYNC',
        data: sessionData,
        timestamp: Date.now()
      })
    }
  } catch (error) {
    console.error('Error syncing cross-platform session:', error)
  }
}

// Handle universal link clicks
export const handleUniversalLink = (url: string): boolean => {
  try {
    const urlObj = new URL(url)
    const platform = detectPlatform()

    // Extract parameters
    const sessionId = urlObj.pathname.split('/').pop()
    const roomCode = urlObj.searchParams.get('code')
    const studentName = urlObj.searchParams.get('name')
    const appUrl = urlObj.searchParams.get('app')

    // Try to open in app first if on mobile
    if (platform === 'mobile' && appUrl) {
      window.location.href = decodeURIComponent(appUrl)

      // Fallback to web after delay
      setTimeout(() => {
        window.location.href = url
      }, 2000)

      return true
    }

    // Handle web navigation
    if (sessionId && studentName) {
      window.location.href = `/live/${sessionId}?name=${encodeURIComponent(studentName)}`
    } else if (roomCode) {
      window.location.href = `/join?code=${roomCode}`
    }

    return true
  } catch (error) {
    console.error('Error handling universal link:', error)
    return false
  }
}

// Export all utilities
export default {
  detectPlatform,
  generateDeepLink,
  generateUniversalLink,
  sendMessageToApp,
  listenForAppMessages,
  createQRCodeWithAppSupport,
  promptAppInstall,
  syncSessionWithApp,
  updateConnectionStatus,
  enhancedMobileDetection,
  syncCrossPlatformSession,
  handleUniversalLink,
  APP_SCHEMES
}
