import {
  COIN_CURRENCIES,
  ITEM_FILTERS,
  ITEM_QUANTITY_PATH,
  PRICE_FLAG_PATH,
  STACKING_SIMILARITIES,
  UNSTACKABLE_TYPES,
  isCoinCurrencyItem
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

  installTradeQuantityGuard(api);
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

function installTradeQuantityGuard(api) {
  if (api.tradeItems?.daggerheartItemPilesGuarded) return;

  const originalTradeItems = api.tradeItems.bind(api);
  const guardedTradeItems = async (seller, buyer, items, options) => {
    const sellerActor = normalizeActor(seller);
    items = filterTradeCurrencyItems(items ?? [], sellerActor);
    if (!items.length) return false;

    if (sellerActor && api.isItemPileMerchant?.(sellerActor)) {
      items = await promptForDefaultStackQuantities(items, sellerActor);
      if (!items) return false;
    }

    return originalTradeItems(seller, buyer, items, options);
  };

  guardedTradeItems.daggerheartItemPilesGuarded = true;
  guardedTradeItems.daggerheartItemPilesOriginal = originalTradeItems;
  api.tradeItems = guardedTradeItems;
}

function filterTradeCurrencyItems(entries, sellerActor) {
  return (entries ?? []).filter((entry) => {
    const item = resolveActorItem(entry?.item, sellerActor);
    return !item || !isCoinCurrencyItem(item);
  });
}

async function promptForDefaultStackQuantities(entries, sellerActor) {
  const promptedEntries = [];

  for (const entry of entries) {
    const promptedEntry = await promptForDefaultStackQuantity(entry, sellerActor);
    if (!promptedEntry) return null;
    promptedEntries.push(promptedEntry);
  }

  return promptedEntries;
}

async function promptForDefaultStackQuantity(entry, sellerActor) {
  const data = { ...entry };
  const item = resolveActorItem(data.item, sellerActor);
  if (!item) return data;

  const itemData = item instanceof Item ? item.toObject() : item;
  const itemQuantity = Number(foundry.utils.getProperty(itemData, ITEM_QUANTITY_PATH));
  const requestedQuantity = Number(data.quantity);

  if (Number.isFinite(itemQuantity) && itemQuantity > 1 && requestedQuantity === itemQuantity) {
    const quantity = await promptPurchaseQuantity(itemData, itemQuantity);
    if (!quantity) return null;
    data.quantity = quantity;
  }

  return data;
}

async function promptPurchaseQuantity(itemData, maxQuantity) {
  const itemName = escapeHtml(itemData?.name ?? "Item");
  const content = `
    <form class="daggerheart-item-piles-quantity-prompt">
      <p>Select how many <strong>${itemName}</strong> to buy.</p>
      <div class="form-group">
        <label>Quantity</label>
        <input type="number" name="quantity" value="1" min="1" max="${maxQuantity}" step="1" autofocus>
      </div>
    </form>
  `;

  const formData = await foundry.applications.api.DialogV2.input({
    window: {
      icon: "fa-solid fa-cart-shopping",
      title: "Choose Purchase Quantity"
    },
    position: { width: 360 },
    content,
    ok: {
      label: "Buy",
      icon: "fa-solid fa-cart-shopping"
    },
    rejectClose: false
  });

  const quantity = Number(formData?.quantity);
  if (!Number.isFinite(quantity)) return null;
  return Math.max(1, Math.min(maxQuantity, Math.floor(quantity)));
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeActor(target) {
  if (target instanceof Actor) return target;
  if (target?.actor instanceof Actor) return target.actor;

  const uuid = typeof target === "string" ? target : target?.uuid;
  return resolveUuidSync(uuid)
    ?? (typeof target === "string" ? game.actors.get(target) : null)
    ?? null;
}

function resolveActorItem(itemReference, actor) {
  if (itemReference instanceof Item) return itemReference;
  if (!actor?.items) return null;

  if (typeof itemReference === "string") {
    return actor.items.get(itemReference) ?? actor.items.getName(itemReference) ?? null;
  }

  return actor.items.get(itemReference?._id ?? itemReference?.id)
    ?? actor.items.getName(itemReference?.name)
    ?? null;
}

function resolveUuidSync(uuid) {
  if (!uuid) return null;
  try {
    return fromUuidSync(uuid);
  } catch (_error) {
    return null;
  }
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
    path: currency.data?.path,
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
