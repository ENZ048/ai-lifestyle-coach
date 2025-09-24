require('dotenv').config();
const supabase = require('./lib/supabaseClient');
const openai = require('./lib/openaiClient');

async function testPlanGeneration() {
  console.log('🧪 Testing Plan Generation...\n');

  try {
    // Test 1: Check environment setup
    console.log('1. Checking environment...');
    if (!process.env.SUPABASE_URL) throw new Error('Missing SUPABASE_URL');
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');
    if (!process.env.OPENAI_API_KEY) throw new Error('Missing OPENAI_API_KEY');
    console.log('✅ Environment variables set\n');

    // Test 2: Check Supabase connection
    console.log('2. Testing Supabase connection...');
    const { data: tables, error: tablesError } = await supabase
      .from('users')
      .select('count(*)', { count: 'exact', head: true });
    if (tablesError) throw new Error(`Supabase connection failed: ${tablesError.message}`);
    console.log('✅ Supabase connected\n');

    // Test 3: Create a test user
    console.log('3. Creating test user...');
    const testUid = `test-${Date.now()}`;
    const testPhone = '+15551234567';
    
    const { data: user, error: userError } = await supabase
      .from('users')
      .insert([{
        firebase_uid: testUid,
        phone_number: testPhone,
        timezone: 'America/New_York',
        last_active: new Date().toISOString()
      }])
      .select()
      .single();
    
    if (userError) throw new Error(`User creation failed: ${userError.message}`);
    console.log(`✅ Test user created: ${user.id}\n`);

    // Test 4: Create a test profile
    console.log('4. Creating test profile...');
    const testProfile = {
      user_id: user.id,
      name: 'Test User',
      date_of_birth: '1990-01-01',
      sex: 'male',
      weight_kg: 75.5,
      height_cm: 175,
      primary_goal: 'lose_fat',
      target_weight_kg: 70.0,
      activity_level: 'moderately_active',
      time_availability: 'morning',
      diet_preference: 'nonveg',
      allergies: null,
      meal_frequency: '3',
      workout_setup: 'home',
      injury: 'no',
      injury_notes: null,
      sleep_hours: 7.5,
      medical_conditions: null,
      updated_at: new Date().toISOString()
    };

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .insert([testProfile])
      .select()
      .single();
    
    if (profileError) throw new Error(`Profile creation failed: ${profileError.message}`);
    console.log(`✅ Test profile created\n`);

    // Test 5: Generate plan with OpenAI
    console.log('5. Testing OpenAI plan generation...');
    const prompt = `Create a concise, actionable 7-day workout + meal plan for the user.

User Profile:
- Goal: Lose fat
- Activity Level: Moderately active
- Workout Setup: Home
- Diet: Non-vegetarian
- Time: Morning workouts

Format: JSON with keys: { title, duration_weeks, daily: [{ day, workout: "...", meals: ["...","..."], notes: "..." }] }
Return only valid JSON. Be concise and use metric units.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a helpful fitness coach.' },
        { role: 'user', content: prompt }
      ],
      max_tokens: 900
    });

    const planText = completion.choices?.[0]?.message?.content ?? null;
    if (!planText) throw new Error('No response from OpenAI');

    let planJson;
    try {
      const cleaned = planText.replace(/^\s*```(?:json\s*)?/, '').replace(/```\s*$/, '').trim();
      planJson = JSON.parse(cleaned);
    } catch (e) {
      planJson = { raw: planText };
    }

    console.log('✅ OpenAI plan generated');
    console.log('📋 Plan preview:', JSON.stringify(planJson, null, 2).slice(0, 300) + '...\n');

    // Test 6: Save plan to database
    console.log('6. Saving plan to database...');
    const { data: savedPlan, error: planError } = await supabase
      .from('plans')
      .insert([{
        user_id: user.id,
        plan_json: planJson,
        generated_at: new Date().toISOString(),
        generator_version: 'gpt-4o-mini'
      }])
      .select()
      .single();

    if (planError) throw new Error(`Plan save failed: ${planError.message}`);
    console.log(`✅ Plan saved to database: ${savedPlan.id}\n`);

    // Test 7: Cleanup
    console.log('7. Cleaning up test data...');
    await supabase.from('plans').delete().eq('id', savedPlan.id);
    await supabase.from('profiles').delete().eq('user_id', user.id);
    await supabase.from('users').delete().eq('id', user.id);
    console.log('✅ Test data cleaned up\n');

    console.log('🎉 All tests passed! Plan generation is working correctly.');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Run the test
testPlanGeneration().catch(console.error);