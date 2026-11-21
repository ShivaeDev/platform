import * as AsyncResult from "effect/reactivity/AsyncResult";
import type { LiveStatus } from "#live.ts";
import type { QuerySignals } from "#querySignals.ts";

export function recordCompletion<A, E>(current: QuerySignals, result: AsyncResult.AsyncResult<A, E>): QuerySignals {
	const pending = AsyncResult.isInitial(result) || result.waiting;
	return { ...current, completed: current.completed + (pending ? 0 : 1), pending };
}

export function recordSubscription(current: QuerySignals, status: LiveStatus<unknown>): QuerySignals {
	switch (status.connection) {
		case "live":
			return { ...current, subscription: "open" };
		case "failed":
			return { ...current, subscription: "refused" };
		case "connecting":
		case "reconnecting":
			return { ...current, subscription: "opening" };
	}
}
