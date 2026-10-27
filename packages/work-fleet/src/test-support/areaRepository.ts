import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { engine } from "#test/engineStory.ts";

export const areaRepository = engine.trait("work", "the Board is inside a repository with package and tooling folders", (state) => {
	for (const directory of [".git", "packages/react", "packages/work-fleet/src/scheduling", "examples/jobs/src/server", "script/release", ".github"]) {
		mkdirSync(join(state.root, directory), { recursive: true });
	}
	writeFileSync(join(state.root, ".git/HEAD"), "ref: refs/heads/main\n");
});

export function areaBrief(areas: readonly string[]) {
	return `---\nid: one\nkind: task\nfleet: approved\nareas: ${JSON.stringify(areas)}\n---\n# Scoped work\n`;
}
