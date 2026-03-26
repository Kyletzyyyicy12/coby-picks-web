// lib/admin-auth-actions.ts
"use server"

import { adminAuth } from "@/lib/firebase-admin"

export async function deleteUserAuth(uid: string) {
  try {
    await adminAuth.deleteUser(uid)
    console.log(`Successfully deleted user auth record: ${uid}`)
    return { success: true, message: `User authentication record for ${uid} deleted.` }
  } catch (error: any) {
    console.error(`Error deleting user auth record ${uid}:`, error)
    return { success: false, message: `Failed to delete user authentication record: ${error.message}` }
  }
}
