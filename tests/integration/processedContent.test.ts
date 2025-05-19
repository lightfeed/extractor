import { z } from "zod";
import { extract, ContentFormat, LLMProvider } from "../../src";

describe("ProcessedContent Integration Tests", () => {
  const simpleSchema = z.object({
    title: z.string(),
    content: z.string().nullable(),
  });

  // Skip tests if API keys are not available
  const skipIfNoKeys = () => {
    if (!process.env.OPENAI_API_KEY) {
      return true;
    }
    return false;
  };

  it("should return original content as processedContent for TXT format", async () => {
    if (skipIfNoKeys()) {
      console.log("Skipping test: No API keys available");
      return;
    }

    const plainTextContent =
      "Title: Simple Test\n\nThis is a test of plain text extraction.";

    const result = await extract({
      content: plainTextContent,
      format: ContentFormat.TXT,
      schema: simpleSchema,
      provider: LLMProvider.OPENAI,
      openaiApiKey: process.env.OPENAI_API_KEY,
    });

    // Verify the processedContent is the same as the original content
    expect(result.processedContent).toBe(plainTextContent);
  }, 60000);

  it("should return original content as processedContent for MARKDOWN format", async () => {
    if (skipIfNoKeys()) {
      console.log("Skipping test: No API keys available");
      return;
    }

    const markdownContent =
      "# Simple Test\n\nThis is a test of markdown extraction.";

    const result = await extract({
      content: markdownContent,
      format: ContentFormat.MARKDOWN,
      schema: simpleSchema,
      provider: LLMProvider.OPENAI,
      openaiApiKey: process.env.OPENAI_API_KEY,
    });

    // Verify the processedContent is the same as the original content
    expect(result.processedContent).toBe(markdownContent);
  }, 60000);

  it("should return converted markdown as processedContent for HTML format", async () => {
    if (skipIfNoKeys()) {
      console.log("Skipping test: No API keys available");
      return;
    }

    const htmlContent =
      "<h1>Simple Test</h1><p>This is a test of HTML extraction.</p>";

    const result = await extract({
      content: htmlContent,
      format: ContentFormat.HTML,
      schema: simpleSchema,
      provider: LLMProvider.OPENAI,
      openaiApiKey: process.env.OPENAI_API_KEY,
      sourceUrl: "https://example.com",
    });

    // For HTML, processedContent should be the converted markdown
    expect(result.processedContent).toContain("Simple Test");
    expect(result.processedContent).toContain(
      "This is a test of HTML extraction."
    );
    expect(result.processedContent).not.toContain("<h1>");
    expect(result.processedContent).not.toContain("</p>");
  }, 60000);
});
