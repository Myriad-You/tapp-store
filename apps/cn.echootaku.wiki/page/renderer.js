'use strict';

function appendInline(document, container, nodes, labels) {
  (nodes || []).forEach(function (node) {
    if (node.type === 'text') {
      container.appendChild(document.createTextNode(node.value || ''));
      return;
    }
    if (node.type === 'inline-code') {
      var inlineCode = document.createElement('code');
      inlineCode.className = 'md-inline-code';
      inlineCode.textContent = node.value || '';
      container.appendChild(inlineCode);
      return;
    }
    if (node.type === 'strong' || node.type === 'emphasis') {
      var emphasis = document.createElement(node.type === 'strong' ? 'strong' : 'em');
      appendInline(document, emphasis, node.children, labels);
      container.appendChild(emphasis);
      return;
    }
    if (node.type === 'external-link') {
      var link = document.createElement('span');
      link.className = 'md-copy-link';
      var label = document.createElement('span');
      label.className = 'md-copy-link-label';
      label.textContent = node.label || node.url;
      var url = document.createElement('code');
      url.className = 'md-copy-link-url';
      url.textContent = node.url;
      var copy = document.createElement('button');
      copy.setAttribute('type', 'button');
      copy.className = 'md-copy-link-button';
      copy.dataset.copyUrl = node.url;
      copy.textContent = labels.copyUrl || 'Copy URL';
      link.append(label, url, copy);
      container.appendChild(link);
      return;
    }
    if (node.type === 'media') container.appendChild(createMedia(document, node, labels));
  });
}

function createMedia(document, node, labels) {
  var figure = document.createElement('figure');
  figure.className = 'md-media';
  function showFallback() {
    var fallback = document.createElement('div');
    fallback.className = 'md-media-fallback';
    var title = document.createElement('strong');
    title.textContent = node.alt || labels.mediaUnavailable || 'Media unavailable';
    var hint = document.createElement('span');
    hint.textContent = labels.mediaUnavailable || 'Media unavailable. The article text is still available.';
    var url = document.createElement('code');
    url.textContent = node.url;
    var copy = document.createElement('button');
    copy.setAttribute('type', 'button');
    copy.dataset.copyUrl = node.url;
    copy.textContent = labels.copyOriginal || labels.copyUrl || 'Copy original URL';
    fallback.append(title, hint, url, copy);
    figure.replaceChildren(fallback);
  }
  var media = document.createElement(node.kind === 'video' ? 'video' : 'img');
  media.className = 'md-media-element';
  media.setAttribute('src', node.url);
  if (node.kind === 'video') {
    media.setAttribute('controls', '');
    media.setAttribute('preload', 'metadata');
  } else {
    media.setAttribute('alt', node.alt || '');
    media.setAttribute('loading', 'lazy');
    media.setAttribute('referrerpolicy', 'no-referrer');
  }
  media.addEventListener('error', showFallback);
  figure.appendChild(media);
  if (node.alt) {
    var caption = document.createElement('figcaption');
    caption.textContent = node.alt;
    figure.appendChild(caption);
  }
  return figure;
}

function renderBlock(document, node, labels) {
  var element;
  if (node.type === 'heading') {
    element = document.createElement('h' + Math.max(1, Math.min(6, Number(node.depth) || 1)));
    appendInline(document, element, node.children, labels);
    return element;
  }
  if (node.type === 'paragraph') {
    element = document.createElement('p');
    appendInline(document, element, node.children, labels);
    return element;
  }
  if (node.type === 'list') {
    element = document.createElement(node.ordered ? 'ol' : 'ul');
    (node.children || []).forEach(function (item) {
      var listItem = document.createElement('li');
      appendInline(document, listItem, item.children, labels);
      element.appendChild(listItem);
    });
    return element;
  }
  if (node.type === 'blockquote') {
    element = document.createElement('blockquote');
    appendInline(document, element, node.children, labels);
    return element;
  }
  if (node.type === 'code') {
    element = document.createElement('pre');
    var code = document.createElement('code');
    code.textContent = node.value || '';
    if (node.language) code.dataset.language = node.language;
    element.appendChild(code);
    return element;
  }
  if (node.type === 'thematic-break') return document.createElement('hr');
  element = document.createElement('p');
  appendInline(document, element, node.children || [node], labels);
  return element;
}

function renderMarkdown(document, container, tree, labels) {
  labels = labels || {};
  var fragment = document.createElement('div');
  fragment.className = 'markdown-body';
  (tree && tree.children || []).forEach(function (node) {
    fragment.appendChild(renderBlock(document, node, labels));
  });
  container.replaceChildren(fragment);
}

module.exports = { createMedia, renderMarkdown };
