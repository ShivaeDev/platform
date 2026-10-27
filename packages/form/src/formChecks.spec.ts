import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { vi } from "vitest";
import { brokenCheck, CHECK_DEBOUNCE, delayedCheck, minimumName, reservedCheck, takenCheck, validatedCheck } from "#test/checks.ts";

takenCheck.it("a check result disappears as soon as the field no longer holds the checked value", [], function* ({ form, errors, eventually }) {
	errors("name");
	form.change("name", "taken");
	yield* eventually(() => expect(errors("name")).toBe("Name is taken"));
	form.change("name", "free");
	expect(errors("name")).toBeUndefined();
});

delayedCheck.it("a check result appears only after debounce and completion", [], function* ({ form, errors, checkStarted, answerCheck, eventually }) {
	errors("name");
	form.change("name", "slow");
	expect(errors("name")).toBeUndefined();
	yield* checkStarted("slow");
	expect(errors("name")).toBeUndefined();
	yield* answerCheck("slow", "Slow is taken");
	yield* eventually(() => expect(errors("name")).toBe("Slow is taken"));
});

brokenCheck.it("a failing check never falls back to an earlier value's result", [], function* ({ form, errors, eventually, checked }) {
	errors("name");
	form.change("name", "taken");
	yield* eventually(() => expect(errors("name")).toBe("Name is taken"));
	form.change("name", "broken");
	yield* eventually(() => expect(checked).toEqual(["broken"]));
	expect(errors("name")).toBeUndefined();
});

delayedCheck.it(
	"a late result for an older value never appears while the current check is pending",
	[],
	function* ({ form, errors, checkStarted, answerCheck, eventually }) {
		errors("name");
		form.change("name", "old");
		yield* checkStarted("old");
		form.change("name", "new");
		yield* answerCheck("old", "Old is taken");
		expect(errors("name")).toBeUndefined();
		yield* checkStarted("new");
		yield* answerCheck("new", "New is taken");
		yield* eventually(() => expect(errors("name")).toBe("New is taken"));
	},
);

delayedCheck.it(
	"a late result for an older value never overwrites current feedback",
	[],
	function* ({ form, errors, checkStarted, answerCheck, eventually }) {
		errors("name");
		form.change("name", "old");
		yield* checkStarted("old");
		form.change("name", "new");
		yield* checkStarted("new");
		yield* answerCheck("new", "New is taken");
		yield* eventually(() => expect(errors("name")).toBe("New is taken"));
		yield* answerCheck("old", "Old is taken");
		expect(errors("name")).toBe("New is taken");
	},
);

reservedCheck.it("a check reads services from the form runtime", [], function* ({ form, errors, eventually }) {
	errors("name");
	form.change("name", "admin");
	yield* eventually(() => expect(errors("name")).toBe("Name is reserved"));
});

validatedCheck.it("a value failing its schema is never sent to the check", [minimumName()], function* ({ form, errors, checked }) {
	yield* Effect.acquireRelease(
		Effect.sync(() => vi.useFakeTimers()),
		() => Effect.sync(() => vi.useRealTimers()),
	);
	errors("name");
	form.change("name", "ready");
	yield* Effect.promise(() => vi.advanceTimersByTimeAsync(CHECK_DEBOUNCE));
	expect(checked).toEqual(["ready"]);
	form.change("name", "ab");
	yield* Effect.promise(() => vi.advanceTimersByTimeAsync(CHECK_DEBOUNCE));
	expect(errors("name")).toBe("Expected a value with a length of at least 3");
	expect(checked).toEqual(["ready"]);
	form.change("name", "abc");
	yield* Effect.promise(() => vi.advanceTimersByTimeAsync(CHECK_DEBOUNCE));
	expect(checked).toEqual(["ready", "abc"]);
});
