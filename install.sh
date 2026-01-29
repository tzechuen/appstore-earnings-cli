#!/bin/bash
set -e

# App Store Earnings CLI Installer
# Usage: curl -fsSL https://raw.githubusercontent.com/tzechuen/appstore-earnings-cli/main/install.sh | bash

REPO="tzechuen/appstore-earnings-cli"
BINARY_NAME="appstore-earnings"
INSTALL_DIR="${INSTALL_DIR:-/usr/local/bin}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo ""
echo "  App Store Earnings CLI Installer"
echo ""

# Detect OS and architecture
detect_platform() {
    local os=""
    local arch=""

    case "$(uname -s)" in
        Darwin)
            os="darwin"
            ;;
        Linux)
            os="linux"
            ;;
        MINGW*|MSYS*|CYGWIN*)
            os="windows"
            ;;
        *)
            echo -e "${RED}Error: Unsupported operating system: $(uname -s)${NC}"
            exit 1
            ;;
    esac

    case "$(uname -m)" in
        x86_64|amd64)
            arch="x64"
            ;;
        arm64|aarch64)
            arch="arm64"
            ;;
        *)
            echo -e "${RED}Error: Unsupported architecture: $(uname -m)${NC}"
            exit 1
            ;;
    esac

    echo "${os}-${arch}"
}

# Get the latest release version
get_latest_version() {
    curl -s "https://api.github.com/repos/${REPO}/releases/latest" | \
        grep '"tag_name":' | \
        sed -E 's/.*"([^"]+)".*/\1/'
}

# Main installation logic
main() {
    local platform
    platform=$(detect_platform)
    echo "  Detected platform: ${platform}"

    # Get latest version
    echo "  Fetching latest release..."
    local version
    version=$(get_latest_version)

    if [ -z "$version" ]; then
        echo -e "${RED}Error: Could not determine latest version${NC}"
        echo "  Please check https://github.com/${REPO}/releases"
        exit 1
    fi

    echo "  Latest version: ${version}"

    # Construct download URL
    local binary_suffix=""
    if [ "$platform" = "windows-x64" ]; then
        binary_suffix=".exe"
    fi

    local download_url="https://github.com/${REPO}/releases/download/${version}/${BINARY_NAME}-${platform}${binary_suffix}"
    local temp_file="/tmp/${BINARY_NAME}${binary_suffix}"

    echo "  Downloading from: ${download_url}"

    # Download the binary
    if ! curl -fsSL -o "$temp_file" "$download_url"; then
        echo -e "${RED}Error: Failed to download binary${NC}"
        echo "  URL: ${download_url}"
        exit 1
    fi

    # Make it executable
    chmod +x "$temp_file"

    # Determine install location
    local install_path="${INSTALL_DIR}/${BINARY_NAME}"

    # Check if we can write to install directory
    if [ -w "$INSTALL_DIR" ]; then
        mv "$temp_file" "$install_path"
        echo -e "${GREEN}  Installed to: ${install_path}${NC}"
    else
        # Try with sudo
        echo "  Requesting sudo access to install to ${INSTALL_DIR}..."
        if sudo mv "$temp_file" "$install_path"; then
            echo -e "${GREEN}  Installed to: ${install_path}${NC}"
        else
            # Fall back to ~/.local/bin
            local local_bin="$HOME/.local/bin"
            mkdir -p "$local_bin"
            mv "$temp_file" "$local_bin/${BINARY_NAME}"
            chmod +x "$local_bin/${BINARY_NAME}"
            install_path="$local_bin/${BINARY_NAME}"
            echo -e "${YELLOW}  Installed to: ${install_path}${NC}"
            echo ""
            echo -e "${YELLOW}  Note: Add ~/.local/bin to your PATH if not already:${NC}"
            echo "    export PATH=\"\$HOME/.local/bin:\$PATH\""
        fi
    fi

    echo ""
    echo -e "${GREEN}  Installation complete!${NC}"
    echo ""
    echo "  Run '${BINARY_NAME}' to get started."
    echo "  Run '${BINARY_NAME} --setup' for first-time configuration."
    echo ""
}

main
