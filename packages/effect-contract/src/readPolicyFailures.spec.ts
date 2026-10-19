import { Effect, Fiber, Option } from "effect";
import { expect, expectTypeOf } from "vitest";
import type { LiveHint } from "#live.ts";
import { eventually } from "#test/eventually.ts";
import { type Denied, notes, type PolicyUnavailable } from "#test/viewerEngine.ts";
import { viewerStory } from "#test/viewerStory.ts";

viewerStory.it("a policy outage reaches the query caller as its declared typed error", [], function* (test) {
	yield* test.policyOutage(true);
	const request = test.get("alice", 1);
	expectTypeOf<Effect.Error<typeof request>>().toEqualTypeOf<Denied | PolicyUnavailable>();
	expect(yield* Effect.result(request)).toMatchObject({ _tag: "Failure", failure: { _tag: "PolicyUnavailable" } });
	yield* test.policyOutage(false);
	expect(yield* test.get("bob", 1).pipe(Effect.result)).toMatchObject({ _tag: "Failure", failure: { _tag: "Denied" } });
	expect(yield* test.get("alice", 1)).toMatchObject({ title: "One" });
});

viewerStory.it("a failed hint check drops the key while the same stream stays open", [], function* (test) {
	const hints: LiveHint[] = [];
	yield* test.watch("alice", [notes.item(1)], hints).pipe(Effect.forkScoped);
	yield* eventually(() => expect(hints).toEqual([{ _tag: "Resync" }]));
	yield* test.policyOutage(true);
	yield* test.rename("alice", 1, "During outage");
	yield* eventually(() => expect(test.checks()).toEqual([{ key: notes.item(1), viewer: "alice" }]));
	yield* test.resync();
	yield* eventually(() => expect(hints).toEqual([{ _tag: "Resync" }, { _tag: "Resync" }]));
	yield* test.policyOutage(false);
	yield* test.rename("alice", 1, "After recovery");
	yield* eventually(() => expect(hints.at(-1)).toEqual({ _tag: "Changed", keys: [notes.item(1)] })).pipe(Effect.timeout("500 millis"));
});

viewerStory.it("an open page catches up after policy recovery without another change or reconnect", [], function* (test) {
	const page = yield* test.openPage("alice", 1);
	yield* eventually(() => {
		expect(page.title()).toBe("One");
		expect(page.status().connection).toBe("live");
	});
	const before = test.checks().length;
	yield* test.policyOutage(true);
	yield* test.rename("alice", 1, "Missed during outage");
	yield* eventually(() => expect(test.checks()).toHaveLength(before + 1));
	expect(page.title()).toBe("One");
	expect(page.status().connection).toBe("live");
	expect(Option.isNone(page.status().failure)).toBe(true);
	yield* eventually(() => expect(test.checks().length).toBeGreaterThan(before + 1));
	expect(page.title()).toBe("One");
	yield* test.policyOutage(false);
	yield* eventually(() => expect(page.title()).toBe("Missed during outage"));
	expect(page.status().connection).toBe("live");
	expect(Option.isNone(page.status().failure)).toBe(true);
});

viewerStory.it("interrupting a subscription cancels its pending failed-policy recheck", [], function* (test) {
	const hints: LiveHint[] = [];
	const subscription = yield* test.watch("alice", [notes.item(1)], hints).pipe(Effect.forkScoped);
	yield* eventually(() => expect(hints).toEqual([{ _tag: "Resync" }]));
	yield* test.policyOutage(true);
	yield* test.rename("alice", 1, "During outage");
	yield* eventually(() => expect(test.checks()).toEqual([{ key: notes.item(1), viewer: "alice" }]));
	yield* Fiber.interrupt(subscription);
	yield* Effect.sleep("1100 millis");
	expect(test.checks()).toEqual([{ key: notes.item(1), viewer: "alice" }]);
	expect(hints).toEqual([{ _tag: "Resync" }]);
});
