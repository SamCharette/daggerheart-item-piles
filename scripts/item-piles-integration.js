import {
  COIN_CURRENCIES,
  ITEM_FILTERS,
  ITEM_QUANTITY_PATH,
  PRICE_FLAG_PATH,
  STACKING_SIMILARITIES,
  UNSTACKABLE_TYPES
} from "./constants.js";
import { getItemPriceSync } from "./price-index.js";

export function registerItemPilesIntegration() {
  const api = game.itempiles?.API;
  if (!api) {
    console.warn("daggerheart-item-piles | Item Piles API was not available during init.");
    return;
  }

  api.addSystemIntegration({
    VERSION: game.system.version,
    ACTOR_CLASS_TYPE: "character",
    ITEM_CLASS_LOOT_TYPE: "loot",
    ITEM_CLASS_WEAPON_TYPE: "weapon",
    ITEM_CLASS_EQUIPMENT_TYPE: "armor",
    ITEM_QUANTITY_ATTRIBUTE: ITEM_QUANTITY_PATH,
    ITEM_PRICE_ATTRIBUTE: PRICE_FLAG_PATH,
    ITEM_FILTERS,
    ITEM_SIMILARITIES: STACKING_SIMILARITIES,
    UNSTACKABLE_ITEM_TYPES: UNSTACKABLE_TYPES,
    CURRENCIES: COIN_CURRENCIES,
    CURRENCY_DECIMAL_DIGITS: 0,
    ITEM_COST_TRANSFORMER: itemCostTransformer,
    PILE_DEFAULTS: {
      shareCurrenciesEnabled: true,
      splitAllEnabled: true,
      canInspectItems: true,
      displayItemTypes: true
    }
  });
}

export async function ensureItemPilesWorldSettings() {
  if (!game.user.isGM) return;

  const api = game.itempiles?.API;
  if (!api) return;

  const changes = [];

  if (api.ITEM_QUANTITY_ATTRIBUTE !== ITEM_QUANTITY_PATH) {
    await api.setItemQuantityAttribute(ITEM_QUANTITY_PATH);
    changes.push("quantity path");
  }

  if (api.ITEM_PRICE_ATTRIBUTE !== PRICE_FLAG_PATH) {
    await api.setItemPriceAttribute(PRICE_FLAG_PATH);
    changes.push("price path");
  }

  if (!sameCurrencySet(api.CURRENCIES, COIN_CURRENCIES)) {
    await api.setCurrencies(COIN_CURRENCIES);
    changes.push("coin currencies");
  }

  if (!sameStringSet(api.UNSTACKABLE_ITEM_TYPES, UNSTACKABLE_TYPES)) {
    await api.setUnstackableItemTypes(UNSTACKABLE_TYPES);
    changes.push("unstackable item types");
  }

  if (!sameStringSet(api.ITEM_SIMILARITIES, STACKING_SIMILARITIES)) {
    await api.setItemSimilarities(STACKING_SIMILARITIES);
    changes.push("stacking similarities");
  }

  if (!sameFilters(api.ITEM_FILTERS, ITEM_FILTERS)) {
    await api.setItemFilters(ITEM_FILTERS);
    changes.push("item filters");
  }

  if (changes.length) {
    console.info(`daggerheart-item-piles | Updated Item Piles settings: ${changes.join(", ")}.`);
  }
}

function itemCostTransformer(item) {
  return getItemPriceSync(item);
}

function sameCurrencySet(left, right) {
  return JSON.stringify(simplifyCurrencies(left)) === JSON.stringify(simplifyCurrencies(right));
}

function simplifyCurrencies(currencies) {
  return (currencies ?? []).map((currency) => ({
    name: currency.name,
    abbreviation: currency.abbreviation,
    exchangeRate: currency.exchangeRate,
    primary: currency.primary,
    type: currency.type,
    itemName: currency.data?.item?.name
  }));
}

function sameStringSet(left, right) {
  const leftValues = [...(left ?? [])].sort();
  const rightValues = [...(right ?? [])].sort();
  return JSON.stringify(leftValues) === JSON.stringify(rightValues);
}

function sameFilters(left, right) {
  const normalize = (filters) => (filters ?? []).map((filter) => ({
    path: filter.path,
    filters: Array.isArray(filter.filters) ? filter.filters.join(",") : filter.filters
  }));
  return JSON.stringify(normalize(left)) === JSON.stringify(normalize(right));
}

export async function warmPriceIndex() {
  const { getPriceIndex } = await import("./price-index.js");
  globalThis.daggerheartItemPiles ??= {};
  globalThis.daggerheartItemPiles.priceIndex = await getPriceIndex();
}
