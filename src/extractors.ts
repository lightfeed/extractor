import { ChatOpenAI } from "@langchain/openai";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { z } from "zod";
import { LLMProvider, Usage, ContentFormat } from "./types";
import { AIMessage } from "@langchain/core/messages";
import {
  safeSanitizedParser,
  transformSchemaForLLM,
  fixUrlEscapeSequences,
} from "./utils/schemaUtils";
import { jsonrepair } from "jsonrepair";

// Define LLMResult type here since direct import is problematic
interface TokenUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

interface LLMOutput {
  tokenUsage?: TokenUsage;
}

interface LLMResult {
  llmOutput?: LLMOutput;
}

/**
 * Get usage statistics from LLM output
 */
export function getUsage(output: LLMResult): Usage {
  const usage: Usage = {};

  if (output.llmOutput && output.llmOutput.tokenUsage) {
    usage.inputTokens = output.llmOutput.tokenUsage.promptTokens;
    usage.outputTokens = output.llmOutput.tokenUsage.completionTokens;
  }

  return usage;
}

/**
 * Create LLM instance based on provider and configuration
 */
export function createLLM(
  provider: LLMProvider,
  modelName: string,
  apiKey: string,
  temperature: number = 0
) {
  switch (provider) {
    case LLMProvider.OPENAI:
      return new ChatOpenAI({
        apiKey,
        modelName,
        temperature,
      });

    case LLMProvider.GOOGLE_GEMINI:
      return new ChatGoogleGenerativeAI({
        apiKey,
        model: modelName,
        temperature,
      });

    default:
      throw new Error(`Unsupported LLM provider: ${provider}`);
  }
}

interface ExtractionPromptOptions {
  format: string;
  content: string;
  customPrompt?: string;
  extractionContext?: Record<string, any>;
}

interface TruncateContentOptions extends ExtractionPromptOptions {
  maxTokens: number;
}

/**
 * Generate the extraction prompt with or without a custom query
 */
export function generateExtractionPrompt({
  format,
  content,
  customPrompt,
  extractionContext,
}: ExtractionPromptOptions): string {
  // Base prompt structure that's shared between default and custom prompts
  const extractionTask = customPrompt
    ? `${customPrompt}`
    : "Please extract structured information from the provided content.";

  // If extractionContext is provided, include it in the prompt for additional context
  let promptTemplate = `Content information is below:
------
Format: ${format}
---
${content}
------

`;

  if (extractionContext) {
    promptTemplate += `Extraction context:
---
${JSON.stringify(extractionContext, null, 2)}
------

You are a data extraction assistant that extracts structured information from the above content and context.

Your task is: ${extractionTask}

## Guidelines:
1. Extract ONLY information explicitly stated in the content or provided in the extraction context
2. If the extraction context contains partial data objects, enrich and update them with information from the content, overriding existing values when better information is available
3. If the extraction context contains metadata (URLs, locations, etc.), use it to enhance your understanding and extraction
4. Do not make assumptions or infer missing data beyond what's provided
5. Leave fields empty when information is not present or you are uncertain
6. Follow the required schema exactly

`;
  } else {
    promptTemplate += `You are a data extraction assistant that extracts structured information from the above content.

Your task is: ${extractionTask}

## Guidelines:
1. Extract ONLY information explicitly stated in the content
2. Do not make assumptions or infer missing data
3. Leave fields empty when information is not present or you are uncertain
4. Do not include information that appears incomplete or truncated
5. Follow the required schema exactly

`;
  }

  promptTemplate += `Return only the structured data in valid JSON format and nothing else.`;

  return promptTemplate;
}

/**
 * Truncate content to fit within token limit
 * Uses a rough conversion of 4 characters per token
 */
export function truncateContent({
  format,
  content,
  customPrompt,
  extractionContext,
  maxTokens,
}: TruncateContentOptions): string {
  const maxChars = maxTokens * 4;

  // First generate the full prompt
  const fullPrompt = generateExtractionPrompt({
    format,
    content,
    customPrompt,
    extractionContext,
  });

  // If the full prompt is within limits, return original content
  if (fullPrompt.length <= maxChars) {
    return content;
  }

  // Calculate how much we need to reduce the content
  const excessChars = fullPrompt.length - maxChars;

  // Truncate content by the excess amount
  return content.slice(0, content.length - excessChars);
}

/**
 * Extract structured data from markdown using an LLM
 */
export async function extractWithLLM<T extends z.ZodTypeAny>(
  content: string,
  schema: T,
  provider: LLMProvider,
  modelName: string,
  apiKey: string,
  temperature: number = 0,
  customPrompt?: string,
  format: string = ContentFormat.MARKDOWN,
  maxInputTokens?: number,
  extractionContext?: Record<string, any>
): Promise<{ data: z.infer<T>; usage: Usage }> {
  const llm = createLLM(provider, modelName, apiKey, temperature);
  let usage: Usage = {};

  // Truncate content if maxInputTokens is specified
  const truncatedContent = maxInputTokens
    ? truncateContent({
        format,
        content,
        customPrompt,
        extractionContext,
        maxTokens: maxInputTokens,
      })
    : content;

  // Generate the prompt using the unified template function
  const prompt = generateExtractionPrompt({
    format,
    content: truncatedContent,
    customPrompt,
    extractionContext,
  });

  try {
    // Transform schema to be compatible with LLM output (converting url() to string())
    const llmSchema = transformSchemaForLLM(schema);

    // Extract structured data with a withStructuredOutput chain
    const structuredOutputLLM = llm.withStructuredOutput(llmSchema, {
      includeRaw: true,
    });

    // Create a callback handler for usage tracking
    const callbacks = [
      {
        handleLLMEnd: (output: any) => {
          usage = getUsage(output);
        },
      },
    ];

    // Invoke the LLM with callbacks to track usage
    const response = await structuredOutputLLM.invoke(prompt, { callbacks });
    const raw = response.raw as AIMessage;

    let data = response.parsed;

    // If structured output is not successful, try to parse the raw object.
    if (data == null) {
      // Note: this only works for OpenAI models.
      if (raw.tool_calls && raw.tool_calls.length > 0) {
        // This is the raw object in JSON mode before structured output tool call.
        const rawObject = raw.tool_calls[0].args;
        // Manually sanitize the object and remove any unsafe but optional fields or unsafe items in arrays.
        data = safeSanitizedParser(llmSchema, rawObject);
      }

      // Note: this only works for Google Gemini models.
      if (raw.lc_kwargs && raw.lc_kwargs.content) {
        // Gemini does not return a JSON object, it returns a string that is a JSON object.
        // We use jsonrepair to fix the JSON string and then parse it.
        const rawJson = raw.lc_kwargs.content;
        const rawObject = JSON.parse(jsonrepair(rawJson));
        data = safeSanitizedParser(llmSchema, rawObject);
      }
      if (data == null) {
        throw new Error("No valid data was extracted");
      }
    }

    // If structured output worked, we still need to fix URL escape sequences
    // and validate against the original schema
    const fixedData = fixUrlEscapeSequences(data, schema);
    const validatedData = safeSanitizedParser(schema, fixedData);
    // If validation fails, something went wrong with the URL validation
    if (validatedData === null) {
      throw new Error(
        "Extracted data failed validation against original schema"
      );
    }

    data = validatedData;

    // Return the parsed data and usage statistics
    return {
      data,
      usage,
    };
  } catch (error) {
    console.error("Error during LLM extraction:", error);
    throw error;
  }
}
