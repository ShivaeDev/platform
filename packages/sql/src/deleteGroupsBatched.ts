import { Effect, Schema } from "effect";
import { PositiveRowCount, type PurgeLimits, runPurgeBatches } from "#batchedDelete.ts";
import { transact } from "#transact.ts";

export interface DeleteGroup<T> {
	readonly rowCount: number;
	readonly value: T;
}

export interface DeleteGroupsBatchedOptions<T, TSelectError, TSelectServices, TDeleteError, TDeleteServices> extends PurgeLimits {
	readonly delete: (group: T) => Effect.Effect<unknown, TDeleteError, TDeleteServices>;
	readonly select: (limit: number) => Effect.Effect<readonly DeleteGroup<T>[], TSelectError, TSelectServices>;
	readonly tableName: string;
}

export const deleteGroupsBatched = Effect.fn("Sql.deleteGroupsBatched")(function* <T, TSelectError, TSelectServices, TDeleteError, TDeleteServices>(
	options: DeleteGroupsBatchedOptions<T, TSelectError, TSelectServices, TDeleteError, TDeleteServices>,
) {
	return yield* runPurgeBatches(options.tableName, options, (limit) =>
		transact(
			Effect.gen(function* () {
				const candidates = yield* options.select(limit);
				const selected: T[] = [];
				let count = 0;
				for (const candidate of candidates) {
					const size = yield* Schema.decodeUnknownEffect(PositiveRowCount)(candidate.rowCount);
					if (size > limit - count) {
						break;
					}
					selected.push(candidate.value);
					count += size;
				}
				for (const group of selected) {
					yield* options.delete(group);
				}
				return { count, done: candidates.length === 0 };
			}),
		),
	).pipe(Effect.scoped);
});
