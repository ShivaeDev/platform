import { expect } from "vitest";
import { noDoubleCast } from "#rules/suppressions/noDoubleCast.ts";
import { nativeCastTypes } from "#test/nativeCastTypes.ts";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";

for (const [shape, content, repair] of [
	["annotated JSON.parse", 'const value: { id: string } = JSON.parse("{}");', "Schema.decodeUnknownEffect"],
	["parenthesized JSON.parse", 'const value: string = (JSON.parse("{}"));', "Schema.decodeUnknownEffect"],
	["unannotated Reflect.get", 'const value = Reflect.get({}, "id");', "Declare the result unknown"],
	["annotated Reflect.get", 'const value: string = Reflect.get({}, "id");', "Schema.decodeUnknownEffect"],
	["SQL row generic", "const rows = sql<{ id: string }>`select id from items`;", "SqlSchema.findAll"],
	["SQL named row generic", "const rows = sql<Row>`select id from items`;", "declared row schema"],
	[
		"identity overload",
		"function hold(value: Holder): Holder;\nfunction hold(value: unknown): unknown { return value; }",
		"declared overload return type",
	],
	["unsafe Context retagging", "const services = Context.makeUnsafe<Handler>(context.mapUnsafe);", "declared Context service type"],
	["unsafe Context retagging around an expression", "const services = Context.makeUnsafe<Handler>((getContext()).mapUnsafe);", "Context.add"],
	[
		"aliased Context retagging",
		'import { Context as Services } from "effect"; const services = Services.makeUnsafe<Handler>(context.mapUnsafe);',
		"Context.add",
	],
] as const) {
	ruleStory.it(
		`suppressions/no-double-cast reports ${shape} and names its repair`,
		[repositoryHas({ content, path: "src/value.ts" })],
		function* ({ check }) {
			const findings = yield* check(noDoubleCast);

			expect(findings).toEqual([{ file: "src/value.ts", line: shape === "identity overload" ? 2 : 1, message: expect.stringContaining(repair) }]);
		},
	);
}

ruleStory.it(
	"suppressions/no-double-cast reports a renamed native SQL client and names its row decoder",
	[
		nativeCastTypes,
		repositoryHas({
			content:
				'import type { SqlClient } from "effect/sql"; declare const query: SqlClient.SqlClient; const rows = query<{ id: string }>`select id from items`;',
			path: "src/value.ts",
		}),
	],
	function* ({ check }) {
		const findings = yield* check(noDoubleCast);

		expect(findings).toEqual([{ file: "src/value.ts", line: 1, message: expect.stringContaining("SqlSchema.findAll") }]);
	},
);

for (const [shape, content] of [
	[
		"Object.assign over a readonly RPC field",
		'import type { Rpc } from "effect/rpc"; declare const rpc: Rpc.AnyWithProps; Object.assign(rpc, { middlewares: new Set() });',
	],
	[
		"Object.assign over a mapped readonly field",
		"declare const rpc: Readonly<{ middlewares: Set<string> }>; Object.assign(rpc, { middlewares: new Set() });",
	],
	["direct readonly write", "declare const rpc: { readonly middlewares: Set<string> }; rpc.middlewares = new Set();"],
	["element readonly write", 'declare const rpc: { readonly middlewares: Set<string> }; rpc["middlewares"] = new Set();'],
	["computed readonly write", 'declare const rpc: { readonly middlewares: Set<string> }; const key = "middlewares"; rpc[key] = new Set();'],
	[
		"a constructor mutating another readonly object",
		"class Wrapper { constructor(rpc: { readonly middlewares: Set<string> }) { Object.assign(rpc, { middlewares: new Set() }); } }",
	],
	["reflected readonly write", 'declare const rpc: { readonly middlewares: Set<string> }; Reflect.set(rpc, "middlewares", new Set());'],
	[
		"defined readonly write",
		'declare const rpc: { readonly middlewares: Set<string> }; Object.defineProperty(rpc, "middlewares", { value: new Set() });',
	],
	["increment of a readonly field", "declare const value: { readonly version: number }; value.version++;"],
	["deletion of a readonly field", "declare const value: { readonly version: number }; delete value.version;"],
	["Scope state assignment", 'import type { Scope } from "effect"; declare const scope: Scope.Scope; scope.state = { _tag: "Empty" };'],
	[
		"Scope state Object.assign",
		'import type { Scope } from "effect"; declare const scope: Scope.Scope; Object.assign(scope, { state: { _tag: "Empty" } });',
	],
	[
		"Object.assign with a named source",
		"declare const rpc: { readonly middlewares: Set<string> }; const update = { middlewares: new Set() }; Object.assign(rpc, update);",
	],
] as const) {
	ruleStory.it(
		`suppressions/no-double-cast reports ${shape} and names the declared type repair`,
		[nativeCastTypes, repositoryHas({ content, path: "src/value.ts" })],
		function* ({ check }) {
			const findings = yield* check(noDoubleCast);

			expect(findings).toEqual([{ file: "src/value.ts", line: 1, message: expect.stringContaining("preserve the declared readonly type") }]);
		},
	);
}

for (const [shape, content] of [
	["unknown JSON", 'const value: unknown = JSON.parse("{}");'],
	["unknown reflection", 'const value: unknown = Reflect.get({}, "id");'],
	["decoded JSON", 'const value: Item = Schema.decodeUnknownSync(Item)(JSON.parse("{}"));'],
	["decoded reflection", 'const value = Schema.decodeUnknownSync(Item)(Reflect.get({}, "id"));'],
	["untyped SQL", "const rows = sql`select id from items`;"],
	["another generic tag", "declare function html<T>(strings: TemplateStringsArray): T; const rendered = html<string>`hello`;"],
	["checked overload implementation", "function hold(value: Holder): Holder;\nfunction hold(value: Holder): Holder { return value; }"],
	["non-identity overload", "function parse(value: string): Item;\nfunction parse(value: unknown): unknown { return decode(value); }"],
	["new Context", "const context = Context.makeUnsafe<Service>(new Map());"],
	["mutable write", "const value = { version: 1 }; value.version++; Object.assign(value, { version: 2 });"],
	["declared extension", 'declare const value: { readonly id: string }; const extended = Object.assign(value, { description: "item" });'],
	["plain state", 'const scope = { state: "Open" }; scope.state = "Closed";'],
	["readonly initialization", "class Item { readonly id: string; constructor(id: string) { this.id = id; } }"],
	["readonly assign initialization", "class Item { readonly id!: string; constructor(id: string) { Object.assign(this, { id }); } }"],
	[
		"readonly descriptor initialization",
		'class Item { readonly id!: string; constructor(id: string) { Object.defineProperty(this, "id", { value: id }); } }',
	],
] as const) {
	ruleStory.it(`suppressions/no-double-cast accepts ${shape}`, [repositoryHas({ content, path: "src/value.ts" })], function* ({ check }) {
		expect(yield* check(noDoubleCast)).toEqual([]);
	});
}

for (const folder of ["adapters", "test-support"]) {
	ruleStory.it(
		`suppressions/no-double-cast leaves hidden casts in ${folder} to its boundary`,
		[
			repositoryHas({
				content:
					'const value: string = JSON.parse("{}"); const field = Reflect.get({}, "id"); const rows = sql<Row>`select id`; function hold(value: Item): Item; function hold(value: unknown): unknown { return value; } const context = Context.makeUnsafe<Service>(previous.mapUnsafe); declare const rpc: { readonly middlewares: Set<string> }; Object.assign(rpc, { middlewares: new Set() });',
				path: `src/${folder}/value.ts`,
			}),
		],
		function* ({ check }) {
			expect(yield* check(noDoubleCast)).toEqual([]);
		},
	);
}
