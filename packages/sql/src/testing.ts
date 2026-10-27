import { Data, Effect } from "effect";
import { SqlClient } from "effect/sql";
import { type BucketKey, type ItemKey, invalidationKeys } from "@shivaedev/changes/keys.ts";
import { ChangeDeclarations } from "#ChangeDeclarations.ts";
import { ChangeObserver, transact } from "#transact.ts";

export class UnannouncedWrites extends Data.TaggedError("UnannouncedWrites")<{ readonly tables: readonly string[] }> {}

export interface ChangeCoverage {
	readonly covers: Readonly<Record<string, readonly (ItemKey | BucketKey)[]>>;
}

interface TableWrites {
	readonly relid: number;
	readonly relname: string;
	readonly writes: number;
}

export const withChangeCoverage = Effect.fn("Changes.withChangeCoverage")(function* <A, E, R>(
	body: Effect.Effect<A, E, R>,
	options?: ChangeCoverage,
) {
	const observer = yield* ChangeObserver;
	const sql = yield* SqlClient.SqlClient;
	const named = new Set<unknown>();
	const declarations = new Map<string, { keys: Set<string>; rows: number }>();
	const outer = yield* ChangeDeclarations;
	const written = sql<TableWrites>`select relid, relname, (n_tup_ins + n_tup_upd + n_tup_del)::int as writes from pg_stat_xact_user_tables`;
	const checked = Effect.gen(function* () {
		const before = new Map((yield* written).map((row) => [row.relid, row.writes]));
		const result = yield* body;
		const missing = (yield* written).filter((row) => {
			const count = row.writes - (before.get(row.relid) ?? 0);
			if (count <= 0) {
				return false;
			}
			const automatic = declarations.get(row.relname);
			const explicit = options?.covers[row.relname] ?? [];
			const expected = [...(automatic?.keys ?? []), ...invalidationKeys(explicit)];
			return (count > (automatic?.rows ?? 0) && explicit.length === 0) || expected.some((key) => !named.has(key));
		});
		if (missing.length > 0) {
			return yield* Effect.fail(new UnannouncedWrites({ tables: missing.map((row) => row.relname).sort() }));
		}
		return result;
	});
	return yield* checked.pipe(
		transact({ onSqlError: (error) => error }),
		Effect.provideService(ChangeDeclarations, {
			declare: (table, keys, rows) =>
				Effect.andThen(
					Effect.sync(() => {
						const entry = declarations.get(table) ?? { keys: new Set<string>(), rows: 0 };
						for (const key of keys) {
							entry.keys.add(key);
						}
						entry.rows += rows;
						declarations.set(table, entry);
					}),
					outer.declare(table, keys, rows),
				),
		}),
		Effect.provideService(ChangeObserver, (event) => {
			if (event._tag === "Recorded") {
				for (const key of event.changes) {
					named.add(key);
				}
			}
			return observer(event);
		}),
	);
});

export class PublishedKeysMismatch extends Data.TaggedError("PublishedKeysMismatch")<{
	readonly expected: readonly unknown[];
	readonly actual: readonly unknown[];
}> {
	override get message() {
		return `Expected published keys ${JSON.stringify(this.expected)}; actual published keys ${JSON.stringify(this.actual)}`;
	}
}

export function expectPublished(keys: readonly unknown[]) {
	return Effect.fn("Changes.expectPublished")(function* <A, E, R>(body: Effect.Effect<A, E, R>) {
		const observer = yield* ChangeObserver;
		const actual = new Set<unknown>();
		const result = yield* body.pipe(
			Effect.provideService(ChangeObserver, (event) => {
				if (event._tag === "Published") {
					for (const key of event.changes) {
						actual.add(key);
					}
				}
				return observer(event);
			}),
		);
		const expected = new Set(keys);
		if (actual.size !== expected.size || [...expected].some((key) => !actual.has(key))) {
			return yield* Effect.fail(new PublishedKeysMismatch({ actual: [...actual], expected: [...expected] }));
		}
		return result;
	});
}
