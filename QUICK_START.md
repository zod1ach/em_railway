# Quick Start Guide

Get the EM Calculator web app running locally in 5 minutes.

## Prerequisites Check

```bash
# Check Python version (need 3.11+)
python --version

# Check pip
pip --version

# Check Docker (for Redis)
docker --version
```

## Setup Steps

### 1. Install Dependencies (2 minutes)

```bash
cd em_calculator_web
pip install -r requirements.txt
```

### 2. Start Redis (30 seconds)

**Option A - Docker (Recommended):**
```bash
docker run -d -p 6379:6379 --name emcalc-redis redis:latest
```

**Option B - Native Redis:**
- Windows: Download from https://github.com/microsoftarchive/redis/releases
- Mac: `brew install redis && redis-server`
- Linux: `sudo apt-get install redis-server && redis-server`

### 3. Start Celery Worker (30 seconds)

Open a new terminal:
```bash
cd em_calculator_web
celery -A app.celery worker --loglevel=info
```

Keep this terminal open.

### 4. Start Flask App (30 seconds)

Open another terminal:
```bash
cd em_calculator_web
python app.py
```

### 5. Access Application (30 seconds)

Open browser: **http://localhost:5000**

Login:
- Username: `UoS_EPE`
- Password: `EPEEMAPP2031`

---

## Test HVAC Non-Magnetic Tab

1. Default parameters are pre-loaded
2. Click **"Calculate Fields"**
3. Wait 5-10 seconds
4. See 3 plots appear:
   - Surface plot
   - Radial profile
   - Azimuthal profile
5. Results displayed below form

---

## Stop Services

```bash
# Stop Flask: Ctrl+C in Flask terminal
# Stop Celery: Ctrl+C in Celery terminal
# Stop Redis:
docker stop emcalc-redis
# Or if native: Ctrl+C in Redis terminal
```

---

## Troubleshooting

**Redis Connection Error:**
```bash
# Check if Redis is running
docker ps | grep redis
# Or
redis-cli ping
# Should return: PONG
```

**Import Errors:**
```bash
# Reinstall dependencies
pip install -r requirements.txt --force-reinstall
```

**Port Already in Use:**
```bash
# Change port in app.py (line 58):
app.run(host='0.0.0.0', port=5001, debug=True)
# Then access: http://localhost:5001
```

---

## What's Next?

- See `README.md` for full documentation
- See `DEPLOYMENT_GUIDE.md` for Railway deployment
- See `PROJECT_SUMMARY.md` for implementation status

---

## Quick Reference

| Service | Command | Port | Status Check |
|---------|---------|------|-------------|
| Redis | `docker run -d -p 6379:6379 redis` | 6379 | `redis-cli ping` |
| Celery | `celery -A app.celery worker` | N/A | Check terminal logs |
| Flask | `python app.py` | 5000 | Visit http://localhost:5000 |

---

**All set! 🚀**

Current status: HVAC Non-Magnetic tab fully functional, 4 tabs to be implemented.
