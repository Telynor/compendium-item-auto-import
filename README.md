# Compendium Item Auto Import

Foundry VTT v14 module. Install the ZIP as a module, enable it in the world, then open **Configure Settings → Module Settings → Compendium Item Auto Import**. Set the source compendium collection ID (such as `world.my-items`) and the destination Items folder name. A GM must be logged in for importing to run.

The module imports all top-level Item entries on load and checks again when the compendium changes. It creates the destination folder if needed, and tags imported entries with their source UUID to prevent duplicate imports. Existing imported items are left as they are; changes or removals in the compendium are not mirrored into world Items. Items in embedded actor inventories are outside the scope of an Item compendium import.
