#!/bin/bash

# Default values
HOST="127.0.0.1"
KEYFILE="certs/localhost-key.pem"
CERTFILE="certs/localhost.pem"

# Check for --lan parameter
for arg in "$@"; do
    if [ "$arg" == "--lan" ]; then
        HOST="0.0.0.0"
        KEYFILE="certs/lan-key.pem"
        CERTFILE="certs/lan.pem"
        echo "Starting server in LAN mode (reachable from other devices on the same network)..."
    fi
done

if [ "$HOST" = "127.0.0.1" ]; then
    echo "Starting server in Localhost-only mode..."
fi

# Activate the virtual environment
if [ -f ".venv/bin/activate" ]; then
    source .venv/bin/activate
elif [ -f ".venv/Scripts/activate" ]; then
    source .venv/Scripts/activate
else
    echo "Warning: Virtual environment activation script not found. Attempting to run uvicorn directly."
fi

# Start uvicorn with SSL configuration
uvicorn app.main:app --reload \
    --host "$HOST" --port 8443 \
    --ssl-keyfile "$KEYFILE" \
    --ssl-certfile "$CERTFILE"
