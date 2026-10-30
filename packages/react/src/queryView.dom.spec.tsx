import { Effect } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { feedbackFirstReadFailed, feedbackRefreshFailed, feedbackRefreshing, feedbackWaiting, queries } from "#test/queryStories.ts";

queries.it("a first read that fails shows its message with Retry in place of Loading", [feedbackWaiting()], function* ({ alert, fail, loading }) {
	expect(yield* loading()).toBe("Loading");

	yield* fail("first", "Offline");

	yield* outcomes({
		alert: [alert(), "OfflineRetry"],
		loading: [loading(), "none"],
	});
});

queries.it("a failed first read stays inside the screen instead of reaching the error boundary", [feedbackFirstReadFailed()], function* ({ crash }) {
	expect(yield* crash()).toBe("none");
});

queries.it("clicking Retry after a failed first read shows Loading", [feedbackFirstReadFailed()], function* ({ clickRetry, loading }) {
	yield* clickRetry();

	expect(yield* loading()).toBe("Loading");
});

queries.it(
	"a retry that answers after a failed first read shows the answer, removes the alert and keeps the shell's element and draft",
	[feedbackFirstReadFailed()],
	function* ({ alert, answer, clickRetry, elements, field, shownAnswer }) {
		yield* clickRetry();

		yield* answer("retry", "Ready");

		yield* outcomes({
			alert: [alert(), "none"],
			answer: [shownAnswer(), "Ready"],
			"shell draft": [field("shell"), "Shell draft"],
			"shell element": [Effect.map(elements(), ({ shell }) => shell), "original"],
		});
	},
);

queries.it("a refresh shows Refreshing", [feedbackRefreshing()], function* ({ loading }) {
	expect(yield* loading()).toBe("Refreshing");
});

queries.it(
	"a failed refresh keeps the answer, its content element and the unsaved input",
	[feedbackRefreshing()],
	function* ({ elements, fail, field, shownAnswer }) {
		yield* fail("refresh", "Offline");

		yield* outcomes({
			answer: [shownAnswer(), "Last success"],
			"content element": [Effect.map(elements(), ({ content }) => content), "original"],
			"unsaved input": [field("local"), "Unsaved input"],
		});
	},
);

queries.it(
	"a retry that answers after a failed refresh shows the fresh answer in the same content element with the unsaved input",
	[feedbackRefreshFailed()],
	function* ({ answer, clickRetry, elements, field, shownAnswer }) {
		yield* clickRetry();

		yield* answer("retry", "Fresh success");

		yield* outcomes({
			answer: [shownAnswer(), "Fresh success"],
			"content element": [Effect.map(elements(), ({ content }) => content), "original"],
			"unsaved input": [field("local"), "Unsaved input"],
		});
	},
);

const defect = new Error("Broken query");
queries.it("a query defect reaches the unexpected-error boundary instead of the alert", [feedbackWaiting(defect)], function* ({ alert, crash, die }) {
	yield* die("first", defect);

	yield* outcomes({
		alert: [alert(), "none"],
		crash: [crash(), "Unexpected failure"],
	});
});
