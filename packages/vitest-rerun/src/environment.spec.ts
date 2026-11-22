import { expect } from "@effect/vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { callerSets, configAndGlobalSetupRecordEnvironment, recordsNodeEnv } from "#test/environment.ts";
import { passes, rerunStory } from "#test/kit.ts";

rerunStory.it("a test run with NODE_ENV unset sees test, as under the Vitest CLI", [recordsNodeEnv()], function* ({ nodeEnvSeen, runExecutable }) {
	yield* runExecutable();

	expect(yield* nodeEnvSeen()).toBe("test");
});

rerunStory.it(
	"a test sees the NODE_ENV its caller set",
	[callerSets({ "NODE_ENV": "production" }), recordsNodeEnv()],
	function* ({ nodeEnvSeen, runExecutable }) {
		yield* runExecutable();

		expect(yield* nodeEnvSeen()).toBe("production");
	},
);

const CLI_ENVIRONMENT = { "NODE_ENV": "test", "TEST": "true", "VITEST": "true" };

rerunStory.it(
	"with NODE_ENV, TEST and VITEST unset, the config and the global setup see NODE_ENV=test, TEST=true and VITEST=true, as under the Vitest CLI",
	[configAndGlobalSetupRecordEnvironment(), passes()],
	function* ({ environmentSeen, runExecutable }) {
		yield* runExecutable();

		yield* outcomes([
			["config", () => environmentSeen("config"), CLI_ENVIRONMENT],
			["global setup", () => environmentSeen("global setup"), CLI_ENVIRONMENT],
		]);
	},
);

const CALLER_ENVIRONMENT = { "TEST": "false", "VITEST": "false" };

rerunStory.it(
	"the config and the global setup see the TEST and VITEST their caller set",
	[callerSets(CALLER_ENVIRONMENT), configAndGlobalSetupRecordEnvironment(), passes()],
	function* ({ environmentSeen, runExecutable }) {
		yield* runExecutable();

		yield* outcomes([
			["config", () => environmentSeen("config"), CALLER_ENVIRONMENT],
			["global setup", () => environmentSeen("global setup"), CALLER_ENVIRONMENT],
		]);
	},
);
