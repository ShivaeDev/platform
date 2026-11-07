import { Effect } from "effect";
import { queryStories } from "#test/queryStories.ts";
import { queryVerbs } from "#test/queryVerbs.ts";
import { queryView } from "#test/queryView.ts";
import { screenWarnings } from "#test/Screen.ts";

type Steps = (verbs: ReturnType<typeof queryVerbs>) => Generator<Effect.Effect<unknown, unknown, never>, void>;

function feedbackAfter(line: string, steps: Steps | undefined, defect?: Error) {
	return queryStories.trait("screen", `query feedback inside an application shell and error boundary: ${line}`, function* ({ screen, state }) {
		const root = yield* screen.open(null, defect ? { onCaughtError: screenWarnings.expectCaughtError((error) => error === defect) } : undefined);
		state.reads.next("first");
		state.view = yield* Effect.promise(() => queryView(root, state.reads.queries("first"), {}, true));
		if (steps) {
			yield* steps(queryVerbs(state, screen));
		}
		state.marked = { content: root.container.querySelector("article"), shell: root.container.querySelector('[name="shell"]') };
	});
}

export function feedbackWaiting(defect?: Error) {
	return feedbackAfter("the first read waits", undefined, defect);
}

export function feedbackFirstReadFailed() {
	return feedbackAfter("the shell input holds Shell draft and the first read failed as Unavailable: Offline", function* (verbs) {
		yield* verbs.type("shell", "Shell draft");
		yield* verbs.fail("first", "Offline");
	});
}

export function feedbackRefreshFailed() {
	return feedbackAfter(
		"the first read answered Last success, the content input holds Unsaved input and a refresh failed as Unavailable: Offline",
		function* (verbs) {
			yield* verbs.answer("first", "Last success");
			yield* verbs.type("local", "Unsaved input");
			yield* verbs.refresh();
			yield* verbs.fail("refresh", "Offline");
		},
	);
}

export function feedbackRefreshing() {
	return feedbackAfter("the first read answered Last success, the content input holds Unsaved input and a refresh waits", function* (verbs) {
		yield* verbs.answer("first", "Last success");
		yield* verbs.type("local", "Unsaved input");
		yield* verbs.refresh();
	});
}
