"use client"

import { db, auth } from '@/lib/firebase'
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  Unsubscribe
} from 'firebase/firestore'
import { getAuth, onAuthStateChanged, signOut } from 'firebase/auth'

export interface FirebaseError {
  code: string
  message: string
  details?: any
}

export interface ConnectionStatus {
  isConnected: boolean
  lastError?: FirebaseError
  retryCount: number
  lastSuccessfulConnection?: Date
}

class FirebaseConnectionHelper {
  private connectionStatus: ConnectionStatus = {
    isConnected: false,
    retryCount: 0
  }

  private maxRetries = 3
  private retryDelay = 1000 // 1 second
  private connectionListeners: ((status: ConnectionStatus) => void)[] = []

  constructor() {
    this.initializeConnectionMonitoring()
  }

  private initializeConnectionMonitoring() {
    // Monitor authentication state
    onAuthStateChanged(auth, (user) => {
      if (user) {
        this.testConnection()
      } else {
        this.updateConnectionStatus(false, {
          code: 'auth/no-user',
          message: 'User not authenticated'
        })
      }
    })

    // Monitor Firestore connection
    this.monitorFirestoreConnection()
  }

  private monitorFirestoreConnection() {
    // Create a test document reference to monitor connection
    const testRef = doc(db, '_connection_test_', 'status')

    const unsubscribe = onSnapshot(
      testRef,
      (doc) => {
        if (doc.exists()) {
          this.updateConnectionStatus(true)
        }
      },
      (error) => {
        this.handleConnectionError(error)
      }
    )

    // Clean up after initial test
    setTimeout(() => {
      unsubscribe()
    }, 5000)
  }

  private async testConnection(): Promise<boolean> {
    try {
      // Test basic Firestore connectivity
      const testQuery = query(collection(db, 'users'), limit(1))
      await getDocs(testQuery)

      this.updateConnectionStatus(true)
      return true
    } catch (error: any) {
      this.handleConnectionError(error)
      return false
    }
  }

  private handleConnectionError(error: any) {
    const firebaseError: FirebaseError = {
      code: error.code || 'unknown',
      message: error.message || 'Unknown connection error',
      details: error
    }

    // Handle specific error types
    if (this.isQuicProtocolError(error)) {
      console.warn('QUIC Protocol Error detected. This may be due to network issues or browser settings.')
      firebaseError.code = 'network/quic-protocol-error'
      firebaseError.message = 'Network protocol error. Please check your connection and try refreshing.'
    } else if (this.isAuthenticationError(error)) {
      console.warn('Authentication error detected. Token may be expired.')
      firebaseError.code = 'auth/token-expired'
      firebaseError.message = 'Authentication token expired. Please sign in again.'
    } else if (this.isNetworkError(error)) {
      console.warn('Network connectivity error detected.')
      firebaseError.code = 'network/connectivity'
      firebaseError.message = 'Network connection issue. Please check your internet connection.'
    }

    this.updateConnectionStatus(false, firebaseError)

    // Auto-retry for recoverable errors
    if (this.shouldRetry(error)) {
      this.scheduleRetry()
    }
  }

  private isQuicProtocolError(error: any): boolean {
    return error.message?.includes('QUIC') ||
           error.message?.includes('ERR_QUIC_PROTOCOL_ERROR') ||
           error.code === 'unavailable' && error.message?.includes('protocol')
  }

  private isAuthenticationError(error: any): boolean {
    return error.code === 'permission-denied' ||
           error.code === 'unauthenticated' ||
           error.message?.includes('token') ||
           error.message?.includes('auth')
  }

  private isNetworkError(error: any): boolean {
    return error.code === 'unavailable' ||
           error.code === 'deadline-exceeded' ||
           error.message?.includes('network') ||
           error.message?.includes('timeout')
  }

  private shouldRetry(error: any): boolean {
    // Don't retry authentication errors
    if (this.isAuthenticationError(error)) {
      return false
    }

    // Retry network and protocol errors
    return this.isNetworkError(error) ||
           this.isQuicProtocolError(error) ||
           error.code === 'unavailable'
  }

  private scheduleRetry() {
    if (this.connectionStatus.retryCount >= this.maxRetries) {
      console.error('Max retry attempts reached. Please check your connection and refresh the page.')
      return
    }

    this.connectionStatus.retryCount++
    const delay = this.retryDelay * Math.pow(2, this.connectionStatus.retryCount - 1) // Exponential backoff

    setTimeout(() => {
      console.log(`Retrying Firebase connection (attempt ${this.connectionStatus.retryCount}/${this.maxRetries})`)
      this.testConnection()
    }, delay)
  }

  private updateConnectionStatus(isConnected: boolean, error?: FirebaseError) {
    this.connectionStatus = {
      ...this.connectionStatus,
      isConnected,
      lastError: error,
      lastSuccessfulConnection: isConnected ? new Date() : this.connectionStatus.lastSuccessfulConnection
    }

    // Notify listeners
    this.connectionListeners.forEach(listener => listener(this.connectionStatus))
  }

  // Public API methods with error handling
  async safeGetDoc(ref: any): Promise<any> {
    try {
      const docSnap = await getDoc(ref)
      return docSnap
    } catch (error: any) {
      this.handleConnectionError(error)
      throw error
    }
  }

  async safeGetDocs(queryRef: any): Promise<any> {
    try {
      const snapshot = await getDocs(queryRef)
      return snapshot
    } catch (error: any) {
      this.handleConnectionError(error)
      throw error
    }
  }

  async safeAddDoc(collectionRef: any, data: any): Promise<any> {
    try {
      const docRef = await addDoc(collectionRef, data)
      return docRef
    } catch (error: any) {
      this.handleConnectionError(error)
      throw error
    }
  }

  async safeUpdateDoc(docRef: any, data: any): Promise<void> {
    try {
      await updateDoc(docRef, data)
    } catch (error: any) {
      this.handleConnectionError(error)
      throw error
    }
  }

  async safeDeleteDoc(docRef: any): Promise<void> {
    try {
      await deleteDoc(docRef)
    } catch (error: any) {
      this.handleConnectionError(error)
      throw error
    }
  }

  safeOnSnapshot(queryRef: any, onNext: (snapshot: any) => void, onError?: (error: any) => void): Unsubscribe {
    return onSnapshot(
      queryRef,
      (snapshot: any) => {
        // Connection is working if we get data
        this.updateConnectionStatus(true)
        onNext(snapshot)
      },
      (error: any) => {
        this.handleConnectionError(error)
        if (onError) {
          onError(error)
        }
      }
    )
  }

  // Connection status monitoring
  getConnectionStatus(): ConnectionStatus {
    return { ...this.connectionStatus }
  }

  onConnectionStatusChange(listener: (status: ConnectionStatus) => void): () => void {
    this.connectionListeners.push(listener)

    // Return unsubscribe function
    return () => {
      const index = this.connectionListeners.indexOf(listener)
      if (index > -1) {
        this.connectionListeners.splice(index, 1)
      }
    }
  }

  // Manual reconnection
  async reconnect(): Promise<boolean> {
    console.log('Manual reconnection requested')
    this.connectionStatus.retryCount = 0 // Reset retry count
    return await this.testConnection()
  }

  // Force sign out on persistent auth errors
  async handlePersistentAuthError() {
    console.warn('Persistent authentication error detected. Signing out user.')
    try {
      await signOut(auth)
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }
}

// Export singleton instance
export const firebaseHelper = new FirebaseConnectionHelper()

// Export utility functions
export const isQuicError = (error: any): boolean => {
  return error.message?.includes('QUIC') ||
         error.message?.includes('ERR_QUIC_PROTOCOL_ERROR') ||
         (error.code === 'unavailable' && error.message?.includes('protocol'))
}

export const isRecoverableError = (error: any): boolean => {
  return error.code === 'unavailable' ||
         error.code === 'deadline-exceeded' ||
         isQuicError(error)
}

export const getErrorMessage = (error: any): string => {
  if (isQuicError(error)) {
    return 'Network protocol error. Please check your connection and try refreshing the page. If the problem persists, try disabling QUIC in Chrome settings.'
  }

  if (error.code === 'permission-denied') {
    return 'Access denied. Please check your permissions or sign in again.'
  }

  if (error.code === 'unavailable') {
    return 'Service temporarily unavailable. Please try again in a moment.'
  }

  if (error.code === 'deadline-exceeded') {
    return 'Request timed out. Please check your connection and try again.'
  }

  return error.message || 'An unexpected error occurred.'
}
