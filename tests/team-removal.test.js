const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'equipas.js'), 'utf8');
const start = source.indexOf('async function removeTeamMember(');
assert.ok(start >= 0);

function setup({ authorized = true, confirmed = true, response = { data: { success: true }, error: null }, failure = null, refresh = true } = {}) {
    const calls = [];
    const tokens = new Map([['member-id', 'token']]);
    const context = {
        requireAdminAction: () => authorized,
        confirm: () => confirmed,
        supabaseClient: { functions: { invoke: async (name, options) => {
            calls.push(['invoke', name, options.body.userId]);
            if (failure) throw failure;
            return response;
        } } },
        teamInviteTokens: tokens,
        fetchTeamMembers: async () => { calls.push(['refresh']); return refresh; },
        showToast: (...args) => calls.push(['toast', ...args]),
        console: { error: (...args) => calls.push(['log', ...args]) }
    };
    vm.createContext(context);
    vm.runInContext(source.slice(start), context);
    return { context, calls, tokens };
}

test('successful removal invokes the edge function with the member ID and refreshes the list', async () => {
    const { context, calls, tokens } = setup();
    await context.removeTeamMember('member-id');
    assert.deepEqual(calls, [
        ['invoke', 'delete-team-member', 'member-id'],
        ['toast', 'Membro e conta removidos com sucesso.'],
        ['refresh']
    ]);
    assert.equal(tokens.has('member-id'), false);
});

test('cancellation and unauthorized requests do not invoke the edge function', async () => {
    for (const options of [{ authorized: false }, { confirmed: false }]) {
        const { context, calls, tokens } = setup(options);
        await context.removeTeamMember('member-id');
        assert.deepEqual(calls, []);
        assert.equal(tokens.has('member-id'), true);
    }
});

test('function errors and rejected requests retain the member and report the failure', async () => {
    for (const options of [
        { response: { data: null, error: new Error('HTTP failure') } },
        { response: { data: { error: 'Forbidden' }, error: null } },
        { response: { data: { success: false }, error: null } },
        { failure: new Error('Network failure') }
    ]) {
        const { context, calls, tokens } = setup(options);
        await context.removeTeamMember('member-id');
        assert.equal(calls.filter(call => call[0] === 'invoke').length, 1);
        assert.equal(calls.some(call => call[0] === 'refresh'), false);
        assert.equal(calls.find(call => call[0] === 'toast')[2], 'error');
        assert.equal(tokens.has('member-id'), true);
    }
});

test('refresh failure is reported separately after successful removal', async () => {
    const { context, calls, tokens } = setup({ refresh: false });
    await context.removeTeamMember('member-id');
    assert.equal(tokens.has('member-id'), false);
    assert.deepEqual(calls.at(-1), ['toast', 'O membro foi removido, mas não foi possível atualizar a lista.', 'error']);
});
