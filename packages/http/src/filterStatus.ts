import { Effect } from "effect";
import { HttpClient } from "effect/http";
import { checkStatus } from "#checkStatus.ts";
import type { RemoteStatusError } from "#errors.ts";

export function filterStatus<E, R>(client: HttpClient.HttpClient.With<E, R>): HttpClient.HttpClient.With<E | RemoteStatusError, R> {
	return HttpClient.transformResponse(client, Effect.flatMap(checkStatus));
}
