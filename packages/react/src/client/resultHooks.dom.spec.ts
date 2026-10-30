import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import {
	accountQuery,
	actionAddsFive,
	actionAnswered,
	oneDispatchRunning,
	queryAnswered,
	queryIsLoading,
	queryRefreshing,
	resultHooks,
	twoReadersOfOneQuery,
} from "#test/resultHookStories.ts";
import { answersUndefined, diesWithUnauthorizedShape, interrupted, results } from "#test/resultStories.ts";

for (const kind of ["query", "action"] as const) {
	results.it(
		`a ${kind} that answers undefined has present data, settled and without a cause`,
		[answersUndefined(kind)],
		function* ({ cause, data, status }) {
			yield* outcomes({
				cause: [cause(), "none"],
				data: [data(), "present: undefined"],
				status: [status(), "settled"],
			});
		},
	);

	for (const [ending, trait, shown] of [
		["dies with an object tagged Unauthorized", diesWithUnauthorizedShape, "died with Unauthorized"],
		["is interrupted", interrupted, "interrupted"],
	] as const) {
		results.it(`a ${kind} that ${ending} shows ${shown} and asks for no session recheck`, [trait(kind)], function* ({ cause, rechecks }) {
			yield* outcomes({
				cause: [cause(), shown],
				rechecks: [rechecks(), []],
			});
		});
	}
}

resultHooks.it("a query shows loading until its work answers, then its data", [queryIsLoading()], function* ({ data, status, workSucceeds }) {
	expect(yield* status()).toBe("loading");

	yield* workSucceeds(7);

	yield* outcomes({
		data: [data(), "present: 7"],
		status: [status(), "settled"],
	});
});

resultHooks.it("a refreshing query keeps its data while its work runs", [queryAnswered(7)], function* ({ data, run, status }) {
	expect(yield* status()).toBe("settled");

	yield* run();

	yield* outcomes({
		data: [data(), "present: 7"],
		status: [status(), "refreshing"],
	});
});

resultHooks.it(
	"a refresh that fails keeps the query's data beside its failure",
	[queryRefreshing(7)],
	function* ({ cause, data, status, workFails }) {
		yield* workFails();

		yield* outcomes({
			cause: [cause(), "failed with unavailable"],
			data: [data(), "present: 7"],
			status: [status(), "settled"],
		});
	},
);

resultHooks.it(
	"a dispatched action is loading until its work answers, then shows its data",
	[actionAddsFive()],
	function* ({ data, run, status, workSucceeds }) {
		yield* run();
		expect(yield* status()).toBe("loading");

		yield* workSucceeds(2);

		yield* outcomes({
			data: [data(), "present: 7"],
			status: [status(), "settled"],
		});
	},
);

resultHooks.it(
	"a later dispatch that fails keeps the action's last data beside its failure",
	[actionAnswered(2)],
	function* ({ cause, data, run, workFails }) {
		yield* run();

		yield* workFails();

		yield* outcomes({
			cause: [cause(), "failed with unavailable"],
			data: [data(), "present: 7"],
		});
	},
);

resultHooks.it("showing a different query drops the previous query's data", [accountQuery()], function* ({ showAnotherQuery, shown }) {
	expect(yield* shown()).toBe("account A");

	yield* showAnotherQuery();

	expect(yield* shown()).toBe("loading");
});

resultHooks.it("two components that read one query share its one run", [twoReadersOfOneQuery()], function* ({ executions, readers }) {
	yield* outcomes({
		"runs of the query's work": [executions(), 1],
		"what each reader shows": [readers(), ["1", "1"]],
	});
});

resultHooks.it("dispatching the action again interrupts its running dispatch", [oneDispatchRunning()], function* ({ dispatchOutcome, run }) {
	expect(yield* dispatchOutcome(1)).toBe("running");

	yield* run();

	expect(yield* dispatchOutcome(1)).toBe("interrupted");
});

resultHooks.it("the action shows its second dispatch's answer", [oneDispatchRunning()], function* ({ data, dispatchAnswers, run }) {
	yield* run();

	yield* dispatchAnswers(2, 2);

	expect(yield* data()).toBe("present: 2");
});
