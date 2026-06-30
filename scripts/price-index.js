import { PRICE_DATA } from "./price-data.js";
import {
  MODULE_ID,
  PRICE_FLAG_PATH,
  PRICE_OVERRIDES_SETTING,
  SUPPORTED_ITEM_TYPES,
  isCoinCurrencyItem
} from "./constants.js";
import { getRegistryItemPrice } from "./price-registry.js";

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
  if (isCoinCurrencyItem(itemData)) return false;

  const explicitPrice = foundry.utils.getProperty(itemData, PRICE_FLAG_PATH);
  if (Number.isFinite(Number(explicitPrice))) return Number(explicitPrice);

  const registryPrice = getRegistryItemPrice(item);
  if (Number.isFinite(Number(registryPrice))) return Number(registryPrice);

  return getBundledItemPriceSync(itemData);
}

export function getBundledItemPriceSync(item) {
  const itemData = item instanceof Item ? item.toObject() : item;
  if (!SUPPORTED_ITEM_TYPES.has(itemData?.type)) return false;

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
