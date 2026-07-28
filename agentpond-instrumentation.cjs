"use strict";

require("dotenv/config");

const {
  LangChainInstrumentation,
} = require("@arizeai/openinference-instrumentation-langchain");
const { resourceFromAttributes } = require("@opentelemetry/resources");
const { BatchSpanProcessor } = require("@opentelemetry/sdk-trace-base");
const { NodeTracerProvider } = require("@opentelemetry/sdk-trace-node");
const CallbackManagerModule = require("@langchain/core/callbacks/manager");

let tracerProvider;
let startupPromise;
let shutdownPromise;

function startAgentPondTracing() {
  if (!process.env.FILES_SDK_PROVIDER || tracerProvider) {
    return Promise.resolve();
  }
  startupPromise ??= initializeAgentPondTracing();
  return startupPromise;
}

async function initializeAgentPondTracing() {
  const { createFilesSpanExporterFromRuntimeEnv } =
    await import("@agentpond/files-sdk/otel");

  tracerProvider = new NodeTracerProvider({
    resource: resourceFromAttributes({
      "service.name": "lightfeed-extractor-example",
    }),
    spanProcessors: [
      new BatchSpanProcessor(createFilesSpanExporterFromRuntimeEnv()),
    ],
  });
  tracerProvider.register();

  const instrumentation = new LangChainInstrumentation({ tracerProvider });
  instrumentation.manuallyInstrument(CallbackManagerModule);
}

function shutdownAgentPondTracing() {
  if (!tracerProvider) return Promise.resolve();
  shutdownPromise ??= tracerProvider.shutdown();
  return shutdownPromise;
}

module.exports = {
  shutdownAgentPondTracing,
  startAgentPondTracing,
};
