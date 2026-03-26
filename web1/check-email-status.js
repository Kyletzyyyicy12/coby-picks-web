// Quick diagnostic script for CobyPicks email service
// Run with: node check-email-status.js

console.log('🔧 CobyPicks Email Service Status Check');
console.log('=====================================\n');

// Check environment variables
console.log('📋 Environment Variables:');
const envVars = {
  EMAIL_USER: process.env.EMAIL_USER,
  EMAIL_PASSWORD: '***' + (process.env.EMAIL_PASSWORD?.slice(-4) || 'NOT SET'),
  EMAIL_FROM: process.env.EMAIL_FROM
};

Object.entries(envVars).forEach(([key, value]) => {
  const status = value && value !== 'NOT SET' ? '✅' : '❌';
  console.log(`  ${status} ${key}: ${value}`);
});

console.log('');

// Validate Gmail configuration
console.log('🔍 Gmail Configuration Validation:');
const issues = [];

if (!process.env.EMAIL_USER) {
  issues.push('EMAIL_USER is not set');
}

if (!process.env.EMAIL_PASSWORD) {
  issues.push('EMAIL_PASSWORD is not set');
} else if (process.env.EMAIL_PASSWORD.length < 8) {
  issues.push('EMAIL_PASSWORD appears to be too short (should be 16 characters for Gmail app password)');
}

if (!process.env.EMAIL_FROM) {
  issues.push('EMAIL_FROM is not set');
}

if (issues.length > 0) {
  console.log('❌ Issues found:');
  issues.forEach(issue => console.log(`   - ${issue}`));
} else {
  console.log('✅ All required environment variables are set');
  console.log('✅ Gmail account:', process.env.EMAIL_USER);
  console.log('✅ App password length:', process.env.EMAIL_PASSWORD?.length || 0, 'characters');
  console.log('✅ From address:', process.env.EMAIL_FROM);
}

console.log('');

// Recommendations
console.log('💡 Recommendations:');
if (issues.length > 0) {
  console.log('   1. Check your .env.local file for missing variables');
  console.log('   2. Ensure you are using a Gmail App Password (not regular password)');
  console.log('   3. Visit Gmail Setup Guide: GMAIL_SETUP_GUIDE.md');
} else {
  console.log('   1. Test connection: npm run test:email');
  console.log('   2. Test email sending: npm run test:email your-email@example.com');
  console.log('   3. Start Next.js server: npm run dev');
}

console.log('');

// Quick status summary
console.log('📊 Status Summary:');
if (issues.length === 0) {
  console.log('🟢 READY: Email service appears to be configured correctly');
  console.log('   You can proceed with testing the email functionality');
} else {
  console.log('🔴 NOT READY: Please fix the configuration issues above');
  console.log('   Email service will not work until issues are resolved');
}

console.log('\n🎯 Next Steps:');
console.log('   1. Fix any configuration issues shown above');
console.log('   2. Run: npm run test:email (test connection)');
console.log('   3. Run: npm run test:email your-email@example.com (test sending)');
console.log('   4. Start development server: npm run dev');
console.log('   5. Test signup verification in the web application');