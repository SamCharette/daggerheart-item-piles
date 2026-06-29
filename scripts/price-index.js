import { PRICE_DATA } from "./price-data.js";
import {
  MODULE_ID,
  PRICE_FLAG_PATH,
  PRICE_OVERRIDES_SETTING,
  PRICE_SOURCE,
  PRICE_SOURCE_FLAG_PATH,
  SUPPORTED_ITEM_TYPES
} from "./constants.js";

let priceIndexPromise = null;

export async function getPriceIndex() {
  priceIndexPromise ??= buildPriceIndex();
  return priceIndexPromise;
}

export async function getItemPrice(item) {
  const itemData = item instanceof Item ? item.toObject() : item;
  return getItemPriceSync(itemData) ?? false;
}

export function getItemPriceSync(item) {
  const itemData = item instanceof Item ? item.toObject() : item;
  if (!SUPPORTED_ITEM_TYPES.has(itemData?.type)) return false;

  const explicitPrice = foundry.utils.getProperty(itemData, PRICE_FLAG_PATH);
  if (Number.isFinite(Number(explicitPrice))) return Number(explicitPrice);

  const index = globalThis.daggerheartItemPiles?.priceIndex;
  return index?.get(normalizeItemName(itemData?.name)) ?? false;
}

export function getDefaultPriceEntries() {
  const entries = [];
  const categoryOrder = new Map(Object.keys(PRICE_DATA).map((category, index) => [category, index]));

  for (const [category, categoryData] of Object.entries(PRICE_DATA)) {
    for (const [name, data] of Object.entries(categoryData ?? {})) {
      const price = Number(data?.price);
      if (!Number.isFinite(price)) continue;
      entries.push({
        category,
        name,
        key: normalizeItemName(name),
        price,
        tier: Number.isFinite(Number(data?.tier)) ? Number(data.tier) : null
      });
    }
  }

  return entries.sort((left, right) => (
    (categoryOrder.get(left.category) ?? 999) - (categoryOrder.get(right.category) ?? 999)
    || (left.tier ?? 0) - (right.tier ?? 0)
    || left.name.localeCompare(right.name)
  ));
}

export function getPriceOverrides() {
  return game.settings.get(MODULE_ID, PRICE_OVERRIDES_SETTING) ?? {};
}

export async function setPriceOverrides(overrides) {
  const cleanOverrides = {};

  for (const [key, value] of Object.entries(overrides ?? {})) {
    const price = Number(value);
    const normalizedKey = normalizeItemName(key);
    if (!normalizedKey || !Number.isFinite(price) || price < 0) continue;
    cleanOverrides[normalizedKey] = price;
  }

  await game.settings.set(MODULE_ID, PRICE_OVERRIDES_SETTING, cleanOverrides);
  await refreshPriceIndex();
}

export async function refreshPriceIndex() {
  priceIndexPromise = null;
  globalThis.daggerheartItemPiles ??= {};
  globalThis.daggerheartItemPiles.priceIndex = await getPriceIndex();
}

export async function seedWorldItemPrices() {
  if (!game.user.isGM) return { actorItemsUpdated: 0, worldItemsUpdated: 0, matched: 0, skipped: 0 };

  const index = await getPriceIndex();
  const worldItemUpdates = [];
  const actorItemUpdates = new Map();
  let matched = 0;
  let skipped = 0;

  for (const item of game.items) {
    if (!SUPPORTED_ITEM_TYPES.has(item.type)) {
      skipped += 1;
      continue;
    }

    const existingPrice = item.getFlag("daggerheart-item-piles", "price");
    if (Number.isFinite(Number(existingPrice))) {
      skipped += 1;
      continue;
    }

    const price = index.get(normalizeItemName(item.name));
    if (!Number.isFinite(price)) {
      skipped += 1;
      continue;
    }

    matched += 1;
    worldItemUpdates.push({
      _id: item.id,
      [PRICE_FLAG_PATH]: price,
      [PRICE_SOURCE_FLAG_PATH]: PRICE_SOURCE
    });
  }

  for (const actor of game.actors) {
    const updates = [];
    for (const item of actor.items) {
      if (!SUPPORTED_ITEM_TYPES.has(item.type)) {
        skipped += 1;
        continue;
      }

      const existingPrice = item.getFlag("daggerheart-item-piles", "price");
      if (Number.isFinite(Number(existingPrice))) {
        skipped += 1;
        continue;
      }

      const price = index.get(normalizeItemName(item.name));
      if (!Number.isFinite(price)) {
        skipped += 1;
        continue;
      }

      matched += 1;
      updates.push({
        _id: item.id,
        [PRICE_FLAG_PATH]: price,
        [PRICE_SOURCE_FLAG_PATH]: PRICE_SOURCE
      });
    }

    if (updates.length) actorItemUpdates.set(actor, updates);
  }

  if (worldItemUpdates.length) await Item.updateDocuments(worldItemUpdates);
  for (const [actor, updates] of actorItemUpdates) {
    await actor.updateEmbeddedDocuments("Item", updates);
  }

  const actorItemsUpdated = [...actorItemUpdates.values()].reduce((total, updates) => total + updates.length, 0);
  return { actorItemsUpdated, worldItemsUpdated: worldItemUpdates.length, matched, skipped };
}

async function buildPriceIndex() {
  const index = new Map();

  for (const category of Object.values(PRICE_DATA)) {
    for (const [name, data] of Object.entries(category ?? {})) {
      const price = Number(data?.price);
      if (!Number.isFinite(price)) continue;
      index.set(normalizeItemName(name), price);
    }
  }

  for (const [name, value] of Object.entries(getPriceOverrides())) {
    const price = Number(value);
    if (!Number.isFinite(price)) continue;
    index.set(normalizeItemName(name), price);
  }

  return index;
}

export function normalizeItemName(name) {
  return String(name ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}
