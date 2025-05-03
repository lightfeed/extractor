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

// Adapted from https://github.com/adbar/trafilatura/blob/c7e00f3a31e436c7b6ce666b44712e16e30908c0/trafilatura/xpaths.py#L100
// Added:
// - Add contains(@id, "filter") to remove filter menus
// Removed (because user might want to extract them):
// - Commented out tags
// - Commented out author
// - Commented out rating
// - Commented out attachment
// - Commented out timestamp
// - Commented out user-info and user-profile
// - Commented out comment or hidden section
const OVERALL_DISCARD_XPATH = [
  // navigation + footers, news outlets related posts, sharing, jp-post-flair jp-relatedposts
  `.//*[(self::div or self::item or self::list
           or self::p or self::section or self::span)][
  contains(translate(@id, "F","f"), "footer") or contains(translate(@class, "F","f"), "footer")
  or contains(@id, "related") or contains(translate(@class, "R", "r"), "related") or
  contains(@id, "viral") or contains(@class, "viral") or
  contains(@id, "filter") or
  starts-with(@id, "shar") or starts-with(@class, "shar") or
  contains(@class, "share-") or
  contains(translate(@id, "S", "s"), "share") or
  contains(@id, "social") or contains(@class, "social") or contains(@class, "sociable") or
  contains(@id, "syndication") or contains(@class, "syndication") or
  starts-with(@id, "jp-") or starts-with(@id, "dpsp-content") or
  contains(@class, "embedded") or contains(@class, "embed")
  or contains(@id, "newsletter") or contains(@class, "newsletter")
  or contains(@class, "subnav") or
  contains(@id, "cookie") or contains(@class, "cookie") or ` +
    // `contains(@id, "tags") or contains(@class, "tags") or ` +
    `contains(@id, "sidebar") or contains(@class, "sidebar") or ` +
    `contains(@id, "banner") or contains(@class, "banner")
  or contains(@class, "meta") or
  contains(@id, "menu") or contains(@class, "menu") or
  contains(translate(@id, "N", "n"), "nav") or contains(translate(@role, "N", "n"), "nav")
  or starts-with(@class, "nav") or contains(translate(@class, "N", "n"), "navigation") or
  contains(@class, "navbar") or contains(@class, "navbox") or starts-with(@class, "post-nav")
  or contains(@id, "breadcrumb") or contains(@class, "breadcrumb") or
  contains(@id, "bread-crumb") or contains(@class, "bread-crumb") or ` +
    // `contains(@id, "author") or contains(@class, "author") or ` +
    `contains(@id, "button") or contains(@class, "button")
  or contains(translate(@class, "B", "b"), "byline") or ` +
    // contains(@class, "rating") or ` +
    `starts-with(@class, "widget") or ` +
    // contains(@class, "attachment") or contains(@class, "timestamp") or
    // contains(@class, "user-info") or contains(@class, "user-profile") or
    `contains(@class, "-ad-") or contains(@class, "-icon")
  or contains(@class, "article-infos") or
  contains(translate(@class, "I", "i"), "infoline")
  or contains(@data-component, "MostPopularStories")
  or contains(@class, "outbrain") or contains(@class, "taboola")
  or contains(@class, "criteo") or contains(@class, "options")
  or contains(@class, "consent") or contains(@class, "modal-content")
  or contains(@class, "paid-content") or contains(@class, "paidcontent")
  or contains(@id, "premium-") or contains(@id, "paywall")
  or contains(@class, "obfuscated") or contains(@class, "blurred")
  or contains(@class, " ad ")
  or contains(@class, "next-post") or contains(@class, "side-stories")
  or contains(@class, "related-stories") or contains(@class, "most-popular")
  or contains(@class, "mol-factbox") or starts-with(@class, "ZendeskForm")
  or contains(@class, "message-container") or contains(@id, "message_container")
  or contains(@class, "yin") or contains(@class, "zlylin") or
  contains(@class, "xg1") or contains(@id, "bmdh")
  or @data-lp-replacement-content or @data-testid]`,

  // comment debris + hidden parts
  // `.//*[@class="comments-title" or contains(@class, "comments-title") or
  // contains(@class, "nocomments") or starts-with(@id, "reply-") or starts-with(@class, "reply-") or
  // contains(@class, "-reply-") or contains(@class, "message")
  // or contains(@id, "akismet") or contains(@class, "akismet") or
  // starts-with(@class, "hide-") or contains(@class, "hide-print") or contains(@id, "hidden")
  // or contains(@style, "hidden") or contains(@hidden, "hidden") or contains(@class, "noprint")
  // or contains(@style, "display:none") or contains(@class, " hidden") or @aria-hidden="true"
  // or contains(@class, "notloaded")]`,
];

// Adapted from https://github.com/adbar/trafilatura/blob/c7e00f3a31e436c7b6ce666b44712e16e30908c0/trafilatura/xpaths.py#L179
// Removed:
// - contains(@style, "border")
const PRECISION_DISCARD_XPATH = [
  ".//header",
  `.//*[(self::div or self::item or self::list
           or self::p or self::section or self::span)][
      contains(@id, "bottom") or contains(@class, "bottom") or
      contains(@id, "link") or contains(@class, "link")
  ]`,
];

// Adatpted from https://github.com/adbar/trafilatura/blob/c7e00f3a31e436c7b6ce666b44712e16e30908c0/trafilatura/settings.py#L55
// Removed (because user might want to extract them):
// - form
// - fieldset
const MANUALLY_CLEANED = [
  // important
  "aside",
  "embed",
  "footer",
  // "form",
  "head",
  "iframe",
  "menu",
  "object",
  "script",
  // other content
  "applet",
  "audio",
  "canvas",
  "figure",
  "map",
  "picture",
  "svg",
  "video",
  // secondary
  "area",
  "blink",
  "button",
  "datalist",
  "dialog",
  "frame",
  "frameset",
  // "fieldset",
  "link",
  "input",
  "ins",
  "label",
  "legend",
  "marquee",
  "math",
  "menuitem",
  "nav",
  "noscript",
  "optgroup",
  "option",
  "output",
  "param",
  "progress",
  "rp",
  "rt",
  "rtc",
  "select",
  "source",
  "style",
  "track",
  "textarea",
  "time",
  "use",
];
