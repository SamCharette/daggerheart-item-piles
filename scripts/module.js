import {
  ITEM_QUANTITY_PATH,
  MODULE_ID,
  PRICE_REGISTRY_SETTING
} from "./constants.js";
import {
  ensureItemPilesWorldSettings,
  registerItemPilesIntegration,
  warmPriceIndex
} from "./item-piles-integration.js";
import {
  getBundledItemPriceSync,
  getDefaultPriceEntries,
  getPriceOverrides,
  normalizeItemName,
  setPriceOverrides
} from "./price-index.js";
import {
  applyRegistryDataToItemData,
  createRegistryEntryFromItem,
  deletePriceRegistryEntry,
  findPriceRegistryEntry,
  getPriceRegistryEntries,
  upsertPriceRegistryEntry
} from "./price-registry.js";

Hooks.once("init", () => {
  registerModuleSettings();
  registerItemSheetPriceEditor();
});

Hooks.once("setup", () => {
  if (game.system.id !== "daggerheart") return;
  registerItemPilesIntegration();
});

Hooks.once("ready", async () => {
  if (game.system.id !== "daggerheart") return;

  await waitForItemPilesAPI();
  registerItemPilesIntegration();
  await warmPriceIndex();
  await ensureItemPilesWorldSettings();

  globalThis.daggerheartItemPiles ??= {};
  globalThis.daggerheartItemPiles.openPriceRegistry = () => new PriceRegistryForm().render(true);
  globalThis.daggerheartItemPiles.openPriceEditor = openItemPriceEditor;
});

Hooks.on("item-piles-preDropItem", (_source, _target, _position, itemData) => {
  if (game.system.id !== "daggerheart") return;
  applyRegistryDataToItemData(itemData?.item);
  if (itemData?.item) itemData.quantity = foundry.utils.getProperty(itemData.item, ITEM_QUANTITY_PATH) ?? itemData.quantity;
});

Hooks.on("item-piles-preAddItems", (_targetActor, itemsToCreate) => {
  if (game.system.id !== "daggerheart") return;
  for (const itemData of itemsToCreate ?? []) applyRegistryDataToItemData(itemData);
});

async function waitForItemPilesAPI() {
  for (let i = 0; i < 20; i += 1) {
    if (game.itempiles?.API) return true;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  console.warn("daggerheart-item-piles | Item Piles API was not available after waiting.");
  return false;
}

function registerModuleSettings() {
  game.settings.register(MODULE_ID, "priceOverrides", {
    name: "Price Overrides",
    hint: "GM-edited item prices keyed by normalized item name. Use the Price Manager instead of editing this directly.",
    scope: "world",
    config: false,
    type: Object,
    default: {}
  });

  game.settings.register(MODULE_ID, PRICE_REGISTRY_SETTING, {
    name: "Item Price Registry",
    hint: "GM-curated Item Piles prices keyed by item source UUID. Use the Item Price Registry instead of editing this directly.",
    scope: "world",
    config: false,
    type: Object,
    default: { version: 1, entries: {} }
  });

  game.settings.registerMenu(MODULE_ID, "priceManager", {
    name: "Price Manager",
    label: "Open Price Manager",
    hint: "Review and override bundled Daggerheart item prices used by Item Piles merchants.",
    icon: "fas fa-tags",
    type: PriceManagerForm,
    restricted: true
  });

  game.settings.registerMenu(MODULE_ID, "priceRegistry", {
    name: "Item Price Registry",
    label: "Open Registry",
    hint: "Drag items from the item directory or compendiums, then set Item Piles prices and default vendor quantities without modifying source items.",
    icon: "fas fa-list-check",
    type: PriceRegistryForm,
    restricted: true
  });
}

function registerItemSheetPriceEditor() {
  Hooks.on("getHeaderControlsItemSheetV2", (app, controls) => {
    const item = app.document;
    if (!canEditItemPilesPrice(item)) return;

    controls.push({
      icon: "fas fa-tags",
      label: "Item Piles Price",
      action: "daggerheart-item-piles-price",
      onClick: () => openItemPriceEditor(item)
    });
  });

  Hooks.on("getItemSheetHeaderButtons", (app, buttons) => {
    const item = app.object;
    if (!canEditItemPilesPrice(item)) return;

    buttons.unshift({
      label: "Item Piles Price",
      class: "daggerheart-item-piles-price",
      icon: "fas fa-tags",
      onclick: () => openItemPriceEditor(item)
    });
  });
}

function canEditItemPilesPrice(item) {
  return game.system.id === "daggerheart"
    && item instanceof Item
    && item.isOwner;
}

function openItemPriceEditor(item) {
  if (!canEditItemPilesPrice(item)) return;
  new ItemPriceForm(item).render(true);
}

class PriceManagerForm extends FormApplication {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "daggerheart-item-piles-price-manager",
      title: "Daggerheart Item Piles Price Manager",
      template: "modules/daggerheart-item-piles/templates/price-manager.html",
      width: 760,
      height: 720,
      resizable: true,
      closeOnSubmit: false,
      submitOnChange: false
    });
  }

  get entries() {
    const overrides = getPriceOverrides();
    return getDefaultPriceEntries().map((entry) => {
      const override = overrides[entry.key];
      const overrideNumber = Number(override);
      const tier = entry.tier ? `Tier ${entry.tier}` : "";
      const tierKey = entry.tier ? String(entry.tier) : "none";
      return {
        ...entry,
        encodedKey: encodeURIComponent(entry.key),
        categoryKey: encodeURIComponent(entry.category),
        override: Number.isFinite(overrideNumber) ? overrideNumber : "",
        tierKey,
        tierLabel: tier,
        search: `${entry.name} ${entry.category} ${tier}`.toLowerCase()
      };
    });
  }

  getData() {
    const entries = this.entries;
    return {
      entries,
      entryCount: entries.length,
      categoryOptions: this.getCategoryOptions(entries),
      tierOptions: this.getTierOptions(entries)
    };
  }

  getCategoryOptions(entries) {
    const counts = new Map();
    for (const entry of entries) {
      counts.set(entry.category, (counts.get(entry.category) ?? 0) + 1);
    }

    return [...counts.entries()]
      .map(([label, count]) => ({
        label,
        count,
        key: encodeURIComponent(label)
      }));
  }

  getTierOptions(entries) {
    const counts = new Map();
    for (const entry of entries) {
      const key = entry.tierKey;
      const label = entry.tier ? `Tier ${entry.tier}` : "No Tier";
      const option = counts.get(key) ?? { key, label, count: 0, sort: entry.tier ?? 99 };
      option.count += 1;
      counts.set(key, option);
    }

    return [...counts.values()].sort((left, right) => left.sort - right.sort);
  }

  activateListeners(html) {
    super.activateListeners(html);

    const filterState = {
      category: "all",
      tier: "all",
      search: ""
    };

    const applyFilters = () => {
      let visibleCount = 0;
      html.find("tbody tr[data-search]").each((_index, row) => {
        const matchesCategory = filterState.category === "all" || row.dataset.category === filterState.category;
        const matchesTier = filterState.tier === "all" || row.dataset.tier === filterState.tier;
        const matchesSearch = !filterState.search || row.dataset.search.includes(filterState.search);
        const isVisible = matchesCategory && matchesTier && matchesSearch;
        row.style.display = isVisible ? "" : "none";
        if (isVisible) visibleCount += 1;
      });

      html.find("[data-visible-count]").text(visibleCount);
      html.find("[data-filter-empty]").toggle(visibleCount === 0);
    };

    html.find("form.daggerheart-item-piles-price-manager").on("submit", async (event) => {
      event.preventDefault();
      const formData = Object.fromEntries(new FormData(event.currentTarget).entries());
      await this._updateObject(event, formData);
    });

    html.find("input[name='search']").on("input", (event) => {
      filterState.search = event.currentTarget.value.trim().toLowerCase();
      applyFilters();
    });

    html.find("[data-action='clear-search']").on("click", () => {
      html.find("input[name='search']").val("").trigger("input");
    });

    html.find("[data-filter-category]").on("click", (event) => {
      const button = event.currentTarget;
      filterState.category = button.dataset.filterCategory;
      html.find("[data-filter-category]").removeClass("active");
      button.classList.add("active");
      applyFilters();
    });

    html.find("[data-filter-tier]").on("click", (event) => {
      const button = event.currentTarget;
      filterState.tier = button.dataset.filterTier;
      html.find("[data-filter-tier]").removeClass("active");
      button.classList.add("active");
      applyFilters();
    });

    html.find("[data-action='reset-overrides']").on("click", async () => {
      await setPriceOverrides({});
      ui.notifications.info("Daggerheart Item Piles: cleared price overrides.");
      this.render(true);
    });

    applyFilters();
  }

  async _updateObject(_event, formData) {
    const overrides = {};

    for (const [path, value] of Object.entries(formData)) {
      if (!path.startsWith("override--")) continue;
      if (value === "" || value === null || value === undefined) continue;

      const key = normalizeItemName(decodeURIComponent(path.slice("override--".length)));
      const price = Number(value);
      if (!key || !Number.isFinite(price) || price < 0) continue;
      overrides[key] = price;
    }

    await setPriceOverrides(overrides);
    ui.notifications.info(`Daggerheart Item Piles: saved ${Object.keys(overrides).length} price override(s).`);
    this.render(true);
  }
}

class PriceRegistryForm extends FormApplication {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "daggerheart-item-piles-price-registry",
      title: "Daggerheart Item Piles Price Registry",
      template: "modules/daggerheart-item-piles/templates/price-registry.html",
      width: 860,
      height: 720,
      resizable: true,
      closeOnSubmit: false,
      submitOnChange: false
    });
  }

  get entries() {
    return getPriceRegistryEntries().map((entry) => ({
      ...entry,
      encodedKey: encodeURIComponent(entry.key),
      price: Number.isFinite(Number(entry.price)) ? Number(entry.price) : "",
      quantity: Number.isFinite(Number(entry.quantity)) ? Number(entry.quantity) : 1,
      search: `${entry.name} ${entry.type} ${entry.uuid} ${entry.fallbackKey}`.toLowerCase()
    }));
  }

  getData() {
    const entries = this.entries;
    return {
      entries,
      entryCount: entries.length
    };
  }

  activateListeners(html) {
    super.activateListeners(html);

    html.find("form.daggerheart-item-piles-price-registry").on("submit", async (event) => {
      event.preventDefault();
      const formData = Object.fromEntries(new FormData(event.currentTarget).entries());
      await this._updateObject(event, formData);
    });

    html.find("input[name='search']").on("input", (event) => {
      const search = event.currentTarget.value.trim().toLowerCase();
      let visibleCount = 0;
      html.find("tbody tr[data-search]").each((_index, row) => {
        const isVisible = !search || row.dataset.search.includes(search);
        row.style.display = isVisible ? "" : "none";
        if (isVisible) visibleCount += 1;
      });
      html.find("[data-visible-count]").text(visibleCount);
      html.find("[data-filter-empty]").toggle(visibleCount === 0);
    });

    html.find("[data-action='clear-search']").on("click", () => {
      html.find("input[name='search']").val("").trigger("input");
    });

    html.find("[data-action='remove-entry']").on("click", async (event) => {
      const key = decodeURIComponent(event.currentTarget.dataset.key);
      await deletePriceRegistryEntry(key);
      ui.notifications.info("Daggerheart Item Piles: removed registry entry.");
      this.render(true);
    });

    const dropZone = html.find("[data-drop-zone]");
    dropZone.on("dragover", (event) => event.preventDefault());
    dropZone.on("drop", async (event) => {
      event.preventDefault();
      await this._updateObject(event, Object.fromEntries(new FormData(html[0]).entries()));

      const data = getDropData(event.originalEvent ?? event);
      if (!data) return;

      const item = await Item.implementation.fromDropData(data);
      if (!(item instanceof Item)) {
        ui.notifications.warn("Daggerheart Item Piles: only Item documents can be added to the registry.");
        return;
      }

      const existing = findPriceRegistryEntry(item);
      const entry = createRegistryEntryFromItem(item, existing ?? {});
      if (!entry) {
        ui.notifications.warn("Daggerheart Item Piles: could not identify that item.");
        return;
      }

      await upsertPriceRegistryEntry(entry);
      ui.notifications.info(`Daggerheart Item Piles: added ${entry.name} to the price registry.`);
      this.render(true);
    });
  }

  async _updateObject(_event, formData) {
    const entries = getPriceRegistryEntries();

    for (const entry of entries) {
      const encodedKey = encodeURIComponent(entry.key);
      const price = formData[`price--${encodedKey}`];
      const quantity = formData[`quantity--${encodedKey}`];
      await upsertPriceRegistryEntry({
        ...entry,
        price,
        quantity
      });
    }

    ui.notifications.info(`Daggerheart Item Piles: saved ${entries.length} registry entr${entries.length === 1 ? "y" : "ies"}.`);
    this.render(true);
  }
}

class ItemPriceForm extends FormApplication {
  constructor(item, options = {}) {
    super(item, options);
    this.item = item;
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "daggerheart-item-piles-item-price",
      title: "Item Piles Price",
      template: "modules/daggerheart-item-piles/templates/item-price.html",
      width: 420,
      height: "auto",
      closeOnSubmit: true,
      submitOnChange: false
    });
  }

  getData() {
    const entry = findPriceRegistryEntry(this.item);
    const draftEntry = createRegistryEntryFromItem(this.item, entry ?? {});
    const defaultPrice = getDefaultItemPrice(this.item);
    const currentPrice = Number.isFinite(Number(entry?.price)) ? Number(entry.price) : "";
    const quantity = Number.isFinite(Number(entry?.quantity)) ? Number(entry.quantity) : 1;

    return {
      itemName: this.item.name,
      itemType: this.item.type,
      itemKey: draftEntry?.key ?? "",
      itemUuid: draftEntry?.uuid ?? "",
      price: currentPrice,
      quantity,
      defaultPrice: Number.isFinite(defaultPrice) ? defaultPrice : "",
      hasDefaultPrice: Number.isFinite(defaultPrice)
    };
  }

  activateListeners(html) {
    super.activateListeners(html);

    html.find("[data-action='clear-price']").on("click", async () => {
      const entry = createRegistryEntryFromItem(this.item);
      if (entry) await deletePriceRegistryEntry(entry.key);
      ui.notifications.info(`Daggerheart Item Piles: removed ${this.item.name} from the price registry.`);
      this.close();
    });
  }

  async _updateObject(_event, formData) {
    const entry = createRegistryEntryFromItem(this.item, {
      price: formData.price,
      quantity: formData.quantity
    });

    if (!entry) {
      ui.notifications.warn("Daggerheart Item Piles: could not identify that item.");
      return;
    }

    if (formData.price !== "" && entry.price === null) {
      ui.notifications.warn("Daggerheart Item Piles: enter a price of 0 or higher.");
      return;
    }

    await upsertPriceRegistryEntry(entry);
    const priceText = entry.price === null ? "no price" : `${entry.price} Coin`;
    ui.notifications.info(`Daggerheart Item Piles: registered ${this.item.name} with ${priceText}.`);
  }
}

function getDefaultItemPrice(item) {
  return getBundledItemPriceSync(item);
}

function getDropData(event) {
  const raw = event.dataTransfer?.getData("text/plain");
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (_error) {
    return null;
  }
}
