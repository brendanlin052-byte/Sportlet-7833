import { randomInt } from "node:crypto";
import { rarities } from "../shared/catalog";

// Integer tenths of a percent keep 0.3% exactly three outcomes out of 1,000.
export function drawRarityIndex(roll = randomInt(1000)) {
  if (!Number.isInteger(roll) || roll < 0 || roll >= 1000) throw new RangeError("Invalid rarity roll.");
  let cumulative = 0;
  const index = rarities.findIndex((rarity) => {
    cumulative += Math.round(rarity.chance * 10);
    return roll < cumulative;
  });
  if (index < 0) throw new Error("Pack odds must total 100%.");
  return index;
}