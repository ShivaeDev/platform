import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { directoryScreen, mappedDirectoryScreen } from "#test/directoryScreen.tsx";

expectNoReactWarnings();

for (const [screen, mapping] of [
	[directoryScreen, "default"],
	[mappedDirectoryScreen, "custom"],
] as const) {
	screen.it(
		`an open users page refreshes after a role change through the ${mapping} directory`,
		[],
		function* ({ assignFromAnotherClient, shownRoles }) {
			expect(yield* shownRoles()).toEqual({
				"Role for alice@app.test": "owner",
				"Role for bob@app.test": "user",
				"Role for carol@app.test": "auditor",
			});

			yield* assignFromAnotherClient("bob", "auditor");

			expect(yield* shownRoles()).toEqual({
				"Role for alice@app.test": "owner",
				"Role for bob@app.test": "auditor",
				"Role for carol@app.test": "auditor",
			});
		},
	);
}
