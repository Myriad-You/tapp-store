/**
 * Page layer shared scope.
 *
 * The page used to ship as one concatenated script, so every file read its
 * siblings' top-level names directly. The host now runs each file in its own
 * module factory, so those names are republished here on the sandbox global and
 * the ~300 existing call sites keep resolving them by bare identifier.
 *
 * Load order still comes from `page/index.js`, which requires the modules in
 * dependency order before running anything.
 */

/** Publish bindings that are never reassigned — functions and constants. */
function value(bindings) {
  Object.keys(bindings).forEach(function (name) {
    window[name] = bindings[name];
  });
}

/**
 * Publish bindings that get reassigned (locale table, cached popover element,
 * in-flight counters). A plain copy would freeze other modules on the value the
 * binding happened to hold at load; an accessor pair keeps reads and writes
 * pointed at the owning module's variable.
 */
function live(accessors) {
  Object.keys(accessors).forEach(function (name) {
    var pair = accessors[name];
    Object.defineProperty(window, name, {
      configurable: true,
      enumerable: true,
      get: pair[0],
      set: pair[1],
    });
  });
}

module.exports = { value: value, live: live };
