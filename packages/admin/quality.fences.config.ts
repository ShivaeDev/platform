import { fence } from "@shivaedev/quality/imports/fence.ts";
import { anything, external, files, folders, modules, packages } from "@shivaedev/quality/imports/fences/selectors.ts";

const server = folders("packages/admin/src/server", "packages/admin/src/test-support");
const client = folders("packages/admin/src/client");
const browser = folders("packages/admin/src").except(server, client);

export default [
	fence("admin-declarations-stay-browser-safe")
		.because("Admin pages and their registry are shared with browser views; handler registration stays on the server.")
		.from(browser)
		.mayNotReach(
			anything.except(
				browser,
				files("packages/access/src/permission.ts"),
				packages("effect-contract", "types"),
				folders("packages/platform/src/rpc"),
				modules("effect"),
			),
		)
		.demonstratedBy({
			illegal: ["packages/admin/src/page.ts", external("node:fs")],
			legal: ["packages/admin/src/page.ts", external("effect")],
		}),
	fence("admin-views-stay-browser-safe")
		.because("React views reach browser declarations and client hooks; authentication storage stays on the server.")
		.from(client)
		.mayNotReach(
			anything.except(
				client,
				browser,
				files("packages/access/src/permission.ts"),
				packages("effect-react", "effect-form", "effect-contract", "types"),
				folders("packages/platform/src/rpc"),
				modules("effect", "react", "@effect/atom-react"),
			),
		)
		.demonstratedBy({
			illegal: ["packages/admin/src/client/UsersView.ts", external("node:fs")],
			legal: ["packages/admin/src/client/UsersView.ts", external("react")],
		}),
];
