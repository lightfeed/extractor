import { extract, ContentFormat, LLMProvider, Browser } from "../index";
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
        price: z.string().describe("Current price"),
        originalPrice: z
          .string()
          .optional()
          .describe("Original price if on sale"),
        weight: z.string().optional().describe("Product weight or size"),
        rating: z.number().optional().describe("Product rating out of 5"),
        reviewCount: z.number().optional().describe("Number of reviews"),
      })
    )
    .describe("List of bread and bakery products"),
  totalProductsFound: z
    .number()
    .describe("Total number of products found on the page"),
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
      content: html,
      format: ContentFormat.HTML,
      sourceUrl: testUrl,
      schema: productCatalogSchema,
      provider: LLMProvider.GOOGLE_GEMINI,
      googleApiKey: process.env.GOOGLE_API_KEY,
      htmlExtractionOptions: {
        extractMainHtml: true,
        includeImages: false,
        cleanUrls: true,
      },
    });

    console.log("✅ Extraction successful!");
    console.log(`\n📊 Found ${result.data.totalProductsFound} products\n`);

    console.log("🍞 WALMART BREAD & BAKERY PRODUCTS:");
    console.log("=".repeat(60));

    result.data.products.forEach((product, index) => {
      console.log(`\n${index + 1}. ${product.name}`);
      if (product.brand) console.log(`   Brand: ${product.brand}`);
      console.log(`   Price: ${product.price}`);
      if (product.originalPrice)
        console.log(`   Original Price: ${product.originalPrice}`);
      if (product.weight) console.log(`   Size: ${product.weight}`);
      if (product.rating)
        console.log(
          `   Rating: ${product.rating}/5 (${product.reviewCount || 0} reviews)`
        );
    });

    console.log("\n" + "=".repeat(60));
    console.log(`Total products extracted: ${result.data.products.length}`);

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
