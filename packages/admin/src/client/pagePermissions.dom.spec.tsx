import { expect } from "vitest";
import { pageScreens } from "#test/pageScreens.tsx";

for (const path of ["/admin/workspaces", "/admin/workspaces/studio"]) {
	for (const [role, text] of [
		["workspace-reader", `Workspaces: ${path}`],
		["viewer", "Permission denied"],
		["auditor", "Permission denied"],
	] as const) {
		pageScreens.it(`${role} sees ${text} at ${path}`, [], function* ({ openScreen, shown }) {
			yield* openScreen(path, role);

			expect(yield* shown()).toBe(text);
		});
	}
}

for (const [role, text] of [
	["workspace-reader", "Permission denied"],
	["auditor", "Workspaces: /admin/workspaces/export"],
] as const) {
	pageScreens.it(`an exact child page uses its own grant for ${role} on the client`, [], function* ({ openScreen, shown }) {
		yield* openScreen("/admin/workspaces/export", role);

		expect(yield* shown()).toBe(text);
	});
}
