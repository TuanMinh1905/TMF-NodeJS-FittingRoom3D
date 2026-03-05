@echo off
REM ===== TMFashion SMPL Service Startup =====
REM Python FastAPI service for SMPL mesh generation
REM Port: 8001

echo ===== SMPL Service =====

REM Check if venv exists
if not exist "venv\" (
    echo Creating virtual environment...
    python -m venv venv
)

REM Activate venv
call venv\Scripts\activate.bat

REM Install dependencies
echo Installing dependencies...
pip install -r requirements.txt -q

REM Start server
echo Starting SMPL FastAPI service on port 8001...
python -m uvicorn main:app --host 0.0.0.0 --port 8001 --reload
