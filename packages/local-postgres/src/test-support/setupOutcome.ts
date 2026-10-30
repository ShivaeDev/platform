import { Effect } from "effect";
import { PostgresSettingError } from "#localConnections.ts";
import { PostgresVersionMismatch } from "#PostgresVersionMismatch.ts";

function messageOf(error: unknown) {
	return (error instanceof Error ? error.message : String(error)).trim();
}

function described(error: unknown) {
	if (error instanceof PostgresVersionMismatch && error._tag === "PostgresVersionMismatch") {
		return `version mismatch: expected ${error.expectedVersion}, observed ${error.observedVersion ?? "none"}`;
	}
	if (error instanceof PostgresSettingError && error._tag === "PostgresSettingError") {
		return `${error.setting} refused in ${error.container}: ${messageOf(error.cause)}`;
	}
	return `failed: ${messageOf(error)}`;
}

export interface Attempt {
	readonly failure: unknown;
	readonly outcome: string;
}

export function attempt(run: () => string): Attempt {
	try {
		return { failure: undefined, outcome: run() };
	} catch (failure) {
		return { failure, outcome: described(failure) };
	}
}

export function recorded(outcome: string | undefined) {
	return outcome === undefined ? Effect.die(new Error("Run a setup action before reading its outcome")) : Effect.succeed(outcome);
}
