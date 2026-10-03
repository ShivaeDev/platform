import { appendFileSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { quality, trees } from "./support/cli.ts";
import { branchOff, commitAll, git } from "./support/git.ts";
import { removeSeededTrees, seedTree } from "./support/tree.ts";

const cliTimeout = 60_000;

afterEach(removeSeededTrees);

const baselined = (): string => {
	const root = seedTree(trees.dirty);
	quality(root, "baseline", "write");
	return branchOff(root);
};

const baselinePath = (root: string): string => join(root, "quality/baseline.jsonl");

const check = (root: string) => quality(root, "baseline", "check", "--against", "main");

describe("quality baseline check", { timeout: cliTimeout }, () => {
	it("holds a baseline that only shrank, against the merge base", () => {
		const root = baselined();
		expect(check(root)).toMatchObject({
			status: 0,
			stdout: expect.stringMatching(/^quality: quality\/baseline\.jsonl holds against main \(merge base [0-9a-f]{12}\)\.\n$/),
		});
		writeFileSync(join(root, "src/long.ts"), "1\n");
		quality(root, "baseline", "prune");
		expect(check(root).status).toBe(0);
	});

	it("fails a hand edit that raises an entry to fit a grown file", () => {
		const root = baselined();
		appendFileSync(join(root, "src/longer.ts"), "7\n");
		writeFileSync(baselinePath(root), readFileSync(baselinePath(root), "utf8").replace('"count":3', '"count":4'));
		expect(quality(root, "lint").status).toBe(0);
		const result = check(root);
		expect(result.status).toBe(1);
		expect(result.stdout).toContain("structure/max-lines src/longer.ts rose to 4 from 3.");
		expect(result.stdout).toContain("quality: baseline check failed with 1 problem.");
	});

	it("fails a baseline deleted and written again over new debt", () => {
		const root = baselined();
		writeFileSync(join(root, "src/new.ts"), "1\n2\n3\n4\n5\n");
		rmSync(baselinePath(root));
		expect(quality(root, "baseline", "write").status).toBe(0);
		const result = check(root);
		expect(result.status).toBe(1);
		expect(result.stdout).toContain("structure/max-lines src/new.ts is new, at 2.");
	});

	it("never fails a branch for being behind, since it compares with the merge base", () => {
		const root = baselined();
		git(root, "switch", "--quiet", "main");
		writeFileSync(join(root, "src/longer.ts"), "1\n2\n3\n4\n5\n");
		quality(root, "baseline", "prune");
		commitAll(root, "Shrink on main");
		git(root, "switch", "--quiet", "work");
		expect(check(root).status).toBe(0);
	});

	it("lets a staged move carry its entry, but not its growth", () => {
		const root = baselined();
		git(root, "mv", "src/longer.ts", "src/moved.ts");
		expect(quality(root, "lint").status).toBe(1);
		expect(quality(root, "baseline", "tighten", "--staged").stdout).toBe(
			"quality: removed 0 entries, lowered 0 entries and carried 1 entry to moved files in quality/baseline.jsonl.\n",
		);
		expect(quality(root, "lint").status).toBe(0);
		expect(check(root)).toMatchObject({ status: 0, stdout: expect.stringContaining("; 1 entry followed moved files.") });

		appendFileSync(join(root, "src/moved.ts"), "7\n");
		expect(quality(root, "lint").status).toBe(1);
		writeFileSync(baselinePath(root), readFileSync(baselinePath(root), "utf8").replace('"count":3', '"count":4'));
		expect(check(root).stdout).toContain("structure/max-lines src/moved.ts rose to 4 from 3.");
	});

	it("admits a rule's first baseline only while adopt names it", () => {
		const root = baselined();
		writeFileSync(join(root, "src/short.ts"), "1; // TODO\n");
		expect(quality(root, "baseline", "write", "--rule", "comments/no-todo").status).toBe(0);
		expect(check(root).stdout).toContain("comments/no-todo is newly baselined in 1 file without being named under `adopt` in quality.config.ts.");
		const config = readFileSync(join(root, "quality.config.ts"), "utf8");
		writeFileSync(join(root, "quality.config.ts"), config.replace("export default {", 'export default { adopt: ["comments/no-todo"],'));
		expect(check(root)).toMatchObject({ status: 0, stdout: expect.stringContaining("; adopted comments/no-todo.") });

		writeFileSync(join(root, "src/short.ts"), "1;\n");
		quality(root, "baseline", "prune");
		expect(check(root).stdout).toContain("`adopt` in quality.config.ts names comments/no-todo, which has nothing baselined. Remove it.");
	});

	it("fails a limit change that re-records a rule's entries higher, which only an owner's merge lets through", () => {
		const root = baselined();
		const config = readFileSync(join(root, "quality.config.ts"), "utf8");
		writeFileSync(join(root, "quality.config.ts"), config.replace("source: 3", "source: 2"));
		expect(quality(root, "lint").status).toBe(1);
		expect(quality(root, "baseline", "write", "--rule", "structure/max-lines").stdout).toBe(
			"quality: recorded 2 entries in quality/baseline.jsonl, replacing 2 entries.\n",
		);
		expect(quality(root, "lint").status).toBe(0);
		const result = check(root);
		expect(result.status).toBe(1);
		expect(result.stdout).toContain("structure/max-lines src/long.ts rose to 2 from 1.");
		expect(result.stdout).toContain("structure/max-lines src/longer.ts rose to 4 from 3.");
	});

	it("compares a baseline migrated in this branch with the earlier format at the base", () => {
		const legacy = { "src/long.ts": { count: 1, measure: 4 }, "src/longer.ts": { count: 1, measure: 7 }, "src/short.ts": { count: 1, measure: 5 } };
		const root = seedTree(trees.dirty, [{ content: JSON.stringify({ "structure/max-lines": legacy }), path: "quality/baseline.json" }]);
		branchOff(root);
		expect(quality(root, "lint")).toMatchObject({ status: 2, stderr: expect.stringContaining("Run `quality baseline migrate`") });
		expect(quality(root, "baseline", "migrate").stdout).toBe(
			"quality: moved 2 entries from quality/baseline.json to quality/baseline.jsonl, dropping 1 fixed entry.\n",
		);
		expect(readFileSync(baselinePath(root), "utf8")).toBe(
			['{"path":"src/long.ts","rule":"structure/max-lines","count":1}', '{"path":"src/longer.ts","rule":"structure/max-lines","count":4}', ""].join(
				"\n",
			),
		);
		expect(quality(root, "lint").status).toBe(0);
		git(root, "add", "--all");
		expect(check(root).status).toBe(0);
		writeFileSync(baselinePath(root), readFileSync(baselinePath(root), "utf8").replace('"count":4', '"count":5'));
		expect(check(root).stdout).toContain("structure/max-lines src/longer.ts rose to 5 from 4.");
	});
});

describe("quality baseline check finds its base", { timeout: cliTimeout }, () => {
	it("in origin/HEAD, then origin/main, then origin/master", () => {
		const root = baselined();
		git(root, "update-ref", "refs/remotes/origin/master", "main");
		expect(quality(root, "baseline", "check").stdout).toContain("holds against origin/master");
		git(root, "update-ref", "refs/remotes/origin/main", "main");
		expect(quality(root, "baseline", "check").stdout).toContain("holds against origin/main");
		git(root, "update-ref", "refs/remotes/origin/trunk", "main");
		git(root, "symbolic-ref", "refs/remotes/origin/HEAD", "refs/remotes/origin/trunk");
		expect(quality(root, "baseline", "check").stdout).toContain("holds against origin/trunk");
	});

	it.each([
		["without a default branch", [], "cannot find the default branch"],
		["with a ref that names no commit", ["--against", "origin/missing"], "origin/missing names no commit"],
	])("and exits 2 %s", (_, args, message) => {
		const result = quality(baselined(), "baseline", "check", ...args);
		expect(result).toMatchObject({ status: 2, stderr: expect.stringContaining(message) });
	});

	it("and exits 2 in a shallow clone that does not reach the merge base", () => {
		const origin = baselined();
		writeFileSync(join(origin, "src/short.ts"), "2\n");
		commitAll(origin, "Work");
		const clone = seedTree([]);
		git(clone, "clone", "--quiet", "--depth=1", "--no-single-branch", `file://${origin}`, ".");
		const result = quality(clone, "baseline", "check", "--against", "origin/main");
		expect(result).toMatchObject({ status: 2, stderr: expect.stringContaining("the clone is shallow") });
		expect(result.stderr).toContain("fetch-depth: 0");
	});

	it("and exits 2 outside a git work tree", () => {
		const result = quality(seedTree(trees.dirty), "baseline", "check");
		expect(result).toMatchObject({ status: 2, stderr: expect.stringContaining("is not in a git work tree") });
	});
});
