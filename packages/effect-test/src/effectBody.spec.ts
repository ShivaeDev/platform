import { expect } from "@effect/vitest";
import { Clock, Context, Effect, Layer } from "effect";
import { makeEffectIt } from "#vitest.ts";

class Token extends Context.Service<Token, string>()("@test/EffectBodyToken") {}
const { effectApp } = makeEffectIt({
	layer: Layer.succeed(Token, "from-layer"),
	makeHarness: () => Effect.map(Token, (token) => ({ token })),
});

effectApp("runs synchronous fixture assertions with the harness and test context", (harness, context) =>
	Effect.sync(() => {
		expect(harness.token).toBe("from-layer");
		expect(context.task.name).toContain("synchronous fixture assertions");
	}),
);

effectApp("supplies Layer services to an Effect-returning body", (harness) => Effect.map(Token, (token) => expect(token).toBe(harness.token)));

effectApp.each([{ count: 1 }, { count: 2 }])("passes the case $count and harness to an Effect-returning body", (item, harness) =>
	Effect.map(Token, (token) => {
		expect(token).toBe(harness.token);
		expect(item.count).toBeGreaterThan(0);
	}),
);

effectApp("closes resources acquired by an Effect-returning body", (_harness, context) => {
	let closed = false;
	context.onTestFinished(() => expect(closed).toBe(true));
	return Effect.acquireRelease(Effect.void, () =>
		Effect.sync(() => {
			closed = true;
		}),
	);
});

effectApp.fails("preserves typed failure and scope cleanup for an Effect-returning body", (_harness, context) => {
	let closed = false;
	context.onTestFinished(() => expect(closed).toBe(true));
	return Effect.acquireRelease(Effect.void, () =>
		Effect.sync(() => {
			closed = true;
		}),
	).pipe(Effect.andThen(Effect.fail("expected")));
});

effectApp("installs TestClock for an Effect-returning body", () => Effect.map(Clock.currentTimeMillis, (now) => expect(now).toBe(0)));

effectApp(
	"honors a live clock override for an Effect-returning body",
	() => Effect.map(Clock.currentTimeMillis, (now) => expect(now).toBeGreaterThan(1_000_000)),
	{ clock: "live" },
);
