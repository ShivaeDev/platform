import { Deferred, Effect } from "effect";
import { expect } from "vitest";
import { waitFor } from "./live.ts";
import { rpcSearch } from "./nativeRpc.ts";
import type { BoardEngine } from "./storyEngine.ts";

export function readVerbs(engine: BoardEngine, tell: (line: string) => void) {
	function reads() {
		if (!engine.reads) {
			throw new Error("The story does not record workspace reads");
		}
		return engine.reads;
	}
	function started() {
		if (!engine.started) {
			throw new Error("The story's board has not started");
		}
		return engine.started;
	}
	return {
		releaseReads: () => {
			tell("the held workspace reads continue");
			const { gate } = reads();
			return gate ? Deferred.succeed(gate, undefined) : Effect.void;
		},
		search: (query: string) => {
			tell(`a client searches for "${query}"`);
			return rpcSearch(started(), query);
		},
		waitForReads: (files: readonly string[]) => {
			tell(`the board reads ${files.join(", ")}`);
			return Effect.promise(() => waitFor(() => expect(files.filter((file) => reads().files.includes(file))).toEqual(files)));
		},
	};
}
