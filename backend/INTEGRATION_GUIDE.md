# Onboarding Session State Machine & Readiness Integration

This document explains how the onboarding session state machine and readiness checker are integrated with the existing API endpoints.

## Overview

The system now automatically tracks session states and determines readiness for plan generation after each response is submitted. This enables real-time feedback and automated plan generation triggers.

## Architecture

```
User Response → API Endpoint → Parse Response → Save to DB → Check Readiness → Update State → Return Response
```

## Key Components

### 1. Session States
- **in_progress**: Session is active, collecting responses
- **awaiting_clarification**: Needs user clarification on responses
- **completed**: Ready for plan generation or plan generated
- **abandoned**: Session inactive for extended period

### 2. Readiness Checker Integration

The `OnboardingReadinessChecker` is integrated into the response submission endpoint (`POST /session/:id/response`) and automatically:

1. Analyzes session readiness after each response
2. Updates session state based on readiness analysis
3. Returns readiness information with the response
4. Triggers plan generation when ready (if auto-trigger enabled)

### 3. Response Payload Enhancement

When a response is submitted, the API now returns additional readiness information:

```json
{
  "saved_response_id": "uuid",
  "parsed_value": "parsed answer",
  "parsed_confidence": 0.85,
  "requires_clarification": false,
  "session_status": "in_progress",
  "ready_for_plan": false,
  "readiness_analysis": {
    "confidence_score": 0.72,
    "missing_fields": ["target_weight", "dietary_restrictions"],
    "safety_risk": "low"
  }
}
```

## Implementation Details

### Modified Endpoint: POST /session/:id/response

After successful response insertion, the endpoint now:

1. Calls `readinessChecker.onResponseAdded(sessionId)`
2. Includes readiness analysis in the response payload
3. Handles readiness check errors gracefully (doesn't fail response insertion)

### Error Handling

- Readiness check errors are logged but don't affect response insertion
- If readiness check fails, the response is still saved successfully
- Frontend can still function without readiness information

### Performance Considerations

- Readiness check is asynchronous and doesn't block response insertion
- Database queries are optimized with proper indexing
- Safety analysis uses efficient keyword matching

## API Endpoints

### Enhanced Response Submission
```http
POST /api/onboarding/session/{id}/response
```
Now includes readiness information in response.

### Dedicated Readiness Endpoints
```http
GET /api/readiness/session/{id}           # Check session readiness
POST /api/readiness/session/{id}/ready    # Force session ready
POST /api/readiness/session/{id}/abandon  # Mark session abandoned
GET /api/readiness/status-summary         # System-wide status
```

## Testing

Run the integration test to verify the system works end-to-end:

```bash
npm run test:integration
```

This test:
1. Creates a new onboarding session
2. Submits multiple responses
3. Verifies readiness information is returned after each response
4. Checks final session readiness state

## Usage Examples

### Frontend Integration

```javascript
// Submit a response and get readiness info
const response = await fetch('/api/onboarding/session/{id}/response', {
  method: 'POST',
  body: JSON.stringify({
    question_id: 'goal',
    question_text: 'What is your fitness goal?',
    raw_answer_text: 'I want to lose weight',
    timestamp: new Date().toISOString()
  })
});

const result = await response.json();

// Check if session is ready for plan generation
if (result.ready_for_plan) {
  // Trigger plan generation UI
  showPlanGenerationButton();
}

// Show progress feedback
updateProgressBar(result.readiness_analysis.confidence_score);
```

### Automated Plan Generation

When a session becomes ready (`ready_for_plan: true`), the system can automatically:

1. Generate a fitness plan using the collected data
2. Send notification to the user
3. Update session status to 'completed'

## Configuration

Readiness thresholds can be configured in `config/onboarding-config.yaml`:

```yaml
readiness_thresholds:
  minimum_confidence: 0.7
  required_fields_threshold: 0.8
  auto_trigger_plan_generation: true
  
safety_analysis:
  high_risk_keywords: ["injury", "medical condition", "pain"]
  medium_risk_keywords: ["sore", "tired", "uncomfortable"]
```

## Monitoring

The system logs readiness checks for monitoring:

```
Session abc123 readiness check: {
  status: 'in_progress',
  readyForPlan: false,
  analysis: { overallConfidence: 0.65, ... }
}
```

Monitor these logs to track session progression and identify issues.