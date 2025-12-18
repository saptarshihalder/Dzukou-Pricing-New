#!/bin/bash

# Start the Price Optimizer AI Electron App
# This script starts both the Python backend and Next.js frontend, then launches Electron

set -e

echo "Starting Price Optimizer AI..."

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

# Function to cleanup on exit
cleanup() {
    echo "Shutting down services..."
    # Kill all child processes
    pkill -P $$ 2>/dev/null || true
    exit 0
}

trap cleanup SIGINT SIGTERM EXIT

# Start the Python backend
echo "Starting Python backend on port 8000..."
cd "$PROJECT_DIR/api"
uv run uvicorn api.main:app --host 127.0.0.1 --port 8000 &
BACKEND_PID=$!
cd "$PROJECT_DIR"

# Wait for backend to be ready
echo "Waiting for backend to be ready..."
for i in {1..30}; do
    if curl -s http://localhost:8000/routes/health > /dev/null 2>&1; then
        echo "Backend is ready!"
        break
    fi
    sleep 1
done

# Start Next.js frontend
echo "Starting Next.js frontend on port 3000..."
pnpm start &
FRONTEND_PID=$!

# Wait for frontend to be ready
echo "Waiting for frontend to be ready..."
for i in {1..30}; do
    if curl -s http://localhost:3000 > /dev/null 2>&1; then
        echo "Frontend is ready!"
        break
    fi
    sleep 1
done

# Start Electron
echo "Starting Electron app..."
pnpm electron:start

# Wait for all background processes
wait
