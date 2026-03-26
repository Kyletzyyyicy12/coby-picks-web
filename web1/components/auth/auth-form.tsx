"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { auth } from "@/lib/firebase"
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail, updateProfile } from "firebase/auth"
import { toast } from "@/hooks/use-toast"
import { db } from "@/lib/firebase"
import { setDoc, doc, updateDoc, getDoc } from "firebase/firestore"
import { getAdminRoleAssignmentDetails } from "@/lib/admin-utils"
import { isHardcodedAdmin } from "@/lib/hardcoded-admin"
import { getRouteForUser, ADMIN_DASHBOARD_PATH } from "@/lib/admin-routing"
import { PasswordResetVerificationModal } from "./password-reset-verification-modal"
import { SignupVerificationModal } from "./signup-verification-modal"
import { FirstLoginSetup } from "./first-login-setup"
import { RoleSelection } from "./role-selection"
import Link from "next/link"
import { Shield } from "lucide-react"

export function AuthForm() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [selectedRole, setSelectedRole] = useState<"participant" | "organizer">("participant")
  const [isRegistering, setIsRegistering] = useState(false)
  const [loading, setLoading] = useState(false)
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [recoveryEmail, setRecoveryEmail] = useState("")
  const [rateLimited, setRateLimited] = useState(false)
  const [retryAfter, setRetryAfter] = useState(0)
  const [showPasswordResetVerification, setShowPasswordResetVerification] = useState(false)
  const [showSignupVerification, setShowSignupVerification] = useState(false)
  const [showFirstLoginSetup, setShowFirstLoginSetup] = useState(false)
  const [showRoleSelection, setShowRoleSelection] = useState(false)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [pendingSignupData, setPendingSignupData] = useState<{ email: string; password: string; firstName: string; lastName: string; selectedRole: string } | null>(null)

  // Countdown effect for rate limiting
  useEffect(() => {
    let interval: NodeJS.Timeout
    if (rateLimited && retryAfter > 0) {
      interval = setInterval(() => {
        setRetryAfter(prev => {
          if (prev <= 1) {
            setRateLimited(false)
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [rateLimited, retryAfter])

  const handleForgotPassword = async () => {
    if (!email) {
      toast({
        title: "Email Required",
        description: "Please enter your email or recovery email to reset your password.",
        variant: "destructive",
      })
      return
    }
    setLoading(true)
    try {
      const response = await fetch('/api/auth/send-reset-verification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      })

      const data = await response.json()

      if (response.ok && data.success) {
        toast({
          title: "Verification Code Sent",
          description: data.message,
        })
        setShowForgotPassword(false)
        setShowPasswordResetVerification(true)
      } else {
        toast({
          title: "Password Reset Error",
          description: data.error || "Failed to send verification code. Please try again.",
          variant: "destructive",
        })
      }
    } catch (error: any) {
      toast({
        title: "Password Reset Error",
        description: "Network error. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Check if rate limited
    if (rateLimited) {
      toast({
        title: "Please Wait",
        description: `You must wait ${retryAfter} seconds before trying again.`,
        variant: "destructive",
      })
      return
    }

    setLoading(true)
    try {
      // Check for hardcoded admin account - ALWAYS CREATE IF NOT EXISTS
      const ADMIN_EMAIL = 'admin@cobypicks.com';
      const ADMIN_PASSWORD = 'AdminCobyPicks2024!';

      // Validate admin credentials first
      if (email.toLowerCase() === ADMIN_EMAIL.toLowerCase() && password === ADMIN_PASSWORD) {
        // Handle hardcoded admin login - ensure account exists in Firebase
        try {
          // Try to sign in first
          console.log('🔍 Attempting admin sign-in...');
          await signInWithEmailAndPassword(auth, email, password)

          console.log('✅ Admin sign-in successful');
          toast({
            title: "Admin Login Successful",
            description: "Welcome back, System Administrator!",
          })

          const adminRoute = getRouteForUser(email, 'admin');
          console.log(`🎯 Routing admin to: ${adminRoute}`);
          router.push(adminRoute)
          return

        } catch (loginError: any) {
          console.log('⚠️ Admin sign-in failed:', loginError.code, loginError.message);

          // Handle different authentication error scenarios
          if (loginError.code === 'auth/user-not-found' || loginError.code === 'auth/user-disabled') {
            // User doesn't exist, create the account
            console.log('🔨 Admin account not found in Firebase Auth, creating...');
            try {
              console.log('📧 Attempting to create admin account with email:', ADMIN_EMAIL);
              const userCredential = await createUserWithEmailAndPassword(auth, ADMIN_EMAIL, ADMIN_PASSWORD)
              const user = userCredential.user

              console.log('✅ Admin Firebase Auth account created successfully:', user.uid);

              // Update user profile
              await updateProfile(user, {
                displayName: "System Administrator"
              })
              console.log('✅ Admin profile updated');

              // Check if Firestore document exists, update or create
              const userDocRef = doc(db, "users", user.uid);
              const userDocSnap = await getDoc(userDocRef);

              if (userDocSnap.exists()) {
                console.log('📄 Admin Firestore document exists, updating...');
                // Update existing document
                await updateDoc(userDocRef, {
                  lastActiveAt: new Date(),
                  lastLoginAt: new Date(),
                  isActive: true,
                  lastActiveDevice: "Web App - Auto Recreated",
                  isHardcodedAdmin: true,
                  canDeleteCollections: true
                });
              } else {
                console.log('📄 Admin Firestore document not found, creating...');
                // Create user document in Firestore with admin role
                await setDoc(userDocRef, {
                  email: user.email,
                  displayName: "System Administrator",
                  fullName: "System Administrator",
                  firstName: "System",
                  lastName: "Administrator",
                  role: "admin",
                  isHardcodedAdmin: true,
                  canDeleteCollections: true,
                  createdAt: new Date(),
                  lastActiveAt: new Date(),
                  lastLoginAt: new Date(),
                  isActive: true,
                  profileComplete: true,
                  lastActiveDevice: "Web App - Auto Created",
                  collaborators: [],
                  dataPrivacyConsentGiven: true,
                  createdBy: "system-auto-creation"
                });
              }

              console.log('✅ Admin Firestore document ready');

              toast({
                title: "Admin Account Recreated & Login Successful",
                description: "Admin account has been recreated in Firebase and you are now logged in!",
              })

              const adminRoute = getRouteForUser(ADMIN_EMAIL, 'admin');
              console.log(`🎯 Routing recreated admin to: ${adminRoute}`);
              router.push(adminRoute)
              return

            } catch (createError: any) {
              console.error('❌ Failed to recreate admin account:', createError);
              console.error('Error details:', {
                code: createError.code,
                message: createError.message,
                stack: createError.stack
              });

              // Provide specific error messages based on error type
              let errorMessage = `Failed to recreate admin account: ${createError.message}`;

              if (createError.code === 'auth/email-already-in-use') {
                errorMessage = 'Admin email is already in use by another account. Please contact support.';
              } else if (createError.code === 'auth/weak-password') {
                errorMessage = 'Admin password is too weak. Please contact support.';
              } else if (createError.code === 'auth/invalid-email') {
                errorMessage = 'Admin email format is invalid. Please contact support.';
              }

              toast({
                title: "Account Recreation Failed",
                description: `${errorMessage}

As a fallback, you can run: node scripts/reset-admin-account.js in the web1 directory to manually recreate the admin account.`,
                variant: "destructive",
              })
              return
            }
          } else if (loginError.code === 'auth/invalid-credential' || loginError.code === 'auth/wrong-password') {
            // Account exists but credentials don't match - provide clear instructions
            console.log('⚠️ Admin account exists but credentials don\'t match, providing resolution steps');

            toast({
              title: "Admin Credential Mismatch",
              description: `The admin account exists but with different credentials than expected. To resolve this:

1. Run the reset script: 'node scripts/reset-admin-account.js' in the web1 directory
2. Or contact your system administrator
3. The expected credentials are: admin@cobypicks.com / AdminCobyPicks2024!

This will reset the account to use the correct hardcoded credentials.`,
              variant: "destructive",
            })

            console.log('📝 Instructions: Run "node scripts/reset-admin-account.js" to reset the admin account with correct credentials');
            return
          }

          // Handle other authentication errors
          if (loginError.code === 'auth/too-many-requests') {
            // Set rate limiting with 2 minute cooldown
            setRateLimited(true)
            setRetryAfter(120) // 2 minutes in seconds
            toast({
              title: "Too Many Login Attempts",
              description: "Please wait 2 minutes before trying again. This is a Firebase security measure.",
              variant: "destructive",
            })
            return
          }

          // Generic error for any other cases
          toast({
            title: "Admin Login Error",
            description: `Authentication failed: ${loginError.message}`,
            variant: "destructive",
          })
          return
        }
      } else if (isRegistering) {
        // Validate registration fields
        if (!firstName.trim() || !lastName.trim()) {
          toast({
            title: "Name Required",
            description: "Please enter both first name and last name",
            variant: "destructive",
          })
          return
        }

        if (password.length < 6) {
          toast({
            title: "Password Too Short",
            description: "Password must be at least 6 characters long",
            variant: "destructive",
          })
          return
        }

        // Send signup verification email immediately
        console.log('📧 Sending signup verification email...');
        const response = await fetch('/api/auth/send-signup-verification', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            email: email.trim().toLowerCase(), 
            firstName: firstName.trim(), 
            lastName: lastName.trim() 
          }),
        })

        const data = await response.json()

        if (response.ok && data.success) {
          console.log('✅ Verification email sent successfully');
          // Store signup data for later completion
          setPendingSignupData({ email, password, firstName, lastName, selectedRole })
          
          toast({
            title: "Verification Code Sent! 📧",
            description: "Check your email for the 6-digit verification code to complete your registration.",
          })
          
          // Show verification modal immediately
          setShowSignupVerification(true)
          return
        } else {
          console.error('❌ Failed to send verification email:', data.error);
          toast({
            title: "Registration Error",
            description: data.error || "Failed to send verification code. Please try again.",
            variant: "destructive",
          })
          return
        }
      } else {
        // Regular user login - direct login (no 2FA)
        const userCredential = await signInWithEmailAndPassword(auth, email, password)

        // Update last active timestamp
        try {
          await updateDoc(doc(db, "users", userCredential.user.uid), {
            lastActiveAt: new Date(),
            isActive: true,
            lastActiveDevice: "web"
          })
        } catch (error) {
          console.log("Could not update user activity:", error)
        }

        // Check if user needs first login setup
        const userDoc = await getDoc(doc(db, "users", userCredential.user.uid))
        const userData = userDoc.exists() ? userDoc.data() : null

        // Check if user needs password reset or recovery email setup
        const needsPasswordReset = userData?.needsPasswordReset === true
        const needsRecoveryEmail = !userData?.recoveryEmail

        if (needsPasswordReset || needsRecoveryEmail) {
          console.log(`🔐 User ${userCredential.user.email} needs first login setup`)
          setCurrentUser(userCredential.user)
          setShowFirstLoginSetup(true)
          return
        }

        toast({
          title: "Login Successful",
          description: "Please select your role to continue.",
        })

        // ALWAYS show role selection after login - this is mandatory every time
        console.log(`🎭 User ${userCredential.user.email} proceeding to role selection (mandatory every login)`)
        setCurrentUser(userCredential.user)
        setShowRoleSelection(true)
        return
      }
    } catch (error: any) {
      toast({
        title: "Authentication Error",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleFirstLoginSetupComplete = async () => {
    if (!currentUser) return

    try {
      // Get user data to determine routing
      const userDoc = await getDoc(doc(db, "users", currentUser.uid))
      const userData = userDoc.exists() ? userDoc.data() : null
      const firestoreRole = userData?.role || "participant"

      toast({
        title: "Setup Complete",
        description: "Your account is now fully configured!",
      })

      // Route to appropriate dashboard
      const targetRoute = getRouteForUser(currentUser.email, firestoreRole)
      router.push(targetRoute)

      // Reset state
      setShowFirstLoginSetup(false)
      setCurrentUser(null)
    } catch (error) {
      console.error("Error completing first login setup:", error)
      toast({
        title: "Setup Error",
        description: "There was an error completing your setup. Please try logging in again.",
        variant: "destructive"
      })
    }
  }

  const handleSignupVerificationSuccess = async (consentData: { teacherConsent: boolean; dataProcessingConsent: boolean }) => {
    console.log('🔍 Starting account creation via API after verification and consent...');

    if (!pendingSignupData) {
      console.log('❌ No pending signup data found');
      return;
    }

    console.log('📊 Pending signup data:', {
      email: pendingSignupData.email,
      firstName: pendingSignupData.firstName,
      lastName: pendingSignupData.lastName,
      selectedRole: pendingSignupData.selectedRole,
      hasPassword: !!pendingSignupData.password,
      consentData
    });

    try {
      const { email, password, firstName, lastName, selectedRole } = pendingSignupData

      console.log('📡 Creating account via server API with privacy consent...');
      
      // Build payload - recovery email is completely optional
      const signupPayload: Record<string, any> = {
        email: email.trim().toLowerCase(),
        code: 'VERIFIED', // Special code indicating web verification completed
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        role: selectedRole,
        password: password,
        teacherConsent: consentData.teacherConsent,
        dataProcessingConsent: consentData.dataProcessingConsent
      };

      // Only include recovery email if user actually provided one
      const trimmedRecoveryEmail = recoveryEmail?.trim().toLowerCase();
      if (trimmedRecoveryEmail && trimmedRecoveryEmail.length > 0) {
        signupPayload.recoveryEmail = trimmedRecoveryEmail;
      }

      // Use the same API as mobile app for consistent verified account creation
      const response = await fetch('/api/auth/mobile-verify-signup-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(signupPayload)
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to create account via API');
      }

      console.log('✅ Account created via API:', data.user);

      // Now sign in the user with Firebase Auth
      console.log('🔐 Signing in user...');
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      console.log('✅ User signed in:', userCredential.user.uid);

      // Get admin role details for routing
      const adminDetails = getAdminRoleAssignmentDetails(email.toLowerCase(), selectedRole as "participant" | "organizer")
      console.log('📊 Admin details:', adminDetails);

      console.log('📍 User registered successfully, proceeding to role selection...');

      if (adminDetails.isHardcodedAdmin || adminDetails.finalRole === 'admin') {
        console.log('🔑 Admin account created');
        toast({
          title: "Admin Account Created Successfully!",
          description: `Welcome ${firstName} ${lastName}! Your admin account has been automatically configured based on your email address.`,
        })
        const adminRoute = getRouteForUser(email, 'admin');
        router.push(adminRoute);
      } else {
        console.log('👤 Regular account created, showing role selection');
        toast({
          title: "Account Created Successfully!",
          description: `Welcome ${firstName} ${lastName}! Please select your role to continue.`,
        })
        // Always show role selection after signup
        setCurrentUser(userCredential.user);
        setShowRoleSelection(true);
      }

      console.log('🧽 Cleaning up...');
      // Clear pending data
      setPendingSignupData(null)
      setShowSignupVerification(false)

      console.log('✅ Account creation completed successfully!');

    } catch (error: any) {
      console.error('💥 Registration error:', error);
      console.error('📊 Error details:', {
        name: error.name,
        message: error.message,
        code: error.code,
        stack: error.stack
      });

      toast({
        title: "Registration Error",
        description: error.message || "Failed to complete registration after verification.",
        variant: "destructive",
      })
    }
  }

  if (showForgotPassword) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <Card className="mx-auto max-w-sm border-swu-red shadow-lg">
          <CardHeader className="bg-swu-red text-white rounded-t-lg p-6">
            <CardTitle className="text-2xl font-bold text-center">Reset Password</CardTitle>
            <CardDescription className="text-white/80 text-center">
              Enter your email or recovery email to receive password reset instructions
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <form onSubmit={(e) => { e.preventDefault(); handleForgotPassword(); }} className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="reset-email">Email or Recovery Email</Label>
                <Input
                  id="reset-email"
                  type="email"
                  placeholder="you@example.com or recovery@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full bg-swu-red hover:bg-swu-red/90" disabled={loading}>
                {loading ? "Sending..." : "Send Reset Email"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full border-swu-red text-swu-red hover:bg-swu-red hover:text-white"
                onClick={() => setShowForgotPassword(false)}
              >
                Back to Login
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (showRoleSelection && currentUser) {
    return (
      <RoleSelection
        onRoleSelected={(role) => {
          // Navigate to appropriate dashboard after role selection
          const route = role === "organizer" ? "/organizer" : "/participants"
          router.push(route)
          setShowRoleSelection(false)
          setCurrentUser(null)
        }}
      />
    )
  }

  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <Card className="mx-auto max-w-sm border-swu-red shadow-lg">
      <CardHeader className="bg-swu-red text-white rounded-t-lg p-6">
        <CardTitle className="text-3xl font-bold text-center">
          {isRegistering ? "Register for Coby Picks" : "Login to Coby Picks"}
        </CardTitle>
        <CardDescription className="text-white/80 text-center">
          {isRegistering
            ? "Enter your email below to create an account"
            : "Enter your email below to login to your account"}
        </CardDescription>
      </CardHeader>
      <CardContent className="p-6">
        <form onSubmit={handleSubmit} className="grid gap-4">
          {isRegistering && (
            <div className="grid gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input
                    id="firstName"
                    type="text"
                    placeholder="John"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    type="text"
                    placeholder="Doe"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                  />
                </div>
              </div>
            </div>
          )}
          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="m@example.com"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          {isRegistering && (
            <div className="grid gap-2">
              <Label htmlFor="recoveryEmail">Recovery Email (optional)</Label>
              <Input
                id="recoveryEmail"
                type="email"
                placeholder="Recovery email to help find your account"
                value={recoveryEmail}
                onChange={(e) => setRecoveryEmail(e.target.value)}
              />
            </div>
          )}
          <div className="grid gap-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
            />
            {isRegistering && (
              <p className="text-xs text-muted-foreground">
                Password must be at least 6 characters long
              </p>
            )}
            {!isRegistering && (
              <Button
                variant="link"
                onClick={() => setShowForgotPassword(true)}
                className="p-0 h-auto text-sm text-swu-red self-end"
                type="button"
              >
                Forgot password?
              </Button>
            )}
          </div>

          <Button type="submit" className="w-full bg-swu-red hover:bg-swu-red/90 text-white" disabled={loading || rateLimited}>
            {rateLimited ? `Wait ${retryAfter}s` : loading ? "Loading..." : isRegistering ? "Register" : "Login"}
          </Button>
        </form>

        {rateLimited && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm font-medium text-red-900 mb-1">⏱️ Rate Limited</p>
            <p className="text-sm text-red-700">Too many failed attempts. Please wait {retryAfter} seconds before trying again.</p>
            <p className="text-xs text-red-600 mt-1">This is a Firebase security measure to protect accounts.</p>
          </div>
        )}

        <div className="mt-4 text-center text-sm">
          {isRegistering ? "Already have an account?" : "Don't have an account?"}{" "}
          <Button variant="link" onClick={() => setIsRegistering(!isRegistering)} className="p-0 h-auto text-swu-red">
            {isRegistering ? "Login" : "Sign up"}
          </Button>
        </div>

      </CardContent>
    </Card>

    {/* 2FA Verification Modals - Sign Up and Password Reset Only */}

    <PasswordResetVerificationModal
      isOpen={showPasswordResetVerification}
      onClose={() => setShowPasswordResetVerification(false)}
      email={email}
    />

    <SignupVerificationModal
      isOpen={showSignupVerification}
      onClose={() => {
        setShowSignupVerification(false)
        setPendingSignupData(null)
      }}
      email={pendingSignupData?.email || ''}
      firstName={pendingSignupData?.firstName || ''}
      lastName={pendingSignupData?.lastName || ''}
      onSuccess={handleSignupVerificationSuccess}
    />

    {showFirstLoginSetup && currentUser && (
      <FirstLoginSetup
        user={currentUser}
        onComplete={handleFirstLoginSetupComplete}
      />
    )}
    </div>
  )
}
