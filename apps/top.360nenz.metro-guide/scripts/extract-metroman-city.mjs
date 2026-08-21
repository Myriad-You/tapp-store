#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = process.argv[2];
if (!source) throw new Error('用法：node scripts/extract-metroman-city.mjs <CSV 解压目录>');

function rows(name) {
  return readFileSync(resolve(source, name), 'utf8').trim().split(/\r?\n/).map((line) => line.split(','));
}

const lineRows = rows('lines.csv');
const stationRows = rows('stations.csv');
const stopRows = rows('stops.csv');
const patternRows = rows('patterns.csv');
const stationNames = stationRows.map((row) => row[1]);

function normalizeSequence(raw) {
  let sequence = raw.split('|').map(Number);
  const half = sequence.length / 2;
  if (Number.isInteger(half) && sequence.slice(0, half).every((value, index) => value === sequence[index + half])) {
    sequence = sequence.slice(0, half);
  }
  return sequence;
}

function canonical(sequence) {
  const forward = sequence.join('|');
  const reverse = sequence.slice().reverse().join('|');
  return forward < reverse ? forward : reverse;
}

const lines = [];
lineRows.forEach((row, lineIndex) => {
  const seen = new Set();
  patternRows.filter((pattern) => Number(pattern[1]) === lineIndex).forEach((pattern) => {
    const stopIndexes = normalizeSequence(pattern[9]);
    const stationIndexes = stopIndexes.map((index) => Number(stopRows[index] && stopRows[index][1])).filter(Number.isInteger);
    const key = canonical(stationIndexes);
    if (seen.has(key)) return;
    seen.add(key);
    const loop = stationIndexes.length > 2 && pattern[4].toLowerCase().includes('loop');
    lines.push({
      id: row[2],
      color: '#' + row[7],
      loop,
      stations: stationIndexes.map((index) => stationNames[index]).filter(Boolean),
    });
  });
});

const output = { name: '上海', source: 'MetroMan APK CSV', version: '20260806', lines };
writeFileSync(resolve(root, 'assets/shanghai.json'), JSON.stringify(output));
console.log('已生成上海线路数据：' + lines.length + ' 条线路路径，' + stationNames.length + ' 个站点');
