import {
  ITEM_QUANTITY_PATH,
  MODULE_ID,
  PRICE_REGISTRY_SETTING,
  SOURCE_UUID_FLAG_PATH
} from "./constants.js";

export function getPriceRegistry() {
  return normalizeRegistry(game.settings.get(MODULE_ID, PRICE_REGISTRY_SETTING));
}

export async function setPriceRegistry(registry) {
  await game.settings.set(MODULE_ID, PRICE_REGISTRY_SETTING, normalizeRegistry(registry));
}

export function getPriceRegistryEntries() {
  return Object.values(getPriceRegistry().entries)
    .sort((left, right) => left.name.localeCompare(right.name) || left.key.localeCompare(right.key));
}

export async function upsertPriceRegistryEntry(entry) {
  const registry = getPriceRegistry();
  const normalized = normalizeEntry(entry);
  if (!normalized) return null;
  registry.entries[normalized.key] = normalized;
  await setPriceRegistry(registry);
  return normalized;
}

export async function deletePriceRegistryEntry(key) {
  const registry = getPriceRegistry();
  delete registry.entries[key];
  await setPriceRegistry(registry);
}

export function getRegistryItemPrice(item) {
  const entry = findPriceRegistryEntry(item);
  const price = Number(entry?.price);
  return Number.isFinite(price) ? price : false;
}

export function findPriceRegistryEntry(item) {
  const registry = getPriceRegistry();
  const identity = getItemRegistryIdentity(item);

  for (const key of identity.keys) {
    const entry = registry.entries[key];
    if (entry) return entry;
  }

  if (identity.fallbackKey) {
    const entry = Object.values(registry.entries)
      .find((candidate) => candidate.fallbackKey === identity.fallbackKey);
    if (entry) return entry;
  }

  return null;
}

export function createRegistryEntryFromItem(item, overrides = {}) {
  const itemData = item instanceof Item ? item.toObject() : item;
  const identity = getItemRegistryIdentity(item);
  const key = identity.primaryKey;
  if (!key) return null;

  return normalizeEntry({
    ...overrides,
    key,
    uuid: identity.sourceUuid,
    fallbackKey: identity.fallbackKey,
    name: itemData?.name ?? "Unnamed Item",
    type: itemData?.type ?? "",
    img: itemData?.img ?? "",
    price: overrides.price ?? null,
    quantity: overrides.quantity ?? 1
  });
}

export function getItemRegistryIdentity(item) {
  const itemData = item instanceof Item ? item.toObject() : item;
  const uuids = [
    getProperty(itemData, SOURCE_UUID_FLAG_PATH),
    getProperty(itemData, "_stats.compendiumSource"),
    getProperty(itemData, "_stats.duplicateSource"),
    getProperty(itemData, "flags.core.sourceId"),
    getProperty(itemData, "flags.core.sourceUuid"),
    item instanceof Item ? item.uuid : null,
    itemData?.uuid
  ].filter(Boolean);

  const sourceUuid = firstUnique(uuids);
  const fallbackKey = makeFallbackKey(itemData);
  const keys = [...new Set([sourceUuid, fallbackKey].filter(Boolean))];

  return {
    sourceUuid,
    fallbackKey,
    primaryKey: sourceUuid || fallbackKey,
    keys
  };
}

export function applyRegistryDataToItemData(itemData, options = {}) {
  if (!itemData) return itemData;
  if (itemData.item) {
    applyRegistryDataToItemData(itemData.item, {
      existingQuantity: itemData.quantity
    });
    const quantity = getProperty(itemData.item, ITEM_QUANTITY_PATH);
    if (Number.isFinite(Number(quantity))) itemData.quantity = Number(quantity);
    return itemData;
  }

  const identity = getItemRegistryIdentity(itemData);
  const entry = findPriceRegistryEntry(itemData);

  if (identity.sourceUuid) {
    setProperty(itemData, SOURCE_UUID_FLAG_PATH, identity.sourceUuid);
  }

  const existingQuantity = Number(options.existingQuantity ?? getProperty(itemData, ITEM_QUANTITY_PATH));
  const registryQuantity = Number(entry?.quantity);
  const quantity = Number.isFinite(existingQuantity) && existingQuantity > 1
    ? existingQuantity
    : registryQuantity;

  if (Number.isFinite(quantity) && quantity > 0) {
    setProperty(itemData, ITEM_QUANTITY_PATH, Math.floor(quantity));
  }

  return itemData;
}

function normalizeRegistry(registry) {
  const entries = {};
  const rawEntries = Array.isArray(registry?.entries)
    ? registry.entries
    : Object.values(registry?.entries ?? {});

  for (const entry of rawEntries) {
    const normalized = normalizeEntry(entry);
    if (normalized) entries[normalized.key] = normalized;
  }

  return {
    version: 1,
    entries
  };
}

export function normalizeEntry(entry) {
  const key = String(entry?.key || entry?.uuid || entry?.fallbackKey || "").trim();
  if (!key) return null;

  const price = entry.price === "" || entry.price === null || entry.price === undefined
    ? null
    : Number(entry.price);
  const quantity = Number(entry.quantity);

  return {
    key,
    uuid: String(entry.uuid || "").trim(),
    fallbackKey: String(entry.fallbackKey || "").trim(),
    name: String(entry.name || "Unnamed Item").trim(),
    type: String(entry.type || "").trim(),
    img: String(entry.img || "").trim(),
    price: Number.isFinite(price) && price >= 0 ? price : null,
    quantity: Number.isFinite(quantity) && quantity > 0 ? Math.floor(quantity) : 1
  };
}

function makeFallbackKey(itemData) {
  const name = normalizeItemName(itemData?.name);
  const type = String(itemData?.type ?? "").trim().toLowerCase();
  return name ? `name:${name}|type:${type}` : "";
}

function firstUnique(values) {
  return [...new Set(values.map((value) => String(value).trim()).filter(Boolean))][0] ?? "";
}

function normalizeItemName(name) {
  return String(name ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function getProperty(object, path) {
  return foundry.utils.getProperty(object, path);
}

function setProperty(object, path, value) {
  return foundry.utils.setProperty(object, path, value);
}
