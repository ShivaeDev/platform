import { Predicate } from "effect";
import { type LiveBound, LiveConnection } from "@shivaedev/contract/automaticLive.ts";

function isLiveBound(value: unknown): value is LiveBound {
	return Predicate.hasProperty(value, LiveConnection);
}

export function liveBindings(client: unknown): readonly LiveBound[] {
	const values = typeof client === "object" && client !== null ? [client, ...Object.values(client)] : [client];
	return values.filter(isLiveBound);
}
