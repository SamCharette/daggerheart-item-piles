import { MODULE_ID } from "./constants.js";
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
      return {
        ...entry,
        encodedKey: encodeURIComponent(entry.key),
        override: Number.isFinite(overrideNumber) ? overrideNumber : "",
        tierLabel: tier,
        search: `${entry.name} ${entry.category} ${tier}`.toLowerCase()
      };
    });
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

    html.find("form.daggerheart-item-piles-price-manager").on("submit", async (event) => {
      event.preventDefault();
      const formData = Object.fromEntries(new FormData(event.currentTarget).entries());
      await this._updateObject(event, formData);
    });

    html.find("input[name='search']").on("input", (event) => {
      const search = event.currentTarget.value.trim().toLowerCase();
      html.find("tbody tr").each((_index, row) => {
        row.style.display = row.dataset.search.includes(search) ? "" : "none";
      });
    });

    html.find("[data-action='clear-search']").on("click", () => {
      html.find("input[name='search']").val("").trigger("input");
    });

    html.find("[data-action='reset-overrides']").on("click", async () => {
      await setPriceOverrides({});
      ui.notifications.info("Daggerheart Item Piles: cleared price overrides.");
      this.render(true);
    });
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
