(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.FootprintEarthCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var LIMITS = Object.freeze({
    protocolVersion: 1,
    messageType: "footprint-earth.v1",
    maxPayloadBytes: 2 * 1024,
    maxNonceLength: 96,
    maxActorLength: 512,
    maxPerActor: 8,
    cooldownMs: 60 * 1000,
    historyPageSize: 100,
    maxHistoryPages: 20,
    historyWarningMessages: 1600,
    maxHistoryMessages: 2000,
    defaultMinK: 3
  });

  var SHARED_KEYS = Object.freeze({
    config: "footprint-earth.config.v1",
    owner: "footprint-earth.owner.v1",
    publicProjection: "footprint-earth.public.v1"
  });

  var KINDS = Object.freeze({
    submission: "footprint.submit",
    moderatorGrant: "moderator.grant",
    moderatorRevoke: "moderator.revoke",
    hide: "moderation.hide",
    restore: "moderation.restore",
    report: "moderation.report",
    resolveReport: "moderation.resolve-report",
    block: "member.block",
    unblock: "member.unblock"
  });

  var REPORT_REASONS = Object.freeze(["spam", "abuse", "privacy", "other"]);
  var MODERATION_REASONS = Object.freeze(["spam", "abuse", "privacy", "invalid", "manual_review"]);
  var CHINA_CODE = "CN";
  var TAIWAN_SOURCE_CODE = "TW";
  var TAIWAN_ADMIN_CODE = "710000";
  var EVENT_FIELDS = Object.freeze({
    "footprint.submit": ["v", "kind", "campaignId", "nonce", "countryCode", "regionCode", "status"],
    "moderator.grant": ["v", "kind", "campaignId", "nonce", "targetActor"],
    "moderator.revoke": ["v", "kind", "campaignId", "nonce", "targetActor"],
    "moderation.hide": ["v", "kind", "campaignId", "nonce", "targetMessageId", "reason"],
    "moderation.restore": ["v", "kind", "campaignId", "nonce", "targetMessageId"],
    "moderation.report": ["v", "kind", "campaignId", "nonce", "targetMessageId", "reason"],
    "moderation.resolve-report": ["v", "kind", "campaignId", "nonce", "reportMessageId", "resolution"],
    "member.block": ["v", "kind", "campaignId", "nonce", "targetActor"],
    "member.unblock": ["v", "kind", "campaignId", "nonce", "targetActor"]
  });

  function byteLength(value) {
    var text = typeof value === "string" ? value : JSON.stringify(value);
    if (typeof TextEncoder !== "undefined") return new TextEncoder().encode(text).length;
    if (typeof Buffer !== "undefined") return Buffer.byteLength(text, "utf8");
    return unescape(encodeURIComponent(text)).length;
  }

  function normalizeActor(value) {
    if (!value) return "";
    if (typeof value === "object") {
      value = value.actor_url || value.actorUrl || value.actor || value.actor_id || value.actorId || value.id || "";
    }
    var actor = String(value).trim().replace(/\/+$/, "").toLowerCase();
    return actor.length <= LIMITS.maxActorLength ? actor : "";
  }

  function actorFrom(value) {
    if (!value || typeof value !== "object") return "";
    return value.sender_actor || value.senderActor || value.actor_url || value.actorUrl || value.actor || "";
  }

  function makeNonce(prefix) {
    var random = "";
    if (typeof crypto !== "undefined" && crypto.getRandomValues) {
      var bytes = new Uint8Array(12);
      crypto.getRandomValues(bytes);
      random = Array.prototype.map.call(bytes, function (item) { return item.toString(16).padStart(2, "0"); }).join("");
    } else {
      random = Math.random().toString(36).slice(2) + Date.now().toString(36);
    }
    return String(prefix || "event") + "-" + random;
  }

  function makeEvent(kind, campaignId, extra) {
    return Object.assign({
      v: LIMITS.protocolVersion,
      kind: kind,
      campaignId: String(campaignId || ""),
      nonce: makeNonce("event")
    }, extra || {});
  }

  function validRegionCode(value) {
    return typeof value === "string" && (/^[A-Z]{2}-[A-Z0-9]{1,3}$/.test(value) || value === TAIWAN_ADMIN_CODE);
  }

  function regionBelongsToCountry(regionCode, countryCode) {
    return regionCode === TAIWAN_ADMIN_CODE ? countryCode === CHINA_CODE : regionCode.indexOf(countryCode + "-") === 0;
  }

  function canonicalLocation(countryCode, regionCode) {
    if (countryCode === TAIWAN_SOURCE_CODE && regionCode === undefined) {
      return { countryCode: CHINA_CODE, regionCode: TAIWAN_ADMIN_CODE };
    }
    return { countryCode: countryCode, regionCode: regionCode };
  }

  function createMapIndex(dataset) {
    dataset = dataset || {};
    var countries = new Map();
    var regions = new Map();
    var points = new Map();
    (dataset.countries || []).forEach(function (country) {
      if (!country || !/^[A-Z]{2}$/.test(country.code || "")) return;
      countries.set(country.code, country);
      if (Array.isArray(country.point) && country.point.length === 2) points.set(country.code, country.point.slice(0, 2));
    });
    (dataset.regions || []).forEach(function (region) {
      if (!region || !validRegionCode(region.code) || !countries.has(region.countryCode) || !regionBelongsToCountry(region.code, region.countryCode)) return;
      regions.set(region.code, region);
      if (Array.isArray(region.point) && region.point.length === 2) points.set(region.code, region.point.slice(0, 2));
    });
    return Object.freeze({ countries: countries, regions: regions, points: points });
  }

  function validNonce(value) {
    return typeof value === "string" && value.length > 0 && value.length <= LIMITS.maxNonceLength && /^[A-Za-z0-9._:-]+$/.test(value);
  }

  function unknownFields(payload, allowed) {
    return Object.keys(payload || {}).filter(function (key) { return allowed.indexOf(key) < 0; });
  }

  function validateCommon(payload, expectedKind, expectedCampaign) {
    var errors = [];
    var allowed = EVENT_FIELDS[expectedKind] || [];
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return { errors: ["payload_missing"] };
    if (byteLength(payload) > LIMITS.maxPayloadBytes) errors.push("payload_too_large");
    if (unknownFields(payload, allowed).length) errors.push("unknown_field");
    if (payload.v !== LIMITS.protocolVersion) errors.push("version_invalid");
    if (payload.kind !== expectedKind) errors.push("kind_invalid");
    if (typeof payload.campaignId !== "string" || !payload.campaignId || payload.campaignId.length > 128 || expectedCampaign && payload.campaignId !== expectedCampaign) errors.push("campaign_invalid");
    if (!validNonce(payload.nonce)) errors.push("nonce_invalid");
    return { errors: errors };
  }

  function validateSubmission(payload, mapIndex, expectedCampaign) {
    var common = validateCommon(payload, KINDS.submission, expectedCampaign);
    var errors = common.errors;
    var countries = mapIndex && mapIndex.countries;
    var regions = mapIndex && mapIndex.regions;
    var location = canonicalLocation(payload && payload.countryCode, payload && payload.regionCode);
    var countryCode = location.countryCode;
    var regionCode = location.regionCode;
    if (typeof countryCode !== "string" || !/^[A-Z]{2}$/.test(countryCode) || !countries || !countries.has(countryCode)) errors.push("country_invalid");
    if (regionCode !== undefined) {
      if (!validRegionCode(regionCode) || !regions || !regions.has(regionCode)) errors.push("region_invalid");
      else if (regions.get(regionCode).countryCode !== countryCode) errors.push("region_country_mismatch");
    }
    if (!payload || payload.status !== "visitor") errors.push("status_invalid");
    return {
      ok: errors.length === 0,
      errors: Array.from(new Set(errors)),
      value: errors.length ? null : {
        v: LIMITS.protocolVersion,
        kind: KINDS.submission,
        campaignId: payload.campaignId,
        nonce: payload.nonce,
        countryCode: countryCode,
        regionCode: regionCode,
        status: "visitor"
      }
    };
  }

  function decodeEnvelope(raw, expectedType) {
    if (!raw || typeof raw !== "object") return null;
    if (raw.senderActor && raw.payload) {
      if (!normalizeActor(raw.senderActor) || !raw.messageId || !validServerTime(raw.createdAt)) return null;
      return {
        payload: raw.payload,
        senderActor: normalizeActor(raw.senderActor),
        messageId: String(raw.messageId),
        roomId: String(raw.roomId || ""),
        createdAt: new Date(raw.createdAt).toISOString()
      };
    }
    var outer = raw;
    var data = raw.data && typeof raw.data === "object" ? raw.data : raw;
    var message = data.message && typeof data.message === "object" ? data.message : data;
    var content = message.content && typeof message.content === "object" ? message.content : message;
    var messageType = content.message_type || message.message_type || data.message_type || outer.message_type;
    var payload = content.payload !== undefined ? content.payload : (message.payload !== undefined ? message.payload : data.payload);
    var senderActor = normalizeActor(actorFrom(message) || actorFrom(data) || actorFrom(outer));
    var messageId = message.id || message.message_id || message.messageId || data.id || data.message_id || outer.messageId || outer.message_id;
    var createdAt = message.created_at || message.createdAt || message.published || data.created_at || data.createdAt || outer.createdAt || outer.created_at;
    if (messageType !== (expectedType || LIMITS.messageType) || !payload || typeof payload !== "object" || !senderActor || !messageId || !validServerTime(createdAt)) return null;
    return {
      payload: payload,
      senderActor: senderActor,
      messageId: String(messageId),
      roomId: String(outer.roomId || outer.room_id || data.roomId || data.room_id || ""),
      createdAt: new Date(createdAt).toISOString()
    };
  }

  function validServerTime(value) {
    return typeof value === "string" && Number.isFinite(new Date(value).getTime());
  }

  function eventSort(left, right) {
    var time = String(left.createdAt).localeCompare(String(right.createdAt));
    return time || String(left.messageId).localeCompare(String(right.messageId));
  }

  function validateTargetActor(payload, kind, campaignId) {
    var common = validateCommon(payload, kind, campaignId);
    var actor = normalizeActor(payload && payload.targetActor);
    if (!actor) common.errors.push("target_actor_invalid");
    return { ok: common.errors.length === 0, errors: common.errors, targetActor: actor };
  }

  function validateModeration(payload, kind, campaignId) {
    var common = validateCommon(payload, kind, campaignId);
    if (!payload || typeof payload.targetMessageId !== "string" || !payload.targetMessageId || payload.targetMessageId.length > 256) common.errors.push("target_message_invalid");
    if (kind === KINDS.hide && MODERATION_REASONS.indexOf(payload.reason) < 0) common.errors.push("reason_invalid");
    return { ok: common.errors.length === 0, errors: common.errors };
  }

  function validateReport(payload, campaignId) {
    var common = validateCommon(payload, KINDS.report, campaignId);
    if (!payload || typeof payload.targetMessageId !== "string" || !payload.targetMessageId || payload.targetMessageId.length > 256) common.errors.push("target_message_invalid");
    if (!payload || REPORT_REASONS.indexOf(payload.reason) < 0) common.errors.push("reason_invalid");
    return { ok: common.errors.length === 0, errors: common.errors };
  }

  function validateResolveReport(payload, campaignId) {
    var common = validateCommon(payload, KINDS.resolveReport, campaignId);
    if (!payload || typeof payload.reportMessageId !== "string" || !payload.reportMessageId || payload.reportMessageId.length > 256) common.errors.push("report_message_invalid");
    if (!payload || ["reviewed", "hidden", "dismissed"].indexOf(payload.resolution) < 0) common.errors.push("resolution_invalid");
    return { ok: common.errors.length === 0, errors: common.errors };
  }

  function replayEvents(rawEvents, options) {
    options = options || {};
    var campaignId = String(options.campaignId || "");
    var ownerActor = normalizeActor(options.ownerActor);
    var maxPerActor = Number(options.maxPerActor) || LIMITS.maxPerActor;
    var cooldownMs = Number(options.cooldownMs) || LIMITS.cooldownMs;
    var decodedEvents = (rawEvents || []).map(function (raw) { return decodeEnvelope(raw); }).filter(Boolean).sort(eventSort);
    var messageIds = new Set();
    var actorNonces = new Set();
    var moderators = new Set();
    var blockedActors = new Set();
    var hiddenMessages = new Set();
    var audit = [];
    var submissionsByMessage = new Map();
    var actorLocations = new Map();
    var actorCounts = new Map();
    var actorLastAccepted = new Map();
    var reports = [];
    var reportsByMessage = new Map();
    var stats = {
      totalEnvelopes: (rawEvents || []).length,
      decodedEnvelopes: decodedEvents.length,
      acceptedSubmissions: 0,
      invalidEvents: Math.max(0, (rawEvents || []).length - decodedEvents.length),
      duplicates: 0,
      locationDuplicates: 0,
      cooldownRejected: 0,
      quotaRejected: 0,
      unauthorizedGovernance: 0,
      ignoredCampaign: 0,
      historyTruncated: Boolean(options.historyTruncated)
    };

    decodedEvents.forEach(function (record) {
      var payload = record.payload || {};
      var sender = record.senderActor;
      var messageNonceKey = sender + "\u0000" + String(payload.nonce || "");
      if (messageIds.has(record.messageId) || payload.nonce && actorNonces.has(messageNonceKey)) {
        stats.duplicates += 1;
        return;
      }
      messageIds.add(record.messageId);
      if (payload.nonce) actorNonces.add(messageNonceKey);
      if (payload.campaignId !== campaignId) {
        stats.ignoredCampaign += 1;
        return;
      }

      if (payload.kind === KINDS.submission) {
        var checked = validateSubmission(payload, options.mapIndex, campaignId);
        if (!checked.ok) { stats.invalidEvents += 1; return; }
        var locationKey = checked.value.regionCode || checked.value.countryCode;
        var locations = actorLocations.get(sender) || new Set();
        if (locations.has(locationKey)) { stats.locationDuplicates += 1; return; }
        var count = actorCounts.get(sender) || 0;
        if (count >= maxPerActor) { stats.quotaRejected += 1; return; }
        var acceptedAt = new Date(record.createdAt).getTime();
        var lastAcceptedAt = actorLastAccepted.get(sender);
        if (lastAcceptedAt !== undefined && acceptedAt - lastAcceptedAt < cooldownMs) { stats.cooldownRejected += 1; return; }
        locations.add(locationKey);
        actorLocations.set(sender, locations);
        actorCounts.set(sender, count + 1);
        actorLastAccepted.set(sender, acceptedAt);
        var submissionRecord = {
          senderActor: sender,
          messageId: record.messageId,
          createdAt: record.createdAt,
          countryCode: checked.value.countryCode,
          regionCode: checked.value.regionCode,
          status: "visitor",
          hidden: false,
          blocked: false
        };
        audit.push(submissionRecord);
        submissionsByMessage.set(record.messageId, submissionRecord);
        stats.acceptedSubmissions += 1;
        return;
      }

      if (payload.kind === KINDS.report) {
        var reportChecked = validateReport(payload, campaignId);
        if (!reportChecked.ok || blockedActors.has(sender) || !submissionsByMessage.has(payload.targetMessageId)) { stats.invalidEvents += 1; return; }
        var report = { messageId: record.messageId, senderActor: sender, targetMessageId: payload.targetMessageId, reason: payload.reason, createdAt: record.createdAt, resolved: false };
        reports.push(report);
        reportsByMessage.set(record.messageId, report);
        return;
      }

      if (payload.kind === KINDS.moderatorGrant || payload.kind === KINDS.moderatorRevoke) {
        var moderatorEvent = validateTargetActor(payload, payload.kind, campaignId);
        if (!moderatorEvent.ok) { stats.invalidEvents += 1; return; }
        if (!ownerActor || sender !== ownerActor) { stats.unauthorizedGovernance += 1; return; }
        if (payload.kind === KINDS.moderatorGrant) moderators.add(moderatorEvent.targetActor);
        else moderators.delete(moderatorEvent.targetActor);
        return;
      }

      var authorized = Boolean(ownerActor && sender === ownerActor) || moderators.has(sender);
      if (payload.kind === KINDS.hide || payload.kind === KINDS.restore) {
        var moderationEvent = validateModeration(payload, payload.kind, campaignId);
        if (!moderationEvent.ok) { stats.invalidEvents += 1; return; }
        if (!authorized) { stats.unauthorizedGovernance += 1; return; }
        if (!submissionsByMessage.has(payload.targetMessageId)) { stats.invalidEvents += 1; return; }
        if (payload.kind === KINDS.hide) hiddenMessages.add(payload.targetMessageId);
        else hiddenMessages.delete(payload.targetMessageId);
        return;
      }
      if (payload.kind === KINDS.block || payload.kind === KINDS.unblock) {
        var blockEvent = validateTargetActor(payload, payload.kind, campaignId);
        if (!blockEvent.ok) { stats.invalidEvents += 1; return; }
        if (!authorized) { stats.unauthorizedGovernance += 1; return; }
        if (payload.kind === KINDS.block) blockedActors.add(blockEvent.targetActor);
        else blockedActors.delete(blockEvent.targetActor);
        return;
      }
      if (payload.kind === KINDS.resolveReport) {
        var resolutionEvent = validateResolveReport(payload, campaignId);
        if (!resolutionEvent.ok) { stats.invalidEvents += 1; return; }
        if (!authorized) { stats.unauthorizedGovernance += 1; return; }
        var targetReport = reportsByMessage.get(payload.reportMessageId);
        if (!targetReport) { stats.invalidEvents += 1; return; }
        targetReport.resolved = true;
        targetReport.resolution = payload.resolution;
        return;
      }
      stats.invalidEvents += 1;
    });

    audit.forEach(function (item) {
      item.hidden = hiddenMessages.has(item.messageId);
      item.blocked = blockedActors.has(item.senderActor);
    });
    return {
      submissions: audit.filter(function (item) { return !item.hidden && !item.blocked; }),
      audit: audit,
      reports: reports,
      moderators: Array.from(moderators).sort(),
      blockedActors: Array.from(blockedActors).sort(),
      stats: stats
    };
  }

  function countBucket(count, minK) {
    minK = Number(minK) || LIMITS.defaultMinK;
    if (count < minK) return null;
    if (count < 5) return "3-4";
    if (count < 10) return "5-9";
    if (count < 25) return "10-24";
    if (count < 50) return "25-49";
    return "50+";
  }

  function incrementDistinct(index, key, actor) {
    var actors = index.get(key) || new Set();
    actors.add(actor);
    index.set(key, actors);
  }

  function buildPublicProjection(replay, options) {
    replay = replay || { submissions: [], stats: {} };
    options = options || {};
    var minK = Number(options.minK) || LIMITS.defaultMinK;
    var countryActors = new Map();
    var regionActors = new Map();
    var allActors = new Set();
    (replay.submissions || []).forEach(function (item) {
      if (!item || !item.senderActor || !/^[A-Z]{2}$/.test(item.countryCode || "")) return;
      allActors.add(item.senderActor);
      incrementDistinct(countryActors, item.countryCode, item.senderActor);
      if (item.regionCode) incrementDistinct(regionActors, item.regionCode, item.senderActor);
    });
    var countries = Array.from(countryActors.entries()).filter(function (entry) { return entry[1].size >= minK; }).map(function (entry) {
      return { code: entry[0], countBucket: countBucket(entry[1].size, minK) };
    }).sort(function (left, right) { return left.code.localeCompare(right.code); });
    var regions = Array.from(regionActors.entries()).filter(function (entry) { return entry[1].size >= minK; }).map(function (entry) {
      var sample = (replay.submissions || []).find(function (item) { return item.regionCode === entry[0]; });
      return { code: entry[0], countryCode: sample.countryCode, countBucket: countBucket(entry[1].size, minK) };
    }).sort(function (left, right) { return left.code.localeCompare(right.code); });
    return {
      v: LIMITS.protocolVersion,
      campaignId: String(options.campaignId || ""),
      publishedDate: String(options.publishedDate || ""),
      totalContributorsBucket: countBucket(allActors.size, minK),
      countries: countries,
      regions: regions,
      diagnostics: {
        reviewedSubmissions: (replay.submissions || []).length,
        suppressedLocations: Math.max(0, countryActors.size - countries.length) + Math.max(0, regionActors.size - regions.length)
      }
    };
  }

  function validatePublicProjection(value, mapIndex, expectedCampaign) {
    var errors = [];
    var buckets = ["3-4", "5-9", "10-24", "25-49", "50+"];
    if (!value || typeof value !== "object" || Array.isArray(value)) return { ok: false, errors: ["projection_missing"], value: null };
    if (unknownFields(value, ["v", "campaignId", "publishedDate", "totalContributorsBucket", "countries", "regions", "diagnostics"]).length) errors.push("projection_unknown_field");
    if (value.v !== 1) errors.push("projection_version_invalid");
    if (typeof value.campaignId !== "string" || !value.campaignId || value.campaignId.length > 128 || expectedCampaign && value.campaignId !== expectedCampaign) errors.push("projection_campaign_invalid");
    if (typeof value.publishedDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value.publishedDate)) errors.push("projection_date_invalid");
    if (value.totalContributorsBucket !== null && buckets.indexOf(value.totalContributorsBucket) < 0) errors.push("projection_total_bucket_invalid");
    if (!Array.isArray(value.countries) || !Array.isArray(value.regions)) errors.push("projection_lists_invalid");
    var countries = [];
    var regions = [];
    var seen = new Set();
    (Array.isArray(value.countries) ? value.countries : []).forEach(function (item) {
      if (item && typeof item === "object" && !Array.isArray(item) && !unknownFields(item, ["code", "countBucket"]).length && item.code === TAIWAN_SOURCE_CODE && buckets.indexOf(item.countBucket) >= 0 && mapIndex && mapIndex.countries.has(CHINA_CODE) && mapIndex.regions.has(TAIWAN_ADMIN_CODE)) {
        if (seen.has("r:" + TAIWAN_ADMIN_CODE)) { errors.push("projection_region_invalid"); return; }
        seen.add("r:" + TAIWAN_ADMIN_CODE);
        regions.push({ code: TAIWAN_ADMIN_CODE, countryCode: CHINA_CODE, countBucket: item.countBucket });
        return;
      }
      if (!item || typeof item !== "object" || Array.isArray(item) || unknownFields(item, ["code", "countBucket"]).length || !mapIndex || !mapIndex.countries.has(item.code) || buckets.indexOf(item.countBucket) < 0 || seen.has("c:" + item.code)) {
        errors.push("projection_country_invalid"); return;
      }
      seen.add("c:" + item.code);
      countries.push({ code: item.code, countBucket: item.countBucket });
    });
    (Array.isArray(value.regions) ? value.regions : []).forEach(function (item) {
      var knownRegion = mapIndex && mapIndex.regions && mapIndex.regions.get(item && item.code);
      var canVerifyRegions = Boolean(mapIndex && mapIndex.regions && mapIndex.regions.size);
      var regionValid = item && validRegionCode(item.code) && typeof item.countryCode === "string" && regionBelongsToCountry(item.code, item.countryCode) && mapIndex && mapIndex.countries.has(item.countryCode) && (!canVerifyRegions || knownRegion && knownRegion.countryCode === item.countryCode);
      if (!item || typeof item !== "object" || Array.isArray(item) || unknownFields(item, ["code", "countryCode", "countBucket"]).length || !regionValid || buckets.indexOf(item.countBucket) < 0 || seen.has("r:" + item.code)) {
        errors.push("projection_region_invalid"); return;
      }
      seen.add("r:" + item.code);
      regions.push({ code: item.code, countryCode: item.countryCode, countBucket: item.countBucket });
    });
    if (countries.length + regions.length > 500) errors.push("projection_limit_exceeded");
    var diagnostics = value.diagnostics;
    if (!diagnostics || typeof diagnostics !== "object" || Array.isArray(diagnostics) || unknownFields(diagnostics, ["reviewedSubmissions", "suppressedLocations"]).length || !Number.isInteger(diagnostics.reviewedSubmissions) || diagnostics.reviewedSubmissions < 0 || diagnostics.reviewedSubmissions > LIMITS.maxHistoryMessages || !Number.isInteger(diagnostics.suppressedLocations) || diagnostics.suppressedLocations < 0 || diagnostics.suppressedLocations > 500) errors.push("projection_diagnostics_invalid");
    var normalized = {
      v: 1,
      campaignId: value.campaignId,
      publishedDate: value.publishedDate,
      totalContributorsBucket: value.totalContributorsBucket,
      countries: countries,
      regions: regions,
      diagnostics: diagnostics && { reviewedSubmissions: diagnostics.reviewedSubmissions, suppressedLocations: diagnostics.suppressedLocations }
    };
    if (byteLength(normalized) > 1024 * 1024) errors.push("projection_too_large");
    return { ok: errors.length === 0, errors: Array.from(new Set(errors)), value: errors.length ? null : normalized };
  }

  function degreesToRadians(value) { return Number(value) * Math.PI / 180; }
  function radiansToDegrees(value) { return Number(value) * 180 / Math.PI; }
  function clamp(value, minimum, maximum) { return Math.min(maximum, Math.max(minimum, value)); }
  function wrapLongitude(value) {
    var wrapped = (Number(value) + 180) % 360;
    if (wrapped < 0) wrapped += 360;
    return wrapped - 180;
  }

  function normalizeView(view) {
    view = view || {};
    var zoom = clamp(Number(view.zoom) || 1, 0.5, 8);
    return {
      centerLon: wrapLongitude(Number(view.centerLon) || 0),
      centerLat: clamp(Number(view.centerLat) || 0, -89.5, 89.5),
      centerX: Number(view.centerX) || 0,
      centerY: Number(view.centerY) || 0,
      radius: Math.max(1, Number(view.radius) || 1) * zoom,
      zoom: zoom
    };
  }

  function projectPoint(lon, lat, view) {
    var camera = normalizeView(view);
    var lambda = degreesToRadians(wrapLongitude(lon));
    var phi = degreesToRadians(clamp(Number(lat) || 0, -90, 90));
    var lambda0 = degreesToRadians(camera.centerLon);
    var phi0 = degreesToRadians(camera.centerLat);
    var delta = lambda - lambda0;
    var cosPhi = Math.cos(phi);
    var sinPhi = Math.sin(phi);
    var cosPhi0 = Math.cos(phi0);
    var sinPhi0 = Math.sin(phi0);
    var depth = sinPhi0 * sinPhi + cosPhi0 * cosPhi * Math.cos(delta);
    var projectedX = cosPhi * Math.sin(delta);
    var projectedY = cosPhi0 * sinPhi - sinPhi0 * cosPhi * Math.cos(delta);
    return {
      x: camera.centerX + projectedX * camera.radius,
      y: camera.centerY - projectedY * camera.radius,
      visible: depth >= -1e-10,
      depth: depth
    };
  }

  function unprojectPoint(x, y, view) {
    var camera = normalizeView(view);
    var normalizedX = (Number(x) - camera.centerX) / camera.radius;
    var normalizedY = -(Number(y) - camera.centerY) / camera.radius;
    var rho = Math.hypot(normalizedX, normalizedY);
    if (!Number.isFinite(rho) || rho > 1 + 1e-10) return null;
    if (rho < 1e-12) return { lon: camera.centerLon, lat: camera.centerLat };
    var c = Math.asin(clamp(rho, 0, 1));
    var sinC = Math.sin(c);
    var cosC = Math.cos(c);
    var phi0 = degreesToRadians(camera.centerLat);
    var lambda0 = degreesToRadians(camera.centerLon);
    var phi = Math.asin(clamp(cosC * Math.sin(phi0) + normalizedY * sinC * Math.cos(phi0) / rho, -1, 1));
    var lambda = lambda0 + Math.atan2(normalizedX * sinC, rho * Math.cos(phi0) * cosC - normalizedY * Math.sin(phi0) * sinC);
    return { lon: wrapLongitude(radiansToDegrees(lambda)), lat: radiansToDegrees(phi) };
  }

  function longitudeNear(value, reference) {
    var longitude = Number(value);
    while (longitude - reference > 180) longitude -= 360;
    while (longitude - reference < -180) longitude += 360;
    return longitude;
  }

  function pointInRing(lon, lat, ring) {
    if (!Array.isArray(ring) || ring.length < 3) return false;
    var inside = false;
    for (var index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
      var currentPoint = ring[index];
      var previousPoint = ring[previous];
      if (!Array.isArray(currentPoint) || !Array.isArray(previousPoint)) continue;
      var currentX = longitudeNear(currentPoint[0], lon);
      var previousX = longitudeNear(previousPoint[0], lon);
      var currentY = Number(currentPoint[1]);
      var previousY = Number(previousPoint[1]);
      var intersects = (currentY > lat) !== (previousY > lat) && lon < (previousX - currentX) * (lat - currentY) / ((previousY - currentY) || Number.EPSILON) + currentX;
      if (intersects) inside = !inside;
    }
    return inside;
  }

  function featureContains(feature, lon, lat) {
    return (feature && feature.polygons || []).some(function (polygon) {
      if (!Array.isArray(polygon) || !polygon.length || !pointInRing(lon, lat, polygon[0])) return false;
      for (var holeIndex = 1; holeIndex < polygon.length; holeIndex += 1) {
        if (pointInRing(lon, lat, polygon[holeIndex])) return false;
      }
      return true;
    });
  }

  function hitTest(dataset, lon, lat, options) {
    options = options || {};
    var level = options.level === "region" ? "region" : "country";
    var features = level === "region" ? dataset && dataset.regions || [] : dataset && dataset.countries || [];
    for (var index = features.length - 1; index >= 0; index -= 1) {
      var feature = features[index];
      if (level === "region" && options.countryCode && feature.countryCode !== options.countryCode) continue;
      if (!featureContains(feature, Number(lon), Number(lat))) continue;
      return level === "region" ? { countryCode: feature.countryCode, regionCode: feature.code } : { countryCode: feature.code };
    }
    return null;
  }

  function hitTestScreen(dataset, x, y, view, options) {
    var geographic = unprojectPoint(x, y, view);
    return geographic ? hitTest(dataset, geographic.lon, geographic.lat, options) : null;
  }

  function representativePoint(mapIndex, code) {
    if (!mapIndex || !mapIndex.points || !mapIndex.points.has(code)) return null;
    var point = mapIndex.points.get(code);
    return Array.isArray(point) ? point.slice(0, 2) : null;
  }

  function loadMapAsset(buffer) {
    var text;
    if (buffer && typeof buffer === "object" && !(buffer instanceof ArrayBuffer) && !ArrayBuffer.isView(buffer) && buffer.buffer !== undefined) buffer = buffer.buffer;
    if (typeof buffer === "string") text = buffer;
    else if (buffer instanceof ArrayBuffer) text = new TextDecoder("utf-8").decode(new Uint8Array(buffer));
    else if (ArrayBuffer.isView(buffer)) text = new TextDecoder("utf-8").decode(buffer);
    else throw new Error("Unsupported map asset buffer");
    var parsed = JSON.parse(text);
    if (!parsed || parsed.v !== 1 || !Array.isArray(parsed.countries) || !Array.isArray(parsed.regions)) throw new Error("Invalid map asset");
    return parsed;
  }

  function mergeMapAssets(world, admin1) {
    return {
      v: 1,
      source: { world: world && world.source || null, admin1: admin1 && admin1.source || null },
      countries: Array.isArray(world && world.countries) ? world.countries.slice() : [],
      regions: Array.isArray(admin1 && admin1.regions) ? admin1.regions.slice() : []
    };
  }

  function validateOwnerFootprints(value, mapIndex) {
    var errors = [];
    var allowedRoot = ["v", "countries", "regions"];
    if (!value || typeof value !== "object" || Array.isArray(value)) return { ok: false, errors: ["owner_missing"], value: null };
    if (unknownFields(value, allowedRoot).length) errors.push("owner_unknown_field");
    if (value.v !== 1) errors.push("owner_version_invalid");
    if (!Array.isArray(value.countries) || !Array.isArray(value.regions)) errors.push("owner_lists_invalid");
    var countries = [];
    var regions = [];
    var seen = new Set();
    function validStatus(status) { return status === "resident" || status === "travel"; }
    (Array.isArray(value.countries) ? value.countries : []).forEach(function (item) {
      if (item && typeof item === "object" && !Array.isArray(item) && !unknownFields(item, ["code", "status"]).length && item.code === TAIWAN_SOURCE_CODE && validStatus(item.status) && mapIndex && mapIndex.countries.has(CHINA_CODE) && mapIndex.regions.has(TAIWAN_ADMIN_CODE)) {
        var taiwanKey = "region:" + TAIWAN_ADMIN_CODE;
        if (seen.has(taiwanKey)) { errors.push("owner_duplicate"); return; }
        seen.add(taiwanKey);
        regions.push({ code: TAIWAN_ADMIN_CODE, countryCode: CHINA_CODE, status: item.status });
        return;
      }
      if (!item || typeof item !== "object" || Array.isArray(item) || unknownFields(item, ["code", "status"]).length || !mapIndex || !mapIndex.countries.has(item.code) || !validStatus(item.status)) {
        errors.push("owner_country_invalid"); return;
      }
      var key = "country:" + item.code;
      if (seen.has(key)) { errors.push("owner_duplicate"); return; }
      seen.add(key);
      countries.push({ code: item.code, status: item.status });
    });
    (Array.isArray(value.regions) ? value.regions : []).forEach(function (item) {
      var region = item && mapIndex && mapIndex.regions.get(item.code);
      if (!item || typeof item !== "object" || Array.isArray(item) || unknownFields(item, ["code", "countryCode", "status"]).length || !region || region.countryCode !== item.countryCode || !validStatus(item.status)) {
        errors.push("owner_region_invalid"); return;
      }
      var key = "region:" + item.code;
      if (seen.has(key)) { errors.push("owner_duplicate"); return; }
      seen.add(key);
      regions.push({ code: item.code, countryCode: item.countryCode, status: item.status });
    });
    if (countries.length + regions.length > 80) errors.push("owner_limit_exceeded");
    var normalized = { v: 1, countries: countries, regions: regions };
    if (byteLength(normalized) > 64 * 1024) errors.push("owner_too_large");
    return { ok: errors.length === 0, errors: Array.from(new Set(errors)), value: errors.length ? null : normalized };
  }

  function markerRadius(bucket) {
    return ({ "3-4": 4, "5-9": 5, "10-24": 6.5, "25-49": 8, "50+": 10 })[bucket] || 5;
  }

  function sameProjectedPoint(left, right) {
    return left && right && Math.abs(left.x - right.x) < 1e-7 && Math.abs(left.y - right.y) < 1e-7;
  }

  function horizonIntersection(left, right, view) {
    var camera = normalizeView(view);
    var denominator = left.depth - right.depth;
    var amount = Math.abs(denominator) < 1e-12 ? 0 : clamp(left.depth / denominator, 0, 1);
    var x = (left.x - camera.centerX + (right.x - left.x) * amount) / camera.radius;
    var y = (left.y - camera.centerY + (right.y - left.y) * amount) / camera.radius;
    var length = Math.hypot(x, y) || 1;
    return { x: camera.centerX + x / length * camera.radius, y: camera.centerY + y / length * camera.radius };
  }

  function visibleRingPaths(ring, view) {
    var points = (Array.isArray(ring) ? ring : []).slice();
    if (points.length > 1 && points[0][0] === points[points.length - 1][0] && points[0][1] === points[points.length - 1][1]) points.pop();
    if (points.length < 3) return [];
    var projected = points.map(function (point) { return projectPoint(point[0], point[1], view); });
    if (projected.every(function (point) { return point.visible; })) return [{ points: projected, horizon: false }];
    var firstHidden = projected.findIndex(function (point) { return !point.visible; });
    if (firstHidden < 0 || projected.every(function (point) { return !point.visible; })) return [];
    var paths = [];
    var current = [];
    for (var step = 0; step < projected.length; step++) {
      var left = projected[(firstHidden + step) % projected.length];
      var right = projected[(firstHidden + step + 1) % projected.length];
      if (!left.visible && right.visible) {
        current = [horizonIntersection(left, right, view), right];
      } else if (left.visible && right.visible) {
        if (!current.length) current.push(left);
        if (!sameProjectedPoint(current[current.length - 1], right)) current.push(right);
      } else if (left.visible && !right.visible) {
        if (!current.length) current.push(left);
        var intersection = horizonIntersection(left, right, view);
        if (!sameProjectedPoint(current[current.length - 1], intersection)) current.push(intersection);
        if (current.length >= 2) paths.push({ points: current, horizon: true });
        current = [];
      }
    }
    return paths;
  }

  function appendHorizonArc(context, from, to, centerX, centerY, radius) {
    var start = Math.atan2(from.y - centerY, from.x - centerX);
    var end = Math.atan2(to.y - centerY, to.x - centerX);
    var delta = (end - start + Math.PI * 3) % (Math.PI * 2) - Math.PI;
    if (Math.abs(delta) > 1e-7) context.arc(centerX, centerY, radius, start, start + delta, delta < 0);
  }

  function renderGlobe(context, options) {
    options = options || {};
    var canvas = context.canvas;
    var width = Number(options.width || canvas && canvas.width || 320);
    var height = Number(options.height || canvas && canvas.height || 240);
    var radius = Math.max(28, Math.min(width, height) * 0.43);
    var view = Object.assign({}, options.view || {}, { centerX: width / 2, centerY: height / 2, radius: radius });
    var renderedRadius = normalizeView(view).radius;
    var theme = options.theme === "dark" ? "dark" : "light";
    var palette = theme === "dark"
      ? { space: "#0d1522", ocean: "#142940", land: "#31506a", border: "#7090a8", glow: "rgba(92,160,190,.24)", ownerResident: "#60a5fa", ownerTravel: "#fb923c", visitor: "#cbd5e1", selected: "#f8fafc" }
      : { space: "#edf1f3", ocean: "#dce8eb", land: "#b8c8cb", border: "#f8fafc", glow: "rgba(42,96,115,.18)", ownerResident: "#2563eb", ownerTravel: "#ea580c", visitor: "#334155", selected: "#0f172a" };
    context.clearRect(0, 0, width, height);
    context.fillStyle = palette.space;
    context.fillRect(0, 0, width, height);
    context.save();
    context.beginPath();
    context.arc(width / 2, height / 2, renderedRadius, 0, Math.PI * 2);
    context.clip();
    context.fillStyle = palette.ocean;
    context.fillRect(width / 2 - renderedRadius, height / 2 - renderedRadius, renderedRadius * 2, renderedRadius * 2);
    context.shadowColor = palette.glow;
    context.shadowBlur = 20;
    (options.dataset && options.dataset.countries || []).forEach(function (feature) {
      var paths = [];
      (feature.polygons || []).forEach(function (polygon) {
        (polygon || []).forEach(function (ring) {
          paths.push.apply(paths, visibleRingPaths(ring, view));
        });
      });
      if (paths.length) {
        context.beginPath();
        paths.forEach(function (path) {
          context.moveTo(path.points[0].x, path.points[0].y);
          path.points.slice(1).forEach(function (point) { context.lineTo(point.x, point.y); });
          if (path.horizon) appendHorizonArc(context, path.points[path.points.length - 1], path.points[0], width / 2, height / 2, renderedRadius);
          context.closePath();
        });
        context.fillStyle = palette.land;
        context.fill("evenodd");
        context.shadowBlur = 0;
        context.beginPath();
        paths.forEach(function (path) {
          context.moveTo(path.points[0].x, path.points[0].y);
          path.points.slice(1).forEach(function (point) { context.lineTo(point.x, point.y); });
          if (!path.horizon) context.closePath();
        });
        context.strokeStyle = palette.border;
        context.lineWidth = Math.max(.45, renderedRadius / 400);
        context.stroke();
        context.shadowBlur = 20;
      }
    });
    context.shadowBlur = 0;
    (options.markers || []).slice().sort(function (left, right) {
      var lp = projectPoint(left.point[0], left.point[1], view);
      var rp = projectPoint(right.point[0], right.point[1], view);
      return lp.depth - rp.depth;
    }).forEach(function (marker) {
      if (!marker || !Array.isArray(marker.point)) return;
      var projected = projectPoint(marker.point[0], marker.point[1], view);
      if (!projected.visible) return;
      var size = marker.kind === "visitor" ? markerRadius(marker.countBucket) : 6;
      context.beginPath();
      context.arc(projected.x, projected.y, size, 0, Math.PI * 2);
      context.fillStyle = marker.kind === "resident" ? palette.ownerResident : marker.kind === "travel" ? palette.ownerTravel : palette.visitor;
      context.globalAlpha = marker.kind === "visitor" ? .68 : .95;
      context.fill();
      context.globalAlpha = 1;
      context.strokeStyle = marker.selected ? palette.selected : palette.ocean;
      context.lineWidth = marker.selected ? 3 : 1.5;
      context.stroke();
    });
    context.restore();
    context.beginPath();
    context.arc(width / 2, height / 2, renderedRadius, 0, Math.PI * 2);
    context.strokeStyle = theme === "dark" ? "#64849a" : "#82999f";
    context.lineWidth = 1.5;
    context.stroke();
  }

  function dragView(view, deltaX, deltaY, width, height) {
    var base = normalizeView(view);
    return {
      centerLon: wrapLongitude(base.centerLon - Number(deltaX) * 180 / Math.max(1, Number(width))),
      centerLat: clamp(base.centerLat + Number(deltaY) * 120 / Math.max(1, Number(height)), -85, 85),
      zoom: base.zoom
    };
  }

  function GlobeController(canvas, options) {
    options = options || {};
    if (!canvas || typeof canvas.getContext !== "function") throw new Error("canvas_required");
    this.canvas = canvas;
    this.context = canvas.getContext("2d");
    this.dataset = options.dataset || { countries: [], regions: [] };
    this.markers = options.markers || [];
    this.theme = options.theme || "light";
    this.view = normalizeView(options.view || { centerLon: 18, centerLat: 18, zoom: 1 });
    this.onSelect = typeof options.onSelect === "function" ? options.onSelect : function () {};
    this.hitLevel = options.hitLevel || "country";
    this.hitCountryCode = options.hitCountryCode || "";
    this.autoRotate = options.autoRotate !== false;
    this.reducedMotion = Boolean(options.reducedMotion);
    this.paused = false;
    this.destroyed = false;
    this.frameId = null;
    this.lastFrameAt = 0;
    this.pointer = null;
    this.requestFrame = options.requestFrame || (typeof requestAnimationFrame === "function" ? requestAnimationFrame.bind(globalThis) : function () { return null; });
    this.cancelFrame = options.cancelFrame || (typeof cancelAnimationFrame === "function" ? cancelAnimationFrame.bind(globalThis) : function () {});
    this.boundDown = this.pointerDown.bind(this);
    this.boundMove = this.pointerMove.bind(this);
    this.boundUp = this.pointerUp.bind(this);
    this.boundWheel = this.wheel.bind(this);
    this.boundKeyDown = this.keyDown.bind(this);
    canvas.addEventListener("pointerdown", this.boundDown);
    canvas.addEventListener("pointermove", this.boundMove);
    canvas.addEventListener("pointerup", this.boundUp);
    canvas.addEventListener("pointercancel", this.boundUp);
    canvas.addEventListener("wheel", this.boundWheel, { passive: false });
    canvas.addEventListener("keydown", this.boundKeyDown);
    this.resize();
    this.render();
    this.schedule();
  }

  GlobeController.prototype.resize = function () {
    var box = this.canvas.getBoundingClientRect ? this.canvas.getBoundingClientRect() : { width: this.canvas.clientWidth, height: this.canvas.clientHeight };
    var ratio = typeof devicePixelRatio === "number" ? Math.min(2, devicePixelRatio) : 1;
    var width = Math.max(1, Math.round(Number(box.width || this.canvas.clientWidth || this.canvas.width || 320) * ratio));
    var height = Math.max(1, Math.round(Number(box.height || this.canvas.clientHeight || this.canvas.height || 240) * ratio));
    if (this.canvas.width !== width) this.canvas.width = width;
    if (this.canvas.height !== height) this.canvas.height = height;
    this.render();
  };
  GlobeController.prototype.render = function () {
    if (this.destroyed) return;
    renderGlobe(this.context, { width: this.canvas.width, height: this.canvas.height, dataset: this.dataset, markers: this.markers, theme: this.theme, view: this.view });
  };
  GlobeController.prototype.schedule = function () {
    var self = this;
    if (this.destroyed || this.paused || !this.autoRotate || this.reducedMotion || this.frameId != null) return;
    this.frameId = this.requestFrame(function (time) {
      self.frameId = null;
      if (self.destroyed || self.paused) return;
      var frameTime = Number(time) || 0;
      if (!self.pointer && self.lastFrameAt) self.view.centerLon = wrapLongitude(self.view.centerLon + Math.min(40, frameTime - self.lastFrameAt) * .0025);
      self.lastFrameAt = frameTime;
      if (!self.pointer) self.render();
      self.schedule();
    });
  };
  GlobeController.prototype.pointerDown = function (event) {
    if (this.destroyed) return;
    if (event.preventDefault) event.preventDefault();
    this.pointer = { id: event.pointerId, startX: event.clientX, startY: event.clientY, lastX: event.clientX, lastY: event.clientY, moved: false };
    if (this.canvas.setPointerCapture) this.canvas.setPointerCapture(event.pointerId);
  };
  GlobeController.prototype.pointerMove = function (event) {
    if (!this.pointer || this.pointer.id !== event.pointerId || this.destroyed) return;
    if (event.preventDefault) event.preventDefault();
    var dx = Number(event.clientX) - this.pointer.lastX;
    var dy = Number(event.clientY) - this.pointer.lastY;
    if (Math.hypot(Number(event.clientX) - this.pointer.startX, Number(event.clientY) - this.pointer.startY) > 4) this.pointer.moved = true;
    this.view = normalizeView(dragView(this.view, dx, dy, this.canvas.clientWidth || this.canvas.width, this.canvas.clientHeight || this.canvas.height));
    this.pointer.lastX = Number(event.clientX);
    this.pointer.lastY = Number(event.clientY);
    this.render();
  };
  GlobeController.prototype.pointerUp = function (event) {
    if (!this.pointer || this.pointer.id !== event.pointerId || this.destroyed) return;
    var pointer = this.pointer;
    this.pointer = null;
    if (this.canvas.releasePointerCapture) { try { this.canvas.releasePointerCapture(event.pointerId); } catch (_error) {} }
    if (!pointer.moved) {
      var box = this.canvas.getBoundingClientRect ? this.canvas.getBoundingClientRect() : { left: 0, top: 0, width: this.canvas.clientWidth, height: this.canvas.clientHeight };
      var scaleX = this.canvas.width / Math.max(1, box.width);
      var scaleY = this.canvas.height / Math.max(1, box.height);
      var hitView = Object.assign({}, this.view, { centerX: this.canvas.width / 2, centerY: this.canvas.height / 2, radius: Math.min(this.canvas.width, this.canvas.height) * .43 });
      var selected = hitTestScreen(this.dataset, (event.clientX - box.left) * scaleX, (event.clientY - box.top) * scaleY, hitView, { level: this.hitLevel, countryCode: this.hitCountryCode });
      if (!selected && this.hitLevel === "region") selected = hitTestScreen(this.dataset, (event.clientX - box.left) * scaleX, (event.clientY - box.top) * scaleY, hitView, { level: "country" });
      if (selected) this.onSelect(selected);
    }
  };
  GlobeController.prototype.wheel = function (event) {
    if (this.destroyed) return;
    if (event.preventDefault) event.preventDefault();
    this.view.zoom = clamp(this.view.zoom * (Number(event.deltaY) > 0 ? .9 : 1.1), .5, 3);
    this.render();
  };
  GlobeController.prototype.keyDown = function (event) {
    if (this.destroyed) return;
    var key = event && event.key;
    var handled = true;
    if (key === "ArrowLeft") this.view.centerLon = wrapLongitude(this.view.centerLon - 8);
    else if (key === "ArrowRight") this.view.centerLon = wrapLongitude(this.view.centerLon + 8);
    else if (key === "ArrowUp") this.view.centerLat = clamp(this.view.centerLat + 6, -85, 85);
    else if (key === "ArrowDown") this.view.centerLat = clamp(this.view.centerLat - 6, -85, 85);
    else if (key === "+" || key === "=") this.view.zoom = clamp(this.view.zoom * 1.12, .5, 3);
    else if (key === "-" || key === "_") this.view.zoom = clamp(this.view.zoom / 1.12, .5, 3);
    else if (key === "0" || key === "Home") this.view = normalizeView({ centerLon: 18, centerLat: 18, zoom: 1 });
    else handled = false;
    if (handled) { if (event.preventDefault) event.preventDefault(); this.render(); }
  };
  GlobeController.prototype.setData = function (dataset) { this.dataset = dataset || { countries: [], regions: [] }; this.render(); };
  GlobeController.prototype.setMarkers = function (markers) { this.markers = Array.isArray(markers) ? markers : []; this.render(); };
  GlobeController.prototype.setTheme = function (theme) { this.theme = theme === "dark" ? "dark" : "light"; this.render(); };
  GlobeController.prototype.setHitTarget = function (level, countryCode) { this.hitLevel = level === "region" ? "region" : "country"; this.hitCountryCode = countryCode || ""; };
  GlobeController.prototype.setView = function (view) { this.view = normalizeView(Object.assign({}, this.view, view || {})); this.render(); };
  GlobeController.prototype.getView = function () { return { centerLon: this.view.centerLon, centerLat: this.view.centerLat, zoom: this.view.zoom }; };
  GlobeController.prototype.pause = function () { this.paused = true; if (this.frameId != null) this.cancelFrame(this.frameId); this.frameId = null; };
  GlobeController.prototype.resume = function () { if (this.destroyed) return; this.paused = false; this.lastFrameAt = 0; this.schedule(); this.render(); };
  GlobeController.prototype.isPaused = function () { return this.paused; };
  GlobeController.prototype.isDestroyed = function () { return this.destroyed; };
  GlobeController.prototype.destroy = function () {
    if (this.destroyed) return;
    this.pause();
    this.destroyed = true;
    this.canvas.removeEventListener("pointerdown", this.boundDown);
    this.canvas.removeEventListener("pointermove", this.boundMove);
    this.canvas.removeEventListener("pointerup", this.boundUp);
    this.canvas.removeEventListener("pointercancel", this.boundUp);
    this.canvas.removeEventListener("wheel", this.boundWheel);
    this.canvas.removeEventListener("keydown", this.boundKeyDown);
  };

  return Object.freeze({
    LIMITS: LIMITS,
    SHARED_KEYS: SHARED_KEYS,
    KINDS: KINDS,
    REPORT_REASONS: REPORT_REASONS,
    MODERATION_REASONS: MODERATION_REASONS,
    byteLength: byteLength,
    normalizeActor: normalizeActor,
    makeNonce: makeNonce,
    makeEvent: makeEvent,
    createMapIndex: createMapIndex,
    validateSubmission: validateSubmission,
    decodeEnvelope: decodeEnvelope,
    replayEvents: replayEvents,
    countBucket: countBucket,
    buildPublicProjection: buildPublicProjection,
    validatePublicProjection: validatePublicProjection,
    projectPoint: projectPoint,
    unprojectPoint: unprojectPoint,
    pointInRing: pointInRing,
    hitTest: hitTest,
    hitTestScreen: hitTestScreen,
    representativePoint: representativePoint,
    loadMapAsset: loadMapAsset,
    mergeMapAssets: mergeMapAssets,
    validateOwnerFootprints: validateOwnerFootprints,
    renderGlobe: renderGlobe,
    dragView: dragView,
    GlobeController: GlobeController
  });
});
