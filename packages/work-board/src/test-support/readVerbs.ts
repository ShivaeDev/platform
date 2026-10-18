import { Deferred, Effect } from "effect";
import { expect } from "vitest";
import { waitFor } from "./live.ts";
import type { BoardEngine } from "./storyEngine.ts";

export function readVerbs(engine: BoardEngine, tell: (line: string) => void) {
	function reads() {
		if (!engine.reads) {
			throw new Error("The story does not record workspace reads");
		}
		return engine.reads;
	}
	return {
		releaseReads: () => {
			tell("the held workspace reads continue");
			const { gate } = reads();
			return gate ? Deferred.succeed(gate, undefined) : Effect.void;
		},
		waitForReads: (files: readonly string[]) => {
			tell(`the board reads ${files.join(", ")}`);
			return Effect.promise(() => waitFor(() => expect(files.filter((file) => reads().files.includes(file))).toEqual(files)));
		},
	};
}
