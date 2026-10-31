import { type Cause, Option } from "effect";
import type { LiveStatus } from "#live.ts";

export function queryFailure(started: () => boolean, publish: (cause: Cause.Cause<unknown>) => void) {
	return ({ connection, failure }: LiveStatus<unknown>) => {
		if (Option.isNone(failure)) {
			return;
		}
		if (!started() || connection === "failed") {
			publish(failure.value);
		}
	};
}
