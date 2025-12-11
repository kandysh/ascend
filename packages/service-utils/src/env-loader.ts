import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

/**
 * Loads .env file from repository root in non-production environments
 */
export function loadEnvFile(): void {
  if (process.env.NODE_ENV !== 'production') {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    // Navigate from packages/service-utils/dist to root
    config({ path: resolve(__dirname, '../../../../.env') });
  }
}

/**
 * Creates a base env schema with common properties
 */
export function createEnvSchema(
  serviceName: string,
  defaultPort: number,
  required: string[] = [],
  additional: Record<string, unknown> = {},
) {
  return {
    type: 'object',
    required,
    properties: {
      PORT: {
        type: 'number',
        default: defaultPort,
      },
      ...additional,
    },
  };
}
