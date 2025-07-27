import {
  extract,
  ContentFormat,
  LLMProvider,
  Browser,
  loadHtmlFromUrl,
} from "../../src/index";
import { z } from "zod";

// These tests require internet access and will be skipped in environments where it's not available
// They test against real websites to ensure the Browser class works end-to-end with extraction

const testSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  mainContent: z.string().optional(),
});

describe("Browser + Extraction Integration Tests", () => {
  // Skip these tests if no API keys are available
  const hasGoogleKey = !!process.env.GOOGLE_API_KEY;
  const hasOpenAIKey = !!process.env.OPENAI_API_KEY;

  // Skip all tests if no API keys
  if (!hasGoogleKey && !hasOpenAIKey) {
    it.skip("Skipping browser extraction tests - no API keys available", () => {});
    return;
  }

  // Test with a simple, stable website
  const testUrl = "https://example.com";

  // Increased timeout for browser operations
  const testTimeout = 60000;

  beforeEach(() => {
    jest.setTimeout(testTimeout);
  });

  if (hasGoogleKey) {
    describe("Browser Class with Google Gemini", () => {
      it("should load page and extract data using Browser class", async () => {
        // Load HTML using Browser class
        const browser = new Browser();
        const { html, url } = await browser.loadPage(testUrl);
        await browser.close();

        // Extract data from the loaded HTML
        const result = await extract({
          content: html,
          format: ContentFormat.HTML,
          sourceUrl: url,
          schema: testSchema,
          provider: LLMProvider.GOOGLE_GEMINI,
          googleApiKey: process.env.GOOGLE_API_KEY,
        });

        expect(result.data).toBeDefined();
        expect(result.data.title).toBeDefined();
        expect(typeof result.data.title).toBe("string");
        expect(result.processedContent).toBeDefined();
        expect(result.usage).toBeDefined();

        // The processed content should be markdown (converted from HTML)
        expect(result.processedContent).toContain("Example Domain");
      });

      it("should use custom browser configuration", async () => {
        const browserConfig = {
          type: "local" as const,
          options: { args: ["--no-sandbox", "--disable-dev-shm-usage"] },
        };

        const browser = new Browser(browserConfig);
        const { html, url } = await browser.loadPage(testUrl, {
          timeout: 20000,
          waitUntil: "load",
        });
        await browser.close();

        const result = await extract({
          content: html,
          format: ContentFormat.HTML,
          sourceUrl: url,
          schema: testSchema,
          provider: LLMProvider.GOOGLE_GEMINI,
          googleApiKey: process.env.GOOGLE_API_KEY,
        });

        expect(result.data).toBeDefined();
        expect(result.data.title).toBeDefined();
      });

      it("should use convenience function loadHtmlFromUrl", async () => {
        const { html, url } = await loadHtmlFromUrl(testUrl);

        const result = await extract({
          content: html,
          format: ContentFormat.HTML,
          sourceUrl: url,
          schema: testSchema,
          provider: LLMProvider.GOOGLE_GEMINI,
          googleApiKey: process.env.GOOGLE_API_KEY,
          htmlExtractionOptions: {
            extractMainHtml: true,
            includeImages: false,
            cleanUrls: true,
          },
        });

        expect(result.data).toBeDefined();
        expect(result.data.title).toBeDefined();
        expect(result.processedContent).toBeDefined();
      });

      it("should handle multiple pages with same browser instance", async () => {
        const browser = new Browser();

        try {
          // Load first page
          const page1 = await browser.loadPage(testUrl);
          expect(page1.html).toBeDefined();
          expect(page1.url).toBe(testUrl);

          // Load second page with same browser instance
          const page2 = await browser.loadPage(testUrl);
          expect(page2.html).toBeDefined();
          expect(page2.url).toBe(testUrl);

          // Extract from both
          const result1 = await extract({
            content: page1.html,
            format: ContentFormat.HTML,
            sourceUrl: page1.url,
            schema: testSchema,
            provider: LLMProvider.GOOGLE_GEMINI,
            googleApiKey: process.env.GOOGLE_API_KEY,
          });

          expect(result1.data.title).toBeDefined();
        } finally {
          await browser.close();
        }
      });
    });
  }

  if (hasOpenAIKey) {
    describe("Browser Class with OpenAI", () => {
      it("should load page and extract data using OpenAI", async () => {
        const openAISchema = z.object({
          title: z.string(),
          description: z.string().nullable(),
          mainContent: z.string().nullable(),
        });

        const { html, url } = await loadHtmlFromUrl(testUrl);

        const result = await extract({
          content: html,
          format: ContentFormat.HTML,
          sourceUrl: url,
          schema: openAISchema,
          provider: LLMProvider.OPENAI,
          openaiApiKey: process.env.OPENAI_API_KEY,
        });

        expect(result.data).toBeDefined();
        expect(result.data.title).toBeDefined();
        expect(typeof result.data.title).toBe("string");
        expect(result.processedContent).toBeDefined();
        expect(result.usage).toBeDefined();
      });
    });
  }

  describe("Error Handling", () => {
    it("should handle invalid URLs", async () => {
      const browser = new Browser();

      await expect(browser.loadPage("not-a-valid-url")).rejects.toThrow(
        "Invalid URL provided"
      );

      await browser.close();
    });

    it("should handle unreachable URLs", async () => {
      const unreachableUrl = "https://this-domain-does-not-exist-12345.com";

      await expect(
        loadHtmlFromUrl(unreachableUrl, undefined, { timeout: 5000 })
      ).rejects.toThrow();
    });

    it("should handle browser startup errors gracefully", async () => {
      // Test with invalid serverless config
      const invalidConfig = {
        type: "serverless" as const,
        executablePath: "/non/existent/path",
      };

      const browser = new Browser(invalidConfig);

      await expect(browser.start()).rejects.toThrow();
    });
  });

  describe("Advanced Browser Operations", () => {
    it("should allow custom page operations before extraction", async () => {
      if (!hasGoogleKey) return;

      const browser = new Browser();

      try {
        await browser.start();
        const page = await browser.newPage();

        // Navigate to page
        await page.goto(testUrl);

        // Wait for specific element or condition
        await page.waitForTimeout(2000);

        // Get title using page evaluation
        const pageTitle = await page.title();
        expect(pageTitle).toBeDefined();

        // Get HTML content
        const html = await page.content();

        await page.close();

        // Extract data
        const result = await extract({
          content: html,
          format: ContentFormat.HTML,
          sourceUrl: testUrl,
          schema: testSchema,
          provider: LLMProvider.GOOGLE_GEMINI,
          googleApiKey: process.env.GOOGLE_API_KEY,
        });

        expect(result.data.title).toBeDefined();
      } finally {
        await browser.close();
      }
    });

    it("should provide access to underlying Playwright browser", async () => {
      const browser = new Browser();

      expect(browser.getBrowser()).toBeNull();

      await browser.start();
      const playwrightBrowser = browser.getBrowser();

      expect(playwrightBrowser).toBeDefined();
      expect(playwrightBrowser).not.toBeNull();

      // Should be able to use Playwright browser directly
      const context = await playwrightBrowser!.newContext();
      const page = await context.newPage();
      await page.goto(testUrl);

      const title = await page.title();
      expect(title).toBeDefined();

      await page.close();
      await context.close();
      await browser.close();
    });
  });
});
