import { mkdirSync, symlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { repositoryStory } from "./repositoryStory.ts";

export function installedWorkspace(name: string, directory: string) {
	return repositoryStory.trait("repository", `node_modules/${name} links to the workspace package in ${directory}`, (engine) => {
		const link = join(engine.root, "node_modules", name);
		mkdirSync(dirname(link), { recursive: true });
		symlinkSync(join(engine.root, directory), link, "dir");
	});
}
