import { expect } from "vitest";
import { queryWindowScreen } from "#test/queryWindowScreen.tsx";

queryWindowScreen.it("queries refetch on independent windows over one connection while the session remains the default", [], function* (test) {
	yield* test.open();
	yield* test.observe(() => expect(test.values()).toEqual(["0", "0", "0"]));
	yield* test.resync();
	test.fakeTime();
	const before = test.reads();
	yield* test.publish(1);
	yield* test.advance(50);
	yield* test.publish(2);
	yield* test.advance(50);
	expect(test.values()).toEqual(["2", "0", "0"]);
	expect(test.reads()).toEqual({ ...before, detail: before.detail + 1 });
	yield* test.advance(400);
	expect(test.values()).toEqual(["2", "0", "2"]);
	yield* test.advance(1500);
	expect(test.values()).toEqual(["2", "2", "2"]);
	expect(test.reads()).toEqual({ dashboard: before.dashboard + 1, detail: before.detail + 1, inherited: before.inherited + 1 });
	expect(test.subscriptions()).toMatchObject([
		{
			queries: [
				{ payload: { id: "detail" }, query: "get" },
				{ payload: { id: "dashboard" }, query: "get" },
				{ payload: { id: "inherited" }, query: "get" },
			],
		},
	]);
});

queryWindowScreen.it("changing a query window keeps its connection and cached reads and uses the new schedule", [], function* (test) {
	yield* test.open();
	yield* test.observe(() => expect(test.values()).toEqual(["0", "0", "0"]));
	yield* test.resync();
	test.fakeTime();
	const before = test.reads();
	yield* test.publish(1);
	yield* test.advance(50);
	yield* test.changeWindow();
	expect(test.values()).toEqual(["0", "0", "0"]);
	expect(test.reads()).toEqual(before);
	expect(test.subscriptions()).toMatchObject([
		{
			queries: [
				{ payload: { id: "detail" }, query: "get" },
				{ payload: { id: "dashboard" }, query: "get" },
				{ payload: { id: "inherited" }, query: "get" },
			],
		},
	]);
	yield* test.advance(50);
	expect(test.values()).toEqual(["1", "0", "0"]);
	yield* test.publish(2);
	yield* test.advance(100);
	expect(test.values()).toEqual(["1", "0", "0"]);
	yield* test.advance(200);
	expect(test.values()).toEqual(["2", "0", "0"]);
	yield* test.advance(100);
	expect(test.values()).toEqual(["2", "0", "2"]);
	yield* test.advance(1500);
	expect(test.values()).toEqual(["2", "2", "2"]);
	expect(test.reads()).toEqual({ dashboard: before.dashboard + 1, detail: before.detail + 2, inherited: before.inherited + 1 });
	expect(test.subscriptions()).toMatchObject([
		{
			queries: [
				{ payload: { id: "detail" }, query: "get" },
				{ payload: { id: "dashboard" }, query: "get" },
				{ payload: { id: "inherited" }, query: "get" },
			],
		},
	]);
});
