const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { pathToFileURL } = require('node:url');
const { stripTypeScriptTypes } = require('node:module');

const root = path.join(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'js', 'app.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const shared = import(pathToFileURL(path.join(root, 'supabase', 'functions', '_shared', 'account-deletion.mjs')));

function frontend(role = 'cleaner') {
    const calls = [];
    const entries = [
        { sequence: 1, userId: 'user' },
        { sequence: 2, userId: 'other' }
    ];
    const snapshots = new Set(['user', 'other']);
    const storage = new Map([
        ['host_cleaner_offline_queue', JSON.stringify([{ userId: 'user' }, { userId: 'other' }])],
        ['host_cleaner_operational_preferences_user', '{}'],
        ['host_cleaner_operational_preferences_other', '{}']
    ]);
    const elements = {};
    for (const id of ['account-delete-open', 'account-delete-status', 'account-delete-modal',
        'account-delete-description', 'account-delete-confirmation', 'account-delete-error', 'account-delete-submit']) {
        const hidden = new Set(['hidden']);
        elements[id] = {
            disabled: false, value: '', textContent: '',
            classList: { add: name => hidden.add(name), remove: name => hidden.delete(name), contains: name => hidden.has(name) },
            focus() {}
        };
    }
    const database = {
        transaction() {
            const transaction = {
                objectStore(name) {
                    if (name === 'snapshots') return { delete: userId => snapshots.delete(userId) };
                    return { openCursor() {
                        const request = {};
                        let index = 0;
                        const next = () => setImmediate(() => {
                            if (index >= entries.length) {
                                request.result = null;
                                request.onsuccess();
                                transaction.oncomplete();
                                return;
                            }
                            const item = entries[index++];
                            request.result = {
                                value: item,
                                delete: () => { entries.splice(entries.indexOf(item), 1); index--; },
                                continue: next
                            };
                            request.onsuccess();
                        });
                        next();
                        return request;
                    } };
                }
            };
            return transaction;
        }
    };
    let response = { data: { allowed: true, role }, error: null };
    const context = {
        document: { getElementById: id => elements[id] },
        window: { indexedDB: {} }, navigator: { onLine: true },
        currentUser: { id: 'user' }, userRole: role, profileRoleVerified: true,
        accountDeleteStatusRequestId: 0, accountDeleteInProgress: false, accountDeletionAllowed: true, syncPendingPromise: null,
        currentLang: 'pt', i18n: { pt: {
            account_delete_checking: 'checking', account_delete_blocked: 'blocked',
            account_delete_unavailable: 'unavailable', account_delete_cleaner: 'preserve history',
            account_delete_admin: 'delete all data', account_delete_failed: 'failed',
            account_delete_stripe_failed: 'Stripe failed', account_delete_stripe_ambiguous: 'Stripe ambiguous',
            account_delete_stripe_unverified: 'Stripe unverified',
            account_delete_local_failed: 'local cleanup failed'
        } },
        localStorage: {
            getItem: key => storage.has(key) ? storage.get(key) : null,
            setItem: (key, value) => storage.set(key, value),
            removeItem: key => storage.delete(key)
        },
        openOfflineDatabase: async () => database,
        supabaseClient: {
            functions: { invoke: async (name, options) => {
                calls.push([name, options.body.action]);
                return response;
            } },
            auth: { signOut: async () => { calls.push(['signOut']); return { error: null }; } }
        },
        setCurrentUser: user => { context.currentUser = user; },
        showLandingScreen: () => calls.push(['landing']),
        showToast: (...args) => calls.push(['toast', ...args]),
        console: { error() {} },
        AggregateError
    };
    const start = app.indexOf('async function loadAccountDeletionStatus()');
    const end = app.indexOf('function switchProfileTab(', start);
    assert.ok(start >= 0 && end > start);
    vm.createContext(context);
    vm.runInContext(app.slice(start, end), context);
    return { context, elements, calls, entries, snapshots, storage, respond: value => { response = value; } };
}

test('deletion is disabled when the backend refuses it or verification fails', async () => {
    const env = frontend('admin');
    env.respond({ data: { allowed: false, role: 'admin' }, error: null });
    await env.context.loadAccountDeletionStatus();
    assert.equal(env.elements['account-delete-open'].disabled, true);
    assert.equal(env.elements['account-delete-status'].textContent, 'blocked');
    env.respond({ data: null, error: new Error('Stripe unavailable') });
    await env.context.loadAccountDeletionStatus();
    assert.equal(env.elements['account-delete-open'].disabled, true);
    assert.equal(env.elements['account-delete-status'].textContent, 'unavailable');
});

test('Stripe errors are shown without clearing local data', async () => {
    for (const [code, message] of [
        ['stripe_cleanup_failed', 'Stripe failed'],
        ['stripe_ambiguous', 'Stripe ambiguous'],
        ['stripe_unverified', 'Stripe unverified']
    ]) {
        const env = frontend('admin');
        env.respond({ data: null, error: {
            context: { clone: () => ({ json: async () => ({ code }) }) }
        } });
        env.elements['account-delete-confirmation'].value = 'APAGAR';
        await env.context.deleteAccount({ preventDefault() {} });
        assert.equal(env.elements['account-delete-error'].textContent, message);
        assert.equal(env.entries.length, 2);
        assert.equal(env.calls.some(call => call[0] === 'signOut'), false);
    }
});

test('confirmation and role-specific warnings precede deletion', async () => {
    for (const [role, warning] of [['cleaner', 'preserve history'], ['admin', 'delete all data']]) {
        const env = frontend(role);
        await env.context.loadAccountDeletionStatus();
        env.context.openAccountDeleteModal();
        assert.equal(env.elements['account-delete-description'].textContent, warning);
        env.elements['account-delete-confirmation'].value = 'apagar';
        env.context.updateAccountDeleteConfirmation();
        assert.equal(env.elements['account-delete-submit'].disabled, true);
        await env.context.deleteAccount({ preventDefault() {} });
        assert.deepEqual(env.calls, [['delete-account', 'status']]);
    }
    assert.match(html, /id="account-delete-modal"[^>]*role="dialog"/);
});

test('successful deletion clears only the account data and returns to landing', async () => {
    const env = frontend();
    env.respond({ data: { success: true }, error: null });
    env.elements['account-delete-confirmation'].value = 'APAGAR';
    await env.context.deleteAccount({ preventDefault() {} });
    assert.deepEqual(env.entries.map(entry => entry.userId), ['other']);
    assert.deepEqual([...env.snapshots], ['other']);
    assert.deepEqual(JSON.parse(env.storage.get('host_cleaner_offline_queue')), [{ userId: 'other' }]);
    assert.equal(env.storage.has('host_cleaner_operational_preferences_user'), false);
    assert.equal(env.storage.has('host_cleaner_operational_preferences_other'), true);
    assert.deepEqual(env.calls, [['delete-account', 'delete'], ['signOut'], ['landing']]);
});

test('failed deletion retains local data and reports failure', async () => {
    const env = frontend();
    env.respond({ data: null, error: new Error('network failure') });
    env.elements['account-delete-confirmation'].value = 'APAGAR';
    await env.context.deleteAccount({ preventDefault() {} });
    assert.equal(env.entries.length, 2);
    assert.equal(env.snapshots.has('user'), true);
    assert.equal(env.elements['account-delete-error'].textContent, 'failed');
    assert.equal(env.calls.some(call => call[0] === 'signOut'), false);
});

test('a session changed during deletion is not signed out or cleared', async () => {
    const env = frontend();
    env.context.supabaseClient.functions.invoke = async () => {
        env.context.currentUser = { id: 'other' };
        return { data: { success: true }, error: null };
    };
    env.elements['account-delete-confirmation'].value = 'APAGAR';
    await env.context.deleteAccount({ preventDefault() {} });
    assert.equal(env.context.currentUser.id, 'other');
    assert.deepEqual(env.entries.map(entry => entry.userId), ['other']);
    assert.equal(env.calls.some(call => call[0] === 'signOut' || call[0] === 'landing'), false);
});

test('local cleanup failure is reported even though the deleted account is signed out', async () => {
    const env = frontend();
    env.respond({ data: { success: true }, error: null });
    env.storage.set('host_cleaner_offline_queue', 'invalid');
    env.elements['account-delete-confirmation'].value = 'APAGAR';
    await env.context.deleteAccount({ preventDefault() {} });
    assert.equal(env.storage.has('host_cleaner_operational_preferences_user'), false);
    assert.deepEqual(env.calls, [
        ['delete-account', 'delete'], ['signOut'], ['landing'], ['toast', 'local cleanup failed', 'error']
    ]);
});

function stripeFixture({ customers = [], subscriptions = [], sessions = [], otherProfiles = [] } = {}) {
    const calls = [];
    const job = { stripe_customer_ids: [], stripe_subscription_ids: [] };
    const failures = {};
    const stripe = {
        customers: {
            list: async function* ({ email }) { yield* customers.filter(c => !c.deleted && c.email === email); },
            retrieve: async id => {
                if (failures.retrieve) throw new Error('Stripe unavailable');
                const customer = customers.find(c => c.id === id);
                if (!customer) throw new Error('Customer not found');
                return customer;
            },
            del: async id => {
                calls.push(['delete', id]);
                const customer = customers.find(c => c.id === id);
                customer.deleted = true;
                if (failures.deleteAfterSuccess) throw new Error('Response lost');
                return { id, deleted: true };
            }
        },
        subscriptions: {
            list: async function* ({ customer }) { yield* subscriptions.filter(s => s.customer === customer); },
            retrieve: async id => {
                const subscription = subscriptions.find(s => s.id === id);
                if (!subscription) throw new Error('Subscription not found');
                return subscription;
            },
            cancel: async id => {
                calls.push(['cancel', id]);
                if (failures.cancel) throw new Error('Cancel failed');
                const subscription = subscriptions.find(s => s.id === id);
                subscription.status = 'canceled';
                return subscription;
            }
        },
        checkout: { sessions: {
            list: async function* () { yield* sessions; },
            expire: async id => {
                calls.push(['expire', id]);
                const session = sessions.find(s => s.id === id);
                session.status = 'expired';
                return session;
            }
        } }
    };
    const supabase = {
        from(table) {
            const filters = {};
            return {
                select() { return this; },
                eq(field, value) { filters[field] = value; return this; },
                neq() { return this; },
                async maybeSingle() { return { data: job, error: null }; },
                async limit() {
                    return { data: otherProfiles.filter(profile => Object.keys(filters).every(key => profile[key] === filters[key])), error: null };
                }
            };
        },
        rpc: async (name, args) => {
            calls.push(['save']);
            assert.equal(name, 'remember_account_deletion_stripe_targets');
            if (failures.save) return { error: new Error('Save failed') };
            job.stripe_customer_ids = [...new Set([...job.stripe_customer_ids, ...args.p_customer_ids])];
            job.stripe_subscription_ids = [...new Set([...job.stripe_subscription_ids, ...args.p_subscription_ids])];
            return { error: null };
        }
    };
    return { stripe, supabase, calls, job, failures };
}

const stripeUser = { id: 'user', email: 'user@example.test' };

test('Stripe cleanup expires checkouts, cancels all active subscriptions and removes the customer', async () => {
    const { removeStripeAccountData } = await shared;
    const env = stripeFixture({
        customers: [{ id: 'cus_one', email: stripeUser.email }],
        subscriptions: [
            { id: 'sub_one', customer: 'cus_one', status: 'active' },
            { id: 'sub_two', customer: 'cus_one', status: 'past_due' },
            { id: 'sub_done', customer: 'cus_one', status: 'canceled' }
        ],
        sessions: [{ id: 'cs_open', client_reference_id: 'user', mode: 'subscription', status: 'open' }]
    });
    const profile = { stripe_customer_id: 'cus_one', stripe_subscription_id: 'sub_one', subscription_plan: 'pro' };
    await removeStripeAccountData(env.stripe, env.supabase, profile, stripeUser);
    assert.deepEqual(env.calls, [['save'], ['expire', 'cs_open'], ['cancel', 'sub_one'], ['cancel', 'sub_two'], ['delete', 'cus_one']]);
    assert.deepEqual(env.job.stripe_customer_ids, ['cus_one']);
    assert.deepEqual(new Set(env.job.stripe_subscription_ids), new Set(['sub_one', 'sub_two', 'sub_done']));
    await removeStripeAccountData(env.stripe, env.supabase, profile, stripeUser);
    assert.equal(env.calls.filter(c => c[0] === 'cancel').length, 2);
    assert.equal(env.calls.filter(c => c[0] === 'delete').length, 1);
});

test('Stripe email fallback handles no, one and multiple matching customers', async () => {
    const { removeStripeAccountData } = await shared;
    const empty = stripeFixture();
    await removeStripeAccountData(empty.stripe, empty.supabase, { subscription_plan: 'free' }, stripeUser);
    assert.deepEqual(empty.calls, [['save']]);
    const single = stripeFixture({
        customers: [{ id: 'cus_one', email: stripeUser.email }],
        subscriptions: [{ id: 'sub_one', customer: 'cus_one', status: 'active' }]
    });
    await removeStripeAccountData(single.stripe, single.supabase, {}, stripeUser);
    assert.deepEqual(single.calls, [['save'], ['cancel', 'sub_one'], ['delete', 'cus_one']]);
    const multiple = stripeFixture({ customers: [
        { id: 'cus_one', email: stripeUser.email }, { id: 'cus_two', email: stripeUser.email }
    ] });
    await assert.rejects(removeStripeAccountData(multiple.stripe, multiple.supabase, {}, stripeUser), { code: 'stripe_ambiguous' });
    assert.deepEqual(multiple.calls, []);
});

test('Stripe cleanup refuses unverified or conflicting ownership before changing Stripe', async () => {
    const { removeStripeAccountData } = await shared;
    const cases = [
        [stripeFixture(), { subscription_plan: 'pro' }, stripeUser, 'stripe_unverified'],
        [stripeFixture(), {}, { id: 'user' }, 'stripe_unverified'],
        [stripeFixture({ sessions: [{ id: 'cs', mode: 'subscription', status: 'open' }] }), {}, stripeUser, 'stripe_unverified'],
        [stripeFixture({
            customers: [{ id: 'cus_one', email: stripeUser.email }],
            otherProfiles: [{ stripe_customer_id: 'cus_one' }]
        }), { stripe_customer_id: 'cus_one' }, stripeUser, 'stripe_ambiguous'],
        [stripeFixture({
            customers: [{ id: 'cus_one', email: stripeUser.email }, { id: 'cus_two', email: 'other@example.test' }],
            subscriptions: [{ id: 'sub_one', customer: 'cus_two', status: 'active' }]
        }), { stripe_customer_id: 'cus_one', stripe_subscription_id: 'sub_one' }, stripeUser, 'stripe_ambiguous']
    ];
    for (const [env, profile, user, code] of cases) {
        await assert.rejects(removeStripeAccountData(env.stripe, env.supabase, profile, user), { code });
        assert.deepEqual(env.calls, []);
    }
});

test('Stripe targets survive a lost deletion response and allow safe retry', async () => {
    const { removeStripeAccountData } = await shared;
    const env = stripeFixture({
        customers: [{ id: 'cus_one', email: stripeUser.email }],
        subscriptions: [{ id: 'sub_one', customer: 'cus_one', status: 'active' }]
    });
    env.failures.deleteAfterSuccess = true;
    await assert.rejects(removeStripeAccountData(env.stripe, env.supabase, {}, stripeUser), /Response lost/);
    assert.deepEqual(env.job.stripe_customer_ids, ['cus_one']);
    assert.deepEqual(env.job.stripe_subscription_ids, ['sub_one']);
    env.failures.deleteAfterSuccess = false;
    await removeStripeAccountData(env.stripe, env.supabase, {}, stripeUser);
    assert.equal(env.calls.filter(c => c[0] === 'delete').length, 1);
    assert.equal(env.calls.filter(c => c[0] === 'cancel').length, 1);
});

test('subscription-only profiles and completed checkouts identify their Stripe customer', async () => {
    const { removeStripeAccountData } = await shared;
    for (const profile of [{ stripe_subscription_id: 'sub_one' }, {}]) {
        const env = stripeFixture({
            customers: [{ id: 'cus_one', email: 'old@example.test' }],
            subscriptions: [{ id: 'sub_one', customer: 'cus_one', status: 'active' }],
            sessions: profile.stripe_subscription_id ? [] : [{
                id: 'cs_complete', mode: 'subscription', status: 'complete',
                client_reference_id: 'user', customer: 'cus_one', subscription: 'sub_one',
                customer_details: { email: stripeUser.email }
            }]
        });
        await removeStripeAccountData(env.stripe, env.supabase, profile, stripeUser);
        assert.deepEqual(env.calls, [['save'], ['cancel', 'sub_one'], ['delete', 'cus_one']]);
    }
});

test('Stripe cancellation and saving failures stop customer deletion', async () => {
    const { removeStripeAccountData } = await shared;
    for (const failure of ['save', 'cancel']) {
        const env = stripeFixture({
            customers: [{ id: 'cus_one', email: stripeUser.email }],
            subscriptions: [{ id: 'sub_one', customer: 'cus_one', status: 'active' }]
        });
        env.failures[failure] = true;
        await assert.rejects(removeStripeAccountData(env.stripe, env.supabase, {}, stripeUser));
        assert.equal(env.calls.some(call => call[0] === 'delete'), false);
        if (failure === 'save') assert.equal(env.calls.some(call => call[0] === 'cancel'), false);
    }
});

test('storage cleanup retries batches and surfaces incomplete removal', async () => {
    const { removeAccountObjects } = await shared;
    let objects = [{ bucket_id: 'photos', name: 'one' }, { bucket_id: 'photos', name: 'two' }];
    const client = {
        rpc: async () => ({ data: objects, error: null }),
        storage: { from: () => ({ remove: async names => {
            objects = objects.filter(item => !names.includes(item.name));
            return { data: names.map(name => ({ name })), error: null };
        } }) }
    };
    await removeAccountObjects(client, 'user');
    assert.deepEqual(objects, []);
    client.rpc = async () => ({ data: [{ bucket_id: 'photos', name: 'one' }], error: null });
    client.storage.from = () => ({ remove: async () => ({ data: [], error: null }) });
    await assert.rejects(removeAccountObjects(client, 'user'), /did not confirm/);
});

function backend({ role = 'cleaner', stripeErrorAt = 0, storageError = false, token = true } = {}) {
    const calls = [];
    let handler;
    let cleanupCount = 0;
    class Stripe {
        static createFetchHttpClient() { return {}; }
    }
    class StripeDeletionError extends Error {}
    const client = {
        auth: { getUser: async () => token
            ? { data: { user: { id: 'user', email: 'user@example.test' } }, error: null }
            : { data: { user: null }, error: new Error('invalid') } },
        from: () => ({ select() { return this; }, eq() { return this; }, async maybeSingle() {
            return { data: { role }, error: null };
        } }),
        rpc: async (name, args) => {
            calls.push([name, args.p_user_id]);
            return { data: name === 'begin_account_deletion' ? role : null, error: null };
        }
    };
    const context = {
        Stripe, createClient: () => client, requiredEnv: () => 'configured',
        StripeDeletionError,
        removeStripeAccountData: async () => {
            calls.push(['stripe']);
            cleanupCount++;
            if (cleanupCount === stripeErrorAt) throw new Error('Stripe unavailable');
        },
        removeAccountObjects: async () => {
            calls.push(['storage']);
            if (storageError) throw new Error('storage error');
        },
        Deno: { serve: fn => { handler = fn; } }, Request, Response,
        console: { error() {} }
    };
    vm.createContext(context);
    const edge = fs.readFileSync(path.join(root, 'supabase', 'functions', 'delete-account', 'index.ts'), 'utf8');
    vm.runInContext(stripTypeScriptTypes(edge, { mode: 'strip' }).replace(/^import[\s\S]*?;\r?\n/gm, ''), context);
    return {
        calls,
        request: body => handler(new Request('https://example.test', {
            method: 'POST', headers: { authorization: 'Bearer token', 'content-type': 'application/json' },
            body: JSON.stringify(body)
        }))
    };
}

test('backend validates identity and confirmation and preserves cleaner storage', { skip: !stripTypeScriptTypes }, async () => {
    const invalid = backend({ token: false });
    assert.equal((await invalid.request({ action: 'delete', confirmation: 'APAGAR' })).status, 401);
    const env = backend();
    assert.equal((await env.request({ action: 'delete', confirmation: 'no' })).status, 400);
    assert.equal((await env.request({ action: 'delete', confirmation: 'APAGAR', userId: 'other' })).status, 200);
    assert.deepEqual(env.calls, [['begin_account_deletion', 'user'], ['finish_account_deletion', 'user']]);
});

test('backend cleans Stripe before storage and never finalizes after an error', { skip: !stripTypeScriptTypes }, async () => {
    const paid = backend({ role: 'admin', stripeErrorAt: 1 });
    const stripeFailure = await paid.request({ action: 'delete', confirmation: 'APAGAR' });
    assert.equal(stripeFailure.status, 503);
    assert.equal((await stripeFailure.json()).code, 'stripe_cleanup_failed');
    assert.deepEqual(paid.calls, [['begin_account_deletion', 'user'], ['stripe']]);
    const failed = backend({ role: 'admin', storageError: true });
    assert.equal((await failed.request({ action: 'delete', confirmation: 'APAGAR' })).status, 500);
    assert.deepEqual(failed.calls, [['begin_account_deletion', 'user'], ['stripe'], ['storage']]);
    const race = backend({ role: 'admin', stripeErrorAt: 2 });
    assert.equal((await race.request({ action: 'delete', confirmation: 'APAGAR' })).status, 503);
    assert.deepEqual(race.calls, [['begin_account_deletion', 'user'], ['stripe'], ['storage'], ['stripe']]);
    const complete = backend({ role: 'admin' });
    assert.equal((await complete.request({ action: 'delete', confirmation: 'APAGAR' })).status, 200);
    assert.deepEqual(complete.calls, [['begin_account_deletion', 'user'], ['stripe'], ['storage'], ['stripe'], ['finish_account_deletion', 'user']]);
});

test('a checkout racing account deletion is retried or canceled after deletion', { skip: !stripTypeScriptTypes }, async () => {
    for (const deleted of [false, true]) {
        let handler;
        const canceled = [];
        class Stripe {
            static createFetchHttpClient() { return {}; }
            static createSubtleCryptoProvider() { return {}; }
            subscriptions = {
                retrieve: async () => ({ status: 'active' }),
                cancel: async id => { canceled.push(id); }
            };
            webhooks = { constructEventAsync: async () => ({
                id: 'evt', type: 'checkout.session.completed', created: 1,
                data: { object: {
                    mode: 'subscription', subscription: 'sub',
                    client_reference_id: '00000000-0000-0000-0000-000000000001'
                } }
            }) };
        }
        const client = {
            from: table => ({ select() { return this; }, eq() { return this; }, async maybeSingle() {
                return { data: table === 'account_deletion_tombstones' ? (deleted ? { user_id: 'user' } : null)
                    : table === 'account_deletion_jobs' ? { user_id: 'user' } : null, error: null };
            } })
        };
        const context = {
            Stripe, createClient: () => client, Response, console: { info() {}, warn() {}, error() {} },
            Deno: {
                env: { get: name => name === 'STRIPE_PRICE_PLAN_MAP' ? '{"price_pro":"pro"}' : 'configured' },
                serve: callback => { handler = callback; }
            }
        };
        const compile = source => stripTypeScriptTypes(source, { mode: 'strip' })
            .replace(/^import[\s\S]*?;\r?\n/gm, '').replace(/^export /gm, '');
        vm.createContext(context);
        vm.runInContext(compile(fs.readFileSync(path.join(root, 'supabase', 'functions', '_shared', 'stripe-plans.ts'), 'utf8')), context);
        vm.runInContext(compile(fs.readFileSync(path.join(root, 'supabase', 'functions', 'stripe-webhook', 'index.ts'), 'utf8')), context);
        const result = await handler(new Request('https://example.test', {
            method: 'POST', headers: { 'stripe-signature': 'test' }, body: '{}'
        }));
        assert.equal(result.status, deleted ? 200 : 500);
        assert.deepEqual(canceled, deleted ? ['sub'] : []);
    }
});
