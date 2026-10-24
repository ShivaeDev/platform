import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { ServiceUnavailable } from "@shivaedev/platform/errors/taxonomy.ts";
import { host } from "#test/hostStory.ts";

for (const table of ["records", "dispatches"]) {
	host.it(`a running daemon reports unavailable after its ${table} table is dropped`, [], function* (daemon) {
		expect(yield* daemon.status()).toEqual({
			active: [],
			completed: [],
			config: expect.objectContaining({ file: daemon.configurationFile(), restartRequired: [] }),
			waiting: { automation: [], maintainer: [], orchestrator: [] },
		});
		expect(yield* daemon.dispatchStatus("one")).toBeNull();
		yield* daemon.dropTable(table);
		expect(yield* daemon.status().pipe(Effect.flip)).toBeInstanceOf(ServiceUnavailable);
		if (table === "dispatches") {
			expect(yield* daemon.dispatchStatus("one").pipe(Effect.flip)).toBeInstanceOf(ServiceUnavailable);
		} else {
			expect((yield* daemon.readSummaries().pipe(Effect.flip))._tag).toBe("SqlError");
		}
	});
}
