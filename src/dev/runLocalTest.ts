import * as fs from "fs";
import * as path from "path";
import { config } from "dotenv";
import { z } from "zod";
import { ChatOpenAI } from "@langchain/openai";
import { ChatGoogle } from "@langchain/google";
import { extract, ContentFormat } from "../index";

// Load environment variables from .env file
config({ path: path.resolve(process.cwd(), ".env") });

type Provider = "gemini" | "openai";

function createLLM(provider: Provider) {
  if (provider === "gemini") {
    return new ChatGoogle({
      apiKey: process.env.GOOGLE_API_KEY,
      model: "gemini-2.5-flash",
      temperature: 0,
    });
  }
  return new ChatOpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    modelName: "gpt-4o-mini",
    temperature: 0,
  });
}

// Helper to load HTML test fixtures
function loadFixture(filename: string): string {
  return fs.readFileSync(
    path.resolve(__dirname, "../../tests/fixtures", filename),
    "utf8",
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

// OpenAI version with nullable instead of optional
const blogSchemaOpenAI = z.object({
  title: z.string(),
  author: z.string().nullable(),
  date: z.string().nullable(),
  tags: z
    .array(z.string())
    .nullable()
    .describe("Tags appear after the date. Do not include the # symbol."),
  summary: z.string(),
  content: z.string().nullable(),
});

const productSchema = z.object({
  products: z.array(
    z.object({
      name: z.string(),
      price: z.string(),
      rating: z.string().optional(),
      description: z.string().optional(),
      features: z.array(z.string()).optional(),
    }),
  ),
});

// OpenAI version with nullable instead of optional
const productSchemaOpenAI = z.object({
  products: z.array(
    z.object({
      name: z.string(),
      price: z.string(),
      rating: z.string().nullable(),
      description: z.string().nullable(),
      features: z.array(z.string()).nullable(),
    }),
  ),
});

// Test functions
async function testBlogExtraction(provider: Provider = "gemini") {
  console.log(`Testing blog post extraction with ${provider}...`);

  try {
    const html = loadFixture("blog-post.html");

    if (provider === "gemini" && !process.env.GOOGLE_API_KEY) {
      console.error("Error: GOOGLE_API_KEY environment variable is required");
      process.exit(1);
    } else if (provider === "openai" && !process.env.OPENAI_API_KEY) {
      console.error("Error: OPENAI_API_KEY environment variable is required");
      process.exit(1);
    }

    const result = await extract({
      llm: createLLM(provider),
      content: html,
      format: ContentFormat.HTML,
      schema: provider === "gemini" ? blogSchema : blogSchemaOpenAI,
      htmlExtractionOptions: {
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

async function testProductExtraction(provider: Provider = "gemini") {
  console.log(`Testing product listing extraction with ${provider}...`);

  try {
    const html = loadFixture("product-list.html");

    if (provider === "gemini" && !process.env.GOOGLE_API_KEY) {
      console.error("Error: GOOGLE_API_KEY environment variable is required");
      process.exit(1);
    } else if (provider === "openai" && !process.env.OPENAI_API_KEY) {
      console.error("Error: OPENAI_API_KEY environment variable is required");
      process.exit(1);
    }

    const result = await extract({
      llm: createLLM(provider),
      content: html,
      format: ContentFormat.HTML,
      schema: provider === "gemini" ? productSchema : productSchemaOpenAI,
      htmlExtractionOptions: {
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
  const args = process.argv.slice(2);
  const contentType = args[0] || "all";
  const providerArg = args[1]?.toUpperCase();
  const provider: Provider | "all" =
    providerArg === "OPENAI"
      ? "openai"
      : providerArg === "GEMINI"
        ? "gemini"
        : "all";

  console.log("API Keys available:");
  console.log(`- GOOGLE_API_KEY: ${process.env.GOOGLE_API_KEY ? "Yes" : "No"}`);
  console.log(`- OPENAI_API_KEY: ${process.env.OPENAI_API_KEY ? "Yes" : "No"}`);
  console.log("");

  if (contentType === "blog" || contentType === "all") {
    if (provider === "gemini" || provider === "all") {
      await testBlogExtraction("gemini");
    }
    if (provider === "openai" || provider === "all") {
      await testBlogExtraction("openai");
    }
  }

  if (contentType === "product" || contentType === "all") {
    if (provider === "gemini" || provider === "all") {
      await testProductExtraction("gemini");
    }
    if (provider === "openai" || provider === "all") {
      await testProductExtraction("openai");
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
