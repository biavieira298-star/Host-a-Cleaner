const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');
const start = source.indexOf('async function loadProfileSettings()');
const end = source.indexOf('async function saveOperationalPreferences()', start);
assert.ok(start >= 0 && end > start);

function setup(error = null) {
    const elements = Object.fromEntries([
        'profile-email-val', 'profile-contact-email', 'profile-contact-phone',
        'profile-contact-message', 'settings-track-hours', 'settings-require-photos'
    ].map(id => [id, { value: '', textContent: '', className: '' }]));
    const calls = [];
    const context = {
        document: { getElementById: id => elements[id] },
        currentUser: { id: 'user', email: 'old@example.com', user_metadata: { phone: '123', name: 'Ana' } },
        supabaseClient: { auth: { updateUser: async updates => {
            calls.push(JSON.parse(JSON.stringify(updates)));
            if (error) return { data: { user: null }, error };
            const user = { ...context.currentUser, user_metadata: { ...context.currentUser.user_metadata, ...updates.data } };
            return { data: { user }, error: null };
        } } },
        i18n: { pt: {
            profile_contact_saved: 'saved',
            profile_contact_unchanged: 'unchanged',
            profile_contact_confirm: 'confirm new email',
            profile_contact_error: 'error',
            profile_contact_session_changed: 'session changed'
        } },
        currentLang: 'pt',
        userRole: 'cleaner',
        operationalPreferences: {},
        localStorage: { getItem: () => null },
        getOperationalPreferencesStorageKey: () => 'preferences',
        applyThemePreference() {},
        loadAccountDeletionStatus: async () => {},
        applyOperationalPreferencesToInviteForm() {},
        console: { error() {} }
    };
    vm.createContext(context);
    vm.runInContext(source.slice(start, end), context);
    return { context, elements, calls };
}

test('contact settings prefill and retain a saved or cleared phone number', async () => {
    const { context, elements, calls } = setup();
    await context.loadProfileSettings();
    assert.equal(elements['profile-contact-email'].value, 'old@example.com');
    assert.equal(elements['profile-contact-phone'].value, '123');
    elements['profile-contact-phone'].value = '  +351 912 345 678  ';
    await context.saveProfileContact({ preventDefault() {} });
    assert.deepEqual(calls, [{ data: { phone: '+351 912 345 678' } }]);
    assert.equal(elements['profile-contact-message'].textContent, 'saved');
    await context.loadProfileSettings();
    assert.equal(elements['profile-contact-phone'].value, '+351 912 345 678');
    elements['profile-contact-phone'].value = '';
    await context.saveProfileContact({ preventDefault() {} });
    await context.loadProfileSettings();
    assert.equal(elements['profile-contact-phone'].value, '');
    assert.equal(context.currentUser.user_metadata.name, 'Ana');
});

test('email changes request confirmation and can be saved with the phone', async () => {
    for (const phone of ['123', '456']) {
        const { context, elements, calls } = setup();
        await context.loadProfileSettings();
        elements['profile-contact-email'].value = ' new@example.com ';
        elements['profile-contact-phone'].value = phone;
        await context.saveProfileContact({ preventDefault() {} });
        assert.deepEqual(calls, [phone === '123'
            ? { email: 'new@example.com' }
            : { email: 'new@example.com', data: { phone: '456' } }]);
        assert.equal(elements['profile-contact-message'].textContent, 'confirm new email');
        assert.equal(elements['profile-email-val'].textContent, 'old@example.com');
    }
});

test('unchanged values do not call Supabase and errors are shown without claiming success', async () => {
    const unchanged = setup();
    await unchanged.context.loadProfileSettings();
    await unchanged.context.saveProfileContact({ preventDefault() {} });
    assert.equal(unchanged.calls.length, 0);
    assert.equal(unchanged.elements['profile-contact-message'].textContent, 'unchanged');

    const failed = setup(new Error('denied'));
    await failed.context.loadProfileSettings();
    failed.elements['profile-contact-phone'].value = '456';
    await failed.context.saveProfileContact({ preventDefault() {} });
    assert.equal(failed.elements['profile-contact-message'].textContent, 'error: denied');
    assert.match(failed.elements['profile-contact-message'].className, /text-rose-600/);
    assert.equal(failed.context.currentUser.user_metadata.phone, '123');
});
