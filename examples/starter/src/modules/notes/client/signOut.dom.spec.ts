import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { signedInNotes, signOut } from "#modules/notes/test-support/signOut.tsx";

for (const first of ["session refresh", "sign-out response"] as const) {
	signOut.it(
		`signing out reaches sign-in when the ${first} finishes first`,
		[signedInNotes()],
		function* ({ finishesSigningOut, heading, href, settle, startsSigningOut }) {
			yield* settle();
			expect(yield* heading()).toBe("Notes");
			yield* startsSigningOut();

			yield* finishesSigningOut(first);

			yield* outcomes([
				["location", href, "/sign-in"],
				["page", heading, "Sign in"],
			]);
		},
	);
}
