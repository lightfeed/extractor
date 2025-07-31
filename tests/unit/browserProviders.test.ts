import {
  LocalBrowserProvider,
  ServerlessBrowserProvider,
  RemoteBrowserProvider,
  createBrowserProvider,
} from "../../src/utils/browserProviders";
import { Browser } from "playwright";

// Mock playwright
jest.mock("playwright", () => ({
  chromium: {
    launch: jest.fn(),
    connectOverCDP: jest.fn(),
  },
}));

const { chromium } = require("playwright");

describe("Browser Providers", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("LocalBrowserProvider", () => {
    it("should create instance with default options", () => {
      const provider = new LocalBrowserProvider({});
      expect(provider).toBeInstanceOf(LocalBrowserProvider);
      expect(provider.options).toBeUndefined();
      expect(provider.proxy).toBeNull();
    });

    it("should create instance with custom options and proxy", () => {
      const options = { args: ["--no-sandbox"] };
      const proxy = { host: "proxy.example.com", port: 8080 };

      const provider = new LocalBrowserProvider({ options, proxy });
      expect(provider.options).toEqual(options);
      expect(provider.proxy).toEqual(proxy);
    });

    it("should start browser with correct configuration", async () => {
      const mockBrowser = { close: jest.fn() } as unknown as Browser;
      chromium.launch.mockResolvedValue(mockBrowser);

      const provider = new LocalBrowserProvider({
        options: { args: ["--test-arg"] },
        proxy: { host: "proxy.test", port: 3128 },
      });

      const browser = await provider.start();

      expect(chromium.launch).toHaveBeenCalledWith({
        channel: "chrome",
        headless: true,
        args: ["--disable-blink-features=AutomationControlled", "--test-arg"],
        proxy: {
          server: "http://proxy.test:3128",
          username: undefined,
          password: undefined,
        },
      });
      expect(browser).toBe(mockBrowser);
      expect(provider.getSession()).toBe(mockBrowser);
    });

    it("should start browser without proxy when not provided", async () => {
      const mockBrowser = { close: jest.fn() } as unknown as Browser;
      chromium.launch.mockResolvedValue(mockBrowser);

      const provider = new LocalBrowserProvider({});
      await provider.start();

      expect(chromium.launch).toHaveBeenCalledWith({
        channel: "chrome",
        headless: true,
        args: ["--disable-blink-features=AutomationControlled"],
      });
    });

    it("should close browser", async () => {
      const mockBrowser = { close: jest.fn() } as unknown as Browser;
      chromium.launch.mockResolvedValue(mockBrowser);

      const provider = new LocalBrowserProvider({});
      await provider.start();
      await provider.close();

      expect(mockBrowser.close).toHaveBeenCalled();
    });

    it("should return null when no session", () => {
      const provider = new LocalBrowserProvider({});
      expect(provider.getSession()).toBeNull();
    });
  });

  describe("ServerlessBrowserProvider", () => {
    it("should create instance with required parameters", () => {
      const executablePath = "/usr/bin/chromium";
      const provider = new ServerlessBrowserProvider({ executablePath });

      expect(provider).toBeInstanceOf(ServerlessBrowserProvider);
      expect(provider.executablePath).toBe(executablePath);
      expect(provider.proxy).toBeNull();
    });

    it("should start browser with executable path", async () => {
      const mockBrowser = { close: jest.fn() } as unknown as Browser;
      chromium.launch.mockResolvedValue(mockBrowser);

      const executablePath = "/usr/bin/chromium";
      const provider = new ServerlessBrowserProvider({ executablePath });

      await provider.start();

      expect(chromium.launch).toHaveBeenCalledWith({
        headless: true,
        executablePath,
        args: ["--disable-blink-features=AutomationControlled"],
      });
    });

    it("should start browser with proxy configuration", async () => {
      const mockBrowser = { close: jest.fn() } as unknown as Browser;
      chromium.launch.mockResolvedValue(mockBrowser);

      const executablePath = "/usr/bin/chromium";
      const proxy = {
        host: "proxy.test",
        port: 8080,
        auth: { username: "user", password: "pass" },
      };

      const provider = new ServerlessBrowserProvider({ executablePath, proxy });
      await provider.start();

      expect(chromium.launch).toHaveBeenCalledWith({
        headless: true,
        executablePath,
        args: ["--disable-blink-features=AutomationControlled"],
        proxy: {
          server: "http://proxy.test:8080",
          username: "user",
          password: "pass",
        },
      });
    });
  });

  describe("RemoteBrowserProvider", () => {
    it("should create instance with WebSocket endpoint", () => {
      const wsEndpoint = "ws://localhost:9222";
      const provider = new RemoteBrowserProvider({ wsEndpoint });

      expect(provider).toBeInstanceOf(RemoteBrowserProvider);
      expect(provider.wsEndpoint).toBe(wsEndpoint);
    });

    it("should connect to remote browser", async () => {
      const mockBrowser = { close: jest.fn() } as unknown as Browser;
      chromium.connectOverCDP.mockResolvedValue(mockBrowser);

      const wsEndpoint = "ws://localhost:9222";
      const options = { timeout: 30000 };
      const provider = new RemoteBrowserProvider({ wsEndpoint, options });

      const browser = await provider.start();

      expect(chromium.connectOverCDP).toHaveBeenCalledWith(wsEndpoint, options);
      expect(browser).toBe(mockBrowser);
    });
  });

  describe("createBrowserProvider", () => {
    it("should create LocalBrowserProvider", () => {
      const config = { type: "local" as const };
      const provider = createBrowserProvider(config);
      expect(provider).toBeInstanceOf(LocalBrowserProvider);
    });

    it("should create ServerlessBrowserProvider", () => {
      const config = {
        type: "serverless" as const,
        executablePath: "/usr/bin/chromium",
      };
      const provider = createBrowserProvider(config);
      expect(provider).toBeInstanceOf(ServerlessBrowserProvider);
    });

    it("should create RemoteBrowserProvider", () => {
      const config = {
        type: "remote" as const,
        wsEndpoint: "ws://localhost:9222",
      };
      const provider = createBrowserProvider(config);
      expect(provider).toBeInstanceOf(RemoteBrowserProvider);
    });

    it("should throw error for unsupported type", () => {
      const config = { type: "unsupported" as any };
      expect(() => createBrowserProvider(config)).toThrow(
        "Unsupported browser provider type: unsupported"
      );
    });
  });
});
