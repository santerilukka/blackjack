#!/bin/bash
# Start both backend and frontend for development
cd "$(dirname "$0")/.."
npx concurrently "npm run dev:backend" "npm run dev:frontend"
