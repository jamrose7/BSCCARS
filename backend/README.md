# BSCCARS

Barangay Sillon Community Complaint and Response System is a web-based complaint intake, tracking, and response system for residents and authorized barangay personnel.

The project currently includes a static HTML/CSS/JavaScript frontend and an Express.js backend. The backend uses in-memory mock data for most workflows, with MySQL schema files prepared for database-backed implementation.

## Current Features

- Resident registration with barangay staff approval.
- Minimum age rule: residents must be at least 18 years old to register their own account. Minors should have a parent or legal guardian submit complaints on their behalf.
- JWT-based sign-in for residents, Assistant Admin, and Super Admin users.
- Resident complaint submission with category, priority, confidentiality, incident date/time, attachments, and Money Debt respondent fields.
- Active complaint limit of 5 pending or in-progress complaints per resident.
- Resident "My Complaints" page with status history, admin responses, attachments, hearing proceedings, and follow-up updates.
- Resident follow-ups for active complaints so continuing issues can be updated instead of duplicated.
- Admin complaint management with status updates, official responses, respondent detail correction, archiving, and resident follow-up visibility.
- Public Feed with summary-only complaint cards. Full complaint details, attachments, respondent information, and admin notes are intentionally not exposed publicly.
- Money Debt hearing notice workflow, including mediation stages, notice service tracking, outcomes, and CFA support.
- Notification and activity logging workflows for residents and administrators.
- Admin reports for complaint overview, categories, monthly totals, resolution, and priority.
- Resident application management: approve, reject, archive, and restore.
- Super Admin administrator account management: create, activate, deactivate, and review admin accounts.
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
- Uploads: multer
- Database target: MySQL using mysql2
- Current development data: in-memory mock data in `backend/data/mockData.js`

## Project Structure

```text
BSCCARS/
  backend/
    config/             JWT configuration
    data/               In-memory mock users, complaints, notifications, logs
    db/                 MySQL schema and seed files
    middleware/         Authentication and role guards
    routes/             API route modules
    server.js           Express app entry point
    package.json        Backend dependencies and scripts
  css/                  Page styles
  html/                 Frontend pages
  images/               Logos, icons, and static images
  js/                   Frontend scripts and API service
```

## Setup

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

The backend also serves the frontend static files, so opening the root URL loads the landing page.

## Environment Variables

Create a `.env` file in `backend/` when needed.

```env
PORT=3000
JWT_SECRET=replace_with_a_strong_secret
JWT_EXPIRES_IN=8h

DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=bsccars
```

Database environment variables are optional in the current development flow. When database variables are not set, most routes use in-memory mock data.

## Database Files

The database files are in `backend/db/`:

- `schema.sql` defines users, complaints, attachments, comments, status history, notifications, activity logs, and hearing notices.
- `seed.sql` contains initial seed data.

Important: some current route behavior still uses `backend/data/mockData.js`. Treat the SQL files as the database target, not proof that every workflow is fully database-backed yet.

## Main API Areas

```text
POST   /api/auth/sign-in
POST   /api/auth/register
POST   /api/auth/reset-password

GET    /api/profile
PATCH  /api/profile

GET    /api/complaints
GET    /api/complaints/check-eligibility
GET    /api/complaints/public-feed
GET    /api/complaints/:id
POST   /api/complaints
PATCH  /api/complaints/:id/status
POST   /api/complaints/:id/comment
POST   /api/complaints/:id/follow-up
PATCH  /api/complaints/:id/respondent
PATCH  /api/complaints/:id/archive
GET    /api/complaints/:id/comments
GET    /api/complaints/:id/hearing-notices

POST   /api/hearing-notices
PATCH  /api/hearing-notices/:id

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

GET    /api/admin-users
POST   /api/admin-users
POST   /api/admin-users/:id/activate
POST   /api/admin-users/:id/deactivate

GET    /api/activity
GET    /api/health
```

## Complaint Rules

- Residents can have up to 5 active complaints.
- Active complaints are `pending` or `in-progress`.
- Resolved complaints no longer count against the active complaint limit.
- Follow-ups can only be added by the resident who submitted the complaint.
- Follow-ups are allowed only for active complaints.
- Confidential complaints hide the complainant from public listings, but authorized barangay personnel can still review the full record.
- Money Debt complaints require respondent name. Respondent details must not be exposed in the Public Feed.
- High priority is automatically applied to configured urgent categories.

## Legal Pages

The system includes:

- `html/privacy.html`
- `html/terms.html`
- `html/disclaimer.html`

These pages were updated to reflect current workflows, including resident approval, age requirements, follow-ups, public feed privacy limits, and the removal of resident account restriction/suspension penalties.

These pages are project text drafts and should still be reviewed by the barangay or a qualified legal/privacy reviewer before official deployment.

## Development Notes

- The app is not fully production-ready while core data still depends on in-memory mock objects.
- Restarting the backend resets mock complaints, users added at runtime, notifications, and activity logs.
- Uploaded complaint attachments are stored under `backend/uploads/complaints`.
- Resident ID uploads in the current mock flow are handled as data URLs.
- The backend currently has a fallback JWT secret. Use a strong `JWT_SECRET` in any real deployment.
- Some files may contain older encoded characters from previous edits. Clean these when touching nearby text.

## Demo Accounts

The mock data includes demo users in `backend/data/mockData.js`. Check that file for the current emails and passwords before testing, because those values may change during development.

Common seed accounts currently include:

```text
superadmin@gmail.com
assistantadmin@gmail.com
resident@gmail.com
```

## Quick Verification

Useful syntax checks:

```bash
node --check backend/routes/complaints.js
node --check js/myComplaints.js
node --check js/publicFeed.js
node --check js/adminComplaints.js
```

Health check after starting the server:

```text
http://localhost:3000/api/health
```
