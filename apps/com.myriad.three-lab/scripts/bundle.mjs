#!/usr/bin/env node
import { mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as esbuild from 'esbuild'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outfile = join(root, 'page', 'scene.js')

await mkdir(join(root, 'page'), { recursive: true })
await esbuild.build({
  absWorkingDir: root,
  entryPoints: [join(root, 'src', 'scene.js')],
  outfile,
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: ['es2020'],
  minify: true,
  legalComments: 'none',
  logLevel: 'info',
})
// Host injects THREE + GLTFLoader when manifest.runtimeModules includes "three".
// Do not bundle three itself — that is the host IIFE.
