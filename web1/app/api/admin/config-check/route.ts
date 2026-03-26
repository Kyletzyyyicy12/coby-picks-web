import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const projectId = process.env.FIREBASE_PROJECT_ID
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
    const privateKey = process.env.FIREBASE_PRIVATE_KEY

    const config = {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      variables: {
        FIREBASE_PROJECT_ID: {
          set: !!projectId,
          value: projectId ? (projectId.length > 10 ? `${projectId.substring(0, 10)}...` : projectId) : 'NOT_SET',
          valid: !!projectId && !projectId.includes('your-project-id')
        },
        FIREBASE_CLIENT_EMAIL: {
          set: !!clientEmail,
          value: clientEmail ? (clientEmail.includes('@') ? `${clientEmail.split('@')[0]}@...` : clientEmail) : 'NOT_SET',
          valid: !!clientEmail && clientEmail.includes('@') && !clientEmail.includes('xyz') && !clientEmail.includes('xxxxx')
        },
        FIREBASE_PRIVATE_KEY: {
          set: !!privateKey,
          hasBeginMarker: !!privateKey && privateKey.includes('-----BEGIN PRIVATE KEY-----'),
          hasEndMarker: !!privateKey && privateKey.includes('-----END PRIVATE KEY-----'),
          length: privateKey ? privateKey.length : 0,
          valid: !!privateKey && 
                 privateKey.includes('-----BEGIN PRIVATE KEY-----') && 
                 privateKey.includes('-----END PRIVATE KEY-----') &&
                 !privateKey.includes('YOUR_PRIVATE_KEY_HERE') &&
                 !privateKey.includes('your-private-key')
        }
      }
    }

    const allValid = config.variables.FIREBASE_PROJECT_ID.valid &&
                    config.variables.FIREBASE_CLIENT_EMAIL.valid &&
                    config.variables.FIREBASE_PRIVATE_KEY.valid

    return NextResponse.json({
      status: allValid ? 'ready' : 'needs_configuration',
      message: allValid ? 
        'Firebase Admin SDK is properly configured' : 
        'Firebase Admin SDK requires configuration',
      config,
      recommendations: allValid ? [] : getRecommendations(config.variables)
    })

  } catch (error: any) {
    return NextResponse.json(
      { 
        status: 'error',
        error: 'Configuration check failed',
        message: error.message 
      },
      { status: 500 }
    )
  }
}

function getRecommendations(variables: any): string[] {
  const recommendations = []

  if (!variables.FIREBASE_PROJECT_ID.valid) {
    recommendations.push('Set FIREBASE_PROJECT_ID to your actual Firebase project ID')
  }

  if (!variables.FIREBASE_CLIENT_EMAIL.valid) {
    recommendations.push('Set FIREBASE_CLIENT_EMAIL to your service account email (ends with @yourproject.iam.gserviceaccount.com)')
  }

  if (!variables.FIREBASE_PRIVATE_KEY.valid) {
    if (!variables.FIREBASE_PRIVATE_KEY.set) {
      recommendations.push('Set FIREBASE_PRIVATE_KEY to your service account private key')
    } else if (!variables.FIREBASE_PRIVATE_KEY.hasBeginMarker || !variables.FIREBASE_PRIVATE_KEY.hasEndMarker) {
      recommendations.push('FIREBASE_PRIVATE_KEY must include -----BEGIN PRIVATE KEY----- and -----END PRIVATE KEY----- markers')
    } else {
      recommendations.push('Replace FIREBASE_PRIVATE_KEY placeholder with actual private key from Firebase service account')
    }
  }

  recommendations.push('Follow QUICK_SETUP.md for step-by-step instructions')
  recommendations.push('Restart development server after making changes')

  return recommendations
}