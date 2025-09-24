require('dotenv').config();
const openai = require('./lib/openaiClient');

async function testOpenAIPlanGeneration() {
  console.log('🧪 Testing OpenAI Plan Generation Only...\n');

  try {
    // Test 1: Check OpenAI setup
    console.log('1. Checking OpenAI setup...');
    if (!process.env.OPENAI_API_KEY) throw new Error('Missing OPENAI_API_KEY');
    console.log('✅ OpenAI API key set\n');

    // Test 2: Generate a sample plan
    console.log('2. Generating sample fitness plan...');
    const prompt = `Create a concise, actionable 7-day workout + meal plan for the user.

User Profile:
- Name: John Doe
- Goal: Lose fat and build muscle
- Activity Level: Moderately active (3-4 days/week)
- Workout Setup: Home workouts (no gym)
- Diet: Non-vegetarian, no allergies
- Time: Morning workouts preferred
- Sleep: 7-8 hours
- Current Weight: 75kg, Target: 70kg

Format: JSON with keys: { title, duration_weeks, daily: [{ day, workout: "...", meals: ["breakfast", "lunch", "dinner"], notes: "..." }] }
Return only valid JSON. Be concise and use metric units.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a professional fitness coach and nutritionist.' },
        { role: 'user', content: prompt }
      ],
      max_tokens: 1200,
      temperature: 0.7
    });

    const planText = completion.choices?.[0]?.message?.content ?? null;
    if (!planText) throw new Error('No response from OpenAI');

    console.log('✅ Raw response received from OpenAI\n');

    // Test 3: Parse the JSON response
    console.log('3. Parsing JSON response...');
    let planJson;
    try {
      const cleaned = planText.replace(/^\s*```(?:json\s*)?/, '').replace(/```\s*$/, '').trim();
      planJson = JSON.parse(cleaned);
      console.log('✅ JSON parsed successfully\n');
    } catch (e) {
      console.log('⚠️  JSON parsing failed, storing as raw text');
      planJson = { raw: planText };
    }

    // Test 4: Display the generated plan
    console.log('4. Generated Plan:');
    console.log('=' .repeat(60));
    console.log(JSON.stringify(planJson, null, 2));
    console.log('=' .repeat(60));

    // Test 5: Validate plan structure
    console.log('\n5. Validating plan structure...');
    if (planJson.raw) {
      console.log('⚠️  Plan stored as raw text (JSON parsing failed)');
    } else {
      const hasTitle = planJson.title && typeof planJson.title === 'string';
      const hasDaily = Array.isArray(planJson.daily) && planJson.daily.length > 0;
      const hasWorkouts = planJson.daily.some(d => d.workout);
      const hasMeals = planJson.daily.some(d => d.meals);

      console.log(`Title: ${hasTitle ? '✅' : '❌'} ${hasTitle ? planJson.title : 'Missing'}`);
      console.log(`Daily array: ${hasDaily ? '✅' : '❌'} ${hasDaily ? `${planJson.daily.length} days` : 'Missing'}`);
      console.log(`Workouts: ${hasWorkouts ? '✅' : '❌'}`);
      console.log(`Meals: ${hasMeals ? '✅' : '❌'}`);
    }

    console.log('\n🎉 OpenAI plan generation test completed successfully!');
    console.log('\n💡 Next steps:');
    console.log('   1. Configure Supabase environment variables');
    console.log('   2. Apply the schema.sql to your database');
    console.log('   3. Run the full backend server with: npm run dev');
    console.log('   4. Test the /profile/complete endpoint with a POST request');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response?.data) {
      console.error('OpenAI API Error:', error.response.data);
    }
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Run the test
testOpenAIPlanGeneration().catch(console.error);