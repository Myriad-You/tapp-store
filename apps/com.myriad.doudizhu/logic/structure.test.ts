/**
 * Structural + texture package checks for com.myriad.doudizhu.
 *
 *   cd apps/com.myriad.doudizhu && npx --yes tsx --test logic/*.test.ts
 */
/* eslint-disable test/no-import-node-test */

import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'
import { DOUDIZHU_MESSAGE_TYPE } from './protocol.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const appDir = join(__dirname, '..')
const MIN_PACKAGE_BYTES = 2_097_152

function walkFiles(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) walkFiles(p, acc)
    else acc.push(p)
  }
  return acc
}

function packageByteSize(dir: string): number {
  return walkFiles(dir).reduce((n, p) => n + statSync(p).size, 0)
}

describe('com.myriad.doudizhu package layout', () => {
  it('has manifest, main, page assets', () => {
    assert.ok(existsSync(join(appDir, 'manifest.json')))
    assert.ok(existsSync(join(appDir, 'main.js')))
    assert.ok(existsSync(join(appDir, 'page.html')))
    assert.ok(existsSync(join(appDir, 'page.css')))
  })

  it('manifest is game with federation permissions and assets list', () => {
    const manifest = JSON.parse(readFileSync(join(appDir, 'manifest.json'), 'utf8'))
    assert.equal(manifest.id, 'com.myriad.doudizhu')
    assert.equal(manifest.category, 'game')
    assert.equal(manifest.name, '斗地主')
    const perms = manifest.permissions || []
    assert.ok(perms.includes('federation:read'))
    assert.ok(perms.includes('federation:write'))
    assert.ok(perms.includes('federation:message'))
    assert.ok(perms.includes('ai:chat'))
    assert.equal(manifest.ai?.protocolVersion, 2)
    assert.ok(manifest.ai?.operations?.includes('chat'))
    assert.ok(manifest.ai?.outputFormats?.includes('json'))
    const aiSetting = (manifest.settings || []).find(
      (setting: { key: string }) => setting.key === 'aiOpponentEnabled',
    )
    assert.equal(aiSetting?.type, 'toggle')
    assert.equal(aiSetting?.defaultValue, false)
    assert.ok(Array.isArray(manifest.assets), 'manifest.assets required')
    assert.ok(manifest.assets.length >= 10, 'must declare multiple texture assets')
    assert.ok(manifest.assets.length <= 64, 'Tapp max 64 assets')
    for (const a of manifest.assets as string[]) {
      assert.ok(a.startsWith('assets/'), `asset path must be under assets/: ${a}`)
      assert.ok(existsSync(join(appDir, a)), `missing asset file ${a}`)
    }
  })

  it('package size is ≥ 2 MiB (texture product bar)', () => {
    const total = packageByteSize(appDir)
    assert.ok(
      total >= MIN_PACKAGE_BYTES,
      `package ${total} bytes < 2 MiB gate ${MIN_PACKAGE_BYTES}`,
    )
  })

  it('image textures exist and are referenced by shipped page code', () => {
    const assetsDir = join(appDir, 'assets')
    assert.ok(existsSync(assetsDir))
    const images = walkFiles(assetsDir).filter((p) =>
      /\.(png|jpe?g|webp)$/i.test(p),
    )
    assert.ok(images.length >= 15, `expected many textures, got ${images.length}`)

    const css = readFileSync(join(appDir, 'page.css'), 'utf8')
    const html = readFileSync(join(appDir, 'page.html'), 'utf8')
    const main = readFileSync(join(appDir, 'main.js'), 'utf8')
    const shipped = css + '\n' + html + '\n' + main

    // Critical commercial layers must be referenced by path basename or full path
    const requiredBasenames = [
      'table_felt',
      'card_back',
      'card_face',
      'btn_play',
      'btn_hint',
      'badge_landlord',
      'seat_frame',
      'bottom_tray',
      'scene_bg',
    ]
    for (const base of requiredBasenames) {
      assert.ok(
        shipped.includes(base) || shipped.includes(`assets/`) && images.some((p) => p.includes(base)),
        `missing reference for texture ${base}`,
      )
      assert.ok(
        main.includes(base) || css.includes(base) || html.includes(base),
        `shipped code must mention texture key/path ${base}`,
      )
    }

    // CSS must expose texture CSS variables / load path
    assert.ok(css.includes('--ddz-tex-felt') || css.includes('--ddz-tex-card'))
    assert.ok(main.includes('loadTextures') || main.includes('Tapp.assets') || main.includes('TEXTURE_MAP'))
    assert.ok(main.includes('TEXTURE_MAP') || main.includes('assets/felt/table_felt'))

    // Every PNG under assets should either be in TEXTURE_MAP / catalog or path string in main/css
    let referenced = 0
    for (const img of images) {
      const rel = relative(appDir, img).replace(/\\/g, '/')
      const base = rel.split('/').pop()!.replace(/\.[^.]+$/, '')
      if (shipped.includes(rel) || shipped.includes(base) || shipped.includes(`'${rel}'`) || shipped.includes(`"${rel}"`)) {
        referenced += 1
      }
    }
    // Allow a few catalog-only / sm variants if parent referenced — still require majority
    assert.ok(
      referenced >= Math.floor(images.length * 0.7),
      `only ${referenced}/${images.length} image assets referenced by page code (orphan padding forbidden)`,
    )
  })

  it('UI has create-room / invite / ready / play / pass / 提示', () => {
    const html = readFileSync(join(appDir, 'page.html'), 'utf8')
    assert.ok(html.includes('创建房间'))
    assert.ok(html.includes('邀请好友'))
    assert.ok(html.includes('准备'))
    assert.ok(html.includes('出牌'))
    assert.ok(html.includes('过牌'))
    assert.ok(html.includes('id="ddz-hint"'))
    assert.ok(html.includes('提示'))
  })

  it('product table has zones, 报牌, per-seat actions, end controls', () => {
    const html = readFileSync(join(appDir, 'page.html'), 'utf8')
    assert.ok(html.includes('id="ddz-hand"'))
    assert.ok(html.includes('data-view="left"'))
    assert.ok(html.includes('data-view="right"'))
    assert.ok(html.includes('id="ddz-bottom"'))
    assert.ok(html.includes('id="ddz-last"'))
    assert.ok(html.includes('id="ddz-phase"'))
    assert.ok(html.includes('id="ddz-turn-hint"'))
    assert.ok(html.includes('id="ddz-auction-btns"'))
    assert.ok(html.includes('id="ddz-play-btns"'))
    assert.ok(html.includes('id="ddz-end-btns"'))
    assert.ok(html.includes('id="ddz-again"'))
    assert.ok(html.includes('id="ddz-to-lobby"'))
    assert.ok(html.includes('id="ddz-alarm-left"'))
    assert.ok(html.includes('id="ddz-alarm-me"'))
    assert.ok(html.includes('id="ddz-action-left"'))
    assert.ok(html.includes('报牌'))
    assert.ok(html.includes('ddz-bg-felt') || html.includes('ddz-bg-scene'))
  })

  it('page.css uses product theme tokens and light/dark', () => {
    const css = readFileSync(join(appDir, 'page.css'), 'utf8')
    assert.ok(css.includes('--tapp-primary') || css.includes('--tapp-primary-rgb'))
    assert.ok(css.includes('.dark'))
    assert.ok(css.includes('--ddz-tex-felt') || css.includes('var(--ddz-tex'))
    assert.ok(css.includes('.ddz-card.selected') || css.includes('selected'))
    assert.ok(css.includes(':hover') || css.includes(':focus-visible'))
  })

  it('main.js wires federation + hint + textures', () => {
    const main = readFileSync(join(appDir, 'main.js'), 'utf8')
    assert.ok(main.includes('createRoom'))
    assert.ok(main.includes('inviteMember'))
    assert.ok(main.includes('subscribeRoom'))
    assert.ok(main.includes(DOUDIZHU_MESSAGE_TYPE) || main.includes("'doudizhu'"))
    assert.ok(main.includes('hostHandleIntent') || main.includes('hostEmit'))
    assert.ok(main.includes('enumerateLegalPlays') || main.includes('nextHintPlay'))
    assert.ok(main.includes('doHint'))
    assert.ok(main.includes('seatActions'))
    assert.ok(main.includes('loadTextures') || main.includes('TEXTURE_MAP'))
    assert.ok(main.includes('TURN_SECONDS = 30'), 'runtime must keep 30s turn clock')
    assert.ok(main.includes('four_two_singles'), 'runtime must support 四带二')
    assert.ok(main.includes('four_two_pairs'), 'runtime must support 四带两对')
    assert.ok(main.includes('botHandStrength'), 'solo bot must bid from hand strength, not random-only')
    assert.ok(main.includes('botPickBestLead'), 'solo bot must choose structured lead plays')
    assert.ok(main.includes('botPickBestResponse'), 'solo bot must choose contextual responses')
    assert.ok(main.includes('botIsTeammate'), 'solo farmers must avoid blindly beating teammate plays')
    assert.ok(main.includes('loadAiSettings'), 'runtime must read admin AI toggle from Tapp settings')
    assert.ok(main.includes('Tapp.ai.tasks.create'), 'runtime must call Myriad AI task API when enabled')
    assert.ok(main.includes('requestAiDecision'), 'AI choice must be isolated behind legal-action candidates')
    assert.ok(main.includes('botPickPlayWithAi'), 'solo bot must keep a local fallback around AI play choice')
    assert.ok(main.includes('bottomKnown'), 'AI prompt must distinguish known and unknown bottom cards')
    assert.ok(main.includes('bottom: bottomKnown ? state.bottom.map(cardSummary) : []'), 'AI auction prompt must not leak bottom cards')
    assert.ok(main.includes('farmerPartnerSeat'), 'farmer AI must identify its actual partner seat')
    assert.ok(main.includes('cancelAiTask'), 'timed-out AI tasks must be cancellable when API supports it')
    assert.ok(main.includes('calculateSettlement'), 'runtime must calculate end-of-round settlement')
    assert.ok(main.includes('sessionScores'), 'runtime must keep visible cumulative session scores')
    assert.ok(main.includes('multiplier'), 'runtime must track bomb/rocket multiplier')
    assert.ok(main.includes('sanitizePrivateHands'), 'runtime must not retain opponent hands on non-host clients')
    assert.ok(main.includes('assets/felt/table_felt.png'))
    assert.ok(main.includes('assets/cards/card_back.png'))
    assert.ok(main.includes('document.documentElement'), 'texture vars on documentElement')
    assert.ok(main.includes('textureApplyTargets'), 'multi-target texture apply')
    assert.ok(main.includes('TEXTURE_CSS_VARS'), 'full key→CSS var map')
  })

  it('store index.json lists this app', () => {
    const indexPath = join(appDir, '../../index.json')
    const index = JSON.parse(readFileSync(indexPath, 'utf8'))
    const app = (index.apps || []).find((a: { id: string }) => a.id === 'com.myriad.doudizhu')
    assert.ok(app)
    assert.ok(app.download?.code?.includes('com.myriad.doudizhu'))
  })

  it('logic modules exist with hint helpers', () => {
    assert.ok(existsSync(join(__dirname, 'rules.ts')))
    assert.ok(existsSync(join(__dirname, 'protocol.ts')))
    const rules = readFileSync(join(__dirname, 'rules.ts'), 'utf8')
    assert.ok(rules.includes('export function deal'))
    assert.ok(rules.includes('export function enumerateLegalPlays'))
    assert.ok(rules.includes('export function nextHintPlay'))
  })
})
