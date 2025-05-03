import { ChatOpenAI } from "@langchain/openai";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { z } from "zod";
import { LLMProvider, Usage, ContentFormat } from "./types";
import { AIMessage } from "@langchain/core/messages";
import { safeSanitizedParser } from "./utils/schemaUtils";

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

  if (output.llmOutput) {
    if (output.llmOutput.tokenUsage) {
      usage.inputTokens = output.llmOutput.tokenUsage.promptTokens;
      usage.outputTokens = output.llmOutput.tokenUsage.completionTokens;
    }
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

/**
 * Generate the extraction prompt with or without a custom query
 */
function generateExtractionPrompt(
  format: string,
  content: string,
  customPrompt?: string
): string {
  // Base prompt structure that's shared between default and custom prompts
  const extractionTask = customPrompt
    ? `${customPrompt}`
    : "Please extract structured information from the provided context.";

  return `Context information is below:
------
Format: ${format}
---
${content}
------

You are a data extraction assistant that extracts structured information from the abovecontext.
Extract information exactly as presented in the context without adding any extra details or making assumptions.
Only return data that matches the required schema.

Your task is:${extractionTask}

To format your answer:

1. Extract ONLY information explicitly present in the context.
2. It is okay to return null when information is not found.
3. Omit any information that appears incomplete or cut off at the context boundaries.
4. Do not attempt to guess or fill in missing information.
5. Return only the structured data in valid JSON format and nothing else.
`;
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
  format: string = ContentFormat.MARKDOWN
): Promise<{ data: z.infer<T>; usage: Usage }> {
  const llm = createLLM(provider, modelName, apiKey, temperature);
  let usage: Usage = {};

  // Generate the prompt using the unified template function
  const prompt = generateExtractionPrompt(format, content, customPrompt);

  try {
    // Extract structured data with a withStructuredOutput chain
    const structuredOutputLLM = llm.withStructuredOutput(schema, {
      includeRaw: true,
    });

    // Create a callback handler for usage tracking
    const callbacks = [
      {
        handleLLMEnd: (output: any) => {
          if (output?.llmOutput?.tokenUsage) {
            usage = {
              inputTokens: output.llmOutput.tokenUsage.promptTokens,
              outputTokens: output.llmOutput.tokenUsage.completionTokens,
            };
          }
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
        // This is the raw object before structured output tool call.
        const rawObject = raw.tool_calls[0].args;
        // Manually sanitize the object and remove any unsafe but optional fields or unsafe items in arrays.
        data = safeSanitizedParser(schema, rawObject);
      }
      // Note: this only works for Google Gemini models.
      if (raw.lc_kwargs && raw.lc_kwargs.content) {
        const rawObject = JSON.parse(raw.lc_kwargs.content);
        data = safeSanitizedParser(schema, rawObject);
      }
      if (data == null) {
        throw new Error("No valid data was extracted");
      }
    }

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
