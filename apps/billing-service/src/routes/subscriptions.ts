import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getDbClient } from '@ascend/db';
import { getPlanLimits } from '../plan-limits.js';

interface CreateSubscriptionBody {
  tenantId: string;
  planType: 'free' | 'pro' | 'enterprise';
}

interface SubscriptionParams {
  id: string;
}

export async function subscriptionsRoutes(fastify: FastifyInstance) {
  const sql = getDbClient();

  fastify.post<{ Body: CreateSubscriptionBody }>(
    '/',
    {
      schema: {
        tags: ['subscriptions'],
        description: 'Create a new subscription for a tenant',
        body: {
          type: 'object',
          required: ['tenantId', 'planType'],
          properties: {
            tenantId: { type: 'string' },
            planType: { type: 'string', enum: ['free', 'pro', 'enterprise'] },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Body: CreateSubscriptionBody }>,
      reply: FastifyReply,
    ) => {
      const { tenantId, planType } = request.body;

      try {
        // Check if tenant already has an active subscription
        const [existing] = await sql`
          SELECT * FROM subscriptions
          WHERE tenant_id = ${tenantId} AND status = 'active'
          LIMIT 1
        `;

        if (existing) {
          return reply
            .code(400)
            .send({ error: 'Tenant already has an active subscription' });
        }

        // Create subscription (30-day billing cycle)
        const now = new Date();
        const periodEnd = new Date(now);
        periodEnd.setDate(periodEnd.getDate() + 30);

        const [subscription] = await sql`
          INSERT INTO subscriptions (
            tenant_id, plan_type, status, current_period_start, current_period_end
          )
          VALUES (
            ${tenantId}, ${planType}, 'active', ${now}, ${periodEnd}
          )
          RETURNING *
        `;

        const planLimits = getPlanLimits(planType);

        return reply.code(201).send({
          ...subscription,
          plan: {
            type: planType,
            displayName: planLimits.displayName,
            price: planLimits.price,
          },
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ error: 'Failed to create subscription' });
      }
    },
  );

  fastify.get(
    '/tenant/:tenantId',
    {
      schema: {
        tags: ['subscriptions'],
        description: 'Get subscription for a tenant',
        params: {
          type: 'object',
          properties: {
            tenantId: { type: 'string' },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: { tenantId: string } }>,
      reply: FastifyReply,
    ) => {
      const { tenantId } = request.params;

      try {
        const [subscription] = await sql`
          SELECT *
          FROM subscriptions
          WHERE tenant_id = ${tenantId}
          ORDER BY created_at DESC
          LIMIT 1
        `;

        if (!subscription) {
          return reply.code(404).send({ error: 'Subscription not found' });
        }

        const planLimits = getPlanLimits(subscription.plan_type);

        return reply.send({
          ...subscription,
          plan: {
            type: subscription.plan_type,
            displayName: planLimits.displayName,
            price: planLimits.price,
            requestsPerMonth: planLimits.requestsPerMonth,
            leaderboardsLimit: planLimits.leaderboardsLimit,
            apiKeysLimit: planLimits.apiKeysLimit,
          },
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ error: 'Failed to fetch subscription' });
      }
    },
  );

  fastify.patch<{ Params: SubscriptionParams; Body: { status: string } }>(
    '/:id/cancel',
    {
      schema: {
        tags: ['subscriptions'],
        description: 'Cancel a subscription',
        params: {
          type: 'object',
          properties: {
            id: { type: 'string' },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: SubscriptionParams }>,
      reply: FastifyReply,
    ) => {
      const { id } = request.params;

      try {
        const [subscription] = await sql`
          UPDATE subscriptions
          SET
            cancel_at_period_end = true,
            updated_at = NOW()
          WHERE id = ${id}
          RETURNING *
        `;

        if (!subscription) {
          return reply.code(404).send({ error: 'Subscription not found' });
        }

        return reply.send(subscription);
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ error: 'Failed to cancel subscription' });
      }
    },
  );

  fastify.get(
    '/:id/usage-check',
    {
      schema: {
        tags: ['subscriptions'],
        description: 'Check if tenant is within usage limits',
        params: {
          type: 'object',
          properties: {
            id: { type: 'string' },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: SubscriptionParams }>,
      reply: FastifyReply,
    ) => {
      const { id } = request.params;

      try {
        const [subscription] = await sql`
          SELECT *
          FROM subscriptions
          WHERE id = ${id}
          LIMIT 1
        `;

        if (!subscription) {
          return reply.code(404).send({ error: 'Subscription not found' });
        }

        const planLimits = getPlanLimits(subscription.plan_type);

        // Get current month usage
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const [usage] = await sql`
          SELECT
            COALESCE(SUM(total_requests), 0) as total_requests
          FROM usage_records
          WHERE tenant_id = ${subscription.tenant_id}
            AND date >= ${startOfMonth}
        `;

        // Get current leaderboard count
        const [leaderboardCount] = await sql`
          SELECT COUNT(*) as count
          FROM leaderboards lb
          JOIN projects p ON lb.project_id = p.id
          WHERE p.tenant_id = ${subscription.tenant_id}
        `;

        // Get current API key count
        const [apiKeyCount] = await sql`
          SELECT COUNT(*) as count
          FROM api_keys ak
          JOIN projects p ON ak.project_id = p.id
          WHERE p.tenant_id = ${subscription.tenant_id}
            AND ak.revoked_at IS NULL
        `;

        const withinLimits = {
          requests: usage.total_requests < planLimits.requestsPerMonth,
          leaderboards: leaderboardCount.count < planLimits.leaderboardsLimit,
          apiKeys: apiKeyCount.count < planLimits.apiKeysLimit,
        };

        return reply.send({
          subscription: {
            id: subscription.id,
            planType: subscription.plan_type,
            status: subscription.status,
          },
          usage: {
            requests: {
              current: Number(usage.total_requests),
              limit: planLimits.requestsPerMonth,
              withinLimit: withinLimits.requests,
            },
            leaderboards: {
              current: Number(leaderboardCount.count),
              limit: planLimits.leaderboardsLimit,
              withinLimit: withinLimits.leaderboards,
            },
            apiKeys: {
              current: Number(apiKeyCount.count),
              limit: planLimits.apiKeysLimit,
              withinLimit: withinLimits.apiKeys,
            },
          },
          withinAllLimits:
            withinLimits.requests &&
            withinLimits.leaderboards &&
            withinLimits.apiKeys,
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ error: 'Failed to check usage' });
      }
    },
  );
}
