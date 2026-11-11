const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'js', 'app.js'), 'utf8');
const team = fs.readFileSync(path.join(root, 'js', 'equipas.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
const start = app.indexOf('function showToast(');
const end = app.indexOf('function escapePropertyHTML(', start);
assert.ok(start >= 0 && end > start);

function createEnvironment(withContainer = true) {
    const toasts = [];
    const timers = [];
    const errors = [];
    const container = { appendChild: toast => toasts.push(toast) };
    const context = {
        document: {
            getElementById: () => withContainer ? container : null,
            createElement: () => ({
                classList: { add(value) { this.added = value; } },
                remove() { this.removed = true; }
            })
        },
        setTimeout: (callback, delay) => timers.push({ callback, delay }),
        console: { error: (...args) => errors.push(args) }
    };
    vm.createContext(context);
    vm.runInContext(app.slice(start, end), context);
    return { context, toasts, timers, errors };
}

test('toast types safely render messages, animate and are removed after four seconds', () => {
    const { context, toasts, timers } = createEnvironment();
    context.showToast('<img src=x>');
    context.showToast('Erro\nDetalhes', 'error');
    context.showToast('Informação', 'info');
    assert.deepEqual(toasts.map(toast => toast.className), ['toast toast-success', 'toast toast-error', 'toast toast-info']);
    assert.equal(toasts[0].textContent, '<img src=x>');
    assert.equal(toasts[1].textContent, 'Erro\nDetalhes');
    assert.deepEqual(timers.map(timer => timer.delay), [3800, 3800, 3800]);
    timers[0].callback();
    assert.equal(toasts[0].classList.added, 'toast-leaving');
    assert.equal(timers[3].delay, 200);
    timers[3].callback();
    assert.equal(toasts[0].removed, true);
    assert.equal(toasts[1].removed, undefined);
});

test('invalid type and missing container are explicitly logged', () => {
    const invalid = createEnvironment();
    invalid.context.showToast('message', 'unknown');
    assert.equal(invalid.toasts[0].className, 'toast toast-info');
    assert.equal(invalid.errors.length, 1);
    const missing = createEnvironment(false);
    missing.context.showToast('message');
    assert.equal(missing.errors.length, 1);
    assert.equal(missing.timers.length, 0);
});

test('toast container is globally available and no native alert calls remain', () => {
    assert.match(html, /id="toast-container"[^>]*aria-live="polite"/);
    assert.match(css, /prefers-reduced-motion:\s*reduce/);
    assert.doesNotMatch(app, /\b(?:window\.)?alert\s*\(/);
    assert.doesNotMatch(team, /\b(?:window\.)?alert\s*\(/);
});
