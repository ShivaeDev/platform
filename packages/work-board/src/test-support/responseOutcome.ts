import { Effect } from "effect";
import {
	BadRequest,
	Conflict,
	Forbidden,
	InternalServerError,
	NotFound,
	PreconditionFailed,
	ServiceUnavailable,
} from "@shivaedev/errors/taxonomy.ts";
import { PublicationUncertain, Unanswered } from "#rpc/rejections.ts";

const refusals = [
	[BadRequest, "bad request"],
	[Conflict, "conflict"],
	[Forbidden, "forbidden"],
	[InternalServerError, "internal error"],
	[NotFound, "not found"],
	[PreconditionFailed, "precondition failed"],
	[PublicationUncertain, "publication uncertain"],
	[ServiceUnavailable, "unavailable"],
	[Unanswered, "unanswered"],
] as const;

export function refusal(error: unknown) {
	for (const [type, phrase] of refusals) {
		if (error instanceof type) {
			return `${phrase}: ${error.message}`;
		}
	}
	return `unexpected failure: ${error instanceof Error ? error.message : String(error)}`;
}

export function settledCall<A>(call: () => Promise<A>): Effect.Effect<A | string> {
	return Effect.promise(() => call().then((value) => value, refusal));
}

export function settledEffect<A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A | string, never, R> {
	return Effect.match(effect, { onFailure: refusal, onSuccess: (value): A | string => value });
}
