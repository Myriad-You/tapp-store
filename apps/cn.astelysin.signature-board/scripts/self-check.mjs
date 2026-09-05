import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(await readFile(resolve(root, 'manifest.json'), 'utf8'));
const required = ['main.js', 'page.html', 'page.css', 'page/entry.js', 'page/editor.js', 'page/runtime.js', 'preview.html', 'widget/entry.js', 'widget.css', 'templates/widget-2x2.html', 'templates/widget-4x2.html'];
await Promise.all(required.map(file => access(resolve(root, file))));

assert.equal(manifest.id, 'cn.astelysin.signature-board');
assert.match(manifest.version, /^\d+\.\d+\.\d+$/);
assert.equal(manifest.core.entry, 'main.js');
assert.equal(manifest.page.entry, 'page/entry.js');
assert.equal(manifest.page.styles, 'page.css');
assert.ok(manifest.permissions.includes('federation:read'));
assert.ok(manifest.permissions.includes('federation:message'));
assert.ok(manifest.permissions.includes('federation:room'));
assert.ok(manifest.permissions.includes('widget:register'));
assert.equal(manifest.widgets[0].id, 'board-preview');
assert.equal(manifest.widgets[0].defaultSize, '4x2');
assert.deepEqual(manifest.widgets[0].sizes, ['2x2', '4x2']);

const sources = await Promise.all(['main.js', 'page/editor.js', 'page/runtime.js', 'widget/entry.js'].map(file => readFile(resolve(root, file), 'utf8')));
const combined = sources.join('\n');
const pageTemplate = await readFile(resolve(root, 'page.html'), 'utf8');
const pageStyles = await readFile(resolve(root, 'page.css'), 'utf8');
assert.doesNotMatch(combined, /\bfetch\s*\(|new\s+WebSocket\s*\(/);
assert.match(combined, /signature-board\.v1/);
assert.match(combined, /sendRoomMessage/);
assert.match(combined, /Tapp\.shared|tapp\.shared/);
assert.doesNotMatch(pageTemplate, /<dialog\b/i);
assert.doesNotMatch(combined, /\.showModal\s*\(/);
assert.match(combined, /getCoalescedEvents/);
assert.match(combined, /quadraticCurveTo/);
assert.match(pageTemplate, /data-archive-list/);
assert.match(combined, /archiveSnapshotPrefix/);
assert.match(pageStyles, /color-scheme:\s*light/);
assert.match(pageTemplate, /data-admin-panel="overview"/);
assert.match(pageTemplate, /data-admin-panel="moderation"/);
assert.match(pageTemplate, /data-admin-panel="members"/);
assert.match(pageTemplate, /data-admin-panel="boards"/);
assert.match(pageTemplate, /data-admin-panel="system"/);
assert.match(combined, /moderator\.resolve-report/);
assert.match(combined, /getRoomMembers/);
assert.match(combined, /Tapp\.widgets|root\.Tapp\.widgets/);
assert.match(combined, /guestSnapshot/);

console.log('signature-board self-check passed');
