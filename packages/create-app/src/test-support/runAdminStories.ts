import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { appScript } from "./environment.ts";

export function runAdminStories(app: string, starter: string, foundationOnly = false) {
	const child = "src/test-support/deployChild.ts";
	writeFileSync(join(app, child), readFileSync(join(starter, child)));
	writeFileSync(
		join(app, "admin-stories.config.ts"),
		'import { appTestConfig } from "@shivaedev/test-kits/quality/appTestConfig.ts";\nexport default appTestConfig(["@shivaedev/source"]);\n',
	);
	return appScript(
		app,
		"test",
		[
			"src/server/assets.spec.ts",
			"src/server/admin/foundation.spec.ts",
			"src/client/admin/jobs.dom.spec.tsx",
			...(foundationOnly
				? []
				: [
						"src/modules/notes/server/admin/development.spec.ts",
						"src/modules/notes/server/admin/users.spec.ts",
						"src/modules/notes/server/admin/userPolicy.spec.ts",
						"src/modules/notes/client/admin/views.dom.spec.tsx",
					]),
			"--config",
			"admin-stories.config.ts",
			"--configLoader",
			"native",
			"--maxWorkers",
			"2",
		],
		["NODE_OPTIONS=--conditions=@shivaedev/source"],
	);
}
