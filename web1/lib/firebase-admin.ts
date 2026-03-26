// lib/firebase-admin.ts
import * as admin from "firebase-admin"
import "server-only"

if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"), // <--- THIS IS CRUCIAL
      }),
    })
    console.log("Firebase Admin SDK initialized successfully.")
  } catch (error) {
    console.error("Firebase Admin SDK initialization error:", error)
  }
}

export const adminAuth = admin.auth()
export const adminDb = admin.firestore()