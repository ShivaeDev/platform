import { Deferred, Effect, PlatformError } from "effect";
import { act } from "react";
import { routeQueryOptions } from "#client/react/routeQuery.ts";
import type { ScreenEngine } from "./screenEngine.ts";

export function indexAvailability(engine: ScreenEngine, files: readonly string[]) {
	return Effect.suspend(() => {
		engine.indexReads += 1;
		const refresh = engine.heldAnswerRefresh;
		if (refresh && files.some((file) => file.startsWith("responses/response."))) {
			refresh.started = true;
			return Deferred.await(refresh.gate);
		}
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
		answerRefreshStarted: () => engine.heldAnswerRefresh?.started ?? false,
		dropLiveConnection: async () => {
			tell("the Board's live connection drops and starts reconnecting");
			if (!(engine.api && engine.view)) {
				throw new Error("The screen has no Board client");
			}
			const { api, view } = engine;
			const status = api.forms.updates.status;
			await act(() => view.registry.set(status, { ...view.registry.get(status), connection: "reconnecting" }));
		},
		failWorkspace: () => {
			tell("workspace indexing becomes unavailable");
			engine.indexFailed = true;
		},
		holdRefreshAfterAnswer: () => {
			tell("workspace indexing waits once an answer file is saved");
			engine.heldAnswerRefresh = { gate: Deferred.makeUnsafe<void>(), started: false };
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
		releaseRefreshAfterAnswer: async () => {
			tell("the Board's refresh after the answer arrives");
			const refresh = engine.heldAnswerRefresh;
			if (!refresh) {
				throw new Error("No refresh after an answer is held");
			}
			delete engine.heldAnswerRefresh;
			await act(() => Promise.resolve().then(() => Effect.runSync(Deferred.succeed(refresh.gate, undefined))));
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
