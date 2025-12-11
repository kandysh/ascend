import { connect, NatsConnection, JSONCodec, StringCodec } from 'nats';

let nc: NatsConnection | null = null;
const jsonCodec = JSONCodec();
const stringCodec = StringCodec();

export async function createNatsClient(url?: string): Promise<NatsConnection> {
  if (nc) {
    return nc;
  }

  try {
    nc = await connect({
      servers: url || process.env.NATS_URL || 'nats://localhost:4222',
      maxReconnectAttempts: -1, // Reconnect forever
      reconnectTimeWait: 1000, // 1 second between reconnect attempts
    });

    console.log(`NATS connected to ${nc.getServer()}`);

    // Handle connection events
    (async () => {
      for await (const status of nc!.status()) {
        console.log(`NATS status: ${status.type}: ${status.data}`);
      }
    })();

    // Handle connection close
    nc.closed().then((err) => {
      if (err) {
        console.error('NATS connection closed with error:', err);
      } else {
        console.log('NATS connection closed');
      }
    });

    return nc;
  } catch (error) {
    console.error('Failed to connect to NATS:', error);
    throw error;
  }
}

export function getNatsClient(): NatsConnection {
  if (!nc) {
    throw new Error(
      'NATS client not initialized. Call createNatsClient first.',
    );
  }
  return nc;
}

export async function closeNatsClient(): Promise<void> {
  if (nc) {
    await nc.close();
    nc = null;
  }
}

export async function publishEvent<T = unknown>(
  subject: string,
  data: T,
): Promise<void> {
  const client = getNatsClient();
  const encoded = jsonCodec.encode(data);
  await client.publish(subject, encoded);
}

export async function subscribeToEvents<T = unknown>(
  subject: string,
  handler: (data: T) => void | Promise<void>,
): Promise<void> {
  const client = getNatsClient();
  const sub = client.subscribe(subject);

  (async () => {
    for await (const msg of sub) {
      try {
        const data = jsonCodec.decode(msg.data) as T;
        await handler(data);
      } catch (error) {
        console.error(`Error processing message on ${subject}:`, error);
      }
    }
  })();
}

export { jsonCodec, stringCodec };
export * from './events.js';
