import TurndownService from "turndown";
import { ContentExtractionOptions } from "./types";

/**
 * Extract the main content from an HTML string if requested
 * This is a simple implementation - for production,
 * consider using more advanced algorithms or libraries
 */
function extractMainHtml(html: string): string {
  // This is a simple implementation that looks for common content containers
  // In a real implementation, you would want to use a more sophisticated
  // algorithm or library like Readability
  const mainContentSelectors = [
    "article",
    "main",
    '[role="main"]',
    ".content",
    "#content",
    ".post-content",
    ".article-content",
  ];

  // Check if the selector exists in the HTML
  for (const selector of mainContentSelectors) {
    const regex = new RegExp(
      `<${selector}[^>]*>(.*?)</${selector.replace(/\[.*?\]/g, "")}>`,
      "is"
    );
    const match = html.match(regex);
    if (match && match[1]) {
      return match[1];
    }
  }

  return html; // If no main content found, return the original HTML
}

/**
 * Convert HTML to Markdown
 */
export function htmlToMarkdown(
  html: string,
  options?: ContentExtractionOptions
): string {
  let processedHtml = html;

  // Extract main content if requested
  if (options?.extractMainHtml) {
    processedHtml = extractMainHtml(html);
  }

  // Convert to markdown using turndown
  const turndownService = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    emDelimiter: "*",
  });

  // Add additional rules for better conversion
  turndownService.addRule("preserveImages", {
    filter: "img",
    replacement: function (content, node) {
      const element = node as HTMLElement;
      const alt = element.getAttribute("alt") || "";
      const src = element.getAttribute("src") || "";
      return src ? `![${alt}](${src})` : "";
    },
  });

  return turndownService.turndown(processedHtml);
}
