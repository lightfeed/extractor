import { extract, ContentFormat, LLMProvider, Browser } from "../../src/index";
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
        throw error; // Re-throw non-network errors
      } finally {
        await browser.close();
      }
    });
  });

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
});
