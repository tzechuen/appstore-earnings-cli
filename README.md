# App Store Earnings CLI

A free, open-source CLI tool to view your App Store earnings by month. A simple alternative to paid services like appFigures for basic earnings tracking.

## Features

- **Standalone binary** - No runtime dependencies required
- View monthly earnings in a clean tree format (apps with their IAPs grouped together)
- **Payment info display** - see when Apple paid you and how much was deposited
- Configurable target currency (USD, EUR, GBP, SGD, etc.)
- Automatic currency conversion using ECB exchange rates
- Groups In-App Purchases and subscriptions under their parent apps
- Caches reports locally to avoid repeated API calls
- Shows the last 24 months for selection
- **Interactive setup wizard** for first-time configuration

## Example Output

```
  App Store Earnings CLI

? Select month: September 2025

Fetching financial report for September 2025...
Converting currencies to USD...

  Earnings for September 2025

├── My Awesome App                          $128.45
│   ├── Pro Upgrade                          $89.99
│   ├── Premium Features                     $28.50
│   └── Remove Ads                            $9.96
│
├── Photo Editor Pro                         $67.22
│   ├── Monthly Subscription                 $45.00
│   └── Yearly Subscription                  $22.22
│
└── Simple Utility                           $12.99
    └── (App Sales)                          $12.99

─────────────────────────────────────────────────────
                                  TOTAL      $208.66

  Payment Status: Paid (estimated)
  Payment Date: ~Oct 5, 2025
  Amount: ~$208.66
```

## Installation

### Option 1: Standalone Binary (Recommended)

Download and install with a single command:

```bash
curl -fsSL https://raw.githubusercontent.com/tzechuen/appstore-earnings-cli/main/install.sh | bash
```

This will:
- Detect your OS and architecture
- Download the appropriate binary from GitHub Releases
- Install to `/usr/local/bin` (or `~/.local/bin` if no sudo access)

### Option 2: Manual Download

Download the appropriate binary from the [Releases page](https://github.com/tzechuen/appstore-earnings-cli/releases):

| Platform | Binary |
|----------|--------|
| macOS (Apple Silicon) | `appstore-earnings-darwin-arm64` |
| macOS (Intel) | `appstore-earnings-darwin-x64` |
| Linux x64 | `appstore-earnings-linux-x64` |
| Linux ARM64 | `appstore-earnings-linux-arm64` |
| Windows x64 | `appstore-earnings-windows-x64.exe` |

Then make it executable and move to your PATH:

```bash
chmod +x appstore-earnings-darwin-arm64
sudo mv appstore-earnings-darwin-arm64 /usr/local/bin/appstore-earnings
```

### Option 3: Build from Source

Requires [Bun](https://bun.sh) installed.

```bash
git clone https://github.com/tzechuen/appstore-earnings-cli.git
cd appstore-earnings-cli
bun install
bun run build
# Binary is now at ./bin/appstore-earnings
```

## Setup

### First-Time Configuration

Run the setup wizard to configure your API credentials:

```bash
appstore-earnings --setup
```

The wizard will guide you through:
1. Entering your App Store Connect API credentials
2. Copying your `.p8` key files to a secure location
3. Setting your preferred currency

### Configuration Options

Configuration is loaded in priority order:

1. **Environment variables** (highest priority)
2. **`.env` file** in current working directory
3. **Config file** at `~/.config/appstore-earnings-cli/config.json`

#### Environment Variables

```bash
# Required: Finance API Key
export ASC_ISSUER_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
export ASC_KEY_ID=XXXXXXXXXX
export ASC_PRIVATE_KEY_PATH=/path/to/AuthKey_XXXXXXXXXX.p8
export ASC_VENDOR_NUMBER=12345678

# Optional: App Manager API Key (for grouping IAPs under apps)
export ASC_APP_MANAGER_ISSUER_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
export ASC_APP_MANAGER_KEY_ID=YYYYYYYYYY
export ASC_APP_MANAGER_PRIVATE_KEY_PATH=/path/to/AuthKey_YYYYYYYYYY.p8

# Optional: Target currency (default: USD)
export TARGET_CURRENCY=USD

# Optional: Custom cache directory
export ASC_CACHE_DIR=/path/to/cache
```

#### Config File Format

`~/.config/appstore-earnings-cli/config.json`:

```json
{
  "issuerId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "keyId": "XXXXXXXXXX",
  "privateKeyPath": "keys/AuthKey_XXXXXXXXXX.p8",
  "vendorNumber": "12345678",
  "targetCurrency": "USD",
  "appManagerIssuerId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "appManagerKeyId": "YYYYYYYYYY",
  "appManagerPrivateKeyPath": "keys/AuthKey_YYYYYYYYYY.p8"
}
```

### Private Key Handling

The CLI supports multiple ways to provide your private key:

1. **Absolute path**: `/Users/me/keys/AuthKey.p8`
2. **Relative to config directory**: `keys/AuthKey.p8` (relative to `~/.config/appstore-earnings-cli/`)
3. **Relative to current directory**: `./AuthKey.p8`
4. **Base64 encoded** (for CI/CD): `base64:LS0tLS1CRUdJTi...`

### Creating API Keys

You need **one required key** and **one optional key**:

#### Required: Finance API Key

This key is used to download financial reports.

1. Go to [App Store Connect](https://appstoreconnect.apple.com)
2. Navigate to **Users and Access** > **Integrations** > **App Store Connect API**
3. Click **+** to generate a new API key
4. Name it something like "Earnings CLI - Finance"
5. Select **Finance** access level
6. Click **Generate**
7. **Download the `.p8` file immediately** - you can only download it once!
8. Note the **Key ID** and **Issuer ID**

#### Optional: App Manager API Key

This key enables grouping of In-App Purchases under their parent apps. Without it, earnings are shown as a flat list.

1. Create another API key following the same steps
2. Name it "Earnings CLI - App Manager"
3. Select **App Manager** access level (or **Admin** if you prefer)
4. Download and save the `.p8` file separately

### Finding Your Vendor Number

1. In App Store Connect, go to **Payments and Financial Reports**
2. Click on **Payments** or **Financial Reports**
3. Your Vendor Number is displayed in the top-right area (it's a numeric ID like `12345678`)

## Usage

### Basic Usage

```bash
appstore-earnings
```

This will:
1. Show an interactive menu to select a month
2. Download (or use cached) financial report for that month
3. Convert all proceeds to your target currency
4. Display earnings grouped by app

### CLI Options

```bash
# Bypass cache and re-download the report
appstore-earnings --no-cache

# Refresh the app/IAP mapping cache
appstore-earnings --refresh-mapping

# Run the setup wizard
appstore-earnings --setup

# Show configuration status
appstore-earnings --status

# Enable debug output
DEBUG=1 appstore-earnings
```

### Cache Locations

Cache files are stored in XDG-compliant locations:

- **Reports**: `~/.cache/appstore-earnings-cli/reports/`
- **Product mapping**: `~/.cache/appstore-earnings-cli/product-mapping.json`

You can override the cache location with `ASC_CACHE_DIR`.

## How It Works

### Data Source

The CLI uses Apple's [App Store Connect API](https://developer.apple.com/documentation/appstoreconnectapi) to download **Financial Reports**. These reports contain actual payment amounts that match what Apple deposits to your bank account.

### Two API Keys Explained

Apple's API requires different access levels for different endpoints:

| Endpoint | Required Role | Purpose |
|----------|---------------|---------|
| Financial Reports | Finance | Download monthly earnings data |
| Apps, IAPs, Subscriptions | App Manager | Fetch app/IAP relationships for grouping |

If you only configure the Finance key, earnings will be shown as a flat list without grouping IAPs under their parent apps.

### Currency Conversion

Proceeds from App Store sales come in different currencies depending on the storefront. The CLI fetches exchange rates from the [Frankfurter API](https://www.frankfurter.app/) (uses European Central Bank rates) and converts everything to your target currency.

**Note:** Exchange rates may differ slightly from Apple's actual conversion rates, so totals may not match your bank deposits exactly.

### Payment Info

The CLI displays estimated payment date and status for each month. Payment information is automatically extracted from the financial report.

**Important:** Apple's Finance Reports API does not include actual payment dates - this information is only visible in the App Store Connect web interface. The CLI **estimates** payment status based on Apple's typical payment schedule (~33 days after the fiscal month ends). Actual payment dates may vary slightly.

## Troubleshooting

### "No report available for this period"

Financial reports take a few days to become available after a month ends. Try selecting an earlier month.

### "Missing required configuration"

Make sure you've configured your credentials using one of:
- `appstore-earnings --setup` (recommended)
- Environment variables
- `.env` file in current directory

### "Error reading private key"

- Check that the `.p8` file path is correct
- Make sure the file exists and is readable
- Try using an absolute path

### "401 Unauthorized" or "403 Forbidden"

- Verify your API key credentials are correct
- Check that the API key has the required access level (Finance for reports)
- Ensure the API key hasn't been revoked in App Store Connect

### Flat list instead of grouped tree

This happens when the App Manager API key is not configured. Add the optional App Manager credentials to enable grouping.

### Debug mode

For detailed error messages and API response previews:

```bash
DEBUG=1 appstore-earnings
```

## Development

### Prerequisites

- [Bun](https://bun.sh) 1.0 or higher

### Running locally

```bash
bun install
bun run start
```

### Building

```bash
# Build for current platform
bun run build

# Build for all platforms
bun run build:all
```

## Security Notes

- Never commit your `.env` file or `.p8` key files to version control
- The `.gitignore` is configured to exclude these files
- Store your `.p8` files securely - they provide access to your App Store Connect data
- When using the setup wizard, keys are stored in `~/.config/appstore-earnings-cli/keys/`

## License

MIT
