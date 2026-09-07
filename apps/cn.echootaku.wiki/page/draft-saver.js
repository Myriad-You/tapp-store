'use strict';

class DraftSaver {
  constructor(options) {
    options = options || {};
    if (typeof options.save !== 'function') throw new Error('DraftSaver requires a save function');
    this.save = options.save;
    this.onStatus = typeof options.onStatus === 'function' ? options.onStatus : function () {};
    this.revision = 0;
    this.savedRevision = 0;
    this.tail = Promise.resolve();
  }

  markDirty() {
    this.revision += 1;
    return this.revision;
  }

  hasPending() {
    return this.revision > this.savedRevision;
  }

  flush(snapshot) {
    if (!this.hasPending()) return Promise.resolve({ changed: false, revision: this.savedRevision });
    var revision = this.revision;
    var self = this;
    self.onStatus('saving');
    var task = self.tail.catch(function () {}).then(function () {
      return self.save(snapshot);
    });
    self.tail = task.catch(function () {});
    return task.then(function (result) {
      self.savedRevision = Math.max(self.savedRevision, revision);
      if (revision === self.revision) self.onStatus('saved');
      return { changed: !result || result.changed !== false, revision: revision };
    }, function (error) {
      if (revision === self.revision) self.onStatus('failed');
      throw error;
    });
  }
}

module.exports = { DraftSaver };
