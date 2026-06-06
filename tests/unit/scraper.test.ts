import * as fs from "fs";
import * as path from "path";
import { z } from "zod";
import {
  htmlToAnnotatedMarkdown,
  schemaToTypeDescription,
  generateScrapingPrompt,
  generateValidationPrompt,
  executeScrapingCode,
  scrape,
} from "../../src/scraper";

// ── Fixtures ────────────────────────────────────────────────────────

const productListHtml = fs.readFileSync(
  path.resolve(__dirname, "../fixtures/product-list.html"),
  "utf8",
);

const simpleHtml = `
<html>
<head><title>Test Page</title></head>
<body>
  <nav><a href="/home">Home</a></nav>
  <main>
    <h1 class="title">Hello World</h1>
    <p class="intro">This is a test paragraph.</p>
    <a href="/about">About</a>
    <script>alert("bad")</script>
    <style>.x{color:red}</style>
  </main>
</body>
</html>`;

// ── Mock LLM ────────────────────────────────────────────────────────

function createMockLLM(responses: any[]) {
  let callIndex = 0;
  return {
    withStructuredOutput: jest.fn().mockImplementation(() => ({
      invoke: jest.fn().mockImplementation(async () => {
        const resp = responses[callIndex] ?? responses[responses.length - 1];
        callIndex++;
        return {
          parsed: resp,
          raw: { tool_calls: [{ args: resp }] },
        };
      }),
    })),
  };
}

// ── Tests ───────────────────────────────────────────────────────────

describe("scraper", () => {
  describe("htmlToAnnotatedMarkdown", () => {
    it("should produce output with CSS and XPath annotations", () => {
      const result = htmlToAnnotatedMarkdown(productListHtml);
      expect(result).toContain("css=");
      expect(result).toContain("xpath=");
    });

    it("should apply cleanup rules — remove scripts, styles, nav", () => {
      const result = htmlToAnnotatedMarkdown(simpleHtml);
      expect(result).not.toContain("alert");
      expect(result).not.toContain("color:red");
      expect(result).toContain("Hello World");
      expect(result).toContain("test paragraph");
    });

    it("should resolve relative URLs when sourceUrl is provided", () => {
      const html = `<body><a href="/about">About</a></body>`;
      const result = htmlToAnnotatedMarkdown(html, undefined, "https://example.com");
      expect(result).toContain("https://example.com/about");
    });

    it("should not resolve URLs when sourceUrl is not provided", () => {
      const html = `<body><a href="/about">About</a></body>`;
      const result = htmlToAnnotatedMarkdown(html);
      expect(result).toContain("/about");
      expect(result).not.toContain("https://");
    });

    it("should include images when includeImages is true", () => {
      const html = `<body><img src="/logo.png" alt="Logo"></body>`;
      const withImages = htmlToAnnotatedMarkdown(html, { includeImages: true }, "https://example.com");
      const withoutImages = htmlToAnnotatedMarkdown(html, { includeImages: false }, "https://example.com");
      expect(withImages).toContain("Logo");
      expect(withImages).toContain("https://example.com/logo.png");
      expect(withoutImages).not.toContain("logo.png");
    });
  });

  describe("schemaToTypeDescription", () => {
    it("should describe a simple object schema", () => {
      const schema = z.object({
        title: z.string(),
        count: z.number(),
      });
      const desc = schemaToTypeDescription(schema);
      expect(desc).toContain("title: string");
      expect(desc).toContain("count: number");
    });

    it("should describe optional and nullable fields", () => {
      const schema = z.object({
        name: z.string(),
        age: z.number().optional(),
        email: z.string().nullable(),
      });
      const desc = schemaToTypeDescription(schema);
      expect(desc).toContain("name: string");
      expect(desc).toContain("age: number (optional)");
      expect(desc).toContain("email: string (nullable)");
    });

    it("should describe URL fields", () => {
      const schema = z.object({
        link: z.string().url().describe("Product link"),
      });
      const desc = schemaToTypeDescription(schema);
      expect(desc).toContain('string (url) - "Product link"');
    });

    it("should describe nested arrays and objects", () => {
      const schema = z.object({
        products: z.array(
          z.object({
            name: z.string(),
            price: z.number().describe("Current price"),
          }),
        ),
      });
      const desc = schemaToTypeDescription(schema);
      expect(desc).toContain("products: Array<");
      expect(desc).toContain("name: string");
      expect(desc).toContain('price: number - "Current price"');
    });

    it("should include boolean type", () => {
      const schema = z.object({
        inStock: z.boolean(),
      });
      const desc = schemaToTypeDescription(schema);
      expect(desc).toContain("inStock: boolean");
    });

    it("should include descriptions on objects and arrays", () => {
      const schema = z.object({
        items: z.array(z.string()).describe("List of item names"),
      });
      const desc = schemaToTypeDescription(schema);
      expect(desc).toContain('"List of item names"');
    });
  });

  describe("generateScrapingPrompt", () => {
    const annotatedMarkdown = "# Title\n<!-- css=\"h1\" xpath=\"//h1\" -->";
    const schemaDescription = "{ title: string }";

    it("should include annotated content and schema description", () => {
      const prompt = generateScrapingPrompt({ annotatedMarkdown, schemaDescription });
      expect(prompt).toContain(annotatedMarkdown);
      expect(prompt).toContain(schemaDescription);
      expect(prompt).toContain("scrape");
      expect(prompt).toContain("document");
    });

    it("should not give preference to CSS or XPath", () => {
      const prompt = generateScrapingPrompt({ annotatedMarkdown, schemaDescription });
      expect(prompt).toContain("CSS selectors or XPath");
      expect(prompt).not.toMatch(/prefer\s+css/i);
      expect(prompt).not.toMatch(/prefer\s+xpath/i);
    });

    it("should include custom prompt when provided", () => {
      const prompt = generateScrapingPrompt({
        annotatedMarkdown,
        schemaDescription,
        customPrompt: "Focus on extracting product prices",
      });
      expect(prompt).toContain("Focus on extracting product prices");
    });

    it("should include previous code and error on retry iterations", () => {
      const prompt = generateScrapingPrompt({
        annotatedMarkdown,
        schemaDescription,
        previousCode: "function scrape(doc) { return {}; }",
        previousError: "Schema validation failed: title is required",
      });
      expect(prompt).toContain("Previous scraping code");
      expect(prompt).toContain("function scrape(doc) { return {}; }");
      expect(prompt).toContain("Schema validation failed: title is required");
    });
  });

  describe("generateValidationPrompt", () => {
    it("should include annotated content, schema, and extracted data", () => {
      const prompt = generateValidationPrompt({
        annotatedMarkdown: "# Title\n<!-- css=\"h1\" -->",
        schemaDescription: "{ title: string }",
        extractedData: { title: "Hello" },
      });
      expect(prompt).toContain("# Title");
      expect(prompt).toContain("{ title: string }");
      expect(prompt).toContain('"title": "Hello"');
    });
  });

  describe("executeScrapingCode", () => {
    it("should execute valid scraping code and return data", () => {
      const code = `function scrape(document) {
        return { title: document.querySelector("h1").textContent };
      }`;
      const html = "<html><body><h1>Hello</h1></body></html>";
      const { result, error } = executeScrapingCode(code, html);
      expect(error).toBeNull();
      expect(result).toEqual({ title: "Hello" });
    });

    it("should return error for broken code", () => {
      const code = `function scrape(document) {
        return document.querySelector("h1").nonExistentMethod();
      }`;
      const html = "<html><body><h1>Hello</h1></body></html>";
      const { result, error } = executeScrapingCode(code, html);
      expect(error).not.toBeNull();
      expect(error).toContain("is not a function");
    });

    it("should return error for syntax errors", () => {
      const code = `function scrape(document { return {}; }`;
      const html = "<html><body></body></html>";
      const { error } = executeScrapingCode(code, html);
      expect(error).not.toBeNull();
    });

    it("should handle complex scraping with type conversion", () => {
      const code = `function scrape(document) {
        const items = document.querySelectorAll(".item");
        const products = [];
        items.forEach(function(el) {
          products.push({
            name: el.querySelector(".name").textContent.trim(),
            price: parseFloat(el.querySelector(".price").textContent.replace("$", "")),
          });
        });
        return { products: products };
      }`;
      const html = `<html><body>
        <div class="item"><span class="name">Widget</span><span class="price">$9.99</span></div>
        <div class="item"><span class="name">Gadget</span><span class="price">$19.50</span></div>
      </body></html>`;
      const { result, error } = executeScrapingCode(code, html);
      expect(error).toBeNull();
      expect(result).toEqual({
        products: [
          { name: "Widget", price: 9.99 },
          { name: "Gadget", price: 19.5 },
        ],
      });
    });

    it("should resolve relative URLs when sourceUrl is provided", () => {
      const code = `function scrape(document) {
        return { url: document.querySelector("a").href };
      }`;
      const html = '<html><body><a href="/about">About</a></body></html>';
      const { result, error } = executeScrapingCode(code, html, "https://example.com");
      expect(error).toBeNull();
      expect(result).toEqual({ url: "https://example.com/about" });
    });

    it("should provide NodeFilter and XPathResult for XPath code", () => {
      const code = `function scrape(document) {
        var result = document.evaluate("//h1", document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
        return { title: result.singleNodeValue.textContent };
      }`;
      const html = "<html><body><h1>Hello XPath</h1></body></html>";
      const { result, error } = executeScrapingCode(code, html);
      expect(error).toBeNull();
      expect(result).toEqual({ title: "Hello XPath" });
    });
  });

  describe("scrape()", () => {
    const schema = z.object({
      title: z.string(),
      price: z.number(),
    });

    const testHtml = `<html><body>
      <h1 class="title">Widget Pro</h1>
      <span class="price">$29.99</span>
    </body></html>`;

    it("should return code and data on successful first iteration", async () => {
      const goodCode = `function scrape(document) {
        return {
          title: document.querySelector("h1").textContent.trim(),
          price: parseFloat(document.querySelector(".price").textContent.replace("$", "")),
        };
      }`;

      const llm = createMockLLM([
        { code: goodCode },
        { isValid: true },
      ]);

      const result = await scrape({
        llm: llm as any,
        content: testHtml,
        schema,
        sourceUrl: "https://example.com",
      });

      expect(result.code).toBe(goodCode);
      expect(result.data).toEqual({ title: "Widget Pro", price: 29.99 });
      expect(result.processedContent).toBeDefined();
      expect(result.processedContent.length).toBeGreaterThan(0);
    });

    it("should retry when first code has execution errors", async () => {
      const badCode = `function scrape(document) { throw new Error("oops"); }`;
      const goodCode = `function scrape(document) {
        return {
          title: document.querySelector("h1").textContent.trim(),
          price: parseFloat(document.querySelector(".price").textContent.replace("$", "")),
        };
      }`;

      const llm = createMockLLM([
        { code: badCode },
        { code: goodCode },
        { isValid: true },
      ]);

      const result = await scrape({
        llm: llm as any,
        content: testHtml,
        schema,
        sourceUrl: "https://example.com",
        maxIterations: 3,
      });

      expect(result.data).toEqual({ title: "Widget Pro", price: 29.99 });
      // Should have called withStructuredOutput at least 3 times (bad code, good code, validation)
      expect(llm.withStructuredOutput).toHaveBeenCalledTimes(3);
    });

    it("should retry when schema validation fails", async () => {
      const badSchemaCode = `function scrape(document) {
        return { title: "Widget Pro", price: "not a number" };
      }`;
      const goodCode = `function scrape(document) {
        return {
          title: document.querySelector("h1").textContent.trim(),
          price: parseFloat(document.querySelector(".price").textContent.replace("$", "")),
        };
      }`;

      const llm = createMockLLM([
        { code: badSchemaCode },
        { code: goodCode },
        { isValid: true },
      ]);

      const result = await scrape({
        llm: llm as any,
        content: testHtml,
        schema,
        sourceUrl: "https://example.com",
        maxIterations: 3,
      });

      expect(result.data).toEqual({ title: "Widget Pro", price: 29.99 });
    });

    it("should retry when LLM validation fails", async () => {
      const partialCode = `function scrape(document) {
        return { title: "Wrong Title", price: 0 };
      }`;
      const goodCode = `function scrape(document) {
        return {
          title: document.querySelector("h1").textContent.trim(),
          price: parseFloat(document.querySelector(".price").textContent.replace("$", "")),
        };
      }`;

      const llm = createMockLLM([
        { code: partialCode },
        { isValid: false, issues: "Title does not match content, price is 0" },
        { code: goodCode },
        { isValid: true },
      ]);

      const result = await scrape({
        llm: llm as any,
        content: testHtml,
        schema,
        sourceUrl: "https://example.com",
        maxIterations: 3,
      });

      expect(result.data).toEqual({ title: "Widget Pro", price: 29.99 });
    });

    it("should throw after maxIterations is exhausted", async () => {
      const badCode = `function scrape(document) { throw new Error("oops"); }`;

      const llm = createMockLLM([{ code: badCode }]);

      await expect(
        scrape({
          llm: llm as any,
          content: testHtml,
          schema,
          sourceUrl: "https://example.com",
          maxIterations: 2,
        }),
      ).rejects.toThrow("did not converge after 2 iterations");
    });

    it("should use default maxIterations of 3", async () => {
      const badCode = `function scrape(document) { throw new Error("oops"); }`;

      const llm = createMockLLM([{ code: badCode }]);

      await expect(
        scrape({
          llm: llm as any,
          content: testHtml,
          schema,
          sourceUrl: "https://example.com",
        }),
      ).rejects.toThrow("did not converge after 3 iterations");
    });
  });
});
