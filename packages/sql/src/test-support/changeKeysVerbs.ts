import { Cause, Effect, Exit, Option, Order } from "effect";
import { type BucketKey, type ItemKey, invalidationKeys, type Key } from "@shivaedev/changes/keys.ts";
import { expectPublished, UnannouncedWrites, withChangeCoverage } from "#testing.ts";
import { ChangeObserver, invalidateOnCommit, transact } from "#transact.ts";
import type { Body, Step } from "./body.ts";
import { type ChangeKeysEngine, keyWords, tableWords } from "./changeKeysEngine.ts";
import { outcomeOf } from "./outcome.ts";
import { Rejected } from "./transactionEngine.ts";

export const ID_BEYOND_NUMBER = 9_007_199_254_740_993n;

export type BucketInsert = "insert" | "insertMany" | "insertOrIgnore" | "insertVoid" | "versionedInsertOrIgnore" | "versionedInsertVoid";
export type BucketMove =
	| "conditionalUpsert"
	| "conditionalUpsertMany"
	| "update"
	| "updateVoid"
	| "upsert"
	| "upsertMany"
	| "versionedUpdate"
	| "versionedUpdateVoid";
export type BucketDelete = "delete" | "versionedDelete";
export type BucketCopy = "insertFromSelect" | "insertFromSelectOrIgnore";
export type OwnedWrite = "delete" | "insertOrIgnore" | "insertVoid" | "update" | "updateVoid";
export type LedgerWrite = "delete" | "insert" | "update";

const RECORD = /^record (?<id>\d+)$/u;
const LIST = /^list (?<id>\d+)$/u;
const OWNER = /^owner (?<name>\w+)$/u;

function failureWords(engine: ChangeKeysEngine, exit: Exit.Exit<unknown, unknown>) {
	const error = Exit.isFailure(exit) ? Option.getOrUndefined(Cause.findErrorOption(exit.cause)) : undefined;
	if (error instanceof UnannouncedWrites) {
		return `failed with unannounced writes to ${error.tables.map((table) => tableWords(engine, table)).join(", ")}`;
	}
	return outcomeOf(exit);
}

export function changeKeysVerbs(engine: ChangeKeysEngine, tell: (line: string) => void) {
	const { buckets, sql } = engine;
	function keyOf(word: string): Key | string {
		const record = RECORD.exec(word)?.groups?.id;
		const list = LIST.exec(word)?.groups?.id;
		const owner = OWNER.exec(word)?.groups?.name;
		if (record !== undefined) {
			return buckets.keys.item(Number(record));
		}
		if (list !== undefined) {
			return buckets.keys.bucket.listId(Number(list));
		}
		return owner === undefined ? word : buckets.keys.bucket.owner(owner);
	}
	function keysOf(words: readonly string[]) {
		const keys = words.map(keyOf);
		const typed = keys.filter((key) => typeof key !== "string");
		return [...invalidationKeys(typed), ...keys.filter((key) => typeof key === "string")];
	}
	function publishedKeyOf(word: string) {
		if (word === "the table") {
			return buckets.tableName;
		}
		const key = keyOf(word);
		return typeof key === "string" ? key : (invalidationKeys([key])[0] ?? word);
	}
	function observed<A, E, R>(effect: Effect.Effect<A, E, R>) {
		if (engine.observing) {
			return effect;
		}
		engine.observing = true;
		return Effect.flatMap(Effect.service(ChangeObserver), (observer) =>
			effect.pipe(
				Effect.provideService(ChangeObserver, (event) => {
					if (event._tag === "Published") {
						for (const key of event.changes) {
							engine.published.add(String(key));
						}
					}
					return observer(event);
				}),
			),
		).pipe(
			Effect.ensuring(
				Effect.sync(() => {
					engine.observing = false;
				}),
			),
		);
	}
	function ended(success: string) {
		return (exit: Exit.Exit<unknown, unknown>) => {
			const ending = Exit.isSuccess(exit) ? success : failureWords(engine, exit);
			engine.endings.push(ending);
			return ending;
		};
	}
	function owned() {
		const table = engine.owned;
		return table === undefined ? Effect.die(new Error("Give the story the owned rows table first")) : Effect.succeed(table);
	}
	function ledger() {
		const table = engine.ledger;
		return table === undefined ? Effect.die(new Error("Give the story the ledger table first")) : Effect.succeed(table);
	}
	const moved = { id: 1, listId: 2, owner: "bob", slug: "note", version: 0 };
	const settings = { updateColumns: ["listId", "owner"] } as const;
	const moves = {
		conditionalUpsert: () => buckets.rows.upsert(moved, { ...settings, updateWhere: { listId: 1 } }),
		conditionalUpsertMany: () => buckets.rows.upsertMany([moved], { ...settings, updateWhere: { listId: 1 } }),
		update: () => buckets.rows.update(moved),
		updateVoid: () => buckets.rows.updateVoid(moved),
		upsert: () => buckets.rows.upsert(moved, settings),
		upsertMany: () => buckets.rows.upsertMany([moved], settings),
		versionedUpdate: () => buckets.versioned.update(moved),
		versionedUpdateVoid: () => buckets.versioned.updateVoid(moved),
	} as const;
	const second = { listId: 2, owner: "bob", slug: "second" };
	const inserts = {
		insert: () => buckets.rows.insert(second),
		insertMany: () => buckets.rows.insertMany([second]),
		insertOrIgnore: () => buckets.rows.insertOrIgnore(second),
		insertVoid: () => buckets.rows.insertVoid(second),
		versionedInsertOrIgnore: () => buckets.versioned.insertOrIgnore(second),
		versionedInsertVoid: () => buckets.versioned.insertVoid(second),
	} as const;
	const deletes = { delete: () => buckets.rows.delete(1), versionedDelete: () => buckets.versioned.delete(1, 0) } as const;
	const ownedWrites = {
		delete: () =>
			Effect.flatMap(owned(), ({ rows }) => Effect.flatMap(rows.findById({ id: 1, ownerId: 2 }), (row) => rows.delete(row, row.lockVersion))),
		insertOrIgnore: () => Effect.flatMap(owned(), ({ rows }) => rows.insertOrIgnore({ id: 1, name: "Draft", ownerId: 2 })),
		insertVoid: () => Effect.flatMap(owned(), ({ rows }) => rows.insertVoid({ id: 1, name: "Draft", ownerId: 2 })),
		update: () =>
			Effect.flatMap(owned(), ({ rows }) =>
				Effect.flatMap(rows.findById({ id: 1, ownerId: 2 }), (row) => rows.update({ ...row, name: "Published" })),
			),
		updateVoid: () =>
			Effect.flatMap(owned(), ({ rows }) =>
				Effect.flatMap(rows.findById({ id: 1, ownerId: 2 }), (row) => rows.updateVoid({ ...row, name: "Final" })),
			),
	} as const;
	const ledgerWrites = {
		delete: () => Effect.flatMap(ledger(), ({ entries }) => entries.delete({ account: "cash", sequence: ID_BEYOND_NUMBER })),
		insert: () => Effect.flatMap(ledger(), ({ entries }) => entries.insert({ account: "cash", amount: "7", sequence: ID_BEYOND_NUMBER })),
		update: () => Effect.flatMap(ledger(), ({ entries }) => entries.update({ account: "cash", amount: "8", sequence: ID_BEYOND_NUMBER })),
	} as const;
	return {
		clearRecordList: () =>
			Effect.suspend(() => {
				tell("record 1 leaves its list, which becomes null");
				return observed(buckets.rows.updateVoid({ id: 1, listId: null, owner: "alice", slug: "note", version: 0 }));
			}),
		copySourceRecordThrough: (operation: BucketCopy) =>
			Effect.suspend(() => {
				tell(`${operation} copies the source record for list 2 and bob into the buckets table`);
				return observed(buckets.rows[operation](buckets.source.select(), { listId: "listId", owner: "owner", slug: "slug" }));
			}),
		deleteRecordThrough: (operation: BucketDelete) =>
			Effect.suspend(() => {
				tell(`${operation} deletes record 1`);
				return observed(deletes[operation]());
			}),
		endings: () => Effect.sync(() => [...engine.endings]),
		expectingPublished: <TStep extends Step, A>(words: readonly string[], body: Body<TStep, A>) =>
			Effect.suspend(() => {
				tell(`expectPublished expects ${words.length === 0 ? "no keys" : words.join(", ")}`);
				return Effect.map(Effect.exit(observed(expectPublished(words.map(publishedKeyOf))(Effect.gen(body)))), ended("matched"));
			}),
		insertRecord: (listId: number, owner: string) =>
			Effect.suspend(() => {
				tell(`a record for list ${listId} and ${owner} is inserted`);
				return observed(buckets.rows.insert({ listId, owner, slug: `note-${engine.endings.length}-${owner}` }));
			}),
		insertRecords: (count: number) =>
			Effect.suspend(() => {
				tell(`one insertMany writes ${count} records for list 1 and alice`);
				return observed(buckets.rows.insertMany(Array.from({ length: count }, (_, index) => ({ listId: 1, owner: "alice", slug: `bulk-${index}` }))));
			}),
		insertRecordThrough: (operation: BucketInsert) =>
			Effect.suspend(() => {
				tell(`${operation} inserts record 2 for list 2 and bob`);
				return observed(inserts[operation]());
			}),
		inTransaction: <TStep extends Step, A>(body: Body<TStep, A>) =>
			Effect.suspend(() => {
				tell("a transaction begins");
				return Effect.map(Effect.exit(observed(transact(Effect.gen(body), { onSqlError: (error) => error }))), ended("committed"));
			}),
		ledgerEntries: () =>
			Effect.flatMap(ledger(), ({ entries }) =>
				Effect.map(entries.findMany(), (rows) => rows.map((row) => `${row.account} ${row.sequence} holds ${row.amount}`)),
			).pipe(Effect.orDie),
		moveRecordThrough: (operation: BucketMove) =>
			Effect.suspend(() => {
				tell(`${operation} moves record 1 from list 1 and alice to list 2 and bob`);
				return observed(moves[operation]());
			}),
		ownedRows: () =>
			Effect.flatMap(owned(), ({ rows }) =>
				Effect.map(rows.findMany(), (found) => found.map((row) => `${row.id}/${row.ownerId} ${row.name} at version ${row.lockVersion}`)),
			).pipe(Effect.orDie),
		publishedKeys: () => Effect.sync(() => [...engine.published].map((key) => keyWords(engine, key)).toSorted(Order.String)),
		record: (words: readonly string[]) =>
			Effect.suspend(() => {
				tell(`the body records ${words.join(", ")}`);
				return invalidateOnCommit(keysOf(words));
			}),
		rejects: () =>
			Effect.suspend(() => {
				tell("the body rejects its work");
				return Effect.fail(new Rejected({ message: "rejected" }));
			}),
		storedRecords: () =>
			Effect.map(buckets.rows.findMany(), (rows) =>
				rows.map((row) => `record ${row.id} in list ${row.listId ?? "none"} for ${row.owner}`).toSorted(Order.String),
			).pipe(Effect.orDie),
		underCoverage: <TStep extends Step, A>(body: Body<TStep, A>, declares: readonly string[] = []) =>
			Effect.suspend(() => {
				tell(
					`a coverage check runs the body${declares.length === 0 ? " with no declarations" : `, declaring ${declares.join(", ")} for the buckets table`}`,
				);
				const typed = declares.map(keyOf).filter((key): key is ItemKey | BucketKey => typeof key !== "string" && key._tag !== "List");
				const options = declares.length === 0 ? undefined : { covers: { [buckets.tableName]: typed } };
				return Effect.map(Effect.exit(observed(withChangeCoverage(Effect.gen(body), options))), ended("covered"));
			}),
		woken: () => Effect.sync(() => engine.woken.toSorted(Order.String)),
		writeLedger: (operation: LedgerWrite) =>
			Effect.suspend(() => {
				tell(`the ledger ${operation}s the cash entry at sequence ${ID_BEYOND_NUMBER}`);
				return observed(ledgerWrites[operation]());
			}),
		writeOwned: (operation: OwnedWrite) =>
			Effect.suspend(() => {
				tell(`${operation} writes owned row 1/2`);
				return observed(ownedWrites[operation]());
			}),
		writeOwnedInsertForTakenId: () =>
			Effect.suspend(() => {
				tell("insertOrIgnore writes owned row 1/1, whose id 1 is taken");
				return observed(Effect.flatMap(owned(), ({ rows }) => rows.insertOrIgnore({ id: 1, name: "Ignored", ownerId: 1 })));
			}),
		writeRaw: () =>
			Effect.suspend(() => {
				tell("raw SQL inserts record 1 for list 1 and alice");
				return sql`insert into ${sql(buckets.tableName)} ("listId", owner, slug) values ('1', 'alice', 'raw')`;
			}),
	};
}
