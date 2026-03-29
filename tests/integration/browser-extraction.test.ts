import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { chromium, Browser } from "playwright";
import { extract, ContentFormat } from "../../src/index";
import { z } from "zod";

function createGeminiLLM() {
  return new ChatGoogleGenerativeAI({
    apiKey: process.env.GOOGLE_API_KEY,
    model: "gemini-2.5-flash",
    temperature: 0,
  });
}

const testSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  mainContent: z.string().optional(),
});

describe("Browser + Extraction Integration Tests", () => {
  const testUrl = "https://example.com";
  let browser: Browser;

  afterEach(async () => {
    if (browser) {
      await browser.close();
    }
  });

  describe("Playwright with Google Gemini", () => {
    it("should load page and extract data using Playwright", async () => {
      browser = await chromium.launch();
      const page = await browser.newPage();

      try {
        await page.goto(testUrl);

        try {
          await page.waitForLoadState("networkidle", { timeout: 10000 });
        } catch {
          console.log("Network idle timeout, continuing...");
        }

        const html = await page.content();

        const result = await extract({
          llm: createGeminiLLM(),
          content: html,
          format: ContentFormat.HTML,
          sourceUrl: testUrl,
          schema: testSchema,
        });

        expect(result.data).toBeDefined();
        expect(result.data.title).toBeDefined();
        expect(typeof result.data.title).toBe("string");
        expect(result.processedContent).toBeDefined();
        expect(result.usage).toBeDefined();

        expect(result.processedContent).toContain("Example Domain");
      } catch (error) {
        throw error;
      }
    });
  });

  describe("Error Handling", () => {
    it("should handle navigation errors", async () => {
      browser = await chromium.launch();
      const page = await browser.newPage();

      const unreachableUrl = "https://this-domain-does-not-exist-12345.com";

      await expect(
        page.goto(unreachableUrl, { timeout: 5000 })
      ).rejects.toThrow();
    });
  });
});
