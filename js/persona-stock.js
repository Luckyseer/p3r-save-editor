import {
  PERSONA_SLOT_COUNT,
  PERSONA_SLOT_WORDS,
  PERSONA_STOCK_BASE,
} from "./constants.js";
import { versionedIndex } from "./core-values.js";

function slotBase(save, slot) {
  if (!Number.isInteger(slot) || slot < 0 || slot >= PERSONA_SLOT_COUNT) {
    throw new Error("Invalid Persona stock slot.");
  }
  return versionedIndex(save, PERSONA_STOCK_BASE) + slot * PERSONA_SLOT_WORDS;
}

function wordBytes(word) {
  return [word & 0xff, (word >>> 8) & 0xff, (word >>> 16) & 0xff, (word >>> 24) & 0xff];
}

export function getPersonaStock(save) {
  return Array.from({ length: PERSONA_SLOT_COUNT }, (_, slot) => {
    const base = slotBase(save, slot);
    const identity = save.getWord(base);
    const stats = wordBytes(save.getWord(base + 7));
    const skillSlots = [];
    for (let index = 0; index < 4; index += 1) {
      const word = save.getWord(base + 3 + index);
      const low = word & 0xffff;
      const high = (word >>> 16) & 0xffff;
      skillSlots.push(low, high);
    }
    return {
      slot,
      flags: identity & 0xffff,
      id: (identity >>> 16) & 0xffff,
      level: save.getWord(base + 1) & 0xffff,
      experience: save.getWord(base + 2),
      skillSlots,
      skills: skillSlots.filter(Boolean),
      stats: [...stats, save.getWord(base + 8) & 0xff],
    };
  });
}

export function replacePersona(save, slot, persona) {
  const duplicate = getPersonaStock(save).find(
    (entry) => entry.slot !== slot && entry.id === persona.id,
  );
  if (duplicate) throw new Error(`That Persona is already in slot ${duplicate.slot + 1}.`);

  const base = slotBase(save, slot);
  for (let index = 0; index < PERSONA_SLOT_WORDS; index += 1) {
    save.setWord(base + index, 0);
  }
  save.setWord(base, ((persona.id & 0xffff) << 16) | 1);
  save.setWord(base + 1, persona.level & 0xffff);
  save.setWord(base + 2, 0);
  for (let index = 0; index < 4; index += 1) {
    const low = persona.skills[index * 2]?.id ?? 0;
    const high = persona.skills[index * 2 + 1]?.id ?? 0;
    save.setWord(base + 3 + index, ((high & 0xffff) << 16) | (low & 0xffff));
  }
  const [strength, magic, endurance, agility, luck] = persona.stats;
  save.setWord(
    base + 7,
    strength | (magic << 8) | (endurance << 16) | (agility << 24),
  );
  save.setWord(base + 8, luck);
}

export function clearPersona(save, slot) {
  const base = slotBase(save, slot);
  for (let index = 0; index < PERSONA_SLOT_WORDS; index += 1) {
    save.setWord(base + index, 0);
  }
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
  if (!Number.isInteger(skillSlot) || skillSlot < 0 || skillSlot >= 8) {
    throw new Error("Persona skill slot must be between 1 and 8.");
  }
  if (!Number.isInteger(skillId) || skillId < 0 || skillId > 0xffff) {
    throw new Error("This Persona skill is not supported.");
  }
  const duplicate = current.skillSlots.findIndex(
    (existingId, index) => index !== skillSlot && existingId === skillId && skillId !== 0,
  );
  if (duplicate >= 0) {
    throw new Error(`That skill is already in skill slot ${duplicate + 1}.`);
  }

  const wordIndex = base + 3 + Math.floor(skillSlot / 2);
  const oldWord = save.getWord(wordIndex);
  const updated = skillSlot % 2 === 0
    ? (oldWord & 0xffff0000) | skillId
    : (oldWord & 0x0000ffff) | (skillId << 16);
  save.setWord(wordIndex, updated >>> 0);
}
