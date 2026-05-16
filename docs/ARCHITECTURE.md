# Nalanda Architecture

Nalanda is structured as an API-first Training & Development platform for 2000+ employees with Admin, Manager, and User roles.

## Local Components

- Frontend: React, Vite, Tailwind CSS, Framer Motion, Recharts.
- Backend: Node.js, Express, JWT, RBAC middleware, file upload endpoints, proctoring event ingestion.
- Database: PostgreSQL schema in `database/schema.sql`.
- Storage: designed for S3, Azure Blob, GCS, or Firebase Storage through `storage_key` references.
- Real-time: proctoring alerts can be upgraded to WebSockets by broadcasting `/api/proctoring/events`.

## Demo Credentials

- Admin: `admin@nalanda.local` / `Password@123`
- Manager: `aarav@nalanda.local` / `Password@123`
- User: `diya@nalanda.local` / `Password@123`

## Backend Run Notes

The backend is a deployment-ready API skeleton with in-memory seed data for local evaluation. It can be connected to PostgreSQL by replacing the arrays in `backend/server.js` with repository functions backed by `database/schema.sql`.

```bash
node backend/server.js
```

## Core API Groups

- Auth: `/api/auth/login`, `/api/auth/me`
- Users: `/api/users`, `/api/users/:id`, `/api/users/:id/status`
- Courses: `/api/courses`, `/api/courses/:id/duplicate`, `/api/courses/:id/approval`, `/api/courses/:id/status`
- Assignments: `/api/assignments`
- Assessments: `/api/assessments`, `/api/assessments/:id/approval`, `/api/assessments/:id/attempts/start`, `/api/assessments/attempts/:attemptId/submit`
- Proctoring: `/api/proctoring/events`
- Analytics: `/api/analytics/global`, `/api/analytics/team`, `/api/analytics/me`
- Reports: `/api/reports/export`
- Security: `/api/settings`
- Audit: `/api/audit-logs`

## Security Model

- JWT bearer authentication protects all non-health endpoints.
- RBAC middleware blocks access by role.
- Users are inactivated instead of deleted to preserve training history.
- Course and assessment approvals are Admin-controlled.
- Proctoring logs are immutable append-only records.
- Course media should be stored outside the database using encrypted object storage and signed URLs.

## Cloud Path

- Containerize frontend and backend separately.
- Add managed PostgreSQL with read replicas for analytics-heavy reporting.
- Add Redis or a queue for long-running report exports.
- Add WebSockets for real-time strict assessment alerts.
- Put course media behind signed URLs and CDN rules.
- Use OAuth or SAML SSO for enterprise identity.
