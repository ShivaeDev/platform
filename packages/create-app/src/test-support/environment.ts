import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Schema } from "effect";
import { databaseProbe } from "./databaseProbe.ts";

export function appScript(app: string, script: string, args: readonly string[] = []) {
	if (!existsSync(join(app, "node_modules"))) {
		symlinkSync(fileURLToPath(new URL("../../../../examples/starter/node_modules", import.meta.url)), join(app, "node_modules"));
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
			"PLATFORM_EFFECT_SQL_TEST_DATABASE_URL",
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

export function testEnvironment(app: string) {
	writeFileSync(join(app, ".env.local"), "PLATFORM_EFFECT_SQL_TEST_DATABASE_URL=postgresql://invalid:invalid@127.0.0.1:1/invalid\n", { flag: "a" });
	writeFileSync(
		join(app, "environment.config.ts"),
		'export default { resolve: { conditions: ["source"] }, ssr: { resolve: { conditions: ["source"] } }, test: { include: ["src/environment.test.ts"] } };\n',
	);
	writeFileSync(join(app, "src/environment.test.ts"), databaseProbe());
}
