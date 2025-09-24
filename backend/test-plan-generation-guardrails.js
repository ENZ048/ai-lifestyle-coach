/**
 * Test: Plan Generation with Safety Guardrails
 * 
 * This test verifies the complete plan generation pipeline including:
 * - Safety analysis and guardrails
 * - Plan generation with LLM
 * - Post-processing safety filters
 * - Database integration
 */

require('dotenv').config();
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const supabaseClient = require('./lib/supabaseClient');

// Test configuration
const BASE_URL = 'http://localhost:3000/api';
const TEST_USER_ID = 'test-user-guardrails';

async function testPlanGenerationWithGuardrails() {
  console.log('🧪 Testing Plan Generation with Safety Guardrails\n');

  try {
    // Step 1: Clean up any existing test data
    console.log('1️⃣ Cleaning up existing test data...');
    await cleanupTestData();
    console.log('✅ Cleanup completed\n');

    // Step 2: Create test scenarios
    const testScenarios = [
      {
        name: 'Low Risk User',
        description: 'Healthy user with no injuries or medical conditions',
        expectedSafety: 'low',
        profile: {
          primary_goal: 'lose_fat',
          current_weight: 80,
          target_weight: 75,
          height: 175,
          activity_level: 'moderately_active',
          training_experience: 'some',
          injury_flag: 'no',
          medical_conditions: 'none'
        }
      },
      {
        name: 'Medium Risk User', 
        description: 'User with minor injury and older age',
        expectedSafety: 'medium',
        profile: {
          primary_goal: 'build_muscle',
          current_weight: 70,
          target_weight: 75,
          height: 180,
          activity_level: 'lightly_active',
          training_experience: 'beginner',
          injury_flag: 'yes',
          injury_details: 'occasional lower back pain',
          date_of_birth: '1955-01-01' // 70 years old
        }
      },
      {
        name: 'High Risk User',
        description: 'User with serious medical conditions and injuries',
        expectedSafety: 'high',
        profile: {
          primary_goal: 'general_fitness',
          current_weight: 85,
          target_weight: 80,
          height: 170,
          activity_level: 'sedentary',
          training_experience: 'none',
          injury_flag: 'yes',
          injury_details: 'recent knee surgery, chronic back pain',
          medical_conditions: 'diabetes, hypertension',
          medications: 'metformin, lisinopril'
        }
      }
    ];

    // Step 3: Test each scenario
    for (let i = 0; i < testScenarios.length; i++) {
      const scenario = testScenarios[i];
      console.log(`${i + 2}️⃣ Testing Scenario: ${scenario.name}`);
      console.log(`   Description: ${scenario.description}`);
      
      try {
        const result = await testScenario(scenario);
        console.log(`   ✅ Scenario completed successfully`);
        console.log(`   📊 Safety Level: ${result.safetyLevel} (expected: ${scenario.expectedSafety})`);
        console.log(`   🛡️ Guardrails Applied: ${result.guardrailsCount}`);
        console.log(`   📋 Plan Status: ${result.planStatus}`);
        console.log(`   🔍 Safety Review Required: ${result.safetyReviewRequired}`);
        
        // Validate results match expectations
        if (result.safetyLevel === scenario.expectedSafety) {
          console.log(`   🎯 Safety level matches expectation`);
        } else {
          console.log(`   ⚠️ Safety level mismatch - expected ${scenario.expectedSafety}, got ${result.safetyLevel}`);
        }
        
      } catch (error) {
        console.log(`   ❌ Scenario failed: ${error.message}`);
      }
      
      console.log('');
    }

    // Step 4: Test safety review workflow
    console.log(`${testScenarios.length + 2}️⃣ Testing Safety Review Workflow...`);
    await testSafetyReviewWorkflow();
    console.log('✅ Safety review workflow tested\n');

    // Step 5: Test auto-generation trigger
    console.log(`${testScenarios.length + 3}️⃣ Testing Auto-Generation Trigger...`);
    await testAutoGenerationTrigger();
    console.log('✅ Auto-generation trigger tested\n');

    console.log('🎉 All plan generation guardrails tests completed successfully!');

  } catch (error) {
    console.error('❌ Plan generation guardrails test failed:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

async function testScenario(scenario) {
  // Create user and session
  const userId = uuidv4();
  const sessionId = uuidv4();

  // Create user
  await supabaseClient.from('users').insert({
    id: userId,
    firebase_uid: `test-${userId}`,
    phone_number: '+1555000' + Math.floor(Math.random() * 10000),
    timezone: 'America/New_York'
  });

  // Create profile with extras
  await supabaseClient.from('profiles').insert({
    user_id: userId,
    name: 'Test User',
    sex: 'male',
    weight_kg: scenario.profile.current_weight,
    height_cm: scenario.profile.height,
    date_of_birth: scenario.profile.date_of_birth || '1990-01-01',
    primary_goal: scenario.profile.primary_goal,
    target_weight_kg: scenario.profile.target_weight,
    activity_level: scenario.profile.activity_level,
    training_experience: scenario.profile.training_experience,
    injury: scenario.profile.injury_flag,
    injury_notes: scenario.profile.injury_details,
    medical_conditions: scenario.profile.medical_conditions,
    medications: scenario.profile.medications
  });

  // Create onboarding session
  await supabaseClient.from('onboarding_sessions').insert({
    id: sessionId,
    user_id: userId,
    status: 'completed',
    ready_for_plan_generation: true,
    missing_required_fields: []
  });

  // Create onboarding responses
  const responses = [
    {
      session_id: sessionId,
      user_id: userId,
      question_id: 'primary_goal_v1',
      question_text: 'What is your primary goal?',
      raw_answer_text: scenario.profile.primary_goal.replace('_', ' '),
      parsed_value: { field: 'primary_goal', value: scenario.profile.primary_goal },
      parsed_confidence: 0.95
    },
    {
      session_id: sessionId,
      user_id: userId,
      question_id: 'current_weight_v1',
      question_text: 'What is your current weight?',
      raw_answer_text: `${scenario.profile.current_weight}kg`,
      parsed_value: { field: 'current_weight', value: scenario.profile.current_weight, unit: 'kg' },
      parsed_confidence: 0.98
    },
    {
      session_id: sessionId,
      user_id: userId,
      question_id: 'injury_flag_v1',
      question_text: 'Do you have any injuries?',
      raw_answer_text: scenario.profile.injury_flag === 'yes' ? 'Yes, I have some injuries' : 'No injuries',
      parsed_value: { field: 'injury_flag', value: scenario.profile.injury_flag },
      parsed_confidence: 0.92
    }
  ];

  if (scenario.profile.injury_details) {
    responses.push({
      session_id: sessionId,
      user_id: userId,
      question_id: 'injury_details_v1',
      question_text: 'Please describe your injuries',
      raw_answer_text: scenario.profile.injury_details,
      parsed_value: { field: 'injury_details', value: scenario.profile.injury_details },
      parsed_confidence: 0.88
    });
  }

  if (scenario.profile.medical_conditions && scenario.profile.medical_conditions !== 'none') {
    responses.push({
      session_id: sessionId,
      user_id: userId,
      question_id: 'medical_conditions_v1',
      question_text: 'Do you have any medical conditions?',
      raw_answer_text: scenario.profile.medical_conditions,
      parsed_value: { field: 'medical_conditions', value: scenario.profile.medical_conditions },
      parsed_confidence: 0.90
    });
  }

  if (scenario.profile.date_of_birth) {
    responses.push({
      session_id: sessionId,
      user_id: userId,
      question_id: 'date_of_birth_v1',
      question_text: 'What is your date of birth?',
      raw_answer_text: scenario.profile.date_of_birth,
      parsed_value: { field: 'date_of_birth', value: scenario.profile.date_of_birth },
      parsed_confidence: 0.95
    });
  }

  await supabaseClient.from('onboarding_responses').insert(responses);

  // Test plan generation via API
  const response = await axios.post(`${BASE_URL}/plans/generate-with-guardrails`, {
    user_id: userId,
    session_id: sessionId,
    force: false,
    include_user_summaries: false
  }, {
    headers: {
      'Authorization': 'Bearer mock-token', // Mock token for testing
      'Content-Type': 'application/json'
    }
  });

  const planData = response.data;

  return {
    userId,
    sessionId,
    planId: planData.plan_id,
    safetyLevel: planData.generation_info.safety_analysis.level,
    guardrailsCount: planData.generation_info.safety_analysis.modifications?.length || 0,
    planStatus: planData.plan.status,
    safetyReviewRequired: planData.generation_info.safety_review_required,
    planData
  };
}

async function testSafetyReviewWorkflow() {
  // Create a high-risk plan that requires review
  const userId = uuidv4();
  const planId = uuidv4();

  // Create user
  await supabaseClient.from('users').insert({
    id: userId,
    firebase_uid: `test-review-${userId}`,
    phone_number: '+1555001234',
    timezone: 'America/New_York'
  });

  // Create a draft plan requiring safety review
  await supabaseClient.from('plans').insert({
    id: planId,
    user_id: userId,
    plan_json: { title: 'Test High Risk Plan' },
    status: 'draft',
    summary_text: 'Test plan requiring safety review',
    safety_analysis: { level: 'high', requiresReview: true }
  });

  // Test safety review approval
  const reviewerId = uuidv4();
  await supabaseClient.from('users').insert({
    id: reviewerId,
    firebase_uid: `reviewer-${reviewerId}`,
    phone_number: '+1555005678',
    timezone: 'America/New_York'
  });

  const reviewResponse = await axios.post(`${BASE_URL}/plans/${planId}/safety-review`, {
    approved: true,
    reviewer_id: reviewerId,
    review_notes: 'Plan approved after review - modifications applied for safety',
    modifications: ['reduced_intensity', 'added_safety_notes']
  }, {
    headers: {
      'Authorization': 'Bearer mock-token',
      'Content-Type': 'application/json'
    }
  });

  console.log(`   📋 Safety Review Response: ${reviewResponse.data.status}`);
  console.log(`   👤 Reviewed by: ${reviewResponse.data.reviewed_by}`);
}

async function testAutoGenerationTrigger() {
  // Create a completed session ready for auto-generation
  const userId = uuidv4();
  const sessionId = uuidv4();

  // Create user
  await supabaseClient.from('users').insert({
    id: userId,
    firebase_uid: `test-auto-${userId}`,
    phone_number: '+1555009999',
    timezone: 'America/New_York'
  });

  // Create profile
  await supabaseClient.from('profiles').insert({
    user_id: userId,
    name: 'Auto Generation Test User',
    sex: 'female',
    weight_kg: 65,
    height_cm: 165,
    primary_goal: 'general_fitness'
  });

  // Create completed session
  await supabaseClient.from('onboarding_sessions').insert({
    id: sessionId,
    user_id: userId,
    status: 'completed',
    ready_for_plan_generation: true,
    missing_required_fields: [],
    trigger_plan_when_ready: true
  });

  // Create minimal responses
  await supabaseClient.from('onboarding_responses').insert([
    {
      session_id: sessionId,
      user_id: userId,
      question_id: 'primary_goal_v1',
      question_text: 'What is your primary goal?',
      raw_answer_text: 'general fitness',
      parsed_value: { field: 'primary_goal', value: 'general_fitness' },
      parsed_confidence: 0.90
    }
  ]);

  // Trigger auto-generation
  const autoResponse = await axios.post(`${BASE_URL}/plans/auto-generate`, {
    session_id: sessionId
  }, {
    headers: {
      'Authorization': 'Bearer mock-token',
      'Content-Type': 'application/json'
    }
  });

  console.log(`   🤖 Auto-generation Response: ${autoResponse.data.message}`);
  console.log(`   ⏱️ Estimated Completion: ${autoResponse.data.estimated_completion}`);
}

async function cleanupTestData() {
  // Clean up test users and related data
  const testUsers = await supabaseClient
    .from('users')
    .select('id')
    .like('firebase_uid', 'test-%');

  if (testUsers.data && testUsers.data.length > 0) {
    const userIds = testUsers.data.map(u => u.id);
    
    // Delete related data (cascade should handle most, but clean up explicitly)
    await supabaseClient.from('plans').delete().in('user_id', userIds);
    await supabaseClient.from('onboarding_responses').delete().in('user_id', userIds);
    await supabaseClient.from('onboarding_sessions').delete().in('user_id', userIds);
    await supabaseClient.from('profiles').delete().in('user_id', userIds);
    await supabaseClient.from('users').delete().in('id', userIds);
  }
}

// Helper function to run the test
async function runTest() {
  await testPlanGenerationWithGuardrails();
}

// Export for use in other test files
module.exports = {
  testPlanGenerationWithGuardrails,
  runTest
};

// Run test if called directly
if (require.main === module) {
  runTest();
}