// Network utilities for cross-platform and network access
// Handles dynamic URL detection for local network deployment

export interface NetworkConfig {
  baseUrl: string
  networkUrl: string
  isLocalNetwork: boolean
  isProduction: boolean
}

// Get the current network configuration
export const getNetworkConfig = (): NetworkConfig => {
  if (typeof window === 'undefined') {
    // Server-side: use environment variables or defaults
    return {
      baseUrl: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      networkUrl: process.env.NEXT_PUBLIC_NETWORK_URL || 'http://169.254.83.107:3000',
      isLocalNetwork: true,
      isProduction: false
    }
  }

  // Client-side: detect current URL
  const currentUrl = window.location.origin
  const hostname = window.location.hostname
  
  // Check if we're on localhost
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1'
  
  // Check if we're on a local network IP
  const isLocalNetwork = hostname.startsWith('192.168.') || 
                         hostname.startsWith('10.') || 
                         hostname.startsWith('172.') ||
                         hostname.startsWith('169.254.') ||
                         isLocalhost

  // Check if we're in production
  const isProduction = hostname.includes('.com') || 
                      hostname.includes('.net') || 
                      hostname.includes('.org') ||
                      process.env.NODE_ENV === 'production'

  return {
    baseUrl: currentUrl,
    networkUrl: currentUrl,
    isLocalNetwork,
    isProduction
  }
}

// Get the correct URL for sharing and QR codes
export const getShareableUrl = (path: string = ''): string => {
  const config = getNetworkConfig()
  
  // For production, use the production URL
  if (config.isProduction) {
    return `${config.baseUrl}${path}`
  }
  
  // For local network, use the network URL
  if (config.isLocalNetwork) {
    // If we're on localhost, try to use the network IP
    if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
      const networkUrl = process.env.NEXT_PUBLIC_NETWORK_URL || 'http://169.254.83.107:3001'
      return `${networkUrl}${path}`
    }
    return `${config.baseUrl}${path}`
  }
  
  return `${config.baseUrl}${path}`
}

// Generate QR code URL with network-accessible link
export const generateQRCodeUrl = (path: string, size: number = 256): string => {
  const shareableUrl = getShareableUrl(path)
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(shareableUrl)}`
}

// Generate join URL for students
export const generateJoinUrl = (roomCode: string): string => {
  return getShareableUrl(`/join?code=${roomCode}`)
}

// Generate live session URL
export const generateLiveSessionUrl = (sessionId: string, studentName?: string): string => {
  const basePath = `/live/${sessionId}`
  const path = studentName ? `${basePath}?name=${encodeURIComponent(studentName)}` : basePath
  return getShareableUrl(path)
}

// Check if current environment supports network access
export const supportsNetworkAccess = (): boolean => {
  if (typeof window === 'undefined') return true
  
  const config = getNetworkConfig()
  return config.isLocalNetwork || config.isProduction
}

// Get network status information
export const getNetworkStatus = () => {
  const config = getNetworkConfig()
  
  return {
    ...config,
    currentHost: typeof window !== 'undefined' ? window.location.hostname : 'unknown',
    currentPort: typeof window !== 'undefined' ? window.location.port : 'unknown',
    protocol: typeof window !== 'undefined' ? window.location.protocol : 'http:',
    isSecure: typeof window !== 'undefined' ? window.location.protocol === 'https:' : false,
    userAgent: typeof window !== 'undefined' ? navigator.userAgent : 'server',
    supportsWebRTC: typeof window !== 'undefined' && 'RTCPeerConnection' in window,
    supportsWebSocket: typeof window !== 'undefined' && 'WebSocket' in window
  }
}

// Log network configuration for debugging
export const logNetworkConfig = () => {
  const status = getNetworkStatus()
  console.log('🌐 Network Configuration:', {
    baseUrl: status.baseUrl,
    networkUrl: status.networkUrl,
    currentHost: status.currentHost,
    isLocalNetwork: status.isLocalNetwork,
    isProduction: status.isProduction,
    isSecure: status.isSecure,
    supportsWebRTC: status.supportsWebRTC,
    supportsWebSocket: status.supportsWebSocket
  })
  
  return status
}

// Validate network connectivity
export const validateNetworkConnectivity = async (): Promise<boolean> => {
  try {
    const config = getNetworkConfig()
    console.log('🔍 Network connectivity check: Attempting to fetch', `${config.baseUrl}/api/health`)

    const response = await fetch(`${config.baseUrl}/api/health`, {
      method: 'HEAD',
      mode: 'no-cors',
      cache: 'no-cache'
    })

    console.log('✅ Network connectivity check: Success, status:', response.status)
    return true
  } catch (error) {
    console.error('❌ Network connectivity check failed:', {
      error: error,
      errorType: error instanceof TypeError ? 'TypeError' : typeof error,
      errorMessage: error instanceof Error ? error.message : String(error),
      url: `${getNetworkConfig().baseUrl}/api/health`,
      timestamp: new Date().toISOString()
    })

    // Check if this is the specific "Network request failed" error
    if (error instanceof TypeError && error.message === 'Network request failed') {
      console.error('🚨 CRITICAL: "Network request failed" error detected. This typically indicates:')
      console.error('   - CORS issues')
      console.error('   - Network connectivity problems')
      console.error('   - Server not responding')
      console.error('   - Invalid URL or port')
    }

    return false
  }
}

// Get recommended URLs for different use cases
export const getRecommendedUrls = () => {
  const config = getNetworkConfig()
  
  return {
    // For teachers accessing the admin interface
    teacherUrl: config.baseUrl,
    
    // For students joining sessions
    studentJoinUrl: getShareableUrl('/join'),
    
    // For QR codes and sharing
    shareableBaseUrl: getShareableUrl(),
    
    // For mobile app deep links
    mobileAppUrl: `cobypicks://join`,
    
    // For development testing
    testUrls: [
      `${config.baseUrl}/test-live`,
      getShareableUrl('/join'),
      getShareableUrl('/live/test')
    ]
  }
}

export default {
  getNetworkConfig,
  getShareableUrl,
  generateQRCodeUrl,
  generateJoinUrl,
  generateLiveSessionUrl,
  supportsNetworkAccess,
  getNetworkStatus,
  logNetworkConfig,
  validateNetworkConnectivity,
  getRecommendedUrls
}
