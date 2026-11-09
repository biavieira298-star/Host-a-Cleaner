import Stripe from 'npm:stripe@18.5.0';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

type PaidPlan = 'starter' | 'pro' | 'business';
type Plan = 'gratuito' | PaidPlan;

const requiredEnv = (name: string): string => {
    const value = Deno.env.get(name);
    if (!value) throw new Error(`Missing required environment variable: ${name}`);
    return value;
};

const stripe = new Stripe(requiredEnv('STRIPE_SECRET_KEY'), {
    httpClient: Stripe.createFetchHttpClient()
});
const stripeWebhookSecret = requiredEnv('STRIPE_WEBHOOK_SECRET');
const pricePlanMap = parsePricePlanMap(requiredEnv('STRIPE_PRICE_PLAN_MAP'));
const supabase = createClient(
    requiredEnv('SUPABASE_URL'),
    requiredEnv('SUPABASE_SERVICE_ROLE_KEY'),
    { auth: { autoRefreshToken: false, persistSession: false } }
);
const cryptoProvider = Stripe.createSubtleCryptoProvider();

function parsePricePlanMap(value: string): Map<string, PaidPlan> {
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

function stripeObjectId(value: string | { id: string } | null): string | null {
    if (typeof value === 'string') return value;
    return value?.id ?? null;
}

function planFromPriceIds(priceIds: string[]): PaidPlan {
    const plans = new Set(priceIds.map(priceId => pricePlanMap.get(priceId)).filter(Boolean));
    if (plans.size !== 1) {
        throw new Error('The Stripe subscription price is missing from, or conflicts with, STRIPE_PRICE_PLAN_MAP.');
    }
    return [...plans][0]!;
}

function planLimits(plan: Plan) {
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

async function stripeCustomerEmail(customerId: string | null, sessionEmail?: string | null): Promise<string | null> {
    if (sessionEmail) return sessionEmail.trim().toLowerCase();
    if (!customerId) return null;

    const customer = await stripe.customers.retrieve(customerId);
    return 'deleted' in customer || !customer.email ? null : customer.email.trim().toLowerCase();
}

async function findUserIdByEmail(email: string): Promise<string | null> {
    const normalizedEmail = email.trim().toLowerCase();
    for (let page = 1; ; page += 1) {
        const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
        if (error) throw error;
        const user = data.users.find(candidate => candidate.email?.trim().toLowerCase() === normalizedEmail);
        if (user) return user.id;
        if (data.users.length < 1000) return null;
    }
}

async function resolveCheckoutUserId(session: Stripe.Checkout.Session, email: string): Promise<string | null> {
    const referencedUserId = session.client_reference_id;
    if (!referencedUserId) return findUserIdByEmail(email);

    const { data, error } = await supabase.auth.admin.getUserById(referencedUserId);
    if (error) {
        if (error.status === 404) return null;
        throw error;
    }
    const accountEmail = data.user?.email?.trim().toLowerCase();
    return accountEmail === email ? data.user?.id ?? null : null;
}

async function updateProfile(
    userId: string,
    values: Record<string, unknown>,
    eventCreated: number
): Promise<boolean> {
    const { data, error } = await supabase
        .from('profiles')
        .update(values)
        .eq('id', userId)
        .or(`stripe_subscription_event_created.is.null,stripe_subscription_event_created.lt.${eventCreated}`)
        .select('id')
        .maybeSingle();
    if (error) throw error;
    if (data) return true;

    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', userId)
        .maybeSingle();
    if (profileError) throw profileError;
    if (!profile) throw new Error(`No profile found for authenticated user ${userId}.`);
    return false;
}

async function handleCheckoutCompleted(
    session: Stripe.Checkout.Session,
    eventId: string,
    eventCreated: number
): Promise<void> {
    if (session.mode !== 'subscription' || !session.subscription) return;

    const customerId = stripeObjectId(session.customer);
    const subscriptionId = stripeObjectId(session.subscription);
    if (!subscriptionId) return;

    const email = await stripeCustomerEmail(
        customerId,
        session.customer_details?.email ?? session.customer_email
    );
    if (!email) {
        console.warn(`Stripe event ${eventId} ignored: Checkout session has no customer email.`);
        return;
    }

    const userId = await resolveCheckoutUserId(session, email);
    if (!userId) {
        console.warn(`Stripe event ${eventId} ignored: customer email does not match a Host a Cleaner account.`);
        return;
    }

    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    if (subscription.status !== 'active' && subscription.status !== 'trialing') {
        console.warn(`Stripe event ${eventId} ignored: subscription is ${subscription.status}.`);
        return;
    }

    const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 100 });
    const plan = planFromPriceIds(lineItems.data.flatMap(item => item.price?.id ? [item.price.id] : []));
    const updated = await updateProfile(userId, {
        ...planLimits(plan),
        stripe_customer_id: customerId,
        stripe_subscription_id: subscription.id,
        stripe_subscription_status: subscription.status,
        stripe_current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
        stripe_cancel_at_period_end: subscription.cancel_at_period_end,
        stripe_subscription_event_created: eventCreated
    }, eventCreated);
    if (!updated) console.warn(`Stripe event ${eventId} ignored: a newer subscription event was already processed.`);
}

async function handleSubscriptionChange(
    subscription: Stripe.Subscription,
    eventCreated: number,
    deleted = false
): Promise<void> {
    const periodEnd = subscription.current_period_end
        ? new Date(subscription.current_period_end * 1000).toISOString()
        : null;
    const values: Record<string, unknown> = {
        stripe_subscription_status: deleted ? 'canceled' : subscription.status,
        stripe_current_period_end: periodEnd,
        stripe_cancel_at_period_end: deleted ? false : subscription.cancel_at_period_end,
        stripe_subscription_event_created: eventCreated
    };

    if (deleted || !['active', 'trialing', 'past_due'].includes(subscription.status)) {
        Object.assign(values, planLimits('gratuito'));
        if (deleted || subscription.status === 'canceled') values.stripe_subscription_id = null;
    } else if (subscription.status === 'active' || subscription.status === 'trialing') {
        const plan = planFromPriceIds(subscription.items.data.map(item => item.price.id));
        Object.assign(values, planLimits(plan));
    }

    const { data, error } = await supabase
        .from('profiles')
        .update(values)
        .eq('stripe_subscription_id', subscription.id)
        .or(`stripe_subscription_event_created.is.null,stripe_subscription_event_created.lt.${eventCreated}`)
        .select('id');
    if (error) throw error;
    if (!data.length) {
        console.warn(`Stripe subscription ${subscription.id} is not linked to a profile or its event is stale.`);
    }
}

Deno.serve(async request => {
    if (request.method !== 'POST') {
        return new Response('Method not allowed', { status: 405, headers: { Allow: 'POST' } });
    }

    const signature = request.headers.get('stripe-signature');
    if (!signature) return new Response('Missing Stripe signature', { status: 400 });

    let event: Stripe.Event;
    try {
        event = await stripe.webhooks.constructEventAsync(
            await request.text(),
            signature,
            stripeWebhookSecret,
            undefined,
            cryptoProvider
        );
    } catch (error) {
        console.error('Stripe webhook signature verification failed:', error);
        return new Response('Invalid Stripe signature', { status: 400 });
    }

    try {
        switch (event.type) {
            case 'checkout.session.completed':
            case 'checkout.session.async_payment_succeeded':
                await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session, event.id, event.created);
                break;
            case 'customer.subscription.updated':
                await handleSubscriptionChange(event.data.object as Stripe.Subscription, event.created);
                break;
            case 'customer.subscription.deleted':
                await handleSubscriptionChange(event.data.object as Stripe.Subscription, event.created, true);
                break;
            default:
                console.info(`Stripe event ${event.type} received and ignored.`);
        }
    } catch (error) {
        console.error(`Stripe event ${event.id} could not be processed:`, error);
        return new Response('Webhook processing failed', { status: 500 });
    }

    return Response.json({ received: true });
});
