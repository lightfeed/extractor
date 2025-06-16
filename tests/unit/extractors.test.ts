import {
  getUsage,
  createLLM,
  extractWithLLM,
  truncateContent,
  generateExtractionPrompt,
} from "../../src/extractors";
import { LLMProvider, ContentFormat } from "../../src/types";
import { z } from "zod";

// Mock the LLM providers
jest.mock("@langchain/openai", () => ({
  ChatOpenAI: jest.fn().mockImplementation(() => ({
    constructor: { name: "ChatOpenAI" },
    withStructuredOutput: jest.fn().mockImplementation(() => ({
      invoke: jest.fn().mockResolvedValue({
        parsed: { title: "Test Title", content: "Test Content" },
        raw: {
          tool_calls: [
            {
              args: { title: "Test Title", content: "Test Content" },
            },
          ],
        },
      }),
    })),
  })),
}));

jest.mock("@langchain/google-genai", () => ({
  ChatGoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    constructor: { name: "ChatGoogleGenerativeAI" },
    withStructuredOutput: jest.fn().mockImplementation(() => ({
      invoke: jest.fn().mockResolvedValue({
        parsed: { title: "Test Title", content: "Test Content" },
        raw: {
          lc_kwargs: {
            content: '{"title":"Test Title","content":"Test Content"}',
          },
        },
      }),
    })),
  })),
}));

describe("extractors", () => {
  const mockSchema = z.object({
    title: z.string(),
    content: z.string(),
  });

  const mockContent = "Test content";
  const mockApiKey = "test-api-key";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getUsage", () => {
    it("should extract usage statistics from LLM output", () => {
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

    it("should handle missing token usage", () => {
      const mockOutput = {
        llmOutput: {},
      };

      const usage = getUsage(mockOutput);

      expect(usage.inputTokens).toBeUndefined();
      expect(usage.outputTokens).toBeUndefined();
    });

    it("should handle missing llmOutput", () => {
      const mockOutput = {};

      const usage = getUsage(mockOutput);

      expect(usage.inputTokens).toBeUndefined();
      expect(usage.outputTokens).toBeUndefined();
    });
  });

  describe("createLLM", () => {
    it("should create ChatOpenAI instance for OPENAI provider", () => {
      const llm = createLLM(
        LLMProvider.OPENAI,
        "gpt-4o-mini",
        "fake-api-key",
        0
      );

      expect(llm).toBeDefined();
      expect(llm.constructor.name).toBe("ChatOpenAI");
    });

    it("should create ChatGoogleGenerativeAI instance for GOOGLE_GEMINI provider", () => {
      const llm = createLLM(
        LLMProvider.GOOGLE_GEMINI,
        "gemini-2.5-flash-preview-04-17",
        "fake-api-key",
        0
      );

      expect(llm).toBeDefined();
      expect(llm.constructor.name).toBe("ChatGoogleGenerativeAI");
    });

    it("should throw error for unsupported provider", () => {
      expect(() => {
        // @ts-ignore - Testing invalid provider
        createLLM("unsupported-provider", "model", "api-key", 0);
      }).toThrow("Unsupported LLM provider");
    });
  });

  describe("extractWithLLM", () => {
    it("should extract data using OpenAI", async () => {
      const result = await extractWithLLM(
        mockContent,
        mockSchema,
        LLMProvider.OPENAI,
        "gpt-4o-mini",
        mockApiKey
      );

      expect(result.data).toEqual({
        title: "Test Title",
        content: "Test Content",
      });
    });

    it("should extract data using Google Gemini", async () => {
      const result = await extractWithLLM(
        mockContent,
        mockSchema,
        LLMProvider.GOOGLE_GEMINI,
        "gemini-2.5-flash-preview-04-17",
        mockApiKey
      );

      expect(result.data).toEqual({
        title: "Test Title",
        content: "Test Content",
      });
    });

    it("should handle custom prompts", async () => {
      const customPrompt = "Extract the main topic and summary";
      const result = await extractWithLLM(
        mockContent,
        mockSchema,
        LLMProvider.OPENAI,
        "gpt-4o-mini",
        mockApiKey,
        0,
        customPrompt
      );

      expect(result.data).toEqual({
        title: "Test Title",
        content: "Test Content",
      });
    });

    it("should handle different content formats", async () => {
      const result = await extractWithLLM(
        mockContent,
        mockSchema,
        LLMProvider.OPENAI,
        "gpt-4o-mini",
        mockApiKey,
        0,
        undefined,
        ContentFormat.TXT
      );

      expect(result.data).toEqual({
        title: "Test Title",
        content: "Test Content",
      });
    });

    it("should handle extraction context", async () => {
      const extractionContext = {
        title: "Existing Title",
        content: "", // Empty field that should be filled
      };

      const result = await extractWithLLM(
        mockContent,
        mockSchema,
        LLMProvider.OPENAI,
        "gpt-4o-mini",
        mockApiKey,
        0,
        undefined,
        ContentFormat.TXT,
        undefined,
        extractionContext
      );

      expect(result.data).toEqual({
        title: "Test Title",
        content: "Test Content",
      });
    });
  });

  describe("truncateContent", () => {
    it("should not truncate content when full prompt is within limit", () => {
      const prompt = generateExtractionPrompt({
        format: ContentFormat.TXT,
        content: "",
      });
      const content = "This is a short test content.";
      const result = truncateContent({
        content,
        maxTokens: (prompt.length + content.length) / 4,
        format: ContentFormat.TXT,
      });
      expect(result).toBe(content);
    });

    it("should truncate content by excess amount", () => {
      const prompt = generateExtractionPrompt({
        format: ContentFormat.TXT,
        content: "",
      });
      // Create a content that will make the full prompt exceed the limit
      const content = "This is a longer test content that should be truncated.";
      const result = truncateContent({
        content,
        maxTokens: (prompt.length + content.length) / 4 - 1,
        format: ContentFormat.TXT,
      });
      expect(result.length).toBe(content.length - 4);
    });

    it("should account for extractionContext in prompt size calculation", () => {
      const prompt = generateExtractionPrompt({
        format: ContentFormat.TXT,
        content: "",
        extractionContext: { a: 1, b: 2 },
      });

      const content = "This is a test content for enrichment.";
      const result = truncateContent({
        content,
        maxTokens: (prompt.length + content.length) / 4 - 1,
        format: ContentFormat.TXT,
        extractionContext: { a: 1, b: 2 },
      });

      expect(result.length).toBe(content.length - 4);
    });
  });

  describe("generateExtractionPrompt", () => {
    it("should generate a basic extraction prompt without extractionContext", () => {
      const prompt = generateExtractionPrompt({
        format: ContentFormat.TXT,
        content: "Some test content",
      });

      expect(prompt).toContain("Context information is below:");
      expect(prompt).toContain("Format: txt");
      expect(prompt).toContain("Some test content");
      expect(prompt).toContain("You are a data extraction assistant");
      expect(prompt).toContain(
        "Extract ONLY information explicitly stated in the context"
      );
      expect(prompt).not.toContain("Additional context data");
      expect(prompt).toContain(
        "Return only the structured data in valid JSON format"
      );
    });

    it("should generate a context-aware prompt with extractionContext", () => {
      const extractionContext = {
        title: "Existing Title",
        author: "",
        tags: ["existing"],
      };

      const prompt = generateExtractionPrompt({
        format: ContentFormat.MARKDOWN,
        content: "Some markdown content",
        extractionContext,
      });

      expect(prompt).toContain("Context information is below:");
      expect(prompt).toContain("Format: markdown");
      expect(prompt).toContain("Some markdown content");
      expect(prompt).toContain("Additional context data");
      expect(prompt).toContain(JSON.stringify(extractionContext, null, 2));
      expect(prompt).toContain(
        "You are a data extraction assistant that extracts structured information from the above context in markdown format"
      );
      expect(prompt).toContain(
        "Use the additional context data to improve extraction accuracy when relevant"
      );
      expect(prompt).toContain(
        "Return only the structured data in valid JSON format"
      );
    });

    it("should include custom prompt in the instructions", () => {
      const customPrompt = "Extract only product information and prices";
      const extractionContext = { products: [] };

      const prompt = generateExtractionPrompt({
        format: ContentFormat.HTML,
        content: "<div>Product content</div>",
        customPrompt,
        extractionContext,
      });

      expect(prompt).toContain(customPrompt);
      expect(prompt).toContain("Additional context data");
      expect(prompt).toContain(JSON.stringify(extractionContext, null, 2));
    });
  });
});
