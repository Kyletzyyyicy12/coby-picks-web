// lib/firebase.ts
import { initializeApp, getApps, getApp } from "firebase/app"
import { getAuth } from "firebase/auth"
import { getFirestore, doc, updateDoc as firebaseUpdateDoc, setDoc as firebaseSetDoc } from "firebase/firestore"
// import { getStorage } from "firebase/storage" // Disabled due to billing requirement

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyB-C_IjY-ywRfZJWd015As_hGnpV_pfyuw",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "cobypicksswu.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "cobypicksswu",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "cobypicksswu.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "469611837919",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:469611837919:web:088c372029035bfe0b2c6a",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-SQ8C2YNEJ3"
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp()
const auth = getAuth(app)
const db = getFirestore(app)
// const storage = getStorage(app) // Disabled due to billing requirement

/**
 * Utility function to filter out undefined values before Firebase operations
 * This prevents the "Unsupported field value: undefined" error
 */
const filterUndefinedValues = (data: any): any => {
  if (data === null || data === undefined) {
    return null;
  }

  if (typeof data === 'object') {
    if (Array.isArray(data)) {
      return data.map(item => filterUndefinedValues(item));
    }

    const filtered: any = {};
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        filtered[key] = filterUndefinedValues(value);
      }
    }
    return filtered;
  }

  return data;
};

/**
 * Safe updateDoc that filters out undefined values
 */
export const safeUpdateDoc = async (documentRef: any, data: any) => {
  const filteredData = filterUndefinedValues(data);

  // Log what was filtered out for debugging
  const originalKeys = Object.keys(data || {});
  const filteredKeys = Object.keys(filteredData || {});
  const removedKeys = originalKeys.filter(key => !(filteredData as any)[key]);

  if (removedKeys.length > 0) {
    console.warn('🔧 Firebase safeUpdateDoc filtered out undefined values:', removedKeys);
  }

  return firebaseUpdateDoc(documentRef, filteredData);
};

/**
 * Safe setDoc that filters out undefined values
 */
export const safeSetDoc = async (documentRef: any, data: any) => {
  const filteredData = filterUndefinedValues(data);

  // Log what was filtered out for debugging
  const originalKeys = Object.keys(data || {});
  const filteredKeys = Object.keys(filteredData || {});
  const removedKeys = originalKeys.filter(key => !(filteredData as any)[key]);

  if (removedKeys.length > 0) {
    console.warn('🔧 Firebase safeSetDoc filtered out undefined values:', removedKeys);
  }

  return firebaseSetDoc(documentRef, filteredData);
};

export { app, auth, db, filterUndefinedValues }
