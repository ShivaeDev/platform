import { expect } from "vitest";
import { screens } from "#test-support/screens.ts";
import { sessionModulesScreen } from "#test-support/sessionModulesScreen.tsx";

for (const name of ["notes", "tasks"] as const) {
	for (const signedIn of [true, false]) {
		const user = signedIn ? "alice" : "anonymous";
		screens.it(
			`the ${name} registration uses ${user}'s rendering registry for a session-scoped contract`,
			[sessionModulesScreen(name, signedIn)],
			function* ({ controlText, settle }) {
				yield* settle();

				expect(controlText("output")).toBe(`${name} for ${user}`);
			},
		);
	}
}
