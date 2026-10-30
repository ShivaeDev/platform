import { Effect } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { signedInNotes, signOut } from "#modules/notes/test-support/signOut.tsx";

for (const first of ["session refresh", "sign-out response"] as const) {
	signOut.it(
		`reaches sign-in from the notes route when the ${first} finishes first`,
		[signedInNotes()],
		function* ({ text, click, requested, becomeAnonymous, releaseResponse, settle, href }) {
			yield* settle();
			expect(text({ name: "Notes", role: "heading" })).toBe("Notes");

			yield* click({ name: "Sign out", role: "button" });
			yield* requested();
			if (first === "session refresh") {
				yield* becomeAnonymous();
				yield* settle();
				expect(text({ name: "Sign in", role: "heading" })).toBe("Sign in");

				yield* releaseResponse();
			} else {
				yield* releaseResponse();
				yield* settle();
				expect(text({ name: "Sign in", role: "heading" })).toBe("Sign in");

				yield* becomeAnonymous();
			}
			yield* settle();

			yield* outcomes({
				"location": [Effect.sync(href), "/sign-in"],
				"page heading": [Effect.sync(() => text({ name: "Sign in", role: "heading" })), "Sign in"],
			});
		},
	);
}
