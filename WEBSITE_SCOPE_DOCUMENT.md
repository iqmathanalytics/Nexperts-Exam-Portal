# Ventrix Global Website Scope Document

## 1. Purpose

This document describes the full functional scope, modules, capabilities, and technical information for the Ventrix Global exam and certification platform.

The platform is an end-to-end certification delivery system covering public marketing, candidate registration, OTP verification, exam purchase and scheduling, AI-proctored exam delivery, identity verification, certificate issuance, admin management, analytics, vouchers, reports, question banks, question pools, and PDF generation.

## 2. High-Level Platform Scope

Ventrix Global provides a secure online certification portal with two primary user areas:

- Candidate portal for registration, purchasing exams, scheduling, taking proctored exams, viewing results, downloading invoices, and sharing certificates.
- Admin portal for managing exams, questions, users, payments, vouchers, certificates, proctoring review, analytics, reports, and AI-assisted question generation.

The system also includes:

- Backend REST API.
- MySQL/TiDB database through Prisma ORM.
- Stripe payment integration.
- Brevo email integration.
- Groq AI integration.
- Python proctoring microservice.
- PDF generation for invoices, certificates, and question pools.
- Cloud/production deployment support through Render and Cloudflare/Netlify-compatible frontend builds.

## 3. User Roles

### Candidate

Candidates can:

- Register an account.
- Verify email via OTP.
- Login through OTP verification.
- View available exams.
- Purchase and schedule exams.
- Apply vouchers.
- Start exams immediately where allowed.
- Reschedule eligible exams.
- Complete identity verification before exam start.
- Take fullscreen webcam-proctored exams.
- Submit, abandon, or complete timed exams.
- View exam results and history.
- Download invoices.
- Download and share certificates.
- Update profile details.

### Admin

Admins can:

- Login through admin credentials.
- Access live platform dashboards.
- Manage exams and exam status.
- Manage question bank content.
- Generate questions using AI or uploaded PDFs.
- Manage reusable question pools.
- Assign exams to users for testing.
- Manage candidate accounts and account status.
- Reset attempts.
- Review payments and refunds.
- Manage vouchers and voucher batches.
- Monitor live exams and proctoring events.
- View identity verification photos.
- Review pass/fail results.
- Regenerate certificates.
- Export reports.
- Configure profile/platform settings.

### Super Admin

The schema supports a `SUPER_ADMIN` role. Current visible admin flows share the admin interface patterns unless role-specific UI is added later.

## 4. Public Website Module

### Landing Page

The public landing page presents Ventrix Global branding and explains the certification platform.

Capabilities include:

- Brand hero section.
- Professional certification positioning.
- AI-proctored and enterprise-grade messaging.
- Partner/company trust section.
- Platform benefits section.
- Four-step certification flow.
- Certification categories.
- Featured exams.
- Testimonials.
- FAQ section.
- Calls to action for login, registration, dashboard, and exams.

### Public Exam Browsing

Public exam listing and exam details are available through API routes and candidate-facing pages. Published exams can be viewed by candidates and purchased through the dashboard.

### Public Certificate Verification

Public certificate verification is available at:

- `/certificate/$credentialId`
- `/certificate/sample`

Capabilities include:

- Verify certificate by credential ID.
- Display recipient name, exam, score, issue date, and credential ID.
- Render certificate preview from the certificate template.
- Show verified credential status.
- Provide a sample certificate page for layout review.

## 5. Authentication and Account Module

### Candidate Registration

Candidate registration captures:

- Full name.
- Email.
- Phone.
- IC/passport.
- MyCAT.
- Degree.
- Date of birth.
- Password.

Backend capabilities:

- Password hashing with bcrypt.
- User uniqueness by email.
- OTP creation.
- OTP email delivery through Brevo.

### Candidate Login

Candidate login uses OTP verification.

Capabilities include:

- Login OTP request.
- OTP input UI.
- Token issuance after OTP verification.
- Local auth session storage.
- Role-aware routing.

### Admin Login

Admin login is separate from candidate login.

Capabilities include:

- Admin credential validation.
- JWT session creation.
- Redirect to admin dashboard.
- Guard against candidate access to admin routes.

### Current User Profile API

Authenticated users can:

- Fetch current session/user data.
- Update profile fields.
- Preserve role and status.

## 6. Candidate Portal Modules

### Candidate Dashboard

The dashboard summarizes candidate activity.

Capabilities include:

- Purchased exams count.
- Certificates count.
- Attempt statistics.
- Pass/fail status.
- Recently issued certificates.
- Notifications.
- Quick navigation to exams, payments, certificates, and history.

### Available Exams

Candidates can browse purchasable published exams.

Capabilities include:

- List available exams.
- Show exam category, price, duration, pass score, max attempts, proctoring requirements, and description.
- Show purchase/schedule flow.
- Validate ownership and schedule state.
- Open schedule and payment dialog.
- Apply vouchers before checkout.

### My Exams

The My Exams page manages purchased and scheduled exams.

Capabilities include:

- View paid exams.
- Show scheduled start and end.
- Show one-year attend-by deadline.
- Display schedule phase: not scheduled, too early, waiting, ready, in progress, expired, completed, or booking expired.
- Start exam from ready state.
- Enter waiting room before scheduled start.
- Start immediately where supported.
- Reschedule eligible exams.
- Show attempt counts and attempts remaining.
- Handle in-progress/resume state.
- Launch pre-start identity verification.

### Exam Waiting Room

The waiting room handles scheduled exams before start.

Capabilities include:

- Show exam title and scheduled time.
- Track schedule availability.
- Allow join when the exam enters the ready window.
- Prevent starting too early.

### Exam Pre-Start and Identity Verification

Before webcam-enabled exams, the candidate completes identity verification.

Capabilities include:

- Camera preview.
- Selfie capture.
- MyKad / ID capture.
- Optional MyKad file upload.
- Identity verification API call.
- Match score display.
- Retry on failure.
- Start exam only after verification succeeds.
- Store both selfie and ID image for admin review.
- Request fullscreen from user gesture where required.
- Show exam starting overlay.

### Exam Taking Module

The exam route provides the secure exam-taking experience.

Capabilities include:

- Load exam session from API or session storage.
- Timed exam countdown.
- Multiple-choice, true/false, and scenario questions.
- Question image support.
- Code block rendering for technical questions.
- Answer selection and local answer state.
- Fullscreen gate and fullscreen enforcement.
- Submit confirmation before leaving fullscreen.
- Copy/paste/context menu prevention.
- Browser reload/leave guard.
- End attempt and leave flow.
- Auto-submit when time expires.
- Submit answers and calculate score.
- Generate certificate on pass.
- Invalidate candidate caches after completion.
- Release camera after exit.

### Proctoring During Exam

The exam route integrates automated proctoring.

Capabilities include:

- Webcam frame capture.
- Frame upload to backend.
- Backend proxy to Python proctoring service.
- Face detection.
- Multiple-person detection.
- Phone detection when heavy detection is enabled.
- Looking-away detection when heavy detection is enabled.
- Warning count display.
- Proctoring violations saved to database.
- Auto-end after violation threshold.
- Admin visibility of monitoring and violation data.

### Exam Completion

The completion page displays:

- Exam title.
- Score.
- Pass/fail result.
- Pass score.
- Credential ID when certificate is issued.
- Navigation back to dashboard/certificates.

### Payments and Invoices

Candidates can view and manage payment records.

Capabilities include:

- View Stripe payments.
- View payment status.
- Resume eligible pending payments.
- Cancel pending payments.
- Download invoice PDFs.
- Preview invoice details.
- Confirm payment return after Stripe checkout.

### Certificates

Candidates can manage certificates.

Capabilities include:

- View earned certificates.
- Download certificate PDF.
- Open public certificate verification page.
- Copy share link.
- Display score, exam, credential ID, and issue date.

### Exam History

Candidates can view historical attempts.

Capabilities include:

- Attempt date.
- Exam title.
- Score.
- Result.
- Completion state.

### Profile Settings

Candidates can update profile data.

Capabilities include:

- Full name.
- Phone.
- IC/passport.
- MyCAT.
- Degree.
- Date of birth.
- Notification preference UI.

## 7. Payment and Scheduling Module

### Stripe Checkout

The platform integrates with Stripe for payment checkout.

Capabilities include:

- Create Stripe checkout sessions.
- Include exam purchase metadata.
- Handle success and cancel URLs.
- Resume existing pending Stripe sessions where possible.
- Support free/zero-total purchases after voucher discount.
- Confirm return from Stripe.
- Handle Stripe webhooks.

### Payment Fulfillment

Payment fulfillment includes:

- Marking payment as paid.
- Assigning one-year attend-by deadline.
- Incrementing voucher usage.
- Recording voucher redemption.
- Sending invoice email.
- Idempotent handling for repeated fulfillment attempts.

### Scheduling

Scheduling is based on Malaysia time (`Asia/Kuala_Lumpur`).

Capabilities include:

- Book exams from today up to one year ahead.
- Generate 30-minute slot increments.
- Default bookable window from 10:00 to 18:00.
- Validate scheduled date and time.
- Allow 10-minute early waiting-room access.
- Track schedule phases.
- Support rescheduling.
- Support immediate-start flow.
- Snap display labels to 30-minute slot boundaries.

### Vouchers

Voucher capabilities include:

- Bulk voucher batch generation.
- 32-character alphanumeric codes.
- Percentage or fixed MYR discounts.
- Expiry dates.
- Active/inactive state.
- Per-voucher usage limits.
- Per-user batch redemption guard.
- Exam-specific voucher associations.
- Voucher validation at checkout.
- Voucher CSV export.
- Voucher usage tracking and remaining-use display.

## 8. Admin Portal Modules

### Admin Dashboard

The admin dashboard summarizes platform activity.

Capabilities include:

- Total users.
- Active exams.
- Payments.
- Passed/failed/ongoing attempts.
- Violations.
- Voucher usage metrics.
- Charts for recent activity.
- Live status cards.
- Navigation to management modules.

### Admin Layout and Navigation

Admin navigation includes:

- Dashboard.
- Exam Management.
- Question Bank.
- AI Generator.
- Users.
- Payments.
- Vouchers.
- Question Pools.
- Exam Monitoring.
- Results.
- Certificates.
- Reports.
- Settings.

Additional layout capabilities:

- Global admin search for users, exams, questions, and vouchers.
- Admin notification popover.
- Unread notification count.
- Mark notifications as read.
- Profile dropdown.
- Theme toggle.
- Logout.

### Exam Management

Admins can manage certification exams.

Capabilities include:

- List exams.
- Create exams.
- Edit exams.
- Publish, draft, and archive status.
- Duplicate exams.
- Delete exams when allowed.
- Prevent deleting exams with payments or issued certificates.
- Configure category, description, duration, question count, pass score, max attempts, price, start/end dates.
- Configure proctoring, fullscreen, tab detection, and webcam requirements.
- Attach question pools for randomized question selection.
- Assign questions directly to exams.
- Assign exams to candidates for testing.

### Question Bank

Admins can manage reusable questions.

Capabilities include:

- Create questions.
- Edit questions.
- Delete questions.
- Bulk delete.
- Bulk upload using CSV.
- Assign existing questions to exams.
- Filter by exam, topic, type, difficulty, and search.
- Preview questions.
- Support multiple-choice, true/false, and scenario question types.
- Support code snippets.
- Support explanations.
- Support tags.
- Support optional question images stored as base64 data URLs.
- Topic selection and topic filter generation.

### AI Question Generator

Admins can generate question drafts with AI.

Capabilities include:

- Generate from topic/syllabus prompt.
- Generate from uploaded PDF.
- Select count up to 50 in the UI.
- Select difficulty.
- Select question type or mixed generation.
- Preview generated questions.
- Accept individual questions into the bank.
- Accept all generated questions into the bank.
- Save to a selected target exam.
- Detect whether Groq is configured.
- Fall back to template-generated questions when AI is unavailable or parsing fails.
- Extract text from PDF before generation.

### Question Pools

Question pools allow admins to create reusable question sets.

Capabilities include:

- Create pools.
- Edit pools.
- Delete pools.
- Activate/deactivate pools.
- Select existing bank questions.
- Search questions by title, topic, or type.
- Bulk import CSV rows into a new pool.
- Save imported rows into the question bank.
- Link imported/new questions to the pool.
- Show question count.
- Download pool as PDF with questions, options, correct answers, and explanations.
- Attach active pools to exams for randomized exam generation.

### User Management

Admins can manage candidate accounts.

Capabilities include:

- List users.
- Search/filter users.
- View user detail page.
- View user profile fields.
- View user attempts.
- View user payments.
- View user violations.
- View user certificates.
- Assign exams for testing.
- Suspend/reactivate users.
- Reset attempts for all exams or a specific exam.
- Download user report CSV.
- Open identity verification image review from attempt rows.

### Payments Admin

Admins can review payment activity.

Capabilities include:

- List payment transactions.
- View candidate, exam, amount, voucher, invoice ID, and status.
- Filter/search payments.
- Preview invoice information.
- Mark/refund payment state through admin endpoint.
- Track paid/pending/refunded totals.

### Voucher Admin

Admins can manage voucher batches.

Capabilities include:

- Generate uncapped voucher batches.
- Configure batch label.
- Configure quantity.
- Configure discount type and amount.
- Configure max uses per voucher.
- Configure expiry.
- Activate/deactivate entire batch.
- Expand batch to inspect individual voucher codes.
- View used count and usage limit per code.
- View redemption users.
- Export voucher batch CSV.
- Delete voucher batches through API.

### Exam Monitoring

Admins can monitor active sessions.

Capabilities include:

- List in-progress attempts.
- Show candidate, exam, started time, warnings, and status.
- View violations per session.
- View recent proctoring events.
- Filter options for exams and students.
- Open identity verification review.
- Identify flagged sessions.

### Identity Verification Review

Admins can review identity verification evidence.

Capabilities include:

- Load identity evidence by attempt.
- Display candidate name, exam, and captured time.
- Show selfie photo.
- Show MyKad / ID photo.
- Fall back to legacy single image for older attempts.
- Support review from monitoring, results, and user detail screens.

### Results

Admins can review completed attempt outcomes.

Capabilities include:

- List pass/fail results.
- Filter by exam.
- Search and score filtering UI.
- Show pass/fail analytics.
- Open identity verification review.

### Certificates Admin

Admins can manage issued certificates.

Capabilities include:

- List certificates.
- Filter by exam.
- Search candidate/exam/credential.
- Download certificate placeholder/text export.
- Regenerate credential IDs.
- Track issue date and score.

### Reports

Admins can export CSV reports.

Supported report types include:

- Revenue.
- Users.
- Exams.
- Payments.
- Results.
- Violations.
- Certificates.

### Settings

Admin settings include:

- Admin profile display.
- Platform configuration interface.
- Theme support.

## 9. Certificate Module

Certificate capabilities include:

- Automatic certificate creation when a candidate passes an exam.
- Credential ID generation.
- Public verification page.
- Candidate certificate list.
- Candidate certificate PDF download.
- Admin certificate list.
- Credential regeneration by admin.
- Certificate preview using `certificate-template.png`.
- Certificate title styling through shared heading CSS.
- PDF certificate generation through Puppeteer.
- Sample certificate review route.

Certificate assets:

- Web preview template: `proctor-ace-ui/public/certificate-template.png`
- API/PDF template: `api/assets/certificate-template.png`
- Certificate layout config: `api/src/config/certificate-layout.json`

## 10. PDF and Document Generation

### Invoice PDF

Invoices include:

- Invoice ID.
- Candidate billing details.
- Exam title and description.
- Amount.
- Discount amount where voucher is used.
- Voucher code where applicable.
- Payment status.
- Company details from environment variables.

Invoice PDFs are generated with PDFKit and sent as downloadable files or email attachments.

### Certificate PDF

Certificates are generated by:

- Building HTML/CSS from certificate data.
- Embedding certificate background template.
- Rendering through Puppeteer/headless Chromium.
- Returning a downloadable PDF.

### Question Pool PDF

Question pool PDFs include:

- Ventrix logo header.
- Pool name.
- Question count.
- Pool description.
- Each question.
- Topic.
- Options.
- Correct answer.
- Explanation.

## 11. AI and PDF Extraction Module

AI capabilities:

- Groq chat completion API integration.
- JSON parsing and normalization.
- Question type normalization.
- Multiple-choice fallback options.
- True/false option normalization.
- Scenario question support.
- Template fallback when Groq is unavailable.
- PDF text extraction through backend service.
- Generated tags and explanations.

## 12. Proctoring Module

### Browser-Side Proctoring

Candidate browser capabilities:

- Camera acquisition before exam start.
- Periodic frame capture during exam.
- Upload frames to backend.
- Show warnings.
- Trigger auto-end when limits are reached.
- Release camera after completion or exit.

### Backend Proctoring Proxy

Backend capabilities:

- Accept frame data.
- Proxy frame analysis to Python service through `PROCTORING_SERVICE_URL`.
- Fallback to local Python script when available.
- Return safe default if service is unavailable.
- Save proctoring violations to database.

### Python Proctoring Service

Python service capabilities:

- FastAPI app.
- `/health` endpoint.
- `/analyze-frame` endpoint.
- `/verify-identity` endpoint.
- OpenCV Haar face detection by default.
- Multiple-face/no-face detection.
- Optional heavy detection for phone and looking away when enabled.
- MyKad/selfie identity verification.
- Optional heavy detection depends on optional YOLO/MediaPipe runtime support; the lightweight requirements install the default OpenCV-based flow.

## 13. Data Storage and Media Handling

The platform stores primary application data in MySQL/TiDB through Prisma.

Important stored entities:

- Users.
- OTP codes.
- Exams.
- Questions.
- Question pools.
- Vouchers.
- Voucher batches.
- Voucher redemptions.
- Payments.
- Exam attempts.
- Attempt question selections.
- Certificates.
- Proctoring violations.

Media storage approach:

- Question images are stored as base64 data URLs in the `Question.imageUrl` long text field.
- Identity verification images are stored as base64 data URLs in `ExamAttempt` long text fields:
  - `identitySelfiePhoto`
  - `identityIdPhoto`
  - `identityPhoto` for legacy compatibility.
- Certificate and logo templates are stored as repository assets.
- Generated PDFs are produced on demand and not persisted as files by default.

## 14. Notifications

Candidate notifications include:

- Recent certificate issuance.
- Payment activity.
- Exam state/activity notices.

Admin notifications include:

- Alerts and information notices.
- Unread count.
- Mark-as-read behavior.
- Lazy loading when notification popover opens.

## 15. Security and Integrity Capabilities

Security-related features include:

- JWT authentication.
- Role-based route protection.
- Admin-only API areas.
- Candidate-only API areas.
- Password hashing.
- OTP verification.
- CORS origin control.
- Stripe webhook signature verification.
- No-store API caching headers.
- Fullscreen exam enforcement.
- Webcam identity check.
- Proctoring violation tracking.
- Attempt limit enforcement.
- Voucher redemption limits.
- Protected invoice and certificate downloads.
- Public certificates exposed only through credential ID lookup.

## 16. Technical Information

### Repository Structure

The project is a monorepo with these main applications:

- `proctor-ace-ui`: React/TanStack frontend.
- `api`: Node.js Express API.
- `proctoring-service`: Python FastAPI proctoring service.

### Frontend Stack

Frontend technologies:

- React 19.
- TanStack Router.
- TanStack React Query.
- TanStack Start.
- Vite.
- TypeScript.
- Tailwind CSS 4.
- Radix UI primitives.
- Lucide icons.
- Sonner toast notifications.
- Recharts for charts.
- Netlify/TanStack plugin support.
- Cloudflare Workers build support.

Important frontend architecture files:

- Router/query setup: `proctor-ace-ui/src/router.tsx`, `proctor-ace-ui/src/routes/__root.tsx`, `proctor-ace-ui/src/lib/query-client.ts`.
- Auth/session helpers: `proctor-ace-ui/src/lib/auth.ts`.
- API helpers: `proctor-ace-ui/src/lib/api-client.ts`, `proctor-ace-ui/src/lib/api-auth.ts`.
- Candidate layout: `proctor-ace-ui/src/components/dashboard-layout.tsx`.
- Admin layout: `proctor-ace-ui/src/components/admin-layout.tsx`.
- Auth layout: `proctor-ace-ui/src/components/auth-layout.tsx`.
- Generated route tree: `proctor-ace-ui/src/routeTree.gen.ts`.

Frontend scripts:

- `npm run dev`: start local Vite dev server.
- `npm run build`: production frontend build.
- `npm run build:cloudflare`: Cloudflare build.
- `npm run deploy:cloudflare`: Cloudflare deploy.
- `npm run lint`: ESLint.
- `npm run format`: Prettier.

Local frontend URL:

- `http://localhost:8080`

### Backend Stack

Backend technologies:

- Node.js.
- Express 5.
- TypeScript.
- Prisma ORM.
- MySQL/TiDB.
- JWT.
- bcryptjs.
- Zod validation.
- Stripe SDK.
- PDFKit.
- Puppeteer/Puppeteer Core.
- `@sparticuz/chromium` for production Chromium.
- Multer for PDF upload.
- `pdf-parse` for PDF text extraction.
- Brevo transactional email API.

Backend scripts:

- `npm run dev`: start API with `tsx watch`.
- `npm run build`: TypeScript compile.
- `npm start`: run compiled API.
- `npm run db:generate`: Prisma generate.
- `npm run db:push`: Prisma schema push.
- `npm run db:seed`: seed users/data.
- `npm run stripe:listen`: Stripe webhook forwarding for local development.

Local backend URL:

- `http://localhost:3001`

### API Route Groups

Main API route groups:

- `/api/health`
- `/api/auth`
- `/api/exams`
- `/api/admin`
- `/api/payments`
- `/api/attempts`
- `/api/candidate`
- `/api/certificates`

### Database Models

Prisma models:

- `User`
- `OtpCode`
- `Exam`
- `Question`
- `QuestionPool`
- `QuestionPoolItem`
- `VoucherBatch`
- `Voucher`
- `VoucherRedemption`
- `VoucherExam`
- `Payment`
- `ExamAttempt`
- `AttemptQuestion`
- `Certificate`
- `ProctoringViolation`

Enums:

- `Role`
- `UserStatus`
- `ExamStatus`
- `PaymentStatus`
- `AttemptResult`
- `OtpPurpose`
- `QuestionType`

### Environment Variables

Important backend environment variables:

- `PORT`
- `NODE_ENV`
- `DATABASE_URL`
- `JWT_SECRET`
- `JWT_EXPIRES_IN`
- `CLIENT_URL`
- `CLIENT_URLS`
- `BREVO_API_KEY`
- `BREVO_SENDER_EMAIL`
- `BREVO_SENDER_NAME`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_SUCCESS_URL`
- `STRIPE_CANCEL_URL`
- `GROQ_API_KEY`
- `GROQ_MODEL`
- `PROCTORING_SERVICE_URL`
- `INVOICE_COMPANY_NAME`
- `INVOICE_COMPANY_LEGAL_NAME`
- `INVOICE_COMPANY_ADDRESS`
- `INVOICE_COMPANY_EMAIL`
- `INVOICE_COMPANY_PHONE`
- `INVOICE_COMPANY_WEBSITE`
- `INVOICE_COMPANY_TAX_ID`
- `PUPPETEER_SKIP_CHROMIUM_DOWNLOAD`

Important frontend environment variables:

- `VITE_API_URL`

### External Integrations

Stripe:

- Checkout sessions.
- Webhooks.
- Payment session resume.
- Checkout cancellation.
- Invoice/payment fulfillment.

Brevo:

- OTP emails.
- Invoice emails.

Groq:

- AI question generation from prompts.
- AI question generation from PDF-extracted text.

Proctoring service:

- Frame analysis.
- Identity verification.
- Webcam exam monitoring.

### Deployment

Backend deployment:

- Render web service.
- Root directory: `api`.
- Build command: `npm install --include=dev && npx prisma generate && npm run build && npx prisma db push`.
- Start command: `npm start`.
- Health check: `/api/health`.

Proctoring deployment:

- Render web service.
- Root directory: `proctoring-service`.
- Build command: `pip install -r requirements.txt`.
- Start command: `uvicorn server:app --host 0.0.0.0 --port $PORT`.
- Health check: `/health`.

Frontend deployment:

- Cloudflare Workers build supported through `vite.config.cloudflare.ts`.
- Netlify/TanStack Start build supported through `vite.config.ts`.
- Production domain referenced in the project: `https://www.ventrix.global`.

### Caching and Runtime Behavior

Runtime behavior includes:

- API responses set `Cache-Control: no-store`.
- React Query is used for client data fetching.
- Data loaders are scoped for candidate/admin pages.
- Notifications are lazy-loaded to reduce dashboard load.
- Exam sessions are stored in browser session storage for reload resilience.
- Client-only wrappers are used for hydration-sensitive routes.
- Scheduled behavior is request-driven; there is no dedicated cron/background scheduler in the current codebase.

### Local Development

Typical local startup:

```bash
cd api
npm run dev
```

```bash
cd proctor-ace-ui
npm run dev
```

Optional proctoring service:

```bash
cd proctoring-service
pip install -r requirements.txt
uvicorn server:app --host 127.0.0.1 --port 8765
```

Local URLs:

- Frontend: `http://localhost:8080`
- API: `http://localhost:3001`
- Proctoring: `http://127.0.0.1:8765`

## 17. Key Business Workflows

### Candidate Certification Flow

1. Candidate registers.
2. Candidate verifies email via OTP.
3. Candidate logs in.
4. Candidate browses available exams.
5. Candidate schedules and pays for an exam.
6. Candidate enters waiting room or starts immediately.
7. Candidate completes selfie and MyKad verification.
8. Candidate enters fullscreen exam mode.
9. Candidate answers questions under proctoring.
10. Candidate submits or is auto-submitted when time expires.
11. System calculates score.
12. System issues certificate if passed.
13. Candidate downloads certificate and shares public verification link.

### Admin Exam Publishing Flow

1. Admin creates or edits an exam.
2. Admin configures exam rules, pricing, attempt limits, and proctoring.
3. Admin adds questions directly or links a question pool.
4. Admin publishes exam.
5. Candidates can purchase and schedule the exam.

### AI Question Generation Flow

1. Admin opens AI generator.
2. Admin chooses topic/syllabus or PDF source.
3. Admin sets count, difficulty, and question type.
4. System requests Groq generation or uses template fallback.
5. Admin reviews generated drafts.
6. Admin accepts individual or all questions into the bank.

### Voucher Purchase Flow

1. Admin generates voucher batch.
2. Candidate enters voucher during checkout.
3. System validates expiry, activity, exam applicability, usage count, and batch allowance.
4. Discount is applied to checkout.
5. On payment fulfillment, usage count and redemption are recorded.

### Proctored Exam Flow

1. Candidate starts pre-check.
2. Candidate captures selfie and MyKad/ID.
3. Backend verifies identity through proctoring service.
4. Exam starts in fullscreen.
5. Browser sends webcam frames for analysis.
6. Violations are recorded.
7. Violation threshold can end the attempt.
8. Admin can review warnings and identity evidence.

## 18. Important Files and Ownership Areas

Frontend:

- `proctor-ace-ui/src/routes`: route-level pages.
- `proctor-ace-ui/src/components`: shared UI and feature components.
- `proctor-ace-ui/src/lib`: client API/auth/session helpers.
- `proctor-ace-ui/src/hooks`: browser/runtime hooks.
- `proctor-ace-ui/public`: public assets and certificate template.

Backend:

- `api/src/routes`: REST route handlers.
- `api/src/services`: domain services and integrations.
- `api/src/lib`: shared backend utilities.
- `api/prisma/schema.prisma`: database schema.
- `api/assets`: PDF/certificate/logo assets.

Proctoring:

- `proctoring-service/server.py`: FastAPI service entry.
- `proctoring-service/yolo_detector.py`: analysis and identity verification implementation.
- `proctoring-service/analyze_once.py`: local script fallback.

Deployment:

- `render.yaml`
- `api/render.yaml`
- `proctoring-service/render.yaml`
- `proctor-ace-ui/vite.config.ts`
- `proctor-ace-ui/vite.config.cloudflare.ts`

## 19. Current Brand Scope

Branding is centralized around Ventrix Global.

Brand assets and metadata include:

- `proctor-ace-ui/src/lib/branding.ts`
- `proctor-ace-ui/public/ventrix_logo.png`
- `api/assets/ventrix_logo.png`
- `proctor-ace-ui/public/favicon.svg`
- `api/assets/ventrix-logo.svg`

Brand values used in the app:

- Name: Ventrix Global.
- Short name: Ventrix.
- Tagline: Enterprise certification & secure exam delivery.
- Website: `https://www.ventrix.global`.
- Support email: `support@ventrix.global`.
- Certificate heading: `VENTRIX GLOBAL CERTIFIED`.

## 20. Notes and Considerations

- Identity verification photos are stored in the database as base64 data URLs, not in object storage.
- Question images are also stored as base64 strings.
- Large base64 media in the database is simple operationally but can increase database size and payload sizes over time.
- Production deployment uses `prisma db push`, so schema updates are applied during backend deploy.
- Some internal infrastructure names still use the legacy `nexperts` service naming for continuity.
- The frontend build may need a larger Node heap on constrained machines for production build.
- The proctoring service has lightweight default detection and optional heavy detection controlled by environment configuration.
