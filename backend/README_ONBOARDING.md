# AI Lifestyle Coach - Onboarding System

## Overview

The onboarding system provides a conversational AI-driven experience to collect user information and generate personalized health and fitness plans. The system uses a canonical question set with versioning, safety checks, and confidence thresholds.

## Architecture

### Core Components

1. **OnboardingConfigService** - Manages question definitions, validation, and conditional logic
2. **OnboardingAIService** - Handles AI-powered conversational flow and response generation
3. **Onboarding Routes** - REST API endpoints for client interaction
4. **Configuration Files** - Centralized settings and question definitions

### File Structure

```
backend/
├── config/
│   ├── onboarding-questions.json      # Canonical question set (v1)
│   ├── onboarding-config.yaml         # System configuration
│   ├── question-summary.csv           # Quick reference table
│   └── ONBOARDING_DECISION_DOC.md    # Decision documentation
├── services/
│   ├── OnboardingConfigService.js     # Question management
│   └── OnboardingAIService.js        # AI conversation handling
├── routes/
│   └── onboarding.js                 # API endpoints
└── test-onboarding-system.js         # Test suite
```

## Question Set (v1)

### Required Fields (9 total)
- `name_v1` - User's name
- `dob_v1` - Date of birth
- `sex_v1` - Biological sex
- `weight_v1` - Current weight
- `primary_goal_v1` - Primary fitness goal
- `activity_level_v1` - Current activity level
- `availability_v1` - Available workout time
- `workout_setup_v1` - Preferred workout location/equipment
- `injury_flag_v1` - Injury/limitation screening

### Optional Fields (7 total)
- `height_v1` - Height (recommended)
- `target_weight_v1` - Target weight (conditional)
- `injury_details_v1` - Injury details (conditional)
- `diet_pref_v1` - Dietary preferences
- `allergies_v1` - Food allergies
- `training_experience_v1` - Training experience level
- `preferred_tone_v1` - Communication style preference

## Configuration

### Confidence Thresholds
```yaml
confidence:
  threshold: 0.60          # Minimum confidence for responses
  high_threshold: 0.85     # Auto-action threshold
```

### Safety Thresholds
```yaml
safety:
  severity_threshold: 2    # Safety concern threshold (1-5 scale)
```

### Plan Generation Policy
```yaml
plan_generation:
  policy: "confirmation_required"  # Options: auto, confirmation_required, manual_trigger
  required_completion_percentage: 90
```

## API Endpoints

### POST /onboarding/start
Start a new onboarding session.

**Request:**
```json
{
  "userName": "John Doe"
}
```

**Response:**
```json
{
  "success": true,
  "session_id": "user_123",
  "welcome_message": "Hello John! I'm your AI Lifestyle Coach...",
  "question": {
    "id": "name_v1",
    "message": "What's your name?",
    "type": "text",
    "required": true
  },
  "progress": {
    "completion_percentage": 0,
    "total_questions": 16,
    "answered": 0
  }
}
```

### POST /onboarding/answer
Submit an answer to the current question.

**Request:**
```json
{
  "answer": "John Doe",
  "skip": false
}
```

**Response:**
```json
{
  "success": true,
  "acknowledgment": "Thank you, John! This helps me personalize your plan.",
  "question": {
    "id": "dob_v1",
    "message": "What's your date of birth?",
    "type": "date",
    "required": true
  },
  "progress": {
    "completion_percentage": 6,
    "answered": 1
  }
}
```

### GET /onboarding/status
Get current onboarding status.

**Response:**
```json
{
  "active": true,
  "completed": false,
  "progress": {
    "completion_percentage": 75,
    "answered_questions": 12,
    "total_questions": 16
  },
  "ready_for_plan": false,
  "current_question": {
    "id": "diet_pref_v1",
    "message": "Do you follow any specific diet?",
    "type": "multiple_choice",
    "options": ["none", "vegetarian", "vegan", "keto", "paleo"]
  }
}
```

### POST /onboarding/generate-plan
Generate personalized plan after completion.

**Response:**
```json
{
  "success": true,
  "message": "Plan generation started",
  "plan_id": "plan_user123_1634567890",
  "estimated_completion": "2025-09-24T15:30:00Z"
}
```

## Safety Features

### Safety Keyword Detection
The system monitors for safety-related keywords in user responses:
- Medical conditions: "heart condition", "diabetes", "pregnancy"
- Physical issues: "surgery", "chronic", "severe pain"
- Allergies: "anaphylaxis", "epipen"

### Safety Response Levels
- **Level 1**: Minor - No action needed
- **Level 2**: Moderate - Flag for review (threshold)
- **Level 3**: Significant - Human review required
- **Level 4**: High Risk - Medical consultation recommended
- **Level 5**: Critical - Immediate medical attention

### Safety Fields
Questions with `safety_flag: true`:
- `injury_details_v1` - Injury descriptions
- `allergies_v1` - Food allergies and intolerances

## Conditional Logic

Questions can be shown conditionally based on previous answers:

```json
{
  "id": "target_weight_v1",
  "conditional": {
    "show_if": "primary_goal_v1 == 'weight_loss' || primary_goal_v1 == 'muscle_gain'"
  }
}
```

## Validation Rules

### Text Fields
- Minimum/maximum length
- Pattern matching (regex)
- Required field validation

### Numeric Fields
- Min/max value constraints
- Type validation
- Unit specification

### Date Fields
- Age range validation
- Format validation

### Choice Fields
- Option validation
- Multiple selection support

## Testing

Run the test suite:
```bash
node test-onboarding-system.js
```

Test categories:
- Complete onboarding flow
- Validation scenarios
- Safety flag detection
- Conditional logic
- Error handling

## Installation

1. Install dependencies:
```bash
npm install yaml
```

2. Start the server:
```bash
npm run dev
```

3. Test the endpoints:
```bash
node test-onboarding-system.js
```

## Deployment Checklist

### Pre-Production
- [ ] Product team sign-off on question set
- [ ] Technical review of thresholds
- [ ] Security audit of safety features
- [ ] Performance testing with load
- [ ] A/B testing of question variations

### Production Setup
- [ ] Replace in-memory sessions with Redis
- [ ] Set up monitoring for safety flags
- [ ] Configure logging for compliance
- [ ] Set up alerts for system errors
- [ ] Deploy with gradual rollout

### Post-Deployment
- [ ] Monitor completion rates
- [ ] Track safety flag frequency
- [ ] Analyze user drop-off points
- [ ] Collect user satisfaction feedback
- [ ] Adjust thresholds based on data

## Future Enhancements

### Phase 2 Features
- Multi-language support
- Voice input/output
- Progress saving across devices
- Advanced conditional logic
- Machine learning for personalization

### Integration Points
- Plan generation service
- User profile management
- Progress tracking system
- Notification service
- Analytics platform

## Support

For questions or issues:
1. Check the decision document: `ONBOARDING_DECISION_DOC.md`
2. Review test cases: `test-onboarding-system.js`
3. Monitor system logs for errors
4. Contact the development team

---

**Version:** 1.0.0  
**Last Updated:** September 24, 2025  
**Maintained by:** AI Lifestyle Coach Development Team