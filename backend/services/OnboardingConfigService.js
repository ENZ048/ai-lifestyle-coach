const fs = require('fs');
const path = require('path');
const yaml = require('yaml');

class OnboardingConfigService {
  constructor() {
    this.questionsPath = path.join(__dirname, '../config/onboarding-questions.json');
    this.configPath = path.join(__dirname, '../config/onboarding-config.yaml');
    this.questions = null;
    this.config = null;
    this.loadConfig();
  }

  loadConfig() {
    try {
      // Load questions
      const questionsData = fs.readFileSync(this.questionsPath, 'utf8');
      this.questions = JSON.parse(questionsData);

      // Load config
      const configData = fs.readFileSync(this.configPath, 'utf8');
      this.config = yaml.parse(configData);
    } catch (error) {
      console.error('Error loading onboarding config:', error);
      throw new Error('Failed to load onboarding configuration');
    }
  }

  getQuestions() {
    return this.questions.questions;
  }

  getConfig() {
    return this.config;
  }

  getRequiredQuestions() {
    return this.questions.questions.filter(q => q.required);
  }

  getOptionalQuestions() {
    return this.questions.questions.filter(q => !q.required);
  }

  getQuestionById(id) {
    return this.questions.questions.find(q => q.id === id);
  }

  getSafetyFlags() {
    return this.questions.questions.filter(q => q.safety_flag);
  }

  getConditionalQuestions() {
    return this.questions.questions.filter(q => q.conditional);
  }

  // Check if a conditional question should be shown
  shouldShowQuestion(questionId, currentAnswers) {
    const question = this.getQuestionById(questionId);
    if (!question?.conditional) return true;

    const condition = question.conditional.show_if;
    return this.evaluateCondition(condition, currentAnswers);
  }

  // Simple condition evaluator
  evaluateCondition(condition, answers) {
    try {
      // Replace question IDs with actual values
      let evaluableCondition = condition;
      Object.keys(answers).forEach(key => {
        const value = answers[key];
        const valueStr = typeof value === 'string' ? `'${value}'` : value;
        evaluableCondition = evaluableCondition.replace(new RegExp(key, 'g'), valueStr);
      });

      // Basic evaluation for simple conditions
      // This is a simplified evaluator - in production, consider using a proper expression parser
      return eval(evaluableCondition);
    } catch (error) {
      console.warn('Error evaluating condition:', condition, error);
      return false;
    }
  }

  // Get next question in the sequence
  getNextQuestion(currentAnswers = {}) {
    const allQuestions = this.getQuestions().sort((a, b) => a.order - b.order);
    const answeredIds = Object.keys(currentAnswers);

    for (const question of allQuestions) {
      // Skip if already answered
      if (answeredIds.includes(question.id)) continue;

      // Check if conditional question should be shown
      if (!this.shouldShowQuestion(question.id, currentAnswers)) continue;

      return question;
    }

    return null; // All questions completed
  }

  // Check if onboarding is complete
  isOnboardingComplete(answers) {
    const requiredQuestions = this.getRequiredQuestions();
    const requiredAnswered = requiredQuestions.filter(q => {
      // Check if question should be shown (conditional logic)
      if (!this.shouldShowQuestion(q.id, answers)) return true;
      // Check if question is answered
      return answers.hasOwnProperty(q.id) && answers[q.id] !== null && answers[q.id] !== '';
    });

    return requiredAnswered.length === requiredQuestions.length;
  }

  // Calculate completion percentage
  getCompletionPercentage(answers) {
    const allQuestions = this.getQuestions();
    const applicableQuestions = allQuestions.filter(q => 
      this.shouldShowQuestion(q.id, answers)
    );
    
    const answeredQuestions = applicableQuestions.filter(q => 
      answers.hasOwnProperty(q.id) && answers[q.id] !== null && answers[q.id] !== ''
    );

    return Math.round((answeredQuestions.length / applicableQuestions.length) * 100);
  }

  // Check if ready for plan generation
  isReadyForPlanGeneration(answers) {
    const completionPercentage = this.getCompletionPercentage(answers);
    const requiredComplete = this.isOnboardingComplete(answers);
    const minPercentage = this.config.plan_generation.required_completion_percentage;

    return requiredComplete && completionPercentage >= minPercentage;
  }

  // Validate answer format
  validateAnswer(questionId, answer) {
    const question = this.getQuestionById(questionId);
    if (!question) return { valid: false, error: 'Question not found' };

    const validation = question.validation || {};
    const errors = [];

    switch (question.type) {
      case 'text':
        if (typeof answer !== 'string') {
          errors.push('Answer must be text');
        } else {
          if (validation.min_length && answer.length < validation.min_length) {
            errors.push(`Minimum length is ${validation.min_length} characters`);
          }
          if (validation.max_length && answer.length > validation.max_length) {
            errors.push(`Maximum length is ${validation.max_length} characters`);
          }
          if (validation.pattern && !new RegExp(validation.pattern).test(answer)) {
            errors.push('Answer format is invalid');
          }
        }
        break;

      case 'number':
        const num = parseFloat(answer);
        if (isNaN(num)) {
          errors.push('Answer must be a number');
        } else {
          if (validation.min && num < validation.min) {
            errors.push(`Minimum value is ${validation.min}`);
          }
          if (validation.max && num > validation.max) {
            errors.push(`Maximum value is ${validation.max}`);
          }
        }
        break;

      case 'date':
        const date = new Date(answer);
        if (isNaN(date.getTime())) {
          errors.push('Invalid date format');
        } else if (validation.min_age || validation.max_age) {
          const age = new Date().getFullYear() - date.getFullYear();
          if (validation.min_age && age < validation.min_age) {
            errors.push(`Minimum age is ${validation.min_age}`);
          }
          if (validation.max_age && age > validation.max_age) {
            errors.push(`Maximum age is ${validation.max_age}`);
          }
        }
        break;

      case 'single_choice':
        if (!question.options.includes(answer)) {
          errors.push('Invalid option selected');
        }
        break;

      case 'multiple_choice':
        if (!Array.isArray(answer)) {
          errors.push('Answer must be an array');
        } else if (!answer.every(item => question.options.includes(item))) {
          errors.push('Invalid options selected');
        }
        break;

      case 'boolean':
        if (typeof answer !== 'boolean') {
          errors.push('Answer must be true or false');
        }
        break;
    }

    return {
      valid: errors.length === 0,
      errors: errors
    };
  }

  // Check for safety concerns
  checkSafetyConcerns(questionId, answer) {
    const question = this.getQuestionById(questionId);
    const safetyKeywords = this.config.safety.safety_keywords;
    const concerns = [];

    if (question?.safety_flag && typeof answer === 'string') {
      const lowerAnswer = answer.toLowerCase();
      safetyKeywords.forEach(keyword => {
        if (lowerAnswer.includes(keyword.toLowerCase())) {
          concerns.push({
            keyword,
            severity: this.calculateSeverity(keyword, lowerAnswer),
            recommendation: this.getSafetyRecommendation(keyword)
          });
        }
      });
    }

    return {
      hasConcerns: concerns.length > 0,
      concerns,
      requiresReview: concerns.some(c => c.severity >= this.config.safety.severity_threshold)
    };
  }

  calculateSeverity(keyword, text) {
    // Simple severity calculation - in production, use ML model
    const highRiskKeywords = ['heart condition', 'diabetes', 'surgery', 'chronic', 'severe'];
    const mediumRiskKeywords = ['pain', 'medication', 'doctor'];
    
    if (highRiskKeywords.some(k => text.includes(k))) return 4;
    if (mediumRiskKeywords.some(k => text.includes(k))) return 3;
    return 2;
  }

  getSafetyRecommendation(keyword) {
    const recommendations = {
      'heart condition': 'Please consult with your cardiologist before starting any exercise program.',
      'diabetes': 'Monitor blood sugar levels and consult your healthcare provider.',
      'pregnancy': 'Please get clearance from your obstetrician before exercising.',
      'surgery': 'Follow your surgeon\'s recovery guidelines and get medical clearance.',
      'medication': 'Check with your doctor about exercise interactions with your medications.',
      'default': 'Please consult with your healthcare provider before starting this program.'
    };

    return recommendations[keyword] || recommendations.default;
  }
}

module.exports = new OnboardingConfigService();