import { BigDecimal, DateTime, Effect, Exit, Option, Predicate } from "effect";
import * as Statement from "effect/sql/Statement";
import type { FindManyFilter } from "#repositoryFilter.ts";
import { transact } from "#transact.ts";
import type { Body, Step } from "./body.ts";
import { attempt, outcomeOf } from "./outcome.ts";
import { type QueryEngine, TABLES } from "./queryEngine.ts";
import { copyColumns, type Payment, payment } from "./queryModels.ts";
import { onSqlError, Rejected } from "./transactionEngine.ts";

type Engine = QueryEngine;
type Query<TMethod extends (...args: never) => unknown> = Parameters<TMethod>[0];

interface PlanNode {
	readonly "Actual Loops": number;
	readonly "Actual Rows": number;
	readonly "Node Type": string;
	readonly Plans?: readonly PlanNode[];
	readonly "Relation Name"?: string;
}

function planNodes(plan: PlanNode): readonly PlanNode[] {
	return [plan, ...(plan.Plans ?? []).flatMap(planNodes)];
}

export function shown(value: unknown): unknown {
	if (BigDecimal.isBigDecimal(value)) {
		return `decimal ${BigDecimal.format(BigDecimal.normalize(value))}`;
	}
	if (DateTime.isDateTime(value)) {
		return DateTime.formatIso(value);
	}
	if (Option.isOption(value)) {
		return Option.match(value, { onNone: () => "none", onSome: (some) => ({ some: shown(some) }) });
	}
	if (Array.isArray(value)) {
		return value.map(shown);
	}
	if (Predicate.isObject(value) && !(value instanceof Date)) {
		return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, shown(entry)]));
	}
	return value;
}

function described(value: unknown): string {
	return JSON.stringify(shown(value), (_, entry: unknown) => (typeof entry === "bigint" ? `${entry}n` : entry)) ?? "nothing";
}

export function queryVerbs(engine: Engine, tell: (line: string) => void) {
	const { sql, tables } = engine;
	function recorded<A, E, R>(effect: Effect.Effect<A, E, R>) {
		return Effect.suspend(() => {
			engine.statements.length = 0;
			return effect.pipe(
				Effect.provideService(Statement.CurrentTransformer, (statement) =>
					Effect.sync(() => {
						engine.statements.push(statement.compile());
						return statement;
					}),
				),
			);
		});
	}
	function read<A, E, R>(line: string, effect: Effect.Effect<A, E, R>) {
		return Effect.suspend(() => {
			tell(line);
			return Effect.map(attempt(recorded(effect)), (result) => {
				engine.last.result = shown(result);
				return engine.last.result;
			});
		});
	}
	function write<A, E, R>(line: string, effect: Effect.Effect<A, E, R>) {
		return Effect.suspend(() => {
			tell(line);
			return Effect.orDie(Effect.asVoid(effect));
		});
	}
	function stored<A, E, R>(effect: Effect.Effect<A, E, R>) {
		return Effect.map(Effect.orDie(effect), shown);
	}
	function domainKey(key: string) {
		const [name, ...rest] = key.split(":");
		const table = TABLES.find((candidate) => tables[candidate] === name);
		return table === undefined ? key : [table, ...rest].join(":");
	}
	return {
		aggregateResults: (query: Query<Engine["results"]["aggregate"]>) =>
			read(`the test results are aggregated ${described(query)}`, engine.results.aggregate(query)),
		announced: () => Effect.sync(() => engine.announced.map(domainKey)),
		boundParameters: () => Effect.sync(() => engine.statements.map(([, parameters]) => shown(parameters))),
		copies: () => stored(engine.copies.findMany({ orderBy: { direction: "asc", field: "copiedKey" }, select: ["copiedKey", "name", "amount"] })),
		copySelected: (query: Query<Engine["sources"]["select"]>) =>
			read(
				`the sources selected ${described(query)} are copied`,
				Effect.map(engine.copies.insertFromSelect(engine.sources.select(query), copyColumns), (copied) =>
					[...copied].sort((left, right) => left.copiedKey - right.copiedKey),
				),
			),
		copySelectedOrIgnore: (query: Query<Engine["sources"]["select"]>) =>
			read(
				`the sources selected ${described(query)} are copied, skipping copied keys that already exist`,
				Effect.map(engine.copies.insertFromSelectOrIgnore(engine.sources.select(query), copyColumns), (copied) =>
					[...copied].sort((left, right) => left.copiedKey - right.copiedKey),
				),
			),
		deleteLedgerEntries: (where: Query<Engine["ledger"]["delete"]>) =>
			read(`the ledger entries ${described(where)} are deleted`, engine.ledger.delete(where)),
		deletePartialRows: (where: Query<Engine["partialRows"]["delete"]>) =>
			read(`the partial rows ${described(where)} are deleted`, engine.partialRows.delete(where)),
		deletePayments: (where: Query<Engine["payments"]["delete"]>) =>
			read(`the payments ${described(where)} are deleted`, engine.payments.delete(where)),
		deleteSamples: (where: Query<Engine["samples"]["delete"]>) => read(`the samples ${described(where)} are deleted`, engine.samples.delete(where)),
		deleteSources: (where: Query<Engine["sources"]["delete"]>) => read(`the sources ${described(where)} are deleted`, engine.sources.delete(where)),
		findLines: (query: Query<Engine["lines"]["findMany"]>) => read(`the invoice lines are read ${described(query)}`, engine.lines.findMany(query)),
		findPartialRows: (query: Query<Engine["partialRows"]["findMany"]>) =>
			read(`the partial rows are read ${described(query)}`, engine.partialRows.findMany(query)),
		findPayments: (query: Query<Engine["payments"]["findMany"]>) =>
			read(`the payments are read ${described(query)}`, engine.payments.findMany(query)),
		findReport: (id: number) =>
			read(
				`the dashboard finds the report of pull request ${id}`,
				Effect.flatMap(dashboardReads(), (reads) => reads.findReport(id)),
			),
		findSamples: (query: Query<Engine["samples"]["findMany"]>) => read(`the samples are read ${described(query)}`, engine.samples.findMany(query)),
		findSources: (query: Query<Engine["sources"]["findMany"]>) => read(`the sources are read ${described(query)}`, engine.sources.findMany(query)),
		findUtcPayments: (query: Query<Engine["utcPayments"]["findMany"]>) =>
			read(`the payments are read through a DateTime.Utc model ${described(query)}`, engine.utcPayments.findMany(query)),
		inTransaction: <TStep extends Step, A>(body: Body<TStep, A>) =>
			Effect.suspend(() => {
				tell("a transaction begins");
				return Effect.map(Effect.exit(transact(Effect.gen(body), { onSqlError })), (exit) => {
					const ending = Exit.isSuccess(exit) ? "committed" : outcomeOf(exit);
					engine.endings.push(ending);
					return ending;
				});
			}),
		lastResult: () => Effect.sync(() => engine.last.result),
		latestLines: (query: Query<Engine["lines"]["latestPerGroup"]>) =>
			read(`the latest invoice lines per group are read ${described(query)}`, engine.lines.latestPerGroup(query)),
		latestRuns: (query: Query<Engine["runs"]["latestPerGroup"]>) =>
			read(`the latest runs per group are read ${described(query)}`, engine.runs.latestPerGroup(query)),
		ledgerEntries: () =>
			stored(
				engine.ledger.findMany({
					orderBy: [
						{ direction: "asc", field: "account" },
						{ direction: "asc", field: "sequence" },
					],
				}),
			),
		listPullRequests: (since: DateTime.Utc) =>
			read(
				`the dashboard lists pull requests updated since ${DateTime.formatIso(since)}`,
				Effect.flatMap(dashboardReads(), (reads) => reads.listPullRequests({ since })),
			),
		listReports: (since: DateTime.Utc) =>
			read(
				`the dashboard lists reported pull requests updated since ${DateTime.formatIso(since)}`,
				Effect.flatMap(dashboardReads(), (reads) => reads.listReports({ since })),
			),
		partialRows: () => stored(engine.partialRows.findMany({ orderBy: { direction: "asc", field: "id" }, select: ["a", "b"] })),
		readPlan: () =>
			Effect.gen(function* () {
				const [statement] = engine.statements;
				if (statement === undefined) {
					return yield* Effect.die(new Error("Read the runs before explaining the read"));
				}
				const [result] = yield* Effect.orDie(
					sql.unsafe<{ readonly "QUERY PLAN": readonly { readonly Plan: PlanNode }[] }>(
						`explain (analyze, format json) ${statement[0]}`,
						statement[1],
					),
				);
				const nodes = planNodes(result?.["QUERY PLAN"][0]?.Plan ?? { "Actual Loops": 0, "Actual Rows": 0, "Node Type": "none" });
				const scans = nodes.filter((node) => node["Relation Name"] === tables.runs && node["Actual Loops"] > 0);
				return {
					rankedByWindow: nodes.some((node) => node["Node Type"] === "WindowAgg"),
					rowsRead: scans.reduce((total, node) => total + node["Actual Rows"] * node["Actual Loops"], 0),
					scans: [...new Set(scans.map((node) => node["Node Type"]))],
				};
			}),
		rejects: () =>
			Effect.suspend(() => {
				tell("the transaction rejects its work");
				return Effect.fail(new Rejected({ message: "rejected" }));
			}),
		samples: () => stored(engine.samples.findMany({ orderBy: { direction: "asc", field: "id" } })),
		saveCopy: (copy: Query<Engine["copies"]["insert"]>) => write(`copy ${copy.copiedKey} "${copy.name}" already exists`, engine.copies.insert(copy)),
		saveLedgerEntries: (entries: Query<Engine["ledger"]["insertMany"]>) =>
			write(`ledger entries ${described(entries)} are saved`, engine.ledger.insertMany(entries)),
		saveLines: (lines: Query<Engine["lines"]["insertMany"]>) =>
			write(`invoice lines ${described(lines)} are saved in id order`, engine.lines.insertMany(lines)),
		savePartialRows: (saved: Query<Engine["partialRows"]["insertMany"]>) =>
			write(`partial rows ${described(saved)} are saved in id order`, engine.partialRows.insertMany(saved)),
		savePayments: (changes: readonly Partial<Query<Engine["payments"]["insert"]>>[]) =>
			write(
				`payments ${described(changes)} are saved, otherwise alike`,
				engine.payments.insertMany(changes.map((change) => ({ ...payment, ...change }))),
			),
		saveSamples: (saved: Query<Engine["samples"]["insertMany"]>) => write(`samples ${described(saved)} are saved`, engine.samples.insertMany(saved)),
		selectPartialRows: (query: Query<Engine["partialRows"]["select"]>) =>
			read(
				`the partial rows selected ${described(query)} are read through the prepared select`,
				Effect.flatMap(engine.partialRows.select(query).statement, (statement) => sql`${statement}`),
			),
		selectPayments: (where: FindManyFilter<typeof Payment>) =>
			read(`a select of the payments ${described(where)} is prepared`, Effect.as(engine.payments.select({ where }).statement, "prepared")),
		sources: () => stored(engine.sources.findMany({ orderBy: { direction: "asc", field: "sourceKey" } })),
		sqlTextContains: (text: string) => Effect.sync(() => engine.statements.some(([query]) => query.includes(text))),
		statementsSent: () => Effect.sync(() => engine.statements.length),
		storedCopyAmounts: () => stored(sql<{ readonly amount: unknown }>`select amount from ${sql(tables.copies)} order by "copiedKey"`),
		transactionEndings: () => Effect.sync(() => [...engine.endings]),
		watch: (...keys: readonly string[]) =>
			Effect.gen(function* () {
				tell(`a subscriber starts watching ${keys.join(", ")}`);
				for (const key of keys) {
					const [table, ...rest] = key.split(":");
					const known = TABLES.find((candidate) => candidate === table);
					if (known === undefined) {
						return yield* Effect.die(new Error(`${key} names no table of the query kit`));
					}
					const watched = [tables[known], ...rest].join(":");
					const stop = engine.reactivity.registerUnsafe([watched], () => engine.announced.push(watched));
					yield* Effect.addFinalizer(() => Effect.sync(stop));
				}
			}),
	};
	function dashboardReads() {
		const dashboard = engine.dashboard.reads;
		return dashboard === undefined ? Effect.die(new Error("Give the story dashboard rows first")) : Effect.succeed(dashboard.reads);
	}
}

export type QueryVerbs = ReturnType<typeof queryVerbs>;
