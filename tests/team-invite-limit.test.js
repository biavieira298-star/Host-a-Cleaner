const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'js', 'app.js'), 'utf8');
const team = fs.readFileSync(path.join(root, 'js', 'equipas.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

function extract(source, start, end) {
    const first = source.indexOf(start);
    const last = source.indexOf(end, first);
    assert.ok(first >= 0 && last > first);
    return source.slice(first, last);
}

function setup({ profile = { subscription_plan: 'free', max_cleaners: 1 }, profileError = null, count = 0, countError = null } = {}) {
    const calls = [];
    const toasts = [];
    const elements = {
        'team-name': { value: 'Cleaner' },
        'team-phone': { value: '+351912345678' },
        'team-track-hours': { checked: true },
        'team-require-photos': { checked: false },
        'btn-add-team': { disabled: false },
        'team-add-form': { reset: () => calls.push(['reset']) }
    };
    const context = {
        currentUser: { id: 'manager-id' },
        requireAdminAction: () => true,
        document: { getElementById: id => elements[id] },
        teamInviteTokens: new Map(),
        fetchTeamMembers: async () => calls.push(['refresh']),
        showToast: (...args) => toasts.push(args),
        console: { error() {} },
        window: { confirm: () => false },
        supabaseClient: {
            from(table) {
                calls.push(['from', table]);
                return {
                    select(...args) { calls.push(['select', table, ...args]); return this; },
                    eq(column, value) { calls.push(['eq', table, column, value]); return this; },
                    async maybeSingle() { return { data: profile, error: profileError }; },
                    then(resolve, reject) { return Promise.resolve({ count, error: countError }).then(resolve, reject); }
                };
            },
            rpc: async (name, args) => {
                calls.push(['rpc', name, args]);
                return { data: [{ member_id: 'member-id', invite_token: 'invite' }], error: null };
            }
        }
    };
    vm.createContext(context);
    vm.runInContext(extract(app, 'async function checkSubscriptionLimit(', 'async function handleChangePassword('), context);
    vm.runInContext(extract(team, 'async function handleAddTeamMember(', 'function formatPhoneForWhatsApp('), context);
    return { context, calls, toasts, elements };
}

test('invitation checks only the authenticated manager profile and cleaner count before creating a member', async () => {
    const { context, calls, elements } = setup();
    await context.handleAddTeamMember({ preventDefault() {} });
    assert.ok(calls.some(call => call[0] === 'eq' && call[1] === 'profiles' && call[2] === 'id' && call[3] === 'manager-id'));
    assert.ok(calls.some(call => call[0] === 'eq' && call[1] === 'team_members' && call[2] === 'manager_id' && call[3] === 'manager-id'));
    assert.ok(calls.some(call => call[0] === 'eq' && call[1] === 'team_members' && call[2] === 'role' && call[3] === 'cleaner'));
    assert.equal(calls.filter(call => call[0] === 'from' && call[1] === 'profiles').length, 1);
    assert.ok(calls.some(call => call[0] === 'rpc' && call[1] === 'create_team_member_invite'));
    assert.ok(calls.some(call => call[0] === 'refresh'));
    assert.equal(elements['btn-add-team'].disabled, false);
    assert.match(html, /id="team-add-form" onsubmit="runFormAction\(event, \(\) => handleAddTeamMember\(event\)\)"/);
});

test('missing manager profile and query failures block the invitation and report errors', async () => {
    for (const options of [{ profile: null }, { profileError: new Error('RLS denied') }, { countError: new Error('count failed') }]) {
        const { context, calls, toasts, elements } = setup(options);
        await context.handleAddTeamMember({ preventDefault() {} });
        assert.equal(calls.some(call => call[0] === 'rpc'), false);
        assert.equal(toasts.at(-1)[1], 'error');
        assert.equal(elements['btn-add-team'].disabled, false);
        if (options.profile === null) assert.match(toasts.at(-1)[0], /administrador.*não encontrado/);
    }
});

test('a full free plan blocks a second cleaner, and an invalid form does not query the profile', async () => {
    const full = setup({ count: 1 });
    await full.context.handleAddTeamMember({ preventDefault() {} });
    assert.equal(full.calls.some(call => call[0] === 'rpc'), false);
    const invalid = setup();
    invalid.elements['team-name'].value = '';
    await invalid.context.handleAddTeamMember({ preventDefault() {} });
    assert.equal(invalid.calls.some(call => call[0] === 'from'), false);
    assert.equal(invalid.toasts[0][1], 'error');
});

test('invited cleaner signup never checks a host subscription', async () => {
    const signup = extract(app, 'async function handleTeamInviteSignup(', 'async function handleForgotPassword(');
    assert.doesNotMatch(signup, /checkSubscriptionLimit|\.from\(['"]profiles['"]\)/);
    const migration = fs.readFileSync(path.join(root, 'supabase', 'migrations', '202607210001_team_member_invites.sql'), 'utf8');
    const accept = extract(migration, 'CREATE OR REPLACE FUNCTION public.accept_team_member_invite()', 'DROP TRIGGER IF EXISTS on_auth_user_created_accept_team_invite');
    assert.doesNotMatch(accept, /profiles|subscription/i);
});
