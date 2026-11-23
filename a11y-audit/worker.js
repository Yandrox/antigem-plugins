'use strict';

// A11y Audit - auditoría offline de accesibilidad para WebViews y mini apps.
// Ningún dato sale del dispositivo.

// Algunos WebViews no exponen crypto.randomUUID y las APIs de scripting y
// mensajería lo necesitan internamente.
try {
  if (!globalThis.crypto) globalThis.crypto = {};
  if (typeof globalThis.crypto.randomUUID !== 'function') {
    globalThis.crypto.randomUUID = function randomUUID() {
      const bytes = new Uint8Array(16);
      if (typeof globalThis.crypto.getRandomValues === 'function') {
        globalThis.crypto.getRandomValues(bytes);
      } else {
        for (let index = 0; index < bytes.length; index++) {
          bytes[index] = Math.floor(Math.random() * 256);
        }
      }
      bytes[6] = (bytes[6] & 0x0f) | 0x40;
      bytes[8] = (bytes[8] & 0x3f) | 0x80;
      const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0'));
      return `${hex[0]}${hex[1]}${hex[2]}${hex[3]}-${hex[4]}${hex[5]}-` +
        `${hex[6]}${hex[7]}-${hex[8]}${hex[9]}-` +
        `${hex[10]}${hex[11]}${hex[12]}${hex[13]}${hex[14]}${hex[15]}`;
    };
  }
} catch (_) {
  // Si el entorno no permite tocar crypto, seguimos sin polyfill.
}

const CATEGORIES = ['contrast', 'tap', 'names', 'alt', 'focus', 'structure'];
const WEIGHTS = {
  contrast: 0.25,
  tap: 0.20,
  names: 0.20,
  alt: 0.10,
  focus: 0.15,
  structure: 0.10
};
const CATEGORY_LABELS = {
  contrast: {es: 'Contraste', en: 'Contrast'},
  tap: {es: 'Zonas táctiles', en: 'Tap targets'},
  names: {es: 'Nombres accesibles', en: 'Accessible names'},
  alt: {es: 'Texto alternativo', en: 'Alternative text'},
  focus: {es: 'Orden de foco', en: 'Focus order'},
  structure: {es: 'Estructura', en: 'Structure'}
};
const INTERACTIVE_ROLES = new Set([
  'button', 'link', 'checkbox', 'radio', 'tab', 'menuitem', 'switch',
  'slider', 'combobox', 'textbox', 'searchbox', 'spinbutton', 'option'
]);

function clamp(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.round(Math.min(max, Math.max(min, number)));
}

function numberInRange(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

function localText(language, es, en) {
  if (language === 'es') return es;
  if (language === 'en') return en;
  return `${es} / ${en}`;
}

function categoryLabel(category, language) {
  const label = CATEGORY_LABELS[category] || {es: category, en: category};
  return localText(language, label.es, label.en);
}

// ---------- Recolector inyectado en la WebView ----------
// Esta función se serializa con toString(); no puede usar variables externas.
function collectDom(options) {
  const maxElements = Math.max(1, Number(options.maxElements) || 2000);
  const minTapSize = Math.max(1, Number(options.minTapSize) || 44);
  const roles = new Set([
    'button', 'link', 'checkbox', 'radio', 'tab', 'menuitem', 'switch',
    'slider', 'combobox', 'textbox', 'searchbox', 'spinbutton', 'option'
  ]);

  function parseColor(value) {
    const raw = String(value || '').trim().toLowerCase();
    if (!raw || raw === 'transparent') return {r: 255, g: 255, b: 255, a: 0};
    const match = raw.match(/rgba?\(([^)]+)\)/);
    if (match) {
      const parts = match[1].split(/[,\s/]+/).filter(Boolean).map(Number);
      return {
        r: parts[0] || 0,
        g: parts[1] || 0,
        b: parts[2] || 0,
        a: parts.length > 3 && Number.isFinite(parts[3]) ? parts[3] : 1
      };
    }
    return {r: 255, g: 255, b: 255, a: 0};
  }

  function effectiveBackground(element) {
    let node = element;
    while (node && node.nodeType === 1) {
      const color = parseColor(getComputedStyle(node).backgroundColor);
      if (color.a >= 0.95) return color;
      node = node.parentElement;
    }
    return {r: 255, g: 255, b: 255, a: 1};
  }

  function escapePart(value) {
    return String(value).replace(/([^A-Za-z0-9_-])/g, '\\$1');
  }

  function selectorFor(element) {
    const parts = [];
    let node = element;
    while (node && node.nodeType === 1 && parts.length < 5) {
      let part = node.tagName.toLowerCase();
      if (node.id) {
        parts.unshift(`${part}#${escapePart(node.id)}`);
        break;
      }
      const classes = Array.from(node.classList || []).slice(0, 2)
        .map(name => `.${escapePart(name)}`);
      part += classes.join('');
      const parent = node.parentElement;
      if (parent) {
        const sameTag = Array.from(parent.children)
          .filter(child => child.tagName === node.tagName);
        if (sameTag.length > 1) {
          part += `:nth-of-type(${sameTag.indexOf(node) + 1})`;
        }
      }
      parts.unshift(part);
      node = parent;
    }
    return parts.join(' > ');
  }

  function directText(element) {
    return Array.from(element.childNodes)
      .filter(node => node.nodeType === 3)
      .map(node => node.textContent.replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .join(' ')
      .slice(0, 300);
  }

  function accessibleName(element) {
    const explicit = element.getAttribute('aria-label');
    if (explicit && explicit.trim()) return explicit.trim();
    const labelledBy = element.getAttribute('aria-labelledby');
    if (labelledBy) {
      const names = labelledBy.split(/\s+/)
        .map(id => document.getElementById(id))
        .filter(Boolean)
        .map(node => (node.textContent || '').replace(/\s+/g, ' ').trim())
        .filter(Boolean);
      if (names.length) return names.join(' ').slice(0, 200);
    }
    const labels = Array.from(element.labels || [])
      .map(label => (label.textContent || '').replace(/\s+/g, ' ').trim())
      .filter(Boolean);
    if (labels.length) return labels.join(' ').slice(0, 200);
    const tag = element.tagName.toLowerCase();
    if (tag === 'img' || (tag === 'input' && element.getAttribute('type') === 'image')) {
      const alt = element.getAttribute('alt');
      if (alt) return alt.trim();
    }
    const title = element.getAttribute('title');
    if (title && title.trim()) return title.trim();
    const placeholder = element.getAttribute('placeholder');
    if (placeholder && placeholder.trim()) return placeholder.trim();
    return directText(element).slice(0, 200);
  }

  function isInteractive(element) {
    const tag = element.tagName.toLowerCase();
    const role = (element.getAttribute('role') || '').toLowerCase();
    const tabindex = Number(element.getAttribute('tabindex'));
    return /^(a|area|button|input|select|textarea|summary)$/.test(tag) ||
      roles.has(role) || element.hasAttribute('onclick') ||
      element.isContentEditable ||
      (element.hasAttribute('tabindex') && tabindex >= 0);
  }

  function isFocusable(element) {
    const tag = element.tagName.toLowerCase();
    const type = (element.getAttribute('type') || '').toLowerCase();
    if (element.hasAttribute('disabled') || type === 'hidden' || element.hidden) return false;
    const tabindex = element.getAttribute('tabindex');
    if (tabindex !== null && Number(tabindex) >= 0) return true;
    if (tabindex !== null && Number(tabindex) < 0) return false;
    if (tag === 'a' || tag === 'area') return element.hasAttribute('href');
    return /^(button|input|select|textarea|summary)$/.test(tag);
  }

  function isVisible(element, style, rect) {
    return style.display !== 'none' && style.visibility !== 'hidden' &&
      Number(style.opacity) > 0 && rect.width > 0 && rect.height > 0;
  }

  const nodes = Array.from(document.querySelectorAll('*'));
  const elements = [];
  for (let index = 0; index < nodes.length && elements.length < maxElements; index++) {
    const element = nodes[index];
    const tag = element.tagName.toLowerCase();
    if (/^(script|style|noscript|template|meta|link|br|hr)$/.test(tag)) continue;
    const style = getComputedStyle(element);
    const box = element.getBoundingClientRect();
    const rect = {width: box.width, height: box.height, top: box.top, left: box.left};
    const visible = isVisible(element, style, rect);
    const role = (element.getAttribute('role') || '').toLowerCase();
    const item = {
      tag,
      id: element.id || '',
      classes: Array.from(element.classList || []).slice(0, 4),
      role,
      type: (element.getAttribute('type') || '').toLowerCase(),
      name: accessibleName(element),
      text: directText(element),
      alt: element.getAttribute('alt'),
      ariaLabel: element.getAttribute('aria-label'),
      ariaHidden: element.getAttribute('aria-hidden'),
      title: element.getAttribute('title'),
      placeholder: element.getAttribute('placeholder'),
      tabindex: element.getAttribute('tabindex'),
      disabled: Boolean(element.disabled) || element.hasAttribute('disabled'),
      visible,
      rect,
      color: parseColor(style.color),
      background: effectiveBackground(element),
      fontSize: parseFloat(style.fontSize) || 16,
      fontWeight: parseInt(style.fontWeight, 10) || 400,
      interactive: isInteractive(element),
      focusable: isFocusable(element),
      hasOnclick: element.hasAttribute('onclick'),
      isImage: tag === 'img' || role === 'img' ||
        (tag === 'input' && (element.getAttribute('type') || '').toLowerCase() === 'image'),
      selector: selectorFor(element)
    };
    elements.push(item);
  }

  const focusOrder = Array.from(document.querySelectorAll(
    'a[href],area[href],button,input,select,textarea,summary,[tabindex]'
  )).slice(0, maxElements).map((element, index) => {
    const style = getComputedStyle(element);
    const box = element.getBoundingClientRect();
    return {
      index,
      tag: element.tagName.toLowerCase(),
      role: (element.getAttribute('role') || '').toLowerCase(),
      tabindex: element.getAttribute('tabindex'),
      name: accessibleName(element),
      selector: selectorFor(element),
      visible: isVisible(element, style, {width: box.width, height: box.height})
    };
  });

  return {
    source: 'live',
    url: location.href,
    title: document.title || '',
    lang: document.documentElement.lang || '',
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight,
      dpr: window.devicePixelRatio || 1
    },
    elements,
    focusOrder,
    total: nodes.length,
    truncated: nodes.length > elements.length
  };
}

async function injectViaBridge(tabId, func, args) {
  const response = await chrome.tabs.sendMessage(tabId, {
    type: 'a11y.code', code: func.toString(), args
  });
  if (!response) throw new Error('El content script no respondió / Content script did not respond');
  if (!response.ok) throw new Error(response.error || 'Error en la página / Page error');
  return response.value;
}

async function injectViaDebugger(tabId, func, args) {
  const expression = `(${func.toString()})(...${JSON.stringify(args || [])})`;
  await chrome.debugger.attach({tabId}, '1.3');
  try {
    const response = await chrome.debugger.sendCommand({tabId}, 'Runtime.evaluate', {
      expression, awaitPromise: true, returnByValue: true
    });
    if (response && response.exceptionDetails) {
      throw new Error(response.exceptionDetails.text || 'CDP evaluation failed');
    }
    return response && response.result ? response.result.value : undefined;
  } finally {
    await chrome.debugger.detach({tabId});
  }
}

async function inject(tabId, func, args = []) {
  const strategies = [
    ['bridge', () => injectViaBridge(tabId, func, args)],
    ['debugger', () => injectViaDebugger(tabId, func, args)],
    ['scripting', async () => {
      const results = await chrome.scripting.executeScript({target: {tabId}, func, args});
      return results && results[0] ? results[0].result : undefined;
    }]
  ];
  let lastError = null;
  for (const [, run] of strategies) {
    try {
      return await run();
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(lastError && lastError.message ? lastError.message : String(lastError));
}

async function getActiveTab(tabId) {
  if (tabId) return await chrome.tabs.get(tabId);
  let tabs = [];
  try {
    tabs = await chrome.tabs.query({active: true, currentWindow: true});
  } catch (_) {
    tabs = await chrome.tabs.query({active: true});
  }
  return tabs && tabs[0] ? tabs[0] : null;
}

// ---------- Modo HTML en línea ----------
function parseColor(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw || raw === 'transparent') return {r: 255, g: 255, b: 255, a: 0};
  const named = {
    white: {r: 255, g: 255, b: 255, a: 1},
    black: {r: 0, g: 0, b: 0, a: 1},
    red: {r: 255, g: 0, b: 0, a: 1},
    gray: {r: 128, g: 128, b: 128, a: 1},
    grey: {r: 128, g: 128, b: 128, a: 1}
  };
  if (named[raw]) return named[raw];
  if (raw.charAt(0) === '#') {
    let hex = raw.slice(1);
    if (hex.length === 3 || hex.length === 4) {
      hex = hex.split('').map(char => char + char).join('');
    }
    if (/^[0-9a-f]{6}([0-9a-f]{2})?$/.test(hex)) {
      return {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16),
        a: hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1
      };
    }
  }
  const match = raw.match(/rgba?\(([^)]+)\)/);
  if (match) {
    const parts = match[1].split(/[,\s/]+/).filter(Boolean).map(Number);
    return {
      r: parts[0] || 0,
      g: parts[1] || 0,
      b: parts[2] || 0,
      a: parts.length > 3 && Number.isFinite(parts[3]) ? parts[3] : 1
    };
  }
  return {r: 255, g: 255, b: 255, a: 0};
}

function styleValue(style, name) {
  const match = String(style || '').match(new RegExp(`(?:^|;)\\s*${name}\\s*:\\s*([^;]+)`, 'i'));
  return match ? match[1].trim() : '';
}

function parsePx(value) {
  const match = String(value || '').match(/^(-?\d+(?:\.\d+)?)px$/i);
  return match ? Number(match[1]) : null;
}

function parseAttrs(source) {
  const attrs = {};
  const re = /([:\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))|([:\w-]+)(?=\s|$)/g;
  let match;
  while ((match = re.exec(String(source || '')))) {
    const key = (match[1] || match[5]).toLowerCase();
    attrs[key] = match[2] !== undefined ? match[2]
      : match[3] !== undefined ? match[3]
        : match[4] !== undefined ? match[4] : '';
  }
  return attrs;
}

function isInteractiveHtml(element) {
  const tag = element.tag;
  const role = element.role;
  const tabindex = Number(element.tabindex);
  return /^(a|area|button|input|select|textarea|summary)$/.test(tag) ||
    INTERACTIVE_ROLES.has(role) || Object.prototype.hasOwnProperty.call(element.attrs, 'onclick') ||
    (element.attrs.tabindex !== undefined && tabindex >= 0);
}

function isFocusableHtml(element) {
  const tag = element.tag;
  const attrs = element.attrs;
  if (attrs.disabled !== undefined || (attrs.type || '').toLowerCase() === 'hidden') return false;
  if (attrs.tabindex !== undefined) {
    const value = Number(attrs.tabindex);
    return Number.isFinite(value) && value >= 0;
  }
  if (tag === 'a' || tag === 'area') return attrs.href !== undefined;
  return /^(button|input|select|textarea|summary)$/.test(tag);
}

function nameFromHtml(attrs, text) {
  return (attrs['aria-label'] || attrs.alt || attrs.title || attrs.placeholder || text || '').trim().slice(0, 200);
}

function scanHtml(html, options) {
  const source = String(html || '');
  const tagRe = /<([a-z][a-z0-9-]*)\b([^>]*)>/gi;
  const elements = [];
  let match;
  while ((match = tagRe.exec(source)) && elements.length < options.maxElements) {
    const tag = match[1].toLowerCase();
    if (/^(script|style|noscript|template|meta|link|title|br|hr|path|circle|rect|line|polyline|polygon|source|track|wbr)$/.test(tag)) continue;
    const attrs = parseAttrs(match[2]);
    const style = attrs.style || '';
    const nextTag = source.indexOf('<', tagRe.lastIndex);
    const text = (nextTag < 0 ? source.slice(tagRe.lastIndex) : source.slice(tagRe.lastIndex, nextTag))
      .replace(/\s+/g, ' ').trim().slice(0, 300);
    const role = (attrs.role || '').toLowerCase();
    const width = parsePx(styleValue(style, 'width'));
    const height = parsePx(styleValue(style, 'height'));
    const fontSizeMatch = styleValue(style, 'font-size').match(/(\d+(?:\.\d+)?)px/i);
    const fontWeightMatch = styleValue(style, 'font-weight').match(/\d+/);
    const classes = String(attrs.class || '').split(/\s+/).filter(Boolean).slice(0, 4);
    const element = {
      tag,
      id: attrs.id || '',
      classes,
      role,
      type: (attrs.type || '').toLowerCase(),
      attrs,
      tabindex: attrs.tabindex === undefined ? null : String(attrs.tabindex),
      disabled: attrs.disabled !== undefined,
      visible: attrs.hidden === undefined && !/display\s*:\s*none|visibility\s*:\s*hidden/i.test(style),
      rect: width !== null || height !== null ? {width: width || 0, height: height || 0} : null,
      color: parseColor(styleValue(style, 'color')),
      background: parseColor(styleValue(style, 'background-color') || styleValue(style, 'background')),
      fontSize: fontSizeMatch ? Number(fontSizeMatch[1]) : null,
      fontWeight: fontWeightMatch ? Number(fontWeightMatch[0]) : null,
      interactive: false,
      focusable: false,
      isImage: tag === 'img' || role === 'img' ||
        (tag === 'input' && (attrs.type || '').toLowerCase() === 'image'),
      alt: attrs.alt === undefined ? null : attrs.alt,
      ariaLabel: attrs['aria-label'] || null,
      ariaHidden: attrs['aria-hidden'] || null,
      title: attrs.title || null,
      placeholder: attrs.placeholder || null,
      text,
      name: nameFromHtml(attrs, text),
      hasOnclick: Object.prototype.hasOwnProperty.call(attrs, 'onclick'),
      selector: `${tag}${attrs.id ? `#${attrs.id}` : ''}${classes.length ? `.${classes.join('.')}` : ''}`
    };
    element.interactive = isInteractiveHtml(element);
    element.focusable = isFocusableHtml(element);
    elements.push(element);
  }
  const titleMatch = source.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const langMatch = source.match(/<html[^>]*\blang\s*=\s*["']([^"']+)["']/i);
  return {
    source: 'html',
    url: '',
    title: titleMatch ? titleMatch[1].replace(/\s+/g, ' ').trim() : '',
    lang: langMatch ? langMatch[1] : '',
    viewport: null,
    elements,
    focusOrder: elements.filter(item => item.focusable)
      .slice(0, options.maxElements)
      .map((item, index) => ({
        index,
        tag: item.tag,
        role: item.role,
        tabindex: item.tabindex,
        name: item.name,
        selector: item.selector,
        visible: item.visible
      })),
    total: elements.length,
    truncated: elements.length >= options.maxElements
  };
}

// ---------- Reglas y puntuación ----------
function blendColor(foreground, background) {
  const alpha = Number.isFinite(foreground.a) ? Math.max(0, Math.min(1, foreground.a)) : 1;
  return {
    r: foreground.r * alpha + background.r * (1 - alpha),
    g: foreground.g * alpha + background.g * (1 - alpha),
    b: foreground.b * alpha + background.b * (1 - alpha),
    a: 1
  };
}

function channelLuminance(value) {
  const channel = Math.max(0, Math.min(255, value)) / 255;
  return channel <= 0.03928 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
}

function relativeLuminance(color) {
  return 0.2126 * channelLuminance(color.r) +
    0.7152 * channelLuminance(color.g) +
    0.0722 * channelLuminance(color.b);
}

function contrastRatio(first, second) {
  const left = relativeLuminance(first);
  const right = relativeLuminance(second);
  const lighter = Math.max(left, right);
  const darker = Math.min(left, right);
  return Math.round(((lighter + 0.05) / (darker + 0.05)) * 100) / 100;
}

function elementRef(element) {
  if (!element) return null;
  return {
    tag: element.tag || '',
    selector: element.selector || '',
    snippet: String(element.text || element.name || element.tag || '').slice(0, 80)
  };
}

function analyzeSnapshot(snapshot, options) {
  const findings = [];
  const seenContrast = new Set();
  const add = (category, severity, code, es, en, suggestionEs, suggestionEn, element, details) => {
    findings.push({
      id: `F${String(findings.length + 1).padStart(3, '0')}`,
      category, severity, code,
      message: en, message_es: es,
      suggestion: suggestionEn, suggestion_es: suggestionEs,
      element: elementRef(element),
      details: details || {}
    });
  };

  if (!snapshot.lang) {
    add('structure', 'warning', 'HTML_LANG_MISSING',
      'El documento no declara el idioma con el atributo lang.',
      'The document does not declare a language with the lang attribute.',
      'Añade <html lang="es"> o <html lang="en">.',
      'Add <html lang="es"> or <html lang="en">.',
      null, {});
  }

  const ids = new Map();
  for (const element of snapshot.elements) {
    if (element.id) ids.set(element.id, (ids.get(element.id) || 0) + 1);
  }
  for (const [id, count] of ids) {
    if (count > 1) {
      add('structure', 'warning', 'DUPLICATE_ID',
        `El id "${id}" aparece ${count} veces.`,
        `The id "${id}" appears ${count} times.`,
        'Usa un id único por elemento o sustituye el extra por una clase.',
        'Use one unique id per element or replace the extra with a class.',
        {tag: 'id', selector: `#${id}`, snippet: id}, {id, count});
    }
  }

  for (const item of snapshot.focusOrder || []) {
    const tabindex = Number(item.tabindex);
    if (Number.isFinite(tabindex) && tabindex > 0) {
      add('focus', 'warning', 'POSITIVE_TABINDEX',
        `Elemento con tabindex positivo (${tabindex}); altera el orden natural.`,
        `Element with positive tabindex (${tabindex}); it changes the natural order.`,
        'Quita el tabindex positivo y deja que el DOM marque el orden.',
        'Remove positive tabindex and let the DOM define the order.',
        item, {tabindex});
    }
  }

  for (const element of snapshot.elements) {
    if (!element.visible) continue;
    const hidden = String(element.ariaHidden || '') === 'true';

    if (element.focusable && hidden) {
      add('focus', 'error', 'ARIA_HIDDEN_FOCUSABLE',
        'Un elemento enfocable está marcado como aria-hidden="true".',
        'A focusable element is marked aria-hidden="true".',
        'Elimina aria-hidden o haz el elemento no enfocable.',
        'Remove aria-hidden or make the element unfocusable.',
        element, {});
    }

    if (element.interactive && !element.focusable && !hidden) {
      add('focus', 'error', 'INTERACTIVE_NOT_FOCUSABLE',
        'Este elemento es interactivo pero no se puede alcanzar con el teclado.',
        'This element is interactive but cannot be reached with the keyboard.',
        'Usa <button> o añade tabindex="0" y una tecla Enter/Espacio.',
        'Use <button> or add tabindex="0" with an Enter/Space handler.',
        element, {hasOnclick: Boolean(element.hasOnclick)});
    }

    if (element.interactive && !String(element.name || '').trim() && !hidden) {
      add('names', 'error', 'NAME_MISSING',
        'Un control interactivo no tiene nombre accesible.',
        'An interactive control has no accessible name.',
        'Añade texto visible, aria-label, aria-labelledby o un <label> asociado.',
        'Add visible text, aria-label, aria-labelledby or an associated <label>.',
        element, {});
    }

    if (element.isImage) {
      if (element.alt === null || element.alt === undefined) {
        add('alt', 'error', 'ALT_MISSING',
          'Una imagen no tiene atributo alt.',
          'An image has no alt attribute.',
          'Describe la imagen con alt="..." o usa alt="" con aria-hidden="true" si es decorativa.',
          'Describe the image with alt="..." or use alt="" with aria-hidden="true" if decorative.',
          element, {});
      } else if (!String(element.alt).trim() && !hidden) {
        add('alt', 'warning', 'ALT_EMPTY',
          'La imagen tiene alt vacío sin estar marcada como decorativa.',
          'The image has empty alt and is not marked as decorative.',
          'Añade texto o confirma que es decorativa con aria-hidden="true".',
          'Add text or mark it decorative with aria-hidden="true".',
          element, {});
      } else if (String(element.alt).length > 125) {
        add('alt', 'info', 'ALT_TOO_LONG',
          'El texto alternativo supera los 125 caracteres.',
          'Alternative text is longer than 125 characters.',
          'Resume la imagen en una frase breve.',
          'Summarise the image in one short sentence.',
          element, {length: String(element.alt).length});
      }
    }

    if (element.interactive && element.rect) {
      const width = Number(element.rect.width) || 0;
      const height = Number(element.rect.height) || 0;
      if (width > 0 && height > 0 && (width < options.minTapSize || height < options.minTapSize)) {
        add('tap', 'warning', 'TAP_TARGET_SMALL',
          `Objeto táctil de ${Math.round(width)}×${Math.round(height)} px, por debajo de ${options.minTapSize} px.`,
          `Tap target of ${Math.round(width)}×${Math.round(height)} px, below ${options.minTapSize} px.`,
          `Aplica min-width:${options.minTapSize}px; min-height:${options.minTapSize}px o aumenta el padding.`,
          `Apply min-width:${options.minTapSize}px; min-height:${options.minTapSize}px or increase padding.`,
          element, {width: Math.round(width), height: Math.round(height), min: options.minTapSize});
      }
    }

    const text = String(element.text || '').trim();
    const colorKnown = element.color && Number(element.color.a) > 0;
    const backgroundKnown = element.background && Number(element.background.a) > 0;
    if (text && !hidden && colorKnown && backgroundKnown) {
      const fontSize = Number(element.fontSize) || 16;
      const fontWeight = Number(element.fontWeight) || 400;
      const large = fontSize >= 24 || (fontSize >= 18.66 && fontWeight >= 700);
      const threshold = large ? options.contrastLarge : options.contrastNormal;
      const foreground = blendColor(element.color, element.background);
      const ratio = contrastRatio(foreground, element.background);
      const key = `${text.slice(0, 40)}|${ratio}`;
      if (ratio < threshold && !seenContrast.has(key)) {
        seenContrast.add(key);
        add('contrast', 'error', 'CONTRAST_LOW',
          `Contraste ${ratio}:1 insuficiente para texto ${large ? 'grande' : 'normal'} (mínimo ${threshold}:1).`,
          `Contrast ${ratio}:1 is insufficient for ${large ? 'large' : 'normal'} text (minimum ${threshold}:1).`,
          'Usa colores más oscuros sobre fondos claros o invierte el esquema.',
          'Use darker colours on light backgrounds or invert the scheme.',
          element, {ratio, threshold, large, fontSize});
      }
    }
  }

  return findings;
}

function gradeFor(score) {
  if (score >= 90) return {es: 'Excelente', en: 'Excellent'};
  if (score >= 75) return {es: 'Bueno', en: 'Good'};
  if (score >= 60) return {es: 'Mejorable', en: 'Improvable'};
  return {es: 'Débil', en: 'Weak'};
}

function scoreFindings(findings) {
  const deduction = {error: 10, warning: 5, info: 1};
  const categoryScores = {};
  for (const category of CATEGORIES) {
    const penalty = findings
      .filter(finding => finding.category === category)
      .reduce((total, finding) => total + (deduction[finding.severity] || 0), 0);
    categoryScores[category] = Math.max(0, 100 - penalty);
  }
  const score = Math.round(CATEGORIES.reduce((total, category) =>
    total + categoryScores[category] * WEIGHTS[category], 0));
  return {score, grade: gradeFor(score), categoryScores};
}

function renderScanMarkdown(scan, language) {
  const t = (es, en) => localText(language, es, en);
  const lines = [
    `# ${t('Informe de accesibilidad', 'Accessibility report')}`,
    '',
    `- ${t('Fuente', 'Source')}: \`${scan.source}\``,
    `- ${t('Página', 'Page')}: ${scan.url || scan.title || '-'}`,
    `- ${t('Idioma del documento', 'Document language')}: \`${scan.lang || '-'}\``,
    `- ${t('Puntuación', 'Score')}: **${scan.score}/100** (${t(scan.grade.es, scan.grade.en)})`,
    `- ${t('Elementos revisados', 'Elements checked')}: ${scan.summary.elements}`,
    `- ${t('Hallazgos', 'Findings')}: ${scan.summary.findings} ` +
      `(${t('errores', 'errors')} ${scan.summary.errors}, ${t('avisos', 'warnings')} ${scan.summary.warnings})`,
    ''
  ];
  lines.push(`## ${t('Puntuación por categoría', 'Score by category')}`, '');
  lines.push(`| ${t('Categoría', 'Category')} | ${t('Nota', 'Score')} |`, '| --- | --- |');
  for (const category of CATEGORIES) {
    lines.push(`| ${categoryLabel(category, language)} | ${scan.categoryScores[category]} |`);
  }
  lines.push('', `## ${t('Hallazgos', 'Findings')}`, '');
  if (!scan.findings.length) {
    lines.push(t('Sin hallazgos. La muestra parece accesible con estas reglas.',
      'No findings. The sample looks accessible under these rules.'));
  } else {
    lines.push(`| ${t('ID', 'ID')} | ${t('Gravedad', 'Severity')} | ${t('Categoría', 'Category')} | ${t('Código', 'Code')} | ${t('Detalle', 'Detail')} |`,
      '| --- | --- | --- | --- | --- |');
    for (const finding of scan.findings) {
      const message = localText(language, finding.message_es, finding.message);
      const clean = message.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
      const selector = finding.element && finding.element.selector ? ` \`${finding.element.selector}\`` : '';
      lines.push(`| ${finding.id} | ${finding.severity.toUpperCase()} | ` +
        `${categoryLabel(finding.category, language)} | \`${finding.code}\` | ${clean}${selector} |`);
    }
  }
  if (scan.truncated) {
    lines.push('', t('El escaneo se limitó al máximo de elementos solicitado.',
      'The scan stopped at the requested element limit.'));
  }
  return `${lines.join('\n')}\n`;
}

async function loadStored(key) {
  const values = await chrome.storage.local.get(key);
  return Object.prototype.hasOwnProperty.call(values, key) ? values[key] : null;
}

async function a11yScan(args) {
  const language = ['es', 'en', 'both'].includes(args.language) ? args.language : 'both';
  const options = {
    minTapSize: clamp(args.min_tap_size, 24, 64, 44),
    contrastNormal: numberInRange(args.contrast_normal, 2, 7, 4.5),
    contrastLarge: numberInRange(args.contrast_large, 2, 7, 3),
    maxElements: clamp(args.max_elements, 100, 5000, 2000)
  };

  let snapshot;
  if (String(args.html || '').trim()) {
    snapshot = scanHtml(args.html, options);
  } else if (String(args.html_path || '').trim()) {
    const path = String(args.html_path).trim();
    const content = await chrome.antigem.readFile({path, encoding: 'utf8'});
    snapshot = scanHtml(content, options);
    snapshot.path = path;
  } else {
    const tab = await getActiveTab(args.tabId);
    if (!tab) throw new Error('No hay una pestaña activa / No active tab');
    snapshot = await inject(tab.id, collectDom, [{
      maxElements: options.maxElements,
      minTapSize: options.minTapSize
    }]);
    snapshot.tabId = tab.id;
  }

  const findings = analyzeSnapshot(snapshot, options);
  const scoring = scoreFindings(findings);
  const counts = {error: 0, warning: 0, info: 0};
  for (const finding of findings) counts[finding.severity]++;
  const interactive = snapshot.elements.filter(element => element.interactive).length;
  const images = snapshot.elements.filter(element => element.isImage).length;
  const textNodes = snapshot.elements.filter(element => String(element.text || '').trim()).length;

  const scan = {
    scanId: `a11y_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    createdAt: Date.now(),
    language,
    source: snapshot.source,
    url: snapshot.url,
    title: snapshot.title,
    lang: snapshot.lang,
    path: snapshot.path || null,
    tabId: snapshot.tabId || null,
    viewport: snapshot.viewport || null,
    options,
    score: scoring.score,
    grade: scoring.grade,
    categoryScores: scoring.categoryScores,
    summary: {
      elements: snapshot.elements.length,
      interactive,
      images,
      textNodes,
      findings: findings.length,
      errors: counts.error,
      warnings: counts.warning,
      info: counts.info,
      truncated: Boolean(snapshot.truncated)
    },
    findings
  };
  scan.markdown = renderScanMarkdown(scan, language);
  await chrome.storage.local.set({
    [`a11y.scans.${scan.scanId}`]: scan,
    'a11y.lastScan': scan.scanId
  });
  return scan;
}

const FIX_TEMPLATES = {
  CONTRAST_LOW: {
    es: 'Subir el contraste del texto',
    en: 'Increase text contrast',
    stepsEs: ['Revisa el color de texto y el fondo.', 'Ajusta hasta alcanzar el ratio indicado.'],
    stepsEn: ['Review the text and background colours.', 'Adjust until the stated ratio is met.'],
    snippet: '.label { color: #111827; background: #ffffff; }'
  },
  TAP_TARGET_SMALL: {
    es: 'Agrandar el objetivo táctil',
    en: 'Enlarge the tap target',
    stepsEs: ['Aplica un tamaño mínimo de 44×44 px.', 'Aumenta el padding si el icono es pequeño.'],
    stepsEn: ['Apply a 44×44 px minimum size.', 'Increase padding if the icon is small.'],
    snippet: '.tap-target { min-width: 44px; min-height: 44px; padding: 12px; }'
  },
  NAME_MISSING: {
    es: 'Poner nombre accesible al control',
    en: 'Give the control an accessible name',
    stepsEs: ['Usa texto visible o aria-label.', 'Si es un input, asocia un <label for>.'],
    stepsEn: ['Use visible text or aria-label.', 'For inputs, associate a <label for>.'],
    snippet: '<button aria-label="Cerrar">✕</button>\n<label for="correo">Correo</label>\n<input id="correo">'
  },
  ALT_MISSING: {
    es: 'Añadir texto alternativo',
    en: 'Add alternative text',
    stepsEs: ['Describe la imagen en alt.', 'Si es decorativa, usa alt="" y aria-hidden="true".'],
    stepsEn: ['Describe the image in alt.', 'If decorative, use alt="" and aria-hidden="true".'],
    snippet: '<img src="grafico.png" alt="Gráfico de ventas de enero">'
  },
  ALT_EMPTY: {
    es: 'Aclarar el propósito de la imagen',
    en: 'Clarify the image purpose',
    stepsEs: ['Añade texto alternativo o márcala como decorativa.'],
    stepsEn: ['Add alternative text or mark it as decorative.'],
    snippet: '<img src="adorno.png" alt="" aria-hidden="true">'
  },
  ALT_TOO_LONG: {
    es: 'Acortar el texto alternativo',
    en: 'Shorten alternative text',
    stepsEs: ['Resume la imagen en menos de 125 caracteres.'],
    stepsEn: ['Summarise the image in fewer than 125 characters.'],
    snippet: '<img src="EquipoDeTrabajoEnLaOficina2026.png" alt="Equipo trabajando">'
  },
  POSITIVE_TABINDEX: {
    es: 'Quitar tabindex positivo',
    en: 'Remove positive tabindex',
    stepsEs: ['Elimina el atributo tabindex del elemento.', 'Reordena el DOM si hace falta.'],
    stepsEn: ['Remove the tabindex attribute.', 'Reorder the DOM if needed.'],
    snippet: '<!-- Antes: <button tabindex="3"> -->\n<button>Guardar</button>'
  },
  INTERACTIVE_NOT_FOCUSABLE: {
    es: 'Hacer enfocable el control',
    en: 'Make the control focusable',
    stepsEs: ['Sustituye el div por un button.', 'Si no puedes, añade tabindex="0" y maneja Enter/Espacio.'],
    stepsEn: ['Replace the div with a button.', 'Otherwise add tabindex="0" and handle Enter/Space.'],
    snippet: '<button type="button" onclick="abrir()">Abrir</button>'
  },
  ARIA_HIDDEN_FOCUSABLE: {
    es: 'Corregir aria-hidden en un control',
    en: 'Fix aria-hidden on a control',
    stepsEs: ['Quita aria-hidden del elemento enfocable.'],
    stepsEn: ['Remove aria-hidden from the focusable element.'],
    snippet: '<button aria-label="Cerrar">✕</button>'
  },
  HTML_LANG_MISSING: {
    es: 'Declarar el idioma del documento',
    en: 'Declare the document language',
    stepsEs: ['Añade el atributo lang a <html>.'],
    stepsEn: ['Add the lang attribute to <html>.'],
    snippet: '<html lang="es">'
  },
  DUPLICATE_ID: {
    es: 'Unificar identificadores duplicados',
    en: 'Resolve duplicate ids',
    stepsEs: ['Deja un solo elemento con ese id.', 'Usa clases para los demás.'],
    stepsEn: ['Keep one element with that id.', 'Use classes for the rest.'],
    snippet: '<div id="unico"></div>\n<div class="grupo"></div>'
  }
};

function defaultFix(code) {
  return {
    es: `Revisar ${code}`,
    en: `Review ${code}`,
    stepsEs: ['Comprueba el elemento señalado y aplica la sugerencia del hallazgo.'],
    stepsEn: ['Check the flagged element and apply the finding suggestion.'],
    snippet: '<!-- Aplica la sugerencia del hallazgo -->'
  };
}

function renderFixMarkdown(fixes, language) {
  const t = (es, en) => localText(language, es, en);
  const lines = [
    `# ${t('Correcciones de accesibilidad', 'Accessibility fixes')}`,
    '',
    `- ${t('Correcciones', 'Fixes')}: ${fixes.length}`,
    `- ${t('Escaneo', 'Scan')}: \`${fixes[0] ? fixes[0].scanId : '-'}\``,
    ''
  ];
  fixes.forEach((fix, index) => {
    lines.push(`## ${index + 1}. ${localText(language, fix.title_es, fix.title_en)}`, '');
    lines.push(`- ${t('Hallazgo', 'Finding')}: \`${fix.findingId}\` (${fix.code})`);
    lines.push(`- ${t('Prioridad', 'Priority')}: ${fix.priority} · ${fix.severity.toUpperCase()}`);
    if (fix.element && fix.element.selector) {
      lines.push(`- ${t('Elemento', 'Element')}: \`${fix.element.selector}\``);
    }
    lines.push('');
    const steps = language === 'es' ? fix.steps_es : language === 'en' ? fix.steps_en :
      fix.steps_es.map((step, position) => `${step} / ${fix.steps_en[position] || ''}`);
    for (const step of steps) lines.push(`1. ${step}`);
    lines.push('', '```html', fix.snippet, '```', '');
  });
  return `${lines.join('\n').trim()}\n`;
}

async function a11yFixSuggestions(args) {
  const language = ['es', 'en', 'both'].includes(args.language) ? args.language : 'both';
  const scanId = args.scan || await loadStored('a11y.lastScan');
  if (!scanId) throw new Error('No hay un escaneo guardado / No saved scan');
  const scan = await loadStored(`a11y.scans.${scanId}`);
  if (!scan) throw new Error(`No existe el escaneo ${scanId} / Scan ${scanId} not found`);

  const categories = Array.isArray(args.categories) && args.categories.length
    ? args.categories.filter(category => CATEGORIES.includes(category)) : CATEGORIES;
  const max = clamp(args.max, 1, 100, 30);
  const severityRank = {error: 0, warning: 1, info: 2};
  const selected = scan.findings
    .filter(finding => categories.includes(finding.category))
    .map(finding => {
      const template = FIX_TEMPLATES[finding.code] || defaultFix(finding.code);
      return {
        scanId,
        findingId: finding.id,
        code: finding.code,
        category: finding.category,
        severity: finding.severity,
        priority: (Object.prototype.hasOwnProperty.call(severityRank, finding.severity)
          ? severityRank[finding.severity] : 2) * 10 +
          (10 - Math.round(WEIGHTS[finding.category] * 100)),
        title_es: template.es,
        title_en: template.en,
        steps_es: template.stepsEs,
        steps_en: template.stepsEn,
        snippet: template.snippet,
        element: finding.element,
        details: finding.details
      };
    })
    .sort((a, b) => a.priority - b.priority || a.findingId.localeCompare(b.findingId))
    .slice(0, max);

  const fixes = {
    fixesId: `fix_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    scanId, createdAt: Date.now(), language,
    total: selected.length,
    fixes: selected
  };
  fixes.markdown = renderFixMarkdown(selected, language);
  fixes.written = false;
  fixes.path = null;
  if (args.output && args.dry_run === false) {
    fixes.path = String(args.output);
    await chrome.antigem.writeFile({path: fixes.path, data: fixes.markdown, encoding: 'utf8'});
    fixes.written = true;
  }
  await chrome.storage.local.set({
    [`a11y.fixes.${fixes.fixesId}`]: fixes,
    'a11y.lastFixes': fixes.fixesId
  });
  return fixes;
}

function renderFullReport(scan, fixes, language) {
  const t = (es, en) => localText(language, es, en);
  const lines = [
    `# ${t('Auditoría de accesibilidad', 'Accessibility audit')}`,
    '',
    `- ${t('Escaneo', 'Scan')}: \`${scan.scanId}\``,
    `- ${t('Fuente', 'Source')}: \`${scan.source}\``,
    `- ${t('Página', 'Page')}: ${scan.url || scan.title || '-'}`,
    `- ${t('Puntuación', 'Score')}: **${scan.score}/100** (${t(scan.grade.es, scan.grade.en)})`,
    `- ${t('Errores / avisos', 'Errors / warnings')}: ${scan.summary.errors} / ${scan.summary.warnings}`,
    '',
    scan.markdown || ''
  ];
  if (fixes && fixes.fixes) {
    lines.push('---', '', `## ${t('Correcciones priorizadas', 'Prioritised fixes')}`, '');
    fixes.fixes.forEach((fix, index) => {
      lines.push(`${index + 1}. **${localText(language, fix.title_es, fix.title_en)}** ` +
        `(${fix.code}, ${t('prioridad', 'priority')} ${fix.priority})`);
      if (fix.element && fix.element.selector) lines.push(`   - \`${fix.element.selector}\``);
    });
    lines.push('', '```html', ...fixes.fixes.slice(0, 5).map(fix => fix.snippet), '```', '');
  }
  return `${lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()}\n`;
}

async function a11yReport(args) {
  const language = ['es', 'en', 'both'].includes(args.language) ? args.language : 'both';
  const scanId = args.scan || await loadStored('a11y.lastScan');
  if (!scanId) throw new Error('No hay un escaneo guardado / No saved scan');
  const scan = await loadStored(`a11y.scans.${scanId}`);
  if (!scan) throw new Error(`No existe el escaneo ${scanId} / Scan ${scanId} not found`);

  let fixes = null;
  if (args.include_fixes !== false) {
    const fixesId = await loadStored('a11y.lastFixes');
    if (fixesId) {
      const candidate = await loadStored(`a11y.fixes.${fixesId}`);
      if (candidate && candidate.scanId === scanId) fixes = candidate;
    }
  }

  const markdown = renderFullReport(scan, fixes, language);
  let path = null;
  let written = false;
  if (args.output && args.dry_run === false) {
    path = String(args.output);
    await chrome.antigem.writeFile({path, data: markdown, encoding: 'utf8'});
    written = true;
  }
  return {
    ok: true, scanId, fixesId: fixes ? fixes.fixesId : null,
    path, written, markdown
  };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.type !== 'mcp_tool_call') return false;
  (async () => {
    const args = message.args || {};
    if (message.tool === 'a11y_scan') return await a11yScan(args);
    if (message.tool === 'a11y_fix_suggestions') return await a11yFixSuggestions(args);
    if (message.tool === 'a11y_report') return await a11yReport(args);
    throw new Error(`Unknown tool: ${message.tool}`);
  })().then(sendResponse, error => sendResponse({
    isError: true,
    content: [{type: 'text', text: error && error.message ? error.message : String(error)}]
  }));
  return true;
});
