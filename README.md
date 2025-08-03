<h1 align="center">
  <img src="https://www.lightfeed.ai/docs/img/logo.svg" width="32" height="32" alt="Lightfeed Logo"/>
  Lightfeed Extractor
</h1>

<p align="center">
  <strong>Robust Web Data Extraction Using LLMs and AI Browser Automations</strong>
</p>

<div align="center">
  <a href="https://www.npmjs.com/package/@lightfeed/extractor">
    <img src="https://img.shields.io/npm/v/@lightfeed/extractor?logo=npm" alt="npm" /></a>
  <a href="https://github.com/lightfeed/extractor/actions/workflows/test.yml">
      <img src="https://img.shields.io/github/actions/workflow/status/lightfeed/extractor/test.yml?branch=main"
          alt="Test status (main branch)"></a>
  <a href="https://github.com/lightfeed/extractor/blob/main/LICENSE">
    <img src="https://img.shields.io/github/license/lightfeed/extractor" alt="License" /></a>
</div>
<div>
  <p align="center">
    <a href="https://lightfeed.ai/docs">
      <img src="https://img.shields.io/badge/docs-lightfeed.ai-3E63DD" alt="Lightfeed Documentation" /></a>
    <a href="https://discord.gg/txZ2s4pgQJ" alt="Discord">
      <img src="https://img.shields.io/discord/1209342987008614501?label=chat&logo=discord&logoColor=white&color=5865F2" alt="Discord" /></a>
    <a href="https://www.linkedin.com/company/lightfeed-ai">
      <img src="https://img.shields.io/badge/Follow%20on%20LinkedIn-0A66C2?logo=linkedin&logoColor=white" alt="Follow on LinkedIn" /></a>
    <a href="https://twitter.com/lightfeed_ai">
      <img src="https://img.shields.io/badge/Follow%20on%20X-202020?logo=x&logoColor=white" alt="Follow on X" /></a>
  </p>
</div>

## Overview
Lightfeed Extractor is a robust LLM-based web extraction library written in Typescript. Use natural language prompts to navigate web pages and extract structured data completely and accurately.

> [!TIP]  
> Building web data pipelines or intelligence databases at scale? Go to [lightfeed.ai](https://lightfeed.ai) - our full platform with premium data sources, AI enrichment, workflow automation, advanced anti-bot, and managed databases - get started for free.

### Features

- 🤖 [**Browser Automation**](#browser-automation) - Run Playwright browsers locally, serverless in the cloud, or connect to a remote browser server. Avoid detection with built-in anti-bot patches and proxy configuration.

- 🧹 [**LLM-ready Markdown**](#html-to-markdown-conversion) - Convert HTML to LLM-ready markdown, with options to extract only main content and clean URLs by removing tracking parameters.

- ⚡️ [**LLM Extraction**](#llm-extraction-function) - Use LLMs in JSON mode to extract structured data according to input Zod schema. Token usage limit and tracking included.

- 🛠️ [**JSON Recovery**](#json-recovery) - Sanitize and recover failed JSON output. This makes complex schema extraction much more robust, especially with deeply nested objects and arrays.

- 🔗 [**URL Validation**](#url-validation) - Handle relative URLs, remove invalid ones, and repair markdown-escaped links.

## Installation

```bash
npm install @lightfeed/extractor
```

## Usage

### E-commerce Product Extraction

This example demonstrates extracting structured product data from a real e-commerce website using a local headed Playwright browser. For production environments, you can use a Playwright browser in [serverless](#serverless-browser) or [remote](#remote-browser) mode.

```typescript
import { extract, ContentFormat, LLMProvider, Browser } from "@lightfeed/extractor";
import { z } from "zod";

// Define schema for product catalog extraction
const productCatalogSchema = z.object({
  products: z
    .array(
      z.object({
        name: z.string().describe("Product name or title"),
        brand: z.string().optional().describe("Brand name"),
        price: z.number().describe("Current price"),
        originalPrice: z
          .number()
          .optional()
          .describe("Original price if on sale"),
        rating: z.number().optional().describe("Product rating out of 5"),
        reviewCount: z.number().optional().describe("Number of reviews"),
        productUrl: z.string().url().describe("Link to product detail page"),
        imageUrl: z.string().url().optional().describe("Product image URL"),
      })
    )
    .describe("List of bread and bakery products"),
});

// Create browser instance
const browser = new Browser({
  type: "local", // also supporting serverless and remote browser
  headless: false,
});

try {
  await browser.start();
  console.log("Browser started successfully");

  // Create page and navigate to e-commerce site
  const page = await browser.newPage();

  const pageUrl = "https://www.walmart.ca/en/browse/grocery/bread-bakery/10019_6000194327359";
  await page.goto(pageUrl);

  try {
    await page.waitForLoadState("networkidle", { timeout: 10000 });
  } catch {
    console.log("Network idle timeout, continuing...");
  }

  // Get HTML content
  const html = await page.content();
  console.log(`Loaded ${html.length} characters of HTML`);

  // Extract structured product data
  console.log("Extracting product data using LLM...");
  const result = await extract({
    content: html,
    format: ContentFormat.HTML,
    sourceUrl: pageUrl,
    schema: productCatalogSchema,
    provider: LLMProvider.GOOGLE_GEMINI,
    googleApiKey: process.env.GOOGLE_API_KEY, // Use environment variable
    htmlExtractionOptions: {
      extractMainHtml: true,
      includeImages: true,
      cleanUrls: true
    }
  });

  console.log("Extraction successful!");
  console.log("Found products:", result.data.products.length);

  // Print the extracted data
  console.log(JSON.stringify(result.data, null, 2));

} catch (error) {
  console.error("Error during extraction:", error);
} finally {
  await browser.close();
  console.log("Browser closed");
}

/* Expected output:
{
  "products": [
    {
      "name": "Dempster's® Signature The Classic Burger Buns, Pack of 8; 568 g",
      "brand": "Dempster's",
      "price": 3.98,
      "originalPrice": 4.57,
      "rating": 4.7376,
      "reviewCount": 141,
      "productUrl": "https://www.walmart.ca/en/ip/dempsters-signature-the-classic-burger-buns/6000188080451?classType=REGULAR&athbdg=L1300",
      "imageUrl": "https://i5.walmartimages.ca/images/Enlarge/725/979/6000196725979.jpg?odnHeight=580&odnWidth=580&odnBg=FFFFFF"
    },
    ... (more products)
  ]
}
*/
```

> [!TIP]
> Run `npm run test:browser` to execute this example, or view the complete code in [testBrowserExtraction.ts](src/dev/testBrowserExtraction.ts).

### Extracting from Markdown or Plain Text

You can also extract structured data directly from HTML, Markdown or text string:

```typescript
const result = await extract({
  content: markdownContent,
  // Specify that content is Markdown. In addition to HTML and Markdown, you can also extract plain text by ContentFormat.TXT
  format: ContentFormat.MARKDOWN,
  schema: mySchema,
  googleApiKey: "your-google-gemini-api-key",
});
```

### Custom Extraction Prompts

You can provide a custom prompt to guide the extraction process:

```typescript
const result = await extract({
  content: htmlContent,
  format: ContentFormat.HTML,
  schema: mySchema,
  sourceUrl: "https://example.com/products",
  // In custom prompt, defined what data should be retrieved
  prompt: "Extract ONLY products that are on sale or have special discounts. Include their original prices, discounted prices, and product URL.",
  googleApiKey: "your-google-gemini-api-key",
});
```

If no prompt is provided, a default extraction prompt will be used.

### Extraction Context

You can use the `extractionContext` option to provide contextual information that enhances the extraction process. This context works alongside the content to enable more accurate and comprehensive data extraction. Common use cases include:

- Enriching partial data objects with missing information from the content
- Providing metadata like website URLs, user locations, timestamps for context-aware extraction
- Including domain-specific knowledge or constraints
- Merging data from multiple sources

The LLM will consider both the content and the extraction context when performing extraction:

```typescript
// Example: Using extraction context with website metadata and geolocation
const extractionContext = {
  websiteUrl: "https://acme.com/products/smart-security-camera",
  country: "Canada",
  city: "Vancouver"
};

const schema = z.object({
  title: z.string(),
  price: z.number(),
  storeName: z.string().describe("Store name in title case from website URL or context"),
  inStock: z.boolean().optional(),
  location: z.string().optional().describe("Location in the format of City, Country")
});

const result = await extract({
  content: htmlContent,
  format: ContentFormat.HTML,
  schema: schema,
  sourceUrl: "https://acme.com/products/smart-security-camera",
  extractionContext: extractionContext,
  googleApiKey: "your-google-gemini-api-key",
});

// The LLM will use the context to extract store name (acme) and consider the location
console.log(result.data);
// {
//   title: "Smart Security Camera",
//   price: 74.50,
//   storeName: "Acme",
//   inStock: true,
//   location: "Vancouver, Canada"
// }
```

### Customizing LLM Provider and Managing Token Limits

You can customize LLM and manage token limits to control costs and ensure your content fits within the model's maximum context window:

```typescript
// Extract from Markdown with token limit
const result = await extract({
  content: markdownContent,
  format: ContentFormat.MARKDOWN,
  schema,
  // Provide model provider and model name
  provider: LLMProvider.OPENAI,
  modelName: "gpt-4o-mini",
  openaiApiKey: "your-openai-api-key",
  // Limit to roughly 128K tokens (max input for gpt-4o-mini)
  maxInputTokens: 128000,
});
```

> [!WARNING]
> For OpenAI models, optional schema is not supported. You need to change `.optional()` to `.nullable()`.

### Extracting from Main HTML

For blog posts or articles with lots of navigation elements, headers, and footers, you can use the `extractMainHtml` option to focus on just the main content:

```typescript
const result = await extract({
  content: htmlContent,
  format: ContentFormat.HTML,
  schema: mySchema,
  htmlExtractionOptions: {
    extractMainHtml: true // Uses heuristics to remove navigation, headers, footers, etc.
  },
  sourceUrl,
});
```

> [!NOTE]
> The `extractMainHtml` option only applies to HTML format. It uses heuristics to identify and extract what appears to be the main content area (like article or main tags). It's recommended to keep this option off (false) when extracting details about a single item (like detail page for a product) as it might remove important contextual elements.

### Extracting Images from HTML

By default, images are excluded from the HTML extraction process to simplify the output. If you need to extract image URLs or references, you can enable the `includeImages` option:

```typescript
// Define a schema that includes product images
const productListSchema = z.object({
  products: z.array(
    z.object({
      name: z.string(),
      price: z.number(),
      description: z.string().optional(),
      // Include an array of images for each product
      image: z.object({
        url: z.string().url(),
        alt: z.string().optional(),
      }).optional(),
    })
  ),
});

const result = await extract({
  content: htmlContent,
  format: ContentFormat.HTML,
  schema: mySchema,
  htmlExtractionOptions: {
    includeImages: true // Includes images in the generated markdown
  },
  sourceUrl: sourceUrl,
});
```

### URL Cleaning

The library can clean URLs to remove tracking parameters and unnecessary components, producing cleaner and more readable links. This is particularly useful for e-commerce sites that add extensive tracking parameters:

```typescript
const result = await extract({
  content: htmlContent,
  format: ContentFormat.HTML,
  schema: mySchema,
  htmlExtractionOptions: {
    cleanUrls: true // Enable URL cleaning to remove tracking parameters
  },
  sourceUrl: "https://amazon.ca/s?k=vitamins",
});
// Amazon URLs like "https://www.amazon.com/Product/dp/B123/ref=sr_1_47?dib=abc"
// become "https://www.amazon.com/Product/dp/B123"
```

> [!NOTE]
> Currently, URL cleaning supports Amazon product URLs (amazon.com, amazon.ca) by removing `/ref=` parameters and everything after. The feature is designed to be extensible for other e-commerce platforms in the future.

## LLM Extraction Function

### LLM API Keys

The library will check for LLM API keys in the following order:

1. Directly provided API key parameter (`googleApiKey` or `openaiApiKey`)
2. Environment variables (`GOOGLE_API_KEY` or `OPENAI_API_KEY`)

While the library can use environment variables, it's recommended to explicitly provide API keys in production code for better control and transparency.

### `extract<T>(options: ExtractorOptions<T>): Promise<ExtractorResult<T>>`

Main function to extract structured data from content.

#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `content` | `string` | HTML, markdown, or plain text content to extract from | Required |
| `format` | `ContentFormat` | Content format (HTML, MARKDOWN, or TXT) | Required |
| `schema` | `z.ZodTypeAny` | Zod schema defining the structure to extract | Required |
| `prompt` | `string` | Custom prompt to guide the extraction process | Internal default prompt |
| `provider` | `LLMProvider` | LLM provider (GOOGLE_GEMINI or OPENAI) | `LLMProvider.GOOGLE_GEMINI` |
| `modelName` | `string` | Model name to use | Provider-specific default, Google Gemini 2.5 flash or OpenAI GPT-4o mini  |
| `googleApiKey` | `string` | Google Gemini API key (if using Google Gemini provider) | From env `GOOGLE_API_KEY` |
| `openaiApiKey` | `string` | OpenAI API key (if using OpenAI provider) | From env `OPENAI_API_KEY` |
| `temperature` | `number` | Temperature for the LLM (0-1) | `0` |
| `htmlExtractionOptions` | `HTMLExtractionOptions` | HTML-specific options for content extraction [see below](#htmlextractionoptions) | `{}` |
| `sourceUrl` | `string` | URL of the HTML content, required when format is HTML to properly handle relative URLs | Required for HTML format |
| `maxInputTokens` | `number` | Maximum number of input tokens to send to the LLM. Uses a rough conversion of 4 characters per token. When specified, content will be truncated if the total prompt size exceeds this limit. | `undefined` |
| `extractionContext` | `Record<string, any>` | Extraction context that provides additional information for the extraction process. Can include partial data objects to enrich, metadata like URLs/locations, or any contextual information relevant to the extraction task. | `undefined` |

#### htmlExtractionOptions

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `extractMainHtml` | `boolean` | When enabled for HTML content, attempts to extract the main content area, removing navigation bars, headers, footers, sidebars etc. using heuristics. Should be kept off when extracting details about a single item. | `false` |
| `includeImages` | `boolean` | When enabled, images in the HTML will be included in the markdown output. Enable this when you need to extract image URLs or related content. | `false` |
| `cleanUrls` | `boolean` | When enabled, removes tracking parameters and unnecessary URL components to produce cleaner links. Currently supports cleaning Amazon product URLs by removing `/ref=` parameters and everything after. This helps produce more readable URLs in the markdown output. | `false` |

#### Return Value

The function returns a Promise that resolves to an `ExtractorResult<T>` object:

```typescript
interface ExtractorResult<T> {
  data: T;             // Extracted structured data
  processedContent: string;    // Processed content that was sent to the LLM. Markdown if the input was HTM (after conversion)
  usage: {             // Token usage statistics
    inputTokens?: number;
    outputTokens?: number;
  };
}
```

## Browser Automation

The `Browser` class provides a clean interface for loading web pages with Playwright. Use it with direct Playwright calls to load HTML content before extracting structured data.

**Constructor**
```typescript
const browser = new Browser(config?: BrowserConfig)
```

**Methods**
| Method | Description | Returns |
|--------|-------------|---------|
| `start()` | Start the browser instance | `Promise<void>` |
| `close()` | Close the browser and clean up resources | `Promise<void>` |
| `newPage()` | Create a new page (browser must be started) | `Promise<Page>` |
| `newContext()` | Create a new browser context (browser must be started) | `Promise<BrowserContext>` |
| `isStarted()` | Check if the browser is currently running | `boolean` |

### Local Browser

Use your local Chrome browser for development and testing. Perfect for:
- Local development and debugging
- Testing automation scripts
- Quick prototyping

```typescript
import { Browser } from "@lightfeed/extractor";

const browser = new Browser({
  type: "local",
  headless: false, // Show browser window for debugging
});
```

### Serverless Browser

Perfect for AWS Lambda and other serverless environments. Uses [@sparticuz/chromium](https://github.com/Sparticuz/chromium) to run Chrome in serverless environments with minimal cold start times and memory usage. Supports proxy configuration for geo-tracking and unblocking.

> [!IMPORTANT]
> This project uses Playwright, which ships with a specific version of Chromium. You need to install the matching version of `@sparticuz/chromium`.
>
> For running on AWS Lambda, lambda layer with ARM64 architecture is preferred.

```typescript
import { Browser } from "@lightfeed/extractor";
import chromium from "@sparticuz/chromium";

const browser = new Browser({
  type: "serverless",
  executablePath: await chromium.executablePath(),
  options: {
    args: chromium.args,
  },
  // Use proxy (optional)
  proxy: {
    host: "proxy.example.com",
    port: 8080,
    auth: {
      username: "user",
      password: "pass"
    }
  }
});
```

### Remote Browser

Connect to any remote browser instance via WebSocket. Great for:
- Brightdata's Scraping Browser
- Custom browser instances in the cloud
- Browser farms and proxy services

```typescript
import { Browser } from "@lightfeed/extractor";

const browser = new Browser({
  type: "remote",
  wsEndpoint: "ws://your-remote-browser:9222/devtools/browser/ws",
  options: {
    timeout: 30000
  }
});
```

## HTML to Markdown Conversion

The `convertHtmlToMarkdown` utility function allows you to convert HTML content to markdown without performing extraction.

**Function signature:**
```typescript
convertHtmlToMarkdown(html: string, options?: HTMLExtractionOptions, sourceUrl?: string): string
```

### Parameters

| Parameter | Type | Description | Default |
|-----------|------|-------------|---------|
| `html` | `string` | HTML content to convert to markdown | Required |
| `options` | `HTMLExtractionOptions` | See [HTML Extraction Options](#html-extraction-options) | `undefined` |
| `sourceUrl` | `string` | URL of the HTML content, used to properly convert relative URLs to absolute URLs | `undefined` |

### Return Value

The function returns a string containing the markdown conversion of the HTML content.

### Example

```typescript
import { convertHtmlToMarkdown, HTMLExtractionOptions } from "@lightfeed/extractor";

// Basic conversion
const markdown = convertHtmlToMarkdown("<h1>Hello World</h1><p>This is a test</p>");
console.log(markdown);
// Output: "Hello World\n===========\n\nThis is a test"

// With options to extract main content, include images, and clean URLs
const options: HTMLExtractionOptions = {
  extractMainHtml: true,
  includeImages: true,
  cleanUrls: true // Clean URLs by removing tracking parameters
};

// With source URL to handle relative links
const markdownWithOptions = convertHtmlToMarkdown(
  `<html>
    <body>
      <header>Header</header>
      <div>
        <img src="/images/logo.png" alt="Logo">
        <a href="/about">About</a>
        <a href="https://www.amazon.com/product/dp/B123/ref=sr_1_1">Amazon Product</a>
      </div>
    </body>
    <footer>Footer content</footer>
  </html>`,
  options,
  "https://example.com"
);
console.log(markdownWithOptions);
// Output: "![Logo](https://example.com/images/logo.png)[About](https://example.com/about)[Amazon Product](https://www.amazon.com/product/dp/B123)"
```

## JSON Recovery

The `safeSanitizedParser` utility function helps sanitize and recover partial data from LLM outputs that may not perfectly conform to your schema.

**Function signature:**
```typescript
safeSanitizedParser<T>(schema: ZodTypeAny, rawObject: unknown): z.infer<T> | null
```

```typescript
import { safeSanitizedParser } from "@lightfeed/extractor";
import { z } from "zod";

// Define a product catalog schema
const productSchema = z.object({
  products: z.array(
    z.object({
      id: z.number(),
      name: z.string(), // Required field
      price: z.number().optional(), // Optional number
      inStock: z.boolean().optional(),
      category: z.string().optional(),
    })
  ),
  storeInfo: z.object({
    name: z.string(),
    location: z.string().optional(),
    rating: z.number().optional(),
  })
});

// Example LLM output with realistic validation issues
const rawLLMOutput = {
  products: [
    {
      id: 1,
      name: "Laptop",
      price: 999,
      inStock: true,
    }, // Valid product
    {
      id: 2,
      name: "Headphones",
      price: "N/A", // Non-convertible string for optional number
      inStock: true,
      category: "Audio",
    },
    {
      id: 3,
      // Missing required "name" field
      price: 45.99,
      inStock: false
    },
    {
      id: 4,
      name: "Keyboard",
      price: 59.99,
      inStock: true
    } // Valid product
  ],
  storeInfo: {
    name: "TechStore",
    location: "123 Main St",
    rating: "N/A" // Invalid: rating is not a number
  }
};

// Sanitize the data to recover what's valid
const sanitizedData = safeSanitizedParser(productSchema, rawLLMOutput);

// Result:
// {
//   products: [
//     {
//       id: 1,
//       name: "Laptop",
//       price: 999,
//       inStock: true,
//     },
//     {
//       id: 2,
//       name: "Headphones",
//       inStock: true,
//       category: "Audio",
//     },
//     {
//       id: 4,
//       name: "Keyboard",
//       price: 59.99,
//       inStock: true,
//     }
//   ],
//   storeInfo: {
//     name: "TechStore",
//     location: "123 Main St",
//   }
// }
```

This utility is especially useful when:
- LLMs return non-convertible data for optional fields (like "N/A" for numbers)
- Some objects in arrays are missing required fields
- Objects contain invalid values that don't match constraints
- You want to recover as much valid data as possible while safely removing problematic parts

## URL Validation

The library provides robust URL validation and handling through Zod's `z.string().url()` validator:

```typescript
const schema = z.object({
  title: z.string(),
  link: z.string().url(),      // Full URL validation works!
  sources: z.array(z.string().url())  // Also works with arrays of URLs
});

const result = await extract({
  content: markdownContent,
  format: ContentFormat.MARKDOWN,
  schema,
  // ... other options
});
```

### How URL Validation Works

Our URL validation system provides several key benefits:

1. **Validation**: Uses Zod's built-in `url()` validator to ensure URLs are properly formatted
2. **Special Character Handling**: Automatically fixes URLs with escaped special characters in markdown (e.g., `https://example.com/meeting-\(2023\)` becomes `https://example.com/meeting-(2023)`)
3. **Relative URL Resolution**: Converts relative URLs to absolute URLs when `sourceUrl` is provided
4. **Invalid URL Handling**: Skips invalid URLs rather than failing the entire extraction using our `safeSanitizedParser`

This approach ensures reliable URL extraction while maintaining the full power of Zod's schema validation.

## Development

### Setup

1. Clone the repository
2. Install dependencies with `npm install`
3. Create a `.env` file in the root directory with your API keys (see `.env.example`)

### Scripts

- `npm run build` - Build the library
- `npm run clean` - Remove build artifacts
- `npm run test` - Run all tests (requires API keys for integration tests)
- `npm run dev` - Run the example file

### Running Local Tests

You can test the library with real API calls and sample HTML files:

```bash
# Run all local tests with both providers
npm run test:local

# Run specific test type with both providers
npm run test:local -- blog
npm run test:local -- product

# Run tests with a specific provider
npm run test:local -- blog openai   # Test blog extraction with OpenAI
npm run test:local -- product gemini  # Test product extraction with Google Gemini
```

### Testing

The library includes both unit tests and integration tests:

- **Unit tests**: Test individual components without making API calls
- **Integration tests**: Test full extraction pipeline with real API calls

Integration tests require valid API keys to be provided in your `.env` file or environment variables. Tests will fail if required API keys are not available.

Each integration test runs with both Google Gemini and OpenAI to ensure compatibility across providers.

#### HTML to Markdown Integration Tests

This project includes comprehensive integration tests for the HTML to Markdown converter using real-world HTML samples. The tests validate three conversion types:

1. Basic conversion (no images)
2. Main content extraction (no images)
3. Conversion with images included

These tests use a Git submodule with HTML files and groundtruth markdown files. The submodule is not downloaded by default to keep the repository lightweight. To run these tests:

```bash
# First time: Initialize and download the test data submodule
npm run test:html2md:update

# Run the HTML to Markdown integration tests
npm run test:html2md

# Update test data if new test files are available
npm run test:html2md:sync
```

The test suite automatically discovers all available test files and creates test cases for each conversion type that has a corresponding groundtruth file.

#### Running Specific Tests

You can run individual tests by using the `-t` flag with a pattern that matches the test description:

```bash
# Run a specific test by exact description
npm run test -- -t "should extract blog post data using Google Gemini default model"

# Run all tests that include a specific keyword
npm run test -- -t "blog post"

# Run all tests for a specific provider
npm run test -- -t "OpenAI"

# Run all unit tests for a specific utility
npm run test -- -t "safeSanitizedParser"

# Run specific HTML to Markdown tests
npm run test -- -t "should convert forum/tech-0 to markdown"
```

The `-t` flag uses pattern matching, so you can be as specific or general as needed to select the tests you want to run.

## Hosted Version

While this library provides a robust foundation for data extraction, you might want to consider [lightfeed.ai](https://lightfeed.ai) if you need:

- 🤖 **AI Enrichment** - Enrich any data point: contact info, product details, company intelligence, and more
- 📍 **Geolocation Targeting** - Capture region-specific price, inventory and campaign data for competitive intelligence
- ⏰ **Workflow Automation** - Set up intelligent data pipelines that run automatically on your schedule
- 📊 **Deduplication and Value History** - Maintain consistent data with automatic change tracking
- ⚡️ **Database with API** - Manage data in a production-ready vector database with real-time API
- 🥷 **Premium Proxies and Anti-bot** - Automatically handle CAPTCHAs and proxy rotation without intervention

## Support

If you need direct assistance with your implementation:
- Email us at support@lightfeed.ai
- Open an issue in this repository
- Post your question in our [Discord community](https://discord.gg/txZ2s4pgQJ)

## License

Apache 2.0
