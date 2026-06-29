import {
  BLOCKED_ITEM_TYPES,
  MODULE_ID
} from "./constants.js";
import {
  ensureItemPilesWorldSettings,
  registerItemPilesIntegration,
  warmPriceIndex
} from "./item-piles-integration.js";
import {
  getDefaultPriceEntries,
  getItemPriceSync,
  getPriceOverrides,
  normalizeItemName,
  setPriceOverrides
} from "./price-index.js";

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
  globalThis.daggerheartItemPiles.openPriceEditor = openItemPriceEditor;
});

Hooks.on("preCreateItem", (item) => {
  if (game.system.id !== "daggerheart") return;

  const price = getItemPriceSync(item);
  if (!Number.isFinite(price)) return;

  item.updateSource({
    "flags.daggerheart-item-piles.price": price,
    "flags.daggerheart-item-piles.priceSource": "daggerheart-item-piles-price-data"
  });
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

  game.settings.registerMenu(MODULE_ID, "priceManager", {
    name: "Price Manager",
    label: "Open Price Manager",
    hint: "Review and override bundled Daggerheart item prices used by Item Piles merchants.",
    icon: "fas fa-tags",
    type: PriceManagerForm,
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
    && item.isOwner
    && !BLOCKED_ITEM_TYPES.includes(item.type);
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
    const explicitPrice = this.item.getFlag(MODULE_ID, "price");
    const defaultPrice = getDefaultItemPrice(this.item);
    const currentPrice = Number.isFinite(Number(explicitPrice)) ? Number(explicitPrice) : "";

    return {
      itemName: this.item.name,
      itemType: this.item.type,
      price: currentPrice,
      defaultPrice: Number.isFinite(defaultPrice) ? defaultPrice : "",
      hasDefaultPrice: Number.isFinite(defaultPrice),
      source: this.item.getFlag(MODULE_ID, "priceSource") ?? ""
    };
  }

  activateListeners(html) {
    super.activateListeners(html);

    html.find("[data-action='clear-price']").on("click", async () => {
      await this.item.unsetFlag(MODULE_ID, "price");
      await this.item.unsetFlag(MODULE_ID, "priceSource");
      ui.notifications.info(`Daggerheart Item Piles: cleared ${this.item.name} price.`);
      this.close();
    });
  }

  async _updateObject(_event, formData) {
    const value = formData.price;
    if (value === "" || value === null || value === undefined) {
      await this.item.unsetFlag(MODULE_ID, "price");
      await this.item.unsetFlag(MODULE_ID, "priceSource");
      ui.notifications.info(`Daggerheart Item Piles: cleared ${this.item.name} price.`);
      return;
    }

    const price = Number(value);
    if (!Number.isFinite(price) || price < 0) {
      ui.notifications.warn("Daggerheart Item Piles: enter a price of 0 or higher.");
      return;
    }

    await this.item.setFlag(MODULE_ID, "price", price);
    await this.item.setFlag(MODULE_ID, "priceSource", "manual");
    ui.notifications.info(`Daggerheart Item Piles: set ${this.item.name} to ${price} gp.`);
  }
}

function getDefaultItemPrice(item) {
  const explicitPrice = item.getFlag(MODULE_ID, "price");
  if (Number.isFinite(Number(explicitPrice))) {
    return globalThis.daggerheartItemPiles?.priceIndex?.get(normalizeItemName(item.name));
  }

  return getItemPriceSync(item);
}
