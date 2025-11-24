# EM Calculator - Railway Deployment Guide

Complete step-by-step guide for deploying the EM Calculator web app to Railway.

## Prerequisites

✅ GitHub account
✅ Railway account (sign up at https://railway.app)
✅ Git installed locally
✅ Completed web app code in `em_calculator_web/` folder

## Step 1: Prepare GitHub Repository

### 1.1 Initialize Git Repository

```bash
cd em_calculator_web
git init
git add .
git commit -m "Initial commit: EM Calculator Web Application"
```

### 1.2 Create GitHub Repository

1. Go to https://github.com/new
2. Repository name: `em-calculator-web`
3. Description: `Electromagnetic Field Calculator for Subsea Cables - Web Application`
4. Public or Private (your choice)
5. DO NOT initialize with README (we already have one)
6. Click "Create repository"

### 1.3 Push to GitHub

```bash
git remote add origin https://github.com/YOUR_USERNAME/em-calculator-web.git
git branch -M main
git push -u origin main
```

## Step 2: Set Up Railway Project

### 2.1 Create New Project

1. Go to https://railway.app/dashboard
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Authorize Railway to access your GitHub account
5. Select `em-calculator-web` repository
6. Railway will start deploying automatically

### 2.2 Configure Web Service

Railway should auto-detect Python and use `Procfile`, but verify:

1. In Railway dashboard, click on your service
2. Go to "Settings" tab
3. Verify:
   - **Start Command**: `gunicorn app:app --workers 4 --timeout 300 --bind 0.0.0.0:$PORT`
   - **Build Command**: (leave default)
   - **Watch Paths**: (leave default)

## Step 3: Add Redis Database

### 3.1 Add Redis Service

1. In Railway dashboard, click "New" in your project
2. Select "Database"
3. Choose "Add Redis"
4. Railway will provision Redis and set `REDIS_URL` automatically

### 3.2 Verify Redis Connection

1. Click on Redis service
2. Go to "Variables" tab
3. Confirm `REDIS_URL` exists (format: `redis://default:xxx@xxx.railway.app:port`)
4. This variable is automatically available to all services in your project

## Step 4: Add Celery Worker Service

### 4.1 Create Worker Service

1. In Railway dashboard, click "New" in your project
2. Select "GitHub Repo"
3. Choose the same `em-calculator-web` repository
4. Railway will create a second service

### 4.2 Configure Worker Service

1. Click on the new service
2. Go to "Settings" tab
3. **Service Name**: Change to `celery-worker`
4. **Start Command**: Change to:
   ```
   celery -A app.celery worker --loglevel=info --concurrency=2
   ```
5. Click "Deploy"

### 4.3 Verify Worker is Running

1. Go to "Deployments" tab of celery-worker service
2. Check logs for: `celery@xxx ready`
3. Should see: `[tasks] . calculations.tasks.*` (registered tasks)

## Step 5: Configure Environment Variables

### 5.1 Generate Secret Key

Run locally:
```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

Copy the output (e.g., `a1b2c3d4...`)

### 5.2 Add Variables to Web Service

1. Go to web service in Railway dashboard
2. Click "Variables" tab
3. Add the following:

| Variable | Value | Notes |
|----------|-------|-------|
| `SECRET_KEY` | (paste generated key) | For session encryption |
| `FLASK_ENV` | `production` | Production mode |
| `MAX_WORKERS` | `4` | Calculation parallelism |

4. Click "Add" for each variable

### 5.3 Verify Redis URL

1. Check that `REDIS_URL` appears in Variables tab
2. If not, manually link Redis:
   - Click "New Variable"
   - Select "Add Reference"
   - Choose Redis service → `REDIS_URL`

## Step 6: Deploy and Verify

### 6.1 Trigger Deployment

1. Any git push to `main` branch triggers automatic deployment
2. Or click "Deploy" button in Railway dashboard

### 6.2 Monitor Deployment

1. Go to "Deployments" tab
2. Watch build logs:
   - Installing Python 3.11
   - Installing requirements (numpy, scipy, matplotlib, etc.)
   - Starting Gunicorn
3. Wait for "Deployment successful" (2-5 minutes)

### 6.3 Get Application URL

1. Go to "Settings" tab of web service
2. Under "Domains" section
3. Click "Generate Domain"
4. Railway provides URL like: `https://em-calculator-web-production-xxxx.up.railway.app`
5. Copy this URL

## Step 7: Test Application

### 7.1 Access Login Page

1. Open the Railway URL in browser
2. Should see EM Calculator login page with dark theme
3. Verify styling loads correctly

### 7.2 Login

- **Username**: `UoS_EPE`
- **Password**: `EPEEMAPP2031`
- Click "Login"

### 7.3 Test HVAC Non-Magnetic Tab

1. Should see 5 tabs (HVAC Non-Magnetic is default)
2. Verify default parameters are loaded
3. Click "Calculate Fields"
4. Should see:
   - Loading spinner
   - "Calculating..." status
   - After 5-10 seconds: plots appear
   - Results displayed below form

### 7.4 Test Configuration Save/Load

1. Change some parameters
2. Click "Save Config" button (top right)
3. JSON file downloads
4. Click "Load Config"
5. Select downloaded JSON
6. Parameters should restore

### 7.5 Test Other Tabs

1. Click "HVAC MAGNETIC ARMOUR" tab
2. Should see "TODO" message (not implemented yet)
3. Repeat for other tabs

## Step 8: Monitor and Troubleshoot

### 8.1 View Logs

**Web Service Logs:**
1. Railway dashboard → Web service → "Deployments" tab
2. Click latest deployment → View logs
3. Look for errors or warnings

**Worker Service Logs:**
1. Railway dashboard → Celery worker → "Deployments" tab
2. Should see Celery startup messages
3. When WMM calculations run, tasks appear here

### 8.2 Check Redis Connection

1. Railway dashboard → Redis service → "Metrics" tab
2. Verify memory usage (should be < 10MB initially)
3. Check connection count (should be 2+: web + worker)

### 8.3 Common Issues

**Issue: Application doesn't start**
- Check web service logs for Python errors
- Verify all variables are set correctly
- Check `requirements.txt` for missing dependencies

**Issue: Calculations timeout**
- Verify Celery worker is running
- Check worker logs for task errors
- Verify `REDIS_URL` is accessible from both services

**Issue: Plots not displaying**
- Check matplotlib backend (should be 'Agg')
- Verify numpy/scipy installed correctly
- Check browser console for JavaScript errors

**Issue: Login doesn't work**
- Verify `SECRET_KEY` is set
- Check Redis connection (sessions stored in Redis)
- Clear browser cookies and try again

## Step 9: Custom Domain (Optional)

### 9.1 Add Custom Domain

1. Purchase domain (e.g., from Namecheap, Google Domains)
2. Railway dashboard → Web service → "Settings" → "Domains"
3. Click "Custom Domain"
4. Enter your domain: `emcalculator.yourdomain.com`
5. Railway provides CNAME record to add to DNS:
   ```
   CNAME: emcalculator
   Value: your-app.up.railway.app
   ```

### 9.2 Configure DNS

1. Go to your domain registrar's DNS settings
2. Add CNAME record with values from Railway
3. Wait 5-60 minutes for DNS propagation
4. Railway automatically provisions SSL certificate

## Step 10: Ongoing Maintenance

### 10.1 Update Application

1. Make code changes locally
2. Commit and push to GitHub:
   ```bash
   git add .
   git commit -m "Description of changes"
   git push origin main
   ```
3. Railway automatically deploys (usually 2-3 minutes)

### 10.2 Monitor Usage

**Railway Dashboard:**
- CPU usage: Should be low (<10%) when idle
- Memory: 500MB-1GB typical
- Network: Minimal unless heavy calculations

**Costs (Railway Hobby Plan - $5/month):**
- Includes: 8GB RAM, unlimited bandwidth
- Additional: $0.000463/GB-hr for storage
- Typical monthly cost: $5-10

### 10.3 Backup Strategy

**Code:** Already on GitHub (automatic backup)

**User Sessions:** Temporary, no backup needed

**Configurations:** Users download JSON files locally

## Step 11: Complete Remaining Tabs

To finish the application, implement the TODO sections:

### 11.1 HVAC Magnetic Armour
- Copy pattern from `hvac_nonmagnetic.py`
- Add armour-specific parameters
- Use `B_three_helices_armour()` function

### 11.2 DC Bipole
- Integrate Folium map (reuse from PyQt6 version)
- Add WMM calculation for Earth field
- Calculate perturbation

### 11.3 WMM Geomagnetic
- Create Celery tasks in `wmm_geomag.py`
- Use `wmm_grid_calculation_task()` from `tasks.py`
- Add progress bar polling
- Remove all GEBCO references

### 11.4 3D Cable
- Port calculation logic from original app
- Create Celery task for line processing
- Add route map with Folium

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                         User Browser                         │
│  (HTTPS via Railway domain)                                  │
└───────────────────┬─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│                    Railway Web Service                       │
│  - Flask app (Gunicorn, 4 workers)                          │
│  - Handles HTTP requests, renders templates                 │
│  - Serves static files (CSS, JS)                            │
└─────────┬──────────────────────────┬────────────────────────┘
          │                          │
          │ Fast calculations        │ Long calculations
          │ (HVAC, DC)              │ (WMM, 3D Cable)
          │                          │
          ▼                          ▼
┌──────────────────────┐    ┌─────────────────────────────────┐
│   Matplotlib Plots   │    │   Railway Celery Worker         │
│   (PNG via base64)   │    │   - Background task processing  │
└──────────────────────┘    │   - Progress updates            │
                             └─────────┬───────────────────────┘
                                       │
                                       ▼
                              ┌─────────────────────┐
                              │   Railway Redis     │
                              │   - Session storage │
                              │   - Task queue      │
                              │   - Results cache   │
                              └─────────────────────┘
```

## Support and Resources

- **Railway Docs**: https://docs.railway.app/
- **Flask Docs**: https://flask.palletsprojects.com/
- **Celery Docs**: https://docs.celeryproject.org/
- **Bootstrap Docs**: https://getbootstrap.com/docs/5.3/

## Cost Estimation

### Railway Hobby Plan ($5/month):
- 8GB RAM
- Unlimited bandwidth
- 3 services (web + worker + Redis)
- ~512 MB storage

### Typical Usage:
- Light use (<10 users/day): $5/month
- Moderate use (50 users/day): $7-8/month
- Heavy use (200+ users/day): $10-15/month

### Optimization Tips:
- Reduce matplotlib DPI if memory is tight
- Implement result caching for common calculations
- Add rate limiting to prevent abuse
- Consider upgrading to Pro plan ($20/month) for heavy usage

---

**Deployment Complete!** 🎉

Your EM Calculator is now live on Railway with:
- ✅ Secure authentication
- ✅ Dark theme matching PyQt6 design
- ✅ Background task processing
- ✅ Configuration management
- ✅ Auto-deploy from GitHub
- ✅ SSL certificate (HTTPS)

Next steps: Complete the remaining 4 tabs following the patterns established in HVAC Non-Magnetic tab.
