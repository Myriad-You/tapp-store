'use strict';

async function requestStructure(apiName, id, simplified, deps) {
  var api = deps.apis && deps.apis[apiName];
  if (typeof api !== 'function') throw new Error('API_MISSING_' + apiName);
  var response = await deps.withTimeout(api({ id: id }), deps.timeoutMs || 30000);
  var text = deps.parser.toText(response);
  var parsed = deps.parser.parseMmCif(text);
  if (!parsed.atoms || !parsed.atoms.length) throw new Error('MMCIF_NO_ATOMS');
  parsed.id = id;
  parsed.simplified = simplified === true;
  return { text: text, parsed: parsed };
}

async function load(id, deps) {
  var primaryError;
  try {
    return await requestStructure('structure', id, false, deps);
  } catch (err) {
    primaryError = err;
    if (typeof deps.onFallback === 'function') deps.onFallback(err);
  }

  try {
    return await requestStructure('structureCa', id, true, deps);
  } catch (fallbackError) {
    fallbackError.primaryError = primaryError;
    throw fallbackError;
  }
}

module.exports = {
  load: load
};
