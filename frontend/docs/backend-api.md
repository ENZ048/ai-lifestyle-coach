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
        "user_id": null,
        "plan_json": { "..." },
        "generated_at": "2025-09-23T12:34:56.000Z",
        "generator_version": "gpt-4o-mini",
        "metadata": {
          "raw_text": "...raw llm output...",
          "auth_uid": "<firebase_uid> | null",
          "prompt_summary": { "goal": "...", "preferences": { "..." } }
        },
        "created_at": "2025-09-23T12:34:56.000Z",
        "updated_at": "2025-09-23T12:34:56.000Z"
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
  - The DB schema expects `user_id` as a UUID referencing a users table. Since we use Firebase Auth, we currently store the Firebase UID under `metadata.auth_uid` and set `user_id: null`. Add a mapping layer later if needed.
  - The LLM output is parsed as JSON; if parsing fails, the raw text is returned inside `{ "raw": "..." }` to avoid errors.

## Conventions & Status Codes
- 200 OK: Successful GETs or auth checks
- 201 Created: Successful creation/generation
- 400 Bad Request: Invalid input payload
- 401 Unauthorized: Missing/invalid token
- 500 Internal Server Error: Unexpected server error

## Changelog
- 2025-09-23: Initial document with Firebase Phone Auth and `/plans/generate` endpoint.
