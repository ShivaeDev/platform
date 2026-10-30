import { Cause, Config, Exit, Option } from "effect";
import type { RevokedSessions } from "#server/better-auth/revokeUnadmitted.ts";

export type SignInAnswer = "signed in" | "refused" | "unavailable" | `failed: ${string}`;
export type RequestAnswer = "ok" | "unauthorized" | "auth unavailable" | `failed: ${string}`;
export const signInRefusals = new Map<string | null, SignInAnswer>([
	["sign_in_refused", "refused"],
	["sign_in_unavailable", "unavailable"],
]);
export const requestFailures = new Map<string, RequestAnswer>([
	["AuthUnavailable", "auth unavailable"],
	["Unauthorized", "unauthorized"],
]);

export type Revocation = RevokedSessions | "stopped by a configuration error" | "stopped by a failed policy check" | `stopped: ${string}`;

export function revocationOf(exit: Exit.Exit<RevokedSessions, unknown>): Revocation {
	if (Exit.isSuccess(exit)) {
		return exit.value;
	}
	const error = Option.getOrUndefined(Cause.findErrorOption(exit.cause));
	if (Cause.isUnknownError(error)) {
		return "stopped by a failed policy check";
	}
	return error instanceof Config.ConfigError ? "stopped by a configuration error" : `stopped: ${Cause.pretty(exit.cause)}`;
}
