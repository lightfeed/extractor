# lightfeed-extract

Use LLM to **robustly** extract structured data from HTML and markdown, for Node.js and Typescript.

## Why use LLM?
- No need manual scraping. No more broken scripts due to website change.
- LLMs are becoming more accurate and cost-effective.
- Can reason from context and return structured answers in addition to extracting as-it-is.

## Existing problems to LLM extractor
- Extrating URLs can cause errors, e.g. LLM not good at extracting very long URL strings and relative links
- Output does not comply to JSON schema, any invalid field will make the output JSON bad, one invalid item will make the entire list response bad.

## We are fixing these problems
- Robustly extract link URLs, including extremely long links, relative links and fixing invalid links with escaped characters due to markdown.
- Sanitize and recover imperfect or failed LLM outputs into valid JSON object to your defined schema.

## Other features
- Convert HTML to LLM-ready markdown
- Extract structured data using OpenAI or Google Gemini models
- Define your extraction schema using Zod
- Support for custom extraction prompts
- Track token usage statistics
- Option to extract only the main content from HTML, removing navigation, headers & footers. Option to extract images.

## Installation

```bash
npm install lightfeed-extract
```

## Usage

### Basic Example

```typescript
import { extract, ContentFormat, LLMProvider } from 'lightfeed-extract';
import { z } from 'zod';

async function main() {
  // Define your schema
  const schema = z.object({
    title: z.string(),
    author: z.string().optional(),
    date: z.string().optional(),
    content: z.string()
  });

  // Extract from HTML
  const result = await extract({
    content: '<article><h1>My Blog Post</h1><p>This is some content</p></article>',
    format: ContentFormat.HTML,
    schema,
    googleApiKey: 'your-google-api-key' // API key must be provided explicitly
  });

  console.log('Extracted Data:', result.data);
  console.log('Token Usage:', result.usage);
}

main().catch(console.error);
```

### Using Plain Text Input

You can also extract structured data directly from plain text:

```typescript
const result = await extract({
  content: "Product Name: Wireless Headphones\nPrice: $99.99\nRating: 4.5/5\nFeatures: Noise cancellation, 20-hour battery life",
  format: ContentFormat.TXT,
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
  prompt: "Extract all product details including specifications and pricing information", 
  provider: LLMProvider.GOOGLE_GEMINI,
  googleApiKey: 'your-google-api-key'
});
```

If no prompt is provided, a default extraction prompt will be used.

### Advanced Example with OpenAI

```typescript
import { extract, ContentFormat, LLMProvider } from 'lightfeed-extract';
import { z } from 'zod';

async function main() {
  // Define a more complex schema
  const schema = z.object({
    items: z.array(
      z.object({
        name: z.string(),
        price: z.string(),
        description: z.string().optional()
      })
    ),
    totalItems: z.number()
  });

  // Extract from Markdown directly
  const result = await extract({
    content: `
# Product List

- Product A: $19.99
  High-quality item with great features.
- Product B: $24.99
  Another excellent product.
- Product C: $15.50
    `,
    format: ContentFormat.MARKDOWN,
    schema,
    provider: LLMProvider.OPENAI,
    openaiApiKey: 'your-openai-api-key', // API key must be provided explicitly
    modelName: 'gpt-4o-mini',
    temperature: 0.2
  });

  console.log('Extracted Data:', result.data);
  console.log('Token Usage:', result.usage);
}

main().catch(console.error);
```

### HTML Content Extraction

For blog posts or articles with lots of navigation elements, headers, and footers, you can use the `extractMainHtml` option to focus on just the main content:

```typescript
const result = await extract({
  content: htmlContent,
  format: ContentFormat.HTML,
  schema: mySchema,
  extractionOptions: {
    extractMainHtml: true // Uses heuristics to remove navigation, headers, footers, etc.
  }
});
```

**Note:** The `extractMainHtml` option only applies to HTML format, not markdown. It uses simple heuristics to identify and extract what appears to be the main content area (like article or main tags). It's recommended to keep this option off (false) when extracting details about a single item (like a product listing) as it might remove important contextual elements.

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
| `extractionOptions` | `ContentExtractionOptions` | Options for content extraction (see below) | `{}` |

#### Content Extraction Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `extractMainHtml` | `boolean` | When enabled for HTML content, attempts to extract the main content area, removing navigation bars, headers, footers, etc. using heuristics. Should be kept off when extracting details about a single item. | `false` |

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
- `npm run test:watch` - Run tests in watch mode
- `npm run test:cov` - Run tests with coverage report
- `npm run test:local` - Run local development tests with real API calls
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
```

The `-t` flag uses pattern matching, so you can be as specific or general as needed to select the tests you want to run.

## License

MIT
