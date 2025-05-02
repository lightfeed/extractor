import * as fs from "fs";
import * as path from "path";
import { z } from "zod";
import { extract, ContentFormat, LLMProvider } from "../../src";

// Read the sample HTML files
const blogPostHtml = fs.readFileSync(
  path.resolve(__dirname, "../fixtures/blog-post.html"),
  "utf8"
);
const productListHtml = fs.readFileSync(
  path.resolve(__dirname, "../fixtures/product-list.html"),
  "utf8"
);

// Define schemas that will be reused
const blogSchema = z.object({
  title: z.string(),
  author: z.string(),
  date: z.string(),
  tags: z.array(z.string()).nullable().optional(),
  summary: z.string(),
});

const productSchema = z.object({
  title: z.string(),
  products: z.array(
    z.object({
      name: z.string(),
      price: z.string(),
      rating: z.string().optional().nullable(),
      description: z.string().optional().nullable(),
      features: z.array(z.string()).optional().nullable(),
    })
  ),
  totalProducts: z.number(),
});

describe("Extract Integration Tests", () => {
  describe("Blog Post Extraction", () => {
    // test("should extract blog post data using Google Gemini", async () => {
    //   const result = await extract({
    //     content: blogPostHtml,
    //     format: ContentFormat.HTML,
    //     schema: blogSchema,
    //     provider: LLMProvider.GOOGLE_GEMINI,
    //     googleApiKey: process.env.GOOGLE_API_KEY,
    //   });

    //   // Check types and structure, not exact values (as LLM output can vary)
    //   expect(result.data).toBeDefined();
    //   expect(result.data.title).toBe("Understanding Async/Await in JavaScript");
    //   expect(result.data.author).toBe("John Doe");
    //   expect(result.data.date).toBe("January 15, 2023");
    //   expect(typeof result.data.summary).toBe("string");

    //   // Check markdown conversion
    //   expect(result.markdown).toContain("Async/await");

    //   // Check that usage statistics are captured
    //   expect(result.usage).toBeDefined();
    //   expect(result.usage.inputTokens).toBeGreaterThan(0);
    //   expect(result.usage.outputTokens).toBeGreaterThan(0);
    // });

    test("should extract data and return usage statistics with OpenAI", async () => {
      const result = await extract({
        content: blogPostHtml,
        format: ContentFormat.HTML,
        schema: blogSchema,
        provider: LLMProvider.OPENAI,
        openaiApiKey: process.env.OPENAI_API_KEY,
      });

      // Check the data is extracted correctly
      expect(result.data).toBeDefined();
      expect(result.data.title).toBe("Understanding Async/Await in JavaScript");
      expect(result.data.author).toBe("John Doe");
      expect(result.data.date).toBe("January 15, 2023");
      expect(typeof result.data.summary).toBe("string");

      // Verify that usage statistics are returned
      expect(result.usage).toBeDefined();
      expect(result.usage.inputTokens).toBeDefined();
      expect(result.usage.outputTokens).toBeDefined();
      expect(result.usage.inputTokens).toBeGreaterThan(0);
      expect(result.usage.outputTokens).toBeGreaterThan(0);

      // Log the usage for inspection
      console.log("Token usage:", result.usage);
    });
  });

  describe("Product List Extraction", () => {
    // test("should extract product list data using Google Gemini", async () => {
    //   const result = await extract({
    //     content: productListHtml,
    //     format: ContentFormat.HTML,
    //     schema: productSchema,
    //     provider: LLMProvider.GOOGLE_GEMINI,
    //     googleApiKey: process.env.GOOGLE_API_KEY,
    //   });
    //   // Check structure, not exact values
    //   expect(result.data).toBeDefined();
    //   expect(typeof result.data.title).toBe("string");
    //   expect(Array.isArray(result.data.products)).toBe(true);
    //   expect(result.data.products.length).toBeGreaterThan(0);
    //   expect(typeof result.data.totalProducts).toBe("number");
    //   // Check that each product has required fields
    //   for (const product of result.data.products) {
    //     expect(typeof product.name).toBe("string");
    //     expect(typeof product.price).toBe("string");
    //   }
    //   // Check usage statistics
    //   expect(result.usage).toBeDefined();
    // });
    // test("should extract product list data using OpenAI", async () => {
    //   const result = await extract({
    //     content: productListHtml,
    //     format: ContentFormat.HTML,
    //     schema: productSchema,
    //     provider: LLMProvider.OPENAI,
    //     openaiApiKey: process.env.OPENAI_API_KEY,
    //     extractionOptions: {
    //       extractMainHtml: true,
    //     },
    //   });
    //   // Check structure, not exact values
    //   expect(result.data).toBeDefined();
    //   expect(typeof result.data.title).toBe("string");
    //   expect(Array.isArray(result.data.products)).toBe(true);
    //   expect(result.data.products.length).toBeGreaterThan(0);
    //   expect(typeof result.data.totalProducts).toBe("number");
    //   // Check that each product has required fields
    //   for (const product of result.data.products) {
    //     expect(typeof product.name).toBe("string");
    //     expect(typeof product.price).toBe("string");
    //   }
    //   // Check usage statistics
    //   expect(result.usage).toBeDefined();
    // });
  });
});
