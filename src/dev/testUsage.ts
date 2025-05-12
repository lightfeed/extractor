import { config } from "dotenv";
import * as path from "path";
import { z } from "zod";
import { extract, ContentFormat, LLMProvider } from "../index";

// Load environment variables from .env file
config({ path: path.resolve(process.cwd(), ".env") });

// A simple test script to verify usage tracking works
async function testUsageTracking() {
  console.log("Testing usage tracking with OpenAI...");

  // Check if API keys are available
  if (!process.env.OPENAI_API_KEY) {
    console.error("Error: OPENAI_API_KEY environment variable is required");
    process.exit(1);
  }

  // Simple schema to test extraction
  const schema = z.object({
    title: z.string(),
    description: z.string(),
  });

  // Simple markdown content
  const markdown = `
# Hello World

This is a test of the usage tracking system.
  `;

  try {
    // Run extraction
    const result = await extract({
      content: markdown,
      format: ContentFormat.MARKDOWN,
      schema,
      provider: LLMProvider.OPENAI,
      openaiApiKey: process.env.OPENAI_API_KEY,
    });

    // Log the results
    console.log("\nExtracted data:");
    console.log(JSON.stringify(result.data, null, 2));

    console.log("\nToken usage:");
    console.log(result.usage);

    // Check if usage was captured
    if (result.usage.inputTokens && result.usage.outputTokens) {
      console.log("\n✅ Usage tracking is working correctly!");
    } else {
      console.log("\n❌ Usage tracking failed!");
    }
  } catch (error) {
    console.error("Error testing usage tracking:", error);
  }
}

// Run the test if executed directly
if (require.main === module) {
  testUsageTracking()
    .then(() => console.log("Test completed"))
    .catch(console.error);
}
