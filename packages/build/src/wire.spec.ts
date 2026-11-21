import { DateTime, Effect, Option } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { browserContractOf, rejectionSourceOf, rejectionTagsOf, successOf } from "#test/generatedText.ts";
import { generatedOnce, generator, notesProject, refusingProject } from "#test/generator.ts";

const NOTES = "src/generated/modules/notes/notes.ts";

generator.it(
	"a rejection is the class run raises: remove's NoteMissing comes from archive.ts and get's same-shaped NoteMissing from model.ts",
	[notesProject(), generatedOnce()],
	function* ({ generatedFile }) {
		const text = yield* generatedFile(NOTES);
		yield* outcomes([
			["remove's NoteMissing", () => Effect.succeed(rejectionSourceOf(text, "remove", "NoteMissing")), "#modules/notes/archive.ts"],
			["get's NoteMissing", () => Effect.succeed(rejectionSourceOf(text, "get", "NoteMissing")), "#modules/notes/model.ts"],
		]);
	},
);

generator.it(
	"create's NoteCard instance travels as the NoteCard Schema class, and summary's interface of the same shape as a struct",
	[notesProject(), generatedOnce()],
	function* ({ generatedFile }) {
		const text = yield* generatedFile(NOTES);
		yield* outcomes([
			["create's success", () => Effect.succeed(successOf(text, "create")), "NoteCard"],
			["summary's success", () => Effect.succeed(successOf(text, "summary")), "Schema.Struct({ id: Schema.Number, title: Schema.String })"],
		]);
	},
);

generator.it(
	"each operation lists the tagged classes its run and policy raise, without infrastructure failures or the automatic two",
	[notesProject(), generatedOnce()],
	function* ({ generatedFile }) {
		const text = yield* generatedFile(NOTES);
		yield* outcomes([
			["create", () => Effect.succeed(rejectionTagsOf(text, "create")), ["TitleTaken"]],
			["get", () => Effect.succeed(rejectionTagsOf(text, "get")), ["NoteMissing"]],
			["list", () => Effect.succeed(rejectionTagsOf(text, "list")), ["Unauthorized"]],
			["stats", () => Effect.succeed(rejectionTagsOf(text, "stats")), []],
		]);
	},
);

generator.it(
	"rename lets the store's stale versioned write reach the framework, so its wire lists the shared Conflict from @shivaedev/errors",
	[notesProject(), generatedOnce()],
	function* ({ generatedFile }) {
		const text = yield* generatedFile(NOTES);
		yield* outcomes([
			["rename's rejections", () => Effect.succeed(rejectionTagsOf(text, "rename")), ["Conflict"]],
			["rename's Conflict", () => Effect.succeed(rejectionSourceOf(text, "rename", "Conflict")), "@shivaedev/errors/taxonomy.ts"],
		]);
	},
);

const STATS = [
	"Schema.Struct({ count: Schema.Number, bytes: Schema.BigInt",
	"words: Schema.Record(Schema.String, Schema.mutableKey(Schema.Number)), frozenWords: Schema.Record(Schema.String, Schema.Number)",
	'status: Schema.Literals(["draft", "published"]), level: Schema.Literals([1, 2, 3]), checkedAt: Schema.DateTimeUtc, latest: Schema.NullOr(Schema.String)',
	"range: Schema.Tuple([Schema.Number, Schema.Number]), pair: Schema.mutable(Schema.Tuple([Schema.String, Schema.Number])), ids: Schema.mutable(Schema.Array(Schema.Number))",
	'events: Schema.Array(Schema.Union([Schema.Struct({ kind: Schema.Literal("created"), id: Schema.Number }), Schema.Struct({ kind: Schema.Literal("deleted"), id: Schema.Number, at: Schema.Date })]))',
	"nothing: Schema.Null, unset: Schema.Undefined, busy: Schema.Boolean, confirmed: Schema.Literal(true), archived: Schema.Literal(false)",
	"check: Schema.Union([Schema.Struct({ ok: Schema.Literal(false), reason: Schema.String }), Schema.Struct({ ok: Schema.Literal(true), count: Schema.Number })])",
	'flag: Schema.optionalKey(Schema.Boolean), review: Schema.optionalKey(Schema.Literals(["closed", "open"]))',
	"reviewedAt: Schema.optionalKey(Schema.NullOr(Schema.Date)) })",
].join(", ");

generator.it(
	"stats travels as the schema of exactly its declared type: readonly and mutable records, tuples and arrays as written, literal unions, true and false, unions discriminated by a string and by a boolean, and optional properties",
	[notesProject(), generatedOnce()],
	function* ({ generatedFile }) {
		expect(successOf(yield* generatedFile(NOTES), "stats")).toBe(STATS);
	},
);

generator.it(
	"the browser's contract names the notes module's queries and commands and carries their payloads, but none of their reads or invalidates",
	[notesProject(), generatedOnce()],
	function* ({ generatedFile }) {
		expect(browserContractOf(yield* generatedFile(NOTES))).toEqual([
			"export const Notes = clientContract({",
			'\tcommands: ["create", "pin", "remove", "rename"],',
			"\tmiddleware: NotesCaller,",
			'\tname: "notes",',
			"\tpayloads: {",
			"\t\tcreate: NoteFields,",
			"\t\tget: { id: Schema.Number },",
			"\t\tpin: { id: Schema.Number },",
			"\t\tremove: { id: Schema.Number },",
			"\t\trename: { id: Schema.Number, title: Schema.String, version: Schema.Number },",
			"\t\tsummary: { id: Schema.Number },",
			"\t},",
			'\tqueries: ["get", "list", "recent", "stats", "summary"],',
			"\twire: notesWire,",
			"});",
		]);
	},
);

generator.it(
	"generate writes the notes module's file under src/generated, headed as generated from its module, without refusing pin's key declared in pin's own file, and tsc compiles the project with it",
	[notesProject()],
	function* ({ compiles, generatedFile, generates }) {
		expect(yield* generatedFile(NOTES)).toBe("missing");

		const outcome = yield* generates();

		yield* outcomes([
			["generate", () => Effect.succeed(outcome), { files: { [NOTES]: "written" }, problems: [], result: "succeeded" }],
			[
				"first line",
				() => Effect.map(generatedFile(NOTES), (text) => text.split("\n")[0]),
				"// Generated by @shivaedev/build from src/modules/notes/notes.ts. Do not edit or commit this file; run `pnpm generate` to write it again.",
			],
			["type check", () => compiles(), "compiles cleanly"],
		]);
	},
);

const MILLISECONDS = Date.UTC(2026, 10, 10, 9, 30, 15, 123);

const BARE_STATS = {
	archived: false,
	busy: true,
	bytes: 9_007_199_254_740_993n,
	check: { ok: false, reason: "ü\u0000\n" },
	checkedAt: DateTime.makeUnsafe(MILLISECONDS),
	confirmed: true,
	count: Number.NaN,
	events: [
		{ id: 1, kind: "created" },
		{ at: new Date(MILLISECONDS), id: 2, kind: "deleted" },
	],
	frozenWords: {},
	ids: [],
	latest: null,
	level: 3,
	nothing: null,
	pair: ["", 1],
	range: [Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY],
	status: "draft",
	unset: undefined,
	words: { "": 1, "a b": Number.POSITIVE_INFINITY },
};

const FULL_STATS = {
	...BARE_STATS,
	bytes: -18_446_744_073_709_551_616n,
	check: { count: Number.MAX_SAFE_INTEGER, ok: true },
	count: 0.1,
	events: [],
	flag: false,
	ids: [2, 1, 2],
	latest: "Plan",
	review: "open",
	reviewedAt: new Date(MILLISECONDS),
	status: "published",
	words: {},
};

const LISTED = { createdAt: new Date(MILLISECONDS), id: 1, pinned: true, tags: ["b", "a", "b"], title: "Plan" };

generator.it(
	"each value run returns arrives through the generated wire equal to what run returned and of the same class, except a count of -0, which arrives as 0 because JSON has no -0, and an event at an invalid Date, which cannot be encoded",
	[notesProject(), generatedOnce()],
	function* ({ noteCard, receives }) {
		const card = yield* noteCard(1, "Plan");
		const sent = [
			["stats without its optional keys", "stats", BARE_STATS],
			["stats with every optional key", "stats", FULL_STATS],
			["an empty list", "list", []],
			["a list of notes without and with a summary", "list", [LISTED, { ...LISTED, summary: "" }]],
			["no note from get", "get", Option.none()],
			["the summary struct", "summary", { id: 1, title: "Plan" }],
			["nothing from remove", "remove", undefined],
			["a NoteCard from create", "create", card],
			["a NoteCard inside get's Option", "get", Option.some(card)],
		] as const;
		const received: Record<string, unknown> = {};
		for (const [label, operation, value] of sent) {
			received[label] = yield* receives(operation, value);
		}
		received["a count of -0"] = yield* receives("stats", { ...BARE_STATS, count: -0 });
		received["an event at an invalid Date"] = yield* receives("stats", {
			...BARE_STATS,
			events: [{ at: new Date(Number.NaN), id: 2, kind: "deleted" }],
		});

		expect(received).toStrictEqual({
			...Object.fromEntries(sent.map(([label, , value]) => [label, value])),
			"a count of -0": { ...BARE_STATS, count: 0 },
			"an event at an invalid Date": "cannot be encoded",
		});
	},
);

const REFUSED = "src/generated/modules/refused/refused.ts";
const OPERATIONS = "src/modules/refused/operations.ts";

const REFUSALS = {
	failsDataTagged:
		'refused.failsDataTagged: run fails with Busy (Busy), which is not a Schema class, so the browser cannot decode it; declare it as a Schema tagged error, such as class Busy extends Schema.TaggedError<Busy>()("Busy", { ... })',
	failsUnexported:
		"refused.failsUnexported: run fails with Hidden (Hidden), which is not an exported class; export its class so the browser can decode it",
	failsUntagged: "refused.failsUntagged: run fails with string, which has no _tag; fail with an exported tagged error class instead",
	localPayload: `refused.localPayload payload uses Draft, which is declared in ${OPERATIONS}; move it to a module the operation imports it from, such as the module's model file`,
	relativePayload: `refused.relativePayload payload imports RefusedDraft by the relative path "./payloads.ts" in ${OPERATIONS}; import it through a package import, such as a # specifier, so the generated file can import it too`,
	returnsAliasedLiteralBrandRecord:
		"refused.returnsAliasedLiteralBrandRecord: run returns LetterRecord at success, which has no exact wire form; return a record keyed by string or a string brand, or an array of entries, since a mapped type whose keys come through a type parameter and that ends with no properties may have dropped branded literal keys, and write {} for an object meant to be empty",
	returnsAny: "refused.returnsAny: run returns any at success, which has no exact wire form; decode the value with a schema, or give it a type",
	returnsBrand:
		'refused.returnsBrand: run returns NoteId at success, which has no exact wire form; export one schema for the brand NoteId, built with Schema.brand("NoteId"), from a module the operation imports',
	returnsEnum:
		"refused.returnsEnum: run returns Level at success.level, which has no exact wire form; return string or number literals instead of an enum",
	returnsGenericMappedLiteralBrandKeys:
		"refused.returnsGenericMappedLiteralBrandKeys: run returns Counts<Letter> at success, which has no exact wire form; return a record keyed by string or a string brand, or an array of entries, since a mapped type whose keys come through a type parameter and that ends with no properties may have dropped branded literal keys, and write {} for an object meant to be empty",
	returnsGenericMappedNever:
		"refused.returnsGenericMappedNever: run returns Counts<never> at success, which has no exact wire form; return a record keyed by string or a string brand, or an array of entries, since a mapped type whose keys come through a type parameter and that ends with no properties may have dropped branded literal keys, and write {} for an object meant to be empty",
	returnsHandBranded:
		"refused.returnsHandBranded: run returns UserId at success, which has no exact wire form; return the unbranded type, or build the brand with Schema.brand and export its schema from a module the operation imports",
	returnsLiteralBrandKeys:
		"refused.returnsLiteralBrandKeys: run returns Record<Letter, number> at success, which has no exact wire form; key the record by string or a string brand, or return an array of entries, since TypeScript keeps no property for a branded literal key and the wire would drop it",
	returnsLooseOptional:
		"refused.returnsLooseOptional: run returns string | undefined at success.summary, which has no exact wire form; drop undefined from the optional property summary, so an absent key is the only way to leave it out",
	returnsMap:
		"refused.returnsMap: run returns Map<string, number> at success, which has no exact wire form; return a plain object, an array or a string-keyed record",
	returnsMappedLiteralBrandKeys:
		"refused.returnsMappedLiteralBrandKeys: run returns {} at success, which has no exact wire form; key the record by string or a string brand, or return an array of entries, since TypeScript keeps no property for a branded literal key and the wire would drop it",
	returnsMemberMappedLiteralBrandKeys:
		"refused.returnsMemberMappedLiteralBrandKeys: run returns {} at success, which has no exact wire form; return a record keyed by string or a string brand, or an array of entries, since a mapped type whose keys come through a type parameter and that ends with no properties may have dropped branded literal keys, and write {} for an object meant to be empty",
	returnsNullOrUndefined:
		"refused.returnsNullOrUndefined: run returns null | undefined at success, which has no exact wire form; return either null or undefined, since the wire carries both as one",
	returnsNumberBrandKeys:
		"refused.returnsNumberBrandKeys: run returns Record<NoteId, string> at success, which has no exact wire form; key the record by string or a string brand, or return an array of entries, since JSON keys are strings and the wire cannot check them against a brand that is not a string",
	returnsNumberKeys:
		"refused.returnsNumberKeys: run returns Record<number, string> at success, which has no exact wire form; use string keys, or keys of a branded string",
	returnsPartialMappedLiteralBrandKeys:
		"refused.returnsPartialMappedLiteralBrandKeys: run returns Partial<{}> at success, which has no exact wire form; key the record by string or a string brand, or return an array of entries, since TypeScript keeps no property for a branded literal key and the wire would drop it",
	returnsPartialRecord:
		'refused.returnsPartialRecord: run returns Partial<Record<string & Brand<"Shelf">, number>> at success, which has no exact wire form; drop Partial and undefined from the record\'s values, so an absent key is the only way to leave a value out',
	returnsPlainClass:
		"refused.returnsPlainClass: run returns Counter at success, which has no exact wire form; return a plain object, or make the class a Schema class",
	returnsReadonlyLiteralBrandKeys:
		'refused.returnsReadonlyLiteralBrandKeys: run returns Readonly<Record<"c" | Letter, number>> at success, which has no exact wire form; key the record by string or a string brand, or return an array of entries, since TypeScript keeps no property for a branded literal key and the wire would drop it',
	returnsRecursive:
		"refused.returnsRecursive: run returns Tree at success.children[number], which has no exact wire form; return a type that does not contain itself",
	returnsStringOrBigint:
		"refused.returnsStringOrBigint: run returns string | bigint at success, which has no exact wire form; return string or number, alone or with boolean, since a NaN or infinite number and a bigint travel as strings and a union with string cannot tell them apart",
	returnsStringOrNumber:
		"refused.returnsStringOrNumber: run returns string | number at success, which has no exact wire form; return string or number, alone or with boolean, since a NaN or infinite number and a bigint travel as strings and a union with string cannot tell them apart",
	returnsTupleRest:
		"refused.returnsTupleRest: run returns readonly [string, ...number[]] at success, which has no exact wire form; use an array, or a tuple of required elements",
	returnsTwiceBranded: `refused.returnsTwiceBranded: run returns string & Brand<"Sku"> at success, which has no exact wire form; export one schema for the brand Sku, not 2: SkuCode in src/modules/refused/payloads.ts and Sku in src/modules/refused/shared.ts`,
	returnsUndefinedProperty:
		"refused.returnsUndefinedProperty: run returns string | undefined at success.summary, which has no exact wire form; return null instead of undefined, or make the property optional",
	returnsUnexportedClass:
		"refused.returnsUnexportedClass: run returns Secret at success, which has no exact wire form; export the Schema class Secret from its module",
	returnsUnknown:
		"refused.returnsUnknown: run returns unknown at success, which has no exact wire form; decode the value with a schema, or give it a type",
} as const;

const MODULE_REFUSALS = {
	"a module not exported": "hidden: export the module as a const, such as export const Hidden = defineModule(...)",
	"a module outside src":
		"lib/outside.ts: defines a module outside src; move it under src, since its generated file goes to src/generated/<its path under src>",
	"two modules in one file": "src/modules/refused/twice.ts: defines 2 modules; define exactly one module per file",
} as const;

generator.it(
	"generate refuses each operation the wire cannot carry exactly with a message naming it, the type and what to write instead, refuses misplaced, hidden or doubled modules, and writes no file for a refused module",
	[refusingProject()],
	function* ({ generatedFile, generates }) {
		const outcome = yield* generates();

		yield* outcomes([
			["generate", () => Effect.succeed(outcome), { files: { [REFUSED]: "refused" }, result: "failed" }],
			...Object.entries(REFUSALS).map(
				([operation, message]) =>
					[
						operation,
						() => Effect.succeed(outcome.problems.find((problem) => problem.startsWith(`refused.${operation}`)) ?? "no message"),
						message,
					] as const,
			),
			...Object.entries(MODULE_REFUSALS).map(([label, message]) => [label, () => Effect.succeed(outcome.problems.includes(message)), true] as const),
			["messages", () => Effect.succeed(outcome.problems.length), Object.keys(REFUSALS).length + Object.keys(MODULE_REFUSALS).length],
			["generated file", () => generatedFile(REFUSED), "missing"],
		]);
	},
);
