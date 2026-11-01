import { expect } from "vitest";
import { outcomes } from "#outcomes.ts";
import { pageRequests } from "#test/pageRequests.tsx";

pageRequests.it("an uncaught page action reaches the host's browser error route", [], function* ({ click, settle, reports }) {
	expect(yield* reports()).toEqual([]);

	yield* click({ name: "Crash", role: "button" });
	yield* settle();

	expect(yield* reports()).toMatchObject([
		{
			body: {
				kind: "error",
				message: "page action failed",
				stack: expect.stringContaining("page action failed"),
				url: expect.stringContaining("/notes/current"),
			},
			method: "POST",
			path: "/_platform/errors",
		},
	]);
});

for (const kind of ["relative", "URL", "Request"] as const) {
	pageRequests.it(
		`a ${kind} fetch after navigation reaches the host with its path, verb, headers and body`,
		[],
		function* ({ send, requests, navigate }) {
			yield* navigate();

			yield* send(kind);

			expect(yield* requests()).toEqual([{ body: "page payload", header: "page header", method: "POST", path: "/notes/echo?from=page" }]);
		},
	);
}

pageRequests.it(
	"settle waits until every page request has answered",
	[],
	function* ({ hold, start, startSettling, settling, settled, requestState }) {
		const first = yield* hold("first");
		const second = yield* hold("second");
		const firstRequest = yield* start("/first");
		yield* start("/second");
		yield* first.waiting;
		yield* second.waiting;
		yield* startSettling();
		expect(yield* settling()).toBe("waiting");

		yield* first.release;
		yield* firstRequest.finished;
		expect(yield* requestState()).toBe("requests pending");
		expect(yield* settling()).toBe("waiting");
		yield* second.release;

		expect(yield* settled()).toBe("succeeded");
	},
);

for (const ending of ["abort", "drop"] as const) {
	pageRequests.it(
		`a request that ends by ${ending} releases the screen wait`,
		[],
		function* ({ hold, start, startSettling, abort, drop, settled, settling }) {
			const held = yield* hold("first");
			const request = yield* start("/first");
			yield* held.waiting;
			yield* startSettling();
			expect(yield* settling()).toBe("waiting");

			if (ending === "abort") {
				yield* abort(request);
			} else {
				yield* drop("first");
			}

			expect(yield* settled()).toBe("succeeded");
		},
	);
}

pageRequests.it("closing the page restores fetch and location and rejects relative requests again", [], function* ({ close, restored, outsidePage }) {
	expect(yield* restored()).toEqual({ fetch: false, location: false });

	yield* close();

	yield* outcomes([
		["original globals", () => restored(), { fetch: true, location: true }],
		["relative request outside a page", () => outsidePage(), "relative URL rejected"],
	]);
});
