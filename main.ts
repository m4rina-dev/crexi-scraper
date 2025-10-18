// Apify SDK - toolkit for building Apify Actors (Read more at https://docs.apify.com/sdk/js/).
import { Actor, log } from 'apify';
// Web scraping and browser automation library (Read more at https://crawlee.dev)
import { PuppeteerCrawler, ProxyConfiguration } from 'crawlee';
import { router } from './routes.js';

// TypeScript interface for the Actor input
interface Input {
    startUrls: {
        url: string;
        method?: 'GET' | 'HEAD' | 'POST' | 'PUT' | 'DELETE' | 'TRACE' | 'OPTIONS' | 'CONNECT' | 'PATCH';
        headers?: Record<string, string>;
        userData?: Record<string, unknown>;
    }[];
    maxCrawlPages?: number;
    maxCrawlDepth?: number;
    maxConcurrency?: number;
    proxyConfiguration?: {
        useApifyProxy?: boolean;
        proxyUrls?: string[];
        groups?: string[];
    };
    waitForDynamicContent?: number;
    includeDetailedKeyValues?: boolean;
    debugMode?: boolean;
}

// The init() call configures the Actor for its environment. It's recommended to start every Actor with an init().
await Actor.init();

try {
    // Get input from the Actor or use default values
    const input = (await Actor.getInput<Input>()) ?? {} as Input;

    const {
        startUrls = [{ url: 'https://www.crexi.com/properties/search?query=Los%20Angeles,%20CA,%20USA' }],
        maxCrawlPages = 100,
        maxCrawlDepth = 2,
        maxConcurrency = 1,
        proxyConfiguration = { useApifyProxy: true },
        waitForDynamicContent = 3,
        includeDetailedKeyValues = true,
        debugMode = false,
    } = input;

    // Validate input
    if (!startUrls || startUrls.length === 0) {
        throw new Error('At least one start URL must be provided');
    }

    // Log configuration for debugging
    log.info('Crexi Scraper starting with configuration:', {
        numberOfStartUrls: startUrls.length,
        maxCrawlPages,
        maxCrawlDepth,
        maxConcurrency,
        waitForDynamicContent,
        includeDetailedKeyValues,
        debugMode,
    });

    // Create a proxy configuration that will rotate proxies
    let proxyConfig: ProxyConfiguration | undefined;
    try {
        proxyConfig = await Actor.createProxyConfiguration(proxyConfiguration);
        log.info('Proxy configuration created successfully');
    } catch (error) {
        log.warning('Failed to create proxy configuration, continuing without proxies', { error });
    }

    // Store configuration in a global context for access in routes
    // This allows routes.ts to access the configuration
    (global as any).actorConfig = {
        waitForDynamicContent: waitForDynamicContent * 1000, // Convert to milliseconds
        includeDetailedKeyValues,
        debugMode,
    };

    // Create a PuppeteerCrawler that will handle the scraping
    const crawler = new PuppeteerCrawler({
        // Use proxy configuration if available
        proxyConfiguration: proxyConfig,

        // Use the router from routes.ts to handle requests
        requestHandler: router,

        // Maximum number of pages to crawl
        maxRequestsPerCrawl: maxCrawlPages,

        // Maximum number of concurrent browser instances
        maxConcurrency,

        // Configure Puppeteer launch options for stability and compatibility
        launchContext: {
            launchOptions: {
                args: [
                    '--disable-gpu', // Mitigates the "crashing GPU process" issue in Docker containers
                    '--no-sandbox', // Required for Docker containers
                    '--disable-setuid-sandbox', // Required for Docker containers
                    '--disable-dev-shm-usage', // Overcome limited resource problems in Docker
                    '--disable-accelerated-2d-canvas', // Stability improvement
                    '--window-size=1920,1080', // Set a reasonable window size
                    '--disable-blink-features=AutomationControlled', // Hide automation
                ],
            } as any,
            useChrome: true, // Use full Chrome instead of Chromium
        },

        // Add page configuration to make browser look more human
        preNavigationHooks: [
            async ({ page }) => {
                // Set realistic user agent
                await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

                // Override webdriver property
                await page.evaluateOnNewDocument(() => {
                    Object.defineProperty(navigator, 'webdriver', {
                        get: () => false,
                    });
                });

                // Set viewport to realistic size
                await page.setViewport({ width: 1920, height: 1080 });

                // Add realistic headers
                await page.setExtraHTTPHeaders({
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                });
            },
        ],

        // Configure request handling with retries and timeouts
        requestHandlerTimeoutSecs: 180, // 3 minutes timeout for each page
        maxRequestRetries: 3, // Retry failed requests up to 3 times

        // Configure navigation timeouts
        navigationTimeoutSecs: 90, // 90 seconds for navigation

        // Log details about the crawling process
        async failedRequestHandler({ request, log }, error) {
            log.error(`Request ${request.url} failed after ${request.retryCount} retries`, {
                error: error.message,
                url: request.url,
            });
        },
    });

    // Prepare start URLs with proper format and initial depth
    const formattedStartUrls = startUrls.map((item) => ({
        url: item.url,
        userData: {
            ...item.userData,
            depth: 0, // Initialize depth tracking
            label: item.url.includes('/properties/') && !item.url.includes('/search') ? 'DETAIL' : 'SEARCH',
        },
    }));

    log.info(`Starting crawler with ${formattedStartUrls.length} URLs`);

    // Run the crawler with the start URLs and wait for it to finish
    await crawler.run(formattedStartUrls);

    log.info('Crawler finished successfully');
} catch (error) {
    // Log any errors that occur during execution
    log.error('Actor failed with error:', { error: error instanceof Error ? error.message : error });
    throw error;
}

// Gracefully exit the Actor process. It's recommended to quit all Actors with an exit().
await Actor.exit();
