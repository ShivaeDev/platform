import * as PgClient from "@effect/sql-pg/PgClient";
import { Cause, Context, Deferred, Effect, Exit, Logger, Queue, Scope } from "effect";
import { SqlClient, Statement } from "effect/sql";
import * as TestClock from "effect/testing/TestClock";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { coordinateWorkerRelease } from "#coordinateWorkerRelease.ts";
import { postgresRelease } from "#postgresRelease.ts";
import { releaseWorkers } from "#releaseWorkers.ts";
import { onPostgres } from "./engines.ts";

type Loop = "heartbeat" | "poll";

function inWords(cause: string) {
	return cause.includes("Connection closed") ? "connection closed" : (cause.split("\n")[0] ?? "");
}

function messageOf(message: unknown) {
	return Array.isArray(message) ? message.map(String).join(" ") : String(message);
}

const handoverEngine = Effect.fnUntraced(function* () {
	const sql = yield* SqlClient.SqlClient;
	const client = yield* PgClient.PgClient;
	const ledger = `handover_${crypto.randomUUID().replaceAll("-", "")}_ledger`;
	yield* Effect.addFinalizer(() =>
		Effect.forEach([`${ledger}_release`, `${ledger}_workers`], (name) => sql`drop table if exists ${sql(name)}`).pipe(Effect.orDie),
	);
	yield* postgresRelease("first", ledger).apply;
	const channel = `${ledger}_ticks`;
	const heartbeats = yield* client.listen(channel);
	const trigger = `${ledger}_heartbeat`;
	yield* sql.unsafe(`create function "${trigger}"() returns trigger language plpgsql as $$
		begin perform pg_notify('${channel}', 'heartbeat'); return new; end $$`);
	yield* Effect.addFinalizer(() => sql`drop function ${sql(trigger)}() cascade`.pipe(Effect.orDie));
	yield* sql.unsafe(`create trigger heartbeat after update on "${ledger}_workers" for each row execute function "${trigger}"()`);
	const scope = yield* Scope.fork(yield* Effect.scope);
	const draining = yield* Deferred.make<void>();
	const drained = yield* Deferred.make<void>();
	const closed = yield* Deferred.make<Exit.Exit<unknown, unknown>>();
	const warnings = yield* Queue.unbounded<string>();
	const logged: string[] = [];
	const loggers = yield* Logger.CurrentLoggers;
	const logger = Logger.make((options) => {
		if (options.logLevel === "Warn") {
			const warning = `${messageOf(options.message)}: ${inWords(Cause.pretty(options.cause))}`;
			logged.push(warning);
			Queue.offerUnsafe(warnings, warning);
		}
	});
	const fault: { loop: Loop | undefined; permanent: boolean } = { loop: undefined, permanent: false };
	let observedScope = false;
	function targetsFault(query: string) {
		switch (fault.loop) {
			case "heartbeat":
				return query.startsWith(`update "${ledger}_workers"`);
			case "poll":
				return query.includes(`from "${ledger}_release"`);
			case undefined:
				return false;
		}
	}
	const gate = yield* coordinateWorkerRelease("first", "1 second", ledger).pipe(
		Scope.provide(scope),
		Effect.provideService(Logger.CurrentLoggers, new Set([...loggers, logger])),
		Effect.provideService(Statement.CurrentTransformer, (statement, sqlConstructor, fiber) =>
			Effect.gen(function* () {
				if (!observedScope) {
					observedScope = true;
					yield* Scope.addFinalizerExit(Context.getUnsafe(fiber.context, Scope.Scope), (exit) => Deferred.succeed(closed, exit));
				}
				const [query, params] = statement.compile();
				if (!targetsFault(query)) {
					return statement;
				}
				if (!fault.permanent) {
					fault.loop = undefined;
				}
				return sqlConstructor.unsafe(`${query} ${query.startsWith("update") ? "returning" : ","} pg_terminate_backend(pg_backend_pid())`, params);
			}),
		),
	);
	yield* gate.register((active) => (active ? Effect.void : Deferred.succeed(draining, undefined).pipe(Effect.andThen(Deferred.await(drained)))));
	yield* Effect.addFinalizer(() => Deferred.succeed(drained, undefined));
	return {
		closed,
		draining,
		fault,
		heartbeats,
		logged,
		recordSecondRelease: postgresRelease("second", ledger).apply,
		second: yield* releaseWorkers("second", 5000, ledger),
		warnings,
	};
});

type HandoverEngine = Effect.Success<ReturnType<typeof handoverEngine>>;

const POLL_INTERVAL = "1 second";
const RETRY_DELAY = "250 millis";

function arm(engine: HandoverEngine, loop: Loop, permanent: boolean) {
	return Effect.sync(() => {
		engine.fault.loop = loop;
		engine.fault.permanent = permanent;
	});
}

export const workerHandover = storyKit({
	...onPostgres,
	clock: "test",
	create: handoverEngine,
	inspect: (engine) => ({ fault: engine.fault, warnings: engine.logged }),
	name: "worker release handover",
	stages: ["release"],
	verbs: (engine, story) => ({
		connectionBlipsOnce: (loop: Loop) =>
			Effect.suspend(() => {
				story.tell(`the ${loop} loop's next query loses its connection once`);
				return arm(engine, loop, false);
			}),
		connectionDiesFor: (loop: Loop) =>
			Effect.suspend(() => {
				story.tell(`every ${loop} query from now on loses its connection`);
				return arm(engine, loop, true);
			}),
		drainStarts: () => Effect.as(Deferred.await(engine.draining), "draining"),
		drainState: () => Effect.map(Deferred.isDone(engine.draining), (done) => (done ? "draining" : "not draining")),
		loggedWarnings: () => Effect.sync(() => [...engine.logged]),
		nextHeartbeat: () => Effect.as(Queue.take(engine.heartbeats), "a heartbeat").pipe(Effect.orDie),
		nextWarning: () => Queue.take(engine.warnings),
		owningScopeEnding: () =>
			Effect.map(Deferred.await(engine.closed), (exit) =>
				Exit.isFailure(exit) ? `failed with ${inWords(Cause.pretty(exit.cause))}` : "clean shutdown",
			),
		pollIntervalPasses: () =>
			Effect.suspend(() => {
				story.tell(`the ${POLL_INTERVAL} poll interval passes`);
				return TestClock.adjust(POLL_INTERVAL);
			}),
		retriesRunOut: () =>
			Effect.gen(function* () {
				story.tell(`the poll interval passes, then the ${RETRY_DELAY} retry delay passes after each of the three retries' failures`);
				yield* TestClock.adjust(POLL_INTERVAL);
				for (let retry = 0; retry < 3; retry += 1) {
					yield* Queue.take(engine.warnings);
					yield* TestClock.adjust(RETRY_DELAY);
				}
				yield* Queue.take(engine.warnings);
			}),
		retryDelayPasses: () =>
			Effect.suspend(() => {
				story.tell(`the ${RETRY_DELAY} retry delay passes`);
				return TestClock.adjust(RETRY_DELAY);
			}),
		secondReleaseClaims: () =>
			Effect.suspend(() => {
				story.tell("a worker of the second release tries to claim its process row");
				return Effect.map(engine.second.claim, (claimed) => (claimed ? "claimed" : "refused"));
			}).pipe(Effect.orDie),
	}),
});

export function secondReleaseRecorded() {
	return workerHandover.trait("release", "the second release is recorded as the database's owner", (engine) =>
		Effect.orDie(engine.recordSecondRelease),
	);
}

export function drainingForSecondRelease() {
	return workerHandover.trait(
		"release",
		"the second release is recorded, and after one poll the first release's worker drains while its heartbeat beats",
		(engine) =>
			Effect.gen(function* () {
				yield* Effect.orDie(engine.recordSecondRelease);
				yield* TestClock.adjust(POLL_INTERVAL);
				yield* Deferred.await(engine.draining);
				yield* Effect.orDie(Queue.take(engine.heartbeats));
			}),
	);
}
