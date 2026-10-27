import { Cause, Clock, Effect, Exit } from "effect";
import { afterAll, expect, vi } from "vitest";
import { withLive } from "@shivaedev/test/withLive.ts";
import { eventually } from "#client/testing.ts";
import { isolatedMounts, notesScreen, testing } from "#test/testingStories.ts";

const originalError = console.error;
afterAll(() => {
	expect(console.error).toBe(originalError);
	expect(vi.isMockFunction(console.error)).toBe(false);
});
testing.it(
	"eventually reports the last assertion and elapsed live time",
	[notesScreen()],
	function* ({ first }) {
		const { container } = first();
		const started = yield* withLive(Clock.currentTimeMillis);
		let attempts = 0;
		let lastFailure: unknown;
		const result = yield* Effect.exit(
			eventually(() => {
				attempts += 1;
				try {
					expect(`${container.querySelector("output")?.textContent} attempt ${attempts}`).toBe("ready");
				} catch (error) {
					lastFailure = error;
					throw error;
				}
			}),
		);
		const elapsed = (yield* withLive(Clock.currentTimeMillis)) - started;
		expect(elapsed).toBeGreaterThanOrEqual(3000);
		expect(attempts).toBeGreaterThan(1);
		expect(result._tag).toBe("Failure");
		const failure = Exit.isFailure(result) ? Cause.squash(result.cause) : undefined;
		expect(failure).toBeInstanceOf(Error);
		expect(failure).toHaveProperty("cause", lastFailure);
		expect(failure).toHaveProperty("message", expect.stringContaining(`attempt ${attempts}`));
		const reported = failure instanceof Error ? Number(/after (?<elapsed>\d+)ms/u.exec(failure.message)?.groups?.elapsed) : 0;
		expect(reported).toBeGreaterThanOrEqual(3000);
		expect(reported).toBeLessThanOrEqual(elapsed);
		expect(yield* Clock.currentTimeMillis).toBe(0);
	},
	{ clock: "test" },
);
testing.it(
	"yieldable assertions let RPC responses render without advancing the story clock",
	[notesScreen()],
	function* ({ first, click }) {
		const { container } = first();
		yield* eventually(() => {
			expect(container.querySelector("output")?.textContent).toBe("");
			expect(container.querySelector("button")?.disabled).toBe(false);
		});
		yield* click();
		yield* eventually(() => {
			expect(container.querySelector("output")?.textContent).toBe("Morning walk");
			expect(container.querySelector("button")?.disabled).toBe(false);
		});
		expect(yield* Clock.currentTimeMillis).toBe(0);
	},
	{ clock: "test" },
);
testing.it(
	"rerender shares a registry; mounts isolate and unmount disposes native resources",
	[isolatedMounts()],
	function* ({ first: firstMount, second: secondMount, resources, relabel, closeFirst, closeSecond }) {
		const first = firstMount();
		const second = secondMount();
		expect(first.registry).not.toBe(second.registry);
		expect(first.container.textContent).toBe("first:1");
		expect(second.container.textContent).toBe("second:2");
		yield* relabel();
		expect(first.container.textContent).toBe("updated:1");
		expect(resources().acquired).toBe(2);
		yield* closeFirst();
		expect(first.container.isConnected).toBe(false);
		expect(first.container.childNodes).toHaveLength(0);
		expect(resources().released).toBe(1);
		yield* closeFirst();
		expect(resources().released).toBe(1);
		expect(second.container.textContent).toBe("second:2");
		yield* closeSecond();
		expect(resources().released).toBe(2);
	},
);
testing.it.fails("console.error fails a story and the spy is restored afterwards", [], function* ({ warn }) {
	yield* warn();
});
