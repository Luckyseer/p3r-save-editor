import {
  PERSONA_SLOT_COUNT,
  PERSONA_STOCK_BASE,
  PERSONA_SLOT_WORDS,
} from "./constants.js";
import { unlockCompendiumPersona } from "./compendium.js";
import { versionedIndex } from "./core-values.js";
import {
  clearPersonaEntry,
  initializePersonaEntry,
  readPersonaEntry,
} from "./persona-entry.js";
import { writePersonaSkillSlot } from "./persona-skills.js";

function slotBase(save, slot) {
  if (!Number.isInteger(slot) || slot < 0 || slot >= PERSONA_SLOT_COUNT) {
    throw new Error("Invalid Persona stock slot.");
  }
  return versionedIndex(save, PERSONA_STOCK_BASE) + slot * PERSONA_SLOT_WORDS;
}

export function getPersonaStock(save) {
  return Array.from({ length: PERSONA_SLOT_COUNT }, (_, slot) => {
    const base = slotBase(save, slot);
    return {
      slot,
      ...readPersonaEntry(save, base),
    };
  });
}

export function replacePersona(save, slot, persona) {
  const duplicate = getPersonaStock(save).find(
    (entry) => entry.slot !== slot && entry.id === persona.id,
  );
  if (duplicate) throw new Error(`That Persona is already in slot ${duplicate.slot + 1}.`);

  const base = slotBase(save, slot);
  initializePersonaEntry(save, base, persona);
  // The Persona menu expects every carried Persona to have a corresponding
  // valid Compendium entry. Registering it here prevents menu-load crashes.
  unlockCompendiumPersona(save, persona);
}

export function clearPersona(save, slot) {
  clearPersonaEntry(save, slotBase(save, slot));
}

export function setPersonaValue(save, slot, field, value) {
  const base = slotBase(save, slot);
  const current = getPersonaStock(save)[slot];
  if (!current.id) throw new Error("Add a Persona to this slot first.");
  if (field === "level") {
    if (!Number.isInteger(value) || value < 1 || value > 99) {
      throw new Error("Persona level must be between 1 and 99.");
    }
    const word = save.getWord(base + 1);
    save.setWord(base + 1, (word & 0xffff0000) | value);
    return;
  }
  if (field === "experience") {
    if (!Number.isInteger(value) || value < 0 || value > 9_999_999) {
      throw new Error("Persona experience must be between 0 and 9,999,999.");
    }
    save.setWord(base + 2, value);
    return;
  }
  const statIndex = ["strength", "magic", "endurance", "agility", "luck"].indexOf(field);
  if (statIndex < 0 || !Number.isInteger(value) || value < 1 || value > 99) {
    throw new Error("Persona stats must be between 1 and 99.");
  }
  if (statIndex < 4) {
    const shift = statIndex * 8;
    const word = save.getWord(base + 7);
    save.setWord(base + 7, ((word & ~(0xff << shift)) | (value << shift)) >>> 0);
  } else {
    const word = save.getWord(base + 8);
    save.setWord(base + 8, (word & 0xffffff00) | value);
  }
}

export function setPersonaSkill(save, slot, skillSlot, skillId) {
  const base = slotBase(save, slot);
  const current = getPersonaStock(save)[slot];
  if (!current.id) throw new Error("Add a Persona to this slot first.");
  writePersonaSkillSlot(save, base, current.skillSlots, skillSlot, skillId);
}
