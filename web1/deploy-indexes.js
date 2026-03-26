// deploy-indexes.js - Deploy Firestore indexes to Firebase projects
const { execSync } = require('child_process');
const path = require('path');

const projects = [
  { name: 'web1', projectId: 'cobypicksswu', configPath: './firestore.indexes.json' },
  { name: 'app', projectId: 'cobypicksswu', configPath: '../app/firestore.indexes.json' }
];

console.log('🚀 Deploying Firestore indexes...\n');

projects.forEach(({ name, projectId, configPath }) => {
  console.log(`📦 Deploying indexes for ${name} project (${projectId})`);

  try {
    // Set the Firebase project
    execSync(`firebase use ${projectId}`, { stdio: 'inherit' });

    // Deploy indexes
    execSync(`firebase firestore:indexes ${configPath}`, { stdio: 'inherit' });

    console.log(`✅ Successfully deployed indexes for ${name}\n`);
  } catch (error) {
    console.error(`❌ Failed to deploy indexes for ${name}:`, error.message);
    console.log(`Manual deployment command for ${name}:`);
    console.log(`firebase use ${projectId}`);
    console.log(`firebase firestore:indexes ${configPath}\n`);
  }
});

console.log('🎉 Index deployment process completed!');
console.log('\n📝 Note: Index deployment can take several minutes to complete in Firebase.');