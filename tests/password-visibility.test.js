const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const app = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');

test('password visibility toggles the input, SVG states and pressed state', () => {
    const input = { type: 'password' };
    const hiddenStates = {};
    const icons = Object.fromEntries(['password-visible', 'password-hidden'].map(name => [
        `.${name}`, { classList: { toggle: (className, hidden) => { hiddenStates[name] = hidden; } } }
    ]));
    const button = { setAttribute: (name, value) => { button[name] = value; } };
    const icon = { querySelector: selector => icons[selector], parentElement: button };
    const context = { document: { getElementById: id => id === 'password' ? input : icon } };
    vm.createContext(context);
    vm.runInContext(app.slice(app.indexOf('function togglePasswordVisibility('), app.indexOf('// Função para Mudar de Idioma')), context);

    context.togglePasswordVisibility('password', 'icon');
    assert.equal(input.type, 'text');
    assert.equal(button['aria-pressed'], 'true');
    assert.equal(hiddenStates['password-visible'], false);
    assert.equal(hiddenStates['password-hidden'], true);

    context.togglePasswordVisibility('password', 'icon');
    assert.equal(input.type, 'password');
    assert.equal(button['aria-pressed'], 'false');
    assert.equal(hiddenStates['password-visible'], true);
    assert.equal(hiddenStates['password-hidden'], false);
});
