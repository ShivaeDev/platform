import { Effect } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { successOf } from "#test/generatedText.ts";
import { catalogProject, generatedOnce, generator } from "#test/generator.ts";

const CATALOG = "src/generated/modules/catalog/catalog.ts";

generator.it(
	"a branded id and a branded template literal travel as the schemas the catalog exports for them, a record keyed by a string brand as a record over that schema that checks every key, Effect's JSON types as its JSON schemas and string or number with boolean as a union",
	[catalogProject(), generatedOnce()],
	function* ({ generatedFile }) {
		const text = yield* generatedFile(CATALOG);
		yield* outcomes([
			["item", () => Effect.succeed(successOf(text, "item")), "ItemId"],
			["code", () => Effect.succeed(successOf(text, "code")), "ItemCode"],
			[
				"the brands' import from the file that declares them, though item's id is imported through a renaming re-export",
				() => Effect.succeed(text.split("\n").find((line) => line.includes("Item"))),
				'import { ItemCode, ItemId } from "#modules/catalog/model.ts";',
			],
			[
				"prices",
				() => Effect.succeed(successOf(text, "prices")),
				"Schema.Record(ItemCode, Schema.mutableKey(Schema.Number)).check(Schema.isPropertyNames(ItemCode))",
			],
			["document", () => Effect.succeed(successOf(text, "document")), "Schema.Json"],
			["settings", () => Effect.succeed(successOf(text, "settings")), "Schema.JsonObject"],
			["history", () => Effect.succeed(successOf(text, "history")), "Schema.Array(Schema.Json)"],
			[
				"answer",
				() => Effect.succeed(successOf(text, "answer")),
				"Schema.Struct({ answer: Schema.Union([Schema.String, Schema.Boolean]), score: Schema.Union([Schema.Number, Schema.Literal(true)]), note: Schema.optionalKey(Schema.Json) })",
			],
		]);
	},
);

generator.it(
	"generate writes the catalog module's file and tsc compiles the project with it, so each schema's Type is the type run returns",
	[catalogProject()],
	function* ({ compiles, generates }) {
		const outcome = yield* generates();

		yield* outcomes([
			["generate", () => Effect.succeed(outcome), { files: { [CATALOG]: "written" }, problems: [], result: "succeeded" }],
			["type check", () => compiles(), "compiles cleanly"],
		]);
	},
);

const DOCUMENT = { blocks: [{ level: 2, text: "ü\u0000\n" }, null, true, -1.5], empty: {}, title: "Plan" };

generator.it(
	"each catalog value arrives through the generated wire equal to what run returned, while a code outside its template, a price keyed outside it and a NaN or infinity inside JSON cannot be encoded",
	[catalogProject(), generatedOnce()],
	function* ({ receives }) {
		const sent = [
			["an item id", "item", 7],
			["an item code", "code", "item-a b"],
			["prices keyed by item code", "prices", { "item-": Number.POSITIVE_INFINITY, "item-a": 2.5 }],
			["no prices", "prices", {}],
			["a JSON document", "document", DOCUMENT],
			["a JSON string", "document", "Plan"],
			["JSON null", "document", null],
			["JSON settings", "settings", { theme: "dark", widths: [1, 2] }],
			["a JSON history", "history", [DOCUMENT, "x", 0]],
			["a string answer and a number score", "answer", { answer: "yes", score: 0.5 }],
			["a boolean answer, a true score and a note", "answer", { answer: false, note: { seen: true }, score: true }],
			["a NaN score", "answer", { answer: "", score: Number.NaN }],
		] as const;
		const received: Record<string, unknown> = {};
		for (const [label, operation, value] of sent) {
			received[label] = yield* receives(operation, value, "catalog");
		}
		received["a code outside its template"] = yield* receives("code", "other", "catalog");
		received["a price keyed outside the code's template"] = yield* receives("prices", { "item-a": 1, other: 2 }, "catalog");
		received["a NaN inside JSON"] = yield* receives("document", { count: Number.NaN }, "catalog");
		received["an infinity inside JSON"] = yield* receives("history", [Number.POSITIVE_INFINITY], "catalog");

		expect(received).toStrictEqual({
			...Object.fromEntries(sent.map(([label, , value]) => [label, value])),
			"a code outside its template": "cannot be encoded",
			"a NaN inside JSON": "cannot be encoded",
			"a price keyed outside the code's template": "cannot be encoded",
			"an infinity inside JSON": "cannot be encoded",
		});
	},
);
