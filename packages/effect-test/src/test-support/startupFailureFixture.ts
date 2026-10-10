import { Context, Effect, Layer } from "effect";
import { expect, it } from "vitest";
import { makeEffectIt } from "#vitest.ts";

class Connection extends Context.Service<Connection, string>()("@test/Connection") {}

let releases = 0;
const { effectApp } = makeEffectIt({
	layer: Layer.effect(
		Connection,
		Effect.gen(function* () {
			yield* Effect.acquireRelease(Effect.succeed("connection"), () =>
				Effect.sync(() => {
					releases += 1;
				}),
			);
			return yield* Effect.fail(new Error("database connection refused during worker startup"));
		}),
	),
	makeHarness: () => Effect.void,
});

effectApp("cannot start the application", function* () {
	yield* Effect.sync(() => expect.unreachable("a failed worker Layer must not run the test body"));
});

it("releases the acquired connection before the next test", () => {
	expect(releases).toBe(1);
});
