import { Cause, Effect, Exit, Fiber } from "effect";
import { expect } from "vitest";
import { screenApp } from "#test/screenApp.ts";

screenApp.it("waits for held data before reporting a settled screen", [], function* ({ holdNews, click, settle, text }) {
	const held = yield* holdNews();
	yield* click("#load");
	yield* held.waiting;
	const settling = yield* Effect.forkChild(settle());
	expect(text("output")).toBe("Loading");
	expect(settling.pollUnsafe()).toBeUndefined();
	yield* held.release;
	yield* Fiber.join(settling);
	expect(text("output")).toBe("Today's news");
});

screenApp.it("identical re-renders cannot settle a pending request", [], function* ({ holdNews, click, settle, repaints, text }) {
	const held = yield* holdNews();
	yield* click("#load");
	yield* held.waiting;
	const before = text();
	const settling = yield* Effect.forkChild(settle());
	yield* repaints(20);
	expect(text()).toBe(before);
	expect(settling.pollUnsafe()).toBeUndefined();
	yield* held.release;
	yield* Fiber.join(settling);
	expect(text()).toContain("Today's news");
});

screenApp.it("signs in from the form through the fake identity provider", [], function* ({ enter, submit, settle, text, value, story }) {
	yield* enter('[name="email"]', "alice@example.test");
	expect(value('[name="email"]')).toBe("alice@example.test");
	yield* submit();
	yield* settle();
	expect(text("output")).toBe("Signed in as alice@example.test");
	expect(story.lines).toContain("fake HTTP received POST /session");
	expect(story.lines).toContain('read output: "Signed in as alice@example.test"');
});

screenApp.it("narrates field actions and reads the rendered textarea", [], function* ({ enter, value, story }) {
	yield* enter("textarea", "a draft");
	expect(value("textarea")).toBe("a draft");
	expect(story.lines).toEqual(["enter a value in textarea", 'read the value in textarea: "a draft"']);
});

screenApp.it("refuses missing, ambiguous, disabled and unsuitable controls", [], function* ({ click, enter, submit }) {
	for (const [action, message] of [
		[click("#missing"), "0 matches"],
		[click("button"), "3 matches"],
		[click("#unavailable"), "is disabled"],
		[enter("#readonly", "changed"), "is read-only"],
		[enter("output", "text"), "is not a text field"],
		[submit("output"), "is not a form"],
	] as const) {
		const exit = yield* Effect.exit(action);
		expect(Exit.isFailure(exit) ? Cause.pretty(exit.cause) : "acted").toContain(message);
	}
});

screenApp.it("reads rendered text without hidden content", [], ({ text }) => {
	expect(text()).toContain("Ready");
	expect(text()).not.toContain("Hidden detail");
});

screenApp.it("explains a signal that never clears instead of reporting a settled screen", [], function* ({ holdNews, click, shortSettle, settle }) {
	const held = yield* holdNews();
	yield* click("#load");
	yield* held.waiting;
	const exit = yield* Effect.exit(shortSettle());
	expect(Exit.isFailure(exit) ? Cause.pretty(exit.cause) : "settled").toContain("The screen did not settle within 40ms");
	yield* held.release;
	yield* settle();
});
