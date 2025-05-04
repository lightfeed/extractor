import * as fs from "fs";
import * as path from "path";
import { z } from "zod";
import {
  extract,
  ContentFormat,
  LLMProvider,
  ExtractorResult,
} from "../../src";
import { htmlToMarkdown } from "../../src/converters";

// Read the sample HTML file with images
const articleWithImages = fs.readFileSync(
  path.resolve(__dirname, "../fixtures/article-with-images.html"),
  "utf8"
);

// Define a schema that includes image extraction
const articleSchema = z.object({
  title: z.string(),
  author: z.string(),
  date: z.string(),
  tags: z
    .array(z.string())
    .optional()
    .describe("Tags appear after the date. Do not include the # symbol."),
  summary: z.string(),
  images: z
    .array(
      z.object({
        url: z.string(),
        alt: z.string().optional(),
        caption: z.string().optional(),
      })
    )
    .optional()
    .describe(
      "Extract all images from the article with their URLs and alt text"
    ),
});

// Function to verify that images are correctly extracted
function verifyImageExtraction(result: ExtractorResult<any>): void {
  // Check the data is extracted correctly
  expect(result.data).toBeDefined();
  expect(result.data.title).toBe(
    "Modern Web Development with React and Node.js"
  );
  expect(result.data.author).toBe("Jane Smith");
  expect(result.data.date).toBe("March 20, 2023");
  expect(result.data.tags).toContain("React");
  expect(result.data.tags).toContain("Node.js");
  expect(result.data.tags).toContain("JavaScript");

  // Verify that images are extracted
  expect(result.data.images).toBeDefined();
  expect(Array.isArray(result.data.images)).toBe(true);
  expect(result.data.images.length).toBeGreaterThan(0);

  // Check for the main architecture image
  const architectureImage = result.data.images.find((img: any) =>
    img.url.includes("react-node-architecture.png")
  );
  expect(architectureImage).toBeDefined();
  expect(architectureImage.alt).toBe("React and Node.js Architecture");

  // Check for the event loop image
  const eventLoopImage = result.data.images.find((img: any) =>
    img.url.includes("nodejs-event-loop.jpg")
  );
  expect(eventLoopImage).toBeDefined();
  expect(eventLoopImage.alt).toBe("Node.js Event Loop");

  // Check for the webpack image
  const webpackImage = result.data.images.find((img: any) =>
    img.url.includes("webpack-logo.png")
  );
  expect(webpackImage).toBeDefined();
  expect(webpackImage.alt).toBe("Webpack Logo");
  expect(webpackImage.caption).toBe("Webpack for module bundling");

  // Verify that usage statistics are returned
  expect(result.usage).toBeDefined();
  expect(result.usage.inputTokens).toBeGreaterThan(0);
  expect(result.usage.outputTokens).toBeGreaterThan(0);
}

describe("Image Extraction Integration Tests", () => {
  // Test that the low level htmlToMarkdown function correctly handles images
  test("should include images in markdown when includeImages is true", () => {
    const markdownWithImages = htmlToMarkdown(articleWithImages, {
      includeImages: true,
    });
    const markdownWithoutImages = htmlToMarkdown(articleWithImages);

    // With includeImages: true, markdown should contain image references
    expect(markdownWithImages).toContain(
      "![React and Node.js Architecture](https://example.com/images/react-node-architecture.png)"
    );
    expect(markdownWithImages).toContain(
      "![Node.js Event Loop](https://example.com/images/nodejs-event-loop.jpg)"
    );

    // Without includeImages, markdown should not contain image references
    expect(markdownWithoutImages).not.toContain(
      "![React and Node.js Architecture]"
    );
    expect(markdownWithoutImages).not.toContain("![Node.js Event Loop]");
  });

  // Test with OpenAI
  test("should extract images using OpenAI when includeImages is true", async () => {
    const result = await extract({
      content: articleWithImages,
      format: ContentFormat.HTML,
      schema: articleSchema,
      provider: LLMProvider.OPENAI,
      openaiApiKey: process.env.OPENAI_API_KEY,
      extractionOptions: {
        includeImages: true,
      },
    });

    verifyImageExtraction(result);
  });

  // Test with Google Gemini
  test("should extract images using Google Gemini when includeImages is true", async () => {
    const result = await extract({
      content: articleWithImages,
      format: ContentFormat.HTML,
      schema: articleSchema,
      provider: LLMProvider.GOOGLE_GEMINI,
      googleApiKey: process.env.GOOGLE_API_KEY,
      extractionOptions: {
        includeImages: true,
      },
    });

    verifyImageExtraction(result);
  });
});
