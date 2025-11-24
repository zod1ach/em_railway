# EM Calculator Web App - Project Summary

## Overview

Successfully converted PyQt6 desktop application to Flask web application for Railway deployment.

**Created**: New folder `em_calculator_web/` with complete web application structure
**Status**: Core infrastructure complete, HVAC Non-Magnetic tab fully functional, 4 tabs awaiting implementation
**Ready for**: Railway deployment and continued development

---

## What Has Been Completed ✅

### 1. Project Structure
```
em_calculator_web/
├── app.py                 # Flask application with Celery
├── config.py              # Configuration management
├── requirements.txt       # All dependencies (no GEBCO/xarray)
├── Procfile              # Railway deployment (web + worker)
├── runtime.txt           # Python 3.11
├── .gitignore
├── README.md             # Complete documentation
├── DEPLOYMENT_GUIDE.md   # Step-by-step Railway setup
│
├── auth/                 # Authentication module
│   ├── __init__.py
│   └── login.py          # Username/password check, decorators
│
├── blueprints/           # Flask blueprints (one per tab)
│   ├── __init__.py
│   ├── hvac_nonmagnetic.py   # ✅ FULLY IMPLEMENTED
│   ├── hvac_magnetic.py      # 🚧 Skeleton created
│   ├── dc_bipole.py          # 🚧 Skeleton created
│   ├── wmm_geomag.py         # 🚧 Skeleton created
│   └── cable_3d.py           # 🚧 Skeleton created
│
├── calculations/         # Core physics calculations
│   ├── __init__.py
│   ├── fields.py         # Copied from python_backend/core/
│   ├── armour.py         # Copied from python_backend/core/
│   ├── plot_utils.py     # ✅ Matplotlib→PNG conversion
│   └── tasks.py          # ✅ Celery background tasks (WMM, 3D)
│
├── templates/
│   ├── base.html         # ✅ Dark theme, Bootstrap 5
│   ├── login.html        # ✅ Authentication page
│   ├── index.html        # ✅ Main app with 5 tabs
│   └── tabs/
│       ├── hvac_nonmagnetic.html  # ✅ FULLY IMPLEMENTED
│       ├── hvac_magnetic.html     # 🚧 Placeholder with TODO
│       ├── dc_bipole.html         # 🚧 Placeholder with TODO
│       ├── wmm_geomag.html        # 🚧 Placeholder with TODO
│       └── cable_3d.html          # 🚧 Placeholder with TODO
│
├── static/
│   ├── css/
│   │   └── theme.css     # ✅ Dark theme converted from PyQt6
│   └── js/
│       ├── app.js        # ✅ Config save/load, tab management
│       ├── calculations.js  # ✅ Task polling, progress bars
│       └── config.js     # ✅ JSON config handling
│
├── temp/                 # Temporary files
└── sessions/             # Session storage
```

### 2. Core Features Implemented

#### Authentication ✅
- Login page with dark theme
- Hardcoded credentials: `UoS_EPE` / `EPEEMAPP2031`
- Session management with Redis
- Login required decorator for all routes

#### Dark Theme ✅
- Converted PyQt6 colors to CSS
- Bootstrap 5 components styled
- Responsive design
- Matches original application appearance

#### HVAC Non-Magnetic Tab ✅ (Fully Functional)
- Input forms for all parameters (geometry, materials, electric)
- AJAX form submission
- Backend calculation using `B_three_helices()`
- Three plots generated:
  1. Surface plot (2D heatmap)
  2. Radial profile (line plot)
  3. Azimuthal profile (line plot)
- Matplotlib → PNG → base64 → HTML display
- Results display (max, min, sheath reduction)
- Loading spinner and status messages

#### Configuration Management ✅
- Save current parameters as JSON (download)
- Load parameters from JSON (upload)
- Preserves active tab state
- Session storage for tab persistence

#### Celery Background Tasks ✅
- Task definitions in `calculations/tasks.py`
- WMM grid calculation with progress updates
- WMM line calculation with progress updates
- 3D cable calculation (placeholder structure)
- Progress polling infrastructure in JavaScript

#### Deployment Configuration ✅
- `Procfile` for Railway (web + worker)
- `requirements.txt` optimized (no GEBCO dependencies)
- `runtime.txt` specifying Python 3.11
- Health check endpoint for Railway
- Gunicorn WSGI server (4 workers, 300s timeout)
- Celery worker (2 concurrency)

### 3. Documentation ✅

- **README.md**: Comprehensive project documentation
  - Features overview
  - Technology stack
  - Local development setup
  - Railway deployment overview
  - Project structure
  - Implementation status
  - Development guidelines

- **DEPLOYMENT_GUIDE.md**: Step-by-step Railway deployment
  - GitHub repository setup
  - Railway project creation
  - Redis service addition
  - Celery worker configuration
  - Environment variables
  - Testing procedures
  - Troubleshooting guide
  - Cost estimation

- **PROJECT_SUMMARY.md**: This file

---

## What Needs Implementation 🚧

### Tab 2: HVAC Magnetic Armour
**Effort**: 4-6 hours

**Tasks**:
1. Copy `hvac_nonmagnetic.py` blueprint as template
2. Add armour-specific input fields:
   - N (number of armour wires)
   - d_f (wire diameter)
   - d_A (armour diameter)
   - p_A (pitch length)
   - mu_r (complex permeability: real - imag*j)
   - sigma (conductivity)
3. Update calculation to use `B_three_helices_armour()`
4. Generate same 3 plot types
5. Update template with armour parameter forms

**Reference**: `gui/forms/hvac_magnetic.py` (original PyQt6 implementation)

### Tab 3: DC Bipole
**Effort**: 6-8 hours

**Tasks**:
1. Create Folium map route in `/dc-bipole/map`
2. Add marker/point drawing to select Earth field location
3. Integrate WMM call to get Bx, By, Bz at selected point
4. Implement DC bipole perturbation calculation
5. Add rotation matrices for cable angle/slope
6. Generate perturbation plots
7. Show results: max perturbation, field components

**Reference**: `gui/forms/dc_bipole.py` (originalPyQt6 implementation)

### Tab 4: WMM Geomagnetic
**Effort**: 8-10 hours

**Tasks**:
1. Create Folium map with rectangle/line drawing
2. Add mode selector (Grid vs Line)
3. Implement `/wmm/calculate` endpoint:
   - Extract bbox or line coordinates
   - Launch Celery task `wmm_grid_calculation_task()` or `wmm_line_calculation_task()`
   - Return task_id
4. Implement `/wmm/status/<task_id>` for progress polling
5. Update template with:
   - Map container
   - Progress bar
   - Grid resolution controls
   - Date selector
6. Display multiple plots (F, D, I, X, Y, Z)
7. **Important**: NO GEBCO elevation - always use 0m

**Reference**: `gui/forms/wmm_geomag.py` (original PyQt6 implementation)

**Note**: `tasks.py` already has `wmm_grid_calculation_task()` and `wmm_line_calculation_task()` implemented!

### Tab 5: 3D Cable
**Effort**: 10-12 hours (check original implementation first)

**Tasks**:
1. **First**: Check `C:\Users\sc2m23\OneDrive - University of Southampton\Desktop\MATLAB_code_EMF_4_cables\EM_Calculator_App` for actual implementation
2. Create Folium map with line drawing for cable route
3. Implement line-based calculation logic
4. Add Celery task for background processing
5. Generate plots (likely cross-section or profile plots)
6. Add progress tracking
7. Display results

**Reference**: Original `EM_Calculator_App` folder (not the Copy-Copy)

**Note**: Based on `3D_CABLE_FIELD_PLAN.md`, but user confirmed no 3D rendering needed, just calculations along line

---

## Implementation Priority

### Phase 1 (Essential for MVP)
1. ✅ HVAC Non-Magnetic - **DONE**
2. 🚧 HVAC Magnetic Armour - **NEXT** (most similar to completed tab)
3. 🚧 DC Bipole - (medium complexity)

### Phase 2 (Advanced Features)
4. 🚧 WMM Geomagnetic - (Celery tasks ready, needs UI integration)
5. 🚧 3D Cable - (check original implementation first)

---

## How to Continue Development

### Step 1: Set Up Local Environment

```bash
cd em_calculator_web

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Start Redis (Docker)
docker run -d -p 6379:6379 redis:latest

# Start Celery worker (separate terminal)
celery -A app.celery worker --loglevel=info

# Run Flask app
python app.py

# Open browser
http://localhost:5000
```

### Step 2: Implement Next Tab (HVAC Magnetic)

1. Open `blueprints/hvac_magnetic.py`
2. Copy structure from `hvac_nonmagnetic.py`
3. Modify parameters and calculation function
4. Open `templates/tabs/hvac_magnetic.html`
5. Copy structure from `hvac_nonmagnetic.html`
6. Add armour-specific input fields
7. Test locally
8. Commit and push to GitHub
9. Railway auto-deploys

### Step 3: Follow Pattern for Remaining Tabs

Each tab follows the same pattern:
- Blueprint with `/calculate` route
- Template with forms (left) + plots (right)
- AJAX submission
- Backend calculation
- Return plots as base64 PNG
- Display results

For tabs with maps (DC, WMM, 3D):
- Add `/map` route serving Folium HTML
- Use JavaScript to capture drawn shapes
- Pass coordinates to calculate endpoint

For long calculations (WMM, 3D):
- Launch Celery task, return task_id
- Poll `/status/<task_id>` for progress
- Update progress bar
- Display plots when complete

---

## Testing Checklist

### Before Deploying Each Tab:

- [ ] Form inputs accept valid values
- [ ] Form validation works (required fields, min/max)
- [ ] Calculate button shows spinner
- [ ] Backend calculation completes without errors
- [ ] Plots display correctly
- [ ] Results show in sidebar
- [ ] Configuration save includes new parameters
- [ ] Configuration load restores parameters
- [ ] No console errors (browser dev tools)
- [ ] Mobile responsive (optional but nice)

### For Background Tasks (WMM, 3D):

- [ ] Celery worker receives task
- [ ] Progress updates appear
- [ ] Progress bar animates
- [ ] Task completes successfully
- [ ] Results display after completion
- [ ] Error handling if task fails

---

## Deployment Checklist

### Before First Deploy:

- [x] Code pushed to GitHub
- [x] Railway project created
- [ ] Redis service added
- [ ] Celery worker service configured
- [ ] Environment variables set (SECRET_KEY, FLASK_ENV)
- [ ] Custom domain configured (optional)

### Before Each Update:

- [ ] Test locally with Redis + Celery
- [ ] Verify all calculations work
- [ ] Check for console errors
- [ ] Commit with descriptive message
- [ ] Push to GitHub
- [ ] Monitor Railway deployment
- [ ] Test on production URL
- [ ] Check worker logs if using Celery

---

## Estimated Completion Time

- **HVAC Magnetic Armour**: 4-6 hours
- **DC Bipole**: 6-8 hours
- **WMM Geomagnetic**: 8-10 hours
- **3D Cable**: 10-12 hours (pending original code review)

**Total**: 28-36 hours of focused development

**Recommended Schedule**:
- Week 1: HVAC Magnetic + DC Bipole
- Week 2: WMM Geomagnetic
- Week 3: 3D Cable
- Week 4: Testing, optimization, documentation updates

---

## Technologies Used

### Backend
- Flask 3.0 (web framework)
- Celery 5.3 (background tasks)
- Redis 5.0 (session + task queue)
- NumPy 1.26 (numerical computing)
- SciPy 1.11 (scientific functions)
- Matplotlib 3.8 (plotting)
- pygeomag 0.1 (WMM calculations)
- Folium 0.15 (interactive maps)

### Frontend
- Bootstrap 5.3 (UI framework)
- jQuery 3.7 (AJAX, DOM manipulation)
- Custom CSS (dark theme)
- Vanilla JavaScript (config, tabs)

### Deployment
- Railway (Platform-as-a-Service)
- Gunicorn (WSGI server)
- GitHub (version control + auto-deploy)

### Development
- Python 3.11
- Git
- Visual Studio Code (recommended)

---

## Key Design Decisions

### Why Flask over Django/FastAPI?
- Lightweight and flexible
- Already had Flask code for maps
- Better for scientific computing apps
- Simpler than Django for single-purpose tool

### Why Matplotlib PNG over Plotly?
- Reuses existing plotting code
- No library conversion needed
- Matches PyQt6 output exactly
- Simpler implementation

### Why Celery over Threading?
- Handles long calculations better
- Progress tracking built-in
- Scales across multiple workers
- Prevents HTTP timeouts

### Why Bootstrap over Custom CSS?
- Fast development
- Responsive by default
- Good dark theme support
- Professional appearance

### Why Server-side Sessions?
- More secure than client cookies
- Supports larger data (calc results)
- Required for multi-worker setup
- Redis provides fast access

---

## File Permissions and Security

### Hardcoded Credentials
- Username/Password are intentionally hardcoded per requirements
- For production, consider environment variables
- Or implement proper user database

### Session Security
- SECRET_KEY must be strong (64+ characters)
- Use environment variable, never commit to Git
- Sessions expire after 30 minutes

### File Uploads
- Limited to 10MB (config files only)
- Only JSON accepted
- Validation on server side

### API Endpoints
- All require login (except /health)
- No public-facing calculation endpoints
- CORS not enabled (single-origin only)

---

## Performance Optimization Tips

### For Railway Deployment:

1. **Reduce Matplotlib DPI**: Change from 150 to 100 in `plot_utils.py` if memory tight
2. **Clear Figures**: Always `plt.close(fig)` after rendering
3. **Cache Results**: Store calculation results in Redis with TTL
4. **Limit Grid Size**: Cap WMM grid to 100x100 points max
5. **Rate Limiting**: Add Flask-Limiter to prevent abuse
6. **Compress Images**: Use PNG compression level 6

### For Local Development:

1. **Use Docker for Redis**: Easier than native installation
2. **Single Celery Worker**: Concurrency=1 sufficient for testing
3. **Debug Mode**: Set `FLASK_ENV=development` for auto-reload

---

## Troubleshooting Common Issues

### "ModuleNotFoundError: No module named 'calculations'"
- Ensure `calculations/__init__.py` exists
- Check Python path includes project root
- Try: `pip install -e .` (if setup.py exists)

### "Celery worker not receiving tasks"
- Verify Redis is running: `redis-cli ping` (should return PONG)
- Check `REDIS_URL` matches in config and worker
- Restart worker after code changes

### "Plot not displaying in browser"
- Check backend calculation completed (check Flask logs)
- Verify base64 string in response (browser dev tools)
- Check matplotlib backend is 'Agg' not 'Qt5Agg'

### "Session lost after refresh"
- Verify Redis is running
- Check `SESSION_TYPE = 'redis'` in config
- Ensure `SECRET_KEY` is consistent

### "Railway deployment fails"
- Check build logs for Python errors
- Verify `requirements.txt` has all dependencies
- Ensure `Procfile` syntax is correct
- Check Python version matches `runtime.txt`

---

## Next Steps

1. **Complete HVAC Magnetic Tab** (~6 hours)
   - Highest priority, most similar to completed tab
   - Good practice before tackling complex tabs

2. **Deploy to Railway** (~2 hours)
   - Follow `DEPLOYMENT_GUIDE.md`
   - Get production URL
   - Test with multiple users

3. **Implement DC Bipole** (~8 hours)
   - Add Folium map integration
   - WMM API calls for Earth field
   - Perturbation calculations

4. **Implement WMM Geomagnetic** (~10 hours)
   - Most complex due to Celery integration
   - Grid and Line modes
   - Progress tracking crucial

5. **Implement 3D Cable** (~12 hours)
   - Review original implementation first
   - May require additional research
   - Static plots only (no 3D rendering)

6. **Testing and Refinement** (~8 hours)
   - Cross-browser testing
   - Mobile responsiveness
   - Performance optimization
   - User acceptance testing

**Total Project Time**: ~46 hours remaining

---

## Success Criteria

✅ **Core Infrastructure**: COMPLETE
- Flask app running
- Authentication working
- Dark theme applied
- 1 tab fully functional
- Celery infrastructure ready
- Deployment files configured

🚧 **Full Application**: IN PROGRESS
- [ ] All 5 tabs functional
- [ ] All calculations match PyQt6 version
- [ ] Maps integrated (DC, WMM, 3D tabs)
- [ ] Background tasks with progress bars
- [ ] Deployed to Railway
- [ ] Stable under multi-user load
- [ ] Documentation complete

---

**Status**: Foundation complete, ready for tab-by-tab implementation.

**Estimated Completion**: 3-4 weeks of focused development.

**Deployment Ready**: Yes - can deploy now and add tabs incrementally.
