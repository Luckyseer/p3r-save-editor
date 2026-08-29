export function concatBytes(...chunks) {
  const length = chunks.reduce((total, chunk) => total + chunk.length, 0);
  const output = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }
  return output;
}

export function uint32Bytes(value) {
  const output = new Uint8Array(4);
  new DataView(output.buffer).setUint32(0, value >>> 0, true);
  return output;
}

export function readUint32(bytes, offset) {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(
    offset,
    true,
  );
}

export function writeUint32(bytes, offset, value) {
  new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).setUint32(
    offset,
    value >>> 0,
    true,
  );
}

export function fstring(value) {
  const encoded = new TextEncoder().encode(value);
  return concatBytes(uint32Bytes(encoded.length + 1), encoded, Uint8Array.of(0));
}

export function readFString(bytes, offset) {
  const length = readUint32(bytes, offset);
  if (length < 1 || offset + 4 + length > bytes.length) {
    throw new Error("Invalid Unreal string in save header.");
  }
  const value = new TextDecoder().decode(bytes.slice(offset + 4, offset + 3 + length));
  return { value, nextOffset: offset + 4 + length };
}

export function findBytes(haystack, needle, start = 0) {
  if (needle.length === 0) return start;
  const last = haystack.length - needle.length;
  outer: for (let index = start; index <= last; index += 1) {
    for (let inner = 0; inner < needle.length; inner += 1) {
      if (haystack[index + inner] !== needle[inner]) continue outer;
    }
    return index;
  }
  return -1;
}

export function startsWithBytes(value, prefix) {
  if (value.length < prefix.length) return false;
  return prefix.every((byte, index) => value[index] === byte);
}

export function containsAscii(bytes, value) {
  return findBytes(bytes, new TextEncoder().encode(value)) >= 0;
}

export function toHex(value, width = 8) {
  return `0x${(value >>> 0).toString(16).toUpperCase().padStart(width, "0")}`;
}

export function bytesEqual(left, right) {
  return left.length === right.length && left.every((byte, index) => byte === right[index]);
}

