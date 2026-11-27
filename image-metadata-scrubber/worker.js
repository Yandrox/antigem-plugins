'use strict';

// image-metadata-scrubber — inspección y limpieza offline de metadatos JPEG/PNG.
// Solo chrome.antigem (antigemFiles) y JS puro: sin exiftool, sin red, sin exec.

const MAX_IMAGE_BYTES = 24 * 1024 * 1024;
const MAX_ENTRIES = 200;
const MAX_VALUE_CHARS = 240;

function asText(value) {
  return value == null ? '' : String(value);
}

function both(es, en) {
  return `${es} / ${en}`;
}

function fail(es, en) {
  throw new Error(both(es, en));
}

function clampInt(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, Math.round(number)));
}

function normalizePath(value, labelEs, labelEn, extension) {
  const raw = asText(value).trim();
  if (!raw) fail(`Falta ${labelEs}`, `${labelEn} is required`);
  if (raw.includes('..')) fail(`${labelEs} no puede contener ..`, `${labelEn} cannot contain ..`);
  if (!/^(~\/|\/sdcard\/|\/data\/)/.test(raw)) {
    fail(`${labelEs} debe empezar por ~/, /sdcard/ o /data/`,
      `${labelEn} must start with ~/, /sdcard/ or /data/`);
  }
  if (extension && !extension.some(ext => raw.toLowerCase().endsWith(ext))) {
    fail(`${labelEs} debe ser ${extension.join(' o ')}`, `${labelEn} must be ${extension.join(' or ')}`);
  }
  return raw;
}

function utf8Decode(bytes) {
  let out = '';
  let index = 0;
  while (index < bytes.length) {
    const first = bytes[index++];
    if (first < 0x80) {
      out += String.fromCharCode(first);
    } else if ((first & 0xe0) === 0xc0 && index < bytes.length) {
      out += String.fromCharCode(((first & 0x1f) << 6) | (bytes[index++] & 0x3f));
    } else if ((first & 0xf0) === 0xe0 && index + 1 < bytes.length) {
      const second = bytes[index++] & 0x3f;
      const third = bytes[index++] & 0x3f;
      out += String.fromCharCode(((first & 0x0f) << 12) | (second << 6) | third);
    } else if ((first & 0xf8) === 0xf0 && index + 2 < bytes.length) {
      const second = bytes[index++] & 0x3f;
      const third = bytes[index++] & 0x3f;
      const fourth = bytes[index++] & 0x3f;
      const code = (((first & 0x07) << 18) | (second << 12) | (third << 6) | fourth) - 0x10000;
      out += String.fromCharCode(0xd800 + (code >> 10), 0xdc00 + (code & 0x3ff));
    } else {
      out += '\uFFFD';
    }
  }
  return out;
}

function base64ToBytes(base64) {
  const clean = asText(base64).replace(/\s/g, '');
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const output = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let buffer = 0;
  let bits = 0;
  let cursor = 0;
  for (let index = 0; index < clean.length; index++) {
    const value = alphabet.indexOf(clean[index]);
    if (value < 0) break;
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      output[cursor++] = (buffer >>> bits) & 0xff;
    }
  }
  return output.subarray(0, cursor);
}

function bytesToBase64(bytes) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const chunks = [];
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index];
    const second = index + 1 < bytes.length ? bytes[index + 1] : 0;
    const third = index + 2 < bytes.length ? bytes[index + 2] : 0;
    const value = (first << 16) | (second << 8) | third;
    chunks.push(
      alphabet[(value >> 18) & 63],
      alphabet[(value >> 12) & 63],
      index + 1 < bytes.length ? alphabet[(value >> 6) & 63] : '=',
      index + 2 < bytes.length ? alphabet[value & 63] : '='
    );
  }
  return chunks.join('');
}

function concatBytes(parts) {
  let total = 0;
  for (const part of parts) total += part.length;
  const output = new Uint8Array(total);
  let cursor = 0;
  for (const part of parts) {
    output.set(part, cursor);
    cursor += part.length;
  }
  return output;
}

function u16be(bytes, offset) {
  if (offset + 2 > bytes.length) return 0;
  return (bytes[offset] << 8) | bytes[offset + 1];
}

function u32be(bytes, offset) {
  if (offset + 4 > bytes.length) return 0;
  return (((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0);
}

function u16le(bytes, offset) {
  if (offset + 2 > bytes.length) return 0;
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function u32le(bytes, offset) {
  if (offset + 4 > bytes.length) return 0;
  return (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0;
}

function humanSize(bytes) {
  if (!Number.isFinite(bytes)) return '?';
  if (bytes < 1024) return `${bytes} B`;
  let value = bytes / 1024;
  let unit = 'KiB';
  if (value >= 1024) {
    value /= 1024;
    unit = 'MiB';
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${unit}`;
}

function clip(text) {
  const value = asText(text).replace(/\0/g, ' ').trim();
  return value.length > MAX_VALUE_CHARS ? `${value.slice(0, MAX_VALUE_CHARS)}…` : value;
}

const EXIF_TAGS = {
  0x010f: 'Make',
  0x0110: 'Model',
  0x0112: 'Orientation',
  0x0131: 'Software',
  0x0132: 'DateTime',
  0x013b: 'Artist',
  0x8298: 'Copyright',
  0x8769: 'ExifIFD',
  0x8825: 'GPSIFD',
  0x9003: 'DateTimeOriginal',
  0x9004: 'DateTimeDigitized',
  0x9291: 'SubSecTimeOriginal',
  0xa430: 'CameraOwnerName',
  0xa431: 'BodySerialNumber',
  0xa433: 'LensMake',
  0xa434: 'LensModel',
  0xa435: 'LensSerialNumber'
};

const GPS_TAGS = {
  0x0000: 'GPSVersionID',
  0x0001: 'GPSLatitudeRef',
  0x0002: 'GPSLatitude',
  0x0003: 'GPSLongitudeRef',
  0x0004: 'GPSLongitude',
  0x0005: 'GPSAltitudeRef',
  0x0006: 'GPSAltitude',
  0x001d: 'GPSDateStamp',
  0x001e: 'GPSSatellites'
};

const TIFF_SIZES = {1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 6: 1, 7: 1, 8: 2, 9: 4, 10: 8, 11: 4, 12: 8};

function riskFor(key, source) {
  const text = `${source} ${key}`.toLowerCase();
  if (/gps|latitude|longitude|altitude|datestamp|serialnumber|cameraowner/.test(text)) return 'high';
  if (/datetime|original|digitized|software|artist|copyright|lens|model|make|xmp|iptc|comment|text|author|creator|modifydate/.test(text)) return 'medium';
  return 'low';
}

function tiffValue(data, tiffStart, length, type, count, valuePos, rawValue, little) {
  const unit = TIFF_SIZES[type] || 1;
  const size = unit * count;
  if (!Number.isSafeInteger(size) || size > 1024 * 1024 || count === 0) return '[vacío]';
  const position = size <= 4 ? valuePos : tiffStart + rawValue;
  if (position + size > length) return '[fuera de rango]';
  const readUnsigned = (offset) => {
    if (type === 3) return little ? u16le(data, offset) : u16be(data, offset);
    if (type === 4 || type === 9) return little ? u32le(data, offset) : u32be(data, offset);
    return data[offset];
  };
  if (type === 2) {
    return clip(utf8Decode(data.subarray(position, position + size)));
  }
  if (type === 5 || type === 10) {
    const values = [];
    for (let index = 0; index < count && values.length < 8; index++) {
      const offset = position + index * 8;
      const numerator = little ? u32le(data, offset) : u32be(data, offset);
      const denominator = little ? u32le(data, offset + 4) : u32be(data, offset + 4);
      values.push(denominator ? Number((numerator / denominator).toFixed(6)) : 0);
    }
    return count === 1 ? values[0] : values;
  }
  if (type === 1 || type === 6 || type === 7 || type === 8) {
    const bytes = Array.from(data.subarray(position, Math.min(position + size, position + 16)));
    return bytes.map(byte => byte.toString(16).padStart(2, '0')).join(' ');
  }
  const values = [];
  for (let index = 0; index < count && values.length < 16; index++) {
    values.push(readUnsigned(position + index * unit));
  }
  return count === 1 ? values[0] : values.join(', ');
}

function formatGps(value, ref) {
  if (!Array.isArray(value) || value.length < 3) return asText(value);
  const numbers = value.map(number => Number(number) || 0);
  const decimal = numbers[0] + numbers[1] / 60 + numbers[2] / 3600;
  const sign = /s|w/i.test(asText(ref)) ? -1 : 1;
  return `${(decimal * sign).toFixed(6)} (${asText(ref)} ${numbers[0]}° ${numbers[1]}' ${numbers[2]}")`;
}

function parseTiff(data, tiffStart, length, source, warnings) {
  const items = [];
  if (tiffStart + 8 > length) return items;
  const order = utf8Decode(data.subarray(tiffStart, tiffStart + 2));
  const little = order === 'II';
  if (!little && order !== 'MM') {
    warnings.push('Cabecera TIFF desconocida; EXIF no analizado.');
    return items;
  }
  const magic = little ? u16le(data, tiffStart + 2) : u16be(data, tiffStart + 2);
  if (magic !== 42) {
    warnings.push('Magic TIFF inválido; EXIF no analizado.');
    return items;
  }
  const first = little ? u32le(data, tiffStart + 4) : u32be(data, tiffStart + 4);
  const visited = new Set();

  function readIfd(offset, label) {
    if (!offset || visited.has(offset) || items.length >= MAX_ENTRIES) return;
    visited.add(offset);
    const position = tiffStart + offset;
    if (position + 2 > length) return;
    const count = little ? u16le(data, position) : u16be(data, position);
    if (count > 200) return;
    const records = [];
    const values = new Map();
    for (let index = 0; index < count; index++) {
      const entry = position + 2 + index * 12;
      if (entry + 12 > length) break;
      const tag = little ? u16le(data, entry) : u16be(data, entry);
      const type = little ? u16le(data, entry + 2) : u16be(data, entry + 2);
      const amount = little ? u32le(data, entry + 4) : u32be(data, entry + 4);
      const rawValue = little ? u32le(data, entry + 8) : u32be(data, entry + 8);
      const value = tiffValue(data, tiffStart, length, type, amount, entry + 8, rawValue, little);
      records.push({tag, type, amount, rawValue, value});
      values.set(tag, value);
    }
    for (const record of records) {
      const isGps = label === 'GPS';
      const name = isGps
        ? (GPS_TAGS[record.tag] || `GPS-0x${record.tag.toString(16)}`)
        : (EXIF_TAGS[record.tag] || `${label}-0x${record.tag.toString(16)}`);
      let value = record.value;
      if (isGps && (record.tag === 0x0002 || record.tag === 0x0004)) {
        const ref = values.get(record.tag === 0x0002 ? 0x0001 : 0x0003);
        value = formatGps(record.value, ref);
      }
      if (name === 'ExifIFD' || name === 'GPSIFD') {
        readIfd(record.rawValue, name === 'GPSIFD' ? 'GPS' : 'Exif');
        continue;
      }
      items.push({source, key: `${label}.${name}`, value: clip(value), risk: riskFor(name, source)});
    }
  }

  readIfd(first, 'IFD0');
  return items;
}

const XMP_PRIVATE = /GPS|Latitude|Longitude|CreatorTool|ModifyDate|CreateDate|Author|Creator|Software|Serial/i;

function xmpItems(payload, source) {
  const text = clip(utf8Decode(payload));
  const hits = [];
  const matches = text.match(XMP_PRIVATE) || [];
  for (const hit of new Set(matches.map(value => value.toLowerCase()))) {
    hits.push(hit);
  }
  return [{source, key: 'XMP', value: hits.length ? `Campos privados: ${hits.join(', ')}` : 'Bloque XMP presente',
    risk: hits.length ? 'medium' : 'low'}];
}

function jpegDimensions(data) {
  let position = 2;
  while (position + 9 < data.length) {
    if (data[position] !== 0xff) {
      position++;
      continue;
    }
    let marker = data[position + 1];
    while (marker === 0xff) marker = data[++position + 1];
    if (marker === 0xda || marker === 0xd9) break;
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      position += 2;
      continue;
    }
    const length = u16be(data, position + 2);
    if (length < 2) break;
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return {width: u16be(data, position + 7), height: u16be(data, position + 5)};
    }
    position += 2 + length;
  }
  return {width: null, height: null};
}

function jpegPayloadStarts(payload, prefix) {
  if (payload.length < prefix.length) return false;
  for (let index = 0; index < prefix.length; index++) {
    if (payload[index] !== prefix.charCodeAt(index)) return false;
  }
  return true;
}

function inspectJpeg(data, warnings) {
  if (data[0] !== 0xff || data[1] !== 0xd8) {
    fail('No es un JPEG válido', 'Not a valid JPEG');
  }
  const items = [];
  let position = 2;
  while (position + 2 <= data.length && items.length < MAX_ENTRIES) {
    if (data[position] !== 0xff) {
      warnings.push('Byte inesperado antes del escaneo JPEG; lectura detenida.');
      break;
    }
    let marker = data[position + 1];
    while (marker === 0xff) {
      position++;
      if (position + 1 >= data.length) break;
      marker = data[position + 1];
    }
    if (marker === 0xd9 || marker === 0xda) break;
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      position += 2;
      continue;
    }
    const length = u16be(data, position + 2);
    if (length < 2 || position + 2 + length > data.length) {
      warnings.push('Segmento JPEG truncado; lectura detenida.');
      break;
    }
    const payload = data.subarray(position + 4, position + 2 + length);
    if (marker === 0xe1 && jpegPayloadStarts(payload, 'Exif\0\0')) {
      items.push(...parseTiff(data, position + 4 + 6, data.length, 'EXIF', warnings));
    } else if (marker === 0xe1 && jpegPayloadStarts(payload, 'http://ns.adobe.com/xap/1.0/')) {
      items.push(...xmpItems(payload, 'XMP'));
    } else if (marker === 0xed) {
      items.push({source: 'IPTC', key: 'Photoshop/IPTC', value: `${payload.length} bytes de metadatos IPTC`, risk: 'medium'});
    } else if (marker === 0xe0) {
      const density = payload.length >= 12 ? `${u16be(payload, 8)}x${u16be(payload, 10)}` : 'desconocida';
      items.push({source: 'JFIF', key: 'Densidad y miniatura', value: `Densidad ${density}`, risk: 'low'});
    } else if (marker === 0xe2 && jpegPayloadStarts(payload, 'ICC_PROFILE')) {
      items.push({source: 'ICC', key: 'ICC_PROFILE', value: `Perfil de color (${payload.length} bytes)`, risk: 'low'});
    } else if (marker === 0xfe) {
      items.push({source: 'COM', key: 'Comentario', value: clip(utf8Decode(payload)), risk: 'medium'});
    }
    position += 2 + length;
  }
  return {format: 'jpeg', ...jpegDimensions(data), items};
}

function scrubJpeg(data, warnings, options) {
  const parts = [data.subarray(0, 2)];
  let position = 2;
  while (position + 2 <= data.length) {
    if (data[position] !== 0xff) {
      warnings.push('Byte inesperado; se copia el resto del archivo sin cambios.');
      parts.push(data.subarray(position));
      break;
    }
    let marker = data[position + 1];
    while (marker === 0xff) {
      position++;
      if (position + 1 >= data.length) break;
      marker = data[position + 1];
    }
    if (marker === 0xd9) {
      parts.push(data.subarray(position, position + 2));
      break;
    }
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      parts.push(data.subarray(position, position + 2));
      position += 2;
      continue;
    }
    const length = u16be(data, position + 2);
    if (length < 2 || position + 2 + length > data.length) {
      warnings.push('Segmento roto; se copia el resto sin cambios.');
      parts.push(data.subarray(position));
      break;
    }
    const segment = data.subarray(position, position + 2 + length);
    const payload = data.subarray(position + 4, position + 2 + length);
    position += 2 + length;
    if (marker === 0xda) {
      parts.push(segment, data.subarray(position));
      break;
    }
    let strip = false;
    if (marker === 0xfe || marker === 0xe0 || marker === 0xed) strip = true;
    if (marker === 0xe1 && (jpegPayloadStarts(payload, 'Exif\0\0') || jpegPayloadStarts(payload, 'http://ns.adobe.com/xap/1.0/'))) strip = true;
    if (marker === 0xe2 && options.strip_icc && jpegPayloadStarts(payload, 'ICC_PROFILE')) strip = true;
    if (options.aggressive && marker >= 0xe0 && marker <= 0xef) strip = true;
    if (!strip) parts.push(segment);
  }
  return concatBytes(parts);
}

function pngChunkType(data, position) {
  return utf8Decode(data.subarray(position + 4, position + 8));
}

function inspectPng(data, warnings) {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  for (let index = 0; index < signature.length; index++) {
    if (data[index] !== signature[index]) fail('No es un PNG válido', 'Not a valid PNG');
  }
  const items = [];
  let position = 8;
  let width = null;
  let height = null;
  while (position + 12 <= data.length && items.length < MAX_ENTRIES) {
    const length = u32be(data, position);
    if (length > MAX_IMAGE_BYTES || position + 12 + length > data.length) {
      warnings.push('Chunk PNG truncado; lectura detenida.');
      break;
    }
    const type = pngChunkType(data, position);
    const payload = data.subarray(position + 8, position + 8 + length);
    if (type === 'IHDR') {
      width = u32be(payload, 0);
      height = u32be(payload, 4);
    } else if (type === 'tEXt') {
      const zero = payload.indexOf(0);
      const key = zero < 0 ? 'tEXt' : utf8Decode(payload.subarray(0, zero));
      const value = zero < 0 ? '' : utf8Decode(payload.subarray(zero + 1));
      items.push({source: 'PNG tEXt', key: clip(key), value: clip(value), risk: riskFor(key, 'tEXt')});
    } else if (type === 'zTXt') {
      const zero = payload.indexOf(0);
      const key = zero < 0 ? 'zTXt' : utf8Decode(payload.subarray(0, zero));
      items.push({source: 'PNG zTXt', key: clip(key), value: `Texto comprimido (${length} bytes)`, risk: riskFor(key, 'zTXt')});
    } else if (type === 'iTXt') {
      const zero = payload.indexOf(0);
      const key = zero < 0 ? 'iTXt' : utf8Decode(payload.subarray(0, zero));
      let rest = zero < 0 ? 0 : zero + 1;
      const compressed = payload[rest] === 1;
      rest += 2;
      const langEnd = payload.indexOf(0, rest);
      const lang = langEnd < 0 ? '' : utf8Decode(payload.subarray(rest, langEnd));
      rest = langEnd < 0 ? payload.length : langEnd + 1;
      const transEnd = payload.indexOf(0, rest);
      rest = transEnd < 0 ? payload.length : transEnd + 1;
      const value = compressed ? `Texto internacional comprimido (${length} bytes)` : utf8Decode(payload.subarray(rest));
      items.push({source: 'PNG iTXt', key: clip(key), value: clip(`${lang ? `${lang} — ` : ''}${value}`), risk: riskFor(key, 'iTXt')});
    } else if (type === 'eXIf') {
      items.push(...parseTiff(data, position + 8, position + 8 + length, 'PNG eXIf', warnings));
    } else if (type === 'tIME') {
      const date = length >= 7
        ? `${u16be(payload, 0)}-${String(payload[2]).padStart(2, '0')}-${String(payload[3]).padStart(2, '0')} ${String(payload[4]).padStart(2, '0')}:${String(payload[5]).padStart(2, '0')}:${String(payload[6]).padStart(2, '0')}`
        : 'fecha inválida';
      items.push({source: 'PNG tIME', key: 'Fecha de modificación', value: date, risk: 'medium'});
    } else if (type === 'iCCP') {
      const zero = payload.indexOf(0);
      items.push({source: 'PNG iCCP', key: 'Perfil de color', value: zero < 0 ? 'Presente' : clip(utf8Decode(payload.subarray(0, zero))), risk: 'low'});
    }
    position += 12 + length;
    if (type === 'IEND') break;
  }
  return {format: 'png', width, height, items};
}

const PNG_STRIP = new Set(['tEXt', 'zTXt', 'iTXt', 'eXIf', 'tIME', 'oFFs', 'sCAL', 'pCAL']);
const PNG_KEEP_ANCILLARY = new Set(['tRNS', 'bKGD', 'gAMA', 'sRGB', 'cHRM', 'pHYs', 'sBIT', 'hIST']);

function scrubPng(data, warnings, options) {
  const parts = [data.subarray(0, 8)];
  let position = 8;
  while (position + 12 <= data.length) {
    const length = u32be(data, position);
    if (position + 12 + length > data.length) {
      warnings.push('Chunk truncado; se copia el resto sin cambios.');
      parts.push(data.subarray(position));
      break;
    }
    const type = pngChunkType(data, position);
    const chunk = data.subarray(position, position + 12 + length);
    position += 12 + length;
    let strip = PNG_STRIP.has(type);
    if (type === 'iCCP' && options.strip_icc) strip = true;
    const ancillary = type.length === 4 && type[0] === type[0].toLowerCase();
    if (options.aggressive && ancillary && !PNG_KEEP_ANCILLARY.has(type)) strip = true;
    if (!strip) parts.push(chunk);
    if (type === 'IEND') break;
  }
  return concatBytes(parts);
}

function inspectBytes(data, warnings) {
  if (data.length < 12) fail('Archivo demasiado pequeño', 'File is too small');
  if (data[0] === 0xff && data[1] === 0xd8) return inspectJpeg(data, warnings);
  if (data[0] === 0x89 && data[1] === 0x50) return inspectPng(data, warnings);
  fail('Formato no soportado: usa .jpg o .png', 'Unsupported format: use .jpg or .png');
}

function scrubBytes(data, warnings, options) {
  if (data[0] === 0xff && data[1] === 0xd8) return scrubJpeg(data, warnings, options);
  return scrubPng(data, warnings, options);
}

function summarize(items) {
  return {
    total: items.length,
    high: items.filter(item => item.risk === 'high').length,
    medium: items.filter(item => item.risk === 'medium').length,
    low: items.filter(item => item.risk === 'low').length,
    gps: items.some(item => /gps|latitude|longitude/i.test(item.key))
  };
}

async function readImage(path) {
  const stat = await chrome.antigem.stat({path});
  if (!stat.isFile) fail('La ruta debe ser un archivo', 'Path must be a file');
  if (!stat.size) fail('El archivo está vacío', 'File is empty');
  if (stat.size > MAX_IMAGE_BYTES) {
    fail(`Imagen demasiado grande (límite ${humanSize(MAX_IMAGE_BYTES)})`,
      `Image too large (limit ${humanSize(MAX_IMAGE_BYTES)})`);
  }
  const data = base64ToBytes(await chrome.antigem.readFile({path, encoding: 'base64'}));
  if (data.length !== stat.size) {
    throw new Error(both('El tamaño leído no coincide', 'Read size does not match the file'));
  }
  return {data, stat};
}

async function pathExists(path) {
  try {
    await chrome.antigem.stat({path});
    return true;
  } catch (_) {
    return false;
  }
}

function defaultName(path, fragment) {
  const point = path.lastIndexOf('.');
  return point > 0 ? `${path.slice(0, point)}${fragment}${path.slice(point)}` : `${path}${fragment}`;
}

async function imageMetaInspect(args) {
  const path = normalizePath(args.path, 'la ruta de la imagen', 'image path');
  const {data, stat} = await readImage(path);
  const warnings = [];
  const result = inspectBytes(data, warnings);
  const maximum = clampInt(args.max_entries, 1, MAX_ENTRIES, 80);
  const items = result.items.slice(0, maximum);
  return {
    ok: true,
    path,
    format: result.format,
    width: result.width,
    height: result.height,
    size: stat.size,
    items,
    warnings,
    summary: {...summarize(result.items), visible: items.length, truncated: result.items.length > items.length},
    message: both(`${summarize(result.items).total} elementos de metadatos encontrados.`,
      `${summarize(result.items).total} metadata items found.`)
  };
}

async function imageMetaScrub(args) {
  const path = normalizePath(args.path, 'la ruta de la imagen', 'image path');
  const output = normalizePath(args.output || defaultName(path, '.clean'), 'la ruta de salida', 'output path');
  const backup = args.backup === false || args.backup === null
    ? null
    : normalizePath(args.backup || defaultName(path, '.original'), 'la ruta de la copia', 'backup path');
  if ([path, output, backup].filter(Boolean).some((value, index, all) => all.indexOf(value) !== index)) {
    fail('Las rutas de entrada, salida y copia deben ser distintas', 'Input, output and backup paths must differ');
  }
  const options = {strip_icc: args.strip_icc === true, aggressive: args.aggressive === true};
  const dryRun = args.dry_run !== false;
  const {data, stat} = await readImage(path);
  const warnings = [];
  const before = inspectBytes(data, warnings);
  const cleaned = scrubBytes(data, warnings, options);
  const afterWarnings = [];
  const after = inspectBytes(cleaned, afterWarnings);
  const removed = before.items.map(item => ({...item, removed: !after.items.some(other =>
    other.source === item.source && other.key === item.key && other.value === item.value)}));

  if (dryRun) {
    return {
      ok: true, dry_run: true, written: false, format: before.format,
      path, output, backup,
      before: {size: stat.size, width: before.width, height: before.height, ...summarize(before.items)},
      after: {size: cleaned.length, width: after.width, height: after.height, ...summarize(after.items)},
      removed, warnings: [...warnings, ...afterWarnings],
      message: both('Vista previa: no se ha escrito ningún archivo.', 'Preview: no file was written.')
    };
  }

  if (backup && await pathExists(backup)) {
    fail(`Ya existe la copia: ${backup}. Elígela o bórrala a mano.`,
      `Backup already exists: ${backup}. Choose another or delete it manually.`);
  }
  if (await pathExists(output)) {
    fail(`Ya existe la salida: ${output}. Elígela o bórrala a mano.`,
      `Output already exists: ${output}. Choose another or delete it manually.`);
  }
  if (backup) await chrome.antigem.copyFile({from: path, to: backup});
  await chrome.antigem.writeFile({path: output, data: bytesToBase64(cleaned), encoding: 'base64'});

  const verified = after.items.length === 0 && before.width === after.width && before.height === after.height;
  return {
    ok: true, dry_run: false, written: true, format: before.format,
    path, output, backup,
    before: {size: stat.size, width: before.width, height: before.height, ...summarize(before.items)},
    after: {size: cleaned.length, width: after.width, height: after.height, ...summarize(after.items)},
    removed, verified, warnings: [...warnings, ...afterWarnings],
    message: verified
      ? both('Imagen limpia y verificada; original conservado.', 'Clean image verified; original preserved.')
      : both('Archivos escritos, pero la verificación encontró incidencias: revisa los avisos.',
        'Files written, but verification found issues: review the warnings.')
  };
}

function row(cells) {
  return `| ${cells.map(cell => asText(cell).replace(/\|/g, '\\|').replace(/\n/g, ' ')).join(' | ')} |`;
}

function renderReport(path, before, after, removed, warnings, afterPath) {
  const lines = ['# Image Metadata Scrubber', '', '## ES', '',
    `- Archivo: \`${path}\` | Formato: ${before.format} | Tamaño: ${humanSize(before.size)}`,
    `- Dimensiones: ${before.width || '?'}x${before.height || '?'}`,
    `- Metadatos: ${before.total} (${before.high} críticos, ${before.medium} medios, ${before.low} bajos)`, ''];
  for (const warning of warnings) lines.push(`> Aviso: ${warning}`);
  if (warnings.length) lines.push('');
  lines.push('### Elementos encontrados', '',
    row(['Origen', 'Clave', 'Valor', 'Riesgo']), row(['---', '---', '---', '---']));
  for (const item of before.items) lines.push(row([item.source, item.key, item.value, item.risk]));
  lines.push('', `> GPS detectado: ${before.gps ? 'sí' : 'no'}. Nada se ha enviado a la red.`, '');

  lines.push('## EN', '',
    `- File: \`${path}\` | Format: ${before.format} | Size: ${humanSize(before.size)}`,
    `- Dimensions: ${before.width || '?'}x${before.height || '?'}`,
    `- Metadata: ${before.total} (${before.high} high, ${before.medium} medium, ${before.low} low)`, '');
  for (const warning of warnings) lines.push(`> Warning: ${warning}`);
  if (warnings.length) lines.push('');
  lines.push('### Items found', '',
    row(['Source', 'Key', 'Value', 'Risk']), row(['---', '---', '---', '---']));
  for (const item of before.items) lines.push(row([item.source, item.key, item.value, item.risk]));
  lines.push('', `> GPS detected: ${before.gps ? 'yes' : 'no'}. Nothing was sent to the network.`, '');

  if (after) {
    const removedItems = removed.filter(item => item.removed);
    lines.push('## ES — Después / EN — After', '',
      `- Archivo limpio: \`${afterPath || 'salida'}\` | Tamaño: ${humanSize(after.size)} | Metadatos restantes: ${after.total}`,
      `- Clean file: \`${afterPath || 'output'}\` | Size: ${humanSize(after.size)} | Metadata left: ${after.total}`, '',
      row(['Origen', 'Clave', 'Eliminado', 'Source', 'Key', 'Removed']), row(['---', '---', '---', '---', '---', '---']));
    for (const item of removedItems) {
      lines.push(row([item.source, item.key, 'sí', item.source, item.key, 'yes']));
    }
    lines.push('');
  }
  return `${lines.join('\n').replace(/\n+$/, '')}\n`;
}

async function imageMetaReport(args) {
  const path = normalizePath(args.path, 'la ruta de la imagen', 'image path');
  const afterPath = args.after_path ? normalizePath(args.after_path, 'la ruta limpia', 'clean image path') : null;
  const output = args.output ? normalizePath(args.output, 'la ruta del informe', 'report path') : '';
  if (output && !/\.md$/i.test(output)) fail('El informe debe ser .md', 'Report must be .md');
  const {data, stat} = await readImage(path);
  const warnings = [];
  const before = inspectBytes(data, warnings);
  let after = null;
  let afterSize = 0;
  let removed = [];
  if (afterPath) {
    const clean = await readImage(afterPath);
    after = inspectBytes(clean.data, warnings);
    afterSize = clean.stat.size;
    removed = before.items.map(item => ({...item, removed: !after.items.some(other =>
      other.source === item.source && other.key === item.key && other.value === item.value)}));
  }
  const markdown = renderReport(path, {format: before.format, size: stat.size, width: before.width,
    height: before.height, items: before.items, ...summarize(before.items)}, after
    ? {size: afterSize, total: summarize(after.items).total} : null, removed, warnings, afterPath);
  const dryRun = args.dry_run !== false;
  let written = false;
  if (output && !dryRun) {
    if (await pathExists(output)) fail(`Ya existe el informe: ${output}`, `Report already exists: ${output}`);
    try {
      await chrome.antigem.writeFile({path: output, data: markdown, encoding: 'utf8'});
      written = true;
    } catch (error) {
      fail(`No se pudo escribir el informe: ${error.message}`, `Could not write the report: ${error.message}`);
    }
  }
  return {
    ok: true, output: output || null, dry_run: dryRun, written, format: before.format,
    summary: summarize(before.items), removedCount: removed.filter(item => item.removed).length,
    markdown,
    message: both('Informe de metadatos listo.', 'Metadata report ready.')
  };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.type !== 'mcp_tool_call') return false;
  (async () => {
    const args = message.args || {};
    if (message.tool === 'image_meta_inspect') return await imageMetaInspect(args);
    if (message.tool === 'image_meta_scrub') return await imageMetaScrub(args);
    if (message.tool === 'image_meta_report') return await imageMetaReport(args);
    throw new Error(`Unknown tool: ${message.tool}`);
  })().then(sendResponse, error => sendResponse({
    isError: true,
    content: [{type: 'text', text: error && error.message ? error.message : String(error)}]
  }));
  return true;
});
