import { Effect } from "effect";
import { expect } from "vitest";
import { Fleet } from "./Fleet.ts";
import { approve, effectApp, noChange, outcome, pullRequest, review, spec } from "./lifecycleFixtures.ts";
import { failure } from "./ports.ts";

effectApp("an externally merged PR cannot bypass scope and required-check evidence", function* (f) {
	yield* Effect.gen(function* () {
		const fleet = yield* Fleet;
		yield* approve([spec("alpha")]);
		yield* fleet.tick();
		yield* f.finish("attempt-1", outcome());
		yield* fleet.tick();
		yield* f.finish("attempt-2", review());
		yield* f.observePr({ ...pullRequest(), checks: [{ name: "test", status: "failed" }], state: "merged" });
		yield* fleet.tick();
		expect((yield* fleet.snapshot()).works[0]?.phase).toBe("held");
		expect((yield* fleet.snapshot()).works[0]?.validation).toBeNull();
		expect(f.merges).toHaveLength(0);
	}).pipe(Effect.provide(f.layer()));
});
effectApp("stale no-change verification continues the original worker for repair", function* (f) {
	yield* Effect.gen(function* () {
		const fleet = yield* Fleet;
		yield* approve([spec("alpha", "no-change")]);
		yield* fleet.tick();
		yield* f.finish("attempt-1", noChange);
		yield* fleet.tick();
		yield* f.finish("attempt-2", review());
		yield* fleet.tick();
		expect(f.launches.at(-1)?.attempt.role).toBe("worker");
		expect(f.launches.at(-1)?.attempt.ref?.sessionId).toBe("session-attempt-1");
		expect((yield* fleet.snapshot()).works[0]?.phase).not.toBe("completed");
	}).pipe(
		Effect.provide(f.layer(":memory:", "test", { verifyNoChange: () => Effect.fail(failure("Base advanced; integrate and revalidate", "repair")) })),
	);
});
