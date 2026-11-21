import { CLIENT_MODULES_PROJECT } from "#test/clientModulesProject.ts";
import { writeFiles } from "#test/fixtureProject.ts";
import { generator } from "#test/generator.ts";

export function clientModulesProject() {
	return generator.trait(
		"project",
		"the project has client modules for tags, notes and archive, a notes server registration and a notes kit with a module of its own",
		(engine) => writeFiles(engine.root, CLIENT_MODULES_PROJECT),
	);
}

export function importsTheClientList() {
	return generator.trait("project", "the project's src/client/modules.ts imports the generated client module list", (engine) =>
		writeFiles(engine.root, { "src/client/modules.ts": CLIENT_MODULES_PROJECT["src/client/modules.ts"] ?? "" }),
	);
}
