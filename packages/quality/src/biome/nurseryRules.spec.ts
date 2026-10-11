import { afterEach, describe, expect, it } from "vitest";
import { biomeReport } from "#biome/report.ts";
import { linkPackage, removeSeededTrees, seedTree } from "#test/tree.ts";

const RULES: ReadonlySet<string | undefined> = new Set([
	"lint/nursery/noMisplacedListElements",
	"lint/nursery/noReactObjectTypeAsDefaultProp",
	"lint/nursery/noSelfImport",
	"lint/nursery/usePromiseRejectErrors",
]);

const SELF_IMPORT = ['import { helper } from "./self.ts";', "export const helper = 1;", "export const twice = helper * 2;"].join("\n");

const LIST = [
	"const NO_ITEMS: readonly string[] = [];",
	"export function Shared({ items = NO_ITEMS }: { readonly items?: readonly string[] }) {",
	"\treturn <ul><li>{items.length}</li></ul>;",
	"}",
	"export function Fresh({ items = [] }: { readonly items?: readonly string[] }) {",
	"\treturn <div><li>{items.length}</li></div>;",
	"}",
].join("\n");

const REJECTIONS = [
	'export const reason = Promise.reject("remote check timed out");',
	'export const failure = Promise.reject(new Error("remote check timed out"));',
].join("\n");

afterEach(removeSeededTrees);

function repository(): string {
	const root = seedTree([
		{ content: '{ "extends": ["@shivaedev/quality/biome"] }\n', path: "biome.json" },
		{ content: "node_modules/\n", path: ".gitignore" },
		{ content: SELF_IMPORT, path: "src/self.ts" },
		{ content: LIST, path: "src/list.tsx" },
		{ content: REJECTIONS, path: "src/rejections.ts" },
	]);
	linkPackage(root);
	return root;
}

describe("nursery rules in the Biome preset", () => {
	it("reports self-imports, fresh prop defaults, stray list items and non-Error rejections, and accepts their safe forms", async () => {
		const report = await biomeReport(repository(), ["lint"]);
		const found = report.diagnostics
			.filter((diagnostic) => RULES.has(diagnostic.category))
			.map((diagnostic) => `${diagnostic.location.path}:${diagnostic.location.start?.line} ${diagnostic.category} ${diagnostic.severity}`)
			.toSorted((left, right) => left.localeCompare(right));
		expect(found).toEqual([
			"src/list.tsx:5 lint/nursery/noReactObjectTypeAsDefaultProp error",
			"src/list.tsx:6 lint/nursery/noMisplacedListElements error",
			"src/rejections.ts:1 lint/nursery/usePromiseRejectErrors error",
			"src/self.ts:1 lint/nursery/noSelfImport error",
		]);
	});
});
