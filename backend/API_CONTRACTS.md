# AI Lifestyle Coach - API Documentation

## Overview

This document provides comprehensive API contracts for the onboarding and plan generation system. These endpoints enable seamless integration between frontend and backend teams.

## Base URL
```
Production: https://api.ai-lifestyle-coach.com
Development: http://localhost:5000
```

## Authentication
All endpoints require Bearer token authentication:
```
Authorization: Bearer <firebase_jwt_token>
```

---

## Onboarding API Endpoints

### 1. Start Onboarding Session

**Endpoint:** `POST /onboarding/session/start`

**Description:** Initializes a new onboarding session with optional pre-filled profile data.

**Request Body:**
```json
{
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "source": "widget",
  "initial_profile": {
    "name": "Pratik",
    "dob": "1999-05-01",
    "sex": "male",
    "weight_kg": 85,
    "height_cm": 170
  }
}
```

**Request Schema:**
- `user_id` (string, UUID, required): User identifier
- `source` (string, optional): Source of onboarding session
  - Values: `"widget"`, `"app"`, `"web"`
  - Default: `"app"`
- `initial_profile` (object, optional): Pre-filled profile data
  - `name` (string, 2-50 chars)
  - `dob` (string, ISO date)
  - `sex` (string): `"male"`, `"female"`, `"other"`
  - `weight_kg` (number, 30-300)
  - `height_cm` (number, 100-250)

**Response (201 Created):**
```json
{
  "session_id": "660e8400-e29b-41d4-a716-446655440001",
  "status": "in_progress",
  "missing_required": ["primary_goal", "activity_level", "availability"]
}
```

**Response Schema:**
- `session_id` (string, UUID): Unique session identifier
- `status` (string): Session status (`"in_progress"`, `"completed"`, `"abandoned"`)
- `missing_required` (array): List of required field IDs still needed

**Error Responses:**
- `400 Bad Request`: Invalid request data
- `500 Internal Server Error`: Server error

---

### 2. Submit Question Response

**Endpoint:** `POST /onboarding/session/:id/response`

**Description:** Submits a user's answer to an onboarding question with AI-powered parsing.

**Request Body:**
```json
{
  "session_id": "660e8400-e29b-41d4-a716-446655440001",
  "question_id": "primary_goal_v1",
  "question_text": "What's your main goal?",
  "raw_answer_text": "I want to lose fat and look toned",
  "timestamp": "2025-09-24T14:00:00Z"
}
```

**Request Schema:**
- `session_id` (string, UUID, required): Session identifier
- `question_id` (string, required): Question identifier (e.g., `"primary_goal_v1"`)
- `question_text` (string, required): The actual question presented to user
- `raw_answer_text` (string, required): User's unprocessed response
- `timestamp` (string, ISO datetime, optional): When response was given

**Response (201 Created):**
```json
{
  "saved_response_id": "770e8400-e29b-41d4-a716-446655440002",
  "parsed_value": {
    "field": "primary_goal",
    "value": "weight_loss",
    "extras": {
      "tone": "toned"
    }
  },
  "parsed_confidence": 0.88,
  "requires_clarification": false
}
```

**Response Schema:**
- `saved_response_id` (string, UUID): Unique response record ID
- `parsed_value` (object): Structured data extracted from raw answer
  - `field` (string): Canonical field name
  - `value` (any): Parsed primary value
  - `extras` (object): Additional extracted information
- `parsed_confidence` (number, 0-1): AI confidence in parsing accuracy
- `requires_clarification` (boolean): Whether response needs clarification

**Low Confidence Response:**
```json
{
  "saved_response_id": "770e8400-e29b-41d4-a716-446655440002",
  "parsed_value": null,
  "parsed_confidence": 0.45,
  "requires_clarification": true,
  "retry_message": "I'm not quite sure I understood. Could you tell me more specifically about your fitness goal?"
}
```

---

### 3. Get Session Status

**Endpoint:** `GET /onboarding/session/:id/status`

**Description:** Retrieves current onboarding session progress and status.

**Response (200 OK):**
```json
{
  "status": "in_progress",
  "progress": {
    "total_questions": 16,
    "answered_questions": 8,
    "completion_percentage": 50
  },
  "missing_required": ["availability", "workout_setup"],
  "next_suggested_question": {
    "question_id": "availability_v1",
    "question_text": "How much time can you dedicate to workouts per day?",
    "type": "single_choice",
    "options": ["15_minutes", "30_minutes", "45_minutes", "60_minutes"],
    "required": true
  },
  "recent_responses": [
    {
      "question_id": "activity_level_v1",
      "raw_answer_text": "I'm moderately active",
      "parsed_confidence": 0.92,
      "requires_clarification": false,
      "answered_at": "2025-09-24T13:45:00Z"
    }
  ]
}
```

**Response Schema:**
- `status` (string): Session status
- `progress` (object): Progress information
  - `total_questions` (number): Total questions in onboarding
  - `answered_questions` (number): Questions answered so far
  - `completion_percentage` (number): Percentage complete (0-100)
- `missing_required` (array): Required fields still needed
- `next_suggested_question` (object, nullable): Recommended next question
  - `question_id` (string): Question identifier
  - `question_text` (string): Question to ask user
  - `type` (string): Question type
  - `options` (array, optional): Available options for choice questions
  - `required` (boolean): Whether question is required
- `recent_responses` (array): Last 5 responses with metadata

---

### 4. Provide Clarification

**Endpoint:** `POST /onboarding/session/:id/clarify`

**Description:** Provides additional clarification for a previous low-confidence response.

**Request Body:**
```json
{
  "original_response_id": "770e8400-e29b-41d4-a716-446655440002",
  "clarification_text": "I specifically want to lose 10kg of body fat while maintaining muscle mass",
  "timestamp": "2025-09-24T14:05:00Z"
}
```

**Request Schema:**
- `original_response_id` (string, UUID, required): ID of response being clarified
- `clarification_text` (string, required): Additional clarification
- `timestamp` (string, ISO datetime, optional): When clarification was provided

**Response (201 Created):**
```json
{
  "clarification_response_id": "880e8400-e29b-41d4-a716-446655440003",
  "parsed_value": {
    "field": "primary_goal",
    "value": "weight_loss",
    "extras": {
      "target_amount": "10kg",
      "preserve_muscle": true
    }
  },
  "parsed_confidence": 0.95,
  "requires_clarification": false
}
```

---

## Plan Generation API

### 5. Generate Plan

**Endpoint:** `POST /plans/generate`

**Description:** Generates a personalized plan based on onboarding data with safety and quality checks.

**Request Body:**
```json
{
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "session_id": "660e8400-e29b-41d4-a716-446655440001",
  "force": false
}
```

**Request Schema:**
- `user_id` (string, UUID, required): User identifier
- `session_id` (string, UUID, required): Completed onboarding session ID
- `force` (boolean, optional): Bypass safety/quality checks
  - Default: `false`

**Success Response (202 Accepted):**
```json
{
  "status": "queued",
  "plan_id": "990e8400-e29b-41d4-a716-446655440004",
  "message": "Plan generation has been queued",
  "estimated_completion": "2025-09-24T14:10:00Z"
}
```

**Rejection Response (400 Bad Request):**

*Missing Required Fields:*
```json
{
  "status": "rejected",
  "reason": "missing_required",
  "details": {
    "missing_fields": ["primary_goal", "activity_level"],
    "message": "Missing 2 required field(s)"
  }
}
```

*Low Confidence Responses:*
```json
{
  "status": "rejected",
  "reason": "low_confidence",
  "details": {
    "low_confidence_responses": [
      {
        "question_id": "diet_pref_v1",
        "confidence": 0.45,
        "raw_answer": "I eat whatever"
      }
    ],
    "message": "1 response(s) have low confidence"
  }
}
```

*Safety Concerns:*
```json
{
  "status": "rejected",
  "reason": "safety_concerns",
  "details": {
    "safety_issues": [
      {
        "question_id": "injury_details_v1",
        "concerns": [
          {
            "keyword": "heart condition",
            "severity": 4,
            "recommendation": "Please consult with your cardiologist before starting any exercise program."
          }
        ],
        "raw_answer": "I have a heart condition"
      }
    ],
    "message": "1 response(s) require safety review"
  }
}
```

*Session Incomplete:*
```json
{
  "status": "rejected",
  "reason": "session_incomplete",
  "details": {
    "session_status": "in_progress",
    "missing_required": ["availability", "workout_setup"]
  }
}
```

---

## Profile Management API

### 6. Confirm Onboarding

**Endpoint:** `PATCH /profiles/:id/confirm-onboarding`

**Description:** User accepts parsed values and marks onboarding as complete.

**Request Body:**
```json
{
  "session_id": "660e8400-e29b-41d4-a716-446655440001",
  "accepted_values": {
    "name_v1": {"value": "Pratik"},
    "primary_goal_v1": {"value": "weight_loss"},
    "activity_level_v1": {"value": "moderately_active"},
    "injury_flag_v1": {"value": false}
  },
  "confirmation_timestamp": "2025-09-24T14:15:00Z"
}
```

**Request Schema:**
- `session_id` (string, UUID, optional): Session being confirmed
- `accepted_values` (object, required): User-approved parsed values
- `confirmation_timestamp` (string, ISO datetime, optional): When user confirmed

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Onboarding confirmed and profile updated successfully",
  "profile_updated": true,
  "onboarding_complete": true,
  "safety_review_required": false
}
```

---

## Behavioral Rules

### Data Persistence
1. **Never overwrite `raw_answer_text`** - Always preserve original user input
2. **Atomic transactions** - Response insertion and session updates must be in single transaction
3. **Audit trail** - All responses are timestamped and traceable
4. **Soft deletes** - Never hard delete user data

### Confidence Handling
1. **Threshold enforcement** - Responses below `CONF_THRESHOLD` (0.60) require clarification
2. **Progressive clarification** - Allow multiple clarification attempts
3. **Confidence scoring** - AI provides 0-1 confidence scores for all parsing

### Safety Processing
1. **Keyword detection** - Automatic flagging of medical/safety keywords
2. **Severity assessment** - 1-5 scale severity scoring
3. **Review triggers** - Severity ≥ 2 requires human review
4. **Medical disclaimers** - Never provide medical advice

### Session Management
1. **Real-time updates** - `missing_required_fields` updated after each response
2. **Progress tracking** - Completion percentage calculated dynamically  
3. **Session timeout** - Inactive sessions expire after 24 hours
4. **Concurrent sessions** - Users can have only one active session

---

## Error Handling

### Standard Error Response Format
```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {
    "field": "specific_field",
    "message": "Detailed explanation"
  },
  "timestamp": "2025-09-24T14:00:00Z"
}
```

### Common Error Codes
- `VALIDATION_ERROR` - Request validation failed
- `SESSION_NOT_FOUND` - Session ID invalid or expired
- `USER_NOT_FOUND` - User ID not found
- `CONFIDENCE_TOO_LOW` - AI parsing confidence below threshold
- `SAFETY_REVIEW_REQUIRED` - Response triggered safety flags
- `RATE_LIMIT_EXCEEDED` - Too many requests
- `SERVER_ERROR` - Internal server error

---

## Rate Limiting

### Limits per User
- **Onboarding responses**: 60 per hour
- **Plan generation**: 5 per hour
- **Session creation**: 10 per hour

### Rate Limit Headers
```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1634567890
```

---

## Webhooks (Optional)

### Plan Generation Completion
**URL:** Client-provided webhook URL  
**Method:** POST  
**Payload:**
```json
{
  "event": "plan.completed",
  "plan_id": "990e8400-e29b-41d4-a716-446655440004",
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "active",
  "generated_at": "2025-09-24T14:08:30Z"
}
```

### Safety Review Required
**URL:** Admin webhook URL  
**Method:** POST  
**Payload:**
```json
{
  "event": "safety.review_required",
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "session_id": "660e8400-e29b-41d4-a716-446655440001",
  "severity": 3,
  "concerns": ["heart condition", "chronic pain"],
  "timestamp": "2025-09-24T14:00:00Z"
}
```

---

## SDK Examples

### JavaScript/TypeScript
```typescript
interface OnboardingClient {
  startSession(data: StartSessionRequest): Promise<StartSessionResponse>;
  submitResponse(sessionId: string, data: ResponseRequest): Promise<ResponseResponse>;
  getStatus(sessionId: string): Promise<StatusResponse>;
  clarifyResponse(sessionId: string, data: ClarifyRequest): Promise<ClarifyResponse>;
}

// Usage
const client = new OnboardingClient('https://api.ai-lifestyle-coach.com');
const session = await client.startSession({
  user_id: userId,
  source: 'widget',
  initial_profile: { name: 'John', weight_kg: 70 }
});
```

### Python
```python
class OnboardingClient:
    def start_session(self, data: dict) -> dict:
        response = requests.post(f"{self.base_url}/onboarding/session/start", 
                               json=data, headers=self.headers)
        return response.json()
    
    def submit_response(self, session_id: str, data: dict) -> dict:
        response = requests.post(f"{self.base_url}/onboarding/session/{session_id}/response",
                               json=data, headers=self.headers)
        return response.json()
```

---

## Testing

### Test User Accounts
- **Test User 1**: `test-user-1@example.com` (complete profile)
- **Test User 2**: `test-user-2@example.com` (partial profile)
- **Test User 3**: `test-user-3@example.com` (safety flags)

### Test Scenarios
1. **Happy Path**: Complete onboarding → Generate plan
2. **Low Confidence**: Provide ambiguous answers → Clarify → Complete
3. **Safety Triggers**: Mention medical conditions → Review required
4. **Partial Completion**: Answer some questions → Resume later

### Postman Collection
Import the provided Postman collection for comprehensive API testing:
`AI-Lifestyle-Coach-API.postman_collection.json`

---

## Monitoring & Analytics

### Key Metrics
- Session completion rate
- Average confidence scores
- Safety flag frequency
- Plan generation success rate
- Response time percentiles

### Health Check
**Endpoint:** `GET /health`
**Response:**
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "timestamp": "2025-09-24T14:00:00Z",
  "dependencies": {
    "database": "healthy",
    "ai_service": "healthy",
    "queue": "healthy"
  }
}
```

---

This API documentation provides complete contracts for seamless frontend-backend integration. All endpoints are implemented with proper validation, error handling, and documentation for production use.