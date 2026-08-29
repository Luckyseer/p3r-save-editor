import {
  ITEM_BAG_ARRAY_BASE,
  ITEM_CATEGORIES,
  RECENT_ITEMS_COUNT,
  RECENT_ITEMS_OFFSET,
} from "./constants.js";

export function locateItem(itemId, version) {
  if (!Number.isInteger(itemId) || itemId < 0 || itemId > 0xffff) {
    throw new Error("This item ID is not supported.");
  }
  const category = itemId >>> 12;
  const localId = itemId & 0x0fff;
  const definition = ITEM_CATEGORIES[category];
  if (!definition || localId >= definition.size) {
    throw new Error(`Unsupported item ID 0x${itemId.toString(16).toUpperCase()}.`);
  }
  const byteOffset = definition.offset + localId;
  return {
    category,
    localId,
    arrayIndex: ITEM_BAG_ARRAY_BASE[version] + Math.floor(byteOffset / 4),
    byteLane: byteOffset % 4,
  };
}

export function getItemQuantity(save, itemId) {
  const location = locateItem(itemId, save.version);
  return (save.getWord(location.arrayIndex) >>> (location.byteLane * 8)) & 0xff;
}

function markItemRecent(save, itemId) {
  const start = ITEM_BAG_ARRAY_BASE[save.version] + RECENT_ITEMS_OFFSET / 4;
  const current = Array.from(
    { length: RECENT_ITEMS_COUNT },
    (_, index) => save.getWord(start + index),
  );
  const newEntry = (itemId & 0xffff) | 0x00010000;
  const updated = [
    newEntry,
    ...current.filter((entry) => (entry & 0xffff) !== itemId),
  ].slice(0, RECENT_ITEMS_COUNT);
  updated.forEach((value, index) => save.setWord(start + index, value));
}

export function setItemQuantity(save, itemId, quantity) {
  if (!Number.isInteger(quantity) || quantity < 0 || quantity > 99) {
    throw new Error("Item quantity must be between 0 and 99.");
  }
  const location = locateItem(itemId, save.version);
  const oldQuantity = getItemQuantity(save, itemId);
  const shift = location.byteLane * 8;
  const oldWord = save.getWord(location.arrayIndex);
  const newWord = (oldWord & ~(0xff << shift)) | (quantity << shift);
  save.setWord(location.arrayIndex, newWord >>> 0);
  if (quantity > oldQuantity && quantity > 0) markItemRecent(save, itemId);
  return { oldQuantity, newQuantity: quantity, location };
}
