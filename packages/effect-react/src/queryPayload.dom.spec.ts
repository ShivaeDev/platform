import { Exit } from "effect";
import { expect } from "vitest";
import { queries, queryScreen } from "#test/queryStories.ts";

queries.it(
	"an opted-in payload change retains the last success through failure and a superseding request",
	[queryScreen({ keepPreviousData: true })],
	function* ({ query, finish, payload, refresh, observe }) {
		const { view, requests } = query();
		yield* finish(requests.gate(), Exit.succeed("First payload"));
		const failed = requests.next();
		yield* payload("second");
		expect(view.snapshot()).toEqual({ data: "First payload", failure: null, pending: true, refreshing: true });
		const failure = { _tag: "Unavailable", message: "New payload unavailable" } as const;
		yield* finish(failed, Exit.fail(failure));
		expect(view.snapshot()).toEqual({ data: "First payload", failure, pending: false, refreshing: false });
		const superseded = requests.next();
		yield* refresh();
		const latest = requests.next();
		yield* payload("third");
		expect(view.snapshot()).toEqual({ data: "First payload", failure: null, pending: true, refreshing: true });
		yield* observe("the superseded request is interrupted", () => expect(requests.interrupted).toEqual(["second"]));
		yield* finish(latest, Exit.succeed("Third payload"));
		yield* finish(superseded, Exit.succeed("Stale payload"));
		expect(view.snapshot()).toEqual({ data: "Third payload", failure: null, pending: false, refreshing: false });
	},
);

for (const keepPreviousData of [undefined, false]) {
	queries.it(
		`payload changes reset by default or with keepPreviousData ${keepPreviousData}`,
		[queryScreen(keepPreviousData === undefined ? {} : { keepPreviousData })],
		function* ({ query, finish, payload }) {
			const { view, requests } = query();
			yield* finish(requests.gate(), Exit.succeed("First payload"));
			const gate = requests.next();
			yield* payload("second");
			expect(view.snapshot()).toEqual({ data: null, failure: null, pending: true, refreshing: false });
			yield* finish(gate, Exit.fail({ _tag: "Unavailable", message: "Offline" }));
			expect(view.snapshot().data).toBeNull();
		},
	);
}

queries.it(
	"an opted-in query clears retained data when its registry changes",
	[queryScreen({ keepPreviousData: true })],
	function* ({ query, finish, replaceOwner }) {
		const { view, requests } = query();
		yield* finish(requests.gate(), Exit.succeed("Previous owner"));
		requests.next();
		yield* replaceOwner();
		expect(view.snapshot()).toEqual({ data: null, failure: null, pending: true, refreshing: false });
	},
);

queries.it(
	"turning off retention drops an inherited value but keeps the current query's next success",
	[queryScreen({ keepPreviousData: true })],
	function* ({ query, finish, payload, refresh }) {
		const { view, requests } = query();
		yield* finish(requests.gate(), Exit.succeed("First payload"));
		const gate = requests.next();
		yield* payload("second");
		expect(view.snapshot().data).toBe("First payload");
		yield* payload("second", { keepPreviousData: false });
		expect(view.snapshot()).toEqual({ data: null, failure: null, pending: true, refreshing: false });
		yield* finish(gate, Exit.succeed("Second payload"));
		requests.next();
		yield* refresh();
		expect(view.snapshot()).toEqual({ data: "Second payload", failure: null, pending: true, refreshing: true });
	},
);
