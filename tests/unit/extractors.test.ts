import { getUsage, createLLM } from "../../src/extractors";
import { LLMProvider } from "../../src/types";

describe("Extractors", () => {
  describe("getUsage", () => {
    test("should extract usage statistics from LLM output", () => {
      const mockOutput = {
        llmOutput: {
          tokenUsage: {
            promptTokens: 100,
            completionTokens: 50,
            totalTokens: 150,
          },
        },
      };

      const usage = getUsage(mockOutput);

      expect(usage.inputTokens).toBe(100);
      expect(usage.outputTokens).toBe(50);
    });

    test("should handle missing token usage", () => {
      const mockOutput = {
        llmOutput: {},
      };

      const usage = getUsage(mockOutput);

      expect(usage.inputTokens).toBeUndefined();
      expect(usage.outputTokens).toBeUndefined();
    });

    test("should handle missing llmOutput", () => {
      const mockOutput = {};

      const usage = getUsage(mockOutput);

      expect(usage.inputTokens).toBeUndefined();
      expect(usage.outputTokens).toBeUndefined();
    });
  });

  describe("createLLM", () => {
    // These tests check the instantiation but not the actual API calls
    // since we don't want to make real API calls in unit tests

    test("should create ChatOpenAI instance for OPENAI provider", () => {
      const llm = createLLM(
        LLMProvider.OPENAI,
        "gpt-4o-mini",
        "fake-api-key",
        0
      );

      expect(llm).toBeDefined();
      expect(llm.constructor.name).toBe("ChatOpenAI");
    });

    test("should create ChatGoogleGenerativeAI instance for GOOGLE_GEMINI provider", () => {
      const llm = createLLM(
        LLMProvider.GOOGLE_GEMINI,
        "gemini-2.5-flash-preview-04-17",
        "fake-api-key",
        0
      );

      expect(llm).toBeDefined();
      expect(llm.constructor.name).toBe("ChatGoogleGenerativeAI");
    });

    test("should throw error for unsupported provider", () => {
      expect(() => {
        // @ts-ignore - Testing invalid provider
        createLLM("unsupported-provider", "model", "api-key", 0);
      }).toThrow("Unsupported LLM provider");
    });
  });

  // Note: We're not testing extractWithLLM here as it would require actual API calls
  // Those should be in integration tests with API key checks
});
