import * as fs from "fs";
import * as path from "path";
import { htmlToMarkdown } from "../converters";
import { ContentExtractionOptions } from "../types";

// Function to convert HTML to Markdown and save the result
async function convertHtmlToMarkdown(
  htmlFilePath: string,
  outputDir: string,
  options?: ContentExtractionOptions
) {
  try {
    // Read the HTML file
    const html = fs.readFileSync(htmlFilePath, "utf8");

    // Convert to Markdown
    const markdown = htmlToMarkdown(html, options);

    // Create output directory if it doesn't exist
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Generate output filename
    const baseName = path.basename(htmlFilePath, ".html");
    const optionsSuffix = options?.includeImages
      ? ".with-images"
      : options?.extractMainHtml
      ? ".main-content"
      : "";
    const outputPath = path.join(outputDir, `${baseName}${optionsSuffix}.md`);

    // Save the markdown
    fs.writeFileSync(outputPath, markdown);
    console.log(`✅ Converted ${htmlFilePath} to ${outputPath}`);

    return outputPath;
  } catch (error) {
    console.error("❌ Error converting HTML to Markdown:", error);
    throw error;
  }
}

// Main function to run the test
async function main() {
  // Get the HTML file path from command line arguments
  const htmlFilePath = process.argv[2];
  if (!htmlFilePath) {
    console.error("❌ Please provide an HTML file path as an argument");
    console.log("Usage: npm run dev:html2md <path-to-html-file>");
    process.exit(1);
  }

  // Create output directory
  const outputDir = path.join(process.cwd(), "dev-output", "markdown");

  // Test different conversion options
  console.log(
    "\n🔍 Testing HTML to Markdown conversion with different options...\n"
  );

  // 1. Basic conversion
  await convertHtmlToMarkdown(htmlFilePath, outputDir);

  // 2. Conversion with images
  await convertHtmlToMarkdown(htmlFilePath, outputDir, { includeImages: true });

  // 3. Main content extraction
  await convertHtmlToMarkdown(htmlFilePath, outputDir, {
    extractMainHtml: true,
  });

  // 4. Both images and main content
  await convertHtmlToMarkdown(htmlFilePath, outputDir, {
    includeImages: true,
    extractMainHtml: true,
  });

  console.log(
    "\n✨ All conversions completed! Check the output in:",
    outputDir
  );
}

// Run the main function
main().catch(console.error);
