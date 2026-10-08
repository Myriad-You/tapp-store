const test = require('node:test');
const assert = require('node:assert/strict');

const { readFileAsDataUrl } = require('../page/file-reader.js');

test('reads local references with FileReader.readAsDataURL', async () => {
  const calls = [];
  class FakeFileReader {
    readAsDataURL(file) {
      calls.push(file);
      this.result = 'data:image/png;base64,iVBORw0KGgo=';
      this.onload();
    }
  }
  const file = { name: 'persona.png', type: 'image/png', size: 8 };

  const result = await readFileAsDataUrl(file, FakeFileReader);

  assert.equal(result, 'data:image/png;base64,iVBORw0KGgo=');
  assert.deepEqual(calls, [file]);
});
test('rejects unsupported MIME types before reading file contents', async () => {
  class NeverReader { readAsDataURL() { throw new Error('must not read'); } }

  await assert.rejects(
    readFileAsDataUrl({ name: 'persona.gif', type: 'image/gif', size: 10 }, NeverReader),
    (error) => error.code === 'INVALID_AI_IMAGE_REFERENCE',
  );
});
