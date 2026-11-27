'use strict';

// zip-archive-explorer — inspección offline de ZIP, TAR y TAR.GZ.
// Solo chrome.antigem (antigemFiles) y JS puro: ni red, ni librerías, ni exec.

const MAX_ARCHIVE_BYTES = 32 * 1024 * 1024;
const MAX_EXPANDED_BYTES = 96 * 1024 * 1024;
const MAX_ENTRIES = 5000;
const MAX_LISTED = 200;
const MAX_FINDINGS = 200;
const BIG_ENTRY = 50 * 1024 * 1024;

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

function normalizePath(value, labelEs, labelEn) {
  const raw = asText(value).trim();
  if (!raw) fail(`Falta ${labelEs}`, `${labelEn} is required`);
  if (raw.includes('..')) {
    fail(`${labelEs} no puede contener ..`, `${labelEn} cannot contain ..`);
  }
  if (!/^(~\/|\/sdcard\/|\/data\/)/.test(raw)) {
    fail(`${labelEs} debe empezar por ~/, /sdcard/ o /data/`,
      `${labelEn} must start with ~/, /sdcard/ or /data/`);
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

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index++) {
    let value = index;
    for (let bit = 0; bit < 8; bit++) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  let value = 0xffffffff;
  for (let index = 0; index < bytes.length; index++) {
    value = CRC_TABLE[(value ^ bytes[index]) & 0xff] ^ (value >>> 8);
  }
  return (value ^ 0xffffffff) >>> 0;
}

const LENGTH_BASE = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258];
const LENGTH_EXTRA = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0];
const DISTANCE_BASE = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577];
const DISTANCE_EXTRA = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13];

function buildHuffman(lengths) {
  let maxBits = 0;
  for (const length of lengths) if (length > maxBits) maxBits = length;
  const counts = new Uint32Array(maxBits + 1);
  for (const length of lengths) if (length) counts[length]++;
  const nextCode = new Uint32Array(maxBits + 2);
  let code = 0;
  for (let bits = 1; bits <= maxBits; bits++) {
    code = (code + counts[bits - 1]) << 1;
    nextCode[bits] = code;
  }
  const tables = [];
  for (let bits = 1; bits <= maxBits; bits++) {
    tables[bits] = new Int32Array(1 << bits).fill(-1);
  }
  const cursor = new Uint32Array(maxBits + 1);
  for (let symbol = 0; symbol < lengths.length; symbol++) {
    const length = lengths[symbol];
    if (!length) continue;
    tables[length][nextCode[length] + cursor[length]++] = symbol;
  }
  return {tables, maxBits};
}

function decodeSymbol(reader, huffman) {
  let code = 0;
  for (let length = 1; length <= huffman.maxBits; length++) {
    code = (code << 1) | reader.bits(1);
    const symbol = huffman.tables[length][code];
    if (symbol >= 0) return symbol;
  }
  throw new Error('Código Huffman inválido / invalid Huffman code');
}

const FIXED_LITERALS = buildHuffman((() => {
  const lengths = new Uint8Array(288);
  let index = 0;
  for (; index < 144; index++) lengths[index] = 8;
  for (; index < 256; index++) lengths[index] = 9;
  for (; index < 280; index++) lengths[index] = 7;
  for (; index < 288; index++) lengths[index] = 8;
  return lengths;
})());
const FIXED_DISTANCES = buildHuffman(new Uint8Array(32).fill(5));

function inflateRaw(data) {
  let position = 0;
  let buffer = 0;
  let buffered = 0;
  const reader = {
    bits(count) {
      while (buffered < count) {
        if (position >= data.length) {
          throw new Error('Stream deflate truncado / truncated deflate stream');
        }
        buffer |= data[position++] << buffered;
        buffered += 8;
      }
      const value = buffer & ((1 << count) - 1);
      buffer >>>= count;
      buffered -= count;
      return value;
    },
    align() {
      const remaining = buffered % 8;
      buffer >>>= remaining;
      buffered -= remaining;
    },
    bytes(count) {
      reader.align();
      if (position + count > data.length) {
        throw new Error('Stream deflate truncado / truncated deflate stream');
      }
      const slice = data.subarray(position, position + count);
      position += count;
      return slice;
    }
  };

  let output = new Uint8Array(Math.min(1024 * 1024, MAX_EXPANDED_BYTES));
  let outputLength = 0;
  function ensure(extra) {
    if (outputLength + extra <= output.length) return;
    if (outputLength + extra > MAX_EXPANDED_BYTES) {
      throw new Error('Archivo expandido demasiado grande / expanded data too large');
    }
    let capacity = output.length;
    while (capacity < outputLength + extra) capacity = Math.min(capacity * 2, MAX_EXPANDED_BYTES);
    const next = new Uint8Array(capacity);
    next.set(output.subarray(0, outputLength));
    output = next;
  }

  let last = 0;
  while (!last) {
    last = reader.bits(1);
    const type = reader.bits(2);
    if (type === 0) {
      const header = reader.bytes(4);
      const length = header[0] | (header[1] << 8);
      const inverse = header[2] | (header[3] << 8);
      if ((length ^ 0xffff) !== inverse) {
        throw new Error('Bloque deflate sin comprimir inválido / invalid stored block');
      }
      ensure(length);
      const chunk = reader.bytes(length);
      output.set(chunk, outputLength);
      outputLength += length;
      continue;
    }
    if (type !== 1 && type !== 2) {
      throw new Error('Tipo de bloque deflate inválido / invalid deflate block type');
    }

    let literals = FIXED_LITERALS;
    let distances = FIXED_DISTANCES;
    if (type === 2) {
      const literalCount = reader.bits(5) + 257;
      const distanceCount = reader.bits(5) + 1;
      const codeCount = reader.bits(4) + 4;
      const order = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];
      const codeLengths = new Uint8Array(19);
      for (let index = 0; index < codeCount; index++) {
        codeLengths[order[index]] = reader.bits(3);
      }
      const codeTree = buildHuffman(codeLengths);
      const lengths = new Uint8Array(literalCount + distanceCount);
      let cursor = 0;
      while (cursor < lengths.length) {
        const symbol = decodeSymbol(reader, codeTree);
        if (symbol < 16) {
          lengths[cursor++] = symbol;
        } else if (symbol === 16) {
          if (!cursor) throw new Error('Longitudes Huffman inválidas / invalid code lengths');
          const previous = lengths[cursor - 1];
          const repeat = 3 + reader.bits(2);
          for (let index = 0; index < repeat && cursor < lengths.length; index++) {
            lengths[cursor++] = previous;
          }
        } else if (symbol === 17) {
          const repeat = 3 + reader.bits(3);
          for (let index = 0; index < repeat && cursor < lengths.length; index++) lengths[cursor++] = 0;
        } else if (symbol === 18) {
          const repeat = 11 + reader.bits(7);
          for (let index = 0; index < repeat && cursor < lengths.length; index++) lengths[cursor++] = 0;
        } else {
          throw new Error('Símbolo de longitud inválido / invalid length symbol');
        }
      }
      literals = buildHuffman(lengths.subarray(0, literalCount));
      distances = buildHuffman(lengths.subarray(literalCount));
    }

    while (true) {
      const symbol = decodeSymbol(reader, literals);
      if (symbol < 256) {
        ensure(1);
        output[outputLength++] = symbol;
      } else if (symbol === 256) {
        break;
      } else {
        const index = symbol - 257;
        if (index >= LENGTH_BASE.length) throw new Error('Longitud de coincidencia inválida / invalid match length');
        const length = LENGTH_BASE[index] + reader.bits(LENGTH_EXTRA[index]);
        const distanceSymbol = decodeSymbol(reader, distances);
        if (distanceSymbol >= DISTANCE_BASE.length) throw new Error('Distancia inválida / invalid distance');
        const distance = DISTANCE_BASE[distanceSymbol] + reader.bits(DISTANCE_EXTRA[distanceSymbol]);
        if (distance > outputLength) throw new Error('Distancia fuera de rango / distance out of range');
        ensure(length);
        for (let offset = 0; offset < length; offset++) {
          output[outputLength] = output[outputLength - distance];
          outputLength++;
        }
      }
    }
  }
  return output.subarray(0, outputLength);
}

function gunzip(bytes) {
  if (bytes.length < 18 || bytes[0] !== 0x1f || bytes[1] !== 0x8b) {
    fail('No es un archivo gzip válido', 'Not a valid gzip file');
  }
  if (bytes[2] !== 8) fail('Método gzip no soportado', 'Unsupported gzip method');
  const flags = bytes[3];
  let position = 10;
  if (flags & 0x04) {
    if (position + 2 > bytes.length) throw new Error('Cabecera gzip truncada / truncated gzip header');
    const extraLength = bytes[position] | (bytes[position + 1] << 8);
    position += 2 + extraLength;
  }
  for (const flag of [0x08, 0x10]) {
    if (flags & flag) {
      while (position < bytes.length && bytes[position] !== 0) position++;
      position++;
    }
  }
  if (flags & 0x02) position += 2;
  if (position + 8 > bytes.length) throw new Error('Cabecera gzip truncada / truncated gzip header');
  const data = inflateRaw(bytes.subarray(position, bytes.length - 8));
  const expectedCrc = (bytes[bytes.length - 8] | (bytes[bytes.length - 7] << 8) |
    (bytes[bytes.length - 6] << 16) | (bytes[bytes.length - 5] << 24)) >>> 0;
  const actualCrc = crc32(data);
  const expectedSize = (bytes[bytes.length - 4] | (bytes[bytes.length - 3] << 8) |
    (bytes[bytes.length - 2] << 16) | (bytes[bytes.length - 1] << 24)) >>> 0;
  return {data, crcOk: expectedCrc === actualCrc && expectedSize === (data.length >>> 0)};
}

function u16(bytes, offset) {
  if (offset + 2 > bytes.length) throw new Error('Archivo truncado / truncated file');
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function u32(bytes, offset) {
  if (offset + 4 > bytes.length) throw new Error('Archivo truncado / truncated file');
  return (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0;
}

function u64(bytes, offset) {
  return u32(bytes, offset) + u32(bytes, offset + 4) * 4294967296;
}

function pad(value) {
  return String(value).padStart(2, '0');
}

function zipTimestamp(date, time) {
  const year = ((date >> 9) & 0x7f) + 1980;
  const month = (date >> 5) & 0x0f;
  const day = date & 0x1f;
  const hour = (time >> 11) & 0x1f;
  const minute = (time >> 5) & 0x3f;
  const second = (time & 0x1f) * 2;
  if (!month || !day || month > 12 || day > 31) return null;
  return `${year}-${pad(month)}-${pad(day)} ${pad(hour)}:${pad(minute)}:${pad(second)}`;
}

const ZIP_METHODS = {
  0: 'stored',
  1: 'shrunk',
  8: 'deflate',
  9: 'deflate64',
  12: 'bzip2',
  14: 'lzma',
  93: 'zstd',
  95: 'xz',
  99: 'aes'
};

function parseZip(bytes, warnings) {
  let eocd = -1;
  const minimum = Math.max(0, bytes.length - 65557);
  for (let offset = bytes.length - 22; offset >= minimum; offset--) {
    if (u32(bytes, offset) === 0x06054b50) {
      eocd = offset;
      break;
    }
  }
  if (eocd < 0) fail('No se encontró el final del ZIP', 'ZIP end-of-central-directory not found');

  let count = u16(bytes, eocd + 10);
  let directorySize = u32(bytes, eocd + 12);
  let directoryOffset = u32(bytes, eocd + 16);
  if (eocd >= 20 && u32(bytes, eocd - 20) === 0x07064b50) {
    const zip64Offset = u64(bytes, eocd - 12);
    if (zip64Offset + 56 <= bytes.length && u32(bytes, zip64Offset) === 0x06064b50) {
      count = u64(bytes, zip64Offset + 32);
      directorySize = u64(bytes, zip64Offset + 40);
      directoryOffset = u64(bytes, zip64Offset + 48);
      warnings.push('ZIP64 detectado: se han leído los tamaños extendidos.');
    }
  }
  if (!Number.isSafeInteger(count) || !Number.isSafeInteger(directoryOffset) || !Number.isSafeInteger(directorySize)) {
    fail('ZIP con valores demasiado grandes', 'ZIP values exceed safe integer range');
  }

  const entries = [];
  let position = directoryOffset;
  const end = Math.min(bytes.length, directoryOffset + directorySize);
  while (position + 46 <= end && entries.length < MAX_ENTRIES) {
    if (u32(bytes, position) !== 0x02014b50) break;
    const flags = u16(bytes, position + 8);
    const method = u16(bytes, position + 10);
    const modified = zipTimestamp(u16(bytes, position + 14), u16(bytes, position + 12));
    const compressedSize = u32(bytes, position + 20);
    let uncompressedSize = u32(bytes, position + 24);
    const nameLength = u16(bytes, position + 28);
    const extraLength = u16(bytes, position + 30);
    const commentLength = u16(bytes, position + 32);
    const attributes = u32(bytes, position + 38);
    let localOffset = u32(bytes, position + 42);
    const nameStart = position + 46;
    if (nameStart + nameLength + extraLength + commentLength > end) break;
    const name = utf8Decode(bytes.subarray(nameStart, nameStart + nameLength));
    const extra = bytes.subarray(nameStart + nameLength, nameStart + nameLength + extraLength);

    let extraPosition = 0;
    while (extraPosition + 4 <= extra.length) {
      const id = u16(extra, extraPosition);
      const size = u16(extra, extraPosition + 2);
      extraPosition += 4;
      if (extraPosition + size > extra.length) break;
      if (id === 0x0001) {
        let field = 0;
        if (uncompressedSize === 0xffffffff) {
          uncompressedSize = u64(extra, extraPosition + field);
          field += 8;
        }
        if (compressedSize === 0xffffffff) field += 8;
        if (localOffset === 0xffffffff && extraPosition + field + 8 <= extra.length) {
          localOffset = u64(extra, extraPosition + field);
        }
      }
      extraPosition += size;
    }

    const mode = (attributes >>> 16) & 0xffff;
    const fileType = mode & 0xf000;
    let type = 'file';
    if (name.endsWith('/') || fileType === 0x4000) type = 'directory';
    else if (fileType === 0xa000) type = 'symlink';
    else if (fileType === 0x8000) type = 'regular';
    else if (fileType === 0x6000) type = 'device';
    else if (fileType === 0x1000) type = 'fifo';
    else if (fileType === 0xc000) type = 'socket';

    entries.push({
      name,
      path: name,
      size: uncompressedSize,
      compressedSize,
      modified,
      type,
      mode: (mode & 0x0fff).toString(8),
      encrypted: Boolean(flags & 0x01),
      hasDescriptor: Boolean(flags & 0x08),
      utf8: Boolean(flags & 0x800),
      method: ZIP_METHODS[method] || `unknown-${method}`,
      link: null,
      headerOffset: localOffset
    });
    position = nameStart + nameLength + extraLength + commentLength;
  }
  if (entries.length > 0 && count > entries.length) {
    warnings.push(`El índice anuncia ${count} entradas pero solo se leyeron ${entries.length}.`);
  }
  return {format: 'zip', entries, warnings};
}

function parseTarNumber(field) {
  let index = 0;
  while (index < field.length && (field[index] === 0 || field[index] === 32)) index++;
  if (index >= field.length) return 0;
  if (field[index] & 0x80) {
    let value = field[index] & 0x7f;
    for (let cursor = index + 1; cursor < field.length; cursor++) value = value * 256 + field[cursor];
    return Number.isFinite(value) ? value : 0;
  }
  let digits = '';
  for (; index < field.length; index++) {
    const byte = field[index];
    if (byte === 0 || byte === 32) break;
    if (byte < 48 || byte > 55) return 0;
    digits += String.fromCharCode(byte);
  }
  const value = parseInt(digits, 8);
  return Number.isFinite(value) ? value : 0;
}

function tarString(field) {
  let end = 0;
  while (end < field.length && field[end] !== 0) end++;
  return utf8Decode(field.subarray(0, end));
}

function parsePax(data) {
  const text = utf8Decode(data);
  const output = {};
  let position = 0;
  while (position < text.length) {
    let length = 0;
    while (position < text.length && text[position] >= '0' && text[position] <= '9') {
      length = length * 10 + Number(text[position]);
      position++;
    }
    if (text[position] !== ' ' || length < 2) break;
    position++;
    const record = text.slice(position, position + length - 1);
    position += length;
    const separator = record.indexOf('=');
    if (separator > 0) output[record.slice(0, separator)] = record.slice(separator + 1);
  }
  return output;
}

const TAR_TYPES = {
  0: 'file',
  '0': 'file',
  '7': 'file',
  5: 'directory',
  '5': 'directory',
  2: 'symlink',
  1: 'hardlink',
  3: 'device',
  4: 'device',
  6: 'fifo'
};

function parseTar(bytes, warnings) {
  const magic = utf8Decode(bytes.subarray(257, 265)).replace(/\0/g, '').trim();
  if (!/^ustar/.test(magic)) {
    fail('No parece un TAR válido (falta la marca ustar)', 'Not a valid TAR (missing ustar magic)');
  }
  const entries = [];
  let position = 0;
  let pendingName = null;
  let pendingLink = null;
  let extended = null;
  let global = null;
  while (position + 512 <= bytes.length && entries.length < MAX_ENTRIES) {
    const header = bytes.subarray(position, position + 512);
    position += 512;
    let empty = true;
    for (let index = 0; index < 512; index++) {
      if (header[index] !== 0) {
        empty = false;
        break;
      }
    }
    if (empty) break;

    const storedChecksum = parseTarNumber(header.subarray(148, 156));
    let checksum = 0;
    for (let index = 0; index < 512; index++) {
      checksum += index >= 148 && index < 156 ? 32 : header[index];
    }
    if (storedChecksum && storedChecksum !== checksum) {
      warnings.push('Hay una cabecera TAR con checksum incorrecto.');
    }

    let name = tarString(header.subarray(0, 100));
    const mode = parseTarNumber(header.subarray(100, 108));
    const uid = parseTarNumber(header.subarray(108, 116));
    const gid = parseTarNumber(header.subarray(116, 124));
    let size = parseTarNumber(header.subarray(124, 136));
    const mtime = parseTarNumber(header.subarray(136, 148));
    const typeCode = header[156] === 0 ? '0' : String.fromCharCode(header[156]);
    let link = tarString(header.subarray(157, 257));
    const prefix = tarString(header.subarray(345, 500));
    if (prefix) name = `${prefix}/${name}`;

    const special = typeCode === 'L' || typeCode === 'K' || typeCode === 'x' || typeCode === 'g';
    const meta = {...(global || {}), ...(extended || {})};
    if (!special && meta.path) name = meta.path;
    if (!special && meta.linkpath) link = meta.linkpath;
    if (!special && meta.size !== undefined && Number.isFinite(Number(meta.size))) size = Number(meta.size);
    if (!Number.isSafeInteger(size) || size < 0) {
      fail('Tamaño TAR no válido', 'Invalid TAR entry size');
    }
    const data = bytes.subarray(position, position + size);
    position += Math.ceil(size / 512) * 512;
    if (position > bytes.length) {
      fail('TAR truncado', 'Truncated TAR');
    }

    if (typeCode === 'L') {
      pendingName = tarString(data).replace(/\0.*$/, '');
      continue;
    }
    if (typeCode === 'K') {
      pendingLink = tarString(data).replace(/\0.*$/, '');
      continue;
    }
    if (typeCode === 'x' || typeCode === 'g') {
      const parsed = parsePax(data);
      if (typeCode === 'g') global = {...(global || {}), ...parsed};
      else extended = parsed;
      continue;
    }

    if (pendingName) {
      name = pendingName;
      pendingName = null;
    }
    if (pendingLink) {
      link = pendingLink;
      pendingLink = null;
    }
    extended = null;

    const modified = mtime ? new Date(mtime * 1000).toISOString().slice(0, 19).replace('T', ' ') : null;
    entries.push({
      name,
      path: name,
      size,
      compressedSize: null,
      modified,
      type: TAR_TYPES[typeCode] || `special-${typeCode}`,
      mode: (mode & 0x0fff).toString(8),
      uid,
      gid,
      encrypted: false,
      method: 'tar',
      link: typeCode === '1' || typeCode === '2' ? link : null,
      headerOffset: position - 512 - Math.ceil(size / 512) * 512
    });
  }
  return {format: 'tar', entries, warnings};
}

function humanSize(bytes) {
  if (!Number.isFinite(bytes)) return '?';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KiB', 'MiB', 'GiB'];
  let value = bytes / 1024;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index++;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[index]}`;
}

const WINDOWS_RESERVED = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\..*)?$/i;

function analyzeRisks(entries, archiveBytes, expandedBytes) {
  const findings = [];
  const seen = new Map();
  const seenLower = new Map();
  function add(severity, kind, entry, detailEs, detailEn, suggestion) {
    if (findings.length >= MAX_FINDINGS) return;
    findings.push({
      severity,
      kind,
      name: entry ? entry.name : null,
      size: entry ? entry.size : null,
      detail: both(detailEs, detailEn),
      suggestion: suggestion || null
    });
  }
  for (const entry of entries) {
    const normalized = entry.name.replace(/\\/g, '/');
    const segments = normalized.split('/').filter(Boolean);
    if (/^\//.test(entry.name) || /^[A-Za-z]:/.test(entry.name) || /^\\\\/.test(entry.name)) {
      add('error', 'absolute_path', entry,
        `Ruta absoluta: ${entry.name}`, `Absolute path: ${entry.name}`,
        'Extrae solo con una herramienta que ignore rutas absolutas o rearma el paquete.');
    }
    if (segments.some(segment => segment === '..')) {
      add('error', 'parent_traversal', entry,
        `Path traversal (..): ${entry.name}`, `Parent traversal (..): ${entry.name}`,
        'No extraigas este archivo hasta revisar la entrada.');
    }
    if (entry.name.includes('\\')) {
      add('warning', 'backslash_path', entry,
        `Separador de Windows: ${entry.name}`, `Windows separator: ${entry.name}`);
    }
    if (/[\x00-\x1f\x7f]/.test(entry.name)) {
      add('error', 'control_char', entry,
        `Carácter de control en el nombre: ${entry.name}`, `Control character in name: ${entry.name}`);
    }
    if (entry.type === 'symlink' || entry.type === 'hardlink') {
      add('warning', entry.type, entry,
        `Enlace (${entry.type}): ${entry.name}${entry.link ? ` -> ${entry.link}` : ''}`,
        `Link entry (${entry.type}): ${entry.name}${entry.link ? ` -> ${entry.link}` : ''}`,
        'Comprueba el destino del enlace antes de extraer.');
    }
    if (entry.type === 'device' || entry.type === 'fifo' || entry.type === 'socket') {
      add('error', 'special_file', entry,
        `Archivo especial (${entry.type}): ${entry.name}`, `Special file (${entry.type}): ${entry.name}`);
    }
    if (entry.encrypted) {
      add('error', 'encrypted', entry,
        `Entrada cifrada: ${entry.name}`, `Encrypted entry: ${entry.name}`,
        'Se necesita contraseña; esta skill no la solicita ni la guarda.');
    }
    if (seen.has(normalized)) {
      add('warning', 'duplicate', entry,
        `Entrada duplicada: ${entry.name}`, `Duplicate entry: ${entry.name}`);
    } else if (seenLower.has(normalized.toLowerCase())) {
      add('warning', 'case_collision', entry,
        `Colisión de mayúsculas: ${entry.name}`, `Case collision: ${entry.name}`);
    }
    seen.set(normalized, true);
    seenLower.set(normalized.toLowerCase(), true);
    if (segments.some(segment => WINDOWS_RESERVED.test(segment))) {
      add('warning', 'windows_reserved', entry,
        `Nombre reservado de Windows: ${entry.name}`, `Reserved Windows name: ${entry.name}`);
    }
    if (entry.size > BIG_ENTRY) {
      add('warning', 'large_entry', entry,
        `Entrada grande (${humanSize(entry.size)}): ${entry.name}`,
        `Large entry (${humanSize(entry.size)}): ${entry.name}`);
    }
    if (entry.method && /unknown|aes|deflate64|lzma/.test(entry.method)) {
      add('warning', 'compression_method', entry,
        `Método de compresión no habitual: ${entry.method}`, `Uncommon compression method: ${entry.method}`);
    }
  }
  if (expandedBytes > BIG_ENTRY * 2) {
    add('warning', 'large_archive', null,
      `Contenido expandido ${humanSize(expandedBytes)} desde ${humanSize(archiveBytes)}: revisa antes de extraer.`,
      `Expanded content ${humanSize(expandedBytes)} from ${humanSize(archiveBytes)}: review before extracting.`);
  }
  if (archiveBytes > 0 && expandedBytes / archiveBytes > 1000 && expandedBytes > 10 * 1024 * 1024) {
    add('warning', 'high_ratio', null,
      `Ratio de compresión ${Math.round(expandedBytes / archiveBytes)}x: posible bomba ZIP.`,
      `Compression ratio ${Math.round(expandedBytes / archiveBytes)}x: possible archive bomb.`);
  }
  return findings;
}

function shQuote(value) {
  return `'${asText(value).replace(/'/g, "'\\''")}'`;
}

async function readArchive(args) {
  const path = normalizePath(args.path, 'la ruta del archivo', 'file path');
  const stat = await chrome.antigem.stat({path});
  if (!stat.isFile) fail('La ruta debe ser un archivo', 'Path must be a file');
  if (stat.size > MAX_ARCHIVE_BYTES) {
    fail(`El archivo supera el límite de ${humanSize(MAX_ARCHIVE_BYTES)}`,
      `File exceeds the ${humanSize(MAX_ARCHIVE_BYTES)} limit`);
  }
  if (!stat.size) fail('El archivo está vacío', 'File is empty');
  const bytes = base64ToBytes(await chrome.antigem.readFile({path, encoding: 'base64'}));
  if (bytes.length !== stat.size) {
    throw new Error(both('El tamaño leído no coincide con el archivo', 'Read size does not match the file'));
  }
  const warnings = [];
  let parsed;
  let source = bytes;
  if (bytes[0] === 0x1f && bytes[1] === 0x8b) {
    const gz = gunzip(bytes);
    if (!gz.crcOk) warnings.push('El CRC del contenido gzip no coincide; el archivo puede estar dañado.');
    source = gz.data;
    parsed = parseTar(source, warnings);
    parsed.format = 'tar.gz';
  } else if (bytes[0] === 0x50 && bytes[1] === 0x4b) {
    parsed = parseZip(bytes, warnings);
  } else {
    parsed = parseTar(bytes, warnings);
  }
  const total = parsed.entries.reduce((sum, entry) => sum + (entry.size || 0), 0);
  if (!Number.isSafeInteger(total)) {
    fail('El tamaño total supera el rango seguro', 'Total size exceeds safe integer range');
  }
  const risks = analyzeRisks(parsed.entries, bytes.length, total);
  const files = parsed.entries.filter(entry => entry.type === 'file' || entry.type === 'regular').length;
  return {
    ok: true,
    path,
    format: parsed.format,
    size: bytes.length,
    modified: stat.modified ? new Date(stat.modified).toISOString().slice(0, 19).replace('T', ' ') : null,
    entries: parsed.entries,
    warnings,
    risks,
    summary: {
      entries: parsed.entries.length,
      files,
      directories: parsed.entries.filter(entry => entry.type === 'directory').length,
      links: parsed.entries.filter(entry => entry.type === 'symlink' || entry.type === 'hardlink').length,
      uncompressed: total,
      compressed: bytes.length,
      errors: risks.filter(item => item.severity === 'error').length,
      warnings: risks.filter(item => item.severity === 'warning').length,
      visible: 0,
      truncated: false
    }
  };
}

function publicResult(result, limit) {
  const maximum = clampInt(limit, 1, MAX_LISTED, 80);
  const visible = result.entries.slice(0, maximum);
  return {...result, entries: visible, summary: {...result.summary, visible: visible.length,
    truncated: result.entries.length > visible.length}};
}

async function archiveList(args) {
  const result = await readArchive(args);
  const output = publicResult(result, args.max_entries);
  return {...output, message: both(
    `${result.summary.entries} entradas, ${result.summary.errors} errores y ${result.summary.warnings} avisos de seguridad.`,
    `${result.summary.entries} entries, ${result.summary.errors} errors and ${result.summary.warnings} security warnings.`)};
}

async function archivePlan(args) {
  const result = await readArchive(args);
  const destination = normalizePath(args.destination, 'la carpeta de destino', 'destination directory');
  const policy = ['skip', 'overwrite'].includes(args.overwrite) ? args.overwrite : 'skip';
  const strip = clampInt(args.strip_components, 0, 20, 0);
  const errors = result.risks.filter(item => item.severity === 'error');
  const archive = shQuote(result.path);
  const target = shQuote(destination);
  const commands = [];
  const notes = [];

  if (errors.length) {
    return {
      ok: true,
      safe: false,
      format: result.format,
      summary: result.summary,
      reasons: errors.map(item => `${item.kind}: ${item.name || 'archivo'}`),
      commands: [],
      notes: [
        both('No se propone ningún comando de extracción: hay entradas peligrosas.',
          'No extraction command is proposed: dangerous entries were found.'),
        both('Revisa los hallazgos y rearma el paquete desde una carpeta limpia.',
          'Review the findings and rebuild the archive from a clean folder.')
      ],
      message: both('Extracción bloqueada por entradas peligrosas.',
        'Extraction blocked because of dangerous entries.')
    };
  }

  commands.push(`mkdir -p ${target}`);
  commands.push(`df -h ${target}`);
  commands.push(`sha256sum ${archive}`);
  if (result.format === 'zip') {
    commands.push(`unzip -l ${archive}`);
    commands.push(`unzip ${policy === 'skip' ? '-n' : '-o'} ${archive} -d ${target}`);
    notes.push(both('unzip descarta componentes .. por defecto, pero aun así revisa primero la lista.',
      'unzip strips .. components by default, but review the list first anyway.'));
  } else {
    const flags = ['--no-same-owner', '--no-same-permissions', '--no-absolute-names'];
    if (policy === 'skip') flags.push('-k');
    else flags.push('--overwrite');
    if (strip) flags.push(`--strip-components=${strip}`);
    const switchFlag = result.format === 'tar.gz' ? '-xzf' : '-xf';
    commands.push(`tar ${result.format === 'tar.gz' ? '-tzf' : '-tf'} ${archive}`);
    commands.push(`tar ${flags.join(' ')} ${switchFlag} ${archive} -C ${target}`);
    notes.push(both('--no-same-owner evita aplicar uid/gid del paquete en el teléfono.',
      '--no-same-owner prevents applying archive uid/gid on the phone.'));
  }
  commands.push(`du -sh ${target}`);
  if (result.summary.links) {
    notes.push(both('Hay enlaces: comprueba que no apunten fuera del destino.',
      'There are links: check that they do not point outside the destination.'));
  }
  notes.push(both('Ejecuta estos comandos tú en proot; el plugin nunca extrae ni ejecuta nada.',
    'Run these commands yourself in proot; the plugin never extracts or executes anything.'));
  return {
    ok: true,
    safe: true,
    format: result.format,
    destination,
    overwrite: policy,
    strip_components: strip,
    summary: result.summary,
    reasons: [],
    commands,
    notes,
    message: both(`${commands.length} comandos seguros propuestos.`,
      `${commands.length} safe commands proposed.`)
  };
}

function row(cells) {
  return `| ${cells.map(cell => asText(cell).replace(/\|/g, '\\|').replace(/\n/g, ' ')).join(' | ')} |`;
}

function renderReport(result, output) {
  const lines = [
    '# Explorador de archivos comprimidos / Archive explorer', '',
    '## ES', '',
    `- Archivo: \`${result.path}\` | Formato: ${result.format} | Tamaño: ${humanSize(result.size)}`,
    `- Entradas: ${result.summary.entries} | Sin comprimir: ${humanSize(result.summary.uncompressed)}`,
    `- Errores: ${result.summary.errors} | Avisos: ${result.summary.warnings}`,
    ''
  ];
  for (const warning of result.warnings) lines.push(`> Aviso: ${warning}`);
  if (result.warnings.length) lines.push('');
  lines.push('### Hallazgos de seguridad', '',
    row(['Gravedad', 'Tipo', 'Entrada', 'Detalle']), row(['---', '---', '---', '---']));
  for (const item of result.risks) {
    lines.push(row([item.severity, item.kind, item.name || '-', item.detail]));
  }
  if (!result.risks.length) lines.push('', 'Sin hallazgos de seguridad.');
  lines.push('', '### Entradas (primeras 100)', '',
    row(['Nombre', 'Tipo', 'Tamaño', 'Modificado']), row(['---', '---', '---', '---']));
  for (const entry of result.entries.slice(0, 100)) {
    lines.push(row([entry.name, entry.type, humanSize(entry.size), entry.modified || '-']));
  }
  lines.push('', '> El plugin solo lee el archivo: no extrae, no ejecuta y no usa la red.', '');

  lines.push('## EN', '',
    `- File: \`${result.path}\` | Format: ${result.format} | Size: ${humanSize(result.size)}`,
    `- Entries: ${result.summary.entries} | Uncompressed: ${humanSize(result.summary.uncompressed)}`,
    `- Errors: ${result.summary.errors} | Warnings: ${result.summary.warnings}`,
    '');
  for (const warning of result.warnings) lines.push(`> Warning: ${warning}`);
  if (result.warnings.length) lines.push('');
  lines.push('### Security findings', '',
    row(['Severity', 'Kind', 'Entry', 'Detail']), row(['---', '---', '---', '---']));
  for (const item of result.risks) {
    lines.push(row([item.severity, item.kind, item.name || '-', item.detail]));
  }
  if (!result.risks.length) lines.push('', 'No security findings.');
  lines.push('', '### Entries (first 100)', '',
    row(['Name', 'Type', 'Size', 'Modified']), row(['---', '---', '---', '---']));
  for (const entry of result.entries.slice(0, 100)) {
    lines.push(row([entry.name, entry.type, humanSize(entry.size), entry.modified || '-']));
  }
  lines.push('', '> The plugin only reads the file: it does not extract, execute or use the network.', '');
  if (output) lines.push(`Report: \`${output}\``, '');
  return `${lines.join('\n').replace(/\n+$/, '')}\n`;
}

async function archiveReport(args) {
  const result = await readArchive(args);
  const output = args.output == null ? '' : normalizePath(args.output, 'la ruta del informe', 'report path');
  if (output && !/\.md$/i.test(output)) fail('El informe debe ser .md', 'Report must be .md');
  const markdown = renderReport(result, output);
  const dryRun = args.dry_run !== false;
  let written = false;
  if (output && !dryRun) {
    try {
      await chrome.antigem.writeFile({path: output, data: markdown, encoding: 'utf8'});
      written = true;
    } catch (error) {
      fail(`No se pudo escribir el informe: ${error.message}`, `Could not write the report: ${error.message}`);
    }
  }
  return {
    ok: true,
    output: output || null,
    dry_run: dryRun,
    written,
    format: result.format,
    summary: result.summary,
    markdown,
    message: both('Informe del archivo listo.', 'Archive report ready.')
  };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.type !== 'mcp_tool_call') return false;
  (async () => {
    const args = message.args || {};
    if (message.tool === 'archive_list') return await archiveList(args);
    if (message.tool === 'archive_plan') return await archivePlan(args);
    if (message.tool === 'archive_report') return await archiveReport(args);
    throw new Error(`Unknown tool: ${message.tool}`);
  })().then(sendResponse, error => sendResponse({
    isError: true,
    content: [{type: 'text', text: error && error.message ? error.message : String(error)}]
  }));
  return true;
});
