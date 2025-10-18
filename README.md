# Crexi Commercial Real Estate Scraper

A production-ready Apify Actor for scraping commercial real estate listings from Crexi.com. Extract property details including prices, descriptions, square footage, and comprehensive property information.

## Features

- **Dual URL Support**: Works with both search result pages and direct property URLs
- **Comprehensive Data Extraction**: Captures titles, prices, addresses, property types, descriptions, images, and detailed property attributes
- **Angular SPA Handling**: Properly waits for dynamic content to load before scraping
- **Robust Error Handling**: Continues operation even if some fields are missing
- **Proxy Support**: Built-in Apify Proxy integration to avoid blocking
- **Configurable Limits**: Control max pages, concurrency, and crawl depth
- **TypeScript**: Fully typed for better development experience
- **Production Ready**: Includes retries, timeouts, and comprehensive logging

## Input Parameters

The Actor accepts the following input parameters:

### Required Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `startUrls` | Array | List of Crexi.com URLs to start scraping (search pages or property pages) |

### Optional Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `maxCrawlPages` | Integer | 100 | Maximum number of property pages to scrape |
| `maxCrawlDepth` | Integer | 2 | Maximum depth of links to follow from start URLs |
| `maxConcurrency` | Integer | 5 | Number of pages to process concurrently (1-20) |
| `proxyConfiguration` | Object | `{ useApifyProxy: true }` | Proxy settings for requests |
| `waitForDynamicContent` | Integer | 2 | Additional seconds to wait for JavaScript content to load |
| `includeDetailedKeyValues` | Boolean | true | Extract all key-value pairs from property details table |
| `debugMode` | Boolean | false | Enable verbose logging for troubleshooting |

## Input Example

```json
{
  "startUrls": [
    {
      "url": "https://www.crexi.com/properties/search?query=Los%20Angeles,%20CA,%20USA"
    },
    {
      "url": "https://www.crexi.com/properties/123456/office-building"
    }
  ],
  "maxCrawlPages": 50,
  "maxConcurrency": 5,
  "waitForDynamicContent": 3,
  "includeDetailedKeyValues": true,
  "proxyConfiguration": {
    "useApifyProxy": true
  }
}
```

## Output Format

Each scraped property is saved as a JSON object with the following structure:

```json
{
  "title": "Class A Office Building - Downtown",
  "price": "$2,500,000",
  "address": "123 Main Street, Los Angeles, CA 90012",
  "propertyType": "Office",
  "squareFootage": "15,000 SF",
  "yearBuilt": "2015",
  "parking": "50 spaces",
  "lotSize": "0.5 acres",
  "description": "Prime office space in the heart of downtown Los Angeles. Recently renovated with modern amenities...",
  "url": "https://www.crexi.com/properties/123456/office-building",
  "mainImage": "https://images.crexi.com/...",
  "scrapedAt": "2025-10-17T12:34:56.789Z",
  "capRate": "6.5%",
  "occupancy": "95%",
  "zoning": "C2",
  "tenancy": "Multi-tenant"
}
```

### Output Fields

| Field | Type | Description |
|-------|------|-------------|
| `title` | String | Property listing title |
| `price` | String | Listing price (may include "Contact for Price") |
| `address` | String | Full property address |
| `propertyType` | String | Type of property (Office, Retail, Industrial, etc.) |
| `squareFootage` | String | Total square footage |
| `yearBuilt` | String | Year the property was built (if available) |
| `parking` | String | Parking information (if available) |
| `lotSize` | String | Lot/land size (if available) |
| `description` | String | Full property description |
| `url` | String | URL of the property listing |
| `mainImage` | String | URL of the main property image |
| `scrapedAt` | String | ISO timestamp of when the data was scraped |
| Additional fields | Various | Other property details extracted from the details table |

## Usage

### Running on Apify Platform

1. Create a new Actor on the Apify platform
2. Copy all files from this repository to your Actor
3. Build the Actor
4. Configure the input parameters
5. Run the Actor

### Running Locally

1. Clone this repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Build the TypeScript code:
   ```bash
   npm run build
   ```
4. Run the Actor:
   ```bash
   npm start
   ```

### Using Apify CLI

```bash
# Install Apify CLI
npm install -g apify-cli

# Initialize (if starting from scratch)
apify init

# Run locally
apify run

# Push to Apify platform
apify push
```

## How It Works

### Architecture

The Actor uses a two-handler approach:

1. **SEARCH Handler (Default)**:
   - Processes search result pages
   - Waits for Angular to load
   - Extracts all property card links
   - Enqueues property URLs with 'DETAIL' label
   - Handles pagination detection

2. **DETAIL Handler**:
   - Processes individual property pages
   - Waits for dynamic content to load
   - Extracts comprehensive property data
   - Handles missing fields gracefully
   - Saves data to dataset

### Technical Implementation

- **Framework**: Built with Apify SDK v3 and Crawlee v3
- **Browser**: Uses Puppeteer for browser automation
- **Language**: TypeScript for type safety
- **SPA Handling**: Implements proper waits for Angular application
- **Error Recovery**: 3 retries per request with exponential backoff
- **Proxy Rotation**: Automatic proxy rotation via Apify Proxy

### Handling Angular/SPA Pages

Crexi.com uses Angular, which requires special handling:

1. Wait for specific Angular selectors to appear
2. Wait for network idle (all API calls completed)
3. Additional configurable delay for dynamic content
4. Multiple fallback selector strategies

## Configuration Tips

### Scraping Speed vs Reliability

- **Faster**: Increase `maxConcurrency` (up to 10), decrease `waitForDynamicContent`
- **More Reliable**: Decrease `maxConcurrency` (3-5), increase `waitForDynamicContent` (3-5 seconds)

### Avoiding Blocks

- Always use proxies (`useApifyProxy: true`)
- Keep `maxConcurrency` reasonable (5-10)
- Use `waitForDynamicContent` to mimic human behavior

### Debugging Issues

1. Enable `debugMode: true` to see detailed logs
2. Check Actor logs for selector timeout warnings
3. Screenshots are saved in debug mode when issues occur
4. Verify start URLs are accessible and contain property listings

## Common Use Cases

### Scrape All Properties in a City

```json
{
  "startUrls": [
    {
      "url": "https://www.crexi.com/properties/search?query=Chicago,%20IL,%20USA"
    }
  ],
  "maxCrawlPages": 500,
  "maxConcurrency": 5
}
```

### Scrape Specific Property Types

Use Crexi's search filters to create a URL with property type filters, then use that as your start URL:

```json
{
  "startUrls": [
    {
      "url": "https://www.crexi.com/properties/search?query=Atlanta,%20GA&propertyType=Office"
    }
  ]
}
```

### Scrape Specific Properties

```json
{
  "startUrls": [
    {
      "url": "https://www.crexi.com/properties/123456/property-name"
    },
    {
      "url": "https://www.crexi.com/properties/789012/another-property"
    }
  ]
}
```

## Limitations

- Crexi.com requires JavaScript, so this Actor uses Puppeteer (slower than HTTP-only scrapers)
- Some properties may have incomplete data (handled gracefully)
- Rate limiting may occur without proxies
- Pagination on search pages is detected but not automatically handled (submit multiple search URLs if needed)

## Troubleshooting

### No Data Extracted

- **Issue**: Properties return empty or minimal data
- **Solution**: Increase `waitForDynamicContent` to 5-10 seconds, enable `debugMode`

### Timeout Errors

- **Issue**: Pages timing out during scraping
- **Solution**: Increase `requestHandlerTimeoutSecs` in main.ts, use proxies

### Missing Fields

- **Issue**: Some properties missing specific fields (year built, parking, etc.)
- **Solution**: This is expected - not all properties have all fields. The Actor handles this gracefully.

### Blocked/Rate Limited

- **Issue**: Actor getting blocked by Crexi
- **Solution**: Enable Apify Proxy, reduce `maxConcurrency`, increase `waitForDynamicContent`

## Best Practices

1. **Always use proxies** when scraping more than a few pages
2. **Start small** - test with 10-20 pages before scaling up
3. **Monitor logs** - check for warnings about missing selectors
4. **Respect rate limits** - use reasonable concurrency (5-10)
5. **Save your configuration** - use the same settings for consistent results

## License

This Actor is licensed under the Apache-2.0 License.

## Support

For issues, questions, or feature requests, please open an issue on the GitHub repository or contact support through the Apify platform.

## Changelog

### Version 1.0.0
- Initial release
- Support for search pages and property detail pages
- Comprehensive data extraction
- Angular/SPA handling
- Proxy support
- Error handling and retries
- TypeScript implementation

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
