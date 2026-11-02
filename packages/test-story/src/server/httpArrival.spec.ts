import { expect } from "vitest";
import { outcomes } from "#outcomes.ts";
import { attempt } from "#test/attempt.ts";
import { httpArrivalApp } from "#test/httpArrivalApp.ts";

httpArrivalApp.it(
	"signals each held arrival independently to existing and later observers before any reply completes",
	[],
	function* ({ answer, completion, hold, progress, receipt, sends, watchedReceipt, watchesReceipt }) {
		const paused = yield* hold("item");
		yield* watchesReceipt("first observer", "/items/a%2Fb?value=first");
		yield* watchesReceipt("second observer", "/items/a%2Fb?value=first");

		for (const value of ["first", "second", "third"]) {
			const path = `/items/a%2Fb?value=${value}`;
			yield* sends(value, path);

			expect(yield* receipt(path)).toMatchObject({ method: "GET", params: { id: "a/b" }, path, status: "pending" });
			expect(yield* progress(value)).toBe("waiting for an answer");
		}
		yield* outcomes([
			["first observer", () => watchedReceipt("first observer"), { path: "/items/a%2Fb?value=first", status: "pending" }],
			["second observer", () => watchedReceipt("second observer"), { path: "/items/a%2Fb?value=first", status: "pending" }],
		]);
		expect(yield* attempt(completion("/items/a%2Fb?value=first", "30 millis"))).toContain(
			'Signal "completed /items/a%2Fb?value=first" never arrived:',
		);

		yield* paused.release;

		for (const value of ["first", "second", "third"]) {
			expect(yield* completion(`/items/a%2Fb?value=${value}`)).toMatchObject({ path: `/items/a%2Fb?value=${value}`, status: 200 });
			expect(yield* answer(value)).toBe(`HTTP 200 {"id":"a/b","title":"Original","value":"${value}"}`);
		}
	},
);

httpArrivalApp.it(
	"computes each held reply from its request and the upstream state at arrival, then sends it only on release",
	[],
	function* ({ answer, asks, changesTitle, hold, progress, receipt, sends }) {
		const paused = yield* hold("item");
		yield* changesTitle("First title");
		yield* sends("first", "/items/1?value=first");
		yield* receipt("/items/1?value=first");
		yield* changesTitle("Second title");
		yield* sends("second", "/items/2?value=second");
		yield* receipt("/items/2?value=second");

		yield* changesTitle("Third title");

		yield* outcomes([
			["first still held", () => progress("first"), "waiting for an answer"],
			["second still held", () => progress("second"), "waiting for an answer"],
		]);

		yield* paused.release;

		yield* outcomes([
			["first reply", () => answer("first"), 'HTTP 200 {"id":"1","title":"First title","value":"first"}'],
			["second reply", () => answer("second"), 'HTTP 200 {"id":"2","title":"Second title","value":"second"}'],
			["later reply", () => asks("/items/3?value=third"), 'HTTP 200 {"id":"3","title":"Third title","value":"third"}'],
		]);
	},
);

httpArrivalApp.it(
	"signals receipt and abandonment of a held request without signaling completion",
	[],
	function* ({ abandons, completion, hold, receipt, sends, waitsForAbandoned }) {
		yield* hold("item");
		yield* sends("client", "/items/1");
		expect(yield* receipt("/items/1")).toMatchObject({ path: "/items/1", status: "pending" });

		yield* abandons("client");

		expect(yield* waitsForAbandoned("/items/1")).toMatchObject({ path: "/items/1", status: "unanswered" });
		expect(yield* attempt(completion("/items/1", "30 millis"))).toContain('Signal "completed /items/1" never arrived:');
	},
);

httpArrivalApp.it("signals completion only after a stalled response body finishes", [], function* ({ answer, completion, sends, stall }) {
	const paused = yield* stall("item");
	yield* sends("client", "/items/1");
	yield* paused.waiting;
	expect(yield* attempt(completion("/items/1", "30 millis"))).toContain('Signal "completed /items/1" never arrived:');

	yield* paused.release;

	expect(yield* completion("/items/1")).toMatchObject({ path: "/items/1", status: 200 });
	expect(yield* answer("client")).toBe('HTTP 200 {"id":"1","title":"Original","value":null}');
});

for (const [path, headers, status] of [
	["/items/1", { authorization: "rejected" }, 401],
	["/missing", {}, 404],
	["/items/%ZZ", {}, 400],
] as const) {
	httpArrivalApp.it(`signals receipt and completion of an HTTP ${status} reply`, [], function* ({ asks, completion, receipt }) {
		yield* asks(path, { headers });

		expect(yield* receipt(path)).toMatchObject({ path });
		expect(yield* completion(path)).toMatchObject({ path, status });
	});
}
