import process from "node:process";
import { type Context, Deferred, Effect, Exit, Fiber, Layer, Queue, type Redacted, Scope } from "effect";
import { SqlClient } from "effect/sql";
import type { PostgresTestDatabase, PostgresTestServices } from "#database.ts";
import { databaseId } from "#internal/databaseOwner.ts";
import { makePostgresTestLayer, type PostgresTestOptions } from "#postgres.ts";
import { withIsolatedDatabase } from "#withIsolatedDatabase.ts";
import { withTestTransaction } from "#withTestTransaction.ts";
import { outcomeOf } from "./outcome.ts";
import { setup } from "./postgres.ts";

export type Services = PostgresTestServices | PostgresTestDatabase;
type Command = Effect.Effect<boolean, unknown, Services | Scope.Scope>;

export interface Block {
	readonly commands: Queue.Queue<Command>;
	database: string;
	readonly fiber: Fiber.Fiber<unknown, unknown>;
}

const ownDatabase = new RegExp(`^effect_test_[a-f0-9]{8}_${process.pid}_[a-f0-9]{32}$`, "u");

export const currentDatabase = Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;
	const [row] = yield* sql<{ name: string }>`select current_database() as name`;
	return row?.name ?? "";
});

const serve = Effect.fnUntraced(function* (commands: Queue.Queue<Command>) {
	let done = false;
	while (!done) {
		done = yield* Effect.flatten(Queue.take(commands));
	}
});

function endedBefore(name: string, exit: Exit.Exit<unknown, unknown>) {
	return Effect.die(new Error(`${name} ended before it ran the step: ${outcomeOf(exit)}.`));
}

export class DatabaseEngine {
	readonly fixture = setup();
	options: PostgresTestOptions<unknown> = this.fixture.options;
	services: Context.Context<Services> | undefined;
	start = "not started";
	template = "";
	shared = "";
	ownDatabases: readonly string[] = [];
	before: ReadonlySet<string> = new Set();
	readonly blocks = new Map<string, Block>();
	readonly endings = new Map<string, string>();
	readonly published: string[] = [];
	finalizerQuery = "not registered";
	readonly marker: string;

	readonly admin: SqlClient.SqlClient;
	readonly scope: Scope.Closeable;
	constructor(admin: SqlClient.SqlClient, scope: Scope.Closeable, marker: string) {
		this.admin = admin;
		this.scope = scope;
		this.marker = marker;
	}

	recordTemplate() {
		return Effect.map(currentDatabase, (name) => {
			this.template = name;
		});
	}

	databaseNames() {
		return Effect.map(this.admin<{ datname: string }>`select datname from pg_database`, (rows) => rows.map(({ datname }) => datname));
	}

	recordOwnDatabases() {
		return Effect.map(this.databaseNames(), (names) => {
			this.ownDatabases = names.filter((name) => ownDatabase.test(name) && !this.before.has(name));
		});
	}

	recordingTemplate(): PostgresTestOptions<unknown> {
		const fixtures = this.options.fixtures;
		if (fixtures === undefined) {
			return this.options;
		}
		const record = this.recordTemplate();
		return {
			...this.options,
			fixtures: (url: Redacted.Redacted<string>) => Effect.andThen(record, typeof fixtures === "function" ? fixtures(url) : fixtures),
		};
	}

	lease() {
		const engine = this;
		return Effect.gen(function* () {
			engine.before = new Set(yield* engine.databaseNames());
			const exit = yield* Layer.buildWithScope(makePostgresTestLayer(engine.recordingTemplate()), engine.scope).pipe(Effect.exit);
			engine.start = Exit.isSuccess(exit) ? "started" : outcomeOf(exit);
			if (Exit.isSuccess(exit)) {
				yield* engine.recordOwnDatabases();
				engine.services = exit.value;
				engine.shared = yield* currentDatabase.pipe(Effect.provideContext(exit.value));
			}
		});
	}

	run<A, E, R>(effect: Effect.Effect<A, E, R>) {
		return Effect.suspend(() => {
			if (this.services === undefined) {
				return Effect.die(new Error(`The worker did not start: ${this.start}.`));
			}
			return effect.pipe(Effect.provideContext(this.services));
		});
	}

	open(name: string, wrapper: "rollback test" | "isolated block") {
		const engine = this;
		return Effect.gen(function* () {
			const commands = yield* Queue.unbounded<Command>();
			const served = wrapper === "rollback test" ? withTestTransaction(serve(commands)) : withIsolatedDatabase(serve(commands));
			const fiber = yield* engine.run(served).pipe(
				Effect.onExit((exit) => Effect.sync(() => engine.endings.set(name, outcomeOf(exit)))),
				Effect.forkScoped,
			);
			const block: Block = { commands, database: "", fiber };
			engine.blocks.set(name, block);
			block.database = yield* engine.inBlock(name, currentDatabase);
		});
	}

	block(name: string) {
		const block = this.blocks.get(name);
		return block === undefined ? Effect.die(new Error(`Open ${name} with a trait before using it.`)) : Effect.succeed(block);
	}

	inBlock<A, E>(name: string, effect: Effect.Effect<A, E, Services | Scope.Scope>) {
		const engine = this;
		return Effect.gen(function* () {
			const block = yield* engine.block(name);
			const answer = yield* Deferred.make<A, E>();
			yield* Queue.offer(
				block.commands,
				effect.pipe(
					Effect.exit,
					Effect.flatMap((exit) => Deferred.done(answer, exit)),
					Effect.as(false),
				),
			);
			return yield* Effect.raceFirst(
				Deferred.await(answer),
				Effect.flatMap(Fiber.await(block.fiber), (exit) => endedBefore(name, exit)),
			);
		});
	}

	end(name: string, ending: Effect.Effect<void, unknown>) {
		const engine = this;
		return Effect.gen(function* () {
			const block = yield* engine.block(name);
			yield* Queue.offer(block.commands, Effect.as(ending, true));
			yield* Fiber.await(block.fiber);
		});
	}

	interrupt(name: string) {
		return Effect.flatMap(this.block(name), (block) => Fiber.interrupt(block.fiber));
	}

	close() {
		return Scope.close(this.scope, Exit.void);
	}
}

export const createDatabaseEngine = Effect.gen(function* () {
	const admin = yield* SqlClient.SqlClient;
	const scope = yield* Effect.acquireRelease(Scope.make(), (leaseScope) => Scope.close(leaseScope, Exit.void));
	return new DatabaseEngine(admin, scope, `story_${yield* databaseId}`);
});
