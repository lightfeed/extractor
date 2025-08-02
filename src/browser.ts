import { Browser as PlaywrightBrowser, BrowserContext, Page } from "playwright";
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
   * Create a new browser context
   * Browser must be started first
   * Use context for advanced operations like setting cookies, headers, etc.
   */
  async newContext(): Promise<BrowserContext> {
    if (!this.browser) {
      throw new Error("Browser not started. Call start() first.");
    }
    return await this.browser.newContext();
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
}
