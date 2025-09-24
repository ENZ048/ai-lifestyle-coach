/**
 * Test Integration: Readiness Checker with Onboarding API
 * 
 * This test verifies that the readiness checker is properly integrated
 * with the response submission endpoint and provides real-time session
 * state updates.
 */

const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

// Test configuration
const BASE_URL = 'http://localhost:3000/api/onboarding';
const TEST_USER_ID = 'test-user-integration';

async function testReadinessIntegration() {
  console.log('🧪 Testing Readiness Checker Integration\n');

  try {
    // 1. Create a new onboarding session
    console.log('1️⃣ Creating onboarding session...');
    const sessionResponse = await axios.post(`${BASE_URL}/session`, {
      user_id: TEST_USER_ID,
      session_type: 'full'
    });

    const sessionId = sessionResponse.data.session_id;
    console.log(`✅ Session created: ${sessionId}\n`);

    // 2. Submit responses and check readiness after each one
    const testResponses = [
      {
        question_id: 'goal',
        question_text: 'What is your primary fitness goal?',
        raw_answer_text: 'I want to lose 20 pounds and build muscle'
      },
      {
        question_id: 'current_weight',
        question_text: 'What is your current weight?',
        raw_answer_text: '180 lbs'
      },
      {
        question_id: 'height',
        question_text: 'What is your height?',
        raw_answer_text: '5 feet 10 inches'
      },
      {
        question_id: 'activity_level',
        question_text: 'How active are you currently?',
        raw_answer_text: 'I exercise 3-4 times per week, mostly cardio and some weights'
      },
      {
        question_id: 'medical_conditions',
        question_text: 'Do you have any medical conditions or injuries?',
        raw_answer_text: 'No major health issues, just occasional lower back pain from sitting at desk'
      }
    ];

    for (let i = 0; i < testResponses.length; i++) {
      const response = testResponses[i];
      console.log(`${i + 2}️⃣ Submitting response for: ${response.question_id}`);
      console.log(`   Raw answer: "${response.raw_answer_text}"`);

      const submitResponse = await axios.post(`${BASE_URL}/session/${sessionId}/response`, {
        question_id: response.question_id,
        question_text: response.question_text,
        raw_answer_text: response.raw_answer_text,
        timestamp: new Date().toISOString()
      });

      console.log(`   ✅ Response saved with confidence: ${submitResponse.data.parsed_confidence}`);
      
      // Check if readiness info was included
      if (submitResponse.data.session_status) {
        console.log(`   📊 Session Status: ${submitResponse.data.session_status}`);
        console.log(`   🎯 Ready for Plan: ${submitResponse.data.ready_for_plan}`);
        
        if (submitResponse.data.readiness_analysis) {
          const analysis = submitResponse.data.readiness_analysis;
          console.log(`   📈 Confidence Score: ${analysis.confidence_score}`);
          console.log(`   ❌ Missing Fields: ${analysis.missing_fields.length}`);
          console.log(`   ⚠️  Safety Risk: ${analysis.safety_risk}`);
        }
      } else {
        console.log('   ⚠️  No readiness info returned - check integration');
      }
      
      console.log('');
    }

    // 3. Check final session readiness using dedicated endpoint
    console.log('6️⃣ Checking final session readiness...');
    const readinessResponse = await axios.get(`http://localhost:3000/api/readiness/session/${sessionId}`);
    
    console.log(`✅ Final readiness check complete:`);
    console.log(`   Status: ${readinessResponse.data.status}`);
    console.log(`   Ready for Plan: ${readinessResponse.data.readyForPlan}`);
    console.log(`   Overall Confidence: ${readinessResponse.data.analysis.overallConfidence}`);
    console.log(`   Missing Required: ${readinessResponse.data.analysis.missingRequired.length} fields`);
    console.log(`   Safety Risk: ${readinessResponse.data.analysis.safetyRisk?.level || 'none'}`);

    console.log('\n🎉 Integration test completed successfully!');

  } catch (error) {
    console.error('❌ Integration test failed:', error.response?.data || error.message);
    
    if (error.response?.status === 404) {
      console.log('\n💡 Tip: Make sure the server is running on port 3000');
      console.log('   Run: npm start or node server.js');
    }
  }
}

// Helper function to run the test
async function runTest() {
  await testReadinessIntegration();
}

// Export for use in other test files
module.exports = {
  testReadinessIntegration,
  runTest
};

// Run test if called directly
if (require.main === module) {
  runTest();
}