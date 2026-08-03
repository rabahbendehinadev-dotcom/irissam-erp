#!/bin/bash
set -e

# Install dependencies
pnpm install --frozen-lockfile

# Rebuild the API server (migrations run automatically on startup via migrations.ts)
cd artifacts/api-server && node ./build.mjs
