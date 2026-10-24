import { Effect, Layer } from "effect";
import { SqlClient } from "effect/sql";
import type { Fleet } from "#fleet.ts";
import { daemonLayer } from "#host/daemon.ts";
import { readWaitStates } from "#host/readWaitStates.ts";
import type { HostStoryEngine } from "#test/HostStoryEngine.ts";
import { hostDatabase } from "#test/hostDatabase.ts";

export function hostDatabaseVerbs(engine: HostStoryEngine, tell: (line: string) => void) {
	return {
		bootScheduler: () => {
			tell("boot the full Fleet daemon and scheduler");
			const resources = engine.resources;
			if (resources === undefined) {
				return Effect.die("Deploy host resources before booting the scheduler");
			}
			return Effect.scoped(Layer.build(daemonLayer(engine.fixture.host, { ...engine.fixture.parts, provider: resources.provider }, 0)));
		},
		configurationFile: () => engine.fixture.configFile,
		dispatchStatus: (workId: string) => engine.running.client("daemon.dispatch-status", { workId }),
		dropTable: (table: string) => {
			tell(`drop the running daemon's ${table} table`);
			return Effect.flatMap(SqlClient.SqlClient, (sql) => sql`drop table ${sql(`${engine.fixture.host.namespace}_${table}`)} cascade`).pipe(
				Effect.provide(hostDatabase(engine.fixture.host, "fleet-story-control", 1)),
			);
		},
		prepare: (input: Parameters<typeof Fleet.Service.prepare>[0]) => engine.running.client("fleet.prepare", input),
		readSummaries: (ids?: readonly string[]) =>
			readWaitStates(engine.fixture.host, ids).pipe(Effect.provide(hostDatabase(engine.fixture.host, "fleet-story-summary", 1))),
	};
}
