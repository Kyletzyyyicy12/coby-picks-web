#!/usr/bin/env node

/**
 * 2FA Verification System Validation Checklist
 * 
 * This checklist ensures both signup verification and password reset verification
 * flows are properly configured and working in the CobyPicks application.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔍 CobyPicks 2FA Verification System Validation');
console.log('=' .repeat(60));

const checks = [];
let allPassed = true;

function addCheck(name, status, message) {
  checks.push({ name, status, message });
  const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
  console.log(`${icon} ${name}: ${message}`);
  if (status === 'FAIL') allPassed = false;
}

// 1. Check File Structure
console.log('\n📁 File Structure Validation');
console.log('-'.repeat(30));

const requiredFiles = [
  'components/auth/auth-form.tsx',
  'components/auth/signup-verification-modal.tsx', 
  'components/auth/password-reset-verification-modal.tsx',
  'components/auth/verification-code-input.tsx',
  'lib/email-service.ts',
  'app/api/auth/send-signup-verification/route.ts',
  'app/api/auth/verify-signup-code/route.ts',
  'app/api/auth/send-reset-verification/route.ts', 
  'app/api/auth/verify-reset-code/route.ts',
  'app/api/auth/update-password/route.ts',
  '.env.local'
];

requiredFiles.forEach(file => {
  const fullPath = path.join(process.cwd(), file);
  if (fs.existsSync(fullPath)) {
    addCheck(`File: ${file}`, 'PASS', 'Exists');
  } else {
    addCheck(`File: ${file}`, 'FAIL', 'Missing');
  }
});

// 2. Check Environment Configuration
console.log('\n🔧 Environment Configuration');
console.log('-'.repeat(30));

const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  
  const requiredEnvVars = [
    'EMAIL_USER',
    'EMAIL_PASSWORD', 
    'EMAIL_FROM',
    'FIREBASE_PROJECT_ID',
    'FIREBASE_CLIENT_EMAIL',
    'FIREBASE_PRIVATE_KEY'
  ];
  
  requiredEnvVars.forEach(envVar => {
    if (envContent.includes(`${envVar}=`) && !envContent.includes(`${envVar}=your_`)) {
      addCheck(`ENV: ${envVar}`, 'PASS', 'Configured');
    } else {
      addCheck(`ENV: ${envVar}`, 'FAIL', 'Missing or not configured');
    }
  });
} else {
  addCheck('ENV File', 'FAIL', '.env.local not found');
}

// 3. Check Component Integration
console.log('\n🔗 Component Integration');
console.log('-'.repeat(30));

const authFormPath = path.join(process.cwd(), 'components/auth/auth-form.tsx');
if (fs.existsSync(authFormPath)) {
  const authFormContent = fs.readFileSync(authFormPath, 'utf8');
  
  // Check for signup verification integration
  if (authFormContent.includes('SignupVerificationModal') && 
      authFormContent.includes('handleSignupVerificationSuccess') &&
      authFormContent.includes('send-signup-verification')) {
    addCheck('Signup Verification Integration', 'PASS', 'Properly integrated in auth form');
  } else {
    addCheck('Signup Verification Integration', 'FAIL', 'Not properly integrated');
  }
  
  // Check for password reset verification integration
  if (authFormContent.includes('PasswordResetVerificationModal') &&
      authFormContent.includes('send-reset-verification')) {
    addCheck('Password Reset Integration', 'PASS', 'Properly integrated in auth form');
  } else {
    addCheck('Password Reset Integration', 'FAIL', 'Not properly integrated');
  }
  
  // Check that login verification is removed
  if (!authFormContent.includes('LoginVerificationModal') &&
      !authFormContent.includes('send-login-verification')) {
    addCheck('Login Verification Removal', 'PASS', 'Login verification properly removed');
  } else {
    addCheck('Login Verification Removal', 'FAIL', 'Login verification still present');
  }
}

// 4. Check API Endpoints Structure
console.log('\n🌐 API Endpoints Validation');
console.log('-'.repeat(30));

const apiEndpoints = [
  'app/api/auth/send-signup-verification/route.ts',
  'app/api/auth/verify-signup-code/route.ts', 
  'app/api/auth/send-reset-verification/route.ts',
  'app/api/auth/verify-reset-code/route.ts',
  'app/api/auth/update-password/route.ts'
];

apiEndpoints.forEach(endpoint => {
  const fullPath = path.join(process.cwd(), endpoint);
  if (fs.existsSync(fullPath)) {
    const content = fs.readFileSync(fullPath, 'utf8');
    
    // Check for proper POST method
    if (content.includes('export async function POST')) {
      addCheck(`API: ${endpoint.split('/').pop().replace('.ts', '')}`, 'PASS', 'Properly structured');
    } else {
      addCheck(`API: ${endpoint.split('/').pop().replace('.ts', '')}`, 'FAIL', 'Missing POST method');
    }
  }
});

// 5. Check Email Service Configuration
console.log('\n📧 Email Service Validation');
console.log('-'.repeat(30));

const emailServicePath = path.join(process.cwd(), 'lib/email-service.ts');
if (fs.existsSync(emailServicePath)) {
  const emailContent = fs.readFileSync(emailServicePath, 'utf8');
  
  // Check for required functions
  const requiredFunctions = [
    'generateVerificationCode',
    'storeVerificationCode',
    'verifyVerificationCode', 
    'sendVerificationEmail',
    'createPasswordResetVerificationTemplate',
    'createSignupVerificationTemplate'
  ];
  
  requiredFunctions.forEach(func => {
    if (emailContent.includes(`export const ${func}`) || emailContent.includes(`const ${func}`)) {
      addCheck(`Email Function: ${func}`, 'PASS', 'Implemented');
    } else {
      addCheck(`Email Function: ${func}`, 'FAIL', 'Missing');
    }
  });
  
  // Check that login verification template is removed
  if (!emailContent.includes('createLoginVerificationTemplate')) {
    addCheck('Login Template Removal', 'PASS', 'Login verification template removed');
  } else {
    addCheck('Login Template Removal', 'FAIL', 'Login verification template still present');
  }
  
  // Check type definitions
  if (emailContent.includes("type: 'password-reset' | 'signup'")) {
    addCheck('Type Definitions', 'PASS', 'Correctly defined without login type');
  } else {
    addCheck('Type Definitions', 'FAIL', 'Type definitions incorrect');
  }
}

// 6. Summary and Recommendations
console.log('\n📊 Validation Summary');
console.log('=' .repeat(60));

const passCount = checks.filter(c => c.status === 'PASS').length;
const failCount = checks.filter(c => c.status === 'FAIL').length;
const warnCount = checks.filter(c => c.status === 'WARN').length;

console.log(`✅ Passed: ${passCount}`);
console.log(`❌ Failed: ${failCount}`);
console.log(`⚠️ Warnings: ${warnCount}`);

if (allPassed) {
  console.log('\n🎉 All checks passed! Your 2FA verification system is properly configured.');
  console.log('\n📝 Next steps:');
  console.log('1. Start the development server: npm run dev');
  console.log('2. Test signup flow with a real email address');
  console.log('3. Test password reset flow with a real email address');
  console.log('4. Verify email delivery and code validation');
  console.log('5. Test error scenarios (expired codes, invalid codes)');
} else {
  console.log('\n⚠️ Some checks failed. Please review the failed items above.');
  console.log('\n🔧 Common fixes:');
  console.log('- Ensure all required files exist');
  console.log('- Verify .env.local configuration');
  console.log('- Check component imports and integration');
  console.log('- Validate API endpoint implementation');
}

console.log('\n📈 System Status: ' + (allPassed ? '🟢 READY' : '🔴 NEEDS ATTENTION'));