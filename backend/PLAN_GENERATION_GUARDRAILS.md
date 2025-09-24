# Plan Generation with Safety Guardrails - Complete Integration Guide

This document explains the comprehensive plan generation system with safety guardrails, automatic triggers, and human review workflows.

## System Overview

The plan generation system creates personalized fitness and nutrition plans with comprehensive safety analysis and guardrails. It integrates with the onboarding session state machine to automatically trigger plan generation when users complete their onboarding.

## Architecture Flow

```
User Response → Parser → Database → Readiness Check → Plan Generation Trigger
                                                    ↓
                                           Safety Analysis ← Profile Data
                                                    ↓
                                           AI Plan Generation (LLM)
                                                    ↓
                                           Post-Processing Guardrails
                                                    ↓
                                           Plan Status Determination
                                                    ↓
                                    [Active Plan] or [Draft Plan + Safety Review]
```

## Key Components

### 1. Plan Generation Service (`services/PlanGenerationService.js`)

**Purpose**: Core service that generates plans with comprehensive safety guardrails

**Key Features**:
- Safety requirement analysis
- LLM-powered plan generation
- Post-processing safety filters
- Caloric limit enforcement
- Age-appropriate modifications
- Schedule constraint validation

**Safety Guardrails Applied**:
- **Guardian 1**: Remove high-risk exercises for injured users
- **Guardian 2**: Set conservative intensity for safety concerns
- **Guardian 3**: Add safety notes and warnings
- **Guardian 4**: Enforce caloric deficit/surplus limits (max 1% body weight/week)
- **Guardian 5**: Age-appropriate programming modifications

### 2. Enhanced Plan Generation Routes (`routes/plans-guardrails.js`)

**Key Endpoints**:
- `POST /api/plans/generate-with-guardrails` - Generate plan with full safety analysis
- `POST /api/plans/auto-generate` - Auto-generate when session ready
- `POST /api/plans/{id}/safety-review` - Complete safety review workflow

### 3. Automatic Plan Generation Integration

**Integration Point**: `routes/onboarding-api.js` - Response submission endpoint

**Trigger Logic**:
1. User submits response
2. Response is parsed and saved
3. Session readiness is checked
4. If session becomes ready AND auto-trigger enabled → Plan generation starts
5. Plan is generated asynchronously (non-blocking)

## Safety Analysis Levels

### Low Risk (Status: Active)
- No injuries or medical conditions
- Normal age range (16-65)
- No medications affecting exercise
- **Action**: Plan is immediately active

### Medium Risk (Status: Active with Notes)
- Minor injuries or conditions
- Age considerations (seniors/youth)
- Some medications
- **Action**: Plan active with safety notes and conservative modifications

### High Risk (Status: Draft)
- Serious injuries or medical conditions
- High-risk medications
- Multiple safety concerns
- **Action**: Plan requires human safety review before activation

## Plan Generation Data Inputs

### Required Fields Snapshot
Canonical onboarding fields with confidence scores:
```json
{
  "primary_goal_v1": {
    "raw_answer": "I want to lose weight and build muscle",
    "parsed_value": {"field": "primary_goal", "value": "lose_fat_build_muscle"},
    "confidence": 0.92,
    "answered_at": "2025-09-24T10:30:00Z"
  },
  "current_weight_v1": {
    "raw_answer": "180 pounds",
    "parsed_value": {"field": "current_weight", "value": 81.6, "unit": "kg"},
    "confidence": 0.98,
    "answered_at": "2025-09-24T10:32:00Z"
  }
}
```

### Profile Extras
Additional safety-relevant information:
- `medications`: List of current medications
- `medical_conditions`: Known medical conditions
- `injury`: Injury flag and details
- `injury_notes`: Detailed injury descriptions

### User Summaries (Optional)
Historical context when available:
- Previous fitness experience
- Past adherence patterns
- Preferences and constraints

## Post-Processing Guardrails

### Exercise Safety Filters

**High-Risk Exercises** (Removed for injured users):
- Deadlifts, heavy squats, overhead press
- Olympic lifts, plyometrics
- High-impact cardio, sprints

**Conservative Intensity Modifications**:
- Reduce sets by 30%
- Lower rep ranges by 20%
- Increase rest periods
- Reduce caloric deficit

### Caloric Safety Limits

**Maximum Rate**: 1% of body weight per week
- 80kg user → Max 0.8kg/week → ~6,160 cal deficit/week → ~880 cal/day deficit
- Never below 120% of estimated BMR
- Surplus limits for weight gain goals

### Age-Appropriate Programming

**Youth (<16 years)**:
- Shorter sessions (20-30 minutes)
- Emphasis on fun and form
- No heavy lifting
- Balance and coordination focus

**Seniors (>65 years)**:
- Balance and flexibility emphasis
- Joint-friendly exercises
- Fall prevention focus
- Gradual progression

## Safety Review Workflow

### When Review is Required
- High safety risk level
- Multiple guardrails triggered (≥3)
- Serious medical conditions
- Recent surgeries or injuries

### Review Process
1. Plan status set to 'draft'
2. Profile flagged `safety_review_required: true`
3. Human reviewer accesses plan
4. Review decision made (approved/rejected)
5. Plan status updated accordingly

### Review API
```http
POST /api/plans/{plan_id}/safety-review
{
  "approved": true,
  "reviewer_id": "uuid",
  "review_notes": "Plan approved with modifications",
  "modifications": ["reduced_intensity", "added_safety_notes"]
}
```

## Database Schema Updates

### Plans Table Extensions
```sql
ALTER TABLE public.plans ADD COLUMN
  safety_analysis JSONB,           -- Safety analysis results
  guardrails_applied JSONB,        -- Applied guardrails list
  safety_review_completed BOOLEAN DEFAULT FALSE,
  safety_review_approved BOOLEAN,
  safety_reviewer_id UUID REFERENCES users(id),
  safety_review_notes TEXT,
  safety_review_date TIMESTAMPTZ;
```

### Profile Safety Flags
```sql
ALTER TABLE public.profiles ADD COLUMN
  safety_review_required BOOLEAN DEFAULT FALSE,
  injury_severity SMALLINT,        -- 0=none, 1=mild, 2=moderate, 3=severe
  medications TEXT;
```

## API Usage Examples

### Manual Plan Generation with Guardrails
```javascript
const response = await fetch('/api/plans/generate-with-guardrails', {
  method: 'POST',
  headers: { 'Authorization': 'Bearer <token>' },
  body: JSON.stringify({
    user_id: 'user-uuid',
    session_id: 'session-uuid',
    force: false
  })
});

const result = await response.json();
// Returns plan with safety analysis and guardrails info
```

### Automatic Generation Response
When a user submits their final onboarding response:
```json
{
  "saved_response_id": "response-uuid",
  "parsed_value": {"field": "goal", "value": "lose_weight"},
  "session_status": "completed",
  "ready_for_plan": true,
  "readiness_analysis": {
    "confidence_score": 0.85,
    "missing_fields": [],
    "safety_risk": "low"
  }
}
```
→ Plan generation automatically triggered in background

## Configuration

### Safety Thresholds
Located in `config/onboarding-config.yaml`:
```yaml
plan_generation:
  safety_thresholds:
    minimum_confidence: 0.7
    max_caloric_deficit_percent: 0.01  # 1% body weight per week
    auto_trigger_enabled: true
    
  high_risk_keywords:
    - "surgery"
    - "chronic pain"
    - "heart condition"
    - "diabetes"
    
  exercise_restrictions:
    injury_present: "conservative_intensity"
    age_over_65: "senior_modifications"
    medical_conditions: "remove_high_risk"
```

### Environment Variables
```env
OPENAI_API_KEY=your-key-here
PLAN_GENERATION_MODEL=gpt-4
MAX_PLAN_GENERATION_TOKENS=2000
AUTO_GENERATION_DELAY_MS=3000
```

## Monitoring and Logging

### Key Metrics to Monitor
- Plan generation success rate
- Safety review queue length
- Guardrails trigger frequency
- Auto-generation completion rate

### Log Events
```
🎯 Starting plan generation for user {id}, session {id}
🛡️ Safety analysis completed: {level} risk
🤖 Base plan generated by LLM
⚡ Safety guardrails applied
📅 Schedule validation completed
✅ Plan generated successfully: {plan_id}
❌ Plan generation failed: {error}
```

## Testing

### Test Suite: `test-plan-generation-guardrails.js`
- Tests all three safety levels (low, medium, high)
- Validates guardrails application
- Tests safety review workflow
- Tests auto-generation triggers

### Run Tests
```bash
npm run test:guardrails  # Plan generation with guardrails
npm run test:all        # All test suites
```

## Production Considerations

### Job Queue Integration
Replace `setTimeout` with proper job queue:
```javascript
// Instead of setTimeout, use:
await jobQueue.add('generate-plan', {
  user_id,
  session_id,
  priority: 'high'
});
```

### Error Handling
- Graceful degradation if plan generation fails
- Retry mechanisms for transient failures
- Fallback to manual generation option

### Performance
- Plan generation typically takes 5-30 seconds
- Non-blocking async processing
- Estimated completion times provided to users

## Acceptance Criteria ✅

✅ **Generated plan stored with required_fields_snapshot**
- Plans include complete snapshot of onboarding data used
- Confidence scores preserved for auditability

✅ **Safety flags trigger appropriate responses**
- Injury/medical conditions → draft status + safety review required
- Conservative intensity and high-risk exercise removal
- Profile safety flags updated automatically

✅ **Comprehensive guardrails system**
- Post-processing filters for exercise safety
- Caloric limit enforcement (max 1% body weight/week)
- Schedule validation against user availability
- Age-appropriate modifications

✅ **Human review workflow**
- Draft plans require safety review for high-risk cases
- Complete review API with approval/rejection
- Safety reviewer tracking and notes

This system provides comprehensive safety coverage while maintaining user experience through automated plan generation and intelligent guardrails.