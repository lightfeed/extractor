import * as fs from "fs";
import * as path from "path";
import { htmlToMarkdown } from "../../src/converters";
import { ContentExtractionOptions } from "../../src/types";

// Flag to check if the test-data submodule exists
const testDataExists = fs.existsSync(path.join(__dirname, "../../test-data"));

// Skip all tests if the test-data submodule is not available
const testOrSkip = testDataExists ? test : test.skip;

describe("HTML to Markdown Integration Tests", () => {
  // Function to test a specific HTML file against its groundtruth markdown
  function testConversion(
    category: string,
    filename: string,
    options?: ContentExtractionOptions,
    variant: string = ""
  ) {
    // Construct file paths
    const htmlFilePath = path.join(
      __dirname,
      "../../test-data/html",
      category,
      `${filename}.html`
    );

    // Determine the groundtruth file path based on variant
    let groundtruthFilename = `${filename}`;
    if (variant === "main") {
      groundtruthFilename += ".main";
    } else if (variant === "images") {
      groundtruthFilename += ".images";
    }

    const markdownFilePath = path.join(
      __dirname,
      "../../test-data/groundtruth",
      category,
      `${groundtruthFilename}.md`
    );

    // Skip if files don't exist
    if (!fs.existsSync(htmlFilePath) || !fs.existsSync(markdownFilePath)) {
      console.warn(
        `Skipping test: Missing files for ${category}/${filename}: ${htmlFilePath} or ${markdownFilePath} not found`
      );
      return;
    }

    // Read files
    const html = fs.readFileSync(htmlFilePath, "utf8");
    const expectedMarkdown = fs.readFileSync(markdownFilePath, "utf8");

    // Convert HTML to Markdown
    const actualMarkdown = htmlToMarkdown(html, options);

    // Compare
    expect(actualMarkdown).toBe(expectedMarkdown);
  }

  // Dynamic test generation - automatically test all files in the test-data directory
  if (testDataExists) {
    describe("Auto-discovered Tests", () => {
      // Get all categories (subdirectories under html/)
      const testDataDir = path.join(__dirname, "../../test-data");
      const htmlDir = path.join(testDataDir, "html");
      const categories = fs
        .readdirSync(htmlDir, { withFileTypes: true })
        .filter((dirent) => dirent.isDirectory())
        .map((dirent) => dirent.name);

      // For each category, get all HTML files and create tests
      categories.forEach((category) => {
        const categoryDir = path.join(htmlDir, category);
        const htmlFiles = fs
          .readdirSync(categoryDir)
          .filter((file) => file.endsWith(".html"))
          .map((file) => file.replace(".html", ""));

        htmlFiles.forEach((filename) => {
          // Check which groundtruth files exist for this file
          const groundtruthDir = path.join(
            testDataDir,
            "groundtruth",
            category
          );

          // Basic conversion
          if (fs.existsSync(path.join(groundtruthDir, `${filename}.md`))) {
            testOrSkip(
              `should convert ${category}/${filename} to markdown`,
              () => {
                testConversion(category, filename);
              }
            );
          }

          // Main content extraction
          if (fs.existsSync(path.join(groundtruthDir, `${filename}.main.md`))) {
            testOrSkip(
              `should extract main content from ${category}/${filename}`,
              () => {
                testConversion(
                  category,
                  filename,
                  { extractMainHtml: true },
                  "main"
                );
              }
            );
          }

          // Conversion with images
          if (
            fs.existsSync(path.join(groundtruthDir, `${filename}.images.md`))
          ) {
            testOrSkip(
              `should convert ${category}/${filename} with images`,
              () => {
                testConversion(
                  category,
                  filename,
                  { includeImages: true },
                  "images"
                );
              }
            );
          }
        });
      });
    });
  }
});
