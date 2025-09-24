const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const supabaseClient = require('../lib/supabaseClient');
const openai = require('../lib/openaiClient');
const onboardingConfig = require('../services/OnboardingConfigService');
const Joi = require('joi');
const { timeAsync } = require('../middleware/logger');

// Validation schema for plan generation
const generatePlanSchema = Joi.object({
  user_id: Joi.string().uuid().required(),
  session_id: Joi.string().uuid().required(),
  force: Joi.boolean().default(false)
});

// Legacy schema for backward compatibility
const legacySchema = Joi.object({
  goal: Joi.string().required(),
  preferences: Joi.object().optional()
});

/**
 * @swagger
 * /plans/generate:
 *   post:
 *     summary: Generate a personalized plan from onboarding data
 *     tags: [Plans]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - user_id
 *               - session_id
 *             properties:
 *               user_id:
 *                 type: string
 *                 format: uuid
 *                 description: User ID
 *               session_id:
 *                 type: string
 *                 format: uuid
 *                 description: Onboarding session ID
 *               force:
 *                 type: boolean
 *                 default: false
 *                 description: Force generation even if there are issues
 *     responses:
 *       202:
 *         description: Plan generation queued successfully
 *       400:
 *         description: Plan generation rejected
 */
router.post('/generate', async (req, res) => {
  try {
    // Try new schema first, fall back to legacy
    let validationResult = generatePlanSchema.validate(req.body);
    let isLegacy = false;
    
    if (validationResult.error) {
      validationResult = legacySchema.validate(req.body);
      isLegacy = true;
    }
    
    if (validationResult.error) {
      return res.status(400).json({
        status: 'rejected',
        reason: 'validation_error',
        details: validationResult.error.details.map(d => d.message)
      });
    }

    // Handle legacy format
    if (isLegacy) {
      return handleLegacyPlanGeneration(req, res, validationResult.value);
    }

    // Handle new format
    const { user_id, session_id, force } = validationResult.value;

    // Get session data
    const { data: session, error: sessionError } = await supabaseClient
      .from('onboarding_sessions')
      .select('*')
      .eq('id', session_id)
      .eq('user_id', user_id)
      .single();

    if (sessionError || !session) {
      return res.status(400).json({
        status: 'rejected',
        reason: 'session_not_found',
        details: { message: 'Onboarding session not found or does not belong to user' }
      });
    }

    // Check if session is complete
    if (session.status !== 'completed' && !force) {
      return res.status(400).json({
        status: 'rejected',
        reason: 'session_incomplete',
        details: { 
          session_status: session.status,
          missing_required: session.missing_required_fields
        }
      });
    }

    // Get all responses for validation
    const { data: responses, error: responsesError } = await supabaseClient
      .from('onboarding_responses')
      .select('*')
      .eq('session_id', session_id)
      .eq('user_id', user_id);

    if (responsesError) {
      console.error('Error fetching responses:', responsesError);
      return res.status(500).json({ error: 'Failed to fetch session responses' });
    }

    // Run checks unless forced
    if (!force) {
      const checks = await runPlanGenerationChecks(session, responses || []);
      
      if (checks.shouldReject) {
        return res.status(400).json({
          status: 'rejected',
          reason: checks.reason,
          details: checks.details
        });
      }
    }

    // Generate plan ID and create plan record
    const planId = uuidv4();
    const estimatedCompletion = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes from now

    // Create plan record with "draft" status
    const { error: planError } = await supabaseClient
      .from('plans')
      .insert({
        id: planId,
        user_id,
        status: 'draft',
        summary_text: 'Plan generation in progress...',
        trigger_reason: force ? 'manual' : 'auto',
        required_fields_snapshot: prepareFieldsSnapshot(responses || [])
      });

    if (planError) {
      console.error('Error creating plan record:', planError);
      return res.status(500).json({ error: 'Failed to create plan record' });
    }

    // Update session to mark as plan generation started
    await supabaseClient
      .from('onboarding_sessions')
      .update({ 
        status: 'completed',
        session_ended_at: new Date()
      })
      .eq('id', session_id);

    // Queue actual plan generation
    queuePlanGeneration(planId, user_id, responses || []);

    res.status(202).json({
      status: 'queued',
      plan_id: planId,
      message: 'Plan generation has been queued',
      estimated_completion: estimatedCompletion.toISOString()
    });

  } catch (error) {
    console.error('Error in plan generation:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Legacy plan generation handler
async function handleLegacyPlanGeneration(req, res, value) {
  const { goal, preferences = {} } = value;

  try {
    const prompt = `
Create a concise, actionable 7-day workout + meal plan for the user.

Goal: ${goal}
Preferences: ${JSON.stringify(preferences)}
Format: JSON with keys: { title, duration_weeks, daily: [{ day, workout: "...", meals: ["...","..."], notes: "..." }] }
Return only valid JSON.
Be concise and use metric units where appropriate.
    `;

    const completion = await timeAsync(req, 'openai.generatePlan', async () =>
      openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a helpful fitness coach.' },
          { role: 'user', content: prompt }
        ],
        max_tokens: 900
      })
    );

    const planText = completion.choices?.[0]?.message?.content ?? null;
    if (!planText) throw new Error('No response from LLM');

    let planJson = null;
    try {
      const cleaned = planText.replace(/^\s*```(?:json\s*)?/, '').replace(/```\s*$/, '').trim();
      planJson = JSON.parse(cleaned);
    } catch (e) {
      planJson = { raw: planText };
    }

    const uid = req.user?.id;
    const insertPayload = {
      user_id: uid,
      plan_json: planJson,
      fitness_plan: planJson,
      generated_at: new Date().toISOString(),
      generator_version: 'gpt-4o-mini-legacy',
      status: 'active'
    };

    const { data, error: supError } = await timeAsync(req, 'supabase.insertPlan', async () =>
      supabaseClient
        .from('plans')
        .insert([insertPayload])
        .select()
        .single()
    );

    if (supError) {
      console.error('Supabase insert error', supError);
      return res.status(201).json({ plan: planJson, saved: false, supabaseError: supError });
    }

    return res.status(201).json({ plan: planJson, saved: true, record: data });

  } catch (err) {
    req?.log?.('handler error', err?.message);
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}

// Helper function to run pre-generation checks
async function runPlanGenerationChecks(session, responses) {
  const config = onboardingConfig.getConfig();
  
  // Check 1: Missing required fields
  const missingRequired = session.missing_required_fields || [];
  if (missingRequired.length > 0) {
    return {
      shouldReject: true,
      reason: 'missing_required',
      details: {
        missing_fields: missingRequired,
        message: `Missing ${missingRequired.length} required field(s)`
      }
    };
  }

  // Check 2: Low confidence responses
  const lowConfidenceResponses = responses.filter(r => 
    r.parsed_confidence < config.confidence.threshold && 
    !r.requires_clarification
  );

  if (lowConfidenceResponses.length > 0) {
    return {
      shouldReject: true,
      reason: 'low_confidence',
      details: {
        low_confidence_responses: lowConfidenceResponses.map(r => ({
          question_id: r.question_id,
          confidence: r.parsed_confidence,
          raw_answer: r.raw_answer_text
        })),
        message: `${lowConfidenceResponses.length} response(s) have low confidence`
      }
    };
  }

  // Check 3: Safety concerns
  const safetyResponses = responses.filter(r => {
    const question = onboardingConfig.getQuestionById(r.question_id);
    return question?.safety_flag && r.raw_answer_text;
  });

  const safetyIssues = [];
  for (const response of safetyResponses) {
    const safetyCheck = onboardingConfig.checkSafetyConcerns(
      response.question_id, 
      response.raw_answer_text
    );
    
    if (safetyCheck.requiresReview) {
      safetyIssues.push({
        question_id: response.question_id,
        concerns: safetyCheck.concerns,
        raw_answer: response.raw_answer_text
      });
    }
  }

  if (safetyIssues.length > 0) {
    return {
      shouldReject: true,
      reason: 'safety_concerns',
      details: {
        safety_issues: safetyIssues,
        message: `${safetyIssues.length} response(s) require safety review`
      }
    };
  }

  return { shouldReject: false };
}

// Helper function to prepare fields snapshot
function prepareFieldsSnapshot(responses) {
  const snapshot = {};
  
  responses.forEach(response => {
    if (response.parsed_value && !response.requires_clarification) {
      snapshot[response.question_id] = {
        raw_answer: response.raw_answer_text,
        parsed_value: response.parsed_value,
        confidence: response.parsed_confidence,
        answered_at: response.answered_at
      };
    }
  });

  return snapshot;
}

// Queue plan generation (async processing)
function queuePlanGeneration(planId, userId, responses) {
  // In production, use a proper job queue (Redis, Bull, etc.)
  setTimeout(async () => {
    try {
      const generatedPlan = await generateActualPlan(userId, responses);
      
      await supabaseClient
        .from('plans')
        .update({
          fitness_plan: generatedPlan.fitness_plan,
          nutrition_plan: generatedPlan.nutrition_plan,
          lifestyle_plan: generatedPlan.lifestyle_plan,
          status: 'active',
          summary_text: generatedPlan.summary,
          generated_at: new Date()
        })
        .eq('id', planId);

      console.log(`Plan ${planId} generated successfully`);
    } catch (error) {
      console.error(`Error generating plan ${planId}:`, error);
      
      await supabaseClient
        .from('plans')
        .update({
          status: 'draft',
          summary_text: 'Plan generation failed. Please try again.'
        })
        .eq('id', planId);
    }
  }, 3000); // 3-second delay
}

// AI-powered plan generation
async function generateActualPlan(userId, responses) {
  // Extract key information from responses
  const responseMap = {};
  responses.forEach(r => {
    if (r.parsed_value && !r.requires_clarification) {
      responseMap[r.question_id] = r.parsed_value;
    }
  });

  const goal = responseMap.primary_goal_v1?.value || 'general_fitness';
  const activityLevel = responseMap.activity_level_v1?.value || 'moderately_active';
  const availability = responseMap.availability_v1?.value || '30_minutes';
  const workoutSetup = responseMap.workout_setup_v1?.value || 'home_basic_equipment';

  // Build comprehensive prompt for AI plan generation
  const prompt = `
Create a detailed, personalized health and fitness plan based on the following user information:

PRIMARY GOAL: ${goal.replace('_', ' ')}
ACTIVITY LEVEL: ${activityLevel.replace('_', ' ')}
AVAILABLE TIME: ${availability.replace('_', ' ')} per day
WORKOUT SETUP: ${workoutSetup.replace('_', ' ')}
${responseMap.weight_v1 ? `WEIGHT: ${responseMap.weight_v1.value}kg` : ''}
${responseMap.height_v1 ? `HEIGHT: ${responseMap.height_v1.value}cm` : ''}
${responseMap.training_experience_v1 ? `EXPERIENCE: ${responseMap.training_experience_v1.value.replace('_', ' ')}` : ''}
${responseMap.injury_flag_v1 && responseMap.injury_details_v1 ? `INJURIES/LIMITATIONS: ${responseMap.injury_details_v1.value}` : ''}

Generate a comprehensive plan in JSON format with the following structure:
{
  "fitness_plan": {
    "weekly_schedule": "detailed weekly structure",
    "exercise_types": ["list of exercise types"],
    "progression_strategy": "how to progress over time"
  },
  "nutrition_plan": {
    "daily_calories": number,
    "macros": {"protein": %, "carbs": %, "fats": %},
    "meal_suggestions": ["list of meal ideas"]
  },
  "lifestyle_plan": {
    "sleep_recommendations": {"target_hours": "7-9", "tips": "sleep hygiene tips"},
    "stress_management": {"techniques": ["list"], "frequency": "recommendation"},
    "hydration_goals": {"daily_target": "amount", "timing": "when to drink"}
  },
  "summary": "brief plan overview"
}

Make it specific to their goal and constraints. Return only valid JSON.
  `;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: 'You are an expert fitness and nutrition coach. Create personalized, safe, and effective plans.' },
        { role: 'user', content: prompt }
      ],
      max_tokens: 1500,
      temperature: 0.7
    });

    const planText = completion.choices?.[0]?.message?.content ?? null;
    if (!planText) throw new Error('No response from AI');

    // Parse JSON response
    const cleaned = planText.replace(/^\s*```(?:json\s*)?/, '').replace(/```\s*$/, '').trim();
    const planJson = JSON.parse(cleaned);

    return planJson;
  } catch (error) {
    console.error('Error generating AI plan:', error);
    
    // Fallback to rule-based plan generation
    return generateFallbackPlan(responseMap);
  }
}

// Fallback plan generation using rules
function generateFallbackPlan(responseMap) {
  const goal = responseMap.primary_goal_v1?.value || 'general_fitness';
  const activityLevel = responseMap.activity_level_v1?.value || 'moderately_active';
  const availability = responseMap.availability_v1?.value || '30_minutes';
  const weight = responseMap.weight_v1?.value || 70;

  return {
    fitness_plan: {
      weekly_schedule: generateFitnessSchedule(goal, activityLevel, availability),
      exercise_types: generateExerciseTypes(goal, responseMap.workout_setup_v1?.value),
      progression_strategy: `Progressive overload adapted for ${responseMap.training_experience_v1?.value || 'intermediate'} level`
    },
    nutrition_plan: {
      daily_calories: calculateDailyCalories(weight, activityLevel, goal),
      macros: calculateMacros(goal),
      meal_suggestions: generateMealSuggestions(responseMap.diet_pref_v1?.value)
    },
    lifestyle_plan: {
      sleep_recommendations: {
        target_hours: '7-9 hours per night',
        tips: 'Consistent sleep schedule and relaxation techniques'
      },
      stress_management: {
        techniques: ['Deep breathing', 'Meditation', 'Regular exercise'],
        frequency: 'Daily practice recommended'
      },
      hydration_goals: {
        daily_target: `${Math.round(weight * 35)}ml`,
        timing: 'Spread throughout the day, increase during exercise'
      }
    },
    summary: `Personalized ${goal.replace('_', ' ')} plan for ${activityLevel.replace('_', ' ')} individual with ${availability.replace('_', ' ')} availability.`
  };
}

// Helper functions for fallback plan generation
function generateFitnessSchedule(goal, activityLevel, availability) {
  const schedules = {
    weight_loss: '4-5 days/week with cardio focus',
    muscle_gain: '4-6 days/week with strength focus',
    general_fitness: '3-4 days/week balanced approach',
    endurance_improvement: '4-5 days/week cardio emphasis',
    strength_building: '3-4 days/week strength focus'
  };
  return schedules[goal] || schedules.general_fitness;
}

function generateExerciseTypes(goal, workoutSetup) {
  const types = ['bodyweight exercises', 'resistance training', 'cardio'];
  if (workoutSetup === 'commercial_gym') types.push('machine exercises', 'free weights');
  if (workoutSetup === 'home_basic_equipment') types.push('dumbbell exercises', 'resistance bands');
  if (workoutSetup === 'outdoor') types.push('running', 'cycling', 'outdoor activities');
  return types;
}

function calculateDailyCalories(weight, activityLevel, goal) {
  const baseCalories = weight * 24; // Simplified BMR
  const activityMultipliers = {
    sedentary: 1.2,
    lightly_active: 1.375,
    moderately_active: 1.55,
    very_active: 1.725,
    extremely_active: 1.9
  };
  
  let calories = baseCalories * (activityMultipliers[activityLevel] || 1.55);
  
  // Adjust for goal
  if (goal === 'weight_loss') calories *= 0.85;
  if (goal === 'muscle_gain') calories *= 1.15;
  
  return Math.round(calories);
}

function calculateMacros(goal) {
  const macros = {
    weight_loss: { protein: 35, carbs: 30, fats: 35 },
    muscle_gain: { protein: 30, carbs: 45, fats: 25 },
    general_fitness: { protein: 25, carbs: 45, fats: 30 },
    endurance_improvement: { protein: 20, carbs: 55, fats: 25 },
    strength_building: { protein: 30, carbs: 40, fats: 30 }
  };
  
  return macros[goal] || macros.general_fitness;
}

function generateMealSuggestions(dietPref) {
  const base = [
    'High protein breakfast with oats and berries',
    'Balanced lunch with lean protein and vegetables',
    'Nutritious dinner with complex carbs',
    'Healthy snacks between meals'
  ];
  
  if (dietPref?.includes('vegetarian')) {
    return base.map(meal => meal.replace('lean protein', 'plant-based protein'));
  }
  
  if (dietPref?.includes('keto')) {
    return [
      'Low-carb high-fat breakfast',
      'Keto-friendly lunch with healthy fats',
      'Low-carb dinner with protein and vegetables',
      'Keto snacks with nuts and cheese'
    ];
  }
  
  return base;
}

// Get the latest plan for the authenticated user
router.get('/current', async (req, res) => {
  try {
    const uid = req.user?.id;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });

    // Find the most recent plan for this user
    const { data: plan, error } = await supabaseClient
      .from('plans')
      .select('*')
      .eq('user_id', uid)
      .order('generated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
      
    if (error) return res.status(500).json({ error: error.message });
    if (!plan) return res.status(404).json({ error: 'No plan found for user' });
    return res.status(200).json({ plan });
  } catch (err) {
    req?.log?.('handler error', err?.message);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
