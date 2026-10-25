import { Exit } from "effect";
import { expect } from "vitest";
import { postgresStory } from "#test/postgresStory.ts";

for (const fail of [false, true]) {
	postgresStory.it(
		`closes the owned PostgreSQL pool after ${fail ? "failure" : "success"}`,
		[],
		function* ({ poolLifetime }) {
			const result = yield* poolLifetime(fail);
			expect(result.exit).toEqual(fail ? Exit.fail("database caller failed") : Exit.succeed(undefined));
			expect(result.duringBackends).toEqual([{ name: result.name }]);
			expect(result.afterBackends).toEqual([]);
		},
		{ clock: "live" },
	);
}
