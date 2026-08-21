#!/usr/bin/env node
/**
 * Structural audit of SHIPPED Aro messenger page modules.
 * Greps/parses real files under apps/com.myriad.aro — does not reimplement messenger UI.
 *
 * Exit 0 only if every acceptance check passes.
 * Run: node apps/com.myriad.aro/scripts/messenger-interaction-audit.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ARO_ROOT = path.resolve(__dirname, '..');

const failures = [];
const passes = [];

function pass(name, detail) {
  passes.push(detail ? `${name}: ${detail}` : name);
}

function fail(name, detail) {
  failures.push(detail ? `${name}: ${detail}` : name);
}

function read(rel) {
  const abs = path.join(ARO_ROOT, rel);
  if (!fs.existsSync(abs)) {
    fail('missing-file', rel);
    return '';
  }
  return fs.readFileSync(abs, 'utf8');
}

function walkFiles(dir, exts, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      // Skip scripts themselves and node_modules if any
      if (ent.name === 'node_modules' || ent.name === 'scripts') continue;
      walkFiles(p, exts, out);
    } else if (exts.some((e) => ent.name.endsWith(e))) {
      out.push(p);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// 1) Zero banned closed-UI symbols in js/html/css
// ---------------------------------------------------------------------------
function checkClosedUiBan() {
  const banned =
    /showClosed|setShowClosed|toggleShowClosed|conv-closed-toggle|conv-closed-chip|conv-tabs-dimmed|conv-tabs-closed/;
  const files = walkFiles(ARO_ROOT, ['.js', '.html', '.css']);
  const hits = [];
  for (const f of files) {
    const text = fs.readFileSync(f, 'utf8');
    const lines = text.split(/\r?\n/);
    lines.forEach((line, i) => {
      if (banned.test(line)) {
        hits.push(`${path.relative(ARO_ROOT, f)}:${i + 1}: ${line.trim().slice(0, 120)}`);
      }
    });
  }
  if (hits.length === 0) {
    pass('1-closed-ui-ban', '0 matches in js/html/css');
  } else {
    fail('1-closed-ui-ban', `${hits.length} hit(s)\n  ` + hits.slice(0, 20).join('\n  '));
  }
}

// ---------------------------------------------------------------------------
// 2) openConversation: first real await after shell paint; is unsubscribeRealtime
// ---------------------------------------------------------------------------
/** Strip // line comments and /* block comments *\/ (naive, good enough for structural scan). */
function stripComments(src) {
  let out = '';
  let i = 0;
  while (i < src.length) {
    if (src[i] === '/' && src[i + 1] === '/') {
      i += 2;
      while (i < src.length && src[i] !== '\n') i++;
      continue;
    }
    if (src[i] === '/' && src[i + 1] === '*') {
      i += 2;
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) i++;
      i = Math.min(src.length, i + 2);
      continue;
    }
    // Keep string literals intact so // inside strings is not stripped wrong
    if (src[i] === '"' || src[i] === "'" || src[i] === '`') {
      const q = src[i];
      out += src[i++];
      while (i < src.length) {
        if (src[i] === '\\') {
          out += src[i++];
          if (i < src.length) out += src[i++];
          continue;
        }
        out += src[i];
        if (src[i] === q) {
          i++;
          break;
        }
        i++;
      }
      continue;
    }
    out += src[i++];
  }
  return out;
}

function extractFunctionBody(src, fnSigRe) {
  const m = fnSigRe.exec(src);
  if (!m) return null;
  const start = m.index + m[0].length;
  // Find opening brace after signature
  let i = start;
  while (i < src.length && src[i] !== '{') i++;
  if (i >= src.length) return null;
  let depth = 0;
  const bodyStart = i;
  for (; i < src.length; i++) {
    const ch = src[i];
    if (ch === '"' || ch === "'" || ch === '`') {
      const q = ch;
      i++;
      while (i < src.length) {
        if (src[i] === '\\') {
          i += 2;
          continue;
        }
        if (src[i] === q) break;
        i++;
      }
      continue;
    }
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        return src.slice(bodyStart + 1, i);
      }
    }
  }
  return null;
}

function checkOpenConversationOrder() {
  const api = read('page/api.js');
  if (!api) return;
  const body = extractFunctionBody(api, /async\s+function\s+openConversation\s*\([^)]*\)\s*/);
  if (!body) {
    fail('2-openConversation-order', 'could not find async function openConversation in page/api.js');
    return;
  }
  const clean = stripComments(body);
  // First real await in the function body
  const awaitRe = /\bawait\s+([A-Za-z0-9_$.]+)\s*\(/g;
  const first = awaitRe.exec(clean);
  if (!first) {
    fail('2-openConversation-order', 'no await found in openConversation');
    return;
  }
  const awaitExpr = first[1];
  const awaitIndex = first.index;
  const before = clean.slice(0, awaitIndex);

  const hasActiveKind = /state\.activeKind\s*=/.test(before);
  const hasActiveId = /state\.activeId\s*=/.test(before);
  const hasEmptyPaint =
    /empty-state/.test(before) ||
    /emptyEl\.style\.display/.test(before) ||
    /\$\(\s*['"]empty-state['"]\s*\)/.test(before);
  const hasChatPaint =
    /chat-container/.test(before) ||
    /chatEl\.style\.display/.test(before) ||
    /\$\(\s*['"]chat-container['"]\s*\)/.test(before);
  const hasRenderConvList = /\brenderConvList\s*\(/.test(before);
  const isUnsub = /unsubscribeRealtime/.test(awaitExpr);

  const ok =
    hasActiveKind &&
    hasActiveId &&
    hasEmptyPaint &&
    hasChatPaint &&
    hasRenderConvList &&
    isUnsub;

  if (ok) {
    pass(
      '2-openConversation-order',
      `first await is ${awaitExpr}() after activeKind/id + empty/chat shell + renderConvList`,
    );
  } else {
    fail(
      '2-openConversation-order',
      [
        `first await: ${awaitExpr} (need unsubscribeRealtime: ${isUnsub})`,
        `activeKind before: ${hasActiveKind}`,
        `activeId before: ${hasActiveId}`,
        `empty shell before: ${hasEmptyPaint}`,
        `chat shell before: ${hasChatPaint}`,
        `renderConvList before: ${hasRenderConvList}`,
      ].join('; '),
    );
  }
}

// ---------------------------------------------------------------------------
// 3) bindConvListClicks with closest(.conv-item) delegation
// ---------------------------------------------------------------------------
function checkConvListDelegation() {
  const chat = read('page/chat.js');
  if (!chat) return;
  const body = extractFunctionBody(chat, /function\s+bindConvListClicks\s*\([^)]*\)\s*/);
  if (!body) {
    fail('3-bindConvListClicks', 'function bindConvListClicks not found in page/chat.js');
    return;
  }
  const hasClosest =
    /\.closest\s*\(\s*['"]\.conv-item['"]\s*\)/.test(body) ||
    /\.closest\s*\(\s*['"]\.conv-item['"]\s*\)/.test(stripComments(body));
  const hasListen = /\.addEventListener\s*\(\s*['"]click['"]/.test(body);
  if (hasClosest && hasListen) {
    pass('3-bindConvListClicks', 'closest(.conv-item) click delegation present');
  } else {
    fail(
      '3-bindConvListClicks',
      `closest(.conv-item)=${hasClosest}, addEventListener(click)=${hasListen}`,
    );
  }
}

// ---------------------------------------------------------------------------
// 4) create-overlay in page.css: display:none + PE none
// ---------------------------------------------------------------------------
function extractCreateOverlayRules(cssText) {
  const rules = [];
  const re = /\.create-overlay\s*\{([^}]*)\}/g;
  let m;
  while ((m = re.exec(cssText)) !== null) {
    rules.push(m[1].replace(/\s+/g, ' ').trim());
  }
  return rules;
}

function checkCreateOverlayCss() {
  for (const rel of ['page.css']) {
    const css = read(rel);
    if (!css) continue;
    const rules = extractCreateOverlayRules(css);
    // Prefer the layout rule (position:fixed / inset) over dark/animation-only shorthands
    const base =
      rules.find((r) => /position\s*:\s*fixed/.test(r) || /inset\s*:\s*0/.test(r)) || rules[0];
    if (!base) {
      fail(`4-create-overlay-${rel}`, 'no .create-overlay { } rule found');
      continue;
    }
    const hasDisplayNone = /display\s*:\s*none/.test(base);
    const hasPeNone = /pointer-events\s*:\s*none/.test(base);
    if (hasDisplayNone && hasPeNone) {
      pass(`4-create-overlay-${rel}`, 'display:none + pointer-events:none');
    } else {
      fail(
        `4-create-overlay-${rel}`,
        `display:none=${hasDisplayNone}, pointer-events:none=${hasPeNone}; rule="${base.slice(0, 160)}"`,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// 5) helpers.js: dismiss helpers, aroDismiss PE early, onDocPointer bubble
// ---------------------------------------------------------------------------
function checkHelpers() {
  const h = read('page/helpers.js');
  if (!h) return;

  if (/function\s+dismissTransientUi\s*\(/.test(h)) {
    pass('5-dismissTransientUi', 'function present');
  } else {
    fail('5-dismissTransientUi', 'function dismissTransientUi missing');
  }

  if (/function\s+forceHideInteractive\s*\(/.test(h)) {
    pass('5-forceHideInteractive', 'function present');
  } else {
    fail('5-forceHideInteractive', 'function forceHideInteractive missing');
  }

  const dismissBody = extractFunctionBody(h, /function\s+aroDismiss\s*\([^)]*\)\s*/);
  if (!dismissBody) {
    fail('5-aroDismiss-pe', 'function aroDismiss not found');
  } else {
    const clean = stripComments(dismissBody);
    // PE none must appear before animation end / finish path dependency — "early"
    // Require pointerEvents = 'none' (or pointer-events) near the top of the body
    // before addEventListener('animationend' or classList.add('aro-leaving')
    const peMatch = /(?:style\.)?pointerEvents\s*=\s*['"]none['"]|pointer-events\s*:\s*none/.exec(
      clean,
    );
    if (!peMatch) {
      fail('5-aroDismiss-pe', "no pointerEvents = 'none' in aroDismiss");
    } else {
      const peIdx = peMatch.index;
      const leavingIdx = clean.search(/aro-leaving|animationend|setTimeout\s*\(\s*finish/);
      if (leavingIdx === -1 || peIdx < leavingIdx) {
        pass('5-aroDismiss-pe', 'pointerEvents none set early (before leave animation path)');
      } else {
        fail('5-aroDismiss-pe', 'pointerEvents none appears after leave animation wiring');
      }
    }
  }

  // onDocPointer registered with capture false, not true
  const bubble =
    /(?:addEventListener|pageListen)\s*\(\s*(?:document\s*,\s*)?['"]click['"]\s*,\s*onDocPointer\s*,\s*false\s*\)/.test(h);
  const capture =
    /(?:addEventListener|pageListen)\s*\(\s*(?:document\s*,\s*)?['"]click['"]\s*,\s*onDocPointer\s*,\s*true\s*\)/.test(h);
  if (bubble && !capture) {
    pass('5-onDocPointer-bubble', 'registered with capture false (not true)');
  } else {
    fail(
      '5-onDocPointer-bubble',
      `bubble(false)=${bubble}, capture(true)=${capture} — need false only`,
    );
  }
}

// ---------------------------------------------------------------------------
// 6) state has openGen + convLoadGen; api uses them
// ---------------------------------------------------------------------------
function checkGens() {
  const state = read('page/state.js');
  const api = read('page/api.js');
  if (!state || !api) return;

  const hasOpenGenState = /\bopenGen\s*:/.test(state);
  const hasConvLoadGenState = /\bconvLoadGen\s*:/.test(state);
  if (hasOpenGenState && hasConvLoadGenState) {
    pass('6-state-gens', 'openGen + convLoadGen in state.js');
  } else {
    fail(
      '6-state-gens',
      `openGen=${hasOpenGenState}, convLoadGen=${hasConvLoadGenState} in state.js`,
    );
  }

  const usesOpenGen =
    /state\.openGen/.test(api) &&
    (/isOpenGenCurrent/.test(api) || /isConversationCurrent/.test(api));
  const usesConvLoadGen = /state\.convLoadGen/.test(api);
  if (usesOpenGen && usesConvLoadGen) {
    pass('6-api-gens', 'page/api.js uses openGen (guards) + convLoadGen');
  } else {
    fail(
      '6-api-gens',
      `openGen usage=${usesOpenGen}, convLoadGen usage=${usesConvLoadGen} in page/api.js`,
    );
  }
}

// ---------------------------------------------------------------------------
// 7) showAroOverlay + create-overlay open paths restore full triad
// After forceHide/dismissTransientUi, hidden=true + PE=none; display:flex alone
// cannot reopen (.create-overlay[hidden]{display:none!important}).
// ---------------------------------------------------------------------------

/** Full open triad: clear hidden, pointerEvents auto, display flex (order flexible). */
function hasOverlayOpenTriad(src) {
  const pe =
    /(?:style\.)?pointerEvents\s*=\s*['"]auto['"]/.test(src) ||
    /pointer-events\s*:\s*auto/.test(src);
  const hiddenClear =
    /\.hidden\s*=\s*false/.test(src) ||
    /removeAttribute\s*\(\s*['"]hidden['"]\s*\)/.test(src);
  const displayFlex =
    /(?:style\.)?display\s*=\s*['"]flex['"]/.test(src) ||
    /display\s*:\s*flex/.test(src);
  return pe && hiddenClear && displayFlex;
}

function usesShowAroOverlayOrTriad(src) {
  return /\bshowAroOverlay\s*\(/.test(src) || hasOverlayOpenTriad(src);
}

function checkShowAroOverlay() {
  const helpers = read('page/helpers.js');
  if (!helpers) return;

  // Strip comments first so extractFunctionBody is not confused by apostrophes in // comments
  // (e.g. "don't") which would otherwise be parsed as string delimiters.
  const helpersClean = stripComments(helpers);

  // Function must exist with the restore triad
  const body = extractFunctionBody(helpersClean, /function\s+showAroOverlay\s*\([^)]*\)\s*/);
  if (!body) {
    fail('7-showAroOverlay-fn', 'function showAroOverlay missing in page/helpers.js');
  } else {
    const hasHidden =
      /\.hidden\s*=\s*false/.test(body) ||
      /removeAttribute\s*\(\s*['"]hidden['"]\s*\)/.test(body);
    const hasPe = /(?:style\.)?pointerEvents\s*=\s*['"]auto['"]/.test(body);
    const hasFlex = /(?:style\.)?display\s*=\s*['"]flex['"]/.test(body);
    const removesLeaving = /classList\.remove\s*\([^)]*aro-leaving/.test(body);
    if (hasHidden && hasPe && hasFlex) {
      pass(
        '7-showAroOverlay-fn',
        `function present with triad (hidden clear + PE auto + display flex${removesLeaving ? '; clears aro-leaving' : ''})`,
      );
    } else {
      fail(
        '7-showAroOverlay-fn',
        `incomplete triad: hiddenClear=${hasHidden}, PE auto=${hasPe}, display flex=${hasFlex}`,
      );
    }
  }

  // openComposer / openFollowDialog in their dedicated Page module.
  const views = read('page/feedCompose.js');
  if (views) {
    const viewsClean = stripComments(views);
    for (const [name, re] of [
      ['openComposer', /function\s+openComposer\s*\([^)]*\)\s*/],
      ['openFollowDialog', /function\s+openFollowDialog\s*\([^)]*\)\s*/],
    ]) {
      const fnBody = extractFunctionBody(viewsClean, re);
      if (!fnBody) {
        fail(`7-${name}`, `function ${name} not found in page/feedCompose.js`);
      } else if (usesShowAroOverlayOrTriad(fnBody)) {
        pass(`7-${name}`, 'uses showAroOverlay or full open triad');
      } else {
        fail(
          `7-${name}`,
          'must call showAroOverlay OR set pointerEvents auto + clear hidden + display flex',
        );
      }
    }

    // quote-repost open path (openQuoteRepostModal)
    const quoteSource = stripComments(read('page/views.js') || '');
    const quoteFn =
      extractFunctionBody(quoteSource, /function\s+openQuoteRepost\w*\s*\([^)]*\)\s*/) ||
      extractFunctionBody(quoteSource, /function\s+showQuoteRepost\w*\s*\([^)]*\)\s*/) ||
      extractFunctionBody(quoteSource, /function\s+\w*[Qq]uote[Rr]epost\w*\s*\([^)]*\)\s*/);
    let quoteOk = false;
    if (quoteFn && usesShowAroOverlayOrTriad(quoteFn)) {
      quoteOk = true;
    } else {
      // Fallback: scan windows around quote-repost-dialog for open triad / showAroOverlay
      let from = 0;
      while (from < quoteSource.length) {
        const i = quoteSource.indexOf('quote-repost-dialog', from);
        if (i === -1) break;
        const window = quoteSource.slice(Math.max(0, i - 80), Math.min(quoteSource.length, i + 400));
        if (/\bshowAroOverlay\s*\(/.test(window) || hasOverlayOpenTriad(window)) {
          quoteOk = true;
          break;
        }
        from = i + 20;
      }
    }
    if (quoteOk) {
      pass('7-quote-repost-open', 'uses showAroOverlay or full open triad');
    } else {
      fail(
        '7-quote-repost-open',
        'quote-repost open path must call showAroOverlay OR pointerEvents auto + clear hidden + display flex',
      );
    }
  }

  // Ring-create bindings live in views.js.
  const events = read('page/views.js');
  if (events) {
    const cleanEv = stripComments(events);
    let ringOk = false;
    let from = 0;
    while (from < cleanEv.length) {
      const i = cleanEv.indexOf('ring-create-dialog', from);
      if (i === -1) break;
      const window = cleanEv.slice(Math.max(0, i - 80), Math.min(cleanEv.length, i + 350));
      // Open path: showAroOverlay or display flex with triad — not aroDismiss-only close
      if (/\bshowAroOverlay\s*\(/.test(window) || hasOverlayOpenTriad(window)) {
        ringOk = true;
        break;
      }
      from = i + 20;
    }
    if (ringOk) {
      pass('7-ring-create-open', 'uses showAroOverlay or full open triad');
    } else {
      fail(
        '7-ring-create-open',
        'ring-create open path must call showAroOverlay OR pointerEvents auto + clear hidden + display flex',
      );
    }
  }

  // showCreateDialog lives in its dedicated Page module.
  const api = read('page/createUi.js');
  if (api) {
    const apiClean = stripComments(api);
    const createBody = extractFunctionBody(apiClean, /function\s+showCreateDialog\s*\([^)]*\)\s*/);
    if (!createBody) {
      fail('7-showCreateDialog', 'function showCreateDialog not found in page/createUi.js');
    } else if (usesShowAroOverlayOrTriad(createBody)) {
      pass('7-showCreateDialog', 'uses showAroOverlay or full open triad');
    } else {
      fail(
        '7-showCreateDialog',
        'must call showAroOverlay OR set pointerEvents auto + clear hidden + display flex',
      );
    }

    // showEditRoomDialog is also a create-overlay open path (bonus consistency)
    const editBody = extractFunctionBody(apiClean, /function\s+showEditRoomDialog\s*\([^)]*\)\s*/);
    if (editBody) {
      if (usesShowAroOverlayOrTriad(editBody)) {
        pass('7-showEditRoomDialog', 'uses showAroOverlay or full open triad');
      } else {
        fail(
          '7-showEditRoomDialog',
          'must call showAroOverlay OR set pointerEvents auto + clear hidden + display flex',
        );
      }
    }
  }

  // createDetailOverlay (share-detail sheets): must open after appendChild
  // Regression after #30: CSS defaults picker-overlay to display:none + PE none.
  const chat = read('page/chat.js');
  if (chat) {
    const chatClean = stripComments(chat);
    const detailBody = extractFunctionBody(
      chatClean,
      /function\s+createDetailOverlay\s*\([^)]*\)\s*/,
    );
    if (!detailBody) {
      fail('7-createDetailOverlay', 'function createDetailOverlay not found in page/chat.js');
    } else if (!/appendChild\s*\(\s*overlay\s*\)/.test(detailBody)) {
      fail('7-createDetailOverlay', 'createDetailOverlay must appendChild(overlay)');
    } else if (usesShowAroOverlayOrTriad(detailBody)) {
      pass('7-createDetailOverlay', 'uses showAroOverlay or full open triad after appendChild');
    } else {
      fail(
        '7-createDetailOverlay',
        'must call showAroOverlay OR set pointerEvents auto + clear hidden + display flex after appendChild',
      );
    }
  }

  // Any function that assigns className 'picker-overlay' must also open it
  // (createPickerOverlay, createDetailOverlay, and any future builders).
  checkPickerOverlayOpenPaths();
}

/**
 * Scan page/*.js for className = 'picker-overlay' assignments.
 * The enclosing function body must call showAroOverlay (or full open triad)
 * before it returns — otherwise the sheet stays display:none after #30 CSS.
 */
function checkPickerOverlayOpenPaths() {
  const pageDir = path.join(ARO_ROOT, 'page');
  const files = walkFiles(pageDir, ['.js']);
  let found = 0;
  for (const f of files) {
    const rel = path.relative(ARO_ROOT, f);
    const src = stripComments(fs.readFileSync(f, 'utf8'));
    // Match className = 'picker-overlay' / "picker-overlay"
    const assignRe = /\.className\s*=\s*['"]picker-overlay['"]/g;
    let m;
    while ((m = assignRe.exec(src)) !== null) {
      found++;
      // Walk backward to nearest function declaration
      const before = src.slice(0, m.index);
      const fnMatches = [
        ...before.matchAll(
          /function\s+([A-Za-z0-9_$]+)\s*\([^)]*\)\s*\{/g,
        ),
      ];
      const lastFn = fnMatches[fnMatches.length - 1];
      const fnName = lastFn ? lastFn[1] : `anon@${path.basename(f)}:${m.index}`;
      let body = null;
      if (lastFn) {
        body = extractFunctionBody(
          src.slice(lastFn.index),
          new RegExp(
            `function\\s+${fnName.replace(/\$/g, '\\$')}\\s*\\([^)]*\\)\\s*`,
          ),
        );
      }
      // Fallback: window around the assignment
      const window = body || src.slice(m.index, Math.min(src.length, m.index + 1200));
      if (usesShowAroOverlayOrTriad(window)) {
        pass(`7-picker-overlay-${fnName}`, `${rel}: opens via showAroOverlay/triad`);
      } else {
        fail(
          `7-picker-overlay-${fnName}`,
          `${rel}: assigns className picker-overlay but never calls showAroOverlay / open triad`,
        );
      }
    }
  }
  if (found === 0) {
    fail('7-picker-overlay-scan', 'no className = picker-overlay assignments found in page/*.js');
  }
}

// ---------------------------------------------------------------------------
// 8) Full-screen portal CSS defaults: confirm/forward/picker/img-viewer
// Must be display:none + pointer-events:none when closed (both CSS files).
// ---------------------------------------------------------------------------
function extractClassRules(cssText, className) {
  const rules = [];
  // Escape dots in class names for regex (className is without leading dot)
  const re = new RegExp(`\\.${className.replace(/\./g, '\\.')}\\s*\\{([^}]*)\\}`, 'g');
  let m;
  while ((m = re.exec(cssText)) !== null) {
    rules.push(m[1].replace(/\s+/g, ' ').trim());
  }
  return rules;
}

function pickBaseLayoutRule(rules) {
  // Prefer the layout rule (position:fixed / inset) over animation-only shorthands
  return (
    rules.find((r) => /position\s*:\s*fixed/.test(r) || /inset\s*:\s*0/.test(r)) || rules[0]
  );
}

function checkPortalOverlayCss() {
  const portals = [
    'confirm-overlay',
    'forward-overlay',
    'picker-overlay',
    'img-viewer',
  ];
  for (const rel of ['page.css']) {
    const css = read(rel);
    if (!css) continue;
    for (const cls of portals) {
      const rules = extractClassRules(css, cls);
      const base = pickBaseLayoutRule(rules);
      if (!base) {
        fail(`8-${cls}-${rel}`, `no .${cls} { } rule found`);
        continue;
      }
      const hasDisplayNone = /display\s*:\s*none/.test(base);
      const hasPeNone = /pointer-events\s*:\s*none/.test(base);
      // Reject dangerous open-by-default PE auto or display:flex as sole display
      const hasDangerousDisplayFlex =
        /display\s*:\s*flex/.test(base) && !/display\s*:\s*none/.test(base);
      const hasDangerousPeAuto =
        /pointer-events\s*:\s*auto/.test(base) && !/pointer-events\s*:\s*none/.test(base);
      if (hasDisplayNone && hasPeNone && !hasDangerousDisplayFlex && !hasDangerousPeAuto) {
        pass(`8-${cls}-${rel}`, 'display:none + pointer-events:none');
      } else {
        fail(
          `8-${cls}-${rel}`,
          `display:none=${hasDisplayNone}, PE none=${hasPeNone}, dangerousFlex=${hasDangerousDisplayFlex}, dangerousPeAuto=${hasDangerousPeAuto}; rule="${base.slice(0, 180)}"`,
        );
      }
    }
  }
}

// ---------------------------------------------------------------------------
// 9) back-btn path must dismiss history/files (or dismissTransientUi)
// History/files are siblings of #chat-container under #chat-main; on mobile
// .history-overlay is position:fixed and will block the list if left open.
// ---------------------------------------------------------------------------
function checkBackBtnDismissesLayers() {
  const events = read('page/views.js');
  if (!events) return;
  const clean = stripComments(events);
  // Locate back-btn wiring — either $('back-btn') or getElementById('back-btn')
  const backIdx =
    clean.search(/\$\(\s*['"]back-btn['"]\s*\)/) !== -1
      ? clean.search(/\$\(\s*['"]back-btn['"]\s*\)/)
      : clean.search(/getElementById\s*\(\s*['"]back-btn['"]\s*\)/);
  if (backIdx === -1) {
    fail('9-back-btn', "could not find back-btn reference in page/views.js");
    return;
  }
  // Scan a generous window after the first back-btn hit for the click handler body
  const window = clean.slice(backIdx, Math.min(clean.length, backIdx + 3500));
  const hasDismiss =
    /dismissTransientUi\s*\(/.test(window) ||
    (/closeChatHistory\s*\(/.test(window) && /closeRoomFiles\s*\(/.test(window));
  if (hasDismiss) {
    pass(
      '9-back-btn-dismiss',
      /dismissTransientUi\s*\(/.test(window)
        ? 'back-btn path calls dismissTransientUi'
        : 'back-btn path calls closeChatHistory + closeRoomFiles',
    );
  } else {
    fail(
      '9-back-btn-dismiss',
      'back-btn handler must call dismissTransientUi OR closeChatHistory+closeRoomFiles before clearing chat',
    );
  }
  // Prefer explicit keepChat:false when using dismissTransientUi
  if (
    /dismissTransientUi\s*\(/.test(window) &&
    /keepChat\s*:\s*false/.test(window)
  ) {
    pass('9-back-btn-keepChat-false', 'dismissTransientUi({ keepChat: false })');
  } else if (/dismissTransientUi\s*\(/.test(window)) {
    // Soft pass — empty opts also means keepChat falsy, but explicit is better
    pass('9-back-btn-keepChat-false', 'dismissTransientUi present (keepChat not required if falsy default)');
  }
}

// ---------------------------------------------------------------------------
// 10) Optional layer inventory dump (informational; never fails the audit)
// ---------------------------------------------------------------------------
function dumpLayerInventory() {
  if (!process.argv.includes('--inventory') && process.env.ARO_AUDIT_INVENTORY !== '1') {
    return;
  }
  const layers = [
    { cls: 'history-overlay', note: 'chat history / room files (scoped #chat-main)' },
    { cls: 'create-overlay', note: 'create/edit/compose dialogs' },
    { cls: 'confirm-overlay', note: 'in-app confirm portal' },
    { cls: 'forward-overlay', note: 'message forward portal' },
    { cls: 'picker-overlay', note: 'attachment picker portal' },
    { cls: 'img-viewer', note: 'full-screen image viewer' },
    { cls: 'invite-popover', note: 'room invite popover' },
    { cls: 'attach-menu', note: 'composer attach menu' },
    { cls: 'member-panel', note: 'room members (mobile full-screen sheet)' },
    { cls: 'manage-dropdown', note: 'header manage menu' },
    { cls: 'msg-ctx-menu', note: 'message context menu' },
  ];
  console.log('--- LAYER INVENTORY (optional) ---');
  for (const rel of ['page.css']) {
    const css = read(rel);
    if (!css) continue;
    console.log(`  [${rel}]`);
    for (const { cls, note } of layers) {
      const rules = extractClassRules(css, cls);
      const base = pickBaseLayoutRule(rules) || '';
      const display = (base.match(/display\s*:\s*([^;]+)/) || [])[1] || '?';
      const pe = (base.match(/pointer-events\s*:\s*([^;]+)/) || [])[1] || '(inherit)';
      const z = (base.match(/z-index\s*:\s*([^;]+)/) || [])[1] || '?';
      console.log(`    .${cls}: display=${display.trim()} PE=${pe.trim()} z=${z.trim()} — ${note}`);
    }
  }
  console.log('');
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------
console.log(`Aro messenger interaction audit\nroot: ${ARO_ROOT}\n`);

checkClosedUiBan();
checkOpenConversationOrder();
checkConvListDelegation();
checkCreateOverlayCss();
checkHelpers();
checkGens();
checkShowAroOverlay();
checkPortalOverlayCss();
checkBackBtnDismissesLayers();
dumpLayerInventory();

console.log('--- PASS ---');
for (const p of passes) console.log(`  ✓ ${p}`);
if (failures.length) {
  console.log('--- FAIL ---');
  for (const f of failures) console.log(`  ✗ ${f}`);
  console.log(`\n${failures.length} check(s) failed, ${passes.length} passed.`);
  process.exit(1);
}
console.log(`\nAll ${passes.length} checks passed (layering audit green).`);
process.exit(0);
