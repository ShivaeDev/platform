import { BackendUnavailable, Rejected } from "@shivaedev/agent/failures.ts";

function message(cause: unknown): string {
	return cause instanceof Error ? cause.message : String(cause);
}
export function unavailable(cause: unknown) {
	return new BackendUnavailable({ backend: "pi", message: message(cause) });
}
export function rejected(cause: unknown) {
	return new Rejected({ backend: "pi", message: message(cause) });
}
