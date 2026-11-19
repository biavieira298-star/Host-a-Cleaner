const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const app = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

function extract(start, end) {
    const first = app.indexOf(start);
    const last = app.indexOf(end, first);
    assert.ok(first >= 0 && last > first);
    return app.slice(first, last);
}

function setup({ session = null, invite = null, registration = false, hash = '', search = '' } = {}) {
    const calls = [];
    let listener;
    const context = {
        URLSearchParams, currentLang: 'pt', selectedDate: '2026-01-01',
        currentUser: null, pendingTeamInviteToken: invite, registrationRequested: registration,
        document: { getElementById: () => ({ value: '' }) },
        window: { location: { hash, search } },
        changeLanguage() {}, getLocalDateString: () => '2026-01-01',
        setCurrentUser: user => { context.currentUser = user; },
        showTeamInviteSignup: () => calls.push('invite'),
        showLoginScreen: () => calls.push('login'),
        showLandingScreen: () => calls.push('landing'),
        setAuthMode: mode => calls.push(mode),
        initializeAuthenticatedApp: async () => calls.push('app'),
        updateOfflineIndicator: async () => {},
        supabaseClient: { auth: {
            getSession: async () => ({ data: { session } }),
            onAuthStateChange: callback => { listener = callback; }
        } }
    };
    vm.createContext(context);
    vm.runInContext(extract('async function initApp()', 'async function initializeAuthenticatedApp()'), context);
    return { context, calls, emit: (...args) => listener(...args) };
}

test('anonymous visitors see the landing page and initial auth events do not change it', async () => {
    const env = setup();
    await env.context.initApp();
    assert.deepEqual(env.calls, ['landing']);
    await env.emit('INITIAL_SESSION', null);
    assert.deepEqual(env.calls, ['landing']);
});

test('existing sessions, invites and explicit auth links retain their routes', async () => {
    for (const [options, expected] of [
        [{ session: { user: { id: 'user' } } }, ['app']],
        [{ invite: 'token' }, ['invite']],
        [{ registration: true }, ['login', 'signup']],
        [{ hash: '#login' }, ['login', 'login']],
        [{ search: '?status=success&session_id=cs_test_123' }, ['login', 'login']]
    ]) {
        const env = setup(options);
        await env.context.initApp();
        await env.emit('INITIAL_SESSION', options.session || null);
        assert.deepEqual(env.calls, expected);
    }
});

test('sign-in opens the app and sign-out returns to the landing page', async () => {
    const env = setup();
    await env.context.initApp();
    await env.emit('SIGNED_IN', { user: { id: 'user' } });
    await env.emit('SIGNED_OUT', null);
    assert.deepEqual(env.calls, ['landing', 'app', 'landing']);
});

test('landing actions open the existing auth form in the requested mode', () => {
    const hidden = new Set(['landing-page']);
    const focused = [];
    const elements = {};
    for (const id of ['landing-page', 'team-invite-signup', 'section-login', 'app-layout', 'auth-name', 'auth-email']) {
        elements[id] = {
            classList: {
                add: () => hidden.add(id),
                remove: () => hidden.delete(id)
            },
            focus: () => focused.push(id)
        };
    }
    const modes = [];
    const context = {
        document: { getElementById: id => elements[id] },
        window: { scrollTo() {} }, setAuthMode: mode => modes.push(mode)
    };
    vm.createContext(context);
    vm.runInContext(extract('function showLandingScreen()', 'function showAppLayout()'), context);
    context.openLandingAuth('signup');
    assert.equal(hidden.has('landing-page'), true);
    assert.equal(hidden.has('section-login'), false);
    assert.equal(focused.at(-1), 'auth-name');
    context.showLandingScreen();
    assert.equal(hidden.has('landing-page'), false);
    assert.equal(hidden.has('section-login'), true);
    context.openLandingAuth('login');
    assert.deepEqual(modes, ['signup', 'login']);
    assert.equal(focused.at(-1), 'auth-email');
});

test('landing and subscription cards show the requested prices and limits', () => {
    const articles = html.match(/<article\b[\s\S]*?<\/article>/g);
    for (const [plan, label, price, propertyKey, teamKey] of [
        ['gratuito', 'Gratuito', '0€', 'landing_free_properties', 'landing_free_cleaners'],
        ['starter', 'Starter', '9,99€', 'landing_starter_properties', 'landing_starter_cleaners'],
        ['pro', 'Pro', '19,99€', 'landing_pro_properties', 'landing_unlimited_cleaners'],
        ['business', 'Business', '49,99€', 'landing_business_properties', 'landing_unlimited_cleaners']
    ]) {
        const accountCard = articles.find(card => card.includes(`data-subscription-plan="${plan}"`));
        const landingCard = articles.find(card => card.includes('landing-price-card') && card.includes(`>${label}</h3>`));
        assert.ok(accountCard && landingCard, `Missing ${label} card`);
        const accountPrice = accountCard.match(/text-3xl[^>]*>([^<]+)/)[1].trim();
        const landingPrice = landingCard.match(/class="landing-price">([^<]+)/)[1].trim();
        assert.equal(accountPrice, price);
        assert.equal(landingPrice, price);
        for (const card of [accountCard, landingCard]) {
            assert.match(card, new RegExp(`data-i18n="${propertyKey}"`));
            assert.match(card, new RegExp(`data-i18n="${teamKey}"`));
            assert.doesNotMatch(card, /desconto|\/ano|suporte prioritário|relatórios financeiros|pdf\/csv|co-host/i);
        }
    }
    assert.match(app, /landing_business_properties: "Imóveis ilimitados"/);
    assert.match(app, /landing_business_properties: "Unlimited properties"/);
    assert.match(app, /landing_unlimited_cleaners: "Equipa ilimitada"/);
    assert.match(app, /landing_unlimited_cleaners: "Unlimited team"/);
});

test('cancellation note appears in both pricing sections with PT and EN translations', () => {
    const landing = html.slice(html.indexOf('<section id="precos"'), html.indexOf('</section>', html.indexOf('<section id="precos"')));
    const subscription = html.slice(html.indexOf('<section id="profile-subtab-subscription"'), html.indexOf('</section>', html.indexOf('<section id="profile-subtab-subscription"')));
    const note = /data-i18n="subscription_no_lock_in">Sem fidelização\. Pode cancelar a subscrição quando quiser\.<\/p>/;
    assert.match(landing, note);
    assert.match(subscription, note);
    assert.match(app, /subscription_no_lock_in: "Sem fidelização\. Pode cancelar a subscrição quando quiser\."/);
    assert.match(app, /subscription_no_lock_in: "No lock-in contract\. Cancel your subscription whenever you want\."/);
});
