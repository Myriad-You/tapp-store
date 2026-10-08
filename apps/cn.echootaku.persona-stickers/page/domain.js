'use strict';

var MAX_REFERENCE_BYTES = 10 * 1024 * 1024;
var MAX_USER_PROMPT_LENGTH = 800;
var CACHE_PATH = /^\/api\/brew\/image-cache\/[A-Za-z0-9._\/-]+$/;
var ALLOWED_MOODS = ['floor', 'sad', 'tense', 'calm', 'excited'];
var ALLOWED_ACTIVITIES = ['idle', 'working', 'thinking', 'talking'];

function codedError(code, message, reason) {
  var error = new Error(message || code);
  error.code = code;
  if (reason) error.reason = reason;
  return error;
}

function decodeBase64(value) {
  if (typeof Buffer !== 'undefined') return Uint8Array.from(Buffer.from(value, 'base64'));
  var decoded = atob(value);
  var bytes = new Uint8Array(decoded.length);
  for (var index = 0; index < decoded.length; index += 1) bytes[index] = decoded.charCodeAt(index);
  return bytes;
}

function parseDataUrl(value) {
  var match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]*={0,2})$/.exec(String(value || ''));
  if (!match || !match[2]) throw codedError('INVALID_AI_IMAGE_REFERENCE', 'Invalid image data URL', 'format');
  var bytes;
  try { bytes = decodeBase64(match[2]); } catch (_) { throw codedError('INVALID_AI_IMAGE_REFERENCE', 'Invalid base64 image data', 'format'); }
  return { mime: match[1], bytes: bytes };
}

function hasSignature(mime, bytes) {
  if (mime === 'image/png') {
    var png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    return png.every(function (value, index) { return bytes[index] === value; });
  }
  if (mime === 'image/jpeg') return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  return bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
}

function validateLocalImageDataUrl(value) {
  var parsed = parseDataUrl(value);
  if (!hasSignature(parsed.mime, parsed.bytes)) {
    throw codedError('INVALID_AI_IMAGE_REFERENCE', 'Image signature does not match its MIME type', 'signature');
  }
  return { mime: parsed.mime, bytes: parsed.bytes.length };
}

function isCachePath(value) {
  return CACHE_PATH.test(String(value || '')) && String(value).indexOf('..') === -1;
}

function normalizePersona(card) {
  if (!card || typeof card !== 'object') {
    return { enabled: false, name: 'Agent', moodBand: 'calm', activity: 'idle', portraitUrl: null, reason: 'unavailable' };
  }
  var enabled = card.enabled === true;
  var name = enabled && typeof card.name === 'string' && card.name.trim() ? card.name.trim().slice(0, 80) : (enabled ? 'Arael' : 'Agent');
  var moodBand = ALLOWED_MOODS.indexOf(card.moodBand) >= 0 ? card.moodBand : 'calm';
  var activity = ALLOWED_ACTIVITIES.indexOf(card.activity) >= 0 ? card.activity : 'idle';
  var portraitUrl = enabled && isCachePath(card.portraitUrl) ? card.portraitUrl : null;
  return { enabled: enabled, name: name, moodBand: moodBand, activity: activity, portraitUrl: portraitUrl, reason: enabled ? (portraitUrl ? 'ready' : 'no-portrait') : 'disabled' };
}

function buildPrompt(options) {
  var persona = normalizePersona(options && options.persona);
  var mode = String(options && options.mode || '').trim();
  var cue = String(options && options.cue || '').trim();
  var userPrompt = String(options && options.userPrompt || '').trim().replace(/\r\n?/g, '\n');
  if (['emoji', 'kaomoji', 'image'].indexOf(mode) < 0) {
    throw codedError('INVALID_EXPRESSION_MODE', 'Choose Emoji, kaomoji, or image reference mode');
  }
  if (mode !== 'image' && !cue) {
    throw codedError('EXPRESSION_CUE_REQUIRED', 'Choose or enter an expression cue');
  }
  if (userPrompt.length > MAX_USER_PROMPT_LENGTH) {
    throw codedError('USER_PROMPT_LIMIT', 'Keep the additional creative direction within 800 characters');
  }
  cue = cue.slice(0, mode === 'emoji' ? 32 : 120);
  var parts = [];
  parts.push('Create exactly one standalone sticker as clean PNG-style artwork.');
  parts.push('Subject: ' + persona.name + '. Keep the same face, hair, outfit, colors, body proportions, and signature accessories. Do not redesign, replace, or age the character.');
  parts.push('Reference image 1 is the canonical Agent appearance. Preserve it faithfully.');
  if (userPrompt) {
    parts.push('PRIMARY USER CREATIVE DIRECTION (highest priority within the fixed identity and output rules):');
    parts.push(userPrompt);
    parts.push('Treat this direction as the dominant creative instruction. Preserve its requested action, expression, staging, props, and intensity instead of replacing it with a generic reaction.');
  }
  if (mode === 'emoji') {
    parts.push('Emoji cue: ' + cue + '. Translate its emotion into the Agent facial expression, body language, and pose; do not draw or print the emoji glyph.');
  } else if (mode === 'kaomoji') {
    parts.push('Kaomoji cue: ' + cue + '. Translate its emotion into the Agent facial expression, body language, and pose; do not draw or print the kaomoji characters.');
  } else {
    parts.push('Reference image 2 is only the expression, pose, and composition reference. It must not replace the Agent identity, clothing, colors, or signature features.');
  }
  parts.push('Current persona context: mood band ' + persona.moodBand + ', activity ' + persona.activity + '.');
  parts.push('Use a polished chibi reaction-sticker treatment with a bold readable silhouette and clean edge separation.');
  parts.push('Use a clean, unobtrusive background suited to the character. Do not draw a transparency checkerboard pattern.');
  parts.push('Show one character depiction only, with no collage or repeated poses. No text, letters, logos, signatures, or watermarks.');
  return parts.join('\n');
}

function errorCode(error) {
  var current = error;
  for (var depth = 0; depth < 6 && current; depth += 1) {
    if (typeof current.code === 'string' && current.code) return current.code.toUpperCase();
    current = current.error || current.details || current.data || current.cause;
  }
  var message = String(error && error.message || error || '');
  var match = /\b(AI_PROVIDER_ERROR|INVALID_AI_IMAGE_REFERENCE|AI_IMAGE_REFERENCE_LIMIT|AI_TASK_INPUT_LIMIT|USER_PROMPT_LIMIT|RESULT_REQUIRED|FILE_API_UNAVAILABLE|DOWNLOAD_API_UNAVAILABLE|PERMISSION_DENIED|FORBIDDEN|PERSONA_REQUIRED|INVALID_EXPRESSION_MODE|EXPRESSION_CUE_REQUIRED|EXPRESSION_IMAGE_REQUIRED|AI_TASK_TIMEOUT|AI_TASK_CANCELLED|AI_TASK_DESTROYED)\b/i.exec(message);
  return match ? match[1].toUpperCase() : '';
}

function classifyError(error) {
  var code = errorCode(error) || 'UNKNOWN_ERROR';
  var kind = 'unknown';
  if (code === 'AI_PROVIDER_ERROR') kind = 'provider';
  else if (/PERMISSION|FORBIDDEN|UNAUTHORIZED/.test(code)) kind = 'permission';
  else if (code === 'PERSONA_REQUIRED') kind = 'persona';
  else if (/^(INVALID_EXPRESSION_MODE|EXPRESSION_CUE_REQUIRED|EXPRESSION_IMAGE_REQUIRED)$/.test(code)) kind = 'input';
  else if (code === 'AI_TASK_TIMEOUT') kind = 'timeout';
  else if (/CANCEL/.test(code)) kind = 'cancelled';
  else if (code === 'INVALID_AI_IMAGE_REFERENCE') kind = 'reference';
  else if (code === 'AI_IMAGE_REFERENCE_LIMIT') kind = 'reference-limit';
  else if (code === 'AI_TASK_INPUT_LIMIT' || code === 'USER_PROMPT_LIMIT') kind = 'input-limit';
  return { kind: kind, code: code };
}

function normalizeImageResult(value, baseUrl) {
  var current = value;
  for (var depth = 0; depth < 7 && current != null; depth += 1) {
    if (current && typeof current === 'object' && typeof current.url === 'string') break;
    if (!current || typeof current !== 'object') return { referenceUrl: null, previewUrl: null, width: 0, height: 0 };
    current = current.value != null ? current.value : current.result != null ? current.result : current.output != null ? current.output : current.data;
  }
  if (!current || typeof current.url !== 'string') return { referenceUrl: null, previewUrl: null, width: 0, height: 0 };
  var referenceUrl = null;
  var previewUrl = null;
  try {
    var base = new URL(baseUrl);
    var resolved = new URL(current.url, base);
    if (resolved.protocol === 'https:' && resolved.origin === base.origin && isCachePath(resolved.pathname) && /\.png$/i.test(resolved.pathname)) {
      referenceUrl = resolved.pathname;
      previewUrl = resolved.href;
    }
  } catch (_) {}
  return {
    referenceUrl: referenceUrl,
    previewUrl: previewUrl,
    width: Number.isFinite(Number(current.width)) ? Number(current.width) : 0,
    height: Number.isFinite(Number(current.height)) ? Number(current.height) : 0,
  };
}

module.exports = {
  MAX_REFERENCE_BYTES: MAX_REFERENCE_BYTES,
  MAX_USER_PROMPT_LENGTH: MAX_USER_PROMPT_LENGTH,
  buildPrompt: buildPrompt,
  classifyError: classifyError,
  codedError: codedError,
  isCachePath: isCachePath,
  normalizeImageResult: normalizeImageResult,
  normalizePersona: normalizePersona,
  validateLocalImageDataUrl: validateLocalImageDataUrl,
};
