const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'equipas.js'), 'utf8');
const start = source.indexOf('function normalizeTeamPhone(');
const end = source.indexOf('async function updateTeamMemberPreference(', start);
assert.ok(start >= 0 && end > start);

function setup({ phone = '+351 912 345 678', popup = true, rpcError = null } = {}) {
    const calls = [];
    const popupWindow = { location: {}, close: () => calls.push('close') };
    const context = {
        URL,
        Date,
        encodeURIComponent,
        currentUser: { id: 'manager' },
        currentLang: 'pt',
        i18n: { pt: { role_locked: 'Sem acesso', team_link_copied: 'Copiado' } },
        requireAdminAction: () => true,
        teamInviteTokens: new Map(),
        teamInviteRequests: new Map(),
        TEAM_INVITE_LIFETIME_MS: 7 * 24 * 60 * 60 * 1000,
        document: { querySelectorAll: selector => selector.includes('phone')
            ? [{ dataset: { teamPhoneId: 'member' }, value: phone }]
            : [{ dataset: { teamNameId: 'member' }, value: 'Ana' }] },
        window: {
            location: { href: 'https://example.test/app/?invite=old&other=secret#token' },
            open: () => { calls.push('open'); return popup ? popupWindow : null; }
        },
        supabaseClient: { rpc: async (name, args) => {
            calls.push(['rpc', name, args.p_member_id]);
            return { data: rpcError ? null : [{ invite_token: 'fresh-token' }], error: rpcError };
        } },
        showToast: (...args) => calls.push(['toast', ...args]),
        console: { error: (...args) => calls.push(['error', ...args]) }
    };
    vm.createContext(context);
    vm.runInContext(source.slice(start, end), context);
    return { context, calls, popupWindow };
}

test('message opens synchronously and contains a usable encoded invite link and phone', async () => {
    const { context, calls, popupWindow } = setup();
    const pending = context.sendTeamAccessByWhatsApp('member');
    assert.deepEqual(calls[0], 'open');
    await pending;
    assert.deepEqual(calls[1], ['rpc', 'rotate_team_member_invite', 'member']);
    const whatsappUrl = new URL(popupWindow.location.href);
    assert.equal(whatsappUrl.origin, 'https://wa.me');
    assert.equal(whatsappUrl.pathname, '/351912345678');
    const message = whatsappUrl.searchParams.get('text');
    assert.match(message, /Olá Ana/);
    assert.ok(message.includes('https://example.test/app/?invite=fresh-token'));
    assert.ok(!message.includes('other=secret'));
    assert.ok(!message.includes('#token'));
});

test('cached token is reused until expiry, including concurrent link requests', async () => {
    const { context, calls } = setup();
    const [first, second] = await Promise.all([context.getTeamAccessLink('member'), context.getTeamAccessLink('member')]);
    assert.equal(first, second);
    assert.equal(calls.filter(call => Array.isArray(call) && call[0] === 'rpc').length, 1);
    await context.getTeamAccessLink('member');
    assert.equal(calls.filter(call => Array.isArray(call) && call[0] === 'rpc').length, 1);
    context.teamInviteTokens.get('member').expiresAt = Date.now() - 1;
    await context.getTeamAccessLink('member');
    assert.equal(calls.filter(call => Array.isArray(call) && call[0] === 'rpc').length, 2);
    context.currentUser.id = 'other-manager';
    await context.getTeamAccessLink('member');
    assert.equal(calls.filter(call => Array.isArray(call) && call[0] === 'rpc').length, 3);
});

test('blocked popups and invalid phones do not rotate a token', async () => {
    const blocked = setup({ popup: false });
    await blocked.context.sendTeamAccessByWhatsApp('member');
    assert.equal(blocked.calls.some(call => Array.isArray(call) && call[0] === 'rpc'), false);
    assert.match(blocked.calls.at(-1)[1], /Copiar Link/);
    const invalid = setup({ phone: '' });
    await invalid.context.sendTeamAccessByWhatsApp('member');
    assert.equal(invalid.calls.includes('open'), false);
    assert.equal(invalid.calls.at(-1)[2], 'error');
});

test('RPC errors close the popup and are reported', async () => {
    const { context, calls } = setup({ rpcError: new Error('RPC failed') });
    await context.sendTeamAccessByWhatsApp('member');
    assert.ok(calls.includes('close'));
    assert.match(calls.at(-1)[1], /RPC failed/);
    assert.equal(calls.at(-1)[2], 'error');
});

test('a local file URL is rejected before rotating an invite', async () => {
    const { context, calls } = setup();
    context.window.location.href = 'file:///C:/app/index.html';
    await assert.rejects(context.getTeamAccessLink('member'), /endereço web/);
    assert.equal(calls.some(call => Array.isArray(call) && call[0] === 'rpc'), false);
});

test('international numbers with 00 prefix keep their country code', () => {
    const { context } = setup();
    assert.equal(context.formatPhoneForWhatsApp('0044 7700 900123'), '447700900123');
    assert.equal(context.formatPhoneForWhatsApp('912 345 678'), '351912345678');
});

test('newly entered phone numbers do not leave the WhatsApp button permanently disabled', () => {
    const button = source.match(/<button type="button" data-team-whatsapp-id=[^\n]+/);
    assert.ok(button);
    assert.doesNotMatch(button[0], /disabled/);
});
