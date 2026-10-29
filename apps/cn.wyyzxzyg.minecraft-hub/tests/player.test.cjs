const test = require('node:test');
const assert = require('node:assert/strict');

const player = require('../page/player.js');
const ID = '069a79f444e94726a5befca90e38aaf5';
const skin = 'https://textures.minecraft.net/texture/' + 'a'.repeat(64);

test('Java name and UUID both resolve to a normalized profile', async () => {
  const calls = [];
  const encoded = Buffer.from(JSON.stringify({ textures: { SKIN: { url: skin, metadata: { model: 'slim' } } } })).toString('base64');
  global.Tapp = { api: async (name, params) => {
    calls.push([name, params]);
    if (name === 'javaPlayerByName') return { data: { id: ID, name: 'Notch' }, success: true };
    return { data: { id: ID, name: 'Notch', properties: [{ name: 'textures', value: encoded }] }, success: true };
  } };
  const byName = await player.javaProvider('Notch');
  assert.equal(byName.playerId, '069a79f4-44e9-4726-a5be-fca90e38aaf5');
  assert.equal(byName.model, 'slim');
  assert.equal(byName.skin, skin);
  assert.deepEqual(calls.map(([name]) => name), ['javaPlayerByName', 'javaPlayerProfile']);
  calls.length = 0;
  const byUuid = await player.javaProvider(ID);
  assert.equal(byUuid.username, 'Notch');
  assert.deepEqual(calls.map(([name]) => name), ['javaPlayerProfile']);
});

test('Bedrock queries use identity endpoints and reject unsupported data', async () => {
  const calls = [];
  global.Tapp = { api: async (name, params) => {
    calls.push([name, params]);
    if (name === 'bedrockXuid') return { xuid: '2535432196048835' };
    if (name === 'bedrockSkin') return { texture_id: 'a'.repeat(64) };
    return { gamertag: 'Example Player' };
  } };
  const byTag = await player.bedrockProvider('Example Player');
  assert.equal(byTag.playerId, '2535432196048835');
  assert.equal(byTag.skin, 'https://api.geysermc.org/render/raw/' + 'a'.repeat(64));
  assert.equal(calls[0][1].gamertag, 'Example%20Player');
  const byId = await player.bedrockProvider('2535432196048835');
  assert.equal(byId.username, 'Example Player');
  assert.equal(calls[2][0], 'bedrockGamertag');
  await assert.rejects(player.neteaseProvider('123456'), { code: 'unsupported' });
});

test('Bedrock identity remains available when no cached skin exists', async () => {
  global.Tapp = { api: async (name) => {
    if (name === 'bedrockSkin') throw new Error('404');
    return { gamertag: 'Example Player' };
  } };
  const profile = await player.bedrockProvider('2535432196048835');
  assert.equal(profile.skin, null);
  assert.equal(profile.playerId, '2535432196048835');
});

test('rejects invalid names and untrusted texture hosts', async () => {
  assert.equal(player.textureUrl('https://evil.example/texture/' + 'a'.repeat(64)), null);
  await assert.rejects(player.javaProvider('invalid name'), { code: 'invalid' });
});

test('does not load remote textures when the TApp image policy excludes them', () => {
  global.document = { querySelector: () => ({ content: 'default-src none; img-src data: blob: https://myriad.wyyzxzyg.cn; connect-src blob: data:' }) };
  assert.equal(player.externalImagesAllowed(), false);
  global.document = { querySelector: () => ({ content: 'img-src data: blob: https:' }) };
  assert.equal(player.externalImagesAllowed(), true);
  global.document = { querySelector: () => ({ content: 'img-src data: blob: https://textures.minecraft.net' }) };
  assert.equal(player.externalImagesAllowed('https://api.geysermc.org/render/raw/' + 'a'.repeat(64)), false);
  global.document = { querySelector: () => ({ content: 'img-src data: blob: https://api.geysermc.org' }) };
  assert.equal(player.externalImagesAllowed('https://api.geysermc.org/render/raw/' + 'a'.repeat(64)), true);
  global.document = { querySelector: () => null };
  global.Tapp = { lifecycle: { getInfo: () => ({ permissions: ['network:fetch'] }) } };
  assert.equal(player.externalImagesAllowed(), false);
  global.Tapp.lifecycle.getInfo = () => ({ permissions: ['network:fetch', 'media:remote'] });
  assert.equal(player.externalImagesAllowed(), true);
  delete global.document;
});

test('converts only Floodgate UUIDs to Bedrock XUIDs', async () => {
  const floodgate = '00000000-0000-0000-0009-0212efab1234';
  const expected = BigInt('0x00090212efab1234').toString();
  assert.equal(player.floodgateXuid(floodgate), expected);
  assert.equal(player.floodgateXuid('da9c273c-8e43-464d-b1d0-4b44828f0b64'), null);
  const calls = [];
  global.Tapp = { api: async (name, params) => { calls.push([name, params]); return name === 'bedrockSkin' ? {} : { gamertag: 'FloodgatePlayer' }; } };
  const profile = await player.bedrockProvider(floodgate);
  assert.equal(profile.playerId, expected);
  assert.equal(calls[0][1].xuid, expected);
  await assert.rejects(player.bedrockProvider('da9c273c-8e43-464d-b1d0-4b44828f0b64'), { code: 'uuid-not-xuid' });
  await assert.rejects(player.bedrockProvider('GamertagLongerThan16'), { code: 'invalid-gamertag' });
  assert.equal(calls.length, 2);
});
