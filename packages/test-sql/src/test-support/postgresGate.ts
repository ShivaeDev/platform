import { spawnSync } from "node:child_process";
import process from "node:process";
import { Effect } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";

const moduleUrl = new URL("../server/adapters/postgresTestUrl.ts", import.meta.url).href;

export const postgresGate = storyKit({
	create: () => Effect.succeed<{ env: Record<string, string> }>({ env: {} }),
	name: "PostgreSQL test collection",
	stages: ["environment"],
	verbs: (engine, story) => ({
		collect: () =>
			Effect.sync(() => {
				story.tell("the test kit declares its PostgreSQL URL gate");
				const result = spawnSync(
					process.execPath,
					[
						"--conditions=source",
						"--input-type=module",
						"--eval",
						`import { postgresTestUrl } from ${JSON.stringify(moduleUrl)}; console.log(JSON.stringify(postgresTestUrl("PLATFORM_GATE_TEST_DATABASE_URL")));`,
					],
					{ encoding: "utf8", env: engine.env },
				);
				return { error: result.stderr, exitCode: result.status, output: result.stdout.trim() };
			}),
	}),
});

export function databaseEnvironment(url: string | undefined, ci: string | undefined) {
	return postgresGate.trait("environment", `database URL ${JSON.stringify(url)}, CI ${JSON.stringify(ci)}`, (engine) => {
		engine.env = {
			...(url === undefined ? {} : { "PLATFORM_GATE_TEST_DATABASE_URL": url }),
			...(ci === undefined ? {} : { "CI": ci }),
		};
	});
}
