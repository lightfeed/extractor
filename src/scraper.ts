import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { z, ZodTypeAny, ZodFirstPartyTypeKind } from "zod";
import { Scrapedown } from "@lightfeed/scrapedown";
import { JSDOM } from "jsdom";
import {
  HTMLExtractionOptions,
  ScrapeOptions,
  ScrapeResult,
  Usage,
} from "./types";
import { tidyHtml, addTurndownCleanupRules } from "./converters";
import { getUsage } from "./extractors";
import { jsonrepair } from "jsonrepair";
import * as url from "url";

const cheerio = require("cheerio");

// ── Annotated Markdown ──────────────────────────────────────────────

/**
 * Convert HTML to annotated Markdown using scrapedown.
 *
 * Applies the same Cheerio preprocessing (tidyHtml) as the standard
 * htmlToMarkdown converter, then resolves relative URLs and cleans them
 * in the HTML before passing to scrapedown. Only cleanup/removal Turndown
 * rules are added to scrapedown's service — rendering rules (paragraph,
 * link, image) are NOT added because they would override scrapedown's
 * annotation rules, causing CSS/XPath annotations to be lost.
 */
export function htmlToAnnotatedMarkdown(
  html: string,
  options?: HTMLExtractionOptions,
  sourceUrl?: string,
): string {
  const tidiedHtml = tidyHtml(html, options?.includeImages ?? false);

  // Resolve relative URLs and clean them in the HTML before scrapedown,
  // since we cannot add the rendering Turndown rules that normally do this.
  const resolvedHtml = sourceUrl
    ? resolveRelativeUrls(tidiedHtml, sourceUrl, options?.cleanUrls ?? false)
    : tidiedHtml;

  const sd = new Scrapedown({ selectors: ["css", "xpath"] });

  // Only add cleanup rules — rendering rules would override scrapedown's
  // annotation rules for links, paragraphs, images, etc.
  addTurndownCleanupRules(sd.service, {
    includeImages: options?.includeImages,
  });

  return sd.convert(resolvedHtml).trim();
}

function resolveRelativeUrls(
  html: string,
  sourceUrl: string,
  cleanUrls: boolean,
): string {
  const $ = cheerio.load(html);
  $("a[href]").each(function (this: any) {
    const el = $(this);
    let href = el.attr("href");
    if (
      href &&
      !href.startsWith("http") &&
      !href.startsWith("mailto:") &&
      !href.startsWith("#")
    ) {
      try {
        href = url.resolve(sourceUrl, href);
      } catch {
        // keep original
      }
    }
    if (href && cleanUrls) {
      href = cleanUrlString(href);
    }
    if (href) el.attr("href", href);
  });

  $("img[src]").each(function (this: any) {
    const el = $(this);
    let src = el.attr("src");
    if (src && !src.startsWith("http") && !src.startsWith("data:")) {
      try {
        src = url.resolve(sourceUrl, src);
      } catch {
        // keep original
      }
    }
    if (src && cleanUrls) {
      src = cleanUrlString(src);
    }
    if (src) el.attr("src", src);
  });

  return $("body").html() ?? html;
}

function cleanUrlString(urlString: string): string {
  try {
    const urlObj = new URL(urlString);
    const hostname = urlObj.hostname.toLowerCase();
    if (
      hostname.startsWith("amazon.com") ||
      hostname.startsWith("www.amazon.com") ||
      hostname.startsWith("amazon.ca") ||
      hostname.startsWith("www.amazon.ca")
    ) {
      const refIndex = urlString.indexOf("/ref=");
      if (refIndex !== -1) return urlString.substring(0, refIndex);
    }
    return urlString;
  } catch {
    return urlString;
  }
}

// ── Schema description ──────────────────────────────────────────────

function isZodType(schema: ZodTypeAny, type: ZodFirstPartyTypeKind): boolean {
  return (schema as any)._def?.typeName === type;
}

function hasUrlCheck(schema: ZodTypeAny): boolean {
  if (!isZodType(schema, ZodFirstPartyTypeKind.ZodString)) return false;
  const checks = (schema as any)._def?.checks;
  return Array.isArray(checks) && checks.some((c: any) => c.kind === "url");
}

/**
 * Convert a Zod schema into a human-readable type description for the LLM prompt.
 */
export function schemaToTypeDescription(
  schema: ZodTypeAny,
  indent: number = 0,
): string {
  const pad = "  ".repeat(indent);
  const desc = (schema as any)._def?.description;

  if (isZodType(schema, ZodFirstPartyTypeKind.ZodObject)) {
    const shape = (schema as any).shape;
    const lines: string[] = ["{"];
    for (const [key, propSchema] of Object.entries(shape)) {
      const propDesc = schemaToTypeDescription(
        propSchema as ZodTypeAny,
        indent + 1,
      );
      lines.push(`${pad}  ${key}: ${propDesc}`);
    }
    lines.push(`${pad}}`);
    const result = lines.join("\n");
    return desc ? `${result} - "${desc}"` : result;
  }

  if (isZodType(schema, ZodFirstPartyTypeKind.ZodArray)) {
    const element = (schema as any).element || (schema as any)._def?.type;
    const inner = schemaToTypeDescription(element as ZodTypeAny, indent);
    const result = `Array<${inner}>`;
    return desc ? `${result} - "${desc}"` : result;
  }

  if (isZodType(schema, ZodFirstPartyTypeKind.ZodOptional)) {
    const inner = schemaToTypeDescription(
      (schema as any).unwrap() as ZodTypeAny,
      indent,
    );
    return `${inner} (optional)`;
  }

  if (isZodType(schema, ZodFirstPartyTypeKind.ZodNullable)) {
    const inner = schemaToTypeDescription(
      (schema as any).unwrap() as ZodTypeAny,
      indent,
    );
    return `${inner} (nullable)`;
  }

  if (hasUrlCheck(schema)) {
    return desc ? `string (url) - "${desc}"` : "string (url)";
  }

  if (isZodType(schema, ZodFirstPartyTypeKind.ZodString)) {
    return desc ? `string - "${desc}"` : "string";
  }

  if (isZodType(schema, ZodFirstPartyTypeKind.ZodNumber)) {
    return desc ? `number - "${desc}"` : "number";
  }

  if (isZodType(schema, ZodFirstPartyTypeKind.ZodBoolean)) {
    return desc ? `boolean - "${desc}"` : "boolean";
  }

  return desc ? `unknown - "${desc}"` : "unknown";
}

// ── Prompts ─────────────────────────────────────────────────────────

interface ScrapingPromptOptions {
  annotatedMarkdown: string;
  schemaDescription: string;
  customPrompt?: string;
  previousCode?: string;
  previousError?: string;
}

export function generateScrapingPrompt({
  annotatedMarkdown,
  schemaDescription,
  customPrompt,
  previousCode,
  previousError,
}: ScrapingPromptOptions): string {
  let prompt = `You are a web scraping code generator. You will receive HTML content converted to Markdown with CSS selector and XPath annotations (as HTML comments). Use these annotations to write robust scraping code.

Annotated content:
------
${annotatedMarkdown}
------

Target output schema (with types):
${schemaDescription}

`;

  if (previousCode) {
    prompt += `Previous scraping code that needs fixing:
\`\`\`javascript
${previousCode}
\`\`\`

Issues with the previous code:
${previousError}

`;
  }

  const task = customPrompt
    ? customPrompt
    : "Generate scraping code that extracts the structured data described by the schema above.";

  prompt += `${task}

## Requirements
1. Write a JavaScript function named \`scrape\` that takes a single \`document\` parameter (a DOM Document object).
2. The code will be executed in a jsdom environment and must use standard DOM APIs only (\`document.querySelector\`, \`document.querySelectorAll\`, \`element.textContent\`, \`element.getAttribute()\`, \`element.closest()\`, etc.). These APIs also work in real browsers, making the code reusable.
3. Use CSS selectors or XPath from the annotations — choose whichever is more robust for each field. You are free to use either or both. For XPath, use \`document.evaluate()\`.
4. Handle type conversions based on the schema types:
   - For \`number\` fields: parse numeric values from text (e.g. \`parseFloat()\`, strip currency symbols)
   - For \`boolean\` fields: derive from text or element presence
   - For \`string (url)\` fields: use the DOM property \`element.href\` or \`element.src\` (NOT \`getAttribute\`) — the property returns the absolute URL even when the HTML attribute is relative
   - For arrays: use \`querySelectorAll\` and map over results
5. Return a plain object matching the schema exactly.
6. Handle missing/optional fields gracefully (return \`undefined\` or \`null\` for missing optional fields).
7. The function must be self-contained with no external dependencies.

Return ONLY the function code, no explanation.`;

  return prompt;
}

interface ValidationPromptOptions {
  annotatedMarkdown: string;
  schemaDescription: string;
  extractedData: unknown;
}

export function generateValidationPrompt({
  annotatedMarkdown,
  schemaDescription,
  extractedData,
}: ValidationPromptOptions): string {
  return `You are a data quality reviewer. Verify whether the extracted data accurately represents the content.

Annotated content:
------
${annotatedMarkdown}
------

Target schema:
${schemaDescription}

Extracted data:
${JSON.stringify(extractedData, null, 2)}

Review the extracted data against the content above. Check that:
1. Values are correct and match the content (not fabricated)
2. Required fields are populated
3. Numeric values are properly parsed (not left as strings)
4. URLs are actual links from the content
5. Arrays contain all expected items (no missing entries)

If the data is accurate and complete, mark it as valid. If there are issues, describe them clearly.`;
}

// ── Code execution ──────────────────────────────────────────────────

interface ExecutionResult {
  result: unknown;
  error: string | null;
}

/**
 * Execute the generated scraping code against HTML using jsdom.
 *
 * @param code - The generated scrape(document) function body
 * @param html - Raw HTML to parse
 * @param sourceUrl - Page URL so that element.href resolves relative URLs
 *                    (matches real browser behaviour)
 */
export function executeScrapingCode(
  code: string,
  html: string,
  sourceUrl?: string,
): ExecutionResult {
  try {
    const dom = new JSDOM(html, sourceUrl ? { url: sourceUrl } : undefined);
    const win = dom.window;

    const wrappedCode = `
      ${code}
      return scrape(document);
    `;

    // Expose the window globals that XPath / TreeWalker code commonly needs
    const fn = new Function(
      "document",
      "window",
      "NodeFilter",
      "XPathResult",
      wrappedCode,
    );
    const result = fn(win.document, win, win.NodeFilter, win.XPathResult);

    return { result, error: null };
  } catch (err: any) {
    return { result: null, error: err.message || String(err) };
  }
}

// ── LLM helpers ─────────────────────────────────────────────────────

function accumulateUsage(total: Usage, delta: Usage): void {
  if (delta.inputTokens != null) {
    total.inputTokens = (total.inputTokens ?? 0) + delta.inputTokens;
  }
  if (delta.outputTokens != null) {
    total.outputTokens = (total.outputTokens ?? 0) + delta.outputTokens;
  }
}

const codeGenerationSchema = z.object({
  code: z
    .string()
    .describe(
      "Complete JavaScript function named scrape(document) that extracts data",
    ),
});

const validationSchema = z.object({
  isValid: z
    .boolean()
    .describe("Whether the extracted data is accurate and complete"),
  issues: z
    .string()
    .optional()
    .describe(
      "Description of issues if not valid, with suggestions for fixing the scraping code",
    ),
});

async function callLLM<S extends z.ZodTypeAny>(
  llm: BaseChatModel,
  prompt: string,
  schema: S,
  usage: Usage,
): Promise<z.infer<S>> {
  let callUsage: Usage = {};

  const structured = llm.withStructuredOutput(schema as never, {
    includeRaw: true,
  });
  const callbacks = [
    {
      handleLLMEnd: (output: any) => {
        callUsage = getUsage(output);
      },
    },
  ];

  const response = await structured.invoke(prompt, { callbacks });

  accumulateUsage(usage, callUsage);

  let data = response.parsed;

  if (data == null) {
    // OpenAI fallback
    const raw = response.raw as any;
    if (raw?.tool_calls?.length > 0) {
      try {
        data = schema.parse(raw.tool_calls[0].args);
      } catch {
        // fall through
      }
    }
    // Gemini fallback
    if (data == null && raw?.lc_kwargs?.content) {
      try {
        const repaired = JSON.parse(jsonrepair(raw.lc_kwargs.content));
        data = schema.parse(repaired);
      } catch {
        // fall through
      }
    }
    if (data == null) {
      throw new Error("LLM did not return a valid structured response");
    }
  }

  return data;
}

// ── Main scrape function ────────────────────────────────────────────

/**
 * Generate validated scraping code from HTML using LLM-powered CSS/XPath annotations.
 *
 * @beta This feature is in beta and may change in future releases.
 */
export async function scrape<T extends z.ZodTypeAny>(
  options: ScrapeOptions<T>,
): Promise<ScrapeResult<z.infer<T>>> {
  const {
    content,
    schema,
    llm,
    sourceUrl,
    htmlExtractionOptions,
    prompt: customPrompt,
    maxInputTokens,
    maxIterations = 3,
  } = options;

  // Step 1: Convert HTML to annotated markdown
  const annotatedMarkdown = htmlToAnnotatedMarkdown(
    content,
    htmlExtractionOptions,
    sourceUrl,
  );

  const schemaDescription = schemaToTypeDescription(schema);

  // Optionally truncate the annotated markdown
  let processedContent = annotatedMarkdown;
  if (maxInputTokens) {
    const maxChars = maxInputTokens * 4;
    if (processedContent.length > maxChars) {
      processedContent = processedContent.slice(0, maxChars);
    }
  }

  const usage: Usage = {};
  let previousCode: string | undefined;
  let previousError: string | undefined;
  let lastData: z.infer<T> | undefined;

  // Step 2: Generate-execute-validate loop
  for (let iteration = 0; iteration < maxIterations; iteration++) {
    const attempt = iteration + 1;

    console.log(`[scrape] Attempt ${attempt}/${maxIterations}: generating scraping code...`);

    const codePrompt = generateScrapingPrompt({
      annotatedMarkdown: processedContent,
      schemaDescription,
      customPrompt,
      previousCode,
      previousError,
    });

    let codeResult: z.infer<typeof codeGenerationSchema>;
    try {
      codeResult = await callLLM(llm, codePrompt, codeGenerationSchema, usage);
    } catch (err: any) {
      throw new Error(`Failed to generate scraping code: ${err.message}`);
    }

    const code = codeResult.code;
    console.log(`[scrape] Attempt ${attempt}/${maxIterations}: code generated (${code.length} chars), executing...`);

    // 2b. Execute code against HTML
    const { result: execResult, error: execError } = executeScrapingCode(
      code,
      content,
      sourceUrl,
    );

    if (execError) {
      console.log(`[scrape] Attempt ${attempt}/${maxIterations}: execution failed — ${execError}`);
      previousCode = code;
      previousError = `Execution error: ${execError}`;
      continue;
    }

    console.log(`[scrape] Attempt ${attempt}/${maxIterations}: execution succeeded, validating schema...`);

    // 2c. Validate against Zod schema
    const parseResult = schema.safeParse(execResult);
    if (!parseResult.success) {
      const zodErrors = parseResult.error.issues
        .map((i: any) => `${i.path.join(".")}: ${i.message}`)
        .join("; ");
      console.log(`[scrape] Attempt ${attempt}/${maxIterations}: schema validation failed — ${zodErrors}`);
      previousCode = code;
      previousError = `Schema validation failed: ${zodErrors}\n\nExecution result was:\n${JSON.stringify(execResult, null, 2)}`;
      continue;
    }

    const validatedData = parseResult.data as z.infer<T>;
    lastData = validatedData;

    console.log(`[scrape] Attempt ${attempt}/${maxIterations}: schema valid, asking LLM to verify data quality...`);

    // 2d. LLM validation of result quality
    const validationPrompt = generateValidationPrompt({
      annotatedMarkdown: processedContent,
      schemaDescription,
      extractedData: validatedData,
    });

    let validation: z.infer<typeof validationSchema>;
    try {
      validation = await callLLM(
        llm,
        validationPrompt,
        validationSchema,
        usage,
      );
    } catch {
      console.log(`[scrape] Attempt ${attempt}/${maxIterations}: LLM validation call failed, accepting schema-valid result`);
      return { code, data: validatedData, processedContent, usage };
    }

    if (validation.isValid) {
      console.log(`[scrape] Attempt ${attempt}/${maxIterations}: LLM confirmed data is valid`);
      return { code, data: validatedData, processedContent, usage };
    }

    console.log(`[scrape] Attempt ${attempt}/${maxIterations}: LLM rejected result — ${validation.issues ?? "no details"}`);
    previousCode = code;
    previousError = `LLM validation issues: ${validation.issues ?? "Unknown issues"}\n\nExecution result was:\n${JSON.stringify(validatedData, null, 2)}`;
  }

  console.log(`[scrape] Failed after ${maxIterations} attempts`);
  throw new Error(
    `Scraping code generation did not converge after ${maxIterations} iterations. ` +
      `Last issue: ${previousError ?? "unknown"}`,
  );
}
