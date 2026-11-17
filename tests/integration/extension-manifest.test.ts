import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

const EXT_DIR = path.resolve(process.cwd(), 'extension');

test('extension/manifest.json is a valid Manifest V3 package with narrow host permissions and existing files', () => {
  const manifestPath = path.join(EXT_DIR, 'manifest.json');
  assert.equal(fs.existsSync(manifestPath), true, 'extension/manifest.json must exist');

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  assert.equal(manifest.manifest_version, 3);
  assert.ok(manifest.name.includes('WAFA FormAssist'));
  assert.ok(Array.isArray(manifest.permissions));
  // Minimum privilege check: must never request dangerous blanket permissions
  assert.equal(manifest.permissions.includes('<all_urls>'), false);
  assert.equal(manifest.permissions.includes('cookies'), false);
  assert.equal(manifest.permissions.includes('webRequest'), false);

  assert.ok(Array.isArray(manifest.host_permissions));
  assert.equal(manifest.host_permissions.includes('<all_urls>'), false);
  assert.ok(
    manifest.host_permissions.some((hp: string) => hp.includes('dgbpo.teletalk.com.bd')),
    'Must explicitly scope host permissions to dgbpo.teletalk.com.bd',
  );

  // Verify every declared file exists on disk
  const referencedFiles: string[] = [
    manifest.background?.service_worker,
    manifest.action?.default_popup,
    manifest.options_page,
    ...Object.values(manifest.icons || {}),
    ...Object.values(manifest.action?.default_icon || {}),
    ...(manifest.content_scripts || []).flatMap((cs: {js?: string[]; css?: string[]}) => [
      ...(cs.js || []),
      ...(cs.css || []),
    ]),
  ].filter(Boolean) as string[];

  for (const rel of referencedFiles) {
    const abs = path.join(EXT_DIR, rel);
    assert.equal(fs.existsSync(abs), true, `Referenced extension asset missing: ${rel}`);
  }
});

test('all JavaScript files inside /extension pass Node syntax check (node --check)', () => {
  const jsFiles: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.js')) jsFiles.push(full);
    }
  };
  walk(EXT_DIR);
  assert.ok(jsFiles.length >= 9, `Expected >= 9 extension JS files, found ${jsFiles.length}`);

  for (const file of jsFiles) {
    execFileSync(process.execPath, ['--check', file], {stdio: 'pipe'});
  }
});
