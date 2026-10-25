import { fence } from "@shivaedev/quality/imports/fence.ts";
import { anything, external, folders, modules, packages } from "@shivaedev/quality/imports/fences/selectors.ts";

const server = folders("packages/admin/src/server", "packages/admin/src/test-support");
const browser = folders("packages/admin/src").except(server);

export default [
	fence("admin-declarations-stay-browser-safe")
		.because("Admin pages and their registry are shared with browser views; handler registration stays on the server.")
		.from(browser)
		.mayNotReach(
			anything.except(
				browser,
				packages("effect-contract", "types"),
				folders("packages/platform/src/rpc", "packages/platform/src/errors"),
				modules("effect"),
			),
		)
		.demonstratedBy({
			illegal: ["packages/admin/src/page.ts", external("node:fs")],
			legal: ["packages/admin/src/page.ts", external("effect")],
		}),
];
