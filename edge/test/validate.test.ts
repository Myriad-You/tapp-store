import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  isValidAppId,
  parseAppIdList,
  parseBool,
  parsePositiveInt,
  validateHitBody,
} from '../src/validate.ts'

describe('isValidAppId', () => {
  it('accepts reverse-domain ids', () => {
    assert.equal(isValidAppId('com.myriad.music-player'), true)
    assert.equal(isValidAppId('cn.wyyzxzyg.minecraft-hub'), true)
  })

  it('rejects junk', () => {
    assert.equal(isValidAppId(''), false)
    assert.equal(isValidAppId('NoDots'), false)
    assert.equal(isValidAppId('.leading'), false)
    assert.equal(isValidAppId('a'), false)
  })
})

describe('validateHitBody', () => {
  it('accepts a minimal install hit', () => {
    const r = validateHitBody({
      app_id: 'com.myriad.music-player',
      event: 'install',
      idempotency_key: 'abc12345-uuid',
    })
    assert.equal(r.ok, true)
    if (r.ok) {
      assert.equal(r.body.app_id, 'com.myriad.music-player')
      assert.equal(r.body.event, 'install')
    }
  })

  it('rejects bad event and short idempotency', () => {
    const badEvent = validateHitBody({
      app_id: 'com.myriad.music-player',
      event: 'download',
      idempotency_key: 'longenough',
    })
    assert.equal(badEvent.ok, false)

    const shortKey = validateHitBody({
      app_id: 'com.myriad.music-player',
      event: 'install',
      idempotency_key: 'short',
    })
    assert.equal(shortKey.ok, false)
  })
})

describe('parseAppIdList', () => {
  it('parses apps= batch and enforces max', () => {
    const ok = parseAppIdList(
      new URLSearchParams('apps=com.a.b,com.c.d'),
      100,
    )
    assert.equal(ok.ok, true)
    if (ok.ok) assert.deepEqual(ok.ids, ['com.a.b', 'com.c.d'])

    const tooMany = parseAppIdList(
      new URLSearchParams('apps=com.a.b,com.c.d,com.e.f'),
      2,
    )
    assert.equal(tooMany.ok, false)
    if (!tooMany.ok) assert.equal(tooMany.code, 'batch_too_large')
  })

  it('requires at least one id', () => {
    const r = parseAppIdList(new URLSearchParams(''), 100)
    assert.equal(r.ok, false)
  })
})

describe('parse helpers', () => {
  it('parseBool / parsePositiveInt', () => {
    assert.equal(parseBool('true', false), true)
    assert.equal(parseBool('no', true), false)
    assert.equal(parsePositiveInt('60', 10), 60)
    assert.equal(parsePositiveInt('999', 10, 100), 100)
    assert.equal(parsePositiveInt('x', 7), 7)
  })
})
