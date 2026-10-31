import { expect } from "@effect/vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { host } from "#test/hostStory.ts";
import { refusal } from "#test/refusal.ts";

const UNAVAILABLE = expect.stringMatching(/^unavailable: /u);

for (const [table, readout] of [
	["records", "summaries read"],
	["dispatches", "dispatch status"],
] as const) {
	host.it(`a running daemon reports unavailable after its ${table} table is dropped`, [], function* (daemon) {
		yield* outcomes([
			[
				"status",
				() => daemon.status(),
				{
					active: [],
					completed: [],
					config: expect.objectContaining({ file: daemon.configurationFile(), restartRequired: [] }),
					waiting: { automation: [], maintainer: [], orchestrator: [] },
				},
			],
			["dispatch status", () => daemon.dispatchStatus("one"), null],
		]);

		yield* daemon.dropTable(table);

		yield* outcomes([
			["status", () => refusal(daemon.status()), UNAVAILABLE],
			[
				readout,
				() => (table === "dispatches" ? refusal(daemon.dispatchStatus("one")) : refusal(daemon.readSummaries())),
				table === "dispatches" ? UNAVAILABLE : expect.stringMatching(/^database failure: /u),
			],
		]);
	});
}
