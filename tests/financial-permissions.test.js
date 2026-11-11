const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'js', 'app.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

function extract(start, end) {
    const first = source.indexOf(start);
    const last = source.indexOf(end, first);
    assert.ok(first >= 0 && last > first);
    return source.slice(first, last);
}

function makeClassList(initial = []) {
    const classes = new Set(initial);
    return {
        add: (...values) => values.forEach(value => classes.add(value)),
        remove: (...values) => values.forEach(value => classes.delete(value)),
        contains: value => classes.has(value),
        toggle(value, state) {
            if (state) classes.add(value);
            else classes.delete(value);
        }
    };
}

function roleContext(profile, member = null, profileError = null, metadata = {}) {
    const calls = [];
    const logs = [];
    const context = {
        currentUser: { id: 'user', app_metadata: metadata },
        userRole: null,
        profileRoleVerified: false,
        currentTeamMemberId: null,
        currentTeamManagerId: null,
        currentTeamMemberPreferences: {},
        console: { log: (...args) => logs.push(args), warn() {}, error() {} },
        calls,
        logs,
        supabaseClient: {
            from(table) {
                calls.push(['from', table]);
                return {
                    select() { return this; },
                    eq(column, value) { calls.push(['eq', table, column, value]); return this; },
                    async maybeSingle() {
                        return table === 'profiles'
                            ? { data: profile, error: profileError }
                            : { data: member, error: null };
                    }
                };
            }
        }
    };
    vm.createContext(context);
    vm.runInContext(extract('async function checkUserRole()', 'function applyRolePermissionsUI()'), context);
    vm.runInContext(extract('function canViewFinancials()', 'function denyFinancialAccess()'), context);
    return context;
}

test('administrator role or subscription grants frontend financial access', async () => {
    for (const [profile, member, role, allowed] of [
        [{ role: 'admin', can_view_financials: false }, null, 'admin', true],
        [{ role: 'admin', can_view_financials: true }, null, 'admin', true],
        [{ role: 'admin' }, { role: 'assistant', id: 'm', manager_id: 'owner' }, 'admin', true],
        [{ role: 'cleaner', subscription_plan: 'admin', can_view_financials: false }, { role: 'cleaner', id: 'm' }, 'admin', true],
        [{ role: 'cleaner', can_view_financials: true }, null, 'cleaner', false],
        [{ role: 'assistant', can_view_financials: true }, null, 'cleaner', false]
    ]) {
        const context = roleContext(profile, member);
        await context.checkUserRole();
        assert.equal(context.userRole, role);
        assert.equal(context.canViewFinancials(), allowed);
        assert.equal(context.profileRoleVerified, true);
        assert.equal(context.logs[0][1], profile);
        assert.ok(context.calls.some(call => call[0] === 'eq' && call[1] === 'profiles' && call[2] === 'id' && call[3] === 'user'));
        if (role === 'admin') assert.equal(context.calls.some(call => call[1] === 'team_members'), false);
    }
});

test('missing, inaccessible or unrecognised profiles never fall back to metadata or cleaner', async () => {
    for (const [profile, error] of [
        [null, null],
        [null, { message: 'denied' }],
        [{ role: null, subscription_plan: 'pro' }, null]
    ]) {
        const context = roleContext(profile, null, error, { role: 'admin' });
        await assert.rejects(context.checkUserRole());
        assert.equal(context.userRole, null);
        assert.equal(context.profileRoleVerified, false);
        assert.equal(context.canViewFinancials(), false);
    }
});

test('a cleaner profile still loads its team assignment and preferences', async () => {
    const context = roleContext({ role: 'cleaner' }, {
        id: 'member', manager_id: 'owner', track_hours: true, require_photos: true
    });
    await context.checkUserRole();
    assert.equal(context.userRole, 'cleaner');
    assert.equal(context.currentTeamMemberId, 'member');
    assert.equal(context.currentTeamManagerId, 'owner');
    assert.equal(context.currentTeamMemberPreferences.track_hours, true);
    assert.equal(context.currentTeamMemberPreferences.require_photos, true);
});

test('administrator profiles immediately unlock the admin sidebar even when a team membership exists', async () => {
    for (const profile of [{ role: 'admin' }, { role: 'cleaner', subscription_plan: 'admin' }]) {
        const context = roleContext(profile, { role: 'cleaner', id: 'm', manager_id: 'owner' });
        const adminElement = { classList: makeClassList(['hidden']) };
        const cleanerElement = { classList: makeClassList() };
        const button = {
            disabled: true, classList: makeClassList(['cursor-not-allowed', 'opacity-70']),
            setAttribute() {}, querySelector: () => null
        };
        const subtitle = {};
        Object.assign(context, {
            reportsRequestId: 0, financialChartRequestId: 0, hostingReportsRequestId: 0,
            currentLang: 'pt', i18n: { pt: { role_locked: 'blocked' } },
            document: {
                querySelectorAll: selector => ({
                    '.admin-only': [adminElement], '.cleaner-only': [cleanerElement],
                    '[data-admin-route]': [button], '[data-financial-access]': []
                })[selector] || [],
                getElementById: id => id === 'sidebar-role-subtitle' ? subtitle : null
            }
        });
        vm.runInContext(extract('function applyRolePermissionsUI()', 'function canViewFinancials()'), context);
        await context.checkUserRole();
        context.applyRolePermissionsUI();
        assert.equal(adminElement.classList.contains('hidden'), false);
        assert.equal(cleanerElement.classList.contains('hidden'), true);
        assert.equal(button.disabled, false);
        assert.equal(subtitle.innerText, 'Admin Hub');
    }
});

test('a profile response from a previous login cannot change the current account role', async () => {
    const context = roleContext(null);
    let resolveProfile;
    context.supabaseClient.from = () => ({
        select() { return this; },
        eq() { return this; },
        maybeSingle: () => new Promise(resolve => { resolveProfile = resolve; })
    });
    const loading = context.checkUserRole();
    context.currentUser = { id: 'other-user' };
    resolveProfile({ data: { role: 'admin' }, error: null });
    assert.equal(await loading, false);
    assert.equal(context.userRole, null);
});

test('initialization reports profile and offline snapshot errors without opening an assumed role', async () => {
    for (const online of [true, false]) {
        const messages = [];
        let opened = false;
        const context = {
            currentUser: { id: 'user' },
            userRole: 'admin', profileRoleVerified: true,
            currentTeamMemberId: null, currentTeamManagerId: null, currentTeamMemberPreferences: {},
            navigator: { onLine: online },
            isOfflineNetworkError: () => false,
            checkUserRole: async () => { throw new Error('profile denied'); },
            restoreOfflineSnapshot: async () => false,
            showAppLayout: () => { opened = true; },
            showLoginScreen: () => {},
            mostrarMensagemAuth: (...args) => messages.push(args),
            currentLang: 'pt',
            i18n: { pt: { auth_profile_error: 'Perfil indisponível', auth_offline_profile_missing: 'Ligue-se à Internet' } },
            console: { warn() {}, error() {} }
        };
        vm.createContext(context);
        vm.runInContext(extract('async function initializeAuthenticatedApp()', 'function isOfflineNetworkError('), context);
        await context.initializeAuthenticatedApp();
        assert.equal(opened, false);
        assert.equal(context.userRole, null);
        assert.equal(context.profileRoleVerified, false);
        assert.match(messages[0][0], online ? /profile denied/ : /Ligue-se à Internet/);
    }
});

test('finance sidebar and financial fields are available to admin roles and plans', async () => {
    for (const [profile, visible, permitted] of [
        [{ role: 'admin', can_view_financials: false }, true, true],
        [{ role: 'cleaner', subscription_plan: 'admin', can_view_financials: false }, true, true],
        [{ role: 'admin', can_view_financials: true }, true, true],
        [{ role: 'cleaner', can_view_financials: true }, false, false]
    ]) {
        const context = roleContext(profile);
        const navigation = Array.from({ length: 4 }, () => ({ classList: makeClassList(['hidden']) }));
        const sensitiveField = { classList: makeClassList() };
        Object.assign(context, {
            reportsRequestId: 0, financialChartRequestId: 0, hostingReportsRequestId: 0,
            currentLang: 'pt', i18n: { pt: { role_locked: 'blocked' } },
            document: {
                querySelectorAll: selector => ({
                    '.admin-only': navigation,
                    '[data-financial-access]': [sensitiveField]
                })[selector] || [],
                getElementById: id => id === 'sidebar-role-subtitle' ? {} : null
            }
        });
        vm.runInContext(extract('function applyRolePermissionsUI()', 'function canViewFinancials()'), context);
        await context.checkUserRole();
        context.applyRolePermissionsUI();
        assert.ok(navigation.every(element => element.classList.contains('hidden') === !visible));
        assert.equal(sensitiveField.classList.contains('hidden'), !permitted);
    }

    const heading = html.match(/<div[^>]*data-i18n="nav_cat_finance"[^>]*>/)[0];
    assert.match(heading, /admin-only/);
    assert.doesNotMatch(heading, /data-financial-access/);
    for (const id of ['btn-sub-reports', 'btn-sub-financial-entries', 'btn-sub-hosting-reports']) {
        const button = html.match(new RegExp(`<button[^>]*id="${id}"[^>]*>`))[0];
        assert.match(button, /admin-only/);
        assert.doesNotMatch(button, /data-financial-access/);
    }
});

test('financial details remain hidden for cleaners and an open export modal is closed', () => {
    const rate = { classList: makeClassList() };
    const modal = { classList: makeClassList() };
    const subtitle = {};
    const context = {
        userRole: 'cleaner',
        currentUser: { id: 'user' },
        reportsRequestId: 0,
        financialChartRequestId: 0,
        hostingReportsRequestId: 0,
        currentLang: 'pt',
        i18n: { pt: { role_locked: 'blocked' } },
        document: {
            querySelectorAll: selector => selector === '[data-financial-access]' ? [rate] : [],
            getElementById: id => id === 'financial-date-modal' ? modal : id === 'sidebar-role-subtitle' ? subtitle : null
        }
    };
    vm.createContext(context);
    vm.runInContext(extract('function applyRolePermissionsUI()', 'function denyFinancialAccess()'), context);
    context.applyRolePermissionsUI();
    assert.equal(rate.classList.contains('hidden'), true);
    assert.equal(modal.classList.contains('hidden'), true);
    assert.equal(context.financialChartRequestId, 1);
    context.userRole = 'admin';
    context.applyRolePermissionsUI();
    assert.equal(rate.classList.contains('hidden'), false);
});

test('forced financial routes and aliases return to the agenda without rendering financial data', () => {
    const elements = new Map();
    const calls = [];
    const context = {
        currentUser: { id: 'user' },
        userRole: 'cleaner',
        currentLang: 'pt',
        i18n: { pt: { role_locked: 'blocked' } },
        profileSettingsTab: 'account',
        viewRenderRequestId: 0,
        activeViewRenderPromise: null,
        document: { getElementById(id) {
            if (!elements.has(id)) elements.set(id, {
                classList: makeClassList(['hidden']), dataset: {},
                setAttribute() {}
            });
            return elements.get(id);
        } },
        localStorage: { setItem: (key, value) => calls.push(value) },
        closeMenuAfterAction() {},
        showToast: (...args) => calls.push(args),
        fetchAgendaTasks: () => { calls.push('agenda'); return Promise.resolve(); },
        carregarRelatorios: () => { calls.push('reports'); return Promise.resolve(); },
        renderFinancialChart: () => { calls.push('chart'); return Promise.resolve(); },
        requestAnimationFrame: fn => fn(),
        console
    };
    vm.createContext(context);
    vm.runInContext(extract('function canViewFinancials()', 'function requireAdminAction()'), context);
    vm.runInContext(extract('function switchTab(', 'async function loadData()'), context);
    for (const route of ['sub-reports', 'sub-financial-entries', 'sub-hosting-reports', 'sub-history', 'sub-financial-movements']) {
        context.switchTab(route);
    }
    assert.equal(calls.filter(item => item === 'agenda').length, 5);
    assert.equal(calls.filter(item => Array.isArray(item) && item[1] === 'info').length, 5);
    assert.equal(calls.includes('reports'), false);
    assert.equal(calls.includes('chart'), false);
    assert.equal(elements.get('view-sub-agenda').classList.contains('hidden'), false);
});

test('admin roles and subscriptions can open finance routes despite the legacy flag', async () => {
    for (const profile of [
        { role: 'admin', can_view_financials: false },
        { role: 'cleaner', subscription_plan: 'admin', can_view_financials: false }
    ]) {
        const context = roleContext(profile);
        const elements = new Map();
        const calls = [];
        Object.assign(context, {
            currentLang: 'pt', i18n: { pt: { role_locked: 'blocked' } },
            profileSettingsTab: 'account', viewRenderRequestId: 0,
            activeViewRenderPromise: null,
            document: { getElementById(id) {
                if (!elements.has(id)) elements.set(id, {
                    classList: makeClassList(['hidden']), dataset: {}, setAttribute() {}
                });
                return elements.get(id);
            } },
            localStorage: { setItem() {} }, closeMenuAfterAction() {},
            showToast: (...args) => calls.push(['toast', ...args]),
            carregarRelatorios: async () => calls.push('reports'),
            renderFinancialChart: async () => calls.push('chart'),
            carregarLancamentosManuais: async () => calls.push('entries'),
            fetchHistoryAdmin: async () => calls.push('history'),
            carregarDocumentosHosting: async () => calls.push('documents'),
            requestAnimationFrame: fn => fn()
        });
        vm.runInContext(extract('function denyFinancialAccess()', 'function requireAdminAction()'), context);
        vm.runInContext(extract('function switchTab(', 'async function loadData()'), context);
        await context.checkUserRole();
        context.switchTab('sub-reports');
        context.switchTab('sub-financial-entries');
        context.switchTab('sub-hosting-reports');
        await context.activeViewRenderPromise;
        assert.ok(['reports', 'chart', 'entries', 'history', 'documents'].every(call => calls.includes(call)));
        assert.equal(calls.some(call => Array.isArray(call) && call[0] === 'toast'), false);
        assert.equal(elements.get('view-sub-hosting-reports').classList.contains('hidden'), false);
    }
});

test('offline snapshots restore verified roles without overriding a freshly loaded role', async () => {
    let snapshot = { userRole: 'admin', profileRoleVerified: true };
    const context = {
        currentUser: { id: 'user' },
        userRole: 'admin',
        profileRoleVerified: false,
        openOfflineDatabase: async () => ({
            transaction: () => ({
                objectStore: () => ({
                    get() {
                        const request = {};
                        queueMicrotask(() => { request.result = snapshot; request.onsuccess(); });
                        return request;
                    }
                })
            })
        }),
        listPendingOfflineItems: async () => [],
        getAgendaDateRange: () => ({ start: '2026-01-01', end: '2026-01-31' }),
        renderAgendaSummary() {},
        renderAgendaView() {},
        carregarAlertasIncidentes: async () => {},
        allPropertiesCache: [],
        allTasksCache: [],
        allTeamMembersCache: [],
        propertyCleaners: [],
        agendaTasksCache: [],
        currentTeamMemberId: null,
        currentTeamManagerId: null,
        currentTeamMemberPreferences: {},
        queueMicrotask
    };
    vm.createContext(context);
    vm.runInContext(extract('async function restoreOfflineSnapshot(', 'async function listPendingOfflineItems('), context);
    await context.restoreOfflineSnapshot();
    assert.equal(context.userRole, 'admin');
    snapshot = { userRole: 'admin', profileRoleVerified: true };
    context.userRole = 'cleaner';
    context.currentTeamManagerId = 'fresh-manager';
    await context.restoreOfflineSnapshot(false);
    assert.equal(context.userRole, 'cleaner');
    assert.equal(context.currentTeamManagerId, 'fresh-manager');
    snapshot = { userRole: 'admin', profileRoleVerified: true };
    await context.restoreOfflineSnapshot();
    assert.equal(context.userRole, 'admin');
    snapshot = { userRole: 'cleaner' };
    context.userRole = null;
    assert.equal(await context.restoreOfflineSnapshot(), false);
    assert.equal(context.userRole, null);
});

test('financial date queries are blocked without permission', async () => {
    let queries = 0;
    const context = {
        canViewFinancials: () => false,
        validateFinancialDateRange() {},
        currentLang: 'pt',
        i18n: { pt: { role_locked: 'blocked' } },
        supabaseClient: { from: () => { queries++; } }
    };
    vm.createContext(context);
    vm.runInContext(extract('async function fetchFinancialEntriesForDateRange(', 'async function renderFinancialChart('), context);
    await assert.rejects(context.fetchFinancialEntriesForDateRange('2026-01-01', '2026-01-31'), /blocked/);
    assert.equal(queries, 0);
});

test('financial date query logs and propagates the Supabase permission error', async () => {
    const error = { code: '42501', message: 'permission denied' };
    const logs = [];
    const query = {
        select() { return this; },
        eq() { return this; },
        gte() { return this; },
        lte() { return this; },
        async order() { return { data: null, error }; }
    };
    const context = {
        canViewFinancials: () => true,
        validateFinancialDateRange() {},
        currentUser: { id: 'user' },
        supabaseClient: { from: table => { assert.equal(table, 'property_financial_entries'); return query; } },
        console: { log: (...args) => logs.push(args) }
    };
    vm.createContext(context);
    vm.runInContext(extract('async function fetchFinancialEntriesForDateRange(', 'async function renderFinancialChart('), context);
    await assert.rejects(context.fetchFinancialEntriesForDateRange('2026-01-01', '2026-01-31'), caught => caught === error);
    assert.match(logs[0][0], /property_financial_entries/);
    assert.equal(logs[0][1], error);
});
