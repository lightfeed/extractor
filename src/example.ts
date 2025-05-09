import { extract, ContentFormat, LLMProvider } from "./index";
import { z } from "zod";
import { config } from "dotenv";
import * as path from "path";

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

    // HTML example content
    const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>My Tech Blog</title>
    </head>
    <body>
      <header>
        <h1>Understanding TypeScript Generics</h1>
        <div class="meta">
          <span class="author">Jane Smith</span>
          <span class="date">October 15, 2023</span>
        </div>
        <div class="categories">
          <span>TypeScript</span>
          <span>Programming</span>
          <span>Web Development</span>
        </div>
      </header>
      <article>
        <p>TypeScript generics provide a way to create reusable components that can work with a variety of types rather than a single one. This is similar to generics in other languages like Java or C#.</p>
        <p>In this article, we'll explore how to leverage generics to build more flexible and robust code structures.</p>
        <!-- More content here -->
      </article>
    </body>
    </html>
    `;

    console.log("Running extraction example...");

    // Extract data from HTML
    const result = await extract({
      content: htmlContent,
      format: ContentFormat.HTML,
      schema,
      // Using Google Gemini by default
      googleApiKey: process.env.GOOGLE_API_KEY,
      extractionOptions: {
        extractMainHtml: false,
      },
    });

    console.log("Extracted Data:");
    console.log(JSON.stringify(result.data, null, 2));

    console.log("\nMarkdown Content:");
    console.log(result.markdown);

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
