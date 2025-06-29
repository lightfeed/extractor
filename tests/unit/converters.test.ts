import { htmlToMarkdown } from "../../src/converters";
import { convertHtmlToMarkdown } from "../../src/index";

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

  // TODO: Add test for end-to-end extraction
  test("should escape markdown characters", () => {
    const html =
      '<a href="https://example.com/meeting-(11-12-24)">Meeting [11-12-24]</a>';
    const markdown = htmlToMarkdown(html);

    expect(markdown).toBe(
      "[Meeting \\[11-12-24\\]](https://example.com/meeting-\\(11-12-24\\))"
    );
  });

  test("should convert links correctly", () => {
    const html = '<a href="https://example.com">Example</a>';
    const markdown = htmlToMarkdown(html);

    expect(markdown).toBe("[Example](https://example.com)");
  });

  test("should discard images by default", () => {
    const html = '<img src="image.jpg" alt="An image">';
    const markdown = htmlToMarkdown(html);
    expect(markdown).toBe("");
  });

  test("should discard images when includeImages is false", () => {
    const html = '<img src="image.jpg" alt="An image">';
    const markdown = htmlToMarkdown(html, { includeImages: false });
    expect(markdown).toBe("");
  });

  test("should include images when includeImages is true", () => {
    const html =
      '<p>Text with an image: <img src="https://example.com/image.jpg" alt="Example image"></p>';
    const markdownWithImages = htmlToMarkdown(html, { includeImages: true });
    const markdownWithoutImages = htmlToMarkdown(html);

    // With includeImages, the image should be converted to markdown format
    expect(markdownWithImages).toContain("Text with an image:");
    expect(markdownWithImages).toContain(
      "![Example image](https://example.com/image.jpg)"
    );

    // Without includeImages, the image should be removed
    expect(markdownWithoutImages).toContain("Text with an image:");
    expect(markdownWithoutImages).not.toContain("![Example image]");
    expect(markdownWithoutImages).not.toContain(
      "https://example.com/image.jpg"
    );
  });

  test("should handle complex HTML with multiple images", () => {
    const html = `
      <article>
        <h1>Test Article</h1>
        <p>First paragraph with <img src="image1.jpg" alt="First image"> embedded.</p>
        <figure>
          <img src="image2.jpg" alt="Second image">
          <figcaption>Figure caption</figcaption>
        </figure>
        <picture>
          <source srcset="image3-large.jpg" media="(min-width: 800px)">
          <source srcset="image3-medium.jpg" media="(min-width: 400px)">
          <img src="image3.jpg" alt="Third image">
        </picture>
        <p>Final paragraph.</p>
      </article>
    `;

    const markdownWithImages = htmlToMarkdown(html, { includeImages: true });

    // Check that both images are included
    expect(markdownWithImages).toContain("![First image](image1.jpg)");
    expect(markdownWithImages).toContain("![Second image](image2.jpg)");
    expect(markdownWithImages).toContain("![Third image](image3.jpg)");
    expect(markdownWithImages).toContain("Figure caption");

    // Verify the basic structure is preserved
    expect(markdownWithImages).toContain("Test Article");
    expect(markdownWithImages).toContain("First paragraph");
    expect(markdownWithImages).toContain("Final paragraph");

    // Check without images
    const markdownWithoutImages = htmlToMarkdown(html);
    expect(markdownWithoutImages).not.toContain("![First image]");
    expect(markdownWithoutImages).not.toContain("![Second image]");
    expect(markdownWithoutImages).not.toContain("![Third image]");
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

  describe("URL handling", () => {
    test("should convert relative URLs to absolute URLs when sourceUrl is provided", () => {
      const html = `
        <a href="/about">About Us</a>
        <a href="products/item.html">Product</a>
        <a href="../blog/post.html">Blog Post</a>
        <img src="/images/logo.png" alt="Logo">
        <img src="assets/photo.jpg" alt="Photo">
      `;
      const sourceUrl = "https://example.com/company/";
      const markdown = htmlToMarkdown(html, { includeImages: true }, sourceUrl);

      // Check that relative URLs are converted to absolute
      expect(markdown).toContain("[About Us](https://example.com/about)");
      expect(markdown).toContain(
        "[Product](https://example.com/company/products/item.html)"
      );
      expect(markdown).toContain(
        "[Blog Post](https://example.com/blog/post.html)"
      );
      expect(markdown).toContain(
        "![Logo](https://example.com/images/logo.png)"
      );
      expect(markdown).toContain(
        "![Photo](https://example.com/company/assets/photo.jpg)"
      );
    });

    test("should not modify absolute URLs when sourceUrl is provided", () => {
      const html = `
        <a href="https://other-site.com/page">External Link</a>
        <a href="mailto:user@example.com">Email</a>
        <img src="https://cdn.example.com/image.jpg" alt="CDN Image">
      `;
      const sourceUrl = "https://example.com/";
      const markdown = htmlToMarkdown(html, { includeImages: true }, sourceUrl);

      // Check that absolute URLs remain unchanged
      expect(markdown).toContain(
        "[External Link](https://other-site.com/page)"
      );
      expect(markdown).toContain("[Email](mailto:user@example.com)");
      expect(markdown).toContain(
        "![CDN Image](https://cdn.example.com/image.jpg)"
      );
    });

    test("should handle relative URLs without sourceUrl", () => {
      const html = `
        <a href="/about">About Us</a>
        <img src="/images/logo.png" alt="Logo">
      `;
      const markdown = htmlToMarkdown(html, { includeImages: true });

      // Check that relative URLs remain unchanged when no sourceUrl is provided
      expect(markdown).toContain("[About Us](/about)");
      expect(markdown).toContain("![Logo](/images/logo.png)");
    });

    test("should handle invalid URLs gracefully", () => {
      const html = `
        <a href="invalid:url">Invalid Link</a>
        <img src="invalid:url" alt="Invalid Image">
      `;
      const sourceUrl = "https://example.com/";
      const markdown = htmlToMarkdown(html, { includeImages: true }, sourceUrl);

      // Check that invalid URLs are preserved as-is
      expect(markdown).toContain("[Invalid Link](invalid:url)");
      expect(markdown).toContain("![Invalid Image](invalid:url)");
    });

    describe("URL cleaning", () => {
      test("should clean Amazon URLs by removing tracking parameters when cleanUrls is enabled", () => {
        const html = `
          <a href="https://www.amazon.com/Product-Name-Here/dp/ABCDE01234/ref=sr_1_47?dib=abc123&qid=1640995200">Amazon Product</a>
          <a href="https://amazon.ca/Item-Name/dp/B12345/ref=sr_1_1?keywords=test">Amazon CA Product</a>
        `;
        const markdown = htmlToMarkdown(html, { cleanUrls: true });

        // Check that Amazon URLs are cleaned
        expect(markdown).toContain(
          "[Amazon Product](https://www.amazon.com/Product-Name-Here/dp/ABCDE01234)"
        );
        expect(markdown).toContain(
          "[Amazon CA Product](https://amazon.ca/Item-Name/dp/B12345)"
        );

        // Ensure tracking parameters are removed
        expect(markdown).not.toContain("/ref=");
        expect(markdown).not.toContain("dib=");
        expect(markdown).not.toContain("qid=");
      });

      test("should not clean Amazon URLs by default", () => {
        const html = `
          <a href="https://www.amazon.com/Product-Name-Here/dp/ABCDE01234/ref=sr_1_47?dib=abc123&qid=1640995200">Amazon Product</a>
        `;
        const markdown = htmlToMarkdown(html);

        // Check that Amazon URLs are NOT cleaned by default
        expect(markdown).toContain(
          "[Amazon Product](https://www.amazon.com/Product-Name-Here/dp/ABCDE01234/ref=sr_1_47?dib=abc123&qid=1640995200)"
        );
      });

      test("should not clean Amazon URLs when cleanUrls is false", () => {
        const html = `
          <a href="https://www.amazon.com/Product-Name-Here/dp/ABCDE01234/ref=sr_1_47?dib=abc123&qid=1640995200">Amazon Product</a>
        `;
        const markdown = htmlToMarkdown(html, { cleanUrls: false });

        // Check that Amazon URLs are NOT cleaned when option is disabled
        expect(markdown).toContain(
          "[Amazon Product](https://www.amazon.com/Product-Name-Here/dp/ABCDE01234/ref=sr_1_47?dib=abc123&qid=1640995200)"
        );
      });

      test("should not modify non-Amazon URLs", () => {
        const html = `
          <a href="https://example.com/product?utm_source=test&ref=something">Regular Link</a>
          <a href="https://shop.example.com/item/ref=special">Shop Link</a>
          <img src="https://cdn.example.com/image.jpg?v=123&ref=cache" alt="Image">
        `;
        const markdown = htmlToMarkdown(html, {
          includeImages: true,
          cleanUrls: true,
        });

        // Check that non-Amazon URLs remain unchanged even with cleanUrls enabled
        expect(markdown).toContain(
          "[Regular Link](https://example.com/product?utm_source=test&ref=something)"
        );
        expect(markdown).toContain(
          "[Shop Link](https://shop.example.com/item/ref=special)"
        );
        expect(markdown).toContain(
          "![Image](https://cdn.example.com/image.jpg?v=123&ref=cache)"
        );
      });
    });
  });
});

describe("convertHtmlToMarkdown", () => {
  it("should convert HTML to markdown", () => {
    const html = "<h1>Hello World</h1><p>This is a test</p>";
    const markdown = convertHtmlToMarkdown(html);
    expect(markdown).toContain("Hello World");
    expect(markdown).toContain("This is a test");
  });

  it("should handle HTML extraction options", () => {
    const html = `
      <nav>Navigation</nav>
      <main><h1>Main Content</h1><p>Important text</p></main>
      <footer>Footer</footer>
    `;
    const markdown = convertHtmlToMarkdown(html, { extractMainHtml: true });
    expect(markdown).toContain("Main Content");
    expect(markdown).toContain("Important text");
    // Navigation and footer might be removed by extractMainHtml
  });

  it("should process images when includeImages is true", () => {
    const html = '<div><img src="image.jpg" alt="Test Image"></div>';
    const markdown = convertHtmlToMarkdown(html, { includeImages: true });
    expect(markdown).toContain("![Test Image]");
  });

  it("should handle source URL for relative links", () => {
    const html = '<a href="/about">About</a>';
    const markdown = convertHtmlToMarkdown(
      html,
      undefined,
      "https://example.com"
    );
    expect(markdown).toContain("https://example.com/about");
  });
});
