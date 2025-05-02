import * as fs from "fs";
import * as path from "path";
import { config } from "dotenv";
import { z } from "zod";
import { extract, ContentFormat, LLMProvider } from "../index";

// Load environment variables from .env file
config({ path: path.resolve(process.cwd(), ".env") });

// Helper to load HTML test fixtures
function loadFixture(filename: string): string {
  return fs.readFileSync(
    path.resolve(__dirname, "../../tests/fixtures", filename),
    "utf8"
  );
}

// Example schemas for different content types
const blogSchema = z.object({
  title: z.string(),
  author: z.string().optional(),
  date: z.string().optional(),
  tags: z.array(z.string()).optional(),
  summary: z.string(),
  content: z.string().optional(),
});

const productSchema = z.object({
  title: z.string(),
  products: z.array(
    z.object({
      name: z.string(),
      price: z.string(),
      rating: z.string().optional(),
      description: z.string().optional(),
      features: z.array(z.string()).optional(),
    })
  ),
  totalProducts: z.number(),
});

// Test functions
async function testBlogExtraction() {
  console.log("Testing blog post extraction...");

  try {
    const html = loadFixture("blog-post.html");

    if (!process.env.GOOGLE_API_KEY) {
      console.error("Error: GOOGLE_API_KEY environment variable is required");
      process.exit(1);
    }

    const result = await extract({
      content: html,
      format: ContentFormat.HTML,
      schema: blogSchema,
      provider: LLMProvider.GOOGLE_GEMINI,
      googleApiKey: process.env.GOOGLE_API_KEY,
      extractionOptions: {
        extractMainContent: true,
      },
    });

    console.log("Extracted data:");
    console.log(JSON.stringify(result.data, null, 2));
    console.log("\nToken usage:");
    console.log(result.usage);

    return result;
  } catch (error) {
    console.error("Blog extraction error:", error);
    throw error;
  }
}

async function testProductExtraction() {
  console.log("Testing product listing extraction...");

  try {
    const html = loadFixture("product-list.html");

    if (!process.env.GOOGLE_API_KEY) {
      console.error("Error: GOOGLE_API_KEY environment variable is required");
      process.exit(1);
    }

    const result = await extract({
      content: html,
      format: ContentFormat.HTML,
      schema: productSchema,
      provider: LLMProvider.GOOGLE_GEMINI,
      googleApiKey: process.env.GOOGLE_API_KEY,
    });

    console.log("Extracted data:");
    console.log(JSON.stringify(result.data, null, 2));
    console.log("\nToken usage:");
    console.log(result.usage);

    return result;
  } catch (error) {
    console.error("Product extraction error:", error);
    throw error;
  }
}

// Run tests based on command line arguments
async function main() {
  const testType = process.argv[2] || "all";

  console.log("API Keys available:");
  console.log(`- GOOGLE_API_KEY: ${process.env.GOOGLE_API_KEY ? "Yes" : "No"}`);
  console.log(`- OPENAI_API_KEY: ${process.env.OPENAI_API_KEY ? "Yes" : "No"}`);
  console.log("");

  if (testType === "blog" || testType === "all") {
    await testBlogExtraction();
  }

  if (testType === "product" || testType === "all") {
    await testProductExtraction();
  }
}

// Only run if directly executed
if (require.main === module) {
  console.log("Starting local extraction test...");
  console.log("Make sure you have set up your .env file with API keys.");

  main()
    .then(() => {
      console.log("All tests completed successfully.");
    })
    .catch((error) => {
      console.error("Test failed:", error);
      process.exit(1);
    });
}
