import { NextRequest, NextResponse } from 'next/server'

// Global variables for Firebase Admin SDK
let adminAuth: any = null
let adminDb: any = null
let adminInitialized = false
let initializationError: string | null = null

// Initialize Firebase Admin SDK with comprehensive error handling
async function initializeFirebaseAdmin() {
  if (adminInitialized) return { success: true }
  
  try {
    // Dynamic imports to handle potential module loading issues
    const { getAuth } = await import('firebase-admin/auth')
    const { getFirestore } = await import('firebase-admin/firestore')
    const { initializeApp, getApps, cert } = await import('firebase-admin/app')
    
    if (!getApps().length) {
      const projectId = process.env.FIREBASE_PROJECT_ID
      const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
      let privateKey = process.env.FIREBASE_PRIVATE_KEY
      
      if (!projectId || !clientEmail || !privateKey) {
        const missingVars = []
        if (!projectId) missingVars.push('FIREBASE_PROJECT_ID')
        if (!clientEmail) missingVars.push('FIREBASE_CLIENT_EMAIL')
        if (!privateKey) missingVars.push('FIREBASE_PRIVATE_KEY')
        
        const error = `Missing Firebase Admin SDK environment variables: ${missingVars.join(', ')}`
        console.error(error)
        console.error('Current values:')
        console.error('- FIREBASE_PROJECT_ID:', projectId ? '✓ Set' : '✗ Missing')
        console.error('- FIREBASE_CLIENT_EMAIL:', clientEmail ? '✓ Set' : '✗ Missing')
        console.error('- FIREBASE_PRIVATE_KEY:', privateKey ? '✓ Set' : '✗ Missing')
        
        initializationError = `Missing required environment variables: ${missingVars.join(', ')}. Please check QUICK_SETUP.md for setup instructions.`
        return { success: false, error: initializationError }
      }

      // Check for placeholder values that haven't been replaced
      if (clientEmail.includes('xyz') || clientEmail.includes('xxxxx')) {
        initializationError = 'FIREBASE_CLIENT_EMAIL contains placeholder values. Please replace with actual service account email.'
        console.error('FIREBASE_CLIENT_EMAIL has placeholder value:', clientEmail)
        return { success: false, error: initializationError }
      }
      
      if (privateKey.includes('YOUR_PRIVATE_KEY_HERE') || privateKey.includes('your-private-key')) {
        initializationError = 'FIREBASE_PRIVATE_KEY contains placeholder values. Please replace with actual private key from Firebase service account.'
        console.error('FIREBASE_PRIVATE_KEY has placeholder value')
        return { success: false, error: initializationError }
      }

      // Clean and format the private key properly with comprehensive handling
      privateKey = privateKey
        .replace(/\\\\n/g, '\n')  // Replace \\\\n with \n (double escaped)
        .replace(/\\n/g, '\n')    // Replace \\n with \n (single escaped)
        .replace(/\\"/g, '')     // Remove escaped quotes
        .replace(/^"|"$/g, '')    // Remove surrounding quotes
        .trim()                    // Remove whitespace
      
      // Normalize line endings and ensure proper PEM format
      if (!privateKey.includes('-----BEGIN PRIVATE KEY-----')) {
        initializationError = 'Private key must contain "-----BEGIN PRIVATE KEY-----" marker'
        console.error('Private key validation failed: missing BEGIN marker')
        return { success: false, error: initializationError }
      }
      
      if (!privateKey.includes('-----END PRIVATE KEY-----')) {
        initializationError = 'Private key must contain "-----END PRIVATE KEY-----" marker'
        console.error('Private key validation failed: missing END marker')
        return { success: false, error: initializationError }
      }

      // Ensure proper line breaks in the private key
      privateKey = privateKey
        .replace(/-----BEGIN PRIVATE KEY-----\s*/, '-----BEGIN PRIVATE KEY-----\n')
        .replace(/\s*-----END PRIVATE KEY-----/, '\n-----END PRIVATE KEY-----')
        .replace(/([A-Za-z0-9+/]{64})/g, '$1\n')  // Add line breaks every 64 characters
        .replace(/\n+/g, '\n')  // Remove multiple consecutive newlines
        .trim()
      
      console.log('Private key format verified successfully')
      
      console.log('Initializing Firebase Admin SDK...')
      initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      })
      
      console.log('✅ Firebase Admin SDK initialized successfully')
    }
    
    // Initialize auth and db instances
    adminAuth = getAuth()
    adminDb = getFirestore()
    adminInitialized = true
    
    return { success: true }
  } catch (error: any) {
    console.error('❌ Firebase Admin SDK initialization error:', error)
    initializationError = `Firebase Admin SDK initialization failed: ${error.message}`
    adminInitialized = false
    return { success: false, error: initializationError }
  }
}

export async function POST(request: NextRequest) {
  // Top-level error boundary to ensure we ALWAYS return JSON
  try {
    return await handleUserCreation(request)
  } catch (criticalError: any) {
    console.error('Critical error in user creation API:', criticalError)
    return NextResponse.json(
      { 
        error: 'Internal server error occurred',
        message: criticalError.message || 'Unknown error',
        details: 'Check server logs for more information'
      },
      { status: 500 }
    )
  }
}

async function handleUserCreation(request: NextRequest) {
  // Ensure we always return JSON, even if there are early errors
  try {
    // Initialize Firebase Admin SDK
    const initResult = await initializeFirebaseAdmin()
    if (!initResult.success) {
      return NextResponse.json(
        { 
          error: 'Firebase Admin SDK Configuration Required',
          message: initResult.error || 'Firebase Admin SDK is not properly configured.',
          details: 'Please set up the required environment variables. Check FIREBASE_ADMIN_SETUP.md for step-by-step instructions.',
          configHelp: 'Visit /api/admin/config-check to verify your configuration status'
        },
        { status: 500 }
      )
    }

    // Parse request body
    let requestData
    try {
      requestData = await request.json()
    } catch (parseError) {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      )
    }

    const { name, email, password, role, adminEmail, contactNumber, needsPasswordReset, isImport } = requestData

    // Validate required fields
    if (!name || !email || !password || !role || !adminEmail) {
      return NextResponse.json(
        { error: 'Missing required fields: name, email, password, role, adminEmail' },
        { status: 400 }
      )
    }

    // Verify that the requesting user is an admin
    try {
      const adminUser = await adminAuth.getUserByEmail(adminEmail)
      const adminDoc = await adminDb.collection('users').doc(adminUser.uid).get()
      
      if (!adminDoc.exists || adminDoc.data()?.role !== 'admin') {
        return NextResponse.json(
          { error: 'Unauthorized: Only admins can create users' },
          { status: 403 }
        )
      }
    } catch (error) {
      return NextResponse.json(
        { error: 'Admin verification failed' },
        { status: 403 }
      )
    }

    // Create user with Firebase Admin SDK (server-side)
    const userRecord = await adminAuth.createUser({
      email: email,
      password: password,
      displayName: name,
      emailVerified: false,
    })

    // Create user document in Firestore with conditional fields for imports
    const userData: any = {
      email: email,
      displayName: name,
      fullName: name,
      role: role,
      createdAt: new Date(),
      lastActiveAt: new Date(),
      isActive: false,
      profileComplete: true,
      lastActiveDevice: isImport ? 'Admin Import' : 'Admin Created',
      createdBy: adminEmail,
      createdByAdmin: true,
      needsPasswordReset: needsPasswordReset || false,
    }

    // Add additional fields for imports
    if (isImport) {
      userData.importedBy = adminEmail
      userData.importedAt = new Date()
    }

    // Add contact number if provided
    if (contactNumber) {
      userData.contactNumber = contactNumber
    }

    await adminDb.collection('users').doc(userRecord.uid).set(userData)

    return NextResponse.json({
      success: true,
      message: `User ${email} created successfully with role ${role}`,
      userId: userRecord.uid,
    })

  } catch (error: any) {
    console.error('Error creating user:', error)
    
    if (error.code === 'auth/email-already-exists') {
      return NextResponse.json(
        { error: 'A user with this email already exists' },
        { status: 409 }
      )
    } else if (error.code === 'auth/invalid-email') {
      return NextResponse.json(
        { error: 'Invalid email address' },
        { status: 400 }
      )
    } else if (error.code === 'auth/weak-password') {
      return NextResponse.json(
        { error: 'Password is too weak' },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: error.message || 'Failed to create user' },
      { status: 500 }
    )
  }
}