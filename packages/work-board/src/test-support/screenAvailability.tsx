import { Deferred, Effect } from "effect";
import { act } from "react";
import { InternalServerError } from "@shivaedev/errors/taxonomy.ts";
import { routeQueryOptions } from "#client/react/routeQuery.ts";
import type { ScreenEngine } from "./screenEngine.ts";

export function requestAvailability(engine: ScreenEngine, files: readonly string[]) {
	return Effect.suspend(() => {
		engine.workspaceRequests += 1;
		const refresh = engine.heldAnswerRefresh;
		if (refresh && files.some((file) => file.startsWith("responses/response."))) {
			refresh.started = true;
			return Deferred.await(refresh.gate);
		}
		if (engine.indexFailed) {
			return Effect.fail(new InternalServerError({ message: "Internal server error" }));
		}
		if (!engine.indexGate) {
			return Effect.void;
		}
		engine.indexWaiting = true;
		return Deferred.await(engine.indexGate).pipe(
			Effect.ensuring(
				Effect.sync(() => {
					engine.indexWaiting = false;
				}),
			),
		);
	});
}

async function setConnection(engine: ScreenEngine, connection: "live" | "reconnecting") {
	if (!(engine.api && engine.view)) {
		throw new Error("The screen has no Board client");
	}
	const { api, view } = engine;
	const status = api.forms.updates.status;
	await act(() => view.registry.set(status, { ...view.registry.get(status), connection }));
}

export function availabilityActions(engine: ScreenEngine, tell: (line: string) => void) {
	return {
		dropLiveConnection: () => {
			tell("the Board's live connection drops and starts reconnecting");
			return setConnection(engine, "reconnecting");
		},
		failWorkspace: () => {
			tell("workspace replies become unavailable");
			engine.indexFailed = true;
		},
		holdRefreshAfterAnswer: () => {
			tell("workspace replies wait once an answer file is saved");
			engine.heldAnswerRefresh = { gate: Deferred.makeUnsafe<void>(), started: false };
		},
		holdWorkspace: () => {
			tell("workspace replies wait at the browser transport");
			engine.indexGate = Deferred.makeUnsafe<void>();
		},
		readWorkspaceRequests: () => {
			tell("the reader checks how many workspace requests ran");
			return engine.workspaceRequests;
		},
		reconnectLive: () => {
			tell("the Board's live connection comes back");
			return setConnection(engine, "live");
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
			engine.heldAnswerRefresh = undefined;
			await act(() => Promise.resolve().then(() => Effect.runSync(Deferred.succeed(refresh.gate, undefined))));
		},
		releaseWorkspace: async () => {
			tell("workspace replies resume");
			if (!engine.indexGate) {
				throw new Error("The workspace index is not held");
			}
			const gate = engine.indexGate;
			await act(() =>
				Promise.resolve().then(() => {
					Effect.runSync(Deferred.succeed(gate, undefined));
				}),
			);
			engine.indexGate = undefined;
		},
	};
}
