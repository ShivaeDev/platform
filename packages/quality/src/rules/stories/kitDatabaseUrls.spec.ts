import { databaseUrl } from "#rules/stories/databaseUrl.ts";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";
import { assertThat } from "#testing/adapters/assertThat.ts";

for (const [imports, read] of [
	['import { Config } from "effect";', 'Config.String("PLATFORM_SQL_TEST_DATABASE_URL");'],
	['import { Config as Settings } from "effect";', 'Settings.Redacted("TEST_DATABASE_URL");'],
	['import * as Config from "effect/Config";', 'Config.string("DATABASE_URL");'],
	['import * as Fx from "effect";', 'Fx.Config.URL("READ_DATABASE_URL");'],
	['import { Config, Schema } from "effect";', 'Config.schema(Schema.String, "DATABASE_URL");'],
	['import { Config } from "effect";', 'Config.NonEmptyString("DATABASE_URL");'],
	['import { redacted as secret } from "effect/Config";', 'secret("TEST_DATABASE_URL");'],
	['import { Config } from "effect";', 'const name = "DATABASE_URL"; Config["String"](name);'],
	['import { Config } from "effect";', 'const read = Config.String; read("DATABASE_URL");'],
	['import { Config } from "effect";', "Config.String(`DATABASE_URL`).pipe(Config.option);"],
	['import process from "node:process";', "process.env.PLATFORM_SQL_TEST_DATABASE_URL;"],
	['import * as runtime from "node:process";', 'runtime.env["DATABASE_URL"];'],
	['import { env } from "node:process";', "env.TEST_DATABASE_URL;"],
	["", 'process["env"][`DATABASE_URL`];'],
	["", 'const name = "TEST_DATABASE_URL"; process.env[name];'],
	["", "const env = process.env; env.DATABASE_URL;"],
	["", "const { env } = process; env.DATABASE_URL;"],
	["", "const { DATABASE_URL: url } = process.env;"],
] as const) {
	ruleStory.it(
		`tests/database-url locates the direct test-support read ${read}`,
		[repositoryHas({ content: `${imports}\n${read}`, path: "src/test-support/database.ts" })],
		function* ({ check, locations }) {
			yield* check(databaseUrl);

			yield* assertThat(yield* locations(), (actual) => actual.toEqual(["src/test-support/database.ts:2"]));
		},
	);
}

ruleStory.it(
	"tests/database-url explains how to keep missing PostgreSQL URLs from silently skipping in CI",
	[repositoryHas({ content: "process.env.DATABASE_URL;", path: "src/test-support/database.ts" })],
	function* ({ check, messages }) {
		yield* check(databaseUrl);

		yield* assertThat(yield* messages(), (actual) =>
			actual.toEqual([
				"Reads a *DATABASE_URL variable directly in test-support. Use postgresTestUrl(name) from @shivaedev/test-sql/server/adapters/postgresTestUrl.ts so missing PostgreSQL URLs fail in CI instead of silently skipping tests.",
			]),
		);
	},
);

for (const [path, content] of [
	[
		"src/test-support/database.ts",
		'import { postgresTestUrl } from "@shivaedev/test-sql/server/adapters/postgresTestUrl.ts"; postgresTestUrl("DATABASE_URL");',
	],
	["src/server/adapters/postgresTestUrl.ts", "export function postgresTestUrl(name: string) { return process.env[name]; }"],
	["src/test-support/database.ts", 'import { Config } from "effect"; Config.String("TOKEN"); Config.succeed("DATABASE_URL");'],
	["src/test-support/database.ts", 'process.env.DATABASE_URL = "postgresql://localhost/app"; delete process.env.TEST_DATABASE_URL;'],
	["src/database.ts", 'import { Config } from "effect"; Config.Redacted("DATABASE_URL"); process.env.TEST_DATABASE_URL;'],
	["src/test-support/database.ts", 'const process = { env: { DATABASE_URL: "fixture" } }; process.env.DATABASE_URL;'],
	[
		"src/test-support/database.ts",
		'import { Config } from "effect"; function example(Config: { String(name: string): string }) { return Config.String("DATABASE_URL"); }',
	],
	[
		"packages/create-app/src/test-support/environment.ts",
		'import { spawnSync } from "node:child_process"; spawnSync("node", ["app.ts"], { env: { ...process.env, "DATABASE_URL": "postgresql://localhost/app" } });',
	],
	[
		"packages/create-app/src/test-support/databaseProbe.ts",
		"export const child = `const environment = { DATABASE_URL: process.env.DATABASE_URL };`;",
	],
] as const) {
	ruleStory.it(`tests/database-url accepts ${content} in ${path}`, [repositoryHas({ content, path })], function* ({ check, findings }) {
		yield* check(databaseUrl);

		yield* assertThat(yield* findings(), (actual) => actual.toEqual([]));
	});
}

ruleStory.it(
	"tests/database-url still checks create-app kits that read a database URL directly",
	[repositoryHas({ content: "process.env.DATABASE_URL;", path: "packages/create-app/src/test-support/database.ts" })],
	function* ({ check, locations }) {
		yield* check(databaseUrl);

		yield* assertThat(yield* locations(), (actual) => actual.toEqual(["packages/create-app/src/test-support/database.ts:1"]));
	},
);
