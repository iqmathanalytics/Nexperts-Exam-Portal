# Deploying NExperts Exam Portal

Deploy **three parts** for best performance:

| Service | Platform | Folder | URL example |
|---------|----------|--------|-------------|
| Frontend | **Netlify** | `proctor-ace-ui/` | `https://your-app.netlify.app` |
| API (backend) | **Render** | `api/` | `https://nexperts-api.onrender.com` |
| Proctoring | **Render** (separate) | `proctoring-service/` | `https://nexperts-proctoring.onrender.com` |
| Database | **TiDB Cloud** | — | connection string in `DATABASE_URL` |

**Order:** GitHub → Render (API + proctoring) → Netlify → Stripe webhook → smoke test.

---

## Step 0 — Push code to GitHub

If the project is not on GitHub yet:

```bash
cd "e:\Nexperts Exam Portal"
git init
git add .
git commit -m "NExperts Exam Portal: scheduling, proctoring, admin UI"
```

Create a new repo on GitHub (empty, no README), then:

```bash
git remote add origin https://github.com/YOUR_USERNAME/nexperts-exam-portal.git
git branch -M main
git push -u origin main
```

Do **not** commit `api/.env` or `proctor-ace-ui/.env` (they are in `.gitignore`).

---

## Step 1 — Deploy on Render (API + Proctoring)

### Option A — One Blueprint (recommended)

1. Go to [Render Dashboard](https://dashboard.render.com) → **New** → **Blueprint**.
2. Connect your **GitHub** account and select the repo.
3. Render reads the root **`render.yaml`** and creates:
   - `nexperts-api` (Node)
   - `nexperts-proctoring` (Python)
4. Fill in **sync: false** environment variables when prompted (see tables below).
5. Wait for both services to deploy. Note both URLs.

### Option B — Manual (two web services)

**API**

1. **New → Web Service** → connect repo.
2. **Root directory:** `api`
3. **Build:** `npm install --include=dev && npx prisma generate && npm run build && npx prisma db push`
4. **Start:** `npm start`
5. **Health check:** `/api/health`

**Proctoring**

1. **New → Web Service** → **Python 3**.
2. **Root directory:** `proctoring-service`
3. **Build:** `pip install -r requirements.txt`
4. **Start:** `uvicorn server:app --host 0.0.0.0 --port $PORT`
5. **Health check:** `/health`

---

### API environment variables (Render → `nexperts-api`)

| Variable | Value |
|----------|--------|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | TiDB connection string |
| `JWT_SECRET` | Long random string (Render can generate) |
| `CLIENT_URL` | Your Netlify URL (set after Step 2) |
| `CLIENT_URLS` | Same Netlify URL (+ preview URLs if needed) |
| `BREVO_API_KEY` | From Brevo |
| `BREVO_SENDER_EMAIL` | Verified sender |
| `STRIPE_SECRET_KEY` | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | After Stripe webhook (Step 4) |
| `STRIPE_SUCCESS_URL` | `https://YOUR-SITE.netlify.app/payment-success` |
| `STRIPE_CANCEL_URL` | `https://YOUR-SITE.netlify.app/dashboard/exams?canceled=1` |
| `GROQ_API_KEY` | Groq API key (optional) |
| **`PROCTORING_SERVICE_URL`** | `https://nexperts-proctoring.onrender.com` (no trailing slash) |

**Smoke test:**

```bash
curl https://nexperts-api.onrender.com/api/health
curl https://nexperts-proctoring.onrender.com/health
```

---

### Proctoring environment variables (Render → `nexperts-proctoring`)

| Variable | Value |
|----------|--------|
| `ENABLE_HEAVY_DETECTION` | `false` (default Haar; set `true` only if you install YOLO/MediaPipe on Render) |

---

## Step 2 — Deploy frontend on Netlify (detailed)

Your API is already live at **https://nexperts-api.onrender.com**. Netlify will host only the UI in `proctor-ace-ui/`.

### 2.1 — Create the Netlify site

1. Open **[Netlify](https://app.netlify.com)** and sign in (GitHub login is easiest).
2. Click **Add new site** → **Import an existing project**.
3. Choose **GitHub** and authorize Netlify if asked.
4. Select repo: **`iqmathanalytics/Nexperts-Exam-Portal`**.
5. On **Configure project**, set:

| Setting | Value |
|---------|--------|
| **Branch to deploy** | `main` |
| **Base directory** | `proctor-ace-ui` |
| **Build command** | `npm run build` |
| **Publish directory** | `dist/client` |
| **Node version** | `22` (or leave blank — `netlify.toml` sets `NODE_VERSION = "22"`) |

> Netlify reads `proctor-ace-ui/netlify.toml` automatically when base directory is `proctor-ace-ui`. You should see build command and publish dir pre-filled after you set the base directory.

6. Expand **Environment variables** (before first deploy) and add:

| Key | Value |
|-----|--------|
| `VITE_API_URL` | `https://nexperts-api.onrender.com` |

**Important:** No trailing slash. Do **not** use `http://localhost:3001` in production.

7. Click **Deploy site**. First build usually takes **3–8 minutes** (TanStack Start + Netlify plugin).

8. When deploy status is **Published**, open the site URL (e.g. `https://nexperts-exam-portal.netlify.app` or a random name). Copy this URL — you need it for Render and Stripe.

### 2.2 — Optional: rename the site URL

1. **Site configuration** → **Domain management** → **Options** on `*.netlify.app`.
2. **Set custom subdomain** (e.g. `nexperts-exam` → `https://nexperts-exam.netlify.app`).

### 2.3 — Wire Netlify URL back to Render API (required)

The API only allows browser requests from origins listed in `CLIENT_URL` / `CLIENT_URLS`. Until you update these, login and API calls from Netlify will fail with **CORS** errors.

1. Open [Render → nexperts-api](https://dashboard.render.com/web/srv-d8a8ubojo6nc73e95m6g) → **Environment**.
2. Update (replace `YOUR-NETLIFY-URL` with your real URL, **no trailing slash**):

| Variable | Example value |
|----------|----------------|
| `CLIENT_URL` | `https://YOUR-NETLIFY-URL.netlify.app` |
| `CLIENT_URLS` | `https://YOUR-NETLIFY-URL.netlify.app` |
| `STRIPE_SUCCESS_URL` | `https://YOUR-NETLIFY-URL.netlify.app/payment-success` |
| `STRIPE_CANCEL_URL` | `https://YOUR-NETLIFY-URL.netlify.app/dashboard/exams?canceled=1` |

3. If you use **Netlify branch deploys** (preview URLs like `https://deploy-preview-1--site.netlify.app`), add each preview origin to `CLIENT_URLS`, comma-separated:

```text
https://YOUR-NETLIFY-URL.netlify.app,https://main--YOUR-SITE-NAME.netlify.app
```

4. Click **Save changes**. Render will redeploy the API automatically.

### 2.4 — Verify Netlify ↔ API

1. Open your Netlify URL in a **private/incognito** window.
2. Open browser **DevTools** → **Network**.
3. Try **candidate login** (OTP) or **admin login**.
4. Confirm requests go to `https://nexperts-api.onrender.com/...`, not `localhost:3001`.
5. If you see CORS errors, double-check `CLIENT_URLS` matches the **exact** origin in the browser address bar (scheme + host, no path).

### 2.5 — Redeploy after env changes

| Change | Action |
|--------|--------|
| Changed `VITE_API_URL` on Netlify | **Deploys** → **Trigger deploy** → **Deploy site** |
| Changed `CLIENT_URLS` on Render | Wait for Render auto-redeploy (~2 min) |
| Changed code on `main` | Both Netlify and Render auto-deploy if connected to GitHub |

### 2.6 — Netlify build troubleshooting

| Symptom | Fix |
|---------|-----|
| Build fails: cannot find module | Ensure **Base directory** = `proctor-ace-ui` (not repo root) |
| Build fails: Node version | Set `NODE_VERSION` = `22` in Netlify env or use `netlify.toml` |
| Site loads but API is localhost | Set `VITE_API_URL` and **redeploy** Netlify |
| 404 on refresh / deep links | TanStack Start Netlify plugin should handle this; confirm `@netlify/vite-plugin-tanstack-start` is in `vite.config.ts` |
| CORS on login/checkout | Update `CLIENT_URLS` on Render with exact Netlify URL |

---

## Step 3 — Stripe webhook

1. [Stripe Dashboard](https://dashboard.stripe.com) → **Developers** → **Webhooks** → **Add endpoint**.
2. **URL:** `https://nexperts-api.onrender.com/api/payments/webhook`
3. **Events:** `checkout.session.completed`, `checkout.session.async_payment_succeeded`
4. Copy **Signing secret** → Render `STRIPE_WEBHOOK_SECRET` on **nexperts-api**.

Update Stripe redirect URLs if you use a custom domain on Netlify.

---

## Step 4 — Production checklist

- [ ] `curl` API `/api/health` returns `{ "ok": true }`
- [ ] `curl` proctoring `/health` returns `{ "ok": true }`
- [ ] Netlify site loads; login works (OTP / admin)
- [ ] `VITE_API_URL` on Netlify points to Render API (not localhost)
- [ ] `PROCTORING_SERVICE_URL` on API points to Render proctoring URL
- [ ] `CLIENT_URLS` on API includes exact Netlify origin
- [ ] Schedule exam + Stripe checkout works
- [ ] Exam proctoring shows **FACE OK** with camera on

### Optional — seed database on Render

Render → **nexperts-api** → **Shell**:

```bash
npx tsx prisma/seed.ts
```

---

## Architecture

```
[Browser] → Netlify (proctor-ace-ui)
              ↓ VITE_API_URL
         Render API (api/) → TiDB
              ↓ PROCTORING_SERVICE_URL
         Render Proctoring (proctoring-service/)
```

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| CORS error | Add exact Netlify URL to `CLIENT_URLS` on API; redeploy API |
| API calls localhost | Set `VITE_API_URL` on Netlify; trigger new deploy |
| Proctoring always FACE OK / no checks | Set `PROCTORING_SERVICE_URL` on API; verify proctoring `/health` |
| False violations | Redeploy proctoring after latest `yolo_detector.py` |
| Stripe stuck | Webhook URL + `STRIPE_WEBHOOK_SECRET` on API |
| Render build fails Prisma | Ensure `DATABASE_URL` is set before build runs `db push` |

---

## Monorepo layout

```
Nexperts Exam Portal/
├── render.yaml              # Blueprint: API + proctoring
├── api/                     # Render Node service
├── proctoring-service/      # Render Python service
└── proctor-ace-ui/          # Netlify
```
