import { Effect, Result } from "effect";
import { expect } from "vitest";
import { Unauthorized } from "@shivaedev/platform/errors/taxonomy.ts";

export function rejectsWith(tag: "Conflict" | "Invalid" | "NotFound" | "Unauthorized" | "ServiceUnavailable", details: Record<string, unknown> = {}) {
	return Effect.fn("AppStory.rejectsWith")(function* <A, E, R>(call: Effect.Effect<A, E, R>) {
		const result = yield* call.pipe(Effect.result);
		expect(Result.isFailure(result)).toBe(true);
		if (Result.isFailure(result)) {
			expect(result.failure).toMatchObject({ _tag: tag, ...details });
			if (tag === "Unauthorized") {
				expect(result.failure).toBeInstanceOf(Unauthorized);
			}
		}
	});
}
