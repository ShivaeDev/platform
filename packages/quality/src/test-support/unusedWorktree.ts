import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { commitAll, git } from "./git.ts";
import { ruleStory } from "./ruleStory.ts";

export function unusedWorktree() {
	return ruleStory.trait(
		"repository",
		"a nested git worktree has its own valid TypeScript config below a checkout with broken extends",
		({ root }) => {
			git(root, "init", "--quiet");
			commitAll(root, "Base");
			const child = join(root, ".worktrees", "app");
			git(root, "worktree", "add", "--quiet", "-b", "app", child);
			writeFileSync(join(root, "tsconfig.json"), '{"extends":"./missing-parent.json"}');
			mkdirSync(join(child, "node_modules"), { recursive: true });
		},
	);
}
