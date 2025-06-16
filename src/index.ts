import { z } from "zod";
import { htmlToMarkdown } from "./converters";
import { extractWithLLM } from "./extractors";
import {
  ContentFormat,
  LLMProvider,
  ExtractorOptions,
  ExtractorResult,
  HTMLExtractionOptions,
} from "./types";

// Default model names
const DEFAULT_MODELS = {
  [LLMProvider.GOOGLE_GEMINI]: "gemini-2.5-flash-preview-04-17",
  [LLMProvider.OPENAI]: "gpt-4o-mini",
};

/**
 * Extract structured data from HTML, markdown, or plain text content using an LLM
 *
 * @param options Configuration options for extraction
 * @param options.content HTML, markdown, or plain text content to extract from
 * @param options.format Content format (HTML, MARKDOWN, or TXT)
 * @param options.schema Zod schema defining the structure to extract
 * @param options.provider LLM provider (GOOGLE_GEMINI or OPENAI)
 * @param options.modelName Model name to use (provider-specific)
 * @param options.googleApiKey Google API key (if using Google Gemini provider)
 * @param options.openaiApiKey OpenAI API key (if using OpenAI provider)
 * @param options.temperature Temperature for the LLM (0-1)
 * @param options.prompt Custom prompt to guide the extraction process
 * @param options.sourceUrl URL of the HTML content (required for HTML format)
 * @param options.htmlExtractionOptions HTML-specific options for content extraction
 * @param options.maxInputTokens Maximum number of input tokens to send to the LLM
 * @param options.extractionContext Additional context data to assist with extraction (partial data, metadata, etc.)
 * @returns The extracted data, original content, and usage statistics
 */
export async function extract<T extends z.ZodTypeAny>(
  options: ExtractorOptions<T>
): Promise<ExtractorResult<z.infer<T>>> {
  // Validate required parameters
  const provider = options.provider ?? LLMProvider.GOOGLE_GEMINI;
  let apiKey: string;

  if (provider === LLMProvider.GOOGLE_GEMINI) {
    apiKey = options.googleApiKey ?? process.env.GOOGLE_API_KEY ?? "";
    if (!apiKey) {
      throw new Error(
        "Google API key is required. Provide googleApiKey option or set GOOGLE_API_KEY environment variable."
      );
    }
  } else if (provider === LLMProvider.OPENAI) {
    apiKey = options.openaiApiKey ?? process.env.OPENAI_API_KEY ?? "";
    if (!apiKey) {
      throw new Error(
        "OpenAI API key is required. Provide openaiApiKey option or set OPENAI_API_KEY environment variable."
      );
    }
  } else {
    throw new Error(`Unsupported LLM provider: ${provider}`);
  }

  // Validate sourceUrl for HTML format
  if (options.format === ContentFormat.HTML && !options.sourceUrl) {
    throw new Error(
      "sourceUrl is required when format is HTML to properly handle relative URLs"
    );
  }

  // Get model name (use defaults if not provided)
  const modelName = options.modelName ?? DEFAULT_MODELS[provider];

  // Convert HTML to markdown if needed
  let content = options.content;
  let formatToUse = options.format;

  if (options.format === ContentFormat.HTML) {
    content = htmlToMarkdown(
      options.content,
      options.htmlExtractionOptions,
      options.sourceUrl
    );
    // For the LLM, the content is now markdown
    formatToUse = ContentFormat.MARKDOWN;
  }

  // Extract structured data using LLM
  const { data, usage } = await extractWithLLM(
    content,
    options.schema,
    provider,
    modelName,
    apiKey,
    options.temperature ?? 0,
    options.prompt,
    formatToUse.toString(), // Pass the correct format based on actual content
    options.maxInputTokens,
    options.extractionContext
  );

  // Return the full result
  return {
    data,
    processedContent: content,
    usage,
  };
}

/**
 * Convert HTML to markdown
 *
 * @param html HTML content to convert
 * @param options HTML extraction options
 * @param sourceUrl Source URL for resolving relative links
 * @returns Markdown content
 */
export function convertHtmlToMarkdown(
  html: string,
  options?: HTMLExtractionOptions,
  sourceUrl?: string
): string {
  return htmlToMarkdown(html, options, sourceUrl);
}

// Re-export types and enums
export * from "./types";

// Utils
export { safeSanitizedParser } from "./utils/schemaUtils";
