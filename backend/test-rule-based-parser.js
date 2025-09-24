const RuleBasedParser = require('./services/RuleBasedParser');

class RuleBasedParserTests {
  constructor() {
    this.parser = new RuleBasedParser();
    this.testResults = [];
  }

  runAllTests() {
    console.log('🧪 Rule-Based Parser Test Suite');
    console.log('================================\n');

    // Test primary goals
    this.testPrimaryGoals();
    
    // Test activity levels
    this.testActivityLevels();
    
    // Test measurements
    this.testMeasurements();
    
    // Test availability parsing
    this.testAvailability();
    
    // Test injury detection
    this.testInjuryDetection();
    
    // Test workout setup
    this.testWorkoutSetup();
    
    // Test diet preferences
    this.testDietPreferences();
    
    // Test edge cases
    this.testEdgeCases();
    
    // Test multi-intent detection
    this.testMultiIntentDetection();
    
    // Test confidence scoring
    this.testConfidenceScoring();

    this.printSummary();
  }

  testPrimaryGoals() {
    console.log('1. Testing Primary Goal Parsing');
    
    const testCases = [
      { input: 'I want to lose weight and get lean', expected: 'lose_fat', minConfidence: 0.7 },
      { input: 'Looking to bulk up and gain muscle mass', expected: 'gain_muscle', minConfidence: 0.7 },
      { input: 'Just want to stay in shape and maintain my current fitness', expected: 'maintain', minConfidence: 0.7 },
      { input: 'I want to get toned and sculpted', expected: 'tone', minConfidence: 0.7 },
      { input: 'Need to build endurance for marathon training', expected: 'endurance', minConfidence: 0.7 },
      { input: 'cut body fat and shred for summer', expected: 'lose_fat', minConfidence: 0.8 },
      { input: 'building strength and getting bigger', expected: 'gain_muscle', minConfidence: 0.8 }
    ];

    this.runTestBatch('primary_goal_v1', testCases);
    console.log('');
  }

  testActivityLevels() {
    console.log('2. Testing Activity Level Parsing');
    
    const testCases = [
      { input: 'I work out 3 times per week', expected: 'moderately_active', minConfidence: 0.8 },
      { input: 'Exercise 5-6 days a week', expected: 'very_active', minConfidence: 0.8 },
      { input: 'I train daily, sometimes twice a day', expected: 'extremely_active', minConfidence: 0.8 },
      { input: 'Maybe once a week if I have time', expected: 'lightly_active', minConfidence: 0.7 },
      { input: 'Desk job, barely any exercise', expected: 'sedentary', minConfidence: 0.7 },
      { input: '4x per week strength training', expected: 'very_active', minConfidence: 0.9 },
      { input: 'I go to the gym most days', expected: 'very_active', minConfidence: 0.6 }
    ];

    this.runTestBatch('activity_level_v1', testCases);
    console.log('');
  }

  testMeasurements() {
    console.log('3. Testing Measurement Parsing');
    
    const weightCases = [
      { input: '75 kg', expected: 75, minConfidence: 0.9 },
      { input: '165 pounds', expected: 74.8, minConfidence: 0.9, tolerance: 0.5 },
      { input: '12 stone 5 pounds', expected: 78.5, minConfidence: 0.9, tolerance: 1.0 },
      { input: '80', expected: 80, minConfidence: 0.6 }, // assumed kg
      { input: '180', expected: 81.6, minConfidence: 0.6, tolerance: 1.0 } // assumed lbs
    ];

    const heightCases = [
      { input: '175 cm', expected: 175, minConfidence: 0.9 },
      { input: '5 feet 9 inches', expected: 175, minConfidence: 0.9, tolerance: 2 },
      { input: '1.75 meters', expected: 175, minConfidence: 0.9 },
      { input: '69 inches', expected: 175, minConfidence: 0.9, tolerance: 2 },
      { input: '5\'9"', expected: 175, minConfidence: 0.9, tolerance: 2 }
    ];

    console.log('   Weight parsing:');
    this.runTestBatch('weight_v1', weightCases);
    
    console.log('   Height parsing:');
    this.runTestBatch('height_v1', heightCases);
    console.log('');
  }

  testAvailability() {
    console.log('4. Testing Availability Parsing');
    
    const testCases = [
      { input: '45 minutes per day', expected: 'medium_sessions', minConfidence: 0.8 },
      { input: 'I can do 1 hour workouts', expected: 'long_sessions', minConfidence: 0.8 },
      { input: '30 min sessions on weekdays', expected: 'short_weekdays', minConfidence: 0.7 },
      { input: 'Weekends only, about 90 minutes', expected: 'long_weekends', minConfidence: 0.7 },
      { input: 'Every day after work for an hour', expected: 'long_daily', minConfidence: 0.6 },
      { input: 'flexible schedule, varies day to day', expected: 'medium_flexible', minConfidence: 0.5 }
    ];

    this.runTestBatch('availability_v1', testCases);
    console.log('');
  }

  testInjuryDetection() {
    console.log('5. Testing Injury Detection');
    
    const testCases = [
      { input: 'No injuries or health concerns', expected: false, minConfidence: 0.9 },
      { input: 'I have a bad knee from soccer', expected: true, minConfidence: 0.8 },
      { input: 'Recent shoulder surgery, still recovering', expected: true, minConfidence: 0.9 },
      { input: 'Chronic back pain from herniated disc', expected: true, minConfidence: 0.9 },
      { input: 'Heart condition - need doctor clearance', expected: true, minConfidence: 0.9 },
      { input: 'Nothing major, just some minor aches', expected: true, minConfidence: 0.6 },
      { input: 'Healthy as a horse!', expected: false, minConfidence: 0.7 }
    ];

    this.runTestBatch('injury_flag_v1', testCases);
    console.log('');
  }

  testWorkoutSetup() {
    console.log('6. Testing Workout Setup Parsing');
    
    const testCases = [
      { input: 'I have a home gym with squat rack and dumbbells', expected: 'home_full_gym', minConfidence: 0.7 },
      { input: 'Just my apartment, no equipment', expected: 'home_no_equipment', minConfidence: 0.8 },
      { input: 'Commercial gym membership', expected: 'commercial_gym', minConfidence: 0.8 },
      { input: 'Some basic dumbbells and resistance bands at home', expected: 'home_basic_equipment', minConfidence: 0.7 },
      { input: 'I prefer outdoor workouts in the park', expected: 'outdoor', minConfidence: 0.8 },
      { input: 'Local fitness center with full equipment', expected: 'commercial_gym', minConfidence: 0.7 }
    ];

    this.runTestBatch('workout_setup_v1', testCases);
    console.log('');
  }

  testDietPreferences() {
    console.log('7. Testing Diet Preference Parsing');
    
    const testCases = [
      { input: 'I eat everything, no restrictions', expected: 'omnivore', minConfidence: 0.7 },
      { input: 'Vegetarian for 5 years now', expected: 'vegetarian', minConfidence: 0.8 },
      { input: 'Strictly vegan plant-based diet', expected: 'vegan', minConfidence: 0.8 },
      { input: 'Keto diet with high fat low carb', expected: 'keto', minConfidence: 0.8 },
      { input: 'I do intermittent fasting 16:8', expected: 'intermittent_fasting', minConfidence: 0.8 },
      { input: 'Mediterranean style eating', expected: 'mediterranean', minConfidence: 0.7 },
      { input: 'No specific diet, just normal food', expected: 'omnivore', minConfidence: 0.7 }
    ];

    this.runTestBatch('diet_pref_v1', testCases);
    console.log('');
  }

  testEdgeCases() {
    console.log('8. Testing Edge Cases');
    
    const edgeCases = [
      { questionId: 'primary_goal_v1', input: '', expectedLowConfidence: true },
      { questionId: 'weight_v1', input: '500 kg', expectedLowConfidence: true }, // Unrealistic weight
      { questionId: 'height_v1', input: '50 cm', expectedLowConfidence: true }, // Unrealistic height
      { questionId: 'activity_level_v1', input: 'askdjf asdjf', expectedLowConfidence: true }, // Gibberish
      { questionId: 'injury_flag_v1', input: 'maybe sometimes I think', expectedLowConfidence: true } // Ambiguous
    ];

    for (const testCase of edgeCases) {
      const result = this.parser.parseResponse(testCase.questionId, testCase.input);
      const passed = testCase.expectedLowConfidence ? result.confidence < 0.5 : result.confidence >= 0.5;
      
      console.log(`   ${passed ? '✅' : '❌'} ${testCase.questionId}: "${testCase.input}" → confidence: ${result.confidence.toFixed(2)}`);
      
      this.testResults.push({
        category: 'edge_cases',
        passed,
        details: `${testCase.questionId}: confidence ${result.confidence.toFixed(2)}`
      });
    }
    console.log('');
  }

  testMultiIntentDetection() {
    console.log('9. Testing Multi-Intent Detection');
    
    const multiIntentCases = [
      { 
        questionId: 'primary_goal_v1', 
        input: 'I want to lose fat but also build some muscle',
        expectMultiIntent: true
      },
      { 
        questionId: 'availability_v1', 
        input: 'Weekdays I have 30 minutes but weekends I can do 2 hours',
        expectComplexParsing: true
      }
    ];

    for (const testCase of multiIntentCases) {
      const result = this.parser.parseResponse(testCase.questionId, testCase.input);
      const hasMultiIntent = result.extras?.multi_intent_detected || result.extras?.requires_clarification;
      const passed = testCase.expectMultiIntent ? hasMultiIntent : true;
      
      console.log(`   ${passed ? '✅' : '❌'} Multi-intent: "${testCase.input}"`);
      console.log(`      → Detected multi-intent: ${!!hasMultiIntent}, Confidence: ${result.confidence.toFixed(2)}`);
      
      this.testResults.push({
        category: 'multi_intent',
        passed,
        details: `Multi-intent detection: ${!!hasMultiIntent}`
      });
    }
    console.log('');
  }

  testConfidenceScoring() {
    console.log('10. Testing Confidence Scoring Consistency');
    
    const confidenceTests = [
      { input: 'I want to lose weight', expectedRange: [0.8, 1.0] }, // Clear intent
      { input: 'maybe lose some weight or something', expectedRange: [0.3, 0.6] }, // Ambiguous
      { input: '75 kg', expectedRange: [0.9, 1.0] }, // Exact measurement
      { input: 'around 75 or so', expectedRange: [0.4, 0.7] }, // Vague measurement
    ];

    for (const test of confidenceTests) {
      const result = this.parser.parseResponse('primary_goal_v1', test.input);
      const inRange = result.confidence >= test.expectedRange[0] && result.confidence <= test.expectedRange[1];
      
      console.log(`   ${inRange ? '✅' : '❌'} "${test.input}" → ${result.confidence.toFixed(2)} (expected: ${test.expectedRange[0]}-${test.expectedRange[1]})`);
      
      this.testResults.push({
        category: 'confidence',
        passed: inRange,
        details: `Confidence ${result.confidence.toFixed(2)} in range ${test.expectedRange}`
      });
    }
    console.log('');
  }

  runTestBatch(questionId, testCases) {
    for (const testCase of testCases) {
      const result = this.parser.parseResponse(questionId, testCase.input);
      
      let passed = false;
      if (testCase.tolerance) {
        // For numeric values with tolerance
        passed = result.confidence >= testCase.minConfidence && 
                Math.abs(result.value - testCase.expected) <= testCase.tolerance;
      } else {
        // For exact matches
        passed = result.confidence >= testCase.minConfidence && result.value === testCase.expected;
      }
      
      console.log(`   ${passed ? '✅' : '❌'} "${testCase.input}" → ${JSON.stringify(result.value)} (confidence: ${result.confidence.toFixed(2)})`);
      
      if (!passed) {
        console.log(`      Expected: ${testCase.expected}, Got: ${result.value}, Confidence: ${result.confidence.toFixed(2)}`);
      }
      
      this.testResults.push({
        category: questionId,
        passed,
        input: testCase.input,
        expected: testCase.expected,
        actual: result.value,
        confidence: result.confidence
      });
    }
  }

  printSummary() {
    const totalTests = this.testResults.length;
    const passedTests = this.testResults.filter(t => t.passed).length;
    const failedTests = totalTests - passedTests;
    
    console.log('📊 Test Summary');
    console.log('===============');
    console.log(`Total Tests: ${totalTests}`);
    console.log(`✅ Passed: ${passedTests} (${((passedTests/totalTests)*100).toFixed(1)}%)`);
    console.log(`❌ Failed: ${failedTests} (${((failedTests/totalTests)*100).toFixed(1)}%)`);
    
    // Category breakdown
    const categories = [...new Set(this.testResults.map(t => t.category))];
    console.log('\n📋 Results by Category:');
    
    for (const category of categories) {
      const categoryTests = this.testResults.filter(t => t.category === category);
      const categoryPassed = categoryTests.filter(t => t.passed).length;
      console.log(`   ${category}: ${categoryPassed}/${categoryTests.length} passed`);
    }
    
    // Show failed tests
    const failedTestsDetails = this.testResults.filter(t => !t.passed);
    if (failedTestsDetails.length > 0) {
      console.log('\n❌ Failed Tests:');
      failedTestsDetails.forEach(test => {
        console.log(`   ${test.category}: "${test.input}" → Expected: ${test.expected}, Got: ${test.actual}`);
      });
    }
    
    // Parser capabilities
    console.log('\n🔧 Parser Capabilities:');
    const capabilities = this.parser.getCapabilities();
    console.log(`   Version: ${capabilities.version}`);
    console.log(`   Supported Fields: ${capabilities.supported_fields.length}`);
    console.log(`   Features: ${capabilities.features.join(', ')}`);
    
    console.log('\n🎯 Acceptance Criteria Check:');
    const highConfidenceRate = this.testResults.filter(t => t.confidence >= 0.8).length / totalTests;
    const targetSlots = ['primary_goal_v1', 'activity_level_v1', 'weight_v1', 'height_v1', 'injury_flag_v1'];
    const targetSlotTests = this.testResults.filter(t => targetSlots.includes(t.category));
    const targetSlotSuccess = targetSlotTests.filter(t => t.passed).length / targetSlotTests.length;
    
    console.log(`   High confidence rate (≥0.8): ${(highConfidenceRate * 100).toFixed(1)}% (target: 70%)`);
    console.log(`   High-impact slots success: ${(targetSlotSuccess * 100).toFixed(1)}% (target: 90%)`);
    console.log(`   Parser version tracking: ✅ ${capabilities.version}`);
    
    if (targetSlotSuccess >= 0.9) {
      console.log('\n🎉 MVP Acceptance Criteria MET! Rule-based parser is ready for production.');
    } else {
      console.log('\n⚠️  MVP Acceptance Criteria NOT MET. Parser needs improvement.');
    }
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  const tester = new RuleBasedParserTests();
  tester.runAllTests();
}

module.exports = RuleBasedParserTests;