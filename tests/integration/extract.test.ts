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
  // tags: z.array(z.string()).optional().nullable(),
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
    //     extractionOptions: {
    //       extractMainHtml : true,
    //     },
    //   });

    //   // Check types and structure, not exact values (as LLM output can vary)
    //   expect(result.data).toBeDefined();
    //   expect(typeof result.data.title).toBe("string");
    //   expect(typeof result.data.author).toBe("string");
    //   expect(typeof result.data.date).toBe("string");
    //   expect(typeof result.data.summary).toBe("string");

    //   // Check markdown conversion
    //   expect(result.markdown).toContain("Async/await");

    //   // Check that usage statistics are captured
    //   expect(result.usage).toBeDefined();
    //   expect(result.usage.inputTokens).toBeGreaterThan(0);
    // });

    test("should extract blog post data using OpenAI", async () => {
      const result = await extract({
        content: blogPostHtml,
        format: ContentFormat.HTML,
        schema: blogSchema,
        provider: LLMProvider.OPENAI,
        openaiApiKey: process.env.OPENAI_API_KEY,
        extractionOptions: {
          extractMainHtml: true,
        },
      });

      console.log("result is", result);
      // Check types and structure, not exact values (as LLM output can vary)
      expect(result.data).toBeDefined();
      expect(typeof result.data.title).toBe("string");
      expect(typeof result.data.author).toBe("string");
      expect(typeof result.data.date).toBe("string");
      expect(typeof result.data.summary).toBe("string");

      // Check markdown conversion
      expect(result.markdown).toContain("Async/await");

      // Check that usage statistics are captured
      expect(result.usage).toBeDefined();
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

    test("should extract product list data using OpenAI", async () => {
      const result = await extract({
        content: productListHtml,
        format: ContentFormat.HTML,
        schema: productSchema,
        provider: LLMProvider.OPENAI,
        openaiApiKey: process.env.OPENAI_API_KEY,
        modelName: "gpt-4o",
      });

      // Check structure, not exact values
      expect(result.data).toBeDefined();
      expect(typeof result.data.title).toBe("string");
      expect(Array.isArray(result.data.products)).toBe(true);
      expect(result.data.products.length).toBeGreaterThan(0);
      expect(typeof result.data.totalProducts).toBe("number");

      // Check that each product has required fields
      for (const product of result.data.products) {
        expect(typeof product.name).toBe("string");
        expect(typeof product.price).toBe("string");
      }

      // Check usage statistics
      expect(result.usage).toBeDefined();
    });
  });
});
