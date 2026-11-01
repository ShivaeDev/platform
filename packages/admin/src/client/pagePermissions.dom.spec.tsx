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

for (const path of ["/admin", "/admin/"]) {
	for (const [role, text, status] of [
		["workspace-reader", `Workspaces: ${path}`, 200],
		["auditor", "Permission denied", 403],
		["viewer", "Permission denied", 403],
	] as const) {
		pageScreens.it(
			`${role} receives ${status} on the server and sees ${text} on the client at ${path}`,
			[],
			function* ({ openDocument, openScreen, shown }) {
				const document = yield* openDocument(path, role);
				yield* openScreen(path, role);

				expect(document.status).toBe(status);
				expect(yield* shown()).toBe(text);
			},
		);
	}
}

for (const [role, text] of [
	["workspace-reader", "Permission denied"],
	["auditor", "Workspaces: /admin/exports"],
] as const) {
	pageScreens.it(`the exports page uses its own grant for ${role} on the client`, [], function* ({ openScreen, shown }) {
		yield* openScreen("/admin/exports", role);

		expect(yield* shown()).toBe(text);
	});
}
