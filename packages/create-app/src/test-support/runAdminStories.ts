import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { appScript } from "./environment.ts";

export function runAdminStories(app: string, foundationOnly = false) {
	writeFileSync(
		join(app, "admin-stories.config.ts"),
		'import { appTestConfig } from "@shivaedev/quality/appTestConfig.ts";\nexport default appTestConfig(["source"]);\n',
	);
	return appScript(
		app,
		"test",
		[
			"src/server/admin/foundation.spec.ts",
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
		["NODE_OPTIONS=--conditions=source"],
	);
}
