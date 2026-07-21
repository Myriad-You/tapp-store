#!/usr/bin/env node
/**
 * Structural audit for X-inspired federation feed UX (share + follow graph).
 * Exit 0 only if required symbols exist in shipped Aro page modules.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const failures = []
const passes = []

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

function must(name, cond, detail) {
  if (cond) passes.push(name + (detail ? ': ' + detail : ''))
  else failures.push(name + (detail ? ': ' + detail : ''))
}

const views = read('page/views.js')
const events = read('page/events.js')
const html = read('page.html')
const css = read('page.css')
const man = JSON.parse(read('manifest.json'))

must('share-dialog-html', html.includes('id="feed-share-dialog"'))
must('share-open-x', html.includes('id="feed-share-x"'))
must('share-copy-text', html.includes('id="feed-share-copy"'))
must('share-fn-open', views.includes('function openShareModal'))
must('share-fn-local-intent', views.includes('function buildLocalXIntentUrl'))
must('share-host-compose', views.includes('composeExternalShare'))
must('share-btn-render', views.includes('data-action-share'))
must('share-bind', views.includes("data-action-share"))
must('share-events', events.includes('feed-share-cancel') || events.includes('closeShareModal'))
must('follow-back', views.includes('data-action-follow-back') && views.includes('doFollowBack'))
must('mutual-badge', views.includes('aro-badge-mutual') || views.includes('is-mutual'))
must('domain-chip', views.includes('feed-actor-domain') || views.includes('feed-item-domain'))
must('css-share', css.includes('feed-share-actions') && css.includes('feed-actor-meta'))
must('version', typeof man.version === 'string' && man.version.length > 0, man.version)
// No server-side X post language
must('no-server-post', !views.includes('can_post: true') && !views.includes('postToX'))

console.log('passes:', passes.length)
passes.forEach((p) => console.log('  ✓', p))
if (failures.length) {
  console.error('failures:', failures.length)
  failures.forEach((f) => console.error('  ✗', f))
  process.exit(1)
}
console.log('ok')
