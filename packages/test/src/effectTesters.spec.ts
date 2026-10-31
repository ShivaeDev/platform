import { Effect } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { it } from "#it.ts";
import { clockReading } from "#test/clockReading.ts";

const GENERATOR_STORY = "it.effect runs a generator body on the test clock from 0 ms with this test's Vitest context";

it.effect(GENERATOR_STORY, function* ({ task }) {
	yield* outcomes([
		["body's clock", () => clockReading, "the test clock at 0 ms"],
		["test the body was given", () => Effect.succeed(task.name), GENERATOR_STORY],
	]);
});

it.live("it.live runs its body on the live clock", function* () {
	expect(yield* clockReading).toBe("the live clock");
});

it.effect("it.effect runs an Effect-returning body on the test clock from 0 ms", () =>
	Effect.map(clockReading, (clock) => expect(clock).toBe("the test clock at 0 ms")),
);
