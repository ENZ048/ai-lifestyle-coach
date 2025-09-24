const express = require('express');
const Joi = require('joi');
const supabase = require('../lib/supabaseClient');
const openai = require('../lib/openaiClient');
const { timeAsync } = require('../middleware/logger');

const router = express.Router();

// Helpers
async function ensureUser(uid, phoneNumber, timezone) {
  if (!uid) throw new Error('Missing Firebase UID');
  // Find by firebase_uid
  const { data: found, error: findErr } = await supabase
    .from('users')
    .select('*')
    .eq('firebase_uid', uid)
    .limit(1)
    .maybeSingle();
  if (findErr) throw findErr;
  if (found) return found;
  // Create if missing
  const insertPayload = {
    firebase_uid: uid,
    phone_number: phoneNumber || null,
    timezone: timezone || null,
    last_active: new Date().toISOString(),
  };
  const { data: created, error: insErr } = await supabase
    .from('users')
    .insert([insertPayload])
    .select()
    .single();
  if (insErr) throw insErr;
  return created;
}

// Map frontend fields/enums to DB columns/enums
function mapFrontendToDb(body) {
  const enumMap = {
    primaryGoal: {
      weight_loss: 'lose_fat',
      fat_loss: 'lose_fat',
      weight_gain: 'gain_muscle',
      muscle_gain: 'gain_muscle',
      recomposition: 'recomposition',
      maintenance: 'general_fitness',
      strength: 'general_fitness',
      endurance: 'general_fitness',
      flexibility: 'general_fitness',
      general_fitness: 'general_fitness',
    },
    activityLevel: {
      sedentary: 'sedentary',
      lightly_active: 'lightly_active',
      light: 'lightly_active',
      moderately_active: 'moderately_active',
      moderate: 'moderately_active',
      very_active: 'very_active',
      extremely_active: 'very_active', // clamp to max allowed
    },
    timeAvailability: {
      morning: 'morning',
      evening: 'evening',
      flexible: 'flexible',
      '15-30min': 'flexible',
      '30-45min': 'flexible',
      '45-60min': 'flexible',
      '60+min': 'flexible',
    },
    dietPreference: {
      omnivore: 'nonveg',
      nonveg: 'nonveg',
      vegetarian: 'veg',
      veg: 'veg',
      vegan: 'vegan',
      keto: 'keto',
      pescatarian: 'pescatarian',
      paleo: 'other',
      mediterranean: 'other',
      other: 'other',
    },
    mealFrequency: {
      '3': '3',
      '5': '5',
      flexible: 'flexible',
    },
    workoutSetup: {
      home: 'home',
      gym: 'gym',
      outdoor: 'mixed',
      hybrid: 'mixed',
      mixed: 'mixed',
    },
    sex: {
      male: 'male',
      female: 'female',
      other: 'other',
    },
    injury: {
      yes: 'yes',
      no: 'no',
      true: 'yes',
      false: 'no',
    },
  };

  const mapEnum = (group, value) => {
    if (value === undefined || value === null) return undefined;
    const v = String(value).toLowerCase();
    return enumMap[group][v] ?? enumMap[group][value] ?? undefined;
  };

  return {
    name: body.name,
    date_of_birth: body.dob || body.date_of_birth,
    sex: mapEnum('sex', body.sex),
    weight_kg: body.weight ?? body.weight_kg,
    height_cm: body.height ?? body.height_cm,
    primary_goal: mapEnum('primaryGoal', body.primaryGoal ?? body.primary_goal),
    target_weight_kg: body.targetWeight ?? body.target_weight_kg,
    activity_level: mapEnum('activityLevel', body.activityLevel ?? body.activity_level),
    time_availability: mapEnum('timeAvailability', body.timeAvailability ?? body.time_availability),
    diet_preference: mapEnum('dietPreference', body.dietPreference ?? body.diet_preference),
    allergies: body.allergies,
    meal_frequency: mapEnum('mealFrequency', body.mealFrequency ?? body.meal_frequency),
    workout_setup: mapEnum('workoutSetup', body.workoutSetup ?? body.workout_setup),
    injury: mapEnum('injury', body.injury),
    injury_notes: body.injuryNotes ?? body.injury_notes,
    sleep_hours: body.sleepHours ?? body.sleep_hours,
    medical_conditions: body.medicalConditions ?? body.medical_conditions,
  };
}

// Map DB record back to frontend shape
function mapDbToFrontend(rec) {
  if (!rec) return null;
  const backMap = {
    diet_preference: { nonveg: 'omnivore', veg: 'vegetarian', vegan: 'vegan', keto: 'keto', pescatarian: 'pescatarian', other: 'other' },
    primary_goal: { lose_fat: 'weight_loss', gain_muscle: 'muscle_gain', recomposition: 'recomposition', general_fitness: 'general_fitness' },
    activity_level: { sedentary: 'sedentary', lightly_active: 'lightly_active', moderately_active: 'moderately_active', very_active: 'very_active' },
    time_availability: { morning: 'morning', evening: 'evening', flexible: 'flexible' },
    workout_setup: { home: 'home', gym: 'gym', mixed: 'hybrid' },
  };
  const mapBack = (group, value) => backMap[group]?.[value] ?? value;
  return {
    name: rec.name,
    dob: rec.date_of_birth,
    sex: rec.sex,
    weight: rec.weight_kg,
    height: rec.height_cm,
    primaryGoal: mapBack('primary_goal', rec.primary_goal),
    targetWeight: rec.target_weight_kg,
    activityLevel: mapBack('activity_level', rec.activity_level),
    timeAvailability: mapBack('time_availability', rec.time_availability),
    dietPreference: mapBack('diet_preference', rec.diet_preference),
    allergies: rec.allergies,
    mealFrequency: rec.meal_frequency,
    workoutSetup: mapBack('workout_setup', rec.workout_setup),
    injury: rec.injury,
    injuryNotes: rec.injury_notes,
    sleepHours: rec.sleep_hours,
    medicalConditions: rec.medical_conditions,
    updatedAt: rec.updated_at,
  };
}

// Validation schema for frontend payload
const profileSchema = Joi.object({
  name: Joi.string().max(100).required(),
  dob: Joi.date().iso().required(),
  sex: Joi.string().valid('male', 'female', 'other').required(),
  weight: Joi.number().precision(2).min(20).max(500).required(),
  height: Joi.number().integer().min(80).max(250).optional(),
  primaryGoal: Joi.string().required(),
  targetWeight: Joi.number().precision(2).min(20).max(500).optional(),
  activityLevel: Joi.string().required(),
  timeAvailability: Joi.string().required(),
  dietPreference: Joi.string().required(),
  allergies: Joi.string().allow('', null).optional(),
  mealFrequency: Joi.string().valid('3', '5', 'flexible').required(),
  workoutSetup: Joi.string().required(),
  injury: Joi.string().valid('yes', 'no').required(),
  injuryNotes: Joi.string().allow('', null).optional(),
  sleepHours: Joi.number().precision(1).min(0).max(24).optional(),
  medicalConditions: Joi.string().allow('', null).optional(),
});

// GET /profile - fetch current user's profile
router.get('/', async (req, res) => {
  try {
  const uid = req.user?.id;
  const phone = req.user?.phone_number || req.user?.firebase?.phone_number || null;
  const tz = req.user?.firebase?.time_zone || null;
  const user = await ensureUser(uid, phone, tz);

    const { data: profile, error } = await timeAsync(req, 'supabase.getProfile', async () =>
      supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()
    );
    if (error) return res.status(500).json({ error: error.message });
    if (!profile) return res.status(200).json({ exists: false, profile: null });
    return res.status(200).json({ exists: true, profile: mapDbToFrontend(profile) });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// PUT /profile - create or update current user's profile
router.put('/', async (req, res) => {
  try {
    const { error: vErr, value } = profileSchema.validate(req.body);
    if (vErr) return res.status(400).json({ error: vErr.message });

  const uid = req.user?.id;
  const phone = req.user?.phone_number || req.user?.firebase?.phone_number || null;
  const tz = req.user?.firebase?.time_zone || null;
  const user = await ensureUser(uid, phone, tz);

    const payload = mapFrontendToDb(value);
    payload.user_id = user.id;
    payload.updated_at = new Date().toISOString();

    // Upsert on primary key user_id
    const { data, error } = await timeAsync(req, 'supabase.upsertProfile', async () =>
      supabase
      .from('profiles')
      .upsert([payload], { onConflict: 'user_id' })
      .select()
      .single()
    );
    if (error) return res.status(500).json({ error: error.message });

    return res.status(200).json({ profile: mapDbToFrontend(data) });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /profile/complete - Save profile and immediately generate a plan
router.post('/complete', async (req, res) => {
  try {
    const { error: vErr, value } = profileSchema.validate(req.body);
    if (vErr) return res.status(400).json({ error: vErr.message });

    const uid = req.user?.id;
    const phone = req.user?.phone_number || req.user?.firebase?.phone_number || null;
    const tz = req.user?.firebase?.time_zone || null;
    const user = await ensureUser(uid, phone, tz);

    // 1) Upsert profile
    const profilePayload = mapFrontendToDb(value);
    profilePayload.user_id = user.id;
    profilePayload.updated_at = new Date().toISOString();

    const { data: savedProfile, error: upsertErr } = await timeAsync(req, 'supabase.upsertProfile', async () =>
      supabase
      .from('profiles')
      .upsert([profilePayload], { onConflict: 'user_id' })
      .select()
      .single()
    );
    if (upsertErr) return res.status(500).json({ error: upsertErr.message });

    // 2) Generate plan using OpenAI
    const prompt = `Create a concise, actionable 7-day workout + meal plan for the user.

User Profile:
${JSON.stringify(savedProfile)}

Format: JSON with keys: { title, duration_weeks, daily: [{ day, workout: "...", meals: ["...","..."], notes: "..." }] }
Return only valid JSON. Be concise and use metric units.`;

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
    let planJson;
    try {
      const cleaned = planText.replace(/^\s*```(?:json\s*)?/, '').replace(/```\s*$/, '').trim();
      planJson = JSON.parse(cleaned);
    } catch (e) {
      planJson = { raw: planText };
    }

    // 3) Save plan
    const insertPayload = {
      user_id: user.id,
      plan_json: planJson,
      generated_at: new Date().toISOString(),
      generator_version: 'gpt-4o-mini',
    };
    const { data: planRecord, error: planErr } = await timeAsync(req, 'supabase.insertPlan', async () =>
      supabase
      .from('plans')
      .insert([insertPayload])
      .select()
      .single()
    );
    if (planErr) {
      // Return profile and plan but mark saved false
      return res.status(201).json({
        profile: mapDbToFrontend(savedProfile),
        plan: planJson,
        planSaved: false,
        supabaseError: planErr
      });
    }

    return res.status(201).json({
      profile: mapDbToFrontend(savedProfile),
      plan: planJson,
      planSaved: true,
      planRecord
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * @swagger
 * /profiles/{id}/confirm-onboarding:
 *   patch:
 *     summary: Confirm onboarding completion and accept parsed values
 *     tags: [Profiles]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: User ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               session_id:
 *                 type: string
 *                 format: uuid
 *                 description: Onboarding session ID to confirm
 *               accepted_values:
 *                 type: object
 *                 description: User-approved parsed values from onboarding
 *               confirmation_timestamp:
 *                 type: string
 *                 format: date-time
 *                 description: When the user confirmed the onboarding
 *     responses:
 *       200:
 *         description: Onboarding confirmed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 profile_updated:
 *                   type: boolean
 *                 onboarding_complete:
 *                   type: boolean
 *       400:
 *         description: Invalid request or session not found
 *       404:
 *         description: User not found
 */
router.patch('/:id/confirm-onboarding', async (req, res) => {
  try {
    const userId = req.params.id;
    const { session_id, accepted_values = {}, confirmation_timestamp } = req.body;

    // Validate user exists
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Validate session exists and belongs to user
    if (session_id) {
      const { data: session, error: sessionError } = await supabase
        .from('onboarding_sessions')
        .select('*')
        .eq('id', session_id)
        .eq('user_id', userId)
        .single();

      if (sessionError || !session) {
        return res.status(400).json({ error: 'Onboarding session not found or does not belong to user' });
      }
    }

    // Start transaction to update profile and mark onboarding complete
    const profileUpdates = {
      onboarding_complete: true,
      updated_at: new Date().toISOString()
    };

    // Map accepted values to profile fields
    if (accepted_values.name_v1) {
      profileUpdates.name = accepted_values.name_v1.value || accepted_values.name_v1;
    }
    
    if (accepted_values.sex_v1) {
      profileUpdates.sex = accepted_values.sex_v1.value || accepted_values.sex_v1;
    }
    
    if (accepted_values.dob_v1) {
      const dob = accepted_values.dob_v1.value || accepted_values.dob_v1;
      profileUpdates.date_of_birth = new Date(dob).toISOString();
      
      // Calculate age
      const age = new Date().getFullYear() - new Date(dob).getFullYear();
      profileUpdates.age = age;
    }
    
    if (accepted_values.weight_v1) {
      profileUpdates.weight_kg = accepted_values.weight_v1.value || accepted_values.weight_v1;
    }
    
    if (accepted_values.height_v1) {
      profileUpdates.height_cm = accepted_values.height_v1.value || accepted_values.height_v1;
    }
    
    if (accepted_values.primary_goal_v1) {
      profileUpdates.primary_goal = accepted_values.primary_goal_v1.value || accepted_values.primary_goal_v1;
    }
    
    if (accepted_values.activity_level_v1) {
      profileUpdates.activity_level = accepted_values.activity_level_v1.value || accepted_values.activity_level_v1;
    }
    
    if (accepted_values.training_experience_v1) {
      profileUpdates.training_experience = accepted_values.training_experience_v1.value || accepted_values.training_experience_v1;
    }
    
    if (accepted_values.preferred_tone_v1) {
      profileUpdates.preferred_coach_tone = accepted_values.preferred_tone_v1.value || accepted_values.preferred_tone_v1;
    }

    // Handle injury information
    if (accepted_values.injury_flag_v1) {
      const hasInjury = accepted_values.injury_flag_v1.value || accepted_values.injury_flag_v1;
      profileUpdates.injury = hasInjury ? 'yes' : 'no';
      
      if (hasInjury && accepted_values.injury_details_v1) {
        const injuryDetails = accepted_values.injury_details_v1.value || accepted_values.injury_details_v1;
        profileUpdates.injury_details = injuryDetails;
        
        // Simple injury severity assessment (in production, use AI)
        const severityKeywords = {
          3: ['severe', 'chronic', 'surgery', 'operation'],
          2: ['moderate', 'pain', 'limitation', 'doctor'],
          1: ['mild', 'minor', 'slight']
        };
        
        let severity = 1;
        const lowerDetails = injuryDetails.toLowerCase();
        
        for (const [level, keywords] of Object.entries(severityKeywords)) {
          if (keywords.some(keyword => lowerDetails.includes(keyword))) {
            severity = Math.max(severity, parseInt(level));
          }
        }
        
        profileUpdates.injury_severity = severity;
        profileUpdates.safety_review_required = severity >= 2;
      }
    }

    // Store additional profile data as JSONB
    const additionalProfile = {};
    
    if (accepted_values.target_weight_v1) {
      additionalProfile.target_weight_kg = accepted_values.target_weight_v1.value || accepted_values.target_weight_v1;
    }
    
    if (accepted_values.availability_v1) {
      additionalProfile.workout_availability = accepted_values.availability_v1.value || accepted_values.availability_v1;
    }
    
    if (accepted_values.workout_setup_v1) {
      additionalProfile.workout_setup = accepted_values.workout_setup_v1.value || accepted_values.workout_setup_v1;
    }
    
    if (accepted_values.diet_pref_v1) {
      additionalProfile.diet_preferences = accepted_values.diet_pref_v1.value || accepted_values.diet_pref_v1;
    }
    
    if (accepted_values.allergies_v1) {
      additionalProfile.food_allergies = accepted_values.allergies_v1.value || accepted_values.allergies_v1;
    }

    if (Object.keys(additionalProfile).length > 0) {
      profileUpdates.additional_profile = additionalProfile;
    }

    // Store consent information
    profileUpdates.consent_profile = {
      consent_given: true,
      consent_date: confirmation_timestamp || new Date().toISOString(),
      terms_version: 'v1',
      onboarding_session_id: session_id
    };

    // Update profile
    const { data: updatedProfile, error: updateError } = await supabase
      .from('profiles')
      .update(profileUpdates)
      .eq('user_id', userId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating profile:', updateError);
      
      // Try to create profile if it doesn't exist
      if (updateError.code === 'PGRST116') {
        const createResult = await supabase
          .from('profiles')
          .insert({ user_id: userId, ...profileUpdates })
          .select()
          .single();
          
        if (createResult.error) {
          return res.status(500).json({ error: 'Failed to create/update profile' });
        }
      } else {
        return res.status(500).json({ error: 'Failed to update profile' });
      }
    }

    // Update user's last onboarding session
    if (session_id) {
      await supabase
        .from('users')
        .update({ 
          last_onboarding_session: session_id,
          last_active: new Date().toISOString()
        })
        .eq('id', userId);
    }

    res.json({
      success: true,
      message: 'Onboarding confirmed and profile updated successfully',
      profile_updated: true,
      onboarding_complete: true,
      safety_review_required: profileUpdates.safety_review_required || false
    });

  } catch (error) {
    console.error('Error confirming onboarding:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Optional: enums for frontend to build selects
router.get('/options', (_req, res) => {
  return res.status(200).json({
    sex: ['male', 'female', 'other'],
    primaryGoal: ['weight_loss', 'muscle_gain', 'recomposition', 'general_fitness'],
    activityLevel: ['sedentary', 'lightly_active', 'moderately_active', 'very_active', 'extremely_active'],
    timeAvailability: ['morning', 'evening', 'flexible', '15-30min', '30-45min', '45-60min', '60+min'],
    dietPreference: ['omnivore', 'vegetarian', 'vegan', 'keto', 'pescatarian', 'other'],
    mealFrequency: ['3', '5', 'flexible'],
    workoutSetup: ['home', 'gym', 'outdoor', 'hybrid'],
    injury: ['yes', 'no']
  });
});

module.exports = router;
