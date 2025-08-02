import { extract, ContentFormat, LLMProvider, Browser } from "../../src/index";
import { z } from "zod";

// These tests require internet access and will be skipped in environments where it's not available
// They test against real websites to ensure the Browser class works end-to-end with extraction

const testSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  mainContent: z.string().optional(),
});

// Helper function to handle network errors gracefully
const handleNetworkError = (error: any) => {
  if (
    error.message.includes("net::ERR_INTERNET_DISCONNECTED") ||
    error.message.includes("net::ERR_NAME_NOT_RESOLVED") ||
    error.message.includes("Navigation timeout") ||
    error.message.includes("net::ERR_NETWORK_CHANGED")
  ) {
    console.log(
      "Network unavailable, skipping test that requires internet connection"
    );
    return true; // Indicates this is a network error we can skip
  }
  return false; // Not a network error, should re-throw
};

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
        // Load HTML using Browser class with direct Playwright API
        const browser = new Browser();
        await browser.start();

        const page = await browser.newPage();

        try {
          await page.goto(testUrl);

          try {
            await page.waitForLoadState("networkidle", { timeout: 10000 });
          } catch {
            console.log("Network idle timeout, continuing...");
          }

          const html = await page.content();
          await browser.close();

          // Extract data from the loaded HTML
          const result = await extract({
            content: html,
            format: ContentFormat.HTML,
            sourceUrl: testUrl,
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
        } catch (error) {
          await browser.close();

          if (handleNetworkError(error)) {
            // Skip this test due to network issues
            console.log("Skipping test due to network connectivity issues");
            return;
          }
          throw error; // Re-throw non-network errors
        }
      });

      it("should use custom browser configuration", async () => {
        const browser = new Browser({ type: "local" });
        await browser.start();

        const page = await browser.newPage();

        try {
          await page.goto(testUrl, { waitUntil: "load" });

          const html = await page.content();
          await browser.close();

          const result = await extract({
            content: html,
            format: ContentFormat.HTML,
            sourceUrl: testUrl,
            schema: testSchema,
            provider: LLMProvider.GOOGLE_GEMINI,
            googleApiKey: process.env.GOOGLE_API_KEY,
          });

          expect(result.data).toBeDefined();
          expect(result.data.title).toBeDefined();
        } catch (error) {
          await browser.close();

          if (handleNetworkError(error)) {
            console.log("Skipping test due to network connectivity issues");
            return;
          }
          throw error;
        }
      });

      it("should handle multiple pages with same browser instance", async () => {
        const browser = new Browser();
        await browser.start();

        try {
          // Load first page
          const page1 = await browser.newPage();
          try {
            await page1.goto(testUrl);
            const html1 = await page1.content();
            await page1.close();

            // Load second page with same browser instance
            const page2 = await browser.newPage();
            try {
              await page2.goto(testUrl);
              const html2 = await page2.content();
              await page2.close();

              expect(html1).toBeDefined();
              expect(html2).toBeDefined();

              // Extract from both
              const result1 = await extract({
                content: html1,
                format: ContentFormat.HTML,
                sourceUrl: testUrl,
                schema: testSchema,
                provider: LLMProvider.GOOGLE_GEMINI,
                googleApiKey: process.env.GOOGLE_API_KEY,
              });

              expect(result1.data.title).toBeDefined();
            } catch (error) {
              await page2.close();
              if (handleNetworkError(error)) {
                console.log("Skipping test due to network connectivity issues");
                return;
              }
              throw error;
            }
          } catch (error) {
            await page1.close();
            if (handleNetworkError(error)) {
              console.log("Skipping test due to network connectivity issues");
              return;
            }
            throw error;
          }
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

        const browser = new Browser();
        await browser.start();

        const page = await browser.newPage();

        try {
          await page.goto(testUrl);
          const html = await page.content();
          await browser.close();

          const result = await extract({
            content: html,
            format: ContentFormat.HTML,
            sourceUrl: testUrl,
            schema: openAISchema,
            provider: LLMProvider.OPENAI,
            openaiApiKey: process.env.OPENAI_API_KEY,
          });

          expect(result.data).toBeDefined();
          expect(result.data.title).toBeDefined();
          expect(typeof result.data.title).toBe("string");
          expect(result.processedContent).toBeDefined();
          expect(result.usage).toBeDefined();
        } catch (error) {
          await browser.close();

          if (handleNetworkError(error)) {
            console.log("Skipping test due to network connectivity issues");
            return;
          }
          throw error;
        }
      });
    });
  }

  describe("Error Handling", () => {
    it("should handle navigation errors", async () => {
      const browser = new Browser();
      await browser.start();

      const page = await browser.newPage();

      // Use a non-existent domain
      const unreachableUrl = "https://this-domain-does-not-exist-12345.com";

      await expect(
        page.goto(unreachableUrl, { timeout: 5000 })
      ).rejects.toThrow();

      await browser.close();
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

        try {
          // Navigate to page
          await page.goto(testUrl);

          // Wait for specific element or condition
          await page.waitForTimeout(2000);

          // Get title using page evaluation
          const pageTitle = await page.title();
          expect(pageTitle).toBeDefined();

          // Get HTML content
          const html = await page.content();

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
        } catch (error) {
          if (handleNetworkError(error)) {
            console.log("Skipping test due to network connectivity issues");
            return;
          }
          throw error;
        }
      } finally {
        await browser.close();
      }
    });

    it("should provide access to browser context for advanced operations", async () => {
      const browser = new Browser();

      // Should fail before browser is started
      await expect(browser.newContext()).rejects.toThrow(
        "Browser not started. Call start() first."
      );

      await browser.start();
      const context = await browser.newContext();

      expect(context).toBeDefined();

      // Should be able to use Playwright context directly
      const page = await context.newPage();

      try {
        await page.goto(testUrl, { timeout: 5000 });
        const title = await page.title();
        expect(title).toBeDefined();
      } catch (error) {
        if (handleNetworkError(error)) {
          console.log("Network unavailable, skipping navigation test");
          // Just verify that the browser and page objects work
          expect(page).toBeDefined();
          expect(context).toBeDefined();
        } else {
          throw error; // Re-throw unexpected errors
        }
      } finally {
        // Always cleanup resources
        await browser.close();
      }
    });
  });
});
