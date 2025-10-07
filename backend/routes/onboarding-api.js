const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const supabaseClient = require('../lib/supabaseClient');
const onboardingConfig = require('../services/OnboardingConfigService');
const onboardingAI = require('../services/OnboardingAIService');
const OnboardingReadinessChecker = require('../services/OnboardingReadinessChecker');
const PlanGenerationService = require('../services/PlanGenerationService');
const Joi = require('joi');

// Initialize services
const readinessChecker = new OnboardingReadinessChecker();
const planGenerator = new PlanGenerationService();

// Validation schemas
const startSessionSchema = Joi.object({
  user_id: Joi.string().uuid().required(),
  source: Joi.string().valid('widget', 'app', 'web').default('app'),
  initial_profile: Joi.object({
    name: Joi.string().min(2).max(50),
    dob: Joi.date().iso(),
    sex: Joi.string().valid('male', 'female', 'other'),
    weight_kg: Joi.number().min(30).max(300),
    height_cm: Joi.number().min(100).max(250)
  }).optional()
});

const responseSchema = Joi.object({
  session_id: Joi.string().uuid().required(),
  question_id: Joi.string().required(),
  question_text: Joi.string().required(),
  raw_answer_text: Joi.string().required(),
  timestamp: Joi.date().iso().default(() => new Date())
});

const clarifySchema = Joi.object({
  original_response_id: Joi.string().uuid().required(),
  clarification_text: Joi.string().required(),
  timestamp: Joi.date().iso().default(() => new Date())
});

const generatePlanSchema = Joi.object({
  user_id: Joi.string().uuid().required(),
  session_id: Joi.string().uuid().required(),
  force: Joi.boolean().default(false)
});

// Helper function to determine missing required fields
function getMissingRequiredFields(responses, requiredQuestions) {
  const answeredQuestionIds = responses
    .filter(r => !r.skipped && r.parsed_value && !r.requires_clarification)
    .map(r => r.question_id);
  
  const missingRequired = requiredQuestions
    .map(q => q.id)
    .filter(qId => !answeredQuestionIds.includes(qId));
  
  return missingRequired;
}

// Helper function to parse answer using AI
async function parseAnswer(questionId, rawAnswerText, questionText) {
  try {
    const question = onboardingConfig.getQuestionById(questionId);
    if (!question) {
      return {
        parsed_value: null,
        parsed_confidence: 0.0,
        requires_clarification: true,
        error: 'Question not found'
      };
    }

    // Use AI to parse natural language answers
    const parseResult = await onboardingAI.parseNaturalLanguageAnswer(
      question,
      rawAnswerText,
      questionText
    );

    return {
      parsed_value: parseResult.parsed_value,
      parsed_confidence: parseResult.confidence,
      requires_clarification: parseResult.confidence < onboardingConfig.getConfig().confidence.threshold
    };
  } catch (error) {
    console.error('Error parsing answer:', error);
    return {
      parsed_value: null,
      parsed_confidence: 0.0,
      requires_clarification: true,
      error: error.message
    };
  }
}

/**
 * @swagger
 * /onboarding/session/start:
 *   post:
 *     summary: Start a new onboarding session
 *     tags: [Onboarding]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - user_id
 *             properties:
 *               user_id:
 *                 type: string
 *                 format: uuid
 *                 description: User ID
 *               source:
 *                 type: string
 *                 enum: [widget, app, web]
 *                 default: app
 *                 description: Source of the onboarding session
 *               initial_profile:
 *                 type: object
 *                 description: Pre-filled profile data if available
 *                 properties:
 *                   name:
 *                     type: string
 *                     minLength: 2
 *                     maxLength: 50
 *                   dob:
 *                     type: string
 *                     format: date
 *                   sex:
 *                     type: string
 *                     enum: [male, female, other]
 *                   weight_kg:
 *                     type: number
 *                     minimum: 30
 *                     maximum: 300
 *                   height_cm:
 *                     type: number
 *                     minimum: 100
 *                     maximum: 250
 *     responses:
 *       201:
 *         description: Session created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 session_id:
 *                   type: string
 *                   format: uuid
 *                 status:
 *                   type: string
 *                   enum: [in_progress, completed, abandoned]
 *                 missing_required:
 *                   type: array
 *                   items:
 *                     type: string
 *                   description: List of required field IDs still missing
 *       400:
 *         description: Invalid request data
 *       500:
 *         description: Server error
 */
router.post('/session/start', async (req, res) => {
  try {
    // Validate request
    const { error, value } = startSessionSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.details.map(d => d.message)
      });
    }

    const { user_id, source, initial_profile } = value;

    // Start database transaction
    const { data: sessionData, error: sessionError } = await supabaseClient
      .from('onboarding_sessions')
      .insert({
        user_id,
        status: 'in_progress',
        missing_required_fields: onboardingConfig.getRequiredQuestions().map(q => q.id)
      })
      .select()
      .single();

    if (sessionError) {
      console.error('Error creating session:', sessionError);
      return res.status(500).json({ error: 'Failed to create session' });
    }

    const sessionId = sessionData.id;
    let missingRequired = [...sessionData.missing_required_fields];

    // Process initial profile data if provided
    if (initial_profile) {
      const profileMappings = {
        name: 'name_v1',
        dob: 'dob_v1', 
        sex: 'sex_v1',
        weight_kg: 'weight_v1',
        height_cm: 'height_v1'
      };

      const responses = [];
      for (const [profileKey, value] of Object.entries(initial_profile)) {
        if (value && profileMappings[profileKey]) {
          const questionId = profileMappings[profileKey];
          const question = onboardingConfig.getQuestionById(questionId);
          
          responses.push({
            session_id: sessionId,
            user_id,
            question_id: questionId,
            question_text: question?.question || `Initial ${profileKey}`,
            raw_answer_text: String(value),
            parsed_value: { field: profileKey, value },
            parsed_confidence: 1.0,
            requires_clarification: false
          });

          // Remove from missing required if it was required
          missingRequired = missingRequired.filter(id => id !== questionId);
        }
      }

      // Insert initial responses if any
      if (responses.length > 0) {
        const { error: responseError } = await supabaseClient
          .from('onboarding_responses')
          .insert(responses);

        if (responseError) {
          console.error('Error inserting initial responses:', responseError);
          // Continue anyway, don't fail the session creation
        }

        // Update session with new missing required fields
        await supabaseClient
          .from('onboarding_sessions')
          .update({ missing_required_fields: missingRequired })
          .eq('id', sessionId);
      }
    }

    res.status(201).json({
      session_id: sessionId,
      status: 'in_progress',
      missing_required: missingRequired
    });

  } catch (error) {
    console.error('Error starting onboarding session:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /onboarding/session/{id}/response:
 *   post:
 *     summary: Submit a response to an onboarding question
 *     tags: [Onboarding]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Session ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - session_id
 *               - question_id
 *               - question_text
 *               - raw_answer_text
 *             properties:
 *               session_id:
 *                 type: string
 *                 format: uuid
 *               question_id:
 *                 type: string
 *                 description: Question identifier (e.g., primary_goal_v1)
 *               question_text:
 *                 type: string
 *                 description: The actual question asked to the user
 *               raw_answer_text:
 *                 type: string
 *                 description: User's raw text response
 *               timestamp:
 *                 type: string
 *                 format: date-time
 *                 description: When the response was given
 *     responses:
 *       201:
 *         description: Response processed and saved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 saved_response_id:
 *                   type: string
 *                   format: uuid
 *                 parsed_value:
 *                   type: object
 *                   description: Structured data extracted from the raw answer
 *                 parsed_confidence:
 *                   type: number
 *                   minimum: 0
 *                   maximum: 1
 *                   description: Confidence in the parsed value (0-1)
 *                 requires_clarification:
 *                   type: boolean
 *                   description: Whether the response needs clarification
 */
router.post('/session/:id/response', async (req, res) => {
  try {
    const sessionId = req.params.id;
    
    // Validate request
    const { error, value } = responseSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.details.map(d => d.message)
      });
    }

    const { question_id, question_text, raw_answer_text, timestamp } = value;

    // Verify session exists and is active
    const { data: session, error: sessionError } = await supabaseClient
      .from('onboarding_sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('status', 'in_progress')
      .single();

    if (sessionError || !session) {
      return res.status(404).json({ error: 'Session not found or not active' });
    }

    // Parse the answer using AI
    const parseResult = await parseAnswer(question_id, raw_answer_text, question_text);

    // Start transaction for atomic writes
    const responseId = uuidv4();
    
    // Insert response
    const { error: insertError } = await supabaseClient
      .from('onboarding_responses')
      .insert({
        id: responseId,
        session_id: sessionId,
        user_id: session.user_id,
        question_id,
        question_text,
        raw_answer_text,
        parsed_value: parseResult.parsed_value,
        parsed_confidence: parseResult.parsed_confidence,
        requires_clarification: parseResult.requires_clarification,
        answered_at: timestamp
      });

    if (insertError) {
      console.error('Error inserting response:', insertError);
      return res.status(500).json({ error: 'Failed to save response' });
    }

    // Update session missing required fields if this was a required question
    const requiredQuestions = onboardingConfig.getRequiredQuestions();
    const isRequiredQuestion = requiredQuestions.some(q => q.id === question_id);
    
    if (isRequiredQuestion && !parseResult.requires_clarification && parseResult.parsed_value) {
      // Get all responses for this session to recalculate missing required
      const { data: allResponses } = await supabaseClient
        .from('onboarding_responses')
        .select('question_id, parsed_value, requires_clarification, skipped')
        .eq('session_id', sessionId);

      const missingRequired = getMissingRequiredFields(allResponses || [], requiredQuestions);

      // Update session atomically
      await supabaseClient
        .from('onboarding_sessions')
        .update({ 
          missing_required_fields: missingRequired,
          last_updated: new Date()
        })
        .eq('id', sessionId);
    }

    // Check session readiness after successful response insertion
    let sessionReadiness = null;
    try {
      sessionReadiness = await readinessChecker.onResponseAdded(sessionId);
      console.log(`Session ${sessionId} readiness check:`, sessionReadiness);
    } catch (readinessError) {
      console.error('Error checking session readiness:', readinessError);
      // Don't fail the response insertion due to readiness check errors
    }

    const responsePayload = {
      saved_response_id: responseId,
      parsed_value: parseResult.parsed_value,
      parsed_confidence: parseResult.parsed_confidence,
      requires_clarification: parseResult.requires_clarification
    };

    // Include session readiness info if available
    if (sessionReadiness) {
      responsePayload.session_status = sessionReadiness.status;
      responsePayload.ready_for_plan = sessionReadiness.readyForPlan;
      
      if (sessionReadiness.analysis) {
        responsePayload.readiness_analysis = {
          confidence_score: sessionReadiness.analysis.overallConfidence,
          missing_fields: sessionReadiness.analysis.missingRequired,
          safety_risk: sessionReadiness.analysis.safetyRisk?.level || 'none'
        };
      }
    }

    res.status(201).json(responsePayload);

  } catch (error) {
    console.error('Error processing response:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /onboarding/session/{id}/status:
 *   get:
 *     summary: Get onboarding session status
 *     tags: [Onboarding]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Session ID
 *     responses:
 *       200:
 *         description: Session status retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   enum: [in_progress, completed, abandoned]
 *                 progress:
 *                   type: object
 *                   properties:
 *                     total_questions:
 *                       type: integer
 *                     answered_questions:
 *                       type: integer
 *                     completion_percentage:
 *                       type: number
 *                 missing_required:
 *                   type: array
 *                   items:
 *                     type: string
 *                 next_suggested_question:
 *                   type: object
 *                   nullable: true
 *                   properties:
 *                     question_id:
 *                       type: string
 *                     question_text:
 *                       type: string
 *                     type:
 *                       type: string
 *                     options:
 *                       type: array
 *                       items:
 *                         type: string
 *                 recent_responses:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       question_id:
 *                         type: string
 *                       raw_answer_text:
 *                         type: string
 *                       parsed_confidence:
 *                         type: number
 *                       requires_clarification:
 *                         type: boolean
 *                       answered_at:
 *                         type: string
 *                         format: date-time
 */
router.get('/session/:id/status', async (req, res) => {
  try {
    const sessionId = req.params.id;

    // Get session data
    const { data: session, error: sessionError } = await supabaseClient
      .from('onboarding_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Get all responses for this session
    const { data: responses, error: responsesError } = await supabaseClient
      .from('onboarding_responses')
      .select('*')
      .eq('session_id', sessionId)
      .order('answered_at', { ascending: false });

    if (responsesError) {
      console.error('Error fetching responses:', responsesError);
      return res.status(500).json({ error: 'Failed to fetch responses' });
    }

    // Calculate progress
    const totalQuestions = onboardingConfig.getQuestions().length;
    const answeredQuestions = responses?.length || 0;
    const completionPercentage = Math.round((answeredQuestions / totalQuestions) * 100);

    // Get next suggested question
    const answeredQuestionIds = (responses || []).map(r => r.question_id);
    const allQuestions = onboardingConfig.getQuestions().sort((a, b) => a.order - b.order);
    const nextQuestion = allQuestions.find(q => !answeredQuestionIds.includes(q.id));

    let nextSuggestedQuestion = null;
    if (nextQuestion) {
      nextSuggestedQuestion = {
        question_id: nextQuestion.id,
        question_text: nextQuestion.question,
        type: nextQuestion.type,
        options: nextQuestion.options || null,
        required: nextQuestion.required
      };
    }

    // Get recent responses (last 5)
    const recentResponses = (responses || []).slice(0, 5).map(r => ({
      question_id: r.question_id,
      raw_answer_text: r.raw_answer_text,
      parsed_confidence: r.parsed_confidence,
      requires_clarification: r.requires_clarification,
      answered_at: r.answered_at
    }));

    res.json({
      status: session.status,
      progress: {
        total_questions: totalQuestions,
        answered_questions: answeredQuestions,
        completion_percentage: completionPercentage
      },
      missing_required: session.missing_required_fields || [],
      next_suggested_question: nextSuggestedQuestion,
      recent_responses: recentResponses
    });

  } catch (error) {
    console.error('Error getting session status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /onboarding/session/{id}/clarify:
 *   post:
 *     summary: Provide clarification for a previous response
 *     tags: [Onboarding]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Session ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - original_response_id
 *               - clarification_text
 *             properties:
 *               original_response_id:
 *                 type: string
 *                 format: uuid
 *                 description: ID of the response being clarified
 *               clarification_text:
 *                 type: string
 *                 description: Additional clarification text
 *               timestamp:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       201:
 *         description: Clarification processed successfully
 */
router.post('/session/:id/clarify', async (req, res) => {
  try {
    const sessionId = req.params.id;
    
    // Validate request
    const { error, value } = clarifySchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.details.map(d => d.message)
      });
    }

    const { original_response_id, clarification_text, timestamp } = value;

    // Get original response
    const { data: originalResponse, error: originalError } = await supabaseClient
      .from('onboarding_responses')
      .select('*')
      .eq('id', original_response_id)
      .eq('session_id', sessionId)
      .single();

    if (originalError || !originalResponse) {
      return res.status(404).json({ error: 'Original response not found' });
    }

    // Combine original answer with clarification
    const combinedAnswer = `${originalResponse.raw_answer_text}\n\nClarification: ${clarification_text}`;

    // Parse the combined answer
    const parseResult = await parseAnswer(
      originalResponse.question_id,
      combinedAnswer,
      originalResponse.question_text
    );

    // Create clarification response
    const clarificationId = uuidv4();
    const { error: insertError } = await supabaseClient
      .from('onboarding_responses')
      .insert({
        id: clarificationId,
        session_id: sessionId,
        user_id: originalResponse.user_id,
        question_id: originalResponse.question_id,
        question_text: `Clarification for: ${originalResponse.question_text}`,
        raw_answer_text: clarification_text,
        parsed_value: parseResult.parsed_value,
        parsed_confidence: parseResult.parsed_confidence,
        requires_clarification: parseResult.requires_clarification,
        clarified_with_response_id: original_response_id,
        answered_at: timestamp
      });

    if (insertError) {
      console.error('Error inserting clarification:', insertError);
      return res.status(500).json({ error: 'Failed to save clarification' });
    }

    // Update original response to link to clarification
    await supabaseClient
      .from('onboarding_responses')
      .update({ clarified_with_response_id: clarificationId })
      .eq('id', original_response_id);

    res.status(201).json({
      clarification_response_id: clarificationId,
      parsed_value: parseResult.parsed_value,
      parsed_confidence: parseResult.parsed_confidence,
      requires_clarification: parseResult.requires_clarification
    });

  } catch (error) {
    console.error('Error processing clarification:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Removed automatic plan generation trigger - plans are now generated on-demand only

/**
 * @swagger
 * /onboarding/session/{id}/generate-plan:
 *   post:
 *     summary: Generate and return a plan based on onboarding session
 *     tags: [Onboarding]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Session ID
 *     responses:
 *       200:
 *         description: Plan generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 plan:
 *                   type: object
 *                   description: The generated plan
 */
router.post('/session/:id/generate-plan', async (req, res) => {
  try {
    const sessionId = req.params.id;

    // Get session data
    const { data: session, error: sessionError } = await supabaseClient
      .from('onboarding_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const userId = session.user_id;

    // Gather plan generation data
    const planData = await gatherPlanGenerationData(userId, sessionId, true);
    if (!planData.success) {
      return res.status(400).json({ error: planData.error });
    }

    // Generate plan
    const generationResult = await planGenerator.generatePlan({
      user_id: userId,
      session_id: sessionId,
      required_fields_snapshot: planData.required_fields_snapshot,
      profile_extras: planData.profile_extras,
      user_summaries: planData.user_summaries,
      force: false
    });

    if (!generationResult.success) {
      return res.status(500).json({ error: generationResult.error });
    }

    // Just return the plan JSON - don't save it or do anything else
    res.json({
      plan: generationResult.plan.plan_json
    });

  } catch (error) {
    console.error('Error generating plan:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Helper function to gather plan generation data
 */
async function gatherPlanGenerationData(userId, sessionId, includeUserSummaries = true) {
  try {
    // Get onboarding responses
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

    // Get profile extras
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

    // Get user summaries if requested
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

module.exports = router;