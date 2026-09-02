import { PARTY_MEMBERS } from "./constants.js";
import { versionedIndex } from "./core-values.js";
import { readPersonaSkillSlots, writePersonaSkillSlot } from "./persona-skills.js";

const supportingParty = PARTY_MEMBERS.filter((member) => member.key !== "protagonist");

function findMember(memberKey) {
  return supportingParty.find((member) => member.key === memberKey);
}

function personaBase(save, member) {
  return versionedIndex(save, member.personaBase);
}

function readPartyPersona(save, member) {
  const base = personaBase(save, member);
  const identity = save.getWord(base);
  const skillSlots = readPersonaSkillSlots(save, base);
  return {
    memberKey: member.key,
    memberName: member.name,
    id: (identity >>> 16) & 0xffff,
    skillSlots,
    skills: skillSlots.filter(Boolean),
  };
}

export function getPartyPersonas(save) {
  return supportingParty.map((member) => readPartyPersona(save, member));
}

export function setPartyPersonaSkill(save, memberKey, skillSlot, skillId) {
  const member = findMember(memberKey);
  if (!member) throw new Error("Unknown party member.");

  const current = readPartyPersona(save, member);
  if (!current.id) throw new Error(`${member.name} does not have an active Persona in this save.`);
  writePersonaSkillSlot(
    save,
    personaBase(save, member),
    current.skillSlots,
    skillSlot,
    skillId,
  );
}
