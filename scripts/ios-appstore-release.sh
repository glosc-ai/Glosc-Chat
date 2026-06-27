#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: scripts/ios-appstore-release.sh [--upload] [--clean]

Build an iOS IPA for App Store Connect with Tauri.

Options:
  --upload   Validate and upload the generated IPA with altool.
             Requires APPLE_ID and APP_SPECIFIC_PASSWORD in the environment.
  --clean    Remove previous iOS build outputs before building.

Optional environment:
  DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer
EOF
}

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

UPLOAD=0
CLEAN=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --upload)
      UPLOAD=1
      ;;
    --clean)
      CLEAN=1
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
  shift
done

export DEVELOPER_DIR="${DEVELOPER_DIR:-/Applications/Xcode.app/Contents/Developer}"

if [[ ! -x "$DEVELOPER_DIR/usr/bin/xcodebuild" ]]; then
  echo "Xcode was not found at: $DEVELOPER_DIR" >&2
  echo "Install Xcode or set DEVELOPER_DIR to the full Xcode Developer directory." >&2
  exit 1
fi

export PATH="$ROOT_DIR/scripts/tauri-ios-xcrun:$DEVELOPER_DIR/usr/bin:$PATH"

if [[ "$CLEAN" -eq 1 ]]; then
  rm -rf "$ROOT_DIR/src-tauri/gen/apple/build" \
    "$ROOT_DIR/src-tauri/target/aarch64-apple-ios/release/bundle/ios" \
    "$ROOT_DIR/build/ios"
fi

marker="$(mktemp "${TMPDIR:-/tmp}/glosc-ios-build.XXXXXX")"
touch "$marker"
trap 'rm -f "$marker"' EXIT

npm run build

npm run -- tauri ios build \
  --target aarch64 \
  --export-method app-store-connect \
  --ci

ipa_path="$(
  find "$ROOT_DIR" \
    -path "$ROOT_DIR/.git" -prune -o \
    -path "$ROOT_DIR/node_modules" -prune -o \
    -name '*.ipa' -type f -newer "$marker" -print |
    sort |
    tail -n 1
)"

if [[ -z "$ipa_path" ]]; then
  echo "Build completed, but no new IPA was found." >&2
  exit 1
fi

echo "IPA: $ipa_path"

if [[ "$UPLOAD" -eq 0 ]]; then
  echo "Upload skipped. Run with --upload to send this IPA to App Store Connect."
  exit 0
fi

if [[ -z "${APPLE_ID:-}" || -z "${APP_SPECIFIC_PASSWORD:-}" ]]; then
  echo "APPLE_ID and APP_SPECIFIC_PASSWORD are required for --upload." >&2
  echo "Example: APPLE_ID='name@example.com' APP_SPECIFIC_PASSWORD='xxxx-xxxx-xxxx-xxxx' scripts/ios-appstore-release.sh --upload" >&2
  exit 2
fi

xcrun altool --validate-app \
  -f "$ipa_path" \
  -t ios \
  -u "$APPLE_ID" \
  -p "$APP_SPECIFIC_PASSWORD"

xcrun altool --upload-app \
  -f "$ipa_path" \
  -t ios \
  -u "$APPLE_ID" \
  -p "$APP_SPECIFIC_PASSWORD"
