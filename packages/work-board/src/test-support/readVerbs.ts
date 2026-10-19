import { Deferred, Effect } from "effect";
import type { BoardEngine } from "./storyEngine.ts";

export function readVerbs(engine: BoardEngine, tell: (line: string) => void) {
	function reads() {
		if (!engine.reads) {
			throw new Error("The story does not record workspace reads");
		}
		return engine.reads;
	}
	return {
		readFiles: () => {
			tell("the reader inspects the workspace paths read by the board");
			return [...reads().files];
		},
		releaseReads: () => {
			tell("the held workspace reads continue");
			const { gate } = reads();
			return gate ? Deferred.succeed(gate, undefined) : Effect.void;
		},
	};
}
