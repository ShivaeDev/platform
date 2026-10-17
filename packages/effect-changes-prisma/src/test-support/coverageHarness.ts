import { readFile } from "node:fs/promises";
import { Effect } from "effect";
import { checkCoverage } from "#coverage.ts";
import { tablesOf, tableWrites, writtenTables } from "#tables.ts";
import { type Change, models } from "./changes.ts";
import type { PrismaEngine } from "./prismaEngine.ts";

export interface CoverageSettings {
	readonly covers: (model: string, change: Change) => boolean;
	readonly tables: ReadonlyMap<string, string>;
}

const domains: Readonly<Record<string, string>> = { Invoice: "invoices", Membership: "memberships", Order: "orders" };

export function coverageSettings(schema: string): CoverageSettings {
	return { covers: (model, change) => domains[model] === change.domain, tables: tablesOf(schema) };
}

export const schemaText = Effect.promise(() => readFile(new URL("./prisma/schema.prisma", import.meta.url), "utf8"));

class RolledBack {
	readonly written: readonly string[];
	constructor(written: readonly string[]) {
		this.written = written;
	}
}

export const coverageOf = Effect.fnUntraced(function* <A, E>(engine: PrismaEngine, body: Effect.Effect<A, E>) {
	const { client, binding, coverage } = engine;
	if (coverage === undefined) {
		throw new Error("Configure coverage checks with a story trait");
	}
	const { changes, observations, observe, unnamed } = binding;
	const context = yield* Effect.context<never>();
	const written = yield* Effect.promise(() =>
		client
			.$transaction(async (tx) => {
				const since = await Effect.runPromise(tableWrites(tx));
				await Effect.runPromiseWith(context)(body.pipe(Effect.provideService(changes.Client, tx), observe));
				throw new RolledBack(await Effect.runPromise(writtenTables(tx, since)));
			})
			.catch((error: unknown) => {
				if (error instanceof RolledBack) {
					return error.written;
				}
				throw error;
			}),
	);
	const input = { ...coverage, models, observations, unnamed, written };
	return { input, violations: checkCoverage(input), written };
});
