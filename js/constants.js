export const GVAS_MAGIC = Uint8Array.of(0x47, 0x56, 0x41, 0x53);
export const STEAM_MAGIC = Uint8Array.of(0x15, 0x00, 0x65, 0x0b);
export const STEAM_KEY = new TextEncoder().encode(
  "ae5zeitaix1joowooNgie3fahP5Ohph",
);
export const P3R_CLASS_MARKER = "/Script/xrd777.XRD777SaveGame\0";

export const SUPPORTED_VERSIONS = new Set([1, 2]);
export const VERSION_INDEX_OFFSET = Object.freeze({ 1: 0, 2: 4 });
// P3R stores this counter at 30 ticks per elapsed second. Its maximum stored
// value of 107,998,200 corresponds to the game's 999h 59m display limit.
export const PLAY_TIME_TICKS_PER_SECOND = 30;
export const MAX_PLAY_TIME_SECONDS = (999 * 3600) + (59 * 60);

// The serialized ItemBag begins 12 bytes earlier than the current in-memory
// UGlobalWork declaration. These bases were verified against three real Steam
// SaveGameVersion 2 files and their recent-item acquisition history.
export const ITEM_BAG_ARRAY_BASE = Object.freeze({ 1: 5368, 2: 5372 });
export const RECENT_ITEMS_OFFSET = 0x1d00;
export const RECENT_ITEMS_COUNT = 30;

export const ITEM_CATEGORIES = Object.freeze({
  0: { name: "Weapons", offset: 0x0000, size: 1024 },
  1: { name: "Armor", offset: 0x0400, size: 1024 },
  2: { name: "Footwear", offset: 0x0800, size: 1024 },
  3: { name: "Accessories", offset: 0x0c00, size: 512 },
  4: { name: "Items", offset: 0x0e00, size: 1024 },
  5: { name: "Event Items", offset: 0x1200, size: 256 },
  6: { name: "Materials", offset: 0x1300, size: 1024 },
  7: { name: "Skill Cards", offset: 0x1700, size: 1024 },
  8: { name: "Costumes", offset: 0x1b00, size: 512 },
});

export const CORE_FIELDS = Object.freeze({
  money: { label: "Yen", index: 7257, min: 0, max: 9_999_999 },
  playTime: { label: "Play time", index: 12832, min: 0, max: MAX_PLAY_TIME_SECONDS },
});

export const PLAYER_NAME_MAX_LENGTH = 8;
export const PLAYER_NAME_WORD_COUNT = 2;
export const PLAYER_NAME_FIELDS = Object.freeze({
  firstName: { label: "First name", headerName: "FirstName", index: 17936 },
  lastName: { label: "Last name", headerName: "LastName", index: 17952 },
});

// Cumulative thresholds from Xrd777's HeroParameterDataAsset. The source
// table stores the additional points required for each successive level.
export const SOCIAL_STATS = Object.freeze([
  {
    key: "academics",
    label: "Academics points",
    index: 5352,
    levels: [
      [0, "Slacker"],
      [20, "Average"],
      [55, "Above Average"],
      [100, "Smart"],
      [155, "Intelligent"],
      [230, "Genius"],
    ],
  },
  {
    key: "charm",
    label: "Charm points",
    index: 5354,
    levels: [
      [0, "Plain"],
      [15, "Unpolished"],
      [30, "Confident"],
      [45, "Smooth"],
      [70, "Popular"],
      [100, "Charismatic"],
    ],
  },
  {
    key: "courage",
    label: "Courage points",
    index: 5356,
    levels: [
      [0, "Timid"],
      [15, "Ordinary"],
      [30, "Determined"],
      [45, "Tough"],
      [60, "Fearless"],
      [80, "Badass"],
    ],
  },
]);

export const SOCIAL_LINKS = Object.freeze([
  { label: "SEES", arcana: "Fool", index: 5300 },
  { label: "Kenji Tomochika", arcana: "Magician", index: 5302 },
  { label: "Fuuka Yamagishi", arcana: "Priestess", index: 5304 },
  { label: "Mitsuru Kirijo", arcana: "Empress", index: 5306 },
  { label: "Hidetoshi Odagiri", arcana: "Emperor", index: 5308 },
  { label: "Bunkichi & Mitsuko", arcana: "Hierophant", index: 5310 },
  { label: "Yukari Takeba", arcana: "Lovers", index: 5312 },
  { label: "Kazushi Miyamoto", arcana: "Chariot", index: 5314 },
  { label: "Chihiro Fushimi", arcana: "Justice", index: 5316 },
  { label: "Maya", arcana: "Hermit", index: 5318 },
  { label: "Keisuke Hiraga", arcana: "Fortune", index: 5320 },
  { label: "Yuko Nishiwaki", arcana: "Strength", index: 5322 },
  { label: "Maiko Oohashi", arcana: "Hanged", index: 5324 },
  { label: "Pharos", arcana: "Death", index: 5326 },
  { label: "Bebe", arcana: "Temperance", index: 5328 },
  { label: "President Tanaka", arcana: "Devil", index: 5330 },
  { label: "Mutatsu", arcana: "Tower", index: 5332 },
  { label: "Mamoru Hayase", arcana: "Star", index: 5334 },
  { label: "Nozomi Suemitsu", arcana: "Moon", index: 5336 },
  { label: "Akinari Kamiki", arcana: "Sun", index: 5338 },
  { label: "Nyx Annihilation Team", arcana: "Judgement", index: 5340 },
  { label: "Aigis", arcana: "Aeon", index: 5342 },
]);

export const PERSONA_STOCK_BASE = 13086;
export const PERSONA_SLOT_WORDS = 12;
export const PERSONA_SLOT_COUNT = 12;

// These are valid protagonist-Persona skills produced by fusion mutation, but
// no Persona learns them naturally, so the generated skills.json omits them.
export const MUTATION_SKILLS = Object.freeze([
  { id: 864, name: "Almighty Amp" },
  { id: 866, name: "Magic Mastery" },
]);

// Navigator abilities are valid party-Persona skills but cannot normally be
// equipped by the protagonist, so they are kept separate from skills.json.
export const NAVIGATOR_SKILLS = Object.freeze([
  { id: 245, name: "Full Analysis" },
  { id: 246, name: "Escape Route" },
  { id: 247, name: "Jamming" },
  { id: 248, name: "Tartarus Search" },
  { id: 249, name: "Sylphid Aura" },
  { id: 250, name: "Shock Noise" },
]);

const supportingParty = [
  "Yukari",
  "Junpei",
  "Akihiko",
  "Mitsuru",
  "Fuuka",
  "Aigis",
  "Koromaru",
  "Ken",
  "Shinjiro",
];

export const PARTY_MEMBERS = Object.freeze([
  {
    key: "protagonist",
    name: "Protagonist",
    hp: 13070,
    sp: 13071,
    level: 13074,
    experience: 13075,
    personaBase: PERSONA_STOCK_BASE,
  },
  ...supportingParty.map((name, offset) => {
    const hp = 13246 + offset * 176;
    return {
      key: name.toLowerCase(),
      name,
      hp,
      sp: hp + 1,
      level: hp + 17,
      experience: hp + 18,
      personaBase: hp + 16,
    };
  }),
]);
