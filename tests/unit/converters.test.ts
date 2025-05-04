import { htmlToMarkdown } from "../../src/converters";

describe("HTML to Markdown converter", () => {
  test("should convert simple HTML to markdown", () => {
    const html = "<h1>Hello World</h1><p>This is a test</p>";
    const markdown = htmlToMarkdown(html);

    expect(markdown).toEqual("Hello World\n===========\n\nThis is a test");
    expect(markdown).toContain("Hello World");
    expect(markdown).toContain("This is a test");
  });

  test("should handle HTML with attributes", () => {
    const html =
      '<div class="content"><h2 id="title">Title</h2><p>Paragraph</p></div>';
    const markdown = htmlToMarkdown(html);

    expect(markdown).toContain("Title");
    expect(markdown).toContain("Paragraph");
  });

  test("should escape markdown characters", () => {
    const html =
      '<a href="https://example.com/meeting-(11-12-24)">Meeting [11-12-24]</a>';
    const markdown = htmlToMarkdown(html);

    expect(markdown).toBe(
      "[Meeting \\[11-12-24\\]](https://example.com/meeting-\\(11-12-24\\))"
    );
  });

  // TODO: Add test for end-to-end extraction
  test("should convert links correctly", () => {
    const html = '<a href="https://example.com">Example</a>';
    const markdown = htmlToMarkdown(html);

    expect(markdown).toBe("[Example](https://example.com)");
  });

  // TODO: Add test for images
  test("should discard images by default", () => {
    const html = '<img src="image.jpg" alt="An image">';
    const markdown = htmlToMarkdown(html);
    expect(markdown).toBe("");
  });

  test("should extract main content when extractMainHtml is true", () => {
    const html = `
      <html>
        <body>
          <header>Header content</header>
          <article>
            <h1>Main Content</h1>
            <p>This is the main content</p>
          </article>
          <footer>Footer content</footer>
        </body>
      </html>
    `;

    const markdownWithExtraction = htmlToMarkdown(html, {
      extractMainHtml: true,
    });
    const markdownWithoutExtraction = htmlToMarkdown(html);

    // With extraction, only the article content should be included
    expect(markdownWithExtraction).toContain("Main Content");
    expect(markdownWithExtraction).toContain("This is the main content");
    expect(markdownWithExtraction).not.toContain("Header content");
    expect(markdownWithExtraction).not.toContain("Footer content");

    // Without extraction, the entire HTML should be converted
    expect(markdownWithoutExtraction).toContain("Header content");
    expect(markdownWithoutExtraction).toContain("Main Content");
    expect(markdownWithoutExtraction).toContain("Footer content");
  });
});
