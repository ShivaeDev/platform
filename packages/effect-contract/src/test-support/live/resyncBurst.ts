import { Effect, Ref } from "effect";
import { expect } from "vitest";
import { eventually } from "#test/eventually.ts";
import type { LiveEngine } from "#test/liveEngine.ts";

export const resyncBurst = Effect.fn("LiveNotesStory.resyncBurst")(function* ({ client, server }: LiveEngine, count: number) {
	const scopes = (yield* Ref.get(server.stored)).size;
	const expected = client.receivedHints() + count * scopes;
	for (let index = 0; index < count; index += 1) {
		yield* Effect.promise(() => server.emit({ _tag: "Resync" }));
	}
	yield* eventually(() => expect(client.receivedHints()).toBe(expected));
});
