import { storyKit } from "#storyKit.ts";
import { bakery } from "./bakery.ts";
import { mill } from "./mill.ts";
import { orders } from "./orders.ts";
import { stock } from "./stock.ts";

export const market = storyKit({ extends: [stock, orders], name: "market" });
export const extendedMarket = storyKit({ extends: [market], name: "extended market" });
export const village = storyKit({ extends: [mill, bakery], name: "village" });
