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
3. **Build:** `npm install && npx prisma generate && npm run build && npx prisma db push`
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

## Step 2 — Deploy frontend on Netlify

1. [Netlify](https://app.netlify.com) → **Add new site** → **Import from Git**.
2. Select the same GitHub repo.
3. **Site settings:**
   - **Base directory:** `proctor-ace-ui`
   - **Build command:** `npm run build` (from `netlify.toml`)
   - **Publish directory:** `dist/client`
   - **Node version:** 22
4. **Environment variables:**

| Variable | Value |
|----------|--------|
| `VITE_API_URL` | `https://nexperts-api.onrender.com` (your Render API URL) |

5. **Deploy site**. Copy the Netlify URL (e.g. `https://something.netlify.app`).

6. Go back to **Render → nexperts-api** and update:
   - `CLIENT_URL` = your Netlify URL
   - `CLIENT_URLS` = `https://your-app.netlify.app` (add `https://main--your-app.netlify.app` if you use branch deploys)
7. **Manual deploy** or wait for auto-redeploy on Render after env change.

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
