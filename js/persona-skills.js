export const PERSONA_SKILL_SLOT_COUNT = 8;

export function readPersonaSkillSlots(save, personaBase) {
  const skillSlots = [];
  for (let index = 0; index < PERSONA_SKILL_SLOT_COUNT / 2; index += 1) {
    const word = save.getWord(personaBase + 3 + index);
    skillSlots.push(word & 0xffff, (word >>> 16) & 0xffff);
  }
  return skillSlots;
}

export function writePersonaSkillSlot(save, personaBase, currentSlots, skillSlot, skillId) {
  if (!Number.isInteger(skillSlot) || skillSlot < 0 || skillSlot >= PERSONA_SKILL_SLOT_COUNT) {
    throw new Error("Persona skill slot must be between 1 and 8.");
  }
  if (!Number.isInteger(skillId) || skillId < 0 || skillId > 0xffff) {
    throw new Error("This Persona skill is not supported.");
  }

  const duplicate = currentSlots.findIndex(
    (existingId, index) => index !== skillSlot && existingId === skillId && skillId !== 0,
  );
  if (duplicate >= 0) {
    throw new Error(`That skill is already in skill slot ${duplicate + 1}.`);
  }

  const wordIndex = personaBase + 3 + Math.floor(skillSlot / 2);
  const oldWord = save.getWord(wordIndex);
  const updated = skillSlot % 2 === 0
    ? (oldWord & 0xffff0000) | skillId
    : (oldWord & 0x0000ffff) | (skillId << 16);
  save.setWord(wordIndex, updated >>> 0);
}
