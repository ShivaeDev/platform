import { join } from "node:path";
import { application } from "./application.ts";
import { gitIn } from "./appReadouts.ts";

export function appStaged(path: string) {
	return application.trait("app", `the author stages ${path}`, (engine) => {
		const result = gitIn(join(engine.root, engine.app), ["add", "--", path]);
		if (result.status !== 0) {
			throw new Error(`git add ${path} failed: ${result.stderr}`);
		}
	});
}
