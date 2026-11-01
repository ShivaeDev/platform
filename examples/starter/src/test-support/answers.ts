import { Effect, Predicate } from "effect";
import { errorWords } from "@shivaedev/test/answers.ts";

const REFUSALS: Readonly<Record<string, string>> = {
	Forbidden: "permission denied",
	LastRoleAssigner: "last owner",
	Unauthorized: "sign in required",
};

function refusalWords(error: unknown) {
	return Predicate.hasProperty(error, "_tag") && typeof error._tag === "string" ? (REFUSALS[error._tag] ?? errorWords(error)) : errorWords(error);
}

export function answer<A, E, R>(request: Effect.Effect<A, E, R>) {
	return Effect.match(request, { onFailure: refusalWords, onSuccess: (value): A | string => value });
}

function reasonedWords(error: unknown) {
	return Predicate.hasProperty(error, "message") && typeof error.message === "string" && error.message !== ""
		? `${refusalWords(error)}: ${error.message}`
		: refusalWords(error);
}

export function answerWithReason<A, E, R>(request: Effect.Effect<A, E, R>) {
	return Effect.match(request, { onFailure: reasonedWords, onSuccess: (value): A | string => value });
}

export function refusal<A, E, R>(request: Effect.Effect<A, E, R>) {
	return Effect.match(request, { onFailure: reasonedWords, onSuccess: () => "accepted" });
}

export function allowed<A, E, R>(request: Effect.Effect<A, E, R>) {
	return Effect.match(request, { onFailure: refusalWords, onSuccess: () => "allowed" });
}
