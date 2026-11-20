import { fence } from "@shivaedev/quality/imports/fence.ts";
import { anyOf, packages, workspace } from "@shivaedev/quality/imports/fences/selectors.ts";

const hosts = packages("server", "starter");
// Test kits compose the host for stories, so the fence treats them as it treats test-support folders.
const testKits = packages("test-kits");

export default [
	fence("libraries-never-import-the-host-or-an-application")
		.because(
			"Libraries compose under any application, so they never reach the application host in @shivaedev/server or an application's own code; only applications and their test kits run on the host.",
		)
		.from(workspace.except(anyOf(hosts, testKits)))
		.mayNotImport(hosts)
		.demonstratedBy({
			illegal: ["packages/jobs/src/server/adapters/client.ts", "packages/server/src/appHost.ts"],
			legal: ["packages/test-kits/src/contract/liveMemoryProtocol.ts", "packages/server/src/hostChanges.ts"],
		}),
];
