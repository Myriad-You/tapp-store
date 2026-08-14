import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

describe('three-lab scene contract', () => {
  it('loads packaged assets without fetch or a CDN', async () => {
    const source = await readFile(join(root, 'src/scene.js'), 'utf8')
    assert.match(source, /Tapp\.assets\.getUrlMap/)
    assert.match(source, /Tapp\.assets\.rewriteUrl/)
    assert.match(source, /setURLModifier/)
    assert.match(source, /onPause/)
    assert.match(source, /onDestroy/)
    assert.match(source, /revokeAll/)
    assert.doesNotMatch(source, /unpkg|jsdelivr|cdnjs|esm\.sh/)
    assert.doesNotMatch(source, /https:\/\//)
  })

  it('ships a bundled IIFE page module', async () => {
    const bundle = await readFile(join(root, 'page/scene.js'), 'utf8')
    assert.ok(bundle.length > 10_000)
    assert.doesNotMatch(bundle.slice(0, 80), /^\s*import\s/)
    assert.match(bundle, /WebGLRenderer/)
  })

  it('ships a GLB that GLTFLoader.parse accepts without extra fetches', async () => {
    const bytes = await readFile(join(root, 'assets/cube.glb'))
    assert.equal(bytes.subarray(0, 4).toString(), 'glTF')
    const loader = new GLTFLoader()
    const gltf = await new Promise((resolve, reject) => {
      loader.parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '', resolve, reject)
    })
    assert.ok(gltf.scene)
    assert.ok(gltf.scene.children.length > 0)
  })
})
