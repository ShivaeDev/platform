import { expect } from "vitest";
import { listenerStartupStory } from "#test/listenerStartupStory.ts";

listenerStartupStory.it(
	"a PostgreSQL LISTEN refusal fails Layer startup with its SQL error and logs the cause",
	[],
	function* ({ refuseListen, startupLogs }) {
		const outcome = yield* refuseListen();

		expect(outcome).toMatchObject({ failure: "SQL failure", reason: "SqlSyntaxError" });
		expect(startupLogs()).toMatchObject([{ cause: expect.stringContaining("zero-length delimited identifier"), level: "Error" }]);
	},
);

for (const phase of ["acquisition", "heartbeat"] as const) {
	listenerStartupStory.it(`a stalled first LISTEN ${phase} fails Layer startup within the heartbeat deadline`, [], function* ({ stallStartup }) {
		const outcome = yield* stallStartup(phase);

		expect(outcome).toMatchObject({ failure: "listener unavailable", setting: "client" });
	});
}
