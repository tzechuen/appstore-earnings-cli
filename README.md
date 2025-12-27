# App Store Earnings CLI

A free, open-source CLI tool to view your App Store earnings by month. A simple alternative to paid services like appFigures for basic earnings tracking.

## Features

- View monthly earnings in a clean tree format (apps with their IAPs grouped together)
- **Payment info display** - see when Apple paid you and how much was deposited
- Configurable target currency (USD, EUR, GBP, SGD, etc.)
- Automatic currency conversion using ECB exchange rates
- Groups In-App Purchases and subscriptions under their parent apps
- Caches reports locally to avoid repeated API calls
- Shows the last 24 months for selection

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

## Prerequisites

- Node.js 18.0.0 or higher
- yarn or npm
- An Apple Developer account with apps on the App Store
- App Store Connect API access (requires Account Holder or Admin role)

## Setup

### 1. Clone and install dependencies

```bash
git clone https://github.com/tzechuen/appstore-earnings-cli.git
cd appstore-earnings-cli
yarn install
```

### 2. Create App Store Connect API Keys

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

### 3. Find your Vendor Number

1. In App Store Connect, go to **Payments and Financial Reports**
2. Click on **Payments** or **Financial Reports**
3. Your Vendor Number is displayed in the top-right area (it's a numeric ID like `12345678`)

### 4. Configure the CLI

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Move your `.p8` files to the project directory:
   ```bash
   mv ~/Downloads/AuthKey_XXXXXXXXXX.p8 ./
   ```

3. Edit `.env` with your credentials:
   ```bash
   # Required: Finance API Key
   ASC_ISSUER_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
   ASC_KEY_ID=XXXXXXXXXX
   ASC_PRIVATE_KEY_PATH=./AuthKey_XXXXXXXXXX.p8
   ASC_VENDOR_NUMBER=12345678

   # Optional: App Manager API Key (for grouping IAPs under apps)
   ASC_APP_MANAGER_ISSUER_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
   ASC_APP_MANAGER_KEY_ID=YYYYYYYYYY
   ASC_APP_MANAGER_PRIVATE_KEY_PATH=./AuthKey_YYYYYYYYYY.p8

   # Optional: Target currency (default: USD)
   TARGET_CURRENCY=USD
   ```

## Usage

### Basic usage

```bash
yarn start
```

This will:
1. Show an interactive menu to select a month
2. Download (or use cached) financial report for that month
3. Convert all proceeds to your target currency
4. Display earnings grouped by app

### CLI Options

```bash
# Bypass cache and re-download the report
yarn start --no-cache

# Refresh the app/IAP mapping cache
yarn start --refresh-mapping

# Enable debug output
DEBUG=1 yarn start
```

### Changing the target currency

Set the `TARGET_CURRENCY` environment variable in your `.env` file:

```bash
TARGET_CURRENCY=EUR   # Euros
TARGET_CURRENCY=GBP   # British Pounds
TARGET_CURRENCY=SGD   # Singapore Dollars
TARGET_CURRENCY=JPY   # Japanese Yen
```

Supported currencies include: USD, EUR, GBP, SGD, JPY, AUD, CAD, CHF, CNY, HKD, NZD, SEK, KRW, MXN, INR, BRL, and more.

### Payment info

The CLI displays estimated payment date and status for each month. Payment information is automatically extracted from the financial report.

**Important:** Apple's Finance Reports API does not include actual payment dates - this information is only visible in the App Store Connect web interface. The CLI **estimates** payment status based on Apple's typical payment schedule (~33 days after the fiscal month ends). Actual payment dates may vary slightly.

The payment amount shown is the total proceeds in your target currency (same as the TOTAL line).

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

### Caching

- **Financial reports** are cached in `./cache/` directory. Use `--no-cache` to bypass.
- **App/IAP mappings** are cached for 7 days. Use `--refresh-mapping` to update.

## Troubleshooting

### "No report available for this period"

Financial reports take a few days to become available after a month ends. Try selecting an earlier month.

### "Missing required environment variables"

Make sure you've created a `.env` file with all required values. See `.env.example` for the template.

### "Error reading private key"

- Check that the `.p8` file path in `ASC_PRIVATE_KEY_PATH` is correct
- Make sure the file exists and is readable

### "401 Unauthorized" or "403 Forbidden"

- Verify your API key credentials are correct
- Check that the API key has the required access level (Finance for reports)
- Ensure the API key hasn't been revoked in App Store Connect

### Flat list instead of grouped tree

This happens when the App Manager API key is not configured. Add the optional `ASC_APP_MANAGER_*` credentials to enable grouping.

### Debug mode

For detailed error messages and API response previews:

```bash
DEBUG=1 yarn start
```

## Security Notes

- Never commit your `.env` file or `.p8` key files to version control
- The `.gitignore` is configured to exclude these files
- Store your `.p8` files securely - they provide access to your App Store Connect data

## License

MIT
