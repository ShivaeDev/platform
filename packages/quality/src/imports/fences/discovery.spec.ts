import { Effect } from "effect";
import { afterEach, expect, it } from "vitest";
import { services } from "#cli/runMain.ts";
import { resolveRules } from "#config/resolve.ts";
import { evaluate, passes } from "#engine/evaluate.ts";
import { runRules } from "#engine/runRules.ts";
import { collectInventory } from "#inventory/collect.ts";
import { render } from "#report/render.ts";
import { importFences } from "#rules/imports/fences.ts";
import { browserFence, fenceDiscovery, replaceBoundary } from "#test/fenceDiscovery.ts";
import { findingsIn, scanned } from "#test/imports.ts";
import { run } from "#test/run.ts";
import { removeSeededTrees } from "#test/tree.ts";

afterEach(removeSeededTrees);

it("discovers a package boundary outside the source inventory and reports its transitive violation through Quality", async () => {
	const root = fenceDiscovery();
	const inputs = await scanned(root);
	const inventory = await Effect.runPromise(
		collectInventory(root, { exclude: [], extensions: [".ts"], sources: ["packages/ui/src"] }).pipe(Effect.provide(services)),
	);
	expect(inventory.files).not.toContain("packages/ui/quality.fences.config.ts");
	const resolved = await Effect.runPromise(resolveRules({}));
	if (resolved._tag !== "Valid") {
		throw new Error(resolved.issues.join("\n"));
	}
	const rules = resolved.value;
	const violations = await run(
		runRules(
			rules.active.filter((rule) => rule.id === "imports/fences"),
			{ ...inputs, ...inventory },
		),
	);
	const outcome = evaluate(violations, [], [], rules);
	expect(passes(outcome)).toBe(false);
	expect(violations.map(({ file }) => file).toSorted()).toEqual(["packages/ui/src/bridge.ts", "packages/ui/src/main.ts"]);
	expect(violations).toEqual(
		expect.arrayContaining([
			{
				file: "packages/ui/src/main.ts",
				level: "error",
				line: 1,
				message: expect.stringContaining(
					'Reaches node:fs through packages/ui/src/main.ts -> packages/ui/src/bridge.ts -> node:fs across the fence "browser-stays-off-disk": The browser code runs without Node.',
				),
				rule: "imports/fences",
				subject: "browser-stays-off-disk",
			},
			{
				file: "packages/ui/src/bridge.ts",
				level: "error",
				line: 1,
				message: expect.stringContaining(
					'Reaches node:fs through packages/ui/src/bridge.ts -> node:fs across the fence "browser-stays-off-disk": The browser code runs without Node.',
				),
				rule: "imports/fences",
				subject: "browser-stays-off-disk",
			},
		]),
	);
	const report = render(outcome, { baseline: "baseline.jsonl", checked: 2, descriptions: new Map(), registry: "registry.json" });
	expect(report).toContain("error imports/fences (2)");
	expect(report).toContain("packages/ui/src/main.ts:1");
	expect(report).toContain("quality: failed with 2 errors");
});

it.each([
	["export const fences = [];", "default export"],
	["export default {};", "array"],
	["export default [null];", "fence"],
	['export default [{ _tag: "Fence" }];', "fence"],
	["throw new Error('broken policy');", "broken policy"],
])("rejects an unreadable boundary: %s", async (boundary, problem) => {
	await expect(findingsIn(importFences, undefined, fenceDiscovery(boundary))).rejects.toThrow("packages/ui/quality.fences.config.ts");
	await expect(findingsIn(importFences, undefined, fenceDiscovery(boundary))).rejects.toThrow(problem);
});

it("validates discovered and config-supplied fences as one policy", async () => {
	await expect(findingsIn(importFences, { fences: [browserFence] }, fenceDiscovery())).rejects.toThrow("an earlier fence has this name");
});

it("discovers a boundary beside the root manifest", async () => {
	expect((await findingsIn(importFences, undefined, fenceDiscovery(undefined, "."))).map(({ file }) => file).toSorted()).toEqual([
		"packages/ui/src/bridge.ts",
		"packages/ui/src/main.ts",
	]);
});

it("reads a changed boundary again during a later scan", async () => {
	const root = fenceDiscovery();
	expect((await findingsIn(importFences, undefined, root)).map(({ file }) => file).toSorted()).toEqual([
		"packages/ui/src/bridge.ts",
		"packages/ui/src/main.ts",
	]);
	replaceBoundary(root, "export default [];");
	expect(await findingsIn(importFences, undefined, root)).toEqual([]);
});
