// One semantic colour for organism names in prose, controls, SVG labels and tooltips.
// DOM text is wrapped without changing markup, attributes, handlers or text content.
(() => {
  'use strict';
  const names = new Set([
    'Citrobacter freundii', 'Enterococcus faecalis', 'Escherichia coli',
    'Klebsiella oxytoca', 'Klebsiella pneumoniae', 'Proteus mirabilis',
    'Pseudomonas aeruginosa', 'Staphylococcus aureus', 'Staphylococcus saprophyticus',
  ]);
  const skip = 'script,style,textarea,input,select,option,code,pre,title,desc,[contenteditable],.organism-entity,[data-organism-ignore]';
  const svgNS = 'http://www.w3.org/2000/svg';
  let pattern;
  const escape = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  function compile() {
    const variants = [];
    for (const name of names) {
      const parts = name.trim().split(/\s+/);
      variants.push(parts.map(escape).join('\\s+'));
      if (parts.length > 1) {
        variants.push(escape(parts[0][0]) + '\\.\\s*' + parts.slice(1).map(escape).join('\\s+'));
        variants.push(escape(parts[0][0]) + '\\s+' + parts.slice(1).map(escape).join('\\s+'));
      }
    }
    pattern = new RegExp('\\b(?:' + variants.sort((a, b) => b.length - a.length).join('|') + ')(?![a-z])', 'gi');
  }
  compile();
  function paint(root) {
    if (!root) return root;
    const nodes = [];
    if (root.nodeType === Node.TEXT_NODE) nodes.push(root);
    else {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) nodes.push(walker.currentNode);
    }
    for (const node of nodes) {
      const parent = node.parentElement;
      if (!parent || parent.closest(skip) || !node.nodeValue?.trim()) continue;
      // SVG text may use tspans; non-text SVG nodes are never changed.
      const isSvg = parent.namespaceURI === svgNS;
      if (isSvg && !parent.closest('text')) continue;
      pattern.lastIndex = 0;
      const matches = Array.from(node.nodeValue.matchAll(pattern));
      if (!matches.length) continue;
      const fragment = document.createDocumentFragment();
      let at = 0;
      for (const match of matches) {
        fragment.append(document.createTextNode(node.nodeValue.slice(at, match.index)));
        const entity = isSvg ? document.createElementNS(svgNS, 'tspan') : document.createElement('span');
        entity.setAttribute('class', 'organism-entity');
        entity.textContent = match[0];
        fragment.append(entity);
        at = match.index + match[0].length;
      }
      fragment.append(document.createTextNode(node.nodeValue.slice(at)));
      node.replaceWith(fragment);
    }
    return root;
  }
  // Input must already be escaped or trusted markup, exactly as for innerHTML.
  // Used before animated text is split into individual word spans.
  function html(markup) {
    const box = document.createElement('div');
    box.innerHTML = markup;
    paint(box);
    return box.innerHTML;
  }
  const pending = new Set();
  let frame = 0, observer;
  const options = {childList: true, characterData: true, subtree: true};
  function flush() {
    frame = 0;
    observer.disconnect();
    const roots = new Set(Array.from(pending).filter(root => root.isConnected));
    pending.clear();
    for (const root of roots) {
      let ancestor = root.parentNode;
      while (ancestor && !roots.has(ancestor)) ancestor = ancestor.parentNode;
      if (!ancestor) paint(root);
    }
    observer.observe(document.body, options);
  }
  function start() {
    paint(document.body);
    observer = new MutationObserver(changes => {
      for (const change of changes) {
        if (change.type === 'characterData') pending.add(change.target);
        else for (const node of change.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE || node.nodeType === Node.TEXT_NODE) pending.add(node);
        }
      }
      if (pending.size && !frame) frame = requestAnimationFrame(flush);
    });
    observer.observe(document.body, options);
  }
  window.OrganismText = {
    paint, html,
    add(extra) { for (const name of extra || []) if (typeof name === 'string' && name.trim()) names.add(name.trim()); compile(); if (document.body) paint(document.body); },
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once: true});
  else start();
})();
