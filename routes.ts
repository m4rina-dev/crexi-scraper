import { createPuppeteerRouter, Dataset } from 'crawlee';

// TypeScript interface for scraped property data
interface PropertyData {
    title: string;
    price: string;
    address: string;
    propertyType: string;
    squareFootage: string;
    yearBuilt?: string;
    parking?: string;
    lotSize?: string;
    description: string;
    url: string;
    mainImage?: string;
    scrapedAt: string;
    [key: string]: any; // For additional details from key-value table
}

// Access global configuration set in main.ts
function getConfig() {
    return (global as any).actorConfig || {
        waitForDynamicContent: 2000,
        includeDetailedKeyValues: true,
        debugMode: false,
    };
}

// Create the router for handling different page types
export const router = createPuppeteerRouter();

/**
 * SEARCH Handler - Processes search result pages
 * Extracts property listing links and enqueues them for detailed scraping
 */
router.addDefaultHandler(async ({ request, page, enqueueLinks, log }) => {
    const config = getConfig();
    const url = request.loadedUrl || request.url;

    log.info(`Processing SEARCH page: ${url}`);

    try {
        // Wait for Angular to bootstrap and load the search results
        // Crexi uses Angular, so we need to wait for the framework to initialize
        if (config.debugMode) {
            log.info('Waiting for Angular application to load...');
        }

        // Wait for the search results panel to appear
        try {
            await page.waitForSelector('div.search-sub-panel__results-tab, cui-card.has-gallery', {
                timeout: 30000,
            });
            log.info('Search results panel loaded successfully');
        } catch (error) {
            log.warning('Timeout waiting for search results panel. Page may not have loaded correctly.');
            // Take a screenshot for debugging if in debug mode
            if (config.debugMode) {
                await page.screenshot({ path: 'apify_storage/debug-search-timeout.png', fullPage: true });
            }
        }

        // Wait for network to be idle (all API calls completed)
        try {
            await page.waitForNetworkIdle({ timeout: 10000 });
        } catch (error) {
            log.warning('Network did not become idle, continuing anyway');
        }

        // Additional wait for dynamic content based on user configuration
        if (config.waitForDynamicContent > 0) {
            await page.waitForTimeout(config.waitForDynamicContent);
        }

        // Extract property card links using page.evaluate for better performance
        const propertyLinks = await page.evaluate(() => {
            const links: string[] = [];

            // Method 1: Look for property card links (primary method)
            const cardLinks = document.querySelectorAll('cui-card.has-gallery > a.cui-card-cover-link');
            cardLinks.forEach((link) => {
                const href = (link as HTMLAnchorElement).href;
                // Only include links that have a property ID (numeric or alphanumeric after /properties/)
                if (href && href.match(/\/properties\/[a-zA-Z0-9-]+$/)) {
                    links.push(href);
                }
            });

            // Method 2: Fallback - look for any links to property pages with IDs
            if (links.length === 0) {
                const allLinks = document.querySelectorAll('a[href*="/properties/"]');
                allLinks.forEach((link) => {
                    const href = (link as HTMLAnchorElement).href;
                    // Only include direct property page links with IDs, not search/filter pages
                    if (href &&
                        href.match(/\/properties\/[a-zA-Z0-9-]+$/) &&
                        !href.includes('/search') &&
                        !href.includes('/Auctions') &&
                        !href.includes('?') &&
                        !href.includes('#')) {
                        links.push(href);
                    }
                });
            }

            // Remove duplicates
            return [...new Set(links)];
        });

        log.info(`Found ${propertyLinks.length} property links on search page`);

        if (propertyLinks.length === 0) {
            log.warning('No property links found on this search page. The page structure may have changed.');

            // Log page title and URL for debugging
            const pageTitle = await page.title();
            log.warning(`Page title: ${pageTitle}`);

            if (config.debugMode) {
                // Save HTML for debugging
                const html = await page.content();
                log.debug(`Page HTML length: ${html.length} characters`);
            }
        }

        // Enqueue all property detail pages
        if (propertyLinks.length > 0) {
            await enqueueLinks({
                urls: propertyLinks,
                label: 'DETAIL',
                userData: {
                    depth: (request.userData.depth || 0) + 1,
                },
            });
            log.info(`Enqueued ${propertyLinks.length} property pages for scraping`);
        }

        // Look for pagination or "Load More" button
        const hasMoreResults = await page.evaluate(() => {
            // Check for "Load More" button
            const loadMoreButton = document.querySelector('button[aria-label*="Load"]');
            // Check for pagination next button
            const nextButton = document.querySelector('a[aria-label*="Next"], button[aria-label*="Next"]');

            return !!(loadMoreButton || nextButton);
        });

        if (hasMoreResults) {
            log.info('More results available (pagination/load more detected)');
            // Note: Handling pagination would require additional logic to click and wait
            // For now, we log it. Implement if needed based on requirements.
        }

    } catch (error) {
        log.error(`Error processing search page ${url}:`, { error: error instanceof Error ? error.message : error });
        throw error;
    }
});

/**
 * DETAIL Handler - Processes individual property detail pages
 * Extracts all property information and saves to dataset
 */
router.addHandler('DETAIL', async ({ request, page, log }) => {
    const config = getConfig();
    const url = request.loadedUrl || request.url;

    log.info(`Processing DETAIL page: ${url}`);

    try {
        // Wait for the property page to load
        // The property title is a good indicator that the page has loaded
        try {
            await page.waitForSelector('h1.ctw\\:text-heading-6, h1[class*="heading"]', {
                timeout: 30000,
            });
            if (config.debugMode) {
                log.info('Property title element found');
            }
        } catch (error) {
            log.warning('Timeout waiting for property title. Attempting to scrape anyway...');
        }

        // Wait for network idle
        try {
            await page.waitForNetworkIdle({ timeout: 10000 });
        } catch (error) {
            log.warning('Network did not become idle, continuing anyway');
        }

        // Additional wait for dynamic content
        if (config.waitForDynamicContent > 0) {
            await page.waitForTimeout(config.waitForDynamicContent);
        }

        // Extract all property data using page.evaluate
        const propertyData = await page.evaluate((includeDetails) => {
            const data: any = {
                title: '',
                price: '',
                address: '',
                propertyType: '',
                squareFootage: '',
                description: '',
            };

            // Helper function to safely get text content
            const getText = (selector: string): string => {
                const element = document.querySelector(selector);
                return element?.textContent?.trim() || '';
            };

            // Helper function to get text from multiple possible selectors
            const getTextFromSelectors = (selectors: string[]): string => {
                for (const selector of selectors) {
                    const text = getText(selector);
                    if (text) return text;
                }
                return '';
            };

            // Extract title
            data.title = getTextFromSelectors([
                'h1.ctw\\:text-heading-6',
                'h1[class*="heading"]',
                'h1.property-title',
                'h1',
            ]);

            // Extract price from "At a Glance" section or other locations
            data.price = getTextFromSelectors([
                'span.ctw\\:text-body.ctw\\:mr-7.ctw\\:whitespace-nowrap',
                '[class*="price"]',
            ]);

            // If price not found in common locations, search for price-like patterns
            if (!data.price) {
                const allText = document.body.innerText;
                const priceMatch = allText.match(/\$[\d,]+(?:\.\d{2})?(?:\s*(?:Million|M|K))?/i);
                if (priceMatch) {
                    data.price = priceMatch[0];
                }
            }

            // Extract address
            data.address = getTextFromSelectors([
                '[class*="address"]',
                'span[class*="location"]',
                'div[class*="address"]',
            ]);

            // Extract main image
            const mainImageElement = document.querySelector('img[class*="property"], img[class*="gallery"], img[src*="crexi"]') as HTMLImageElement;
            if (mainImageElement) {
                data.mainImage = mainImageElement.src;
            }

            // Extract description from expandable content or description sections
            const descriptionElements = document.querySelectorAll('crx-expandable-content, [class*="description"], [class*="overview"]');
            let description = '';
            descriptionElements.forEach((element) => {
                const text = element.textContent?.trim() || '';
                if (text.length > description.length) {
                    description = text;
                }
            });
            data.description = description;

            // Extract property details from key-value table
            if (includeDetails) {
                const keyValueRows = document.querySelectorAll('crx-key-value-table > div > div.ng-star-inserted > div');
                keyValueRows.forEach((row) => {
                    const cells = row.querySelectorAll('div');
                    if (cells.length >= 2) {
                        const key = cells[0].textContent?.trim() || '';
                        const value = cells[1].textContent?.trim() || '';

                        if (key && value) {
                            // Normalize key to camelCase
                            const normalizedKey = key
                                .toLowerCase()
                                .replace(/[^a-z0-9]+(.)/g, (_, char) => char.toUpperCase());

                            data[normalizedKey] = value;

                            // Map common fields to standardized names
                            if (key.toLowerCase().includes('property type') || key.toLowerCase() === 'type') {
                                data.propertyType = value;
                            } else if (key.toLowerCase().includes('square') || key.toLowerCase().includes('sf') || key.toLowerCase().includes('size')) {
                                data.squareFootage = value;
                            } else if (key.toLowerCase().includes('year built') || key.toLowerCase() === 'built') {
                                data.yearBuilt = value;
                            } else if (key.toLowerCase().includes('parking')) {
                                data.parking = value;
                            } else if (key.toLowerCase().includes('lot size') || key.toLowerCase().includes('land')) {
                                data.lotSize = value;
                            }
                        }
                    }
                });
            }

            // Try alternative methods to get property type if not found
            if (!data.propertyType) {
                data.propertyType = getTextFromSelectors([
                    '[class*="property-type"]',
                    'span[class*="type"]',
                ]);
            }

            // Try alternative methods to get square footage if not found
            if (!data.squareFootage) {
                const sfText = getTextFromSelectors([
                    '[class*="square-foot"]',
                    '[class*="size"]',
                ]);
                if (sfText) {
                    data.squareFootage = sfText;
                }
            }

            return data;
        }, config.includeDetailedKeyValues);

        // Add metadata
        const finalData: PropertyData = {
            ...propertyData,
            url,
            scrapedAt: new Date().toISOString(),
        };

        // Validate that we got at least some data
        if (!finalData.title && !finalData.price && !finalData.address) {
            log.warning(`No data extracted from ${url}. The page may not have loaded correctly or the structure may have changed.`);

            if (config.debugMode) {
                const pageTitle = await page.title();
                log.debug(`Page title: ${pageTitle}`);
                await page.screenshot({ path: 'apify_storage/debug-detail-no-data.png', fullPage: true });
            }
        } else {
            // Log successful extraction
            log.info(`Successfully extracted property: ${finalData.title || 'Untitled'}`, {
                price: finalData.price,
                propertyType: finalData.propertyType,
            });
        }

        // Save to dataset
        await Dataset.pushData(finalData);

        if (config.debugMode) {
            log.debug('Property data saved to dataset', { data: finalData });
        }

    } catch (error) {
        log.error(`Error processing detail page ${url}:`, { error: error instanceof Error ? error.message : error });

        // Save partial data if available
        await Dataset.pushData({
            url,
            error: error instanceof Error ? error.message : 'Unknown error',
            scrapedAt: new Date().toISOString(),
        } as any);
    }
});
