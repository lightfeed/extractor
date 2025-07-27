import { Browser as PlaywrightBrowser, Page } from "playwright";
import { BrowserConfig } from "./types";
import { createBrowserProvider } from "./utils/browserProviders";

/**
 * Browser class that provides a clean interface for browser operations
 * Use this to load web pages and extract HTML content before passing to the extractor
 */
export class Browser {
  private browserProvider: any;
  private browser: PlaywrightBrowser | null = null;
  private config: BrowserConfig;

  constructor(config: BrowserConfig = { type: "local" }) {
    this.config = config;
    this.browserProvider = createBrowserProvider(config as any);
  }

  /**
   * Start the browser instance
   */
  async start(): Promise<void> {
    if (this.browser) {
      throw new Error(
        "Browser is already started. Call close() first if you want to restart."
      );
    }
    this.browser = await this.browserProvider.start();
  }

  /**
   * Create a new page in the browser
   * Browser must be started first
   */
  async newPage(): Promise<Page> {
    if (!this.browser) {
      throw new Error("Browser not started. Call start() first.");
    }
    return await this.browser.newPage();
  }

  /**
   * Get the underlying Playwright browser instance
   * Useful for advanced operations not covered by this class
   */
  getBrowser(): PlaywrightBrowser | null {
    return this.browser;
  }

  /**
   * Close the browser and clean up resources
   */
  async close(): Promise<void> {
    if (this.browser) {
      await this.browserProvider.close();
      this.browser = null;
    }
  }

  /**
   * Check if the browser is currently running
   */
  isStarted(): boolean {
    return this.browser !== null;
  }

  /**
   * Convenience method to load a URL and get HTML content
   * This handles the common case of just wanting to get HTML from a URL
   */
  async loadPage(
    url: string,
    options?: {
      timeout?: number;
      waitUntil?: "load" | "domcontentloaded" | "networkidle";
      waitTime?: number;
    }
  ): Promise<{ html: string; url: string }> {
    const {
      timeout = 30000,
      waitUntil = "domcontentloaded",
      waitTime = 1000,
    } = options || {};

    // Validate URL
    try {
      new URL(url);
    } catch (error) {
      throw new Error(`Invalid URL provided: ${url}`);
    }

    // Ensure browser is started
    if (!this.browser) {
      await this.start();
    }

    const page = await this.newPage();

    try {
      // Set timeout
      page.setDefaultTimeout(timeout);

      // Navigate to URL
      await page.goto(url, {
        waitUntil,
        timeout,
      });

      // Wait a bit more for dynamic content
      if (waitTime > 0) {
        await page.waitForTimeout(waitTime);
      }

      // Get HTML content
      const html = await page.content();

      return {
        html,
        url,
      };
    } finally {
      // Always close the page
      await page.close();
    }
  }
}

/**
 * Convenience function to quickly load HTML from a URL
 * Creates a browser, loads the page, gets HTML, and closes the browser
 */
export async function loadHtmlFromUrl(
  url: string,
  browserConfig?: BrowserConfig,
  options?: {
    timeout?: number;
    waitUntil?: "load" | "domcontentloaded" | "networkidle";
    waitTime?: number;
  }
): Promise<{ html: string; url: string }> {
  const browser = new Browser(browserConfig);

  try {
    return await browser.loadPage(url, options);
  } finally {
    await browser.close();
  }
}
