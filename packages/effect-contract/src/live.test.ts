import { Cause, Exit, Schema } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import { expect } from "vitest";
import { LiveHint } from "#live.ts";
import { eventually } from "#test/eventually.ts";
import { liveDenied, liveNotesStory, liveSession, liveStoredNotes, startsWith, withoutResume } from "#test/liveNotesStory.ts";
import { Denied, Note, notes } from "#test/notes.ts";

liveNotesStory.it("rejects unknown hints and invalid read keys at the Schema boundary", [], () => {
	const decode = Schema.decodeUnknownResult(LiveHint);
	for (const value of [{ _tag: "Unknown" }, { _tag: "Changed", keys: [{ _tag: "Item", collection: "notes", id: true }] }]) {
		expect(decode(value)._tag).toBe("Failure");
	}
	expect(decode({ _tag: "Changed", keys: [notes.item(1)] })._tag).toBe("Success");
	expect(decode({ _tag: "Changed", keys: [{ _tag: "Item", collection: "documents", id: "one" }] })._tag).toBe("Success");
});
liveNotesStory.it(
	"reconciles the full explicit scope on each new stream even when its first hint is targeted",
	[liveSession(), startsWith({ _tag: "Changed", keys: [notes.item(1)] })],
	function* (test) {
		const registry = test.registry;
		const two = test.query(2);
		registry.mount(two);
		yield* eventually(() => expect(AsyncResult.getOrElse(registry.get(two), () => undefined)?.body).toBe("Second"));
		test.connect();
		yield* eventually(() => expect(test.reads().filter((id) => id === "get:2")).toHaveLength(2));
		yield* test.disconnect();
		yield* eventually(() => expect(test.reads().filter((id) => id === "get:2")).toHaveLength(3));
	},
);
liveNotesStory.it("defers resume reconciliation while paused until the consumer unpauses", [liveSession()], function* (test) {
	const registry = test.registry;
	const one = test.query(1);
	registry.mount(one);
	yield* eventually(() => expect(AsyncResult.getOrElse(registry.get(one), () => undefined)?.body).toBe("First"));
	test.connect();
	yield* eventually(() => {
		expect(test.status().connection).toBe("live");
		expect(test.reads().filter((id) => id === "get:1")).toHaveLength(2);
		expect(registry.get(one).waiting).toBe(false);
	});
	test.pause(true);
	yield* test.edit(1, "Changed while paused");
	yield* eventually(() => expect(test.status().pending).toBe(1));
	const reads = test.reads();
	test.resume();
	expect(test.status()).toMatchObject({ needsResync: true, pending: 1 });
	expect(test.reads()).toEqual(reads);
	expect(registry.get(one).waiting).toBe(false);
	expect(AsyncResult.getOrElse(registry.get(one), () => undefined)?.body).toBe("First");
	test.pause(false);
	yield* eventually(() => expect(AsyncResult.getOrElse(registry.get(one), () => undefined)?.body).toBe("Changed while paused"));
	expect(test.status()).toMatchObject({ needsResync: false, pending: 0 });
});
liveNotesStory.it(
	"continues native HTTP live updates when the optional resume signal is omitted",
	[liveSession(), withoutResume()],
	function* (test) {
		const registry = test.registry;
		const one = test.query(1);
		test.connect();
		registry.mount(one);
		yield* eventually(() => expect(test.status().connection).toBe("live"));
		yield* eventually(() => expect(AsyncResult.getOrElse(registry.get(one), () => undefined)?.body).toBe("First"));
		yield* test.edit(1, "Changed without resume signal");
		yield* eventually(() => expect(AsyncResult.getOrElse(registry.get(one), () => undefined)?.body).toBe("Changed without resume signal"));
		expect(test.active()).toBe(1);
	},
);

liveNotesStory.it(
	"reads seeded notes through the authenticated live API",
	[liveSession("grace"), liveStoredNotes(new Note({ body: "Seeded", id: 4, title: "Four" }))],
	function* (test) {
		expect(yield* test.get(4)).toEqual(Exit.succeed(new Note({ body: "Seeded", id: 4, title: "Four" })));
	},
);

liveNotesStory.it(
	"denied sessions cannot subscribe to stored notes",
	[liveDenied(), liveStoredNotes(new Note({ body: "Private", id: 4, title: "Four" }))],
	function* (test) {
		const exit = yield* test.subscribe(1);
		expect(Exit.isFailure(exit) && Cause.squash(exit.cause)).toBeInstanceOf(Denied);
		expect(test.connections()).toBe(0);
		expect(test.active()).toBe(0);
	},
);
