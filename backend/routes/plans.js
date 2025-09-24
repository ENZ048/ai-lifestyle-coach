const express = require('express');
const router = express.Router();
const supabase = require('../lib/supabaseClient');
const openai = require('../lib/openaiClient');
const Joi = require('joi');
const { timeAsync } = require('../middleware/logger');

// ensure a users row exists (by firebase_uid) and return it
async function ensureUser(uid, phoneNumber, timezone) {
  if (!uid) throw new Error('Missing Firebase UID');
  const { data: found, error: findErr } = await supabase
    .from('users')
    .select('*')
    .eq('firebase_uid', uid)
    .limit(1)
    .maybeSingle();
  if (findErr) throw findErr;
  if (found) return found;
  const insertPayload = { firebase_uid: uid, phone_number: phoneNumber || null, timezone: timezone || null, last_active: new Date().toISOString() };
  const { data: created, error: insErr } = await supabase
    .from('users')
    .insert([insertPayload])
    .select()
    .single();
  if (insErr) throw insErr;
  return created;
}

// simple validation
const schema = Joi.object({
  goal: Joi.string().required(),
  preferences: Joi.object().optional()
});

/**
 * POST /plans/generate
 * body: { userId?, goal: string, preferences? }
 * - Generates a plan (workout + meal) using LLM
 * - Saves plan to "plans" table in Supabase
 *
 * NOTE: Matches schema.sql `plans` columns:
 *   - id (uuid)
 *   - user_id (uuid)
 *   - plan_json (jsonb)
 *   - generator_version (varchar)
 *   - generated_at (timestamptz)
 */
router.post('/generate', async (req, res) => {
  const { error, value } = schema.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });

  const { goal, preferences = {} } = value;

  try {
    // 1) Build a prompt for the model
    const prompt = `
Create a concise, actionable 7-day workout + meal plan for the user.

Goal: ${goal}
Preferences: ${JSON.stringify(preferences)}
Format: JSON with keys: { title, duration_weeks, daily: [{ day, workout: "...", meals: ["...","..."], notes: "..." }] }
Return only valid JSON.
Be concise and use metric units where appropriate.
    `;

    // 2) Call OpenAI (chat/completions) - adjust call to match your SDK if needed
    const completion = await timeAsync(req, 'openai.generatePlan', async () =>
      openai.chat.completions.create({
      model: 'gpt-4o-mini', // replace with your allowed model
      messages: [
        { role: 'system', content: 'You are a helpful fitness coach.' },
        { role: 'user', content: prompt }
      ],
      max_tokens: 900
    })
    );

    const planText = completion.choices?.[0]?.message?.content ?? null;
    if (!planText) throw new Error('No response from LLM');

    // try to parse JSON
    let planJson = null;
    try {
      // strip markdown fences if present
      const cleaned = planText.replace(/^\s*```(?:json\s*)?/, '').replace(/```\s*$/, '').trim();
      planJson = JSON.parse(cleaned);
    } catch (e) {
      // fallback: store raw text inside the JSON to avoid crashes
      planJson = { raw: planText };
    }

    // 3) Ensure user exists and Save to Supabase 'plans' table
  const uid = req.user?.id;
  const phone = req.user?.phone_number || req.user?.firebase?.phone_number || null;
  const tz = req.user?.firebase?.time_zone || null;
  const user = await timeAsync(req, 'supabase.ensureUser', async () => ensureUser(uid, phone, tz));

    const insertPayload = {
      user_id: user.id,
      plan_json: planJson,
      generated_at: new Date().toISOString(),
      generator_version: 'gpt-4o-mini',
    };

    const { data, error: supError } = await timeAsync(req, 'supabase.insertPlan', async () =>
      supabase
      .from('plans')
      .insert([insertPayload])
      .select()
      .single()
    );

    if (supError) {
      console.error('Supabase insert error', supError);
      // still return plan to client but indicate not saved
      return res.status(201).json({ plan: planJson, saved: false, supabaseError: supError });
    }

  return res.status(201).json({ plan: planJson, saved: true, record: data });

  } catch (err) {
    req?.log?.('handler error', err?.message);
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

// Get the latest plan for the authenticated user
router.get('/current', async (req, res) => {
  try {
    const uid = req.user?.id;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });

    // Find the most recent plan for this user
    const { data: plan, error } = await supabase
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
