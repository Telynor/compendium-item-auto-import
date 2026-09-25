const ID = "compendium-item-auto-import";
const SOURCE_FLAG = "sourceUuid";
let running = false;
let queued = false;
let timer;

Hooks.once("init", () => {
  game.settings.register(ID, "pack", {
    name: "Source Item compendium",
    hint: "Enter the compendium collection ID (for example, world.my-items). Leave empty to disable importing.",
    scope: "world", config: true, type: String, default: "",
    onChange: scheduleSync
  });
  game.settings.register(ID, "folder", {
    name: "Destination Items folder",
    hint: "Name of a top-level Items folder. It will be created if it does not exist.",
    scope: "world", config: true, type: String, default: "Imported Compendium Items",
    onChange: scheduleSync
  });
});

Hooks.once("ready", scheduleSync);
Hooks.on("updateCompendium", pack => {
  if (pack?.collection === game.settings.get(ID, "pack")?.trim()) scheduleSync();
});

function isPrimaryGM() {
  return game.user?.isGM && game.users.filter(user => user.active && user.isGM)
    .sort((a, b) => a.id.localeCompare(b.id))[0]?.id === game.user.id;
}

function scheduleSync() {
  if (!game.ready || !isPrimaryGM()) return;
  clearTimeout(timer);
  timer = setTimeout(() => void sync().catch(error => {
    console.error(`${ID} | Import failed`, error);
    ui.notifications.error("Compendium item import failed. Check the browser console.");
  }), 700);
}

async function sync() {
  if (running) { queued = true; return; }
  running = true;
  try {
    const packId = game.settings.get(ID, "pack")?.trim();
    const folderName = game.settings.get(ID, "folder")?.trim();
    if (!packId || !folderName) return;
    const pack = game.packs.get(packId);
    if (!pack || pack.documentName !== "Item") {
      ui.notifications.warn(`Item compendium not found: ${packId}`);
      return;
    }
    let folder = game.folders.find(f => f.type === "Item" && !f.folder && f.name === folderName);
    if (!folder) folder = await Folder.create({ name: folderName, type: "Item" });
    const index = await pack.getIndex();
    const imported = new Set(game.items.contents
      .map(item => item.getFlag(ID, SOURCE_FLAG)).filter(Boolean));
    let count = 0;
    for (const entry of index) {
      const sourceUuid = pack.getUuid(entry._id);
      if (imported.has(sourceUuid)) continue;
      await game.items.importFromCompendium(pack, entry._id, {
        folder: folder.id,
        flags: { [ID]: { [SOURCE_FLAG]: sourceUuid } }
      });
      imported.add(sourceUuid);
      count++;
    }
    if (count) ui.notifications.info(`Imported ${count} item${count === 1 ? "" : "s"} into ${folderName}.`);
  } finally {
    running = false;
    if (queued) { queued = false; scheduleSync(); }
  }
}
