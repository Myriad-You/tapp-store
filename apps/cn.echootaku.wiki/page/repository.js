'use strict';

var domain = require('./domain.js');

var CATALOG_KEY = 'wiki:catalog:v1';
var RECOVERY_KEY = 'wiki:recovery:v1';
var ARTICLE_PREFIX = 'wiki:article:';
var EVENT_PREFIX = 'wiki:event:v2:';
var BATCH_PREFIX = 'wiki:batch:v2:';
var ABORT_PREFIX = 'wiki:abort:v2:';
var DRAFT_PREFIX = 'wiki:draft:';
var PUBLISH_RESERVE_BYTES = 256 * 1024;
var ORPHAN_GRACE_MS = 5 * 60 * 1000;

function emptyCatalog(now) {
  return { schema: 2, revision: 'empty', updatedAt: now, items: [] };
}

function draftShape(article) {
  return {
    id: String(article.id || ''),
    slug: String(article.slug || ''),
    title: String(article.title || ''),
    summary: String(article.summary || ''),
    tags: Array.isArray(article.tags) ? article.tags.map(String) : [],
    parentId: article.parentId == null || article.parentId === '' ? null : String(article.parentId),
    order: Number.isFinite(Number(article.order)) ? Number(article.order) : 0,
    markdown: String(article.markdown || ''),
    existing: article.existing !== false,
  };
}

function eventKey(revision, id) {
  return EVENT_PREFIX + String(revision) + ':' + String(id);
}

function batchKey(batchId) { return BATCH_PREFIX + String(batchId); }
function abortKey(batchId) { return ABORT_PREFIX + String(batchId); }

function logicalClock(value) {
  var clock = Number(value);
  return Number.isSafeInteger(clock) && clock >= 0 ? clock : 0;
}

function candidateClock(candidate) {
  return logicalClock(candidate && candidate.event && candidate.event.clock);
}

function compareCandidates(left, right) {
  var clock = candidateClock(left) - candidateClock(right);
  if (clock) return clock;
  if (!!left.legacy !== !!right.legacy) return left.legacy ? -1 : 1;
  var revision = String(left.event.revision || '').localeCompare(String(right.event.revision || ''));
  return revision || String(left.key).localeCompare(String(right.key));
}

function legacyTime(candidate) {
  var value = Date.parse(candidate && candidate.event && candidate.event.committedAt);
  return Number.isFinite(value) ? value : 0;
}

function snapshotFromAnalysis(analysis, now) {
  var articles = [];
  var items = [];
  var latest = analysis.activeBatch ? analysis.activeBatch.marker : null;

  Array.from(analysis.winners.values()).sort(function (left, right) {
    return compareCandidates(right, left);
  }).forEach(function (candidate) {
    if (!latest || compareCandidates(latest, candidate) < 0) latest = candidate;
    if (candidate.event.kind === 'tombstone') return;
    try {
      var article = domain.validateArticle(candidate.event.article, []);
      article.updatedAt = String(candidate.event.article.updatedAt || candidate.event.committedAt || '');
      article.status = 'published';
      articles.push(article);
      items.push({
        id: article.id,
        slug: article.slug,
        title: article.title,
        summary: article.summary,
        tags: article.tags,
        parentId: article.parentId,
        order: article.order,
        updatedAt: article.updatedAt,
        status: 'published',
        contentKey: candidate.key,
      });
    } catch (error) {
      analysis.issues.push({
        id: candidate.event.id,
        code: 'invalid-content',
        message: String(error && error.message || error),
      });
    }
  });

  var catalog = latest ? {
    schema: 2,
    revision: String(latest.event.revision),
    updatedAt: String(latest.event.committedAt || now),
    items: items,
  } : emptyCatalog(now);
  return { catalog: catalog, articles: articles, issues: analysis.issues };
}

function analyzeSharedValues(values, now) {
  values = values && typeof values === 'object' ? values : {};
  var issues = [];
  var markers = new Map();
  var abortMarkers = new Map();
  var allEvents = new Map();
  var standaloneEvents = [];
  var batchEvents = new Map();
  var legacyBodies = [];
  var missingLegacy = [];

  Object.keys(values).forEach(function (key) {
    if (key.indexOf(BATCH_PREFIX) !== 0) return;
    var value = values[key];
    if (!value || value.schema !== 2 || !value.batchId || !value.revision ||
        !['batch-pending', 'batch-commit'].includes(value.kind) ||
        !Number.isSafeInteger(Number(value.clock)) || Number(value.clock) < 1 ||
        !Array.isArray(value.eventKeys) || key !== batchKey(value.batchId)) {
      issues.push({ id: key, code: 'invalid-batch-marker' });
      return;
    }
    var marker = { key: key, event: value, legacy: false };
    markers.set(String(value.batchId), marker);
  });

  Object.keys(values).forEach(function (key) {
    if (key.indexOf(ABORT_PREFIX) !== 0) return;
    var value = values[key];
    if (!value || value.schema !== 2 || value.kind !== 'batch-abort' ||
        !value.batchId || !value.revision || key !== abortKey(value.batchId) ||
        !Number.isSafeInteger(Number(value.clock)) || Number(value.clock) < 1 ||
        !Array.isArray(value.eventKeys)) {
      issues.push({ id: key, code: 'invalid-abort-marker' });
      return;
    }
    abortMarkers.set(String(value.batchId), { key: key, event: value, legacy: false });
  });

  Object.keys(values).forEach(function (key) {
    if (key.indexOf(EVENT_PREFIX) !== 0) return;
    var value = values[key];
    if (!value || value.schema !== 2 || !value.id || !value.revision ||
        !['article', 'tombstone'].includes(value.kind) ||
        !Number.isSafeInteger(Number(value.clock)) || Number(value.clock) < 1 ||
        key !== eventKey(value.revision, value.id)) {
      issues.push({ id: key, code: 'invalid-event' });
      return;
    }
    if (value.kind === 'article') {
      try {
        var validated = domain.validateArticle(value.article, []);
        if (validated.id !== String(value.id)) throw new Error('event/article id mismatch');
      } catch (error) {
        issues.push({ id: key, code: 'invalid-event-content', message: String(error && error.message || error) });
        return;
      }
    }
    var candidate = { key: key, event: value, legacy: false };
    allEvents.set(key, candidate);
    if (!value.batchId) standaloneEvents.push(candidate);
    else {
      var batchId = String(value.batchId);
      if (!batchEvents.has(batchId)) batchEvents.set(batchId, []);
      batchEvents.get(batchId).push(candidate);
    }
  });

  var validBatches = [];
  var pendingBatches = [];
  var abortedBatches = [];
  var uncommitted = [];
  var discardableBatchEvents = [];
  var batchIds = new Set();
  batchEvents.forEach(function (_events, batchId) { batchIds.add(batchId); });
  markers.forEach(function (_marker, batchId) { batchIds.add(batchId); });
  abortMarkers.forEach(function (_marker, batchId) { batchIds.add(batchId); });

  batchIds.forEach(function (batchId) {
    var events = batchEvents.get(batchId) || [];
    var marker = markers.get(batchId);
    var abort = abortMarkers.get(batchId);
    if (abort) {
      abortedBatches.push({ marker: marker || null, abort: abort, events: events });
      return;
    }
    if (!marker) {
      uncommitted.push.apply(uncommitted, events);
      return;
    }
    if (marker.event.kind === 'batch-pending') {
      pendingBatches.push({ marker: marker, events: events });
      return;
    }
    var expectedKeys = marker.event.eventKeys.map(String);
    var expectedSet = new Set(expectedKeys);
    var expectedEvents = [];
    var seenIds = new Set();
    var valid = expectedSet.size === expectedKeys.length;
    expectedKeys.forEach(function (key) {
      var candidate = allEvents.get(key);
      if (!candidate || String(candidate.event.batchId || '') !== batchId ||
          candidateClock(candidate) !== candidateClock(marker) ||
          String(candidate.event.revision) !== String(marker.event.revision) ||
          seenIds.has(String(candidate.event.id))) {
        valid = false;
        return;
      }
      seenIds.add(String(candidate.event.id));
      expectedEvents.push(candidate);
    });
    events.forEach(function (candidate) {
      if (!expectedSet.has(candidate.key)) discardableBatchEvents.push(candidate);
    });
    if (!valid || expectedEvents.length !== expectedKeys.length) {
      issues.push({ id: marker.key, code: 'incomplete-batch' });
      uncommitted.push.apply(uncommitted, events);
      return;
    }
    validBatches.push({ marker: marker, events: expectedEvents });
  });

  validBatches.sort(function (left, right) {
    return compareCandidates(left.marker, right.marker);
  });
  var activeBatch = validBatches.length ? validBatches[validBatches.length - 1] : null;

  var legacyCatalog = values[CATALOG_KEY];
  var referencedLegacyKeys = new Set();
  var legacyEvents = [];
  if (legacyCatalog && legacyCatalog.schema === 1 && Array.isArray(legacyCatalog.items)) {
    legacyCatalog.items.forEach(function (item) {
      if (!item || !item.id || !item.contentKey) return;
      referencedLegacyKeys.add(String(item.contentKey));
      var body = values[item.contentKey];
      if (!body) {
        missingLegacy.push({ id: String(item.id), code: 'missing-content' });
        return;
      }
      var candidate = {
        key: String(item.contentKey),
        legacy: true,
        referenced: true,
        event: {
          schema: 1,
          clock: 0,
          id: String(item.id),
          kind: 'article',
          revision: String(item.contentKey),
          committedAt: String(body.updatedAt || item.updatedAt || legacyCatalog.updatedAt || ''),
          article: body,
        },
      };
      legacyEvents.push(candidate);
      legacyBodies.push(candidate);
    });
  }
  Object.keys(values).forEach(function (key) {
    if (key.indexOf(ARTICLE_PREFIX) !== 0 || referencedLegacyKeys.has(key)) return;
    var body = values[key];
    if (!body || !body.id) return;
    legacyBodies.push({
      key: key,
      legacy: true,
      referenced: false,
      event: {
        schema: 1,
        clock: 0,
        id: String(body.id),
        kind: 'article',
        revision: String(key),
        committedAt: String(body.updatedAt || ''),
        article: body,
      },
    });
  });

  var visibleCandidates = activeBatch ? activeBatch.events.slice() : legacyEvents.slice();
  standaloneEvents.forEach(function (candidate) {
    if (!activeBatch || compareCandidates(activeBatch.marker, candidate) < 0) visibleCandidates.push(candidate);
  });
  var winners = new Map();
  visibleCandidates.forEach(function (candidate) {
    var current = winners.get(String(candidate.event.id));
    if (!current || compareCandidates(current, candidate) < 0) {
      winners.set(String(candidate.event.id), candidate);
    }
  });
  if (!activeBatch) {
    missingLegacy.forEach(function (issue) {
      var winner = winners.get(issue.id);
      if (!winner || winner.legacy) issues.push(issue);
    });
  }

  var maxClock = 0;
  standaloneEvents.forEach(function (candidate) { maxClock = Math.max(maxClock, candidateClock(candidate)); });
  markers.forEach(function (marker) { maxClock = Math.max(maxClock, candidateClock(marker)); });
  abortMarkers.forEach(function (marker) { maxClock = Math.max(maxClock, candidateClock(marker)); });

  return {
    values: values,
    issues: issues,
    winners: winners,
    activeBatch: activeBatch,
    validBatches: validBatches,
    pendingBatches: pendingBatches,
    abortedBatches: abortedBatches,
    uncommitted: uncommitted,
    discardableBatchEvents: discardableBatchEvents,
    standaloneEvents: standaloneEvents,
    legacyBodies: legacyBodies,
    maxClock: maxClock,
  };
}

class WikiRepository {
  constructor(options) {
    options = options || {};
    if (!options.shared || !options.privateStorage) throw new Error('shared and privateStorage are required');
    this.shared = options.shared;
    this.privateStorage = options.privateStorage;
    this.now = options.now || function () { return new Date().toISOString(); };
    this.createRevision = options.createRevision || function () {
      if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
      return Math.random().toString(36).slice(2) + '_' + Math.random().toString(36).slice(2);
    };
  }

  async readAnalysis() {
    return analyzeSharedValues(await this.shared.getAll(), this.now());
  }

  nextClock(analysis) {
    if (analysis.maxClock >= Number.MAX_SAFE_INTEGER) throw new Error('logical clock is exhausted');
    return analysis.maxClock + 1;
  }

  async saveDraft(article) {
    var current = draftShape(article || {});
    if (!current.id) throw new Error('draft id is required');
    var key = DRAFT_PREFIX + current.id;
    var previous = await this.privateStorage.get(key);
    if (previous && JSON.stringify(previous.article) === JSON.stringify(current)) return { changed: false, key: key };
    await this.privateStorage.set(key, { schema: 1, savedAt: this.now(), article: current });
    return { changed: true, key: key };
  }

  async getDraft(id) {
    return this.privateStorage.get(DRAFT_PREFIX + String(id || ''));
  }

  async getLatestNewDraft(excludedIds) {
    var excluded = new Set(Array.isArray(excludedIds) ? excludedIds.map(String) : []);
    var snapshot = await this.loadSnapshot();
    var publishedIds = new Set(snapshot.catalog.items.map(function (item) { return item.id; }));
    var keys = await this.privateStorage.keys();
    var latest = null;
    for (var i = 0; i < keys.length; i += 1) {
      var key = keys[i];
      if (key.indexOf(DRAFT_PREFIX) !== 0) continue;
      var value = await this.privateStorage.get(key);
      if (!value || value.schema !== 1 || !value.article || !value.article.id) continue;
      var id = String(value.article.id);
      if (excluded.has(id)) continue;
      if (value.article.existing !== false && publishedIds.has(id)) continue;
      if (!latest || String(value.savedAt || '') > String(latest.savedAt || '')) latest = value;
    }
    return latest;
  }

  async recordOrphans(keys, reason) {
    if (!keys.length) return;
    try {
      var recovery = await this.privateStorage.get(RECOVERY_KEY);
      if (!recovery || recovery.schema !== 1 || !Array.isArray(recovery.orphans)) {
        recovery = { schema: 1, orphans: [] };
      }
      keys.forEach(function (key) {
        if (!recovery.orphans.some(function (item) { return item.key === key; })) {
          recovery.orphans.push({ key: key, reason: reason, recordedAt: this.now() });
        }
      }, this);
      recovery.orphans = recovery.orphans.slice(-2048);
      await this.privateStorage.set(RECOVERY_KEY, recovery);
    } catch (_error) {}
  }

  async reconcileRecovery(processedKeys, failedKeys, reason) {
    try {
      var recovery = await this.privateStorage.get(RECOVERY_KEY);
      var processed = new Set(processedKeys.map(String));
      var remaining = recovery && recovery.schema === 1 && Array.isArray(recovery.orphans)
        ? recovery.orphans.filter(function (item) { return !processed.has(String(item.key || '')); })
        : [];
      failedKeys.forEach(function (key) {
        if (!remaining.some(function (item) { return item.key === key; })) {
          remaining.push({ key: key, reason: reason, recordedAt: this.now() });
        }
      }, this);
      if (!remaining.length) {
        await this.privateStorage.remove(RECOVERY_KEY);
        return;
      }
      await this.privateStorage.set(RECOVERY_KEY, {
        schema: 1,
        orphans: remaining.slice(-2048),
      });
    } catch (_error) {}
  }

  async preflight(writeBytes, largestValueBytes) {
    var usage = await this.shared.usage();
    var report = domain.assessQuota({
      used: usage && usage.used,
      quota: usage && usage.quota,
      writeBytes: writeBytes,
      largestValueBytes: largestValueBytes,
      reserveBytes: PUBLISH_RESERVE_BYTES,
    });
    if (!report.allowed) throw new Error('quota preflight failed: write requires temporary reserve space');
    return report;
  }

  async loadSnapshot() {
    var analysis = await this.readAnalysis();
    return snapshotFromAnalysis(analysis, this.now());
  }

  async publish(input) {
    var analysis = await this.readAnalysis();
    var snapshot = snapshotFromAnalysis(analysis, this.now());
    var article = domain.validateArticle(input, snapshot.catalog.items);
    var previous = snapshot.catalog.items.find(function (item) { return item.id === article.id; }) || null;
    if (!previous && snapshot.catalog.items.length >= domain.MAX_ARTICLES) throw new Error('catalog contains too many articles');
    var revision = this.createRevision();
    var clock = this.nextClock(analysis);
    var now = this.now();
    var key = eventKey(revision, article.id);
    var body = Object.assign({}, article, { updatedAt: now, status: 'published' });
    var event = {
      schema: 2, clock: clock, id: article.id, kind: 'article', revision: revision,
      committedAt: now, batchId: null, article: body,
    };
    var bytes = domain.utf8Bytes(event);
    await this.preflight(bytes, bytes);
    try { await this.shared.set(key, event); }
    catch (error) {
      var stored = null;
      try { stored = await this.shared.get(key); } catch (_error) {}
      if (!stored || stored.revision !== revision || stored.id !== article.id) {
        throw new Error('publish write failed: ' + (error && error.message || error));
      }
    }

    var committed = await this.loadSnapshot();
    var visible = committed.catalog.items.find(function (item) { return item.id === article.id; });
    if (!visible || visible.contentKey !== key) throw new Error('concurrent publish superseded this revision; refresh and retry');
    try { await this.privateStorage.remove(DRAFT_PREFIX + article.id); } catch (_error) {}
    return { catalog: committed.catalog, article: body, quota: await this.shared.usage() };
  }

  async deleteArticle(id) {
    id = String(id || '');
    var analysis = await this.readAnalysis();
    var snapshot = snapshotFromAnalysis(analysis, this.now());
    if (!snapshot.catalog.items.some(function (item) { return item.id === id; })) return { changed: false };
    var revision = this.createRevision();
    var now = this.now();
    var key = eventKey(revision, id);
    var event = {
      schema: 2, clock: this.nextClock(analysis), id: id, kind: 'tombstone',
      revision: revision, committedAt: now, batchId: null,
    };
    try { await this.shared.set(key, event); }
    catch (error) {
      var stored = null;
      try { stored = await this.shared.get(key); } catch (_error) {}
      if (!stored || stored.revision !== revision || stored.id !== id || stored.kind !== 'tombstone') {
        throw new Error('delete marker write failed: ' + (error && error.message || error));
      }
    }
    var committed = await this.loadSnapshot();
    if (committed.catalog.items.some(function (item) { return item.id === id; })) {
      throw new Error('concurrent publish superseded this delete; refresh and retry');
    }
    try { await this.privateStorage.remove(DRAFT_PREFIX + id); } catch (_error) {}
    return { changed: true, catalog: committed.catalog };
  }

  async cleanupOrphans() {
    var analysis = await this.readAnalysis();
    var recovery = await this.privateStorage.get(RECOVERY_KEY).catch(function () { return null; });
    var recoverable = new Set(recovery && Array.isArray(recovery.orphans)
      ? recovery.orphans.map(function (item) { return String(item.key || ''); }) : []);
    var winnerKeys = new Set();
    analysis.winners.forEach(function (candidate) { winnerKeys.add(candidate.key); });
    var protectedKeys = new Set();
    if (analysis.activeBatch) {
      protectedKeys.add(analysis.activeBatch.marker.key);
      analysis.activeBatch.events.forEach(function (candidate) { protectedKeys.add(candidate.key); });
    }
    var candidates = [];
    var skippedRecent = [];
    var removed = [];
    var failed = [];
    var processedRecovery = new Set();
    var currentMs = Date.parse(this.now());
    if (!Number.isFinite(currentMs)) currentMs = Date.now();

    analysis.standaloneEvents.forEach(function (candidate) {
      var supersededByBatch = analysis.activeBatch && compareCandidates(candidate, analysis.activeBatch.marker) <= 0;
      if (!winnerKeys.has(candidate.key) && (supersededByBatch || analysis.winners.has(String(candidate.event.id)))) {
        candidates.push(candidate.key);
      }
    });
    var batchCleanup = [];
    analysis.validBatches.forEach(function (batch) {
      if (!analysis.activeBatch || batch.marker.key !== analysis.activeBatch.marker.key) {
        batchCleanup.push({ batch: batch, reason: 'gc-complete-batch' });
      }
    });
    analysis.pendingBatches.forEach(function (batch) {
      batchCleanup.push({ batch: batch, reason: 'cancel-pending-batch' });
    });
    analysis.abortedBatches.forEach(function (batch) {
      var reason = String(batch.abort && batch.abort.event.reason || 'writer-aborted');
      batchCleanup.push({ batch: batch, reason: reason });
    });

    for (var batchIndex = 0; batchIndex < batchCleanup.length; batchIndex += 1) {
      var job = batchCleanup[batchIndex];
      var source = job.batch.marker || job.batch.abort;
      var batchId = String(source.event.batchId);
      var abortMarkerKey = abortKey(batchId);
      var abortMarker = job.batch.abort;
      if (!abortMarker) {
        var markerKeys = job.batch.marker && Array.isArray(job.batch.marker.event.eventKeys)
          ? job.batch.marker.event.eventKeys.map(String)
          : job.batch.events.map(function (candidate) { return candidate.key; });
        var abortValue = {
          schema: 2,
          kind: 'batch-abort',
          batchId: batchId,
          revision: String(source.event.revision),
          clock: candidateClock(source),
          committedAt: this.now(),
          eventKeys: markerKeys,
          reason: job.reason,
        };
        try {
          await this.shared.set(abortMarkerKey, abortValue);
          abortMarker = { key: abortMarkerKey, event: abortValue, legacy: false };
        } catch (_error) {
          failed.push(abortMarkerKey);
          continue;
        }
      }
      var batchKeys = [];
      if (job.batch.marker) batchKeys.push(job.batch.marker.key);
      job.batch.events.forEach(function (candidate) { batchKeys.push(candidate.key); });
      var batchFailed = false;
      for (var batchKeyIndex = 0; batchKeyIndex < batchKeys.length; batchKeyIndex += 1) {
        var batchItemKey = batchKeys[batchKeyIndex];
        if (recoverable.has(batchItemKey)) processedRecovery.add(batchItemKey);
        try { await this.shared.remove(batchItemKey); removed.push(batchItemKey); }
        catch (_error) { failed.push(batchItemKey); batchFailed = true; }
      }
      if (!batchFailed && abortMarker.event.eventKeys.length) {
        var compactAbort = Object.assign({}, abortMarker.event, { eventKeys: [] });
        try {
          await this.shared.set(abortMarker.key, compactAbort);
          abortMarker.event = compactAbort;
          if (recoverable.has(abortMarker.key)) processedRecovery.add(abortMarker.key);
        } catch (_error) { failed.push(abortMarker.key); }
      }
    }
    analysis.discardableBatchEvents.forEach(function (candidate) { candidates.push(candidate.key); });
    analysis.uncommitted.forEach(function (candidate) {
      if (recoverable.has(candidate.key)) {
        candidates.push(candidate.key);
        processedRecovery.add(candidate.key);
      }
      else skippedRecent.push(candidate.key);
    });
    analysis.legacyBodies.forEach(function (candidate) {
      if (candidate.referenced || winnerKeys.has(candidate.key)) return;
      if (currentMs - legacyTime(candidate) >= ORPHAN_GRACE_MS) candidates.push(candidate.key);
      else skippedRecent.push(candidate.key);
    });

    var seen = new Set();
    for (var i = 0; i < candidates.length; i += 1) {
      var key = candidates[i];
      if (!key || seen.has(key) || protectedKeys.has(key)) continue;
      seen.add(key);
      try { await this.shared.remove(key); removed.push(key); }
      catch (_error) { failed.push(key); }
    }
    await this.reconcileRecovery(Array.from(processedRecovery), failed.filter(function (key) {
      return processedRecovery.has(key);
    }), 'cleanup-retry-needed');
    return { removed: removed, failed: failed, skippedRecent: skippedRecent };
  }

  async abortFailedBatch(markerKey, marker, staged) {
    var existing = null;
    var markerRead = false;
    try { existing = await this.shared.get(markerKey); markerRead = true; } catch (_error) {}
    var abortMarkerKey = abortKey(marker.batchId);
    var existingAbort = null;
    var abortRead = false;
    try { existingAbort = await this.shared.get(abortMarkerKey); abortRead = true; } catch (_error) {}
    if (existing && existing.schema === 2 && existing.kind === 'batch-commit' &&
        existing.batchId === marker.batchId && !existingAbort) {
      return { committed: true, failed: [] };
    }
    if (!markerRead || !abortRead) {
      var uncertainKeys = staged.map(function (entry) { return entry.key; });
      uncertainKeys.push(markerKey);
      await this.recordOrphans(uncertainKeys, 'backup-restore-outcome-uncertain');
      return { committed: false, failed: uncertainKeys, ambiguous: true };
    }
    var abortMarker = existingAbort || Object.assign({}, marker, {
      kind: 'batch-abort',
      eventKeys: staged.map(function (entry) { return entry.key; }),
      reason: 'writer-aborted',
    });
    var abortWritten = !!existingAbort;
    if (!abortWritten) {
      try { await this.shared.set(abortMarkerKey, abortMarker); abortWritten = true; } catch (_error) {
        try {
          var storedAbort = await this.shared.get(abortMarkerKey);
          abortWritten = !!(storedAbort && storedAbort.kind === 'batch-abort' && storedAbort.batchId === marker.batchId);
        } catch (_readError) {}
      }
    }
    if (!abortWritten) {
      var unresolved = staged.map(function (entry) { return entry.key; });
      unresolved.push(markerKey);
      await this.recordOrphans(unresolved, 'backup-restore-abort-uncertain');
      return { committed: false, failed: unresolved, ambiguous: true };
    }
    var failed = [];
    try { await this.shared.remove(markerKey); } catch (_error) { failed.push(markerKey); }
    for (var j = 0; j < staged.length; j += 1) {
      try { await this.shared.remove(staged[j].key); } catch (_error) { failed.push(staged[j].key); }
    }
    if (!failed.length && abortMarker.eventKeys.length) {
      try { await this.shared.set(abortMarkerKey, Object.assign({}, abortMarker, { eventKeys: [] })); }
      catch (_error) { failed.push(abortMarkerKey); }
    }
    await this.recordOrphans(failed, 'backup-restore-aborted');
    return { committed: false, failed: failed };
  }

  async restoreBackup(input) {
    var backup = domain.parseBackup(input);
    var analysis = await this.readAnalysis();
    var batchId = this.createRevision();
    var clock = this.nextClock(analysis);
    var now = this.now();
    var staged = [];

    for (var i = 0; i < backup.articles.length; i += 1) {
      var article = domain.validateArticle(backup.articles[i], []);
      var body = Object.assign({}, article, { updatedAt: now, status: 'published' });
      var key = eventKey(batchId, article.id);
      staged.push({
        key: key,
        value: {
          schema: 2, clock: clock, id: article.id, kind: 'article', revision: batchId,
          committedAt: now, batchId: batchId, article: body,
        },
      });
    }
    var markerKey = batchKey(batchId);
    var marker = {
      schema: 2,
      kind: 'batch-commit',
      batchId: batchId,
      revision: batchId,
      clock: clock,
      committedAt: now,
      eventKeys: staged.map(function (entry) { return entry.key; }),
    };
    var pendingMarker = Object.assign({}, marker, { kind: 'batch-pending' });
    var sizes = staged.map(function (entry) { return domain.utf8Bytes(entry.value); });
    sizes.push(domain.utf8Bytes(marker));
    await this.preflight(
      sizes.reduce(function (sum, bytes) { return sum + bytes; }, 0),
      Math.max.apply(null, sizes)
    );

    try {
      await this.shared.set(markerKey, pendingMarker);
      for (var j = 0; j < staged.length; j += 1) await this.shared.set(staged[j].key, staged[j].value);
      var canceled = await this.shared.get(abortKey(batchId));
      if (canceled) throw new Error('backup restore was canceled by cleanup');
      await this.shared.set(markerKey, marker);
    } catch (error) {
      var outcome = await this.abortFailedBatch(markerKey, marker, staged);
      if (!outcome.committed) {
        if (outcome.ambiguous) {
          throw new Error('backup restore outcome is uncertain; refresh before retrying');
        }
        throw new Error('backup restore commit failed: ' + (error && error.message || error));
      }
    }

    var committedAnalysis = await this.readAnalysis();
    if (!committedAnalysis.activeBatch || committedAnalysis.activeBatch.marker.key !== markerKey) {
      throw new Error('concurrent restore superseded this batch; refresh and retry');
    }
    var committed = snapshotFromAnalysis(committedAnalysis, this.now());
    return { catalog: committed.catalog, articles: committed.articles };
  }
}

module.exports = {
  ABORT_PREFIX,
  ARTICLE_PREFIX,
  BATCH_PREFIX,
  CATALOG_KEY,
  DRAFT_PREFIX,
  EVENT_PREFIX,
  ORPHAN_GRACE_MS,
  RECOVERY_KEY,
  WikiRepository,
};
