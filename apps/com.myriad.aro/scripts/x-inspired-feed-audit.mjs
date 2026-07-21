#!/usr/bin/env node
/**
 * Structural audit for X-inspired federation feed UX (share + follow graph).
 * Exit 0 only if required symbols exist in shipped Aro page modules.
 *
 * Host dependency (optional at runtime):
 *   federation.composeExternalShare / getExternalShareStatus — Myriad PR #225
 * Aro must keep local X intent fallback when host methods are absent.
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
const readme = read('README.md')
const man = JSON.parse(read('manifest.json'))

// Interaction density (must remain on timeline cards)
must('like-action', views.includes('data-action-like') && views.includes('doToggleLike'))
must('bookmark-action', views.includes('data-action-bookmark') && views.includes('doToggleBookmark'))
must('announce-action', views.includes('data-action-announce') && (views.includes('doAnnounce') || views.includes('doUnannounce')))
must('like-aria', views.includes('data-action-like') && views.includes('aria-label'))

// Share dialog + host-or-local compose
must('share-dialog-html', html.includes('id="feed-share-dialog"'))
must('share-open-x', html.includes('id="feed-share-x"'))
must('share-copy-text', html.includes('id="feed-share-copy"'))
must('share-fn-open', views.includes('function openShareModal'))
must('share-fn-local-intent', views.includes('function buildLocalXIntentUrl'))
must('share-host-compose', views.includes('composeExternalShare'))
must('share-host-status', views.includes('getExternalShareStatus'))
must('share-refuse-can-post', views.includes('can_post') && views.includes('refusing') || views.includes("can_post === true"))
must('published-share', views.includes('renderPublishedItem') && views.includes('feed-item-action-share'))
must('find-published', views.includes('state.published') && views.includes('function findFeedItem'))
must('follow-back-busy', views.includes('followBackBusy'))
must('copy-actor', views.includes('data-action-copy-actor'))
must('share-copy-toast', views.includes('shareCopiedText') || views.includes('shareCopiedIntent'))


must('share-local-fallback', views.includes('buildLocalXIntentUrl') && views.includes('x.com/intent/tweet'))
must('share-btn-render', views.includes('data-action-share'))
must('share-bind', views.includes('data-action-share'))
must('share-events', events.includes('feed-share-cancel') || events.includes('closeShareModal'))

// Follow graph clarity
must('follow-back', views.includes('data-action-follow-back') && views.includes('doFollowBack'))
must('mutual-badge', views.includes('aro-badge-mutual') || views.includes('is-mutual'))
must('domain-chip', views.includes('feed-actor-domain') || views.includes('feed-item-domain'))
must('css-share', css.includes('feed-share-actions') && css.includes('feed-actor-meta'))

// Version + host dependency docs
must('version', man.version === '1.0.8', man.version)
must('host-dep-docs', readme.includes('composeExternalShare') && readme.includes('PR #225'))

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
