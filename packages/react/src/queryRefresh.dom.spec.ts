import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import {
	invalidatedOnce,
	invalidatedTwice,
	nativeQueryAnswered,
	nativeQueryRefreshing,
	queries,
	queryAnswered,
	refreshFailed,
	retryingAfterFailedRefresh,
} from "#test/queryStories.ts";

queries.it(
	"a native refresh that drops its previous answer still shows the last answer while it loads",
	[nativeQueryAnswered("Last success")],
	function* ({ nativeAnswer, nativeRefreshDropsAnswer, shown }) {
		yield* nativeRefreshDropsAnswer();

		yield* outcomes({
			"native answer": [nativeAnswer(), "none"],
			shown: [shown(), { data: "Last success", failure: "none", status: "refreshing" }],
		});
	},
);

queries.it(
	"a native refresh that fails after dropping its answer shows the failure beside the last answer",
	[nativeQueryRefreshing("Last success")],
	function* ({ nativeFails, shown }) {
		yield* nativeFails("Offline");

		expect(yield* shown()).toEqual({ data: "Last success", failure: "Unavailable: Offline", status: "settled" });
	},
);

queries.it("an invalidation keeps showing the last answer while it re-reads", [queryAnswered("Last success")], function* ({ invalidate, shown }) {
	yield* invalidate("first invalidation");

	expect(yield* shown()).toEqual({ data: "Last success", failure: "none", status: "refreshing" });
});

queries.it(
	"a second invalidation interrupts the first one's re-read and keeps the last answer on screen",
	[invalidatedOnce()],
	function* ({ interruptedReads, invalidate, shown }) {
		expect(yield* interruptedReads()).toEqual([]);

		yield* invalidate("second invalidation");

		yield* outcomes({
			"interrupted reads": [interruptedReads(), ["first"]],
			shown: [shown(), { data: "Last success", failure: "none", status: "refreshing" }],
		});
	},
);

queries.it("a superseded re-read that answers after the newest one does not replace its answer", [invalidatedTwice()], function* ({ answer, shown }) {
	yield* answer("second invalidation", "Fresh value");
	yield* answer("first invalidation", "Stale value");

	expect(yield* shown()).toEqual({ data: "Fresh value", failure: "none", status: "settled" });
});

queries.it("a refresh keeps showing the last answer while it re-reads", [queryAnswered("Last success")], function* ({ refresh, shown }) {
	yield* refresh();

	expect(yield* shown()).toEqual({ data: "Last success", failure: "none", status: "refreshing" });
});

queries.it("a failed refresh shows its failure beside the last answer", [queryAnswered("Last success")], function* ({ fail, refresh, shown }) {
	yield* refresh();

	yield* fail("refresh", "Offline");

	expect(yield* shown()).toEqual({ data: "Last success", failure: "Unavailable: Offline", status: "settled" });
});

queries.it("retrying after a failed refresh keeps the last answer while it re-reads", [refreshFailed()], function* ({ refresh, shown }) {
	yield* refresh("retry");

	expect(yield* shown()).toMatchObject({ data: "Last success", status: "refreshing" });
});

queries.it("a retry that answers replaces the failure with its answer", [retryingAfterFailedRefresh()], function* ({ answer, shown }) {
	yield* answer("retry", "Recovered");

	expect(yield* shown()).toEqual({ data: "Recovered", failure: "none", status: "settled" });
});
