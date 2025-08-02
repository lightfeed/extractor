import { z } from "zod";
import type { Browser, LaunchOptions, ConnectOverCDPOptions } from "playwright";

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
 * Proxy configuration for network requests
 */
export interface ProxyConfig {
  host: string;
  port: number;
  auth?: {
    username: string;
    password: string;
  };
}

/**
 * Abstract base class for browser providers
 */
export abstract class BrowserProvider<T = Browser> {
  abstract start(): Promise<T>;
  abstract close(): Promise<void>;
  abstract getSession(): T | null;
}

/**
 * Configuration for local browser provider
 */
export interface LocalBrowserConfig {
  type: "local";
  options?: Omit<Omit<LaunchOptions, "headless">, "channel">;
  headless?: boolean;
  proxy?: ProxyConfig;
}

/**
 * Configuration for serverless browser provider
 */
export interface ServerlessBrowserConfig {
  type: "serverless";
  executablePath: string;
  options?: Omit<
    Omit<Omit<LaunchOptions, "headless">, "channel">,
    "executablePath"
  >;
  headless?: boolean;
  proxy?: ProxyConfig;
}

/**
 * Configuration for remote browser provider
 */
export interface RemoteBrowserConfig {
  type: "remote";
  wsEndpoint: string;
  options?: Omit<ConnectOverCDPOptions, "endpointURL">;
}

/**
 * Union type for all browser configurations
 */
export type BrowserConfig =
  | LocalBrowserConfig
  | ServerlessBrowserConfig
  | RemoteBrowserConfig;

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
