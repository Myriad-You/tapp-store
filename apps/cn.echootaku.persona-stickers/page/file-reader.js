'use strict';

var domain = require('./domain.js');
var ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

function readFileAsDataUrl(file, Reader) {
  if (!file || ALLOWED_TYPES.indexOf(String(file.type || '').toLowerCase()) < 0) {
    return Promise.reject(domain.codedError('INVALID_AI_IMAGE_REFERENCE', 'Only PNG, JPEG and WebP files are supported', 'type'));
  }
  var FileReaderClass = Reader || (typeof FileReader !== 'undefined' ? FileReader : null);
  if (!FileReaderClass) return Promise.reject(domain.codedError('FILE_API_UNAVAILABLE', 'FileReader is unavailable'));
  return new Promise(function (resolve, reject) {
    var reader = new FileReaderClass();
    reader.onload = function () {
      if (typeof reader.result !== 'string') {
        reject(domain.codedError('INVALID_AI_IMAGE_REFERENCE', 'FileReader returned an invalid result', 'format'));
        return;
      }
      resolve(reader.result);
    };
    reader.onerror = function () { reject(domain.codedError('FILE_READ_FAILED', 'The image could not be read')); };
    reader.onabort = function () { reject(domain.codedError('FILE_READ_CANCELLED', 'The image read was cancelled')); };
    reader.readAsDataURL(file);
  });
}

module.exports = { ALLOWED_TYPES: ALLOWED_TYPES, readFileAsDataUrl: readFileAsDataUrl };
