import { join } from "node:path";
import { boardStory, projectFiles } from "./boardStory.ts";

export function areaRepository(areas: readonly string[]) {
	return boardStory.traits(
		projectFiles({
			".git": "gitdir: synthetic",
			".github/workflows/check.yml": "name: check",
			".work/task.md": `---\nid: task\nkind: task\nareas: ${JSON.stringify(areas)}\n---\n# Work`,
			"examples/jobs/server/index.ts": "export {};",
			"packages/react/src/index.ts": "export {};",
			"packages/work-fleet/scheduling/index.ts": "export {};",
			"script/release/index.ts": "export {};",
		}),
		boardStory.trait("project", "the Board reads .work inside the repository", (engine) => {
			const repository = engine.notes;
			engine.notes = { ...repository, root: join(repository.root, ".work"), write: (file, source) => repository.write(join(".work", file), source) };
		}),
	);
}
