const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');
const start = source.indexOf('function normalizeAirbnbText(');
const end = source.indexOf('function carregarPropriedadesDocumentos(', start);
assert.ok(start >= 0 && end > start);

function createParser() {
    const calls = { inserted: [], warnings: [] };
    const query = {
        select() { return this; },
        eq() { return this; },
        like() { return this; },
        gte() { return this; },
        lte() { return Promise.resolve({ data: [], error: null }); },
        insert(rows) { calls.inserted.push(...rows); return Promise.resolve({ error: null }); }
    };
    const context = {
        supabaseClient: { from: () => query },
        currentUser: { id: 'user' },
        console: { warn: (...args) => calls.warnings.push(args) },
        extractTextFromPDF: async file => file.text
    };
    vm.createContext(context);
    vm.runInContext(source.slice(start, end), context);
    return { context, calls };
}

const properties = [
    { id: 'generic', name: 'House' },
    { id: 'blue', name: 'Casa Azul' },
    { id: 'sea', name: 'Sea House' }
];

test('report period prefers labelled month to generation date and supports numeric periods', () => {
    const { context } = createParser();
    assert.equal(context.resolvePlatformReportDate(['Gerado em 05/11/2026', 'Relatório de outubro de 2026']), '2026-10-01');
    assert.equal(context.resolvePlatformReportDate(['Generated on 2026-11-05', 'Statement period: 10/2026']), '2026-10-01');
    assert.equal(context.resolvePlatformReportDate(['Statement: October 2026 generated on November 2026']), '2026-10-01');
    assert.equal(context.resolvePlatformReportDate(['Generated on 2026-11-05 | Statement: October 2026']), '2026-10-01');
    assert.equal(context.resolvePlatformReportDate(['Period: 01/10/2026 - 31/10/2026']), '2026-10-01');
    assert.equal(context.resolvePlatformReportDate(['Period: 01/10/2026 - 30/11/2026']), null);
    assert.equal(context.resolvePlatformReportDate(['Generated on 2026-11-05']), null);
});

test('standalone headings do not match a generic property inside an unrelated name', () => {
    const { context, calls } = createParser();
    const rows = context.collectPropertyRows(['Unknown House', 'Casa Azul'], properties, null);
    assert.equal(rows.length, 2);
    assert.equal(rows[0].property, null);
    assert.equal(rows[1].property.id, 'blue');
    assert.equal(calls.warnings.length, 1);
});

for (const [platform, parser] of [['Airbnb', 'processAirbnbPDF'], ['Booking.com', 'processBookingPDF']]) {
    test(`${platform} maps each listing and uses the report period rather than payout date`, async () => {
        const { context, calls } = createParser();
        const file = { text: [
            'Gerado em 05/11/2026',
            'Relatório de outubro de 2026',
            'Anúncio: Casa Azul | 03/11/2026 | Pagamento 125,50 EUR',
            'Anúncio: Unknown House | 04/11/2026 | Pagamento 999,00 EUR',
            'Anúncio: Sea House | 05/11/2026 | Pagamento 50,00 EUR'
        ].join('\n') };
        const result = await context[parser](file, properties, 'generic');
        assert.equal(result.inserted, 2);
        assert.deepEqual(calls.inserted.map(row => [row.property_id, row.amount, row.occurred_on, row.entry_date]), [
            ['blue', 125.5, '2026-10-01', '2026-10-01'],
            ['sea', 50, '2026-10-01', '2026-10-01']
        ]);
        assert.equal(calls.warnings.length, 1);
        assert.match(calls.warnings[0][1], /Unknown House/);
    });

    test(`${platform} never falls back to the first property or upload date`, async () => {
        const { context, calls } = createParser();
        const file = { text: 'Anúncio: Unknown House | 05/11/2026 | Pagamento 999,00 EUR' };
        const result = await context[parser](file, properties);
        assert.equal(result.inserted, 0);
        assert.equal(calls.inserted.length, 0);
        assert.ok(calls.warnings.length);
    });

    test(`${platform} does not assign an unlabelled unknown listing to a generic name`, async () => {
        const { context, calls } = createParser();
        const file = { text: [
            'Relatório de outubro de 2026',
            'Casa Azul 03/11/2026 Pagamento 125,50 EUR',
            'Unknown House 04/11/2026 Pagamento 999,00 EUR',
            'Sea House 05/11/2026 Pagamento 50,00 EUR'
        ].join('\n') };
        await context[parser](file, properties, 'generic');
        assert.deepEqual(calls.inserted.map(row => row.property_id), ['blue', 'sea']);
        assert.match(calls.warnings[0][1], /Unknown House/);
    });
}

test('Booking keeps transactions in separate months when no report period is specified', async () => {
    const { context, calls } = createParser();
    await context.processBookingPDF({ text: [
        'Anúncio: Casa Azul',
        'Reserva 12345 30/10/2026 Pagamento 100,00 EUR',
        'Reserva 67890 02/11/2026 Pagamento 50,00 EUR'
    ].join('\n') }, properties);
    assert.deepEqual(calls.inserted.map(row => [row.property_id, row.amount, row.occurred_on]), [
        ['blue', 100, '2026-10-30'],
        ['blue', 50, '2026-11-02']
    ]);
});

test('an explicitly selected property is used only when no listing name is present', async () => {
    const { context, calls } = createParser();
    await context.processAirbnbPDF({ text: 'Relatório outubro de 2026\n03/11/2026 Pagamento 75,00 EUR' }, properties, 'blue');
    assert.equal(calls.inserted.length, 1);
    assert.equal(calls.inserted[0].property_id, 'blue');
    assert.equal(calls.inserted[0].occurred_on, '2026-10-01');
});

test('undated movements are not assigned to the upload date', async () => {
    const { context, calls } = createParser();
    await context.processBookingPDF({ text: 'Anúncio: Casa Azul | Pagamento 75,00 EUR' }, properties);
    assert.equal(calls.inserted.length, 0);
    assert.ok(calls.warnings.length);
});
