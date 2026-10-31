import { boardStory } from "./boardStory.ts";
import { failedSentinelWrite } from "./fileWatchingTraits.ts";
import { wrapFilesystem } from "./storyEngine.ts";

export function unwritableRoot(code: string) {
	return boardStory.trait("project", `the board cannot write its root's sentinel: ${code}`, (engine) => {
		wrapFilesystem(engine, failedSentinelWrite(code));
	});
}
