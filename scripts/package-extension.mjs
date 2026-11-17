import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';

const ROOT = process.cwd();
const EXT_DIR = path.join(ROOT, 'extension');
const DIST_DIR = path.join(ROOT, 'dist');

function addDir(zip, dir, prefix = '') {
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    const full = path.join(dir, entry.name);
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      addDir(zip, full, rel);
    } else {
      zip.file(rel, fs.readFileSync(full));
    }
  }
}

async function main() {
  const manifestPath = path.join(EXT_DIR, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    throw new Error('extension/manifest.json not found');
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (manifest.manifest_version !== 3) {
    throw new Error('Extension manifest_version must be 3');
  }

  // Verify referenced files exist
  const requiredPaths = [
    manifest.action?.default_popup,
    manifest.options_page,
    manifest.background?.service_worker,
    ...Object.values(manifest.icons || {}),
    ...(manifest.content_scripts || []).flatMap((cs) => cs.js || []),
  ].filter(Boolean);

  for (const rel of requiredPaths) {
    const abs = path.join(EXT_DIR, rel);
    if (!fs.existsSync(abs)) {
      throw new Error(`Manifest references missing file: extension/${rel}`);
    }
  }

  fs.mkdirSync(DIST_DIR, {recursive: true});
  const outZip = path.join(DIST_DIR, `wafa-formassist-extension-mv3-v${manifest.version}.zip`);

  const zip = new JSZip();
  addDir(zip, EXT_DIR);
  const buffer = await zip.generateAsync({type: 'nodebuffer', compression: 'DEFLATE'});
  fs.writeFileSync(outZip, buffer);

  const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
  console.log(`Packaged Chrome/Edge MV3 extension -> ${path.relative(ROOT, outZip)}`);
  console.log(`Size: ${buffer.byteLength} bytes | SHA-256: ${sha256}`);
}

main().catch((err) => {
  console.error('Extension packaging failed:', err);
  process.exit(1);
});
