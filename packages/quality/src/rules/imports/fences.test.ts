import { afterEach, describe, expect, it } from "vitest";
import { fence } from "#imports/fences/dsl.ts";
import type { Fence } from "#imports/fences/model.ts";
import { anyOf, external, folders, modules, packages, scopes, workspace } from "#imports/fences/selectors.ts";
import { importFences } from "#rules/imports/fences.ts";
import { findingsIn, importTree } from "#test/imports.ts";
import { removeSeededTrees } from "#test/tree.ts";

afterEach(removeSeededTrees);

const gameKeepsOutOfCms = fence("game-keeps-out-of-cms")
	.because("The game ships to players; the CMS is for contributors.")
	.from(folders("packages/game/src"))
	.mayNotImport(packages("cms"))
	.demonstratedBy({
		illegal: ["packages/game/src/a.ts", "packages/cms/src/b.ts"],
		legal: ["packages/game/src/a.ts", "packages/simulation/src/b.ts"],
	});

const gameNeverReachesCms = fence("game-never-reaches-cms")
	.because("Nothing the game loads may pull the CMS in.")
	.from(folders("packages/game/src"))
	.mayNotReach(packages("@demo/cms"))
	.demonstratedBy({
		illegal: ["packages/game/src/a.ts", "packages/simulation/src/b.ts", "packages/cms/src/c.ts"],
		legal: ["packages/game/src/a.ts", "packages/simulation/src/b.ts"],
	});

const gameSpeaksCards = fence("game-speaks-cards")
	.because("The game uses the card words of the vocabulary only.")
	.from(folders("packages/game/src"))
	.mayImportOnly("cards", "session")
	.of(packages("vocabulary"))
	.demonstratedBy({
		illegal: ["packages/game/src/a.ts", "packages/vocabulary/src/voyage/b.ts"],
		legal: ["packages/game/src/a.ts", "packages/vocabulary/src/cards.ts"],
	});

const cmsStaysOffDisk = fence("cms-stays-off-disk")
	.because("The CMS stores through the database, never the file system.")
	.from(packages("cms"))
	.mayNotImport(modules("node:fs"))
	.demonstratedBy({ illegal: ["packages/cms/src/a.ts", external("fs/promises")], legal: ["packages/cms/src/a.ts", external("node:path")] });

const coreNeedsNoAuth = fence("core-needs-no-auth")
	.because("The core runs without the auth packages installed.")
	.from(folders("packages/core/src"))
	.mayNotImport(anyOf(modules("better-auth", "hast", "@demo/kit"), scopes("@trpc")))
	.demonstratedBy({ illegal: ["packages/core/src/a.ts", external("better-auth/client")], legal: ["packages/core/src/a.ts", external("effect")] });

function check(fences: readonly Fence[], tree = "fence") {
	return findingsIn(importFences, { fences }, importTree(tree));
}

describe("imports/fences fires", () => {
	it("on an import across a fence, at the import's line", async () => {
		expect(await check([gameKeepsOutOfCms])).toEqual([
			{
				file: "packages/game/src/play.ts",
				line: 1,
				message: 'Imports packages/cms/src/edit.ts across the fence "game-keeps-out-of-cms": The game ships to players; the CMS is for contributors.',
				subject: "game-keeps-out-of-cms",
			},
		]);
	});

	it("on every path that reaches across a transitive fence, naming the path", async () => {
		const findings = await check([gameNeverReachesCms]);
		expect(findings.map((finding) => finding.message.split(" across ")[0])).toEqual([
			"Reaches packages/cms/src/edit.ts through packages/game/src/play.ts -> packages/cms/src/edit.ts",
			"Reaches packages/cms/src/edit.ts through packages/game/src/run.ts -> packages/simulation/src/step.ts -> packages/cms/src/edit.ts",
		]);
	});

	it("on an import of a vocabulary subject the fence does not allow", async () => {
		const findings = await check([gameSpeaksCards]);
		expect(findings.map((finding) => [finding.file, finding.line])).toEqual([["packages/game/src/words.ts", 2]]);
		expect(findings[0]?.message).toContain('Imports "voyage" of packages/vocabulary/src across the fence "game-speaks-cards"');
	});

	it("on a builtin module, however the import spells it", async () => {
		expect((await check([cmsStaysOffDisk])).map((finding) => finding.file)).toEqual(["packages/cms/src/edit.ts"]);
	});
});

describe("imports/fences skips", () => {
	it("test code in the modules a fence holds, a test or spec file or a file under test-support, because it ships nowhere", async () => {
		const findings = await Promise.all([gameKeepsOutOfCms, gameNeverReachesCms, gameSpeaksCards].map((one) => check([one])));
		expect(findings.flat().map((finding) => finding.file)).toEqual([
			"packages/game/src/play.ts",
			"packages/game/src/play.ts",
			"packages/game/src/run.ts",
			"packages/game/src/words.ts",
		]);
	});
});

describe("imports/fences sees through", () => {
	it("an alias, a tsconfig path, a relative path and a types-only package to the package an import names", async () => {
		expect((await check([coreNeedsNoAuth], "aliases")).map((finding) => finding.message.split(" across ")[0])).toEqual([
			"Imports #auth (better-auth)",
			"Imports auth-kit (better-auth)",
			"Imports ../../../node_modules/@trpc/server/src/http.ts (@trpc/server)",
			"Imports hast",
			"Imports @demo/kit",
		]);
	});

	it("a package.json nested in a workspace package, which keeps the files it holds in the workspace package", async () => {
		expect((await check([gameKeepsOutOfCms], "nested")).map((finding) => finding.file)).toEqual(["packages/game/src/preview.ts"]);
	});

	it("an import of a file that does not exist yet, such as a client a generator writes", async () => {
		expect((await check([gameKeepsOutOfCms], "pending")).map((finding) => finding.message.split(" across ")[0])).toEqual([
			"Imports packages/cms/generated/client.ts",
		]);
	});
});

describe("imports/fences refuses a policy", () => {
	it("that names a package or folder the repository does not have", async () => {
		const typo = fence("typo")
			.because("Typos must not pass silently.")
			.from(folders("packages/gaem/src"))
			.mayNotImport(packages("cmss"))
			.demonstratedBy({ illegal: ["packages/gaem/src/a.ts", "packages/cmss/src/b.ts"], legal: ["packages/gaem/src/a.ts", external("effect")] });
		await expect(check([typo])).rejects.toThrow(
			[
				"the fence policy is invalid:",
				'  - fence "typo".from: folders("packages/gaem/src") holds no checked file',
				'  - fence "typo".to: no workspace package is named "cmss"',
			].join("\n"),
		);
	});

	it("whose illegal example crosses another fence too, so every fence stays an independent prohibition", async () => {
		const overlapping = fence("game-keeps-out-of-workspace")
			.because("The game is a leaf.")
			.from(folders("packages/game/src"))
			.mayNotImport(workspace.except(packages("game")))
			.demonstratedBy({ illegal: ["packages/game/src/a.ts", "packages/cms/src/b.ts"], legal: ["packages/game/src/a.ts", external("effect")] });
		await expect(check([gameKeepsOutOfCms, overlapping])).rejects.toThrow(
			'fence "game-keeps-out-of-workspace": the illegal example packages/game/src/a.ts -> packages/cms/src/b.ts must cross this fence alone, and crosses game-keeps-out-of-cms, game-keeps-out-of-workspace',
		);
	});

	it("whose vocabulary names a subject the folder does not hold", async () => {
		const wrong = fence("wrong")
			.because("Examples must be true.")
			.from(folders("packages/game/src"))
			.mayImportOnly("cards", "stories")
			.of(packages("vocabulary"))
			.demonstratedBy({
				illegal: ["packages/game/src/a.ts", "packages/vocabulary/src/session.ts"],
				legal: ["packages/game/src/a.ts", "packages/vocabulary/src/voyage/b.ts"],
			});
		await expect(check([wrong])).rejects.toThrow('fence "wrong".of: "stories" is no module or folder directly in packages/vocabulary/src');
	});

	it("whose examples contradict it", async () => {
		const wrong = fence("wrong")
			.because("Examples must be true.")
			.from(folders("packages/game/src"))
			.mayImportOnly("cards", "session")
			.of(packages("vocabulary"))
			.demonstratedBy({
				illegal: ["packages/game/src/a.ts", "packages/vocabulary/src/session.ts"],
				legal: ["packages/game/src/a.ts", "packages/vocabulary/src/voyage/b.ts"],
			});
		await expect(check([wrong])).rejects.toThrow(
			[
				'  - fence "wrong": the illegal example packages/game/src/a.ts -> packages/vocabulary/src/session.ts must cross this fence alone, and crosses none',
				'  - fence "wrong": the legal example packages/game/src/a.ts -> packages/vocabulary/src/voyage/b.ts crosses wrong',
			].join("\n"),
		);
	});
});
