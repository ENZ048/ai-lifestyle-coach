# AI Lifestyle Coach – Backend API

This document describes the backend API endpoints, authentication, request/response shapes, and status codes. Keep this file updated as the API evolves.

Base URL: http://localhost:5000

## Authentication

- Scheme: Bearer token (Firebase ID token)
- Header: `Authorization: Bearer <FIREBASE_ID_TOKEN>`
- Source: Frontend authenticates users via Firebase Phone Auth, obtains ID token with `user.getIdToken()`, and includes it in requests.

Middleware behavior:
- `authenticate` (required): Rejects with 401 if token missing/invalid.
- `optionalAuth` (optional): Attaches `req.user` if token is valid, else continues.

`req.user` shape (derived from Firebase ID token):
```json
{
  "id": "<firebase_uid>",
  "email": "user@example.com | null",
  "phone_number": "+15551234567 | null",
  "firebase": { "...decoded token claims..." }
}
```

## Endpoints

### GET `/` (Health)
- Auth: None
- Description: Simple health check for the backend.
- Request: None
- Response: 200 OK, text
  - Example: `AI Lifestyle Coach Backend`

---

### GET `/auth/user`
- Auth: Optional (`optionalAuth`)
- Description: Returns the current authenticated user if a valid Firebase token is provided.
- Request headers:
  - Optional `Authorization: Bearer <ID_TOKEN>`
- Responses:
  - 200 OK unauthenticated
    ```json
    { "authenticated": false }
    ```
  - 200 OK authenticated
    ```json
    {
      "authenticated": true,
      "user": {
        "id": "<firebase_uid>",
        "email": "user@example.com",
        "phone_number": "+15551234567",
        "firebase": { "...claims..." }
      }
    }
    ```

---

### POST `/plans/generate`
- Auth: Required (`authenticate`)
- Description: Generates a 7-day workout + meal plan via LLM and persists it to the `plans` table. Returns the generated plan whether or not persistence succeeds.
- Request headers:
  - `Authorization: Bearer <ID_TOKEN>`
  - `Content-Type: application/json`
- Request body:
  ```json
  {
    "goal": "string (required)",
    "preferences": { "...any json..." } // optional
  }
  ```
- Successful responses:
  - 201 Created (saved to DB)
    ```json
    {
      "plan": { "...plan json..." },
      "saved": true,
      "record": {
        "id": "uuid",
        "user_id": "uuid",
        "plan_json": { "..." },
        "generated_at": "2025-09-23T12:34:56.000Z",
        "generator_version": "gpt-4o-mini"
      }
    }
    ```
  - 201 Created (not saved to DB)
    - When Supabase insert fails; the generated plan is still returned.
    ```json
    {
      "plan": { "...plan json..." },
      "saved": false,
      "supabaseError": { "message": "...", "details": "...", "hint": "...", "code": "..." }
    }
    ```
- Error responses:
  - 400 Bad Request (validation)
    ```json
    { "error": "\"goal\" is required" }
    ```
  - 401 Unauthorized (missing/invalid token)
    ```json
    { "error": "Unauthorized" }
    ```
  - 500 Internal Server Error (unexpected)
    ```json
    { "error": "<message>" }
    ```

- Notes:
  - The DB schema expects `user_id` as UUID. The backend now ensures a `users` row exists for the authenticated email and sets `plans.user_id` accordingly.
  - The LLM output is parsed as JSON; if parsing fails, the raw text is returned inside `{ "raw": "..." }` to avoid errors.

---

### GET `/profile`
- Auth: Required (`authenticate`)
- Description: Fetch the current user's onboarding profile. If not found, returns `exists: false`.
- Response 200 OK (exists):
  ```json
  {
    "exists": true,
    "profile": {
      "name": "John Doe",
      "dob": "1990-05-20",
      "sex": "male",
      "weight": 75.5,
      "height": 178,
      "primaryGoal": "weight_loss",
      "targetWeight": 70,
      "activityLevel": "moderately_active",
      "timeAvailability": "morning",
      "dietPreference": "omnivore",
      "allergies": "peanuts",
      "mealFrequency": "3",
      "workoutSetup": "home",
      "injury": "no",
      "injuryNotes": null,
      "sleepHours": 7.5,
      "medicalConditions": null,
      "updatedAt": "2025-09-23T12:34:56.000Z"
    }
  }
  ```
- Response 200 OK (not exists):
  ```json
  { "exists": false, "profile": null }
  ```

### PUT `/profile`
- Auth: Required (`authenticate`)
- Description: Creates or updates the current user's onboarding profile. Upserts by `user_id`.
- Request body:
  ```json
  {
    "name": "John Doe",
    "dob": "1990-05-20",
    "sex": "male",
    "weight": 75.5,
    "height": 178,
    "primaryGoal": "weight_loss",
    "targetWeight": 70,
    "activityLevel": "moderately_active",
    "timeAvailability": "morning",
    "dietPreference": "omnivore",
    "allergies": "peanuts",
    "mealFrequency": "3",
    "workoutSetup": "home",
    "injury": "no",
    "injuryNotes": "",
    "sleepHours": 7.5,
    "medicalConditions": ""
  }
  ```
- Response 200 OK:
  ```json
  { "profile": { "...same shape as GET /profile..." } }
  ```

Validation rules: the backend validates presence and ranges (e.g., `sleepHours` 0-24); enum-like strings are normalized to match DB checks.

---

### POST `/profile/complete`
- Auth: Required (`authenticate`)
- Description: One-shot endpoint for onboarding completion. Validates and upserts the profile, then generates and saves a 7-day plan for the user.
- Request body: Same as `PUT /profile`.
- Responses:
  - 201 Created (plan saved):
    ```json
    {
      "profile": { "...profile as returned by GET /profile..." },
      "plan": { "...generated plan json..." },
      "planSaved": true,
      "planRecord": { "id": "uuid", "user_id": "uuid", "generated_at": "...", "generator_version": "gpt-4o-mini", "plan_json": {"..."} }
    }
    ```
  - 201 Created (plan not saved due to DB error; plan still returned):
    ```json
    {
      "profile": { "..." },
      "plan": { "..." },
      "planSaved": false,
      "supabaseError": { "message": "...", "details": "..." }
    }
    ```

Notes:
- The backend ensures a `users` row exists keyed by the Firebase UID. The `users` table now stores `firebase_uid` and `phone_number` (no email required for phone auth).

## Conventions & Status Codes
- 200 OK: Successful GETs or auth checks
- 201 Created: Successful creation/generation
- 400 Bad Request: Invalid input payload
- 401 Unauthorized: Missing/invalid token
- 500 Internal Server Error: Unexpected server error

## Changelog
- 2025-09-24: Added `/profile` GET/PUT, updated `/plans/generate` to set `user_id` and removed unused metadata in docs.
- 2025-09-23: Initial document with Firebase Phone Auth and `/plans/generate` endpoint.