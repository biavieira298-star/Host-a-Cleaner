import Stripe from 'npm:stripe@18.5.0';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';
import {
    parsePricePlanMap, planFromPriceIds, planLimits, requiredEnv, stripeObjectId, subscriptionPeriodEnd
} from '../_shared/stripe-plans.ts';

const stripe = new Stripe(requiredEnv('STRIPE_SECRET_KEY'), {
    httpClient: Stripe.createFetchHttpClient()
});
const pricePlanMap = parsePricePlanMap(requiredEnv('STRIPE_PRICE_PLAN_MAP'));
const supabase = createClient(
    requiredEnv('SUPABASE_URL'),
    requiredEnv('SUPABASE_SERVICE_ROLE_KEY'),
    { auth: { autoRefreshToken: false, persistSession: false } }
);
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

function response(body: Record<string, unknown>, status: number): Response {
    return Response.json(body, { status, headers: corsHeaders });
}

Deno.serve(async request => {
    if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
    if (request.method !== 'POST') return response({ error: 'Method not allowed' }, 405);

    const token = request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) return response({ error: 'Authentication required' }, 401);

    try {
        const { data: auth, error: authError } = await supabase.auth.getUser(token);
        if (authError || !auth.user) return response({ error: 'Invalid authentication' }, 401);

        let body: unknown;
        try {
            body = await request.json();
        } catch {
            return response({ error: 'Invalid JSON body' }, 400);
        }
        const sessionId = body && typeof body === 'object' && 'session_id' in body
            ? body.session_id
            : null;
        if (typeof sessionId !== 'string' || !/^cs_(test|live)_[a-zA-Z0-9]+$/.test(sessionId)) {
            return response({ error: 'Invalid checkout session ID' }, 400);
        }

        const session = await stripe.checkout.sessions.retrieve(sessionId);
        const email = session.customer_details?.email ?? session.customer_email;
        if (session.client_reference_id !== auth.user.id
            || !email || !auth.user.email
            || email.trim().toLowerCase() !== auth.user.email.trim().toLowerCase()) {
            return response({ error: 'Checkout session does not match the authenticated account' }, 403);
        }
        if (session.mode !== 'subscription' || session.status !== 'complete'
            || !['paid', 'no_payment_required'].includes(session.payment_status)) {
            return response({ error: 'Checkout payment is not complete' }, 409);
        }

        const subscriptionId = stripeObjectId(session.subscription);
        const customerId = stripeObjectId(session.customer);
        if (!subscriptionId || !customerId) {
            return response({ error: 'Checkout session has no subscription or customer' }, 409);
        }
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        if (!['active', 'trialing'].includes(subscription.status)
            || stripeObjectId(subscription.customer) !== customerId) {
            return response({ error: 'Subscription is not active' }, 409);
        }
        const plan = planFromPriceIds(subscription.items.data.map(item => item.price.id), pricePlanMap);

        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('stripe_subscription_id, stripe_subscription_event_created, stripe_checkout_session_created')
            .eq('id', auth.user.id)
            .maybeSingle();
        if (profileError) throw profileError;
        if (!profile) return response({ error: 'Profile not found' }, 404);

        const previousCheckout = profile.stripe_checkout_session_created;
        if (previousCheckout !== null && (previousCheckout > session.created
            || (previousCheckout === session.created && profile.stripe_subscription_id !== subscriptionId))) {
            return response({ error: 'A newer checkout is already associated with this profile' }, 409);
        }
        if (previousCheckout === null && profile.stripe_subscription_id
            && profile.stripe_subscription_id !== subscriptionId) {
            const previousSubscription = await stripe.subscriptions.retrieve(profile.stripe_subscription_id);
            if (previousSubscription.created >= subscription.created) {
                return response({ error: 'A newer subscription is already associated with this profile' }, 409);
            }
        }

        let update = supabase.from('profiles').update({
            ...planLimits(plan),
            stripe_customer_id: customerId,
            stripe_subscription_id: subscription.id,
            stripe_subscription_status: subscription.status,
            stripe_current_period_end: subscriptionPeriodEnd(subscription),
            stripe_cancel_at_period_end: subscription.cancel_at_period_end,
            stripe_checkout_session_created: session.created
        }).eq('id', auth.user.id);
        for (const column of [
            'stripe_subscription_id', 'stripe_subscription_event_created', 'stripe_checkout_session_created'
        ] as const) {
            const value = profile[column];
            update = value === null ? update.is(column, null) : update.eq(column, value);
        }
        const { data: updated, error: updateError } = await update.select('id').maybeSingle();
        if (updateError) throw updateError;
        if (!updated) return response({ error: 'Profile changed during synchronization; retry' }, 409);
        console.info(`Stripe checkout ${session.id} synchronized for user ${auth.user.id}.`);
        return response({ subscription_plan: plan, stripe_subscription_status: subscription.status }, 200);
    } catch (error) {
        console.error('Stripe subscription synchronization failed:', error);
        return response({ error: 'Subscription synchronization failed' }, 500);
    }
});
