import * as fs from "fs";
import * as path from "path";
import { htmlToMarkdown } from "../converters";
import { ContentExtractionOptions } from "../types";

// Function to convert HTML to Markdown and save as ground truth
async function generateGroundTruth(
  htmlFilePath: string,
  groundtruthDir: string,
  options?: ContentExtractionOptions,
  variant: string = ""
) {
  try {
    // Read the HTML file
    const html = fs.readFileSync(htmlFilePath, "utf8");

    // Convert to Markdown
    const markdown = htmlToMarkdown(html, options);

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
