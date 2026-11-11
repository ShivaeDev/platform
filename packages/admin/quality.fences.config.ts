import { fence } from "@shivaedev/quality/imports/fence.ts";
import { anyOf, anything, external, files, folders, modules, packages } from "@shivaedev/quality/imports/fences/selectors.ts";

const server = folders("packages/admin/src/server", "packages/admin/src/test-support");
const client = folders("packages/admin/src/client");
const browser = folders("packages/admin/src").except(server, client);
const identityDeclarations = anyOf(
	folders("packages/identity/src/generated"),
	files(
		"packages/identity/src/PermissionSession.ts",
		"packages/identity/src/identity.ts",
		"packages/identity/src/middleware.ts",
		"packages/identity/src/permission.ts",
		"packages/identity/src/roles.ts",
		"packages/identity/src/users.ts",
		"packages/identity/src/sessionPermissions.ts",
		"packages/identity/src/signedInSessions.ts",
	),
);

export default [
	fence("admin-declarations-stay-browser-safe")
		.because("Admin pages and their registry are shared with browser views; handler registration stays on the server.")
		.from(browser)
		.mayNotReach(
			anything.except(
				files(
					"packages/changes/src/compositeKeys.ts",
					"packages/changes/src/keys.ts",
					"packages/jobs/src/JobFailure.ts",
					"packages/jobs/src/display.ts",
				),
				browser,
				packages("access"),
				packages("contract", "errors", "types"),
				identityDeclarations,
				modules("effect"),
			),
		)
		.demonstratedBy({
			illegal: ["packages/admin/src/page.ts", external("node:fs")],
			legal: ["packages/admin/src/jobs/schemas.ts", "packages/jobs/src/JobFailure.ts"],
		}),
	fence("admin-views-stay-browser-safe")
		.because("React views reach browser declarations and client hooks; authentication storage stays on the server.")
		.from(client)
		.mayNotReach(
			anything.except(
				files(
					"packages/changes/src/compositeKeys.ts",
					"packages/changes/src/keys.ts",
					"packages/jobs/src/JobFailure.ts",
					"packages/jobs/src/display.ts",
				),
				client,
				browser,
				packages("access"),
				packages("react", "form", "contract", "errors", "types"),
				identityDeclarations,
				modules("effect", "react", "@effect/atom-react"),
			),
		)
		.demonstratedBy({
			illegal: ["packages/admin/src/client/adapters/UsersView.ts", external("node:fs")],
			legal: ["packages/admin/src/client/adapters/UsersView.ts", external("react")],
		}),
];
