import process from "node:process";
import { fileURLToPath } from "node:url";
import * as NodeServices from "@effect/platform-node/NodeServices";
import * as PgClient from "@effect/sql-pg/PgClient";
import { Cause, Config, Duration, Effect, Exit, Fiber, Layer, Option, Predicate, Redacted } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import { SqlClient } from "effect/sql";
import { TestClock } from "effect/testing";
import type { SchemaComponent } from "@shivaedev/sql/SchemaComponent.ts";
import { answered, causeWords, countWords, errorWords } from "@shivaedev/test/answers.ts";
import { environmentVariable } from "@shivaedev/test-sql/server/adapters/environmentVariable.ts";
import { disconnectProxy } from "@shivaedev/test-sql/server/disconnectProxy.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { type BootedHost, bootMigrations } from "#test/app-host/bootMigrations.ts";
import { migrationLoader } from "#test/app-host/migrationLoader.ts";

export interface MigrationState {
	booted?: BootedHost;
	gate?: Effect.Success<ReturnType<typeof disconnectProxy>>;
	hostUrl: Redacted.Redacted;
	interruption?: Fiber.Fiber<unknown>;
	readonly lifecycle: string[];
	readonly migrations: { readonly components: SchemaComponent[]; readonly loader: ReturnType<typeof migrationLoader>; readonly table: string };
	step: string;
	readonly table: string;
	readonly url: Redacted.Redacted;
}

const create = Effect.fnUntraced(function* () {
	const url = yield* Config.Redacted("PLATFORM_SQL_TEST_DATABASE_URL");
	const table = `waiting_${crypto.randomUUID().replaceAll("-", "")}`;
	const ledger = `${table}_migrations`;
	const sql = yield* SqlClient.SqlClient;
	yield* Effect.addFinalizer(() => sql`drop table if exists ${sql(table)}, ${sql(ledger)}`.pipe(Effect.orDie));
	const lifecycle: string[] = [];
	const components: SchemaComponent[] = [];
	const state: MigrationState = {
		hostUrl: url,
		lifecycle,
		migrations: { components, loader: migrationLoader(table), table: ledger },
		step: "not started",
		table,
		url,
	};
	return state;
});

function bootedOf(state: MigrationState) {
	if (state.booted === undefined) {
		throw new Error("Start the host before reading its boot");
	}
	return state.booted;
}

const migrate = Effect.fnUntraced(function* (state: MigrationState, initialOnly: boolean) {
	const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
	const env = {
		"DATABASE_URL": Redacted.value(state.url),
		"HOST_JOBS_SCHEMA": state.migrations.components.length > 0 ? `${state.table}_jobs` : "",
		"HOST_MIGRATION_TABLE": state.table,
	};
	const child = yield* spawner.spawn(
		ChildProcess.make(
			process.execPath,
			["--conditions=source", fileURLToPath(new URL("./migrationProcess.ts", import.meta.url)), initialOnly ? "initial" : "all"],
			{ env, extendEnv: true, stderr: "inherit" },
		),
	);
	const exitCode = yield* child.exitCode;
	if (exitCode !== 0) {
		return yield* Effect.die(new Error(`The migration process exited with ${exitCode}`));
	}
}, Effect.provide(NodeServices.layer));

function messageOf(entry: ReturnType<BootedHost["migrationLogs"]>[number]) {
	return entry.message.join(" ");
}

function failureOf(error: unknown) {
	return {
		error: errorWords(error),
		kind: Predicate.hasProperty(error, "kind") ? error.kind : undefined,
		message: Predicate.hasProperty(error, "message") ? error.message : undefined,
	};
}

const startupFailure = Effect.fnUntraced(function* (booted: BootedHost) {
	const exit = yield* booted.exit;
	return Exit.isFailure(exit)
		? Option.match(Cause.findErrorOption(exit.cause), { onNone: () => causeWords(exit.cause), onSome: failureOf })
		: "started";
});

export const migrationHost = storyKit({
	clock: "test",
	create,
	layer: Layer.unwrap(Effect.map(Config.Redacted("PLATFORM_SQL_TEST_DATABASE_URL"), (url) => PgClient.layer({ url }))),
	name: "migration wait",
	runIf: environmentVariable("PLATFORM_SQL_TEST_DATABASE_URL") !== undefined,
	stages: ["schema"],
	verbs: (state, story) => ({
		anotherProcessMigrates: () => {
			story.tell("a separate process applies all migrations");
			return migrate(state, false);
		},
		applicationLifecycle: () => Effect.sync(() => state.lifecycle),
		bootStep: () => Effect.sync(() => state.step),
		checkStartup: () => {
			story.tell("a host starts in check mode");
			return Effect.flatMap(bootMigrations(state, { mode: "check" }), startupFailure);
		},
		hostEnding: () =>
			Effect.flatMap(
				Effect.sync(() => bootedOf(state)),
				(booted) => Effect.map(booted.exit, (exit) => (Exit.isSuccess(exit) ? "ended" : causeWords(exit.cause))),
			),
		hostStarts: (options?: Parameters<typeof bootMigrations>[1]) => {
			story.tell(
				`the host starts in ${options?.mode ?? "wait"} mode${options?.release === undefined ? "" : ` expecting release ${options.release}`}`,
			);
			return Effect.gen(function* () {
				state.booted = yield* bootMigrations(state, options);
				state.step = yield* state.booted.next;
			});
		},
		interruptionProgress: () =>
			Effect.sync(() => {
				if (state.interruption === undefined) {
					return "not interrupted";
				}
				return state.interruption.pollUnsafe() === undefined ? "waiting for the pool to disconnect" : "finished";
			}),
		migrationLog: (message: string) =>
			Effect.sync(() => {
				const entry = bootedOf(state)
					.migrationLogs()
					.find((candidate) => messageOf(candidate) === message);
				return entry === undefined ? `no log saying ${message}` : { annotations: entry.annotations, level: entry.level };
			}),
		migrationLogMessages: () => Effect.sync(() => bootedOf(state).migrationLogs().map(messageOf)),
		openPoolConnections: () =>
			Effect.sync(() =>
				state.gate === undefined ? "no gate between the host and PostgreSQL" : countWords(state.gate.openClients(), "open connection"),
			),
		peerAcknowledgesDisconnects: () => {
			story.tell("PostgreSQL's disconnect acknowledgements reach the host");
			return Effect.gen(function* () {
				state.gate?.release();
				if (state.interruption !== undefined) {
					yield* Fiber.await(state.interruption);
				}
			});
		},
		pingHost: () => answered(Effect.suspend(() => bootedOf(state).ping)),
		pollBudgetExpires: () => {
			story.tell("poll intervals pass until the wait budget expires");
			return Effect.gen(function* () {
				while (state.step.startsWith("sleeps ")) {
					yield* TestClock.adjust(Number(state.step.split(" ")[1]));
					state.step = yield* bootedOf(state).next;
				}
			});
		},
		pollIntervalPasses: () => {
			story.tell("the poll interval passes");
			return Effect.gen(function* () {
				yield* TestClock.adjust(Number(state.step.split(" ")[1]));
				state.step = yield* bootedOf(state).next;
			});
		},
		startupFailure: () =>
			Effect.flatMap(
				Effect.sync(() => bootedOf(state)),
				startupFailure,
			),
		theHostIsInterrupted: () => {
			story.tell("the waiting host is interrupted while PostgreSQL holds its disconnect acknowledgements");
			return Effect.gen(function* () {
				state.interruption = yield* Fiber.interrupt(bootedOf(state).fiber).pipe(Effect.forkScoped);
				if (state.gate !== undefined) {
					yield* Effect.promise(() => state.gate?.disconnecting ?? Promise.resolve());
				}
			});
		},
		timePasses: (duration: Duration.Input) => {
			story.tell(`${Duration.format(Duration.fromInputUnsafe(duration))} pass`);
			return TestClock.adjust(duration);
		},
	}),
});

export const invalidLedger = migrationHost.trait("schema", "the ledger is missing its name column", function* (state) {
	const sql = yield* SqlClient.SqlClient;
	yield* sql`create table ${sql(state.migrations.table)} (migration_id integer primary key)`;
});

export const migrated = migrationHost.trait("schema", "another process has applied all migrations", (state) => migrate(state, false));

export const initiallyMigrated = migrationHost.trait("schema", "another process has applied only the initial migration", (state) =>
	migrate(state, true),
);

export const heldDisconnects = migrationHost.trait(
	"schema",
	"the host reaches PostgreSQL through a gate that holds disconnect acknowledgements",
	function* (state) {
		const gate = yield* disconnectProxy(Redacted.value(state.url), { holdDisconnects: true });
		yield* Effect.addFinalizer(() => Effect.sync(gate.release));
		state.gate = gate;
		state.hostUrl = Redacted.make(gate.url);
	},
);
