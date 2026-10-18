import { Cause, Clock, Effect, Exit } from "effect";
import { afterAll, expect, vi } from "vitest";
import { isolatedMounts, notesScreen, testing } from "#test/testingStories.ts";

const originalError = console.error;
afterAll(() => {
	expect(console.error).toBe(originalError);
	expect(vi.isMockFunction(console.error)).toBe(false);
});
testing.it("eventually rethrows its last assertion after the three-second deadline", [], function* ({ observe }) {
	const started = yield* Clock.currentTimeMillis;
	let attempts = 0;
	let lastFailure: unknown;
	const result = yield* Effect.exit(
		observe("retry a failing assertion until the deadline", () => {
			attempts += 1;
			try {
				expect(attempts).toBe(0);
			} catch (error) {
				lastFailure = error;
				throw error;
			}
		}),
	);
	expect((yield* Clock.currentTimeMillis) - started).toBeGreaterThanOrEqual(3000);
	expect(attempts).toBeGreaterThan(1);
	expect(lastFailure).toBeInstanceOf(Error);
	expect(result._tag).toBe("Failure");
	expect(Exit.isFailure(result) ? Cause.squash(result.cause) : undefined).toBe(lastFailure);
});
testing.it("a rendered query refetches after a command through native RPC", [notesScreen()], function* ({ first, observe, click }) {
	const { container } = first();
	yield* observe("the initial query settles", () => {
		expect(container.querySelector("output")?.textContent).toBe("");
		expect(container.querySelector("button")?.disabled).toBe(false);
	});
	yield* click();
	yield* observe("the command refreshes the query", () => {
		expect(container.querySelector("output")?.textContent).toBe("Morning walk");
		expect(container.querySelector("button")?.disabled).toBe(false);
	});
});
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
