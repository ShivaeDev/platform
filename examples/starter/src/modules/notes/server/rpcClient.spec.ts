import { Effect } from "effect";
import { expect } from "vitest";
import { app, signedIn } from "#modules/notes/test-support/application.ts";

app.it("the bound client carries its cookie transform to a session-guarded query", [signedIn()], function* ({ actor, profile }) {
	const { cookie, userId } = actor();
	expect(yield* profile(cookie)).toEqual({ email: "alice@app.test", id: userId, name: "alice" });
	expect(yield* profile("").pipe(Effect.flip)).toMatchObject({ _tag: "Unauthorized" });
});
