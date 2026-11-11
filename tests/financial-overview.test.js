const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');

function extractFunction(start, next) {
    const startIndex = source.indexOf(start);
    const endIndex = source.indexOf(next, startIndex);
    assert.ok(startIndex >= 0 && endIndex > startIndex);
    return source.slice(startIndex, endIndex);
}

function makeElement(value = '') {
    return {
        value,
        innerHTML: '',
        replaceChildren(...children) { this.children = children; }
    };
}

function createReportEnvironment(month, selectedProperty = 'p1', entriesError = null) {
    const elements = Object.fromEntries([
        'reports-summary-cards', 'reports-property-list', 'financial-property',
        'financial-filter-property', 'financial-filter-month', 'hosting-report-property',
        'financial-entry-submit', 'hosting-report-submit'
    ].map(id => [id, makeElement()]));
    elements['financial-filter-month'].value = month;
    elements['financial-filter-property'].value = selectedProperty;
    const entries = [
        { id: '1', property_id: 'p1', entry_type: 'income', amount: '125.50', occurred_on: `${month}-01` },
        { id: '2', property_id: 'p1', entry_type: 'expense', amount: '25.25', occurred_on: `${month}-01` },
        { id: '3', property_id: 'p1', entry_type: 'income', amount: null, occurred_on: `${month}-01` },
        { id: '4', property_id: 'p1', entry_type: 'income', occurred_on: `${month}-01` },
        { id: '5', property_id: 'p1', entry_type: 'income', amount: 'invalid', occurred_on: `${month}-01` },
        { id: '6', property_id: 'p2', entry_type: 'income', amount: '999', occurred_on: `${month}-01` }
    ];
    const calls = { logs: [], warnings: [], errors: [], messages: [], filters: [] };
    const supabaseClient = {
        from(table) {
            const filters = [];
            const query = {
                select() { return query; },
                eq(column, value) { filters.push(['eq', column, value]); return query; },
                gte(column, value) { filters.push(['gte', column, value]); return query; },
                lt(column, value) { filters.push(['lt', column, value]); return query; },
                order() { return query; },
                then(resolve, reject) {
                    let result;
                    if (table === 'property_financial_entries') {
                        calls.filters = filters;
                        const data = entries.filter(entry => filters.every(([op, column, value]) => {
                            if (column === 'user_id') return true;
                            if (op === 'eq') return entry[column] === value;
                            if (op === 'gte') return entry[column] >= value;
                            return entry[column] < value;
                        }));
                        result = { data: entriesError ? null : data, error: entriesError };
                    } else {
                        result = { data: table === 'properties' ? [{ id: 'p1', name: 'Casa' }] : [], error: null };
                    }
                    return Promise.resolve(result).then(resolve, reject);
                }
            };
            return query;
        }
    };
    const context = {
        document: { getElementById: id => elements[id] },
        supabaseClient,
        currentUser: { id: 'user' },
        userRole: 'admin',
        currentLang: 'pt',
        i18n: { pt: { reports_loading: 'loading', reports_load_error: 'error' } },
        reportsRequestId: 0,
        getLocalDateString: () => '2024-02-10',
        hidePropertyMessage() {},
        showPropertyMessage: (...args) => calls.messages.push(args),
        Option: function Option(text, value) { this.text = text; this.value = value; },
        formatFinancialAmount: String,
        escapePropertyHTML: String,
        console: {
            log: (...args) => calls.logs.push(args),
            warn: (...args) => calls.warnings.push(args),
            error: (...args) => calls.errors.push(args)
        }
    };
    vm.createContext(context);
    vm.runInContext(extractFunction('async function carregarRelatorios()', 'async function registarMovimentoFinanceiro('), context);
    return { context, elements, entries, calls };
}

test('overview filters by the selected month and property and sums valid numeric values', async () => {
    for (const [month, nextMonth, lastDay] of [
        ['2024-02', '2024-03-01', '2024-02-29'],
        ['2024-12', '2025-01-01', '2024-12-31'],
        ['0099-12', '0100-01-01', '0099-12-31']
    ]) {
        const { context, elements, entries, calls } = createReportEnvironment(month);
        entries.push(
            { id: '7', property_id: 'p1', entry_type: 'income', amount: '10', occurred_on: lastDay },
            { id: '8', property_id: 'p1', entry_type: 'income', amount: '999', occurred_on: nextMonth }
        );
        await context.carregarRelatorios();
        const cards = elements['reports-summary-cards'].innerHTML;
        assert.match(cards, />135\.5</);
        assert.match(cards, />25\.25</);
        assert.match(cards, />110\.25</);
        assert.match(elements['reports-property-list'].innerHTML, />135\.5</);
        assert.ok(calls.filters.some(filter => filter.join('|') === `gte|occurred_on|${month}-01`));
        assert.ok(calls.filters.some(filter => filter.join('|') === `lt|occurred_on|${nextMonth}`));
        assert.ok(calls.filters.some(filter => filter.join('|') === 'eq|property_id|p1'));
        assert.equal(calls.logs[0][1].count, 6);
        assert.equal(calls.logs[0][1].error, null);
        assert.equal(calls.warnings.length, 3);
        assert.equal(calls.errors.length, 0);
    }
});

test('overview reports Supabase errors and rejects invalid months', async () => {
    const queryError = { message: 'query failed' };
    const failed = createReportEnvironment('2024-02', 'all', queryError);
    await failed.context.carregarRelatorios();
    assert.equal(failed.calls.logs[0][1].error, queryError);
    assert.equal(failed.calls.messages[0][2], 'error');
    const invalid = createReportEnvironment('2024-13');
    await invalid.context.carregarRelatorios();
    assert.equal(invalid.calls.logs.length, 0);
    assert.equal(invalid.calls.messages[0][2], 'error');
});

test('successful Airbnb and Booking imports refresh overview before loading documents', async () => {
    for (const platform of ['Airbnb', 'Booking.com']) {
        const calls = [];
        const elements = {
            'hosting-report-platform': makeElement(platform),
            'hosting-report-month': makeElement('2026-10'),
            'hosting-wrong-month': makeElement(),
            'hosting-report-file': { files: [{ name: 'report.pdf', type: 'application/pdf' }] },
            'hosting-report-submit': makeElement(),
            'hosting-report-form': { reset() {} },
            'hosting-report-file-label': makeElement()
        };
        const client = {
            auth: { getUser: async () => ({ data: { user: { id: 'user' } }, error: null }) },
            storage: { from: () => ({
                upload: async () => ({ error: null }),
                getPublicUrl: () => ({ data: { publicUrl: 'url' } })
            }) },
            from: table => table === 'platform_documents'
                ? { insert: () => ({ select: () => ({ single: async () => ({ data: { id: 'doc1' }, error: null }) }) }) }
                : { select: () => ({ eq: async () => ({ data: [{ id: 'p1', name: 'Casa' }], error: null }) }) }
        };
        const importReport = async (file, properties, month, documentId) => {
            assert.equal(month, '2026-10');
            assert.equal(documentId, 'doc1');
            calls.push('import');
            return { matched: 1, inserted: 1, replaced: 0 };
        };
        const context = {
            document: { getElementById: id => elements[id] },
            supabaseClient: client,
            currentUser: { id: 'user' },
            userRole: 'admin',
            currentLang: 'pt',
            i18n: { pt: {
                hosting_airbnb_import_success: '{count}/{replaced}',
                hosting_booking_import_success: '{count}/{replaced}'
            } },
            crypto: { randomUUID: () => 'document' },
            validateHostingReportFile: () => true,
            hidePropertyMessage() {},
            showPropertyMessage: (...args) => calls.push(args[2]),
            processAirbnbPDF: importReport,
            processBookingPDF: importReport,
            carregarRelatorios: async () => { calls.push('overview'); },
            renderFinancialChart: async () => { calls.push('chart'); },
            carregarLancamentosManuais: async () => { calls.push('entries'); },
            carregarDocumentosHosting: async () => { calls.push('documents'); },
            console
        };
        vm.createContext(context);
        vm.runInContext(extractFunction('async function submitHostingReport(event)', 'function getPlatformDocumentStoragePath('), context);
        await context.submitHostingReport({ preventDefault() {} });
        assert.deepEqual(calls, ['import', 'overview', 'chart', 'entries', 'documents', 'success']);
    }
});

test('deleting a document removes its row and refreshes financial views', async () => {
    const calls = [];
    const query = {
        delete() { calls.push('delete'); return this; },
        eq(column, value) { calls.push(`${column}:${value}`); return this; },
        select() { return this; },
        single: async () => ({ error: null })
    };
    const context = {
        requireAdminAction: () => true,
        hostingReportsCache: [{ id: 'doc1', file_url: 'url' }],
        window: { confirm: () => true },
        i18n: { pt: { hosting_delete_confirm: 'confirm' } },
        currentLang: 'pt',
        currentUser: { id: 'user' },
        hidePropertyMessage() {},
        getPlatformDocumentStoragePath: () => 'file.pdf',
        supabaseClient: {
            storage: { from: () => ({ remove: async () => { calls.push('storage'); return { error: null }; } }) },
            from: () => query
        },
        carregarDocumentosHosting: async () => calls.push('documents'),
        carregarRelatorios: async () => calls.push('overview'),
        renderFinancialChart: async () => calls.push('chart'),
        carregarLancamentosManuais: async () => calls.push('entries'),
        console
    };
    vm.createContext(context);
    vm.runInContext(extractFunction('async function deleteHostingReport(reportId)', 'async function togglePaymentStatus('), context);
    await context.deleteHostingReport('doc1');
    assert.deepEqual(calls, ['storage', 'delete', 'id:doc1', 'user_id:user', 'documents', 'overview', 'chart', 'entries']);
});

test('document deletion reports a database failure after storage removal', async () => {
    const messages = [];
    const query = {
        delete() { return this; },
        eq() { return this; },
        select() { return this; },
        single: async () => ({ error: new Error('row failure') })
    };
    const context = {
        requireAdminAction: () => true,
        hostingReportsCache: [{ id: 'doc1', file_url: 'url' }],
        window: { confirm: () => true },
        i18n: { pt: { hosting_delete_confirm: 'confirm', hosting_delete_row_error: 'file removed' } },
        currentLang: 'pt',
        currentUser: { id: 'user' },
        hidePropertyMessage() {},
        getPlatformDocumentStoragePath: () => 'file.pdf',
        supabaseClient: {
            storage: { from: () => ({ remove: async () => ({ error: null }) }) },
            from: () => query
        },
        showPropertyMessage: (...args) => messages.push(args),
        console: { error() {} }
    };
    vm.createContext(context);
    vm.runInContext(extractFunction('async function deleteHostingReport(reportId)', 'async function togglePaymentStatus('), context);
    await context.deleteHostingReport('doc1');
    assert.equal(messages[0][0], 'hosting-documents-message');
    assert.match(messages[0][1], /file removed: row failure/);
});
