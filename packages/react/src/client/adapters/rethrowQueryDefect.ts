import { Cause, Result } from "effect";

export function rethrowQueryDefect(cause: Cause.Cause<unknown>): void {
	const defect = Cause.findDefect(cause);
	if (Result.isSuccess(defect)) {
		throw defect.success;
	}
}
