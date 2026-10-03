# BSCCARS

Barangay Sillon Community Complaint and Response System is a web-based complaint intake, tracking, and response system for residents and authorized barangay personnel.

The project includes a static HTML/CSS/JavaScript frontend and an Express.js backend. Application data is stored in MySQL; there is no mock/in-memory fallback. A reachable MySQL database is required for API workflows.

## Current Features

- Resident registration with barangay staff approval.
- Minimum age rule: residents must be at least 18 years old to register their own account. Minors should have a parent or legal guardian submit complaints on their behalf.
- JWT-based sign-in for residents, Assistant Admin, and Super Admin users.
- Resident complaint submission with category, priority, confidentiality, incident date/time, attachments, and Money Debt respondent fields.
- Admin-only complaint intake source tracking ("Received Via"): Digital Submission, In-person at Barangay Office, or Other (with a free-text specify field).
- Active complaint limit of 5 pending or in-progress complaints per resident.
- Resident "My Complaints" page with status history, admin responses, attachments, hearing proceedings, and follow-up updates.
- Resident follow-ups for active complaints so continuing issues can be updated instead of duplicated.
- Admin complaint management with status updates, official responses, respondent detail correction, archiving, and resident follow-up visibility.
- Authenticated Public Feed with summary-only complaint cards. Full complaint details, attachments, respondent information, and admin notes are intentionally not exposed publicly.
- Money Debt hearing notice workflow, including mediation stages, notice service tracking, outcomes, and certificate-for-filing-action (CFA) records.
- Protected complaint attachments: image/video files are stored outside the database under the backend upload directory, while MySQL stores the attachment metadata and complaint relationship. Files are served through an authenticated route that verifies the requester is either an admin or the complaint's own submitter before the file is returned.
- In-app notification workflows and persistent MySQL activity logging for residents and administrators. Email notifications cover account/auth events (registration verification, password reset, admin activation, email change) as well as complaint status changes and official admin responses. Hearing notice creation and updates notify the resident in-app; those routes do not send a hearing-specific email. An official-response email may include hearing-related text entered by staff.
- Admin reports for complaint overview, categories, monthly totals, resolution, priority, and recurring complainant/respondent activity.
- Resident application management: approve, reject, archive, and restore.
- Super Admin administrator account management for barangay turnover: create incoming admin accounts, send activation links, deactivate outgoing admins, and review admin accounts. The application does not automatically create the first administrator; a fresh database needs an administrator provisioned through a secure setup process.
- Email verification for new registrations and pending email changes, with a resend option on the resident dashboard.
- Email-based password recovery using secure, hashed, expiring, single-use reset tokens.
- Legal pages for Privacy Policy, Terms of Service, and Disclaimer.

## Roles

### Resident

Residents can register, sign in after approval, submit complaints, view their own complaints, add follow-ups to active complaints, view admin responses, and track relevant hearing proceedings.

### Assistant Admin

Assistant Admin users can process resident applications, review complaints, update statuses, add official responses, manage hearing notices, and view reports.

### Super Admin

Super Admin users can do Assistant Admin tasks plus archive/restore records where allowed, manage administrator accounts, and view system activity logs.

## Public Feed Privacy

The Public Feed is intentionally limited. It should only show summary information such as:

- complaint number
- title
- category
- purok
- incident date and time
- status
- submitter display name for non-confidential complaints

Do not expose full complaint descriptions, attachments, respondent names, debt amounts, contact details, admin notes, or hearing notes on the Public Feed. Those belong in authenticated resident/admin views only.

## Tech Stack

- Frontend: HTML, CSS, vanilla JavaScript
- Backend: Node.js, Express.js
- Authentication: JWT, bcryptjs
- Email: Nodemailer with configured SMTP
- Uploads: multer
- Database: MySQL using mysql2
- Administrator seed data is environment-specific and is not included in the repository. The local `backend/db/seed.sql` is ignored by Git.

## Project Structure

```text
BSCCARS/
  backend/
    config/             JWT configuration
    data/               Database-backed helper modules
    db/                 MySQL schema; local seed files are not tracked
    middleware/         Authentication and role guards
    routes/             API route modules
    services/           Email sending (Nodemailer)
    uploads/            Stored complaint attachments (gitignored)
    server.js           Express app entry point
    package.json        Backend dependencies and scripts
  css/                  Page styles
  html/                 Frontend pages
  images/               Logos, icons, and static images
  js/                   Frontend scripts and API service
```

## Setup

For a first-time local database setup, create the database and apply the schema from the repository root. Replace `bsccars` if `DB_NAME` uses a different database name. These commands use a local MySQL root account for setup; configure the backend to connect with a separate MySQL application account in `backend/.env`.

```bash
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS bsccars;"
mysql -u root -p bsccars < backend/db/schema.sql
```

The repository includes the database schema, but does not include administrator seed data. The local `backend/db/seed.sql`, if present, is ignored by Git because it contains environment-specific account records and can update existing password hashes. Keep it private and review it before running; never commit real account details or password hashes.

A new database needs its first administrator provisioned through a secure, out-of-band setup process before admin features can be used.

From the backend directory, install dependencies:

```bash
cd backend
npm install
```

Start the server:

```bash
npm start
```

For development with auto-restart:

```bash
npm run dev
```

The default server URL is:

```text
http://localhost:3000
```

The backend also serves the frontend static files. Opening `http://localhost:3000/` loads the landing page; `http://localhost:3000/api/health` is the API health check.

## Environment Variables

Create a `.env` file in `backend/`.

```env
PORT=3000
JWT_SECRET=replace_with_a_strong_secret
JWT_EXPIRES_IN=8h

DB_HOST=localhost
DB_PORT=3306
DB_USER=bsccars_app
DB_PASSWORD=
DB_NAME=bsccars

APP_BASE_URL=http://localhost:3000

SMTP_HOST=smtp.example.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=replace-with-smtp-user
SMTP_PASS=replace-with-smtp-password
MAIL_FROM_NAME=BSCCARS
MAIL_FROM_ADDRESS=replace-with-sender@example.com

EMAIL_VERIFICATION_TOKEN_TTL_MINUTES=1440
EMAIL_CHANGE_TOKEN_TTL_MINUTES=1440
PASSWORD_RESET_TOKEN_TTL_MINUTES=30
ADMIN_ACTIVATION_TOKEN_TTL_MINUTES=1440
```

The database module defaults to `localhost:3306`, user `root`, an empty password, and database `bsccars` when database variables are omitted. For normal local setup, use a dedicated MySQL application user and grant it only the required database privileges. In production, the server requires at least one of `DB_HOST`, `DB_USER`, or `DB_NAME` to be configured; an actual database connection is required when API routes query MySQL. Set a stable, strong `JWT_SECRET` in production; the server rejects production startup if it is missing.

SMTP configuration is needed for registration verification, password recovery, email changes, administrator activation, complaint status notifications, and official-response notifications. If sending registration or activation email fails, the corresponding account creation is rolled back. Password recovery and email-change sending report failures to the user; complaint status/response updates are saved even if email delivery fails, and the server logs those email failures. Hearing notice creation and updates generate in-app notifications but do not call an email-sending function.

The mailer reads `SMTP_PASS` first and accepts `SMTP_APP_PASSWORD` as a fallback. For Gmail, use an App Password, not the account login password.

`APP_BASE_URL` must be the trusted frontend URL used in email links. Do not build password reset, email verification, or admin activation links from the request `Host` header.

If the frontend is served from a different origin, add that exact origin to the `allowedOrigins` list in `server.js`; CORS rejects other origins. The current setup serves frontend and API from the same Express origin by default.

## Database Files

The database schema is in `backend/db/`:

- `schema.sql` defines users, authentication tokens, complaints, attachments, comments, follow-ups, status history, notifications, activity logs, and hearing notices.

Administrator seed files are environment-specific and are not included in the repository. A local `backend/db/seed.sql` is ignored by Git; its duplicate-key clause may update existing accounts, including password hashes. Do not publish it. Provision the initial administrator securely or restore a private database dump.

Important: backend routes require the MySQL database. If the database is unavailable, the API should fail instead of returning fake in-memory data.

New resident registrations are pending and inactive until the application is approved by assistant admin or super admin. Email verification is tracked separately through `email_verified_at` and is required for password recovery.

If applying schema changes to an existing database, inspect the affected table first and apply only the missing column/index/enum update rather than forcing a destructive change.

## Main API Areas

```text
POST   /api/auth/sign-in
POST   /api/auth/register
GET    /api/auth/verify-email
POST   /api/auth/request-password-reset
POST   /api/auth/validate-reset-token
POST   /api/auth/reset-password
POST   /api/auth/resend-verification-email
POST   /api/auth/validate-admin-activation-token
POST   /api/auth/activate-admin

GET    /api/profile
PATCH  /api/profile
POST   /api/profile/change-password
GET    /api/profile/activity-log

GET    /api/complaints
GET    /api/complaints/check-eligibility
GET    /api/complaints/public-feed (authenticated)
GET    /api/complaints/:id
POST   /api/complaints
PATCH  /api/complaints/:id/status
POST   /api/complaints/:id/comment
POST   /api/complaints/:id/follow-up
PATCH  /api/complaints/:id/respondent
PATCH  /api/complaints/:id/archive
GET    /api/complaints/:id/comments
GET    /api/complaints/:id/hearing-notices

POST   /api/hearing-notices (Money Debt complaints only)
PATCH  /api/hearing-notices/:noticeId/outcome (Money Debt complaints only)

GET    /api/residents/pending
GET    /api/residents/all
POST   /api/residents/:id/approve
POST   /api/residents/:id/reject
PATCH  /api/residents/:id/archive

GET    /api/notifications
GET    /api/notifications/unread
PATCH  /api/notifications/:id/read

GET    /api/reports/overview
GET    /api/reports/dashboard
GET    /api/reports/by-category
GET    /api/reports/monthly
GET    /api/reports/resolution
GET    /api/reports/priority
GET    /api/reports/recurring
POST   /api/reports/export-log

GET    /api/admin-users
POST   /api/admin-users
POST   /api/admin-users/:id/deactivate

GET    /api/activity (Super Admin only)

GET    /api/uploads/complaints/:filename

GET    /api/health
```

`POST /api/admin-users/:id/activate` is intentionally not part of the active onboarding workflow (it returns an error message directing the admin to their emailed activation link). Incoming administrators must activate their own account through the emailed activation link and create their own permanent password.

All routes under `/api/profile`, `/api/residents`, `/api/complaints`, `/api/hearing-notices`, and `/api/notifications` require authentication. Report routes require an Assistant Admin or Super Admin; admin-user routes and `/api/activity` require a Super Admin. Authentication, email verification, password reset, and activation routes are public, with rate limits applied to selected endpoints.

`/api/uploads/complaints/:filename` requires a valid token and is authorized per-file: admins may open any complaint's attachment, while a resident may only open attachments on complaints they submitted. This route also blocks path-traversal attempts on the filename.

## Authentication and Email Flows

### Registration Email Verification

- New resident accounts are created inactive and pending approval. Sign-in requires admin approval of the application; email verification is a separate step that does not block sign-in but is required for password recovery.
- A secure email verification token is generated with cryptographically random bytes.
- Only the token hash is stored in `auth_tokens`.
- Verification links expire and are single-use.
- Existing users are not treated as verified unless `email_verified_at` is set by a successful verification flow.

### Forgot Password

The password recovery flow is:

```text
User -> Forgot Password -> enters email -> generic response
  Verified email:   receives reset link -> sets new password -> token invalidated -> confirmation email -> Sign In
  Unverified email: receives a verification link -> verifies -> requests a reset again
```

Rules enforced by the backend:

- Unverified residents (applications not rejected) receive a verification link instead of a reset link. A reset link is never sent to an unverified address.
- Residents can also resend the verification link from the banner on the resident dashboard.
- Password reset emails are only sent to registered verified email addresses.
- Reset tokens are hashed in the database, expire, and are single-use.
- Reset request and token endpoints are rate-limited.

### Administrator Onboarding and Turnover

The Super Admin creates incoming `super_admin` or `assistant_admin` accounts with the incoming person's own controlled email address. The Super Admin does not set or view the incoming admin's permanent password.

The onboarding flow is:

```text
Current Super Admin creates incoming admin -> activation link is emailed -> incoming admin creates permanent password -> account becomes active and verified -> incoming admin signs in -> outgoing admin may be deactivated
```

Backend safeguards:

- A Super Admin cannot deactivate themselves.
- The system cannot be left without an active Super Admin.
- A Super Admin can deactivate another Super Admin only when another active Super Admin exists.
- Administrator creation, activation, and deactivation are written to activity logs.

### Profile Editing

Authenticated users may edit only:

- Email Address
- Profile Photo, optional, maximum 2 MB

Names are not editable through profile self-service; they are treated as identity-of-record tied to the verified ID and KP hearing notice documents.

Email changes require the current password. The new email is stored as `pending_email`, a verification link is sent to that pending email, and the current email remains active until verification succeeds. Duplicate current or pending emails are rejected.

Profile photos are validated on the backend by declared image type, data URL format, size, and image file signature.

## Complaint Rules

- Residents can have up to 5 active complaints.
- Active complaints are `pending` or `in-progress`.
- Resolved complaints no longer count against the active complaint limit.
- Follow-ups can only be added by the resident who submitted the complaint.
- Follow-ups are allowed only for active, non-archived complaints.
- Confidential complaints hide the complainant from public listings, but authorized barangay personnel can still review the full record. The schema currently supports `Public` and `Confidential` only — the "Anonymous" confidentiality tier described in the original proposal is not implemented at the database level.
- Money Debt complaints require respondent full name and purok; respondent contact number is optional. Respondent details are never exposed in the Public Feed.
- High priority is automatically and non-overridably applied to complaints in configured urgent categories (Physical Harm/Violence/Threats, Public Health Hazard); all other categories are stored as Normal. A resident-requested High priority on a non-urgent category is downgraded to Normal and recorded in the activity log.
- Complaint submissions accept one JPG/JPEG/PNG image up to 5 MB and one valid MP4 video up to 10 MB and 20 seconds. Videos shorter than 20 seconds are accepted. The browser and backend both enforce the duration limit.
- Complaint reference numbers follow the format `CMP-YYYY-NNNN` (see Known Issues below regarding the hardcoded year).
- Only resolved complaints can be archived, and only by a Super Admin.

## Legal Pages

The system includes:

- `html/privacy.html`
- `html/terms.html`
- `html/disclaimer.html`

These pages describe resident approval, age requirements, follow-ups, attachment rules, email verification, Public Feed privacy limits, and respondent data handling. Keep them aligned with application changes.

The Privacy Policy still requires the barangay to supply its designated Data Protection contact and approved retention periods before publication. All three pages should be reviewed and approved by the barangay or a qualified legal/privacy reviewer before official deployment.

## Development Notes

- Uploaded complaint attachment files are stored under `backend/uploads/complaints`; MySQL stores their metadata in `complaint_attachments`.
- Resident ID uploads are currently stored as data URLs in the `users` table. This can make database backups large; protect database backups accordingly.
- Backups must include both the MySQL database and the `backend/uploads/complaints` directory. A database-only backup is incomplete because complaint attachment binaries are not stored in MySQL.
- The authentication middleware generates an ephemeral fallback JWT secret outside production when `JWT_SECRET` is unset. Tokens will stop working after a server restart in that configuration. Production startup requires `JWT_SECRET`.
- Production startup requires at least one of `DB_HOST`, `DB_USER`, or `DB_NAME`.
- Set `ENFORCE_HTTPS=true` when the app is deployed behind a TLS-capable proxy or host.
- Password reset, email verification, email change verification, and administrator activation use emailed links. Do not log or expose raw tokens, passwords, SMTP credentials, JWTs, or full reset/verification URLs.
- Keep user-facing terminology as `Sign In` and `Sign Out`.

## Security and Assurance Status

BSCCARS includes baseline Information Security controls: JWT authentication, bcrypt password hashing, role-based API authorization, rate limiting on selected auth and token endpoints (5 attempts per 15 minutes; form endpoints use IP plus submitted email, while token-validation endpoints use IP), Helmet security headers with a Content-Security-Policy, token hashing for password reset/email verification/admin activation, upload validation, path traversal checks and per-file authorization for complaint attachments, privacy-limited public feed responses, and database-backed activity logging.

Note: the current CSP allows `'unsafe-inline'` for both `script-src` (inline
`<script>` blocks) and `script-src-attr` (inline event-handler attributes
like `onclick`) since both are still used across several HTML pages.
Auditing and removing inline scripts and inline event handlers so the CSP
can be tightened is tracked as future work.

This is still not a full Information Assurance pass for production. Before claiming production readiness, the project still needs verified backup and recovery procedures, documented access review, incident response procedures, audit log retention, dependency vulnerability checks, and legal/privacy review for official barangay deployment.

## Known Issues / Technical Debt

Known limitations and operational notes:

1. **Hardcoded year in ID generation.** Complaint IDs (`CMP-2026-####`) and user IDs (`RES-2026-###`, `ADM-2026-###`) hardcode `2026` in `backend/routes/complaints.js` and `backend/data/dbUsers.js`, enforced further by a `CHECK` constraint on `users.id` in `schema.sql`. Update the generators and schema constraint before using the system in a later year.
2. **Email notification behavior.** Updating a complaint status sends an in-app notification and attempts a status email. If staff provide official response text in that same status update, the server also attempts a separate official-response email; staff may include hearing information in that text. SMTP failures for these complaint emails are logged server-side, while the complaint update still succeeds. Hearing notice creation and updates send in-app notifications only; those routes do not send a hearing-specific email.
3. **`complaint_status_history` status columns are `VARCHAR(30)`**, not the same `ENUM` as `complaints.status`, so there is no database-level guarantee that history values stay in sync with valid complaint statuses. No functional issue has been observed; tightening this is deferred as future work.
4. **Inline JavaScript remains enabled by the CSP.** The Content-Security-Policy allows inline scripts and event-handler attributes because existing pages still use them. Move these handlers to external scripts before tightening the policy.

## Quick Verification

From the repository root, these commands check JavaScript syntax (they do not verify database connectivity, email delivery, or end-to-end behavior):

```bash
node --check backend/server.js
node --check backend/routes/auth.js
node --check backend/routes/profile.js
node --check backend/routes/adminUsers.js
node --check backend/routes/activity.js
node --check backend/routes/complaints.js
node --check js/myComplaints.js
node --check js/publicFeed.js
node --check js/adminComplaints.js
node --check js/adminUsers.js
node --check js/profilePage.js
node --check js/admin_activation.js
node --check js/verify_email.js
node --check backend/services/emailService.js
```

Health check after starting the server:

```text
http://localhost:3000/api/health
```
