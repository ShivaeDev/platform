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
		collect: (name = "GATE_TEST_DATABASE_URL") =>
			Effect.sync(() => {
				story.tell("the test kit declares its PostgreSQL URL gate");
				const result = spawnSync(
					process.execPath,
					[
						"--conditions=@shivaedev/source",
						"--input-type=module",
						"--eval",
						`import { postgresTestUrl } from ${JSON.stringify(moduleUrl)}; console.log(JSON.stringify(postgresTestUrl(${JSON.stringify(name)})));`,
					],
					{ encoding: "utf8", env: engine.env },
				);
				return { error: result.stderr, exitCode: result.status, output: result.stdout.trim() };
			}),
	}),
});

export function databaseEnvironment(url: string | undefined, ci: string | undefined, name = "GATE_TEST_DATABASE_URL") {
	return postgresGate.trait("environment", `${name} ${JSON.stringify(url)}, CI ${JSON.stringify(ci)}`, (engine) => {
		engine.env = {
			...(url === undefined ? {} : { [name]: url }),
			...(ci === undefined ? {} : { "CI": ci }),
		};
	});
}
