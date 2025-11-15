#!/bin/bash

# Browser Extension Build Script
# Builds production-ready ZIP files for Chrome and Firefox

set -e

echo "🔨 Building Firstly Academy Flashcard Saver Extension..."

# Create dist directory
mkdir -p ../dist

# Clean previous builds
rm -f ../dist/flashcard-saver-*.zip

# Files to exclude from build
EXCLUDE_FILES="*.md build.sh .DS_Store .git* *.backup.json"

# Build Chrome version
echo ""
echo "📦 Building Chrome/Brave version..."
zip -r ../dist/flashcard-saver-chrome.zip . \
  -x $EXCLUDE_FILES \
  -x "manifest.firefox.json" \
  > /dev/null

# Build Firefox version
echo "📦 Building Firefox version..."

# Backup current manifest
cp manifest.json manifest.backup.json

# Use Firefox manifest
cp manifest.firefox.json manifest.json

# Create Firefox zip
zip -r ../dist/flashcard-saver-firefox.zip . \
  -x $EXCLUDE_FILES \
  -x "manifest.backup.json" \
  > /dev/null

# Restore original manifest
mv manifest.backup.json manifest.json

# Show results
echo ""
echo "✅ Build complete!"
echo ""
echo "📂 Output files:"
ls -lh ../dist/flashcard-saver-*.zip | awk '{print "   " $9 " (" $5 ")"}'

echo ""
echo "📋 Next steps:"
echo "   1. Test the extensions in their respective browsers"
echo "   2. Upload to browser stores:"
echo "      - Chrome Web Store: https://chrome.google.com/webstore/devconsole"
echo "      - Firefox Add-ons: https://addons.mozilla.org/developers/"
echo ""
