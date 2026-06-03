# KOLO — Auth Testing Playbook (Emergent Google Auth + Custom Email/Password)

Canonical playbook for validating the multi-provider login flow.

## Endpoints
- Backend base: $REACT_APP_BACKEND_URL (preview) or https://trykolo.io (prod)
- `POST /api/auth/session`  → exchanges Emergent `session_id` for a server session + cookie
- `GET  /api/auth/me`       → current user (cookie OR `Authorization: Bearer <token>`)
- `POST /api/auth/login`    → email + password
- `POST /api/auth/register` → email + password + name + phone (creates 7-day trial)
- `POST /api/auth/logout`   → invalidates session
- `GET  /api/admin/check`   → `{is_super_admin: bool}` for the current session
- `GET  /api/admin/stats`   → KPIs (super admin only)
- `GET  /api/admin/leads`   → enterprise demo requests (super admin only)
- `PATCH /api/admin/leads/{id}` → update status (super admin only)
- `GET  /api/admin/users`   → user list (super admin only)

## Super Admin allowlist
Hard-coded server-side in `server.py → KOLO_SUPER_ADMIN_EMAILS`.
Today: `elliot.cohenpressard@trykolo.io` (Google login OR email/password).

## Step 1 — Seed a test admin session in Mongo
```
mongosh "$MONGO_URL" --eval "
const db = db.getSiblingDB(process.env.DB_NAME || 'test_database');
const userId = 'test-admin-' + Date.now();
const sessionToken = 'test_session_' + Date.now();
db.users.insertOne({
  user_id: userId,
  email: 'elliot.cohenpressard@trykolo.io',
  name: 'Elliot',
  auth_provider: 'google',
  subscription_status: 'active',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
});
db.user_sessions.insertOne({
  user_id: userId,
  session_token: sessionToken,
  expires_at: new Date(Date.now() + 7*24*60*60*1000).toISOString(),
  created_at: new Date().toISOString()
});
print(sessionToken);"
```

## Step 2 — Validate API
```
curl -H "Authorization: Bearer $SESSION_TOKEN" "$REACT_APP_BACKEND_URL/api/auth/me"
curl -H "Authorization: Bearer $SESSION_TOKEN" "$REACT_APP_BACKEND_URL/api/admin/check"
curl -H "Authorization: Bearer $SESSION_TOKEN" "$REACT_APP_BACKEND_URL/api/admin/stats"
```
Expect: `is_super_admin: true` and a stats payload.

## Step 3 — Browser flow
- `/login` shows: email field, Google button (works), Apple button (disabled, tooltip).
- Google button → `https://auth.emergentagent.com/?redirect=<encoded origin>/`.
- After callback `#session_id=...`, `<AuthCallback>` exchanges token and lands in `/app`.
- Super admin sees "Espace Admin" entry AND can open `/kolo-admin`.
- Non-admin opening `/kolo-admin` redirects to `/app`.

## Rules
- Do NOT hardcode redirect URL — always use `window.location.origin`.
- Backend reads `session_token` cookie first then `Authorization` header.
- Mongo: `{"_id": 0}` projection everywhere.
- Use timezone-aware datetimes.
