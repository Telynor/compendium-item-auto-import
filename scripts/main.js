const ID = "compendium-item-auto-import";
const SOURCE_FLAG = "sourceUuid";
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

class CompendiumImporter extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: `${ID}-settings`,
    window: { title: "Compendium Importer", resizable: true },
    position: { width: 510 },
    actions: { import: CompendiumImporter.import }
  };

  static PARTS = {
    main: { template: `modules/${ID}/templates/importer.hbs` }
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const savedPack = game.settings.get(ID, "sourcePack");
    const savedFolder = game.settings.get(ID, "targetFolder");
    const packs = [...game.packs].filter(p => ["Item", "Actor"].includes(p.documentName))
      .sort((a, b) => a.title.localeCompare(b.title));
    const selectedPack = packs.find(p => p.collection === savedPack) ?? packs[0];
    const folders = game.folders.contents.filter(f => f.type === selectedPack?.documentName)
      .sort((a, b) => folderLabel(a).localeCompare(folderLabel(b)));
    return {
      ...context,
      packs: packs.map(p => ({ id: p.collection, label: `${p.title} (${p.documentName})`, selected: p === selectedPack })),
      folders: folders.map(f => ({ id: f.id, label: folderLabel(f), selected: f.id === savedFolder })),
      folderType: selectedPack?.documentName ?? "Item",
      hasPacks: packs.length > 0,
      hasFolders: folders.length > 0
    };
  }

  _onRender(context, options) {
    super._onRender(context, options);
    this.element.querySelector('[name="sourcePack"]')?.addEventListener("change", () => {
      const packId = this.element.querySelector('[name="sourcePack"]').value;
      const type = game.packs.get(packId)?.documentName;
      const folders = game.folders.contents.filter(f => f.type === type)
        .sort((a, b) => folderLabel(a).localeCompare(folderLabel(b)));
      const select = this.element.querySelector('[name="targetFolder"]');
      select.replaceChildren(...folders.map(f => new Option(folderLabel(f), f.id)));
      this.element.querySelector('[data-folder-type]').textContent = type ?? "Item";
      this.element.querySelector('[data-action="import"]').disabled = !folders.length;
    });
  }

  static async import(event, button) {
    if (!game.user.isGM || this.importing) return;
    const packId = this.element.querySelector('[name="sourcePack"]')?.value;
    const folderId = this.element.querySelector('[name="targetFolder"]')?.value;
    const pack = game.packs.get(packId);
    const folder = game.folders.get(folderId);
    if (!pack || !["Item", "Actor"].includes(pack.documentName) || !folder || folder.type !== pack.documentName) {
      ui.notifications.warn("Select a compendium and a matching world folder first.");
      return;
    }
    this.importing = true;
    button.disabled = true;
    try {
      await game.settings.set(ID, "sourcePack", packId);
      await game.settings.set(ID, "targetFolder", folderId);
      const collection = pack.documentName === "Item" ? game.items : game.actors;
      const imported = new Set(collection.contents
        .map(doc => doc.getFlag(ID, SOURCE_FLAG)).filter(Boolean));
      const index = await pack.getIndex();
      let count = 0;
      for (const entry of index) {
        const sourceUuid = pack.getUuid(entry._id);
        if (imported.has(sourceUuid)) continue;
        await collection.importFromCompendium(pack, entry._id, {
          folder: folder.id,
          flags: { [ID]: { [SOURCE_FLAG]: sourceUuid } }
        });
        imported.add(sourceUuid);
        count++;
      }
      ui.notifications.info(`Imported ${count} ${pack.documentName.toLowerCase()}${count === 1 ? "" : "s"} into ${folder.name}.`);
    } catch (error) {
      console.error(`${ID} | Import failed`, error);
      ui.notifications.error("Compendium import failed. Check the browser console.");
    } finally {
      this.importing = false;
      button.disabled = false;
    }
  }
}

function folderLabel(folder) {
  const names = [folder.name];
  let parent = folder.folder;
  while (parent) { names.unshift(parent.name); parent = parent.folder; }
  return names.join(" / ");
}

Hooks.once("init", () => {
  game.settings.register(ID, "sourcePack", { scope: "world", config: false, type: String, default: "" });
  game.settings.register(ID, "targetFolder", { scope: "world", config: false, type: String, default: "" });
  game.settings.registerMenu(ID, "importer", {
    name: "Compendium Importer",
    label: "Choose Compendium and Import",
    hint: "Select an Item or Actor compendium and a matching world folder, then import its entries.",
    icon: "fa-solid fa-file-import",
    type: CompendiumImporter,
    restricted: true
  });
});
