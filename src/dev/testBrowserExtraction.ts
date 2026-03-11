import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { extract, ContentFormat, Browser } from "../index";
import { z } from "zod";
import * as path from "path";
import { config } from "dotenv";

// Load environment variables from .env file
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
      })
    )
    .describe("List of bread and bakery products"),
});

async function testProductCatalogExtraction() {
  console.log("🍞 Testing Product Catalog Extraction...\n");

  const testUrl =
    "https://www.walmart.ca/en/browse/grocery/bread-bakery/10019_6000194327359";

  try {
    console.log(`📡 Loading product catalog page: ${testUrl}`);
    console.log("🤖 Using Browser class to load the page...\n");

    // Create browser instance
    const browser = new Browser({
      type: "local",
      headless: false,
    });

    await browser.start();
    console.log("✅ Browser started successfully");

    // Create page and load content using direct Playwright API
    const page = await browser.newPage();
    await page.goto(testUrl);

    try {
      await page.waitForLoadState("networkidle", { timeout: 10000 });
    } catch {
      console.log("Network idle timeout, continuing...");
    }

    const html = await page.content();
    console.log(`📄 Loaded ${html.length} characters of HTML`);

    await browser.close();
    console.log("✅ Browser closed");

    // Now extract product data from the loaded HTML
    console.log("\n🧠 Extracting product data using LLM...");

    const result = await extract({
      llm: new ChatGoogleGenerativeAI({
        apiKey: process.env.GOOGLE_API_KEY,
        model: "gemini-2.5-flash",
        temperature: 0,
      }),
      content: html,
      format: ContentFormat.HTML,
      sourceUrl: testUrl,
      schema: productCatalogSchema,
      htmlExtractionOptions: {
        extractMainHtml: true,
        includeImages: true,
        cleanUrls: true,
      },
    });

    console.log("✅ Extraction successful!");

    console.log("🍞 EXTRACTED PRODUCT CATALOG DATA:");
    console.log("=".repeat(80));
    console.log(JSON.stringify(result.data, null, 2));
    console.log("=".repeat(80));

    console.log("\n💰 Token Usage:");
    console.log(`Input tokens: ${result.usage.inputTokens}`);
    console.log(`Output tokens: ${result.usage.outputTokens}`);
  } catch (error) {
    console.error("❌ Error during product catalog extraction:", error);
  }
}

async function main() {
  if (!process.env.GOOGLE_API_KEY) {
    console.error("❌ Please set GOOGLE_API_KEY environment variable");
    process.exit(1);
  }

  console.log("🚀 Starting product catalog extraction\n");

  await testProductCatalogExtraction();

  console.log("\n🎉 Extraction completed!");
}

if (require.main === module) {
  main().catch(console.error);
}

export { testProductCatalogExtraction };
