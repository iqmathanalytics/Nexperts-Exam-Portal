# Deploy frontend to Cloudflare Workers

The UI (`proctor-ace-ui`) is a TanStack Start app configured for **Cloudflare Workers** via `@cloudflare/vite-plugin` and Wrangler.

| Item | Value |
|------|--------|
| API (unchanged) | `https://nexperts-api.onrender.com` |
| Frontend | Cloudflare Workers (`*.workers.dev` or custom domain) |

---

## Prerequisites

- [Cloudflare account](https://dash.cloudflare.com/sign-up)
- Node.js **22** (match `engines` / CI)
- API already deployed on Render

---

## Option A — Deploy from your machine (CLI)

### 1. Install dependencies

```bash
cd proctor-ace-ui
npm install
```

### 2. Log in to Cloudflare

```bash
npx wrangler login
npx wrangler whoami
```

### 3. Set production API URL

Create `proctor-ace-ui/.env.production` (not committed):

```env
VITE_API_URL=https://nexperts-api.onrender.com
```

Or set in Cloudflare after first deploy: **Workers & Pages → your worker → Settings → Variables**.

| Variable | Value |
|----------|--------|
| `VITE_API_URL` | `https://nexperts-api.onrender.com` (no trailing slash) |

> `VITE_*` vars are baked in at **build** time. Rebuild and redeploy after changing them.

### 4. Build and deploy

```bash
npm run deploy:cloudflare
```

This runs `build:cloudflare` then `wrangler deploy`. Your site will be at:

`https://nexperts-exam-portal.<your-subdomain>.workers.dev`

### 5. Preview locally (optional)

```bash
npm run preview:cloudflare
```

---

## Option B — Deploy via Cloudflare dashboard (Git)

1. Open [Cloudflare Dashboard](https://dash.cloudflare.com) → **Workers & Pages** → **Create**.
2. Choose **Connect to Git** → select `iqmathanalytics/Nexperts-Exam-Portal`.
3. Configure:

| Setting | Value |
|---------|--------|
| **Production branch** | `main` |
| **Root directory** | `proctor-ace-ui` |
| **Build command** | `npm ci && npm run build:cloudflare` |
| **Deploy command** | `npx wrangler deploy` |

> Cloudflare must use **npm** (`package-lock.json`), not Bun. Do not add a `bun.lock` file in `proctor-ace-ui/`.

4. Add **environment variable** (build):

| Key | Value |
|-----|--------|
| `VITE_API_URL` | `https://nexperts-api.onrender.com` |

5. Save and deploy.

---

## Wire Cloudflare URL to the API (required)

Update Render → **nexperts-api** → **Environment**:

| Variable | Example |
|----------|---------|
| `CLIENT_URL` | `https://nexperts-exam-portal.your-subdomain.workers.dev` |
| `CLIENT_URLS` | Same URL (comma-separate preview URLs if needed) |
| `STRIPE_SUCCESS_URL` | `https://YOUR-CLOUDFLARE-URL/payment-success` |
| `STRIPE_CANCEL_URL` | `https://YOUR-CLOUDFLARE-URL/dashboard/exams?canceled=1` |

Save — Render redeploys the API automatically.

---

## Custom domain (optional)

1. **Workers & Pages** → your worker → **Settings** → **Domains & Routes**.
2. Add `exam.yourdomain.com` (or similar).
3. Add that origin to Render `CLIENT_URL` / `CLIENT_URLS` and Stripe redirect URLs.

---

## Netlify (still supported)

Netlify builds use the Netlify plugin explicitly:

```bash
npm run build:netlify
```

`netlify.toml` runs `build:netlify` so existing Netlify sites keep working.

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| CORS errors on login | Add Cloudflare URL to Render `CLIENT_URL` / `CLIENT_URLS` |
| API calls go to localhost | Set `VITE_API_URL` before build; redeploy |
| Build fails on Cloudflare | Use Node 22; ensure root dir is `proctor-ace-ui` |
| `nodejs_compat` errors | Already set in `wrangler.jsonc` |

**Smoke test:**

```bash
curl https://nexperts-api.onrender.com/api/health
```

Then open your Cloudflare URL in a private window and test login.
