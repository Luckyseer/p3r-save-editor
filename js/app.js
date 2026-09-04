import { bytesEqual } from "./binary.js";
import {
  ITEM_CATEGORIES,
  MAX_PLAY_TIME_SECONDS,
  MUTATION_SKILLS,
  NAVIGATOR_SKILLS,
  PLAYER_NAME_MAX_LENGTH,
} from "./constants.js";
import {
  getCoreValues,
  getParty,
  getSocialData,
  setCoreValue,
  setPartyValue,
  setPlayerName,
  setSocialLinkRank,
  setSocialStat,
} from "./core-values.js";
import { P3RSave } from "./gvas-save.js";
import { getItemQuantity, setItemQuantity } from "./inventory.js";
import {
  getCombatAllies,
  getPartyFormation,
  setPartyFormation,
} from "./party-formation.js";
import { getPartyPersonas, setPartyPersonaSkill } from "./party-personas.js";
import {
  clearPersona,
  getPersonaStock,
  replacePersona,
  setPersonaSkill,
  setPersonaValue,
} from "./persona-stock.js";
import { decodeSave, encodeSave } from "./steam-crypto.js";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ITEM_PAGE_SIZE = 50;

const state = {
  items: [],
  personas: [],
  skills: [],
  partySkills: [],
  personaById: new Map(),
  skillNames: new Map(),
  originalRaw: null,
  save: null,
  format: null,
  fileName: null,
  changes: new Map(),
  itemPage: 1,
  skillPicker: null,
};

const elements = Object.fromEntries(
  [
    "landing", "editor", "formatSelect", "dropZone", "saveInput", "loadStatus",
    "loadedFileName", "loadedFileMeta", "overviewCards", "coreFields", "changeCount",
    "changeList", "itemSearch", "itemCategory", "ownedOnly",
    "showUnused", "inventorySummary", "inventoryRows", "itemPrev", "itemNext",
    "itemPage", "partyFormation", "partyGrid", "personaGrid", "socialStats", "socialLinks",
    "dirtyDot", "dirtyLabel", "resetChanges", "downloadSave", "safetyDialog", "toast",
    "skillDialog", "skillDialogTitle", "closeSkillDialog", "skillSearch",
    "skillResultCount", "skillChoices",
  ].map((id) => [id, document.getElementById(id)]),
);

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function parseInteger(value, label) {
  if (String(value).trim() === "" || !/^-?\d+$/.test(String(value).trim())) {
    throw new Error(`${label} must be a whole number.`);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) throw new Error(`${label} is outside the safe range.`);
  return parsed;
}

function formatNumber(value) {
  return Number(value ?? 0).toLocaleString("en-US");
}

function formatDuration(seconds) {
  const total = Math.max(0, Number(seconds) || 0);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remainder = total % 60;
  return `${hours}h ${minutes}m ${remainder}s`;
}

function showToast(message, isError = false) {
  elements.toast.textContent = message;
  elements.toast.classList.toggle("error", isError);
  elements.toast.classList.add("show");
  clearTimeout(showToast.timeout);
  showToast.timeout = setTimeout(() => elements.toast.classList.remove("show"), 3600);
}

function setLoadStatus(message, isError = false) {
  elements.loadStatus.textContent = message;
  elements.loadStatus.style.color = isError ? "var(--danger)" : "var(--cyan-soft)";
}

function describeFormat(format) {
  return format === "steam" ? "Steam save" : "Decrypted save";
}

function markChange(key, label, before, after) {
  const existing = state.changes.get(key);
  const original = existing?.before ?? before;
  if (String(original) === String(after)) state.changes.delete(key);
  else state.changes.set(key, { label, before: original, after });
  renderChanges();
}

function renderChanges() {
  const count = state.changes.size;
  elements.changeCount.textContent = `${count} ${count === 1 ? "edit" : "edits"}`;
  elements.dirtyLabel.textContent = count ? `${count} staged ${count === 1 ? "change" : "changes"}` : "No staged changes";
  elements.dirtyDot.classList.toggle("dirty", count > 0);
  elements.resetChanges.disabled = count === 0;
  elements.downloadSave.disabled = count === 0;
  if (!count) {
    elements.changeList.className = "change-list empty-state";
    elements.changeList.textContent = "No changes yet.";
    return;
  }
  elements.changeList.className = "change-list";
  elements.changeList.innerHTML = [...state.changes.values()]
    .map((change) => `
      <div class="change-row">
        <span>${escapeHtml(change.label)}</span>
        <small>${escapeHtml(change.before)} &rarr; ${escapeHtml(change.after)}</small>
      </div>`)
    .join("");
}

function itemName(itemId) {
  return state.items.find((item) => item.id === itemId)?.name ?? `Item ${itemId}`;
}

function personaName(personaId) {
  if (!personaId) return "Empty";
  return state.personaById.get(personaId)?.name ?? `Unknown Persona ${personaId}`;
}

function skillLabel(skillId) {
  if (!skillId) return "";
  return `${state.skillNames.get(skillId) || `Unknown Skill`} [${skillId}]`;
}

function mergeSkills(...lists) {
  return [...new Map(
    lists.flat().map((skill) => [skill.id, skill]),
  ).values()];
}

function renderOverview() {
  const header = state.save.getHeader();
  const core = getCoreValues(state.save);
  const characterName = [header.firstName, header.lastName].filter(Boolean).join(" ") || "Unknown";
  const calendar = header.month && header.day
    ? `${header.month}/${header.day}${header.week ? ` - ${header.week}` : ""}`
    : "Unavailable";
  const metrics = [
    ["Character", characterName, header.slotName || "Save slot"],
    ["Calendar", calendar, header.timeZone || "Story date"],
    ["Play time", formatDuration(core.playTime), "Stored in this save"],
    ["Format", describeFormat(state.format), `Save version ${state.save.version}`],
  ];
  elements.overviewCards.innerHTML = metrics.map(([label, value, detail]) => `
    <div class="metric-card"><span>${escapeHtml(label)}</span><strong title="${escapeHtml(value)}">${escapeHtml(value)}</strong><small>${escapeHtml(detail)}</small></div>
  `).join("");
  elements.coreFields.innerHTML = `
    <div class="field"><label><span>First name</span><input type="text" maxlength="${PLAYER_NAME_MAX_LENGTH}" value="${escapeHtml(header.firstName)}" data-player-name="firstName" /></label><small>1 to ${PLAYER_NAME_MAX_LENGTH} basic characters</small></div>
    <div class="field"><label><span>Last name</span><input type="text" maxlength="${PLAYER_NAME_MAX_LENGTH}" value="${escapeHtml(header.lastName)}" data-player-name="lastName" /></label><small>1 to ${PLAYER_NAME_MAX_LENGTH} basic characters</small></div>
    <div class="field"><label><span>Yen</span><input type="number" min="0" max="9999999" step="1" value="${core.money}" data-core="money" /></label><small>0 to 9,999,999</small></div>
    <div class="field">
      <span class="field-group-label">Play time</span>
      <div class="play-time-inputs">
        <label><span>Hours</span><input type="number" min="0" max="999" step="1" value="${Math.floor(core.playTime / 3600)}" data-playtime-part="hours" /></label>
        <label><span>Minutes</span><input type="number" min="0" max="59" step="1" value="${Math.floor((core.playTime % 3600) / 60)}" data-playtime-part="minutes" /></label>
        <label><span>Seconds</span><input type="number" min="0" max="59" step="1" value="${core.playTime % 60}" data-playtime-part="seconds" /></label>
      </div>
      <small>Up to 999h 59m</small>
    </div>
  `;
}

function filteredItems() {
  const search = elements.itemSearch.value.trim().toLowerCase();
  const category = elements.itemCategory.value;
  return state.items.filter((item) => {
    if (!elements.showUnused.checked && item.unused) return false;
    if (category !== "all" && String(item.category) !== category) return false;
    const quantity = getItemQuantity(state.save, item.id);
    if (elements.ownedOnly.checked && quantity === 0) return false;
    if (!search) return true;
    return item.name.toLowerCase().includes(search)
      || String(item.id).includes(search)
      || `0x${item.id.toString(16)}`.includes(search.replaceAll(" ", ""));
  });
}

function renderInventory() {
  const filtered = filteredItems();
  const pages = Math.max(1, Math.ceil(filtered.length / ITEM_PAGE_SIZE));
  state.itemPage = Math.min(Math.max(1, state.itemPage), pages);
  const start = (state.itemPage - 1) * ITEM_PAGE_SIZE;
  const visible = filtered.slice(start, start + ITEM_PAGE_SIZE);
  const ownedCount = state.items.reduce(
    (count, item) => count + (getItemQuantity(state.save, item.id) > 0 ? 1 : 0),
    0,
  );
  elements.inventorySummary.textContent = `${ownedCount.toLocaleString()} owned types`;
  elements.inventoryRows.innerHTML = visible.length ? visible.map((item) => {
    const quantity = getItemQuantity(state.save, item.id);
    return `
      <div class="table-row" role="row">
        <span class="item-name"><strong>${escapeHtml(item.name)}</strong><small>${item.unused ? "Unverified/unused entry" : quantity ? "In inventory" : "Not owned"}</small></span>
        <span class="category-chip">${escapeHtml(item.categoryName)}</span>
        <span>${item.id}</span>
        <input class="quantity-input" type="number" min="0" max="99" step="1" value="${quantity}" aria-label="${escapeHtml(item.name)} quantity" data-item-id="${item.id}" />
      </div>`;
  }).join("") : '<div class="empty-state">No matching item IDs.</div>';
  elements.itemPage.textContent = `Page ${state.itemPage} of ${pages} - ${filtered.length.toLocaleString()} results`;
  elements.itemPrev.disabled = state.itemPage <= 1;
  elements.itemNext.disabled = state.itemPage >= pages;
}

function partyFormationLabel(formation) {
  return formation.map((member) => member.name).join(", ");
}

function partyFormationOptions(selectedKey, selectedKeys) {
  const options = ['<option value="">Empty</option>'];
  const selectedMember = getPartyFormation(state.save).find(
    (member) => member.key === selectedKey,
  );
  if (selectedMember?.unknown) {
    options.push(`<option value="${escapeHtml(selectedKey)}" selected>${escapeHtml(selectedMember.name)}</option>`);
  }
  getCombatAllies().forEach((member) => {
    const selected = member.key === selectedKey;
    const usedElsewhere = !selected && selectedKeys.includes(member.key);
    options.push(`<option value="${member.key}" ${selected ? "selected" : ""} ${usedElsewhere ? "disabled" : ""}>${escapeHtml(member.name)}</option>`);
  });
  return options.join("");
}

function renderPartyFormation() {
  const formation = getPartyFormation(state.save);
  if (
    formation[0]?.key !== "protagonist"
    || formation.length > 4
    || formation.some((member, index) => member.unknown || (index > 0 && member.navigator))
  ) {
    elements.partyFormation.innerHTML = '<div class="empty-state">This save is not in a standard combat-party state, so its formation cannot be edited safely.</div>';
    return;
  }
  const selectedKeys = formation.slice(1).map((member) => member.key);
  const slots = Array.from({ length: 3 }, (_, index) => selectedKeys[index] || "");
  elements.partyFormation.innerHTML = `
    <label class="party-formation-field"><span>Leader</span><span class="fixed-member">Protagonist</span></label>
    ${slots.map((selectedKey, index) => `
      <label class="party-formation-field"><span>Ally ${index + 1}</span><select data-party-formation-slot="${index}">${partyFormationOptions(selectedKey, selectedKeys)}</select></label>
    `).join("")}
  `;
}

function renderParty(openSkillEditor = null) {
  const partyPersonas = new Map(
    getPartyPersonas(state.save).map((persona) => [persona.memberKey, persona]),
  );
  elements.partyGrid.innerHTML = getParty(state.save).map((member) => {
    const partyPersona = partyPersonas.get(member.key);
    return `
      <article class="party-card">
        <h3>${escapeHtml(member.name)}</h3>
        <div class="party-fields">
          ${partyInput(member, "hp", "HP", 0, 9999)}
          ${partyInput(member, "sp", "SP", 0, 9999)}
          ${partyInput(member, "level", "Level", 1, 99)}
          ${partyInput(member, "experience", "Experience", 0, 9999999)}
        </div>
        ${partyPersona?.id ? `
          <details class="persona-skill-editor" ${member.key === openSkillEditor ? "open" : ""}>
            <summary>Edit Persona skills</summary>
            <p>Choose a known skill, or clear the slot.</p>
            <div class="persona-skill-grid">
              ${partyPersona.skillSlots.map((skillId, skillSlot) => `<label><span>Skill ${skillSlot + 1}</span><button class="skill-picker-button" type="button" data-party-skill-member="${member.key}" data-open-party-skill-picker="${skillSlot}">${escapeHtml(skillId ? (state.skillNames.get(skillId) || `Unknown skill ${skillId}`) : "Empty")}</button></label>`).join("")}
            </div>
          </details>` : ""}
      </article>`;
  }).join("");
}

function partyInput(member, field, label, min, max) {
  return `<label><span>${label}</span><input type="number" min="${min}" max="${max}" step="1" value="${member[field]}" data-party-member="${member.key}" data-party-field="${field}" /></label>`;
}

function personaOptions(currentId) {
  const options = [...state.personas].sort((left, right) => left.name.localeCompare(right.name));
  const currentKnown = !currentId || state.personaById.has(currentId);
  return [
    '<option value="0">Empty slot</option>',
    ...(!currentKnown ? [`<option value="${currentId}">Unknown Persona ${currentId}</option>`] : []),
    ...options.map((persona) => `<option value="${persona.id}" ${persona.id === currentId ? "selected" : ""}>${escapeHtml(persona.name)}${persona.dlc ? " [DLC]" : ""} - ${escapeHtml(persona.arcana)} Lv ${persona.level}</option>`),
  ].join("");
}

function renderPersonas(openSkillEditor = null) {
  elements.personaGrid.innerHTML = getPersonaStock(state.save).map((stock) => {
    const known = state.personaById.get(stock.id);
    const skillText = stock.skills.length
      ? stock.skills.map((id) => state.skillNames.get(id) || `Skill ${id}`).join(" / ")
      : "No skills recorded";
    const disabled = stock.id ? "" : "disabled";
    const statNames = ["strength", "magic", "endurance", "agility", "luck"];
    return `
      <article class="persona-card">
        <div class="persona-title"><span>Slot ${stock.slot + 1}</span><small>${escapeHtml(known?.arcana || (stock.id ? "Unknown ID" : "Open"))}</small></div>
        <label><span>Persona</span><select data-persona-select="${stock.slot}">${personaOptions(stock.id)}</select></label>
        <div class="persona-meta"><strong>${escapeHtml(personaName(stock.id))}</strong><br />Skills: ${escapeHtml(skillText)}</div>
        <div class="persona-fields">
          <label><span>Level</span><input type="number" min="1" max="99" value="${stock.level || 1}" data-persona-slot="${stock.slot}" data-persona-field="level" ${disabled} /></label>
          <label><span>Experience</span><input type="number" min="0" max="9999999" value="${stock.experience}" data-persona-slot="${stock.slot}" data-persona-field="experience" ${disabled} /></label>
        </div>
        <div class="persona-stats">
          ${statNames.map((field, index) => `<label><span>${field.slice(0, 3)}</span><input type="number" min="1" max="99" value="${stock.stats[index] || 1}" data-persona-slot="${stock.slot}" data-persona-field="${field}" ${disabled} /></label>`).join("")}
        </div>
        <details class="persona-skill-editor" ${stock.id ? "" : "hidden"} ${stock.slot === openSkillEditor ? "open" : ""}>
          <summary>Edit skills</summary>
          <p>Choose a known player-Persona skill, or clear the slot.</p>
          <div class="persona-skill-grid">
            ${stock.skillSlots.map((skillId, skillSlot) => `<label><span>Skill ${skillSlot + 1}</span><button class="skill-picker-button" type="button" data-persona-slot="${stock.slot}" data-open-skill-picker="${skillSlot}">${escapeHtml(skillId ? (state.skillNames.get(skillId) || `Unknown skill ${skillId}`) : "Empty")}</button></label>`).join("")}
          </div>
        </details>
        <div class="persona-actions"><button class="button button-quiet" data-remove-persona="${stock.slot}" ${!stock.id || stock.slot === 0 ? "disabled" : ""}>Clear slot</button></div>
      </article>`;
  }).join("");
}

function renderSkillChoices() {
  const context = getSkillPickerContext();
  if (!context) return;
  const query = elements.skillSearch.value.trim().toLowerCase();
  const matches = context.availableSkills.filter((skill) => (
    !query
    || skill.name.toLowerCase().includes(query)
    || String(skill.id).includes(query)
  ));
  const visible = matches.slice(0, 100);
  const { currentId } = context;
  elements.skillResultCount.textContent = matches.length > visible.length
    ? `Showing the first ${visible.length} of ${matches.length} matches`
    : `${matches.length} ${matches.length === 1 ? "match" : "matches"}`;
  elements.skillChoices.innerHTML = [
    `<button class="skill-choice ${currentId === 0 ? "selected" : ""}" type="button" role="option" aria-selected="${currentId === 0}" data-skill-choice="0"><strong>Empty</strong><small>Remove this skill</small></button>`,
    ...visible.map((skill) => `<button class="skill-choice ${currentId === skill.id ? "selected" : ""}" type="button" role="option" aria-selected="${currentId === skill.id}" data-skill-choice="${skill.id}"><strong>${escapeHtml(skill.name)}</strong><small>ID ${skill.id}</small></button>`),
  ].join("");
}

function getSkillPickerContext() {
  if (!state.skillPicker) return null;
  const { owner, skillSlot } = state.skillPicker;
  if (owner === "party") {
    const partyPersona = getPartyPersonas(state.save).find(
      (persona) => persona.memberKey === state.skillPicker.memberKey,
    );
    if (!partyPersona?.id) return null;
    return {
      availableSkills: state.partySkills,
      currentId: partyPersona.skillSlots[skillSlot],
      partyPersona,
    };
  }

  const stock = getPersonaStock(state.save)[state.skillPicker.personaSlot];
  if (!stock?.id) return null;
  return {
    availableSkills: state.skills,
    currentId: stock.skillSlots[skillSlot],
    stock,
  };
}

function openPersonaSkillPicker(personaSlot, skillSlot) {
  const stock = getPersonaStock(state.save)[personaSlot];
  if (!stock?.id) return;
  state.skillPicker = { owner: "protagonist", personaSlot, skillSlot };
  elements.skillDialogTitle.textContent = `${personaName(stock.id)} - skill ${skillSlot + 1}`;
  elements.skillSearch.value = "";
  renderSkillChoices();
  elements.skillDialog.showModal();
  elements.skillSearch.focus();
}

function openPartySkillPicker(memberKey, skillSlot) {
  const partyPersona = getPartyPersonas(state.save).find(
    (persona) => persona.memberKey === memberKey,
  );
  if (!partyPersona?.id) return;
  state.skillPicker = { owner: "party", memberKey, skillSlot };
  elements.skillDialogTitle.textContent = `${partyPersona.memberName}'s Persona - skill ${skillSlot + 1}`;
  elements.skillSearch.value = "";
  renderSkillChoices();
  elements.skillDialog.showModal();
  elements.skillSearch.focus();
}

function socialStatReference(stat) {
  let currentRank = 1;
  stat.levels.forEach(([minimum], index) => {
    if (stat.value >= minimum) currentRank = index + 1;
  });
  const current = stat.levels[currentRank - 1];
  const next = stat.levels[currentRank];
  const progress = next
    ? `${next[0] - stat.value} points to Lv ${currentRank + 1} ${next[1]}`
    : "Maximum level reached";
  const thresholds = stat.levels
    .map(([minimum, name], index) => `Lv ${index + 1} ${name}: ${minimum}`)
    .join(" · ");
  return { currentRank, currentName: current[1], progress, thresholds };
}

function renderSocial() {
  const social = getSocialData(state.save);
  elements.socialStats.innerHTML = social.stats.map((stat) => {
    const reference = socialStatReference(stat);
    return `
      <div class="field social-stat-field">
        <label><span>${escapeHtml(stat.label)}</span><input type="number" min="0" max="255" step="1" value="${stat.value}" data-social-stat="${stat.key}" /></label>
        <strong>Lv ${reference.currentRank}: ${escapeHtml(reference.currentName)}</strong>
        <small>${escapeHtml(reference.progress)}</small>
        <small class="threshold-reference">${escapeHtml(reference.thresholds)}</small>
      </div>`;
  }).join("");
  elements.socialLinks.innerHTML = social.links.map((link) => `
    <div class="social-link"><span><strong>${escapeHtml(link.label)}</strong><small>${escapeHtml(link.arcana)}</small></span><input type="number" min="0" max="10" step="1" value="${link.rank}" aria-label="${escapeHtml(link.label)} rank" data-social-link="${link.index}" data-social-label="${escapeHtml(link.label)}" /></div>
  `).join("");
}

function renderAll() {
  renderOverview();
  renderInventory();
  renderPartyFormation();
  renderParty();
  renderPersonas();
  renderSocial();
  renderChanges();
}

function editSafely(mutation, rerender) {
  try {
    mutation();
    rerender?.();
  } catch (error) {
    showToast(error.message || String(error), true);
    rerender?.();
  }
}

async function loadFile(file) {
  if (!file) return;
  setLoadStatus("Reading and validating save...");
  try {
    if (file.size > MAX_FILE_SIZE) throw new Error("The selected file exceeds the 10 MiB limit.");
    const raw = new Uint8Array(await file.arrayBuffer());
    const decoded = decodeSave(raw, elements.formatSelect.value);
    const save = new P3RSave(decoded.decrypted);
    const roundTrip = decodeSave(encodeSave(save.bytes, decoded.format), decoded.format);
    if (!bytesEqual(roundTrip.decrypted, save.bytes)) {
      throw new Error("Initial encryption round-trip validation failed.");
    }
    state.originalRaw = raw.slice();
    state.save = save;
    state.format = decoded.format;
    state.fileName = file.name || "SaveData.sav";
    state.changes.clear();
    state.itemPage = 1;
    elements.loadedFileName.textContent = state.fileName;
    elements.loadedFileMeta.textContent = `${describeFormat(state.format)} - save version ${state.save.version}`;
    elements.landing.hidden = true;
    elements.editor.hidden = false;
    renderAll();
    setLoadStatus("");
    showToast(`Loaded and validated ${state.fileName}.`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  } catch (error) {
    setLoadStatus(error.message || String(error), true);
    showToast(error.message || String(error), true);
    elements.saveInput.value = "";
  }
}

async function downloadEditedSave() {
  try {
    if (!state.save || !state.changes.size) throw new Error("There are no changes to export.");
    const encoded = encodeSave(state.save.bytes, state.format);
    const decoded = decodeSave(encoded, state.format);
    const validated = new P3RSave(decoded.decrypted);
    validated.validateHeaderContainer();
    if (validated.version !== state.save.version || !bytesEqual(decoded.decrypted, state.save.bytes)) {
      throw new Error("Final encryption and parse validation failed; nothing was downloaded.");
    }
    const extensionIndex = state.fileName.lastIndexOf(".");
    const stem = extensionIndex > 0 ? state.fileName.slice(0, extensionIndex) : state.fileName;
    const extension = extensionIndex > 0 ? state.fileName.slice(extensionIndex) : ".sav";
    const outputName = `${stem}_edited${extension}`;
    const url = URL.createObjectURL(new Blob([encoded], { type: "application/octet-stream" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = outputName;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast(`Validated and downloaded ${outputName}.`);
  } catch (error) {
    showToast(error.message || String(error), true);
  }
}

function resetChanges() {
  if (!state.changes.size || !window.confirm("Discard every staged edit and restore the loaded file?")) return;
  const decoded = decodeSave(state.originalRaw, state.format);
  state.save = new P3RSave(decoded.decrypted);
  state.changes.clear();
  state.itemPage = 1;
  renderAll();
  showToast("All staged edits were discarded.");
}

function bindEditorEvents() {
  document.querySelectorAll(".nav-item").forEach((button) => button.addEventListener("click", () => {
    document.querySelectorAll(".nav-item").forEach((item) => item.classList.toggle("active", item === button));
    document.querySelectorAll(".tab-panel").forEach((panel) => panel.classList.toggle("active", panel.dataset.panel === button.dataset.tab));
  }));

  elements.editor.addEventListener("change", (event) => {
    const target = event.target;
    if (target.matches("[data-item-id]")) {
      const id = Number(target.dataset.itemId);
      editSafely(() => {
        const before = getItemQuantity(state.save, id);
        const after = parseInteger(target.value, "Quantity");
        setItemQuantity(state.save, id, after);
        markChange(`item:${id}`, `${itemName(id)} quantity`, before, after);
      }, renderInventory);
    } else if (target.matches("[data-player-name]")) {
      const key = target.dataset.playerName;
      editSafely(() => {
        const before = state.save.getHeader()[key];
        const after = target.value;
        setPlayerName(state.save, key, after);
        markChange(`name:${key}`, key === "firstName" ? "First name" : "Last name", before, after);
      }, renderOverview);
    } else if (target.matches("[data-playtime-part]")) {
      editSafely(() => {
        const before = getCoreValues(state.save).playTime;
        const readPart = (part, label) => parseInteger(
          elements.coreFields.querySelector(`[data-playtime-part="${part}"]`).value,
          label,
        );
        const hours = readPart("hours", "Play time hours");
        const minutes = readPart("minutes", "Play time minutes");
        const seconds = readPart("seconds", "Play time seconds");
        if (hours < 0 || minutes < 0 || seconds < 0 || hours > 999 || minutes > 59 || seconds > 59) {
          throw new Error("Play time must use 0-999 hours and 0-59 minutes or seconds.");
        }
        const after = (hours * 3600) + (minutes * 60) + seconds;
        if (after > MAX_PLAY_TIME_SECONDS) throw new Error("Play time cannot exceed 999h 59m.");
        setCoreValue(state.save, "playTime", after);
        markChange("core:playTime", "Play time", formatDuration(before), formatDuration(after));
      }, renderOverview);
    } else if (target.matches("[data-core]")) {
      const key = target.dataset.core;
      editSafely(() => {
        const before = getCoreValues(state.save)[key];
        const after = parseInteger(target.value, "Yen");
        setCoreValue(state.save, key, after);
        markChange(`core:${key}`, "Yen", before, after);
      }, renderOverview);
    } else if (target.matches("[data-party-formation-slot]")) {
      const beforeFormation = getPartyFormation(state.save);
      const beforeAllies = beforeFormation.slice(1).map((member) => member.key);
      const selectedAllies = [...elements.partyFormation.querySelectorAll("[data-party-formation-slot]")]
        .map((select) => select.value)
        .filter(Boolean);
      if (
        selectedAllies.includes("shinjiro")
        && !beforeAllies.includes("shinjiro")
        && !window.confirm("Shinjiro can be added after his story departure, but the game may remove him during transitions or behave incorrectly in scripted scenes. Continue?")
      ) {
        renderPartyFormation();
        return;
      }
      editSafely(() => {
        setPartyFormation(state.save, selectedAllies);
        const afterFormation = getPartyFormation(state.save);
        markChange(
          "party:formation",
          "Current party",
          partyFormationLabel(beforeFormation),
          partyFormationLabel(afterFormation),
        );
      }, renderPartyFormation);
    } else if (target.matches("[data-party-member]")) {
      const memberKey = target.dataset.partyMember;
      const field = target.dataset.partyField;
      editSafely(() => {
        const member = getParty(state.save).find((entry) => entry.key === memberKey);
        const before = member[field];
        const after = parseInteger(target.value, `${member.name} ${field}`);
        setPartyValue(state.save, memberKey, field, after);
        markChange(`party:${memberKey}:${field}`, `${member.name} ${field}`, before, after);
      }, renderParty);
    } else if (target.matches("[data-persona-select]")) {
      const slot = Number(target.dataset.personaSelect);
      const id = Number(target.value);
      const stock = getPersonaStock(state.save)[slot];
      if (stock.id === id) return;
      if (id === 0 && slot === 0) {
        showToast("Slot 1 cannot be empty; the protagonist needs an equipped Persona.", true);
        renderPersonas();
        return;
      }
      const action = id ? `replace slot ${slot + 1} with ${personaName(id)}` : `clear slot ${slot + 1}`;
      if (stock.id && !window.confirm(`This will ${action}. Existing skills and stats in that slot will be lost. Continue?`)) {
        renderPersonas();
        return;
      }
      editSafely(() => {
        const before = personaName(stock.id);
        if (id) replacePersona(state.save, slot, state.personaById.get(id));
        else clearPersona(state.save, slot);
        markChange(`persona:${slot}`, `Persona stock slot ${slot + 1}`, before, personaName(id));
      }, () => renderPersonas(slot));
    } else if (target.matches("[data-persona-field]")) {
      const slot = Number(target.dataset.personaSlot);
      const field = target.dataset.personaField;
      editSafely(() => {
        const beforeStock = getPersonaStock(state.save)[slot];
        const before = field === "level" ? beforeStock.level
          : field === "experience" ? beforeStock.experience
            : beforeStock.stats[["strength", "magic", "endurance", "agility", "luck"].indexOf(field)];
        const after = parseInteger(target.value, `Persona ${field}`);
        setPersonaValue(state.save, slot, field, after);
        markChange(`persona:${slot}:${field}`, `Slot ${slot + 1} ${field}`, before, after);
      }, renderPersonas);
    } else if (target.matches("[data-social-stat]")) {
      const key = target.dataset.socialStat;
      editSafely(() => {
        const entry = getSocialData(state.save).stats.find((stat) => stat.key === key);
        const before = entry.value;
        const after = parseInteger(target.value, entry.label);
        setSocialStat(state.save, key, after);
        markChange(`social-stat:${key}`, entry.label, before, after);
      }, renderSocial);
    } else if (target.matches("[data-social-link]")) {
      const index = Number(target.dataset.socialLink);
      const label = target.dataset.socialLabel;
      editSafely(() => {
        const entry = getSocialData(state.save).links.find((link) => link.index === index);
        const before = entry.rank;
        const after = parseInteger(target.value, `${label} rank`);
        setSocialLinkRank(state.save, index, after);
        markChange(`social-link:${index}`, `${label} rank`, before, after);
      }, renderSocial);
    }
  });

  elements.editor.addEventListener("click", (event) => {
    const skillButton = event.target.closest("[data-open-skill-picker]");
    if (skillButton) {
      openPersonaSkillPicker(
        Number(skillButton.dataset.personaSlot),
        Number(skillButton.dataset.openSkillPicker),
      );
      return;
    }
    const partySkillButton = event.target.closest("[data-open-party-skill-picker]");
    if (partySkillButton) {
      openPartySkillPicker(
        partySkillButton.dataset.partySkillMember,
        Number(partySkillButton.dataset.openPartySkillPicker),
      );
      return;
    }
    const button = event.target.closest("[data-remove-persona]");
    if (!button) return;
    const slot = Number(button.dataset.removePersona);
    const stock = getPersonaStock(state.save)[slot];
    if (!stock.id || slot === 0 || !window.confirm(`Clear ${personaName(stock.id)} from slot ${slot + 1}?`)) return;
    editSafely(() => {
      clearPersona(state.save, slot);
      markChange(`persona:${slot}`, `Persona stock slot ${slot + 1}`, personaName(stock.id), "Empty");
    }, renderPersonas);
  });
}

function bindToolbarEvents() {
  for (const input of [elements.itemSearch, elements.itemCategory, elements.ownedOnly, elements.showUnused]) {
    input.addEventListener(input === elements.itemSearch ? "input" : "change", () => {
      state.itemPage = 1;
      renderInventory();
    });
  }
  elements.itemPrev.addEventListener("click", () => { state.itemPage -= 1; renderInventory(); });
  elements.itemNext.addEventListener("click", () => { state.itemPage += 1; renderInventory(); });
  elements.resetChanges.addEventListener("click", resetChanges);
  elements.downloadSave.addEventListener("click", downloadEditedSave);
  elements.skillSearch.addEventListener("input", renderSkillChoices);
  elements.closeSkillDialog.addEventListener("click", () => elements.skillDialog.close());
  elements.skillDialog.addEventListener("close", () => { state.skillPicker = null; });
  elements.skillChoices.addEventListener("click", (event) => {
    const choice = event.target.closest("[data-skill-choice]");
    if (!choice || !state.skillPicker) return;
    const picker = state.skillPicker;
    const context = getSkillPickerContext();
    if (!context) return;
    const { skillSlot } = picker;
    const beforeId = context.currentId;
    const afterId = Number(choice.dataset.skillChoice);
    try {
      if (afterId !== 0 && !context.availableSkills.some((skill) => skill.id === afterId)) {
        throw new Error("Choose a skill from the known-skill list.");
      }
      if (picker.owner === "party") {
        setPartyPersonaSkill(state.save, picker.memberKey, skillSlot, afterId);
        markChange(
          `party:${picker.memberKey}:persona-skill:${skillSlot}`,
          `${context.partyPersona.memberName} Persona skill ${skillSlot + 1}`,
          beforeId ? skillLabel(beforeId) : "Empty",
          afterId ? skillLabel(afterId) : "Empty",
        );
      } else {
        setPersonaSkill(state.save, picker.personaSlot, skillSlot, afterId);
        markChange(
          `persona:${picker.personaSlot}:skill:${skillSlot}`,
          `Slot ${picker.personaSlot + 1} skill ${skillSlot + 1}`,
          beforeId ? skillLabel(beforeId) : "Empty",
          afterId ? skillLabel(afterId) : "Empty",
        );
      }
      elements.skillDialog.close();
      if (picker.owner === "party") renderParty(picker.memberKey);
      else renderPersonas(picker.personaSlot);
    } catch (error) {
      showToast(error.message || String(error), true);
    }
  });
}

async function initialize() {
  try {
    const [itemsResponse, personasResponse, skillsResponse] = await Promise.all([
      fetch("./data/items.json"),
      fetch("./data/personas.json"),
      fetch("./data/skills.json"),
    ]);
    if (!itemsResponse.ok || !personasResponse.ok || !skillsResponse.ok) {
      throw new Error("Editor reference data could not be loaded.");
    }
    state.items = await itemsResponse.json();
    state.personas = await personasResponse.json();
    state.skills = mergeSkills(await skillsResponse.json(), MUTATION_SKILLS);
    state.partySkills = mergeSkills(state.skills, NAVIGATOR_SKILLS);
    state.personaById = new Map(state.personas.map((persona) => [persona.id, persona]));
    state.skillNames = new Map(state.partySkills.map((skill) => [skill.id, skill.name]));
    state.skills.sort((left, right) => left.name.localeCompare(right.name));
    state.partySkills.sort((left, right) => left.name.localeCompare(right.name));
    Object.entries(ITEM_CATEGORIES).forEach(([id, category]) => {
      const option = document.createElement("option");
      option.value = id;
      option.textContent = category.name;
      elements.itemCategory.append(option);
    });
    bindEditorEvents();
    bindToolbarEvents();
    elements.saveInput.addEventListener("change", () => loadFile(elements.saveInput.files[0]));
    for (const eventName of ["dragenter", "dragover"]) {
      elements.dropZone.addEventListener(eventName, (event) => {
        event.preventDefault();
        elements.dropZone.classList.add("dragging");
      });
    }
    for (const eventName of ["dragleave", "drop"]) {
      elements.dropZone.addEventListener(eventName, (event) => {
        event.preventDefault();
        elements.dropZone.classList.remove("dragging");
      });
    }
    elements.dropZone.addEventListener("drop", (event) => loadFile(event.dataTransfer.files[0]));
    if (typeof elements.safetyDialog.showModal === "function") elements.safetyDialog.showModal();
  } catch (error) {
    setLoadStatus(`${error.message} Serve this project over HTTP instead of opening index.html directly.`, true);
  }
}

initialize();
