const terminalStatuses = new Set(['canceled', 'incomplete_expired']);

export class StripeDeletionError extends Error {
    constructor(code, message) {
        super(message);
        this.code = code;
    }
}

function stripeId(value) {
    return typeof value === 'string' ? value : value?.id || null;
}

export async function removeStripeAccountData(stripe, supabase, profile, user) {
    const { data: job, error: jobError } = await supabase.from('account_deletion_jobs')
        .select('stripe_customer_ids, stripe_subscription_ids').eq('user_id', user.id).maybeSingle();
    if (jobError) throw jobError;
    if (!job || !Array.isArray(job.stripe_customer_ids) || !Array.isArray(job.stripe_subscription_ids)) {
        throw new StripeDeletionError('stripe_unverified', 'Deletion progress is unavailable');
    }

    const customerIds = new Set(job.stripe_customer_ids);
    const subscriptionIds = new Set(job.stripe_subscription_ids);
    const openSessions = new Set();
    const email = user.email?.trim();
    const normalizedEmail = email?.toLowerCase();
    let emailCustomerId = null;
    if (profile.stripe_customer_id) {
        customerIds.add(profile.stripe_customer_id);
    } else {
        if (!email) throw new StripeDeletionError('stripe_unverified', 'Account email is unavailable');
        const matches = [];
        for await (const customer of stripe.customers.list({ email, limit: 100 })) {
            matches.push(customer.id);
            if (matches.length > 1) {
                throw new StripeDeletionError('stripe_ambiguous', 'Multiple Stripe customers match the account email');
            }
        }
        if (matches.length) {
            emailCustomerId = matches[0];
            if (customerIds.size && !customerIds.has(emailCustomerId)) {
                throw new StripeDeletionError('stripe_ambiguous', 'Email customer differs from saved deletion targets');
            }
            customerIds.add(emailCustomerId);
        }
    }
    if (profile.stripe_subscription_id) subscriptionIds.add(profile.stripe_subscription_id);

    const subscriptions = new Map();
    async function addSubscription(id) {
        if (subscriptions.has(id)) return;
        const subscription = await stripe.subscriptions.retrieve(id);
        const customerId = stripeId(subscription.customer);
        if (!customerId) throw new StripeDeletionError('stripe_unverified', 'Subscription customer is unavailable');
        if (id === profile.stripe_subscription_id && profile.stripe_customer_id &&
            customerId !== profile.stripe_customer_id) {
            throw new StripeDeletionError('stripe_ambiguous', 'Profile Stripe identifiers do not match');
        }
        subscriptions.set(id, subscription);
        subscriptionIds.add(id);
        customerIds.add(customerId);
    }
    for (const id of [...subscriptionIds]) await addSubscription(id);
    if (!profile.stripe_customer_id && emailCustomerId && profile.stripe_subscription_id &&
        stripeId(subscriptions.get(profile.stripe_subscription_id).customer) !== emailCustomerId) {
        throw new StripeDeletionError('stripe_ambiguous', 'Email customer differs from the profile subscription');
    }

    let inspected = 0;
    for await (const session of stripe.checkout.sessions.list({ limit: 100 })) {
        inspected += 1;
        if (inspected > 10000) throw new Error('Too many checkout sessions to verify safely');
        const sessionEmail = session.customer_details?.email || session.customer_email;
        const customerId = stripeId(session.customer);
        if (session.mode === 'subscription' && session.status === 'open' &&
            !session.client_reference_id && !sessionEmail) {
            throw new StripeDeletionError('stripe_unverified', 'An unidentified checkout is still open');
        }
        const sameEmail = Boolean(sessionEmail && normalizedEmail &&
            sessionEmail.trim().toLowerCase() === normalizedEmail);
        const sameCustomer = Boolean(customerId && customerIds.has(customerId));
        if (sameCustomer && session.client_reference_id && session.client_reference_id !== user.id) {
            throw new StripeDeletionError('stripe_ambiguous', 'Stripe customer is linked to another checkout account');
        }
        const matches = session.client_reference_id === user.id || sameCustomer ||
            (!session.client_reference_id && sameEmail);
        if (!matches || session.mode !== 'subscription') continue;
        if (session.client_reference_id === user.id && customerId && !sameCustomer && !sameEmail) {
            throw new StripeDeletionError('stripe_ambiguous', 'Checkout customer cannot be verified');
        }
        if (!session.client_reference_id && !sameCustomer && profile.stripe_customer_id) {
            throw new StripeDeletionError('stripe_ambiguous', 'Email-only checkout cannot be attributed safely');
        }
        if (session.status === 'open') {
            openSessions.add(session.id);
            continue;
        }
        if (session.status === 'complete') {
            const id = stripeId(session.subscription);
            if (!id || !customerId) throw new StripeDeletionError('stripe_unverified', 'Checkout subscription is unavailable');
            if (!sameCustomer && session.client_reference_id !== user.id) {
                throw new StripeDeletionError('stripe_ambiguous', 'Checkout customer cannot be attributed safely');
            }
            await addSubscription(id);
            if (stripeId(subscriptions.get(id).customer) !== customerId) {
                throw new StripeDeletionError('stripe_ambiguous', 'Checkout and subscription customers do not match');
            }
        }
    }

    const customers = new Map();
    for (const id of customerIds) {
        const customer = await stripe.customers.retrieve(id);
        customers.set(id, customer);
        if (!customer.deleted) {
            for await (const subscription of stripe.subscriptions.list({ customer: id, status: 'all', limit: 100 })) {
                if (stripeId(subscription.customer) !== id) {
                    throw new StripeDeletionError('stripe_ambiguous', 'Subscription customer does not match');
                }
                subscriptions.set(subscription.id, subscription);
                subscriptionIds.add(subscription.id);
            }
        }
    }

    const paidPlan = ['starter', 'pro', 'business'].includes(
        String(profile.subscription_plan || '').trim().toLowerCase()
    );
    const unresolvedStatus = [profile.stripe_subscription_status, profile.subscription_status]
        .some(status => ['active', 'trialing', 'past_due', 'unpaid', 'incomplete', 'paused'].includes(
            String(status || '').trim().toLowerCase()
        ));
    if (!customerIds.size && !subscriptionIds.size && (paidPlan || unresolvedStatus)) {
        throw new StripeDeletionError('stripe_unverified', 'Paid subscription cannot be identified');
    }

    for (const [field, ids] of [['stripe_customer_id', customerIds], ['stripe_subscription_id', subscriptionIds]]) {
        for (const id of ids) {
            const { data, error } = await supabase.from('profiles').select('id')
                .eq(field, id).neq('id', user.id).limit(1);
            if (error) throw error;
            if (!Array.isArray(data)) throw new Error('Invalid Stripe association response');
            if (data.length) throw new StripeDeletionError('stripe_ambiguous', 'Stripe identifier belongs to another account');
        }
    }
    const { error: saveError } = await supabase.rpc('remember_account_deletion_stripe_targets', {
        p_user_id: user.id,
        p_customer_ids: [...customerIds],
        p_subscription_ids: [...subscriptionIds]
    });
    if (saveError) throw saveError;

    for (const id of openSessions) {
        const expired = await stripe.checkout.sessions.expire(id);
        if (expired.status !== 'expired') throw new Error('Checkout expiration was not confirmed');
    }
    for (const [id, subscription] of subscriptions) {
        if (!terminalStatuses.has(subscription.status)) {
            const canceled = await stripe.subscriptions.cancel(id);
            if (!terminalStatuses.has(canceled.status)) throw new Error('Subscription cancellation was not confirmed');
        }
    }
    for (const [id, customer] of customers) {
        if (!customer.deleted) {
            const removed = await stripe.customers.del(id);
            if (!removed.deleted || removed.id !== id) throw new Error('Customer deletion was not confirmed');
        }
    }
}

export async function removeAccountObjects(supabase, userId) {
    let previousBatch = null;
    for (;;) {
        const { data: objects, error } = await supabase.rpc('account_deletion_objects', { p_user_id: userId });
        if (error) throw error;
        if (!Array.isArray(objects)) throw new Error('Invalid storage manifest');
        if (!objects.length) return;
        const batch = JSON.stringify(objects);
        if (batch === previousBatch) throw new Error('Storage objects remain after removal');
        previousBatch = batch;
        const buckets = new Map();
        for (const object of objects) {
            if (!object.bucket_id || !object.name) throw new Error('Invalid storage object');
            if (!buckets.has(object.bucket_id)) buckets.set(object.bucket_id, []);
            buckets.get(object.bucket_id).push(object.name);
        }
        for (const [bucket, paths] of buckets) {
            const { data, error: removeError } = await supabase.storage.from(bucket).remove(paths);
            if (removeError) throw removeError;
            if (!Array.isArray(data) || data.length !== paths.length) {
                throw new Error('Storage did not confirm removal of every object');
            }
        }
    }
}
