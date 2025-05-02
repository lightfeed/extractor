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
 * Extract structured data from HTML or markdown content using an LLM
 *
 * @param options Configuration options for extraction
 * @returns The extracted data, original markdown, and usage statistics
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
  let markdown = options.content;
  if (options.format === ContentFormat.HTML) {
    markdown = htmlToMarkdown(options.content, options.extractionOptions);
  }

  // Extract structured data using LLM
  const { data, usage } = await extractWithLLM(
    markdown,
    options.schema,
    provider,
    modelName,
    apiKey,
    options.temperature ?? 0
  );

  // Return the full result
  return {
    data,
    markdown,
    usage,
  };
}

// Re-export types and enums
export * from "./types";
