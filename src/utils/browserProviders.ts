import {
  chromium,
  Browser,
  LaunchOptions,
  ConnectOverCDPOptions,
} from "playwright";
import { BrowserProvider, ProxyConfig } from "../types";

/**
 * Local browser provider that launches a Chrome instance locally
 */
export class LocalBrowserProvider extends BrowserProvider<Browser> {
  options: Omit<Omit<LaunchOptions, "headless">, "channel"> | undefined;
  session: Browser | undefined;
  proxy: ProxyConfig | null;

  constructor(params: {
    options?: Omit<Omit<LaunchOptions, "headless">, "channel">;
    proxy?: ProxyConfig;
  }) {
    super();
    this.options = params.options;
    this.proxy = params.proxy ?? null;
  }

  async start(): Promise<Browser> {
    const launchArgs = this.options?.args ?? [];
    const browser = await chromium.launch({
      ...(this.options ?? {}),
      channel: "chrome",
      headless: false,
      args: ["--disable-blink-features=AutomationControlled", ...launchArgs],
      ...(this.proxy == null
        ? {}
        : {
            proxy: {
              server: `http://${this.proxy.host}:${this.proxy.port}`,
              username: this.proxy.auth?.username,
              password: this.proxy.auth?.password,
            },
          }),
    });
    this.session = browser;
    return this.session;
  }

  async close(): Promise<void> {
    return await this.session?.close();
  }

  public getSession() {
    if (!this.session) {
      return null;
    }
    return this.session;
  }
}

/**
 * Serverless browser provider for environments like AWS Lambda
 */
export class ServerlessBrowserProvider extends BrowserProvider<Browser> {
  options: Omit<Omit<LaunchOptions, "headless">, "channel"> | undefined;
  session: Browser | undefined;
  executablePath: string;
  proxy: ProxyConfig | null;

  constructor(params: {
    options?: Omit<Omit<LaunchOptions, "headless">, "channel">;
    executablePath: string;
    proxy?: ProxyConfig;
  }) {
    super();
    this.options = params.options;
    this.executablePath = params.executablePath;
    this.proxy = params.proxy ?? null;
  }

  async start(): Promise<Browser> {
    const launchArgs = this.options?.args ?? [];
    const browser = await chromium.launch({
      ...(this.options ?? {}),
      headless: true,
      executablePath: this.executablePath,
      args: ["--disable-blink-features=AutomationControlled", ...launchArgs],
      ...(this.proxy == null
        ? {}
        : {
            proxy: {
              server: `http://${this.proxy.host}:${this.proxy.port}`,
              username: this.proxy.auth?.username,
              password: this.proxy.auth?.password,
            },
          }),
    });
    this.session = browser;
    return this.session;
  }

  async close(): Promise<void> {
    return await this.session?.close();
  }

  public getSession() {
    if (!this.session) {
      return null;
    }
    return this.session;
  }
}

/**
 * Remote browser provider that connects to an existing browser instance
 */
export class RemoteBrowserProvider extends BrowserProvider<Browser> {
  options: Omit<ConnectOverCDPOptions, "endpointURL"> | undefined;
  session: Browser | undefined;
  wsEndpoint: string;

  constructor(params: {
    wsEndpoint: string;
    options?: Omit<ConnectOverCDPOptions, "endpointURL">;
  }) {
    super();
    this.wsEndpoint = params.wsEndpoint;
    this.options = params.options;
  }

  async start(): Promise<Browser> {
    const browser = await chromium.connectOverCDP(
      this.wsEndpoint,
      this.options
    );
    this.session = browser;
    return this.session;
  }

  async close(): Promise<void> {
    return await this.session?.close();
  }

  public getSession() {
    if (!this.session) {
      return null;
    }
    return this.session;
  }
}

/**
 * Factory function to create a browser provider based on configuration
 */
export function createBrowserProvider(config: {
  type: "local";
  options?: Omit<Omit<LaunchOptions, "headless">, "channel">;
  proxy?: ProxyConfig;
}): LocalBrowserProvider;
export function createBrowserProvider(config: {
  type: "serverless";
  executablePath: string;
  options?: Omit<Omit<LaunchOptions, "headless">, "channel">;
  proxy?: ProxyConfig;
}): ServerlessBrowserProvider;
export function createBrowserProvider(config: {
  type: "remote";
  wsEndpoint: string;
  options?: Omit<ConnectOverCDPOptions, "endpointURL">;
}): RemoteBrowserProvider;
export function createBrowserProvider(
  config: any
): LocalBrowserProvider | ServerlessBrowserProvider | RemoteBrowserProvider {
  switch (config.type) {
    case "local":
      return new LocalBrowserProvider({
        options: config.options,
        proxy: config.proxy,
      });
    case "serverless":
      return new ServerlessBrowserProvider({
        options: config.options,
        executablePath: config.executablePath,
        proxy: config.proxy,
      });
    case "remote":
      return new RemoteBrowserProvider({
        wsEndpoint: config.wsEndpoint,
        options: config.options,
      });
    default:
      throw new Error(`Unsupported browser provider type: ${config.type}`);
  }
}
