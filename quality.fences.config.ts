import { fence } from "@shivaedev/quality/imports/fence.ts";
import { external, packages, workspace } from "@shivaedev/quality/imports/fences/selectors.ts";

const hosts = packages("server", "work-board", "work-fleet", "starter");

export default [
	fence("libraries-never-import-the-host-or-an-application")
		.because(
			"Libraries compose under any application, so they never reach the application host in @shivaedev/server or an application's own code; only applications run on the host.",
		)
		.from(workspace.except(hosts))
		.mayNotImport(hosts)
		.demonstratedBy({
			illegal: ["packages/jobs/src/server/client.ts", "packages/server/src/appHost.ts"],
			legal: ["packages/jobs/src/server/client.ts", external("effect")],
		}),
];
