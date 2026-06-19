#!/bin/bash
set -euo pipefail

APP_NAME="Xoras"
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BUNDLE_APP="$PROJECT_DIR/src-tauri/target/release/bundle/macos/${APP_NAME}.app"

echo "Building ${APP_NAME}..."
cd "$PROJECT_DIR"
npm run tauri:build

if [[ ! -d "$BUNDLE_APP" ]]; then
  echo "Build failed: ${BUNDLE_APP} not found"
  exit 1
fi

echo "Installing to /Applications/${APP_NAME}.app ..."
rm -rf "/Applications/${APP_NAME}.app"
cp -R "$BUNDLE_APP" "/Applications/${APP_NAME}.app"

echo "Done. Launch with: open -a ${APP_NAME}"
open -a "$APP_NAME"
