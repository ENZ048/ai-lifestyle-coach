const express = require('express');
const router = express.Router();
const onboardingConfig = require('../services/OnboardingConfigService');
const onboardingAI = require('../services/OnboardingAIService');

// In-memory session storage (replace with Redis in production)
const onboardingSessions = new Map();

// Get or create onboarding session
function getSession(userId) {
  if (!onboardingSessions.has(userId)) {
    onboardingSessions.set(userId, {
      userId,
      answers: {},
      currentQuestion: null,
      startedAt: new Date(),
      lastActivity: new Date(),
      completed: false,
      planGenerated: false
    });
  }
  return onboardingSessions.get(userId);
}

// Update session activity
function updateSessionActivity(userId) {
  const session = getSession(userId);
  session.lastActivity = new Date();
  return session;
}

// Start onboarding flow
router.post('/start', async (req, res) => {
  try {
    const userId = req.user.id;
    const { userName } = req.body;
    
    // Reset or create session
    onboardingSessions.delete(userId);
    const session = getSession(userId);
    
    // Generate welcome message
    const welcome = await onboardingAI.generateWelcomeMessage(userName);
    
    // Get first question
    const firstQuestion = onboardingConfig.getNextQuestion({});
    if (!firstQuestion) {
      return res.status(400).json({ error: 'No questions available' });
    }
    
    // Generate question message
    const questionMessage = await onboardingAI.generateQuestionMessage(firstQuestion);
    
    session.currentQuestion = firstQuestion.id;

    res.json({
      success: true,
      session_id: userId,
      welcome_message: welcome.message,
      question: {
        id: firstQuestion.id,
        message: questionMessage.message,
        type: firstQuestion.type,
        options: firstQuestion.options,
        descriptions: firstQuestion.descriptions,
        required: firstQuestion.required
      },
      progress: {
        completion_percentage: 0,
        total_questions: onboardingConfig.getQuestions().length,
        answered: 0
      }
    });
  } catch (error) {
    console.error('Error starting onboarding:', error);
    res.status(500).json({ error: 'Failed to start onboarding' });
  }
});

// Submit answer to current question
router.post('/answer', async (req, res) => {
  try {
    const userId = req.user.id;
    const { answer, skip = false } = req.body;
    
    const session = updateSessionActivity(userId);
    
    if (!session.currentQuestion) {
      return res.status(400).json({ error: 'No active question' });
    }

    const currentQuestion = onboardingConfig.getQuestionById(session.currentQuestion);
    if (!currentQuestion) {
      return res.status(400).json({ error: 'Invalid question' });
    }

    // Handle skip for optional questions
    if (skip && !currentQuestion.required) {
      session.answers[session.currentQuestion] = null;
    } else if (!skip) {
      // Process the answer
      const processResult = await onboardingAI.processAnswer(
        session.currentQuestion, 
        answer, 
        { currentAnswers: session.answers }
      );

      if (!processResult.valid) {
        return res.json({
          success: false,
          errors: processResult.errors,
          retry_message: processResult.retry_message,
          question: {
            id: currentQuestion.id,
            message: processResult.retry_message,
            type: currentQuestion.type,
            options: currentQuestion.options,
            descriptions: currentQuestion.descriptions,
            required: currentQuestion.required
          }
        });
      }

      // Save the processed answer
      session.answers[session.currentQuestion] = processResult.processed_answer;

      // Handle safety concerns
      if (processResult.requires_medical_review) {
        // Log for admin review
        console.warn('Medical review required for user:', userId, {
          question: session.currentQuestion,
          answer: answer,
          concerns: processResult.safety_concerns
        });
      }
    }

    // Get next question
    const nextQuestion = onboardingConfig.getNextQuestion(session.answers);
    const isComplete = !nextQuestion || onboardingConfig.isOnboardingComplete(session.answers);
    
    let response = {
      success: true,
      acknowledgment: skip ? "Okay, we'll skip that for now." : undefined,
      progress: {
        completion_percentage: onboardingConfig.getCompletionPercentage(session.answers),
        answered: Object.keys(session.answers).length
      }
    };

    if (!skip && !isComplete) {
      const processResult = await onboardingAI.processAnswer(
        session.currentQuestion, 
        answer, 
        { currentAnswers: session.answers }
      );
      response.acknowledgment = processResult.acknowledgment;
    }

    if (isComplete) {
      // Onboarding complete
      session.completed = true;
      session.currentQuestion = null;
      
      const completionMessage = await onboardingAI.generateCompletionMessage(session.answers);
      
      response.complete = true;
      response.completion_message = completionMessage.message;
      response.ready_for_plan = onboardingConfig.isReadyForPlanGeneration(session.answers);
      
      // Check plan generation policy
      const config = onboardingConfig.getConfig();
      if (config.plan_generation.policy === 'auto' && response.ready_for_plan) {
        // Auto-generate plan
        response.plan_generation_started = true;
      } else if (config.plan_generation.policy === 'confirmation_required') {
        response.requires_plan_confirmation = true;
      }
    } else {
      // Get next question
      session.currentQuestion = nextQuestion.id;
      const questionMessage = await onboardingAI.generateQuestionMessage(
        nextQuestion, 
        { currentAnswers: session.answers }
      );
      
      response.question = {
        id: nextQuestion.id,
        message: questionMessage.message,
        type: nextQuestion.type,
        options: nextQuestion.options,
        descriptions: nextQuestion.descriptions,
        required: nextQuestion.required
      };
    }

    res.json(response);
  } catch (error) {
    console.error('Error processing answer:', error);
    res.status(500).json({ error: 'Failed to process answer' });
  }
});

// Get current onboarding status
router.get('/status', async (req, res) => {
  try {
    const userId = req.user.id;
    const session = getSession(userId);
    
    const status = {
      active: !!session.currentQuestion,
      completed: session.completed,
      plan_generated: session.planGenerated,
      progress: {
        completion_percentage: onboardingConfig.getCompletionPercentage(session.answers),
        answered_questions: Object.keys(session.answers).length,
        total_questions: onboardingConfig.getQuestions().length
      },
      ready_for_plan: onboardingConfig.isReadyForPlanGeneration(session.answers),
      started_at: session.startedAt,
      last_activity: session.lastActivity
    };

    if (session.currentQuestion) {
      const currentQuestion = onboardingConfig.getQuestionById(session.currentQuestion);
      if (currentQuestion) {
        const questionMessage = await onboardingAI.generateQuestionMessage(
          currentQuestion, 
          { currentAnswers: session.answers }
        );
        
        status.current_question = {
          id: currentQuestion.id,
          message: questionMessage.message,
          type: currentQuestion.type,
          options: currentQuestion.options,
          descriptions: currentQuestion.descriptions,
          required: currentQuestion.required
        };
      }
    }

    res.json(status);
  } catch (error) {
    console.error('Error getting onboarding status:', error);
    res.status(500).json({ error: 'Failed to get status' });
  }
});

// Get progress update
router.get('/progress', async (req, res) => {
  try {
    const userId = req.user.id;
    const session = getSession(userId);
    
    const progressMessage = await onboardingAI.generateProgressMessage(session.answers);
    
    res.json({
      ...progressMessage,
      answered_questions: Object.keys(session.answers).length,
      total_questions: onboardingConfig.getQuestions().length,
      ready_for_plan: onboardingConfig.isReadyForPlanGeneration(session.answers)
    });
  } catch (error) {
    console.error('Error getting progress:', error);
    res.status(500).json({ error: 'Failed to get progress' });
  }
});

// Confirm plan generation
router.post('/generate-plan', async (req, res) => {
  try {
    const userId = req.user.id;
    const session = getSession(userId);
    
    if (!session.completed) {
      return res.status(400).json({ error: 'Onboarding not completed' });
    }
    
    if (!onboardingConfig.isReadyForPlanGeneration(session.answers)) {
      return res.status(400).json({ error: 'Not ready for plan generation' });
    }

    // TODO: Integrate with plan generation service
    // For now, return success
    session.planGenerated = true;
    
    res.json({
      success: true,
      message: 'Plan generation started',
      plan_id: `plan_${userId}_${Date.now()}`,
      estimated_completion: new Date(Date.now() + 2 * 60 * 1000) // 2 minutes from now
    });
  } catch (error) {
    console.error('Error generating plan:', error);
    res.status(500).json({ error: 'Failed to generate plan' });
  }
});

// Get user's answers (for admin/debugging)
router.get('/answers', async (req, res) => {
  try {
    const userId = req.user.id;
    const session = getSession(userId);
    
    // Format answers with question details
    const formattedAnswers = {};
    Object.entries(session.answers).forEach(([questionId, answer]) => {
      const question = onboardingConfig.getQuestionById(questionId);
      formattedAnswers[questionId] = {
        question: question?.question || 'Unknown question',
        answer,
        type: question?.type,
        category: question?.category
      };
    });
    
    res.json({
      answers: formattedAnswers,
      session_info: {
        started_at: session.startedAt,
        completed: session.completed,
        plan_generated: session.planGenerated
      }
    });
  } catch (error) {
    console.error('Error getting answers:', error);
    res.status(500).json({ error: 'Failed to get answers' });
  }
});

// Reset onboarding (for testing)
router.post('/reset', async (req, res) => {
  try {
    const userId = req.user.id;
    onboardingSessions.delete(userId);
    
    res.json({
      success: true,
      message: 'Onboarding session reset'
    });
  } catch (error) {
    console.error('Error resetting onboarding:', error);
    res.status(500).json({ error: 'Failed to reset onboarding' });
  }
});

module.exports = router;