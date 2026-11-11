import Stripe from 'npm:stripe@18.5.0';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';
import {
    parsePricePlanMap, planFromPriceIds, planLimits, requiredEnv, stripeObjectId, subscriptionPeriodEnd
} from '../_shared/stripe-plans.ts';

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
    eventCreated: number,
    sessionCreated: number,
    subscriptionId: string
): Promise<boolean> {
    const { data, error } = await supabase
        .from('profiles')
        .update(values)
        .eq('id', userId)
        .or(`stripe_subscription_event_created.is.null,stripe_subscription_event_created.lt.${eventCreated}`)
        .or(`stripe_checkout_session_created.is.null,stripe_checkout_session_created.lt.${sessionCreated},and(stripe_checkout_session_created.eq.${sessionCreated},stripe_subscription_id.eq.${subscriptionId})`)
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

    const plan = planFromPriceIds(subscription.items.data.map(item => item.price.id), pricePlanMap);
    const updated = await updateProfile(userId, {
        ...planLimits(plan),
        stripe_customer_id: customerId,
        stripe_subscription_id: subscription.id,
        stripe_subscription_status: subscription.status,
        stripe_current_period_end: subscriptionPeriodEnd(subscription),
        stripe_cancel_at_period_end: subscription.cancel_at_period_end,
        stripe_checkout_session_created: session.created,
        stripe_subscription_event_created: eventCreated
    }, eventCreated, session.created, subscription.id);
    if (!updated) console.warn(`Stripe event ${eventId} ignored: a newer subscription event was already processed.`);
}

async function handleSubscriptionChange(
    eventSubscription: Stripe.Subscription,
    eventCreated: number,
    deleted = false
): Promise<void> {
    const subscription = await stripe.subscriptions.retrieve(eventSubscription.id);
    const periodEnd = subscriptionPeriodEnd(subscription);
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
        const plan = planFromPriceIds(subscription.items.data.map(item => item.price.id), pricePlanMap);
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
