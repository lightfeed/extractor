# lightfeed-extract

Use LLMs to **robustly** extract structured data from HTML and markdown. Used in production by Lightfeed and successfully extracting 10M+ records. Written in Typescript/Node.js.

## Core features
✅ **Sanitize and recover imperfect, failed, or partial LLM outputs into valid JSON** - Ensures outputs conform to your schema

🔗 **Robust URL extraction** - Handles relative/absolute paths and fixes markdown-escaped links automatically

## Other features
- [x] Convert HTML to LLM-ready markdown, option to extract only the main content from HTML, removing navigation, headers & footers, option to extract images
- [x] Extract structured data using OpenAI or Google Gemini models, option to truncate to max input token limit
- [x] Define your extraction schema using Zod
- [x] Support for custom extraction prompts
- [x] Return token usage per each call
- [x] Extensive unit tests and integration tests to ensure production reliability

## Why use an LLM extractor?
🔎 Can reason from context, perform search and return structured answers in addition to extracting content as-is

⚡️ No need to manually create custom scraper code for each site

🔁 Resilient to website changes, e.g., HTML structure, CSS selectors, or page layout

💡 LLMs are becoming more accurate and cost-effective

## Installation

```bash
npm install lightfeed-extract
```

## Hosted Version

While this library provides a robust foundation for data extraction, you might want to consider [lightfeed.ai](https://lightfeed.ai) if you need:

- **Persistent Searchable Databases**: Automatically store and manage extracted data in production-ready vector databases
- **Scheduled Runs, Deduplication and Tracking**: Smart detection and handling of duplicate content across your sources, with automated change tracking
- **Pagination and Multi-page Extraction**: Follow links to collect complete data from connected pages
- **Real-time API and Integration**: Query your extracted data through robust API endpoints and integrations
- **Research Portal**: Explore and analyze your data through an intuitive interface

## Usage

### Basic Example

```typescript
import { extract, ContentFormat, LLMProvider } from 'lightfeed-extract';
import { z } from 'zod';

async function main() {
  // Define your schema. We will run one more sanitization process to recover imperfect, failed, or partial LLM outputs into this schema
  const schema = z.object({
    title: z.string(),
    author: z.string().optional(),
    date: z.string().optional(),
    tags: z.array(z.string()),
    summary: z.string().describe("A brief summary of the article content within 500 characters"),
    links: z.array(z.string()).describe("All URLs mentioned in the article")
  });

  // Extract from HTML
  const result = await extract({
    content: `
      <article>
        <h1>Understanding Async/Await in JavaScript</h1>
        <div class="meta">
          <span class="author">John Doe</span> |
          <span class="date">January 15, 2023</span> |
          <span class="tags">#JavaScript #Programming</span>
        </div>
        <p>This article explains how async/await works in modern JavaScript.</p>
        <p>Learn more at <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/async_function">MDN</a>
        or check our <a href="/blog/javascript-tutorials">tutorials</a>.</p>
      </article>
    `,
    format: ContentFormat.HTML,
    schema,
    sourceUrl: 'https://example.com/blog/async-await', // Required for HTML format to handle relative URLs
    googleApiKey: 'your-google-api-key' // API key must be provided explicitly
  });

  console.log('Extracted Data:', result.data);
  console.log('Token Usage:', result.usage);
}

main().catch(console.error);
```

### Using Markdown Input

You can also extract structured data directly from markdown:

```typescript
const result = await extract({
  content: markdownContent,
  format: ContentFormat.MARKDOWN,
  schema: mySchema,
  provider: LLMProvider.OPENAI,
  openaiApiKey: 'your-openai-api-key'
});
```

### Custom Extraction Prompts

You can provide a custom prompt to guide the extraction process:

```typescript
const result = await extract({
  content: textContent,
  format: ContentFormat.TXT,
  schema: mySchema,
  prompt: "Extract only products that are on sale or have special discounts. Include their original prices, discounted prices, and all specifications.",
  provider: LLMProvider.GOOGLE_GEMINI,
  googleApiKey: 'your-google-api-key'
});
```

If no prompt is provided, a default extraction prompt will be used.

### Using Alternative Models with Input Token Limit

```typescript
// Extract from Markdown with token limit
const result = await extract({
  content: markdownContent,
  format: ContentFormat.MARKDOWN,
  schema,
  provider: LLMProvider.OPENAI,
  openaiApiKey: 'your-openai-api-key',
  modelName: 'gpt-4o-mini',
  temperature: 0.2,
  maxInputTokens: 128000 // Limit to roughly 128K tokens (max input for gpt-4o-mini)
});
```

### HTML Content Extraction

For blog posts or articles with lots of navigation elements, headers, and footers, you can use the `extractMainHtml` option to focus on just the main content:

```typescript
const result = await extract({
  content: htmlContent,
  format: ContentFormat.HTML,
  schema: mySchema,
  htmlExtractionOptions: {
    extractMainHtml: true // Uses heuristics to remove navigation, headers, footers, etc.
  },
  sourceUrl: sourceUrl
});
```

> [!NOTE]
> The `extractMainHtml` option only applies to HTML format. It uses heuristics to identify and extract what appears to be the main content area (like article or main tags). It's recommended to keep this option off (false) when extracting details about a single item (like a product listing) as it might remove important contextual elements.

### Including Images in HTML

By default, images are excluded from the HTML extraction process to simplify the output. If you need to extract image URLs or references, you can enable the `includeImages` option:

```typescript
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

This is particularly useful when:
- You need to extract product images
- You're analyzing content that contains relevant diagrams or charts
- You want to retain image captions and context

#### Example: Extracting Products with Images

When scraping product listings, you'll often want to extract the product images along with other details:

```typescript
import { extract, ContentFormat, LLMProvider } from 'lightfeed-extract';
import { z } from 'zod';

// Define a schema that includes product images
const productListSchema = z.object({
  products: z.array(
    z.object({
      name: z.string(),
      price: z.number(),
      description: z.string().optional(),
      // Include an array of images for each product
      images: z.array(
        z.object({
          url: z.string(),
          alt: z.string().optional(),
        })
      ).optional(),
    })
  ),
});

// Extract product data with images
const result = await extract({
  content: productPageHtml,
  format: ContentFormat.HTML,
  schema: productListSchema,
  provider: LLMProvider.OPENAI,
  openaiApiKey: process.env.OPENAI_API_KEY,
  htmlExtractionOptions: {
    includeImages: true // Enable image extraction
  },
  sourceUrl: sourceUrl,
});

// Now you can access the product images
for (const product of result.data.products) {
  console.log(`${product.name}: ${product.price}`);
  if (product.images && product.images.length > 0) {
    console.log(`Primary image: ${product.images[0].url}`);
  }
}
```

## API Keys

The library will check for API keys in the following order:

1. Directly provided API key parameter (`googleApiKey` or `openaiApiKey`)
2. Environment variables (`GOOGLE_API_KEY` or `OPENAI_API_KEY`)

While the library can use environment variables, it's recommended to explicitly provide API keys in production code for better control and transparency.

## API Reference

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
| `modelName` | `string` | Model name to use | Provider-specific default |
| `googleApiKey` | `string` | Google API key (if using Google Gemini provider) | From env `GOOGLE_API_KEY` |
| `openaiApiKey` | `string` | OpenAI API key (if using OpenAI provider) | From env `OPENAI_API_KEY` |
| `temperature` | `number` | Temperature for the LLM (0-1) | `0` |
| `htmlExtractionOptions` | `HTMLExtractionOptions` | HTML-specific options for content extraction (see below) | `{}` |
| `sourceUrl` | `string` | URL of the HTML content, required when format is HTML to properly handle relative URLs | Required for HTML format |
| `maxInputTokens` | `number` | Maximum number of input tokens to send to the LLM. Uses a rough conversion of 4 characters per token. When specified, content will be truncated if the total prompt size exceeds this limit. | `undefined` |

#### HTML Extraction Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `extractMainHtml` | `boolean` | When enabled for HTML content, attempts to extract the main content area, removing navigation bars, headers, footers, sidebars etc. using heuristics. Should be kept off when extracting details about a single item. | `false` |
| `includeImages` | `boolean` | When enabled, images in the HTML will be included in the markdown output. Enable this when you need to extract image URLs or related content. | `false` |

#### Return Value

The function returns a Promise that resolves to an `ExtractorResult<T>` object:

```typescript
interface ExtractorResult<T> {
  data: T;             // Extracted structured data
  markdown: string;    // The markdown content that was processed
  usage: {             // Token usage statistics
    inputTokens?: number;
    outputTokens?: number;
  }
}
```

### `safeSanitizedParser<T>(schema: ZodTypeAny, rawObject: unknown): z.infer<T> | null`

Utility function to sanitize and recover partial data from LLM outputs that may not perfectly conform to your schema.

```typescript
import { safeSanitizedParser } from 'lightfeed-extract';
import { z } from 'zod';

// Define a product catalog schema
const productSchema = z.object({
  products: z.array(
    z.object({
      id: z.number(),
      name: z.string(), // Required field
      price: z.number().optional(), // Optional number
      inStock: z.boolean().optional(),
      category: z.string().optional()
    })
  ),
  storeInfo: z.object({
    name: z.string(),
    location: z.string().optional(),
    rating: z.number().optional()
  })
});

// Example LLM output with realistic validation issues
const rawLLMOutput = {
  products: [
    {
      id: 1,
      name: "Laptop",
      price: 999,
      inStock: true
    }, // Valid product
    {
      id: 2,
      name: "Headphones",
      price: "N/A", // Non-convertible string for optional number
      inStock: true,
      category: "Audio"
    },
    {
      id: 3,
      // Missing required 'name' field
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
//       inStock: true
//     },
//     {
//       id: 2,
//       name: "Headphones",
//       inStock: true,
//       category: "Audio"
//     },
//     {
//       id: 4,
//       name: "Keyboard",
//       price: 59.99,
//       inStock: true
//     }
//   ],
//   storeInfo: {
//     name: "TechStore",
//     location: "123 Main St"
//   }
// }
```

This utility is especially useful when:
- LLMs return non-convertible data for optional fields (like "N/A" for numbers)
- Some objects in arrays are missing required fields
- Objects contain invalid values that don't match constraints
- You want to recover as much valid data as possible while safely removing problematic parts

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

## License

Apache 2.0
