// Plan limits configuration
export const PLAN_LIMITS = {
  free: {
    displayName: 'Free',
    price: 0,
    requestsPerMonth: 10000,
    leaderboardsLimit: 5,
    apiKeysLimit: 2,
  },
  pro: {
    displayName: 'Pro',
    price: 49,
    requestsPerMonth: 1000000,
    leaderboardsLimit: 50,
    apiKeysLimit: 10,
  },
  enterprise: {
    displayName: 'Enterprise',
    price: 499,
    requestsPerMonth: 10000000,
    leaderboardsLimit: 9999,
    apiKeysLimit: 9999,
  },
} as const;

export type PlanType = keyof typeof PLAN_LIMITS;

export function getPlanLimits(planType: PlanType) {
  return PLAN_LIMITS[planType];
}
