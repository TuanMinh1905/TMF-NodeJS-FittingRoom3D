#!/bin/bash
# ===== TMFashion SMPL Service Startup =====
# Python FastAPI service for SMPL mesh generation
# Port: 8001

echo "===== SMPL Service ====="

# Check if venv exists
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

# Activate venv
source venv/bin/activate

# Install dependencies
echo "Installing dependencies..."
pip install -r requirements.txt -q

# Start server
echo "Starting SMPL FastAPI service on port 8001..."
python -m uvicorn main:app --host 0.0.0.0 --port 8001 --reload
