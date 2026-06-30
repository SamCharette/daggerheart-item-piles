# Daggerheart Item Piles

Foundry VTT module that adds Daggerheart support for Item Piles.

## What It Does

- Registers Daggerheart item quantity support for Item Piles.
- Uses the Daggerheart character sheet's Coin field as the Item Piles primary currency.
- Blocks Coin items from Item Piles buying, selling, pricing, and registry workflows.
- Uses bundled Daggerheart item prices for Item Piles merchants.
- Prompts for quantity when Item Piles tries to buy an entire merchant stack, defaulting to one item.
- Adds a GM-only Price Manager with search, type filters, tier filters, and world-specific price overrides.
- Adds a GM-only Item Price Registry for drag-and-drop homebrew pricing without modifying source items.
- Adds an Item Piles Price button to Daggerheart item sheets that updates the registry entry for that item source.

## Requirements

- Foundry VTT 14
- Daggerheart system 2.4.1 or later
- Item Piles 3.3.2 or later

## Install

In Foundry's **Install Module** screen, paste this manifest URL:

```text
https://raw.githubusercontent.com/SamCharette/daggerheart-item-piles/main/module.json
```

Then enable `Daggerheart Item Piles` in your Daggerheart world.

## Manual Zip Install

1. Stop Foundry.
2. Download the latest release ZIP from GitHub.
3. Unzip this module into the Foundry user data modules folder.
4. Confirm the module file is at:

   ```text
   FoundryVTT/Data/modules/daggerheart-item-piles/module.json
   ```

5. Start Foundry.
6. Open the Daggerheart world as GM.
7. Enable `Daggerheart Item Piles` in Manage Modules.
8. Refresh the browser once after enabling.

## Updating Prices

Default prices are bundled in `scripts/price-data.js`.

GM overrides are stored in the world database, not in module files:

1. Open Configure Settings.
2. Open Module Settings.
3. Find Daggerheart Item Piles.
4. Click Open Price Manager.
5. Search for an item, enter an override price, and save.

Blank overrides use the bundled default price. World overrides should survive module updates.

## Pricing Homebrew Items

Homebrew prices are stored in a world-level module registry, not on the source item or compendium entry.

To register items from the settings menu:

1. Open Configure Settings.
2. Open Module Settings.
3. Find Daggerheart Item Piles.
4. Click Open Registry.
5. Drag items from the item directory or any compendium into the registry.
6. Enter price and default vendor quantity, then save.

To register a single item from its sheet:

1. Open the item sheet.
2. Click the tag icon in the sheet header.
3. Enter the Item Piles value and default vendor quantity, then save.

Registry entries are keyed by source UUID when Foundry exposes one, with a name/type fallback. Items dragged into Item Piles from the item directory, custom compendiums, or rolltable results should use the registry price and quantity when their source can be resolved. Item Piles still applies vendor buy/sell modifiers to the base registry price.

## Building A Handoff Zip

From the Foundry `Data/modules` directory:

```bash
zip -r daggerheart-item-piles.zip daggerheart-item-piles
```
