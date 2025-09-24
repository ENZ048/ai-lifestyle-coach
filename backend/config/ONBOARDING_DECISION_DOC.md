# AI Lifestyle Coach - Onboarding Decision Document
**Version:** 1.0.0  
**Date:** September 24, 2025  
**Status:** DRAFT - Pending Product Team Sign-off

## Executive Summary

This document defines the canonical onboarding question set, configuration thresholds, and plan generation policies for the AI Lifestyle Coach application.

## 1. Canonical Question Set (v1)

### 1.1 Required Fields (9 total)
The following fields are **mandatory** for plan generation:

| Question ID | Field | Rationale |
|-------------|-------|-----------|
| `name_v1` | Name | Personalization and user identification |
| `dob_v1` | Date of Birth | Age-based metabolic calculations |
| `sex_v1` | Biological Sex | Gender-specific fitness/nutrition needs |
| `weight_v1` | Current Weight | BMI, caloric needs, progress tracking |
| `primary_goal_v1` | Primary Goal | Core plan focus and direction |
| `activity_level_v1` | Current Activity Level | Baseline fitness assessment |
| `availability_v1` | Workout Time | Realistic plan duration |
| `workout_setup_v1` | Workout Location/Equipment | Exercise selection constraints |
| `injury_flag_v1` | Injury/Limitation Flag | Safety screening |

### 1.2 Optional Fields (7 total)
These fields enhance personalization but are not mandatory:

| Question ID | Field | Impact |
|-------------|-------|--------|
| `height_v1` | Height | BMI calculation, more accurate metrics |
| `target_weight_v1` | Target Weight | Goal-specific planning (conditional) |
| `injury_details_v1` | Injury Details | Safety modifications (conditional) |
| `diet_pref_v1` | Dietary Preferences | Nutrition customization |
| `allergies_v1` | Food Allergies | Safety considerations |
| `training_experience_v1` | Training Experience | Difficulty calibration |
| `preferred_tone_v1` | Communication Style | AI interaction preferences |

## 2. Configuration Thresholds

### 2.1 Confidence Thresholds
```yaml
CONF_THRESHOLD: 0.60          # Minimum confidence for AI responses
HIGH_CONF_THRESHOLD: 0.85     # Auto-action threshold
```

**Rationale:**
- 0.60 ensures reasonable accuracy while maintaining conversational flow
- 0.85 provides high confidence for automated actions
- Below 0.60 triggers clarification requests

### 2.2 Safety Thresholds
```yaml
SAFETY_SEVERITY_THRESHOLD: 2  # Scale: 1-5 (Minor to Critical)
```

**Safety Classification:**
- **Level 1:** Minor - No restrictions
- **Level 2:** Moderate - Flag for review (THRESHOLD)
- **Level 3:** Significant - Require human review
- **Level 4:** High Risk - Medical consultation recommended
- **Level 5:** Critical - Immediate medical attention

**Safety Triggers:**
- Keywords: "heart condition", "diabetes", "pregnancy", "surgery", etc.
- Fields: `injury_details_v1`, `allergies_v1`

## 3. Plan Generation Policy

### 3.1 Generation Trigger
**Selected Policy:** `confirmation_required`

**Options Considered:**
1. **Auto-generate** - Generate immediately when ready
2. **Confirmation Required** - Show preview, require user confirmation ✓
3. **Manual Trigger** - User must explicitly request generation

**Decision Rationale:**
- Builds user trust through transparency
- Allows final review before commitment
- Prevents unwanted plan generation
- Maintains user control over the process

### 3.2 Generation Criteria
```yaml
required_completion_percentage: 90%
auto_generate_on_required_complete: true
show_preview: true
```

**Minimum Requirements for Generation:**
- All 9 required fields completed
- Safety review passed (if applicable)
- User confirmation received

## 4. Implementation Details

### 4.1 Question Versioning
- Format: `{field_name}_v{version_number}`
- Example: `name_v1`, `weight_v2`
- Allows backward compatibility and A/B testing

### 4.2 Conditional Logic
- `target_weight_v1` shown only if `primary_goal_v1` involves weight change
- `injury_details_v1` shown only if `injury_flag_v1` is true

### 4.3 Validation Rules
- **Name:** 2-50 characters, letters and spaces only
- **Age:** 13-120 years (calculated from DOB)
- **Weight:** 30-300 kg
- **Height:** 100-250 cm

## 5. Quality Assurance

### 5.1 Testing Requirements
- [ ] All required fields validation
- [ ] Optional field skipping
- [ ] Conditional logic triggers
- [ ] Safety keyword detection
- [ ] Confidence threshold handling
- [ ] Plan generation flow

### 5.2 Monitoring Metrics
- Completion rates by field
- Safety flag frequency
- Confidence score distribution
- Plan generation success rate
- User satisfaction scores

## 6. Sign-off Requirements

### 6.1 Stakeholder Approval Needed

**Product Team:**
- [ ] Product Manager - Question set and user flow
- [ ] UX Designer - Question wording and presentation
- [ ] Data Scientist - Thresholds and safety parameters

**Technical Team:**
- [ ] Backend Lead - Implementation feasibility
- [ ] AI/ML Engineer - Confidence thresholds
- [ ] Security Engineer - Safety considerations

**Compliance Team:**
- [ ] Legal - Data collection compliance
- [ ] Privacy Officer - User data protection
- [ ] Medical Advisor - Safety thresholds

### 6.2 Acceptance Criteria

✓ **Question Set:**
- Canonical list finalized with versioning
- Required vs optional fields defined
- Conditional logic documented

✓ **Configuration:**
- Confidence thresholds set and justified
- Safety thresholds defined with clear criteria
- Plan generation policy selected

✓ **Documentation:**
- All decisions documented with rationale
- Implementation details provided
- Testing requirements defined

**Pending:**
- [ ] Product team review and approval
- [ ] Technical feasibility confirmation
- [ ] Compliance and legal review

## 7. Next Steps

1. **Product Team Review** (Target: Week 1)
   - Review question set completeness
   - Validate required field selection
   - Approve threshold values

2. **Technical Implementation** (Target: Week 2-3)
   - Implement question engine
   - Build conditional logic
   - Create safety monitoring

3. **User Testing** (Target: Week 4)
   - A/B test question variations
   - Validate completion rates
   - Test safety triggers

4. **Production Deployment** (Target: Week 5)
   - Gradual rollout
   - Monitor metrics
   - Adjust thresholds as needed

---

**Document Owner:** AI Lifestyle Coach Development Team  
**Review Cycle:** Monthly or as needed for question set updates  
**Last Updated:** September 24, 2025