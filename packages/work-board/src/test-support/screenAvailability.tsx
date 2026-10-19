import { Deferred, Effect, PlatformError } from "effect";
import { act } from "react";
import { routeQueryOptions } from "#client/react/routeQuery.ts";
import type { ScreenEngine } from "./screenEngine.ts";

export function indexAvailability(engine: ScreenEngine) {
	return Effect.suspend(() => {
		engine.indexReads += 1;
		if (engine.indexFailed) {
			return Effect.fail(
				PlatformError.systemError({ _tag: "Unknown", description: "Workspace unavailable", method: "readDirectory", module: "FileSystem" }),
			);
		}
		return engine.indexGate ? Deferred.await(engine.indexGate) : Effect.void;
	});
}

export function availabilityActions(engine: ScreenEngine, tell: (line: string) => void) {
	return {
		failWorkspace: () => {
			tell("workspace indexing becomes unavailable");
			engine.indexFailed = true;
		},
		holdWorkspace: () => {
			tell("workspace indexing waits");
			engine.indexGate = Deferred.makeUnsafe<void>();
		},
		readIndexReads: () => {
			tell("the reader checks how many workspace index reads ran");
			return engine.indexReads;
		},
		recoverWorkspace: () => {
			tell("the workspace becomes readable again");
			engine.indexFailed = false;
		},
		refreshToday: async () => {
			tell("the reader refreshes Today");
			if (!(engine.api && engine.view)) {
				throw new Error("The Board screen has not opened");
			}
			const { api, view } = engine;
			await act(() =>
				Promise.resolve().then(() => {
					view.registry.refresh(api.inbox.query(undefined, routeQueryOptions));
					view.registry.refresh(api.goals.query(undefined, routeQueryOptions));
				}),
			);
		},
		releaseWorkspace: async () => {
			tell("workspace indexing resumes");
			if (!engine.indexGate) {
				throw new Error("The workspace index is not held");
			}
			const gate = engine.indexGate;
			await act(() =>
				Promise.resolve().then(() => {
					Effect.runSync(Deferred.succeed(gate, undefined));
				}),
			);
			delete engine.indexGate;
		},
	};
}
