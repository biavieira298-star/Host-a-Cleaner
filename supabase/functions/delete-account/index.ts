import Stripe from 'npm:stripe@18.5.0';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';
import { requiredEnv } from '../_shared/stripe-plans.ts';
import { removeAccountObjects, removeStripeAccountData, StripeDeletionError } from '../_shared/account-deletion.mjs';

const stripe = new Stripe(requiredEnv('STRIPE_SECRET_KEY'), {
    httpClient: Stripe.createFetchHttpClient()
});
const supabase = createClient(requiredEnv('SUPABASE_URL'), requiredEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { autoRefreshToken: false, persistSession: false }
});
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
        if (!body || typeof body !== 'object' || !('action' in body) ||
            (body.action !== 'status' && body.action !== 'delete')) {
            return response({ error: 'Invalid action' }, 400);
        }
        if (body.action === 'delete' && (!('confirmation' in body) || body.confirmation !== 'APAGAR')) {
            return response({ error: 'Confirmation required' }, 400);
        }

        const { data: profile, error: profileError } = await supabase.from('profiles')
            .select('role, subscription_plan, stripe_customer_id, stripe_subscription_id, stripe_subscription_status, subscription_status')
            .eq('id', auth.user.id).maybeSingle();
        if (profileError) throw profileError;
        if (!profile || !['admin', 'cleaner'].includes(profile.role)) {
            return response({ error: 'Invalid account role' }, 403);
        }
        if (body.action === 'status') return response({ allowed: true, role: profile.role }, 200);

        const { data: role, error: beginError } = await supabase.rpc('begin_account_deletion', { p_user_id: auth.user.id });
        if (beginError) throw beginError;
        if (role !== profile.role) throw new Error('Account role changed during deletion');
        if (role === 'admin') {
            const { data: currentProfile, error: currentProfileError } = await supabase.from('profiles')
                .select('role, subscription_plan, stripe_customer_id, stripe_subscription_id, stripe_subscription_status, subscription_status')
                .eq('id', auth.user.id).maybeSingle();
            if (currentProfileError) throw currentProfileError;
            if (!currentProfile || currentProfile.role !== 'admin') throw new Error('Account role changed during deletion');
            const cleanupStripe = async (): Promise<Response | null> => {
                try {
                    await removeStripeAccountData(stripe, supabase, currentProfile, auth.user);
                    return null;
                } catch (error) {
                    console.error('Stripe account cleanup failed:', error);
                    const code = error instanceof StripeDeletionError ? error.code : 'stripe_cleanup_failed';
                    return response({ error: 'Stripe cleanup could not be completed; the account was not deleted', code }, code === 'stripe_cleanup_failed' ? 503 : 409);
                }
            };
            const initialStripeError = await cleanupStripe();
            if (initialStripeError) return initialStripeError;
            await removeAccountObjects(supabase, auth.user.id);
            const finalStripeError = await cleanupStripe();
            if (finalStripeError) return finalStripeError;
        }
        const { error: finishError } = await supabase.rpc('finish_account_deletion', {
            p_user_id: auth.user.id, p_role: role
        });
        if (finishError) throw finishError;
        return response({ success: true }, 200);
    } catch (error) {
        console.error('Account deletion failed:', error);
        return response({ error: 'Account deletion failed; retry or contact support' }, 500);
    }
});
