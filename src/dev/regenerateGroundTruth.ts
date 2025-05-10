import * as fs from "fs";
import * as path from "path";
import { htmlToMarkdown } from "../converters";
import { ContentExtractionOptions } from "../types";
import * as cheerio from "cheerio";

// Function to sanitize HTML content
function sanitizeHTML(html: string, originalSource: string): string {
  const $ = cheerio.load(html);

  // Remove scripts and event handlers
  $("script").remove();
  $("[onclick]").removeAttr("onclick");
  $("[onload]").removeAttr("onload");
  // Find all elements with attributes starting with "on" and remove them
  $("*").each(function () {
    const el = $(this);
    const node = el[0];

    // Skip if not an element node or has no attributes
    if (!node || node.type !== "tag" || !("attribs" in node)) return;

    // Now TypeScript knows node.attribs exists
    Object.keys(node.attribs)
      .filter((attr) => attr.startsWith("on"))
      .forEach((attr) => el.removeAttr(attr));
  });
  // Remove styles
  $("style").remove();
  $("[style]").removeAttr("style");

  // Replace text content with placeholder
  $("p, h1, h2, h3, h4, h5, span, div").each(function () {
    const el = $(this);
    if (el.children().length === 0) {
      // Only replace text in leaf nodes
      const originalText = el.text();
      const length = originalText.length;

      if (length > 0) {
        // Generate placeholder text with exactly the same length
        const loremIpsumBase =
          "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. ";

        // Create deterministic placeholder based on original length and first character
        let placeholder = "";
        // Repeat the base text as many times as needed
        while (placeholder.length < length) {
          placeholder += loremIpsumBase;
        }

        // Trim to exact length of original text
        placeholder = placeholder.substring(0, length);

        el.text(placeholder);
      }
    }
  });

  // Replace links
  $("a").each(function () {
    const el = $(this);
    const isEmail = el.attr("href") && el.attr("href")!.startsWith("mailto:");
    const isExternal =
      el.attr("href") &&
      (el.attr("href")!.startsWith("http") ||
        el.attr("href")!.startsWith("www"));

    // Replace with appropriate placeholder based on link type
    if (isEmail) {
      // Replace email links
      el.attr("href", "mailto:example@example.com");
    } else if (isExternal) {
      // Replace external links
      el.attr("href", "https://example.com/external-link");
    } else {
      // Replace internal/relative links
      el.attr("href", "/placeholder-page");
    }

    const originalLinkText = el.text().trim();
    const textLength = originalLinkText.length;
    if (textLength > 0) {
      // Base text patterns for different link types
      let placeholderBase = "Link Text";

      if (isEmail) {
        placeholderBase = "Email Link";
      } else if (isExternal) {
        placeholderBase = "External Link";
      } else {
        placeholderBase = "Page Link";
      }

      // Replace the link text
      el.text(placeholderBase);
    }
  });

  // Replace images with real placeholder services
  $("img").each(function () {
    const el = $(this);
    const width = el.attr("width") || 300;
    const height = el.attr("height") || 200;

    // Use a real placeholder image service
    el.attr("src", `https://picsum.photos/${width}/${height}`);

    // Add generic alt text if none exists
    if (!el.attr("alt")) {
      el.attr("alt", "Placeholder image");
    }
  });

  // Add attribution header
  const sanitizedHTML = $.html();

  return sanitizedHTML;
}

// Function to convert HTML to Markdown and save as ground truth
async function generateGroundTruth(
  htmlFilePath: string,
  groundtruthDir: string,
  options?: ContentExtractionOptions,
  variant: string = ""
) {
  try {
    // Read and sanitize the HTML file
    const originalHtml = fs.readFileSync(htmlFilePath, "utf8");
    const sanitizedHtml = sanitizeHTML(originalHtml, htmlFilePath);

    // Save sanitized HTML back to the original file
    fs.writeFileSync(htmlFilePath, sanitizedHtml);
    console.log(`✅ Sanitized HTML: ${htmlFilePath}`);

    // Convert to Markdown
    const markdown = htmlToMarkdown(sanitizedHtml, options);

    // Create groundtruth directory if it doesn't exist
    if (!fs.existsSync(groundtruthDir)) {
      fs.mkdirSync(groundtruthDir, { recursive: true });
    }

    // Generate output filename
    const baseName = path.basename(htmlFilePath, ".html");
    const outputFilename = variant
      ? `${baseName}.${variant}.md`
      : `${baseName}.md`;
    const outputPath = path.join(groundtruthDir, outputFilename);

    // Save the markdown
    fs.writeFileSync(outputPath, markdown);
    console.log(`✅ Generated ground truth: ${outputPath}`);

    return outputPath;
  } catch (error) {
    console.error("❌ Error generating ground truth:", error);
    throw error;
  }
}

// Main function to regenerate all ground truth files
async function main() {
  const testDataDir = path.join(process.cwd(), "test-data");

  // Check if test-data directory exists
  if (!fs.existsSync(testDataDir)) {
    console.error(
      "❌ test-data directory not found. Please run 'npm run test:html2md:update' first."
    );
    process.exit(1);
  }

  const htmlDir = path.join(testDataDir, "html");
  const groundtruthDir = path.join(testDataDir, "groundtruth");

  // Get all categories (subdirectories under html/)
  const categories = fs
    .readdirSync(htmlDir, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name);

  console.log("\n🔍 Regenerating ground truth files...\n");

  // Process each category
  for (const category of categories) {
    console.log(`\n📁 Processing category: ${category}`);

    const categoryHtmlDir = path.join(htmlDir, category);
    const categoryGroundtruthDir = path.join(groundtruthDir, category);

    // Create category directory in groundtruth if it doesn't exist
    if (!fs.existsSync(categoryGroundtruthDir)) {
      fs.mkdirSync(categoryGroundtruthDir, { recursive: true });
    }

    // Get all HTML files in this category
    const htmlFiles = fs
      .readdirSync(categoryHtmlDir)
      .filter((file) => file.endsWith(".html"))
      .map((file) => file.replace(".html", ""));

    // Process each HTML file
    for (const filename of htmlFiles) {
      const htmlFilePath = path.join(categoryHtmlDir, `${filename}.html`);

      // Generate ground truth files with different options
      await generateGroundTruth(htmlFilePath, categoryGroundtruthDir); // Basic conversion
      await generateGroundTruth(
        htmlFilePath,
        categoryGroundtruthDir,
        { includeImages: true },
        "images"
      );
      await generateGroundTruth(
        htmlFilePath,
        categoryGroundtruthDir,
        { extractMainHtml: true },
        "main"
      );
    }
  }

  console.log("\n✨ All ground truth files have been regenerated!");
}

// Run the main function
main().catch(console.error);
