import { PERSONA_ENTRY_WORDS, PERSONA_VALID_FLAG } from "./constants.js";
import { readPersonaSkillSlots } from "./persona-skills.js";

function wordBytes(word) {
  return [word & 0xff, (word >>> 8) & 0xff, (word >>> 16) & 0xff, (word >>> 24) & 0xff];
}

// Persona EXP is cumulative, not progress since its base level. A zero-filled
// EXP word is inconsistent with a newly registered Persona above level 1.
// Source: https://steamcommunity.com/sharedfiles/filedetails/?id=3230774091
// (Experience and Levels). Both the main game and Episode Aigis use this curve;
// the base level must come from the corresponding game's reference data.
function basePersonaExperience(level) {
  return level === 1 ? 0 : Math.floor(level ** 3 * (4.34 - 0.0266 * level) + 10);
}

export function readPersonaEntry(save, base) {
  const identity = save.getWord(base);
  const skillSlots = readPersonaSkillSlots(save, base);
  return {
    flags: identity & 0xffff,
    id: (identity >>> 16) & 0xffff,
    level: save.getWord(base + 1) & 0xffff,
    experience: save.getWord(base + 2),
    skillSlots,
    skills: skillSlots.filter(Boolean),
    stats: [...wordBytes(save.getWord(base + 7)), save.getWord(base + 8) & 0xff],
  };
}

export function personaEntryWords(persona, flags = PERSONA_VALID_FLAG) {
  if (
    !persona
    || !Number.isInteger(persona.id)
    || !Number.isInteger(persona.level)
    || persona.level < 1
    || persona.level > 99
    || !Array.isArray(persona.stats)
    || persona.stats.length < 5
    || persona.stats.slice(0, 5).some((stat) => !Number.isInteger(stat))
    || !Array.isArray(persona.skills)
  ) {
    throw new Error("The selected Persona does not have complete reference data.");
  }

  const words = Array(PERSONA_ENTRY_WORDS).fill(0);
  words[0] = ((persona.id & 0xffff) << 16) | (flags & 0xffff);
  words[1] = persona.level & 0xffff;
  words[2] = basePersonaExperience(persona.level);
  for (let index = 0; index < 4; index += 1) {
    const low = persona.skills[index * 2]?.id ?? 0;
    const high = persona.skills[index * 2 + 1]?.id ?? 0;
    words[3 + index] = ((high & 0xffff) << 16) | (low & 0xffff);
  }
  const [strength, magic, endurance, agility, luck] = persona.stats;
  words[7] = (strength | (magic << 8) | (endurance << 16) | (agility << 24)) >>> 0;
  words[8] = luck;
  return words;
}

export function personaEntryUpdates(base, persona, flags = PERSONA_VALID_FLAG) {
  return personaEntryWords(persona, flags).map((value, index) => [base + index, value]);
}

export function clearPersonaEntry(save, base) {
  save.setWords(Array.from(
    { length: PERSONA_ENTRY_WORDS },
    (_, index) => [base + index, 0],
  ));
}

export function initializePersonaEntry(save, base, persona, flags = PERSONA_VALID_FLAG) {
  save.setWords(personaEntryUpdates(base, persona, flags));
}
