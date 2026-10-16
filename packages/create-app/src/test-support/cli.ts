import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { NodeServices } from "@effect/platform-node";
import { Config, Effect, Schema } from "effect";
import { packTemplate } from "#packTemplate.ts";

const folders: string[] = [];
const cli = fileURLToPath(new URL("../cli.ts", import.meta.url));

export async function packAppTemplate() {
	const root = mkdtempSync(fileURLToPath(new URL("../../node_modules/.create-app-pack-", import.meta.url)));
	folders.push(root);
	const output = join(root, "template.json");
	await Effect.runPromise(
		packTemplate(fileURLToPath(new URL("../../../../examples/starter", import.meta.url)), output).pipe(Effect.provide(NodeServices.layer)),
	);
	renameSync(output, fileURLToPath(new URL("../../template.json", import.meta.url)));
}

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
			"PLATFORM_EFFECT_SQL_TEST_DATABASE_URL=postgresql://127.0.0.1:1/unused",
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
				? `import { Effect } from "effect";\nimport { SqlClient } from "effect/sql";\nimport { postgres } from "#test-support/postgres.ts";\nit("ignores the monorepo database override", async () => { const rows = await Effect.runPromise(Effect.flatMap(SqlClient.SqlClient, sql => sql\`select 1 as value\`).pipe(Effect.provide(postgres))); expect(rows).toEqual([{ value: 1 }]); });\nimport { Pool } from "pg";\nimport { afterAll } from "vitest";\nfor (const [key, name] of [["DATABASE_URL", "${database}_dev"], ["TEST_DATABASE_URL", "${database}_test"]]) { it("prepares " + name, async () => { const pool = new Pool({ connectionString: process.env[key] }); try { expect((await pool.query("SELECT current_database() AS name")).rows).toEqual([{ name }]); } finally { await pool.end(); } }); }\nafterAll(async () => { const url = new URL(process.env.TEST_DATABASE_URL); url.pathname = "/postgres"; const pool = new Pool({ connectionString: url.toString() }); try { await pool.query('DROP DATABASE "${database}_dev"'); await pool.query('DROP DATABASE "${database}_test"'); } finally { await pool.end(); } });\n`
				: ""),
	);
	return {
		prepareDatabases: () => appScript(app, "db:setup"),
		run: () => appScript(app, "test", ["--config", "environment.config.ts"]),
	};
}

export function appFolder({
	installationExit = 0,
	formattingExit = 0,
	destination = "absent",
	umask = 0o022,
}: {
	readonly installationExit?: number;
	readonly formattingExit?: number;
	readonly umask?: number;
	readonly destination?: "absent" | "empty" | "file" | "nonempty" | "environment";
} = {}) {
	const root = mkdtempSync(join(tmpdir(), "create-app-cli-"));
	folders.push(root);
	const bin = join(root, "bin");
	mkdirSync(bin);
	writeFileSync(
		join(bin, "pnpm"),
		`#!/usr/bin/env node\nconst fs = require('node:fs');\nconst calls = fs.existsSync('installation.json') ? JSON.parse(fs.readFileSync('installation.json')) : [];\ncalls.push(process.argv.slice(2));\nfs.writeFileSync('installation.json', JSON.stringify(calls));\nrequire('node:fs').chmodSync('installation.json', 0o644);\nrequire('node:fs').writeFileSync('pnpm-lock.yaml', 'lockfileVersion: 9.0\\n', { mode: 0o600 });\nprocess.exit(process.argv[2] === "format" ? ${formattingExit} : ${installationExit});\n`,
		{ mode: 0o755 },
	);
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
	return {
		root,
		run: (args: readonly string[]) =>
			spawnSync(
				"env",
				[
					`PATH=${bin}:${path}`,
					"NODE_OPTIONS=",
					process.execPath,
					"--conditions=source",
					"--eval",
					`process.umask(${umask}); process.argv.splice(1, 0, ${JSON.stringify(cli)}); import(${JSON.stringify(cli)})`,
					"--",
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
