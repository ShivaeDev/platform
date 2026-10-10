import { expect } from "@effect/vitest";
import { Clock, Effect } from "effect";
import * as TestClock from "effect/testing/TestClock";
import { it } from "#it.ts";

const seen: string[] = [];

it.effect("runs a generator body under TestClock", function* ({ task }) {
	expect(task.name).toBe("runs a generator body under TestClock");
	expect(yield* Clock.currentTimeMillis).toBe(0);
	yield* TestClock.adjust("1 second");
	expect(yield* Clock.currentTimeMillis).toBe(1000);
});

it.live("runs a generator body on the live clock", function* () {
	expect(yield* Clock.currentTimeMillis).toBeGreaterThan(0);
});

it.effect("runs an effect body as it is", () => Effect.sync(() => expect(seen).toEqual([])));

it.effect.each(["first", "second"])("passes the table case %s to the body", function* (item) {
	seen.push(item);
	expect(yield* Effect.succeed(item)).toBe(item);
});

it.effect.fails("fails the test when the body fails", function* () {
	return yield* Effect.fail("expected");
});

it("keeps the plain Vitest test", () => {
	expect(seen).toEqual(["first", "second"]);
});
