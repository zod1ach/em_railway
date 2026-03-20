# Railway Deployment Guide

## Architecture

```
[React Frontend (Nginx)]  -->  [FastAPI Backend (Uvicorn)]
       :80                            :8000
```

Two Railway services from the same repo, different root directories.

## Step 1: Push to GitHub

```bash
cd em_calculator_web
git init
git add backend frontend DEPLOY.md
git commit -m "EM Calculator v2 — React + FastAPI"
git remote add origin <your-repo-url>
git push -u origin main
```

## Step 2: Create Backend Service on Railway

1. Railway dashboard -> New Project -> Deploy from GitHub
2. Select your repo
3. Settings:
   - **Root Directory**: `backend`
   - **Builder**: Dockerfile
4. Environment Variables:
   - `SECRET_KEY` = (generate: `python -c "import secrets; print(secrets.token_hex(32))"`)
   - `CORS_ORIGINS` = `https://<your-frontend>.railway.app`
   - `AUTH_USERNAME` = `UoS_EPE`
   - `AUTH_PASSWORD` = `EPEEMAPP2031`
5. Note the public URL (e.g., `https://em-api-xxx.railway.app`)

## Step 3: Create Frontend Service on Railway

1. Same project -> Add Service -> GitHub repo
2. Settings:
   - **Root Directory**: `frontend`
   - **Builder**: Dockerfile
3. Build Arguments:
   - `VITE_API_URL` = `https://em-api-xxx.railway.app` (your backend URL)
4. Environment Variables:
   - `API_URL` = `https://em-api-xxx.railway.app` (for nginx proxy)

## Step 4: Verify

- Visit the frontend URL
- Login with UoS_EPE / EPEEMAPP2031
- Run a calculation on each tab

## Local Development

Terminal 1 (backend):
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Terminal 2 (frontend):
```bash
cd frontend
npm install
npm run dev
```

Vite dev server proxies `/api/*` to `localhost:8000` automatically.

## Resource Requirements

- Backend: ~1 GB RAM (numpy/scipy calculations on 400x400 grids)
- Frontend: minimal (static files)
- Railway Hobby plan ($5/month) recommended for 8 GB RAM
