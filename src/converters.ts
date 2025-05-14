import TurndownService from "turndown";
import { HTMLExtractionOptions } from "./types";
import { DOMParser, XMLSerializer } from "xmldom";
import { isNodeLike } from "xpath";
import * as url from "url";

var xpath = require("xpath");
const cheerio = require("cheerio");

/**
 * Extract the main content from an HTML string if requested
 */
function extractMainHtml(html: string): string {
  try {
    const bodyDoc = new DOMParser().parseFromString(html, "text/html");

    [...OVERALL_DISCARD_XPATH, ...PRECISION_DISCARD_XPATH].forEach((xPath) => {
      const result = xpath.parse(xPath).select({ node: bodyDoc, isHtml: true });

      // Ensure result is an array before calling forEach
      const nodes = Array.isArray(result) ? result : [result];

      nodes.forEach((node) => {
        if (isNodeLike(node) && node.parentNode) {
          node.parentNode.removeChild(node);
        }
      });
    });

    const refinedHtml = new XMLSerializer().serializeToString(bodyDoc);
    return refinedHtml == "" ? html : refinedHtml;
  } catch (error) {
    console.error("error extracting main html", error);
    return "";
  }
}

/**
 * Convert HTML to Markdown
 */
export function htmlToMarkdown(
  html: string,
  options?: HTMLExtractionOptions,
  sourceUrl?: string
): string {
  // First clean up the html
  const tidiedHtml = tidyHtml(html, options?.includeImages ?? false);

  // Turndown config
  // Reference: https://github.com/jina-ai/reader/blob/1e3bae6aad9cf0005c14f0036b46b49390e63203/backend/functions/src/cloud-functions/crawler.ts#L134
  const turnDownService = new TurndownService();

  // Define elements to remove - conditionally include or exclude images
  const elementsToRemove: any[] = [
    "meta",
    "style",
    "script",
    "noscript",
    "link",
    "textarea",
  ];

  // Only remove image elements if includeImages is not enabled
  if (!options?.includeImages) {
    elementsToRemove.push("img", "picture", "figure");
  }

  turnDownService.addRule("remove-irrelevant", {
    filter: elementsToRemove,
    replacement: () => "",
  });

  turnDownService.addRule("truncate-svg", {
    filter: "svg" as any,
    replacement: () => "",
  });

  turnDownService.addRule("title-as-h1", {
    filter: ["title"],
    replacement: (innerText: string) => `${innerText}\n===============\n`,
  });

  turnDownService.addRule("improved-paragraph", {
    filter: "p",
    replacement: (innerText: string) => {
      const trimmed = innerText.trim();
      if (!trimmed) {
        return "";
      }

      return `${trimmed.replace(/\n{3,}/g, "\n\n")}\n\n`;
    },
  });

  turnDownService.addRule("improved-inline-link", {
    filter: function (node: any, options: any) {
      return Boolean(
        options.linkStyle === "inlined" &&
          node.nodeName === "A" &&
          node.getAttribute("href")
      );
    },

    replacement: function (content: string, node: any) {
      let href = node.getAttribute("href");
      if (href) {
        // Convert relative URLs to absolute if sourceUrl is provided
        if (
          sourceUrl &&
          !href.startsWith("http") &&
          !href.startsWith("mailto:")
        ) {
          try {
            href = url.resolve(sourceUrl, href);
          } catch (error) {
            console.warn(
              `Failed to resolve URL ${href} against ${sourceUrl}:`,
              error
            );
          }
        }
        href = href.replace(/([()])/g, "\\$1");
      }
      let title = cleanAttribute(node.getAttribute("title"));
      if (title) title = ' "' + title.replace(/"/g, '\\"') + '"';

      const fixedContent = content.replace(/\s+/g, " ").trim();
      const fixedHref = href.replace(/\s+/g, "").trim();

      return `[${fixedContent}](${fixedHref}${title || ""})`;
    },
  });

  turnDownService.addRule("images", {
    filter: "img",

    replacement: function (content: string, node: any) {
      let src = node.getAttribute("src");
      if (src) {
        // Convert relative URLs to absolute if sourceUrl is provided
        if (sourceUrl && !src.startsWith("http") && !src.startsWith("data:")) {
          try {
            src = url.resolve(sourceUrl, src);
          } catch (error) {
            console.warn(
              `Failed to resolve URL ${src} against ${sourceUrl}:`,
              error
            );
          }
        }
        src = src.replace(/([()])/g, "\\$1");
      } else {
        return ""; // No source, no image
      }

      let alt = cleanAttribute(node.getAttribute("alt") || "");
      let title = cleanAttribute(node.getAttribute("title"));

      if (title) title = ' "' + title.replace(/"/g, '\\"') + '"';

      const fixedSrc = src.replace(/\s+/g, "").trim();

      return `![${alt}](${fixedSrc}${title || ""})`;
    },
  });

  const fullMarkdown = turnDownService.turndown(tidiedHtml).trim();
  if (options?.extractMainHtml) {
    const mainHtml = extractMainHtml(tidiedHtml);
    const mainMarkdown = turnDownService.turndown(mainHtml).trim();
    // Heristics:
    // If main content is empty or is less than 20% of full content and not too short, use full content
    if (
      mainMarkdown.length == 0 ||
      (mainMarkdown.length < fullMarkdown.length * 0.2 &&
        mainMarkdown.length < 500)
    ) {
      return fullMarkdown;
    } else {
      return mainMarkdown;
    }
  } else {
    return fullMarkdown;
  }
}

// Clean up the html
function tidyHtml(html: string, includeImages: boolean): string {
  const $ = cheerio.load(html);
  $("*").each(function (this: any) {
    const element = $(this);
    const attributes = Object.keys(this.attribs);

    for (let i = 0; i < attributes.length; i++) {
      let attr = attributes[i];
      // Check if the attribute value has an odd number of quotes
      // If the attribute name has a quote, it might be a broken attribute. Remove it completely.
      // (this occured at dealnews.com)
      if (attr.includes('"')) {
        element.remove();
      }
    }
  });

  // Adatpted from https://github.com/adbar/trafilatura/blob/c7e00f3a31e436c7b6ce666b44712e16e30908c0/trafilatura/settings.py#L55
  // Removed (because user might want to extract them):
  // - form
  // - fieldset
  // - footer (might contain company info)
  // - img, picture, figure (if includeImages is false)
  // - option, label, select (this can present product options and titles)
  const manuallyCleanedElements = [
    // important
    "aside",
    "embed",
    // "footer",
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
    "map",
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
    // "label",
    "legend",
    "marquee",
    "math",
    "menuitem",
    "nav",
    "noscript",
    "optgroup",
    // "option",
    "output",
    "param",
    "progress",
    "rp",
    "rt",
    "rtc",
    // "select",
    "source",
    "style",
    "track",
    "textarea",
    "time",
    "use",
  ];

  if (!includeImages) {
    manuallyCleanedElements.push("img", "picture", "figure");
  }

  // Further clean html
  manuallyCleanedElements.forEach((element) => {
    $(element).remove();
  });
  return $("body").html();
}

function cleanAttribute(attribute: string) {
  return attribute ? attribute.replace(/(\n+\s*)+/g, "\n") : "";
}

// Adapted from https://github.com/adbar/trafilatura/blob/c7e00f3a31e436c7b6ce666b44712e16e30908c0/trafilatura/xpaths.py#L100
// Added:
// - Add contains(@id, "filter") to remove filter menus
// - footer
// Removed (because user might want to extract them):
// - Commented out tags
// - Commented out sidebar (sidebar sometimes can be too aggressive and can remove main content)
// - Commented out author
// - Commented out rating
// - Commented out attachment
// - Commented out timestamp
// - Commented out user-info and user-profile
// - Commented out comment or hidden section
// - Not including @data-testid (it can remove dynamic product listings)
// - Commented out options
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
    // `contains(@id, "sidebar") or contains(@class, "sidebar") or ` +
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
  or contains(@class, "criteo") ` +
    // or contains(@class, "options")
    `or contains(@class, "consent") or contains(@class, "modal-content")
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
  or @data-lp-replacement-content]`,
  ".//footer",

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
