import { Exit, Option } from "effect";
import { expect } from "vitest";
import { isUnauthorized } from "#client/resultState.ts";
import { resultHook, resultHooks } from "#test/resultHookStories.ts";
import { resultProbe, results } from "#test/resultStories.ts";

for (const kind of ["query", "action"] as const) {
	results.it(`${kind} preserves successful undefined as Some with settled flags`, [resultProbe(kind, "undefined")], function* ({ result, execute }) {
		if (kind === "action") {
			yield* execute();
		}
		const view = result();
		expect(view.current().data).toEqual(Option.some(undefined));
		expect(view.current().pending).toBe(false);
		expect(view.current().refreshing).toBe(false);
		expect(view.current().cause).toEqual(Option.none());
	});
	for (const failure of ["defect", "interruption"] as const) {
		results.it(
			`${kind} exposes a ${failure} cause without rechecking the session`,
			[resultProbe(kind, failure)],
			function* ({ result, execute, rerender }) {
				if (kind === "action") {
					yield* execute();
				}
				const view = result();
				expect(view.current().cause).toEqual(Option.some(view.expectedCause));
				expect(isUnauthorized(Option.getOrThrow(view.current().cause))).toBe(false);
				expect(view.rechecks).toEqual([]);
				yield* rerender();
				expect(view.rechecks).toEqual([]);
			},
		);
	}
}
resultHooks.it("query retains data during refresh and typed failure", [resultHook("query")], function* ({ snapshot, finish, next, execute }) {
	expect(snapshot()).toEqual({ data: null, failed: false, pending: true, refreshing: false });
	yield* finish(Exit.succeed(7));
	expect(snapshot()).toEqual({ data: 7, failed: false, pending: false, refreshing: false });
	next();
	yield* execute();
	expect(snapshot()).toEqual({ data: 7, failed: false, pending: true, refreshing: true });
	yield* finish(Exit.fail("unavailable"));
	expect(snapshot()).toEqual({ data: 7, failed: true, pending: false, refreshing: false });
});
resultHooks.it("action renders ordinary successes and typed failures", [resultHook("action")], function* ({ execute, snapshot, finish, next }) {
	yield* execute();
	expect(snapshot()).toEqual({ data: null, failed: false, pending: true });
	yield* finish(Exit.succeed(2));
	expect(snapshot()).toEqual({ data: 7, failed: false, pending: false });
	next();
	yield* execute();
	yield* finish(Exit.fail("denied"));
	expect(snapshot()).toEqual({ data: 7, failed: true, pending: false });
});
resultHooks.it("query identity changes drop the previous data", [resultHook("identity")], function* ({ text, changeIdentity }) {
	expect(text()).toBe("account A");
	yield* changeIdentity();
	expect(text()).toBe("loading");
});
resultHooks.it("consumers of one query share its native execution", [resultHook("shared")], function* ({ text, engine, observe }) {
	yield* observe("two consumers share one execution", () => {
		expect(text()).toBe("11");
		expect(engine().calls).toBe(1);
	});
});
resultHooks.it("overlapping dispatches expose the latest native result", [resultHook("overlap")], function* ({ execute, engine, finish, text }) {
	yield* execute();
	yield* execute();
	expect(engine().interrupted).toBe(true);
	yield* finish(Exit.succeed(2), "second");
	expect(text()).toBe("2");
	yield* finish(Exit.succeed(1), "first");
	expect(text()).toBe("2");
});
