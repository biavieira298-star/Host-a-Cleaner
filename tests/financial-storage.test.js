const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const migration = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'migrations', '202611110004_private_financial_storage.sql'), 'utf8');

test('financial buckets are private and a restrictive policy constrains all object operations', () => {
    assert.match(migration, /'platform-documents', 'platform-documents', false/);
    assert.match(migration, /ON CONFLICT \(id\) DO UPDATE SET public = false/);
    assert.match(migration, /UPDATE storage\.buckets SET public = false WHERE id = 'hosting-reports'/);
    assert.match(migration, /AS RESTRICTIVE FOR ALL TO PUBLIC/);
    assert.equal((migration.match(/bucket_id NOT IN \('platform-documents', 'hosting-reports'\)/g) || []).length, 2);
    assert.equal((migration.match(/storage\.foldername\(name\)\)\[1\] = auth\.uid\(\)::text/g) || []).length, 5);
    assert.match(migration, /FOR SELECT TO authenticated/);
    assert.match(migration, /FOR INSERT TO authenticated/);
    assert.match(migration, /FOR DELETE TO authenticated/);
});

test('permission check excludes team cleaners and explicit denial', () => {
    assert.match(migration, /auth\.uid\(\) IS NOT NULL/);
    assert.match(migration, /member\.auth_user_id = auth\.uid\(\)/);
    assert.match(migration, /member\.role::text IN \('cleaner', 'assistant', 'assistente'\)/);
    assert.match(migration, /profile\.id = auth\.uid\(\)/);
    assert.match(migration, /can_view_financials'\)::boolean, true/);
    assert.match(migration, /SECURITY DEFINER\s+SET search_path = ''/);
    assert.match(migration, /BEFORE UPDATE OR DELETE ON public\.profiles/);
    assert.match(migration, /auth\.role\(\) IN \('authenticated', 'anon'\)/);
    assert.match(migration, /to_jsonb\(NEW\)->'can_view_financials'.*IS DISTINCT FROM/);
    assert.match(migration, /to_jsonb\(NEW\)->'role'.*IS DISTINCT FROM/);
});
