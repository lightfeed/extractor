import { z } from "zod";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";

/**
 * Represents the format of the input content
 */
export enum ContentFormat {
  HTML = "html",
  MARKDOWN = "markdown",
  TXT = "txt",
}

/**
 * Options for HTML content processing
 */
export interface HTMLExtractionOptions {
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

  /**
   * When enabled, removes tracking parameters and unnecessary URL components to clean up links.
   * Currently supports cleaning Amazon product URLs by removing /ref= parameters and everything after.
   * This helps produce cleaner, more readable URLs in the markdown output.
   *
   * Disabled by default to preserve original URLs.
   */
  cleanUrls?: boolean;
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

  /**
   * A LangChain chat model instance to use for extraction.
   * Accepts any LangChain chat model (ChatOpenAI, ChatAnthropic, ChatGoogleGenerativeAI, etc.).
   *
   * @example
   * ```typescript
   * import { ChatOpenAI } from "@langchain/openai";
   * const llm = new ChatOpenAI({ model: "gpt-4.1-mini" });
   * const result = await extract({ llm, content, format, schema });
   * ```
   */
  llm: BaseChatModel;

  /** HTML-specific extraction options (only applies when format is HTML) */
  htmlExtractionOptions?: HTMLExtractionOptions;

  /** Custom prompt for extraction (if not provided, a default prompt will be used) */
  prompt?: string;

  /** URL of the HTML content, required when format is HTML to properly handle relative URLs */
  sourceUrl?: string;

  /** Maximum number of input tokens to send to the LLM. Uses a rough conversion of 4 characters per token. */
  maxInputTokens?: number;

  /**
   * Extraction context that provides additional information for the extraction process. This can include:
   * - Partial data objects to be enriched with information from the content
   * - Metadata like website URL, user location, access timestamp
   * - Domain-specific knowledge or constraints
   * - Any other contextual information relevant to the extraction task
   * When provided, the LLM will consider this context alongside the content for more accurate extraction.
   */
  extractionContext?: Record<string, any>;
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

  /**
   * Processed content that was sent to the LLM.
   * This will be markdown if the input was HTML (after conversion),
   * or the original content if the input was already markdown or plain text.
   */
  processedContent: string;

  /** Usage statistics */
  usage: Usage;
}

/**
 * Options for the scrape function (Beta)
 *
 * Generates reusable scraping code from HTML using CSS selector and XPath annotations,
 * then validates it by executing against the page and confirming with the LLM.
 */
export interface ScrapeOptions<T extends z.ZodTypeAny> {
  /** HTML content to generate scraping code for */
  content: string;

  /** Zod schema defining the structure to extract */
  schema: T;

  /**
   * A LangChain chat model instance. Recommend using advanced models for this mode
   * (e.g. gpt-4.1, gemini-2.5-pro) since it requires generating and reasoning about code.
   */
  llm: BaseChatModel;

  /** URL of the HTML content, required to properly handle relative URLs */
  sourceUrl: string;

  /** HTML-specific extraction options */
  htmlExtractionOptions?: HTMLExtractionOptions;

  /** Custom prompt to guide the scraping code generation */
  prompt?: string;

  /** Maximum number of input tokens to send to the LLM. Uses a rough conversion of 4 characters per token. */
  maxInputTokens?: number;

  /**
   * Maximum number of generate-execute-validate iterations.
   * Each iteration generates (or refines) scraping code, executes it, and validates the result.
   * @default 3
   */
  maxIterations?: number;

  /**
   * Enable debug mode to write intermediate artifacts to disk.
   * - `true` — writes to `./scrape-debug-<timestamp>/`
   * - A string path — writes to that directory
   *
   * Each attempt gets a sub-folder with the generated code, execution result/error,
   * validation feedback, etc.  The annotated markdown is written once at the top level.
   */
  debug?: boolean | string;
}

/**
 * Result of the scrape function (Beta)
 */
export interface ScrapeResult<T> {
  /** Generated JavaScript scraping function code */
  code: string;

  /** Extracted data from executing the scraping code against the HTML */
  data: T;

  /**
   * Annotated markdown (with CSS selector and XPath annotations) that was sent to the LLM.
   */
  processedContent: string;

  /** Accumulated usage statistics across all iterations */
  usage: Usage;
}
