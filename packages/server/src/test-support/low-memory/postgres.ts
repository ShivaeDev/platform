import * as NodeServices from "@effect/platform-node/NodeServices";
import { Effect } from "effect";
import { ChildProcessSpawner } from "effect/process";
import { SqlClient } from "effect/sql";
import { applyLowMemoryPostgres } from "@shivaedev/sql/applyLowMemoryPostgres.ts";
import { environmentVariable } from "@shivaedev/test-sql/server/adapters/environmentVariable.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { type Consumer, startConsumer } from "#test/low-memory/consumer.ts";
import { cgroupMemory, command, connect, DATA_DIRECTORY, type Machine, machine, ready } from "#test/low-memory/machine.ts";
import { trimPostgresPageCache } from "#trimPostgresPageCache.ts";

interface State {
	consumer?: Consumer;
	readonly machine: Machine;
	pointInTimeRecovery: boolean;
}

function admin<A, E, R>(state: State, action: Effect.Effect<A, E, R>) {
	return action.pipe(Effect.provide(state.machine.layer), Effect.scoped);
}

function consumer(state: State) {
	if (state.consumer === undefined) {
		throw new Error("Start the consumer first");
	}
	return state.consumer;
}

export const lowMemoryPostgres = storyKit({
	clock: "live",
	*create() {
		const state: State = { machine: yield* machine, pointInTimeRecovery: false };
		return state;
	},
	inspect: (state) => ({ container: state.machine.container, pointInTimeRecovery: state.pointInTimeRecovery }),
	layer: NodeServices.layer,
	name: "low-memory PostgreSQL",
	runIf: environmentVariable("PLATFORM_SQL_TEST_DATABASE_URL") !== undefined,
	stages: ["configured"],
	verbs: (state, story) => ({
		applyPreset: () => {
			story.tell("the database owner applies the low-memory preset");
			return admin(state, applyLowMemoryPostgres({ pointInTimeRecovery: state.pointInTimeRecovery }));
		},
		cgroupMemory: () => cgroupMemory(state.machine.container),
		configureArchiveTimeout: (seconds: number) =>
			admin(
				state,
				SqlClient.SqlClient.use((sql) => sql.unsafe(`ALTER SYSTEM SET archive_timeout = '${seconds}'`)),
			),
		nextHint: () => consumer(state).feed.next,
		publishChange: () => {
			story.tell("the consumer commits a write and its change key");
			return consumer(state).publishChange();
		},
		restart: () => {
			story.tell("the operator restarts PostgreSQL to activate shared-memory settings");
			return Effect.gen(function* () {
				yield* command("docker", ["restart", state.machine.container]);
				yield* ready(state.machine.container);
				Object.assign(state.machine, yield* connect(state.machine.container));
			});
		},
		settings: () =>
			admin(
				state,
				SqlClient.SqlClient.use(
					(sql) => sql<{
						readonly name: string;
						readonly setting: string;
						readonly unit: string | null;
					}>`select name, setting, unit from pg_settings where name in (
			'shared_buffers', 'max_connections', 'wal_buffers', 'jit', 'max_parallel_workers_per_gather',
			'hash_mem_multiplier', 'autovacuum_max_workers', 'autovacuum_work_mem',
			'idle_in_transaction_session_timeout', 'idle_session_timeout', 'wal_compression', 'archive_timeout', 'archive_mode'
		) order by name`,
				).pipe(Effect.map((rows) => Object.fromEntries(rows.map((row) => [row.name, `${row.setting}${row.unit === null ? "" : ` ${row.unit}`}`])))),
			),
		sharedMemory: () =>
			admin(
				state,
				SqlClient.SqlClient.use(
					(sql) => sql<{ readonly bytes: string }>`select sum(allocated_size)::bigint::text as bytes from pg_shmem_allocations`,
				).pipe(Effect.map((rows) => Number(rows[0]?.bytes))),
			),
		startApp: () =>
			Effect.gen(function* () {
				story.tell("a throwaway consumer starts its application database with server's pool lifetime defaults");
				state.consumer = yield* startConsumer(state.machine.url);
			}),
		storedPayloads: () => consumer(state).storedPayloads(),
		trim: () => {
			story.tell("the PGDATA owner trims clean pages without privileges");
			return trimPostgresPageCache(DATA_DIRECTORY).pipe(Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, state.machine.inContainer));
		},
		warmData: () => {
			story.tell("the consumer writes and scans 128 MiB of uncompressed data, checkpointed to make its cache pages clean");
			return consumer(state).warmData();
		},
	}),
});

export const withRecovery = lowMemoryPostgres.trait("configured", "the app explicitly keeps point-in-time recovery", (state) => {
	state.pointInTimeRecovery = true;
});
