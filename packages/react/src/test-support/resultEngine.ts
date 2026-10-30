import { Deferred, Effect } from "effect";

export interface Dispatch {
	readonly answer: Deferred.Deferred<number, string>;
	outcome: "running" | "answered" | "interrupted";
}

export interface ResultEngine {
	calls: number;
	readonly dispatches: Dispatch[];
	gate: Deferred.Deferred<number, string>;
}
export function resultEngine(): ResultEngine {
	return { calls: 0, dispatches: [], gate: Effect.runSync(Deferred.make<number, string>()) };
}
