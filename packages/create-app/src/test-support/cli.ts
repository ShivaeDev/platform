import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { Config, Effect, Schema } from "effect";
import { setupInstaller } from "./setupInstaller.ts";

const folders: string[] = [];
const cli = fileURLToPath(new URL("../cli.ts", import.meta.url));

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

export function testEnvironment(app: string, { databases = false, name = "my-app" } = {}) {
	const database = name.replaceAll("-", "_");
	writeFileSync(join(app, "environment.config.ts"), 'export default { test: { include: ["src/environment.test.ts"] } };\n');
	writeFileSync(
		join(app, "src/environment.test.ts"),
		`import process from "node:process";\nimport { expect, it } from "vitest";\nit("loads test database", () => expect(process.env.TEST_DATABASE_URL).toBe("postgresql://postgres:postgres@127.0.0.1:55432/${database}_test"));\n`
			+ (databases
				? `import { Pool } from "pg";\nimport { afterAll } from "vitest";\nfor (const [key, name] of [["DATABASE_URL", "${database}_dev"], ["TEST_DATABASE_URL", "${database}_test"]]) { it("prepares " + name, async () => { const pool = new Pool({ connectionString: process.env[key] }); try { expect((await pool.query("SELECT current_database() AS name")).rows).toEqual([{ name }]); } finally { await pool.end(); } }); }\nafterAll(async () => { const url = new URL(process.env.TEST_DATABASE_URL); url.pathname = "/postgres"; const pool = new Pool({ connectionString: url.toString() }); try { await pool.query('DROP DATABASE "${database}_dev"'); await pool.query('DROP DATABASE "${database}_test"'); } finally { await pool.end(); } });\n`
				: ""),
	);
	return {
		prepareDatabases: () => appScript(app, "db:setup"),
		run: () => appScript(app, "test", ["--config", "environment.config.ts"]),
	};
}

export function appFolder({
	installationExit = 0,
	gitAvailable = true,
	realSetup = false,
	typecheckExit,
	destination = "absent",
}: {
	readonly installationExit?: number;
	readonly gitAvailable?: boolean;
	readonly realSetup?: boolean;
	readonly typecheckExit?: number;
	readonly destination?: "absent" | "empty" | "file" | "nonempty" | "environment";
} = {}) {
	const root = mkdtempSync(join(tmpdir(), "create-app-cli-"));
	folders.push(root);
	const bin = join(root, "bin");
	mkdirSync(bin);
	writeFileSync(
		join(bin, "pnpm"),
		`#!/usr/bin/env node\nrequire('node:fs').writeFileSync('installation.json', JSON.stringify(process.argv.slice(2)));\nrequire('node:fs').writeFileSync('pnpm-lock.yaml', 'lockfileVersion: 9.0\\n');\nprocess.exit(${installationExit});\n`,
		{ mode: 0o755 },
	);
	if (realSetup) {
		const pnpm = spawnSync("which", ["pnpm"], { encoding: "utf8" }).stdout.trim();
		const modules = fileURLToPath(new URL("../../../../examples/starter/node_modules", import.meta.url));
		writeFileSync(join(bin, "pnpm"), setupInstaller(pnpm, modules, typecheckExit), { mode: 0o755 });
	}
	const target = join(root, "my-app");
	if (["empty", "nonempty", "environment"].includes(destination)) {
		mkdirSync(target);
	}
	if (destination === "nonempty") {
		writeFileSync(join(target, ".keep"), "user data");
	}
	if (destination === "environment") {
		writeFileSync(join(target, ".env.local"), "user settings");
	}
	if (destination === "file") {
		writeFileSync(target, "user data");
	}
	const path = Effect.runSync(Config.String("PATH"));
	if (!gitAvailable) {
		symlinkSync(process.execPath, join(bin, "node"));
	}
	return {
		root,
		run: (args: readonly string[], environment: readonly string[] = []) =>
			spawnSync(
				"env",
				[
					"-u",
					"GIT_AUTHOR_NAME",
					"-u",
					"GIT_AUTHOR_EMAIL",
					"-u",
					"GIT_COMMITTER_NAME",
					"-u",
					"GIT_COMMITTER_EMAIL",
					`PATH=${gitAvailable ? `${bin}:${path}` : bin}`,
					"NODE_OPTIONS=",
					"GIT_CONFIG_NOSYSTEM=1",
					"GIT_CONFIG_GLOBAL=/dev/null",
					...environment,
					process.execPath,
					"--conditions=source",
					cli,
					...args,
				],
				{
					cwd: root,
					encoding: "utf8",
				},
			),
	};
}

export function cleanup() {
	for (const folder of folders.splice(0)) {
		rmSync(folder, { force: true, recursive: true });
	}
}
