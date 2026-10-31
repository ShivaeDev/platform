import { expect } from "vitest";
import { namedAfterExport } from "#rules/files/namedAfterExport.ts";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";

// The package runs script/seed-data.ts through a script and src/tool-cli.ts, built to dist/tool-cli.js, as its bin.
const appPackage = repositoryHas({
	content: JSON.stringify({ bin: { tool: "dist/tool-cli.js" }, name: "@demo/app", scripts: { seed: "node script/seed-data.ts" } }),
	path: "packages/app/package.json",
});

const named = [
	["Create.tsx in spaces/client/ exporting CreateSpace", "packages/app/src/spaces/client/Create.tsx", "export function CreateSpace() {}\n"],
	["list.ts in routers/items/ exporting listItems", "packages/app/src/routers/items/list.ts", "export function listItems() {}\n"],
	["Create.ts in routers/items/ exporting CreateItemRouter", "packages/app/src/routers/items/Create.ts", "export class CreateItemRouter {}\n"],
	[
		"Panel.tsx in item/ exporting ItemPanel and its props",
		"packages/app/src/item/Panel.tsx",
		"export function ItemPanel() {}\nexport interface ItemPanelProps {}\n",
	],
	["ItemPanel.tsx exporting ItemPanel", "packages/app/src/ItemPanel.tsx", "export function ItemPanel() {}\n"],
	["Panel.tsx in its module folder Panel/", "packages/app/src/Panel/Panel.tsx", "export function Panel() {}\n"],
	["Order.ts exporting the interface Order", "packages/app/src/Order.ts", "export interface Order {}\n"],
	["the topic file limits.ts exporting two constants", "packages/app/src/limits.ts", "export const MAX_ITEMS = 10;\nexport const MAX_DEPTH = 4;\n"],
	["the camelCase topic file helpers.ts", "packages/app/src/helpers.ts", "export function list() {}\nexport function count() {}\n"],
	["the camelCase setupTests.ts that exports nothing", "packages/app/src/setupTests.ts", "import 'x';\n"],
	["the kebab-case seed-data.ts that a package script runs", "packages/app/script/seed-data.ts", "export function seed() {}\n"],
	["the kebab-case tool-cli.ts that the package bin runs", "packages/app/src/tool-cli.ts", "export function run() {}\n"],
	["a test file", "packages/app/src/other.test.ts", "export function helper() {}\n"],
	["a config file", "packages/app/vitest.config.ts", "export default {};\n"],
] as const;

for (const [file, path, content] of named) {
	ruleStory.it(`files/named-after-export accepts ${file}`, [appPackage, repositoryHas({ content, path })], function* ({ check }) {
		expect(yield* check(namedAfterExport)).toEqual([]);
	});
}

const misnamed = [
	[
		"CreateSpace.tsx that repeats its folder spaces/",
		"packages/app/src/spaces/client/CreateSpace.tsx",
		"export function CreateSpace() {}\n",
		'"CreateSpace" repeats its folder "spaces".',
	],
	[
		"listItems.ts that repeats its folder items/",
		"packages/app/src/items/listItems.ts",
		"export function listItems() {}\n",
		'"listItems" repeats its folder "items".',
	],
	[
		"list-copy.ts exporting itemList",
		"packages/app/src/routers/items/list-copy.ts",
		"export const itemList = [];\n",
		'"list-copy" does not name its export itemList.',
	],
	["order-type.ts exporting Order", "packages/app/src/order-type.ts", "export interface Order {}\n", '"order-type" does not name its export Order.'],
	[
		"maxItems.ts exporting only the constant MAX_ITEMS",
		"packages/app/src/maxItems.ts",
		"export const MAX_ITEMS = 10;\n",
		'"maxItems" exports only the constant MAX_ITEMS.',
	],
	[
		"timeout.ts exporting only the constant timeout",
		"packages/app/src/timeout.ts",
		"export const timeout = 30;\n",
		'"timeout" exports only the constant timeout.',
	],
	[
		"the PascalCase topic file Helpers.ts",
		"packages/app/src/Helpers.ts",
		"export function list() {}\nexport function count() {}\n",
		'"Helpers" exports several things, so it is a topic file named in camelCase, such as limits.ts.',
	],
	[
		"the PascalCase SetupTests.ts that exports nothing",
		"packages/app/src/SetupTests.ts",
		"import 'x';\n",
		'"SetupTests" exports nothing, so it is named in camelCase, such as setupTests.ts.',
	],
	[
		"the camelCase script runTool.ts with a shebang",
		"packages/app/src/runTool.ts",
		"#!/usr/bin/env node\nexport function run() {}\n",
		'"runTool" is run as a script, so it is named in kebab-case, such as build-docs.ts.',
	],
] as const;

for (const [file, path, content, reason] of misnamed) {
	ruleStory.it(
		`files/named-after-export reports ${file}: ${reason}`,
		[appPackage, repositoryHas({ content, path })],
		function* ({ check, messages }) {
			yield* check(namedAfterExport);

			expect(yield* messages()).toEqual([expect.stringContaining(reason)]);
		},
	);
}

ruleStory.it(
	"files/named-after-export reports a file that does not name its export and says which names would",
	[repositoryHas({ content: "export function loadItem() {}\n", path: "src/fetch.ts" })],
	function* ({ check }) {
		const findings = yield* check(namedAfterExport);

		expect(findings).toEqual([
			{
				file: "src/fetch.ts",
				message:
					"\"fetch\" does not name its export loadItem. The file name and the names of its folders spell the export, in any order, and the file's first letter follows the export's case: listItems in items/ is items/list.ts, ItemPanel is ItemPanel.tsx or item/Panel.tsx. Rename the file or the export.",
			},
		]);
	},
);

const defaultExports = [
	["a default function", "src/ItemPanel.tsx", "export default function ItemPanel() {}\n"],
	["a default export of a local function", "src/Badge.tsx", "function Badge() {}\nexport default Badge;\n"],
	["a default export wrapped in memo", "src/Card.tsx", 'import { memo } from "react";\nfunction Card() {}\nexport default memo(Card);\n'],
	["a default class", "src/OrderStore.ts", "export default class OrderStore {}\n"],
	["a function exported as default", "src/Toast.tsx", "function Toast() {}\nexport { Toast as default };\n"],
	["an anonymous default function in a camelCase file", "src/setupMocks.ts", "export default function () {}\n"],
] as const;

for (const [exported, path, content] of defaultExports) {
	ruleStory.it(`files/named-after-export accepts ${path} named after ${exported}`, [repositoryHas({ content, path })], function* ({ check }) {
		expect(yield* check(namedAfterExport)).toEqual([]);
	});
}

ruleStory.it(
	"files/named-after-export reports item-panel.tsx, which does not name its default export ItemPanel",
	[repositoryHas({ content: "export default function ItemPanel() {}\n", path: "src/item-panel.tsx" })],
	function* ({ check, messages }) {
		yield* check(namedAfterExport);

		expect(yield* messages()).toEqual([expect.stringContaining('"item-panel" does not name its export ItemPanel.')]);
	},
);

const RAILWAY = "export default function infrastructure() {}\n";

for (const path of [".railway/railway.ts", "apps/web/.railway/railway.ts"]) {
	ruleStory.it(
		`files/named-after-export leaves Railway's authoring file ${path} to Railway`,
		[repositoryHas({ content: RAILWAY, path })],
		function* ({ check }) {
			expect(yield* check(namedAfterExport)).toEqual([]);
		},
	);
}

for (const path of [".railway/helpers.ts", "src/railway.ts", ".railway/nested/railway.ts", ".railway/railway.tsx", ".railways/railway.ts"]) {
	ruleStory.it(
		`files/named-after-export checks ${path}, which is not Railway's authoring file`,
		[repositoryHas({ content: RAILWAY, path })],
		function* ({ check, locations }) {
			yield* check(namedAfterExport);

			expect(yield* locations()).toContain(path);
		},
	);
}
