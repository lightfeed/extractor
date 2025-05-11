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
  tags: z
    .array(z.string())
    .optional()
    .describe("Tags appear after the date. Do not include the # symbol."),
  summary: z.string(),
  content: z.string().optional(),
});

const productSchema = z.object({
  products: z.array(
    z.object({
      name: z.string(),
      price: z.string(),
      rating: z.string().optional(),
      description: z.string().optional(),
      features: z.array(z.string()).optional(),
    })
  ),
});

// Test functions
async function testBlogExtraction(provider = LLMProvider.GOOGLE_GEMINI) {
  console.log(`Testing blog post extraction with ${provider}...`);

  try {
    const html = loadFixture("blog-post.html");

    // Check for required API key
    if (provider === LLMProvider.GOOGLE_GEMINI && !process.env.GOOGLE_API_KEY) {
      console.error("Error: GOOGLE_API_KEY environment variable is required");
      process.exit(1);
    } else if (provider === LLMProvider.OPENAI && !process.env.OPENAI_API_KEY) {
      console.error("Error: OPENAI_API_KEY environment variable is required");
      process.exit(1);
    }

    const apiKey =
      provider === LLMProvider.GOOGLE_GEMINI
        ? process.env.GOOGLE_API_KEY
        : process.env.OPENAI_API_KEY;

    const result = await extract({
      content: html,
      format: ContentFormat.HTML,
      schema: blogSchema,
      provider,
      googleApiKey: provider === LLMProvider.GOOGLE_GEMINI ? apiKey : undefined,
      openaiApiKey: provider === LLMProvider.OPENAI ? apiKey : undefined,
      extractionOptions: {
        extractMainHtml: false,
      },
      sourceUrl: "https://www.example.com/blog/blog-post",
    });

    console.log("Extracted data:");
    console.log(JSON.stringify(result.data, null, 2));
    console.log("\nToken usage:");
    console.log(result.usage);

    return result;
  } catch (error) {
    console.error(`Blog extraction error with ${provider}:`, error);
    throw error;
  }
}

async function testProductExtraction(provider = LLMProvider.GOOGLE_GEMINI) {
  console.log(`Testing product listing extraction with ${provider}...`);

  try {
    const html = loadFixture("product-list.html");

    // Check for required API key
    if (provider === LLMProvider.GOOGLE_GEMINI && !process.env.GOOGLE_API_KEY) {
      console.error("Error: GOOGLE_API_KEY environment variable is required");
      process.exit(1);
    } else if (provider === LLMProvider.OPENAI && !process.env.OPENAI_API_KEY) {
      console.error("Error: OPENAI_API_KEY environment variable is required");
      process.exit(1);
    }

    const apiKey =
      provider === LLMProvider.GOOGLE_GEMINI
        ? process.env.GOOGLE_API_KEY
        : process.env.OPENAI_API_KEY;

    const result = await extract({
      content: html,
      format: ContentFormat.HTML,
      schema: productSchema,
      provider,
      googleApiKey: provider === LLMProvider.GOOGLE_GEMINI ? apiKey : undefined,
      openaiApiKey: provider === LLMProvider.OPENAI ? apiKey : undefined,
      extractionOptions: {
        extractMainHtml: true,
      },
      sourceUrl: "https://www.example.com/product/product-list",
    });

    console.log("Extracted data:");
    console.log(JSON.stringify(result.data, null, 2));
    console.log("\nToken usage:");
    console.log(result.usage);

    return result;
  } catch (error) {
    console.error(`Product extraction error with ${provider}:`, error);
    throw error;
  }
}

// Run tests based on command line arguments
async function main() {
  // Parse arguments: content type and provider
  const args = process.argv.slice(2);
  const contentType = args[0] || "all"; // 'blog', 'product', or 'all'
  const provider =
    args[1]?.toUpperCase() === "OPENAI"
      ? LLMProvider.OPENAI
      : args[1]?.toUpperCase() === "GEMINI"
      ? LLMProvider.GOOGLE_GEMINI
      : "all"; // 'OPENAI', 'GEMINI', or 'all'

  console.log("API Keys available:");
  console.log(`- GOOGLE_API_KEY: ${process.env.GOOGLE_API_KEY ? "Yes" : "No"}`);
  console.log(`- OPENAI_API_KEY: ${process.env.OPENAI_API_KEY ? "Yes" : "No"}`);
  console.log("");

  // Run blog tests
  if (contentType === "blog" || contentType === "all") {
    if (provider === LLMProvider.GOOGLE_GEMINI || provider === "all") {
      await testBlogExtraction(LLMProvider.GOOGLE_GEMINI);
    }
    if (provider === LLMProvider.OPENAI || provider === "all") {
      await testBlogExtraction(LLMProvider.OPENAI);
    }
  }

  // Run product tests
  if (contentType === "product" || contentType === "all") {
    if (provider === LLMProvider.GOOGLE_GEMINI || provider === "all") {
      await testProductExtraction(LLMProvider.GOOGLE_GEMINI);
    }
    if (provider === LLMProvider.OPENAI || provider === "all") {
      await testProductExtraction(LLMProvider.OPENAI);
    }
  }
}

// Only run if directly executed
if (require.main === module) {
  console.log("Starting local extraction test...");
  console.log("Make sure you have set up your .env file with API keys.");
  console.log("Usage: npm run test:local -- [contentType] [provider]");
  console.log("  contentType: 'blog', 'product', or 'all' (default)");
  console.log("  provider: 'openai', 'gemini', or 'all' (default)");

  main()
    .then(() => {
      console.log("All tests completed successfully.");
    })
    .catch((error) => {
      console.error("Test failed:", error);
      process.exit(1);
    });
}
