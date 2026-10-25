import { afterEach, describe, expect, it } from "vitest";
import { CLI_EXIT, quality } from "#test/cli.ts";
import { register, seedFences } from "#test/importFenceRepository.ts";
import { misdirectedWorkspace, productionImportsTestsWorkspace } from "#test/importWorkspaces.ts";
import { formatTree } from "#test/qualityTree.ts";
import { removeSeededTrees } from "#test/tree.ts";

const CLI_TIMEOUT = 60_000;

afterEach(removeSeededTrees);

describe("the imports rules on the command line", { timeout: CLI_TIMEOUT }, () => {
	it("exit 2 when the import graph covers no modules, so a misdirected config cannot pass", () => {
		const root = misdirectedWorkspace();
		const result = quality(root, "lint");
		expect(result.status).toBe(CLI_EXIT.invalid);
		expect(result.stderr).toContain("the import graph covers no modules");
		expect(result.stderr).toContain("Point `sources` at the TypeScript or JavaScript code.");
		expect(result.stderr).not.toContain("turn the imports rules off");
	});

	it("rejects production imports of tests by default and asks for shared production code", () => {
		const root = productionImportsTestsWorkspace();
		const result = quality(root, "lint");
		expect(result.status).toBe(CLI_EXIT.rejected);
		expect(result.stdout).toContain("imports/no-test-code");
		expect(result.stdout).toContain('src/app.ts:1  Imports test code through "./app.test.ts".');
		expect(result.stdout).toContain('src/app.ts:2  Imports test code through "./test-support/fixture.ts".');
		expect(result.stdout).toContain("Move the shared code into a production module and import it from both production and tests.");
	});

	it("take a registry exception for one fence in one file, and fail on one that exempts nothing", () => {
		const root = seedFences();
		expect(quality(root, "lint").stdout).toContain(
			'packages/game/src/play.ts:1  Imports packages/cms/src/edit.ts across the fence "game-keeps-out-of-cms"',
		);
		const reason = "The play screen previews CMS drafts until the preview service lands.";
		register(root, [{ file: "packages/game/src/play.ts", reason, rule: "imports/fences", subject: "game-keeps-out-of-cms" }]);
		expect(quality(formatTree(root), "lint")).toMatchObject({ status: 0, stdout: expect.stringContaining("quality: passed") });
		register(root, [
			{ file: "packages/game/src/play.ts", reason, rule: "imports/fences", subject: "game-keeps-out-of-cms" },
			{ file: "packages/game/src/run.ts", reason, rule: "imports/fences", subject: "game-keeps-out-of-cms" },
		]);
		const stale = quality(root, "lint");
		expect(stale.status).toBe(CLI_EXIT.rejected);
		expect(stale.stdout).toContain("packages/game/src/run.ts");
	});
});
