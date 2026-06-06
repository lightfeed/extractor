import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { chromium } from "playwright";
import { scrape } from "../index";
import { z } from "zod";
import * as path from "path";
import { config } from "dotenv";

config({ path: path.resolve(process.cwd(), ".env") });

const productCatalogSchema = z.object({
  products: z
    .array(
      z.object({
        name: z.string().describe("Product name or title"),
        brand: z.string().optional().describe("Brand name"),
        price: z.number().describe("Current price"),
        originalPrice: z
          .number()
          .optional()
          .describe("Original price if on sale"),
        rating: z.number().optional().describe("Product rating out of 5"),
        reviewCount: z.number().optional().describe("Number of reviews"),
        productUrl: z.string().url().describe("Link to product detail page"),
        imageUrl: z.string().url().optional().describe("Product image URL"),
      }),
    )
    .describe("List of bread and bakery products"),
});

async function testProductCatalogScraping() {
  console.log("Testing Product Catalog Scraping (scrape mode)...\n");

  const testUrl =
    "https://www.walmart.ca/en/browse/grocery/bread-bakery/10019_6000194327359";

  try {
    console.log(`Loading product catalog page: ${testUrl}`);

    const browser = await chromium.launch({ headless: false });
    const page = await browser.newPage();
    await page.goto(testUrl);

    try {
      await page.waitForLoadState("networkidle", { timeout: 10000 });
    } catch {
      console.log("Network idle timeout, continuing...");
    }

    const html = await page.content();
    console.log(`Loaded ${html.length} characters of HTML`);

    await browser.close();
    console.log("Browser closed");

    console.log("\nGenerating scraping code using LLM...");

    const result = await scrape({
      llm: new ChatGoogleGenerativeAI({
        apiKey: process.env.GOOGLE_API_KEY,
        model: "gemini-2.5-flash",
        temperature: 0,
      }),
      content: html,
      sourceUrl: testUrl,
      schema: productCatalogSchema,
      htmlExtractionOptions: {
        includeImages: true,
        cleanUrls: true,
      },
      maxIterations: 3,
      debug: true,
    });

    console.log("Scraping code generation successful!");

    console.log("\nGENERATED SCRAPING CODE:");
    console.log("=".repeat(80));
    console.log(result.code);
    console.log("=".repeat(80));

    console.log("\nEXTRACTED PRODUCT CATALOG DATA:");
    console.log("=".repeat(80));
    console.log(JSON.stringify(result.data, null, 2));
    console.log("=".repeat(80));

    console.log(`\nFound ${result.data.products.length} products`);

    console.log("\nToken Usage:");
    console.log(`Input tokens: ${result.usage.inputTokens}`);
    console.log(`Output tokens: ${result.usage.outputTokens}`);
  } catch (error) {
    console.error("Error during product catalog scraping:", error);
  }
}

async function main() {
  if (!process.env.GOOGLE_API_KEY) {
    console.error("Please set GOOGLE_API_KEY environment variable");
    process.exit(1);
  }

  console.log("Starting product catalog scraping (scrape mode)\n");

  await testProductCatalogScraping();

  console.log("\nScraping completed!");
}

if (require.main === module) {
  main().catch(console.error);
}

export { testProductCatalogScraping };
