# App Store Payments CLI

A local CLI tool to view your App Store earnings by month. Replaces the need for services like appFigures for basic earnings tracking.

## Features

- View monthly earnings per app in a clean table format
- Converts all currencies to SGD (Singapore Dollars)
- Uses Apple's fiscal calendar for accurate monthly breakdowns
- Caches reports locally to avoid repeated API calls
- Shows the last 24 fiscal months for selection

## Prerequisites

- Node.js 18.0.0 or higher
- yarn
- An Apple Developer account with apps on the App Store
- App Store Connect API access (Account Holder or Admin role)

## Setup

### 1. Clone and install dependencies

```bash
cd app-store-payments
yarn install
```

### 2. Create an App Store Connect API Key

1. Go to [App Store Connect](https://appstoreconnect.apple.com)
2. Navigate to **Users and Access** > **Integrations** > **App Store Connect API**
3. Click the **+** button to generate a new API key
4. Name it something like "Earnings CLI"
5. Select **Finance** or **Admin** access level
6. Click **Generate**
7. **Important**: Download the `.p8` file immediately - you can only download it once!
8. Note the **Key ID** (shown in the table)
9. Note the **Issuer ID** (shown at the top of the page)

### 3. Find your Vendor Number

1. In App Store Connect, go to **Payments and Financial Reports**
2. Click on **Payments** or **Financial Reports**
3. Your Vendor Number is displayed in the top-right area (it's a numeric ID)

### 4. Configure the CLI

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Move your `.p8` file to the project directory:
   ```bash
   mv ~/Downloads/AuthKey_XXXXXXXXXX.p8 ./
   ```

3. Edit `.env` with your credentials:
   ```bash
   ASC_ISSUER_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
   ASC_KEY_ID=XXXXXXXXXX
   ASC_PRIVATE_KEY_PATH=./AuthKey_XXXXXXXXXX.p8
   ASC_VENDOR_NUMBER=12345678
   ```

## Usage

### Basic usage

```bash
yarn start
```

This will:
1. Show an interactive menu to select a fiscal month
2. Download (or use cached) sales report for that month
3. Convert all proceeds to SGD
4. Display a table of earnings per app

### Bypass cache

To force re-download a report (e.g., if data was updated):

```bash
yarn start:no-cache
```

### Example output

```
  App Store Earnings CLI

? Select fiscal month: December 2024 (Nov 25 - Dec 29)

Fetching report for December 2024 (Nov 25 - Dec 29)...
Converting currencies to SGD...

  Earnings for December 2024 (Nov 25 - Dec 29)

┌────────────────────────────────────────┬──────────────────┐
│ App                                    │ Proceeds (SGD)   │
├────────────────────────────────────────┼──────────────────┤
│ My Awesome App                         │ S$328.45         │
│ Another Great App                      │ S$119.22         │
│ Simple Utility                         │ S$16.80          │
├────────────────────────────────────────┼──────────────────┤
│                                        │                  │
├────────────────────────────────────────┼──────────────────┤
│                                  TOTAL │         S$464.47 │
└────────────────────────────────────────┴──────────────────┘
```

## How It Works

### Data Source

The CLI uses Apple's [App Store Connect API](https://developer.apple.com/documentation/appstoreconnectapi) to download **Summary Sales Reports**. These reports contain:

- Units sold/returned per app
- Developer proceeds (your earnings after Apple's commission)
- Currency of proceeds
- Product type (app, in-app purchase, subscription, etc.)

### Fiscal Calendar

Apple uses a fiscal calendar that doesn't align with regular calendar months. Each fiscal month is either 4 or 5 weeks, starting on a Sunday. The CLI calculates these dates automatically and shows them in the month picker.

### Currency Conversion

Proceeds may be in different currencies depending on where sales occurred. The CLI fetches exchange rates from the [Frankfurter API](https://www.frankfurter.app/) (uses European Central Bank rates) and converts everything to SGD.

### Caching

Downloaded reports are cached in the `./cache/` directory. Subsequent requests for the same fiscal month will use the cached data instead of re-downloading. Use `--no-cache` to bypass this.

## Troubleshooting

### "No sales report available for..."

Reports take a few days to become available after a fiscal month ends. Try selecting an earlier month.

### "Missing required environment variables"

Make sure you've created a `.env` file with all required values. See `.env.example` for the template.

### "Error reading private key"

- Check that the `.p8` file path in `ASC_PRIVATE_KEY_PATH` is correct
- Make sure the file exists and is readable

### "401 Unauthorized" or "403 Forbidden"

- Verify your API key credentials are correct
- Check that the API key has Finance or Admin access
- Ensure the API key hasn't been revoked in App Store Connect

### Debug mode

For more detailed error messages:

```bash
DEBUG=1 yarn start
```

## Security Notes

- Never commit your `.env` file or `.p8` key file to version control
- The `.gitignore` is configured to exclude these files
- Store your `.p8` file securely - it provides access to your App Store Connect data

## License

MIT
