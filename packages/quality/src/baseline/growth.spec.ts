import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runQuality, trees } from "#test/cli.ts";
import { branchOff, commitAll, git } from "#test/git.ts";
import { qualityTree } from "#test/qualityTree.ts";
import { linkPackage, removeSeededTrees, seedTree } from "#test/tree.ts";

const cliTimeout = 60_000;

afterEach(removeSeededTrees);

async function baselined(): Promise<string> {
	const root = qualityTree(trees.dirty);
	await runQuality(root, "baseline", "write");
	return branchOff(root);
}

function baseline(root: string): string {
	return readFileSync(join(root, "quality/baseline.jsonl"), "utf8");
}

const HINT =
	"If the baseline should keep these findings, such as the debt of a moved or renamed file, record them again with `quality baseline write --rule structure/max-lines` and call out the baseline growth in the pull request description.";

describe("a baseline that grows", { timeout: cliTimeout }, () => {
	it("fails lint on a finding it does not cover, ending with the command that records the rule again", async () => {
		const root = await baselined();
		appendFileSync(join(root, "src/longer.ts"), "String(7);\n");
		const result = await runQuality(root, "lint");
		expect(result.status).toBe(1);
		expect(result.stdout.trimEnd().endsWith(HINT)).toBe(true);
	});

	it("passes lint once it is written again with more entries, which the diff then shows", async () => {
		const root = await baselined();
		writeFileSync(join(root, "src/new.ts"), "String(1);\nString(2);\nString(3);\nString(4);\nString(5);\n");
		expect((await runQuality(root, "lint")).status).toBe(1);
		expect((await runQuality(root, "baseline", "write", "--rule", "structure/max-lines")).status).toBe(0);
		expect((await runQuality(root, "lint")).status).toBe(0);
		expect(baseline(root)).toContain('{"path":"src/new.ts","rule":"structure/max-lines","count":2}');
	});

	it("keeps a renamed file's debt under its new path, with no entry left at the old one", async () => {
		const root = await baselined();
		git(root, "mv", "src/longer.ts", "src/renamed.ts");
		expect((await runQuality(root, "lint")).stdout).toContain(HINT);
		await runQuality(root, "baseline", "write", "--rule", "structure/max-lines");
		expect((await runQuality(root, "lint")).status).toBe(0);
		expect(baseline(root)).toContain('"path":"src/renamed.ts"');
		expect(baseline(root)).not.toContain('"path":"src/longer.ts"');
	});
});

async function shallowClone(): Promise<{ readonly clone: string; readonly origin: string }> {
	const origin = await baselined();
	for (const content of ["String(2);\n", "String(3);\n", "String(4);\n"]) {
		writeFileSync(join(origin, "src/short.ts"), content);
		commitAll(origin, "Work");
	}
	git(origin, "switch", "--quiet", "main");
	writeFileSync(join(origin, "src/main.ts"), "String(1);\n");
	commitAll(origin, "Main moves on");
	git(origin, "switch", "--quiet", "work");
	const clone = seedTree([]);
	git(clone, "clone", "--quiet", "--depth=2", "--no-single-branch", `file://${origin}`, ".");
	linkPackage(clone);
	return { clone, origin };
}

async function moved(): Promise<string> {
	const root = await baselined();
	git(root, "mv", "src/longer.ts", "src/a-longer.ts");
	commitAll(root, "Move");
	return root;
}

const CARRIED = "carried 1 entry to moved files";

describe("quality baseline prune finds the merge base it follows moves from", { timeout: cliTimeout }, () => {
	it.each([
		["origin/master when it is the only default branch", [["update-ref", "refs/remotes/origin/master", "main"]]],
		[
			"origin/main before origin/master",
			[
				["update-ref", "refs/remotes/origin/master", "work"],
				["update-ref", "refs/remotes/origin/main", "main"],
			],
		],
		[
			"origin/HEAD before origin/main",
			[
				["update-ref", "refs/remotes/origin/main", "work"],
				["update-ref", "refs/remotes/origin/trunk", "main"],
				["symbolic-ref", "refs/remotes/origin/HEAD", "refs/remotes/origin/trunk"],
			],
		],
	])("in %s", async (_, refs) => {
		const root = await moved();
		for (const args of refs) {
			git(root, ...args);
		}
		expect((await runQuality(root, "baseline", "prune")).stdout).toContain(CARRIED);
	});

	it("and prunes without following moves when no default branch exists", async () => {
		const result = await runQuality(await moved(), "baseline", "prune");
		expect(result).toMatchObject({ status: 0, stderr: expect.stringContaining("moved files are not followed: cannot find the default branch") });
	});

	it("and exits 2 when --against names no commit", async () => {
		const result = await runQuality(await moved(), "baseline", "prune", "--against", "origin/missing");
		expect(result).toMatchObject({ status: 2, stderr: expect.stringContaining("origin/missing names no commit") });
	});

	it("and exits 2 without fetching in a shallow clone that does not reach it", async () => {
		const { clone } = await shallowClone();
		const result = await runQuality(clone, "baseline", "prune", "--against", "origin/main");
		expect(result).toMatchObject({ status: 2, stderr: expect.stringContaining("the clone is shallow and does not reach the merge base") });
		expect(git(clone, "rev-parse", "--is-shallow-repository")).toBe("true\n");
	});

	it("and exits 2 when HEAD shares no history with the target", async () => {
		const root = await baselined();
		git(root, "checkout", "--quiet", "--orphan", "unrelated");
		commitAll(root, "Unrelated");
		const result = await runQuality(root, "baseline", "prune", "--against", "main");
		expect(result).toMatchObject({ status: 2, stderr: expect.stringContaining("HEAD and main share no history.") });
	});
});

describe("quality baseline migrate", { timeout: cliTimeout }, () => {
	it("moves a baseline in the earlier format to JSON Lines, after which lint passes", async () => {
		const legacy = { "src/long.ts": { count: 1, measure: 4 }, "src/longer.ts": { count: 1, measure: 7 }, "src/short.ts": { count: 1, measure: 5 } };
		const root = qualityTree(trees.dirty, [{ content: JSON.stringify({ "structure/max-lines": legacy }), path: "quality/baseline.json" }]);
		expect(await runQuality(root, "lint")).toMatchObject({ status: 2, stderr: expect.stringContaining("Run `quality baseline migrate`") });
		expect((await runQuality(root, "baseline", "migrate")).stdout).toBe(
			"quality: moved 2 entries from quality/baseline.json to quality/baseline.jsonl, dropping 1 fixed entry.\n",
		);
		expect(baseline(root)).toBe(
			['{"path":"src/long.ts","rule":"structure/max-lines","count":1}', '{"path":"src/longer.ts","rule":"structure/max-lines","count":4}', ""].join(
				"\n",
			),
		);
		expect((await runQuality(root, "lint")).status).toBe(0);
	});
});
