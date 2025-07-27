import { Browser, loadHtmlFromUrl } from "../../src/browser";

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
      setDefaultTimeout: jest.fn(),
      goto: jest.fn(),
      waitForTimeout: jest.fn(),
      content: jest.fn(),
      close: jest.fn(),
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
        options: { args: ["--no-sandbox"] },
      };
      const browser = new Browser(config);
      expect(browser.isStarted()).toBe(false);
    });

    it("should start browser successfully", async () => {
      const browser = new Browser();
      await browser.start();

      expect(browser.isStarted()).toBe(true);
      expect(mockProvider.start).toHaveBeenCalled();
    });

    it("should throw error when starting already started browser", async () => {
      const browser = new Browser();
      await browser.start();

      await expect(browser.start()).rejects.toThrow(
        "Browser is already started. Call close() first if you want to restart."
      );
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
      await browser.close(); // Should not throw
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
    });
  });

  describe("loadPage method", () => {
    it("should load page successfully", async () => {
      const url = "https://example.com";
      const htmlContent = "<html><body><h1>Test</h1></body></html>";

      mockPage.content.mockResolvedValue(htmlContent);

      const browser = new Browser();
      const result = await browser.loadPage(url);

      expect(result).toEqual({
        html: htmlContent,
        url: url,
      });

      expect(mockProvider.start).toHaveBeenCalled();
      expect(mockBrowser.newPage).toHaveBeenCalled();
      expect(mockPage.setDefaultTimeout).toHaveBeenCalledWith(30000);
      expect(mockPage.goto).toHaveBeenCalledWith(url, {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });
      expect(mockPage.waitForTimeout).toHaveBeenCalledWith(1000);
      expect(mockPage.content).toHaveBeenCalled();
      expect(mockPage.close).toHaveBeenCalled();
    });

    it("should use custom options", async () => {
      const url = "https://example.com";
      const options = {
        timeout: 15000,
        waitUntil: "load" as const,
        waitTime: 2000,
      };

      mockPage.content.mockResolvedValue("<html></html>");

      const browser = new Browser();
      await browser.loadPage(url, options);

      expect(mockPage.setDefaultTimeout).toHaveBeenCalledWith(15000);
      expect(mockPage.goto).toHaveBeenCalledWith(url, {
        waitUntil: "load",
        timeout: 15000,
      });
      expect(mockPage.waitForTimeout).toHaveBeenCalledWith(2000);
    });

    it("should handle zero wait time", async () => {
      const url = "https://example.com";
      const options = { waitTime: 0 };

      mockPage.content.mockResolvedValue("<html></html>");

      const browser = new Browser();
      await browser.loadPage(url, options);

      expect(mockPage.waitForTimeout).not.toHaveBeenCalled();
    });

    it("should throw error for invalid URL", async () => {
      const browser = new Browser();

      await expect(browser.loadPage("not-a-url")).rejects.toThrow(
        "Invalid URL provided: not-a-url"
      );
    });

    it("should handle navigation errors and close page", async () => {
      const url = "https://example.com";
      const error = new Error("Navigation failed");

      mockPage.goto.mockRejectedValue(error);

      const browser = new Browser();

      await expect(browser.loadPage(url)).rejects.toThrow("Navigation failed");
      expect(mockPage.close).toHaveBeenCalled();
    });

    it("should auto-start browser if not started", async () => {
      const url = "https://example.com";
      mockPage.content.mockResolvedValue("<html></html>");

      const browser = new Browser();
      expect(browser.isStarted()).toBe(false);

      await browser.loadPage(url);

      expect(browser.isStarted()).toBe(true);
      expect(mockProvider.start).toHaveBeenCalled();
    });
  });

  describe("loadHtmlFromUrl function", () => {
    it("should load HTML and close browser automatically", async () => {
      const url = "https://example.com";
      const htmlContent = "<html><body><h1>Test</h1></body></html>";

      mockPage.content.mockResolvedValue(htmlContent);

      const result = await loadHtmlFromUrl(url);

      expect(result).toEqual({
        html: htmlContent,
        url: url,
      });

      expect(mockProvider.start).toHaveBeenCalled();
      expect(mockProvider.close).toHaveBeenCalled();
    });

    it("should use custom browser config", async () => {
      const url = "https://example.com";
      const browserConfig = {
        type: "serverless" as const,
        executablePath: "/usr/bin/chromium",
      };

      mockPage.content.mockResolvedValue("<html></html>");

      await loadHtmlFromUrl(url, browserConfig);

      const {
        createBrowserProvider,
      } = require("../../src/utils/browserProviders");
      expect(createBrowserProvider).toHaveBeenCalledWith(browserConfig);
    });

    it("should use custom options", async () => {
      const url = "https://example.com";
      const options = { timeout: 20000, waitUntil: "networkidle" as const };

      mockPage.content.mockResolvedValue("<html></html>");

      await loadHtmlFromUrl(url, undefined, options);

      expect(mockPage.goto).toHaveBeenCalledWith(url, {
        waitUntil: "networkidle",
        timeout: 20000,
      });
    });

    it("should close browser even if error occurs", async () => {
      const url = "https://example.com";
      const error = new Error("Load failed");

      mockPage.goto.mockRejectedValue(error);

      await expect(loadHtmlFromUrl(url)).rejects.toThrow("Load failed");

      expect(mockProvider.close).toHaveBeenCalled();
    });
  });
});
