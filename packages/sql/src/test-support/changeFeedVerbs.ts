import { Deferred, Effect, Exit } from "effect";
import { Migrator, SqlClient } from "effect/sql";
import type { SqlError } from "effect/sql/SqlError";
import { migratePostgres } from "#migrations.ts";
import { withChangeCoverage } from "#testing.ts";
import { type InvalidationKeys, invalidateOnCommit, transact } from "#transact.ts";
import type { Body, Step } from "./body.ts";
import type { ChangeFeedEngine, FeedTables } from "./changeFeedEngine.ts";
import { endingOf, failureOf, outcomeOf } from "./outcome.ts";
import { Rejected, Unavailable } from "./transactionEngine.ts";

function described(error: SqlError) {
	return error.reason._tag === "UnknownError" && error.reason.message !== "" ? error.reason.message : failureOf(error);
}

function onSqlError(error: SqlError) {
	return new Unavailable({ message: `storage unavailable after ${described(error)}` });
}

function owned<TName extends keyof FeedTables>(engine: ChangeFeedEngine, name: TName) {
	const tables = engine.tables[name];
	if (tables === undefined) {
		return Effect.die(new Error(`Give the story the ${name} table first`));
	}
	return Effect.succeed(tables);
}

function aliasOf(engine: ChangeFeedEngine) {
	const names = Object.entries(engine.tables).map(([alias, tables]) => [alias, tables.name] as const);
	return (key: unknown) => {
		const text = String(key);
		const found = names.find(([, name]) => text === name || text.startsWith(`${name}:`));
		return found === undefined ? text : `${found[0]}${text.slice(found[1].length)}`;
	};
}

export function keyOf(engine: ChangeFeedEngine, key: string) {
	const separator = key.indexOf(":");
	const alias = separator === -1 ? key : key.slice(0, separator);
	const tables = Object.entries(engine.tables).find(([name]) => name === alias)?.[1];
	return tables === undefined ? key : `${tables.name}${key.slice(alias.length)}`;
}

function parsed(payload: string): unknown[] {
	const value: unknown = JSON.parse(payload);
	return Array.isArray(value) ? value : [];
}

export function changeFeedVerbs(engine: ChangeFeedEngine, tell: (line: string) => void) {
	const { client, controls, other } = engine;
	const alias = aliasOf(engine);
	function inFeed<A, E, R>(effect: Effect.Effect<A, E, R>) {
		return engine.binding === undefined ? effect : Effect.provideContext(effect, engine.binding);
	}
	function transactOn<A, E, R>(sql: SqlClient.SqlClient, effect: Effect.Effect<A, E, R>) {
		return Effect.map(Effect.exit(inFeed(transact(effect, { onSqlError })).pipe(Effect.provideService(SqlClient.SqlClient, sql))), (exit) => {
			const ending = Exit.isSuccess(exit) ? "committed" : outcomeOf(exit);
			engine.endings.push(ending);
			return ending;
		});
	}
	const delivered = Effect.gen(function* () {
		const sentinel = `sentinel:${crypto.randomUUID()}`;
		const seen = yield* Deferred.make<void>();
		const stop = engine.reactivity.registerUnsafe([sentinel], () => Deferred.doneUnsafe(seen, Exit.void));
		yield* other`select pg_notify(${engine.channel}, ${JSON.stringify([sentinel])})`.pipe(Effect.orDie);
		yield* Deferred.await(seen);
		stop();
	});
	const payloads = Effect.map(delivered, () =>
		controls.payloads
			.map(parsed)
			.filter((keys) => !keys.some((key) => String(key).startsWith("sentinel:")))
			.map((keys) => keys.map(alias)),
	);
	function rows() {
		return Effect.map(owned(engine, "rows"), ({ repository }) => repository);
	}
	function write<A, E, R>(line: string, effect: Effect.Effect<A, E, R>) {
		return Effect.suspend(() => {
			tell(line);
			return inFeed(Effect.asVoid(effect));
		});
	}
	return {
		announce: (keys: InvalidationKeys) => write(`the body announces ${JSON.stringify(keys).slice(0, 60)}`, invalidateOnCommit(keys)),
		announced: () => Effect.map(delivered, () => engine.announced.map(alias)),
		appliedMigrations: () => Effect.sync(() => [...engine.applied]),
		changeReadingAmount: (source: string, sequence: number, amount: number) =>
			Effect.flatMap(owned(engine, "readings"), ({ repository }) =>
				write(`reading ${source} ${sequence} changes its amount to ${amount}`, repository.updateVoid({ amount, sequence, source })),
			),
		checkChangeCoverage: <TStep extends Step, A>(body: Body<TStep, A>) =>
			Effect.suspend(() => {
				tell("the change coverage check runs the body");
				return endingOf(withChangeCoverage(Effect.gen(body)));
			}),
		copySources: (operation: "insertFromSelect" | "insertFromSelectOrIgnore") =>
			Effect.flatMap(Effect.all([owned(engine, "copies"), owned(engine, "sources")]), ([copies, sources]) =>
				write(
					`${operation} copies every source into the copies`,
					copies.repository[operation](sources.repository.select({}), { copiedKey: "sourceKey", name: "name" }),
				),
			),
		deleteDocument: () =>
			Effect.flatMap(owned(engine, "documents"), ({ repository }) =>
				Effect.flatMap(repository.findById(1), (document) =>
					write("document 1 is deleted at its current version", repository.delete(document.id, document.lockVersion)),
				),
			),
		deleteParentlessRows: () =>
			Effect.flatMap(rows(), (repository) => write("every row without a parent is deleted by a filter", repository.delete({ parent: null }))),
		deleteReading: (source: string, sequence: number) =>
			Effect.flatMap(owned(engine, "readings"), ({ repository }) =>
				write(`reading ${source} ${sequence} is deleted`, repository.delete({ sequence, source })),
			),
		deleteRow: (id: number) => Effect.flatMap(rows(), (repository) => write(`row ${id} is deleted`, repository.delete(id))),
		endings: () => Effect.sync(() => [...engine.endings]),
		inOtherTransaction: <TStep extends Step, A>(body: Body<TStep, A>) =>
			Effect.suspend(() => {
				tell("the other client begins a transaction");
				return transactOn(other, Effect.gen(body));
			}),
		insertDocumentVoid: (name: string) =>
			Effect.flatMap(owned(engine, "documents"), ({ repository }) =>
				write(`document ${name} is inserted without returning it`, repository.insertVoid({ name })),
			),
		insertGeneratedRowVoid: () =>
			Effect.flatMap(owned(engine, "generated"), ({ repository }) =>
				write("a row with a generated id is inserted without returning it", repository.insertVoid({})),
			),
		insertReading: (source: string, sequence: number, amount: number) =>
			Effect.flatMap(owned(engine, "readings"), ({ repository }) =>
				write(`reading ${source} ${sequence} is inserted`, repository.insert({ amount, sequence, source })),
			),
		insertRow: (id: number) => Effect.flatMap(rows(), (repository) => write(`row ${id} is inserted`, repository.insert({ id, parent: null }))),
		insertRows: (ids: readonly number[]) =>
			Effect.flatMap(rows(), (repository) =>
				write(`${ids.length} rows are inserted with insertMany`, repository.insertMany(ids.map((id) => ({ id, parent: null })))),
			),
		insertRowsOrIgnore: (ids: readonly number[]) =>
			Effect.flatMap(rows(), (repository) =>
				write(`${ids.length} rows are inserted with insertManyOrIgnore`, repository.insertManyOrIgnore(ids.map((id) => ({ id, parent: null })))),
			),
		insertRowVoid: (id: number) =>
			Effect.flatMap(rows(), (repository) => write(`row ${id} is inserted without returning it`, repository.insertVoid({ id, parent: null }))),
		insertRowWithRawSql: (id: number, parent: number | null = null) =>
			Effect.flatMap(owned(engine, "rows"), ({ name }) =>
				write(
					`row ${id}${parent === null ? "" : ` under parent ${parent}`} is inserted with raw SQL that announces nothing`,
					client`insert into ${client(name)} (id, parent) values (${id}, ${parent})`,
				),
			),
		insertSources: (count: number) =>
			Effect.flatMap(owned(engine, "sources"), ({ repository }) =>
				write(
					`${count} sources are inserted`,
					repository.insertMany(Array.from({ length: count }, (_, index) => ({ name: `source ${index}`, sourceKey: index }))),
				),
			),
		inTransaction: <TStep extends Step, A>(body: Body<TStep, A>) =>
			Effect.suspend(() => {
				tell("the main client begins a transaction");
				return transactOn(client, Effect.gen(body));
			}),
		migrate: (migrations: Readonly<Record<string, () => Generator<Effect.Effect<unknown, unknown, SqlClient.SqlClient>, void, never>>>) =>
			Effect.gen(function* () {
				tell(`the migrator runs ${Object.keys(migrations).join(", ")}`);
				const loader = Migrator.fromRecord(Object.fromEntries(Object.entries(migrations).map(([name, body]) => [name, Effect.gen(body)])));
				const ending = yield* endingOf(
					Effect.tap(inFeed(migratePostgres({ loader, lockTimeout: "5 seconds", table: engine.ledger })), (applied) =>
						Effect.sync(() => engine.applied.push(...applied.map(([id, name]) => `${id}_${name}`))),
					),
				);
				engine.endings.push(ending);
				return ending;
			}),
		published: () => payloads,
		publishedKeys: () => Effect.map(payloads, (keys) => keys.flat()),
		rejects: () =>
			Effect.suspend(() => {
				tell("the body rejects its work");
				return Effect.fail(new Rejected({ message: "rejected" }));
			}),
		renameDocumentVoid: (name: string) =>
			Effect.flatMap(owned(engine, "documents"), ({ repository }) =>
				Effect.flatMap(repository.findById(1), (document) =>
					write(`document 1 is renamed ${name} without returning it`, repository.updateVoid({ ...document, name })),
				),
			),
		storedRows: () =>
			Effect.flatMap(owned(engine, "rows"), ({ name }) =>
				Effect.map(client<{ readonly id: number }>`select id from ${client(name)} order by id`.pipe(Effect.orDie), (found) =>
					found.map(({ id }) => id),
				),
			),
		updateRowParent: (id: number, parent: number) =>
			Effect.flatMap(rows(), (repository) => write(`row ${id} moves under parent ${parent}`, repository.update({ id, parent }))),
		updateRowParentVoid: (id: number, parent: number) =>
			Effect.flatMap(rows(), (repository) =>
				write(`row ${id} moves under parent ${parent} without returning it`, repository.updateVoid({ id, parent })),
			),
		upsertParentlessRows: (ids: readonly number[], parent: number) =>
			Effect.flatMap(rows(), (repository) =>
				write(
					`${ids.length} rows are upserted under parent ${parent}, updating only rows without a parent`,
					repository.upsertMany(
						ids.map((id) => ({ id, parent })),
						{ updateColumns: ["parent"], updateWhere: { parent: null } },
					),
				),
			),
		upsertRowParent: (id: number, parent: number) =>
			Effect.flatMap(rows(), (repository) =>
				write(`row ${id} is upserted under parent ${parent}`, repository.upsert({ id, parent }, { updateColumns: ["parent"] })),
			),
		upsertRows: (ids: readonly number[], parent: number) =>
			Effect.flatMap(rows(), (repository) =>
				write(
					`${ids.length} rows are upserted under parent ${parent}`,
					repository.upsertMany(
						ids.map((id) => ({ id, parent })),
						{ updateColumns: ["parent"] },
					),
				),
			),
	};
}
