import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { appScript } from "./environment.ts";

export function runAdminStories(app: string) {
	writeFileSync(
		join(app, "admin-stories.config.ts"),
		'import { appTestConfig } from "@shivaedev/quality/appTestConfig.ts";\nexport default appTestConfig(["source"]);\n',
	);
	return appScript(
		app,
		"test",
		[
			"src/modules/notes/server/adminDevelopment.spec.ts",
			"src/modules/notes/server/adminUsers.spec.ts",
			"src/modules/notes/server/adminUserPolicy.spec.ts",
			"src/modules/notes/client/adminViews.dom.spec.tsx",
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
