import { existsSync } from "node:fs";
import { join } from "node:path";
import { git } from "./git.ts";
import { repositoryStory } from "./repositoryStory.ts";

export function repositoryTracks(...paths: readonly string[]) {
	return repositoryStory.trait("history", `git tracks ${paths.join(", ")}, ignored or not, without a commit`, (engine) => {
		if (!existsSync(join(engine.root, ".git"))) {
			git(engine.root, "init", "--quiet");
		}
		git(engine.root, "add", "--force", ...paths);
	});
}
