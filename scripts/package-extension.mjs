import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';

const ROOT = process.cwd();
const EXT_DIR = path.join(ROOT, 'extension');
const DIST_DIR = path.join(ROOT, 'dist');

const EXCLUDED_NAMES = new Set([
  '.DS_Store',
  'Thumbs.db',
  'node_modules',
  '.git',
  '.env',
  '.env.local',
]);

const EXCLUDED_EXTENSIONS = new Set(['.map', '.pem', '.key', '.p12', '.pfx', '.log', '.bak', '.tmp']);

const SECRET_PATTERNS = [
  { name: 'Private Key Block', regex: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { name: 'Google API Key', regex: /AIzaSy[0-9A-Za-z_-]{30,}/ },
  { name: 'OpenAI/Stripe Secret Key', regex: /\bsk-[A-Za-z0-9]{20,}\b/ },
  { name: 'GitHub PAT', regex: /\bgh[pousr]_[A-Za-z0-9]{20,}\b/ },
  { name: 'Slack Token', regex: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/ },
];

const TEXT_EXTENSIONS = new Set(['.js', '.mjs', '.cjs', '.json', '.html', '.css', '.txt', '.md']);
const REPRODUCIBLE_DATE = new Date('2026-01-01T00:00:00.000Z');

function isExcluded(entryName) {
  if (EXCLUDED_NAMES.has(entryName)) return true;
  if (entryName.startsWith('.')) return true;
  const ext = path.extname(entryName).toLowerCase();
  if (EXCLUDED_EXTENSIONS.has(ext)) return true;
  return false;
}

function collectFiles(dir, prefix = '', acc = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    if (isExcluded(entry.name)) continue;
    const full = path.join(dir, entry.name);
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      collectFiles(full, rel, acc);
    } else if (entry.isFile()) {
      acc.push({ full, rel });
    }
  }
  return acc;
}

function scanForSecrets(files) {
  for (const file of files) {
    const ext = path.extname(file.rel).toLowerCase();
    if (!TEXT_EXTENSIONS.has(ext)) continue;
    const content = fs.readFileSync(file.full, 'utf8');
    for (const pattern of SECRET_PATTERNS) {
      if (pattern.regex.test(content)) {
        throw new Error(`Security check failed: detected potential ${pattern.name} in extension/${file.rel}`);
      }
    }
  }
}

function validateManifest(manifest) {
  if (manifest.manifest_version !== 3) {
    throw new Error('Extension manifest_version must be 3');
  }
  if (!manifest.version || typeof manifest.version !== 'string') {
    throw new Error('Extension manifest must define a valid version string');
  }
  const permissions = Array.isArray(manifest.permissions) ? manifest.permissions : [];
  if (!permissions.includes('alarms')) {
    throw new Error('Extension manifest must include "alarms" permission for inactivity auto-lock');
  }

  const hostPermissions = Array.isArray(manifest.host_permissions) ? manifest.host_permissions : [];
  for (const hp of hostPermissions) {
    if (hp === '<all_urls>' || hp === '*://*/*' || hp === 'http://*/*' || hp === 'https://*/*') {
      throw new Error(`Overly broad host_permission rejected: ${hp}`);
    }
  }

  const contentScripts = Array.isArray(manifest.content_scripts) ? manifest.content_scripts : [];
  if (contentScripts.length === 0) {
    throw new Error('Extension manifest must configure content_scripts');
  }
  for (const cs of contentScripts) {
    const jsFiles = Array.isArray(cs.js) ? cs.js : [];
    if (jsFiles[0] !== 'content/sensitive-fields.js') {
      throw new Error('content/sensitive-fields.js must be loaded first in content_scripts');
    }
  }

  const requiredPaths = [
    manifest.action?.default_popup,
    manifest.options_page,
    manifest.background?.service_worker,
    ...Object.values(manifest.icons || {}),
    ...contentScripts.flatMap((cs) => cs.js || []),
  ].filter(Boolean);

  for (const rel of requiredPaths) {
    const abs = path.join(EXT_DIR, rel);
    if (!fs.existsSync(abs)) {
      throw new Error(`Manifest references missing file: extension/${rel}`);
    }
  }
}

async function main() {
  const manifestPath = path.join(EXT_DIR, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    throw new Error('extension/manifest.json not found');
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  validateManifest(manifest);

  const files = collectFiles(EXT_DIR);
  scanForSecrets(files);

  const zip = new JSZip();
  for (const file of files) {
    zip.file(file.rel, fs.readFileSync(file.full), { date: REPRODUCIBLE_DATE });
  }

  const buffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 },
  });
  const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');

  fs.mkdirSync(DIST_DIR, { recursive: true });
  const targets = [
    `wafa-formassist-chrome-mv3-v${manifest.version}.zip`,
    `wafa-formassist-edge-mv3-v${manifest.version}.zip`,
    `wafa-formassist-extension-mv3-v${manifest.version}.zip`,
  ];

  for (const filename of targets) {
    const outPath = path.join(DIST_DIR, filename);
    fs.writeFileSync(outPath, buffer);
    console.log(`Packaged MV3 extension -> ${path.relative(ROOT, outPath)}`);
  }

  console.log(`Files: ${files.length} | Size: ${buffer.byteLength} bytes | SHA-256: ${sha256}`);
}

main().catch((err) => {
  console.error('Extension packaging failed:', err);
  process.exit(1);
});
