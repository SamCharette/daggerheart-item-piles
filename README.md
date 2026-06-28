# Daggerheart Item Piles

Private Foundry VTT module that adds Daggerheart support for Item Piles.

## What It Does

- Registers Daggerheart item quantity support for Item Piles.
- Adds D&D-style coin currencies: gp, sp, cp, and pp.
- Uses bundled Daggerheart item prices for Item Piles merchants.
- Adds a GM-only Price Manager for world-specific price overrides.
- Blocks character-build items, such as ancestry, class, subclass, domain cards, and features, from player sell lists.

## Requirements

- Foundry VTT 14
- Daggerheart system 2.4.1 or later
- Item Piles 3.3.2 or later

## Install From A Zip

1. Stop Foundry.
2. Unzip this module into the Foundry user data modules folder.
3. Confirm the module file is at:

   ```text
   FoundryVTT/Data/modules/daggerheart-item-piles/module.json
   ```

4. Start Foundry.
5. Open the Daggerheart world as GM.
6. Enable `Daggerheart Item Piles` in Manage Modules.
7. Refresh the browser once after enabling.

## Updating Prices

Default prices are bundled in `scripts/price-data.js`.

GM overrides are stored in the world database, not in module files:

1. Open Configure Settings.
2. Open Module Settings.
3. Find Daggerheart Item Piles.
4. Click Open Price Manager.
5. Search for an item, enter an override price, and save.

Blank overrides use the bundled default price. World overrides should survive module updates.

## Building A Handoff Zip

From the Foundry `Data/modules` directory:

```bash
zip -r daggerheart-item-piles.zip daggerheart-item-piles
```
