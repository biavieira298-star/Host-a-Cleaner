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
    const calls = { inserted: [], warnings: [], logs: [], requests: [], confirmations: [] };
    const context = {
        supabaseClient: { rpc: async (name, args) => {
            calls.requests.push({ name, args });
            calls.inserted.push(...args.p_entries.map(entry => ({ ...entry, entry_date: entry.occurred_on })));
            return { data: 2, error: null };
        } },
        currentUser: { id: 'user' },
        currentLang: 'pt',
        i18n: { pt: {
            hosting_unmatched_properties: 'unmatched',
            hosting_missing_date: 'missing date',
            hosting_replace_confirm: 'Replace {platform} {months}?',
            hosting_replace_cancelled: 'cancelled'
        } },
        window: { confirm: message => { calls.confirmations.push(message); return true; } },
        console: {
            warn: (...args) => calls.warnings.push(args),
            log: (...args) => calls.logs.push(args)
        },
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

test('property matching normalizes formatting and supports partial names in both directions', () => {
    const { context } = createParser();
    const listings = [
        { id: 'room-b', name: '1st Floor: Room B' },
        { id: 'room-a', name: '1st Floor: Room A' },
        { id: 'blue', name: 'Casa Azul' }
    ];
    assert.equal(context.normalizeAirbnbText('  1ST  FLÓOR: Room-B '), '1st floor room b');
    assert.equal(context.findBestPropertyForReportText('1st Floor Room B', listings, true).id, 'room-b');
    assert.equal(context.findBestPropertyForReportText('Casa Azul Lisboa', listings, true).id, 'blue');
    assert.equal(context.findBestPropertyForReportText('Casa Azul vista maravilhosa para o mar', listings, true).id, 'blue');
    assert.equal(context.findBestPropertyForReportText('Unknown House', properties, true), null);
    assert.equal(context.findBestPropertyForReportText('1st Floor Room', listings, true), null);
    assert.equal(context.findBestPropertyForReportText('Casa Azul', [{ id: 'long', name: 'Casa Azul Lisboa' }], true).id, 'long');
    assert.equal(context.findBestPropertyForReportText('Casa Azul 03/11/2026 10 EUR', listings).id, 'blue');
});

test('mapping logs the extracted and normalized name and the matched property ID', () => {
    const { context, calls } = createParser();
    const rows = context.collectPropertyRows([
        'Anúncio: 1st   FLÓOR - Room B | 03/11/2026 | Pagamento 30 EUR',
        'Anúncio: Sem Correspondência | 03/11/2026 | Pagamento 20 EUR'
    ], [{ id: 'room-b', name: '1st Floor: Room B' }], null);
    assert.equal(rows[0].property.id, 'room-b');
    assert.equal(rows[1].property, null);
    assert.equal(calls.logs[0][1].reportName, '1st   FLÓOR - Room B');
    assert.equal(calls.logs[0][1].normalizedName, '1st floor room b');
    assert.equal(calls.logs[0][1].propertyId, 'room-b');
    assert.equal(calls.warnings[0][1], 'Sem Correspondência');
    assert.equal(calls.warnings[0][2].normalizedName, 'sem correspondencia');
    assert.equal(calls.warnings[0][2].propertyId, null);
});

test('report period prefers labelled month to generation date and supports numeric periods', () => {
    const { context } = createParser();
    assert.equal(context.resolvePlatformReportDate(['Gerado em 05/11/2026', 'Relatório de outubro de 2026']), '2026-10-01');
    assert.equal(context.resolvePlatformReportDate(['Generated on 2026-11-05', 'Statement period: 10/2026']), '2026-10-01');
    assert.equal(context.resolvePlatformReportDate(['Statement period: 2026-10']), '2026-10-01');
    assert.equal(context.resolvePlatformReportDate(['Statement: October 2026 generated on November 2026']), '2026-10-01');
    assert.equal(context.resolvePlatformReportDate(['Generated on 2026-11-05 | Statement: October 2026']), '2026-10-01');
    assert.equal(context.resolvePlatformReportDate(['Period: 01/10/2026 - 31/10/2026']), '2026-10-01');
    assert.equal(context.resolvePlatformReportDate(['Period: 01/10/2026 - 30/11/2026']), null);
    assert.equal(context.resolvePlatformReportDate(['Generated on 2026-11-05']), null);
    assert.equal(context.resolvePlatformReportDate([], 'airbnb_2026-10.pdf', '2026-11'), '2026-10-01');
    assert.equal(context.resolvePlatformReportDate([], 'airbnb_10_2026.pdf', ''), '2026-10-01');
    assert.equal(context.resolvePlatformReportDate([], 'airbnb outubro 2026.pdf', '2026-11'), '2026-10-01');
    assert.equal(context.resolvePlatformReportDate([], 'report.pdf', '2026-10'), '2026-10-01');
    assert.equal(context.resolvePlatformReportDate(['Relatório setembro 2026'], 'airbnb_2026-10.pdf', '2026-11'), '2026-09-01');
    assert.equal(context.resolvePlatformReportDate([], 'report.pdf', '2026-13'), null);
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
    test(`${platform} imports undated rows using a fallback month and replaces the extra month`, async () => {
        const { context, calls } = createParser();
        await context[parser]({ name: 'relatorio.pdf', text: 'Anúncio: Casa Azul | Pagamento 75,00 EUR' }, properties, null, '2026-10', '2026-11');
        assert.equal(calls.inserted[0].occurred_on, '2026-10-01');
        assert.equal(calls.requests[0].name, 'replace_platform_financial_entries');
        assert.equal(calls.requests[0].args.p_extra_month, '2026-11-01');
        assert.match(calls.confirmations[0], /2026-10, 2026-11/);
    });

    test(`${platform} cancellation leaves existing entries unchanged`, async () => {
        const { context, calls } = createParser();
        context.window.confirm = () => false;
        await assert.rejects(context[parser]({ name: 'relatorio_2026-10.pdf', text: 'Anúncio: Casa Azul | Pagamento 75,00 EUR' }, properties), /cancelled/);
        assert.equal(calls.requests.length, 0);
    });

    test(`${platform} imports formatted and partial listing names`, async () => {
        const { context, calls } = createParser();
        const file = { text: [
            'Relatório de outubro de 2026',
            'Anúncio: 1st floor room b | 03/11/2026 | Pagamento 30 EUR',
            'Anúncio: Casa Azul Lisboa | 04/11/2026 | Pagamento 40 EUR'
        ].join('\n') };
        await context[parser](file, [
            { id: 'room-b', name: '1st Floor: Room B' },
            { id: 'blue', name: 'Casa Azul' }
        ]);
        assert.deepEqual(calls.inserted.map(row => row.property_id), ['room-b', 'blue']);
        assert.equal(calls.logs[0][1].propertyId, 'room-b');
        assert.equal(calls.logs[1][1].propertyId, 'blue');
    });

    test(`${platform} maps each listing and uses the report period rather than payout date`, async () => {
        const { context, calls } = createParser();
        const file = { text: [
            'Gerado em 05/11/2026',
            'Relatório de outubro de 2026',
            'Anúncio: Casa Azul | 03/11/2026 | Pagamento 125,50 EUR',
            'Anúncio: Sea House | 05/11/2026 | Pagamento 50,00 EUR'
        ].join('\n') };
        const result = await context[parser](file, properties, 'generic');
        assert.equal(result.inserted, 2);
        assert.deepEqual(calls.inserted.map(row => [row.property_id, row.amount, row.occurred_on, row.entry_date]), [
            ['blue', 125.5, '2026-10-01', '2026-10-01'],
            ['sea', 50, '2026-10-01', '2026-10-01']
        ]);
        assert.equal(calls.warnings.length, 0);
    });

    test(`${platform} never falls back to the first property or upload date`, async () => {
        const { context, calls } = createParser();
        const file = { text: 'Anúncio: Unknown House | 05/11/2026 | Pagamento 999,00 EUR' };
        await assert.rejects(context[parser](file, properties), /unmatched/);
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
        await assert.rejects(context[parser](file, properties, 'generic'), /unmatched/);
        assert.equal(calls.inserted.length, 0);
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
    await assert.rejects(context.processBookingPDF({ text: 'Anúncio: Casa Azul | Pagamento 75,00 EUR' }, properties), /missing date/);
    assert.equal(calls.inserted.length, 0);
});

test('Airbnb imports undated transaction lines below the property heading', async () => {
    const { context, calls } = createParser();
    await context.processAirbnbPDF({
        name: 'relatorio.pdf',
        text: 'Anúncio: Casa Azul\nPagamento 75,00 EUR\nPagamento 35,00 EUR'
    }, properties, null, '2026-10');
    assert.deepEqual(calls.inserted.map(row => row.amount), [75, 35]);
});

test('replacement errors are surfaced and an empty report never calls the database', async () => {
    const { context, calls } = createParser();
    const empty = await context.persistPlatformEarnings('Airbnb', [], '2026-11');
    assert.equal(empty.inserted, 0);
    assert.equal(calls.confirmations.length, 0);
    context.supabaseClient.rpc = async () => ({ error: new Error('transaction failed') });
    await assert.rejects(context.processAirbnbPDF({
        name: 'relatorio_2026-10.pdf',
        text: 'Anúncio: Casa Azul | Pagamento 75,00 EUR'
    }, properties), /transaction failed/);
});
