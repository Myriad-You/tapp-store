const test = require('node:test');
const assert = require('node:assert/strict');

const domain = require('../page/domain.js');

function persona() {
  return {
    enabled: true,
    name: 'Arael',
    moodBand: 'calm',
    activity: 'idle',
    portraitUrl: '/api/brew/image-cache/ab/agent.png',
  };
}

test('accepts PNG JPEG and WebP signatures and rejects a mismatched payload', () => {
  const png = 'data:image/png;base64,iVBORw0KGgo=';
  const jpeg = 'data:image/jpeg;base64,/9j/4AAQSkY=';
  const webp = 'data:image/webp;base64,UklGRgAAAABXRUJQ';

  assert.equal(domain.validateLocalImageDataUrl(png).mime, 'image/png');
  assert.equal(domain.validateLocalImageDataUrl(jpeg).mime, 'image/jpeg');
  assert.equal(domain.validateLocalImageDataUrl(webp).mime, 'image/webp');
  assert.throws(
    () => domain.validateLocalImageDataUrl('data:image/png;base64,SGVsbG8='),
    (error) => error.code === 'INVALID_AI_IMAGE_REFERENCE',
  );
});

test('normalizes Persona cards and only exposes an eligible cache portrait reference', () => {
  assert.deepEqual(domain.normalizePersona(null), {
    enabled: false,
    name: 'Agent',
    moodBand: 'calm',
    activity: 'idle',
    portraitUrl: null,
    reason: 'unavailable',
  });
  assert.equal(domain.normalizePersona({ enabled: false, name: 'Arael', portraitUrl: '/api/brew/image-cache/ab/a.png' }).portraitUrl, null);
  assert.equal(domain.normalizePersona({ enabled: true, name: 'Arael', moodBand: 'excited', activity: 'talking', portraitUrl: '/api/brew/image-cache/ab/a.png' }).portraitUrl, '/api/brew/image-cache/ab/a.png');
  assert.equal(domain.normalizePersona({ enabled: true, name: 'Arael', portraitUrl: 'https://example.com/a.png' }).portraitUrl, null);
});

test('builds one PNG-style sticker without promising an alpha channel', () => {
  const prompt = domain.buildPrompt({ persona: persona(), mode: 'emoji', cue: '😭' });

  assert.match(prompt, /exactly one standalone sticker/i);
  assert.doesNotMatch(prompt, /on a transparent background/i);
  assert.match(prompt, /do not draw a transparency checkerboard pattern/i);
  assert.match(prompt, /Emoji cue: 😭/);
  assert.match(prompt, /do not draw or print the emoji glyph/i);
  assert.doesNotMatch(prompt, /panel|sheet|grid/i);
});

test('builds one sticker from a kaomoji cue without rendering the source characters', () => {
  const prompt = domain.buildPrompt({ persona: persona(), mode: 'kaomoji', cue: '(╥﹏╥)' });

  assert.match(prompt, /Kaomoji cue: \(╥﹏╥\)/);
  assert.match(prompt, /do not draw or print the kaomoji characters/i);
  assert.match(prompt, /same face, hair, outfit, colors, body proportions, and signature accessories/i);
});

test('uses a second image only as expression pose and composition guidance', () => {
  const prompt = domain.buildPrompt({ persona: persona(), mode: 'image', cue: '' });

  assert.match(prompt, /Reference image 1 is the canonical Agent appearance/i);
  assert.match(prompt, /Reference image 2 is only the expression, pose, and composition reference/i);
  assert.match(prompt, /must not replace the Agent identity/i);
});

test('makes the optional user direction the dominant creative instruction without weakening output constraints', () => {
  const direction = '双手抱头蹲下，眼泪像喷泉一样向两侧飞出，动作要非常夸张。';
  const prompt = domain.buildPrompt({ persona: persona(), mode: 'emoji', cue: '😭', userPrompt: direction });

  assert.match(prompt, /PRIMARY USER CREATIVE DIRECTION/);
  assert.match(prompt, new RegExp(direction));
  assert.ok(prompt.indexOf(direction) < prompt.indexOf('Emoji cue: 😭'));
  assert.match(prompt, /Treat this direction as the dominant creative instruction/i);
  assert.match(prompt, /exactly one standalone sticker/i);
  assert.doesNotMatch(prompt, /on a transparent background/i);
  assert.match(prompt, /do not draw a transparency checkerboard pattern/i);
  assert.match(prompt, /no text/i);
});

test('omits an empty user direction and rejects one longer than 800 characters', () => {
  const withoutDirection = domain.buildPrompt({ persona: persona(), mode: 'emoji', cue: '😭', userPrompt: '   ' });
  assert.doesNotMatch(withoutDirection, /PRIMARY USER CREATIVE DIRECTION/);
  assert.throws(
    () => domain.buildPrompt({ persona: persona(), mode: 'emoji', cue: '😭', userPrompt: '描'.repeat(801) }),
    (error) => error.code === 'USER_PROMPT_LIMIT',
  );
});

test('rejects an unknown mode and an empty text cue', () => {
  assert.throws(
    () => domain.buildPrompt({ persona: persona(), mode: 'unknown', cue: '😭' }),
    (error) => error.code === 'INVALID_EXPRESSION_MODE',
  );
  assert.throws(
    () => domain.buildPrompt({ persona: persona(), mode: 'emoji', cue: '   ' }),
    (error) => error.code === 'EXPRESSION_CUE_REQUIRED',
  );
});

test('maps provider, permission, Persona, input and cancellation failures without hiding codes', () => {
  assert.deepEqual(domain.classifyError({ code: 'AI_PROVIDER_ERROR' }), { kind: 'provider', code: 'AI_PROVIDER_ERROR' });
  assert.equal(domain.classifyError({ code: 'PERMISSION_DENIED' }).kind, 'permission');
  assert.equal(domain.classifyError({ code: 'PERSONA_REQUIRED' }).kind, 'persona');
  assert.equal(domain.classifyError({ code: 'EXPRESSION_CUE_REQUIRED' }).kind, 'input');
  assert.equal(domain.classifyError({ code: 'EXPRESSION_IMAGE_REQUIRED' }).kind, 'input');
  assert.equal(domain.classifyError({ code: 'AI_TASK_TIMEOUT' }).kind, 'timeout');
  assert.equal(domain.classifyError({ code: 'AI_TASK_CANCELLED' }).kind, 'cancelled');
  assert.equal(domain.classifyError({ code: 'INVALID_AI_IMAGE_REFERENCE' }).kind, 'reference');
  assert.equal(domain.classifyError({ code: 'AI_IMAGE_REFERENCE_LIMIT' }).kind, 'reference-limit');
  assert.equal(domain.classifyError({ code: 'USER_PROMPT_LIMIT' }).kind, 'input-limit');
});

test('accepts same-origin PNG cache results but rejects unsafe cross-origin and non-PNG URLs', () => {
  assert.deepEqual(domain.normalizeImageResult(
    { format: 'image', value: { url: '/api/brew/image-cache/ab/result.png', width: 1024, height: 1024 } },
    'https://myriad.example/tapp/run/id',
  ), {
    referenceUrl: '/api/brew/image-cache/ab/result.png',
    previewUrl: 'https://myriad.example/api/brew/image-cache/ab/result.png',
    width: 1024,
    height: 1024,
  });
  assert.equal(domain.normalizeImageResult({ value: { url: '/api/brew/image-cache/ab/result.webp' } }, 'https://myriad.example/').previewUrl, null);
  assert.equal(domain.normalizeImageResult({ value: { url: 'https://evil.example/a.png' } }, 'https://myriad.example/').previewUrl, null);
  assert.equal(domain.normalizeImageResult({ value: { url: 'javascript:alert(1)' } }, 'https://myriad.example/').previewUrl, null);
});
