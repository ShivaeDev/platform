import { Cause } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import { vi } from "vitest";
import type { BoardTestApi } from "./react.tsx";

export type QueryState = "failed" | "pending";
export interface HeldQueries {
	readonly fleetItems?: QueryState;
	readonly goals?: QueryState;
	readonly watcher?: QueryState;
}

function queryIn<A>(state: QueryState) {
	return Atom.make(state === "failed" ? AsyncResult.failure<A>(Cause.die("Query unavailable")) : AsyncResult.initial<A>());
}

export function holdQueries(api: BoardTestApi, queries: HeldQueries = {}) {
	if (queries.fleetItems) {
		vi.spyOn(api.fleetItems, "query").mockReturnValue(queryIn(queries.fleetItems));
	}
	if (queries.goals) {
		vi.spyOn(api.goals, "query").mockReturnValue(queryIn(queries.goals));
	}
	if (queries.watcher) {
		vi.spyOn(api.watcher, "query").mockReturnValue(queryIn(queries.watcher));
	}
}
