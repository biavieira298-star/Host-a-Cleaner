const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const app = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');
const team = fs.readFileSync(path.join(__dirname, '..', 'js', 'equipas.js'), 'utf8');

function extract(source, start, end) {
    const first = source.indexOf(start);
    const last = source.indexOf(end, first);
    assert.ok(first >= 0 && last > first);
    return source.slice(first, last);
}

function environment(userId, role, ownerId = null) {
    const calls = [];
    const rows = {
        properties: [{ user_id: 'owner-a' }, { user_id: 'owner-b' }],
        cleaning_tasks: [{ properties: { user_id: 'owner-a' } }, { properties: { user_id: 'owner-b' } }],
        team_members: [{ owner_id: 'owner-a' }, { owner_id: 'owner-b' }]
    };
    const context = {
        currentUser: { id: userId }, userRole: role, profileRoleVerified: true,
        currentTeamOwnerId: ownerId, currentTeamMemberId: ownerId ? 'member' : null,
        allPropertiesCache: [], allTasksCache: [], agendaTasksCache: [],
        allTeamMembersCache: [], propertyCleaners: [], taskTeamMembers: [],
        hostingReportsCache: [], employeeHoursMonthlyData: [], selectedPropertyFilter: 'all',
        financialOverviewChart: null, viewRenderRequestId: 0,
        agendaRequestId: 0, incidentRequestId: 0, globalIncidentHistoryRequestId: 0,
        reportsRequestId: 0, financialChartRequestId: 0, hostingReportsRequestId: 0, subscriptionLoadRequestId: 0,
        navigator: { onLine: true }, document: { getElementById: () => null, querySelectorAll: () => [] }, console,
        supabaseClient: {
            from(table) {
                let filtered = rows[table];
                const query = {
                    select() { return this; },
                    eq(column, value) {
                        calls.push([table, column, value]);
                        filtered = filtered.filter(row => column.split('.').reduce((value, key) => value?.[key], row) === value);
                        return this;
                    },
                    then(resolve) { return Promise.resolve({ data: filtered, error: null }).then(resolve); }
                };
                return query;
            }
        }
    };
    vm.createContext(context);
    vm.runInContext(extract(app, 'function setCurrentUser(', 'async function initApp('), context);
    vm.runInContext(extract(app, 'async function fetchAllTasksCache()', 'async function runButtonAction('), context);
    return { context, calls };
}

test('direct registration always requests an independent free administrator account', async () => {
    let signup;
    const context = { supabaseClient: { auth: { signUp: async data => {
        signup = data;
        return { data: {}, error: null };
    } } } };
    vm.createContext(context);
    vm.runInContext(extract(app, 'async function registarUtilizador(', 'async function handleAuthSubmit('), context);
    await context.registarUtilizador('a@example.com', 'password', 'Name', 'cleaner');
    assert.equal(signup.options.data.role, 'admin');
    assert.equal(signup.options.data.subscription_plan, 'free');
    assert.equal(signup.options.data.team_invite_token, undefined);
});

test('properties and tasks use the admin or invited cleaner’s owner, even without RLS', async () => {
    for (const [user, role, teamOwner, owner] of [
        ['owner-a', 'admin', null, 'owner-a'],
        ['new-owner', 'admin', null, 'new-owner'],
        ['cleaner', 'cleaner', 'owner-b', 'owner-b']
    ]) {
        const { context, calls } = environment(user, role, teamOwner);
        assert.equal(await context.fetchPropertiesForSelect(), true);
        assert.equal(await context.fetchAllTasksCache(), true);
        assert.ok(context.allPropertiesCache.every(row => row.user_id === owner));
        assert.ok(context.allTasksCache.every(row => row.properties.user_id === owner));
        assert.equal(context.allPropertiesCache.length, owner === 'new-owner' ? 0 : 1);
        assert.equal(context.allTasksCache.length, owner === 'new-owner' ? 0 : 1);
        assert.deepEqual(calls, [
            ['properties', 'user_id', owner],
            ['cleaning_tasks', 'properties.user_id', owner]
        ]);
    }
});

test('work hours are filtered and saved using the admin ownership link', async () => {
    const calls = [];
    const fields = {
        'time-entries-list': { innerHTML: '' },
        'time-entry-submit': { disabled: false },
        'time-entry-hours': { value: '2' },
        'time-entry-description': { value: 'Limpeza' },
        'time-entry-date': { value: '2026-11-17' },
        'time-entry-property': { value: '' },
        'time-entry-form': { reset() {} }
    };
    const context = {
        currentUser: { id: 'admin-a' }, userRole: 'admin',
        currentTeamMemberId: 'member-a', currentTeamOwnerId: 'admin-a',
        currentLang: 'pt', i18n: { pt: {} }, allPropertiesCache: [], console,
        document: { getElementById: id => id === 'time-entry-property' && context.userRole === 'admin' ? null : fields[id] },
        getLocalDateString: () => '2026-11-17',
        showPropertyMessage() {}, hidePropertyMessage() {},
        supabaseClient: { from: table => ({
            select() { return this; }, order() { return this; },
            eq(column, value) { calls.push([table, column, value]); return Promise.resolve({ data: [], error: null }); },
            insert(rows) { calls.push([table, rows[0]]); return Promise.resolve({ error: null }); }
        }) }
    };
    vm.createContext(context);
    vm.runInContext(extract(app, 'async function carregarRegistosHoras()', 'function getDefaultFinancialDateRange()'), context);
    await context.carregarRegistosHoras();
    assert.deepEqual(calls.shift(), ['work_time_entries', 'owner_id', 'admin-a']);
    context.currentUser.id = 'cleaner-a';
    context.userRole = 'cleaner';
    context.document.getElementById = id => id === 'time-entry-property'
        ? { value: '', replaceChildren() {} } : fields[id];
    context.Option = function () {};
    await context.registarHorasTrabalhadas({ preventDefault() {} });
    const [table, row] = calls.shift();
    assert.equal(table, 'work_time_entries');
    assert.equal(row.owner_id, 'admin-a');
    assert.equal(row.user_id, 'cleaner-a');
    assert.equal(Object.hasOwn(row, 'team_member_id'), false);
    assert.deepEqual(calls.shift(), ['work_time_entries', 'user_id', 'cleaner-a']);
});

test('work hours resolve cleaner names by user and owner without a foreign-key relationship', async () => {
    const calls = [];
    const list = { innerHTML: '' };
    const context = {
        currentUser: { id: 'admin-a' }, userRole: 'admin', currentLang: 'pt',
        i18n: { pt: { time_entry_property: 'Alojamento', time_entry_error: 'Erro' } },
        allPropertiesCache: [{ id: 'property-a', name: 'Casa' }],
        document: { getElementById: id => id === 'time-entries-list' ? list : null },
        escapePropertyHTML: String, console,
        supabaseClient: { from: table => ({
            select(fields) { calls.push(['select', table, fields]); return this; },
            order() { return this; },
            eq(column, value) {
                calls.push(['eq', table, column, value]);
                return table === 'work_time_entries'
                    ? Promise.resolve({ data: [{ user_id: 'cleaner-a', property_id: 'property-a', work_date: '2026-11-17', hours: 2, description: 'Limpeza' }], error: null })
                    : this;
            },
            in(column, values) {
                calls.push(['in', table, column, Array.from(values)]);
                return Promise.resolve({ data: [{ auth_user_id: 'cleaner-a', name: 'Ana' }], error: null });
            }
        }) }
    };
    vm.createContext(context);
    vm.runInContext(extract(app, 'async function carregarRegistosHoras()', 'async function registarHorasTrabalhadas('), context);
    await context.carregarRegistosHoras();
    assert.match(list.innerHTML, /Casa/);
    assert.match(list.innerHTML, /Ana/);
    assert.ok(calls.some(call => call[0] === 'eq' && call[1] === 'team_members' && call[2] === 'owner_id' && call[3] === 'admin-a'));
    assert.ok(calls.some(call => call[0] === 'in' && call[1] === 'team_members' && call[2] === 'auth_user_id' && call[3][0] === 'cleaner-a'));
    assert.ok(calls.every(call => !String(call[2]).includes('team_member_id_fkey')));
});

test('team reads are limited to the active owner', async () => {
    for (const [user, role, teamOwner, owner] of [
        ['new-owner', 'admin', null, 'new-owner'],
        ['cleaner', 'cleaner', 'owner-b', 'owner-b']
    ]) {
        const { context, calls } = environment(user, role, teamOwner);
        const list = { innerHTML: '', querySelectorAll: () => [] };
        context.document.getElementById = () => list;
        context.i18n = { pt: {} };
        context.currentLang = 'pt';
        context.changeLanguage = () => {};
        context.escapeTeamMemberAttribute = String;
        const originalFrom = context.supabaseClient.from;
        context.supabaseClient.from = table => {
            const query = originalFrom(table);
            query.order = () => query;
            return query;
        };
        vm.runInContext(extract(team, 'async function fetchTeamMembers()', 'async function handleAddTeamMember('), context);
        await context.fetchTeamMembers();
        assert.deepEqual(calls, [['team_members', 'owner_id', owner]]);
        assert.equal(context.allTeamMembersCache.length, owner === 'new-owner' ? 0 : 1);
    }
});

test('switching accounts clears cached records and discards an earlier response', async () => {
    const { context } = environment('owner-a', 'admin');
    let active = true;
    let hidden = false;
    const badge = { classList: { add: () => { hidden = true; } } };
    const button = {
        dataset: { subscriptionPlan: 'pro' }, textContent: 'Plano Atual', disabled: false,
        closest: () => ({ classList: { remove: () => { active = false; } }, querySelector: () => badge })
    };
    context.document.querySelectorAll = () => [button];
    context.currentLang = 'pt';
    context.i18n = { pt: { subscription_free: 'Gratuito', subscription_subscribe: 'Subscrever' } };
    let finish;
    context.supabaseClient.from = () => ({
        select() { return this; },
        eq() { return new Promise(resolve => { finish = resolve; }); }
    });
    const pending = context.fetchPropertiesForSelect();
    context.allTasksCache = [{ id: 'old-task' }];
    context.allTeamMembersCache = [{ id: 'old-member' }];
    context.setCurrentUser({ id: 'owner-b' });
    finish({ data: [{ user_id: 'owner-a' }], error: null });
    assert.equal(await pending, false);
    assert.equal(context.allPropertiesCache.length, 0);
    assert.equal(context.allTasksCache.length, 0);
    assert.equal(context.allTeamMembersCache.length, 0);
    assert.equal(active, false);
    assert.equal(hidden, true);
    assert.equal(button.textContent, 'Subscrever Pro');
    assert.equal(button.disabled, true);
});

test('stored photo references use authenticated signed URLs and signing failures are surfaced', async () => {
    const calls = [];
    let failure = false;
    const context = {
        URL, window: { location: { href: 'https://app.example.test/' } },
        SUPABASE_URL: 'https://project.example.test',
        supabaseClient: { storage: { from: bucket => ({
            createSignedUrl: async (name, lifetime) => {
                calls.push([bucket, name, lifetime]);
                return failure ? { data: null, error: new Error('denied') } : { data: { signedUrl: 'https://signed.example.test/photo' }, error: null };
            }
        }) } }
    };
    vm.createContext(context);
    vm.runInContext(extract(app, 'function safeIncidentPhotoUrl(', 'async function loadPropertyIncidentHistory('), context);
    const url = 'https://project.example.test/storage/v1/object/public/property-incidents/user/property/incident/photo.jpg';
    const photos = await context.resolveIncidentPhotoRecords([{ photo_url: url, photos: [] }]);
    assert.equal(photos[0].photos[0], 'https://signed.example.test/photo');
    assert.deepEqual(calls, [['property-incidents', 'user/property/incident/photo.jpg', 3600]]);
    const legacy = 'https://project.example.test/storage/v1/object/public/cleaning-photos/user/incidents/photo.jpg';
    await context.resolvePrivatePhotoUrl(legacy, 'property-incidents');
    assert.deepEqual(calls[1], ['cleaning-photos', 'user/incidents/photo.jpg', 3600]);
    failure = true;
    await assert.rejects(context.resolvePrivatePhotoUrl(url, 'property-incidents'), /denied/);
});
