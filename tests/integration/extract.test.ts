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
  tags: z
    .array(z.string())
    .optional()
    .describe("Tags appear after the date. Do not include the # symbol."),
  summary: z.string(),
  links: z
    .array(z.string().url())
    .optional()
    .describe("Extract all URLs from the content"),
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
  expect(result.data.tags).toEqual(["JavaScript", "Programming"]);

  // Verify URLs are extracted and are absolute
  expect(result.data.links).toBeDefined();
  expect(Array.isArray(result.data.links)).toBe(true);
  expect(result.data.links).toContain(
    "https://example.com/blog/javascript-tutorials"
  );
  expect(result.data.links).toContain(
    "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/async_function"
  );
  expect(result.data.links).toContain("https://api.example.com/data");

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
        sourceUrl: "https://example.com/blog/async-await",
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
        sourceUrl: "https://example.com/blog/async-await",
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
        imageUrl: z.string().url().optional(),
        productUrl: z.string().url().optional(),
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
      imageUrl: "https://example.com/images/products/speaker.jpg",
      productUrl: "https://example.com/products/smart-speaker-pro",
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
      imageUrl: "https://example.com/images/products/thermostat.jpg",
      productUrl: "https://example.com/products/smart-thermostat",
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
      imageUrl: "https://example.com/images/products/camera.jpg",
      productUrl: "https://example.com/products/smart-security-camera",
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
      expect(product.price).toBe(groundTruthProduct!.price);
      expect(product.rating).toBe(groundTruthProduct!.rating);
      expect(product.description).toBe(groundTruthProduct!.description);
      expect(product.features).toEqual(groundTruthProduct!.features);

      // Verify URLs are absolute
      expect(product.imageUrl).toBe(groundTruthProduct!.imageUrl);
      expect(product.productUrl).toBe(groundTruthProduct!.productUrl);
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
        sourceUrl: "https://example.com/products",
        htmlExtractionOptions: {
          extractMainHtml: true,
          includeImages: true,
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
        sourceUrl: "https://example.com/products",
        htmlExtractionOptions: {
          extractMainHtml: true,
          includeImages: true,
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

    test("should handle structured output errors using Google Gemini", async () => {
      const result = await extract({
        content: blogPostHtml,
        format: ContentFormat.HTML,
        schema: z.object({
          title: z.string(),
          author: z.string().optional(),
          date: z.string().optional(),
          tags: z
            .array(z.string())
            .optional()
            .describe(
              "Tags appear after the date. Do not include the # symbol."
            ),
          summary: z.string(),
          // For this test, adding an additional content field seems to cause the Google Gemini model
          // to fail in some cases to return the structured output.
          content: z.string().optional(),
        }),
        provider: LLMProvider.GOOGLE_GEMINI,
        googleApiKey: process.env.GOOGLE_API_KEY,
        sourceUrl: "https://example.com/blog/async-await",
      });
      expect(result.data).toBeDefined();
    });
  });

  describe("Special Character Handling", () => {
    test("should extract link with special characters from markdown and validate as URL", async () => {
      const markdownContent =
        "[Meeting \\[11-12-24\\]](https://example.com/meeting-\\(11-12-24\\))";

      // Use string().url() validation
      const schema = z.object({
        title: z.string(),
        link: z.string().url(), // Added URL validation
      });

      const result = await extract({
        content: markdownContent,
        format: ContentFormat.MARKDOWN,
        schema,
        provider: LLMProvider.OPENAI,
        openaiApiKey: process.env.OPENAI_API_KEY,
      });

      // Verify the extracted data
      expect(result.data.title).toBe("Meeting [11-12-24]");
      expect(result.data.link).toBe("https://example.com/meeting-(11-12-24)");
    });

    test("should extract an array of URLs with special characters", async () => {
      const markdownContent = `
# Meeting Links

- [Q4 Planning \\(2023\\)](https://example.com/meetings/q4-planning-\\(2023\\))
- [Budget Review \\[2024\\]](https://example.com/budget/review-\\[2024\\])
- [Product Launch (May 2024)](https://example.com/products/launch-(may-2024))
      `;

      // Use array of string().url() validation
      const schema = z.object({
        title: z.string(),
        links: z.array(z.string().url()),
      });

      const result = await extract({
        content: markdownContent,
        format: ContentFormat.MARKDOWN,
        schema,
        provider: LLMProvider.OPENAI,
        openaiApiKey: process.env.OPENAI_API_KEY,
      });

      // Verify the extracted data
      expect(result.data.title).toBe("Meeting Links");
      expect(result.data.links).toContain(
        "https://example.com/meetings/q4-planning-(2023)"
      );
      expect(result.data.links).toContain(
        "https://example.com/budget/review-[2024]"
      );
      expect(result.data.links).toContain(
        "https://example.com/products/launch-(may-2024)"
      );
    });
  });

  describe("Data Enrichment", () => {
    test("should enrich existing data with blog post content using Google Gemini", async () => {
      // Create partial data to be enriched
      const partialData = {
        title: "A Different Title",
        date: "February 1, 2022", // This might be updated based on content
        summary: "",
      };

      const result = await extract({
        content: blogPostHtml,
        format: ContentFormat.HTML,
        schema: blogSchema,
        provider: LLMProvider.GOOGLE_GEMINI,
        googleApiKey: process.env.GOOGLE_API_KEY,
        sourceUrl: "https://example.com/blog/async-await",
        dataToEnrich: partialData,
      });

      // Verify the enriched data has the correct values
      verifyBlogPostExtraction(result);
    });

    test("should enrich existing data with blog post content using OpenAI", async () => {
      // Create partial data with some existing values
      const partialData = {
        title: "A Different Title", // This should be updated
        date: "February 1, 2022", // This might be updated based on content
        summary: "",
      };

      const result = await extract({
        content: blogPostHtml,
        format: ContentFormat.HTML,
        schema: blogSchema,
        provider: LLMProvider.OPENAI,
        openaiApiKey: process.env.OPENAI_API_KEY,
        sourceUrl: "https://example.com/blog/async-await",
        dataToEnrich: partialData,
      });

      // Verify the enriched data has the correct values
      verifyBlogPostExtraction(result);
    });

    test("should enrich product list data with custom prompt using Google Gemini", async () => {
      // Create partial product data with missing information
      const partialData = {
        products: [
          {
            name: "Smart Speaker Pro",
            price: 0, // Missing price
            features: [], // Missing features
          },
          {
            name: "Smart Thermostat",
            price: 0, // Missing price
            features: [], // Missing features
          },
          {
            name: "Smart Security Camera",
            price: 0, // Missing price
            features: [], // Missing features
          },
        ],
      };

      const result = await extract({
        content: productListHtml,
        format: ContentFormat.HTML,
        schema: productSchema,
        provider: LLMProvider.GOOGLE_GEMINI,
        googleApiKey: process.env.GOOGLE_API_KEY,
        sourceUrl: "https://example.com/products",
        dataToEnrich: partialData,
        prompt:
          "Focus on enriching the product data with accurate prices and feature lists from the context.",
      });

      // Verify that prices and features were enriched correctly
      expect(result.data).toBeDefined();
      expect(Array.isArray(result.data.products)).toBe(true);
      expect(result.data.products.length).toBe(3);

      // Check prices were updated
      expect(result.data.products[0].price).toBe(129.99);
      expect(result.data.products[1].price).toBe(89.95);
      expect(result.data.products[2].price).toBe(74.5);

      // Check features were populated
      expect(result.data.products[0].features?.length).toBeGreaterThan(0);
      expect(result.data.products[1].features?.length).toBeGreaterThan(0);
      expect(result.data.products[2].features?.length).toBeGreaterThan(0);

      // Verify usage stats
      expect(result.usage).toBeDefined();
      expect(result.usage.inputTokens).toBeGreaterThan(0);
      expect(result.usage.outputTokens).toBeGreaterThan(0);
    });
  });
});

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
        url: z.string().url(),
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
      htmlExtractionOptions: {
        includeImages: true,
      },
      sourceUrl: "https://example.com/blog/async-await",
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
      htmlExtractionOptions: {
        includeImages: true,
      },
      sourceUrl: "https://example.com/blog/async-await",
    });

    verifyImageExtraction(result);
  });
});
