import { Cause, Exit, Option } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import { expect } from "vitest";
import { queries, queryScreen } from "#test/queryStories.ts";
import type { Unavailable } from "#test/queryView.ts";

queries.it(
	"same-identity refreshes retain data even when native results drop their previous success",
	[queryScreen({}, "Last success")],
	function* ({ query, setNativeResult }) {
		const { view, native } = query();
		yield* setNativeResult(AsyncResult.initial(true));
		if (!native) {
			throw new Error("Expected a native query");
		}
		expect(Option.isNone(AsyncResult.value(view.registry.get(native)))).toBe(true);
		expect(view.snapshot()).toEqual({ data: "Last success", failure: null, pending: true, refreshing: true });

		const failure: Unavailable = { _tag: "Unavailable", message: "Offline" };
		yield* setNativeResult(AsyncResult.failure(Cause.fail(failure)));
		expect(view.snapshot()).toEqual({ data: "Last success", failure, pending: false, refreshing: false });
	},
);

queries.it(
	"live invalidation retains the rendered value and interrupts the superseded refresh",
	[queryScreen()],
	function* ({ query, finish, invalidate }) {
		const { view, requests } = query();
		expect(view.snapshot()).toEqual({ data: null, failure: null, pending: true, refreshing: false });
		yield* finish(requests.gate(), Exit.succeed("Last success"));
		const superseded = requests.next();
		yield* invalidate();
		expect(view.snapshot()).toEqual({ data: "Last success", failure: null, pending: true, refreshing: true });
		const latest = requests.next();
		yield* invalidate();
		expect(requests.interrupted).toEqual(["first"]);
		expect(view.snapshot()).toEqual({ data: "Last success", failure: null, pending: true, refreshing: true });
		yield* finish(latest, Exit.succeed("Fresh value"));
		yield* finish(superseded, Exit.succeed("Stale value"));
		expect(view.snapshot()).toEqual({ data: "Fresh value", failure: null, pending: false, refreshing: false });
	},
);

queries.it("a failed manual refresh keeps the rendered success next to its typed failure", [queryScreen()], function* ({ query, finish, refresh }) {
	const { view, requests } = query();
	yield* finish(requests.gate(), Exit.succeed("Last success"));
	const gate = requests.next();
	yield* refresh();
	expect(view.snapshot()).toEqual({ data: "Last success", failure: null, pending: true, refreshing: true });
	const failure = { _tag: "Unavailable", message: "Offline" } as const;
	yield* finish(gate, Exit.fail(failure));
	expect(view.snapshot()).toEqual({ data: "Last success", failure, pending: false, refreshing: false });
	const retry = requests.next();
	yield* refresh();
	expect(view.snapshot().data).toBe("Last success");
	expect(view.snapshot().refreshing).toBe(true);
	yield* finish(retry, Exit.succeed("Recovered"));
	expect(view.snapshot()).toEqual({ data: "Recovered", failure: null, pending: false, refreshing: false });
});
