import { Effect } from "effect";
import { expect } from "vitest";
import { TooManyRequests } from "@shivaedev/rate-limit/TooManyRequests.ts";
import { app, signedIn } from "#modules/notes/test-support/application.ts";

app.it("alice's eleventh note creation is refused over HTTP while bob can still create", [signedIn(), signedIn("bob")], function* ({ actor }) {
	const alice = actor().notes;
	for (let index = 0; index < 10; index += 1) {
		yield* alice.create({ title: `Alice note ${index}` });
	}

	const refused = yield* alice.create({ title: "Excess note" }).pipe(Effect.flip);

	expect(refused).toBeInstanceOf(TooManyRequests);
	expect(refused).toMatchObject({ retryAt: expect.any(Number) });
	expect((yield* alice.list()).map((note) => note.title)).not.toContain("Excess note");
	const bob = yield* actor("bob").notes.create({ title: "Bob note" });
	expect(bob.title).toBe("Bob note");
});
