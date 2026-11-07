import { storyKit } from "#server/storyKit.ts";
import { bakery } from "#test/bakery.ts";
import { mill } from "#test/mill.ts";
import { orders } from "#test/orders.ts";
import { stock } from "#test/stock.ts";

export const market = storyKit({ extends: [stock, orders], name: "market" });
export const extendedMarket = storyKit({ extends: [market], name: "extended market" });
export const village = storyKit({ extends: [mill, bakery], name: "village" });
