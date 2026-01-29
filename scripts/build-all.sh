#!/bin/bash
set -e

echo "Building appstore-earnings-cli for all platforms..."
echo ""

# Create bin directory
mkdir -p bin

# Build for each platform
echo "Building for macOS ARM64 (Apple Silicon)..."
bun build src/index.ts --compile --target=bun-darwin-arm64 --outfile bin/appstore-earnings-darwin-arm64

echo "Building for macOS x64 (Intel)..."
bun build src/index.ts --compile --target=bun-darwin-x64 --outfile bin/appstore-earnings-darwin-x64

echo "Building for Linux x64..."
bun build src/index.ts --compile --target=bun-linux-x64 --outfile bin/appstore-earnings-linux-x64

echo "Building for Linux ARM64..."
bun build src/index.ts --compile --target=bun-linux-arm64 --outfile bin/appstore-earnings-linux-arm64

echo "Building for Windows x64..."
bun build src/index.ts --compile --target=bun-windows-x64 --outfile bin/appstore-earnings-windows-x64.exe

echo ""
echo "All builds complete!"
echo ""
ls -lh bin/
