require('dotenv').config();
const axios = require('axios');

const BASE_URL = 'http://localhost:5000';

// Mock Firebase JWT payload for testing
const mockFirebaseToken = 'mock-firebase-token'; // You'd replace this with a real token

async function testAPIEndpoints() {
  console.log('🧪 Testing API Endpoints...\n');
  console.log('⚠️  Make sure the server is running with: npm run dev\n');

  try {
    // Test 1: Health check
    console.log('1. Testing health endpoint...');
    try {
      const response = await axios.get(`${BASE_URL}/`);
      console.log('✅ Health check:', response.data);
    } catch (error) {
      console.log('❌ Server not running. Start with: npm run dev');
      return;
    }

    // Test 2: Auth check (no token)
    console.log('\n2. Testing auth endpoint (no token)...');
    const authResponse = await axios.get(`${BASE_URL}/auth/user`);
    console.log('✅ Auth response:', authResponse.data);

    // Test 3: Profile options
    console.log('\n3. Testing profile options...');
    try {
      const optionsResponse = await axios.get(`${BASE_URL}/profile/options`, {
        headers: { 'Authorization': `Bearer ${mockFirebaseToken}` }
      });
      console.log('✅ Profile options received');
      console.log('   Available options:', Object.keys(optionsResponse.data));
    } catch (error) {
      console.log('⚠️  Profile options requires auth:', error.response?.status);
    }

    // Test 4: Plans generation (mock)
    console.log('\n4. Testing plans generation endpoint structure...');
    const mockPlanRequest = {
      goal: 'lose weight and build muscle',
      preferences: {
        workoutDays: 4,
        dietType: 'balanced'
      }
    };
    
    try {
      const planResponse = await axios.post(`${BASE_URL}/plans/generate`, mockPlanRequest, {
        headers: { 
          'Authorization': `Bearer ${mockFirebaseToken}`,
          'Content-Type': 'application/json'
        }
      });
      console.log('✅ Plan generation endpoint accessible');
    } catch (error) {
      if (error.response?.status === 401) {
        console.log('⚠️  Plan generation requires valid Firebase auth (expected)');
      } else {
        console.log('❌ Unexpected error:', error.response?.status, error.response?.data);
      }
    }

    console.log('\n🎯 API structure test completed!');
    console.log('\n📝 To test with real authentication:');
    console.log('   1. Set up Firebase in your frontend');
    console.log('   2. Get a real Firebase ID token');
    console.log('   3. Use that token in Authorization header');
    console.log('   4. Configure Supabase environment variables');
    console.log('   5. Apply schema.sql to your database');

  } catch (error) {
    console.error('❌ API test failed:', error.message);
    console.error('Make sure the server is running on port 5000');
  }
}

// Run the test
testAPIEndpoints().catch(console.error);