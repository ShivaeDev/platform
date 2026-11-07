import { expect } from "@effect/vitest";
import { sqlTransact } from "#rules/effect/sqlTransact.ts";
import { changeKeysResolve } from "#test/changeKeys.ts";
import { effectResolves } from "#test/effectPolicyFiles.ts";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";
import { transactionConsumer } from "#test/transactionConsumer.ts";

const REJECTED = [
	'yield* sql.withTransaction(Effect.gen(function* () { yield* notes.insert({ id: 1, name: "first" }); yield* notes.insert({ id: 2, name: "second" }); }));',
	'yield* notes.insert({ id: 1, name: "first" }).pipe(sql.withTransaction);',
	'const save = notes.insert({ id: 1, name: "first" }); yield* sql.withTransaction(save);',
	'const wrap = sql.withTransaction; yield* wrap(notes.update({ id: 1, name: "saved" }));',
	'yield* sql["withTransaction"](notes.delete(1));',
	'const { withTransaction: wrap } = sql; yield* wrap(notes.insertVoid({ id: 1, name: "first" }));',
	'const save = () => notes.insert({ id: 1, name: "first" }); yield* sql.withTransaction(save());',
	'const save = notes.insert; yield* sql.withTransaction(save({ id: 1, name: "first" }));',
	'const { insert: save } = notes; yield* sql.withTransaction(save({ id: 1, name: "first" }));',
	'yield* pipe(notes.insert({ id: 1, name: "first" }), sql.withTransaction);',
	'yield* Effect.void.pipe(Effect.andThen(notes.insert({ id: 1, name: "first" })), sql.withTransaction);',
	"yield* sql.withTransaction(transact(Effect.void, { onSqlError: (error) => error }));",
	"yield* sql.withTransaction(invalidateOnCommit([]));",
];

ruleStory.it(
	"effect/sql-transact names transact and locates native repository transactions across calls, pipes, aliases and helpers",
	[effectResolves(), changeKeysResolve(), repositoryHas(...REJECTED.map((code, index) => transactionConsumer(code, `src/rejected-${index}.ts`)))],
	function* ({ check }) {
		const findings = yield* check(sqlTransact);

		expect(findings).toEqual(
			REJECTED.map((_, index) => ({
				file: `src/rejected-${index}.ts`,
				line: 8,
				message:
					"Uses native sql.withTransaction around repository writes or change announcements. Begin the outer transaction with transact(effect, { onSqlError }) so changed keys follow its commit.",
			})).toSorted((left, right) => left.file.localeCompare(right.file)),
		);
	},
);

const ACCEPTED = [
	'yield* transact(Effect.gen(function* () { yield* notes.insert({ id: 1, name: "first" }); yield* notes.insert({ id: 2, name: "second" }); }), { onSqlError: (error) => error });',
	"yield* sql.withTransaction(sql`select 1`);",
	"yield* sql.withTransaction(notes.findMany());",
	'yield* notes.insert({ id: 1, name: "first" });',
	'const unrelated = { withTransaction: <A>(value: A) => value }; yield* unrelated.withTransaction(notes.insert({ id: 1, name: "first" }));',
	'yield* notes.findMany().pipe(sql.withTransaction, Effect.andThen(notes.insert({ id: 1, name: "after" })));',
	'yield* pipe(notes.findMany(), sql.withTransaction, Effect.andThen(notes.insert({ id: 1, name: "after" })));',
];

ruleStory.it(
	"effect/sql-transact accepts transact, standalone repository writes, native reads and unrelated transaction methods",
	[effectResolves(), changeKeysResolve(), repositoryHas(...ACCEPTED.map((code, index) => transactionConsumer(code, `src/accepted-${index}.ts`)))],
	function* ({ check }) {
		expect(yield* check(sqlTransact)).toEqual([]);
	},
);
