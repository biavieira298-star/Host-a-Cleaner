const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { stripTypeScriptTypes } = require('node:module');

const root = path.join(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'js', 'app.js'), 'utf8');

function extract(source, start, end) {
    const first = source.indexOf(start);
    const last = source.indexOf(end, first);
    assert.ok(first >= 0 && last > first);
    return source.slice(first, last);
}

function frontend({ profile = { subscription_plan: 'pro', stripe_subscription_status: 'active' }, queryError = null, syncError = null } = {}) {
    const buttons = ['gratuito', 'starter', 'pro', 'business'].map(plan => ({
        dataset: { subscriptionPlan: plan }, disabled: false, textContent: ''
    }));
    const status = { textContent: '' };
    const toasts = [];
    const tabs = [];
    const invoked = [];
    let replacedUrl;
    const context = {
        URL, console: { error() {} },
        currentUser: { id: 'user-1' },
        subscriptionLoadRequestId: 0,
        stripeCheckoutSyncPromise: null,
        currentLang: 'pt',
        i18n: { pt: {
            subscription_loading: 'loading', subscription_load_error: 'load error',
            subscription_free: 'Gratuito', subscription_current: 'Plano Atual',
            subscription_subscribe: 'Subscrever', subscription_status_label: 'Estado',
            subscription_no_status: 'Sem subscrição Stripe',
            subscription_sync_success: 'synchronized', subscription_sync_error: 'sync error'
        } },
        document: {
            title: 'App',
            getElementById: () => status,
            querySelectorAll: () => buttons
        },
        window: {
            location: { href: 'https://example.test/index.html?session_id=cs_test_123&other=1' },
            history: { replaceState: (_state, _title, url) => { replacedUrl = url; } }
        },
        supabaseClient: {
            from: () => ({
                select() { return this; },
                eq() { return this; },
                async maybeSingle() { return { data: profile, error: queryError }; }
            }),
            functions: { async invoke(name, options) { invoked.push([name, options]); return { error: syncError }; } }
        },
        showToast: (...args) => toasts.push(args),
        switchTab: tab => tabs.push(tab)
    };
    vm.createContext(context);
    vm.runInContext(extract(app, 'async function loadSubscriptionPlan()', 'function getOperationalPreferencesStorageKey()'), context);
    return { context, buttons, status, toasts, tabs, invoked, getReplacedUrl: () => replacedUrl };
}

test('subscription view reads the profile and marks only its actual plan', async () => {
    const { context, buttons, status } = frontend();
    await context.loadSubscriptionPlan();
    assert.equal(status.textContent, 'Pro · Estado: active');
    assert.equal(buttons[2].textContent, 'Plano Atual');
    assert.equal(buttons[2].disabled, true);
    assert.equal(buttons[0].textContent, 'Gratuito');
    assert.equal(buttons[1].disabled, false);
});

test('a failed profile read does not claim that a plan is active', async () => {
    const { context, buttons, status } = frontend({ queryError: new Error('denied') });
    await context.loadSubscriptionPlan();
    assert.equal(status.textContent, 'load error');
    assert.ok(buttons.every(button => button.disabled));
});

test('checkout return invokes synchronization and removes its ID only on success', async () => {
    const successful = frontend();
    await successful.context.syncStripeCheckout();
    assert.equal(successful.invoked[0][0], 'stripe-sync-subscription');
    assert.equal(successful.invoked[0][1].body.session_id, 'cs_test_123');
    assert.equal(successful.getReplacedUrl(), 'https://example.test/index.html?other=1');
    assert.deepEqual(successful.tabs, ['sub-subscriptions']);

    const failed = frontend({ syncError: new Error('pending') });
    await failed.context.syncStripeCheckout();
    assert.equal(failed.getReplacedUrl(), undefined);
    assert.equal(failed.toasts[0][1], 'error');
    assert.deepEqual(failed.tabs, []);
});

function successPage({ url = 'https://example.test/app/status-success.html?session_id=cs_test_123', session = { user: { id: 'user-1' } }, sessionAfterSync = session, syncError = null, lang = 'pt' } = {}) {
    const elements = {
        'payment-title': { textContent: '' },
        'payment-message': { textContent: '' },
        'payment-spinner': { hidden: false },
        'return-to-dashboard': { hidden: true, href: 'index.html' }
    };
    const calls = [];
    let timer;
    let destination;
    let authReads = 0;
    const context = {
        URL, Object, console: { error() {}, warn() {} },
        document: { getElementById: id => elements[id], documentElement: {} },
        SUPABASE_URL: 'https://supabase.example.test', SUPABASE_KEY: 'public-key',
        supabase: { createClient: () => ({
            auth: { getSession: async () => ({ data: { session: authReads++ === 0 ? session : sessionAfterSync }, error: null }) },
            functions: { invoke: async (name, options) => {
                calls.push([name, options]);
                return { data: { subscription_plan: 'pro', stripe_subscription_status: 'active' }, error: syncError };
            } }
        }) },
        localStorage: { getItem: () => lang, setItem: (...args) => calls.push(['storage', ...args]) },
        window: {
            location: { href: url, replace: value => { destination = value; } },
            setTimeout: callback => { timer = callback; }
        }
    };
    vm.createContext(context);
    const script = fs.readFileSync(path.join(root, 'js', 'status-success.js'), 'utf8');
    vm.runInContext(script.replace('void confirmStripePayment();', ''), context);
    return { context, elements, calls, redirect: () => timer?.(), destination: () => destination };
}

test('return page confirms the checkout, shows the plan, and redirects to the dashboard', async () => {
    const page = successPage();
    await page.context.confirmStripePayment();
    assert.equal(page.calls[0][0], 'stripe-sync-subscription');
    assert.equal(page.calls[0][1].body.session_id, 'cs_test_123');
    assert.match(page.elements['payment-message'].textContent, /Pro ativo/);
    assert.equal(page.elements['payment-spinner'].hidden, true);
    assert.deepEqual(page.calls[1], ['storage', 'host_cleaner_active_tab', 'sub-subscriptions']);
    page.redirect();
    assert.equal(page.destination(), 'https://example.test/app/index.html');
});

test('return page reports missing sessions and failed reconciliation without redirecting', async () => {
    for (const options of [
        { url: 'https://example.test/app/status-success.html' },
        { syncError: new Error('Stripe unavailable') },
        { sessionAfterSync: { user: { id: 'another-user' } } }
    ]) {
        const page = successPage(options);
        await page.context.confirmStripePayment();
        assert.match(page.elements['payment-title'].textContent, /Não foi possível/);
        assert.equal(page.elements['return-to-dashboard'].hidden, false);
        assert.equal(page.elements['payment-spinner'].hidden, true);
        page.redirect();
        assert.equal(page.destination(), undefined);
        if (options.url) assert.equal(page.calls.length, 0);
    }
});

test('return page uses the saved language preference', async () => {
    const page = successPage({ lang: 'en' });
    await page.context.confirmStripePayment();
    assert.equal(page.context.document.documentElement.lang, 'en');
    assert.match(page.elements['payment-message'].textContent, /Plan Pro active/);
    assert.equal(page.elements['return-to-dashboard'].textContent, 'Return to dashboard');
});

test('return page preserves the checkout for users who must sign in', async () => {
    const page = successPage({ session: null });
    await page.context.confirmStripePayment();
    assert.match(page.elements['payment-message'].textContent, /Inicia sessão/);
    assert.equal(page.elements['return-to-dashboard'].href, 'https://example.test/app/index.html?session_id=cs_test_123');
    assert.equal(page.calls.length, 0);
});

test('service worker caches the return page separately from the dashboard, including its route alias', async () => {
    const handlers = {};
    const matches = [];
    const cache = {
        async match(key) { matches.push(key.url || String(key)); return new Response('return page'); },
        async put() {}
    };
    const context = {
        URL, Request, Response, console,
        self: {
            location: { origin: 'https://example.test' },
            registration: { scope: 'https://example.test/app/' },
            addEventListener: (name, handler) => { handlers[name] = handler; }
        },
        caches: { open: async () => cache },
        fetch: async () => new Response('return page')
    };
    vm.createContext(context);
    vm.runInContext(fs.readFileSync(path.join(root, 'sw.js'), 'utf8'), context);
    for (const route of ['status-success.html', 'status-success']) {
        let response;
        let background;
        handlers.fetch({
            request: { method: 'GET', mode: 'navigate', url: `https://example.test/app/${route}?session_id=cs_test_123` },
            respondWith: promise => { response = promise; },
            waitUntil: promise => { background = promise; }
        });
        await response;
        await background;
    }
    assert.deepEqual(matches, [
        'https://example.test/app/status-success.html',
        'https://example.test/app/status-success.html'
    ]);
});

function backend(options = {}) {
    const session = {
        id: 'cs_test_123', created: 100, client_reference_id: 'user-1',
        customer_details: { email: 'user@example.test' }, customer: 'cus_1',
        subscription: 'sub_1', mode: 'subscription', status: 'complete', payment_status: 'paid',
        ...options.session
    };
    const subscription = {
        id: 'sub_1', created: 100, customer: 'cus_1', status: 'active',
        items: { data: [{ price: { id: 'price_pro' }, current_period_end: 200 }] },
        cancel_at_period_end: false,
        ...options.subscription
    };
    const profile = {
        stripe_subscription_id: null, stripe_subscription_event_created: null,
        stripe_checkout_session_created: null, ...options.profile
    };
    const writes = [];
    let handler;
    class Stripe {
        static createFetchHttpClient() { return {}; }
        checkout = { sessions: { retrieve: async () => session } };
        subscriptions = { retrieve: async id => id === subscription.id ? subscription : {
            id, created: options.previousSubscriptionCreated ?? 99
        } };
    }
    const client = {
        auth: { getUser: async token => token === 'valid'
            ? { data: { user: { id: 'user-1', email: 'user@example.test' } }, error: null }
            : { data: { user: null }, error: new Error('invalid') } },
        from() {
            let values;
            const filters = [];
            return {
                select() { return this; },
                update(data) { values = data; return this; },
                eq(column, value) { filters.push([column, value]); return this; },
                is(column, value) { filters.push([column, value]); return this; },
                async maybeSingle() {
                    if (!values) return { data: { ...profile }, error: null };
                    if (options.concurrentChange) profile.stripe_subscription_event_created = 101;
                    if (filters.some(([column, value]) => column !== 'id' && profile[column] !== value)) {
                        return { data: null, error: null };
                    }
                    Object.assign(profile, values);
                    writes.push(values);
                    return { data: { id: 'user-1' }, error: null };
                }
            };
        }
    };
    const context = {
        Stripe, createClient: () => client, Response, console: { info() {}, error() {} },
        Deno: {
            env: { get: name => name === 'STRIPE_PRICE_PLAN_MAP' ? '{"price_pro":"pro"}' : 'configured' },
            serve: callback => { handler = callback; }
        }
    };
    vm.createContext(context);
    const shared = fs.readFileSync(path.join(root, 'supabase', 'functions', '_shared', 'stripe-plans.ts'), 'utf8');
    const edge = fs.readFileSync(path.join(root, 'supabase', 'functions', 'stripe-sync-subscription', 'index.ts'), 'utf8');
    const compile = source => stripTypeScriptTypes(source, { mode: 'strip' })
        .replace(/^import[\s\S]*?;\r?\n/gm, '').replace(/^export /gm, '');
    vm.runInContext(compile(shared), context);
    vm.runInContext(compile(edge), context);
    return {
        writes, profile,
        request: (token = 'valid', sessionId = 'cs_test_123') => handler(new Request('https://example.test', {
            method: 'POST', headers: { authorization: `Bearer ${token}` },
            body: JSON.stringify({ session_id: sessionId })
        }))
    };
}

test('verified checkout updates the authenticated profile using current subscription prices', { skip: !stripTypeScriptTypes }, async () => {
    const fixture = backend();
    const response = await fixture.request();
    assert.equal(response.status, 200);
    assert.equal(fixture.writes.length, 1);
    assert.equal(fixture.profile.subscription_plan, 'pro');
    assert.equal(fixture.profile.max_properties, 10);
    assert.equal(fixture.profile.stripe_current_period_end, new Date(200000).toISOString());
    assert.equal(fixture.profile.stripe_checkout_session_created, 100);
});

test('authentication, account ownership and payment are required before updating', { skip: !stripTypeScriptTypes }, async () => {
    for (const [options, token, expected] of [
        [{}, 'invalid', 401],
        [{ session: { client_reference_id: 'other' } }, 'valid', 403],
        [{ session: { customer_details: { email: 'other@example.test' } } }, 'valid', 403],
        [{ session: { payment_status: 'unpaid' } }, 'valid', 409],
        [{ subscription: { status: 'incomplete' } }, 'valid', 409]
    ]) {
        const fixture = backend(options);
        assert.equal((await fixture.request(token)).status, expected);
        assert.equal(fixture.writes.length, 0);
    }
});

test('older sessions and concurrent profile changes cannot overwrite the profile', { skip: !stripTypeScriptTypes }, async () => {
    for (const options of [
        { profile: { stripe_checkout_session_created: 101, stripe_subscription_id: 'sub_new' } },
        { profile: { stripe_subscription_id: 'sub_new' }, previousSubscriptionCreated: 101 },
        { concurrentChange: true }
    ]) {
        const fixture = backend(options);
        assert.equal((await fixture.request()).status, 409);
        assert.equal(fixture.writes.length, 0);
    }
});

test('a delayed subscription webhook uses the current Stripe subscription instead of stale event data', { skip: !stripTypeScriptTypes }, async () => {
    let handler;
    let written;
    const subscription = {
        id: 'sub_1', status: 'active', cancel_at_period_end: false,
        items: { data: [{ price: { id: 'price_pro' }, current_period_end: 200 }] }
    };
    class Stripe {
        static createFetchHttpClient() { return {}; }
        static createSubtleCryptoProvider() { return {}; }
        subscriptions = { retrieve: async () => subscription };
        webhooks = { constructEventAsync: async () => ({
            id: 'evt_1', type: 'customer.subscription.updated', created: 101,
            data: { object: { ...subscription, items: { data: [{ price: { id: 'price_starter' } }] } } }
        }) };
    }
    const client = {
        from() {
            return {
                update(values) { written = values; return this; },
                eq() { return this; },
                or() { return this; },
                async select() { return { data: [{ id: 'user-1' }], error: null }; }
            };
        }
    };
    const context = {
        Stripe, createClient: () => client, Response, console: { info() {}, warn() {}, error() {} },
        Deno: {
            env: { get: name => name === 'STRIPE_PRICE_PLAN_MAP' ? '{"price_pro":"pro","price_starter":"starter"}' : 'configured' },
            serve: callback => { handler = callback; }
        }
    };
    vm.createContext(context);
    const compile = source => stripTypeScriptTypes(source, { mode: 'strip' })
        .replace(/^import[\s\S]*?;\r?\n/gm, '').replace(/^export /gm, '');
    vm.runInContext(compile(fs.readFileSync(path.join(root, 'supabase', 'functions', '_shared', 'stripe-plans.ts'), 'utf8')), context);
    vm.runInContext(compile(fs.readFileSync(path.join(root, 'supabase', 'functions', 'stripe-webhook', 'index.ts'), 'utf8')), context);
    const result = await handler(new Request('https://example.test', {
        method: 'POST', headers: { 'stripe-signature': 'test' }, body: '{}'
    }));
    assert.equal(result.status, 200);
    assert.equal(written.subscription_plan, 'pro');
});
