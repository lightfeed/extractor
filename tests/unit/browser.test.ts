import { Browser } from "../../src/browser";

// Mock browser providers
jest.mock("../../src/utils/browserProviders");

describe("Browser Class", () => {
  let mockBrowser: any;
  let mockPage: any;
  let mockProvider: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock page
    mockPage = {
      goto: jest.fn(),
      waitForTimeout: jest.fn(),
      waitForLoadState: jest.fn(),
      content: jest.fn(),
      close: jest.fn(),
      title: jest.fn(),
    };

    // Mock browser
    mockBrowser = {
      newPage: jest.fn().mockResolvedValue(mockPage),
      close: jest.fn(),
    };

    // Mock provider
    mockProvider = {
      start: jest.fn().mockResolvedValue(mockBrowser),
      close: jest.fn(),
    };

    // Mock createBrowserProvider
    const {
      createBrowserProvider,
    } = require("../../src/utils/browserProviders");
    createBrowserProvider.mockReturnValue(mockProvider);
  });

  describe("Browser instantiation and lifecycle", () => {
    it("should create browser with default config", () => {
      const browser = new Browser();
      expect(browser.isStarted()).toBe(false);
    });

    it("should create browser with custom config", () => {
      const config = {
        type: "local" as const,
        options: { args: ["--disable-dev-shm-usage"] },
      };
      const browser = new Browser(config);
      expect(browser.isStarted()).toBe(false);
    });

    it("should start browser successfully", async () => {
      const browser = new Browser();
      await browser.start();

      expect(browser.isStarted()).toBe(true);
      expect(mockProvider.start).toHaveBeenCalled();

      await browser.close();
    });

    it("should throw error when starting already started browser", async () => {
      const browser = new Browser();
      await browser.start();

      await expect(browser.start()).rejects.toThrow(
        "Browser is already started. Call close() first if you want to restart."
      );

      await browser.close();
    });

    it("should close browser successfully", async () => {
      const browser = new Browser();
      await browser.start();
      await browser.close();

      expect(browser.isStarted()).toBe(false);
      expect(mockProvider.close).toHaveBeenCalled();
    });

    it("should handle closing non-started browser gracefully", async () => {
      const browser = new Browser();
      await browser.close();

      expect(browser.isStarted()).toBe(false);
    });
  });

  describe("Page operations", () => {
    it("should create new page when browser is started", async () => {
      const browser = new Browser();
      await browser.start();

      const page = await browser.newPage();

      expect(page).toBe(mockPage);
      expect(mockBrowser.newPage).toHaveBeenCalled();

      await browser.close();
    });

    it("should throw error when creating page with non-started browser", async () => {
      const browser = new Browser();

      await expect(browser.newPage()).rejects.toThrow(
        "Browser not started. Call start() first."
      );
    });

    it("should return underlying browser instance", async () => {
      const browser = new Browser();
      expect(browser.getBrowser()).toBeNull();

      await browser.start();
      expect(browser.getBrowser()).toBe(mockBrowser);
      await browser.close();
    });

    it("should allow direct page operations with Playwright API", async () => {
      const browser = new Browser();
      await browser.start();

      const page = await browser.newPage();
      const url = "https://example.com";
      const htmlContent = "<html><body><h1>Test</h1></body></html>";

      mockPage.content.mockResolvedValue(htmlContent);
      mockPage.title.mockResolvedValue("Test Title");

      // Use direct Playwright API
      await page.goto(url);
      await page.waitForLoadState("networkidle", { timeout: 10000 });
      const html = await page.content();
      const title = await page.title();

      expect(mockPage.goto).toHaveBeenCalledWith(url);
      expect(mockPage.waitForLoadState).toHaveBeenCalledWith("networkidle", {
        timeout: 10000,
      });
      expect(mockPage.content).toHaveBeenCalled();
      expect(mockPage.title).toHaveBeenCalled();
      expect(mockPage.close).toHaveBeenCalled();
      expect(html).toBe(htmlContent);
      expect(title).toBe("Test Title");

      await browser.close();
    });

    it("should handle page errors gracefully", async () => {
      const browser = new Browser();
      await browser.start();

      const page = await browser.newPage();
      const error = new Error("Navigation failed");

      mockPage.goto.mockRejectedValue(error);

      await expect(page.goto("https://example.com")).rejects.toThrow(
        "Navigation failed"
      );

      expect(mockPage.close).toHaveBeenCalled();

      await browser.close();
    });

    it("should support multiple pages", async () => {
      const browser = new Browser();
      await browser.start();

      const page1 = await browser.newPage();
      const page2 = await browser.newPage();

      expect(page1).toBe(mockPage);
      expect(page2).toBe(mockPage);
      expect(mockBrowser.newPage).toHaveBeenCalledTimes(2);

      await browser.close();
    });
  });
});
