import { PERSONA_ENTRY_WORDS, PERSONA_VALID_FLAG } from "./constants.js";
import { readPersonaSkillSlots } from "./persona-skills.js";

function wordBytes(word) {
  return [word & 0xff, (word >>> 8) & 0xff, (word >>> 16) & 0xff, (word >>> 24) & 0xff];
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

export function clearPersonaEntry(save, base) {
  for (let index = 0; index < PERSONA_ENTRY_WORDS; index += 1) {
    save.setWord(base + index, 0);
  }
}

export function initializePersonaEntry(save, base, persona, flags = PERSONA_VALID_FLAG) {
  if (
    !persona
    || !Number.isInteger(persona.id)
    || !Number.isInteger(persona.level)
    || !Array.isArray(persona.stats)
    || persona.stats.length < 5
    || persona.stats.slice(0, 5).some((stat) => !Number.isInteger(stat))
    || !Array.isArray(persona.skills)
  ) {
    throw new Error("The selected Persona does not have complete reference data.");
  }

  clearPersonaEntry(save, base);
  save.setWord(base, ((persona.id & 0xffff) << 16) | (flags & 0xffff));
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
    (strength | (magic << 8) | (endurance << 16) | (agility << 24)) >>> 0,
  );
  save.setWord(base + 8, luck);
}
