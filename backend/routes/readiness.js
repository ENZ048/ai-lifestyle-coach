const express = require('express');
const router = express.Router();
const OnboardingReadinessChecker = require('../services/OnboardingReadinessChecker');
const { authenticateUser } = require('../middleware/auth');

const readinessChecker = new OnboardingReadinessChecker();

/**
 * GET /readiness/session/:sessionId
 * Check readiness status of a specific onboarding session
 */
router.get('/session/:sessionId', authenticateUser, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { force = false } = req.query;

    console.log(`[API] Checking readiness for session ${sessionId}, force: ${force}`);

    const result = await readinessChecker.checkSessionReadiness(sessionId, {
      forceCheck: force === 'true'
    });

    res.status(200).json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Error checking session readiness:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check session readiness',
      details: error.message
    });
  }
});

/**
 * POST /readiness/session/:sessionId/force-ready
 * Mark session as ready for plan generation (user forced)
 */
router.post('/session/:sessionId/force-ready', authenticateUser, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { reason = 'user_forced' } = req.body;

    console.log(`[API] Force-marking session ${sessionId} as ready`);

    const result = await readinessChecker.checkSessionReadiness(sessionId, {
      userForced: true
    });

    if (result.ready) {
      res.status(200).json({
        success: true,
        message: 'Session marked as ready for plan generation',
        data: result
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Session cannot be forced ready',
        reason: 'Insufficient basic information',
        data: result
      });
    }

  } catch (error) {
    console.error('Error force-marking session ready:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to force session ready',
      details: error.message
    });
  }
});

/**
 * POST /readiness/session/:sessionId/abandon
 * Mark session as abandoned
 */
router.post('/session/:sessionId/abandon', authenticateUser, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { reason = 'user_abandoned' } = req.body;

    console.log(`[API] Abandoning session ${sessionId}, reason: ${reason}`);

    await readinessChecker.markSessionAbandoned(sessionId, reason);

    res.status(200).json({
      success: true,
      message: 'Session marked as abandoned'
    });

  } catch (error) {
    console.error('Error abandoning session:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to abandon session',
      details: error.message
    });
  }
});

/**
 * GET /readiness/states
 * Get available session states and their descriptions
 */
router.get('/states', (req, res) => {
  const states = {
    [OnboardingReadinessChecker.STATES.IN_PROGRESS]: {
      description: 'Session is actively collecting responses',
      allows_responses: true,
      can_generate_plan: false
    },
    [OnboardingReadinessChecker.STATES.AWAITING_CLARIFICATION]: {
      description: 'Some responses need clarification due to low confidence',
      allows_responses: true,
      can_generate_plan: false
    },
    [OnboardingReadinessChecker.STATES.COMPLETED]: {
      description: 'Session has all required information and is ready',
      allows_responses: true,
      can_generate_plan: true
    },
    [OnboardingReadinessChecker.STATES.ABANDONED]: {
      description: 'Session was abandoned by user or system',
      allows_responses: false,
      can_generate_plan: false
    }
  };

  res.status(200).json({
    success: true,
    data: {
      states,
      current_schema_version: '1.0.0'
    }
  });
});

/**
 * POST /readiness/check-all-active
 * Manual trigger for checking all active sessions (admin endpoint)
 */
router.post('/check-all-active', authenticateUser, async (req, res) => {
  try {
    // This would typically require admin permissions
    console.log('[API] Manual trigger: checking all active sessions');

    // Run in background
    readinessChecker.checkAllActiveSessions()
      .then(() => console.log('[API] Background check completed'))
      .catch(err => console.error('[API] Background check failed:', err));

    res.status(202).json({
      success: true,
      message: 'Active session check initiated in background'
    });

  } catch (error) {
    console.error('Error initiating active session check:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to initiate session check',
      details: error.message
    });
  }
});

/**
 * GET /readiness/session/:sessionId/next-action
 * Get the next recommended action for a session
 */
router.get('/session/:sessionId/next-action', authenticateUser, async (req, res) => {
  try {
    const { sessionId } = req.params;

    const result = await readinessChecker.checkSessionReadiness(sessionId);
    
    res.status(200).json({
      success: true,
      data: {
        session_id: sessionId,
        current_state: result.state,
        ready: result.ready,
        next_action: result.next_recommended_action,
        completion_percentage: result.completion_percentage,
        can_force_generate: result.can_force_generate
      }
    });

  } catch (error) {
    console.error('Error getting next action:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get next action',
      details: error.message
    });
  }
});

/**
 * GET /readiness/session/:sessionId/status-summary
 * Get a comprehensive status summary for the session
 */
router.get('/session/:sessionId/status-summary', authenticateUser, async (req, res) => {
  try {
    const { sessionId } = req.params;

    const result = await readinessChecker.checkSessionReadiness(sessionId);
    
    // Format for frontend consumption
    const summary = {
      session_id: sessionId,
      state: result.state,
      ready_for_plan: result.ready,
      completion: {
        percentage: result.completion_percentage,
        missing_fields: result.missing_required_fields.length,
        low_confidence_fields: result.low_confidence_fields.length
      },
      safety: {
        review_required: result.safety_review_required,
        concerns_count: result.safety_concerns.length,
        concerns: result.safety_concerns.map(c => ({
          type: c.type,
          field: c.field,
          severity: c.severity || 'unknown'
        }))
      },
      next_steps: {
        action: result.next_recommended_action.action,
        message: result.next_recommended_action.message,
        priority: result.next_recommended_action.priority
      },
      actions_available: {
        can_continue: result.state !== 'abandoned',
        can_force_generate: result.can_force_generate,
        can_generate_plan: result.ready,
        can_clarify: result.low_confidence_fields.length > 0
      },
      last_updated: result.updated_at
    };

    res.status(200).json({
      success: true,
      data: summary
    });

  } catch (error) {
    console.error('Error getting status summary:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get status summary',
      details: error.message
    });
  }
});

module.exports = router;