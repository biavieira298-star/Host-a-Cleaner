const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const app = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');
const start = app.indexOf('async function runButtonAction(');
const end = app.indexOf('function showToast(', start);
assert.ok(start >= 0 && end > start);

function setup() {
    const errors = [];
    const toasts = [];
    const context = {
        console: { error: (...args) => errors.push(args) },
        showToast: (...args) => toasts.push(args),
        i18n: { pt: { action_error: 'Erro na ação' } },
        currentLang: 'pt'
    };
    vm.createContext(context);
    vm.runInContext(app.slice(start, end), context);
    return { context, errors, toasts };
}

function makeButton() {
    const attributes = new Map();
    return {
        disabled: false,
        dataset: {},
        innerHTML: '<span>Ícone</span> Guardar',
        getAttribute: name => attributes.has(name) ? attributes.get(name) : null,
        setAttribute: (name, value) => attributes.set(name, value),
        removeAttribute: name => attributes.delete(name)
    };
}

test('button remains busy while pending, blocks duplicates and preserves its content', async () => {
    const { context } = setup();
    const button = makeButton();
    let finish;
    let calls = 0;
    const pending = context.runButtonAction(button, () => {
        calls++;
        return new Promise(resolve => { finish = resolve; });
    });
    assert.equal(button.disabled, true);
    assert.equal(button.dataset.actionLoading, 'true');
    assert.equal(button.getAttribute('aria-busy'), 'true');
    assert.equal(button.innerHTML, '<span>Ícone</span> Guardar');
    await context.runButtonAction(button, () => calls++);
    button.disabled = false;
    await context.runButtonAction(button, () => calls++);
    assert.equal(calls, 1);
    finish('done');
    assert.equal(await pending, 'done');
    assert.equal(button.disabled, false);
    assert.equal(button.dataset.actionLoading, undefined);
    assert.equal(button.getAttribute('aria-busy'), null);
    assert.equal(button.innerHTML, '<span>Ícone</span> Guardar');
});

test('failure is reported and busy state restored', async () => {
    const { context, errors, toasts } = setup();
    const button = makeButton();
    button.setAttribute('aria-busy', 'false');
    await context.runButtonAction(button, async () => { throw new Error('falhou'); });
    assert.equal(button.disabled, false);
    assert.equal(button.getAttribute('aria-busy'), 'false');
    assert.equal(button.dataset.actionLoading, undefined);
    assert.equal(errors.length, 1);
    assert.deepEqual(toasts[0], ['Erro na ação: falhou', 'error']);
});

test('form action prevents default and uses the submitter or fallback submit button', async () => {
    const { context } = setup();
    const button = makeButton();
    const fallback = makeButton();
    let prevented = 0;
    let calls = 0;
    const form = { querySelector: () => fallback };
    await context.runFormAction({ preventDefault: () => prevented++, currentTarget: form, submitter: button }, () => {
        assert.equal(button.disabled, true);
        calls++;
    });
    await context.runFormAction({ preventDefault: () => prevented++, currentTarget: form }, () => {
        assert.equal(fallback.disabled, true);
        calls++;
    });
    assert.equal(prevented, 2);
    assert.equal(calls, 2);
    assert.equal(button.disabled, false);
    assert.equal(fallback.disabled, false);
});

test('disabled and missing buttons never run actions and missing button is reported', async () => {
    const { context, errors, toasts } = setup();
    const button = makeButton();
    button.disabled = true;
    let calls = 0;
    await context.runButtonAction(button, () => calls++);
    await context.runButtonAction(null, () => calls++);
    assert.equal(calls, 0);
    assert.equal(button.disabled, true);
    assert.equal(errors.length, 1);
    assert.deepEqual(toasts[0], ['Erro na ação', 'error']);
});

test('form action keeps a button disabled when the business rule changes during the action', async () => {
    const { context } = setup();
    const button = makeButton();
    let restricted = false;
    await context.runFormAction(
        { preventDefault() {}, submitter: button },
        async () => { restricted = true; },
        () => restricted
    );
    assert.equal(button.disabled, true);
    assert.equal(button.dataset.actionLoading, undefined);
});

test('cleaning submission restores its button even when the request rejects', async () => {
    const start = app.indexOf('async function handleAddCleaningSubmit(');
    const end = app.indexOf('function openDayTasksModal(', start);
    assert.ok(start >= 0 && end > start);
    const button = makeButton();
    const elements = {
        'modal-cleaning-prop': { value: 'property' },
        'modal-cleaning-date': { value: '2026-01-01' },
        'modal-cleaning-notes': { value: '' },
        'btn-submit-add-cleaning': button
    };
    const context = {
        document: { getElementById: id => elements[id] },
        requireAdminAction: () => true,
        supabaseClient: { from: () => ({ insert: async () => { throw new Error('network'); } }) }
    };
    vm.createContext(context);
    vm.runInContext(app.slice(start, end), context);
    await assert.rejects(context.handleAddCleaningSubmit({ preventDefault() {} }), /network/);
    assert.equal(button.disabled, false);
    assert.equal(button.innerHTML, '<span>Ícone</span> Guardar');
});
