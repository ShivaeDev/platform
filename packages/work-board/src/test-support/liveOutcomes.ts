import { Effect } from "effect";

const PHRASES: Readonly<Record<string, string>> = {
	BadRequest: "bad request",
	Forbidden: "forbidden",
	InternalServerError: "internal server error",
	NotFound: "not found",
	ServiceUnavailable: "service unavailable",
};

const GENERIC = new Set(["Internal server error", "Forbidden", "An error has occurred"]);

export function rejection(error: unknown): string {
	if (error instanceof Error && error.name === "AbortError") {
		return `canceled: ${error.message}`;
	}
	const tag = typeof error === "object" && error !== null && "_tag" in error ? String(error._tag) : undefined;
	const phrase = tag === undefined ? undefined : PHRASES[tag];
	if (phrase === undefined) {
		return `unexpected failure: ${String(error)}`;
	}
	const message = typeof error === "object" && error !== null && "message" in error ? String(error.message) : "";
	return message === "" || GENERIC.has(message) ? phrase : `${phrase}: ${message}`;
}

export function answered<A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<"answered" | string, never, R> {
	return effect.pipe(
		Effect.as("answered"),
		Effect.catch((error) => Effect.succeed(rejection(error))),
	);
}

export function settled<A>(read: () => Promise<A>): Effect.Effect<A | string> {
	return Effect.promise(() => read().catch((error: unknown) => rejection(error)));
}

export function answeredPromise(read: () => Promise<unknown>): Effect.Effect<string> {
	return Effect.promise(() => read().then(() => "answered", rejection));
}
