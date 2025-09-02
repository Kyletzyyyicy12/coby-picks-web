import { NextRequest, NextResponse } from "next/server"
import { adminDb } from "@/lib/firebase-admin"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const recoveryEmailInput: string | undefined = body?.recoveryEmail
    const recoveryEmail = recoveryEmailInput?.trim().toLowerCase()

    if (!recoveryEmail) {
      return NextResponse.json({ error: "recoveryEmail is required" }, { status: 400 })
    }

    // Query Firestore for user with matching recoveryEmail
    const usersRef = adminDb.collection("users")
    const snapshot = await usersRef.where("recoveryEmail", "==", recoveryEmail).limit(1).get()

    if (snapshot.empty) {
      return NextResponse.json({ error: "No account for this recovery email" }, { status: 404 })
    }

    const doc = snapshot.docs[0]
    const userData = doc.data() as { email?: string | null }
    const primaryEmail = userData?.email || null

    return NextResponse.json({ primaryEmail })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Internal Server Error" }, { status: 500 })
  }
}
