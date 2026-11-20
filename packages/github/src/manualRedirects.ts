import { Effect } from "effect";
import { FetchHttpClient } from "effect/http";

export function manualRedirects<A, E, R>(request: Effect.Effect<A, E, R>) {
	return request.pipe(Effect.provideService(FetchHttpClient.RequestInit, { credentials: "omit", redirect: "manual" }));
}
