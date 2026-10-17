import { Cause, Effect, Exit, Fiber, Result } from "effect";
import { expect } from "vitest";
import { eventually } from "#test/eventually.ts";
import { Unavailable } from "#test/live/contract.ts";
import { liveNotesStory, liveSession } from "#test/liveNotesStory.ts";
import { notes } from "#test/notes.ts";

liveNotesStory.it(
	"delivers declared elements through the bound native HTTP stream and releases its scope on completion",
	[liveSession()],
	function* (test) {
		const received = yield* test.subscribe(2).pipe(Effect.forkScoped);
		yield* eventually(() => expect(test.active()).toBe(1));
		yield* test.edit(1, "Changed");
		expect(yield* Fiber.join(received)).toEqual(Exit.succeed([{ _tag: "Resync" }, { _tag: "Changed", keys: [notes.item(1)] }]));
		yield* eventually(() => expect(test.active()).toBe(0));
	},
);

liveNotesStory.it("decodes a declared stream rejection into its shared tagged class", [liveSession()], function* (test) {
	yield* test.streamOutage(true);
	const exit = yield* test.subscriptionResult();
	expect(Exit.isSuccess(exit)).toBe(true);
	if (Exit.isSuccess(exit)) {
		expect(Result.isFailure(exit.value) && exit.value.failure).toBeInstanceOf(Unavailable);
	}
});

liveNotesStory.it("interrupting the bound client releases the active server stream over HTTP", [liveSession()], function* (test) {
	const controller = new AbortController();
	const received = yield* test.subscribe(undefined, controller.signal).pipe(Effect.forkScoped);
	yield* eventually(() => expect(test.active()).toBe(1));
	controller.abort();
	const exit = yield* Fiber.join(received);
	expect(Exit.isFailure(exit) && Cause.hasInterrupts(exit.cause)).toBe(true);
	yield* eventually(() => expect(test.active()).toBe(0));
});
