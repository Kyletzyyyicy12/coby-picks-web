import fs from 'fs'
import path from 'path'

// Simple script to check current .env.local configuration status
const envPath = path.join(process.cwd(), '.env.local')

console.log('🔍 Checking Firebase Admin SDK Configuration...')
console.log('📁 Looking for .env.local at:', envPath)

try {
  if (!fs.existsSync(envPath)) {
    console.log('❌ .env.local file not found!')
    console.log('📝 Please create .env.local file following QUICK_SETUP.md')
    process.exit(1)
  }

  const envContent = fs.readFileSync(envPath, 'utf8')
  console.log('✅ .env.local file found')

  // Check for Firebase Admin SDK variables
  const projectIdMatch = envContent.match(/FIREBASE_PROJECT_ID=(.+)/)
  const clientEmailMatch = envContent.match(/FIREBASE_CLIENT_EMAIL=(.+)/)
  const privateKeyMatch = envContent.match(/FIREBASE_PRIVATE_KEY=(.+)/)

  console.log('\n📊 Configuration Status:')
  
  // Project ID
  const projectId = projectIdMatch ? projectIdMatch[1].trim() : null
  console.log(`• FIREBASE_PROJECT_ID: ${projectId ? '✅ Set (' + projectId + ')' : '❌ Missing'}`)
  
  // Client Email
  const clientEmail = clientEmailMatch ? clientEmailMatch[1].trim() : null
  const hasValidEmail = clientEmail && clientEmail.includes('@') && !clientEmail.includes('xyz') && !clientEmail.includes('xxxxx')
  console.log(`• FIREBASE_CLIENT_EMAIL: ${hasValidEmail ? '✅ Valid' : clientEmail ? '⚠️ Has placeholder values' : '❌ Missing'}`)
  if (clientEmail && !hasValidEmail) {
    console.log(`  Current value: ${clientEmail}`)
  }
  
  // Private Key
  const privateKey = privateKeyMatch ? privateKeyMatch[1].trim() : null
  const hasValidPrivateKey = privateKey && 
    privateKey.includes('-----BEGIN PRIVATE KEY-----') && 
    privateKey.includes('-----END PRIVATE KEY-----') &&
    !privateKey.includes('YOUR_PRIVATE_KEY_HERE')
  console.log(`• FIREBASE_PRIVATE_KEY: ${hasValidPrivateKey ? '✅ Valid' : privateKey ? '⚠️ Has placeholder values' : '❌ Missing'}`)
  
  if (!hasValidPrivateKey && privateKey) {
    if (privateKey.includes('YOUR_PRIVATE_KEY_HERE')) {
      console.log('  ⚠️ Contains placeholder text: YOUR_PRIVATE_KEY_HERE')
    }
    if (!privateKey.includes('-----BEGIN PRIVATE KEY-----')) {
      console.log('  ⚠️ Missing BEGIN marker')
    }
    if (!privateKey.includes('-----END PRIVATE KEY-----')) {
      console.log('  ⚠️ Missing END marker')
    }
  }

  const allValid = projectId && hasValidEmail && hasValidPrivateKey

  console.log('\n🎯 Overall Status:', allValid ? '✅ Ready' : '❌ Needs Configuration')

  if (!allValid) {
    console.log('\n📋 Next Steps:')
    console.log('1. 🔗 Go to Firebase Console: https://console.firebase.google.com/')
    console.log('2. 📁 Select your cobypicks project')
    console.log('3. ⚙️ Go to Project Settings > Service Accounts')
    console.log('4. 🔑 Click "Generate new private key" and download JSON')
    console.log('5. ✏️ Update .env.local with real values from the JSON file')
    console.log('6. 📖 Follow QUICK_SETUP.md for detailed instructions')
    console.log('7. 🔄 Restart development server with: pnpm dev')
  } else {
    console.log('\n🎉 Configuration looks good! You should be able to:')
    console.log('• ✅ Create users through admin dashboard')
    console.log('• ✅ Upload CSV files for bulk user creation')
    console.log('• ✅ All users will be stored in Firebase database')
  }

} catch (error) {
  console.error('❌ Error reading .env.local file:', error)
  console.log('📝 Please check file permissions and try again')
}