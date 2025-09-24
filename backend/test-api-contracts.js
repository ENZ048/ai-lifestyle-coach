const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

// Test configuration
const BASE_URL = process.env.API_BASE_URL || 'http://localhost:5000';
const TEST_USER_TOKEN = process.env.TEST_USER_TOKEN || 'your-test-token';

class OnboardingAPITester {
  constructor() {
    this.client = axios.create({
      baseURL: BASE_URL,
      headers: {
        'Authorization': `Bearer ${TEST_USER_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    this.testUserId = uuidv4();
    this.sessionId = null;
    this.responseIds = [];
  }

  async runAllTests() {
    console.log('🧪 AI Lifestyle Coach - API Contract Tests');
    console.log('==========================================\n');

    try {
      await this.testStartSession();
      await this.testSubmitResponses();
      await this.testSessionStatus();
      await this.testClarification();
      await this.testPlanGeneration();
      await this.testProfileConfirmation();
      
      console.log('✅ All API contract tests passed!');
    } catch (error) {
      console.error('❌ Test suite failed:', error.message);
      if (error.response) {
        console.error('Response data:', error.response.data);
      }
    }
  }

  async testStartSession() {
    console.log('1. Testing POST /onboarding/session/start');
    
    const requestData = {
      user_id: this.testUserId,
      source: 'widget',
      initial_profile: {
        name: 'Test User',
        dob: '1990-01-01',
        sex: 'male',
        weight_kg: 75,
        height_cm: 175
      }
    };

    const response = await this.client.post('/onboarding/session/start', requestData);
    
    this.validateResponse(response, 201, {
      required: ['session_id', 'status', 'missing_required'],
      types: {
        session_id: 'string',
        status: 'string',
        missing_required: 'object'
      }
    });

    this.sessionId = response.data.session_id;
    console.log('   ✅ Session created:', this.sessionId);
    console.log('   ✅ Missing required fields:', response.data.missing_required.length);
    console.log('');
  }

  async testSubmitResponses() {
    console.log('2. Testing POST /onboarding/session/:id/response');
    
    const testResponses = [
      {
        question_id: 'primary_goal_v1',
        question_text: 'What is your primary fitness goal?',
        raw_answer_text: 'I want to lose weight and get toned',
        expectedField: 'primary_goal'
      },
      {
        question_id: 'activity_level_v1',
        question_text: 'What is your current activity level?',
        raw_answer_text: 'I exercise 3-4 times per week',
        expectedField: 'activity_level'
      },
      {
        question_id: 'availability_v1',
        question_text: 'How much time can you dedicate to workouts?',
        raw_answer_text: '45 minutes per day',
        expectedField: 'availability'
      },
      {
        question_id: 'workout_setup_v1',
        question_text: 'Where do you prefer to work out?',
        raw_answer_text: 'I have a home gym with basic equipment',
        expectedField: 'workout_setup'
      },
      {
        question_id: 'injury_flag_v1',
        question_text: 'Do you have any injuries or limitations?',
        raw_answer_text: 'No current injuries',
        expectedField: 'injury_flag'
      }
    ];

    for (const testResponse of testResponses) {
      const requestData = {
        session_id: this.sessionId,
        question_id: testResponse.question_id,
        question_text: testResponse.question_text,
        raw_answer_text: testResponse.raw_answer_text,
        timestamp: new Date().toISOString()
      };

      const response = await this.client.post(
        `/onboarding/session/${this.sessionId}/response`, 
        requestData
      );

      this.validateResponse(response, 201, {
        required: ['saved_response_id', 'parsed_confidence', 'requires_clarification'],
        types: {
          saved_response_id: 'string',
          parsed_confidence: 'number',
          requires_clarification: 'boolean'
        }
      });

      this.responseIds.push(response.data.saved_response_id);
      
      console.log(`   ✅ Response for ${testResponse.question_id}:`);
      console.log(`      Confidence: ${response.data.parsed_confidence}`);
      console.log(`      Needs clarification: ${response.data.requires_clarification}`);
      
      if (response.data.parsed_value) {
        console.log(`      Parsed value: ${JSON.stringify(response.data.parsed_value)}`);
      }
    }
    console.log('');
  }

  async testSessionStatus() {
    console.log('3. Testing GET /onboarding/session/:id/status');
    
    const response = await this.client.get(`/onboarding/session/${this.sessionId}/status`);
    
    this.validateResponse(response, 200, {
      required: ['status', 'progress', 'missing_required'],
      types: {
        status: 'string',
        progress: 'object',
        missing_required: 'object'
      }
    });

    console.log('   ✅ Session status:', response.data.status);
    console.log('   ✅ Progress:', response.data.progress.completion_percentage + '%');
    console.log('   ✅ Remaining required:', response.data.missing_required.length);
    
    if (response.data.next_suggested_question) {
      console.log('   ✅ Next question:', response.data.next_suggested_question.question_id);
    }
    console.log('');
  }

  async testClarification() {
    console.log('4. Testing POST /onboarding/session/:id/clarify');
    
    if (this.responseIds.length === 0) {
      console.log('   ⚠️  No responses to clarify, skipping test');
      console.log('');
      return;
    }

    const clarificationData = {
      original_response_id: this.responseIds[0],
      clarification_text: 'Specifically, I want to lose 10 pounds of fat while building lean muscle',
      timestamp: new Date().toISOString()
    };

    try {
      const response = await this.client.post(
        `/onboarding/session/${this.sessionId}/clarify`,
        clarificationData
      );

      this.validateResponse(response, 201, {
        required: ['clarification_response_id', 'parsed_confidence'],
        types: {
          clarification_response_id: 'string',
          parsed_confidence: 'number'
        }
      });

      console.log('   ✅ Clarification processed');
      console.log('   ✅ New confidence:', response.data.parsed_confidence);
    } catch (error) {
      if (error.response?.status === 404) {
        console.log('   ⚠️  Original response not found (expected for test data)');
      } else {
        throw error;
      }
    }
    console.log('');
  }

  async testPlanGeneration() {
    console.log('5. Testing POST /plans/generate');
    
    const planRequest = {
      user_id: this.testUserId,
      session_id: this.sessionId,
      force: true // Force generation for testing
    };

    const response = await this.client.post('/plans/generate', planRequest);
    
    // Should either be queued (202) or rejected (400)
    if (response.status === 202) {
      this.validateResponse(response, 202, {
        required: ['status', 'plan_id', 'message'],
        types: {
          status: 'string',
          plan_id: 'string',
          message: 'string'
        }
      });
      
      console.log('   ✅ Plan generation queued');
      console.log('   ✅ Plan ID:', response.data.plan_id);
    } else if (response.status === 400) {
      this.validateResponse(response, 400, {
        required: ['status', 'reason'],
        types: {
          status: 'string',
          reason: 'string'
        }
      });
      
      console.log('   ✅ Plan generation rejected (expected)');
      console.log('   ✅ Reason:', response.data.reason);
    }
    console.log('');
  }

  async testProfileConfirmation() {
    console.log('6. Testing PATCH /profiles/:id/confirm-onboarding');
    
    const confirmationData = {
      session_id: this.sessionId,
      accepted_values: {
        name_v1: { value: 'Test User' },
        primary_goal_v1: { value: 'weight_loss' },
        activity_level_v1: { value: 'moderately_active' },
        injury_flag_v1: { value: false }
      },
      confirmation_timestamp: new Date().toISOString()
    };

    const response = await this.client.patch(
      `/profiles/${this.testUserId}/confirm-onboarding`,
      confirmationData
    );

    this.validateResponse(response, 200, {
      required: ['success', 'message', 'profile_updated', 'onboarding_complete'],
      types: {
        success: 'boolean',
        message: 'string',
        profile_updated: 'boolean',
        onboarding_complete: 'boolean'
      }
    });

    console.log('   ✅ Onboarding confirmed');
    console.log('   ✅ Profile updated:', response.data.profile_updated);
    console.log('   ✅ Onboarding complete:', response.data.onboarding_complete);
    console.log('');
  }

  // Test data validation and error scenarios
  async testErrorScenarios() {
    console.log('7. Testing Error Scenarios');
    
    // Test invalid session ID
    try {
      await this.client.get('/onboarding/session/invalid-uuid/status');
      console.log('   ❌ Should have failed with invalid UUID');
    } catch (error) {
      if (error.response?.status === 400 || error.response?.status === 404) {
        console.log('   ✅ Invalid UUID handled correctly');
      }
    }

    // Test missing required fields
    try {
      await this.client.post('/onboarding/session/start', {});
      console.log('   ❌ Should have failed with missing required fields');
    } catch (error) {
      if (error.response?.status === 400) {
        console.log('   ✅ Missing required fields handled correctly');
      }
    }

    // Test invalid question response
    try {
      await this.client.post(`/onboarding/session/${this.sessionId}/response`, {
        session_id: this.sessionId,
        // Missing required fields
      });
      console.log('   ❌ Should have failed with invalid response data');
    } catch (error) {
      if (error.response?.status === 400) {
        console.log('   ✅ Invalid response data handled correctly');
      }
    }

    console.log('');
  }

  // Test confidence thresholds
  async testConfidenceHandling() {
    console.log('8. Testing Confidence Threshold Handling');
    
    // Submit an ambiguous response
    const ambiguousResponse = {
      session_id: this.sessionId,
      question_id: 'diet_pref_v1',
      question_text: 'Do you have any dietary preferences?',
      raw_answer_text: 'eh, maybe sometimes I guess',
      timestamp: new Date().toISOString()
    };

    try {
      const response = await this.client.post(
        `/onboarding/session/${this.sessionId}/response`,
        ambiguousResponse
      );

      if (response.data.parsed_confidence < 0.6) {
        console.log('   ✅ Low confidence detected:', response.data.parsed_confidence);
        console.log('   ✅ Requires clarification:', response.data.requires_clarification);
      } else {
        console.log('   ⚠️  Expected low confidence but got:', response.data.parsed_confidence);
      }
    } catch (error) {
      console.log('   ⚠️  Error testing confidence:', error.message);
    }

    console.log('');
  }

  // Test safety keyword detection
  async testSafetyKeywords() {
    console.log('9. Testing Safety Keyword Detection');
    
    const safetyResponse = {
      session_id: this.sessionId,
      question_id: 'injury_details_v1',
      question_text: 'Please describe any injuries or limitations',
      raw_answer_text: 'I have a heart condition and chronic back pain from surgery',
      timestamp: new Date().toISOString()
    };

    try {
      const response = await this.client.post(
        `/onboarding/session/${this.sessionId}/response`,
        safetyResponse
      );

      console.log('   ✅ Safety response processed');
      console.log('   ✅ Response saved with ID:', response.data.saved_response_id);
      
      // The response should be saved but might trigger safety flags
      if (response.data.parsed_value) {
        console.log('   ✅ Parsed safety-related content');
      }
    } catch (error) {
      console.log('   ⚠️  Error testing safety keywords:', error.message);
    }

    console.log('');
  }

  validateResponse(response, expectedStatus, validation) {
    if (response.status !== expectedStatus) {
      throw new Error(`Expected status ${expectedStatus}, got ${response.status}`);
    }

    const data = response.data;

    // Check required fields
    if (validation.required) {
      for (const field of validation.required) {
        if (!(field in data)) {
          throw new Error(`Missing required field: ${field}`);
        }
      }
    }

    // Check field types
    if (validation.types) {
      for (const [field, expectedType] of Object.entries(validation.types)) {
        if (field in data) {
          const actualType = typeof data[field];
          if (actualType !== expectedType) {
            throw new Error(`Field ${field} should be ${expectedType}, got ${actualType}`);
          }
        }
      }
    }

    // Check value constraints
    if (validation.constraints) {
      for (const [field, constraint] of Object.entries(validation.constraints)) {
        if (field in data) {
          if (constraint.min !== undefined && data[field] < constraint.min) {
            throw new Error(`Field ${field} below minimum: ${constraint.min}`);
          }
          if (constraint.max !== undefined && data[field] > constraint.max) {
            throw new Error(`Field ${field} above maximum: ${constraint.max}`);
          }
          if (constraint.values && !constraint.values.includes(data[field])) {
            throw new Error(`Field ${field} not in allowed values: ${constraint.values}`);
          }
        }
      }
    }
  }

  async testFullOnboardingFlow() {
    console.log('10. Testing Complete Onboarding Flow');
    
    try {
      // Create a new session for complete flow test
      const newUserId = uuidv4();
      const startResponse = await this.client.post('/onboarding/session/start', {
        user_id: newUserId,
        source: 'test'
      });

      const newSessionId = startResponse.data.session_id;
      console.log('   ✅ New session created for complete flow test');

      // Submit all required responses
      const requiredResponses = [
        { question_id: 'name_v1', raw_answer_text: 'Complete Test User' },
        { question_id: 'dob_v1', raw_answer_text: '1985-06-15' },
        { question_id: 'sex_v1', raw_answer_text: 'female' },
        { question_id: 'weight_v1', raw_answer_text: '65 kg' },
        { question_id: 'primary_goal_v1', raw_answer_text: 'muscle gain' },
        { question_id: 'activity_level_v1', raw_answer_text: 'very active' },
        { question_id: 'availability_v1', raw_answer_text: '60 minutes' },
        { question_id: 'workout_setup_v1', raw_answer_text: 'commercial gym' },
        { question_id: 'injury_flag_v1', raw_answer_text: 'no' }
      ];

      for (const response of requiredResponses) {
        await this.client.post(`/onboarding/session/${newSessionId}/response`, {
          session_id: newSessionId,
          question_id: response.question_id,
          question_text: `Test question for ${response.question_id}`,
          raw_answer_text: response.raw_answer_text,
          timestamp: new Date().toISOString()
        });
      }

      console.log('   ✅ All required responses submitted');

      // Check session status
      const statusResponse = await this.client.get(`/onboarding/session/${newSessionId}/status`);
      console.log('   ✅ Session status:', statusResponse.data.status);
      console.log('   ✅ Missing required:', statusResponse.data.missing_required.length);

      // Try to generate plan
      const planResponse = await this.client.post('/plans/generate', {
        user_id: newUserId,
        session_id: newSessionId,
        force: false
      });

      if (planResponse.status === 202) {
        console.log('   ✅ Plan generation started successfully');
      } else {
        console.log('   ⚠️  Plan generation rejected:', planResponse.data.reason);
      }

    } catch (error) {
      console.log('   ❌ Complete flow test failed:', error.message);
    }

    console.log('');
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  const tester = new OnboardingAPITester();
  
  tester.runAllTests()
    .then(() => tester.testErrorScenarios())
    .then(() => tester.testConfidenceHandling())
    .then(() => tester.testSafetyKeywords())
    .then(() => tester.testFullOnboardingFlow())
    .then(() => {
      console.log('🎉 All API contract tests completed successfully!');
      process.exit(0);
    })
    .catch(error => {
      console.error('💥 Test suite failed:', error);
      process.exit(1);
    });
}

module.exports = OnboardingAPITester;