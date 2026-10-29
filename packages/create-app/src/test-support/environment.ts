import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Schema } from "effect";
import { databaseProbe } from "./databaseProbe.ts";
import { linkStarterModules } from "./starterModules.ts";

export function appScript(app: string, script: string, args: readonly string[] = [], environment: readonly string[] = []) {
	if (!existsSync(join(app, "node_modules"))) {
		linkStarterModules(app);
	}
	const manifest = Schema.decodeUnknownSync(Schema.fromJsonString(Schema.Struct({ scripts: Schema.Record(Schema.String, Schema.String) })))(
		readFileSync(join(app, "package.json"), "utf8"),
	);
	return spawnSync(
		"env",
		[
			"-u",
			"TEST_DATABASE_URL",
			"-u",
			"DATABASE_URL",
			"-u",
			"PLATFORM_SQL_TEST_DATABASE_URL",
			...environment,
			"sh",
			"-c",
			`${manifest.scripts[script]} "$@"`,
			script,
			...args,
		],
		{
			cwd: app,
			encoding: "utf8",
		},
	);
}

export function installDatabaseProbe(app: string) {
	const environment = join(app, ".env.local");
	const line = "PLATFORM_SQL_TEST_DATABASE_URL=postgresql://invalid:invalid@127.0.0.1:1/invalid";
	if (!readFileSync(environment, "utf8").split("\n").includes(line)) {
		writeFileSync(environment, `${line}\n`, { flag: "a" });
	}
	writeFileSync(
		join(app, "environment.config.ts"),
		'export default { resolve: { conditions: ["source"] }, ssr: { resolve: { conditions: ["source"] } }, test: { include: ["src/environment.test.ts"] } };\n',
	);
	writeFileSync(join(app, "src/environment.test.ts"), databaseProbe());
}

export function readyAgainstWorkspace(app: string, starter: string) {
	for (const path of [
		"tsconfig.json",
		"vite.config.ts",
		"vitest.config.ts",
		"src/server/dev.ts",
		"src/test-support/adminCommand.ts",
		"src/test-support/deployChild.ts",
		"src/test-support/developmentServer.ts",
	]) {
		writeFileSync(join(app, path), readFileSync(join(starter, path)));
	}
	return appScript(app, "ready", [], ["NODE_OPTIONS=--conditions=source"]);
}
