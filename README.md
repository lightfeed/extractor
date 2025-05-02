# lightfeed-extract

A TypeScript/Node.js library for extracting structured data from HTML or markdown content using LLMs.

## Features

- Convert HTML to markdown using Turndown
- Extract structured data using OpenAI or Google Gemini models
- Define your extraction schema using Zod
- Track token usage statistics
- Option to extract only the main content from HTML

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
    modelName: 'gpt-4o',
    temperature: 0.2
  });

  console.log('Extracted Data:', result.data);
  console.log('Token Usage:', result.usage);
}

main().catch(console.error);
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
| `content` | `string` | HTML or markdown content to extract from | Required |
| `format` | `ContentFormat` | Content format (HTML or MARKDOWN) | Required |
| `schema` | `z.ZodTypeAny` | Zod schema defining the structure to extract | Required |
| `provider` | `LLMProvider` | LLM provider (GOOGLE_GEMINI or OPENAI) | `LLMProvider.GOOGLE_GEMINI` |
| `modelName` | `string` | Model name to use | Provider-specific default |
| `googleApiKey` | `string` | Google API key (if using Google Gemini provider) | From env `GOOGLE_API_KEY` |
| `openaiApiKey` | `string` | OpenAI API key (if using OpenAI provider) | From env `OPENAI_API_KEY` |
| `temperature` | `number` | Temperature for the LLM (0-1) | `0` |
| `extractionOptions` | `ContentExtractionOptions` | Options for content extraction | `{}` |

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
# Run all local tests
npm run test:local

# Run specific test type
npm run test:local -- blog
npm run test:local -- product
```

### Testing

The library includes both unit tests and integration tests:

- **Unit tests**: Test individual components without making API calls
- **Integration tests**: Test full extraction pipeline with real API calls

Integration tests require valid API keys to be provided in your `.env` file or environment variables. Tests will fail if required API keys are not available.

## License

ISC
