import { Deferred, Effect } from "effect";
export interface ResultEngine {
	calls: number;
	first: Deferred.Deferred<number, string>;
	gate: Deferred.Deferred<number, string>;
	input: number;
	interrupted: boolean;
	second: Deferred.Deferred<number, string>;
}
export function resultEngine(): ResultEngine {
	return {
		calls: 0,
		first: Effect.runSync(Deferred.make<number, string>()),
		gate: Effect.runSync(Deferred.make<number, string>()),
		input: 0,
		interrupted: false,
		second: Effect.runSync(Deferred.make<number, string>()),
	};
}
