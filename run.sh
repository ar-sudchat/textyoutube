#!/bin/bash
echo "=========================================================="
echo " Starting GetText AI - YouTube Transcript & Summarizer"
echo "=========================================================="

# Ensure venv exists
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
    ./venv/bin/pip install -r requirements.txt
fi

echo "Server starting at http://localhost:8000"
echo "Press Ctrl+C to stop the server."
./venv/bin/python -m uvicorn server:app --host 0.0.0.0 --port 8000 --reload
