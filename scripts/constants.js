export const MODULE_ID = "daggerheart-item-piles";
export const PRICE_OVERRIDES_SETTING = "priceOverrides";
export const PRICE_REGISTRY_SETTING = "priceRegistry";
export const PRICE_FLAG_PATH = `flags.${MODULE_ID}.price`;
export const SOURCE_UUID_FLAG_PATH = `flags.${MODULE_ID}.sourceUuid`;

export const ITEM_QUANTITY_PATH = "system.quantity";
export const STACKING_SIMILARITIES = ["name", "type"];
export const UNSTACKABLE_TYPES = ["armor", "weapon"];
export const ITEM_FILTERS = [];

export const SUPPORTED_ITEM_TYPES = new Set(["armor", "weapon", "consumable", "loot"]);

export const COIN_CURRENCIES = [
  {
    type: "item",
    name: "Coin",
    abbreviation: "{#} Coin",
    img: "icons/commodities/currency/coin-embossed-crown-gold.webp",
    primary: true,
    exchangeRate: 1,
    data: {
      item: {
        name: "Coin",
        type: "loot",
        img: "icons/commodities/currency/coin-embossed-crown-gold.webp",
        system: {
          description: "<p>A standard coin.</p>",
          quantity: 1
        }
      }
    }
  }
];
