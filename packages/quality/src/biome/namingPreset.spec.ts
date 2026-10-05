import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { biomeReport, type Diagnostic } from "#biome/report.ts";
import { linkPackage, removeSeededTrees, type SeedFile, seedTree } from "#test/tree.ts";

type Line = readonly [code: string, ...findings: string[]];

const NAMING_RULES: Readonly<Record<string, string>> = {
	"lint/nursery/useReactNamingConvention": "useReactNamingConvention",
	"lint/performance/noBarrelFile": "noBarrelFile",
	"lint/performance/noReExportAll": "noReExportAll",
	"lint/style/noExportedImports": "noExportedImports",
	"lint/style/useComponentExportOnlyModules": "useComponentExportOnlyModules",
	"lint/style/useConsistentMemberAccessibility": "useConsistentMemberAccessibility",
	"lint/style/useNamingConvention": "useNamingConvention",
};

const PLUGINS: ReadonlyArray<readonly [prefix: string, plugin: string]> = [
	["A module-level constant", "constant-names"],
	["A top-level function whose whole body is Effect.gen", "effect-fn-functions"],
	["A test body that is only Effect.gen", "effect-test-bodies"],
	["Effect.fn takes a literal span name", "effect-fn-spans"],
	["The operation in an Effect.fn span", "effect-fn-spans"],
	["A function passed to an onX prop", "handler-names"],
	["An object key or type property", "key-names"],
	["A schema is PascalCase", "schema-names"],
	["A Schema.Struct field", "schema-struct-keys"],
	["A service's Layer", "service-layers"],
	["A module never re-exports", "type-re-exports"],
];

const IMPORTS: Line = ['import { Effect, Layer, Schema } from "effect";'];

const fixtures: Readonly<Record<string, readonly Line[]>> = {
	"src/components.tsx": [
		['import { createContext, useState } from "react";'],
		['const Theme = createContext<string>("light");', "useReactNamingConvention"],
		["export function Panel({ onClose }: { readonly onClose: () => void }) {"],
		["\tconst close = () => onClose();"],
		["\tconst handleOpen = () => onClose();"],
		['\tconst [label, setLabel] = useState("");'],
		['\tconst settle = () => setLabel("");'],
		["\treturn ("],
		['\t\t<Theme.Provider value="dark">'],
		['\t\t\t<button onClick={close} type="button" />', "handler-names"],
		['\t\t\t<button onClick={handleOpen} type="button" />'],
		['\t\t\t<button onClick={onClose} type="button" />'],
		["\t\t\t<input onChange={setLabel} value={label} />"],
		["\t\t\t<input onChange={settle} value={label} />", "handler-names"],
		["\t\t</Theme.Provider>"],
		["\t);"],
		["}"],
		["export const panelWidth = 3;", "constant-names", "useComponentExportOnlyModules"],
	],
	"src/effects.test.ts": [
		['import { it } from "@effect/vitest";'],
		['import { Effect } from "effect";'],
		['it.effect("reads the item", () =>', "effect-test-bodies"],
		["\tEffect.gen(function* () {"],
		["\t\treturn yield* Effect.succeed(1);"],
		["\t}),"],
		[");"],
		['it.effect.each([1, 2])("reads item %s", (id) =>', "effect-test-bodies"],
		["\tEffect.gen(function* () {"],
		["\t\treturn yield* Effect.succeed(id);"],
		["\t}),"],
		[");"],
		['it.effect.skipIf(false)("writes the item", () => {', "effect-test-bodies"],
		["\treturn Effect.gen(function* () {"],
		["\t\treturn yield* Effect.succeed(1);"],
		["\t});"],
		["});"],
		['it.effect("settles the item", () =>'],
		["\tEffect.gen(function* () {"],
		["\t\treturn yield* Effect.succeed(1);"],
		["\t}).pipe(Effect.orDie),"],
		[");"],
		['it.effect("lists the items", () => Effect.succeed([]));'],
		["const seeded = () =>", "effect-fn-functions"],
		["\tEffect.gen(function* () {"],
		["\t\treturn yield* Effect.succeed(1);"],
		["\t});"],
		['it.effect("seeds the items", seeded);'],
	],
	"src/effects.ts": [
		IMPORTS,
		["export const loadItem = (id: string) =>", "effect-fn-functions"],
		["\tEffect.gen(function* () {"],
		["\t\treturn yield* Effect.succeed(id);"],
		["\t});"],
		["export function saveItem(id: string) {", "effect-fn-functions"],
		["\treturn Effect.gen(function* () {"],
		["\t\treturn yield* Effect.succeed(id);"],
		["\t});"],
		["}"],
		["const countItems = (): Effect.Effect<number> => {", "effect-fn-functions"],
		["\treturn Effect.gen(function* () {"],
		["\t\treturn yield* Effect.succeed(1);"],
		["\t});"],
		["};"],
		['export const readItem = Effect.fn("ItemStore.readItem")(function* (id: string) {'],
		["\treturn yield* Effect.succeed(id);"],
		["});"],
		["export const pingItem = Effect.fnUntraced(function* () {"],
		["\treturn yield* countItems();"],
		["});"],
		["export const program = Effect.gen(function* () {"],
		["\treturn yield* Effect.succeed(1);"],
		["});"],
		["export const settled = () =>"],
		["\tEffect.gen(function* () {"],
		["\t\treturn yield* Effect.succeed(1);"],
		["\t}).pipe(Effect.orDie);"],
		["export function prepared(id: string) {"],
		["\tconst key = id.trim();"],
		["\treturn Effect.gen(function* () {"],
		["\t\treturn yield* Effect.succeed(key);"],
		["\t});"],
		["}"],
		["export function batch(ids: readonly string[]) {"],
		["\tconst one = (id: string) =>"],
		["\t\tEffect.gen(function* () {"],
		["\t\t\treturn yield* Effect.succeed(id);"],
		["\t\t});"],
		["\treturn Effect.forEach(ids, (id) => Effect.gen(function* () {"],
		["\t\treturn yield* one(id);"],
		["\t}));"],
		["}"],
		['it.effect("is not a test outside test code", () =>'],
		["\tEffect.gen(function* () {"],
		["\t\treturn yield* Effect.succeed(1);"],
		["\t}),"],
		[");"],
		["export const handlers = {"],
		["\tread: (id: string) =>"],
		["\t\tEffect.gen(function* () {"],
		["\t\t\treturn yield* Effect.succeed(id);"],
		["\t\t}),"],
		["};"],
	],
	"src/harness.test.tsx": [
		['import { it } from "vitest";'],
		["function Harness() {"],
		["\treturn <div />;"],
		["}"],
		["const Wrapper = () => <Harness />;"],
		['it("renders the harness", () => Wrapper);'],
	],
	"src/identifiers.ts": [
		IMPORTS,
		["export const maxItems = 50;", "constant-names"],
		['const defaultLabel = "item";', "constant-names"],
		["export const MAX_ITEMS = 50;"],
		["export function count() {"],
		["\tconst LOCAL_LIMIT = 3;", "useNamingConvention"],
		["\tconst localLimit = 3;"],
		["\treturn LOCAL_LIMIT + localLimit + defaultLabel.length;"],
		["}"],
		["export function first<Item>(items: readonly Item[]) {", "useNamingConvention"],
		["\treturn items[0];"],
		["}"],
		["export function pair<T, TRight>(left: T, right: TRight) {"],
		["\treturn [left, right];"],
		["}"],
		["export function run<A, E, R>(effect: Effect.Effect<A, E, R>) {"],
		["\treturn effect;"],
		["}"],
		["export function fetchFrom<TURL>(url: TURL) {", "useNamingConvention"],
		["\treturn url;"],
		["}"],
		["export interface IClient {", "useNamingConvention"],
		["\treadonly base_url: string;", "key-names"],
		["}"],
		["export interface HttpClient {"],
		['\treadonly _tag: "HttpClient";'],
		["\treadonly baseUrl: string;"],
		["}"],
		["export function parseURL(text: string) {", "useNamingConvention"],
		["\treturn text;"],
		["}"],
		["export const headers = { content_type: 1, MAX_AGE: 2, userId: 3, Service: 4, _tag: 5, $raw: 6 };", "key-names", "key-names"],
		["export const env: Record<string, number> = { DATABASE_URL: 1 };", "key-names"],
		['export const query = { "per_page": 50, "DATABASE_URL": "x", "OR": [] };'],
		["export interface Payload {"],
		['\treadonly "created_at": string;'],
		["}"],
		["export class Counter {"],
		["\tprivate count = 0;", "useConsistentMemberAccessibility"],
		["\t#total = 0;"],
		["\tincrement() {"],
		["\t\tthis.count += 1;"],
		["\t\tthis.#total += 1;"],
		["\t\treturn this.count + this.#total;"],
		["\t}"],
		["}"],
	],
	"src/legacy.js": [["export const headers = { content_type: 1, contentType: 2 };", "key-names"], ['export const query = { "per_page": 50 };']],
	"src/re-exports.ts": [
		['import { Effect } from "effect";', "noExportedImports"],
		['export type { Duration } from "effect";', "type-re-exports"],
		['export { Schema } from "effect";', "noBarrelFile"],
		['export * from "effect";', "noReExportAll"],
		["export { Effect };"],
	],
	"src/schemas.ts": [
		IMPORTS,
		["export const Item = Schema.Struct({ id: Schema.String, createdAt: Schema.String });"],
		["export const order = Schema.Struct({ id: Schema.String });", "schema-names"],
		["export const Row = Schema.Struct({ created_at: Schema.String });", "key-names", "schema-struct-keys"],
		['export const QuotedRow = Schema.Struct({ "created_at": Schema.String });', "schema-struct-keys"],
		["export const decodeItem = Schema.decodeUnknownSync(Item);"],
		["export const ItemStoreLive = Layer.empty.pipe(Layer.provide(Layer.empty));", "service-layers"],
		["export const layer = Layer.mergeAll(Layer.empty);"],
		["const AppLive = Layer.mergeAll(layer);"],
		['export const loadItem = Effect.fn("ItemStore.loadItem")(function* () {'],
		["\treturn yield* Effect.succeed(AppLive);"],
		["});"],
		['export const saveItem = Effect.fn("ItemStore.save")(function* () {', "effect-fn-spans"],
		["\treturn yield* Effect.void;"],
		["});"],
		["export const store = {"],
		['\tget: Effect.fn("ItemStore.get")(function* () {'],
		["\t\treturn yield* Effect.void;"],
		["\t}),"],
		['\tput: Effect.fn("ItemStore.write")(function* () {', "effect-fn-spans"],
		["\t\treturn yield* Effect.void;"],
		["\t}),"],
		["};"],
		['export const untraced = Effect.fn("untraced")(function* () {', "effect-fn-spans"],
		["\treturn yield* Effect.void;"],
		["});"],
	],
	"src/test-support/items.ts": [
		['import { it } from "@effect/vitest";'],
		['import { Effect } from "effect";'],
		["export function registerItemTests() {"],
		['\tit.live("reads the live item", () =>', "effect-test-bodies"],
		["\t\tEffect.gen(function* () {"],
		["\t\t\treturn yield* Effect.succeed(1);"],
		["\t\t}),"],
		["\t);"],
		["}"],
	],
};

function nameOf(diagnostic: Diagnostic): string | undefined {
	if (diagnostic.category === "plugin") {
		return PLUGINS.find(([prefix]) => diagnostic.message.startsWith(prefix))?.[1];
	}
	return NAMING_RULES[diagnostic.category ?? ""];
}

function expected(lines: readonly Line[]): readonly string[] {
	return lines.flatMap(([, ...findings], index) => findings.map((finding) => `${index + 1} ${finding}`)).toSorted();
}

const PRESET: readonly SeedFile[] = [
	{ content: '{ "extends": ["@shivaedev/quality/biome"] }\n', path: "biome.json" },
	{ content: "node_modules/\n", path: ".gitignore" },
];

let found: ReadonlyMap<string, readonly string[]> = new Map();

beforeAll(async () => {
	const root = seedTree(
		PRESET,
		Object.entries(fixtures).map(([path, lines]) => ({ content: `${lines.map(([code]) => code).join("\n")}\n`, path })),
	);
	linkPackage(root);
	const report = await biomeReport(root, ["lint"]);
	const named = report.diagnostics.flatMap((diagnostic) => {
		const name = nameOf(diagnostic);
		return name === undefined ? [] : [{ file: diagnostic.location.path ?? "", finding: `${diagnostic.location.start?.line ?? 0} ${name}` }];
	});
	found = new Map(
		Object.keys(fixtures).map((path) => [
			path,
			named
				.filter((entry) => entry.file === path)
				.map((entry) => entry.finding)
				.toSorted(),
		]),
	);
}, 60_000);

afterAll(removeSeededTrees);

describe("the naming rules of the Biome preset", () => {
	it.each(Object.keys(fixtures))("report in %s exactly the lines that break a naming rule", (path) => {
		expect(found.get(path)).toEqual(expected(fixtures[path] ?? []));
	});

	it("keeps the quotes that mark a key as a name an outside API decides", async () => {
		const root = seedTree(PRESET, [{ content: 'export const query = { "per_page": 50, perPage: 50 };\n', path: "src/query.ts" }]);
		linkPackage(root);
		const report = await biomeReport(root, ["format"]);
		expect(report.diagnostics.map((diagnostic) => diagnostic.category)).toEqual([]);
	});
});
