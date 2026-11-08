import { versionedIndex } from "./core-values.js";

// Elizabeth's requests are stored as one status byte per slot of the game's
// VelvetRoomQuestDataAsset table (128 slots, four per word). Verified against
// the in-game request list of a SaveGameVersion 2 save (raw word 1522).
export const REQUEST_STATUS_BASE = 1518;
export const REQUEST_SLOT_COUNT = 128;

export const REQUEST_STATUSES = Object.freeze([
  { value: 0, label: "Not started" },
  { value: 1, label: "In progress" },
  { value: 3, label: "Done" },
]);

const KNOWN_STATUS_VALUES = new Set(REQUEST_STATUSES.map((status) => status.value));

export function requestStatusLabel(value) {
  return REQUEST_STATUSES.find((status) => status.value === value)?.label ?? `Unknown (${value})`;
}

function slotLocation(save, slot) {
  return {
    index: versionedIndex(save, REQUEST_STATUS_BASE) + Math.floor(slot / 4),
    shift: (slot % 4) * 8,
  };
}

function readStatus(save, slot) {
  const { index, shift } = slotLocation(save, slot);
  return (save.getWord(index) >>> shift) & 0xff;
}

// Refuse to edit when the area does not look like the request table, for
// example an unverified save layout: every byte must be a known status, and
// slots without a request must be empty.
export function getRequestAreaProblem(save, definitions) {
  if (save.isEpisodeAigis) return "Episode Aigis request editing is not supported yet.";
  const usedSlots = new Set(definitions.map((request) => request.slot));
  for (let slot = 0; slot < REQUEST_SLOT_COUNT; slot += 1) {
    const value = readStatus(save, slot);
    if (!KNOWN_STATUS_VALUES.has(value) || (value !== 0 && !usedSlots.has(slot))) {
      return "This save's request data does not match the verified layout, so editing is disabled.";
    }
  }
  return null;
}

export function getRequests(save, definitions) {
  return definitions.map((request) => ({ ...request, status: readStatus(save, request.slot) }));
}

export function setRequestStatus(save, definitions, slot, status) {
  if (!definitions.some((request) => request.slot === slot)) throw new Error("Unknown request.");
  if (!KNOWN_STATUS_VALUES.has(status)) throw new Error("Choose a supported request status.");
  const problem = getRequestAreaProblem(save, definitions);
  if (problem) throw new Error(problem);
  const { index, shift } = slotLocation(save, slot);
  const word = save.getWord(index);
  save.setWord(index, ((word & ~(0xff << shift)) | (status << shift)) >>> 0);
}
