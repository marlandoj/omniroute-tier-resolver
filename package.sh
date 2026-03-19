#!/bin/bash
# Package script for sharing omniroute-tier-resolver skill

set -e

SKILL_NAME="omniroute-tier-resolver"
VERSION="1.0.0"
OUTPUT_FILE="${SKILL_NAME}-v${VERSION}.tar.gz"

echo "📦 Packaging ${SKILL_NAME} v${VERSION}..."

# Navigate to Skills directory
cd "$(dirname "$0")/.."

# Create tarball
tar -czf "$OUTPUT_FILE" \
  --exclude='*.tar.gz' \
  --exclude='.git' \
  --exclude='node_modules' \
  "$SKILL_NAME/"

echo "✅ Created: $(pwd)/$OUTPUT_FILE"
echo ""
echo "📤 Share with colleague:"
echo "   scp $OUTPUT_FILE colleague@host:/home/workspace/Skills/"
echo ""
echo "📥 Colleague installs:"
echo "   cd /home/workspace/Skills"
echo "   tar -xzf $OUTPUT_FILE"
echo "   cd $SKILL_NAME/scripts"
echo "   bun tier-resolve.ts --help"
