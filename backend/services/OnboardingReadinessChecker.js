const { supabase } = require('../lib/supabaseClient');
const OnboardingConfigService = require('./OnboardingConfigService');
const yaml = require('yaml');
const fs = require('fs');
const path = require('path');

class OnboardingReadinessChecker {
  constructor() {
    this.configService = new OnboardingConfigService();
    this.loadConfig();
  }

  loadConfig() {
    try {
      const configPath = path.join(__dirname, '../config/onboarding-config.yaml');
      const configFile = fs.readFileSync(configPath, 'utf8');
      this.config = yaml.parse(configFile);
    } catch (error) {
      console.error('Error loading onboarding config:', error);
      // Fallback defaults
      this.config = {
        confidence_thresholds: {
          minimum_confidence: 0.6,
          high_confidence: 0.8,
          safety_severity_threshold: 0.7
        },
        required_fields: [
          'name_v1', 'dob_v1', 'sex_v1', 'weight_v1', 'primary_goal_v1',
          'activity_level_v1', 'availability_v1', 'workout_setup_v1', 'injury_flag_v1'
        ],
        optional_fields: [
          'height_v1', 'diet_pref_v1', 'experience_level_v1',
          'injury_details_v1', 'medical_conditions_v1'
        ]
      };
    }
  }

  /**
   * Session state machine states
   */
  static STATES = {
    IN_PROGRESS: 'in_progress',
    AWAITING_CLARIFICATION: 'awaiting_clarification', 
    COMPLETED: 'completed',
    ABANDONED: 'abandoned'
  };

  /**
   * Main readiness checker - determines if session is ready for plan generation
   */
  async checkSessionReadiness(sessionId, options = {}) {
    const { forceCheck = false, userForced = false } = options;
    
    try {
      console.log(`[READINESS] Checking session: ${sessionId}, force: ${userForced}`);
      
      // Get session info
      const session = await this.getSessionInfo(sessionId);
      if (!session) {
        throw new Error('Session not found');
      }

      // Get latest canonical responses
      const canonicalFields = await this.getCanonicalFieldsFromResponses(sessionId);
      console.log(`[READINESS] Found ${Object.keys(canonicalFields).length} canonical fields`);

      // Run readiness analysis
      const readinessResult = await this.analyzeReadiness(canonicalFields, userForced);
      
      // Update session state based on readiness
      const newState = this.determineSessionState(readinessResult, userForced);
      
      // Update database
      await this.updateSessionState(sessionId, newState, readinessResult);
      
      // Auto-trigger plan generation if ready and enabled
      if (readinessResult.ready && session.trigger_plan_when_ready && !userForced) {
        console.log(`[READINESS] Auto-triggering plan generation for session ${sessionId}`);
        await this.enqueuePlanGeneration(session.user_id, sessionId);
      }

      return {
        session_id: sessionId,
        ready: readinessResult.ready,
        state: newState,
        missing_required_fields: readinessResult.missing_required_fields,
        low_confidence_fields: readinessResult.low_confidence_fields,
        safety_review_required: readinessResult.safety_review_required,
        safety_concerns: readinessResult.safety_concerns,
        completion_percentage: readinessResult.completion_percentage,
        can_force_generate: readinessResult.can_force_generate,
        next_recommended_action: this.getNextRecommendedAction(readinessResult),
        updated_at: new Date().toISOString()
      };

    } catch (error) {
      console.error(`[READINESS] Error checking session ${sessionId}:`, error);
      throw error;
    }
  }

  /**
   * Get session information from database
   */
  async getSessionInfo(sessionId) {
    const { data, error } = await supabase
      .from('onboarding_sessions')
      .select('*')
      .eq('session_id', sessionId)
      .single();

    if (error) {
      console.error('Error fetching session:', error);
      return null;
    }

    return data;
  }

  /**
   * Extract canonical field values from latest responses
   */
  async getCanonicalFieldsFromResponses(sessionId) {
    const { data: responses, error } = await supabase
      .from('onboarding_responses')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching responses:', error);
      return {};
    }

    const canonicalFields = {};
    
    // Process responses to extract latest canonical values
    for (const response of responses) {
      const questionId = response.question_id;
      
      // Skip if we already have this field (latest first due to ordering)
      if (canonicalFields[questionId]) {
        continue;
      }

      // Extract parsed value if available
      let canonicalValue = null;
      let confidence = response.parsed_confidence || 0;

      if (response.parsed_value) {
        try {
          const parsed = typeof response.parsed_value === 'string' 
            ? JSON.parse(response.parsed_value) 
            : response.parsed_value;
          canonicalValue = parsed.value;
        } catch (e) {
          console.warn(`Could not parse response for ${questionId}:`, e);
          canonicalValue = response.raw_answer_text;
          confidence = Math.min(confidence, 0.5);
        }
      } else {
        // Fallback to raw text
        canonicalValue = response.raw_answer_text;
        confidence = Math.min(confidence, 0.3);
      }

      canonicalFields[questionId] = {
        value: canonicalValue,
        confidence: confidence,
        response_id: response.response_id,
        created_at: response.created_at,
        requires_clarification: response.requires_clarification || false
      };
    }

    return canonicalFields;
  }

  /**
   * Core readiness analysis logic
   */
  async analyzeReadiness(canonicalFields, userForced = false) {
    const result = {
      ready: false,
      missing_required_fields: [],
      low_confidence_fields: [],
      safety_review_required: false,
      safety_concerns: [],
      completion_percentage: 0,
      can_force_generate: false,
      analysis_details: {}
    };

    const requiredFields = this.config.required_fields;
    const minConfidence = this.config.confidence_thresholds.minimum_confidence;
    const safetyThreshold = this.config.confidence_thresholds.safety_severity_threshold;

    // 1. Check for missing required fields
    const presentFields = Object.keys(canonicalFields);
    result.missing_required_fields = requiredFields.filter(field => !presentFields.includes(field));
    
    console.log(`[READINESS] Missing required: ${result.missing_required_fields.length}, Present: ${presentFields.length}`);

    // 2. Check confidence levels for present fields
    for (const [fieldId, fieldData] of Object.entries(canonicalFields)) {
      if (requiredFields.includes(fieldId) && fieldData.confidence < minConfidence) {
        result.low_confidence_fields.push({
          field: fieldId,
          confidence: fieldData.confidence,
          value: fieldData.value,
          requires_clarification: fieldData.requires_clarification
        });
      }
    }

    // 3. Safety analysis
    const safetyAnalysis = this.analyzeSafetyRisk(canonicalFields, safetyThreshold);
    result.safety_review_required = safetyAnalysis.review_required;
    result.safety_concerns = safetyAnalysis.concerns;

    // 4. Calculate completion percentage
    const totalRequiredFields = requiredFields.length;
    const completedFields = requiredFields.filter(field => {
      const fieldData = canonicalFields[field];
      return fieldData && fieldData.confidence >= minConfidence;
    }).length;
    
    result.completion_percentage = Math.round((completedFields / totalRequiredFields) * 100);

    // 5. Determine overall readiness
    const hasAllRequired = result.missing_required_fields.length === 0;
    const hasGoodConfidence = result.low_confidence_fields.length === 0;
    const noBlockingSafety = !result.safety_review_required || safetyAnalysis.can_proceed_with_caution;

    if (userForced) {
      // User forced - allow if we have at least 50% completion and basic info
      const hasBasicInfo = canonicalFields['name_v1'] && canonicalFields['primary_goal_v1'];
      result.ready = hasBasicInfo;  
      result.analysis_details.force_reason = hasBasicInfo ? 'user_forced_with_basic_info' : 'user_forced_insufficient_data';
    } else {
      // Standard readiness check
      result.ready = hasAllRequired && hasGoodConfidence && noBlockingSafety;
    }

    // 6. Can force generate check (for UI)
    result.can_force_generate = result.completion_percentage >= 50 && 
                               canonicalFields['name_v1'] && 
                               canonicalFields['primary_goal_v1'];

    result.analysis_details = {
      ...result.analysis_details,
      has_all_required: hasAllRequired,
      has_good_confidence: hasGoodConfidence,
      no_blocking_safety: noBlockingSafety,
      total_fields_present: presentFields.length,
      required_fields_count: totalRequiredFields
    };

    console.log(`[READINESS] Analysis complete: ready=${result.ready}, missing=${result.missing_required_fields.length}, low_conf=${result.low_confidence_fields.length}`);

    return result;
  }

  /**
   * Analyze safety risks from responses
   */
  analyzeSafetyRisk(canonicalFields, safetyThreshold) {
    const analysis = {
      review_required: false,
      can_proceed_with_caution: true,
      concerns: [],
      severity_score: 0
    };

    // Check injury flag
    const injuryFlag = canonicalFields['injury_flag_v1'];
    if (injuryFlag && injuryFlag.value === true) {
      analysis.concerns.push({
        type: 'injury_reported',
        field: 'injury_flag_v1',
        details: 'User reported having injuries or physical limitations'
      });
      analysis.severity_score += 0.5;
    }

    // Check injury details for severity
    const injuryDetails = canonicalFields['injury_details_v1'];
    if (injuryDetails && injuryDetails.value) {
      const severityKeywords = [
        'heart', 'cardiac', 'surgery', 'chronic', 'severe', 'doctor',
        'medical', 'condition', 'medication', 'therapy'
      ];
      
      const detailsText = injuryDetails.value.toLowerCase();
      const matchedKeywords = severityKeywords.filter(keyword => detailsText.includes(keyword));
      
      if (matchedKeywords.length > 0) {
        analysis.concerns.push({
          type: 'high_severity_injury',
          field: 'injury_details_v1',
          matched_keywords: matchedKeywords,
          details: injuryDetails.value
        });
        analysis.severity_score += matchedKeywords.length * 0.2;
      }
    }

    // Check medical conditions
    const medicalConditions = canonicalFields['medical_conditions_v1'];
    if (medicalConditions && medicalConditions.value) {
      analysis.concerns.push({
        type: 'medical_conditions',
        field: 'medical_conditions_v1',
        details: medicalConditions.value
      });
      analysis.severity_score += 0.4;
    }

    // Determine if review is required
    analysis.review_required = analysis.severity_score >= safetyThreshold;
    analysis.can_proceed_with_caution = analysis.severity_score < 1.0; // Block if very high risk

    return analysis;
  }

  /**
   * Determine session state based on readiness analysis
   */
  determineSessionState(readinessResult, userForced) {
    if (userForced && readinessResult.ready) {
      return OnboardingReadinessChecker.STATES.COMPLETED;
    }

    if (readinessResult.ready) {
      return OnboardingReadinessChecker.STATES.COMPLETED;
    }

    if (readinessResult.low_confidence_fields.length > 0) {
      return OnboardingReadinessChecker.STATES.AWAITING_CLARIFICATION;
    }

    if (readinessResult.missing_required_fields.length > 0) {
      return OnboardingReadinessChecker.STATES.IN_PROGRESS;
    }

    return OnboardingReadinessChecker.STATES.IN_PROGRESS;
  }

  /**
   * Update session state in database
   */
  async updateSessionState(sessionId, newState, readinessResult) {
    const updateData = {
      status: newState,
      missing_required_fields: readinessResult.missing_required_fields,
      completion_percentage: readinessResult.completion_percentage,
      ready_for_plan_generation: readinessResult.ready,
      safety_review_required: readinessResult.safety_review_required,
      last_updated: new Date().toISOString()
    };

    const { error } = await supabase
      .from('onboarding_sessions')
      .update(updateData)
      .eq('session_id', sessionId);

    if (error) {
      console.error('Error updating session state:', error);
      throw error;
    }

    console.log(`[READINESS] Updated session ${sessionId} to state: ${newState}`);
  }

  /**
   * Get next recommended action for the user
   */
  getNextRecommendedAction(readinessResult) {
    if (readinessResult.ready) {
      return {
        action: 'generate_plan',
        message: 'Ready to generate your personalized plan!',
        priority: 'high'
      };
    }

    if (readinessResult.safety_review_required) {
      return {
        action: 'safety_review',
        message: 'Please consult with a healthcare professional before starting any fitness program',
        priority: 'critical'
      };
    }

    if (readinessResult.low_confidence_fields.length > 0) {
      const field = readinessResult.low_confidence_fields[0];
      return {
        action: 'clarify_response',
        message: `Please clarify your response about ${field.field.replace('_v1', '')}`,
        priority: 'medium',
        field: field.field
      };
    }

    if (readinessResult.missing_required_fields.length > 0) {
      const nextField = readinessResult.missing_required_fields[0];
      return {
        action: 'answer_question',
        message: `Please provide information about ${nextField.replace('_v1', '')}`,
        priority: 'medium',
        field: nextField
      };
    }

    return {
      action: 'continue',
      message: 'Continue with the onboarding process',
      priority: 'low'
    };
  }

  /**
   * Enqueue plan generation (integrate with existing plans service)
   */
  async enqueuePlanGeneration(userId, sessionId) {
    try {
      // This would integrate with your existing plan generation service
      console.log(`[READINESS] Plan generation queued for user ${userId}, session ${sessionId}`);
      
      // For now, just log - in production this would call the plans API
      // await planGenerationService.enqueue({ userId, sessionId, trigger: 'auto' });
      
      return { queued: true, timestamp: new Date().toISOString() };
    } catch (error) {
      console.error('Error enqueueing plan generation:', error);
      throw error;
    }
  }

  /**
   * Event-driven readiness check (called after response insertion)
   */
  async onResponseAdded(sessionId, responseId) {
    console.log(`[READINESS] Response added to session ${sessionId}, checking readiness`);
    
    try {
      const result = await this.checkSessionReadiness(sessionId);
      
      // Emit event for real-time updates (if using WebSocket/SSE)
      // this.emitSessionUpdate(sessionId, result);
      
      return result;
    } catch (error) {
      console.error(`Error in onResponseAdded for session ${sessionId}:`, error);
      // Don't throw - this is a background process
      return null;
    }
  }

  /**
   * Scheduled job to check all active sessions
   */
  async checkAllActiveSessions() {
    console.log('[READINESS] Running scheduled check for all active sessions');
    
    try {
      const { data: sessions, error } = await supabase
        .from('onboarding_sessions')
        .select('session_id')
        .in('status', ['in_progress', 'awaiting_clarification'])
        .lt('last_updated', new Date(Date.now() - 5 * 60 * 1000).toISOString()); // 5 minutes old

      if (error) {
        console.error('Error fetching active sessions:', error);
        return;
      }

      console.log(`[READINESS] Found ${sessions.length} sessions to check`);

      for (const session of sessions) {
        try {
          await this.checkSessionReadiness(session.session_id, { forceCheck: true });
        } catch (error) {
          console.error(`Error checking session ${session.session_id}:`, error);
          // Continue with other sessions
        }
      }

      console.log(`[READINESS] Completed scheduled check of ${sessions.length} sessions`);
    } catch (error) {
      console.error('Error in scheduled session check:', error);
    }
  }

  /**
   * Mark session as abandoned (cleanup utility)
   */
  async markSessionAbandoned(sessionId, reason = 'inactivity') {
    const { error } = await supabase
      .from('onboarding_sessions')
      .update({
        status: OnboardingReadinessChecker.STATES.ABANDONED,
        abandoned_reason: reason,
        last_updated: new Date().toISOString()
      })
      .eq('session_id', sessionId);

    if (error) {
      console.error('Error marking session as abandoned:', error);
      throw error;
    }

    console.log(`[READINESS] Marked session ${sessionId} as abandoned: ${reason}`);
  }
}

module.exports = OnboardingReadinessChecker;