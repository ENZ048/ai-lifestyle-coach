const openaiClient = require('../lib/openaiClient');
const onboardingConfig = require('./OnboardingConfigService');
const RuleBasedParser = require('./RuleBasedParser');

class OnboardingAIService {
  constructor() {
    this.systemPrompt = this.buildSystemPrompt();
    this.ruleBasedParser = new RuleBasedParser();
  }

  buildSystemPrompt() {
    return `You are an AI Lifestyle Coach conducting an onboarding conversation with a new user. Your role is to:

1. Ask onboarding questions in a natural, conversational way
2. Show empathy and encouragement
3. Adapt your tone based on user responses
4. Ensure safety by identifying potential health concerns
5. Guide users through the complete onboarding process

PERSONALITY TRAITS:
- Empathetic and supportive (Level: ${onboardingConfig.getConfig().ai_behavior.empathy_level}/10)
- Encouraging and motivating (Level: ${onboardingConfig.getConfig().ai_behavior.encouragement_level}/10)
- Professional but friendly (Level: ${onboardingConfig.getConfig().ai_behavior.professionalism_level}/10)

COMMUNICATION STYLE:
- Use ${onboardingConfig.getConfig().ai_behavior.use_emojis ? 'appropriate emojis' : 'no emojis'}
- Keep responses ${onboardingConfig.getConfig().ai_behavior.response_length}
- Be ${onboardingConfig.getConfig().ai_behavior.adaptive_tone ? 'adaptive to user tone' : 'consistent in tone'}

SAFETY PRIORITIES:
- Always prioritize user safety
- Flag any mentions of medical conditions, injuries, or allergies
- Recommend medical consultation when appropriate
- Never provide medical advice

CONVERSATION FLOW:
1. Welcome the user warmly
2. Ask questions one at a time
3. Acknowledge and validate responses
4. Show progress and encourage completion
5. Explain why each question helps create a better plan`;
  }

  async generateWelcomeMessage(userName = null) {
    const prompt = `Generate a warm welcome message for a new user ${userName ? `named ${userName}` : ''} starting their onboarding process. Explain that you'll ask some questions to create their personalized health and fitness plan.`;

    try {
      const response = await openaiClient.chat.completions.create({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: this.systemPrompt },
          { role: 'user', content: prompt }
        ],
        max_tokens: 200,
        temperature: 0.7
      });

      return {
        message: response.choices[0].message.content,
        confidence: this.calculateConfidence(response)
      };
    } catch (error) {
      console.error('Error generating welcome message:', error);
      return {
        message: `Hello${userName ? ` ${userName}` : ''}! 👋 I'm your AI Lifestyle Coach, and I'm excited to help you create a personalized health and fitness plan. I'll ask you a few questions to understand your goals and preferences better. Ready to get started?`,
        confidence: 1.0
      };
    }
  }

  async generateQuestionMessage(question, context = {}) {
    const { currentAnswers = {}, attemptNumber = 1, previousError = null } = context;
    
    let prompt = `Ask the following question naturally: "${question.question}"`;
    
    if (question.ai_prompt) {
      prompt += `\n\nContext: ${question.ai_prompt}`;
    }

    if (question.options) {
      prompt += `\n\nOptions: ${question.options.join(', ')}`;
    }

    if (question.descriptions) {
      prompt += `\n\nOption descriptions: ${JSON.stringify(question.descriptions)}`;
    }

    if (attemptNumber > 1) {
      prompt += `\n\nThis is attempt #${attemptNumber}. The previous answer was invalid: ${previousError}`;
    }

    // Add context from previous answers for personalization
    if (Object.keys(currentAnswers).length > 0) {
      prompt += `\n\nUser context: ${this.buildUserContext(currentAnswers)}`;
    }

    try {
      const response = await openaiClient.chat.completions.create({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: this.systemPrompt },
          { role: 'user', content: prompt }
        ],
        max_tokens: 300,
        temperature: 0.7
      });

      return {
        message: response.choices[0].message.content,
        confidence: this.calculateConfidence(response),
        question: question
      };
    } catch (error) {
      console.error('Error generating question message:', error);
      return {
        message: this.getFallbackQuestionMessage(question),
        confidence: 0.5,
        question: question
      };
    }
  }

  async processAnswer(questionId, answer, context = {}) {
    const question = onboardingConfig.getQuestionById(questionId);
    const { currentAnswers = {} } = context;

    // Validate answer format
    const validation = onboardingConfig.validateAnswer(questionId, answer);
    if (!validation.valid) {
      return {
        valid: false,
        errors: validation.errors,
        retry_message: await this.generateRetryMessage(question, validation.errors)
      };
    }

    // Check for safety concerns
    const safetyCheck = onboardingConfig.checkSafetyConcerns(questionId, answer);
    
    // Generate acknowledgment message
    const acknowledgment = await this.generateAcknowledgment(question, answer, {
      ...context,
      safetyCheck
    });

    return {
      valid: true,
      processed_answer: this.processAnswerValue(question, answer),
      acknowledgment: acknowledgment.message,
      confidence: acknowledgment.confidence,
      safety_concerns: safetyCheck,
      requires_medical_review: safetyCheck.requiresReview
    };
  }

  async generateAcknowledgment(question, answer, context = {}) {
    const { safetyCheck = null } = context;
    
    let prompt = `Generate a brief acknowledgment for the user's answer to: "${question.question}"\nUser answered: "${answer}"`;
    
    if (safetyCheck?.hasConcerns) {
      prompt += `\n\nSafety concerns detected. Include appropriate safety recommendations without providing medical advice.`;
    }

    prompt += `\n\nBe encouraging and explain briefly how this information helps create their plan.`;

    try {
      const response = await openaiClient.chat.completions.create({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: this.systemPrompt },
          { role: 'user', content: prompt }
        ],
        max_tokens: 150,
        temperature: 0.7
      });

      return {
        message: response.choices[0].message.content,
        confidence: this.calculateConfidence(response)
      };
    } catch (error) {
      console.error('Error generating acknowledgment:', error);
      return {
        message: this.getFallbackAcknowledgment(question),
        confidence: 0.5
      };
    }
  }

  async generateRetryMessage(question, errors) {
    const prompt = `The user provided an invalid answer to: "${question.question}"\nErrors: ${errors.join(', ')}\n\nGenerate a helpful message asking them to try again, explaining what went wrong.`;

    try {
      const response = await openaiClient.chat.completions.create({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: this.systemPrompt },
          { role: 'user', content: prompt }
        ],
        max_tokens: 100,
        temperature: 0.7
      });

      return response.choices[0].message.content;
    } catch (error) {
      console.error('Error generating retry message:', error);
      return `I'm sorry, but there was an issue with your answer. ${errors.join(' ')} Could you please try again?`;
    }
  }

  async generateCompletionMessage(answers, plan = null) {
    const userContext = this.buildUserContext(answers);
    const completionPercentage = onboardingConfig.getCompletionPercentage(answers);
    
    let prompt = `Generate a completion message for a user who has finished onboarding with ${completionPercentage}% completion.\n\nUser context: ${userContext}`;
    
    if (plan) {
      prompt += `\n\nA personalized plan has been generated. Congratulate them and encourage them to start their journey.`;
    } else {
      prompt += `\n\nExplain that their plan is being generated and will be ready soon.`;
    }

    try {
      const response = await openaiClient.chat.completions.create({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: this.systemPrompt },
          { role: 'user', content: prompt }
        ],
        max_tokens: 200,
        temperature: 0.7
      });

      return {
        message: response.choices[0].message.content,
        confidence: this.calculateConfidence(response)
      };
    } catch (error) {
      console.error('Error generating completion message:', error);
      return {
        message: "Congratulations! 🎉 You've completed your onboarding. I'm now creating your personalized health and fitness plan based on your responses. This is the beginning of an amazing journey toward your health goals!",
        confidence: 1.0
      };
    }
  }

  async generateProgressMessage(currentAnswers) {
    const completionPercentage = onboardingConfig.getCompletionPercentage(currentAnswers);
    const remainingQuestions = this.getRemainingQuestionCount(currentAnswers);
    
    const prompt = `Generate a brief progress update. The user is ${completionPercentage}% complete with approximately ${remainingQuestions} questions remaining. Be encouraging.`;

    try {
      const response = await openaiClient.chat.completions.create({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: this.systemPrompt },
          { role: 'user', content: prompt }
        ],
        max_tokens: 100,
        temperature: 0.7
      });

      return {
        message: response.choices[0].message.content,
        confidence: this.calculateConfidence(response),
        completion_percentage: completionPercentage,
        remaining_questions: remainingQuestions
      };
    } catch (error) {
      console.error('Error generating progress message:', error);
      return {
        message: `Great progress! You're ${completionPercentage}% complete. Just ${remainingQuestions} more questions to go! 💪`,
        confidence: 1.0,
        completion_percentage: completionPercentage,
        remaining_questions: remainingQuestions
      };
    }
  }

  // Helper methods
  buildUserContext(answers) {
    const context = [];
    
    if (answers.name_v1) context.push(`Name: ${answers.name_v1}`);
    if (answers.primary_goal_v1) context.push(`Goal: ${answers.primary_goal_v1}`);
    if (answers.activity_level_v1) context.push(`Activity Level: ${answers.activity_level_v1}`);
    if (answers.preferred_tone_v1) context.push(`Preferred Tone: ${answers.preferred_tone_v1}`);
    
    return context.join(', ');
  }

  getRemainingQuestionCount(currentAnswers) {
    const allQuestions = onboardingConfig.getQuestions();
    const applicableQuestions = allQuestions.filter(q => 
      onboardingConfig.shouldShowQuestion(q.id, currentAnswers)
    );
    const answeredQuestions = applicableQuestions.filter(q => 
      currentAnswers.hasOwnProperty(q.id)
    );
    
    return applicableQuestions.length - answeredQuestions.length;
  }

  processAnswerValue(question, answer) {
    switch (question.type) {
      case 'number':
        return parseFloat(answer);
      case 'date':
        return new Date(answer);
      case 'boolean':
        return Boolean(answer);
      case 'multiple_choice':
        return Array.isArray(answer) ? answer : [answer];
      default:
        return answer;
    }
  }

  calculateConfidence(response) {
    // Simple confidence calculation based on response length and structure
    // In production, use more sophisticated methods
    const content = response.choices[0].message.content;
    const baseConfidence = 0.8;
    
    // Adjust based on response characteristics
    if (content.length < 20) return Math.max(baseConfidence - 0.2, 0.3);
    if (content.length > 200) return Math.min(baseConfidence + 0.1, 0.95);
    
    return baseConfidence;
  }

  getFallbackQuestionMessage(question) {
    let message = question.question;
    
    if (question.options) {
      message += `\n\nPlease choose from: ${question.options.join(', ')}`;
    }
    
    return message;
  }

  getFallbackAcknowledgment(question) {
    const acknowledgments = [
      "Thank you for that information!",
      "Got it! This helps me understand you better.",
      "Perfect! I'll use this to create your personalized plan.",
      "Thanks for sharing that with me!",
      "Excellent! Every detail helps me design the best plan for you."
    ];
    
    return acknowledgments[Math.floor(Math.random() * acknowledgments.length)];
  }

  // Parse natural language answer using Rule-Based Parser (MVP) with AI fallback
  async parseNaturalLanguageAnswer(question, rawAnswer, questionText) {
    console.log(`[PARSER] Processing question: ${question.id}, answer: "${rawAnswer}"`);
    
    // Step 1: Try rule-based parser first (fast, reliable)
    const ruleBasedResult = this.ruleBasedParser.parseResponse(question.id, rawAnswer);
    
    console.log(`[PARSER] Rule-based result: confidence=${ruleBasedResult.confidence}, value=${JSON.stringify(ruleBasedResult.value)}`);
    
    // Step 2: Use rule-based result if confidence is high enough
    if (ruleBasedResult.confidence >= 0.6) {
      return {
        parsed_value: {
          field: ruleBasedResult.field,
          value: ruleBasedResult.value,
          extras: {
            ...ruleBasedResult.extras,
            parsing_method: 'rule_based',
            parser_version: ruleBasedResult.parser_version
          }
        },
        confidence: ruleBasedResult.confidence,
        requires_clarification: ruleBasedResult.extras?.requires_clarification || false
      };
    }

    // Step 3: Fall back to AI parsing for complex cases
    console.log(`[PARSER] Rule-based confidence too low (${ruleBasedResult.confidence}), trying AI fallback`);
    
    try {
      const aiResult = await this.parseWithAI(question, rawAnswer, questionText);
      
      // Combine rule-based insights with AI parsing
      return {
        parsed_value: {
          ...aiResult.parsed_value,
          extras: {
            ...aiResult.parsed_value.extras,
            rule_based_attempt: ruleBasedResult,
            parsing_method: 'ai_fallback',
            fallback_reason: 'low_rule_based_confidence'
          }
        },
        confidence: aiResult.confidence,
        requires_clarification: aiResult.requires_clarification
      };
      
    } catch (error) {
      console.error('[PARSER] AI fallback failed:', error);
      
      // Step 4: Use rule-based result even with low confidence if AI fails
      console.log(`[PARSER] Using rule-based result despite low confidence due to AI failure`);
      
      return {
        parsed_value: {
          field: ruleBasedResult.field,
          value: ruleBasedResult.value,
          extras: {
            ...ruleBasedResult.extras,
            parsing_method: 'rule_based_emergency',
            ai_fallback_failed: true,
            original_confidence: ruleBasedResult.confidence
          }
        },
        confidence: Math.max(ruleBasedResult.confidence, 0.3), // Boost slightly for emergency use
        requires_clarification: true // Always require clarification in emergency mode
      };
    }
  }

  // AI parsing method (used as fallback)
  async parseWithAI(question, rawAnswer, questionText) {
    const prompt = `Parse the following user response to extract structured data:

Question: "${questionText}"
Question Type: ${question.type}
${question.options ? `Valid Options: ${question.options.join(', ')}` : ''}
User Response: "${rawAnswer}"

Extract the key information and return JSON in this format:
{
  "parsed_value": {
    "field": "${question.id.replace('_v1', '')}",
    "value": "extracted_value",
    "extras": {}
  },
  "confidence": 0.85,
  "requires_clarification": false
}

For single_choice questions, match to the closest valid option.
For multiple_choice questions, return an array of matched options.
For text questions, clean and standardize the response.
For number questions, extract the numeric value.
For boolean questions, determine true/false intent.

Be conservative with confidence scores. Use confidence < 0.6 if the answer is ambiguous.`;

    const response = await openaiClient.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: 'You are an expert at parsing natural language responses into structured data. Always return valid JSON.' },
        { role: 'user', content: prompt }
      ],
      max_tokens: 300,
      temperature: 0.3
    });

    const responseText = response.choices[0].message.content;
    
    try {
      const parsed = JSON.parse(responseText);
      return {
        parsed_value: parsed.parsed_value,
        confidence: Math.min(Math.max(parsed.confidence || 0.5, 0.0), 1.0),
        requires_clarification: parsed.requires_clarification || false
      };
    } catch (parseError) {
      console.error('Error parsing AI response:', parseError);
      throw new Error('AI parsing failed: invalid JSON response');
    }
  }

  // Simple fallback parsing (deprecated - rule-based parser handles most cases)
  fallbackParse(question, rawAnswer) {
    console.log(`[PARSER] Using deprecated fallback parsing for ${question.id}`);
    
    // This method is largely replaced by RuleBasedParser
    // Keep minimal logic for absolute emergency cases
    return {
      parsed_value: {
        field: question.id.replace('_v1', ''),
        value: rawAnswer.trim(),
        extras: {
          parsing_method: 'deprecated_fallback',
          needs_manual_review: true
        }
      },
      confidence: 0.2,
      requires_clarification: true
    };
  }
}

module.exports = new OnboardingAIService();