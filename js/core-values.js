import {
  CORE_FIELDS,
  PARTY_MEMBERS,
  PLAYER_FULL_NAME_INDEX,
  PLAYER_NAME_BUFFER_WORD_COUNT,
  PLAYER_NAME_FIELDS,
  PLAYER_NAME_MAX_LENGTH,
  PLAY_TIME_TICKS_PER_SECOND,
  SOCIAL_LINKS,
  SOCIAL_STATS,
  VERSION_INDEX_OFFSET,
} from "./constants.js";

export function versionedIndex(save, versionOneIndex) {
  return versionOneIndex + VERSION_INDEX_OFFSET[save.version];
}

export function getCoreValues(save) {
  return Object.fromEntries(
    Object.entries(CORE_FIELDS).map(([key, field]) => {
      const storedValue = save.getWord(versionedIndex(save, field.index));
      const value = key === "playTime"
        ? Math.floor(storedValue / PLAY_TIME_TICKS_PER_SECOND)
        : storedValue;
      return [key, value];
    }),
  );
}

export function setCoreValue(save, key, value) {
  const field = CORE_FIELDS[key];
  if (!field) throw new Error(`Unknown core value ${key}.`);
  if (!Number.isInteger(value) || value < field.min || value > field.max) {
    throw new Error(`${field.label} must be between ${field.min} and ${field.max}.`);
  }
  const storedValue = key === "playTime" ? value * PLAY_TIME_TICKS_PER_SECOND : value;
  save.setWord(versionedIndex(save, field.index), storedValue);
  if (key === "playTime") save.writeHeaderNumber("PlayTime", storedValue);
}

function writePlayerNameBuffer(save, versionOneIndex, value) {
  if (value.length >= PLAYER_NAME_BUFFER_WORD_COUNT * 4) {
    throw new Error("The combined protagonist name is too long for the save format.");
  }
  for (let wordIndex = 0; wordIndex < PLAYER_NAME_BUFFER_WORD_COUNT; wordIndex += 1) {
    let packed = 0;
    for (let byteIndex = 0; byteIndex < 4; byteIndex += 1) {
      const characterIndex = (wordIndex * 4) + byteIndex;
      if (characterIndex < value.length) {
        packed |= value.charCodeAt(characterIndex) << (byteIndex * 8);
      }
    }
    save.setWord(versionedIndex(save, versionOneIndex + wordIndex), packed >>> 0);
  }
}

export function setPlayerName(save, key, value) {
  const field = PLAYER_NAME_FIELDS[key];
  if (!field) throw new Error("Unknown protagonist name field.");
  if (typeof value !== "string" || value.length < 1 || value.length > PLAYER_NAME_MAX_LENGTH) {
    throw new Error(`${field.label} must contain 1 to ${PLAYER_NAME_MAX_LENGTH} characters.`);
  }
  if ([...value].some((character) => {
    const code = character.charCodeAt(0);
    return code < 0x20 || code > 0x7e;
  })) {
    throw new Error(`${field.label} can only use basic English letters, numbers, spaces, and punctuation.`);
  }
  if (!value.trim()) throw new Error(`${field.label} cannot be blank.`);

  const names = save.getHeader();
  names[key] = value;
  save.writeHeaderByteString(field.headerName, value);
  writePlayerNameBuffer(save, PLAYER_NAME_FIELDS.firstName.index, names.firstName);
  writePlayerNameBuffer(save, PLAYER_NAME_FIELDS.lastName.index, names.lastName);
  writePlayerNameBuffer(
    save,
    PLAYER_FULL_NAME_INDEX,
    [names.firstName, names.lastName].filter(Boolean).join(" "),
  );
}

export function getParty(save) {
  return PARTY_MEMBERS.map((member) => ({
    ...member,
    hp: save.getWord(versionedIndex(save, member.hp)),
    sp: save.getWord(versionedIndex(save, member.sp)),
    level: save.getWord(versionedIndex(save, member.level)) & 0xffff,
    experience: save.getWord(versionedIndex(save, member.experience)),
  }));
}

export function setPartyValue(save, memberKey, field, value) {
  const member = PARTY_MEMBERS.find((entry) => entry.key === memberKey);
  if (!member || !["hp", "sp", "level", "experience"].includes(field)) {
    throw new Error("Unknown party field.");
  }
  const ranges = {
    hp: [0, 9999],
    sp: [0, 9999],
    level: [1, 99],
    experience: [0, 9_999_999],
  };
  const [minimum, maximum] = ranges[field];
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${field} must be between ${minimum} and ${maximum}.`);
  }
  const index = versionedIndex(save, member[field]);
  if (field === "level") {
    const oldWord = save.getWord(index);
    save.setWord(index, (oldWord & 0xffff0000) | value);
    if (member.key === "protagonist") save.writeHeaderNumber("PlayerLevel", value);
  } else {
    save.setWord(index, value);
  }
}

export function getSocialData(save) {
  return {
    stats: SOCIAL_STATS.map((field) => ({
      ...field,
      value: save.getWord(versionedIndex(save, field.index)),
    })),
    links: SOCIAL_LINKS.map((link) => ({
      ...link,
      rank: save.getWord(versionedIndex(save, link.index)) & 0xff,
    })),
  };
}

export function setSocialStat(save, key, value) {
  const field = SOCIAL_STATS.find((entry) => entry.key === key);
  if (!field) throw new Error("Unknown social stat.");
  if (!Number.isInteger(value) || value < 0 || value > 255) {
    throw new Error("Social stat points must be between 0 and 255.");
  }
  save.setWord(versionedIndex(save, field.index), value);
}

export function setSocialLinkRank(save, versionOneIndex, rank) {
  if (!Number.isInteger(rank) || rank < 0 || rank > 10) {
    throw new Error("Social Link rank must be between 0 and 10.");
  }
  const index = versionedIndex(save, versionOneIndex);
  const oldWord = save.getWord(index);
  save.setWord(index, (oldWord & 0xffffff00) | rank);
}
