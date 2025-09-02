"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { toast } from "@/hooks/use-toast"

export function PrivacyConsent() {
  const [consentGiven, setConsentGiven] = useState(false)
  const [showDialog, setShowDialog] = useState(false)

  useEffect(() => {
    const storedConsent = localStorage.getItem("cobyPicksPrivacyConsent")
    if (storedConsent === "true") {
      setConsentGiven(true)
    } else {
      setShowDialog(true) // Show dialog if consent not given
    }
  }, [])

  const handleConsentChange = (checked: boolean) => {
    setConsentGiven(checked)
    if (checked) {
      localStorage.setItem("cobyPicksPrivacyConsent", "true")
      toast({
        title: "Privacy Consent Accepted",
        description: "Thank you for accepting our data privacy policy.",
      })
      setShowDialog(false)
    } else {
      localStorage.removeItem("cobyPicksPrivacyConsent")
      toast({
        title: "Privacy Consent Revoked",
        description: "You have revoked your data privacy consent.",
        variant: "destructive",
      })
    }
  }

  return (
    <div>
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogTrigger asChild>
          <Button
            variant="outline"
            className="w-full border-swu-red text-swu-red hover:bg-swu-red hover:text-white bg-transparent"
            disabled={consentGiven}
          >
            Review Data Privacy
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="text-swu-red">Data Privacy Consent</DialogTitle>
            <DialogDescription>Please review our data usage policy before proceeding.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4 text-sm text-muted-foreground">
            <p>
              At Coby Picks, we are committed to protecting your privacy. This application collects and stores data you
              provide, such as participant names, emails, contact numbers, and wheel configurations, to enable the core
              functionality of the spinning wheel and related features.
            </p>
            <p>
              <strong>What data do we collect?</strong>
              <ul className="list-disc list-inside ml-4">
                <li>User registration details (email, password - securely hashed by Firebase Auth).</li>
                <li>Wheel names, topics, categories, and congratulatory messages.</li>
                <li>Participant lists, including names, emails, and contact numbers, as uploaded by you.</li>
                <li>Spin logs, including timestamps and selected winners.</li>
              </ul>
            </p>
            <p>
              <strong>How do we use your data?</strong>
              <ul className="list-disc list-inside ml-4">
                <li>To provide and maintain the Coby Picks service.</li>
                <li>To personalize your experience and save your wheel configurations.</li>
                <li>To enable collaboration features with other users you invite.</li>
                <li>To analyze usage patterns for service improvement (anonymized where possible).</li>
              </ul>
            </p>
            <p>
              <strong>Data Security:</strong>
              We use Firebase for secure data storage and authentication. While we strive to protect your personal data,
              no method of transmission over the Internet or method of electronic storage is 100% secure.
            </p>
            <p>
              <strong>Your Choices:</strong>
              You have the right to access, modify, or delete your data at any time. You can delete wheels and
              participants directly within the application.
            </p>
            <p>
              By checking the box below, you consent to the collection and use of your data as described in this policy.
            </p>
          </div>
          <DialogFooter>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="privacy-consent"
                checked={consentGiven}
                onCheckedChange={handleConsentChange}
                className="data-[state=checked]:bg-swu-red data-[state=checked]:text-white"
              />
              <Label htmlFor="privacy-consent">I have read and agree to the data privacy policy.</Label>
            </div>
            <Button
              onClick={() => setShowDialog(false)}
              disabled={!consentGiven}
              className="bg-swu-red hover:bg-swu-red/90 text-white"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {!consentGiven && (
        <p className="text-sm text-red-500 mt-2">
          Please accept the data privacy consent to fully use the application.
        </p>
      )}
    </div>
  )
}
