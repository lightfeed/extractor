import { extract, ContentFormat, LLMProvider } from "./index";
import { z } from "zod";
import { config } from "dotenv";
import * as path from "path";
import * as fs from "fs";
import { htmlToMarkdown } from "./converters";

// Load environment variables from .env file
config({ path: path.resolve(process.cwd(), ".env") });

async function example() {
  try {
    // Check if API key is available
    if (!process.env.GOOGLE_API_KEY) {
      console.error("Error: GOOGLE_API_KEY environment variable is required");
      return;
    }

    // Define a schema for blog post extraction
    const schema = z.object({
      title: z.string(),
      author: z.string().optional(),
      date: z.string().optional(),
      summary: z.string(),
      categories: z.array(z.string()).optional(),
    });

    const htmlContent = fs.readFileSync(
      path.resolve(__dirname, "../tests/fixtures", "blog-post.html"),
      "utf8"
    );
    const sourceUrl = "https://www.example.com/blog/async-await";

    const markdown = htmlToMarkdown(
      htmlContent,
      {
        extractMainHtml: true,
        includeImages: true,
      },
      sourceUrl
    );

    // fs.writeFileSync("test.md", markdown);

    console.log("Running extraction example...");

    // Extract data from HTML
    const result = await extract({
      content: htmlContent,
      format: ContentFormat.HTML,
      schema,
      // Using Google Gemini by default
      openaiApiKey: process.env.OPENAI_API_KEY,
      provider: LLMProvider.OPENAI,
      sourceUrl,
    });

    console.log("Extracted Data:");
    console.log(JSON.stringify(result.data, null, 2));

    console.log("\nMarkdown Content:");
    console.log(result.processedContent.slice(0, 1000) + "\n...");

    console.log("\nToken Usage:");
    console.log(result.usage);
  } catch (error) {
    console.error("Error in example:", error);
  }
}

// Only run if directly executed
if (require.main === module) {
  example();
}
