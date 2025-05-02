import { ChatOpenAI } from "@langchain/openai";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { z } from "zod";
import { LLMProvider, Usage } from "./types";

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
        callbacks: [
          {
            handleLLMEnd(output: LLMResult) {
              return getUsage(output);
            },
          },
        ],
      });

    case LLMProvider.GOOGLE_GEMINI:
      return new ChatGoogleGenerativeAI({
        apiKey,
        model: modelName,
        temperature,
        callbacks: [
          {
            handleLLMEnd(output: LLMResult) {
              return getUsage(output);
            },
          },
        ],
      });

    default:
      throw new Error(`Unsupported LLM provider: ${provider}`);
  }
}

/**
 * Extract structured data from markdown using an LLM
 */
export async function extractWithLLM<T extends z.ZodTypeAny>(
  markdown: string,
  schema: T,
  provider: LLMProvider,
  modelName: string,
  apiKey: string,
  temperature: number = 0
): Promise<{ data: z.infer<T>; usage: Usage }> {
  const llm = createLLM(provider, modelName, apiKey, temperature);
  let usage: Usage = {};

  // Construct the prompt
  const prompt = `Extract the structured data from the following markdown content according to the provided schema. 
Return only the structured data in valid JSON format and nothing else.

MARKDOWN CONTENT:
${markdown}`;

  // Define callback for usage tracking
  const callbacks = [
    {
      handleLLMEnd(output: LLMResult) {
        usage = getUsage(output);
      },
    },
  ];

  // Extract structured data
  const res = await llm
    .withStructuredOutput(schema, { includeRaw: true })
    .invoke(prompt);

  return {
    data: res,
    usage,
  };
}
