// Structural self-check: manifest/catalog/i18n validity, require graph
// completeness and JS syntax for the page modules. Run: node scripts/self-check.mjs
import { createRequire } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
let failed = 0;
function check(name, ok, detail) {
  if (ok) console.log('  ok ' + name);
  else { failed += 1; console.log('  FAIL ' + name + (detail ? ' — ' + detail : '')); }
}
const read = (p) => readFileSync(join(root, p), 'utf8');

const manifest = JSON.parse(read('manifest.json'));
check('manifest valid', !!manifest);
check('id matches folder', manifest.id === 'cn.astelysin.protein-viewer', manifest.id);
check('semver version', /^\d+\.\d+\.\d+$/.test(manifest.version));
check('category developer', manifest.category === 'developer');
check('runtimeModules three', Array.isArray(manifest.runtimeModules) && manifest.runtimeModules.includes('three'));
check('network:fetch granted', manifest.permissions.includes('network:fetch'));
check('core.entry exists', manifest.core && existsSync(join(root, manifest.core.entry)));
check('page.entry exists', manifest.page && existsSync(join(root, manifest.page.entry)));
check('page.template exists', manifest.page && existsSync(join(root, manifest.page.template)));
check('page.styles exists', manifest.page && existsSync(join(root, manifest.page.styles)));
check('apis search/titles/structure', manifest.apis && ['search', 'titles', 'structure', 'structureCa'].every((k) => manifest.apis[k]));

const catalog = JSON.parse(read('catalog.json'));
check('catalog preview snapshot', catalog.preview && catalog.preview.type === 'snapshot');
check('catalog preview html exists', catalog.preview && existsSync(join(root, catalog.preview.html)));

for (const lang of ['zh-CN', 'en-US', 'ja-JP']) {
  const table = JSON.parse(read(`i18n/${lang}.json`));
  check(`i18n ${lang}`, !!table && Object.keys(table).length > 10, Object.keys(table).length + ' keys');
}

for (const mod of ['page/parser.js', 'page/structure-loader.js', 'page/bonds.js', 'page/colors.js']) {
  try { require(join(root, mod)); check(`require ${mod}`, true); }
  catch (err) { check(`require ${mod}`, false, err.message); }
}
const entrySrc = read('page/entry.js');
check('entry -> viewer', /require\(['"]\.\/viewer\.js['"]\)/.test(entrySrc));
const viewerSrc = read('page/viewer.js');
for (const dep of ['parser', 'structure-loader', 'bonds', 'build', 'colors']) {
  check(`viewer -> ./${dep}.js`, new RegExp(`require\\(['"]\\./${dep}\\.js['"]\\)`).test(viewerSrc));
}
check('wireframe pick target', /function makePickMesh\(atoms\)/.test(viewerSrc) && /new THREE\.InstancedMesh/.test(viewerSrc) && /intersectObjects\(\[state\.pickMesh\], false\)/.test(viewerSrc));
check('host file download', /Tapp\.file\.download/.test(viewerSrc) && !/URL\.createObjectURL/.test(viewerSrc));
check('text structure fallback', /structureLoader\.load/.test(viewerSrc) && /structureCa/.test(read('page/structure-loader.js')));
check('model server text APIs', [manifest.apis.structure, manifest.apis.structureCa].every((api) => api.endpoint.startsWith('https://models.rcsb.org/v1/')) && !/\.cif\.gz/.test(JSON.stringify(manifest.apis)));

for (const mod of ['page/build.js', 'page/viewer.js']) {
  const res = spawnSync(process.execPath, ['--check', join(root, mod)], { encoding: 'utf8' });
  check(`syntax ${mod}`, res.status === 0, String(res.stderr || '').trim());
}
const earlyThreeLoad = spawnSync(process.execPath, ['-e', "globalThis.Tapp = { lifecycle: { onReady() {} } }; require('./page/viewer.js');"], { cwd: root, encoding: 'utf8' });
check('viewer module tolerates late THREE injection', earlyThreeLoad.status === 0, String(earlyThreeLoad.stderr || '').trim());

console.log(failed ? `\n${failed} check(s) FAILED` : '\nall checks passed');
process.exit(failed ? 1 : 0);
