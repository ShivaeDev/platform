import { Effect } from "effect";
import { FleetFailure } from "#policy.ts";
import { until } from "#test/cloudRestart.ts";

interface ResponseRecord {
	readonly responses?: readonly { readonly boardAcknowledged?: boolean | undefined; readonly responseId: string }[] | undefined;
}

export function responseApplied<E>(observe: Effect.Effect<ResponseRecord, E>, refresh: Effect.Effect<ResponseRecord, E>, responseId: string) {
	return until(() =>
		observe.pipe(
			Effect.catchIf(
				(error) => error instanceof FleetFailure && error.reason === "stale",
				() => refresh,
			),
			Effect.map(
				(record) => record.responses?.some((response) => response.responseId === responseId && response.boardAcknowledged === true) ?? false,
			),
		),
	);
}
