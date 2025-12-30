#!/bin/bash

# VeloxCase Packaging Script
# Excludes .env files and heavy folders like node_modules

OUTPUT_FILE="veloxcase_update.tar.gz"

echo "📦 Packaging VeloxCase (excluding .env files)..."

tar --exclude='.env' \
    --exclude='.env.example' \
    --exclude='node_modules' \
    --exclude='.git' \
    --exclude='__pycache__' \
    --exclude='.pytest_cache' \
    --exclude='.DS_Store' \
    -czf $OUTPUT_FILE .

echo "✅ Done! Package created: $OUTPUT_FILE"
echo "🚀 You can now send this file to your Oracle Cloud server using scp."
