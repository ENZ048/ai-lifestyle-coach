/**
 * Rule-Based Parser for Converting Raw Chat Text to Canonical Slots
 * 
 * MVP approach for fast, reliable parsing with confidence scoring
 * Handles: fitness goals, measurements, availability, injuries, diet preferences
 */

class RuleBasedParser {
  constructor() {
    this.version = '1.0.0';
    this.initializeRules();
  }

  initializeRules() {
    // Primary goal keywords mapping
    this.goalKeywords = {
      lose_fat: [
        'lose', 'cut', 'shred', 'slim', 'lean', 'drop', 'shed', 'burn',
        'weight loss', 'fat loss', 'cutting', 'slimming', 'trim'
      ],
      gain_muscle: [
        'bulk', 'gain', 'build', 'grow', 'mass', 'muscle', 'strength',
        'bulking', 'building', 'growing', 'bigger', 'stronger'
      ],
      maintain: [
        'maintain', 'keep', 'stay', 'same', 'current', 'stable',
        'maintenance', 'keeping', 'staying'
      ],
      tone: [
        'tone', 'toned', 'toning', 'sculpt', 'sculpted', 'define',
        'definition', 'firm', 'shape'
      ],
      endurance: [
        'endurance', 'cardio', 'stamina', 'fitness', 'conditioning',
        'marathon', 'running', 'cycling', 'swimming'
      ]
    };

    // Activity level keywords
    this.activityKeywords = {
      sedentary: [
        'sedentary', 'desk job', 'office', 'sitting', 'inactive',
        'no exercise', 'couch', 'barely', 'never work out'
      ],
      lightly_active: [
        'light', 'lightly', 'occasionally', 'sometimes', 'weekend',
        'once a week', '1x week', 'rarely exercise'
      ],
      moderately_active: [
        'moderate', 'moderately', 'regular', 'few times', '2-3',
        '3-4', 'several times', 'most days'
      ],
      very_active: [
        'very active', 'daily', 'every day', '5-6', '6-7',
        'athlete', 'competitive', 'intense', 'most days'
      ],
      extremely_active: [
        'extremely', 'professional', 'twice daily', '2x daily',
        'multiple sessions', 'elite', 'hardcore', 'train daily', 'twice a day'
      ]
    };

    // Workout setup keywords
    this.setupKeywords = {
      home_no_equipment: [
        'home', 'no equipment', 'bodyweight', 'apartment', 'bedroom',
        'living room', 'minimal space', 'no gym'
      ],
      home_basic_equipment: [
        'home gym', 'basic equipment', 'dumbbells', 'resistance bands',
        'yoga mat', 'kettlebell', 'simple setup'
      ],
      home_full_gym: [
        'home gym', 'full setup', 'squat rack', 'barbell', 'plates',
        'complete gym', 'garage gym', 'basement gym', 'squat rack and dumbbells'
      ],
      commercial_gym: [
        'gym', 'fitness center', 'commercial', 'membership',
        'local gym', 'chain gym', 'full gym'
      ],
      outdoor: [
        'outdoor', 'park', 'trail', 'running', 'hiking',
        'calisthenics', 'street workout'
      ]
    };

    // Diet preference keywords
    this.dietKeywords = {
      omnivore: ['everything', 'no restrictions', 'normal', 'regular'],
      vegetarian: ['vegetarian', 'veggie', 'no meat'],
      vegan: ['vegan', 'plant based', 'no animal products'],
      pescatarian: ['pescatarian', 'fish', 'seafood'],
      keto: ['keto', 'ketogenic', 'low carb', 'high fat'],
      paleo: ['paleo', 'paleolithic', 'caveman'],
      mediterranean: ['mediterranean', 'med diet'],
      intermittent_fasting: ['intermittent fasting', 'IF', '16:8', '18:6']
    };

    // Injury/safety keywords (high priority for detection)
    this.injuryKeywords = [
      'heart', 'cardiac', 'chest pain', 'heart condition',
      'surgery', 'recent surgery', 'post surgery',
      'chronic pain', 'arthritis', 'joint pain',
      'back pain', 'spine', 'herniated', 'disc',
      'knee', 'knee pain', 'knee injury', 'ACL', 'meniscus', 'bad knee',
      'shoulder pain', 'rotator cuff', 'shoulder injury',
      'ankle', 'wrist', 'neck pain', 'concussion',
      'diabetes', 'blood pressure', 'medication',
      'physical therapy', 'doctor', 'medical clearance',
      'minor aches', 'aches', 'pain'
    ];

    // Time availability patterns
    this.timePatterns = [
      { regex: /(\d+)\s*(?:min|minute|minutes)/i, unit: 'minutes' },
      { regex: /(\d+)\s*(?:hr|hour|hours)/i, multiplier: 60, unit: 'minutes' },
      { regex: /(\d+\.?\d*)\s*(?:hr|hour|hours)/i, multiplier: 60, unit: 'minutes' }
    ];

    // Day patterns for availability
    this.dayPatterns = {
      weekdays: ['weekday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'work days'],
      weekends: ['weekend', 'saturday', 'sunday', 'sat', 'sun'],
      daily: ['daily', 'every day', 'everyday', '7 days', 'all days'],
      flexible: ['flexible', 'varies', 'depends', 'any time', 'whenever']
    };
  }

  /**
   * Main parsing method - converts raw text to canonical slot
   */
  parseResponse(questionId, rawText) {
    if (!rawText || typeof rawText !== 'string') {
      return this.createLowConfidenceResponse(questionId, null, 0.0, 'Empty or invalid input');
    }

    const cleanText = rawText.toLowerCase().trim();
    
    // Route to appropriate parser based on question type
    switch (this.getQuestionType(questionId)) {
      case 'goal':
        return this.parseGoal(cleanText);
      case 'activity':
        return this.parseActivityLevel(cleanText);
      case 'availability':
        return this.parseAvailability(cleanText);
      case 'setup':
        return this.parseWorkoutSetup(cleanText);
      case 'diet':
        return this.parseDietPreference(cleanText);
      case 'injury':
        return this.parseInjuryFlag(cleanText);
      case 'measurement':
        return this.parseMeasurement(questionId, cleanText);
      case 'demographics':
        return this.parseDemographics(questionId, cleanText);
      default:
        return this.parseGeneric(questionId, cleanText);
    }
  }

  /**
   * Parse fitness goals with high confidence for exact matches
   */
  parseGoal(text) {
    const scores = {};
    
    // Score each goal based on keyword matches
    for (const [goal, keywords] of Object.entries(this.goalKeywords)) {
      scores[goal] = this.calculateKeywordScore(text, keywords);
    }

    const bestMatch = this.getBestMatch(scores);
    
    if (bestMatch.score >= 0.7) {
      return {
        field: 'primary_goal',
        value: bestMatch.key,
        extras: {
          detected_keywords: this.getMatchedKeywords(text, this.goalKeywords[bestMatch.key]),
          alternative_goals: this.getAlternatives(scores, bestMatch.key, 0.3)
        },
        confidence: Math.min(0.95, bestMatch.score),
        parser_version: this.version
      };
    }

    // Check for explicit multi-intent patterns first
    const multiIntentPatterns = /\b(but also|and also|both|as well as|but)\b/i;
    const hasMultiIntentPattern = multiIntentPatterns.test(text);
    
    // Handle multi-goal responses
    const multiGoals = Object.entries(scores).filter(([_, score]) => score > 0.3);
    if (multiGoals.length > 1 || hasMultiIntentPattern) {
      return {
        field: 'primary_goal',
        value: multiGoals.length > 0 ? multiGoals[0][0] : 'lose_fat', // Take highest scoring or default
        extras: {
          multi_intent_detected: true,
          all_detected_goals: multiGoals.map(([goal, score]) => ({ goal, score })),
          requires_clarification: true,
          multi_intent_pattern: hasMultiIntentPattern
        },
        confidence: 0.4, // Low confidence for multi-intent
        parser_version: this.version
      };
    }

    return this.createLowConfidenceResponse('primary_goal', null, 0.2, 'No clear goal detected');
  }

  /**
   * Parse activity level with numeric pattern recognition
   */
  parseActivityLevel(text) {
    // Look for specific numeric patterns first
    const weeklyPatterns = [
      { regex: /(\d+)\s*(?:x|times?)\s*(?:per\s*)?week/i, field: 'sessions_per_week' },
      { regex: /(\d+)\s*(?:days?)\s*(?:per\s*)?week/i, field: 'days_per_week' },
      { regex: /(\d+)-(\d+)\s*(?:times?|days?)\s*(?:per\s*)?week/i, field: 'range_per_week' }
    ];

    for (const pattern of weeklyPatterns) {
      const match = text.match(pattern.regex);
      if (match) {
        const frequency = pattern.field === 'range_per_week' 
          ? (parseInt(match[1]) + parseInt(match[2])) / 2 
          : parseInt(match[1]);
        
        const activityLevel = this.frequencyToActivityLevel(frequency);
        return {
          field: 'activity_level',
          value: activityLevel,
          extras: {
            extracted_frequency: frequency,
            pattern_matched: pattern.field,
            raw_match: match[0]
          },
          confidence: 0.9,
          parser_version: this.version
        };
      }
    }

    // Fall back to keyword matching
    const scores = {};
    for (const [level, keywords] of Object.entries(this.activityKeywords)) {
      scores[level] = this.calculateKeywordScore(text, keywords);
    }

    const bestMatch = this.getBestMatch(scores);
    if (bestMatch.score >= 0.5) {
      return {
        field: 'activity_level',
        value: bestMatch.key,
        extras: {
          detected_keywords: this.getMatchedKeywords(text, this.activityKeywords[bestMatch.key])
        },
        confidence: bestMatch.score * 0.8, // Slightly lower for keyword-only
        parser_version: this.version
      };
    }

    return this.createLowConfidenceResponse('activity_level', null, 0.3, 'Ambiguous activity description');
  }

  /**
   * Parse availability with time and day extraction
   */
  parseAvailability(text) {
    const result = {
      field: 'availability',
      value: null,
      extras: {},
      confidence: 0.0,
      parser_version: this.version
    };

    // Extract time duration
    let timeMinutes = null;
    let timeConfidence = 0.0;

    for (const pattern of this.timePatterns) {
      const match = text.match(pattern.regex);
      if (match) {
        const value = parseFloat(match[1]);
        timeMinutes = pattern.multiplier ? value * pattern.multiplier : value;
        timeConfidence = 0.9;
        result.extras.time_extracted = `${timeMinutes} minutes`;
        result.extras.time_pattern = match[0];
        break;
      }
    }

    // Extract day preferences
    let dayPreference = null;
    let dayConfidence = 0.0;

    for (const [dayType, keywords] of Object.entries(this.dayPatterns)) {
      const score = this.calculateKeywordScore(text, keywords);
      if (score > dayConfidence) {
        dayPreference = dayType;
        dayConfidence = score;
      }
    }

    // Combine time and day information
    if (timeMinutes && timeMinutes > 0) {
      result.value = this.categorizeAvailability(timeMinutes, dayPreference);
      result.confidence = (timeConfidence + dayConfidence) / 2;
      
      if (dayPreference) {
        result.extras.day_preference = dayPreference;
        result.extras.day_confidence = dayConfidence;
      }
    } else if (dayPreference) {
      result.value = `${dayPreference}_schedule`;
      result.confidence = dayConfidence * 0.6; // Lower without time info
      result.extras.day_preference = dayPreference;
    } else {
      return this.createLowConfidenceResponse('availability', text, 0.2, 'No clear time or schedule pattern');
    }

    return result;
  }

  /**
   * Parse workout setup preferences
   */
  parseWorkoutSetup(text) {
    const scores = {};
    for (const [setup, keywords] of Object.entries(this.setupKeywords)) {
      scores[setup] = this.calculateKeywordScore(text, keywords);
    }

    const bestMatch = this.getBestMatch(scores);
    if (bestMatch.score >= 0.5) {
      return {
        field: 'workout_setup',
        value: bestMatch.key,
        extras: {
          detected_keywords: this.getMatchedKeywords(text, this.setupKeywords[bestMatch.key]),
          setup_confidence: bestMatch.score
        },
        confidence: bestMatch.score * 0.9,
        parser_version: this.version
      };
    }

    return this.createLowConfidenceResponse('workout_setup', null, 0.3, 'Unclear workout setup preference');
  }

  /**
   * Parse diet preferences
   */
  parseDietPreference(text) {
    const scores = {};
    for (const [diet, keywords] of Object.entries(this.dietKeywords)) {
      scores[diet] = this.calculateKeywordScore(text, keywords);
    }

    const bestMatch = this.getBestMatch(scores);
    if (bestMatch.score >= 0.6) {
      return {
        field: 'diet_pref',
        value: bestMatch.key,
        extras: {
          detected_keywords: this.getMatchedKeywords(text, this.dietKeywords[bestMatch.key])
        },
        confidence: bestMatch.score * 0.85,
        parser_version: this.version
      };
    }

    // Check for "no restrictions" patterns
    const noRestrictionPatterns = ['no', 'none', 'everything', 'anything', 'normal'];
    const noRestrictionScore = this.calculateKeywordScore(text, noRestrictionPatterns);
    
    if (noRestrictionScore >= 0.5) {
      return {
        field: 'diet_pref',
        value: 'omnivore',
        extras: {
          no_restrictions_detected: true,
          confidence_basis: 'no_restriction_pattern'
        },
        confidence: 0.8,
        parser_version: this.version
      };
    }

    return this.createLowConfidenceResponse('diet_pref', null, 0.2, 'No clear diet preference detected');
  }

  /**
   * Parse injury flag with safety keyword detection
   */
  parseInjuryFlag(text) {
    // Check for explicit "no" responses first
    const noPatterns = ['no', 'none', 'nothing', 'nope', 'not really', 'no injuries', 'healthy', 'horse'];
    const noScore = this.calculateKeywordScore(text, noPatterns);
    
    // Also check for direct negation patterns (but exclude if injury words are present)
    const negationPatterns = /\b(no|none|nothing|nope|healthy)\b/i;
    const hasNegation = negationPatterns.test(text);
    const hasInjuryWords = this.getMatchedKeywords(text, this.injuryKeywords).length > 0;
    
    if ((noScore >= 0.6 || (hasNegation && text.length < 30)) && !hasInjuryWords) {
      return {
        field: 'injury_flag',
        value: false,
        extras: {
          explicit_no_detected: true,
          no_keywords: this.getMatchedKeywords(text, noPatterns),
          negation_pattern: hasNegation
        },
        confidence: hasNegation ? 0.95 : noScore + 0.1,
        parser_version: this.version
      };
    }

    // Check for injury keywords
    const injuryScore = this.calculateKeywordScore(text, this.injuryKeywords);
    const matchedInjuries = this.getMatchedKeywords(text, this.injuryKeywords);

    if (injuryScore >= 0.3 || matchedInjuries.length > 0) {
      return {
        field: 'injury_flag',
        value: true,
        extras: {
          detected_injuries: matchedInjuries,
          injury_details: text, // Store full text for review
          safety_alert: injuryScore >= 0.7,
          severity_score: injuryScore
        },
        confidence: Math.min(0.9, Math.max(0.6, injuryScore + 0.3)),
        parser_version: this.version
      };
    }

    // Ambiguous response
    return {
      field: 'injury_flag',
      value: null,
      extras: {
        ambiguous_response: true,
        raw_text: text,
        requires_clarification: true
      },
      confidence: 0.3,
      parser_version: this.version
    };
  }

  /**
   * Parse measurements (weight, height)
   */
  parseMeasurement(questionId, text) {
    const field = questionId.includes('weight') ? 'weight' : 
                  questionId.includes('height') ? 'height' : 'measurement';

    if (field === 'weight') {
      return this.parseWeight(text);
    } else if (field === 'height') {
      return this.parseHeight(text);
    }

    // Handle direct numeric responses for measurements
    const numberMatch = text.match(/(\d+(?:\.\d+)?)/);
    if (numberMatch) {
      return {
        field: field,
        value: parseFloat(numberMatch[1]),
        extras: {
          direct_numeric_parse: true,
          requires_unit_confirmation: true
        },
        confidence: 0.9,
        parser_version: this.version
      };
    }

    return this.createLowConfidenceResponse(field, null, 0.1, 'Unknown measurement type');
  }

  /**
   * Parse weight with unit detection
   */
  parseWeight(text) {
    const patterns = [
      { regex: /(\d+(?:\.\d+)?)\s*(?:kg|kgs|kilos?|kilograms?)/i, unit: 'kg', multiplier: 1 },
      { regex: /(\d+(?:\.\d+)?)\s*(?:lb|lbs|pounds?)/i, unit: 'kg', multiplier: 0.453592 },
      { regex: /(\d+(?:\.\d+)?)\s*(?:st|stone)(?:\s*(\d+(?:\.\d+)?))?/i, unit: 'kg', multiplier: 6.35029 }
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern.regex);
      if (match) {
        let weight = parseFloat(match[1]) * pattern.multiplier;
        
        // Handle stone + pounds (e.g., "12 stone 5" means 12 stone + 5 pounds)
        if (match[0].includes('stone') && match[2]) {
          const stones = parseFloat(match[1]);
          const pounds = parseFloat(match[2]);
          weight = stones * 6.35029 + pounds * 0.453592;
        }

        // Sanity check (reasonable human weight range)
        if (weight >= 30 && weight <= 300) {
          return {
            field: 'weight',
            value: Math.round(weight * 10) / 10, // Round to 1 decimal
            extras: {
              original_value: match[1],
              original_unit: pattern.unit,
              raw_match: match[0],
              converted_to_kg: true
            },
            confidence: 0.95,
            parser_version: this.version
          };
        }
      }
    }

    // Try to extract just numbers if no unit found
    const numberMatch = text.match(/(\d+(?:\.\d+)?)/);
    if (numberMatch) {
      const value = parseFloat(numberMatch[1]);
      // Assume kg if reasonable range, lbs if higher
      const assumedKg = value <= 150 ? value : value * 0.453592;
      
      if (assumedKg >= 30 && assumedKg <= 300) {
        return {
          field: 'weight',
          value: Math.round(assumedKg * 10) / 10,
          extras: {
            original_value: value,
            unit_assumed: value <= 150 ? 'kg' : 'lbs',
            requires_unit_confirmation: true
          },
          confidence: 0.6, // Lower confidence without explicit unit
          parser_version: this.version
        };
      }
    }

    return this.createLowConfidenceResponse('weight', null, 0.2, 'No valid weight pattern detected');
  }

  /**
   * Parse height with multiple unit systems
   */
  parseHeight(text) {
    const patterns = [
      { regex: /(\d+(?:\.\d+)?)\s*(?:cm|centimeter|centimetre)/i, unit: 'cm', multiplier: 1 },
      { regex: /(\d+(?:\.\d+)?)\s*(?:m|meter|metre)/i, unit: 'cm', multiplier: 100 },
      { regex: /(\d+)[\s']*(?:ft|feet|foot)[\s,]*(\d+)[\s"]*(?:in|inch|inches)?/i, unit: 'cm', multiplier: 30.48 },
      { regex: /(\d+)[''](\d+)["]?/i, unit: 'cm', multiplier: 30.48 }, // 5'9" format
      { regex: /(\d+)[\s"]*(?:in|inch|inches)/i, unit: 'cm', multiplier: 2.54 }
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern.regex);
      if (match) {
        let height;
        
        if (pattern.multiplier === 30.48 && match[2]) { // feet + inches
          height = parseInt(match[1]) * 30.48 + parseInt(match[2]) * 2.54;
        } else {
          height = parseFloat(match[1]) * pattern.multiplier;
        }

        // Sanity check (reasonable human height range)
        if (height >= 100 && height <= 250) {
          return {
            field: 'height',
            value: Math.round(height),
            extras: {
              original_value: match[0],
              converted_to_cm: true,
              raw_match: match[0]
            },
            confidence: 0.95,
            parser_version: this.version
          };
        }
      }
    }

    return this.createLowConfidenceResponse('height', null, 0.2, 'No valid height pattern detected');
  }

  /**
   * Parse demographics (age, sex, name)
   */
  parseDemographics(questionId, text) {
    if (questionId.includes('sex') || questionId.includes('gender')) {
      return this.parseSex(text);
    } else if (questionId.includes('age') || questionId.includes('dob')) {
      return this.parseAge(text);
    } else if (questionId.includes('name')) {
      return this.parseName(text);
    }

    return this.createLowConfidenceResponse('demographics', text, 0.5, 'Generic demographic parsing');
  }

  /**
   * Parse biological sex
   */
  parseSex(text) {
    const patterns = {
      male: ['male', 'man', 'boy', 'm', 'masculine', 'guy'],
      female: ['female', 'woman', 'girl', 'f', 'feminine', 'lady'],
      other: ['other', 'non-binary', 'nb', 'prefer not to say', 'trans', 'transgender']
    };

    for (const [sex, keywords] of Object.entries(patterns)) {
      const score = this.calculateKeywordScore(text, keywords);
      if (score >= 0.7) {
        return {
          field: 'sex',
          value: sex,
          extras: {
            matched_keywords: this.getMatchedKeywords(text, keywords)
          },
          confidence: score,
          parser_version: this.version
        };
      }
    }

    return this.createLowConfidenceResponse('sex', null, 0.2, 'No clear sex/gender indication');
  }

  /**
   * Parse name (simple validation)
   */
  parseName(text) {
    const cleanName = text.trim().replace(/[^\w\s-']/g, '');
    
    if (cleanName.length >= 2 && cleanName.length <= 50) {
      return {
        field: 'name',
        value: cleanName,
        extras: {
          original_text: text,
          cleaned: cleanName !== text
        },
        confidence: 0.9,
        parser_version: this.version
      };
    }

    return this.createLowConfidenceResponse('name', cleanName, 0.3, 'Name validation failed');
  }

  // Helper methods

  /**
   * Calculate keyword matching score
   */
  calculateKeywordScore(text, keywords) {
    let score = 0;
    let matchCount = 0;
    let maxKeywordScore = 0;
    
    for (const keyword of keywords) {
      if (text.includes(keyword.toLowerCase())) {
        matchCount++;
        // Score based on keyword length and position
        const keywordScore = Math.min(1.0, keyword.length / 15 + 0.6);
        score += keywordScore;
        maxKeywordScore = Math.max(maxKeywordScore, keywordScore);
      }
    }

    if (matchCount === 0) return 0;

    // Use the best match as base, boost for multiple matches
    const multiMatchBonus = Math.min(0.2, (matchCount - 1) * 0.1);
    const finalScore = maxKeywordScore + multiMatchBonus;
    
    return Math.min(1.0, finalScore);
  }

  /**
   * Get best matching key from scores
   */
  getBestMatch(scores) {
    let bestKey = null;
    let bestScore = 0;

    for (const [key, score] of Object.entries(scores)) {
      if (score > bestScore) {
        bestScore = score;
        bestKey = key;
      }
    }

    return { key: bestKey, score: bestScore };
  }

  /**
   * Get matched keywords for debugging
   */
  getMatchedKeywords(text, keywords) {
    return keywords.filter(keyword => text.includes(keyword.toLowerCase()));
  }

  /**
   * Get alternative matches above threshold
   */
  getAlternatives(scores, excludeKey, threshold) {
    return Object.entries(scores)
      .filter(([key, score]) => key !== excludeKey && score >= threshold)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
  }

  /**
   * Convert exercise frequency to activity level
   */
  frequencyToActivityLevel(frequency) {
    if (frequency <= 1) return 'lightly_active';
    if (frequency <= 3) return 'moderately_active';
    if (frequency <= 5) return 'very_active';
    return 'extremely_active';
  }

  /**
   * Categorize availability based on time and days
   */
  categorizeAvailability(minutes, dayType) {
    const timeCategory = minutes < 30 ? 'short' : 
                        minutes < 60 ? 'medium' : 'long';
    
    if (dayType) {
      return `${timeCategory}_${dayType}`;
    }
    
    return `${timeCategory}_sessions`;
  }

  /**
   * Infer question type from question ID
   */
  getQuestionType(questionId) {
    const id = questionId.toLowerCase();
    if (id.includes('goal')) return 'goal';
    if (id.includes('activity')) return 'activity';
    if (id.includes('availability')) return 'availability';
    if (id.includes('setup') || id.includes('workout')) return 'setup';
    if (id.includes('diet')) return 'diet';
    if (id.includes('injury')) return 'injury';
    if (id.includes('weight')) return 'measurement';
    if (id.includes('height')) return 'measurement';
    if (id.includes('name') || id.includes('sex') || id.includes('age') || id.includes('dob')) return 'demographics';
    return 'generic';
  }

  /**
   * Generic parsing fallback
   */
  parseGeneric(questionId, text) {
    return {
      field: questionId.replace('_v1', '').replace('_v2', ''),
      value: text,
      extras: {
        generic_parsing: true,
        needs_manual_review: true
      },
      confidence: 0.5,
      parser_version: this.version
    };
  }

  /**
   * Create low confidence response
   */
  createLowConfidenceResponse(field, value, confidence, reason) {
    return {
      field,
      value,
      extras: {
        low_confidence_reason: reason,
        requires_clarification: true,
        parsing_failed: true
      },
      confidence,
      parser_version: this.version
    };
  }

  /**
   * Get parser version and capabilities
   */
  getCapabilities() {
    return {
      version: this.version,
      supported_fields: [
        'primary_goal', 'activity_level', 'availability', 'workout_setup',
        'diet_pref', 'injury_flag', 'weight', 'height', 'sex', 'name'
      ],
      confidence_thresholds: {
        high: 0.8,
        medium: 0.6,
        low: 0.4,
        requires_clarification: 0.3
      },
      features: [
        'keyword_mapping', 'regex_extraction', 'unit_conversion',
        'multi_intent_detection', 'safety_keyword_detection',
        'confidence_scoring', 'alternative_suggestions'
      ]
    };
  }
}

module.exports = RuleBasedParser;