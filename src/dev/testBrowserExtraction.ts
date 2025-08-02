import { extract, ContentFormat, LLMProvider, Browser } from "../index";
import { z } from "zod";

// Example schema for extracting website information
const websiteSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  mainHeadings: z.array(z.string()).describe("Main headings found on the page"),
  links: z
    .array(z.string().url())
    .describe("Important links found on the page"),
  technology: z
    .string()
    .optional()
    .describe("What technology or framework this website appears to use"),
});

async function testBrowserClassExtraction() {
  console.log("🌐 Testing Browser class with extraction...\n");

  const testUrl = "https://example.com";

  try {
    console.log(`📡 Loading page: ${testUrl}`);
    console.log("🤖 Using Browser class with custom configuration...\n");

    // Using Browser class directly with full Playwright control
    const browser = new Browser({
      type: "local",
      options: {
        args: ["--no-sandbox", "--disable-dev-shm-usage"],
      },
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

    await page.close();
    await browser.close();
    console.log("✅ Browser closed");

    // Now extract data from the loaded HTML
    console.log("\n🧠 Extracting data using LLM...");
    const result = await extract({
      content: html,
      format: ContentFormat.HTML,
      sourceUrl: testUrl,
      schema: websiteSchema,
      provider: LLMProvider.GOOGLE_GEMINI,
      googleApiKey: process.env.GOOGLE_API_KEY,
      htmlExtractionOptions: {
        extractMainHtml: true,
        includeImages: false,
        cleanUrls: true,
      },
    });

    console.log("✅ Extraction successful!");
    console.log("\n📊 Extracted Data:");
    console.log(JSON.stringify(result.data, null, 2));

    console.log("\n📄 Processed Content (first 500 chars):");
    console.log(result.processedContent.substring(0, 500) + "...");

    console.log("\n💰 Token Usage:");
    console.log(`Input tokens: ${result.usage.inputTokens}`);
    console.log(`Output tokens: ${result.usage.outputTokens}`);
  } catch (error) {
    console.error("❌ Error during browser extraction:", error);
  }
}

async function testAdvancedBrowserOperations() {
  console.log("\n🔧 Testing advanced browser operations...\n");

  const browser = new Browser();

  try {
    await browser.start();
    console.log("✅ Browser started for advanced operations");

    // Create a page for custom operations
    const page = await browser.newPage();

    // Navigate to the page
    await page.goto("https://example.com");
    console.log("📡 Navigated to page");

    // Perform custom operations
    const pageTitle = await page.title();
    console.log(`📝 Page title: ${pageTitle}`);

    // Wait for any dynamic content
    await page.waitForTimeout(3000);

    // You could do more complex operations here:
    // - Wait for specific elements
    // - Interact with the page
    // - Take screenshots
    // - Evaluate JavaScript

    // Get the final HTML
    const html = await page.content();

    // Close the page
    await page.close();
    console.log("✅ Page operations completed");

    // Extract data from the processed HTML
    const result = await extract({
      content: html,
      format: ContentFormat.HTML,
      sourceUrl: "https://example.com",
      schema: websiteSchema,
      provider: LLMProvider.GOOGLE_GEMINI,
      googleApiKey: process.env.GOOGLE_API_KEY,
    });

    console.log("✅ Advanced browser extraction successful!");
    console.log(`📊 Extracted title: ${result.data.title}`);
  } catch (error) {
    console.error("❌ Error during advanced browser operations:", error);
  } finally {
    await browser.close();
    console.log("✅ Browser closed after advanced operations");
  }
}

async function testMultiplePages() {
  console.log("\n📚 Testing multiple pages with same browser instance...\n");

  const browser = new Browser();

  try {
    await browser.start();

    const urls = [
      "https://example.com",
      "https://httpbin.org/html", // Another simple test page
    ];

    console.log(`🔄 Loading ${urls.length} pages with same browser...`);

    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      console.log(`\n📡 Loading page ${i + 1}: ${url}`);

      const page = await browser.newPage();
      await page.goto(url);

      const html = await page.content();
      console.log(`📄 Loaded ${html.length} characters`);

      await page.close();

      // Extract just the title for efficiency
      const titleSchema = z.object({ title: z.string() });

      const result = await extract({
        content: html,
        format: ContentFormat.HTML,
        sourceUrl: url,
        schema: titleSchema,
        provider: LLMProvider.GOOGLE_GEMINI,
        googleApiKey: process.env.GOOGLE_API_KEY,
      });

      console.log(`📝 Page ${i + 1} title: ${result.data.title}`);
    }

    console.log("✅ Multiple pages extraction completed!");
  } catch (error) {
    console.error("❌ Error during multiple pages test:", error);
  } finally {
    await browser.close();
  }
}

async function testConcurrentPages() {
  console.log("\n🚀 Testing concurrent page loading...\n");

  const browser = new Browser();

  try {
    await browser.start();

    const urls = ["https://example.com", "https://httpbin.org/html"];

    console.log(`⚡ Loading ${urls.length} pages concurrently...`);

    // Load pages concurrently
    const loadPromises = urls.map(async (url, index) => {
      const page = await browser.newPage();
      await page.goto(url);
      const html = await page.content();
      await page.close();

      console.log(`📄 Page ${index + 1} loaded: ${html.length} characters`);
      return { url, html };
    });

    const results = await Promise.all(loadPromises);

    console.log("✅ All pages loaded concurrently!");

    // Extract from all pages
    for (const { url, html } of results) {
      const titleSchema = z.object({ title: z.string() });

      const result = await extract({
        content: html,
        format: ContentFormat.HTML,
        sourceUrl: url,
        schema: titleSchema,
        provider: LLMProvider.GOOGLE_GEMINI,
        googleApiKey: process.env.GOOGLE_API_KEY,
      });

      console.log(`📝 Extracted from ${url}: ${result.data.title}`);
    }
  } catch (error) {
    console.error("❌ Error during concurrent pages test:", error);
  } finally {
    await browser.close();
  }
}

async function main() {
  if (!process.env.GOOGLE_API_KEY) {
    console.error("❌ Please set GOOGLE_API_KEY environment variable");
    process.exit(1);
  }

  console.log("🚀 Starting Browser + Extraction Tests\n");

  await testBrowserClassExtraction();
  await testAdvancedBrowserOperations();
  await testMultiplePages();
  await testConcurrentPages();

  console.log("\n🎉 All tests completed!");
}

if (require.main === module) {
  main().catch(console.error);
}

export {
  testBrowserClassExtraction,
  testAdvancedBrowserOperations,
  testMultiplePages,
  testConcurrentPages,
};
