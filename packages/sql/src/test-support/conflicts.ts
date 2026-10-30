import { Effect, Option } from "effect";
import { SqlClient } from "effect/sql";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { makeRepository } from "#repository.ts";
import { transact } from "#transact.ts";
import type { Body, Step } from "./body.ts";
import { Account, KeyPrefix, Reading } from "./conflictModels.ts";
import { onPostgres } from "./engines.ts";
import { attempt, endingOf, failureOf } from "./outcome.ts";
import { kept, ownTable, readEndings, readReturned, recorded, records, uniqueTable } from "./writeTables.ts";

const KEY_PREFIX = "prefix:";

export interface AccountInput {
	readonly amount: number;
	readonly email: string;
	readonly origin: string;
}

export type AccountColumn = "amount" | "email" | "externalKey" | "id" | "missing" | "note" | "origin";

const conflictEngine = Effect.fnUntraced(function* () {
	const sql = yield* SqlClient.SqlClient;
	const tables = { accounts: uniqueTable("conflict_accounts"), readings: uniqueTable("conflict_readings") };
	yield* ownTable(
		sql,
		tables.accounts,
		sql`id integer generated always as identity primary key, "externalKey" text not null unique, email text not null unique,
			amount text not null, origin text not null, note text, "createdAt" timestamptz not null default now()`,
	);
	yield* ownTable(
		sql,
		tables.readings,
		sql`source text not null, sequence text not null, amount text not null, label text not null, primary key (source, sequence)`,
	);
	return {
		accounts: yield* makeRepository(Account, { conflictColumns: ["externalKey"], idColumn: "id", spanPrefix: "Account", tableName: tables.accounts }),
		readings: yield* makeRepository(Reading, {
			conflictColumns: ["source", "sequence"],
			idColumn: ["source", "sequence"],
			spanPrefix: "Reading",
			tableName: tables.readings,
		}),
		records: records(),
		sql,
		tables,
	};
});

type ConflictEngine = Effect.Success<ReturnType<typeof conflictEngine>>;

function printedAccount({ amount, createdAt, email, externalKey, id, origin }: Account) {
	return { amount, createdAt: createdAt instanceof Date ? "a database-generated date" : createdAt, email, externalKey, id, origin };
}

function readingKey(source: string, sequence: number) {
	return `${source}/${sequence}`;
}

function prefixed<A, E, R>(effect: Effect.Effect<A, E, R>) {
	return Effect.provideService(effect, KeyPrefix, KEY_PREFIX);
}

function parsed<A>(json: string): A {
	return JSON.parse(json);
}

function conflictVerbs({ accounts, readings, records: log, sql, tables }: ConflictEngine, tell: (line: string) => void) {
	function record<R>(ending: Effect.Effect<string, never, R>) {
		return recorded(log, ending);
	}
	function keep<A, E, R>(effect: Effect.Effect<A, E, R>, print: (value: A) => unknown) {
		return kept(log, effect, print);
	}
	return {
		account: () => prefixed(Effect.map(attempt(accounts.findById(1)), (row) => (typeof row === "string" ? row : printedAccount(row)))),
		deleteReading: (source: string, sequence: number) =>
			Effect.suspend(() => {
				tell(`delete removes reading ${readingKey(source, sequence)}`);
				return record(endingOf(readings.delete({ sequence, source })));
			}),
		endings: () => readEndings(log),
		findReadingWithoutSequence: () =>
			Effect.suspend(() => {
				tell("findById looks up a reading by its source alone");
				return record(endingOf(readings.findById(parsed('{"source":"meter"}'))));
			}),
		inFailingTransaction: <TStep extends Step, A>(body: Body<TStep, A>) =>
			Effect.suspend(() => {
				tell("a transaction begins, and fails once its body has run");
				return record(endingOf(transact(Effect.andThen(Effect.gen(body), Effect.fail("cancelled")), { onSqlError: (error) => error })));
			}),
		insertAccountOrIgnore: (externalKey: string, input: AccountInput) =>
			Effect.suspend(() => {
				tell(`insertOrIgnore offers account ${externalKey} for ${input.email} with amount ${input.amount}`);
				return prefixed(keep(accounts.insertOrIgnore({ ...input, externalKey }), Option.match({ onNone: () => "ignored", onSome: printedAccount })));
			}),
		insertReadingOrIgnore: (source: string, sequence: number, amount: number) =>
			Effect.suspend(() => {
				tell(`insertOrIgnore offers reading ${readingKey(source, sequence)} with amount ${amount}`);
				return record(
					Effect.match(readings.insertOrIgnore({ amount, label: "offered", sequence, source }), {
						onFailure: (error) => `failed with ${failureOf(error)}`,
						onSuccess: Option.match({ onNone: () => "ignored", onSome: () => "inserted" }),
					}),
				);
			}),
		insertWithUnknownConflictColumn: (externalKey: string, input: AccountInput) =>
			Effect.gen(function* () {
				tell(`a repository whose conflict column is missing from the model offers account ${externalKey}`);
				const invalid = yield* makeRepository(Account, {
					conflictColumns: parsed<readonly ["externalKey"]>('["missing"]'),
					idColumn: "id",
					spanPrefix: "InvalidAccount",
					tableName: tables.accounts,
				});
				return yield* prefixed(record(endingOf(invalid.insertOrIgnore({ ...input, externalKey }))));
			}),
		reading: (source: string, sequence: number) =>
			Effect.map(attempt(readings.findById({ sequence, source })), (row) =>
				typeof row === "string" ? row : { amount: row.amount, label: row.label },
			),
		readingKeys: () =>
			Effect.map(
				readings.findMany({
					orderBy: [
						{ direction: "asc", field: "source" },
						{ direction: "asc", field: "sequence" },
					],
				}),
				(rows) => rows.map(({ sequence, source }) => readingKey(source, sequence)),
			),
		returned: () => readReturned(log),
		storedAccounts: () => sql`select "externalKey", amount, origin from ${sql(tables.accounts)} order by id`,
		updateReading: (source: string, sequence: number, amount: number, write: "update" | "updateVoid") =>
			Effect.suspend(() => {
				tell(`${write} sets reading ${readingKey(source, sequence)} to amount ${amount}`);
				return record(endingOf(readings[write]({ amount, label: "original", sequence, source })));
			}),
		upsertAccount: (externalKey: string, input: AccountInput, updateColumns: readonly AccountColumn[] = ["amount"]) =>
			Effect.suspend(() => {
				tell(
					`upsert offers account ${externalKey} for ${input.email} with amount ${input.amount}, updating ${updateColumns.join(", ") || "no columns"}`,
				);
				const columns = parsed<readonly ["amount"]>(JSON.stringify(updateColumns));
				return prefixed(
					keep(accounts.upsert({ ...input, externalKey }, { updateColumns: columns }), ({ inserted, row }) => ({
						inserted,
						row: printedAccount(row),
					})),
				);
			}),
		upsertReading: (source: string, sequence: number, amount: number, label: string) =>
			Effect.suspend(() => {
				tell(`upsert offers reading ${readingKey(source, sequence)} with amount ${amount} and label ${label}, updating amount`);
				return keep(readings.upsert({ amount, label, sequence, source }, { updateColumns: ["amount"] }), ({ inserted, row }) => ({
					inserted,
					row: { amount: row.amount, label: row.label },
				}));
			}),
		writeAccountWithTextAmount: (write: "insertOrIgnore" | "upsert") =>
			Effect.suspend(() => {
				tell(`${write} offers account two whose amount is the text "bad"`);
				const input = parsed<typeof Account.insert.Type>('{"amount":"bad","email":"two@example.test","externalKey":"two","origin":"import"}');
				return prefixed(
					record(write === "upsert" ? endingOf(accounts.upsert(input, { updateColumns: ["amount"] })) : endingOf(accounts.insertOrIgnore(input))),
				);
			}),
	};
}

export const conflicts = storyKit({
	...onPostgres,
	create: conflictEngine,
	name: "PostgreSQL conflict writes",
	stages: ["rows"],
	verbs: (engine, story) => conflictVerbs(engine, story.tell),
});

export function accountExists(externalKey: string, input: AccountInput) {
	return conflicts.trait(
		"rows",
		`account ${externalKey} for ${input.email} with amount ${input.amount} from ${input.origin} exists, its key stored as ${KEY_PREFIX}${externalKey}`,
		({ accounts }) => Effect.provideService(accounts.insertVoid({ ...input, externalKey }), KeyPrefix, KEY_PREFIX),
	);
}

export function readingsExist(rows: readonly (readonly [string, number, number])[]) {
	const listed = rows.map(([source, sequence, amount]) => `${readingKey(source, sequence)} with amount ${amount}`).join(", ");
	return conflicts.trait("rows", `readings labelled original exist: ${listed}`, ({ readings }) =>
		Effect.forEach(rows, ([source, sequence, amount]) => readings.insertVoid({ amount, label: "original", sequence, source }), { discard: true }),
	);
}
