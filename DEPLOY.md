# Ops AI — Deployment Guide

## Quick Start (Docker)

### 1. Clone & configure
```bash
git clone https://github.com/lwhobley/opsai.git
cd opsai

# Backend env
cp backend/.env.example backend/.env
# Edit backend/.env — fill in all required values

# Frontend env
cp frontend/.env.example frontend/.env
# Edit frontend/.env — set REACT_APP_BACKEND_URL
```

### 2. Generate a JWT secret
```bash
openssl rand -hex 64
# Paste output into backend/.env as JWT_SECRET
```

### 3. Run
```bash
docker-compose up -d
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:8001
- API docs: http://localhost:8001/docs

### 4. First login
Use the `ADMIN_PIN` you set in `backend/.env`.

---

## Environment Variables

### Backend (required)
| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Supabase PostgreSQL connection string |
| `JWT_SECRET` | Random 64-byte hex string — generate with `openssl rand -hex 64` |
| `ADMIN_PIN` | 4 or 6 digit PIN for the initial admin user |
| `GEMINI_API_KEY` | Google Gemini API key |
| `FRONTEND_URL` | Frontend origin(s) for CORS — comma-separated |

### Backend (optional)
| Variable | Default | Description |
|----------|---------|-------------|
| `COOKIE_SECURE` | `false` | Set `true` in production (HTTPS) |
| `TARGET_POUR_COST_PCT` | `20.0` | Pour cost target % for reports |
| `TARGET_FOOD_COST_PCT` | `30.0` | Food cost target % for reports |
| `TOAST_API_BASE_URL` | Toast production URL | Set to sandbox URL for testing |
| `LOGIN_RATE_LIMIT` | `10` | Max login attempts per window |
| `LOGIN_RATE_WINDOW` | `300` | Rate limit window in seconds |

### Frontend
| Variable | Description |
|----------|-------------|
| `REACT_APP_BACKEND_URL` | Backend URL — no trailing slash |

---

## Production Deployment (Render.com — Recommended)

### Backend
1. New Web Service → connect GitHub repo
2. Root directory: `backend`
3. Runtime: Python 3
4. Build command: `pip install -r requirements.txt`
5. Start command: `uvicorn server:app --host 0.0.0.0 --port $PORT --workers 2`
6. Add all env vars from the table above
7. Set `COOKIE_SECURE=true`

### Frontend
1. New Static Site → connect GitHub repo
2. Root directory: `frontend`
3. Build command: `npm ci && npm run build`
4. Publish directory: `build`
5. Add env var: `REACT_APP_BACKEND_URL=https://your-backend.onrender.com`
6. Add redirect rule: `/* → /index.html` (200 rewrite for React Router)

### After deploy
1. Update `FRONTEND_URL` in backend env to your frontend's URL
2. Login with your `ADMIN_PIN`
3. Create staff and manager accounts in More → Users
4. Connect Toast in More → Integrations when credentials are ready

---

## Supabase Setup

1. Create project at supabase.com
2. Go to Settings → Database → Connection string → Transaction pooler
3. Copy the URL and set as `DATABASE_URL` in backend `.env`
4. Tables are created automatically on first startup via SQLAlchemy

---

## Toast POS Setup (when ready)

1. Log into Toast Web → Integrations → API Access
2. Copy: Restaurant GUID, Client ID, Client Secret
3. In Ops AI: More → Integrations → Connect Toast
4. Hit Sync Now to pull sales

For testing before production credentials: set `TOAST_API_BASE_URL=https://ws-sandbox-api.eng.toasttab.com` in backend env.

---

## Updating

```bash
git pull
docker-compose up -d --build
```
