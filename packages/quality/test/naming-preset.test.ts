import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { biomeReport, type Diagnostic } from "../src/biome/report.ts";
import { linkPackage, removeSeededTrees, seedTree } from "./support/tree.ts";

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
	["Effect.fn takes a literal span name", "effect-fn-spans"],
	["The operation in an Effect.fn span", "effect-fn-spans"],
	["A function passed to an onX prop", "handler-names"],
	["A schema is PascalCase", "schema-names"],
	["A Schema.Struct field", "schema-struct-keys"],
	["A service's Layer", "service-layers"],
	["A module never re-exports", "type-re-exports"],
];

const IMPORTS: Line = ['import { Effect, Layer, Schema } from "effect";'];

const fixtures: Readonly<Record<string, readonly Line[]>> = {
	"src/components.tsx": [
		['import { createContext } from "react";'],
		['const Theme = createContext<string>("light");', "useReactNamingConvention"],
		["export function Panel({ onClose }: { readonly onClose: () => void }) {"],
		["\tconst close = () => onClose();"],
		["\tconst handleOpen = () => onClose();"],
		["\treturn ("],
		['\t\t<Theme.Provider value="dark">'],
		['\t\t\t<button onClick={close} type="button" />', "handler-names"],
		['\t\t\t<button onClick={handleOpen} type="button" />'],
		['\t\t\t<button onClick={onClose} type="button" />'],
		["\t\t</Theme.Provider>"],
		["\t);"],
		["}"],
		["export const panelWidth = 3;", "constant-names", "useComponentExportOnlyModules"],
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
		["\treadonly base_url: string;", "useNamingConvention"],
		["}"],
		["export interface HttpClient {"],
		['\treadonly _tag: "HttpClient";'],
		["\treadonly baseUrl: string;"],
		["}"],
		["export function parseURL(text: string) {", "useNamingConvention"],
		["\treturn text;"],
		["}"],
		[
			"export const headers = { content_type: 1, MAX_AGE: 2, userId: 3, Service: 4, _tag: 5, $raw: 6 };",
			"useNamingConvention",
			"useNamingConvention",
		],
		["export const env: Record<string, number> = { DATABASE_URL: 1 };", "useNamingConvention"],
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
		["export const Row = Schema.Struct({ created_at: Schema.String });", "useNamingConvention", "schema-struct-keys"],
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

let found: ReadonlyMap<string, readonly string[]> = new Map();

beforeAll(async () => {
	const root = seedTree(
		[
			{ content: '{ "extends": ["@shivaedev/quality/biome"] }\n', path: "biome.json" },
			{ content: "node_modules/\n", path: ".gitignore" },
		],
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
});
