import { Option } from "effect";
import type { LiveStatus } from "#live.ts";

export function aggregateLiveStatus(values: readonly LiveStatus<unknown>[]): LiveStatus<unknown> {
	let connection: LiveStatus<unknown>["connection"] = "live";
	if (values.some((value) => value.connection === "connecting")) {
		connection = "connecting";
	}
	if (values.some((value) => value.connection === "reconnecting")) {
		connection = "reconnecting";
	}
	return {
		connection,
		failure: values.find((value) => Option.isSome(value.failure))?.failure ?? Option.none(),
		needsResync: values.some((value) => value.needsResync),
		pending: values.reduce((sum, value) => sum + value.pending, 0),
	};
}
