import { z } from "zod";
import { htmlToMarkdown } from "./converters";
import { extractWithLLM } from "./extractors";
import {
  ContentFormat,
  ExtractorOptions,
  ExtractorResult,
  HTMLExtractionOptions,
} from "./types";

/**
 * Extract structured data from HTML, markdown, or plain text content using an LLM
 *
 * @param options Configuration options for extraction
 * @param options.llm A LangChain chat model instance (ChatOpenAI, ChatAnthropic, etc.)
 * @param options.content HTML, markdown, or plain text content to extract from
 * @param options.format Content format (HTML, MARKDOWN, or TXT)
 * @param options.schema Zod schema defining the structure to extract
 * @param options.prompt Custom prompt to guide the extraction process
 * @param options.sourceUrl URL of the HTML content (required for HTML format)
 * @param options.htmlExtractionOptions HTML-specific options for content extraction
 * @param options.maxInputTokens Maximum number of input tokens to send to the LLM
 * @param options.extractionContext Extraction context that provides additional information for the extraction process (partial data, metadata, etc.)
 * @returns The extracted data, original content, and usage statistics
 */
export async function extract<T extends z.ZodTypeAny>(
  options: ExtractorOptions<T>
): Promise<ExtractorResult<z.infer<T>>> {

  // Validate sourceUrl for HTML format
  if (options.format === ContentFormat.HTML && !options.sourceUrl) {
    throw new Error(
      "sourceUrl is required when format is HTML to properly handle relative URLs"
    );
  }

  // Convert HTML to markdown if needed
  let content = options.content;
  let formatToUse = options.format;

  if (options.format === ContentFormat.HTML) {
    content = htmlToMarkdown(
      options.content,
      options.htmlExtractionOptions,
      options.sourceUrl
    );
    formatToUse = ContentFormat.MARKDOWN;
  }

  // Extract structured data using LLM
  const { data, usage } = await extractWithLLM(
    content,
    options.schema,
    options.llm,
    options.prompt,
    formatToUse.toString(),
    options.maxInputTokens,
    options.extractionContext
  );

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

// Scrape mode (Beta)
export { scrape, htmlToAnnotatedMarkdown } from "./scraper";

// Utils
export { safeSanitizedParser } from "./utils/schemaUtils";
