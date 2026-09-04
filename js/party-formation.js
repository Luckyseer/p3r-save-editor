import {
  MAX_PARTY_ALLIES,
  PARTY_FORMATION_BASE,
  PARTY_FORMATION_WORD_COUNT,
  PARTY_MEMBERS,
} from "./constants.js";
import { versionedIndex } from "./core-values.js";

const protagonist = PARTY_MEMBERS.find((member) => member.key === "protagonist");
const combatAllies = PARTY_MEMBERS.filter(
  (member) => member.key !== "protagonist" && !member.navigator,
);

function readFormationIds(save) {
  const ids = [];
  const base = versionedIndex(save, PARTY_FORMATION_BASE);
  for (let wordIndex = 0; wordIndex < PARTY_FORMATION_WORD_COUNT; wordIndex += 1) {
    const word = save.getWord(base + wordIndex);
    ids.push(word & 0xffff, (word >>> 16) & 0xffff);
  }
  const firstEmpty = ids.indexOf(0);
  const activeIds = firstEmpty < 0 ? ids : ids.slice(0, firstEmpty);
  if (firstEmpty >= 0 && ids.slice(firstEmpty).some(Boolean)) {
    throw new Error("The current party list is not stored contiguously.");
  }
  return activeIds;
}

export function getCombatAllies() {
  return combatAllies;
}

export function getPartyFormation(save) {
  return readFormationIds(save).map((id) => (
    PARTY_MEMBERS.find((member) => member.id === id)
    ?? { id, key: `unknown-${id}`, name: `Unknown member ${id}`, unknown: true }
  ));
}

export function setPartyFormation(save, allyKeys) {
  if (!Array.isArray(allyKeys) || allyKeys.length > MAX_PARTY_ALLIES) {
    throw new Error(`Choose no more than ${MAX_PARTY_ALLIES} party members.`);
  }
  if (new Set(allyKeys).size !== allyKeys.length) {
    throw new Error("Each party member can only be selected once.");
  }

  const allies = allyKeys.map((key) => {
    const member = combatAllies.find((entry) => entry.key === key);
    if (!member) throw new Error("Choose a valid combat party member.");
    return member;
  });
  const ids = [protagonist.id, ...allies.map((member) => member.id)];
  const paddedIds = [...ids, ...Array(10 - ids.length).fill(0)];
  const base = versionedIndex(save, PARTY_FORMATION_BASE);
  for (let wordIndex = 0; wordIndex < PARTY_FORMATION_WORD_COUNT; wordIndex += 1) {
    const lower = paddedIds[wordIndex * 2];
    const upper = paddedIds[(wordIndex * 2) + 1];
    save.setWord(base + wordIndex, (lower | (upper << 16)) >>> 0);
  }
}
