import { Effect } from "effect";
import { PostgresSettingError } from "#localConnections.ts";
import { PostgresVersionMismatch } from "#PostgresVersionMismatch.ts";

function messageOf(error: unknown) {
	return (error instanceof Error ? error.message : String(error)).trim();
}

function described(error: unknown) {
	if (error instanceof PostgresVersionMismatch) {
		return `version mismatch: expected ${error.expectedVersion}, observed ${error.observedVersion}`;
	}
	if (error instanceof PostgresSettingError) {
		return `${error.setting} refused in ${error.container}: ${messageOf(error.cause)}`;
	}
	return `failed: ${messageOf(error)}`;
}

export function attempt<E, R>(run: Effect.Effect<string, E, R>) {
	return Effect.match(run, {
		onFailure: (failure) => ({ failure, outcome: described(failure) }),
		onSuccess: (outcome) => ({ failure: undefined, outcome }),
	});
}

export function recorded(outcome: string | undefined) {
	return outcome === undefined ? Effect.die(new Error("Run a setup action before reading its outcome")) : Effect.succeed(outcome);
}
