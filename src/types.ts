import { z } from "zod";

/**
 * Represents the format of the input content
 */
export enum ContentFormat {
  HTML = "html",
  MARKDOWN = "markdown",
  TXT = "txt",
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

  /**
   * When enabled, images in the HTML will be included in the markdown output.
   * By default, images are excluded to simplify the extraction process.
   *
   * Enable this option when you need to extract image information or URLs.
   */
  includeImages?: boolean;
}

/**
 * Options for the extractor
 */
export interface ExtractorOptions<T extends z.ZodTypeAny> {
  /** Content to extract from (HTML, Markdown, or plain text) */
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

  /** Custom prompt for extraction (if not provided, a default prompt will be used) */
  prompt?: string;

  /** URL of the HTML content, required only for HTML format */
  sourceUrl?: string;

  /** Maximum number of input tokens to send to the LLM. Uses a rough conversion of 4 characters per token. */
  maxInputTokens?: number;
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
