import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { consumerRepo, removeConsumerRepos, runCli } from "#test/cli.ts";

afterEach(removeConsumerRepos);

const VERSION: unknown = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;

it("check exits non-zero and asks for sync until sync copies the package's own skills", { timeout: 30_000 }, () => {
	const repo = consumerRepo(["pr-description"]);

	const before = runCli(repo, ["check"]);

	expect(before.status).toBe(1);
	expect(before.stderr).toContain("shivaedev-skills: The shared skills are out of sync:\n- .agents/skills/.shivaedev-skills.json is missing.\n");
	expect(before.stderr).toContain("Run `shivaedev-skills sync` and commit the result.");
	expect(runCli(repo, ["sync"])).toMatchObject({ status: 0, stdout: `Synced pr-description from @shivaedev/skills ${VERSION}.\n` });
	expect(readFileSync(join(repo, ".claude/skills/pr-description/SKILL.md"), "utf8")).toContain("name: pr-description");
	expect(runCli(repo, ["check"])).toMatchObject({ status: 0, stdout: `The shared skills match @shivaedev/skills ${VERSION}.\n` });
});
