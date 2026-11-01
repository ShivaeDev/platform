import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { collectionScreen, signedInAs, withWorkspace } from "#test/collectionScreen.tsx";

expectNoReactWarnings();

for (const [caller, role, expected] of [
	["admin", "admin", "tenant one: Studio"],
	["viewer", "user", "Permission denied"],
	["restricted", "admin", "Permission denied"],
] as const) {
	collectionScreen.it(
		`${caller}'s session-scoped collection page renders ${expected}`,
		[signedInAs(caller, role), withWorkspace],
		function* ({ open, shown }) {
			yield* open();

			expect(shown()).toBe(expected);
		},
	);
}
