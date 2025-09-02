"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { toast } from "@/hooks/use-toast"
import { db } from "@/lib/firebase"
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore"
import { Shield, FileText, Clock, Check, AlertTriangle, Info } from "lucide-react"
import type { User as FirebaseUser } from "firebase/auth"

interface ConsentData {
  userId: string
  teacherConsent: boolean
  dataProcessingConsent: boolean
  communicationConsent: boolean
  consentDate: Date
  ipAddress?: string
  userAgent?: string
  version: string
}

interface ConsentManagerProps {
  user: FirebaseUser
  onConsentComplete?: (consented: boolean) => void
  showDialog?: boolean
}

export function ConsentManager({ user, onConsentComplete, showDialog = false }: ConsentManagerProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(showDialog)
  const [consent, setConsent] = useState<ConsentData | null>(null)
  const [loading, setLoading] = useState(true)
  const [formData, setFormData] = useState({
    teacherConsent: false,
    dataProcessingConsent: false,
    communicationConsent: false
  })

  const schoolColors = {
    primary: "#8e0b16",
    secondary: "#66181E",
    accent: "#ffffff"
  }

  useEffect(() => {
    checkExistingConsent()
  }, [user])

  const checkExistingConsent = async () => {
    try {
      const consentDoc = await getDoc(doc(db, "privacyConsents", user.uid))
      
      if (consentDoc.exists()) {
        const data = consentDoc.data()
        setConsent({
          ...data,
          consentDate: data.consentDate?.toDate()
        } as ConsentData)
      } else {
        // No consent found, show dialog
        setIsDialogOpen(true)
      }
    } catch (error) {
      console.error("Error checking consent:", error)
    } finally {
      setLoading(false)
    }
  }

  const saveConsent = async () => {
    if (!formData.teacherConsent || !formData.dataProcessingConsent) {
      toast({
        title: "Required Consent Missing",
        description: "Teacher verification and data processing consent are required to use this system",
        variant: "destructive"
      })
      return
    }

    try {
      const consentData: ConsentData = {
        userId: user.uid,
        teacherConsent: formData.teacherConsent,
        dataProcessingConsent: formData.dataProcessingConsent,
        communicationConsent: formData.communicationConsent,
        consentDate: new Date(),
        version: "1.0",
        ipAddress: await getClientIP(),
        userAgent: navigator.userAgent
      }

      await setDoc(doc(db, "privacyConsents", user.uid), {
        ...consentData,
        consentDate: serverTimestamp()
      })

      setConsent(consentData)
      setIsDialogOpen(false)
      
      toast({
        title: "Consent Recorded",
        description: "Your privacy preferences have been saved",
      })

      onConsentComplete?.(true)
    } catch (error) {
      console.error("Error saving consent:", error)
      toast({
        title: "Error",
        description: "Failed to save consent preferences",
        variant: "destructive"
      })
    }
  }

  const getClientIP = async (): Promise<string> => {
    try {
      const response = await fetch('https://api.ipify.org?format=json')
      const data = await response.json()
      return data.ip
    } catch {
      return 'unknown'
    }
  }

  const revokeConsent = async () => {
    if (!confirm("Are you sure you want to revoke your consent? This will prevent you from using the system.")) {
      return
    }

    try {
      await setDoc(doc(db, "privacyConsents", user.uid), {
        ...consent,
        teacherConsent: false,
        dataProcessingConsent: false,
        communicationConsent: false,
        revokedDate: serverTimestamp(),
        status: "revoked"
      })

      setConsent(null)
      
      toast({
        title: "Consent Revoked",
        description: "Your consent has been revoked. You will need to provide consent again to use the system.",
      })

      onConsentComplete?.(false)
    } catch (error) {
      console.error("Error revoking consent:", error)
      toast({
        title: "Error",
        description: "Failed to revoke consent",
        variant: "destructive"
      })
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-muted-foreground">Checking privacy preferences...</p>
      </div>
    )
  }

  return (
    <>
      {/* Consent Status Card */}
      {consent && (
        <Card className="border-2" style={{ borderColor: schoolColors.primary }}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2" style={{ color: schoolColors.primary }}>
              <Shield className="h-6 w-6" />
              Privacy & Data Consent
            </CardTitle>
            <CardDescription>
              Your current privacy preferences and data usage consent
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center gap-2">
                {consent.teacherConsent ? (
                  <Check className="h-5 w-5 text-green-500" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                )}
                <div>
                  <p className="font-medium">Teacher Verification</p>
                  <p className="text-sm text-muted-foreground">
                    {consent.teacherConsent ? "Verified" : "Not verified"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {consent.dataProcessingConsent ? (
                  <Check className="h-5 w-5 text-green-500" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                )}
                <div>
                  <p className="font-medium">Data Processing</p>
                  <p className="text-sm text-muted-foreground">
                    {consent.dataProcessingConsent ? "Consented" : "Not consented"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {consent.communicationConsent ? (
                  <Check className="h-5 w-5 text-green-500" />
                ) : (
                  <Info className="h-5 w-5 text-gray-500" />
                )}
                <div>
                  <p className="font-medium">Communications</p>
                  <p className="text-sm text-muted-foreground">
                    {consent.communicationConsent ? "Allowed" : "Declined"}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>Consented on {consent.consentDate.toLocaleDateString()}</span>
                <Badge variant="outline">v{consent.version}</Badge>
              </div>
              
              <Button
                variant="outline"
                size="sm"
                onClick={revokeConsent}
                className="text-red-600 border-red-600 hover:bg-red-50"
              >
                Revoke Consent
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Consent Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2" style={{ color: schoolColors.primary }}>
              <Shield className="h-6 w-6" />
              Privacy & Data Consent
            </DialogTitle>
            <DialogDescription>
              Please review and accept our data usage terms to continue using Coby Picks
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Teacher Verification */}
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <Checkbox
                  id="teacher-consent"
                  checked={formData.teacherConsent}
                  onCheckedChange={(checked) => 
                    setFormData(prev => ({ ...prev, teacherConsent: checked as boolean }))
                  }
                />
                <div className="space-y-1">
                  <label htmlFor="teacher-consent" className="font-medium text-sm cursor-pointer">
                    Teacher/Educator Verification *
                  </label>
                  <p className="text-sm text-muted-foreground">
                    I confirm that I am a teacher, educator, or authorized school personnel using this system 
                    for legitimate educational purposes. I understand that this system is designed for 
                    classroom and educational activities.
                  </p>
                </div>
              </div>
            </div>

            {/* Data Processing */}
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <Checkbox
                  id="data-consent"
                  checked={formData.dataProcessingConsent}
                  onCheckedChange={(checked) => 
                    setFormData(prev => ({ ...prev, dataProcessingConsent: checked as boolean }))
                  }
                />
                <div className="space-y-1">
                  <label htmlFor="data-consent" className="font-medium text-sm cursor-pointer">
                    Data Processing Consent *
                  </label>
                  <p className="text-sm text-muted-foreground">
                    I consent to the processing of participant data (names, emails, contact information) 
                    for the purpose of conducting randomizer activities. Data will be stored securely 
                    and used only for educational purposes.
                  </p>
                </div>
              </div>
            </div>

            {/* Communication */}
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <Checkbox
                  id="communication-consent"
                  checked={formData.communicationConsent}
                  onCheckedChange={(checked) => 
                    setFormData(prev => ({ ...prev, communicationConsent: checked as boolean }))
                  }
                />
                <div className="space-y-1">
                  <label htmlFor="communication-consent" className="font-medium text-sm cursor-pointer">
                    Communication Preferences (Optional)
                  </label>
                  <p className="text-sm text-muted-foreground">
                    I agree to receive system notifications, updates, and educational communications 
                    related to my use of Coby Picks.
                  </p>
                </div>
              </div>
            </div>

            {/* Data Usage Information */}
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <h4 className="font-medium text-blue-900 mb-2">How We Use Your Data</h4>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Participant data is stored temporarily for each activity</li>
                <li>• Names and emails are used only for randomizer functionality</li>
                <li>• Data is automatically deleted after 30 days of inactivity</li>
                <li>• No data is shared with third parties</li>
                <li>• You can export or delete your data at any time</li>
              </ul>
            </div>

            <p className="text-xs text-muted-foreground">
              * Required fields. By continuing, you acknowledge that you have read and understood 
              our privacy policy and agree to the terms outlined above.
            </p>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsDialogOpen(false)
                onConsentComplete?.(false)
              }}
            >
              Decline
            </Button>
            <Button
              onClick={saveConsent}
              disabled={!formData.teacherConsent || !formData.dataProcessingConsent}
              className="bg-[#8e0b16] hover:bg-[#66181E]"
            >
              Accept & Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
