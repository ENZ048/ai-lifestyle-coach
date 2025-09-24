const axios = require('axios');

// Test configuration
const BASE_URL = 'http://localhost:5000';
const TEST_USER_TOKEN = 'your-test-token'; // Replace with actual token

class OnboardingTester {
  constructor() {
    this.client = axios.create({
      baseURL: BASE_URL,
      headers: {
        'Authorization': `Bearer ${TEST_USER_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
  }

  async testCompleteOnboardingFlow() {
    console.log('🚀 Starting Complete Onboarding Flow Test\n');

    try {
      // 1. Start onboarding
      console.log('1. Starting onboarding...');
      const startResponse = await this.client.post('/onboarding/start', {
        userName: 'John Doe'
      });
      
      console.log('✅ Onboarding started');
      console.log('Welcome:', startResponse.data.welcome_message);
      console.log('First question:', startResponse.data.question.message);
      console.log('Progress:', startResponse.data.progress, '\n');

      // 2. Answer questions sequentially
      const testAnswers = {
        'name_v1': 'John Doe',
        'dob_v1': '1990-05-15',
        'sex_v1': 'male',
        'weight_v1': 75,
        'height_v1': 180,
        'primary_goal_v1': 'weight_loss',
        'target_weight_v1': 70,
        'activity_level_v1': 'lightly_active',
        'availability_v1': '30_minutes',
        'workout_setup_v1': 'home_basic_equipment',
        'injury_flag_v1': false,
        'diet_pref_v1': ['none'],
        'training_experience_v1': 'some_experience',
        'preferred_tone_v1': 'encouraging_supportive'
      };

      let currentQuestionId = startResponse.data.question.id;
      let questionCount = 1;

      while (currentQuestionId) {
        const answer = testAnswers[currentQuestionId];
        
        if (answer === undefined) {
          console.log(`⚠️  No test answer for ${currentQuestionId}, skipping...`);
          const skipResponse = await this.client.post('/onboarding/answer', {
            skip: true
          });
          
          if (skipResponse.data.complete) {
            console.log('✅ Onboarding completed!');
            break;
          }
          
          currentQuestionId = skipResponse.data.question?.id;
          continue;
        }

        console.log(`${questionCount + 1}. Answering ${currentQuestionId}: ${answer}`);
        
        const answerResponse = await this.client.post('/onboarding/answer', {
          answer: answer
        });

        if (!answerResponse.data.success) {
          console.log('❌ Answer validation failed:', answerResponse.data.errors);
          break;
        }

        console.log('   Acknowledgment:', answerResponse.data.acknowledgment);
        console.log('   Progress:', answerResponse.data.progress?.completion_percentage + '%');

        if (answerResponse.data.complete) {
          console.log('✅ Onboarding completed!');
          console.log('Completion message:', answerResponse.data.completion_message);
          console.log('Ready for plan:', answerResponse.data.ready_for_plan);
          break;
        }

        currentQuestionId = answerResponse.data.question?.id;
        if (currentQuestionId) {
          console.log('   Next question:', answerResponse.data.question.message);
        }
        
        questionCount++;
        console.log('');
      }

      // 3. Check final status
      console.log('\n3. Checking final status...');
      const statusResponse = await this.client.get('/onboarding/status');
      console.log('✅ Final status:', {
        completed: statusResponse.data.completed,
        ready_for_plan: statusResponse.data.ready_for_plan,
        progress: statusResponse.data.progress
      });

      // 4. Get all answers
      console.log('\n4. Getting all answers...');
      const answersResponse = await this.client.get('/onboarding/answers');
      console.log('✅ Total answers collected:', Object.keys(answersResponse.data.answers).length);
      
      // 5. Generate plan (if ready)
      if (statusResponse.data.ready_for_plan) {
        console.log('\n5. Generating plan...');
        const planResponse = await this.client.post('/onboarding/generate-plan');
        console.log('✅ Plan generation:', planResponse.data.message);
      }

      console.log('\n🎉 Complete onboarding flow test passed!');
      
    } catch (error) {
      console.error('❌ Test failed:', error.response?.data || error.message);
    }
  }

  async testValidationScenarios() {
    console.log('\n🔍 Testing Validation Scenarios\n');

    try {
      // Start fresh onboarding
      await this.client.post('/onboarding/reset');
      const startResponse = await this.client.post('/onboarding/start', {
        userName: 'Test User'
      });

      // Test invalid answers
      const invalidTests = [
        {
          description: 'Invalid name (too short)',
          answer: 'A'
        },
        {
          description: 'Invalid weight (too low)',
          answer: 10
        },
        {
          description: 'Invalid date format',
          answer: 'not-a-date'
        }
      ];

      for (const test of invalidTests) {
        console.log(`Testing: ${test.description}`);
        const response = await this.client.post('/onboarding/answer', {
          answer: test.answer
        });

        if (response.data.success === false) {
          console.log('✅ Validation caught invalid input');
          console.log('   Errors:', response.data.errors);
          console.log('   Retry message:', response.data.retry_message);
        } else {
          console.log('❌ Validation should have failed');
        }
        console.log('');
      }

    } catch (error) {
      console.error('❌ Validation test failed:', error.response?.data || error.message);
    }
  }

  async testSafetyFlags() {
    console.log('\n🛡️  Testing Safety Flags\n');

    try {
      // Start fresh onboarding and get to injury question
      await this.client.post('/onboarding/reset');
      await this.client.post('/onboarding/start', { userName: 'Safety Test' });

      // Answer required questions to get to injury flag
      const requiredAnswers = [
        { answer: 'Safety Test' },  // name
        { answer: '1985-01-01' },   // dob
        { answer: 'male' },         // sex
        { answer: 80 },             // weight
        { answer: 175 },            // height (optional)
        { answer: 'general_fitness' }, // primary_goal
        { answer: 'moderately_active' }, // activity_level
        { answer: '45_minutes' },   // availability
        { answer: 'commercial_gym' }, // workout_setup
        { answer: true }            // injury_flag - triggers safety question
      ];

      for (let i = 0; i < requiredAnswers.length; i++) {
        await this.client.post('/onboarding/answer', requiredAnswers[i]);
      }

      // Now answer injury details with safety keywords
      console.log('Testing safety keyword detection...');
      const safetyResponse = await this.client.post('/onboarding/answer', {
        answer: 'I have a heart condition and chronic back pain from recent surgery'
      });

      console.log('✅ Safety response processed');
      console.log('   Acknowledgment includes safety info:', 
        safetyResponse.data.acknowledgment?.includes('doctor') || 
        safetyResponse.data.acknowledgment?.includes('healthcare')
      );

    } catch (error) {
      console.error('❌ Safety test failed:', error.response?.data || error.message);
    }
  }

  async runAllTests() {
    console.log('🧪 AI Lifestyle Coach - Onboarding System Tests');
    console.log('================================================\n');

    await this.testCompleteOnboardingFlow();
    await this.testValidationScenarios();
    await this.testSafetyFlags();

    console.log('\n📊 All tests completed!');
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  const tester = new OnboardingTester();
  tester.runAllTests().catch(console.error);
}

module.exports = OnboardingTester;