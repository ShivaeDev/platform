import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { repositoryStory } from "./repositoryStory.ts";

export function runtimeFolders(...folders: readonly string[]) {
	return repositoryStory.trait("repository", `the repository has the empty runtime folders ${folders.join(", ")}`, (engine) => {
		for (const folder of folders) {
			mkdirSync(join(engine.root, folder), { recursive: true });
		}
	});
}
