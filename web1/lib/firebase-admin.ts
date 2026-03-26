// lib/firebase-admin.ts
import * as admin from "firebase-admin"
import "server-only"

let adminAuth: admin.auth.Auth | null = null
let adminDb: admin.firestore.Firestore | null = null

const initializeFirebaseAdmin = () => {
  if (adminAuth && adminDb) {
    return { adminAuth, adminDb }
  }

  if (!admin.apps.length) {
    try {
      // Only initialize if credentials are available (skip during build)
      if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PRIVATE_KEY) {
        console.warn("Firebase Admin credentials not configured. Skipping initialization.")
        return { adminAuth: null, adminDb: null }
      }

      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
        }),
      })
      console.log("Firebase Admin SDK initialized successfully.")
    } catch (error) {
      console.error("Firebase Admin SDK initialization error:", error)
      return { adminAuth: null, adminDb: null }
    }
  }

  adminAuth = admin.auth()
  adminDb = admin.firestore()
  return { adminAuth, adminDb }
}

// Lazy initialization
const getAdminAuth = () => {
  const { adminAuth: auth } = initializeFirebaseAdmin()
  return auth || admin.auth()
}

const getAdminDb = () => {
  const { adminDb: db } = initializeFirebaseAdmin()
  return db || admin.firestore()
}

export { getAdminAuth as adminAuth, getAdminDb as adminDb }