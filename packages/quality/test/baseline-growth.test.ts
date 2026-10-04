import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { quality, trees } from "./support/cli.ts";
import { branchOff, commitAll, git } from "./support/git.ts";
import { removeSeededTrees, seedTree } from "./support/tree.ts";

const cliTimeout = 60_000;

afterEach(removeSeededTrees);

function baselined(): string {
	const root = seedTree(trees.dirty);
	quality(root, "baseline", "write");
	return branchOff(root);
}

function baseline(root: string): string {
	return readFileSync(join(root, "quality/baseline.jsonl"), "utf8");
}

const HINT =
	"If the baseline should keep these findings, such as the debt of a moved or renamed file, record them again with `quality baseline write --rule structure/max-lines` and call out the baseline growth in the pull request description.";

describe("a baseline that grows", { timeout: cliTimeout }, () => {
	it("fails lint on a finding it does not cover, ending with the command that records the rule again", () => {
		const root = baselined();
		appendFileSync(join(root, "src/longer.ts"), "7\n");
		const result = quality(root, "lint");
		expect(result.status).toBe(1);
		expect(result.stdout.trimEnd().endsWith(HINT)).toBe(true);
	});

	it("passes lint once it is written again with more entries, which the diff then shows", () => {
		const root = baselined();
		writeFileSync(join(root, "src/new.ts"), "1\n2\n3\n4\n5\n");
		expect(quality(root, "lint").status).toBe(1);
		expect(quality(root, "baseline", "write", "--rule", "structure/max-lines").status).toBe(0);
		expect(quality(root, "lint").status).toBe(0);
		expect(baseline(root)).toContain('{"path":"src/new.ts","rule":"structure/max-lines","count":2}');
	});

	it("keeps a renamed file's debt under its new path, with no entry left at the old one", () => {
		const root = baselined();
		git(root, "mv", "src/longer.ts", "src/renamed.ts");
		expect(quality(root, "lint").stdout).toContain(HINT);
		quality(root, "baseline", "write", "--rule", "structure/max-lines");
		expect(quality(root, "lint").status).toBe(0);
		expect(baseline(root)).toContain('"path":"src/renamed.ts"');
		expect(baseline(root)).not.toContain('"path":"src/longer.ts"');
	});
});

function shallowClone(): { readonly clone: string; readonly origin: string } {
	const origin = baselined();
	for (const content of ["2\n", "3\n", "4\n"]) {
		writeFileSync(join(origin, "src/short.ts"), content);
		commitAll(origin, "Work");
	}
	git(origin, "switch", "--quiet", "main");
	writeFileSync(join(origin, "src/main.ts"), "1\n");
	commitAll(origin, "Main moves on");
	git(origin, "switch", "--quiet", "work");
	const clone = seedTree([]);
	git(clone, "clone", "--quiet", "--depth=2", "--no-single-branch", `file://${origin}`, ".");
	return { clone, origin };
}

function moved(): string {
	const root = baselined();
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
	])("in %s", (_, refs) => {
		const root = moved();
		for (const args of refs) {
			git(root, ...args);
		}
		expect(quality(root, "baseline", "prune").stdout).toContain(CARRIED);
	});

	it("and prunes without following moves when no default branch exists", () => {
		const result = quality(moved(), "baseline", "prune");
		expect(result).toMatchObject({ status: 0, stderr: expect.stringContaining("moved files are not followed: cannot find the default branch") });
	});

	it("and exits 2 when --against names no commit", () => {
		const result = quality(moved(), "baseline", "prune", "--against", "origin/missing");
		expect(result).toMatchObject({ status: 2, stderr: expect.stringContaining("origin/missing names no commit") });
	});

	it("and exits 2 without fetching in a shallow clone that does not reach it", () => {
		const { clone } = shallowClone();
		const result = quality(clone, "baseline", "prune", "--against", "origin/main");
		expect(result).toMatchObject({ status: 2, stderr: expect.stringContaining("the clone is shallow and does not reach the merge base") });
		expect(git(clone, "rev-parse", "--is-shallow-repository")).toBe("true\n");
	});

	it("and exits 2 when HEAD shares no history with the target", () => {
		const root = baselined();
		git(root, "checkout", "--quiet", "--orphan", "unrelated");
		commitAll(root, "Unrelated");
		const result = quality(root, "baseline", "prune", "--against", "main");
		expect(result).toMatchObject({ status: 2, stderr: expect.stringContaining("HEAD and main share no history.") });
	});
});

describe("quality baseline migrate", { timeout: cliTimeout }, () => {
	it("moves a baseline in the earlier format to JSON Lines, after which lint passes", () => {
		const legacy = { "src/long.ts": { count: 1, measure: 4 }, "src/longer.ts": { count: 1, measure: 7 }, "src/short.ts": { count: 1, measure: 5 } };
		const root = seedTree(trees.dirty, [{ content: JSON.stringify({ "structure/max-lines": legacy }), path: "quality/baseline.json" }]);
		expect(quality(root, "lint")).toMatchObject({ status: 2, stderr: expect.stringContaining("Run `quality baseline migrate`") });
		expect(quality(root, "baseline", "migrate").stdout).toBe(
			"quality: moved 2 entries from quality/baseline.json to quality/baseline.jsonl, dropping 1 fixed entry.\n",
		);
		expect(baseline(root)).toBe(
			['{"path":"src/long.ts","rule":"structure/max-lines","count":1}', '{"path":"src/longer.ts","rule":"structure/max-lines","count":4}', ""].join(
				"\n",
			),
		);
		expect(quality(root, "lint").status).toBe(0);
	});
});
