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
			expect(result.during).toBe(1);
			expect(result.after).toBe(0);
		},
		{ clock: "live" },
	);
}
