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
    const context = {
        currentUser: { id: 'user', app_metadata: metadata },
        userRole: 'admin',
        financialsAllowed: false,
        currentTeamMemberId: null,
        currentTeamManagerId: null,
        currentTeamMemberPreferences: {},
        console: { warn() {}, error() {} },
        supabaseClient: {
            from(table) {
                return {
                    select() { return this; },
                    eq() { return this; },
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
    for (const [profile, member, error, metadata, allowed] of [
        [{ role: 'admin', can_view_financials: false }, null, null, {}, false],
        [{ role: 'admin', can_view_financials: true }, null, null, {}, true],
        [{ role: 'admin' }, null, null, {}, true],
        [{ role: 'cleaner', can_view_financials: true }, null, null, {}, false],
        [{ role: 'assistant', can_view_financials: true }, null, null, {}, false],
        [{ role: 'admin' }, { role: 'assistant', id: 'm', manager_id: 'owner' }, null, {}, false],
        [null, null, { message: 'denied' }, { role: 'admin' }, false]
    ]) {
        const context = roleContext(profile, member, error, metadata);
        await context.checkUserRole();
        assert.equal(context.canViewFinancials(), allowed);
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
    let snapshot = { userRole: 'admin', financialsAllowed: false };
    const context = {
        currentUser: { id: 'user' },
        userRole: 'admin',
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
    snapshot = { userRole: 'admin', financialsAllowed: true };
    context.userRole = 'cleaner';
    await context.restoreOfflineSnapshot(false);
    assert.equal(context.userRole, 'cleaner');
    assert.equal(context.financialsAllowed, false);
    snapshot = { userRole: 'admin' };
    context.financialsAllowed = true;
    await context.restoreOfflineSnapshot();
    assert.equal(context.financialsAllowed, false);
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
