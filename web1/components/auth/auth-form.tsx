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

export function AuthForm() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [fullName, setFullName] = useState("")
  const [selectedRole, setSelectedRole] = useState<"participant" | "organizer">("participant")
  const [isRegistering, setIsRegistering] = useState(false)
  const [loading, setLoading] = useState(false)
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [recoveryEmail, setRecoveryEmail] = useState("")
  const [rateLimited, setRateLimited] = useState(false)
  const [retryAfter, setRetryAfter] = useState(0)
  const [showPasswordResetVerification, setShowPasswordResetVerification] = useState(false)
  const [showSignupVerification, setShowSignupVerification] = useState(false)
  const [pendingSignupData, setPendingSignupData] = useState<{ email: string; password: string; fullName: string; selectedRole: string } | null>(null)

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
          console.log('⚠️ Admin sign-in failed:', loginError.code);
          
          // Handle different authentication error scenarios
          if (loginError.code === 'auth/user-not-found') {
            // User doesn't exist, create the account
            console.log('🔨 Admin account not found, creating in Firebase...');
            try {
              const userCredential = await createUserWithEmailAndPassword(auth, ADMIN_EMAIL, ADMIN_PASSWORD)
              const user = userCredential.user

              console.log('✅ Admin Firebase Auth account created:', user.uid);

              // Update user profile
              await updateProfile(user, {
                displayName: "System Administrator"
              })

              // Create user document in Firestore with admin role
              await setDoc(doc(db, "users", user.uid), {
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
              })

              console.log('✅ Admin Firestore document created');
              
              toast({
                title: "Admin Account Created & Login Successful",
                description: "Admin account has been created in Firebase and you are now logged in!",
              })
              
              const adminRoute = getRouteForUser(ADMIN_EMAIL, 'admin');
              console.log(`🎯 Routing new admin to: ${adminRoute}`);
              router.push(adminRoute)
              return
              
            } catch (createError: any) {
              console.error('❌ Failed to create admin account:', createError);
              toast({
                title: "Account Creation Failed",
                description: `Failed to create admin account: ${createError.message}`,
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
          
          if (loginError.code === 'auth/user-disabled') {
            toast({
              title: "Account Disabled",
              description: "The admin account has been disabled. Contact support.",
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
        if (!fullName.trim()) {
          toast({
            title: "Full Name Required",
            description: "Please enter your full name",
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

        // Step 1: Send signup verification email
        try {
          const response = await fetch('/api/auth/send-signup-verification', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, fullName }),
          })

          const data = await response.json()

          if (response.ok && data.success) {
            // Store signup data for later completion
            setPendingSignupData({ email, password, fullName, selectedRole })
            setShowSignupVerification(true)
            
            toast({
              title: "Verification Code Sent",
              description: "Please check your email for the verification code to complete your registration.",
            })
            return
          } else {
            throw new Error(data.error || 'Failed to send verification code')
          }
        } catch (verificationError: any) {
          toast({
            title: "Registration Error",
            description: verificationError.message || "Failed to send verification code. Please try again.",
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

        toast({
          title: "Login Successful",
          description: "You have successfully logged in.",
        })

        // Enhanced admin routing
        try {
          console.log(`🔍 Determining route for user: ${userCredential.user.email}`);
          
          // Get Firestore role data
          const userDoc = await getDoc(doc(db, "users", userCredential.user.uid))
          const userData = userDoc.exists() ? userDoc.data() : null
          const firestoreRole = userData?.role || "participant"
          
          console.log(`📋 Firestore role for ${userCredential.user.email}: ${firestoreRole}`);
          
          // Use routing utility to get correct route
          const targetRoute = getRouteForUser(userCredential.user.email, firestoreRole);
          console.log(`🎯 Final routing decision: ${userCredential.user.email} -> ${targetRoute}`);
          
          router.push(targetRoute);
          
        } catch (roleError) {
          console.error(`❌ Error determining user role for ${userCredential.user.email}:`, roleError);
          
          // Critical fallback using routing utility
          const fallbackRoute = getRouteForUser(userCredential.user.email, undefined);
          console.log(`🚑 Fallback routing: ${userCredential.user.email} -> ${fallbackRoute}`);
          router.push(fallbackRoute);
        }
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

  const handleSignupVerificationSuccess = async () => {
    console.log('🔍 Starting account creation after verification...');
    
    if (!pendingSignupData) {
      console.log('❌ No pending signup data found');
      return;
    }

    console.log('📊 Pending signup data:', {
      email: pendingSignupData.email,
      fullName: pendingSignupData.fullName,
      selectedRole: pendingSignupData.selectedRole,
      hasPassword: !!pendingSignupData.password
    });

    try {
      const { email, password, fullName, selectedRole } = pendingSignupData
      
      console.log('🔥 Creating Firebase user...');
      const userCredential = await createUserWithEmailAndPassword(auth, email, password)
      console.log('✅ Firebase user created:', userCredential.user.uid);

      console.log('📝 Updating user profile...');
      // Update user profile with display name
      await updateProfile(userCredential.user, {
        displayName: fullName
      })
      console.log('✅ User profile updated');

      console.log('🔎 Getting admin role details...');
      // Auto-detect admin role using utility function
      const adminDetails = getAdminRoleAssignmentDetails(email.toLowerCase(), selectedRole as "participant" | "organizer")
      console.log('📊 Admin details:', adminDetails);

      console.log('📄 Creating Firestore document...');
      // Create user profile in Firestore with auto-detected role (mobile/web compatible)
      await setDoc(doc(db, "users", userCredential.user.uid), {
        email: userCredential.user.email,
        displayName: fullName,
        fullName: fullName,  // For mobile compatibility
        role: adminDetails.finalRole,
        isHardcodedAdmin: adminDetails.isHardcodedAdmin, // Mark as hardcoded admin if email matches
        roleLocked: adminDetails.roleLocked, // Lock the role to prevent unauthorized changes
        roleLockedAt: new Date(),
        roleChangedBy: adminDetails.roleChangedBy,
        roleChangeHistory: [{
          oldRole: null,
          newRole: adminDetails.finalRole,
          changedBy: adminDetails.roleChangedBy,
          changedAt: new Date(),
          reason: adminDetails.reason,
          adminEmail: adminDetails.isHardcodedAdmin ? 'system-auto-detect' : null
        }],
        recoveryEmail: recoveryEmail ? recoveryEmail.trim().toLowerCase() : null,
        createdAt: new Date(),
        lastActiveAt: new Date(),
        lastLoginAt: new Date(),
        isActive: true,
        profileComplete: true,
        lastActiveDevice: "Web App",
        collaborators: [],  // For mobile compatibility
        dataPrivacyConsentGiven: false,  // For mobile compatibility
      })
      console.log('✅ Firestore document created');

      console.log('📍 Determining route...');
      // Enhanced admin routing for registration using routing utility
      const targetRoute = getRouteForUser(email, adminDetails.finalRole);
      console.log(`🎯 Registration routing: ${email} (${adminDetails.finalRole}) -> ${targetRoute}`);
      
      if (adminDetails.isHardcodedAdmin || targetRoute === ADMIN_DASHBOARD_PATH) {
        console.log('🔑 Admin account created');
        toast({
          title: "Admin Account Created Successfully!",
          description: `Welcome ${fullName}! Your admin account has been automatically configured based on your email address.`,
        })
      } else {
        console.log('👤 Regular account created');
        toast({
          title: "Account Created Successfully!",
          description: `Welcome ${fullName}! Your ${selectedRole} account is ready.`,
        })
      }
      
      console.log('🚪 Navigating to dashboard...');
      router.push(targetRoute);
      
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
            <div className="grid gap-2">
              <Label htmlFor="fullName">Full Name</Label>
              <Input
                id="fullName"
                type="text"
                placeholder="Enter your full name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
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
          {isRegistering && (
            <div className="grid gap-2">
              <Label htmlFor="role">I am a...</Label>
              <div className="grid gap-3">
                <div
                  className={`p-3 border rounded-lg cursor-pointer transition-all ${
                    selectedRole === "participant" ? "border-swu-red bg-red-50" : "border-gray-200 hover:border-gray-300"
                  }`}
                  onClick={() => setSelectedRole("participant")}
                >
                  <div className="flex items-center gap-3">
                    <div className="text-2xl">👥</div>
                    <div>
                      <h4 className="font-medium">Participant</h4>
                      <p className="text-sm text-muted-foreground">Join activities, participate in live draws, view results</p>
                    </div>
                  </div>
                </div>
                <div
                  className={`p-3 border rounded-lg cursor-pointer transition-all ${
                    selectedRole === "organizer" ? "border-swu-red bg-red-50" : "border-gray-200 hover:border-gray-300"
                  }`}
                  onClick={() => setSelectedRole("organizer")}
                >
                  <div className="flex items-center gap-3">
                    <div className="text-2xl">👤</div>
                    <div>
                      <h4 className="font-medium">Organizer</h4>
                      <p className="text-sm text-muted-foreground">Create activities, manage participants, coordinate events</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
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
      fullName={pendingSignupData?.fullName || ''}
      onSuccess={handleSignupVerificationSuccess}
    />
    </div>
  )
}

