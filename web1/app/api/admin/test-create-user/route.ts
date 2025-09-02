import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    console.log('Test API route called')
    
    // Parse request body safely
    let requestData
    try {
      requestData = await request.json()
      console.log('Request data received:', requestData)
    } catch (parseError: any) {
      console.error('JSON parse error:', parseError)
      return NextResponse.json(
        { error: 'Invalid JSON in request body', details: parseError?.message || 'Unknown parse error' },
        { status: 400 }
      )
    }

    const { name, email, password, role, adminEmail } = requestData

    // Validate required fields
    if (!name || !email || !password || !role || !adminEmail) {
      return NextResponse.json(
        { error: 'Missing required fields: name, email, password, role, adminEmail' },
        { status: 400 }
      )
    }

    // For now, just return a success response without actually creating the user
    console.log('Test user creation request:', { name, email, role, adminEmail })
    
    // Simulate the same response format as the real endpoint
    return NextResponse.json({
      success: true,
      message: `User ${email} created successfully with role ${role}`,
      userId: `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      note: 'TEST MODE: No actual user was created - this is for testing the admin interface flow',
      testUser: {
        name,
        email,
        role,
        createdAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString(),
        isActive: false,
        lastActiveDevice: 'Test Mode Creation'
      },
      receivedData: { name, email, role, adminEmail }
    })

  } catch (error: any) {
    console.error('Error in test user creation API:', error)
    return NextResponse.json(
      { error: 'Test API error', message: error.message, stack: error.stack },
      { status: 500 }
    )
  }
}