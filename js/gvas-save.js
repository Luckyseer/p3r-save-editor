import {
  P3R_CLASS_MARKER,
  PLAY_TIME_TICKS_PER_SECOND,
  SUPPORTED_VERSIONS,
} from "./constants.js";
import {
  concatBytes,
  containsAscii,
  findBytes,
  fstring,
  readFString,
  readUint32,
  uint32Bytes,
  writeUint32,
} from "./binary.js";

function propertyPrefix(name, type, size) {
  return concatBytes(fstring(name), fstring(type), uint32Bytes(size));
}

export const SAVE_DATA_PREFIX = propertyPrefix("SaveDataArea", "UInt32Property", 4);
export const SAVE_DATA_RECORD_SIZE = SAVE_DATA_PREFIX.length + 4 + 1 + 4;

export class P3RSave {
  constructor(decrypted) {
    this.bytes = decrypted.slice();
    this.version = readUint32(this.bytes, 4);
    if (!SUPPORTED_VERSIONS.has(this.version)) {
      throw new Error(`Unsupported save version ${this.version}.`);
    }
    if (!containsAscii(this.bytes, P3R_CLASS_MARKER)) {
      throw new Error("This decrypted file is not a Persona 3 Reload save.");
    }
    this.reindex();
  }

  reindex() {
    this.records = [];
    this.recordMap = new Map();
    let searchFrom = 0;
    while (true) {
      const offset = findBytes(this.bytes, SAVE_DATA_PREFIX, searchFrom);
      if (offset < 0) break;
      const indexOffset = offset + SAVE_DATA_PREFIX.length;
      const valueOffset = indexOffset + 5;
      if (valueOffset + 4 <= this.bytes.length && this.bytes[indexOffset + 4] === 0) {
        const record = {
          offset,
          arrayIndex: readUint32(this.bytes, indexOffset),
          valueOffset,
          value: readUint32(this.bytes, valueOffset),
        };
        this.records.push(record);
        if (this.recordMap.has(record.arrayIndex)) {
          throw new Error("SaveDataArea contains duplicate array indexes.");
        }
        this.recordMap.set(record.arrayIndex, record);
      }
      searchFrom = offset + 1;
    }

    if (this.records.length < 100) {
      throw new Error("The save contains too few SaveDataArea records.");
    }
    for (let index = 1; index < this.records.length; index += 1) {
      if (this.records[index - 1].arrayIndex >= this.records[index].arrayIndex) {
        throw new Error("SaveDataArea records are not uniquely sorted.");
      }
    }
  }

  getWord(arrayIndex) {
    return this.recordMap.get(arrayIndex)?.value ?? 0;
  }

  setWord(arrayIndex, value) {
    const normalized = Number(value) >>> 0;
    const existing = this.recordMap.get(arrayIndex);
    if (existing) {
      writeUint32(this.bytes, existing.valueOffset, normalized);
      existing.value = normalized;
      return;
    }
    if (normalized === 0) return;

    const next = this.records.find((record) => record.arrayIndex > arrayIndex);
    const insertAt = next
      ? next.offset
      : this.records[this.records.length - 1].offset + SAVE_DATA_RECORD_SIZE;
    const record = concatBytes(
      SAVE_DATA_PREFIX,
      uint32Bytes(arrayIndex),
      Uint8Array.of(0),
      uint32Bytes(normalized),
    );
    this.bytes = concatBytes(this.bytes.slice(0, insertAt), record, this.bytes.slice(insertAt));
    this.reindex();
  }

  findProperty(name, type, size, occurrence = 0) {
    const prefix = propertyPrefix(name, type, size);
    let searchFrom = 0;
    let found = 0;
    while (true) {
      const offset = findBytes(this.bytes, prefix, searchFrom);
      if (offset < 0) return null;
      const indexOffset = offset + prefix.length;
      const valueOffset = indexOffset + 5;
      if (valueOffset + size <= this.bytes.length && this.bytes[indexOffset + 4] === 0) {
        if (found === occurrence) return { offset, indexOffset, valueOffset };
        found += 1;
      }
      searchFrom = offset + 1;
    }
  }

  readHeaderNumber(name, type = "IntProperty", size = 4) {
    const property = this.findProperty(name, type, size);
    if (!property) return null;
    const view = new DataView(this.bytes.buffer, this.bytes.byteOffset, this.bytes.byteLength);
    if (size === 1) return view.getUint8(property.valueOffset);
    if (size === 2) return view.getUint16(property.valueOffset, true);
    return view.getUint32(property.valueOffset, true);
  }

  writeHeaderNumber(name, value, type = "UInt32Property", size = 4) {
    const property = this.findProperty(name, type, size);
    if (!property) throw new Error(`Header property ${name} was not found.`);
    const view = new DataView(this.bytes.buffer, this.bytes.byteOffset, this.bytes.byteLength);
    if (size === 1) view.setUint8(property.valueOffset, value);
    else if (size === 2) view.setUint16(property.valueOffset, value, true);
    else view.setUint32(property.valueOffset, value >>> 0, true);
  }

  readHeaderString(name) {
    const prefix = concatBytes(fstring(name), fstring("StrProperty"));
    const offset = findBytes(this.bytes, prefix);
    if (offset < 0) return null;
    const sizeOffset = offset + prefix.length;
    if (sizeOffset + 9 > this.bytes.length) return null;
    const size = readUint32(this.bytes, sizeOffset);
    const indexOffset = sizeOffset + 4;
    const valueOffset = indexOffset + 5;
    if (
      this.bytes[indexOffset + 4] !== 0 ||
      size < 4 ||
      valueOffset + size > this.bytes.length
    ) return null;
    try {
      return readFString(this.bytes, valueOffset).value;
    } catch {
      return null;
    }
  }

  readHeaderEnum(name) {
    const prefix = concatBytes(fstring(name), fstring("EnumProperty"));
    const offset = findBytes(this.bytes, prefix);
    if (offset < 0) return null;
    // UE serializes EnumProperty as size, array index, enum type FString,
    // property-GUID marker, then the enum value FString. Parsing the exact
    // boundaries prevents a nearby enum property from being mistaken for this
    // one (Week is immediately followed by TimeZone in P3R headers).
    try {
      const sizeOffset = offset + prefix.length;
      const payloadSize = readUint32(this.bytes, sizeOffset);
      const enumType = readFString(this.bytes, sizeOffset + 8);
      const guidMarkerOffset = enumType.nextOffset;
      if (this.bytes[guidMarkerOffset] !== 0) return null;
      const enumValue = readFString(this.bytes, guidMarkerOffset + 1);
      if (enumValue.nextOffset - (guidMarkerOffset + 1) !== payloadSize) return null;
      return enumValue.value.split("::").at(-1) || null;
    } catch {
      return null;
    }
  }

  readHeaderByteString(name) {
    return this.findHeaderByteProperties(name)
      .sort((left, right) => left.arrayIndex - right.arrayIndex)
      .map(({ valueOffset }) => String.fromCharCode(this.bytes[valueOffset]))
      .join("");
  }

  findStructProperty(name) {
    const prefix = concatBytes(fstring(name), fstring("StructProperty"));
    const offset = findBytes(this.bytes, prefix);
    if (offset < 0) return null;
    const sizeOffset = offset + prefix.length;
    if (sizeOffset + 8 > this.bytes.length) return null;

    try {
      const size = readUint32(this.bytes, sizeOffset);
      const structType = readFString(this.bytes, sizeOffset + 8);
      const structIdOffset = structType.nextOffset;
      const guidMarkerOffset = structIdOffset + 16;
      const hasPropertyGuid = this.bytes[guidMarkerOffset];
      if (hasPropertyGuid !== 0 && hasPropertyGuid !== 1) return null;
      const payloadOffset = guidMarkerOffset + 1 + (hasPropertyGuid ? 16 : 0);
      if (payloadOffset + size > this.bytes.length) return null;
      return {
        offset,
        sizeOffset,
        size,
        structType: structType.value,
        payloadOffset,
        declaredEnd: payloadOffset + size,
      };
    } catch {
      return null;
    }
  }

  validateHeaderContainer() {
    const container = this.findStructProperty("SaveDataHeadder");
    if (!container) throw new Error("The save header container was not found.");
    if (container.declaredEnd !== this.records[0].offset) {
      throw new Error("The save header length does not match its contents.");
    }
  }

  findHeaderByteProperties(name) {
    const prefix = propertyPrefix(name, "Int8Property", 1);
    const properties = [];
    const headerEnd = this.records[0]?.offset ?? this.bytes.length;
    let searchFrom = 0;
    while (true) {
      const offset = findBytes(this.bytes, prefix, searchFrom);
      if (offset < 0 || offset >= headerEnd) break;
      const indexOffset = offset + prefix.length;
      const valueOffset = indexOffset + 5;
      if (valueOffset < headerEnd && this.bytes[indexOffset + 4] === 0) {
        properties.push({
          offset,
          arrayIndex: readUint32(this.bytes, indexOffset),
          valueOffset,
          endOffset: valueOffset + 1,
        });
      }
      searchFrom = offset + 1;
    }
    return properties;
  }

  writeHeaderByteString(name, value) {
    const container = this.findStructProperty("SaveDataHeadder");
    if (!container) throw new Error("The save header container was not found.");
    const properties = this.findHeaderByteProperties(name);
    if (!properties.length) throw new Error(`Header property ${name} was not found.`);
    for (let index = 0; index < properties.length; index += 1) {
      if (properties[index].arrayIndex !== index) {
        throw new Error(`Header property ${name} uses an unsupported character layout.`);
      }
      if (index > 0 && properties[index - 1].endOffset !== properties[index].offset) {
        throw new Error(`Header property ${name} is not stored contiguously.`);
      }
    }

    const prefix = propertyPrefix(name, "Int8Property", 1);
    const replacement = concatBytes(...[...value].map((character, index) => concatBytes(
      prefix,
      uint32Bytes(index),
      Uint8Array.of(0, character.charCodeAt(0)),
    )));
    const start = properties[0].offset;
    const end = properties.at(-1).endOffset;
    if (start < container.payloadOffset || end > this.records[0].offset) {
      throw new Error(`Header property ${name} is outside the save header container.`);
    }
    const replacementDelta = replacement.length - (end - start);
    const actualPayloadSize = this.records[0].offset - container.payloadOffset;
    this.bytes = concatBytes(this.bytes.slice(0, start), replacement, this.bytes.slice(end));
    writeUint32(this.bytes, container.sizeOffset, actualPayloadSize + replacementDelta);
    this.reindex();
    this.validateHeaderContainer();
  }

  getHeader() {
    const playTimeTicks = this.readHeaderNumber("PlayTime", "UInt32Property", 4);
    return {
      slotName: this.readHeaderString("SaveSlotName"),
      firstName: this.readHeaderByteString("FirstName"),
      lastName: this.readHeaderByteString("LastName"),
      month: this.readHeaderNumber("Month"),
      day: this.readHeaderNumber("Day"),
      week: this.readHeaderEnum("Week"),
      timeZone: this.readHeaderEnum("TimeZone"),
      playerLevel: this.readHeaderNumber("PlayerLevel", "UInt32Property", 4),
      difficulty: this.readHeaderNumber("Difficulty", "UInt16Property", 2),
      playTime: playTimeTicks === null
        ? null
        : Math.floor(playTimeTicks / PLAY_TIME_TICKS_PER_SECOND),
    };
  }
}
