/**
 * Enhanced Plan Generation Route with Safety Guardrails
 * 
 * This route integrates the PlanGenerationService with comprehensive
 * safety guardrails and automatic plan generation triggers.
 */

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const supabaseClient = require('../lib/supabaseClient');
const PlanGenerationService = require('../services/PlanGenerationService');
const OnboardingReadinessChecker = require('../services/OnboardingReadinessChecker');
const Joi = require('joi');

// Initialize services
const planGenerator = new PlanGenerationService();
const readinessChecker = new OnboardingReadinessChecker();

// Validation schemas
const generatePlanSchema = Joi.object({
  user_id: Joi.string().uuid().required(),
  session_id: Joi.string().uuid().required(),
  force: Joi.boolean().default(false),
  include_user_summaries: Joi.boolean().default(true)
});

/**
 * @swagger
 * /plans/generate-with-guardrails:
 *   post:
 *     summary: Generate a plan with comprehensive safety guardrails
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
 *               session_id:
 *                 type: string
 *                 format: uuid
 *               force:
 *                 type: boolean
 *                 default: false
 *               include_user_summaries:
 *                 type: boolean
 *                 default: true
 *     responses:
 *       201:
 *         description: Plan generated successfully
 *       400:
 *         description: Invalid request or session not ready
 *       500:
 *         description: Generation failed
 */
router.post('/generate-with-guardrails', async (req, res) => {
  try {
    // Validate request
    const { error, value } = generatePlanSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.details.map(d => d.message)
      });
    }

    const { user_id, session_id, force, include_user_summaries } = value;

    console.log(`Plan generation requested for user ${user_id}, session ${session_id}`);

    // Step 1: Verify session exists and check readiness
    const { data: session, error: sessionError } = await supabaseClient
      .from('onboarding_sessions')
      .select('*')
      .eq('id', session_id)
      .eq('user_id', user_id)
      .single();

    if (sessionError || !session) {
      return res.status(400).json({
        error: 'Session not found',
        details: { message: 'Onboarding session not found or does not belong to user' }
      });
    }

    // Step 2: Check session readiness (unless forced)
    if (!force) {
      const readinessCheck = await readinessChecker.checkSessionReadiness(session_id);
      
      if (!readinessCheck.readyForPlan) {
        return res.status(400).json({
          error: 'Session not ready for plan generation',
          readiness_analysis: readinessCheck.analysis,
          details: {
            status: readinessCheck.status,
            missing_required: readinessCheck.analysis?.missingRequired || [],
            confidence_score: readinessCheck.analysis?.overallConfidence || 0,
            safety_concerns: readinessCheck.analysis?.safetyRisk || {}
          }
        });
      }
    }

    // Step 3: Gather required data for plan generation
    const planData = await gatherPlanGenerationData(user_id, session_id, include_user_summaries);
    
    if (!planData.success) {
      return res.status(500).json({
        error: 'Failed to gather plan data',
        details: planData.error
      });
    }

    // Step 4: Generate plan with guardrails
    console.log(`Starting AI plan generation with safety guardrails...`);
    const generationResult = await planGenerator.generatePlan({
      user_id,
      session_id,
      required_fields_snapshot: planData.required_fields_snapshot,
      profile_extras: planData.profile_extras,
      user_summaries: planData.user_summaries,
      force
    });

    if (!generationResult.success) {
      return res.status(500).json({
        error: 'Plan generation failed',
        details: generationResult.error
      });
    }

    // Step 5: Save plan to database
    const { data: savedPlan, error: saveError } = await supabaseClient
      .from('plans')
      .insert([generationResult.plan])
      .select()
      .single();

    if (saveError) {
      console.error('Failed to save plan:', saveError.message);
      return res.status(500).json({
        error: 'Failed to save generated plan',
        details: saveError.message
      });
    }

    // Step 6: Update session status if plan was generated successfully
    await supabaseClient
      .from('onboarding_sessions')
      .update({
        status: 'completed',
        session_ended_at: new Date().toISOString(),
        plan_generation_attempts: (session.plan_generation_attempts || 0) + 1
      })
      .eq('id', session_id);

    // Step 7: Update profile safety flags if needed
    if (generationResult.safety_review_required) {
      await supabaseClient
        .from('profiles')
        .update({
          safety_review_required: true
        })
        .eq('user_id', user_id);
    }

    console.log(`Plan generated successfully: ${savedPlan.id}`);

    // Step 8: Return comprehensive response
    res.status(201).json({
      success: true,
      plan_id: savedPlan.id,
      plan: savedPlan,
      generation_info: {
        safety_review_required: generationResult.safety_review_required,
        guardrails_triggered: generationResult.guardrails_triggered,
        safety_analysis: generationResult.analysis,
        generator_version: planGenerator.GENERATOR_VERSION
      },
      session_info: {
        session_id,
        status: 'completed',
        plan_generated_at: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Plan generation error:', error.message);
    res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
});

/**
 * @swagger
 * /plans/auto-generate:
 *   post:
 *     summary: Auto-generate plan when session becomes ready
 *     tags: [Plans]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - session_id
 *             properties:
 *               session_id:
 *                 type: string
 *                 format: uuid
 *     responses:
 *       202:
 *         description: Auto-generation queued
 *       400:
 *         description: Session not ready or already has plan
 */
router.post('/auto-generate', async (req, res) => {
  try {
    const { session_id } = req.body;

    if (!session_id) {
      return res.status(400).json({
        error: 'session_id is required'
      });
    }

    // Get session info
    const { data: session, error: sessionError } = await supabaseClient
      .from('onboarding_sessions')
      .select('*')
      .eq('id', session_id)
      .single();

    if (sessionError || !session) {
      return res.status(400).json({
        error: 'Session not found'
      });
    }

    // Check if user already has an active plan
    const { data: existingPlan } = await supabaseClient
      .from('plans')
      .select('id, status')
      .eq('user_id', session.user_id)
      .eq('status', 'active')
      .order('generated_at', { ascending: false })
      .limit(1)
      .single();

    if (existingPlan) {
      return res.status(400).json({
        error: 'User already has an active plan',
        existing_plan_id: existingPlan.id
      });
    }

    // Check readiness
    const readinessCheck = await readinessChecker.checkSessionReadiness(session_id);
    
    if (!readinessCheck.readyForPlan) {
      return res.status(400).json({
        error: 'Session not ready for auto-generation',
        readiness_analysis: readinessCheck.analysis
      });
    }

    // Queue generation (in production, use proper job queue)
    setTimeout(async () => {
      try {
        console.log(`Auto-generating plan for session ${session_id}`);
        
        const planData = await gatherPlanGenerationData(session.user_id, session_id, true);
        if (!planData.success) {
          throw new Error(`Failed to gather plan data: ${planData.error}`);
        }

        const generationResult = await planGenerator.generatePlan({
          user_id: session.user_id,
          session_id,
          required_fields_snapshot: planData.required_fields_snapshot,
          profile_extras: planData.profile_extras,
          user_summaries: planData.user_summaries,
          force: false
        });

        if (generationResult.success) {
          await supabaseClient.from('plans').insert([generationResult.plan]);
          
          await supabaseClient
            .from('onboarding_sessions')
            .update({
              status: 'completed',
              session_ended_at: new Date().toISOString()
            })
            .eq('id', session_id);

          console.log(`Auto-generated plan for session ${session_id}`);
        } else {
          console.error(`Auto-generation failed for session ${session_id}:`, generationResult.error);
        }
      } catch (error) {
        console.error(`Auto-generation error for session ${session_id}:`, error.message);
      }
    }, 2000); // 2-second delay

    res.status(202).json({
      message: 'Plan auto-generation queued',
      session_id,
      estimated_completion: new Date(Date.now() + 30000).toISOString() // 30 seconds
    });

  } catch (error) {
    console.error('Auto-generation error:', error.message);
    res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
});

/**
 * Helper function to gather all data needed for plan generation
 */
async function gatherPlanGenerationData(userId, sessionId, includeUserSummaries = true) {
  try {
    // Get onboarding responses (required fields snapshot)
    const { data: responses, error: responsesError } = await supabaseClient
      .from('onboarding_responses')
      .select('*')
      .eq('session_id', sessionId)
      .eq('user_id', userId);

    if (responsesError) {
      return { success: false, error: `Failed to fetch responses: ${responsesError.message}` };
    }

    // Prepare required fields snapshot
    const required_fields_snapshot = {};
    (responses || []).forEach(response => {
      if (response.parsed_value && !response.requires_clarification) {
        required_fields_snapshot[response.question_id] = {
          raw_answer: response.raw_answer_text,
          parsed_value: response.parsed_value,
          confidence: response.parsed_confidence,
          answered_at: response.answered_at
        };
      }
    });

    // Get profile extras (medications, medical conditions)
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('medications, medical_conditions, injury, injury_notes, additional_profile')
      .eq('user_id', userId)
      .single();

    const profile_extras = {};
    if (profile && !profileError) {
      profile_extras.medications = profile.medications;
      profile_extras.medical_conditions = profile.medical_conditions;
      profile_extras.injury = profile.injury;
      profile_extras.injury_notes = profile.injury_notes;
      profile_extras.additional_profile = profile.additional_profile;
    }

    // Get user summaries (if requested and available)
    let user_summaries = {};
    if (includeUserSummaries) {
      const { data: summary, error: summaryError } = await supabaseClient
        .from('user_summaries')
        .select('summary_text, last_updated')
        .eq('user_id', userId)
        .single();

      if (summary && !summaryError) {
        user_summaries.summary = summary.summary_text;
        user_summaries.last_updated = summary.last_updated;
      }

      // Get recent memories (last 10)
      const { data: memories, error: memoriesError } = await supabaseClient
        .from('memories')
        .select('text, type, importance, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (memories && !memoriesError) {
        user_summaries.recent_memories = memories;
      }
    }

    return {
      success: true,
      required_fields_snapshot,
      profile_extras,
      user_summaries
    };

  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * @swagger
 * /plans/{id}/safety-review:
 *   post:
 *     summary: Complete safety review for a draft plan
 *     tags: [Plans]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - approved
 *               - reviewer_id
 *             properties:
 *               approved:
 *                 type: boolean
 *               reviewer_id:
 *                 type: string
 *               review_notes:
 *                 type: string
 *               modifications:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Safety review completed
 */
router.post('/:id/safety-review', async (req, res) => {
  try {
    const { id: planId } = req.params;
    const { approved, reviewer_id, review_notes, modifications = [] } = req.body;

    if (typeof approved !== 'boolean' || !reviewer_id) {
      return res.status(400).json({
        error: 'approved (boolean) and reviewer_id are required'
      });
    }

    // Get the plan
    const { data: plan, error: planError } = await supabaseClient
      .from('plans')
      .select('*')
      .eq('id', planId)
      .single();

    if (planError || !plan) {
      return res.status(404).json({
        error: 'Plan not found'
      });
    }

    if (plan.status !== 'draft') {
      return res.status(400).json({
        error: 'Only draft plans can undergo safety review'
      });
    }

    // Update plan status based on review
    const updateData = {
      status: approved ? 'active' : 'draft',
      safety_review_completed: true,
      safety_review_approved: approved,
      safety_reviewer_id: reviewer_id,
      safety_review_notes: review_notes,
      safety_review_date: new Date().toISOString()
    };

    if (modifications.length > 0) {
      updateData.safety_modifications = modifications;
    }

    const { error: updateError } = await supabaseClient
      .from('plans')
      .update(updateData)
      .eq('id', planId);

    if (updateError) {
      return res.status(500).json({
        error: 'Failed to update plan',
        details: updateError.message
      });
    }

    // Update profile safety review flag
    await supabaseClient
      .from('profiles')
      .update({
        safety_review_required: !approved // Clear flag if approved
      })
      .eq('user_id', plan.user_id);

    res.json({
      success: true,
      plan_id: planId,
      status: approved ? 'active' : 'draft',
      reviewed_by: reviewer_id,
      reviewed_at: new Date().toISOString()
    });

  } catch (error) {
    console.error('Safety review error:', error.message);
    res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
});

module.exports = router;