# Step-by-Step Implementation Plan for Adaptive AI Lifestyle Coach (Mobile-first Web App PWA)

## 1 — High-level outcome & MVP promise
Outcome: A mobile-first PWA that onboards a user in 60s, generates an initial 6-month plan (workout + meals), does a 10–20s daily check-in, stores long-term memories, and adaptively updates the plan based on adherence, sleep, sickness, and food slips.

## 2 — MVP scope
Must-have features:
- Onboarding (goal + profile)
- Initial plan generator (LLM + templates)
- Daily one-tap check-in
- Structured logging
- Memory system: user_summary + event memories
- Plan modifier engine (rules + LLM)
- Mobile-first PWA, installable
- Notifications (push)
- Admin dashboard
- Basic analytics

Nice-to-have (Phase 1+):
- Photo food logging
- WhatsApp check-ins
- Trainer review panel
- Payment/subscriptions

## 3 — Tech stack
- Frontend: React + Next.js (PWA)
- Backend: Node.js (Express/Nest)
- DB: Supabase (Postgres + pgvector)
- Vector store: Supabase Vector (pgvector), Pinecone/Qdrant later
- LLM: OpenAI/Gemini
- Notifications: Firebase
- Hosting: Vercel (frontend) + Render/Heroku (backend)
- Analytics: PostHog or Mixpanel

## 4 — Data model
Users(id, email, name, timezone, created_at, last_active)
Profiles(user_id, birth_year, sex, height_cm, initial_weight_kg, diet_pref, allergies, equipment, injured, injury_notes)
DailyLogs(id, user_id, date, workout_status, workout_type, meals_summary, sleep_hours, mood, sick_flag, created_at)
Memories(id, user_id, text, vector, type, importance, persist, created_at, source)
UserSummary(user_id, summary_text, vector, last_updated)
Plans(id, user_id, plan_json, generated_at, generator_version)
Events/Corrections(id, user_id, type, details, created_by, created_at)

## 5 — AI pipeline
- Ingest: events to vector DB
- Consolidate: daily/weekly user_summary
- Retrieve: summary + top memories
- Compose prompt: system + summary + memories + query
- Generate: LLM call
- Post-process: safety checks
- Store: plan + provenance

## 6 — Plan modifier engine
- Hard rules: sickness, sleep <5h, injuries
- Soft adjustments: LLM replan with context

## 7 — API endpoints
/me, /onboarding
/logs/daily (GET/POST)
/plans/generate, /plans/current
/memories (GET/POST)
/notifications/register

## 8 — Frontend screens
- Onboarding
- Home/Today
- Daily check-in
- Progress
- Plan details
- Settings
- Admin dashboard

## 9 — Notifications
- Daily check-in at user time
- Adaptive frequency
- Micro-nudges
- Channels: Push, WhatsApp (later), SMS fallback

## 10 — Privacy & safety
- Memory consent
- Encrypt sensitive fields
- Provide delete/edit UI
- Disclaimers for medical
- Audit logs

## 11 — Metrics
- D1/D7/D30 retention
- WAU
- Adherence rate
- Avg session duration
- Conversion to paid
- LLM cost/user
- Retrieval precision
- Safety false triggers

## 12 — 90-day execution plan
Week 0: setup infra
Sprint 1 (Days 1–14): backend skeleton, onboarding, initial plan gen, deploy PWA shell
Sprint 2 (Days 15–30): daily check-ins, logs, memory store, retrieval pipeline, plan modifier
Sprint 3 (Days 31–45): rules engine, notifications, admin dashboard, analytics
Sprint 4 (Days 46–60): polish UI, user test, memory edit UI, caching
Sprint 5 (Days 61–90): retention experiments, paid tier, migrate vectors if needed, WhatsApp trial

## 13 — Example code snippets
Store memory:
  embeddings.embed -> supabase.from('memories').insert
Retrieve memories:
  embeddings.embed -> supabase.rpc('match_memories') -> re-rank

## 14 — Risks
- High LLM cost -> cache, cheaper models
- Poor retention -> microcopy, nudges
- Wrong advice -> hard safety rules, disclaimers
- Memory drift -> provenance, edit UI
- Free tier limits -> prune, migrate to Pinecone/Qdrant

## 15 — Immediate next 5 actions
1. Create Supabase project + enable pgvector
2. Get LLM API key and test simple prompt
3. Scaffold Next.js PWA + onboarding screen
4. Implement /plans/generate endpoint
5. Recruit 10 testers and show onboarding + plan manually
