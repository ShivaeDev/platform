import { Effect } from "effect";
import type * as Reactivity from "effect/reactivity/Reactivity";
import { SqlClient } from "effect/sql";
import { type StoryKit, storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { makeRepository } from "#repository.ts";
import { transact } from "#transact.ts";
import type { Body, Step } from "./body.ts";
import { onPostgres, onSqlite } from "./engines.ts";
import { InvoiceLine, Label, LabelPrefix } from "./invoiceModels.ts";
import { attempt, endingOf } from "./outcome.ts";
import type { RecordedLogs } from "./RecordedLogs.ts";
import type { Database } from "./transactionEngine.ts";
import { ownTableIn, uniqueTable } from "./writeTables.ts";

const LABEL_PREFIX = "db:";

interface LineInput {
	readonly amount: number;
	readonly note?: string | null;
}

function invoiceEngine(database: Database) {
	return Effect.fnUntraced(function* () {
		const sql = yield* SqlClient.SqlClient;
		const tables = { labels: uniqueTable("invoice_labels"), lines: uniqueTable("invoice_lines") };
		const id = database === "PostgreSQL" ? sql`id integer generated always as identity primary key` : sql`id integer primary key`;
		yield* ownTableIn(database, sql, tables.lines, sql`${id}, name text not null, amount text not null, note text`);
		yield* ownTableIn(database, sql, tables.labels, sql`id integer primary key, name text not null`);
		return {
			ids: new Map<string, number>(),
			labels: yield* makeRepository(Label, { idColumn: "id", spanPrefix: "Label", tableName: tables.labels }),
			lines: yield* makeRepository(InvoiceLine, { idColumn: "id", spanPrefix: "InvoiceLine", tableName: tables.lines }),
			sql,
			tables,
		};
	});
}

type InvoiceEngine = Effect.Success<ReturnType<ReturnType<typeof invoiceEngine>>>;
type Lines = InvoiceEngine["lines"];

function described(line: string, { amount, note = null }: LineInput) {
	return `${line} (${amount}${note === null ? ", no note" : `, ${note}`})`;
}

function idOf(engine: InvoiceEngine, line: string) {
	const id = engine.ids.get(line);
	return id === undefined ? Effect.die(new Error(`Insert the line ${line} first`)) : Effect.succeed(id);
}

function insertLine(engine: InvoiceEngine, line: string, input: LineInput) {
	return Effect.map(engine.lines.insert({ amount: input.amount, name: line, note: input.note ?? null }), (saved) => {
		engine.ids.set(line, saved.id);
	});
}

function invoiceVerbs(engine: InvoiceEngine, tell: (line: string) => void) {
	const { labels, lines, sql, tables } = engine;
	const withPrefix = Effect.provideService(LabelPrefix, LABEL_PREFIX);
	function rewrite(write: "update" | "updateVoid") {
		return (line: string, changes: Partial<LineInput> & { readonly name?: string }) =>
			Effect.gen(function* () {
				tell(`the line ${line} is changed with ${write} to ${JSON.stringify(changes)}`);
				const current = yield* lines.findById(yield* idOf(engine, line));
				yield* lines[write]({ ...current, ...changes });
			});
	}
	return {
		deleteLine: (line: string) =>
			Effect.gen(function* () {
				tell(`the line ${line} is deleted`);
				yield* lines.delete(yield* idOf(engine, line));
			}),
		findLines: (query: Parameters<Lines["findMany"]>[0]) =>
			Effect.suspend(() => {
				tell(`findMany runs ${JSON.stringify(query)}`);
				return attempt(lines.findMany(query));
			}),
		inFailingTransaction: <TStep extends Step, A>(body: Body<TStep, A>) =>
			Effect.suspend(() => {
				tell("a transaction begins, and fails once its body has run");
				return endingOf(transact(Effect.andThen(Effect.gen(body), Effect.fail("cancelled")), { onSqlError: (error) => error }));
			}),
		insertLabel: (label: string) =>
			Effect.suspend(() => {
				tell(`the label ${label} is inserted while the label codec reads the prefix ${LABEL_PREFIX} from the caller's environment`);
				return withPrefix(labels.insert({ id: 1, name: label }));
			}),
		insertLine: (line: string, input: LineInput) =>
			Effect.suspend(() => {
				tell(`the line ${described(line, input)} is inserted`);
				return insertLine(engine, line, input);
			}),
		labelsNamed: (label: string) => withPrefix(attempt(labels.findMany({ select: ["name"], where: { name: label } }))),
		line: (line: string) => Effect.flatMap(idOf(engine, line), (id) => attempt(lines.findById(id))),
		lineNames: () =>
			Effect.map(lines.findMany({ orderBy: { direction: "asc", field: "id" }, select: ["name"] }), (rows) => rows.map(({ name }) => name)),
		storedAmounts: () =>
			Effect.map(sql<{ readonly amount: unknown }>`select amount from ${sql(tables.lines)} order by id`, (rows) => rows.map(({ amount }) => amount)),
		storedLabelNames: () =>
			Effect.map(sql<{ readonly name: unknown }>`select name from ${sql(tables.labels)}`, (rows) => rows.map(({ name }) => name)),
		updateLine: rewrite("update"),
		updateLineVoid: rewrite("updateVoid"),
	};
}

function definition(database: Database) {
	return {
		create: invoiceEngine(database),
		name: `${database} invoice lines`,
		stages: ["lines"],
		verbs: (engine: InvoiceEngine, story: { readonly tell: (line: string) => void }) => invoiceVerbs(engine, story.tell),
	} as const;
}

export const postgresInvoices = storyKit({ ...onPostgres, ...definition("PostgreSQL") });
export const sqliteInvoices = storyKit({ ...onSqlite, ...definition("SQLite") });

type Kit = StoryKit<InvoiceEngine, "lines", ReturnType<typeof invoiceVerbs>, never, SqlClient.SqlClient | Reactivity.Reactivity | RecordedLogs>;

export const invoiceKits: readonly Kit[] = [postgresInvoices, sqliteInvoices];

export function linesExist(kit: Kit, lines: Readonly<Record<string, LineInput>>) {
	const listed = Object.entries(lines).map(([line, input]) => described(line, input));
	return kit.trait("lines", `the lines ${listed.join(", ")} exist`, (engine) =>
		Effect.forEach(Object.entries(lines), ([line, input]) => insertLine(engine, line, input), { discard: true }),
	);
}

export function storedAmountIsText(kit: Kit, amount: string) {
	return kit.trait(
		"lines",
		`a line whose amount is the text "${amount}" was written by raw SQL, since the repository cannot write an amount its codec rejects`,
		({ sql, tables }) => sql`insert into ${sql(tables.lines)} (name, amount) values ('Imported', ${amount})`.pipe(Effect.asVoid),
	);
}
