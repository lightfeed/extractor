import { z } from "zod";

/**
 * Represents the format of the input content
 */
export enum ContentFormat {
  HTML = "html",
  MARKDOWN = "markdown",
}

/**
 * Supported LLM providers
 */
export enum LLMProvider {
  OPENAI = "openai",
  GOOGLE_GEMINI = "google_gemini",
}

/**
 * Options for HTML content processing
 */
export interface ContentExtractionOptions {
  /**
   * When enabled, attempts to extract the main content from HTML, removing navigation bars, headers, footers, etc.
   * This uses heuristics to identify the main content area.
   *
   * Should be kept off (false) when extracting specific details about a single item,
   * as it might remove important contextual elements.
   *
   * Only applies to HTML format, not markdown.
   */
  extractMainHtml?: boolean;
}

/**
 * Options for the extractor
 */
export interface ExtractorOptions<T extends z.ZodTypeAny> {
  /** Content to extract from (HTML or Markdown) */
  content: string;

  /** Format of the content */
  format: ContentFormat;

  /** Schema for structured extraction */
  schema: T;

  /** LLM Provider (OpenAI or Google Gemini) */
  provider?: LLMProvider;

  /** Model name to use */
  modelName?: string;

  /** OpenAI API key */
  openaiApiKey?: string;

  /** Google API key */
  googleApiKey?: string;

  /** Temperature for the LLM (0-1), defaults to 0 */
  temperature?: number;

  /** Content extraction options (for HTML) */
  extractionOptions?: ContentExtractionOptions;
}

/**
 * Usage statistics for LLM calls
 */
export interface Usage {
  inputTokens?: number;
  outputTokens?: number;
}

/**
 * Result of the extraction process
 */
export interface ExtractorResult<T> {
  /** Extracted data according to the schema */
  data: T;

  /** Raw markdown content that was processed */
  markdown: string;

  /** Usage statistics */
  usage: Usage;
}
