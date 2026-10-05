import { describe, expect, it } from "vitest";
import type { Finding } from "#rule.ts";
import { namedAfterExport } from "#rules/files/namedAfterExport.ts";
import { checkRule, type Seed } from "#test/inputs.ts";

const manifest = JSON.stringify({ bin: { tool: "dist/tool-cli.js" }, name: "@demo/app", scripts: { seed: "node script/seed-data.ts" } });

const named: Seed = {
	sources: [
		{ content: "export function listItems() {}\n", path: "packages/app/src/routers/items/list.ts" },
		{ content: "export const itemList = [];\n", path: "packages/app/src/routers/items/list-copy.ts" },
		{ content: "export class CreateItemRouter {}\n", path: "packages/app/src/routers/items/Create.ts" },
		{ content: "export function ItemPanel() {}\nexport interface ItemPanelProps {}\n", path: "packages/app/src/item/Panel.tsx" },
		{ content: "export function ItemPanel() {}\n", path: "packages/app/src/ItemPanel.tsx" },
		{ content: "export function Panel() {}\n", path: "packages/app/src/Panel/Panel.tsx" },
		{ content: "export interface Order {}\n", path: "packages/app/src/Order.ts" },
		{ content: "export const MAX_ITEMS = 10;\nexport const MAX_DEPTH = 4;\n", path: "packages/app/src/limits.ts" },
		{ content: "export const MAX_ITEMS = 10;\n", path: "packages/app/src/maxItems.ts" },
		{ content: "export const timeout = 30;\n", path: "packages/app/src/timeout.ts" },
		{ content: "export function loadItem() {}\n", path: "packages/app/src/fetch.ts" },
		{ content: "export interface Order {}\n", path: "packages/app/src/order-type.ts" },
		{ content: "export function listItems() {}\n", path: "packages/app/src/items/listItems.ts" },
		{ content: "export function list() {}\nexport function count() {}\n", path: "packages/app/src/Helpers.ts" },
		{ content: "export function list() {}\nexport function count() {}\n", path: "packages/app/src/helpers.ts" },
		{ content: "import 'x';\n", path: "packages/app/src/SetupTests.ts" },
		{ content: "import 'x';\n", path: "packages/app/src/setupTests.ts" },
		{ content: "export function seed() {}\n", path: "packages/app/script/seed-data.ts" },
		{ content: "export function run() {}\n", path: "packages/app/src/tool-cli.ts" },
		{ content: "#!/usr/bin/env node\nexport function run() {}\n", path: "packages/app/src/runTool.ts" },
		{ content: "export function helper() {}\n", path: "packages/app/src/other.test.ts" },
		{ content: "export default {};\n", path: "packages/app/vitest.config.ts" },
	],
	texts: { "packages/app/package.json": manifest },
};

function byFile(findings: readonly Finding[]): readonly string[] {
	return findings.map((finding) => `${finding.file}: ${finding.message.split(".")[0]}`);
}

describe("files/named-after-export", () => {
	it("passes a file whose name and folders spell its export, and flags every other shape", async () => {
		const findings = await checkRule(namedAfterExport, undefined, {
			...named,
			files: [...(named.sources ?? []).map((file) => file.path), "packages/app/package.json"],
		});
		expect(byFile(findings)).toEqual([
			'packages/app/src/routers/items/list-copy.ts: "list-copy" does not name its export itemList',
			'packages/app/src/maxItems.ts: "maxItems" exports only the constant MAX_ITEMS',
			'packages/app/src/timeout.ts: "timeout" exports only the constant timeout',
			'packages/app/src/fetch.ts: "fetch" does not name its export loadItem',
			'packages/app/src/order-type.ts: "order-type" does not name its export Order',
			'packages/app/src/items/listItems.ts: "listItems" repeats its folder "items"',
			'packages/app/src/Helpers.ts: "Helpers" exports several things, so it is a topic file named in camelCase, such as limits',
			'packages/app/src/SetupTests.ts: "SetupTests" exports nothing, so it is named in camelCase, such as setupTests',
			'packages/app/src/runTool.ts: "runTool" is run as a script, so it is named in kebab-case, such as build-docs',
		]);
	});

	it("says which shapes are valid when a file does not name its export", async () => {
		const findings = await checkRule(namedAfterExport, undefined, {
			sources: [{ content: "export function loadItem() {}\n", path: "src/fetch.ts" }],
		});
		expect(findings).toEqual([
			{
				file: "src/fetch.ts",
				message:
					"\"fetch\" does not name its export loadItem. The file name and the names of its folders spell the export, in any order, and the file's first letter follows the export's case: listItems in items/ is items/list.ts, ItemPanel is ItemPanel.tsx or item/Panel.tsx. Rename the file or the export.",
			},
		]);
	});

	it("names a file after its default export", async () => {
		const sources = [
			{ content: "export default function ItemPanel() {}\n", path: "src/ItemPanel.tsx" },
			{ content: "function Badge() {}\nexport default Badge;\n", path: "src/Badge.tsx" },
			{ content: 'import { memo } from "react";\nfunction Card() {}\nexport default memo(Card);\n', path: "src/Card.tsx" },
			{ content: "export default class OrderStore {}\n", path: "src/OrderStore.ts" },
			{ content: "function Toast() {}\nexport { Toast as default };\n", path: "src/Toast.tsx" },
			{ content: "export default function () {}\n", path: "src/setupMocks.ts" },
			{ content: "export default function ItemPanel() {}\n", path: "src/item-panel.tsx" },
		];
		expect(byFile(await checkRule(namedAfterExport, undefined, { sources }))).toEqual([
			'src/item-panel.tsx: "item-panel" does not name its export ItemPanel',
		]);
	});

	it("leaves the configured tool-owned files alone", async () => {
		const sources = [{ content: "export function loadItem() {}\n", path: "src/fetch.ts" }];
		expect(await checkRule(namedAfterExport, { toolOwned: ["src/fetch.ts"] }, { sources })).toEqual([]);
	});
});
