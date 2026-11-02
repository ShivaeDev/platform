import { Clock } from "effect";
import { afterAll, expect, vi } from "vitest";
import { isolatedMounts, pendingResultScreen, testing } from "#test/reactRendering.ts";

const originalError = console.error;
afterAll(() => {
	expect(console.error).toBe(originalError);
	expect(vi.isMockFunction(console.error)).toBe(false);
});
testing.it(
	"screen settlement renders native atom results without advancing the story clock",
	[pendingResultScreen()],
	function* ({ shown, answer, settle }) {
		expect(shown()).toBe("");

		yield* answer("Morning walk");
		yield* settle();

		expect(shown()).toBe("Morning walk");
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
