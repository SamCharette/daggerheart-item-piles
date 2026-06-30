export const MODULE_ID = "daggerheart-item-piles";
export const PRICE_OVERRIDES_SETTING = "priceOverrides";
export const PRICE_REGISTRY_SETTING = "priceRegistry";
export const PRICE_FLAG_PATH = `flags.${MODULE_ID}.price`;
export const SOURCE_UUID_FLAG_PATH = `flags.${MODULE_ID}.sourceUuid`;

export const ITEM_QUANTITY_PATH = "system.quantity";
export const COIN_PATH = "system.gold.coins";
export const STACKING_SIMILARITIES = ["name", "type"];
export const UNSTACKABLE_TYPES = [];
export const COIN_ITEM_NAMES = new Set([
  "coin",
  "coins",
  "copper coin",
  "copper coins",
  "gold coin",
  "gold coins",
  "platinum coin",
  "platinum coins",
  "silver coin",
  "silver coins"
]);
export const ITEM_FILTERS = [
  {
    path: "name",
    filters: "Coin,Coins,Copper Coin,Copper Coins,Gold Coin,Gold Coins,Platinum Coin,Platinum Coins,Silver Coin,Silver Coins"
  }
];

export const SUPPORTED_ITEM_TYPES = new Set(["armor", "weapon", "consumable", "loot"]);

export const COIN_CURRENCIES = [
  {
    type: "attribute",
    name: "Coin",
    abbreviation: "{#} Coin",
    img: "icons/commodities/currency/coin-embossed-crown-gold.webp",
    primary: true,
    exchangeRate: 1,
    data: {
      path: COIN_PATH
    }
  }
];

export function isCoinCurrencyItem(item) {
  const itemData = typeof Item !== "undefined" && item instanceof Item ? item.toObject() : item;
  const name = String(itemData?.name ?? "").trim().toLowerCase();
  return COIN_ITEM_NAMES.has(name);
}
