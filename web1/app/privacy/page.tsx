"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Shield, FileText, Clock, Check, AlertTriangle, Info, ArrowLeft } from "lucide-react"
import Link from "next/link"

export default function PrivacyPage() {
  const schoolColors = {
    primary: "#8e0b16",
    secondary: "#66181E",
    accent: "#ffffff"
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-6 max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <Link href="/" className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4">
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Link>

          <div className="text-center">
            <div className="flex items-center justify-center gap-3 mb-4">
              <Shield className="h-12 w-12" style={{ color: schoolColors.primary }} />
              <h1 className="text-4xl font-bold" style={{ color: schoolColors.primary }}>
                Privacy & Data Policy
              </h1>
            </div>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Your privacy and data security are our top priorities at Coby Picks
            </p>
            <Badge variant="outline" className="mt-4">
              Last Updated: {new Date().toLocaleDateString()}
            </Badge>
          </div>
        </div>

        {/* Overview Card */}
        <Card className="mb-8 border-2" style={{ borderColor: schoolColors.primary }}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2" style={{ color: schoolColors.primary }}>
              <Info className="h-6 w-6" />
              Privacy Overview
            </CardTitle>
            <CardDescription>
              How we collect, use, and protect your personal information
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <Shield className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                <h3 className="font-semibold text-blue-900">Secure Storage</h3>
                <p className="text-sm text-blue-700">Your data is encrypted and securely stored</p>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <Check className="h-8 w-8 text-green-600 mx-auto mb-2" />
                <h3 className="font-semibold text-green-900">No Data Sharing</h3>
                <p className="text-sm text-green-700">We never share your data with third parties</p>
              </div>
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <Clock className="h-8 w-8 text-purple-600 mx-auto mb-2" />
                <h3 className="font-semibold text-purple-900">Auto Deletion</h3>
                <p className="text-sm text-purple-700">Data is automatically deleted after 30 days</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Data Collection Section */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-6 w-6" />
              What Data We Collect
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-3">Participant Data</h3>
              <ul className="space-y-2 text-gray-700">
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-green-500 mt-1 flex-shrink-0" />
                  <span>Names and email addresses for randomizer activities</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-green-500 mt-1 flex-shrink-0" />
                  <span>IP addresses for security and compliance purposes</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-green-500 mt-1 flex-shrink-0" />
                  <span>Device information and browser details</span>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-3">Teacher/Educator Data</h3>
              <ul className="space-y-2 text-gray-700">
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-green-500 mt-1 flex-shrink-0" />
                  <span>Email addresses for account management</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-green-500 mt-1 flex-shrink-0" />
                  <span>Activity and session data for educational purposes</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-green-500 mt-1 flex-shrink-0" />
                  <span>Usage analytics to improve our service</span>
                </li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* How We Use Data */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="h-6 w-6" />
              How We Use Your Data
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <h3 className="font-semibold text-green-700">✅ Permitted Uses</h3>
                <ul className="space-y-2 text-sm">
                  <li>• Conducting randomizer activities</li>
                  <li>• Providing educational services</li>
                  <li>• Ensuring platform security</li>
                  <li>• Improving user experience</li>
                  <li>• Complying with legal requirements</li>
                </ul>
              </div>
              <div className="space-y-3">
                <h3 className="font-semibold text-red-700">❌ What We Don't Do</h3>
                <ul className="space-y-2 text-sm">
                  <li>• Sell your data to advertisers</li>
                  <li>• Share data with third parties</li>
                  <li>• Use data for marketing purposes</li>
                  <li>• Track you across other websites</li>
                  <li>• Store data longer than necessary</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Data Retention */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-6 w-6" />
              Data Retention & Deletion
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <h4 className="font-medium text-blue-900 mb-2">Automatic Data Management</h4>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Participant data is automatically deleted after 30 days of inactivity</li>
                <li>• Activity results are stored temporarily for educational review</li>
                <li>• User accounts can be deleted upon request</li>
                <li>• All data is permanently deleted when you revoke consent</li>
              </ul>
            </div>

            <div className="p-4 bg-green-50 rounded-lg border border-green-200">
              <h4 className="font-medium text-green-900 mb-2">Your Rights</h4>
              <ul className="text-sm text-green-800 space-y-1">
                <li>• Access your personal data at any time</li>
                <li>• Request data export or deletion</li>
                <li>• Revoke consent and stop data processing</li>
                <li>• Update your privacy preferences</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Security Measures */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-6 w-6" />
              Security & Protection
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 border rounded-lg">
                <h4 className="font-semibold mb-2">Technical Security</h4>
                <ul className="text-sm space-y-1">
                  <li>• End-to-end encryption</li>
                  <li>• Secure Firebase infrastructure</li>
                  <li>• Regular security audits</li>
                  <li>• HTTPS-only connections</li>
                </ul>
              </div>
              <div className="p-4 border rounded-lg">
                <h4 className="font-semibold mb-2">Access Controls</h4>
                <ul className="text-sm space-y-1">
                  <li>• Role-based permissions</li>
                  <li>• Teacher verification required</li>
                  <li>• Session-based authentication</li>
                  <li>• Activity logging and monitoring</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Contact Information */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-6 w-6" />
              Contact & Support
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-gray-700">
              If you have any questions about our privacy practices or need to exercise your data rights,
              please contact us:
            </p>

            <div className="p-4 bg-gray-50 rounded-lg">
              <h4 className="font-semibold mb-2">Privacy Officer</h4>
              <p className="text-sm text-gray-600">
                For privacy-related inquiries, data requests, or to revoke consent,
                please email our privacy team or contact your school administrator.
              </p>
            </div>

            <div className="flex gap-4">
              <Button
                variant="outline"
                onClick={() => window.history.back()}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Go Back
              </Button>
              <Button
                style={{ backgroundColor: schoolColors.primary }}
                className="text-white"
                onClick={() => window.location.href = '/'}
              >
                Return to Coby Picks
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center text-sm text-gray-500 border-t pt-8">
          <p>
            This privacy policy was last updated on {new Date().toLocaleDateString()}.
            By using Coby Picks, you agree to the terms outlined above.
          </p>
        </div>
      </div>
    </div>
  )
}