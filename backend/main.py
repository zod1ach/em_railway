"""
EM Calculator API — FastAPI backend
"""
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.auth import router as auth_router
from api.hvac_nonmagnetic import router as hvac_nonmag_router
from api.hvac_magnetic import router as hvac_mag_router
from api.dc_bipole import router as dc_bipole_router
from api.wmm_geomag import router as wmm_router
from api.cable_3d import router as cable_3d_router

app = FastAPI(
    title="EM Calculator API",
    description="Electromagnetic Field Calculator for Subsea Cables",
    version="2.0.0",
)

# CORS — allow frontend origin
origins = os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/api/auth", tags=["auth"])
app.include_router(hvac_nonmag_router, prefix="/api/hvac-nonmag", tags=["hvac-nonmag"])
app.include_router(hvac_mag_router, prefix="/api/hvac-mag", tags=["hvac-mag"])
app.include_router(dc_bipole_router, prefix="/api/dc-bipole", tags=["dc-bipole"])
app.include_router(wmm_router, prefix="/api/wmm", tags=["wmm"])
app.include_router(cable_3d_router, prefix="/api/cable-3d", tags=["cable-3d"])

@app.get("/api/health")
def health():
    return {"status": "ok"}
