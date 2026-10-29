import { Effect } from "effect";
import { expect } from "vitest";
import { eventually } from "#test/eventually.ts";
import { automaticResume, nativeOnly, resumeStory } from "#test/resumeStory.ts";

resumeStory.it("visible browser resume, visible reconnect and native resume each refresh a query; hidden events do not", [], function* (test) {
	const release = test.watch(1);
	yield* eventually(() => expect(test.reads(1)).toBe(1));
	expect(yield* test.loaded(1)).toMatchObject({ id: 1, title: "One" });
	test.fire("visibilitychange");
	yield* eventually(() => expect(test.reads(1)).toBe(2));
	test.fire("visibilitychange", "hidden");
	test.fire("online", "hidden");
	yield* Effect.sleep("20 millis");
	expect(test.reads(1)).toBe(2);
	test.fire("online");
	yield* eventually(() => expect(test.reads(1)).toBe(3));
	test.resume();
	yield* eventually(() => expect(test.reads(1)).toBe(4));
	expect(test.listeners()).toEqual([2, 1]);
	release();
	test.dispose();
	expect(test.listeners()).toEqual([0, 0]);
});

for (const source of ["native", "browser"] as const) {
	resumeStory.it(`automatic live reads reconcile on ${source} resume and reconnect after interruption`, [automaticResume(source)], function* (test) {
		const watched = [1, 2];
		for (const id of watched) {
			test.watch(id);
		}
		test.connect();
		yield* eventually(() => expect(test.status().connection).toBe("live"));
		expect(yield* test.loaded(1)).toMatchObject({ title: "One" });
		expect(yield* test.loaded(2)).toMatchObject({ title: "Two" });
		const initialSubscriptions = test.subscriptionCount() ?? 0;
		yield* test.externalRename(1, "Changed while away");
		yield* test.externalRename(2, "Also changed while away");
		if (source === "native") {
			test.resume();
		} else {
			test.windowEvent("visibilitychange");
		}
		yield* eventually(() => {
			expect(test.title(1)).toBe("Changed while away");
			expect(test.title(2)).toBe("Also changed while away");
		});
		yield* eventually(() => expect(test.subscriptionCount()).toBe(initialSubscriptions));
		expect(test.listeners()[1]).toBe(source === "native" ? 1 : 0);
		yield* test.disconnect();
		yield* eventually(() => expect(test.active()).toBe(0));
		yield* test.externalRename(1, "Changed while disconnected");
		if (source === "native") {
			test.resume();
		} else {
			test.windowEvent("online");
		}
		yield* eventually(() => expect(test.subscriptionCount()).toBe(initialSubscriptions + watched.length));
		yield* eventually(() => expect(test.status().connection).toBe("live"));
		yield* eventually(() => expect(test.title(1)).toBe("Changed while disconnected"));
		test.dispose();
		expect(test.listeners()).toEqual([0, 0]);
		yield* eventually(() => expect(test.active()).toBe(0));
	});
}

resumeStory.it("swr treats resume as a focus signal and only revalidates stale data", [nativeOnly()], function* (test) {
	test.watch(1, "fresh");
	test.watch(2, "stale");
	yield* eventually(() => expect([test.reads(1), test.reads(2)]).toEqual([1, 1]));
	expect(yield* test.loaded(1)).toMatchObject({ id: 1, title: "One" });
	expect(yield* test.loaded(2)).toMatchObject({ id: 2, title: "Two" });
	expect(test.listeners()).toEqual([0, 1]);
	test.resume();
	yield* eventually(() => expect([test.reads(1), test.reads(2)]).toEqual([1, 2]));
	test.dispose();
	expect(test.listeners()).toEqual([0, 0]);
});
