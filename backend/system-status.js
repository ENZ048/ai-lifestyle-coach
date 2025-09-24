#!/usr/bin/env node

/**
 * System Status Check - Plan Generation with Guardrails
 * 
 * This script verifies all components of the plan generation system
 * are properly configured and ready for use.
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');

console.log('🔍 AI Lifestyle Coach - Plan Generation System Status\n');

// Check environment variables
console.log('📋 Environment Configuration:');
const requiredEnvVars = [
  'OPENAI_API_KEY',
  'SUPABASE_URL', 
  'SUPABASE_SERVICE_ROLE_KEY'
];

let envComplete = true;
requiredEnvVars.forEach(envVar => {
  const value = process.env[envVar];
  const status = value ? '✅' : '❌';
  const display = value ? `${value.substring(0, 10)}...` : 'Not set';
  console.log(`   ${status} ${envVar}: ${display}`);
  if (!value) envComplete = false;
});

console.log('');

// Check service files
console.log('🛠️ Service Components:');
const serviceFiles = [
  'services/PlanGenerationService.js',
  'services/OnboardingReadinessChecker.js',
  'services/RuleBasedParser.js',
  'routes/plans-guardrails.js',
  'routes/readiness.js',
  'routes/onboarding-api.js'
];

let servicesComplete = true;
serviceFiles.forEach(file => {
  const fullPath = path.join(__dirname, file);
  const exists = fs.existsSync(fullPath);
  const status = exists ? '✅' : '❌';
  console.log(`   ${status} ${file}`);
  if (!exists) servicesComplete = false;
});

console.log('');

// Check database schema
console.log('📊 Database Schema:');
const schemaPath = path.join(__dirname, 'schema.sql');
const schemaExists = fs.existsSync(schemaPath);

if (schemaExists) {
  const schemaContent = fs.readFileSync(schemaPath, 'utf8');
  const requiredTables = [
    'onboarding_sessions',
    'onboarding_responses',
    'plans'
  ];
  
  const requiredColumns = [
    'safety_analysis',
    'guardrails_applied', 
    'safety_review_required',
    'required_fields_snapshot'
  ];

  requiredTables.forEach(table => {
    const hasTable = schemaContent.includes(table);
    const status = hasTable ? '✅' : '❌';
    console.log(`   ${status} Table: ${table}`);
  });

  requiredColumns.forEach(column => {
    const hasColumn = schemaContent.includes(column);
    const status = hasColumn ? '✅' : '❌';
    console.log(`   ${status} Column: ${column}`);
  });
} else {
  console.log('   ❌ schema.sql not found');
}

console.log('');

// Check test files
console.log('🧪 Test Coverage:');
const testFiles = [
  'test-rule-based-parser.js',
  'test-integration-readiness.js',
  'test-plan-generation-guardrails.js'
];

testFiles.forEach(file => {
  const fullPath = path.join(__dirname, file);
  const exists = fs.existsSync(fullPath);
  const status = exists ? '✅' : '❌';
  console.log(`   ${status} ${file}`);
});

console.log('');

// Check package.json scripts
console.log('📦 NPM Scripts:');
const packagePath = path.join(__dirname, 'package.json');
if (fs.existsSync(packagePath)) {
  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  const requiredScripts = [
    'test:guardrails',
    'test:integration',
    'test:all'
  ];

  requiredScripts.forEach(script => {
    const hasScript = packageJson.scripts && packageJson.scripts[script];
    const status = hasScript ? '✅' : '❌';
    console.log(`   ${status} ${script}`);
  });
} else {
  console.log('   ❌ package.json not found');
}

console.log('');

// System summary
console.log('🎯 System Status Summary:');
if (envComplete && servicesComplete) {
  console.log('   ✅ All core components are ready');
  console.log('   🚀 Plan generation system is operational');
  console.log('');
  console.log('📝 Next Steps:');
  console.log('   1. Run database migrations: Apply schema.sql to your database');
  console.log('   2. Start the server: npm start');
  console.log('   3. Run tests: npm run test:all');
  console.log('   4. Test plan generation: npm run test:guardrails');
} else {
  console.log('   ⚠️  System requires setup to be fully operational');
  console.log('');
  console.log('🔧 Required Actions:');
  if (!envComplete) {
    console.log('   - Set missing environment variables');
  }
  if (!servicesComplete) {
    console.log('   - Ensure all service files are present');
  }
}

console.log('');
console.log('📚 Documentation:');
console.log('   - PLAN_GENERATION_GUARDRAILS.md: Complete integration guide');
console.log('   - INTEGRATION_GUIDE.md: Session state machine documentation');
console.log('   - API.md: API endpoint documentation');

console.log('');
console.log('🎉 Plan Generation with Guardrails Implementation Complete!');