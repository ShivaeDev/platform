// An application's catalog module, whose ids are branded, one of them imported through a renaming re-export, and whose items
// carry authored JSON: each operation returns a form the wire carries through a schema the module exports or one of Effect's.
export const CATALOG_PROJECT: Readonly<Record<string, string>> = {
	"src/modules/catalog/catalog.ts": `import { defineModule } from "@shivaedev/contract/defineModule.ts";
import { catalogWire } from "#generated/modules/catalog/catalog.ts";
import { Answer, Blank, Code, Document, Empties, History, Item, Prices, Settings } from "#modules/catalog/operations.ts";

export const Catalog = defineModule({
	name: "catalog",
	operations: [Item, Code, Prices, Document, Settings, History, Answer, Blank, Empties],
	wire: catalogWire,
});
`,
	"src/modules/catalog/ids.ts": `export { ItemId as Id } from "#modules/catalog/model.ts";
`,
	"src/modules/catalog/model.ts": `import { Schema } from "effect";

export const ItemId = Schema.Number.pipe(Schema.brand("ItemId"));
export type ItemId = typeof ItemId.Type;

export const ItemCode = Schema.TemplateLiteral(["item-", Schema.String]).pipe(Schema.brand("ItemCode"));
export type ItemCode = typeof ItemCode.Type;
`,
	"src/modules/catalog/operations.ts": `import { Effect, type Schema } from "effect";
import { query } from "@shivaedev/contract/operation.ts";
import type { Id } from "#modules/catalog/ids.ts";
import type { ItemCode } from "#modules/catalog/model.ts";

interface Unmarked {}

interface Empty {
	readonly object: {};
	readonly unmarked: Unmarked;
	readonly partial: Partial<Unmarked>;
	readonly keyless: { [K in never]: number };
}

interface Answered {
	readonly answer: string | boolean;
	readonly score: number | true;
	readonly note?: Schema.Json;
}

export const Item = query("item", {
	*run() {
		const id = yield* Effect.succeed(1 as Id);
		return id;
	},
});

export const Code = query("code", {
	*run() {
		const code = yield* Effect.succeed("item-a" as ItemCode);
		return code;
	},
});

export const Prices = query("prices", {
	*run() {
		const prices: Record<ItemCode, number> = yield* Effect.succeed({});
		return prices;
	},
});

export const Document = query("document", {
	*run() {
		const document = yield* Effect.succeed<Schema.Json>(null);
		return document;
	},
});

export const Settings = query("settings", {
	*run() {
		const settings = yield* Effect.succeed<Schema.JsonObject>({});
		return settings;
	},
});

export const History = query("history", {
	*run() {
		const history = yield* Effect.succeed<Schema.JsonArray>([]);
		return history;
	},
});

export const Blank = query("blank", {
	*run() {
		const blank: Record<never, number> = yield* Effect.succeed({});
		return blank;
	},
});

export const Empties = query("empties", {
	*run() {
		const empties = yield* Effect.succeed<Empty>({ keyless: {}, object: {}, partial: {}, unmarked: {} });
		return empties;
	},
});

export const Answer = query("answer", {
	*run() {
		const answered = yield* Effect.succeed<Answered>({ answer: true, score: true });
		return answered;
	},
});
`,
};
