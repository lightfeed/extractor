import * as fs from "fs";
import * as path from "path";
import { z } from "zod";
import {
  extract,
  ContentFormat,
  LLMProvider,
  ExtractorResult,
} from "../../src";

// Read the sample HTML files
const blogPostHtml = fs.readFileSync(
  path.resolve(__dirname, "../fixtures/blog-post.html"),
  "utf8"
);
// Define schemas that will be reused
const blogSchema = z.object({
  title: z.string(),
  author: z.string(),
  date: z.string(),
  tags: z.array(z.string()).optional(),
  summary: z.string(),
});

// Helper function to verify blog post extraction results
function verifyBlogPostExtraction(result: ExtractorResult<any>): void {
  // Check the data is extracted correctly
  expect(result.data).toBeDefined();
  expect(result.data.title).toBe("Understanding Async/Await in JavaScript");
  expect(result.data.author).toBe("John Doe");
  expect(result.data.date).toBe("January 15, 2023");
  expect(typeof result.data.summary).toBe("string");
  expect(result.data.summary.length).toBeGreaterThan(0);

  // Verify that usage statistics are returned
  expect(result.usage).toBeDefined();
  expect(result.usage.inputTokens).toBeGreaterThan(0);
  expect(result.usage.outputTokens).toBeGreaterThan(0);
}

describe("Extract Integration Tests", () => {
  describe("Blog Post Extraction", () => {
    test("should extract blog post data using Google Gemini default model", async () => {
      const result = await extract({
        content: blogPostHtml,
        format: ContentFormat.HTML,
        schema: blogSchema,
        provider: LLMProvider.GOOGLE_GEMINI,
        googleApiKey: process.env.GOOGLE_API_KEY,
      });

      verifyBlogPostExtraction(result);
    });

    test("should extract blog post data using OpenAI default model", async () => {
      const result = await extract({
        content: blogPostHtml,
        format: ContentFormat.HTML,
        schema: blogSchema,
        provider: LLMProvider.OPENAI,
        openaiApiKey: process.env.OPENAI_API_KEY,
      });

      verifyBlogPostExtraction(result);
    });
  });

  const productListHtml = fs.readFileSync(
    path.resolve(__dirname, "../fixtures/product-list.html"),
    "utf8"
  );

  const productSchema = z.object({
    products: z.array(
      z.object({
        name: z.string(),
        price: z.number(),
        rating: z.number().optional(),
        description: z.string().optional(),
        features: z.array(z.string()).optional(),
      })
    ),
  });

  const groundTruthProductList = [
    {
      name: "Smart Speaker Pro",
      price: 129.99,
      rating: 4.2,
      description:
        "Premium smart speaker with built-in voice assistant. Control your smart home, play music, or get answers to your questions.",
      features: [
        "360° sound with deep bass",
        "Multi-room audio support",
        "Compatible with most smart home devices",
        "Available in black, white, and gray",
      ],
    },
    {
      name: "Smart Thermostat",
      price: 89.95,
      rating: 4.8,
      description:
        "Energy-efficient smart thermostat that learns your preferences and helps save on utility bills.",
      features: [
        "Easy installation",
        "Compatible with most HVAC systems",
        "Mobile app control",
        "Energy usage reports",
      ],
    },
    {
      name: "Smart Security Camera",
      price: 74.5,
      rating: 4,
      description:
        "HD security camera with motion detection, night vision, and two-way audio.",
      features: [
        "1080p HD video",
        "Cloud storage available",
        "Weather-resistant",
        "Real-time alerts",
      ],
    },
  ];

  // Helper function to verify product list extraction results
  function verifyProductListExtraction(result: ExtractorResult<any>): void {
    // Check structure, not exact values
    expect(result.data).toBeDefined();
    expect(Array.isArray(result.data.products)).toBe(true);

    // Check parity with ground truth data
    expect(result.data.products.length).toBe(groundTruthProductList.length);

    // Verify each extracted product matches the ground truth
    for (const product of result.data.products) {
      // Find matching product in ground truth by name
      const groundTruthProduct = groundTruthProductList.find(
        (p) => p.name === product.name
      );

      // Ensure the product exists in ground truth
      expect(groundTruthProduct).toBeDefined();

      // Compare all product properties
      expect(product.price).toBe(groundTruthProduct?.price);
      expect(product.rating).toBe(groundTruthProduct?.rating);
      expect(product.description).toBe(groundTruthProduct?.description);
      expect(product.features).toEqual(groundTruthProduct?.features);
    }

    // Verify that usage statistics are returned
    expect(result.usage).toBeDefined();
    expect(result.usage.inputTokens).toBeGreaterThan(0);
    expect(result.usage.outputTokens).toBeGreaterThan(0);
  }

  describe("Product List Extraction", () => {
    test("should extract product list data using Google Gemini", async () => {
      const result = await extract({
        content: productListHtml,
        format: ContentFormat.HTML,
        schema: productSchema,
        provider: LLMProvider.GOOGLE_GEMINI,
        googleApiKey: process.env.GOOGLE_API_KEY,
        extractionOptions: {
          extractMainHtml: true,
        },
      });
      verifyProductListExtraction(result);
    });

    test("should extract product list data using OpenAI", async () => {
      const result = await extract({
        content: productListHtml,
        format: ContentFormat.HTML,
        schema: productSchema,
        provider: LLMProvider.OPENAI,
        openaiApiKey: process.env.OPENAI_API_KEY,
        extractionOptions: {
          extractMainHtml: true,
        },
      });
      verifyProductListExtraction(result);
    });
  });

  const markdownContent = "Product: Apple, Price: N/A";

  describe("Handle Structured Output Errors", () => {
    test("should handle structured output errors using OpenAI", async () => {
      const result = await extract({
        content: markdownContent,
        format: ContentFormat.MARKDOWN,
        schema: z.object({
          product: z.string(),
          // For this test, force the price to be N/A and break the schema so we can test the
          // structured output error handling. In real life, this could happen if the LLM returns
          // a value that is not expected by the schema.
          price: z.number().describe("Use 'N/A' if not available").optional(),
        }),
        provider: LLMProvider.OPENAI,
        openaiApiKey: process.env.OPENAI_API_KEY,
        modelName: "gpt-3.5-turbo",
      });
      expect(result.data).toEqual({ product: "Apple" });
    });
  });
});
