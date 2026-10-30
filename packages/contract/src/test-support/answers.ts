import { Cause, Effect, Exit, Option, Predicate } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import type { Key } from "@shivaedev/changes/keys.ts";
import type { LiveHint } from "#live.ts";

function field(error: object, name: string): string {
	return Predicate.hasProperty(error, name) ? String(error[name]) : "";
}

function tagged(error: unknown, words: string): string {
	return error instanceof Error ? words : `${words}, left as an undecoded object`;
}

export function refusal(error: unknown): string {
	if (!Predicate.hasProperty(error, "_tag")) {
		return `untagged failure ${String(error)}`;
	}
	switch (error._tag) {
		case "NoteMissing":
			return tagged(error, `note ${field(error, "id")} is missing`);
		case "Invalid":
			return tagged(error, `invalid ${field(error, "field")}: ${field(error, "message")}`);
		case "Denied":
			return tagged(error, "denied");
		case "Unavailable":
			return tagged(error, "unavailable");
		case "QueryReadDenied":
			return tagged(error, "read denied");
		case "MissingReadPolicy":
			return tagged(error, `missing read policy: ${field(error, "message")}`);
		case "Rejected":
			return tagged(error, "rejected");
		default:
			return `untranslated ${String(error._tag)}`;
	}
}

export function failure(cause: Cause.Cause<unknown>): string {
	const error = Cause.findErrorOption(cause);
	if (Option.isSome(error)) {
		return `failed with ${refusal(error.value)}`;
	}
	return Cause.hasInterruptsOnly(cause) ? "interrupted" : `died: ${Cause.pretty(cause)}`;
}

export function ending<A>(exit: Exit.Exit<A, unknown>, success: (value: A) => string = () => "completed"): string {
	return Exit.isSuccess(exit) ? success(exit.value) : failure(exit.cause);
}

export function answered<A, E, R>(effect: Effect.Effect<A, E, R>, success: (value: A) => string): Effect.Effect<string, never, R> {
	return Effect.map(Effect.exit(effect), (exit) => ending(exit, success));
}

export function streams(count: number, state: "open" | "opened"): string {
	switch (count) {
		case 0:
			return `no streams ${state}`;
		case 1:
			return `one stream ${state}`;
		default:
			return `${count} streams ${state}`;
	}
}

export function shown<A, TWords>(result: AsyncResult.AsyncResult<A, unknown>, words: (value: A) => TWords): TWords | string {
	if (AsyncResult.isSuccess(result)) {
		return words(result.value);
	}
	return AsyncResult.isFailure(result) ? failure(result.cause) : "still loading";
}

export function thrown(act: () => unknown): string {
	try {
		act();
		return "nothing thrown";
	} catch (error) {
		return error instanceof Error ? error.message : String(error);
	}
}

export function times(count: number): string {
	switch (count) {
		case 0:
			return "never";
		case 1:
			return "once";
		case 2:
			return "twice";
		default:
			return `${count} times`;
	}
}

function keyWords(key: Key): string {
	switch (key._tag) {
		case "Item":
			return `${key.collection} ${key.id}`;
		case "List":
			return `the ${key.collection} list`;
		case "Bucket":
			return `${key.collection} with ${key.field} ${key.value}`;
	}
}

export function hintWords(hint: LiveHint): string {
	return hint._tag === "Resync" ? "resync" : `changed ${hint.keys.map(keyWords).join(", ")}`;
}
