import { FastifyPluginAsync } from 'fastify';
import '@fastify/swagger';

export interface ServiceConfig {
  name: string;
  port: number;
  title: string;
  description: string;
  tags?: Array<{ name: string; description: string }>;
  routes: Array<{
    plugin: FastifyPluginAsync;
    prefix: string;
  }>;
  envSchema?: Record<string, unknown>;
  requiresInternalAuth?: boolean;
  onInit?: (config: Record<string, unknown>) => void | Promise<void>;
}

export interface EnvConfig {
  PORT?: number;
  DATABASE_URL?: string;
  REDIS_URL?: string;
  NATS_URL?: string;
  INTERNAL_API_SECRET?: string;
  [key: string]: unknown;
}
