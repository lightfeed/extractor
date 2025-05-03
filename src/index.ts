import { z } from "zod";
import { htmlToMarkdown } from "./converters";
import { extractWithLLM } from "./extractors";
import {
  ContentFormat,
  LLMProvider,
  ExtractorOptions,
  ExtractorResult,
  Usage,
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

  // Get model name (use defaults if not provided)
  const modelName = options.modelName ?? DEFAULT_MODELS[provider];

  // Convert HTML to markdown if needed
  let content = options.content;
  let originalFormat = options.format;

  if (options.format === ContentFormat.HTML) {
    content = htmlToMarkdown(options.content, options.extractionOptions);
    // Keep track that we converted from HTML
    originalFormat = ContentFormat.HTML;
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
    options.format.toString() // Pass the format as a string
  );

  // Return the full result
  return {
    data,
    markdown: content,
    usage,
  };
}

// Re-export types and enums
export * from "./types";

// Utils
export { safeSanitizedParser } from "./utils/schemaUtils";
