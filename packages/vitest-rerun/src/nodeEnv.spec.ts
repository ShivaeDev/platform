import { expect } from "@effect/vitest";
import { rerunStory } from "#test/kit.ts";
import { callerSetsNodeEnv, recordsNodeEnv } from "#test/nodeEnv.ts";

rerunStory.it("a test run with NODE_ENV unset sees test, as under the Vitest CLI", [recordsNodeEnv()], function* ({ nodeEnvSeen, runExecutable }) {
	yield* runExecutable();

	expect(yield* nodeEnvSeen()).toBe("test");
});

rerunStory.it(
	"a test sees the NODE_ENV its caller set",
	[callerSetsNodeEnv("production"), recordsNodeEnv()],
	function* ({ nodeEnvSeen, runExecutable }) {
		yield* runExecutable();

		expect(yield* nodeEnvSeen()).toBe("production");
	},
);
