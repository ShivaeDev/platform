import { afterAll, expect, vi } from "vitest";
import { isolatedMounts, notesScreen, testing } from "#test/testingStories.ts";

const originalError = console.error;
afterAll(() => {
	expect(console.error).toBe(originalError);
	expect(vi.isMockFunction(console.error)).toBe(false);
});
testing.it("eventually rethrows its last assertion after the three-second deadline", [], function* ({ deadlineFailure }) {
	const { elapsed, attempts, lastFailure, thrown } = yield* deadlineFailure();
	expect(elapsed).toBeGreaterThanOrEqual(3000);
	expect(attempts).toBeGreaterThan(1);
	expect(lastFailure).toBeInstanceOf(Error);
	expect(thrown).toBe(lastFailure);
});
testing.it("a rendered query refetches after a command through native RPC", [notesScreen()], function* ({ ready, click }) {
	yield* ready("");
	yield* click();
	yield* ready("Morning walk");
});
testing.it(
	"rerender shares a registry; mounts isolate and unmount disposes native resources",
	[isolatedMounts()],
	function* ({ mounts, relabel, closeFirst, closeSecond }) {
		const { first, second } = mounts();
		expect(first.registry).not.toBe(second.registry);
		expect(first.container.textContent).toBe("first:1");
		expect(second.container.textContent).toBe("second:2");
		yield* relabel();
		expect(first.container.textContent).toBe("updated:1");
		expect(mounts().acquired).toBe(2);
		yield* closeFirst();
		expect(first.container.isConnected).toBe(false);
		expect(first.container.childNodes).toHaveLength(0);
		expect(mounts().released).toBe(1);
		yield* closeFirst();
		expect(mounts().released).toBe(1);
		expect(second.container.textContent).toBe("second:2");
		yield* closeSecond();
		expect(mounts().released).toBe(2);
	},
);
testing.it.fails("console.error fails a story and the spy is restored afterwards", [], function* ({ act }) {
	yield* act("React logs a warning", () => vi.mocked(console.error)("Expected warning for the helper regression"));
});

testing.it("a failed scoped screen unmounts and disposes its registry", [], function* ({ failInScope }) {
	const { result, root, acquired, released } = yield* failInScope();
	expect(result._tag).toBe("Failure");
	expect(acquired).toBe(1);
	expect(released).toBe(1);
	expect(root.container.isConnected).toBe(false);
	expect(root.container.childNodes).toHaveLength(0);
	expect(root.registry.getNodes().size).toBe(0);
});
