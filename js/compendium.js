import {
  COMPENDIUM_BASE,
  COMPENDIUM_ENTRY_COUNT,
  PERSONA_ENTRY_WORDS,
  PERSONA_VALID_FLAG,
} from "./constants.js";
import { versionedIndex } from "./core-values.js";
import {
  clearPersonaEntry,
  personaEntryUpdates,
  readPersonaEntry,
} from "./persona-entry.js";

function entryBase(save, personaId) {
  if (!Number.isInteger(personaId) || personaId < 0 || personaId >= COMPENDIUM_ENTRY_COUNT) {
    throw new Error("That Persona ID is outside the supported Compendium range.");
  }
  return versionedIndex(save, COMPENDIUM_BASE) + (personaId * PERSONA_ENTRY_WORDS);
}

export function getCompendiumEntry(save, persona) {
  const entry = readPersonaEntry(save, entryBase(save, persona.id));
  return {
    ...persona,
    registeredId: entry.id,
    flags: entry.flags,
    registeredLevel: entry.level,
    unlocked: entry.id === persona.id && Boolean(entry.flags & PERSONA_VALID_FLAG),
  };
}

export function getCompendium(save, personas) {
  return personas.map((persona) => getCompendiumEntry(save, persona));
}

export function isCompendiumUnlocked(save, personaId) {
  const entry = readPersonaEntry(save, entryBase(save, personaId));
  return entry.id === personaId && Boolean(entry.flags & PERSONA_VALID_FLAG);
}

export function unlockCompendiumPersona(save, persona) {
  return unlockCompendiumPersonas(save, [persona]).length === 1;
}

export function unlockCompendiumPersonas(save, personas) {
  const targets = personas.filter((persona, index, all) => (
    all.findIndex((entry) => entry.id === persona.id) === index
    && !isCompendiumUnlocked(save, persona.id)
  ));
  if (!targets.length) return [];
  save.setWords(targets.flatMap((persona) => personaEntryUpdates(
    entryBase(save, persona.id),
    persona,
    PERSONA_VALID_FLAG,
  )));
  return targets;
}

export function setCompendiumUnlocked(save, persona, unlocked) {
  if (typeof unlocked !== "boolean") throw new Error("Compendium state must be locked or unlocked.");
  if (unlocked) return unlockCompendiumPersona(save, persona);
  if (!isCompendiumUnlocked(save, persona.id)) return false;
  clearPersonaEntry(save, entryBase(save, persona.id));
  return true;
}
