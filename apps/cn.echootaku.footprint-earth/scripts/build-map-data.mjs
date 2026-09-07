import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const QUANTIZE_DECIMALS = 1;

const CHINA_CODE = 'CN';
const TAIWAN_SOURCE_CODE = 'TW';
const TAIWAN_ADMIN_CODE = '710000';
const TAIWAN_NAMES = Object.freeze({
  en: 'Taiwan Province, China',
  zh: '台湾省',
  ja: '台湾省'
});

function quantize(value) {
  const factor = 10 ** QUANTIZE_DECIMALS;
  return Math.round(Number(value) * factor) / factor;
}

function squaredDistance(point, start, end) {
  let x = start[0];
  let y = start[1];
  let dx = end[0] - x;
  let dy = end[1] - y;
  if (dx !== 0 || dy !== 0) {
    const ratio = ((point[0] - x) * dx + (point[1] - y) * dy) / (dx * dx + dy * dy);
    if (ratio > 1) { x = end[0]; y = end[1]; }
    else if (ratio > 0) { x += dx * ratio; y += dy * ratio; }
  }
  dx = point[0] - x;
  dy = point[1] - y;
  return dx * dx + dy * dy;
}

function simplifyLine(points, tolerance) {
  if (points.length <= 2) return points.slice();
  const squaredTolerance = tolerance * tolerance;
  const markers = new Uint8Array(points.length);
  const stack = [[0, points.length - 1]];
  markers[0] = 1;
  markers[points.length - 1] = 1;
  while (stack.length) {
    const [first, last] = stack.pop();
    let maximum = squaredTolerance;
    let selected = -1;
    for (let index = first + 1; index < last; index += 1) {
      const distance = squaredDistance(points[index], points[first], points[last]);
      if (distance > maximum) { maximum = distance; selected = index; }
    }
    if (selected >= 0) {
      markers[selected] = 1;
      stack.push([first, selected], [selected, last]);
    }
  }
  return points.filter((_point, index) => markers[index]);
}

function unwrapRing(ring) {
  const output = [];
  for (const point of ring || []) {
    if (!Array.isArray(point) || point.length < 2 || !Number.isFinite(Number(point[0])) || !Number.isFinite(Number(point[1]))) continue;
    let longitude = Number(point[0]);
    if (output.length) {
      const previous = output.at(-1)[0];
      while (longitude - previous > 180) longitude -= 360;
      while (longitude - previous < -180) longitude += 360;
    }
    output.push([longitude, Number(point[1])]);
  }
  return output;
}

function cleanRing(ring, tolerance) {
  let points = unwrapRing(ring);
  if (points.length < 4) return null;
  if (points[0][0] === points.at(-1)[0] && points[0][1] === points.at(-1)[1]) points = points.slice(0, -1);
  if (points.length < 3) return null;
  const simplified = simplifyLine([...points, points[0]], tolerance).slice(0, -1);
  const quantized = [];
  for (const point of simplified) {
    const candidate = [quantize(point[0]), quantize(point[1])];
    const previous = quantized.at(-1);
    if (!previous || previous[0] !== candidate[0] || previous[1] !== candidate[1]) quantized.push(candidate);
  }
  if (quantized.length < 3) return null;
  quantized.push(quantized[0].slice());
  return quantized;
}

function geometryPolygons(geometry, tolerance) {
  if (!geometry || !Array.isArray(geometry.coordinates)) return [];
  const sourcePolygons = geometry.type === 'Polygon'
    ? [geometry.coordinates]
    : geometry.type === 'MultiPolygon' ? geometry.coordinates : [];
  return sourcePolygons.map((polygon) => (polygon || []).map((ring) => cleanRing(ring, tolerance)).filter(Boolean)).filter((polygon) => polygon.length);
}

function names(properties, keys) {
  const output = {};
  for (const [target, source] of Object.entries(keys)) {
    const value = properties[source];
    if (typeof value === 'string' && value.trim()) output[target] = value.trim().slice(0, 120);
  }
  return output;
}

function validCountryCode(value) {
  return typeof value === 'string' && /^[A-Z]{2}$/.test(value);
}

function validRegionCode(value) {
  return typeof value === 'string' && /^[A-Z]{2}-[A-Z0-9]{1,3}$/.test(value);
}

function countryFeature(feature) {
  const properties = feature?.properties || {};
  const code = validCountryCode(properties.ISO_A2) ? properties.ISO_A2 : properties.ISO_A2_EH;
  if (!validCountryCode(code)) return null;
  const polygons = geometryPolygons(feature.geometry, 0.05);
  if (!polygons.length) return null;
  return {
    code,
    names: names(properties, { en: 'NAME_EN', zh: 'NAME_ZH', ja: 'NAME_JA' }),
    point: [quantize(properties.LABEL_X), quantize(properties.LABEL_Y)],
    polygons
  };
}

function taiwanRegionFeature(taiwan) {
  if (!taiwan) return null;
  return {
    code: TAIWAN_ADMIN_CODE,
    countryCode: CHINA_CODE,
    names: { ...TAIWAN_NAMES },
    point: taiwan.point.slice(),
    polygons: taiwan.polygons
  };
}

function regionFeature(feature, countryCodes) {
  const properties = feature?.properties || {};
  const code = properties.iso_3166_2;
  const countryCode = properties.iso_a2;
  if (!validRegionCode(code) || !validCountryCode(countryCode) || !countryCodes.has(countryCode) || !code.startsWith(`${countryCode}-`)) return null;
  const polygons = geometryPolygons(feature.geometry, 0.08);
  if (!polygons.length) return null;
  return {
    code,
    countryCode,
    names: names(properties, { en: 'name_en', zh: 'name_zh', ja: 'name_ja' }),
    point: [quantize(properties.longitude), quantize(properties.latitude)],
    polygons
  };
}

export function buildDatasets(countryGeoJson, regionGeoJson, metadata = {}) {
  const sourceCountries = (countryGeoJson?.features || []).map(countryFeature).filter(Boolean);
  const taiwan = sourceCountries.find((country) => country.code === TAIWAN_SOURCE_CODE);
  const countries = sourceCountries.filter((country) => country.code !== TAIWAN_SOURCE_CODE);
  const china = countries.find((country) => country.code === CHINA_CODE);
  if (china && taiwan) china.polygons = china.polygons.concat(taiwan.polygons);
  countries.sort((left, right) => left.code.localeCompare(right.code));
  const countryCodes = new Set(countries.map((country) => country.code));
  const regions = (regionGeoJson?.features || []).map((feature) => regionFeature(feature, countryCodes)).filter(Boolean).sort((left, right) => left.code.localeCompare(right.code));
  const taiwanRegion = china && taiwanRegionFeature(taiwan);
  if (taiwanRegion) regions.push(taiwanRegion);
  regions.sort((left, right) => left.code.localeCompare(right.code));
  return {
    world: {
      v: 1,
      source: { dataset: 'Natural Earth', revision: String(metadata.revision || ''), scale: '1:110m', publicDomain: true },
      countries,
      regions: []
    },
    admin1: {
      v: 1,
      source: { dataset: 'Natural Earth', revision: String(metadata.revision || ''), scale: '1:50m', publicDomain: true },
      countries: [],
      regions
    }
  };
}

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  const countryPath = argument('--countries');
  const regionPath = argument('--regions');
  const outputDirectory = argument('--out');
  const revision = argument('--revision');
  if (!countryPath || !regionPath || !outputDirectory || !revision) {
    throw new Error('Usage: build-map-data.mjs --countries <file> --regions <file> --out <directory> --revision <sha>');
  }
  const [countryGeoJson, regionGeoJson] = await Promise.all([
    readFile(resolve(countryPath), 'utf8').then(JSON.parse),
    readFile(resolve(regionPath), 'utf8').then(JSON.parse)
  ]);
  const built = buildDatasets(countryGeoJson, regionGeoJson, { revision });
  await mkdir(resolve(outputDirectory), { recursive: true });
  await Promise.all([
    writeFile(resolve(outputDirectory, 'world-110m.json'), `${JSON.stringify(built.world)}\n`),
    writeFile(resolve(outputDirectory, 'admin1-50m.json'), `${JSON.stringify(built.admin1)}\n`)
  ]);
  console.log(JSON.stringify({
    revision,
    countries: built.world.countries.length,
    regions: built.admin1.regions.length
  }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
