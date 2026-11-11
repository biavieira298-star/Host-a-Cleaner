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
        financialsAllowed: false,
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

test('profile flag, roles and profile errors determine financial access', async () => {
    for (const [profile, member, role, allowed] of [
        [{ role: 'admin', can_view_financials: false }, null, 'admin', false],
        [{ role: 'admin', can_view_financials: true }, null, 'admin', true],
        [{ role: 'admin' }, { role: 'assistant', id: 'm', manager_id: 'owner' }, 'admin', true],
        [{ role: 'cleaner', subscription_plan: 'admin' }, { role: 'cleaner', id: 'm' }, 'admin', true],
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
            userRole: 'admin', profileRoleVerified: true, financialsAllowed: true,
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
        assert.equal(context.financialsAllowed, false);
        assert.match(messages[0][0], online ? /profile denied/ : /Ligue-se à Internet/);
    }
});

test('financial navigation is hidden and an already open export modal is closed', () => {
    const nav = { classList: makeClassList() };
    const rate = { classList: makeClassList() };
    const modal = { classList: makeClassList() };
    const subtitle = {};
    const context = {
        userRole: 'admin',
        currentUser: { id: 'user' },
        financialsAllowed: false,
        reportsRequestId: 0,
        financialChartRequestId: 0,
        hostingReportsRequestId: 0,
        currentLang: 'pt',
        i18n: { pt: { role_locked: 'blocked' } },
        document: {
            querySelectorAll: selector => selector === '[data-financial-access]' ? [nav, rate] : [],
            getElementById: id => id === 'financial-date-modal' ? modal : id === 'sidebar-role-subtitle' ? subtitle : null
        }
    };
    vm.createContext(context);
    vm.runInContext(extract('function applyRolePermissionsUI()', 'function denyFinancialAccess()'), context);
    context.applyRolePermissionsUI();
    assert.equal(nav.classList.contains('hidden'), true);
    assert.equal(rate.classList.contains('hidden'), true);
    assert.equal(modal.classList.contains('hidden'), true);
    assert.equal(context.financialChartRequestId, 1);
    context.financialsAllowed = true;
    context.applyRolePermissionsUI();
    assert.equal(nav.classList.contains('hidden'), false);
    assert.equal(rate.classList.contains('hidden'), false);
    for (const id of ['btn-sub-reports', 'btn-sub-financial-entries', 'btn-sub-hosting-reports']) {
        assert.match(html, new RegExp(`id="${id}"[^>]*data-financial-access`));
    }
});

test('forced financial routes and aliases return to the agenda without rendering financial data', () => {
    const elements = new Map();
    const calls = [];
    const context = {
        currentUser: { id: 'user' },
        userRole: 'admin',
        financialsAllowed: false,
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

test('offline snapshots restore the saved restriction and cannot override a freshly loaded permission', async () => {
    let snapshot = { userRole: 'admin', profileRoleVerified: true, financialsAllowed: false };
    const context = {
        currentUser: { id: 'user' },
        userRole: 'admin',
        profileRoleVerified: false,
        financialsAllowed: true,
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
    assert.equal(context.financialsAllowed, false);
    snapshot = { userRole: 'admin', profileRoleVerified: true, financialsAllowed: true };
    context.userRole = 'cleaner';
    context.currentTeamManagerId = 'fresh-manager';
    await context.restoreOfflineSnapshot(false);
    assert.equal(context.userRole, 'cleaner');
    assert.equal(context.financialsAllowed, false);
    assert.equal(context.currentTeamManagerId, 'fresh-manager');
    snapshot = { userRole: 'admin', profileRoleVerified: true };
    context.financialsAllowed = true;
    await context.restoreOfflineSnapshot();
    assert.equal(context.financialsAllowed, false);
    snapshot = { userRole: 'cleaner', financialsAllowed: true };
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
