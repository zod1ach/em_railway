# EM Calculator Web Application

Electromagnetic Field Calculator for Subsea Cables - Web Version

Converted from PyQt6 desktop application to Flask web app for deployment on Railway.

## Features

- **5 Calculation Tabs:**
  1. HVAC Non-Magnetic - AC cables with non-magnetic armour
  2. HVAC Magnetic Armour - AC cables with magnetic shielding
  3. DC Bipole - DC cables with Earth field perturbation
  4. WMM Geomagnetic - High-resolution geomagnetic field analysis
  5. 3D Cable - Line-based calculations along cable routes

- **Authentication:** Login required (Username: `UoS_EPE`, Password: `EPEEMAPP2031`)
- **Dark Theme:** Matching the original PyQt6 design
- **Configuration Management:** Save/load parameters as JSON
- **Interactive Maps:** Folium maps for location/route selection
- **Background Processing:** Celery for long-running calculations (WMM, 3D Cable)
- **Plot Export:** Download plots as PNG images

## Technology Stack

- **Backend:** Flask 3.0
- **Task Queue:** Celery + Redis
- **Frontend:** Bootstrap 5, jQuery
- **Plotting:** Matplotlib (server-side rendering to PNG)
- **Maps:** Folium
- **Deployment:** Railway (Gunicorn + Celery worker)

## Local Development

### Prerequisites

- Python 3.11+
- Redis server (for Celery)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd em_calculator_web
```

2. Create virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Start Redis (in separate terminal):
```bash
# On Linux/Mac with Docker:
docker run -d -p 6379:6379 redis:latest

# Or install Redis locally and run:
redis-server
```

5. Start Celery worker (in separate terminal):
```bash
source venv/bin/activate
celery -A app.celery worker --loglevel=info
```

6. Run Flask app:
```bash
python app.py
```

7. Open browser: `http://localhost:5000`

## Railway Deployment

### Step 1: Prepare GitHub Repository

1. Initialize git (if not already):
```bash
git init
git add .
git commit -m "Initial commit: EM Calculator Web App"
```

2. Create GitHub repository and push:
```bash
git remote add origin <your-github-repo-url>
git push -u origin main
```

### Step 2: Deploy to Railway

1. Go to [railway.app](https://railway.app/) and sign in
2. Click "New Project" → "Deploy from GitHub repo"
3. Select your repository
4. Railway will auto-detect Python and use the `Procfile`

### Step 3: Add Redis Service

1. In Railway dashboard, click "New" → "Database" → "Add Redis"
2. Railway will automatically set `REDIS_URL` environment variable
3. Both web and worker processes will use this Redis instance

### Step 4: Configure Environment Variables

In Railway dashboard, add these variables:
- `SECRET_KEY`: (generate with `python -c "import secrets; print(secrets.token_hex(32))"`)
- `FLASK_ENV`: `production`
- `MAX_WORKERS`: `4`

### Step 5: Deploy Worker Process

1. Railway should automatically detect both `web` and `worker` from Procfile
2. If not, manually add a new service:
   - Same GitHub repo
   - Custom start command: `celery -A app.celery worker --loglevel=info --concurrency=2`

### Step 6: Access Application

- Railway will provide a URL like: `https://your-app.railway.app`
- Login with: `UoS_EPE` / `EPEEMAPP2031`

## Project Structure

```
em_calculator_web/
├── app.py                          # Main Flask application
├── config.py                       # Configuration
├── requirements.txt                # Python dependencies
├── Procfile                        # Railway deployment config
├── runtime.txt                     # Python version
├── .gitignore
│
├── auth/                           # Authentication module
│   ├── __init__.py
│   └── login.py
│
├── blueprints/                     # Flask blueprints (routes)
│   ├── __init__.py
│   ├── hvac_nonmagnetic.py        # HVAC Non-Magnetic tab
│   ├── hvac_magnetic.py           # HVAC Magnetic Armour tab
│   ├── dc_bipole.py               # DC Bipole tab
│   ├── wmm_geomag.py              # WMM Geomagnetic tab
│   └── cable_3d.py                # 3D Cable tab
│
├── calculations/                   # Core physics calculations
│   ├── __init__.py
│   ├── fields.py                  # Electromagnetic field calculations
│   ├── armour.py                  # Armour shielding calculations
│   ├── plot_utils.py              # Matplotlib plotting utilities
│   └── tasks.py                   # Celery background tasks
│
├── templates/                      # HTML templates
│   ├── base.html                  # Base template with dark theme
│   ├── login.html                 # Login page
│   ├── index.html                 # Main app (5 tabs)
│   └── tabs/                      # Individual tab templates
│       ├── hvac_nonmagnetic.html
│       ├── hvac_magnetic.html
│       ├── dc_bipole.html
│       ├── wmm_geomag.html
│       └── cable_3d.html
│
├── static/                         # Static assets
│   ├── css/
│   │   └── theme.css              # Dark theme CSS
│   ├── js/
│   │   ├── app.js                 # Main JavaScript
│   │   ├── calculations.js        # Calculation helpers
│   │   └── config.js              # Configuration management
│   └── img/
│
├── temp/                          # Temporary files (maps, exports)
└── sessions/                      # Session storage
```

## Implementation Status

### Completed ✅
- [x] Project structure
- [x] Flask app with authentication
- [x] Base HTML templates with dark theme
- [x] 5-tab layout (Bootstrap)
- [x] Calculation code ported from PyQt6 app
- [x] HVAC Non-Magnetic tab (fully functional)
- [x] Plot generation utilities (matplotlib → PNG)
- [x] Configuration save/load JavaScript
- [x] Railway deployment files (Procfile, requirements.txt)

### In Progress 🚧
- [ ] HVAC Magnetic Armour tab (blueprint created, needs implementation)
- [ ] DC Bipole tab (blueprint created, needs Folium map integration)
- [ ] WMM Geomagnetic tab (blueprint created, needs Celery tasks + no GEBCO)
- [ ] 3D Cable tab (blueprint created, needs implementation from original app)
- [ ] Celery tasks module for background processing
- [ ] Data export functionality (CSV)

### To Do 📋
- [ ] Complete remaining 4 tabs
- [ ] Implement Celery background tasks with progress bars
- [ ] Add Folium map integration for DC, WMM, 3D tabs
- [ ] Remove GEBCO dependency from WMM (use 0m elevation)
- [ ] Testing and bug fixes
- [ ] Performance optimization for Railway

## Notes

- **GEBCO File Removed:** WMM tab defaults to 0m elevation (sea level) instead of loading 7GB GEBCO bathymetry data
- **Background Tasks:** WMM and 3D Cable tabs use Celery for long calculations to avoid HTTP timeout
- **Memory Usage:** Estimated 500MB-1GB RAM needed. Railway Hobby plan ($5/month) recommended for 8GB RAM
- **Browser Support:** Tested on Chrome, Firefox, Edge. Dark theme optimized for modern browsers

## Development Guidelines

### Adding a New Tab

1. Create blueprint in `blueprints/new_tab.py`
2. Register blueprint in `app.py`
3. Create template in `templates/tabs/new_tab.html`
4. Add tab button in `templates/index.html`
5. Implement calculation route (`/new-tab/calculate`)
6. Use `plot_utils.py` for generating plots

### Creating Background Tasks

```python
# In calculations/tasks.py
from app import celery

@celery.task(bind=True)
def long_calculation(self, params):
    total = 100
    for i in range(total):
        # Do work...
        self.update_state(state='PROGRESS', meta={'current': i, 'total': total})
    return result
```

### Plotting Pattern

```python
from calculations.plot_utils import create_dark_figure, fig_to_base64

fig = create_dark_figure(figsize=(10, 8))
ax = fig.add_subplot(111)
ax.plot(x, y)
# ... configure plot ...
img_base64 = fig_to_base64(fig)
return jsonify({'plot': img_base64})
```

## Troubleshooting

### Redis Connection Error
- Ensure Redis is running locally or `REDIS_URL` is set correctly in Railway
- Check Celery worker logs for connection issues

### Calculation Timeout
- Increase `CELERY_TASK_TIME_LIMIT` in `config.py`
- Reduce grid resolution or calculation complexity

### Memory Issues on Railway
- Upgrade to Hobby plan ($5/month) for 8GB RAM
- Optimize matplotlib figure DPI (currently 150, can reduce to 100)
- Clear session data periodically

## License

For research and educational use. University of Southampton - EPE Research Group.

## Credits

Ported from MATLAB to Python, then from PyQt6 to Flask web application.
