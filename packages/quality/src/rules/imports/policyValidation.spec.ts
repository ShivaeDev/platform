import { afterEach, describe, expect, it } from "vitest";
import { fence } from "#imports/fences/dsl.ts";
import { anyOf, anything, external, files, folders, modules, packages, scopes, workspace } from "#imports/fences/selectors.ts";
import { importFences } from "#rules/imports/fences.ts";
import { findingsIn, importTree } from "#test/imports.ts";
import { checkRule } from "#test/inputs.ts";
import { removeSeededTrees, seedTree } from "#test/tree.ts";

afterEach(removeSeededTrees);

const examples = {
	illegal: ["packages/game/src/a.ts", "packages/cms/src/b.ts"],
	legal: ["packages/game/src/a.ts", "packages/simulation/src/b.ts"],
} as const;

describe("fence configuration boundaries", () => {
	it("allows disabling all fences even when there are no source modules", async () => {
		expect(await checkRule(importFences, { fences: [] }, {})).toEqual([]);
	});

	it.each([
		[" ", "A reason.", "fence 0: has no name"],
		["game", " ", 'fence "game": because() gives no reason'],
	])("rejects a declaration with name %s and rationale %s", async (name, reason, problem) => {
		const policy = fence(name).because(reason).from(packages("game")).mayNotImport(packages("cms")).demonstratedBy(examples);
		await expect(findingsIn(importFences, { fences: [policy] }, importTree("fence"))).rejects.toThrow(problem);
	});

	it("rejects duplicate fence names before a finding becomes ambiguous", async () => {
		const policy = fence("game").because("A reason.").from(packages("game")).mayNotImport(packages("cms")).demonstratedBy(examples);
		await expect(findingsIn(importFences, { fences: [policy, policy] }, importTree("fence"))).rejects.toThrow(
			'fence "game": an earlier fence has this name',
		);
	});

	it.each([
		[packages(), "packages() names nothing"],
		[folders(), "folders() names nothing"],
		[files(), "files() names nothing"],
		[modules(), "modules() names nothing"],
		[scopes(), "scopes() names nothing"],
		[anyOf(), "anyOf() names nothing"],
		[anything.except(), "except() names nothing"],
		[files("packages/game/src/missing.ts"), 'files("packages/game/src/missing.ts") is no checked file'],
		[modules("./local"), 'modules("./local") is no package name'],
		[scopes("@demo/cms"), 'scopes("@demo/cms") is no scope such as "@types"'],
	])("rejects a selector that would silently protect nothing: %s", async (target, problem) => {
		const policy = fence("game").because("A reason.").from(packages("game")).mayNotImport(target).demonstratedBy(examples);
		await expect(findingsIn(importFences, { fences: [policy] }, importTree("fence"))).rejects.toThrow(problem);
	});

	it("rejects workspace selection in a repository without workspace packages", async () => {
		const policy = fence("game").because("A reason.").from(workspace).mayNotImport(modules("node:fs")).demonstratedBy(examples);
		await expect(findingsIn(importFences, { fences: [policy] }, importTree("cycle"))).rejects.toThrow(
			"workspace selects nothing, since no named package.json among the sources is a member of the workspace that pnpm-workspace.yaml or the root package.json declares",
		);
	});

	it("requires a scoped package name when two workspace members have the same short name", async () => {
		const root = seedTree([
			{ content: "packages:\n  - packages/*\n", path: "pnpm-workspace.yaml" },
			{ content: '{"name":"@one/cms"}', path: "packages/one/package.json" },
			{ content: '{"name":"@two/cms"}', path: "packages/two/package.json" },
			{ content: "export const value = 1;", path: "packages/one/src/main.ts" },
			{ content: "export const value = 2;", path: "packages/two/src/main.ts" },
		]);
		const policy = fence("cms").because("A reason.").from(packages("cms")).mayNotImport(modules("node:fs")).demonstratedBy(examples);
		await expect(findingsIn(importFences, { fences: [policy] }, root)).rejects.toThrow('more than one workspace package is named "cms"');
	});

	it("rejects an external importer in a demonstration that the repository cannot inspect", async () => {
		const policy = fence("game")
			.because("A reason.")
			.from(packages("game"))
			.mayNotReach(modules("effect"))
			.demonstratedBy({ illegal: ["packages/game/src/a.ts", external("bridge"), external("effect")], legal: examples.legal });
		await expect(findingsIn(importFences, { fences: [policy] }, importTree("fence"))).rejects.toThrow(
			'fence "game": an example imports from an external module; only its last step may be external()',
		);
	});

	it("enforces a fence over named files while allowing their other imports", async () => {
		const policy = fence("game")
			.because("The editor is not shipped to players.")
			.from(files("packages/game/src/play.ts"))
			.mayNotImport(anything.except(files("packages/simulation/src/step.ts")))
			.demonstratedBy({
				illegal: ["packages/game/src/play.ts", "packages/cms/src/edit.ts"],
				legal: ["packages/game/src/play.ts", "packages/simulation/src/step.ts"],
			});
		expect(await findingsIn(importFences, { fences: [policy] }, importTree("fence"))).toEqual([
			{
				file: "packages/game/src/play.ts",
				line: 1,
				message: 'Imports packages/cms/src/edit.ts across the fence "game": The editor is not shipped to players.',
				subject: "game",
			},
		]);
	});

	it("uses a folder as a vocabulary boundary", async () => {
		const policy = fence("words")
			.because("Use card words only.")
			.from(packages("game"))
			.mayImportOnly("cards", "session")
			.of(folders("packages/vocabulary/src/"))
			.demonstratedBy({
				illegal: ["packages/game/src/a.ts", "packages/vocabulary/src/voyage/a.ts"],
				legal: ["packages/game/src/a.ts", "packages/vocabulary/src/cards.ts"],
			});
		expect((await findingsIn(importFences, { fences: [policy] }, importTree("fence"))).map(({ file, line }) => ({ file, line }))).toEqual([
			{ file: "packages/game/src/words.ts", line: 2 },
		]);
	});

	it.each([
		[folders("packages/vocabulary/missing"), ["cards"], 'folders("packages/vocabulary/missing") holds no checked file'],
		[packages("vocabulary", "cms"), ["cards"], "of() takes one package or one folder"],
		[packages("missing"), ["cards"], 'no workspace package is named "missing"'],
		[packages("vocabulary"), [], "mayImportOnly() names no subject"],
	])("rejects an unusable vocabulary boundary %s", async (unit, subjects, problem) => {
		const policy = fence("words")
			.because("A reason.")
			.from(packages("game"))
			.mayImportOnly(...subjects)
			.of(unit)
			.demonstratedBy(examples);
		await expect(findingsIn(importFences, { fences: [policy] }, importTree("fence"))).rejects.toThrow(problem);
	});
});
