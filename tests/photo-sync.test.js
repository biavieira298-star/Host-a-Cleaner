const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const app = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');

function extract(start, end) {
    const first = app.indexOf(start);
    const last = app.indexOf(end, first);
    assert.ok(first >= 0 && last > first);
    return app.slice(first, last);
}

function environment() {
    const uploads = [];
    const inserts = [];
    const updates = [];
    const errors = [];
    let uploadError = null;
    let insertError = null;
    let existing = null;
    const context = {
        getTenantOwnerId: () => 'owner',
        dataURLtoBlob: value => value,
        getIncidentPhotoExtension: () => 'jpg',
        i18n: { pt: {} }, currentLang: 'pt',
        console: { error: (...args) => errors.push(args) },
        supabaseClient: {
            storage: { from: bucket => ({
                upload: async (name, file, options) => {
                    uploads.push({ bucket, name, file, options });
                    return { error: uploadError };
                }
            }) },
            from: table => ({
                insert: async rows => {
                    inserts.push({ table, row: rows[0] });
                    return { error: insertError };
                },
                update: values => ({ eq: async (column, value) => {
                    updates.push({ table, values, column, value });
                    return { error: null };
                } }),
                select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: existing, error: null }) }) })
            })
        }
    };
    vm.createContext(context);
    vm.runInContext(extract('function queuedPhotoPath(', 'async function syncPendingData('), context);
    return {
        context, uploads, inserts, updates, errors,
        failUpload: error => { uploadError = error; },
        duplicate: row => { insertError = Object.assign(new Error('duplicate'), { code: '23505' }); existing = row; }
    };
}

test('queued cleaner task photos use owner paths, including legacy queue entries', async () => {
    const env = environment();
    const item = {
        userId: 'cleaner', propertyId: 'property', taskId: 'task', photoField: 'photo_before_url',
        file: { type: 'image/jpeg' }, storagePath: 'cleaner/property/task/photo.jpg'
    };
    await env.context.syncPendingOfflineItem({ ...item, type: 'task_photo' });
    assert.equal(env.uploads[0].name, 'owner/property/task/photo.jpg');
    assert.equal(env.inserts[0].row.storage_path, env.uploads[0].name);
    assert.equal(env.inserts[0].row.photo_url, env.uploads[0].name);
    assert.equal(env.updates[0].values.photo_before_url, env.uploads[0].name);
    assert.equal(env.inserts[0].row.uploaded_by, 'cleaner');
    await assert.rejects(env.context.uploadQueuedTaskPhoto({ ...item, ownerId: 'other-owner' }), /outra conta/);
    await assert.rejects(env.context.uploadQueuedTaskPhoto({ ...item, storagePath: 'cleaner/other/task/photo.jpg' }), /inválido/);
});

test('upload failures are logged and do not insert photo records', async () => {
    for (const type of ['task_photo', 'incident']) {
        const env = environment();
        env.failUpload(new Error('storage denied'));
        const item = type === 'task_photo'
            ? { type, userId: 'cleaner', propertyId: 'property', taskId: 'task', file: {}, storagePath: 'cleaner/property/task/photo.jpg' }
            : { type, userId: 'cleaner', propertyId: 'property', incidentId: 'incident', files: [{ file: {}, storagePath: 'cleaner/property/incident/photo.jpg' }] };
        await assert.rejects(env.context.syncPendingOfflineItem(item), /storage denied/);
        assert.equal(env.errors.length, 1);
        assert.equal(env.inserts.length, 0);
    }
});

test('incident uploads save relative paths and use a stable incident id', async () => {
    const env = environment();
    await env.context.syncPendingOfflineItem({
        type: 'incident', userId: 'cleaner', propertyId: 'property', incidentId: 'incident',
        incidentType: 'damage', description: 'Damage',
        files: [{ file: { type: 'image/jpeg' }, storagePath: 'cleaner/property/incident/photo.jpg' }]
    });
    assert.equal(env.uploads[0].name, 'owner/property/incident/photo.jpg');
    assert.equal(env.inserts[0].row.id, 'incident');
    assert.equal(env.inserts[0].row.photos[0], env.uploads[0].name);
    assert.equal(env.inserts[0].row.photo_url, env.uploads[0].name);
});

test('duplicate retries are accepted only for the matching record', async () => {
    const env = environment();
    const item = {
        type: 'task_photo', userId: 'cleaner', propertyId: 'property', taskId: 'task',
        file: {}, storagePath: 'owner/property/task/photo.jpg', photoField: 'photo_after_url'
    };
    env.duplicate({ task_id: 'task', property_id: 'property', uploaded_by: 'cleaner' });
    await env.context.syncPendingOfflineItem(item);
    assert.equal(env.updates.length, 1);
    env.duplicate({ task_id: 'other', property_id: 'property', uploaded_by: 'cleaner' });
    await assert.rejects(env.context.syncPendingOfflineItem(item), /duplicate/);
});

test('a failed upload keeps the item in the offline queue even when the error mentions duplicates', async () => {
    const env = environment();
    const item = {
        type: 'task_photo', userId: 'cleaner', propertyId: 'property', taskId: 'task', sequence: 1,
        file: {}, storagePath: 'owner/property/task/photo.jpg'
    };
    let deleted = false;
    env.failUpload(new Error('duplicate upload denied'));
    Object.assign(env.context, {
        navigator: { onLine: true }, currentUser: { id: 'cleaner' }, syncPendingPromise: null, accountDeleteInProgress: false,
        isOfflineMode: false, listPendingOfflineItems: async () => [item],
        deletePendingOfflineItem: async () => { deleted = true; },
        updateOfflineIndicator: async () => {}, schedulePendingSyncRetry: () => {},
        isOfflineNetworkError: () => false,
        i18n: { pt: { offline_sync_error: 'Erro' } }
    });
    vm.runInContext(extract('async function syncPendingData()', 'function clearPendingSyncRetry()'), env.context);
    assert.equal(await env.context.syncPendingData(), false);
    assert.equal(deleted, false);
});
