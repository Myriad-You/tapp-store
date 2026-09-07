'use strict';

var domain = require('./domain.js');

function text(value) {
  return { type: 'text', value: value };
}

function parseInline(source) {
  source = String(source || '');
  var children = [];
  var token = /!\[([^\]]*)\]\(([^)\s]+)\)|\[([^\]]+)\]\(([^)\s]+)\)|`([^`]+)`|\*\*([^*]+)\*\*|\*([^*]+)\*/g;
  var cursor = 0;
  var match;
  while ((match = token.exec(source))) {
    if (match.index > cursor) children.push(text(source.slice(cursor, match.index)));
    if (match[1] !== undefined) {
      var media = domain.validateMediaUrl(match[2]);
      if (media.ok) {
        children.push({ type: 'media', kind: media.kind, alt: match[1], url: media.url });
      } else {
        children.push(text((match[1] || 'media') + ' (' + match[2] + ')'));
      }
    } else if (match[3] !== undefined) {
      var url = domain.sanitizeExternalUrl(match[4]);
      if (url) children.push({ type: 'external-link', label: match[3], url: url });
      else children.push(text(match[3] + ' (' + match[4] + ')'));
    } else if (match[5] !== undefined) {
      children.push({ type: 'inline-code', value: match[5] });
    } else if (match[6] !== undefined) {
      children.push({ type: 'strong', children: [text(match[6])] });
    } else if (match[7] !== undefined) {
      children.push({ type: 'emphasis', children: [text(match[7])] });
    }
    cursor = token.lastIndex;
  }
  if (cursor < source.length) children.push(text(source.slice(cursor)));
  if (!children.length && source) children.push(text(source));
  return children;
}

function parseMarkdown(markdown) {
  var lines = String(markdown == null ? '' : markdown).replace(/\r\n?/g, '\n').split('\n');
  var root = { type: 'document', children: [] };
  var index = 0;
  while (index < lines.length) {
    var line = lines[index];
    if (!line.trim()) { index += 1; continue; }

    var fence = line.match(/^```([^\s`]*)\s*$/);
    if (fence) {
      var code = [];
      index += 1;
      while (index < lines.length && !/^```\s*$/.test(lines[index])) {
        code.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) index += 1;
      root.children.push({ type: 'code', language: fence[1] || '', value: code.join('\n') });
      continue;
    }

    var heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      root.children.push({ type: 'heading', depth: heading[1].length, children: parseInline(heading[2]) });
      index += 1;
      continue;
    }

    if (/^\s*[-*+]\s+/.test(line)) {
      var list = { type: 'list', ordered: false, children: [] };
      while (index < lines.length && /^\s*[-*+]\s+/.test(lines[index])) {
        list.children.push({ type: 'list-item', children: parseInline(lines[index].replace(/^\s*[-*+]\s+/, '')) });
        index += 1;
      }
      root.children.push(list);
      continue;
    }

    if (/^\s*\d+[.)]\s+/.test(line)) {
      var ordered = { type: 'list', ordered: true, children: [] };
      while (index < lines.length && /^\s*\d+[.)]\s+/.test(lines[index])) {
        ordered.children.push({ type: 'list-item', children: parseInline(lines[index].replace(/^\s*\d+[.)]\s+/, '')) });
        index += 1;
      }
      root.children.push(ordered);
      continue;
    }

    if (/^>\s?/.test(line)) {
      var quote = [];
      while (index < lines.length && /^>\s?/.test(lines[index])) {
        quote.push(lines[index].replace(/^>\s?/, ''));
        index += 1;
      }
      root.children.push({ type: 'blockquote', children: parseInline(quote.join('\n')) });
      continue;
    }

    if (/^---+$/.test(line.trim())) {
      root.children.push({ type: 'thematic-break' });
      index += 1;
      continue;
    }

    var paragraph = [line];
    index += 1;
    while (index < lines.length && lines[index].trim() &&
      !/^(?:#{1,6}\s|```|>\s?|\s*[-*+]\s+|\s*\d+[.)]\s+)/.test(lines[index])) {
      paragraph.push(lines[index]);
      index += 1;
    }
    root.children.push({ type: 'paragraph', children: parseInline(paragraph.join('\n')) });
  }
  return root;
}

module.exports = { parseInline, parseMarkdown };
