import { Effect, Option } from "effect";
import type { SqlClient } from "effect/sql";
import type { Fragment } from "effect/sql/Statement";
import * as Statement from "effect/sql/Statement";
import { endingOf } from "./outcome.ts";

export function uniqueTable(prefix: string) {
	return `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`;
}

export function ownTable(sql: SqlClient.SqlClient, name: string, columns: Fragment) {
	return Effect.acquireRelease(sql`create table ${sql(name)} (${columns})`, () => Effect.orDie(sql`drop table if exists ${sql(name)}`));
}

export function ownTableIn(database: "PostgreSQL" | "SQLite", sql: SqlClient.SqlClient, name: string, columns: Fragment) {
	return database === "PostgreSQL" ? ownTable(sql, name, columns) : sql`create table ${sql(name)} (${columns})`;
}

export function insertedOrIgnored<A>(row: Option.Option<A>) {
	return Option.match(row, { onNone: () => "ignored" as const, onSome: (value) => value });
}

export interface StatementLog {
	readonly statements: (readonly [string, readonly unknown[]])[];
}

export function statementLog(): StatementLog {
	return { statements: [] };
}

export interface Records {
	readonly endings: string[];
	readonly returned: unknown[];
}

export function records(): Records {
	return { endings: [], returned: [] };
}

export function recorded<R>({ endings }: Records, ending: Effect.Effect<string, never, R>) {
	return Effect.tap(ending, (line) => Effect.sync(() => endings.push(line)));
}

export function kept<A, E, R>(log: Records, effect: Effect.Effect<A, E, R>, print: (value: A) => unknown) {
	return recorded(log, endingOf(Effect.tap(effect, (value) => Effect.sync(() => log.returned.push(print(value))))));
}

export function readEndings({ endings }: Records) {
	return Effect.sync(() => [...endings]);
}

export function readReturned({ returned }: Records) {
	return Effect.sync(() => [...returned]);
}

export function recording<A, E, R>(log: StatementLog, effect: Effect.Effect<A, E, R>) {
	return effect.pipe(
		Effect.provideService(Statement.CurrentTransformer, (statement) =>
			Effect.sync(() => {
				log.statements.push(statement.compile());
				return statement;
			}),
		),
	);
}

export function statementKinds(log: StatementLog) {
	return Effect.sync(() =>
		log.statements
			.map(([text]) => text.split(" ")[0]?.toLowerCase() ?? "")
			.filter((kind) => kind === "update" || kind === "select" || kind === "insert"),
	);
}
