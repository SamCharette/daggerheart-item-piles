export const MODULE_ID = "daggerheart-item-piles";
export const PRICE_OVERRIDES_SETTING = "priceOverrides";
export const PRICE_FLAG_PATH = `flags.${MODULE_ID}.price`;
export const PRICE_SOURCE_FLAG_PATH = `flags.${MODULE_ID}.priceSource`;
export const PRICE_SOURCE = "daggerheart-item-piles-price-data";

export const ITEM_QUANTITY_PATH = "system.quantity";
export const STACKING_SIMILARITIES = ["name", "type"];
export const UNSTACKABLE_TYPES = ["armor", "weapon"];
export const BLOCKED_ITEM_TYPES = [
  "ancestry",
  "beastform",
  "class",
  "community",
  "domainCard",
  "feature",
  "subclass"
];
export const ITEM_FILTERS = [
  {
    path: "type",
    filters: BLOCKED_ITEM_TYPES.join(",")
  }
];

export const SUPPORTED_ITEM_TYPES = new Set(["armor", "weapon", "consumable", "loot"]);

export const COIN_CURRENCIES = [
  {
    type: "item",
    name: "Gold Coin",
    abbreviation: "{#} gp",
    img: "icons/commodities/currency/coin-embossed-crown-gold.webp",
    primary: true,
    exchangeRate: 1,
    data: {
      item: {
        name: "Gold Coin",
        type: "loot",
        img: "icons/commodities/currency/coin-embossed-crown-gold.webp",
        system: {
          description: "<p>A standard gold coin.</p>",
          quantity: 1
        }
      }
    }
  },
  {
    type: "item",
    name: "Silver Coin",
    abbreviation: "{#} sp",
    img: "icons/commodities/currency/coin-engraved-moon-silver.webp",
    primary: false,
    exchangeRate: 0.1,
    data: {
      item: {
        name: "Silver Coin",
        type: "loot",
        img: "icons/commodities/currency/coin-engraved-moon-silver.webp",
        system: {
          description: "<p>A standard silver coin.</p>",
          quantity: 1
        }
      }
    }
  },
  {
    type: "item",
    name: "Copper Coin",
    abbreviation: "{#} cp",
    img: "icons/commodities/currency/coin-engraved-mountain-copper.webp",
    primary: false,
    exchangeRate: 0.01,
    data: {
      item: {
        name: "Copper Coin",
        type: "loot",
        img: "icons/commodities/currency/coin-engraved-mountain-copper.webp",
        system: {
          description: "<p>A standard copper coin.</p>",
          quantity: 1
        }
      }
    }
  },
  {
    type: "item",
    name: "Platinum Coin",
    abbreviation: "{#} pp",
    img: "icons/commodities/currency/coin-engraved-star-platinum.webp",
    primary: false,
    exchangeRate: 10,
    data: {
      item: {
        name: "Platinum Coin",
        type: "loot",
        img: "icons/commodities/currency/coin-engraved-star-platinum.webp",
        system: {
          description: "<p>A standard platinum coin.</p>",
          quantity: 1
        }
      }
    }
  }
];
