import { expect } from "vitest";
import { loaderWindowStory } from "#test/loaderWindowStory.tsx";

loaderWindowStory.it("a loader screen coalesces two quick hints into one refetch with its own window", [], function* (screen) {
	yield* screen.open(0, { coalesceWindow: "100 millis" });
	expect(screen.shown()).toBe("0");
	expect(screen.requests()).toEqual([0]);

	yield* screen.publish(1);
	yield* screen.publish(2);
	yield* screen.refetched();

	expect(screen.shown()).toBe("2");
	expect(screen.requests()).toEqual([0, 2]);
});

for (const options of [undefined, { coalesceWindow: 0 }]) {
	loaderWindowStory.it(
		options === undefined
			? "a loader screen without options keeps the session's immediate refetches"
			: "a loader screen can override coalescing with a zero window",
		[],
		function* (screen) {
			yield* screen.open(options === undefined ? 0 : "100 millis", options);
			expect(screen.shown()).toBe("0");

			yield* screen.publish(1);
			yield* screen.refetched();
			expect(screen.shown()).toBe("1");
			yield* screen.publish(2);
			yield* screen.refetched();

			expect(screen.shown()).toBe("2");
			expect(screen.requests()).toEqual([0, 1, 2]);
		},
	);
}

for (const removed of ["first", "second"]) {
	loaderWindowStory.it(`removing the ${removed} reader leaves the other reader's immediate live window intact`, [], function* (screen) {
		yield* screen.open("100 millis", { coalesceWindow: 0 });
		yield* screen.addReader("second", { coalesceWindow: 0 });
		expect(screen.shown()).toBe("00");

		yield* screen.removeReader(removed);
		yield* screen.publish(1);
		yield* screen.publish(2);
		yield* screen.refetched();

		expect(screen.shown()).toBe("2");
		expect(screen.requests()).toEqual([0, 1, 2]);
	});
}

loaderWindowStory.it("removing the latest reader restores the earlier reader's live coalescing window", [], function* (screen) {
	yield* screen.open(0, { coalesceWindow: "100 millis" });
	yield* screen.addReader("second", { coalesceWindow: 0 });
	expect(screen.shown()).toBe("00");

	yield* screen.removeReader("second");
	yield* screen.publish(1);
	yield* screen.publish(2);
	yield* screen.refetched();

	expect(screen.shown()).toBe("2");
	expect(screen.requests()).toEqual([0, 2]);
});

loaderWindowStory.it("clearing the only reader's live window returns to the session window", [], function* (screen) {
	yield* screen.open("100 millis", { coalesceWindow: 0 });
	expect(screen.shown()).toBe("0");

	yield* screen.changeReaderWindow("first", undefined);
	yield* screen.publish(1);
	yield* screen.publish(2);
	yield* screen.refetched();

	expect(screen.shown()).toBe("2");
	expect(screen.requests()).toEqual([0, 2]);
});
