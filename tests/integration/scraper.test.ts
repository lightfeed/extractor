import * as fs from "fs";
import * as path from "path";
import { z } from "zod";
import { ChatOpenAI } from "@langchain/openai";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { scrape, ScrapeResult } from "../../src";

function createGeminiLLM() {
  return new ChatGoogleGenerativeAI({
    apiKey: process.env.GOOGLE_API_KEY,
    model: "gemini-2.5-pro",
    temperature: 0,
  });
}

function createOpenAILLM() {
  return new ChatOpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    modelName: "gpt-4.1",
    temperature: 0,
  });
}

const productListHtml = fs.readFileSync(
  path.resolve(__dirname, "../fixtures/product-list.html"),
  "utf8",
);

const productSchema = z.object({
  products: z.array(
    z.object({
      name: z.string(),
      price: z.number(),
      rating: z.number().optional(),
      description: z.string().optional(),
      features: z.array(z.string()).optional(),
      productUrl: z.string().url().optional(),
    }),
  ),
});

const groundTruthProducts = [
  { name: "Smart Speaker Pro", price: 129.99, rating: 4.2 },
  { name: "Smart Thermostat", price: 89.95, rating: 4.8 },
  { name: "Smart Security Camera", price: 74.5, rating: 4 },
];

function verifyScrapeResult(
  result: ScrapeResult<z.infer<typeof productSchema>>,
): void {
  // Verify code is valid JavaScript
  expect(result.code).toBeDefined();
  expect(result.code).toContain("scrape");
  expect(result.code).toContain("document");
  expect(typeof result.code).toBe("string");
  expect(result.code.length).toBeGreaterThan(50);

  // Verify data
  expect(result.data).toBeDefined();
  expect(Array.isArray(result.data.products)).toBe(true);
  expect(result.data.products.length).toBe(groundTruthProducts.length);

  for (const product of result.data.products) {
    const gt = groundTruthProducts.find((p) => p.name === product.name);
    expect(gt).toBeDefined();
    expect(product.price).toBe(gt!.price);
    expect(typeof product.price).toBe("number");
  }

  // Verify processedContent is annotated markdown
  expect(result.processedContent).toContain("css=");

  // Verify usage
  expect(result.usage).toBeDefined();
  expect(result.usage.inputTokens).toBeGreaterThan(0);
  expect(result.usage.outputTokens).toBeGreaterThan(0);
}

describe("Scrape Integration Tests", () => {
  describe("Product List Scraping", () => {
    test("should generate working scraping code using OpenAI gpt-4.1", async () => {
      const result = await scrape({
        llm: createOpenAILLM(),
        content: productListHtml,
        schema: productSchema,
        sourceUrl: "https://example.com/products",
        htmlExtractionOptions: {
          includeImages: true,
        },
      });

      verifyScrapeResult(result);
    }, 120000);

    test("should generate working scraping code using Google Gemini 2.5 Pro", async () => {
      const result = await scrape({
        llm: createGeminiLLM(),
        content: productListHtml,
        schema: productSchema,
        sourceUrl: "https://example.com/products",
        htmlExtractionOptions: {
          includeImages: true,
        },
      });

      verifyScrapeResult(result);
    }, 180000);
  });
});
