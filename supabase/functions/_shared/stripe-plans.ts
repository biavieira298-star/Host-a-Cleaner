export type PaidPlan = 'starter' | 'pro' | 'business';
export type Plan = 'gratuito' | PaidPlan;

export function requiredEnv(name: string): string {
    const value = Deno.env.get(name);
    if (!value) throw new Error(`Missing required environment variable: ${name}`);
    return value;
}

export function parsePricePlanMap(value: string): Map<string, PaidPlan> {
    let parsed: unknown;
    try {
        parsed = JSON.parse(value);
    } catch (error) {
        throw new Error(`STRIPE_PRICE_PLAN_MAP must be valid JSON: ${String(error)}`);
    }

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('STRIPE_PRICE_PLAN_MAP must be a JSON object mapping price IDs to plans.');
    }

    const mapping = new Map<string, PaidPlan>();
    for (const [priceId, plan] of Object.entries(parsed)) {
        if (!priceId || !['starter', 'pro', 'business'].includes(String(plan))) {
            throw new Error(`Invalid Stripe price-to-plan mapping for price ${priceId}.`);
        }
        mapping.set(priceId, plan as PaidPlan);
    }
    if (mapping.size === 0) throw new Error('STRIPE_PRICE_PLAN_MAP must contain at least one price.');
    return mapping;
}

export function stripeObjectId(value: string | { id: string } | null): string | null {
    if (typeof value === 'string') return value;
    return value?.id ?? null;
}

export function stripeTimestampToIso(value: unknown): string | null {
    if (typeof value !== 'number' || !Number.isFinite(value)) return null;
    const date = new Date(value * 1000);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function subscriptionPeriodEnd(subscription: {
    current_period_end?: number;
    items: { data: Array<{ current_period_end?: number }> };
}): string | null {
    const itemEnds = subscription.items.data
        .map(item => item.current_period_end)
        .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
    return stripeTimestampToIso(itemEnds.length ? Math.min(...itemEnds) : subscription.current_period_end);
}

export function planFromPriceIds(priceIds: string[], pricePlanMap: Map<string, PaidPlan>): PaidPlan {
    const plans = new Set(priceIds.map(priceId => pricePlanMap.get(priceId)).filter(Boolean));
    if (plans.size !== 1) {
        throw new Error('The Stripe subscription price is missing from, or conflicts with, STRIPE_PRICE_PLAN_MAP.');
    }
    return [...plans][0]!;
}

export function planLimits(plan: Plan) {
    switch (plan) {
        case 'starter':
            return { subscription_plan: plan, max_properties: 4, max_cleaners: 3 };
        case 'pro':
            return { subscription_plan: plan, max_properties: 10, max_cleaners: null };
        case 'business':
            return { subscription_plan: plan, max_properties: 25, max_cleaners: null };
        default:
            return { subscription_plan: plan, max_properties: 1, max_cleaners: 1 };
    }
}
