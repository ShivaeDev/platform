import * as HttpStatus from "effect/http/HttpStatus";
import { expect } from "vitest";
import { pageHost } from "#test/pageHost.ts";

for (const path of ["/admin/workspaces", "/admin/workspaces/studio", "/admin/workspaces/studio?tab=members", "/admin/workspaces/"]) {
	pageHost.it(`a role holding only workspaces.read loads ${path}`, [], function* ({ openDocument }) {
		expect(yield* openDocument(path, "workspace-reader")).toEqual({ body: `<main>Workspaces: ${path}</main>`, status: 200 });
	});
	for (const role of ["viewer", "auditor", undefined] as const) {
		pageHost.it(`${role ?? "a visitor"} is refused the document ${path}`, [], function* ({ openDocument }) {
			expect(yield* openDocument(path, role)).toMatchObject({ body: "", status: role === undefined ? 401 : 403 });
		});
	}
}

for (const [role, answer] of [
	["workspace-reader", "Workspace studio"],
	["viewer", "forbidden"],
	["auditor", "forbidden"],
] as const) {
	pageHost.it(`${role} receives ${answer} from the registered workspace RPC`, [], function* ({ readWorkspace }) {
		expect(yield* readWorkspace(role)).toBe(answer);
	});
}

pageHost.it("an unregistered admin document is not served", [], function* ({ openDocument }) {
	expect(yield* openDocument("/admin/workspaces/studio/settings", "workspace-reader")).toMatchObject({ body: "", status: 404 });
});

for (const path of ["/admin", "/admin/"]) {
	for (const [role, status] of [
		["workspace-reader", 200],
		["auditor", 403],
	] as const) {
		pageHost.it(`${path} uses the first page's permission for ${role}`, [], function* ({ openDocument }) {
			expect(yield* openDocument(path, role)).toMatchObject({ status });
		});
	}
}

pageHost.it("an auditor holding only users.read loads the users document", [], function* ({ openDocument }) {
	expect(yield* openDocument("/admin/users", "auditor")).toMatchObject({ status: 200 });
});

for (const [role, status] of [
	["workspace-reader", 403],
	["auditor", 200],
] as const) {
	pageHost.it(`the exports page uses its own grant for ${role}`, [], function* ({ openDocument }) {
		expect(yield* openDocument("/admin/exports", role)).toMatchObject({ status });
	});
}

for (const path of ["/admin", "/admin/"]) {
	pageHost.it(`a visitor is refused ${path} on the server and sent to sign-in on the client`, [], function* ({ openClientAsVisitor, openDocument }) {
		const document = yield* openDocument(path);
		const destination = yield* openClientAsVisitor(path);

		expect(document.status).toBe(HttpStatus.fromLiteral("Unauthorized"));
		expect(destination).toBe("/sign-in");
	});
}
