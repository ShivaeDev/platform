import { Cause, Option, Predicate } from "effect";
import type { LiveStatus } from "#live.ts";

export function queryFailure(started: () => boolean, publish: (cause: Cause.Cause<unknown>) => void, recheck: () => void) {
	let rechecked: Cause.Cause<unknown> | undefined;
	return ({ failure }: LiveStatus<unknown>) => {
		if (Option.isNone(failure)) {
			return;
		}
		if (!started()) {
			publish(failure.value);
		} else if (
			failure.value !== rechecked
			&& Option.exists(Cause.findErrorOption(failure.value), (error) => Predicate.isTagged(error, "QueryReadDenied"))
		) {
			rechecked = failure.value;
			recheck();
		}
	};
}
