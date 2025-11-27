/**
 * @fileoverview OpenTelemetry instrumentation setup
 * @module utils/otel
 */

import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import { Resource } from '@opentelemetry/resources';
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from '@opentelemetry/semantic-conventions';
import config from '../config/index.js';

/**
 * Initialize OpenTelemetry SDK
 * Must be called before any other imports to ensure auto-instrumentation works
 * @returns {NodeSDK} The initialized SDK instance
 */
export function initOtel() {
  const traceExporter = new OTLPTraceExporter({
    url: `${config.otel.collectorUrl}/v1/traces`,
  });

  const prometheusExporter = new PrometheusExporter({
    port: 9464,
    preventServerStart: false,
  });

  const sdk = new NodeSDK({
    resource: new Resource({
      [ATTR_SERVICE_NAME]: config.otel.serviceName,
      [ATTR_SERVICE_VERSION]: '1.0.0',
    }),
    traceExporter,
    metricReader: prometheusExporter,
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-fs': {
          enabled: false,
        },
        '@opentelemetry/instrumentation-http': {
          enabled: true,
        },
        '@opentelemetry/instrumentation-express': {
          enabled: true,
        },
        '@opentelemetry/instrumentation-pg': {
          enabled: true,
        },
        '@opentelemetry/instrumentation-ioredis': {
          enabled: true,
        },
        '@opentelemetry/instrumentation-pino': {
          enabled: true,
        },
      }),
    ],
  });

  sdk.start();

  // Graceful shutdown
  process.on('SIGTERM', () => {
    sdk
      .shutdown()
      .then(() => console.log('OTEL SDK shut down successfully'))
      .catch((error) => console.error('Error shutting down OTEL SDK', error))
      .finally(() => process.exit(0));
  });

  return sdk;
}

export default initOtel;
